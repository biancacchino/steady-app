import { expect, newUser, test } from "./fixtures";

test("the landing page has one h1, the section headings, and both credits", async ({
  page,
  ip: _,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle("Steady");

  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "An IBS journal that asks how you feel about food before it asks you to cut anything out.",
  );
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText([
    "Why Steady exists",
    "How Steady handles it",
    "Where this is coming from",
  ]);
  await expect(
    page.getByRole("heading", { name: "A check-in comes before any diet advice" }),
  ).toBeVisible();
  await expect(
    page.getByText("The appointment summary and the food check-in come next."),
  ).toBeVisible();

  const footer = page.getByRole("contentinfo");
  await expect(
    footer.getByText("Research and product idea by Beatrice Javier", { exact: true }),
  ).toBeVisible();
  await expect(footer.getByText("Software by Bianca Javier", { exact: true })).toBeVisible();
});

test("the sample entry uses the journal's labeled rows and is not interactive", async ({
  page,
  ip: _,
}) => {
  await page.goto("/");
  const sample = page.getByRole("figure");
  await expect(sample.locator("dt")).toHaveText(["Food", "Symptoms", "Context"]);
  await expect(sample.locator("dd")).toHaveText([
    "Leftover pasta with pesto, sparkling water",
    "Bloating in the afternoon · Severity medium",
    "None noted",
  ]);
  await expect(sample.getByRole("button")).toHaveCount(0);
  await expect(sample.getByRole("link")).toHaveCount(0);
});

test("signed out, Join the waitlist opens an email to a real address", async ({ page, ip: _ }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "Open your journal" })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  const href = await main.getByRole("link", { name: "Join the waitlist" }).getAttribute("href");
  const email = "steadyappjournal@gmail.com";
  const url = new URL(href ?? "");
  expect(url.pathname).toBe(email);
  expect(url.searchParams.get("subject")).toBe("Steady waitlist");
  expect(url.searchParams.get("body")).toContain("permission to email me");
  // Without a default mail app the link does nothing, so the address is also shown as text.
  await expect(main.getByText(`Or email ${email}`)).toBeVisible();
});

test("signed in, the landing page offers Open your journal instead", async ({
  page,
  ip,
  baseURL,
}) => {
  const created = await page.request.post("/api/auth/sign-up/email", {
    data: { ...newUser(), ageConfirmedAt: new Date().toISOString() },
    headers: { "x-forwarded-for": ip, origin: baseURL ?? "" },
  });
  expect(created.ok()).toBe(true);

  await page.goto("/");
  const main = page.getByRole("main");
  await expect(page).toHaveURL(/\/$/);
  await expect(main.getByRole("link", { name: "Join the waitlist" })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await expect(main.getByText("steadyappjournal@gmail.com")).toHaveCount(0);
  await main.getByRole("link", { name: "Open your journal" }).click();
  await expect(page).toHaveURL(/\/journal$/);
  await expect(page.getByRole("button", { name: "New entry" })).toBeVisible();
});

for (const width of [320, 390, 1280]) {
  test(`no horizontal scroll and 44px actions at ${width}px`, async ({ page, ip: _ }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);

    for (const name of ["Join the waitlist", "Sign in"]) {
      const box = await page.getByRole("main").getByRole("link", { name }).boundingBox();
      // Rounded, because Firefox and 3x screens can report 44px as 43.99999.
      expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
    }
  });
}

test("on wide screens a section heading stays in view while its items scroll", async ({
  page,
  ip: _,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page
    .getByRole("heading", { name: "Review your summary before you share it" })
    .scrollIntoViewIfNeeded();
  const box = await page.getByRole("heading", { name: "How Steady handles it" }).boundingBox();
  expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect(box?.y ?? 9999).toBeLessThan(800);
});

test("the footer credit for Bianca opens the software page", async ({ page, ip: _ }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Bianca Javier" }).click();
  await expect(page).toHaveURL(/\/about\/software$/);
  await expect(page).toHaveTitle("How Steady is built - Steady");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Read the code on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/biancacchino/steady-app",
  );
});

// The page reuses landing.css, which the loop above tests at three widths; 320px is the tightest.
test("the software page has no horizontal scroll at 320px", async ({ page, ip: _ }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/about/software");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
