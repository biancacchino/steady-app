import type { Page } from "@playwright/test";

import { expect, newUser, test } from "./fixtures";

// A fixed zone and a fixed past week, so the results never depend on today's date.
test.use({ timezoneId: "America/Toronto" });

const weekUrl = (week: string) => `/journal?week=${week}`;

async function signUp(page: Page) {
  const user = newUser();
  await signUpAs(page, user);
  return user;
}

async function signUpAs(page: Page, user: ReturnType<typeof newUser>) {
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
  await expect(page.getByText("9:30 AM PDT")).toBeVisible();
});

test("saves a new entry from the card, which opens on Food and returns focus", async ({
  page,
  ip: _,
}) => {
  await signUp(page);
  const newEntry = page.getByRole("button", { name: "New entry" });
  await newEntry.click();
  const card = page.getByRole("dialog", { name: "New entry" });
  await expect(card.getByLabel("Food")).toBeFocused();
  await card.getByLabel("Food").fill("Toast");
  await card.getByLabel("Symptoms").fill("bloated");
  await card.getByRole("button", { name: "Stress" }).click();
  await card.getByRole("button", { name: "Save entry" }).click();

  await expect(card).toBeHidden();
  await expect(page.locator(".entry", { hasText: "Toast" })).toContainText("Stress");
  await expect(newEntry).toBeFocused();
});

test("an empty save explains itself and saves nothing", async ({ page, ip: _ }) => {
  await signUp(page);
  await page.getByRole("button", { name: "New entry" }).click();
  const card = page.getByRole("dialog", { name: "New entry" });
  await card.getByLabel("Food").fill("   ");
  await card.getByRole("button", { name: "Save entry" }).click();

  await expect(card.getByRole("alert")).toHaveText(
    "This entry is empty. Add what you ate, a symptom, or both.",
  );
  await expect(card.getByLabel("Food")).toHaveAttribute("aria-invalid", "true");
  await expect(card.getByLabel("Symptoms")).toHaveAttribute("aria-invalid", "true");
  await expect(card).toBeVisible();
});

test("edits an entry in place, keeping its time", async ({ page, ip: _ }) => {
  await signUp(page);
  await save(page, { occurredAt: "2026-10-05T16:30:00Z", food: "Toast", symptom: "bloated" });
  await page.goto(weekUrl("2026-10-05"));
  const editButton = page.getByRole("button", { name: "Edit entry, Monday 5 October 12:30 PM" });
  await editButton.click();

  const card = page.getByRole("dialog", { name: "Edit entry" });
  await expect(card.getByLabel("Food")).toHaveValue("Toast");
  await expect(card.getByLabel("Date")).toHaveValue("2026-10-05");
  await expect(card.getByLabel("Time")).toHaveValue("12:30");
  await card.getByLabel("Food").fill("Toast and jam");
  // Decision 16: a stray click outside does not throw away an edit.
  await page.mouse.click(5, 5);
  await expect(card.getByLabel("Food")).toHaveValue("Toast and jam");
  await card.getByRole("button", { name: "Save entry" }).click();

  await expect(card).toBeHidden();
  await expect(editButton).toBeFocused();
  const entry = page.locator(".entry", { hasText: "Toast and jam" });
  await expect(entry).toContainText("12:30");
  await expect(page.locator(".entry")).toHaveCount(1);
});

test("closing keeps a draft for this user, and signing out removes it", async ({ page, ip: _ }) => {
  const user = await signUp(page);
  const newEntry = page.getByRole("button", { name: "New entry" });
  await newEntry.click();
  await page.getByLabel("Symptoms").fill("bad cramps");
  await page.keyboard.press("Escape");

  await expect(page.getByRole("status")).toHaveText("Draft kept on this device.");
  await expect(newEntry).toBeFocused();
  await newEntry.click();
  await expect(page.getByLabel("Symptoms")).toHaveValue("bad cramps");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/journal/);
  await page.getByRole("button", { name: "New entry" }).click();
  await expect(page.getByLabel("Symptoms")).toHaveValue("");
});

test("a cleared date or time is explained, not silently ignored", async ({ page, ip: _ }) => {
  await signUp(page);
  await page.getByRole("button", { name: "New entry" }).click();
  const card = page.getByRole("dialog", { name: "New entry" });
  await card.getByLabel("Food").fill("Toast");
  await card.getByLabel("Date").fill("");
  await card.getByRole("button", { name: "Save entry" }).click();
  await expect(card.getByRole("alert")).toHaveText("Choose a date and a time.");
  await expect(card).toBeVisible();
});

test("a draft emptied on purpose stays gone, and keeps no stray severity", async ({
  page,
  ip: _,
}) => {
  await signUp(page);
  const newEntry = page.getByRole("button", { name: "New entry" });
  await newEntry.click();
  await page.getByLabel("Symptoms").fill("cramps");
  await page.getByText("Add severity").click();
  await page.locator(".sev-opts").getByText("High").click();
  await expect(page.getByRole("radio", { name: "High" })).toBeChecked();
  await page.getByLabel("Symptoms").fill("");
  await page.getByLabel("Food").fill("Rice");
  await page.keyboard.press("Escape");

  // Kept for the food, but the severity had no symptom left.
  await newEntry.click();
  await expect(page.getByLabel("Food")).toHaveValue("Rice");
  // No severity was kept, so the severity choices start collapsed.
  await expect(page.locator("details.sev")).not.toHaveAttribute("open");

  // Emptied on purpose, then closed: nothing comes back.
  await page.getByLabel("Food").fill("");
  await page.getByRole("button", { name: "Cancel" }).click();
  await newEntry.click();
  await expect(page.getByLabel("Food")).toHaveValue("");
});
