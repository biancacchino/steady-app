// Care-team link and JSON export (PRD 5.7, 7), through the real app and database.
// Needs the local Postgres with migrations applied.
import { randomUUID } from "node:crypto";
import { auth } from "@steady/auth";
import { db } from "@steady/db";
import { journalEntry, user } from "@steady/db/schema/index";
import { dietPlan, referralLog, result } from "@steady/db/schema/screening";
import { summary } from "@steady/db/schema/summary";
import { env } from "@steady/env/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { app } from "./app";

const emails: string[] = [];

async function newUser(name = "Maya") {
  const email = `${name.toLowerCase()}-${randomUUID()}@example.com`;
  emails.push(email);
  const body = {
    name,
    email,
    password: "Password123!",
    ageConfirmedAt: new Date(),
    privacyConsentAt: new Date(),
    inviteCode: env.INVITE_CODE,
  };
  const res = await auth.api.signUpEmail({ body, asResponse: true });
  const cookie = res.headers.getSetCookie()[0]?.split(";")[0];
  if (!cookie) throw new Error("Sign-up returned no session cookie.");
  const { user: created } = (await res.json()) as { user: { id: string } };
  return { id: created.id, email, cookie };
}

function call(cookie: string | null, method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  return app.request(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const careTeam = async (id: string) =>
  (await db.select({ link: user.careTeamLink }).from(user).where(eq(user.id, id)))[0]?.link;

afterAll(async () => {
  await db.delete(user).where(inArray(user.email, emails));
});

describe("care team link", () => {
  it("answers 401 without a session", async () => {
    expect((await call(null, "PUT", "/api/settings/care-team", { link: null })).status).toBe(401);
  });

  it("turns an email address into a mailto link and keeps an https link", async () => {
    const maya = await newUser();
    const put = (link: string | null) =>
      call(maya.cookie, "PUT", "/api/settings/care-team", { link });
    expect((await put("  dr.osei@clinic.example ")).status).toBe(200);
    expect(await careTeam(maya.id)).toBe("mailto:dr.osei@clinic.example");
    for (const [typed, saved] of [
      ["care+team@dept.clinic.example.com", "mailto:care+team@dept.clinic.example.com"],
      ["mailto:dr@clinic.example", "mailto:dr@clinic.example"],
    ] as const) {
      expect((await put(typed)).status).toBe(200);
      expect(await careTeam(maya.id)).toBe(saved);
    }
    expect((await put("https://portal.clinic.example/message")).status).toBe(200);
    expect(await careTeam(maya.id)).toBe("https://portal.clinic.example/message");
  });

  it("clears the link with null or an empty value", async () => {
    const maya = await newUser();
    await call(maya.cookie, "PUT", "/api/settings/care-team", { link: "a@b.example" });
    for (const link of [null, "  "]) {
      await call(maya.cookie, "PUT", "/api/settings/care-team", { link: "a@b.example" });
      expect((await call(maya.cookie, "PUT", "/api/settings/care-team", { link })).status).toBe(
        200,
      );
      expect(await careTeam(maya.id)).toBeNull();
    }
  });

  it("refuses links that are not an email address or an https address", async () => {
    const maya = await newUser();
    for (const link of [
      "javascript:alert(1)",
      "http://insecure.example",
      "data:text/html,x",
      "https://user:pw@portal.clinic.example",
      "https://",
      "mailto:not an address",
      "not a link",
      `https://${"a".repeat(300)}.example`,
      "a@b.example\nBcc: x@y.example",
    ]) {
      const res = await call(maya.cookie, "PUT", "/api/settings/care-team", { link });
      expect(res.status, link).toBe(400);
    }
    const extra = await call(maya.cookie, "PUT", "/api/settings/care-team", {
      link: "a@b.example",
      name: "x",
    });
    expect(extra.status).toBe(400);
    expect(await careTeam(maya.id)).toBeNull();
  });

  it("changes only the signed-in user's link", async () => {
    const maya = await newUser();
    const sam = await newUser("Sam");
    await call(maya.cookie, "PUT", "/api/settings/care-team", { link: "a@b.example" });
    expect(await careTeam(sam.id)).toBeNull();
  });
});

describe("export", () => {
  it("answers 401 without a session", async () => {
    expect((await call(null, "POST", "/api/settings/export")).status).toBe(401);
  });

  it("is not available as a GET, so a link on another site cannot start it", async () => {
    const maya = await newUser();
    expect((await call(maya.cookie, "GET", "/api/settings/export")).status).toBe(404);
  });

  it("holds all of the user's data, none of anyone else's, and no credentials", async () => {
    const maya = await newUser();
    const sam = await newUser("Sam");
    const when = new Date("2026-10-13T16:30:00Z");
    for (const [owner, food] of [
      [maya.id, "Maya toast"],
      [sam.id, "Sam rice"],
    ] as const) {
      await db
        .insert(journalEntry)
        .values({ userId: owner, occurredAt: when, timeZone: "UTC", food });
      await db.insert(summary).values({
        userId: owner,
        rangeStart: "2026-10-01",
        rangeEnd: "2026-10-10",
        questions: [`${food} question`],
      });
      await db.insert(result).values({
        userId: owner,
        instrumentId: "placeholder",
        instrumentVersion: 1,
        answers: { q1: 1 },
        score: 7,
        tier: "at_or_above",
      });
      await db.insert(dietPlan).values({ userId: owner, eliminationEndsAt: when });
      await db.insert(referralLog).values({ userId: owner });
    }
    await call(maya.cookie, "PUT", "/api/settings/care-team", { link: "dr@clinic.example" });

    const res = await call(maya.cookie, "POST", "/api/settings/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="steady-export-/);
    const text = await res.text();
    const data = JSON.parse(text);

    expect(data.profile).toMatchObject({
      email: maya.email,
      name: "Maya",
      careTeamLink: "mailto:dr@clinic.example",
    });
    expect(data.entries.map((e: { food: string }) => e.food)).toEqual(["Maya toast"]);
    expect(data.summaries).toHaveLength(1);
    expect(data.summaries[0].questions).toEqual(["Maya toast question"]);
    expect(data.screenerResults).toHaveLength(1);
    expect(data.screenerResults[0].answers).toEqual({ q1: 1 });
    expect(data.dietPlan).toMatchObject({ status: "active" });
    expect(data.referrals).toHaveLength(1);

    // No other user's data, no score, and nothing from the sign-in tables.
    expect(text).not.toContain("Sam");
    expect(text).not.toMatch(/"score"|password|token|"session"|"account"/i);
  });

  it("is an empty but complete export for a new user", async () => {
    const maya = await newUser();
    const data = await (await call(maya.cookie, "POST", "/api/settings/export")).json();
    expect(data).toMatchObject({
      entries: [],
      summaries: [],
      screenerResults: [],
      dietPlan: null,
      referrals: [],
    });
  });
});
