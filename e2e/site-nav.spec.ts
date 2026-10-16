import { expect, signUp, siteNav, test } from "./fixtures";

test("signed out, the header offers the waitlist and sign in", async ({ page, ip: _ }) => {
  await page.goto("/");
  const header = await siteNav(page);
  await expect(header.getByRole("link", { name: "Join the waitlist" })).toHaveAttribute(
    "href",
    /^mailto:/,
  );
  await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  // The address is in the footer too, for visitors without a mail app.
  await expect(page.getByRole("contentinfo").getByText("steadyappjournal@gmail.com")).toBeVisible();

  await header.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("signed in, the header links the app and marks the current page", async ({ page, ip: _ }) => {
  await signUp(page);
  let header = await siteNav(page);
  await expect(header.getByRole("link", { name: "Journal" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(header.getByRole("link", { name: "Join the waitlist" })).toHaveCount(0);

  await header.getByRole("link", { name: "Appointment summary" }).click();
  await expect(page).toHaveURL(/\/summary$/);
  header = await siteNav(page);
  await expect(header.getByRole("link", { name: "Appointment summary" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(header.getByRole("link", { name: "Journal" })).not.toHaveAttribute("aria-current");
  await expect(header.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("the How it's made menu opens both pages and closes with Esc", async ({ page, ip: _ }) => {
  await page.goto("/");
  const header = await siteNav(page);
  const made = header.getByRole("button", { name: "How it's made" });
  await expect(made).toHaveAttribute("aria-expanded", "false");
  await made.click();
  await expect(made).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(made).toHaveAttribute("aria-expanded", "false");
  await expect(made).toBeFocused();

  await made.click();
  await header.getByRole("link", { name: "Software perspective" }).click();
  await expect(page).toHaveURL(/\/about\/software$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How Steady is built");

  await (await siteNav(page)).getByRole("button", { name: "How it's made" }).click();
  await header.getByRole("link", { name: "Healthcare perspective" }).click();
  await expect(page).toHaveURL(/\/about\/healthcare$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});

test("a click outside closes the How it's made menu", async ({ page, ip: _ }) => {
  await page.goto("/");
  const header = await siteNav(page);
  const made = header.getByRole("button", { name: "How it's made" });
  await made.click();
  await expect(header.getByRole("link", { name: "Software perspective" })).toBeVisible();
  // On a phone this also closes Menu, which hides the button, so check the list instead.
  await page.getByRole("heading", { level: 1 }).click();
  await expect(header.getByRole("link", { name: "Software perspective" })).toBeHidden();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 320, height: 700 } });

  test("the links sit behind Menu, which closes after a link or Esc", async ({ page, ip: _ }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    const menu = header.getByRole("button", { name: "Menu" });
    await expect(header.getByRole("link", { name: "Sign in" })).toBeHidden();

    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();

    await menu.click();
    await header.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  });

  test("no horizontal scroll and 44px targets with the menu open", async ({ page, ip: _ }) => {
    await signUp(page);
    const header = await siteNav(page);
    await header.getByRole("button", { name: "How it's made" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const target of await header.locator("button:visible, a:visible:not(.wordmark)").all()) {
      const box = await target.boundingBox();
      expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
    }
  });
});

test("the about pages link each author's profiles", async ({ page, ip: _ }) => {
  await page.goto("/about/healthcare");
  const health = page.getByRole("main");
  await expect(health.getByRole("link", { name: "Beatrice on LinkedIn" })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/beatrice-javier-1061291a7/",
  );

  await page.goto("/about/software");
  const software = page.getByRole("main");
  await expect(software.getByRole("link", { name: "Bianca on LinkedIn" })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/javierbianca/",
  );
  await expect(software.getByRole("link", { name: "Bianca on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/biancacchino",
  );
});
