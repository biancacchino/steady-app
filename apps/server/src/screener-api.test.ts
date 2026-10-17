// The screener, the diet gate, and the referral log, through the real app and database
// (PRD 5.5 to 5.7, section 10). Needs the local Postgres with migrations applied.
import { randomUUID } from "node:crypto";
import { auth } from "@steady/auth";
import { db } from "@steady/db";
import { user } from "@steady/db/schema/index";
import { dietPlan, referralLog, result } from "@steady/db/schema/screening";
import { env } from "@steady/env/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { app } from "./app";

const emails: string[] = [];
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

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
  return { id: created.id, cookie };
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

/** A result stored directly, so a test can pick its date. */
async function storeResult(userId: string, tier: "below" | "at_or_above", daysAgo: number) {
  await db.insert(result).values({
    userId,
    instrumentId: "placeholder",
    instrumentVersion: 1,
    answers: {},
    score: tier === "below" ? 0 : 10,
    tier,
    completedAt: ago(daysAgo),
  });
}

const submit = (cookie: string, answers: number[]) =>
  call(cookie, "POST", "/api/screening", {
    instrumentId: "placeholder",
    instrumentVersion: 1,
    answers,
  });

afterAll(async () => {
  await db.delete(user).where(inArray(user.email, emails));
});

describe("signed out", () => {
  it.each([
    ["GET", "/api/screening"],
    ["POST", "/api/screening"],
    ["GET", "/api/diet"],
    ["POST", "/api/diet/start"],
    ["POST", "/api/referral"],
  ])("%s %s answers 401", async (method, path) => {
    expect((await call(null, method, path)).status).toBe(401);
  });
});

describe("the diet gate", () => {
  it("answers 403 with no screen", async () => {
    const maya = await newUser();
    expect((await call(maya.cookie, "GET", "/api/diet")).status).toBe(403);
    expect((await call(maya.cookie, "POST", "/api/diet/start")).status).toBe(403);
  });

  it("answers 403 for an expired screen and 200 on day 89", async () => {
    const maya = await newUser();
    await storeResult(maya.id, "below", 90);
    expect((await call(maya.cookie, "GET", "/api/diet")).status).toBe(403);
    await storeResult(maya.id, "below", 89);
    expect((await call(maya.cookie, "GET", "/api/diet")).status).toBe(200);
  });

  it("answers 403 for a current at-or-above screen", async () => {
    const maya = await newUser();
    await storeResult(maya.id, "at_or_above", 1);
    expect((await call(maya.cookie, "GET", "/api/diet")).status).toBe(403);
  });

  it("uses the latest result, not the best one", async () => {
    const maya = await newUser();
    await storeResult(maya.id, "below", 30);
    await storeResult(maya.id, "at_or_above", 1);
    expect((await call(maya.cookie, "GET", "/api/diet")).status).toBe(403);
  });

  it("does not let one user's screen open another's diet content", async () => {
    const maya = await newUser();
    const sam = await newUser("Sam");
    await storeResult(maya.id, "below", 1);
    expect((await call(maya.cookie, "GET", "/api/diet")).status).toBe(200);
    expect((await call(sam.cookie, "GET", "/api/diet")).status).toBe(403);
  });

  it("starts one plan that ends in 4 weeks, and refuses a second start", async () => {
    const maya = await newUser();
    await storeResult(maya.id, "below", 1);
    const start = await call(maya.cookie, "POST", "/api/diet/start");
    expect(start.status).toBe(201);
    expect(await start.json()).toMatchObject({ status: "active" });
    const [plan] = await db.select().from(dietPlan).where(eq(dietPlan.userId, maya.id));
    expect(plan?.status).toBe("active");
    const days =
      ((plan?.eliminationEndsAt.getTime() ?? 0) - (plan?.startedAt.getTime() ?? 0)) / DAY;
    expect(days).toBe(28);
    expect((await call(maya.cookie, "POST", "/api/diet/start")).status).toBe(409);
    const plan2 = (await (await call(maya.cookie, "GET", "/api/diet")).json()) as {
      plan: { eliminationEndsAt: string };
    };
    expect(plan2.plan.eliminationEndsAt).toBe(plan?.eliminationEndsAt.toISOString());
  });
});

describe("taking the screener", () => {
  it("shows the questions without the answer values, and says it is a placeholder", async () => {
    const maya = await newUser();
    const res = await call(maya.cookie, "GET", "/api/screening");
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.status).toBe("none");
    expect(body.canTake).toBe(true);
    expect(body.instrument.isPlaceholder).toBe(true);
    expect(body.instrument.questions).toHaveLength(5);
    expect(text).not.toContain('"value"');
    expect(text).not.toContain("score");
  });

  it("scores 3 as below and 4 as at-or-above, and never returns the score", async () => {
    const low = await newUser();
    const lowRes = await submit(low.cookie, [1, 1, 1, 0, 0]);
    expect(lowRes.status).toBe(200);
    expect(await lowRes.json()).toEqual({ status: "below" });
    expect((await call(low.cookie, "GET", "/api/diet")).status).toBe(200);

    const high = await newUser();
    const highRes = await submit(high.cookie, [1, 1, 1, 1, 0]);
    expect(await highRes.json()).toEqual({ status: "at_or_above" });
    expect((await call(high.cookie, "GET", "/api/diet")).status).toBe(403);
    const rows = await db.select().from(result).where(eq(result.userId, high.id));
    expect(rows[0]).toMatchObject({ score: 4, tier: "at_or_above", instrumentId: "placeholder" });
  });

  it("refuses a retake for 90 days after an at-or-above result, then allows it", async () => {
    const maya = await newUser();
    await storeResult(maya.id, "at_or_above", 89);
    expect((await submit(maya.cookie, [0, 0, 0, 0, 0])).status).toBe(409);
    const status = (await (await call(maya.cookie, "GET", "/api/screening")).json()) as {
      status: string;
      canTake: boolean;
      retakeAt: string;
      instrument?: unknown;
    };
    expect(status).toMatchObject({ status: "at_or_above", canTake: false });
    expect(status.instrument).toBeUndefined();
    expect(new Date(status.retakeAt).getTime()).toBeGreaterThan(Date.now());

    const sam = await newUser("Sam");
    await storeResult(sam.id, "at_or_above", 90);
    expect((await submit(sam.cookie, [0, 0, 0, 0, 0])).status).toBe(200);
  });

  it("refuses answers that do not fit, and a different instrument version", async () => {
    const maya = await newUser();
    for (const answers of [[], [0, 0, 0, 0], [0, 0, 0, 0, 3], [0, 0, 0, 0, 0.5], "x"]) {
      expect((await submit(maya.cookie, answers as number[])).status).toBe(400);
    }
    const stale = await call(maya.cookie, "POST", "/api/screening", {
      instrumentId: "placeholder",
      instrumentVersion: 99,
      answers: [0, 0, 0, 0, 0],
    });
    expect(stale.status).toBe(409);
    const extra = await call(maya.cookie, "POST", "/api/screening", {
      instrumentId: "placeholder",
      instrumentVersion: 1,
      answers: [0, 0, 0, 0, 0],
      tier: "below",
    });
    expect(extra.status).toBe(400);
    expect(await db.select().from(result).where(eq(result.userId, maya.id))).toEqual([]);
  });

  it("pauses the plan on an at-or-above result and resumes it, with the same dates, on a later below result", async () => {
    const maya = await newUser();
    await storeResult(maya.id, "below", 5);
    await call(maya.cookie, "POST", "/api/diet/start");
    const [before] = await db.select().from(dietPlan).where(eq(dietPlan.userId, maya.id));

    // The screen expires (moved back), and the re-screen comes back at or above.
    await db
      .update(result)
      .set({ completedAt: ago(91) })
      .where(eq(result.userId, maya.id));
    expect((await submit(maya.cookie, [2, 2, 2, 2, 2])).status).toBe(200);
    const [paused] = await db.select().from(dietPlan).where(eq(dietPlan.userId, maya.id));
    expect(paused?.status).toBe("paused");

    await db
      .update(result)
      .set({ completedAt: ago(91) })
      .where(eq(result.userId, maya.id));
    expect((await submit(maya.cookie, [0, 0, 0, 0, 0])).status).toBe(200);
    const [after] = await db.select().from(dietPlan).where(eq(dietPlan.userId, maya.id));
    expect(after?.status).toBe("active");
    expect(after?.eliminationEndsAt).toEqual(before?.eliminationEndsAt);
    expect(after?.startedAt).toEqual(before?.startedAt);
  });
});

describe("what the screens and responses may say", () => {
  it("leaves out the score and the banned wording from PRD 5.5", async () => {
    const maya = await newUser();
    const texts: string[] = [];
    texts.push(await (await call(maya.cookie, "GET", "/api/screening")).text());
    texts.push(await (await submit(maya.cookie, [2, 2, 2, 2, 2])).text());
    texts.push(await (await call(maya.cookie, "GET", "/api/screening")).text());
    texts.push(await (await call(maya.cookie, "GET", "/api/diet")).text());
    texts.push(await (await call(maya.cookie, "POST", "/api/referral")).text());
    const sam = await newUser("Sam");
    await storeResult(sam.id, "below", 1);
    texts.push(await (await call(sam.cookie, "GET", "/api/diet")).text());
    for (const text of texts) {
      expect(text).not.toMatch(
        /eating disorder|diagnos|you have|"score"|calori|safe food|trigger/i,
      );
    }
  });
});

describe("the referral", () => {
  it("logs each time it is shown, for that user only", async () => {
    const maya = await newUser();
    const sam = await newUser("Sam");
    const first = await call(maya.cookie, "POST", "/api/referral");
    expect(first.status).toBe(200);
    const body = (await first.json()) as { resources: unknown[]; crisis: string };
    expect(body.resources.length).toBeGreaterThan(0);
    expect(body.crisis).toContain("988");
    await call(maya.cookie, "POST", "/api/referral");
    expect(await db.select().from(referralLog).where(eq(referralLog.userId, maya.id))).toHaveLength(
      2,
    );
    expect(await db.select().from(referralLog).where(eq(referralLog.userId, sam.id))).toHaveLength(
      0,
    );
  });
});

describe("the database checks", () => {
  it("refuses a tier or plan status the API never writes", async () => {
    const maya = await newUser();
    await expect(
      db.insert(result).values({
        userId: maya.id,
        instrumentId: "placeholder",
        instrumentVersion: 1,
        answers: {},
        score: 0,
        tier: "high",
      }),
    ).rejects.toThrow();
    await expect(
      db
        .insert(dietPlan)
        .values({ userId: maya.id, eliminationEndsAt: new Date(), status: "done" }),
    ).rejects.toThrow();
  });
});
