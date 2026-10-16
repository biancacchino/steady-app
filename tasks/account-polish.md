# Milestone 4: Account and polish

Plan: `docs/prd.md` sections 5.7, 7 and 9. Branch: `feat/account-polish`, based on `feat/screener-gate` because the export holds the screener tables.

- [x] 1. Care team link: `PUT /api/settings/care-team`, a field on the Account page.
  Verify: API tests (email becomes `mailto:`, https kept, `javascript:`, `http:`, line breaks and long values refused, clear with empty) and an e2e test that the referral page uses it.
- [x] 2. Export: `POST /api/settings/export`, a "Download my data" button.
  Verify: API tests (all six parts, no other user's rows, no credentials, no score, GET refused) and an e2e test that reads the downloaded file.
- [x] 3. Accessibility pass: 44px and no-scroll tests on the new screener and Account sections, keyboard order through the new forms, `role="status"` messages.
- [x] 4. Tone review of every string: `check:tone` is green and a manual scan of all visible strings for judging, scoring, or urgent wording found nothing to change.
- [x] 5. Docs, then `npm run ci`.

## Defaults I picked

- The export holds screener answers and the result tier, but not the numeric score, because the user never sees it.
- An email address is saved as `mailto:`; any other value must be an https link. Plain `http:` is refused.
- Export is a POST (like the summary export), so a link on another site cannot start it.
- No new accessibility dependency (no axe): the Playwright tests check targets, scroll, and keyboard order, as in milestone 1.
