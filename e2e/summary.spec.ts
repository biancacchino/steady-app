import type { Page } from "@playwright/test";

import { expect, save, signUp, test } from "./fixtures";

const RANGE = "/summary?from=2026-10-01&to=2026-10-10";

async function withFlaggedEntries(page: Page) {
  await signUp(page);
  await save(page, {
    occurredAt: "2026-10-05T16:30:00Z",
    food: "Pasta",
    symptom: "bloated",
    flagged: true,
  });
  await save(page, {
    occurredAt: "2026-10-06T16:30:00Z",
    food: "Secret soup",
    symptom: "bloating",
    flagged: true,
  });
  await save(page, { occurredAt: "2026-10-07T16:30:00Z", food: "Rice" });
}

test("export waits until Worth flagging has been on screen", async ({ page, ip: _ }) => {
  await withFlaggedEntries(page);
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto(RANGE);
  const exportPdf = page.getByRole("button", { name: "Reviewed, export PDF" });
  await expect(exportPdf).toBeDisabled();
  await expect(page.getByText("Read through Worth flagging to continue.")).toBeVisible();

  await page.getByRole("heading", { name: "Questions to bring" }).scrollIntoViewIfNeeded();
  await expect(exportPdf).toBeEnabled();
  await expect(page.getByRole("button", { name: "Show PDF preview" })).toBeVisible();
});

test("an entry left out never reaches the copied text or the PDF preview", async ({
  page,
  ip: _,
  browserName,
}) => {
  if (browserName === "chromium") {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  }
  await withFlaggedEntries(page);
  await page.goto(RANGE);
  await page.getByLabel("For (optional)").fill("Dr. Osei");
  const seen = (text: string) => page.getByText(text).filter({ visible: true });
  await expect(seen("2 of 3 logged days mentioned bloating.")).toHaveCount(1);
  await page.getByRole("checkbox", { name: /^Include, Tuesday 6 October/ }).uncheck();
  // The left-out entry stops counting, and untouched suggestions follow.
  await expect(seen("You logged 2 entries on 2 days.")).toHaveCount(1);
  await expect(seen("2 of 3 logged days mentioned bloating.")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Question 1" })).not.toHaveValue(/Bloating/);
  // Every entry has the note; only the left-out one shows it.
  await expect(
    page.getByText("Left out of this summary. Still in your journal.").filter({ visible: true }),
  ).toHaveCount(1);

  await page.getByRole("heading", { name: "Questions to bring" }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Show PDF preview" }).click();
  const paper = page.getByRole("document", { name: "PDF preview" });
  await expect(paper).toContainText("Pasta");
  await expect(paper).toContainText("Dr. Osei");
  await expect(paper).not.toContainText("Secret soup");

  const copied = page.waitForResponse((res) => res.url().endsWith("/text"));
  await page.getByRole("button", { name: "Copy as text" }).click();
  const text = await (await copied).text();
  expect(text).toContain("Food: Pasta");
  expect(text).not.toContain("Secret soup");
});

test("Reviewed, export PDF downloads the reviewed summary", async ({ page, ip: _ }) => {
  await withFlaggedEntries(page);
  await page.goto(RANGE);
  await page.getByRole("heading", { name: "Questions to bring" }).scrollIntoViewIfNeeded();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Reviewed, export PDF" }).click();
  expect((await download).suggestedFilename()).toBe("appointment-summary-2026-10-10.pdf");
  await expect(
    page.getByRole("status").filter({ hasText: "Your PDF is downloading" }),
  ).toBeVisible();
});

test("questions can be edited and added, up to four", async ({ page, ip: _ }) => {
  await withFlaggedEntries(page);
  await page.goto(RANGE);
  const questions = page.getByRole("textbox", { name: /^Question \d$/ });
  await expect(questions.first()).toBeVisible();
  const count = await questions.count();
  expect(count).toBeGreaterThanOrEqual(2);
  for (let i = count; i < 4; i++)
    await page.getByRole("button", { name: "Add a question" }).click();
  await expect(questions).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Add a question" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Question 4" }).fill("Should I keep the journal going?");
  await expect(page.getByRole("textbox", { name: "Question 4" })).toHaveValue(
    "Should I keep the journal going?",
  );
});

for (const width of [320, 1280]) {
  test(`no horizontal scroll and 44px controls at ${width}px`, async ({ page, ip: _ }) => {
    await withFlaggedEntries(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(RANGE);
    await page.getByRole("heading", { name: "Questions to bring" }).scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    const targets = page.locator(".sheet button, .sheet .incl, .sheet textarea, .site-head a");
    for (const target of await targets.all()) {
      const box = await target.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
}

test("the journal links to the summary", async ({ page, ip: _ }) => {
  await signUp(page);
  await page.getByRole("link", { name: "Appointment summary" }).click();
  await expect(page).toHaveURL(/\/summary/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Get ready for your appointment",
  );
});
