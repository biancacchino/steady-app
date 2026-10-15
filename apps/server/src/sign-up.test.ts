// Sign-up writes the user, the password account, and the session as one transaction.
// Needs the local Postgres with migrations applied (npm run db:start, npm run db:migrate).
import { randomUUID } from "node:crypto";
import { auth } from "@steady/auth";
import { db } from "@steady/db";
import { user } from "@steady/db/schema/index";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const emails: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const email of emails.splice(0)) await db.delete(user).where(eq(user.email, email));
});

describe("sign-up", () => {
  it("leaves no user behind when a later write fails", async () => {
    // Without one transaction, a failed session insert left a user with no way to sign in, and
    // that email could never sign up again.
    const ctx = await auth.$context;
    vi.spyOn(ctx.internalAdapter, "createSession").mockRejectedValueOnce(
      new Error("session insert failed"),
    );
    const email = `atomic-${randomUUID()}@example.com`;
    emails.push(email);

    await expect(
      auth.api.signUpEmail({
        body: { name: "Maya", email, password: "Password123!", ageConfirmedAt: new Date() },
      }),
    ).rejects.toThrow();

    expect(await db.select().from(user).where(eq(user.email, email))).toEqual([]);
  });

  it("still signs up normally", async () => {
    const email = `atomic-${randomUUID()}@example.com`;
    emails.push(email);
    const res = await auth.api.signUpEmail({
      body: { name: "Maya", email, password: "Password123!", ageConfirmedAt: new Date() },
    });
    expect(res.user.email).toBe(email);
  });
});
