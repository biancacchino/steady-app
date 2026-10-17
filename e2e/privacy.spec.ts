import type { Page } from "@playwright/test";

import { expect, signUp, test } from "./fixtures";

/**
 * Makes the signed-in account look like one made before the consent box existed, until `keep`
 * returns false. The browser can't clear the database column, so the session answer is rewritten.
 */
async function withoutConsent(page: Page, keep = () => true) {
  await page.route("**/api/auth/get-session*", async (route) => {
    try {
      const res = await route.fetch();
      const body = await res.json();
      if (keep() && body?.user) body.user.privacyConsentAt = null;
      await route.fulfill({ response: res, json: body });
    } catch {
      // The page cancelled this request by navigating; there is nothing left to answer.
    }
  });
}

for (const [name, path, title] of [
  ["Privacy", "/privacy", "Privacy - Steady"],
  ["Terms", "/terms", "Terms - Steady"],
] as const) {
  test(`the footer opens ${name}, with no horizontal scroll at 320px`, async ({ page, ip: _ }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
}

test("sign-up requires the privacy box", async ({ page, ip: _ }) => {
  await page.goto("/sign-up");
  await page.getByText("I am 18 or older").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Agree to how Steady stores your data to continue.")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-up$/);
});

// apps/server/src/consent.test.ts covers the server holding that account's data routes.
test("an account without consent agrees once, then reaches the journal", async ({
  page,
  ip: _,
}) => {
  await signUp(page);
  let consented = false;
  await withoutConsent(page, () => !consented);
  page.on("request", (req) => {
    if (req.url().endsWith("/api/consent") && req.method() === "POST") consented = true;
  });

  await page.goto("/journal");
  await expect(page).toHaveURL(/\/consent$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How Steady stores your data");

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Agree to how Steady stores your data to continue.")).toBeVisible();

  await page.getByText("I agree to Steady storing").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/journal$/);
});

test("an account without consent can still reach Account to export or delete", async ({
  page,
  ip: _,
}) => {
  await signUp(page);
  await withoutConsent(page);
  await page.goto("/consent");
  await page.getByRole("link", { name: "Account page" }).click();
  await expect(page).toHaveURL(/\/account$/);
});
