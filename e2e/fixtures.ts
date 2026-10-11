import { test as base, expect } from "@playwright/test";

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

export function newUser() {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: "Test Person",
    email: `test-${id}@example.com`,
    password: "correct horse battery",
  };
}
