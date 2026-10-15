import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const SEVERITIES = ["low", "medium", "high"] as const;
export const CONTEXTS = ["stress", "travel", "sleep", "cycle"] as const;
export const MAX_TEXT_LENGTH = 1000;

// Characters that count as blank: whitespace, then invisible characters such as the zero-width
// space. Text made only of these is empty (milestone 1, decision 2). Written once as a regex
// character class so the database constraint and cleanText use the exact same list.
// ponytail: a fixed list, not Unicode properties, because Postgres regexes do not support \p{...}.
// String.raw keeps the backslashes, so Postgres and JavaScript each read the escapes themselves.
const BLANK = [
  String.raw`\t\n\v\f\r \u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000`,
  String.raw`\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E`,
  String.raw`\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0`,
].join("");
const BLANK_ENDS = new RegExp(`^[${BLANK}]+|[${BLANK}]+$`, "gu");

/** Removes blank characters from both ends. Returns null when nothing visible is left. */
export function cleanText(value: string): string | null {
  const text = value.replace(BLANK_ENDS, "");
  return text === "" ? null : text;
}

/** Counts characters the way Postgres char_length does, so an emoji counts as 1, not 2. */
export function textLength(value: string): number {
  return [...value].length;
}

// Zone-name shape: "UTC", "America/Toronto", "Etc/GMT+5". Rules out offsets like "-04:00",
// which Intl accepts but which break when an entry's date is edited across a daylight saving change.
const ZONE_NAME = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/;

// Node follows CLDR and still calls these zones by their old names; Postgres follows IANA and
// knows only the new ones (milestone 1, decision 8). journal-schema.test.ts fails if a Node or
// Postgres upgrade adds a name that is in neither Postgres nor this table.
const OLD_ZONE_NAMES: Record<string, string> = {
  "Africa/Asmera": "Africa/Asmara",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Catamarca": "America/Argentina/Catamarca",
  "America/Cordoba": "America/Argentina/Cordoba",
  "America/Godthab": "America/Nuuk",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Jujuy": "America/Argentina/Jujuy",
  "America/Louisville": "America/Kentucky/Louisville",
  "America/Mendoza": "America/Argentina/Mendoza",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Europe/Kiev": "Europe/Kyiv",
  "Pacific/Enderbury": "Pacific/Kanton",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Truk": "Pacific/Chuuk",
};

/** The zone's name as Postgres knows it, or null when the value is not a zone name. */
export function toTimeZone(value: string): string | null {
  if (!ZONE_NAME.test(value)) return null;
  try {
    // Resolving also turns links like "US/Eastern" into the zone they point to.
    const zone = new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions().timeZone;
    return OLD_ZONE_NAMES[zone] ?? zone;
  } catch {
    return null;
  }
}

// At least one visible character, and at most MAX_TEXT_LENGTH characters.
const hasContent = (column: AnyPgColumn) =>
  sql`${column} ~ ${sql.raw(`'[^${BLANK}]'`)} and char_length(${column}) <= ${sql.raw(String(MAX_TEXT_LENGTH))}`;

// PRD 5.2 and 6. The checks repeat the API's rules so no path can store an entry that breaks them.
// `occurred_at` is a moment in UTC: despite its name, Postgres `timestamp with time zone` converts
// to UTC and keeps no zone. `time_zone` records where the clock was, so lunch in Toronto shows
// as 12:30 even when opened in Vancouver (milestone 1, decision 3). It has no default on purpose:
// a wrong default would silently shift times, so an entry without a zone is refused.
export const journalEntry = pgTable(
  "journal_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    timeZone: text("time_zone").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    food: text("food"),
    symptom: text("symptom"),
    severity: text("severity", { enum: SEVERITIES }),
    context: text("context", { enum: CONTEXTS }).array().default(sql`'{}'`).notNull(),
    flagged: boolean("flagged").default(false).notNull(),
  },
  (t) => [
    index("journal_entry_user_occurred_idx").on(t.userId, t.occurredAt),
    check("journal_entry_food_or_symptom", sql`${t.food} is not null or ${t.symptom} is not null`),
    check("journal_entry_food_length", hasContent(t.food)),
    check("journal_entry_symptom_length", hasContent(t.symptom)),
    // Postgres cannot cheaply check a zone name, so the API does with toTimeZone. This bounds it.
    check("journal_entry_time_zone_length", sql`char_length(${t.timeZone}) between 1 and 64`),
    check(
      "journal_entry_severity_value",
      sql`${t.severity} in (${sql.raw(SEVERITIES.map((s) => `'${s}'`).join(", "))})`,
    ),
    check(
      "journal_entry_severity_needs_symptom",
      sql`${t.severity} is null or ${t.symptom} is not null`,
    ),
    check(
      "journal_entry_context_values",
      sql`${t.context} <@ array[${sql.raw(CONTEXTS.map((c) => `'${c}'`).join(", "))}]::text[]`,
    ),
  ],
);
