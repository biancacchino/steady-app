// The summaries API, through the real app, session check, and database (milestone 2).
// Needs the local Postgres with migrations applied (npm run db:start, npm run db:migrate).
import { randomUUID } from "node:crypto";
import { auth } from "@steady/auth";
import { db } from "@steady/db";
import { user } from "@steady/db/schema/index";
import { env } from "@steady/env/server";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "./app";

const emails: string[] = [];
let maya: string;
let sam: string;

async function signUp(name: string) {
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
  return cookie;
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

async function addEntry(cookie: string, occurredAt: string, fields: Record<string, unknown>) {
  const res = await call(cookie, "POST", "/api/entries", {
    occurredAt,
    timeZone: "America/Toronto",
    ...fields,
  });
  return ((await res.json()) as { id: string }).id;
}

async function draft(cookie: string, body: Record<string, unknown>) {
  const res = await call(cookie, "POST", "/api/summaries", body);
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

let pasta: string;
let soup: string;

beforeAll(async () => {
  maya = await signUp("Maya");
  sam = await signUp("Sam");
  pasta = await addEntry(maya, "2026-09-05T16:30:00Z", {
    food: "Pasta",
    symptom: "bloating",
    flagged: true,
  });
  soup = await addEntry(maya, "2026-09-06T16:30:00Z", {
    food: "Secret soup",
    symptom: "bloated",
    flagged: true,
  });
  await addEntry(maya, "2026-09-07T16:30:00Z", { food: "Rice" });
});

afterAll(async () => {
  await db.delete(user).where(inArray(user.email, emails));
});

const range = { from: "2026-09-01", to: "2026-09-10" };
const previewOf = (to: string, from?: string) =>
  `/api/summaries/preview?${from ? `from=${from}&` : ""}to=${to}`;

describe("summaries API", () => {
  it("rejects signed-out requests with 401", async () => {
    const res = await call(null, "GET", previewOf("2026-09-10"));
    expect(res.status).toBe(401);
  });

  it("previews a range: observations, flagged entries, and suggested questions", async () => {
    const res = await call(maya, "GET", previewOf(range.to, range.from));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      observations: string[];
      flagged: { id: string }[];
      questions: string[];
    };
    expect(body.observations).toEqual([
      "You logged 3 entries on 3 days.",
      "2 of 3 logged days mentioned bloating.",
    ]);
    expect(body.flagged.map((e) => e.id)).toEqual([pasta, soup]);
    expect(body.questions[0]).toBe(
      "Bloating was noted on 2 of 3 logged days. Is that worth looking into?",
    );
  });

  it("defaults to the 30 days ending on the given day when nothing was exported", async () => {
    const res = await call(sam, "GET", previewOf("2026-10-15"));
    expect(((await res.json()) as { from: string }).from).toBe("2026-09-16");
  });

  it("refuses a bad range or a bad draft", async () => {
    expect((await call(maya, "GET", previewOf("nope"))).status).toBe(400);
    const five = ["a?", "b?", "c?", "d?", "e?"];
    for (const body of [
      { ...range, questions: five },
      { ...range, questions: ["x".repeat(301)] },
      { ...range, userId: "someone-else" },
      { from: "2026-09-10", to: "2026-09-01" },
      { ...range, excludedEntryIds: ["not-a-uuid"] },
    ]) {
      expect((await call(maya, "POST", "/api/summaries", body)).status).toBe(400);
    }
  });

  it("builds the PDF preview from the same snapshot, without saving anything", async () => {
    const res = await call(maya, "POST", "/api/summaries/draft", {
      ...range,
      excludedEntryIds: [soup],
      questions: ["Worth a look?"],
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      header: string[];
      snapshot: { flagged: { food: string }[]; questions: string[]; observations: string[] };
    };
    expect(body.header).toEqual(["Period: 1 September 2026 to 10 September 2026"]);
    expect(body.snapshot.flagged.map((f) => f.food)).toEqual(["Pasta"]);
    expect(body.snapshot.questions).toEqual(["Worth a look?"]);
    // The left-out entry's bloating no longer counts.
    expect(body.snapshot.observations).toEqual(["You logged 2 entries on 2 days."]);
  });

  it("refuses to export a summary that was not reviewed, and sends no file", async () => {
    const id = await draft(maya, range);
    for (const kind of ["pdf", "text"]) {
      const res = await call(maya, "POST", `/api/summaries/${id}/${kind}`);
      expect(res.status).toBe(409);
      expect(res.headers.get("content-type")).toContain("application/json");
    }
  });

  it("exports the reviewed snapshot: left-out entries never appear, and later edits change nothing", async () => {
    const id = await draft(maya, {
      ...range,
      providerName: "Dr. Osei",
      excludedEntryIds: [soup],
      questions: ["Is the bloating worth looking into?", ""],
    });
    expect((await call(maya, "POST", `/api/summaries/${id}/review`)).status).toBe(200);
    expect((await call(maya, "POST", `/api/summaries/${id}/review`)).status).toBe(409);

    // An edit after review does not reach the export.
    await call(maya, "PATCH", `/api/entries/${pasta}`, { food: "Changed later" });

    const text = await (await call(maya, "POST", `/api/summaries/${id}/text`)).text();
    expect(text).toContain("For: Dr. Osei");
    expect(text).toContain("Food: Pasta");
    expect(text).not.toContain("Changed later");
    expect(text).not.toContain("Secret soup");
    expect(text).toContain("1. Is the bloating worth looking into?\n");
    expect(text).not.toContain("2. ");

    const pdf = await call(maya, "POST", `/api/summaries/${id}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("cache-control")).toBe("no-store");
    expect(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
  });

  it("starts the next default range the day after the last export", async () => {
    const res = await call(maya, "GET", previewOf("2026-10-15"));
    expect(((await res.json()) as { from: string }).from).toBe("2026-09-11");
  });

  it("answers 404 for another user's summary", async () => {
    const id = await draft(maya, range);
    for (const kind of ["review", "pdf", "text"]) {
      expect((await call(sam, "POST", `/api/summaries/${id}/${kind}`)).status).toBe(404);
    }
    expect((await call(sam, "POST", "/api/summaries/not-a-uuid/review")).status).toBe(404);
  });

  it("never lists another user's entries in a preview", async () => {
    const res = await call(sam, "GET", previewOf(range.to, range.from));
    expect(((await res.json()) as { flagged: unknown[] }).flagged).toEqual([]);
  });
});
