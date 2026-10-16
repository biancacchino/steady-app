# Steady

An IBS food and symptom journal with an eating-disorder risk gate before diet content, and appointment summaries the user reviews before sharing.

## Overrides

One global rule is changed: PRs are merged with a merge commit, not squashed, so every feature commit stays on `main` to go back to.
Delete the branch after merging, as before.
No other global rule is relaxed.
Health data raises the bar: anything touching screening, export, sharing, or third parties follows `docs/prd.md` sections 4 and 7 exactly.

## Repo map

- `apps/web` - React + TanStack Router app. Routes in `src/routes`, React Aria components in `src/components`, tokens in `src/styles/tokens.css`. `src/routes/summary.tsx` is the appointment summary (styles in `src/styles/summary.css`). `src/routes/account.tsx` is the Account page with account deletion. `src/routes/index.tsx` is the landing page at `/` for everyone (styles in `src/styles/landing.css`); signed-out visitors get "Join the waitlist" (an email link, with the address also shown as text for visitors without a mail app) and "Sign in"; signed-in visitors get "Open your journal".
- `apps/server` - Hono server. `src/app.ts` holds middleware, security headers, the error handler, and routes; `src/entries.ts` is the journal entries API; `src/summaries.ts` is the appointment summary API, with its content in `src/summary-content.ts` and its PDF in `src/summary-pdf.ts` (pdfkit); `src/index.ts` starts it. In production it also serves `apps/web/dist`.
- `packages/auth` - Better-Auth config (invite-only sign-up via `INVITE_CODE`, 18+ confirmation, rate limit, account deletion with password and typed phrase).
- `packages/db` - Drizzle schema in `src/schema`, migrations in `src/migrations`, Postgres in `docker-compose.yml`.
- `packages/env` - Validated server environment variables. `CLIENT_IP_HEADER` names the one header rate limiting reads (`cf-connecting-ip` on Render).
- `scripts` - `check-tone.mjs`, with tests in `checks.test.mjs`. Third-party loads are caught by `e2e/fixtures.ts`.
- `e2e` - Playwright tests, type-checked by `tsc -p e2e` in `npm run check-types`. `fixtures.ts` gives each test its own IP and fails any test that loads another origin or hits a CSP violation.
- `docs` - `prd.md` (requirements), `design-brief.md` (visual rules).
- `design` - Reference pages: `steady-design.html` (the source for tokens), `steady-stack.html` (stack and data diagrams).
- `render.yaml` - Render Blueprint for the hosted MVP (free web service; Postgres is on Neon). See the README's Deploy section.
- `tasks` - `todo.md` (current milestone), `lessons.md` (corrections to remember).

## Run locally

See `README.md`. Short version: `npm install`, copy `apps/server/.env.example`, `npm run db:start`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`.
Demo account (created by `apps/server/src/seed.ts`, which refuses any database not on this machine): `user@example.com` / `Password123!`.
`npm run ci` runs every check CI runs.

## Stack

Node 24 + npm workspaces + Turborepo.
React 19, TanStack Router, React Aria Components, plain CSS with tokens.
Hono on `@hono/node-server`, Better-Auth, Drizzle, Postgres 18.
Biome for lint and format, Vitest, Playwright.

## Decisions (ADRs)

- **Node, not Bun.** Bun was the first plan; Node was already installed and avoids runtime questions for the PDF library.
- **One origin.** Vite proxies `/api` in development; the Hono server serves the built app in production. Cookies stay `SameSite=Lax`, and there is no CORS.
- **Strict CSP, no exceptions.** Nothing loads from other origins, no inline scripts or styles. Fonts are self-hosted. React Aria's one injected style ships as `apps/web/public/react-aria.css`. React Aria `Modal` also injects a style, so the entry card uses a native `<dialog>` instead; do not use `Modal`.
- **Gates live on the server.** The diet gate (milestone 3) and export review (milestone 2) are enforced in the API; the UI only chooses what to show.
- **Migrations only.** Schema changes go through `npm run db:generate` and are committed. There is no `db:push`.
- **No analytics.** None, first-party or third-party.
- **Firefox test setting.** `playwright.config.ts` turns off Firefox's COOP handling in tests only, to dodge Playwright bug #42731 (page.goto hangs). Remove it once that bug is fixed; the app keeps its COOP header.
- **Scaffold output replaced.** The generator's UI used `@base-ui/react` with Tailwind classes and no Tailwind, set cookies to `SameSite=None`, left Postgres unpinned, and had a broken `start` path. All were replaced or fixed.

## Conventions

- User-facing text follows the tone rules in `docs/prd.md` section 7; `npm run check:tone` enforces the banned words.
- Colors come only from tokens. Change values in `design/steady-design.html` first, then copy them.
- No eyebrows (small labels above or beside headings) and no italic or accent-word headlines. See `tasks/lessons.md`.
- Every API route except `/api/auth/*` requires a session. Every query on user data must filter by the session's user id.
- Every table with user data references `user.id` with `onDelete: "cascade"`, so account deletion removes it. `apps/server/src/account-deletion.test.ts` fails otherwise.
- Server logs hold method, path, and status only. Never log an error object: database errors include the query's values, which can be journal text.
- Environment variables are declared and validated in `packages/env/src/server.ts`.
- Commit messages and PRs carry no AI attribution: no "Generated with Claude Code" line and no `Co-Authored-By: Claude` trailer.
