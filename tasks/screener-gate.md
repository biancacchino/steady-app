# Milestone 3: Screener gate

Plan: `docs/prd.md` sections 4, 5.5, 5.6, 5.7, 6 and 10.
Branch: `feat/screener-gate`. Run with `/ship-crunch`, so safety decisions are listed in the PR.

- [x] 1. Schema: `screening.instrument`, `screening.result`, `diet_plan`, `referral_log`; the placeholder instrument is a row added by the migration.
  Verify: DB test for the tier and status checks; the account deletion cascade test still passes.
- [x] 2. Screening logic (`screening.ts`): score, tier, current (90 days), retake rule. Pure functions.
  Verify: unit tests at the threshold, one under, one over, day 89, day 90.
- [x] 3. API: `GET /api/screening`, `POST /api/screening`, `POST /api/referral`, gated `GET /api/diet` and `POST /api/diet/start`.
  Verify: `/api/diet` is 403 for no screen, an expired screen and an at-or-above screen, 200 for a current below screen; retake refused inside 90 days after at-or-above; at-or-above pauses the plan; no response holds a numeric score or the banned words.
- [x] 4. Pages: `/screening` (one question per screen, review step), `/diet`, `/referral`; links from the journal header.
  Verify: Playwright flow for below, at-or-above, and the locked retake.
- [x] 5. Bundle scan: `scripts/check-bundle.mjs` fails when a diet content string is in `apps/web/dist`; runs in `npm run ci` and GitHub CI after the build.
- [x] 6. Docs, then `npm run ci`.

## Defaults I picked

- Placeholder instrument: 5 questions, 3 answers each worth 0, 1 or 2; threshold 4.
  The text is plain and labeled "Placeholder questions, not a clinical screen".
- A below-threshold screen may be retaken any time; an at-or-above screen may not for 90 days.
- A new below-threshold result resumes a paused plan with its original end date.
- Plan `ended` status exists in the schema but nothing sets it yet; the reintroduction dates are read-only content.
- Referral resources are placeholders without invented links or phone numbers, except 988, the crisis line for Canada and the US.
  The care-team link needs the settings page (milestone 4); until then the referral page links to the Account page.
- Diet content lives in `apps/server/src/diet-content.ts` and is only sent through the gated API.
