// Privacy consent (PRD 5.1 and 7): health data needs express consent, so sign-up requires it and
// an account made before consent existed can't store data until the user agrees.
// Needs the local Postgres with migrations applied.
import { randomUUID } from "node:crypto";
import { db } from "@steady/db";
import { user } from "@steady/db/schema/index";
import { env } from "@steady/env/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { app } from "./app";

const emails: string[] = [];
const week = { from: "2026-10-01", to: "2026-10-08" };
const ENTRIES = `/api/entries?${new URLSearchParams(week)}`;

function signUp(body: Record<string, unknown>) {
  const email = `consent-${randomUUID()}@example.com`;
  emails.push(email);
  return app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: env.BETTER_AUTH_URL,
      // Each request gets its own IP, so the sign-up rate limit never trips here.
      "x-forwarded-for": `10.8.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    },
    body: JSON.stringify({
      name: "Rae",
      email,
      password: "Password123!",
      ageConfirmedAt: new Date().toISOString(),
      inviteCode: env.INVITE_CODE,
      ...body,
    }),
  });
}

async function newUser() {
  const res = await signUp({ privacyConsentAt: new Date().toISOString() });
  const cookie = res.headers.getSetCookie()[0]?.split(";")[0];
  if (!cookie) throw new Error("Sign-up returned no session cookie.");
  const { user: created } = (await res.json()) as { user: { id: string } };
  return { id: created.id, cookie };
}

function call(cookie: string, method: string, path: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: {
      cookie,
      origin: env.BETTER_AUTH_URL,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const consentOf = async (id: string) =>
  (await db.select({ at: user.privacyConsentAt }).from(user).where(eq(user.id, id)))[0]?.at;

afterAll(async () => {
  await db.delete(user).where(inArray(user.email, emails));
});

describe("privacy consent", () => {
  it("refuses sign-up without consent", async () => {
    const res = await signUp({});
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message?: string }).message).toBe(
      "Agree to how Steady stores your data to continue.",
    );
  });

  it("stores the server's time, not the browser's", async () => {
    const before = Date.now();
    const res = await signUp({ privacyConsentAt: "2001-01-01T00:00:00.000Z" });
    const { user: created } = (await res.json()) as { user: { id: string } };
    expect((await consentOf(created.id))?.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("can't be changed through update-user", async () => {
    const maya = await newUser();
    const res = await call(maya.cookie, "POST", "/api/auth/update-user", {
      privacyConsentAt: "2001-01-01T00:00:00.000Z",
    });
    expect(res.status).toBe(400);
  });

  it("blocks data routes for an account without consent, but not export or the consent itself", async () => {
    const maya = await newUser();
    await db.update(user).set({ privacyConsentAt: null }).where(eq(user.id, maya.id));

    const blocked = await call(maya.cookie, "GET", ENTRIES);
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({
      error: "Agree to how Steady stores your data to continue.",
      consentRequired: true,
    });
    expect((await call(maya.cookie, "GET", "/api/me")).status).toBe(200);
    expect((await call(maya.cookie, "POST", "/api/settings/export")).status).toBe(200);

    const agreed = await call(maya.cookie, "POST", "/api/consent");
    expect(agreed.status).toBe(200);
    expect(await consentOf(maya.id)).toBeInstanceOf(Date);
    const after = await call(maya.cookie, "GET", ENTRIES);
    expect(after.status).not.toBe(403);
  });

  it("keeps the first consent time when agreeing again", async () => {
    const maya = await newUser();
    const first = await consentOf(maya.id);
    await call(maya.cookie, "POST", "/api/consent");
    expect(await consentOf(maya.id)).toEqual(first);
  });
});
