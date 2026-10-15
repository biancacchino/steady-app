import type { Page } from "@playwright/test";

import { expect, newUser, test } from "./fixtures";

// A fixed zone and a fixed past week, so the results never depend on today's date.
test.use({ timezoneId: "America/Toronto" });

const weekUrl = (week: string) => `/journal?week=${week}`;

async function signUp(page: Page) {
  const user = newUser();
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByText("I am 18 or older").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/journal$/);
}

async function save(page: Page, entry: Record<string, unknown>) {
  const res = await page.request.post("/api/entries", {
    data: { timeZone: "America/Toronto", ...entry },
  });
  expect(res.status()).toBe(201);
}

test("shows a week's entries grouped by day, with the same rows on every entry", async ({
  page,
  ip: _,
}) => {
  await signUp(page);
  await save(page, {
    occurredAt: "2026-10-05T16:30:00Z",
    food: "Toast",
    symptom: "bloated",
    severity: "medium",
    context: ["stress"],
  });
  await save(page, { occurredAt: "2026-10-06T22:00:00Z", symptom: "bloating, cramps" });
  await save(page, { occurredAt: "2026-10-06T17:00:00Z", food: "Rice" });

  // A Wednesday in the URL shows its whole week (decision 12).
  await page.goto(weekUrl("2026-10-07"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("October 2026");
  await expect(
    page.getByText("You logged 3 entries on 2 days. 2 of 2 logged days mentioned bloating."),
  ).toBeVisible();

  // The strip: a word under days with a symptom, and only days with entries are buttons.
  await expect(
    page.getByRole("button", { name: "Monday 5 October, bloating mentioned" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tuesday 6 October, bloating mentioned" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Wednesday 7 October/ })).toHaveCount(0);

  // Every entry has Food, Symptoms, and Context, with an explicit empty value.
  const monday = page.locator(".day-group", {
    has: page.getByRole("heading", { name: "Monday 5 October" }),
  });
  await expect(monday.getByText("12:30")).toBeVisible();
  await expect(monday.getByText("Toast")).toBeVisible();
  await expect(monday.getByText("· Severity medium")).toBeVisible();
  await expect(monday.getByText("Stress")).toBeVisible();
  const tuesday = page.locator(".day-group", {
    has: page.getByRole("heading", { name: "Tuesday 6 October" }),
  });
  await expect(tuesday.locator(".entry")).toHaveCount(2);
  await expect(tuesday.getByText("None noted")).toHaveCount(2);

  // Picking a day moves focus to its heading.
  await page.getByRole("button", { name: "Tuesday 6 October, bloating mentioned" }).click();
  await expect(page.getByRole("heading", { name: "Tuesday 6 October" })).toBeFocused();

  // Refresh keeps the week; Previous and Back move through the URL.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("October 2026");
  await page.getByRole("button", { name: /Previous week/ }).click();
  await expect(page).toHaveURL(/week=2026-09-28/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("September - October 2026");
  await expect(page.getByText("No entries logged.")).toBeVisible();
  await page.goBack();
  await expect(page.getByText("You logged 3 entries on 2 days.", { exact: false })).toBeVisible();
});

test("a broken, future, or missing week shows the current week", async ({ page, ip: _ }) => {
  await signUp(page);
  for (const url of [weekUrl("banana"), weekUrl("2099-03-02"), "/journal"]) {
    await page.goto(url);
    await expect(page.getByRole("button", { name: /Next week/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Previous week/ })).toBeEnabled();
  }
});

test("shows an entry's time where it was logged, with its zone when that differs", async ({
  page,
  ip: _,
}) => {
  await signUp(page);
  await save(page, {
    occurredAt: "2026-10-05T16:30:00Z",
    timeZone: "America/Vancouver",
    food: "Lunch",
  });
  await page.goto(weekUrl("2026-10-05"));
  await expect(page.getByText("09:30 PDT")).toBeVisible();
});
