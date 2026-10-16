// Invite-only sign-up (tasks/deploy.md step 3), through the real app and database.
// Needs the local Postgres with migrations applied (npm run db:start, npm run db:migrate).
import { randomUUID } from "node:crypto";
import { db } from "@steady/db";
import { user } from "@steady/db/schema/index";
import { env } from "@steady/env/server";
import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { app } from "./app";

const WRONG_CODE = "That invite code doesn't work. Check it and try again.";
const emails: string[] = [];

function signUp(body: Record<string, unknown>) {
  const email = `invite-${randomUUID()}@example.com`;
  emails.push(email);
  return app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: env.BETTER_AUTH_URL,
      // Each request gets its own IP, so the sign-up rate limit never trips here.
      "x-forwarded-for": `10.9.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    },
    body: JSON.stringify({
      name: "Rae",
      email,
      password: "Password123!",
      ageConfirmedAt: new Date().toISOString(),
      ...body,
    }),
  });
}

async function expectRefused(res: Response) {
  expect(res.status).toBe(403);
  expect(((await res.json()) as { message?: string }).message).toBe(WRONG_CODE);
}

afterAll(async () => {
  await db.delete(user).where(inArray(user.email, emails));
});

describe("invite-only sign-up", () => {
  it("creates the account with the right code", async () => {
    const res = await signUp({ inviteCode: env.INVITE_CODE });
    expect(res.status).toBe(200);
  });

  it("refuses a missing code", async () => {
    await expectRefused(await signUp({}));
  });

  it("refuses a wrong code, including one that differs only in length", async () => {
    await expectRefused(await signUp({ inviteCode: "wrong" }));
    await expectRefused(await signUp({ inviteCode: `${env.INVITE_CODE}x` }));
  });

  it("refuses a non-string code", async () => {
    await expectRefused(await signUp({ inviteCode: 12345 }));
  });

  it("checks the code before the email, so a taken email is not revealed", async () => {
    const first = await signUp({ inviteCode: env.INVITE_CODE });
    expect(first.status).toBe(200);
    await expectRefused(await signUp({ email: emails.at(-1), inviteCode: "wrong" }));
  });
});
