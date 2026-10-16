# Landing page

Branch: `feat/landing-page` (worktree `../ibs-app-prototype-landing`, off `main`).
Source: Beatrice's drafts (first HTML paste, then https://claude.ai/artifact/R4ST2kxSpgfuuFvnGUmQSj), rebuilt to `docs/design-brief.md`, `docs/prd.md` sections 4 and 7, and `tasks/lessons.md`.
Credit: research and product idea by Beatrice Javier, software by Bianca Javier.

- [x] 1. Copy: rewrite Beatrice's text into `docs/landing-copy.md`.
  That doc was deleted in review (2026-10-15): `apps/web/src/routes/index.tsx` is the only copy of the text now.
  Keep her structure (problem, how it works, the research) and her meaning.
  Remove em dashes, kickers, tags, "Demo 1" labels, cause-and-effect claims ("possible trigger"), and "one tap" summary wording (summaries are reviewed before sharing).
  Verify: `npm run check:tone` passes on the final page text, and an avoid-ai-writing pass finds nothing.
- [x] 2. Build: `/` becomes the landing page for everyone, signed in or not (today it redirects).
  Primary action "Try it out" goes to `/sign-up`, with "Sign in" beside it; signed-in users get "Open your journal".
  The page says the journal works today and the screener and appointment summary come next.
  One route file plus styles from existing tokens, self-hosted fonts, no inline script or style, no new dependencies.
  Verify: Playwright test (headings, credits, journal link, no horizontal scroll at 320px), `e2e/fixtures.ts` CSP and origin checks green.
- [x] 3. Review: apple-design, craft, and accessibility passes on screenshots at 320, 390, and 1280px, light and dark.
  Fix what they find.
  Verify: `npm run ci` exit 0.
  Fixed: section headings stick beside their items on wide screens, section padding tops out at 96px instead of 144px, one 36rem measure for item headings and paragraphs, the research leads are real `h3`s, the credits are body size in ink above a quiet prototype note, and names never break across lines.
  The sign-up flake fix moved to its own branch, `fix/sign-up-transaction`.
- [x] 4. Docs: README and CLAUDE.md repo map mention the landing route.
- [x] 5. Merge order: PR #4 (journal screens) merges first, then rebase this branch on `main`.
  #4 changes `apps/web/src/styles/app.css` (flag, toast, delete, phone `.entry`), so expect a conflict there, not in `index.tsx`.
  The copy says "the journal works today", which is only true on `main` after #4.
- [ ] 6. `/ship-wise`, then stage and draft the commit for approval.

## Beatrice's new ideas

Bristol scale, rescreening through reintroduction, and watching for postponed food challenges go to a PRD proposal on `docs/prd-beatrice-ideas` (worktree `../ibs-app-prototype-prd`) for her review.
They are not on the landing page until the PRD says so.

## Not carried over from the draft (say if you want any back)

- The interactive screener demo.
  It invents three screening questions and shows a "proceed with low-FODMAP" result, which breaks non-negotiable 1 and the PRD's validated-instrument requirement.
  The page describes the screener in words instead.
- The 4-tab demo: risk tiers in red, yellow, and green shown to the user, ARFID and orthorexia named, a "Safe & expandable list", 0-10 severity, and reintroduction tracking (Phase 2).
  These break non-negotiables 2 and 3 and fail the CI tone check.
- The interactive journal and summary demos.
  They used `innerHTML` with typed text (an XSS hole), flagged "skipped" meals (judges food), and phrased questions as cause and effect.
  The page shows a static, made-up sample entry in the real journal layout instead, and links to the real app.
- Google Fonts, the clay warning color, and the gold kicker color.
  The CSP blocks other origins, and the brief rules out red-orange as a signal and eyebrow labels.
