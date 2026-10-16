// Screener, diet gate, and referral API (PRD 5.5 to 5.7). Mounted behind the session check in app.ts.
// The gate is enforced here, not in the UI (non-negotiable 1): every `/api/diet` route runs
// `requireScreen` first and answers 403 unless the user's latest screen is current and below.
import { db } from "@steady/db";
import { dietPlan, instrument, referralLog, result } from "@steady/db/schema/screening";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";

import type { Variables } from "./app";
import { dietContent } from "./diet-content";
import { type Gate, gateState, type Question, scoreAnswers } from "./screening";

type Env = { Variables: Variables };

const DAY_MS = 86_400_000;
const NOT_AVAILABLE = "Diet content is not available right now.";
const INVALID = "Some answers could not be saved.";
const CRISIS = "If you are in distress right now, call or text 988 (Canada and the US).";
// Placeholder list (PRD 5.7, 12): no links or numbers are invented. A person has to verify
// a real, current, regional list before launch.
const RESOURCES = [
  {
    name: "Your family doctor or primary care provider",
    description: "A good first stop. You can bring your appointment summary.",
  },
  {
    name: "A registered dietitian",
    description:
      "Ask your doctor for a referral to a dietitian who works with gut and food concerns.",
  },
  {
    name: "A counsellor or therapist",
    description: "Someone who can talk with you about your relationship with food.",
  },
];

async function latestResult(userId: string) {
  const [row] = await db
    .select({ tier: result.tier, completedAt: result.completedAt })
    .from(result)
    .where(eq(result.userId, userId))
    .orderBy(desc(result.completedAt))
    .limit(1);
  return row ?? null;
}

// A real instrument (not a placeholder) wins over the placeholder, and a newer version over an older one.
async function activeInstrument() {
  const [row] = await db
    .select()
    .from(instrument)
    .orderBy(instrument.isPlaceholder, desc(instrument.version))
    .limit(1);
  if (!row) throw new Error("No screening instrument is installed.");
  return row;
}

const attempt = z
  .object({
    instrumentId: z.string(),
    instrumentVersion: z.number().int(),
    answers: z.array(z.number()).max(100),
  })
  .strict();

const gateBody = (gate: Gate) => ({
  status: gate.state,
  ...(gate.state === "at_or_above" ? { retakeAt: gate.retakeAt } : {}),
  ...(gate.state === "below" ? { expiresAt: gate.expiresAt } : {}),
});

export const screeningApi = new Hono<Env>()
  // Where the user stands, and the questions when they may take it. Answer values are left out,
  // so the response never shows how the score works.
  .get("/", async (c) => {
    const gate = gateState(await latestResult(c.get("user").id), new Date());
    const canTake = gate.state !== "at_or_above";
    if (!canTake) return c.json({ ...gateBody(gate), canTake });
    const active = await activeInstrument();
    const questions = (active.questions as Question[]).map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options.map((o) => ({ label: o.label })),
    }));
    return c.json({
      ...gateBody(gate),
      canTake,
      instrument: {
        id: active.id,
        version: active.version,
        isPlaceholder: active.isPlaceholder,
        questions,
      },
    });
  })

  .post("/", async (c) => {
    const body = attempt.safeParse(await c.req.json().catch(() => undefined));
    if (!body.success) return c.json({ error: INVALID }, 400);
    const userId = c.get("user").id;
    const gate = gateState(await latestResult(userId), new Date());
    if (gate.state === "at_or_above") {
      return c.json({ error: "This is not available to take again yet." }, 409);
    }
    const active = await activeInstrument();
    if (body.data.instrumentId !== active.id || body.data.instrumentVersion !== active.version) {
      return c.json({ error: "The questions changed. Reload to see the new ones." }, 409);
    }
    const questions = active.questions as Question[];
    const score = scoreAnswers(questions, body.data.answers);
    if (score === null) return c.json({ error: INVALID }, 400);
    const tier = score >= active.threshold ? "at_or_above" : "below";
    const answers = Object.fromEntries(questions.map((q, i) => [q.id, body.data.answers[i]]));

    await db.transaction(async (tx) => {
      await tx.insert(result).values({
        userId,
        instrumentId: active.id,
        instrumentVersion: active.version,
        answers,
        score,
        tier,
      });
      // At or above: the plan pauses. Below: a paused plan resumes, with its dates unchanged (PRD 5.5).
      await tx
        .update(dietPlan)
        .set({ status: tier === "below" ? "active" : "paused" })
        .where(
          and(
            eq(dietPlan.userId, userId),
            eq(dietPlan.status, tier === "below" ? "paused" : "active"),
          ),
        );
    });
    return c.json({ status: tier });
  });

const requireScreen = createMiddleware<Env>(async (c, next) => {
  const gate = gateState(await latestResult(c.get("user").id), new Date());
  if (gate.state !== "below") return c.json({ error: NOT_AVAILABLE }, 403);
  return next();
});

export const dietApi = new Hono<Env>()
  .use(requireScreen)
  .get("/", async (c) => {
    const [plan] = await db
      .select({
        startedAt: dietPlan.startedAt,
        eliminationEndsAt: dietPlan.eliminationEndsAt,
        status: dietPlan.status,
      })
      .from(dietPlan)
      .where(eq(dietPlan.userId, c.get("user").id));
    const day = (n: number) =>
      plan ? new Date(plan.startedAt.getTime() + (n - 1) * DAY_MS).toISOString() : null;
    return c.json({
      plan: plan ?? null,
      content: {
        ...dietContent,
        reintroduction: dietContent.reintroduction.map((step) => ({
          ...step,
          from: day(step.fromDay),
          to: day(step.toDay),
        })),
      },
    });
  })

  // One plan per user. The end date is fixed at the start and never moves (PRD 5.5, 5.6).
  .post("/start", async (c) => {
    const startedAt = new Date();
    const [created] = await db
      .insert(dietPlan)
      .values({
        userId: c.get("user").id,
        startedAt,
        eliminationEndsAt: new Date(
          startedAt.getTime() + dietContent.elimination.lengthDays * DAY_MS,
        ),
      })
      .onConflictDoNothing()
      .returning({
        startedAt: dietPlan.startedAt,
        eliminationEndsAt: dietPlan.eliminationEndsAt,
        status: dietPlan.status,
      });
    if (!created) return c.json({ error: "You already have a plan." }, 409);
    return c.json(created, 201);
  });

export const referralApi = new Hono<Env>().post("/", async (c) => {
  await db.insert(referralLog).values({ userId: c.get("user").id });
  return c.json({
    resources: RESOURCES,
    crisis: CRISIS,
    careTeamLink: c.get("user").careTeamLink ?? null,
  });
});
