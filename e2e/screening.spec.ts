import type { Page } from "@playwright/test";

import { expect, signUp, siteNav, test } from "./fixtures";

async function answer(page: Page, label: string, times: number) {
  for (let i = 0; i < times; i++) {
    await page.getByRole("radio", { name: label }).check({ force: true });
    await page.getByRole("button", { name: "Continue" }).click();
  }
}

test("signed out, the screener, diet plan, and referral send you to sign in", async ({
  page,
  ip: _,
}) => {
  for (const path of ["/screening", "/diet", "/referral"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
  }
});

test("before the questions, the diet plan asks for them and shows no plan", async ({
  page,
  ip: _,
}) => {
  await signUp(page);
  await (await siteNav(page)).getByRole("link", { name: "Diet plan" }).click();
  await expect(page.getByRole("heading", { name: "A few questions first" })).toBeVisible();
  await expect(page.getByText("Placeholder content")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start the plan" })).toHaveCount(0);
});

test("answering below the threshold opens the diet plan, which starts with a fixed end date", async ({
  page,
  ip: _,
}) => {
  await signUp(page);
  await page.goto("/screening");
  await expect(page.getByText("Placeholder questions, not a clinical screen")).toBeVisible();
  await expect(page.getByText("Question 1 of 5")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await answer(page, "Never", 5);

  await expect(page.getByRole("heading", { name: "Check your answers" })).toBeFocused();
  await expect(page.getByText("Placeholder questions, not a clinical screen")).toBeVisible();
  // A mis-tap can be fixed before it counts.
  await page
    .getByRole("button", { name: /^Change answer to/ })
    .first()
    .click();
  await page.getByRole("radio", { name: "Sometimes" }).check({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Submit answers" }).click();

  await expect(page.getByRole("heading", { name: "Thank you for answering" })).toBeFocused();
  await page.getByRole("link", { name: "Go to the diet plan" }).click();
  await expect(page.getByText("Placeholder content, not dietary advice")).toBeVisible();
  await page.getByRole("button", { name: "Start the plan" }).click();
  await expect(page.getByText(/This phase ends on/)).toBeVisible();
  await expect(page.getByText("Step 1")).toBeVisible();
});

test("answering at or above the threshold hides the diet plan and shows who can help", async ({
  page,
  ip: _,
}) => {
  await signUp(page);
  await page.goto("/screening");
  await answer(page, "Often", 5);
  await page.getByRole("button", { name: "Submit answers" }).click();

  await expect(
    page.getByRole("heading", { name: "Let's talk this through with someone first" }),
  ).toBeFocused();
  await expect(page.locator("body")).not.toContainText(/score|eating disorder|diagnos/i);

  // The questions stay closed, and the diet plan stays hidden.
  await page.goto("/screening");
  await expect(page.getByText(/You can answer these again on/)).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.goto("/diet");
  await expect(page.getByText("Placeholder content")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "See who can help" })).toBeVisible();

  await page.getByRole("link", { name: "See who can help" }).click();
  await expect(page.getByRole("heading", { name: "People who can help" })).toBeVisible();
  await expect(page.getByText(/988/)).toBeVisible();
  // The journal still works.
  await (await siteNav(page)).getByRole("link", { name: "Journal" }).click();
  await expect(page).toHaveURL(/\/journal/);
});

test("no horizontal scroll and 44px targets on the question screen", async ({ page, ip: _ }) => {
  await signUp(page);
  await page.goto("/screening");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const target of await page
    .locator("main button:visible, main a:visible, main .choice")
    .all()) {
    const box = await target.boundingBox();
    expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
  }
});
