# Milestone 1: Journal

Plan: `docs/prd.md` sections 5.2 and 5.3, layout in `docs/design-brief.md` sections 5 and 6.
Branch: `feat/journal`.

- [x] 1. Branch and this checklist
- [x] 2. Schema: `journal_entry` table with the `food` or `symptom` check constraint, 1000-character limits, `severity` only when there is a symptom, `context` limited to the four values.
  Generate and commit the migration.
  Verify: a DB test inserts an entry with neither field and gets a constraint error.
  Done for the empty rule (decisions 1 and 2 in the vault). `time_zone` column added (decision 3), text with checks kept over enums (decision 5).
- [x] 3. API: `GET /api/entries?from&to` (calendar dates), `POST /api/entries`, `PATCH /api/entries/:id`, `DELETE /api/entries/:id`.
  Validated input, every query filtered by the session's user id, empty-entry error with the PRD's exact message.
  Verify: tests for 401 without a session, 400 on empty entry, and the ownership test (user B gets 404 on user A's entry for read, edit, and delete).
- [x] 4. Observations: a pure function from entries to sentences ("3 of 7 logged days mentioned bloating."), symptom vocabulary only, never food words.
  Verify: unit test with known entries checks the exact sentences (PRD 5.3 acceptance).
- [x] 5. Week view: month title, previous and next week (next disabled on the current week), week strip, agenda layout with a date column and time column, same Food, Symptoms, Context rows with "None noted".
  Verify: Playwright test and a screenshot pass at phone and desktop widths.
- [x] 6. New entry card in a native `<dialog>`: modal on desktop, bottom sheet on phones, fields in PRD order, "Add severity", When defaults to now, draft kept in `localStorage` when closed without saving.
  Same card edits an existing entry.
  Verify: Playwright test for the empty-entry message, saving, editing, draft surviving close and reopen, Esc closes, focus returns to the button.
  The origin and CSP check in `e2e/fixtures.ts` must stay green, which proves no inline style was injected.
- [x] 7. Flag toggle ("Flag" or "Flagged" with an icon, not color alone) and delete with a 10-second Undo, no confirmation.
  Verify: Playwright test flags, reloads, sees it kept; deletes, undoes, sees it back.
  Done: no server change was needed. Delete lives in the Edit card; focus moves to Undo, then to the restored entry or to New entry when Undo expires.
- [x] 8. Accessibility and tone: keyboard-only run through the whole journal, 44px targets, reduced motion, `npm run check:tone` green.
  Verify: manual keyboard pass and a VoiceOver pass on macOS, notes in the PR.
  Done: `e2e/journal-a11y.spec.ts` covers the keyboard run (desktop browsers), 44px targets at desktop and phone widths, and reduced motion; `check:tone` is green.
  Undo's 10 seconds now pause while it is hovered or keyboard-focused (WCAG 2.2.1, chosen 2026-10-15).
  Review fix (decision 23): pending deletes are kept apart from messages, so a Flag or draft message no longer takes Undo away; one Undo restores every entry deleted in the last 10 seconds; a stale hover flag no longer keeps Undo on screen.
  VoiceOver pass on macOS (Safari) done by hand 2026-10-15: week view, entry card, Flag, delete and Undo; no issues found.
- [x] 9. Docs: README, CLAUDE.md (`Modal` warning replaced in step 6), PRD only if something changed.
  Done: README "What works today" and `E2E_PORT`; the CLAUDE.md `Modal` note was already right; PRD 5.2 records the Undo pause.
- [ ] 10. `/ship-wise`, then stage and draft the commit for approval.

## Defaults I picked (say if you want them changed)

- Weeks start on Monday.
  The client sends `from` and `to` as calendar dates, and the API matches each entry's local date in its own stored zone (decision 4 in the vault).
- Keyword pre-flagging (design brief, "Flagging") waits for milestone 2, where the summary uses it.
  Milestone 1 has only the manual Flag toggle.
- Delete happens on the server right away; Undo re-creates the entry with the same fields.
  It gets a new id and `created_at`, because PRD 5.2 says `created_at` is never set by a client (chosen 2026-10-15).
  The other choice, delaying the delete for 10 seconds on the client, loses the delete if the tab closes.

## Deferred

- Deploy: once there is an email provider, account deletion also needs a link sent to the account's email (Better-Auth `sendDeleteAccountVerification`), and a notice after it is done.
  The link's `/delete-user/callback` route skips the password and phrase check, so check both before sending the link.
- Deploy: the Account page says database backups are removed within 30 days.
  True on Neon's free plan, which keeps 6 hours of history; check again before moving to a paid plan.

- Done (tasks/deploy.md step 4): rate limiting reads one header, `CLIENT_IP_HEADER`, set to `cf-connecting-ip` on Render, instead of `trustedProxies`.
  Still to confirm on the live site: Render's logs show no "could not determine a client IP" warning.
- Deploy blocker, partly covered: sign-up answers 422 for an email that already has an account.
  Since PR #8, only someone with the invite code reaches that check. Email verification and a neutral message still need an email provider.
- Idea for its own `/reason` at deploy time: a per-account failed sign-in counter.
  It stops guessing spread across many IPs; the cost is that anyone who knows an email could lock that account.
- Email verification and password reset: need an email provider, chosen at deploy time.
- Host: chosen 2026-10-15, Render's free web service with Neon's free Postgres 18 (tasks/deploy.md). The data region is picked when the Neon project is created.
- Production Postgres must stay on 18 to match CI's `postgres:18` (decision 8); Neon's project version is set at creation.
