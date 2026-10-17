# Privacy and terms pages

Branch: `feat/privacy-terms`, off `main`.
Users: friends in Canada, invite only, as of 2026-10-16.
Not legal advice and not lawyer-reviewed. Get a review before strangers from the waitlist get invites.

## What applies in Canada

- **PIPEDA** (federal) covers personal information in commercial activity.
  A free student project for friends may fall outside it, but Steady follows its principles anyway: it costs little, and the same rules apply the day it isn't a hobby.
  Health information counts as sensitive, so it needs express consent, not a buried link.
  It also requires one named person responsible for privacy (Bianca) with a contact address.
  Breaches with a real risk of significant harm get reported to the Privacy Commissioner and the affected users, and every breach gets recorded and kept for 24 months.
- **Quebec Law 25** is stricter if any user lives in Quebec: publish the privacy officer's name, and do a privacy impact assessment before data leaves Quebec.
- **Ontario PHIPA** covers health custodians like doctors and hospitals.
  Steady isn't one, and summaries leave only when the user shares them herself, so it doesn't apply.
- **Health Canada (software as a medical device):** a journal and a summary the user reviews aren't devices.
  The screener only decides whether to show a referral and never gives a diagnosis (PRD non-negotiable 2), which keeps Steady out of device territory. Copy must keep it that way.
- **Data location:** as far as I know, neither Render nor Neon offers a Canadian region, so the data is in the US or Europe.
  That's allowed, but the privacy page has to say where it's stored and that the laws of that country apply there.

## Decisions (2026-10-16)

- [x] A. Region: Ohio, US (Render and Neon).
- [x] B. Everyone is in Toronto; nobody in Quebec, so Law 25 items are out for now. Revisit if that changes.
- [x] C. Consent at sign-up: a second required checkbox, "I agree to Steady storing my journal and screener answers as described in the privacy page", saved as `privacy_consent_at` and checked on the server like `age_confirmed_at`.
  This replaces my earlier "just a link under the button" suggestion, because health data needs express consent.
- [x] D. Both: the checkbox on sign-up, and for friends who already have accounts: a one-time consent screen on their next visit to a data page.
- [x] E. Contact: the waitlist address (default; change if Bianca wants a separate one).
- [ ] F. Still open: Beatrice approves the "not medical advice" wording before it ships.

## Steps

- [x] 1. Branch off `main`.
- [x] 2. Failing tests: e2e that the footer links to `/privacy` and `/terms` and each has one h1 and no horizontal scroll at 320px; sign-up fails on the server without consent; a signed-in user without consent sees the consent screen (if D is the screen).
- [x] 3. Schema: `privacy_consent_at` on `user`, migration generated and committed. Server check in `packages/auth` next to the age check.
- [x] 4. `/privacy`: what's stored, why, where (region), no analytics or third parties, nothing shared without the user's action, export, deletion, 30-day backups, breach steps, contact.
  Every line has to match what the code does today. No compliance or certification claims.
- [x] 5. `/terms`: invite-only beta, 18+, not medical advice (Beatrice's wording), no uptime guarantee, Steady can shut down with notice and time to export, the user owns her data.
- [x] 6. Sign-up checkbox, consent screen (D), footer links. The screener has no intro screen, so the "doesn't give medical advice" line went in the footer, which shows on every page.
- [x] 7. Copy: `check:tone`, screenshots at 320 and 1280px in light and dark (the e2e test covers no horizontal scroll at 320).
  Fixed from screenshots: a multi-line checkbox label centered the box on the whole label; it now lines up with the first line.
  Not done: the avoid-ai-writing skill and a VoiceOver pass by hand.
- [x] 8. Docs: PRD sections 5.1 and 7, CLAUDE.md repo map. The README lists no pages, so it is unchanged.
- [ ] 9. `npm run ci` exit 0, `/ship-wise`, stage, draft the commit for approval.

## Verify

- Open `/privacy` and `/terms` from the footer, signed in and signed out.
- Sign up without the consent box: the server refuses, even with the box removed in dev tools.
- Sign in as the demo user with `privacy_consent_at` cleared: the consent screen shows once, then the journal.
- Read the privacy page next to `docs/prd.md` section 7: no promise the code doesn't keep.
