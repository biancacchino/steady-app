# Account deletion

Branch: `feat/account-deletion` (worktree `../ibs-app-prototype-delete`, off `main`).
Spec: `docs/prd.md` section 4 (data model, last line) and section 7 (Deletion).
Pulled forward from milestone 4 so a hosted "Try it out" never leaves visitors' data stuck on the server.
Export stays in milestone 4.

- [x] 1. Database test first: every foreign key that points at `user` must be `ON DELETE CASCADE`.
  It reads `information_schema`, so the summary, diet plan, screener, and referral tables added later fail it if they forget.
  Then a test that deleting a user removes their sessions, accounts, and journal entries, and leaves another user's entries alone.
  Verify: both run in `npm run test`. Today's schema already cascades, so the first passes now and guards the future.
- [x] 2. Server: turn on Better-Auth's `user.deleteUser` and require the current password.
  Deleting the `user` row is one statement, so the cascades remove everything in one transaction.
  Rate limit `/delete-user` like sign-in (3 tries per 10 seconds per IP), so it cannot be used to guess the password.
  Verify: tests for 401 without a session, wrong password refused with nothing deleted, right password deletes everything and the old session no longer works.
- [x] 3. Web: a new `/account` page, linked from the journal header beside Sign out.
  It shows the name and email, then a "Delete account" section: what gets deleted, the backups line, a password field, a field to type `delete my account`, and a "Delete my account" button.
  The button is the secondary style, like Delete entry; the brief has no red, so the words and the password carry the weight.
  Pressing it with a field wrong shows the error on that field and focuses it.
  On success it clears this user's saved draft from local storage and shows "Your account is deleted" in place, with focus on that heading and a link to `/`.
  Signed out, `/account` redirects to sign-in like `/journal` does.
  Verify: Playwright test signs up a fresh user, adds an entry, deletes the account, then cannot sign in with that email and can sign up again with it.
  Plus 44px targets, keyboard-only run, CSP fixture green, 320px with no horizontal scroll.
- [x] 4. Copy and tone: all new text through `npm run check:tone` and an avoid-ai-writing pass.
- [x] 5. Docs: README "What works today", CLAUDE.md repo map, PRD milestone table (deletion moves out of milestone 4), `tasks/todo.md` deferred list (backups line, email confirmation link, and deletion notice are deploy items).
- [ ] 6. `npm run ci` exit 0, then `/ship-wise` when you say, then stage and draft the commit for approval.

## Decisions (chosen 2026-10-15)

- Deleting needs the account password and the typed phrase `delete my account`.
  The password proves the person holding an unlocked phone is the owner; the phrase stops accidental deletes.
  Better-Auth checks the password; the server checks the phrase in `beforeDelete`, so the API cannot skip it.
- At deploy, once there is an email provider: deletion also needs a link sent to the account's email, and a notice is sent after.
  Better-Auth's `sendDeleteAccountVerification` covers the link.
- Not chosen: a per-account lockout after wrong passwords (anyone who knows the email could block the owner), and per-user encryption keys destroyed on delete (changes all journal storage; its own discussion).
- The screen says backups roll off within 30 days, as the PRD default says.
  That is only true once a host is chosen and set up that way, so it goes on the deploy checklist.
- No "Are you sure?" second dialog: the password and phrase already make it deliberate.
