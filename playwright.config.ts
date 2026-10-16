import { defineConfig, devices } from "@playwright/test";

// Tests run against the production build: one Hono server serves the web app and the API,
// with the real security headers. Port 3100 keeps it apart from `npm run dev`; E2E_PORT lets a
// second worktree run its tests at the same time.
const PORT = Number(process.env.E2E_PORT ?? 3100);
// The invite code the test server accepts. Test workers inherit it, so fixtures.ts can read it.
process.env.INVITE_CODE ??= "e2e-invite-code-for-tests";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  // A failing test keeps its trace (network, DOM, timings); CI uploads test-results on failure.
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        // Playwright bug https://github.com/microsoft/playwright/issues/42731: in Firefox, page.goto
        // can wait forever on a page that sends Cross-Origin-Opener-Policy (Steady does) and calls
        // history.replaceState on load (TanStack Router does), though the page loaded fine. It hit
        // about 1 in 100 runs. Test browser only; the app keeps its COOP header. Remove when fixed.
        launchOptions: {
          firefoxUserPrefs: { "browser.tabs.remote.useCrossOriginOpenerPolicy": false },
        },
      },
    },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "npm run build && npm start",
    url: `http://localhost:${PORT}/sign-in`,
    timeout: 180_000,
    // Never reuse: a server already on the port may be another worktree's build, and the tests
    // would pass or fail against code that is not in this checkout.
    reuseExistingServer: false,
    env: {
      NODE_ENV: "production",
      PORT: String(PORT),
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      INVITE_CODE: process.env.INVITE_CODE,
    },
  },
});
