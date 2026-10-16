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
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
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
  await expect(sample.getByText("A made-up entry, shown for this page only.")).toBeVisible();
  await expect(sample.getByRole("button")).toHaveCount(0);
  await expect(sample.getByRole("link")).toHaveCount(0);
});

test("signed out, Try it out goes to sign-up", async ({ page, ip: _ }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Open your journal" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  await page.getByRole("link", { name: "Try it out" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Try it out" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await page.getByRole("link", { name: "Open your journal" }).click();
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

    for (const name of ["Try it out", "Sign in"]) {
      const box = await page.getByRole("link", { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
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
