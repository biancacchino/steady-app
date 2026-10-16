// Settings and export API (PRD 5.7 and 7). Mounted behind the session check in app.ts.
// Every query filters by the session's user id.
import { db } from "@steady/db";
import { journalEntry, user } from "@steady/db/schema/index";
import { dietPlan, referralLog, result } from "@steady/db/schema/screening";
import { summary } from "@steady/db/schema/summary";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Variables } from "./app";

const MAX_LINK_LENGTH = 300;
const INVALID_LINK = "Enter an email address or a link that starts with https://.";

// An email address becomes a mailto link; a link must be https. Nothing else is stored, so the
// referral page can open it safely (no javascript: or data: links, no header injection).
// ponytail: a simple email shape, since the real check is the user sending a message to it.
const careTeamLink = z
  .string()
  .nullable()
  .transform((value) => value?.trim() || null)
  .transform((value, ctx) => {
    if (value === null) return null;
    if (value.length > MAX_LINK_LENGTH || /\s/.test(value) || [...value].some((ch) => ch < " ")) {
      ctx.addIssue({ code: "custom", message: INVALID_LINK });
      return z.NEVER;
    }
    // A pasted mailto: link is fine; what follows it is checked as an address.
    const address = value.replace(/^mailto:/i, "");
    if (/^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/.test(address)) return `mailto:${address}`;
    try {
      const url = new URL(value);
      // No password inside the link: a pasted login link would be stored and shown back.
      if (url.protocol === "https:" && url.hostname && !url.username && !url.password) return value;
    } catch {}
    ctx.addIssue({ code: "custom", message: INVALID_LINK });
    return z.NEVER;
  });

export const settings = new Hono<{ Variables: Variables }>()
  .put("/care-team", async (c) => {
    const body = z
      .object({ link: careTeamLink })
      .strict()
      .safeParse(await c.req.json().catch(() => undefined));
    if (!body.success) return c.json({ error: INVALID_LINK }, 400);
    await db
      .update(user)
      .set({ careTeamLink: body.data.link })
      .where(eq(user.id, c.get("user").id));
    return c.json({ link: body.data.link });
  })

  // All of the user's data as one JSON file. A POST, so a link on another site cannot start it.
  // Credentials are left out on purpose: it reads none of the sign-in tables (`account`, `session`),
  // and the screener's numeric score is never shown to the user, so it is not exported either.
  .post("/export", async (c) => {
    const id = c.get("user").id;
    const [profile] = await db
      .select({
        name: user.name,
        email: user.email,
        careTeamLink: user.careTeamLink,
        ageConfirmedAt: user.ageConfirmedAt,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, id));
    const [entries, summaries, screenerResults, plan, referrals] = await Promise.all([
      db
        .select({
          occurredAt: journalEntry.occurredAt,
          timeZone: journalEntry.timeZone,
          food: journalEntry.food,
          symptom: journalEntry.symptom,
          severity: journalEntry.severity,
          context: journalEntry.context,
          flagged: journalEntry.flagged,
          createdAt: journalEntry.createdAt,
        })
        .from(journalEntry)
        .where(eq(journalEntry.userId, id))
        .orderBy(asc(journalEntry.occurredAt)),
      db
        .select({
          rangeStart: summary.rangeStart,
          rangeEnd: summary.rangeEnd,
          providerName: summary.providerName,
          appointmentDate: summary.appointmentDate,
          questions: summary.questions,
          reviewedAt: summary.reviewedAt,
          snapshot: summary.snapshot,
          exportedAt: summary.exportedAt,
          createdAt: summary.createdAt,
        })
        .from(summary)
        .where(eq(summary.userId, id))
        .orderBy(asc(summary.createdAt)),
      db
        .select({
          instrumentId: result.instrumentId,
          instrumentVersion: result.instrumentVersion,
          answers: result.answers,
          tier: result.tier,
          completedAt: result.completedAt,
        })
        .from(result)
        .where(eq(result.userId, id))
        .orderBy(asc(result.completedAt)),
      db
        .select({
          startedAt: dietPlan.startedAt,
          eliminationEndsAt: dietPlan.eliminationEndsAt,
          status: dietPlan.status,
        })
        .from(dietPlan)
        .where(eq(dietPlan.userId, id)),
      db
        .select({ shownAt: referralLog.shownAt })
        .from(referralLog)
        .where(eq(referralLog.userId, id))
        .orderBy(asc(referralLog.shownAt)),
    ]);
    const now = new Date();
    c.header("content-type", "application/json");
    c.header(
      "content-disposition",
      `attachment; filename="steady-export-${now.toISOString().slice(0, 10)}.json"`,
    );
    return c.body(
      JSON.stringify(
        {
          exportedAt: now,
          profile,
          entries,
          summaries,
          screenerResults,
          dietPlan: plan[0] ?? null,
          referrals,
        },
        null,
        2,
      ),
    );
  });
