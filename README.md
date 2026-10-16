# Steady

A food and symptom journal for people with IBS, with an eating-disorder risk screen before any diet guidance, and a short summary to bring to appointments.

What it must do is in `docs/prd.md`.
How it should look is in `docs/design-brief.md`.
How the pieces fit is in `design/steady-stack.html`.

## What works today

The journal (milestone 1): log what you ate and any symptoms, see one week at a time with plain observations, edit entries, flag the ones worth raising at an appointment, and delete with Undo.
The appointment summary (milestone 2): pick a date range, read through the entries you flagged, leave any out, edit up to four questions, then export a PDF or copy the text. Export only works on a summary you marked reviewed.
The Account page (milestone 4) saves a care team email or link for the "Message your care team" link, and downloads all your data as one JSON file (no password, sign-in details, or screening score).
Account deletion: the Account page deletes the account, every entry, and every summary, after the password and the typed phrase "delete my account".
The screener gate (milestone 3): a short set of questions (placeholder ones for now, labeled as such) comes before any diet content.
Below the threshold, the diet plan opens with a 4 week end date and fixed reintroduction dates.
At or above it, the plan stays hidden, a "who can help" page appears, and the questions cannot be answered again for 90 days.
The server enforces this: `/api/diet` answers 403 without a current below-threshold screen.

## Run it locally

You need Node 24 and a Docker engine (OrbStack or Docker Desktop).

```sh
npm install
cp apps/server/.env.example apps/server/.env   # then set BETTER_AUTH_SECRET (openssl rand -base64 32) and INVITE_CODE (openssl rand -hex 16)
npm run db:start                               # Postgres 18 in Docker, on port 5432
npm run db:migrate                             # apply migrations
npm run db:seed                                # create the demo account
npm run dev                                    # web on http://localhost:5173, API on :3000
```

Open http://localhost:5173 for the landing page, then choose Sign in and use the demo account: `user@example.com` / `Password123!`.
The landing page at `/` is open to everyone; its text lives in `apps/web/src/routes/index.tsx`.
Sign-up is invite only: a new account needs the `INVITE_CODE` from `apps/server/.env`.
The seed script only runs against a database on this machine, so this account never reaches a real deployment.
In development, Vite forwards `/api` to the Hono server, so the browser only ever talks to one origin.

## Deploy

Steady runs on Render's free web service with Postgres 18 on Neon's free plan (`tasks/deploy.md`).
`render.yaml` is the Blueprint: it builds with `npm ci --include=dev && npm run build`, runs migrations, then starts the server, which serves the API and the built app from one origin.

1. Create a Neon project on Postgres 18 and copy its connection string (it ends in `?sslmode=require`).
2. In Render, choose New, then Blueprint, pick this repository, and use the same region as Neon.
3. Set `DATABASE_URL`, `INVITE_CODE` (`openssl rand -hex 16`), and `BETTER_AUTH_URL` (the `https://...onrender.com` address) in the dashboard. Render generates `BETTER_AUTH_SECRET`.
4. Never use Render's free Postgres: it is deleted 44 days after it is created.

The free web service sleeps after 15 minutes without visitors, so the first visit after that takes about a minute.

## Checks

```sh
npm run ci
```

This runs everything CI runs, in order: format, lint, type check, tone check, unit tests, production build, dependency audit, and the Playwright tests in Chrome, Firefox, Safari, and iPhone Safari.
Every Playwright test also fails if the page requests anything from another website or breaks the Content Security Policy.
The Playwright tests build and start the production server on port 3100 and need Postgres running.
They never reuse a server already on that port, which may be another worktree's build; set `E2E_PORT` to run them in a second worktree at the same time.
The unit tests need it too, with migrations applied: some check the database's rules and the entries API against the real tables.
The first time, install the browsers with `npx playwright install`.

| Command | What it does |
|---|---|
| `npm run check:bundle` | Fails if any diet content is in the built web app (run after `npm run build`) |
| `npm run check:tone` | Fails on banned wording in user-facing text (PRD section 10) |
| `npm run db:generate` | Writes a migration after a schema change in `packages/db/src/schema` |
| `npm run db:studio` | Opens a browser view of the local database |
| `npm run db:seed` | Creates the demo account; safe to run again |

To reset the local database: `docker compose -f packages/db/docker-compose.yml down -v`, then `npm run db:start`, `npm run db:migrate`, and `npm run db:seed`.

## How it was scaffolded

```sh
npx create-better-fullstack@latest steady --disable-analytics --frontend tanstack-router \
  --backend hono --runtime node --api none --database postgres --orm drizzle --db-setup docker \
  --auth better-auth --package-manager npm --ui-library react-aria --css-framework none \
  --testing vitest-playwright --validation zod --examples none
```

All other options were `none`.
The generated UI components, sample pages, and cookie settings were replaced; `CLAUDE.md` lists why.
