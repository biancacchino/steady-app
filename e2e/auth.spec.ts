import { expect, newUser, test } from "./fixtures";

test("signing up opens the journal", async ({ page, ip: _ }) => {
  const user = newUser();
  await page.goto("/sign-up");
  await page.getByLabel("Invite code").fill(user.inviteCode);
  await page.getByLabel("Your name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByText("I am 18 or older").click();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/journal$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveTitle("Journal - Steady");
});

test("an empty sign-up shows every problem at once and focuses the first", async ({
  page,
  ip: _,
}) => {
  await page.goto("/sign-up");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Enter your invite code.")).toBeVisible();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByText("Enter your email.")).toBeVisible();
  await expect(page.getByText("Enter a password.")).toBeVisible();
  await expect(page.getByText("Confirm that you are 18 or older to continue.")).toBeVisible();
  await expect(page.getByLabel("Invite code")).toBeFocused();

  await page.getByLabel("Your name").fill("Maya");
  await expect(page.getByText("Enter your name.")).toBeHidden();
});

test("a wrong invite code is refused with a message that says only that", async ({
  page,
  ip: _,
}) => {
  const user = newUser();
  await page.goto("/sign-up");
  await page.getByLabel("Invite code").fill("not-the-code");
  await page.getByLabel("Your name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByText("I am 18 or older").click();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "That invite code doesn't work. Check it and try again.",
  );
  await expect(page).toHaveURL(/\/sign-up$/);
});

test("sign-up requires the 18 or older box", async ({ page, ip: _ }) => {
  const user = newUser();
  await page.goto("/sign-up");
  await page.getByLabel("Invite code").fill(user.inviteCode);
  await page.getByLabel("Your name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Confirm that you are 18 or older to continue.")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-up$/);
});

test("the server refuses a sign-up without age confirmation", async ({ request, ip, baseURL }) => {
  const user = newUser();
  const res = await request.post("/api/auth/sign-up/email", {
    data: {
      name: user.name,
      email: user.email,
      password: user.password,
      inviteCode: user.inviteCode,
    },
    headers: { "x-forwarded-for": ip, origin: baseURL ?? "" },
  });
  expect(res.status()).toBe(400);
});

test("signing out returns to sign in and locks the journal", async ({ page, ip: _ }) => {
  const user = newUser();
  await page.goto("/sign-up");
  await page.getByLabel("Invite code").fill(user.inviteCode);
  await page.getByLabel("Your name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByText("I am 18 or older").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/journal$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/journal");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("a failed sign-out says so and stays on the journal", async ({ page, ip: _ }) => {
  const user = newUser();
  await page.goto("/sign-up");
  await page.getByLabel("Invite code").fill(user.inviteCode);
  await page.getByLabel("Your name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByText("I am 18 or older").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/journal$/);

  await page.route("**/api/auth/sign-out", (route) => route.abort());
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("alert")).toHaveText("Sign-out did not work. Try again.");
  await expect(page).toHaveURL(/\/journal$/);
});

test("a missing asset file gets 404, not the app page", async ({ request }) => {
  const res = await request.get("/assets/missing-abc123.js");
  expect(res.status()).toBe(404);
});

test("signed-out API requests get 401", async ({ request }) => {
  const res = await request.get("/api/me");
  expect(res.status()).toBe(401);
});

test("sign in works with the keyboard alone, with a visible focus ring", async ({
  page,
  ip,
  baseURL,
}) => {
  const user = newUser();
  const created = await page.request.post("/api/auth/sign-up/email", {
    data: { ...user, ageConfirmedAt: new Date().toISOString() },
    headers: { "x-forwarded-for": ip, origin: baseURL ?? "" },
  });
  expect(created.ok()).toBe(true);
  await page.context().clearCookies();

  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();
  const outline = await page
    .getByLabel("Email")
    .evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
  await page.keyboard.type(user.email);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  await page.keyboard.type(user.password);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/journal$/);
});

test("repeated failed sign-ins are rate limited", async ({ page, ip: _ }) => {
  await page.goto("/sign-in");
  for (let i = 0; i < 4; i++) {
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill(`wrong password ${i}`);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  }
  await expect(page.getByRole("alert")).toHaveText(/Too many attempts/);
});

test.describe("server-side limits", () => {
  const signUp = (
    request: import("@playwright/test").APIRequestContext,
    ip: string,
    origin: string,
    data: object,
  ) =>
    request.post("/api/auth/sign-up/email", { data, headers: { "x-forwarded-for": ip, origin } });

  test("a signed-in user cannot change when they confirmed their age", async ({
    request,
    ip,
    baseURL,
  }) => {
    const user = newUser();
    const created = await signUp(request, ip, baseURL ?? "", {
      ...user,
      ageConfirmedAt: new Date().toISOString(),
    });
    expect(created.ok()).toBe(true);
    const before = (await (await request.get("/api/auth/get-session")).json()).user.ageConfirmedAt;

    const res = await request.post("/api/auth/update-user", {
      data: { ageConfirmedAt: "1999-01-01T00:00:00.000Z" },
      headers: { "x-forwarded-for": ip, origin: baseURL ?? "" },
    });
    expect(res.status()).toBe(400);
    const after = (await (await request.get("/api/auth/get-session")).json()).user.ageConfirmedAt;
    expect(after).toBe(before);
  });

  test("the server refuses a 7-character password", async ({ request, ip, baseURL }) => {
    const user = newUser();
    const res = await signUp(request, ip, baseURL ?? "", {
      ...user,
      password: "1234567",
      ageConfirmedAt: new Date().toISOString(),
    });
    expect(res.status()).toBe(400);
  });

  test("the server refuses a name over 100 characters", async ({ request, ip, baseURL }) => {
    const user = newUser();
    const res = await signUp(request, ip, baseURL ?? "", {
      ...user,
      name: "N".repeat(101),
      ageConfirmedAt: new Date().toISOString(),
    });
    expect(res.status()).toBe(400);
  });

  test("the server refuses an oversized request body", async ({ request, ip, baseURL }) => {
    const user = newUser();
    const res = await signUp(request, ip, baseURL ?? "", {
      ...user,
      name: "N".repeat(100_000),
      ageConfirmedAt: new Date().toISOString(),
    });
    expect(res.status()).toBe(413);
  });
});
