// Appointment summary API (PRD 5.4, milestone 2). Mounted behind the session check in app.ts.
// Every query filters by the session's user id in the same `where` (milestone 1, decision 6), so
// another user's summary and a missing one both answer 404.
import { db } from "@steady/db";
import { cleanText } from "@steady/db/schema/journal";
import {
  MAX_PROVIDER_LENGTH,
  MAX_QUESTION_LENGTH,
  MAX_QUESTIONS,
  summary,
} from "@steady/db/schema/summary";
import { and, eq, isNotNull, isNull, max } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Variables } from "./app";
import { entriesInRange, range } from "./entries";
import { observe } from "./observations";
import {
  buildSnapshot,
  headerLines,
  keptEntries,
  type Snapshot,
  suggestQuestions,
  summaryText,
} from "./summary-content";
import { renderPdf } from "./summary-pdf";

const NOT_FOUND = "This summary could not be found.";
const NOT_REVIEWED = "Review this summary before exporting it.";
const INVALID = "Some of this summary could not be saved.";
const DEFAULT_DAYS = 30;

const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const preview = z.object({ from: z.iso.date().optional(), to: z.iso.date() });

// Strict, so a request cannot set fields like userId, reviewedAt, or snapshot.
const draftBody = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    providerName: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v ? cleanText(v) : null))
      .refine((v) => v === null || v.length <= MAX_PROVIDER_LENGTH),
    appointmentDate: z.iso.date().nullable().optional(),
    excludedEntryIds: z.array(z.uuid()).max(1000).default([]),
    questions: z.array(z.string().max(MAX_QUESTION_LENGTH)).max(MAX_QUESTIONS).default([]),
  })
  .strict()
  .refine((body) => range.safeParse(body).success);

const summaryId = z.uuid();

export const summaries = new Hono<{ Variables: Variables }>()
  // What a summary for this range would say. `to` is the browser's today; without `from`, the range
  // starts the day after the last exported summary, or covers the 30 days ending on `to` (PRD 5.4).
  .get("/preview", async (c) => {
    const query = preview.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "Choose a valid date range." }, 400);
    const userId = c.get("user").id;
    const { to } = query.data;
    let from = query.data.from;
    if (!from) {
      const [last] = await db
        .select({ end: max(summary.rangeEnd) })
        .from(summary)
        .where(and(eq(summary.userId, userId), isNotNull(summary.exportedAt)));
      const next = last?.end ? addDays(last.end, 1) : null;
      from = next && next <= to ? next : addDays(to, 1 - DEFAULT_DAYS);
    }
    if (!range.safeParse({ from, to }).success) {
      return c.json({ error: "Choose a valid date range." }, 400);
    }
    const rows = await entriesInRange(userId, from, to);
    const flagged = rows.filter((row) => row.flagged);
    return c.json({
      from,
      to,
      observations: observe(rows),
      flagged,
      questions: suggestQuestions(rows, flagged.length),
    });
  })

  // The PDF preview: what export would send for these choices, built by the same code as the
  // reviewed snapshot so the preview and the file cannot differ. Saves nothing.
  .post("/draft", async (c) => {
    const body = draftBody.safeParse(await c.req.json().catch(() => undefined));
    if (!body.success) return c.json({ error: INVALID }, 400);
    const { from, to, providerName, appointmentDate, excludedEntryIds, questions } = body.data;
    const entries = await entriesInRange(c.get("user").id, from, to);
    const snapshot = buildSnapshot({
      entries,
      rangeStart: from,
      rangeEnd: to,
      providerName,
      appointmentDate: appointmentDate ?? null,
      excludedEntryIds,
      questions,
    });
    // Suggestions for what is left after the user's choices, so the screen can refresh the ones
    // the user has not edited.
    const kept = keptEntries(entries, excludedEntryIds);
    const suggested = suggestQuestions(kept, kept.filter((e) => e.flagged).length);
    return c.json({ header: headerLines(snapshot), snapshot, suggested });
  })

  // Saves the user's choices as a draft. Nothing can be exported until it is reviewed.
  .post("/", async (c) => {
    const body = draftBody.safeParse(await c.req.json().catch(() => undefined));
    if (!body.success) return c.json({ error: INVALID }, 400);
    const { from, to, providerName, appointmentDate, excludedEntryIds, questions } = body.data;
    const [row] = await db
      .insert(summary)
      .values({
        userId: c.get("user").id,
        rangeStart: from,
        rangeEnd: to,
        providerName,
        appointmentDate: appointmentDate ?? null,
        excludedEntryIds,
        questions,
      })
      .returning({ id: summary.id });
    return c.json(row, 201);
  })

  // Marks the summary reviewed and saves exactly what export will send (non-negotiable 4).
  .post("/:id/review", async (c) => {
    const id = summaryId.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: NOT_FOUND }, 404);
    const userId = c.get("user").id;
    const [row] = await db
      .select()
      .from(summary)
      .where(and(eq(summary.id, id.data), eq(summary.userId, userId)));
    if (!row) return c.json({ error: NOT_FOUND }, 404);
    if (row.reviewedAt) return c.json({ error: "This summary was already reviewed." }, 409);
    const snapshot = buildSnapshot({
      entries: await entriesInRange(userId, row.rangeStart, row.rangeEnd),
      rangeStart: row.rangeStart,
      rangeEnd: row.rangeEnd,
      providerName: row.providerName,
      appointmentDate: row.appointmentDate,
      excludedEntryIds: row.excludedEntryIds,
      questions: row.questions,
    });
    // `reviewed_at is null` again here, so two reviews at once cannot both save a snapshot.
    const [reviewed] = await db
      .update(summary)
      .set({ reviewedAt: new Date(), snapshot })
      .where(and(eq(summary.id, row.id), eq(summary.userId, userId), isNull(summary.reviewedAt)))
      .returning({ id: summary.id });
    if (!reviewed) return c.json({ error: "This summary was already reviewed." }, 409);
    return c.json({ id: reviewed.id });
  })

  // Export: POST, not GET, so a link on another site cannot start one. Only a reviewed summary,
  // and only its snapshot (PRD 5.4: 409 and no file otherwise).
  .post("/:id/:kind{pdf|text}", async (c) => {
    const id = summaryId.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: NOT_FOUND }, 404);
    const userId = c.get("user").id;
    const mine = and(eq(summary.id, id.data), eq(summary.userId, userId));
    const [row] = await db
      .select({
        reviewedAt: summary.reviewedAt,
        snapshot: summary.snapshot,
        rangeEnd: summary.rangeEnd,
      })
      .from(summary)
      .where(mine);
    if (!row) return c.json({ error: NOT_FOUND }, 404);
    if (!row.reviewedAt) return c.json({ error: NOT_REVIEWED }, 409);
    const snapshot = row.snapshot as Snapshot;
    const kind = c.req.param("kind");
    // Built before it is marked exported, so a failed PDF does not move the next default range.
    const pdf = kind === "pdf" ? await renderPdf(snapshot) : null;
    await db.update(summary).set({ exportedAt: new Date() }).where(mine);
    if (!pdf) return c.text(summaryText(snapshot));
    c.header("content-type", "application/pdf");
    c.header(
      "content-disposition",
      `attachment; filename="appointment-summary-${row.rangeEnd}.pdf"`,
    );
    return c.body(new Uint8Array(pdf));
  });
