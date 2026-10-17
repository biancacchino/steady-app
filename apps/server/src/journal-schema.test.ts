// Checks the database rules on journal_entry directly, so they hold even if the API is bypassed.
// Needs the local Postgres with migrations applied (npm run db:start, npm run db:migrate).
import { randomUUID } from "node:crypto";
import { db } from "@steady/db";
import { cleanText, journalEntry, textLength, toTimeZone, user } from "@steady/db/schema/index";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const userId = randomUUID();
const timeZone = "America/Toronto";
// A no-break space and a byte order mark: invisible, so blank (decision 2).
const INVISIBLE = "\u00A0" + "\uFEFF";

beforeAll(async () => {
  await db.insert(user).values({
    id: userId,
    name: "Schema Test",
    email: `${userId}@example.com`,
    ageConfirmedAt: new Date(),
    privacyConsentAt: new Date(),
  });
});

afterAll(async () => {
  await db.delete(user).where(eq(user.id, userId));
});

// Drizzle wraps the driver error, and the constraint name is on its cause.
async function violation(values: Partial<typeof journalEntry.$inferInsert>) {
  try {
    await db.insert(journalEntry).values({ userId, timeZone, ...values });
  } catch (e) {
    return (e as { cause?: { constraint?: string } }).cause?.constraint ?? "unknown";
  }
  return null;
}

describe("journal_entry constraints", () => {
  it("saves an entry with only a symptom, and fills the defaults", async () => {
    const [row] = await db
      .insert(journalEntry)
      .values({ userId, timeZone, symptom: "Bloating", severity: "medium" })
      .returning();
    expect(row?.flagged).toBe(false);
    expect(row?.context).toEqual([]);
    expect(row?.occurredAt).toBeInstanceOf(Date);
  });

  it("refuses an entry with neither food nor symptom", async () => {
    expect(await violation({})).toBe("journal_entry_food_or_symptom");
  });

  it("refuses empty strings, so blank text cannot stand in for a missing field", async () => {
    expect(await violation({ food: "" })).toBe("journal_entry_food_length");
    expect(await violation({ food: "Toast", symptom: "" })).toBe("journal_entry_symptom_length");
  });

  // Decision 2: a field with no visible characters is empty, whatever its length.
  it("refuses text with no visible characters", async () => {
    for (const blank of ["   ", "\n\t", "\u200B", INVISIBLE]) {
      expect(await violation({ food: blank })).toBe("journal_entry_food_length");
      expect(await violation({ food: "Toast", symptom: blank })).toBe(
        "journal_entry_symptom_length",
      );
    }
  });

  it("accepts emoji and punctuation as real content", async () => {
    for (const text of ["🤢", "?", "-", "☕"]) {
      expect(await violation({ food: text, symptom: text })).toBeNull();
    }
  });

  it("counts an emoji as one character, like Postgres", async () => {
    expect(textLength("🤢")).toBe(1);
    expect(await violation({ food: "🤢".repeat(1000) })).toBeNull();
    expect(await violation({ food: "🤢".repeat(1001) })).toBe("journal_entry_food_length");
  });

  it("refuses text over 1000 characters", async () => {
    expect(await violation({ food: "a".repeat(1001) })).toBe("journal_entry_food_length");
    expect(await violation({ symptom: "a".repeat(1001) })).toBe("journal_entry_symptom_length");
  });

  it("refuses a severity without a symptom, and unknown severities", async () => {
    expect(await violation({ food: "Toast", severity: "high" })).toBe(
      "journal_entry_severity_needs_symptom",
    );
    expect(await violation({ symptom: "Pain", severity: "extreme" as "high" })).toBe(
      "journal_entry_severity_value",
    );
  });

  it("refuses context values outside the four allowed", async () => {
    expect(await violation({ food: "Toast", context: ["stress", "weather" as "stress"] })).toBe(
      "journal_entry_context_values",
    );
  });

  // Decision 3: no default zone, so an entry that does not say where it happened is refused.
  it("refuses an entry without a time zone", async () => {
    const error = await db
      .insert(journalEntry)
      .values({ userId, food: "Toast" } as typeof journalEntry.$inferInsert)
      .catch((e: { cause?: { column?: string } }) => e.cause?.column);
    expect(error).toBe("time_zone");
  });

  it("stores enough to show an entry at the time where it happened", async () => {
    const [row] = await db
      .insert(journalEntry)
      .values({ userId, timeZone, food: "Lunch", occurredAt: new Date("2026-10-12T16:30:00Z") })
      .returning({
        local: sql<string>`to_char(${journalEntry.occurredAt} at time zone ${journalEntry.timeZone}, 'HH24:MI')`,
      });
    expect(row?.local).toBe("12:30");
  });

  it("deletes a user's entries when the user is deleted", async () => {
    const otherId = randomUUID();
    await db.insert(user).values({
      id: otherId,
      name: "Cascade Test",
      email: `${otherId}@example.com`,
      ageConfirmedAt: new Date(),
      privacyConsentAt: new Date(),
    });
    await db.insert(journalEntry).values({ userId: otherId, timeZone, food: "Rice" });
    await db.delete(user).where(eq(user.id, otherId));
    const left = await db.select().from(journalEntry).where(eq(journalEntry.userId, otherId));
    expect(left).toEqual([]);
  });
});

// The API cleans text with cleanText before saving, so it must agree with the database on what
// is blank. If the two lists drift apart, one of these cases fails.
describe("cleanText", () => {
  it("trims blank characters from both ends", () => {
    expect(cleanText("\u200B Toast\n\n")).toBe("Toast");
    expect(cleanText("Rice and beans")).toBe("Rice and beans");
  });

  it("returns null exactly when the database would refuse the text as blank", async () => {
    for (const text of ["   ", "\n\t", "\u200B", INVISIBLE, "🤢", "?", " - "]) {
      const refused = (await violation({ food: text })) === "journal_entry_food_length";
      expect(cleanText(text) === null).toBe(refused);
    }
  });
});

describe("toTimeZone", () => {
  it("keeps current names and resolves links like US/Eastern", () => {
    expect(toTimeZone("America/Toronto")).toBe("America/Toronto");
    expect(toTimeZone("UTC")).toBe("UTC");
    expect(toTimeZone("US/Eastern")).toBe("America/New_York");
  });

  it("translates old names browsers still report into the names Postgres uses", () => {
    expect(toTimeZone("Asia/Calcutta")).toBe("Asia/Kolkata");
    expect(toTimeZone("Europe/Kiev")).toBe("Europe/Kyiv");
  });

  it("refuses offsets, made-up names, and empty text", () => {
    for (const zone of ["-04:00", "+05:30", "Mars/Olympus", "", "America/Toronto; drop"]) {
      expect(toTimeZone(zone)).toBeNull();
    }
  });

  // Decision 8: Node (CLDR) and Postgres (IANA) disagree on some names. This fails when a Node or
  // Postgres upgrade adds a name Node can report but Postgres cannot use.
  it("turns every zone Node can report into one Postgres knows", async () => {
    const rows = await db.execute<{ name: string }>(sql`select name from pg_timezone_names`);
    const postgres = new Set(rows.rows.map((row) => row.name));
    const unusable = [...Intl.supportedValuesOf("timeZone"), "UTC"].filter(
      (zone) => !postgres.has(toTimeZone(zone) ?? ""),
    );
    expect(unusable).toEqual([]);
  });
});
