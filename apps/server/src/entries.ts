// Journal entries API (PRD 5.2, milestone 1 step 3). Mounted behind the session check in app.ts.
// Every query filters by the session's user id in the same `where` (decision 6), so another
// user's entry and a missing entry both come back as "no row" and answer 404.
import { db } from "@steady/db";
import {
  CONTEXTS,
  cleanText,
  journalEntry,
  MAX_TEXT_LENGTH,
  SEVERITIES,
  textLength,
  toTimeZone,
} from "@steady/db/schema/journal";
import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Variables } from "./app";
import { observe, symptomsIn } from "./observations";

const EMPTY = "This entry is empty. Add what you ate, a symptom, or both.";
const INVALID = "Some of this entry could not be saved. Check it and try again.";
const NOT_FOUND = "This entry could not be found.";
const MAX_RANGE_DAYS = 366;
// Postgres refuses year 0, which the ISO formats allow, so dates before this are refused up front.
const EARLIEST = Date.parse("1900-01-01T00:00:00Z");
// A future week cannot be opened, so an entry far in the future could never be seen again
// (decision 12). A day of slack covers a phone clock that runs fast.
const MAX_AHEAD_MS = 24 * 60 * 60 * 1000;

// Database rules the API turns into words (decision 7). Any other database error stays a 500.
const CONSTRAINT_MESSAGES: Record<string, string> = {
  journal_entry_food_or_symptom: EMPTY,
  journal_entry_severity_needs_symptom: "Add a symptom before choosing how strong it was.",
};

// Free text is cleaned (decision 2): blank-only text becomes null, and the database decides
// whether the entry as a whole is empty.
const freeText = z
  .string()
  .nullable()
  .transform((value) => (value === null ? null : cleanText(value)))
  .refine((value) => value === null || textLength(value) <= MAX_TEXT_LENGTH);

const fields = {
  occurredAt: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value))
    .refine((date) => date.getTime() >= EARLIEST && date.getTime() <= Date.now() + MAX_AHEAD_MS),
  // Stored under the name Postgres knows (decision 8); null fails the pipe as not a zone.
  timeZone: z.string().transform(toTimeZone).pipe(z.string()),
  food: freeText,
  symptom: freeText,
  severity: z.enum(SEVERITIES).nullable(),
  context: z
    .array(z.enum(CONTEXTS))
    .max(CONTEXTS.length * 2)
    .transform((values) => [...new Set(values)]),
  flagged: z.boolean(),
};

// Strict, so a request cannot set fields like userId or createdAt.
const createBody = z
  .object(fields)
  .partial()
  .required({ occurredAt: true, timeZone: true })
  .strict();

// A time is only meaningful with its zone (decision 3), so they change together.
const editBody = z
  .object(fields)
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0)
  .refine((body) => (body.occurredAt === undefined) === (body.timeZone === undefined));

const range = z.object({ from: z.iso.date(), to: z.iso.date() }).refine(({ from, to }) => {
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  return Date.parse(from) >= EARLIEST && days >= 1 && days <= MAX_RANGE_DAYS;
});

const entryId = z.uuid();

// Everything the browser sees: every column except these two. A new column is returned by
// default, so a column the browser must not see has to be added to this list.
const { userId: _userId, updatedAt: _updatedAt, ...columns } = getTableColumns(journalEntry);

function constraintMessage(error: unknown): string | undefined {
  const name = (error as { cause?: { constraint?: string } }).cause?.constraint;
  return name ? CONSTRAINT_MESSAGES[name] : undefined;
}

export const entries = new Hono<{ Variables: Variables }>()
  // Entries whose local date, in the zone they were logged in, falls in the range (decision 4),
  // with the plain sentences the week view shows above them (decision 10).
  // ponytail: the (user_id, occurred_at) index narrows to one user's rows, then each is checked.
  // Fine for one person's journal; add an index on the local date if this gets slow.
  .get("/", async (c) => {
    const query = range.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "Choose a valid date range." }, 400);
    const localDate = sql`(${journalEntry.occurredAt} at time zone ${journalEntry.timeZone})::date`;
    const rows = await db
      .select(columns)
      .from(journalEntry)
      .where(
        and(
          eq(journalEntry.userId, c.get("user").id),
          sql`${localDate} between ${query.data.from}::date and ${query.data.to}::date`,
        ),
      )
      .orderBy(asc(journalEntry.occurredAt));
    // Each entry carries its symptoms for the week strip, from the same matcher (decision 13).
    const tagged = rows.map((row) => ({
      ...row,
      symptoms: [...symptomsIn(row.symptom ?? "")].sort(),
    }));
    return c.json({ entries: tagged, observations: observe(rows) });
  })

  .post("/", async (c) => {
    const body = createBody.safeParse(await c.req.json().catch(() => undefined));
    if (!body.success) return c.json({ error: INVALID }, 400);
    const { symptom, severity } = body.data;
    try {
      const [row] = await db
        .insert(journalEntry)
        .values({
          ...body.data,
          userId: c.get("user").id,
          // PRD 5.2: severity is only saved when there is a symptom.
          severity: symptom ? (severity ?? null) : null,
        })
        .returning(columns);
      return c.json(row, 201);
    } catch (error) {
      const message = constraintMessage(error);
      if (message) return c.json({ error: message }, 400);
      throw error;
    }
  })

  // One statement, so nothing can change between a check and the save (decision 7).
  .patch("/:id", async (c) => {
    const id = entryId.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: NOT_FOUND }, 404);
    const body = editBody.safeParse(await c.req.json().catch(() => undefined));
    if (!body.success) return c.json({ error: INVALID }, 400);
    // Clearing the symptom clears how strong it was.
    const changes = body.data.symptom === null ? { ...body.data, severity: null } : body.data;
    try {
      const [row] = await db
        .update(journalEntry)
        .set(changes)
        .where(and(eq(journalEntry.id, id.data), eq(journalEntry.userId, c.get("user").id)))
        .returning(columns);
      if (!row) return c.json({ error: NOT_FOUND }, 404);
      return c.json(row);
    } catch (error) {
      const message = constraintMessage(error);
      if (message) return c.json({ error: message }, 400);
      throw error;
    }
  })

  .delete("/:id", async (c) => {
    const id = entryId.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: NOT_FOUND }, 404);
    const [row] = await db
      .delete(journalEntry)
      .where(and(eq(journalEntry.id, id.data), eq(journalEntry.userId, c.get("user").id)))
      .returning({ id: journalEntry.id });
    if (!row) return c.json({ error: NOT_FOUND }, 404);
    return c.body(null, 204);
  });
