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
- [ ] 8. Accessibility and tone: keyboard-only run through the whole journal, 44px targets, reduced motion, `npm run check:tone` green.
  Verify: manual keyboard pass and a VoiceOver pass on macOS, notes in the PR.
- [ ] 9. Docs: README, CLAUDE.md (`Modal` warning replaced in step 6), PRD only if something changed.
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

- Deploy blocker: set `advanced.ipAddress.trustedProxies` in `packages/auth/src/index.ts` to the host's proxy range, and confirm the proxy sets `x-forwarded-for`.
  Without it, sign-in rate limiting can be dodged with fake IPs, or one bucket is shared by every user.
- Deploy blocker: sign-up answers 422 for an email that already has an account, which reveals who uses Steady.
  Turn on email verification so new and existing emails get the same response, and use a neutral message.
- Idea for its own `/reason` at deploy time: a per-account failed sign-in counter.
  It stops guessing spread across many IPs; the cost is that anyone who knows an email could lock that account.
- Email verification and password reset: need an email provider, chosen at deploy time.
- Host and data region (PRD section 12), needed before any deploy.
- Deploy: production Postgres must match CI's `postgres:18`, or its time zone list may differ from the one `toTimeZone` is tested against (decision 8).
