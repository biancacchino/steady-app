import { defineConfig, devices } from "@playwright/test";

// Tests run against the production build: one Hono server serves the web app and the API,
// with the real security headers. Port 3100 keeps it apart from `npm run dev`.
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}` },
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
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: "production",
      PORT: String(PORT),
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
    },
  },
});
