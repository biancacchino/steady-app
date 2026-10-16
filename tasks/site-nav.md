# Site header and footer

Branch: `feat/site-nav`, off `main` (PR #19 already added `/about/software`).
Reference: ada.cx's header and footer, rebuilt to `docs/design-brief.md` and `tasks/lessons.md`.

## Decisions (chosen 2026-10-16)

- One header and one footer for every page, rendered in `__root.tsx`.
  Each page's own header goes away: the journal's button row, "Back to journal" on summary, account, screening, diet, and referral, and the landing page's bare wordmark and footer.
- Signed out: links to the landing sections (Why Steady, How it works) and "How it's made", then "Sign in" and the primary "Join the waitlist".
  No "Create account": sign-up is invite only, so a visitor without a code would get stuck.
- Signed in: Journal, Appointment summary, Diet plan, Account, and "How it's made", then "Sign out".
  The current page's link gets `aria-current="page"`.
- "How it's made" is the recruiter-facing menu with two pages: Healthcare perspective (`/about/healthcare`) and Software perspective (`/about/software`).
  It's a disclosure button with a list of links (the APG navigation pattern), not an ARIA menu. It closes on Esc, on a click outside, and on navigation.
- The session comes from `authClient.useSession()`, so navigating doesn't trigger an extra fetch.
  While it loads, the header shows only the wordmark, so the wrong links or button never flash.
- Sign out moves into the header and keeps today's rules: leave only after the server confirms, and clear the draft (decision 14).
- Phones: the links and CTA fold into a "Menu" button, the same disclosure pattern, and open as a list under the header. No new dependency and no inline style.
- A "Skip to content" link comes first, since the header now repeats on every page (WCAG 2.4.1).
- Not sticky: on phones it would take space from the journal and its bottom-sheet entry card.
- Footer: link columns (Steady: the same links as the header for the session; How it's made: Healthcare perspective, Software perspective), the waitlist address as text for visitors without a mail app, then the credits and the prototype note that are on the landing page today.

## Steps

- [x] 1. Branch off `main`.
- [x] 2. Failing Playwright test `e2e/site-nav.spec.ts`: signed out shows "Join the waitlist" and "Sign in" and no "Sign out"; signed in shows "Sign out" and the app links; `aria-current` on the current page; the phone menu opens, closes with Esc, and closes after picking a link; the "How it's made" menu reaches both pages; no horizontal scroll at 320px.
- [x] 3. `components/site-header.tsx`, `components/site-footer.tsx`, and styles in `styles/site.css` from tokens. Hook them up in `__root.tsx`.
- [x] 4. Remove the per-page headers and the landing footer. Move sign-out out of `journal.tsx`. Account deletion still ends up signed out.
- [x] 5. `/about/healthcare` page. **Content comes from Beatrice later.** Until then it says she is writing it and links to "Where this is coming from" on the home page. No clinical text written by me.
- [x] 6. Update e2e tests that click the old header buttons (`auth`, `journal`, `screening`, `summary` specs).
- [x] 7. Review at 320, 390, and 1280px in light and dark (craft and accessibility passes), keyboard-only run, 44px targets, an avoid-ai-writing pass and `check:tone` on the new copy.
  Fixed from screenshots: the footer grid overflowed 320px (an `auto` column took the link grid's max-width), and the Menu label sat high in its pill.
  The copy got a read for tone by hand and `check:tone` passed; the avoid-ai-writing skill was not run.
  Still to do: a VoiceOver pass by hand.
- [x] 8. Docs: CLAUDE.md repo map and README.
- [ ] 9. `npm run ci` exit 0 (done twice, 269 of 269 each), `/ship-wise`, then stage and draft the commit for approval.

## Verify

`npm run ci` exits 0 with the new spec.
By hand: `npm run dev`, open `/` signed out (Waitlist and Sign in), sign in as `user@example.com` (app links, Sign out), resize to 390px and use the Menu button with only the keyboard.

## Test failures found on the way

- `npm run ci` failed twice in Firefox and WebKit (account tests first, then journal tests): page loads and clicks hung until timeout.
  On `main`, the same Firefox journal specs passed 60 of 60; this branch passed 58 of 60.
  Cause: `useSession()` in the header and footer refetched the session whenever the window regained focus, and a Playwright click focuses the window.
  With `refetchOnWindowFocus: false` in `apps/web/src/lib/auth-client.ts`, 100 of 100 passed.
  The mechanism inside Firefox is inferred, not confirmed.
