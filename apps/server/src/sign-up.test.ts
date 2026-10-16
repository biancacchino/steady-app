// Sign-up writes the user, the password account, and the session as one transaction.
// Needs the local Postgres with migrations applied (npm run db:start, npm run db:migrate).
import { randomUUID } from "node:crypto";
import { auth } from "@steady/auth";
import { db } from "@steady/db";
import { user } from "@steady/db/schema/index";
import { env } from "@steady/env/server";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const emails: string[] = [];
// The invite code is sent, so sign-up gets past the invite check to the writes being tested.
const maya = {
  name: "Maya",
  password: "Password123!",
  ageConfirmedAt: new Date(),
  inviteCode: env.INVITE_CODE,
};

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
        body: { ...maya, email },
      }),
    ).rejects.toThrow();

    expect(await db.select().from(user).where(eq(user.email, email))).toEqual([]);
  });

  it("still signs up normally", async () => {
    const email = `atomic-${randomUUID()}@example.com`;
    emails.push(email);
    const res = await auth.api.signUpEmail({
      body: { ...maya, email },
    });
    expect(res.user.email).toBe(email);
  });
});
