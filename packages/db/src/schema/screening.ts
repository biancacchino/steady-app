import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const TIERS = ["below", "at_or_above"] as const;
export const PLAN_STATUSES = ["active", "paused", "ended"] as const;
export const SCREEN_VALID_DAYS = 90;

// PRD 5.5 and 6. The screener lives in its own Postgres schema so nothing analytics-shaped can
// join it by accident. An instrument is data: questions, scoring rule, and threshold.
export const screening = pgSchema("screening");

export const instrument = screening.table(
  "instrument",
  {
    id: text("id").notNull(),
    version: integer("version").notNull(),
    questions: jsonb("questions").notNull(),
    scoring: jsonb("scoring").notNull(),
    threshold: integer("threshold").notNull(),
    isPlaceholder: boolean("is_placeholder").notNull(),
  },
  (t) => [primaryKey({ columns: [t.id, t.version] })],
);

export const result = screening.table(
  "result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    instrumentId: text("instrument_id").notNull(),
    instrumentVersion: integer("instrument_version").notNull(),
    answers: jsonb("answers").notNull(),
    score: integer("score").notNull(),
    tier: text("tier").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("result_user_completed_idx").on(t.userId, t.completedAt),
    foreignKey({
      columns: [t.instrumentId, t.instrumentVersion],
      foreignColumns: [instrument.id, instrument.version],
    }),
    check("result_tier", sql`${t.tier} in ('below', 'at_or_above')`),
  ],
);

// PRD 5.6. One plan per user; a re-screen pauses or resumes it but never moves its dates.
export const dietPlan = pgTable(
  "diet_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    eliminationEndsAt: timestamp("elimination_ends_at", { withTimezone: true }).notNull(),
    status: text("status").default("active").notNull(),
  },
  (t) => [check("diet_plan_status", sql`${t.status} in ('active', 'paused', 'ended')`)],
);

// PRD 5.7. Each time the referral is shown. Only the user sees it, in their own export.
export const referralLog = pgTable(
  "referral_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    shownAt: timestamp("shown_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("referral_log_user_idx").on(t.userId)],
);
