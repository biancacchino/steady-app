import { sql } from "drizzle-orm";
import { check, date, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const MAX_QUESTIONS = 4;
export const MAX_QUESTION_LENGTH = 300;
export const MAX_PROVIDER_LENGTH = 100;

// PRD 5.4 and 6. A summary starts as a draft (the choices only). Review saves `snapshot`, exactly
// what export sends, so later journal edits cannot change a reviewed summary (non-negotiable 4).
// The checks repeat the API's rules, so no path can store a summary that breaks them.
export const summary = pgTable(
  "summary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rangeStart: date("range_start").notNull(),
    rangeEnd: date("range_end").notNull(),
    providerName: text("provider_name"),
    appointmentDate: date("appointment_date"),
    // No foreign key: a left-out entry the user later deletes simply stops mattering.
    excludedEntryIds: uuid("excluded_entry_ids").array().default(sql`'{}'`).notNull(),
    questions: text("questions").array().default(sql`'{}'`).notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    snapshot: jsonb("snapshot"),
    exportedAt: timestamp("exported_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("summary_user_idx").on(t.userId),
    check(
      "summary_range",
      sql`${t.rangeEnd} >= ${t.rangeStart} and ${t.rangeEnd} - ${t.rangeStart} < 366`,
    ),
    check(
      "summary_questions_count",
      sql`cardinality(${t.questions}) <= ${sql.raw(String(MAX_QUESTIONS))}`,
    ),
    // Bounds all questions together; the API checks each one.
    check(
      "summary_questions_length",
      sql`char_length(array_to_string(${t.questions}, '')) <= ${sql.raw(String(MAX_QUESTIONS * MAX_QUESTION_LENGTH))}`,
    ),
    check(
      "summary_provider_length",
      sql`char_length(${t.providerName}) between 1 and ${sql.raw(String(MAX_PROVIDER_LENGTH))}`,
    ),
    check("summary_excluded_count", sql`cardinality(${t.excludedEntryIds}) <= 1000`),
    check(
      "summary_reviewed_has_snapshot",
      sql`(${t.reviewedAt} is null) = (${t.snapshot} is null)`,
    ),
    check(
      "summary_exported_needs_review",
      sql`${t.exportedAt} is null or ${t.reviewedAt} is not null`,
    ),
  ],
);
