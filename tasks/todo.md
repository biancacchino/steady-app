# Milestone 0: Foundation

Plan: `docs/prd.md` section 9, milestone 0.
Branch: `feat/foundation`, rebased onto `main` after PR #1 merges.

- [x] 0. Data diagrams added to the stack map (full and per milestone)
- [x] 1. Branch and this checklist
- [x] 2. Scaffold with Better Fullstack (React + TanStack Router, Hono, Node + npm, Drizzle, Postgres in Docker, Better-Auth)
- [x] 3. Database and sign-in: migrations, `age_confirmed_at`, `care_team_link`, rate limit
- [x] 4. Server safety: 401 on every non-auth route, security headers and CSP, logs without bodies, `GET /api/me`
- [x] 5. Design tokens, self-hosted fonts, React Aria, focus ring, reduced motion
- [x] 6. Screens: sign up (with 18+ checkbox), sign in, sign out, empty journal shell
- [x] 7. Checks: `npm run ci`, tone check, Playwright tests (which also fail on any third-party request), GitHub workflow, PR template
- [x] 8. Docs: README, CLAUDE.md, PRD, design brief
- [x] 9. `/ship`, then stage and draft the commit for approval

## Deferred

- Deploy blocker: set `advanced.ipAddress.trustedProxies` in `packages/auth/src/index.ts` to the host's proxy range, and confirm the proxy sets `x-forwarded-for`.
  Without it, sign-in rate limiting can be dodged with fake IPs, or one bucket is shared by every user.
- Deploy blocker: sign-up answers 422 for an email that already has an account, which reveals who uses Steady.
  Turn on email verification so new and existing emails get the same response, and use a neutral message.
- Idea for its own `/reason` at deploy time: a per-account failed sign-in counter.
  It stops guessing spread across many IPs; the cost is that anyone who knows an email could lock that account.

- Milestone 1: React Aria `Modal` (via `usePreventScroll`) injects an inline `<style>` with no id check, so the strict CSP will block it.
  Either use a native `<dialog>` for the New entry card, or have the server add a per-request nonce (`<meta property="csp-nonce">` plus `style-src 'nonce-...'`).

- Email verification and password reset: need an email provider, chosen at deploy time.
