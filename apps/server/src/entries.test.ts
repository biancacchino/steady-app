// The entries API, through the real app, session check, and database (milestone 1, step 3).
// Needs the local Postgres with migrations applied (npm run db:start, npm run db:migrate).
import { randomUUID } from "node:crypto";
import { auth } from "@steady/auth";
import { db } from "@steady/db";
import { user } from "@steady/db/schema/index";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "./app";

const EMPTY = "This entry is empty. Add what you ate, a symptom, or both.";
const emails: string[] = [];
let maya: string;
let sam: string;

/** Signs up a new user through Better-Auth and returns their session cookie. */
async function signUp(name: string) {
  const email = `${name.toLowerCase()}-${randomUUID()}@example.com`;
  emails.push(email);
  const res = await auth.api.signUpEmail({
    body: { name, email, password: "Password123!", ageConfirmedAt: new Date() },
    asResponse: true,
  });
  const cookie = res.headers.getSetCookie()[0]?.split(";")[0];
  if (!cookie) throw new Error("Sign-up returned no session cookie.");
  return cookie;
}

const listPath = (from: string, to: string) => `/api/entries?from=${from}&to=${to}`;

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

type Listed = { id: string; food: string | null };
async function entriesOf(res: Response) {
  return ((await res.json()) as { entries: Listed[] }).entries;
}

async function create(cookie: string, fields: Record<string, unknown>) {
  const res = await call(cookie, "POST", "/api/entries", {
    occurredAt: "2026-10-13T16:30:00Z",
    timeZone: "America/Toronto",
    ...fields,
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string } & Record<string, unknown>;
}

beforeAll(async () => {
  maya = await signUp("Maya");
  sam = await signUp("Sam");
});

afterAll(async () => {
  await db.delete(user).where(inArray(user.email, emails));
});

describe("entries API", () => {
  it("refuses every route without a session", async () => {
    expect((await call(null, "GET", listPath("2026-10-12", "2026-10-18"))).status).toBe(401);
    expect((await call(null, "POST", "/api/entries", { food: "Toast" })).status).toBe(401);
    expect((await call(null, "PATCH", `/api/entries/${randomUUID()}`, {})).status).toBe(401);
    expect((await call(null, "DELETE", `/api/entries/${randomUUID()}`)).status).toBe(401);
  });

  it("creates an entry, cleaning the text", async () => {
    const entry = await create(maya, {
      food: "  Toast\n\n",
      symptom: "Bloating",
      severity: "medium",
      context: ["stress", "stress", "sleep"],
    });
    expect(entry).toMatchObject({
      food: "Toast",
      symptom: "Bloating",
      severity: "medium",
      context: ["stress", "sleep"],
      flagged: false,
      timeZone: "America/Toronto",
      occurredAt: "2026-10-13T16:30:00.000Z",
    });
    expect(entry).not.toHaveProperty("userId");
  });

  it("shows the empty-entry message for an empty or blank-only entry", async () => {
    for (const fields of [{}, { food: "   ", symptom: "\u200B" }, { food: null, symptom: null }]) {
      const res = await call(maya, "POST", "/api/entries", {
        occurredAt: "2026-10-13T16:30:00Z",
        timeZone: "America/Toronto",
        ...fields,
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: EMPTY });
    }
  });

  it("drops a severity sent without a symptom (PRD 5.2)", async () => {
    const entry = await create(maya, { food: "Rice", severity: "high" });
    expect(entry.severity).toBeNull();
  });

  it("refuses bad input: unknown fields, bad zones, long text", async () => {
    const base = { occurredAt: "2026-10-13T16:30:00Z", timeZone: "America/Toronto", food: "Tea" };
    for (const body of [
      { ...base, userId: "someone-else" },
      { ...base, timeZone: "-04:00" },
      { ...base, food: "a".repeat(1001) },
      { ...base, severity: "extreme", symptom: "Pain" },
      { ...base, occurredAt: "yesterday" },
      { ...base, occurredAt: "0000-01-01T00:00:00Z" },
    ]) {
      expect((await call(maya, "POST", "/api/entries", body)).status).toBe(400);
    }
  });

  it("edits an entry, and clearing the symptom clears its severity", async () => {
    const entry = await create(maya, { food: "Pasta", symptom: "Cramping", severity: "low" });
    const res = await call(maya, "PATCH", `/api/entries/${entry.id}`, {
      symptom: null,
      flagged: true,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      food: "Pasta",
      symptom: null,
      severity: null,
      flagged: true,
    });
  });

  it("shows the empty-entry message when an edit would empty the entry", async () => {
    const entry = await create(maya, { food: "Toast" });
    const res = await call(maya, "PATCH", `/api/entries/${entry.id}`, { food: null });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: EMPTY });
  });

  it("requires the time zone whenever the time changes", async () => {
    const entry = await create(maya, { food: "Soup" });
    const res = await call(maya, "PATCH", `/api/entries/${entry.id}`, {
      occurredAt: "2026-11-03T17:30:00Z",
    });
    expect(res.status).toBe(400);
  });

  it("lists entries by the day they happened where they were logged", async () => {
    const cookie = await signUp("Week");
    // 00:30 on Tuesday 13 October in Toronto is 21:30 on Monday in Vancouver.
    const snack = await create(cookie, {
      food: "Snack",
      occurredAt: "2026-10-13T04:30:00Z",
    });
    const monday = await call(cookie, "GET", listPath("2026-10-12", "2026-10-12"));
    const tuesday = await call(cookie, "GET", listPath("2026-10-13", "2026-10-13"));
    expect(await monday.json()).toEqual({ entries: [], observations: ["No entries logged."] });
    expect((await entriesOf(tuesday)).map((e) => e.id)).toEqual([snack.id]);
  });

  // Decision 8: Postgres does not know "Asia/Calcutta", so storing it would break the week list.
  it("stores an old zone name under its current name, and still lists the week", async () => {
    const cookie = await signUp("Priya");
    const entry = await create(cookie, { food: "Chai", timeZone: "Asia/Calcutta" });
    expect(entry.timeZone).toBe("Asia/Kolkata");
    const week = await call(cookie, "GET", listPath("2026-10-12", "2026-10-18"));
    expect(week.status).toBe(200);
    expect((await entriesOf(week)).map((e) => e.id)).toEqual([entry.id]);
  });

  // Decision 10: the week view gets its sentences from the same request as its entries.
  it("lists the week's observations with its entries", async () => {
    const cookie = await signUp("Observed");
    await create(cookie, { symptom: "bloating", occurredAt: "2026-10-12T16:00:00Z" });
    await create(cookie, { symptom: "no pain, bloated", occurredAt: "2026-10-13T16:00:00Z" });
    const week = await call(cookie, "GET", listPath("2026-10-12", "2026-10-18"));
    expect(((await week.json()) as { observations: string[] }).observations).toEqual([
      "You logged 2 entries on 2 days.",
      "2 of 2 logged days mentioned bloating.",
    ]);
  });

  // Decision 12: a future week cannot be opened, so a future entry could never be seen again.
  it("refuses a time more than a day ahead, but allows a fast clock", async () => {
    const hour = 60 * 60 * 1000;
    const body = { timeZone: "America/Toronto", food: "Toast" };
    const ahead = (ms: number) => new Date(Date.now() + ms).toISOString();
    const late = await call(maya, "POST", "/api/entries", {
      ...body,
      occurredAt: ahead(25 * hour),
    });
    expect(late.status).toBe(400);
    const fast = await create(maya, { ...body, occurredAt: ahead(5 * 60 * 1000) });
    const moved = await call(maya, "PATCH", `/api/entries/${fast.id}`, {
      occurredAt: ahead(48 * hour),
      timeZone: "America/Toronto",
    });
    expect(moved.status).toBe(400);
  });

  // Decision 13: the week strip shows each day's symptom from these tags.
  it("tags each listed entry with the symptoms it mentions", async () => {
    const cookie = await signUp("Tagged");
    await create(cookie, {
      symptom: "cramping, no pain, bloated",
      occurredAt: "2026-10-12T16:00:00Z",
    });
    const week = await call(cookie, "GET", listPath("2026-10-12", "2026-10-18"));
    const [entry] = ((await week.json()) as { entries: { symptoms: string[] }[] }).entries;
    expect(entry?.symptoms).toEqual(["bloating", "cramping"]);
  });

  it("refuses bad date ranges", async () => {
    for (const query of [
      "",
      "?from=2026-10-12",
      "?from=12-10-2026&to=2026-10-18",
      "?from=2026-10-18&to=2026-10-12",
      "?from=2020-01-01&to=2026-10-18",
      "?from=0000-01-01&to=0000-01-02",
    ]) {
      expect((await call(maya, "GET", `/api/entries${query}`)).status).toBe(400);
    }
  });

  it("deletes an entry", async () => {
    const entry = await create(maya, { food: "Crackers" });
    expect((await call(maya, "DELETE", `/api/entries/${entry.id}`)).status).toBe(204);
    expect((await call(maya, "DELETE", `/api/entries/${entry.id}`)).status).toBe(404);
  });

  // PRD section 10: one user cannot read another user's rows.
  it("keeps each user's entries to themselves", async () => {
    const entry = await create(maya, { food: "Oatmeal", symptom: "Nausea" });
    const path = `/api/entries/${entry.id}`;

    expect((await call(sam, "PATCH", path, { food: "Changed" })).status).toBe(404);
    expect((await call(sam, "DELETE", path)).status).toBe(404);
    const list = await call(sam, "GET", listPath("2026-10-01", "2026-10-31"));
    expect(await entriesOf(list)).toEqual([]);

    const mine = await call(maya, "GET", listPath("2026-10-13", "2026-10-13"));
    const oatmeal = (await entriesOf(mine)).find((e) => e.id === entry.id);
    expect(oatmeal?.food).toBe("Oatmeal");
  });

  it("answers 404 for an id that is not a valid entry id", async () => {
    expect((await call(maya, "PATCH", "/api/entries/not-a-uuid", { food: "X" })).status).toBe(404);
  });
});
