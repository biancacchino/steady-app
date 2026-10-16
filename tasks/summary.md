# Milestone 2: Appointment summary

Plan: `docs/prd.md` section 5.4 (and 4, 5.3, 6, 7), layout in `docs/design-brief.md` section 5 ("Appointment summary").
Branch: `feat/summary`. Built with `/ship-crunch` (2026-10-15): no checkpoints or `comprehend`; skipped study goes to the vault's `Steady/Crunch log.md`.

- [x] 1. Schema: `summary` table with the PRD 6 columns, `user_id` with cascade delete, at most 4 questions, bounded text.
  Verify: a migration is generated and committed; a DB test refuses a fifth question.
- [x] 2. Summary content: a pure function from entries, a range, and choices to the snapshot (observations from `observe`, included flagged entries, questions).
  Question templates are filled from observations, phrased as questions, never conclusions; 2 to 4, empty ones dropped.
  Verify: unit tests with known entries check the exact questions, the 4 cap, empty questions dropped, and that excluded entries never reach the snapshot.
- [x] 3. API under `/api/summaries`, every query filtered by the session's user id:
  `GET /preview?from&to` (or `?to` alone for the default range), `POST /` (save a draft), `POST /:id/review` (save the snapshot, set `reviewed_at`), `GET /:id/pdf` and `GET /:id/text` (export; 409 without `reviewed_at`; set `exported_at`).
  Verify: 401 signed out, 409 before review with no file, ownership (another user gets 404), the default range, and that journal edits after review do not change the export.
- [x] 4. PDF from the snapshot with `pdfkit`, self-hosted Hanken Grotesk: header block, then date, Food, Symptoms per included entry, then the questions. Clipboard text from the same snapshot.
  Verify: text extracted from the PDF (`unpdf`, dev only) has every line of the clipboard text in order, and no excluded entry.
- [x] 5. Screen at `/summary`: date range, For and Appointment fields, the sheet ("Appointment summary", For / Period / Appointment block, Pattern observed, Worth flagging in the journal's entry layout with an "Include" pill, Questions to bring edited in place).
  Export is disabled with "Read through Worth flagging to continue." until Worth flagging has been on screen; then "Show PDF preview" and "Reviewed, export PDF", plus "Copy as text".
  A link to it from the journal header.
  Verify: Playwright test for the disabled-then-enabled export, Include unticked leaves an entry out of the copied text, the question cap, keyboard use, 44px targets, no horizontal scroll at 320px; screenshots at phone and desktop.
- [x] 6. Docs: README "What works today", CLAUDE.md repo map, PRD only if a default changed.
- [ ] 7. Trim, two-pass review, security pass, commit, PR, crunch log.

## Defaults picked (crunch, recorded for review)

- PDF library: `pdfkit` instead of the PRD's `@react-pdf/renderer` default. It draws text directly; react-pdf would bring React, a WebAssembly layout engine, and more onto the server for a short list. PRD section 8 updated to match.
- Default range: from the day after the last exported summary's end (when that is not after today), else the 30 days ending today. Today is the browser's calendar date, sent as `to`.
- Review happens when the user presses "Reviewed, export PDF" or "Copy as text": the browser saves the draft, then marks it reviewed, then exports. The API still refuses export without `reviewed_at`.
- Questions (filled from the range's observations, at most 4, in this order, each only when it applies):
  1. the most frequent recurring symptom: "Bloating was noted on 3 of 5 logged days. Is that worth looking into?"
  2. the context tag with the most symptom days, when at least 2: "Symptoms were noted on 4 of 5 days tagged stress. Is that worth looking into?"
  3. flagged entries: "I flagged 3 entries. Could we go through them together?"
  4. always: "What would be most useful to keep noting before my next visit?"
- A left-out entry is left out of everything: Pattern observed, the suggested questions, the preview, and the export (chosen 2026-10-15 after a side review). Someone leaving out an entry to keep a symptom private should not see it counted. Suggested questions refresh with the choices until the user edits one.
- The font is Hanken Grotesk's Latin subset, so characters outside it (most emoji, non-Latin scripts) print blank in the PDF. The copied text keeps them.
- The appointment reminder band (design brief section 6) is not in milestone 2's PRD scope; left for later.
