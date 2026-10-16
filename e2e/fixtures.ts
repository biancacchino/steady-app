import { test as base, expect, type Page } from "@playwright/test";

let ipCounter = 0;

/**
 * Every test gets its own client IP, because sign-in and sign-up are rate limited per IP.
 * It is set as a context option, so the browser starts with the header. Calling
 * setExtraHTTPHeaders on an already open page made Firefox's page.goto hang about once in
 * 100 parallel runs, even though every request had finished.
 */
export const test = base.extend<{ ip: string }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern here
  ip: async ({}, use, testInfo) => {
    const n = ipCounter++;
    await use(`10.${testInfo.workerIndex % 250}.${Math.floor(n / 250) % 250}.${n % 250}`);
  },
  extraHTTPHeaders: async ({ ip }, use) => {
    await use({ "x-forwarded-for": ip });
  },
  // Every page fails its test if it loads anything from another origin or breaks the CSP.
  page: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL ?? "").origin;
    const external: string[] = [];
    const cspErrors: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (/^https?:/.test(url) && new URL(url).origin !== origin) external.push(url);
    });
    page.on("console", (msg) => {
      if (/content security policy/i.test(msg.text())) cspErrors.push(msg.text());
    });

    await use(page);

    expect(external, "requests to other origins").toEqual([]);
    expect(cspErrors, "Content Security Policy violations").toEqual([]);
  },
});

export { expect };

/** Set in playwright.config.ts and passed to the test server. */
export const INVITE_CODE = process.env.INVITE_CODE ?? "";

export function newUser() {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: "Test Person",
    email: `test-${id}@example.com`,
    password: "correct horse battery",
    inviteCode: INVITE_CODE,
  };
}

export const weekUrl = (week: string) => `/journal?week=${week}`;

/** Saves an entry through the API, logged in Toronto unless the entry says otherwise. */
export async function save(page: Page, entry: Record<string, unknown>) {
  const res = await page.request.post("/api/entries", {
    data: { timeZone: "America/Toronto", ...entry },
  });
  expect(res.status()).toBe(201);
}

/** Signs up a new user through the form and waits for the journal. Returns the user. */
export async function signUp(page: Page) {
  const user = newUser();
  await page.goto("/sign-up");
  await page.getByLabel("Invite code").fill(user.inviteCode);
  await page.getByLabel("Your name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByText("I am 18 or older").click();
  await page.getByRole("button", { name: "Create account" }).click();
  // Sign-up hashes the password, commits three rows, and loads the journal. On a shared CI
  // runner (two browsers, the server, and Postgres on one machine) that passed the default 5
  // seconds about once in 200 sign-ups, though it never did locally in 600+ runs.
  await expect(page).toHaveURL(/\/journal$/, { timeout: 15_000 });
  return user;
}

/**
 * The site header, with its links showing. On narrow screens they sit behind the Menu button,
 * so it is opened first.
 */
export async function siteNav(page: Page) {
  const header = page.getByRole("banner");
  // isVisible does not wait, so wait for the header to render first.
  await header.getByRole("link", { name: "Steady", exact: true }).waitFor();
  const menu = header.getByRole("button", { name: "Menu" });
  if ((await menu.isVisible()) && (await menu.getAttribute("aria-expanded")) !== "true") {
    await menu.click();
  }
  return header;
}
