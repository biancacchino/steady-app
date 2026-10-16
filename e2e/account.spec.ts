import { expect, signUp, siteNav, test } from "./fixtures";

test("signed out, the account page sends you to sign in", async ({ page, ip: _ }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("deleting the account removes it and its journal, and frees the email", async ({
  page,
  ip: _,
}) => {
  const user = await signUp(page);
  const created = await page.request.post("/api/entries", {
    data: { occurredAt: "2026-10-13T16:30:00Z", timeZone: "America/Toronto", food: "Toast" },
  });
  expect(created.status()).toBe(201);

  await (await siteNav(page)).getByRole("link", { name: "Account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page).toHaveTitle("Account - Steady");
  await expect(page.getByText(user.email)).toBeVisible();

  const remove = page.getByRole("button", { name: "Delete my account" });
  await remove.click();
  await expect(page.getByText("Enter your password.")).toBeVisible();
  await expect(page.getByText('Type "delete my account" to confirm.')).toBeVisible();
  await expect(page.getByLabel("Password")).toBeFocused();

  await page.getByLabel("Password").fill("not the password");
  await page.getByLabel('Type "delete my account"').fill("delete my account");
  await remove.click();
  await expect(page.getByText("That password is not right.")).toBeVisible();

  await page.getByLabel("Password").fill(user.password);
  await remove.click();
  await expect(page.getByRole("heading", { name: "Your account is deleted" })).toBeFocused();

  // The session is gone, so the journal sends you to sign in.
  await page.goto("/journal");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password do not match an account.")).toBeVisible();

  // The same email can sign up again and starts with an empty journal.
  await page.goto("/sign-up");
  await page.getByLabel("Invite code").fill(user.inviteCode);
  await page.getByLabel("Your name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByText("I am 18 or older").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/journal$/);
  const range = new URLSearchParams({ from: "2026-10-12", to: "2026-10-18" });
  const week = await page.request.get(`/api/entries?${range}`);
  expect(((await week.json()) as { entries: unknown[] }).entries).toEqual([]);
});

test("the account page fits a 320px screen with 44px targets", async ({ page, ip: _ }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await signUp(page);
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  for (const target of await page.locator("main a, main button, main input").all()) {
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("the care team contact is saved, used on the referral page, and can be removed", async ({
  page,
  ip: _,
}) => {
  await signUp(page);
  await page.goto("/account");
  const field = page.getByLabel("Email address or link");
  await field.fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Enter an email address or a link that starts with https://."),
  ).toBeVisible();

  await field.fill("dr.osei@clinic.example");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  await page.goto("/referral");
  await expect(page.getByRole("link", { name: "Message your care team" })).toHaveAttribute(
    "href",
    "mailto:dr.osei@clinic.example",
  );

  await page.goto("/account");
  await expect(field).toHaveValue("dr.osei@clinic.example");
  await field.fill("");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Removed." })).toBeVisible();
  await page.goto("/referral");
  await expect(page.getByRole("link", { name: "Add your care team's contact" })).toBeVisible();
});

test("Download my data saves one JSON file with the user's entries", async ({ page, ip: _ }) => {
  const user = await signUp(page);
  await page.request.post("/api/entries", {
    data: { occurredAt: "2026-10-13T16:30:00Z", timeZone: "America/Toronto", food: "Toast" },
  });
  await page.goto("/account");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my data" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^steady-export-\d{4}-\d{2}-\d{2}\.json$/);
  const { createReadStream } = await import("node:fs");
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream((await file.path()) ?? ""))
    chunks.push(chunk as Buffer);
  const data = JSON.parse(Buffer.concat(chunks).toString());
  expect(data.profile.email).toBe(user.email);
  expect(data.entries[0].food).toBe("Toast");
  await expect(page.getByText("Your file is downloading.")).toBeVisible();
});
