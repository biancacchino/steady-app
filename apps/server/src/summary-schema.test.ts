// Checks the database rules on summary directly, so they hold even if the API is bypassed.
// Needs the local Postgres with migrations applied (npm run db:start, npm run db:migrate).
import { randomUUID } from "node:crypto";
import { db } from "@steady/db";
import { summary, user } from "@steady/db/schema/index";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const userId = randomUUID();
const range = { rangeStart: "2026-10-01", rangeEnd: "2026-10-14" };

beforeAll(async () => {
  await db.insert(user).values({
    id: userId,
    name: "Summary Test",
    email: `${userId}@example.com`,
    ageConfirmedAt: new Date(),
    privacyConsentAt: new Date(),
  });
});

afterAll(async () => {
  await db.delete(user).where(eq(user.id, userId));
});

// Drizzle wraps the driver error, and the constraint name is on its cause.
async function violation(values: Partial<typeof summary.$inferInsert>) {
  try {
    await db.insert(summary).values({ userId, ...range, ...values });
  } catch (e) {
    return (e as { cause?: { constraint?: string } }).cause?.constraint ?? "unknown";
  }
  return null;
}

describe("summary constraints", () => {
  it("saves a draft with the defaults", async () => {
    const [row] = await db
      .insert(summary)
      .values({ userId, ...range })
      .returning();
    expect(row?.questions).toEqual([]);
    expect(row?.excludedEntryIds).toEqual([]);
    expect(row?.reviewedAt).toBeNull();
  });

  it("refuses a fifth question", async () => {
    expect(await violation({ questions: ["a?", "b?", "c?", "d?", "e?"] })).toBe(
      "summary_questions_count",
    );
  });

  it("refuses a range that ends before it starts", async () => {
    expect(await violation({ rangeStart: "2026-10-14", rangeEnd: "2026-10-01" })).toBe(
      "summary_range",
    );
  });

  it("refuses an export time without a review, so nothing unreviewed is ever marked shared", async () => {
    expect(await violation({ exportedAt: new Date() })).toBe("summary_exported_needs_review");
  });

  it("refuses a review without a snapshot", async () => {
    expect(await violation({ reviewedAt: new Date() })).toBe("summary_reviewed_has_snapshot");
  });
});
