// Account deletion (docs/prd.md sections 4 and 7), through the real app and database.
// Needs the local Postgres with migrations applied (npm run db:start, npm run db:migrate).
import { randomUUID } from "node:crypto";
import { auth } from "@steady/auth";
import { db } from "@steady/db";
import { account, journalEntry, session, user } from "@steady/db/schema/index";
import { env } from "@steady/env/server";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { app } from "./app";

const PASSWORD = "Password123!";
const PHRASE = "delete my account";
const emails: string[] = [];

/** Signs up a new user with one journal entry and returns their id and session cookie. */
async function signUpWithEntry(name: string) {
  const email = `${name.toLowerCase()}-${randomUUID()}@example.com`;
  emails.push(email);
  const body = {
    name,
    email,
    password: PASSWORD,
    ageConfirmedAt: new Date(),
    privacyConsentAt: new Date(),
    inviteCode: env.INVITE_CODE,
  };
  const res = await auth.api.signUpEmail({ body, asResponse: true });
  const cookie = res.headers.getSetCookie()[0]?.split(";")[0];
  if (!cookie) throw new Error("Sign-up returned no session cookie.");
  const { user: created } = (await res.json()) as { user: { id: string } };
  await db.insert(journalEntry).values({
    userId: created.id,
    occurredAt: new Date("2026-10-13T16:30:00Z"),
    timeZone: "America/Toronto",
    food: "Toast",
  });
  return { id: created.id, email, cookie };
}

/** A new client IP, so each test gets its own rate-limit bucket. */
const newIp = () => `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 256)).join(".")}`;

function deleteAccount(cookie: string | null, body: Record<string, unknown>, ip = newIp()) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    origin: env.BETTER_AUTH_URL,
    "x-forwarded-for": ip,
  };
  if (cookie) headers.cookie = cookie;
  return app.request("/api/auth/delete-user", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function rowsFor(userId: string) {
  const [users, sessions, accounts, entries] = await Promise.all([
    db.select().from(user).where(eq(user.id, userId)),
    db.select().from(session).where(eq(session.userId, userId)),
    db.select().from(account).where(eq(account.userId, userId)),
    db.select().from(journalEntry).where(eq(journalEntry.userId, userId)),
  ]);
  return {
    users: users.length,
    sessions: sessions.length,
    accounts: accounts.length,
    entries: entries.length,
  };
}

afterAll(async () => {
  await db.delete(user).where(inArray(user.email, emails));
});

describe("account deletion", () => {
  it("cascades every foreign key to user", async () => {
    // Guards later tables (summary, diet_plan, screening results, referral_log): one that does not
    // cascade would block deletion or leave health data behind.
    const result = await db.execute(sql`
      select con.conrelid::regclass::text as "table", con.confdeltype as "onDelete"
      from pg_constraint con
      where con.contype = 'f' and con.confrelid = 'public.user'::regclass
    `);
    const keys = result.rows as { table: string; onDelete: string }[];
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((k) => k.onDelete !== "c")).toEqual([]);
  });

  it("refuses without a session", async () => {
    const res = await deleteAccount(null, { password: PASSWORD, confirm: PHRASE });
    expect(res.status).toBe(401);
  });

  it("refuses a wrong password and deletes nothing", async () => {
    const maya = await signUpWithEntry("Maya");
    const res = await deleteAccount(maya.cookie, { password: "WrongPassword1!", confirm: PHRASE });
    expect(res.status).toBe(400);
    expect(await rowsFor(maya.id)).toEqual({ users: 1, sessions: 1, accounts: 1, entries: 1 });
  });

  it("refuses without the typed phrase and deletes nothing", async () => {
    const maya = await signUpWithEntry("Maya");
    for (const confirm of [undefined, "", "delete", "DELETE MY ACCOUNT!"]) {
      const res = await deleteAccount(maya.cookie, { password: PASSWORD, confirm }, newIp());
      expect(res.status).toBe(400);
      expect(((await res.json()) as { message: string }).message).toBe(
        `Type "${PHRASE}" to confirm.`,
      );
    }
    expect(await rowsFor(maya.id)).toEqual({ users: 1, sessions: 1, accounts: 1, entries: 1 });
  });

  it("limits attempts to 3 per 10 seconds per IP, so it cannot be used to guess the password", async () => {
    const maya = await signUpWithEntry("Maya");
    const ip = newIp();
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      statuses.push(
        (await deleteAccount(maya.cookie, { password: `Guess${i}!`, confirm: PHRASE }, ip)).status,
      );
    }
    expect(statuses).toEqual([400, 400, 400, 429]);
    expect(await rowsFor(maya.id)).toEqual({ users: 1, sessions: 1, accounts: 1, entries: 1 });
  });

  it("refuses without a password, even on a new session", async () => {
    const maya = await signUpWithEntry("Maya");
    const res = await deleteAccount(maya.cookie, { confirm: PHRASE });
    expect(res.status).toBe(400);
    expect(await rowsFor(maya.id)).toEqual({ users: 1, sessions: 1, accounts: 1, entries: 1 });
  });

  it("deletes the user and all their data, and leaves other users alone", async () => {
    const maya = await signUpWithEntry("Maya");
    const sam = await signUpWithEntry("Sam");

    const res = await deleteAccount(maya.cookie, {
      password: PASSWORD,
      confirm: " Delete my account ",
    });
    expect(res.status).toBe(200);

    expect(await rowsFor(maya.id)).toEqual({ users: 0, sessions: 0, accounts: 0, entries: 0 });
    expect(await rowsFor(sam.id)).toEqual({ users: 1, sessions: 1, accounts: 1, entries: 1 });
    const range = new URLSearchParams({ from: "2026-10-12", to: "2026-10-18" });
    const after = await app.request(`/api/entries?${range}`, {
      headers: { cookie: maya.cookie },
    });
    expect(after.status).toBe(401);
  });
});
