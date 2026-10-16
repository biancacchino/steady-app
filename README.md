# Steady

A food and symptom journal for people with IBS, with an eating-disorder risk screen before any diet guidance, and a short summary to bring to appointments.

What it must do is in `docs/prd.md`.
How it should look is in `docs/design-brief.md`.
How the pieces fit is in `design/steady-stack.html`.

## What works today

The journal (milestone 1): log what you ate and any symptoms, see one week at a time with plain observations, edit entries, flag the ones worth raising at an appointment, and delete with Undo.
The appointment summary (milestone 2) and the screener gate (milestone 3) come next.

## Run it locally

You need Node 24 and a Docker engine (OrbStack or Docker Desktop).

```sh
npm install
cp apps/server/.env.example apps/server/.env   # then set BETTER_AUTH_SECRET: openssl rand -base64 32
npm run db:start                               # Postgres 18 in Docker, on port 5432
npm run db:migrate                             # apply migrations
npm run db:seed                                # create the demo account
npm run dev                                    # web on http://localhost:5173, API on :3000
```

Open http://localhost:5173 for the landing page, then choose Sign in and use the demo account: `user@example.com` / `Password123!`.
The landing page at `/` is open to everyone; its text lives in `apps/web/src/routes/index.tsx`.
The seed script only runs against a database on this machine, so this account never reaches a real deployment.
In development, Vite forwards `/api` to the Hono server, so the browser only ever talks to one origin.

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
