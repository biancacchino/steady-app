# Steady - Product Requirements (v1.0, MVP)

Status: draft for review, 2026-09-29.
Source: the Steady spec v0.1 (sections 3.1 to 6).
Design: `docs/design-brief.md` and the reference page `design/steady-design.html` (https://claude.ai/artifact/7R3iBaY7ADAs197F2vjYMC).
Stack: the Steady stack map (https://claude.ai/artifact/V4gpi9H8L4BQtk1LgXwJcU).

This PRD turns the spec into buildable, testable requirements.
Where the spec leaves something open, this document picks a default and marks it **[Default]**, so work is not blocked.
Anything marked **[Needs decision]** has to be settled by a person before the part it blocks ships.

## 1. Problem

Steady is an IBS app that solves two problems.

1. **Elimination diets can lead to disordered eating.**
   Low-FODMAP and similar diets ask people to cut foods, watch portions, and track closely how their body reacts.
   Those habits overlap with eating-disorder behavior, and clinical guidance says to screen for eating-disorder risk before recommending such a diet.
2. **Appointments are too short.**
   Patients get 10 to 15 minutes and cannot explain weeks of changing symptoms, so details are lost.

Steady answers with three parts:
- a screener that must be passed before any diet guidance appears
- a journal that records food and symptoms without judging them
- a summary generator that turns the journal into a short document for the appointment

## 2. Users

| Persona | Who | What they need from Steady |
|---|---|---|
| Maya (primary) | 27, newly diagnosed, already cutting foods based on internet advice | Clarity, not more rules |
| Dr. Osei | Primary care doctor, sees Maya for 12 minutes every few months | A quick, structured read on what changed |
| Priya | Dietitian who gets referrals when the screener flags risk | Enough context to pick up without starting over |

Only Maya uses the app in the MVP.
Dr. Osei and Priya only receive what Maya chooses to export.

## 3. Goals and non-goals

### Goals (MVP)

- Maya can log food and symptoms in under 30 seconds per entry.
- Maya can produce a reviewed, one-page summary for an appointment in under 2 minutes.
- Diet content is impossible to reach without a current screen below threshold, enforced by the server.
- All data lives in Maya's own account, syncs across devices, and can be exported or fully deleted by her.

### Non-goals (MVP)

- Automatic re-screening from journal warning signs (Phase 2).
- Shareable or expiring links (Phase 2).
- A step-by-step reintroduction tracking UI (Phase 2).
- A provider directory or booking (Phase 2).
- Care-team portal integration and a clinician view (Future, only with proven demand).
- Native mobile apps. The MVP is a responsive web app.
- Any analytics, ads, or marketing use of data.

## 4. The five non-negotiables

These come from spec section 6.
Each one has an automated check (section 10), because a regression here is a safety problem, not a style problem.

1. Diet content is never reachable without a completed, current screen.
2. The app never gives the user a diagnosis label.
3. Nothing scores, ranks, or gamifies food or restriction.
4. Every summary is reviewed and started by the user before it is shared.
5. Health data is never used for marketing, ads, or third-party analytics.

## 5. Features

### 5.1 Accounts

- Sign up and sign in with email and password through Better-Auth.
  Sessions are stored in Steady's own Postgres.
- **[Default]** Users must confirm they are 18 or older at sign-up.
  Eating-disorder screening and referral for minors is a different clinical path, which the MVP does not cover.
- Email verification and password reset use a transactional email provider.
  Those emails never contain health data, only account links.
- Sign-in is rate limited.

**Acceptance criteria**
- A signed-out request to any API route except auth returns 401.
- A signed-in user can only read or change their own rows.
  Every query is scoped by the session's user id, and a test tries to read another user's entry by id and gets 404.

### 5.2 Food and symptom journal (spec 3.2)

**Entry fields**

| Field | Type | Rules |
|---|---|---|
| `occurred_at` | timestamp | Defaults to now. The user can change the date and time, so a missed entry can be logged later. |
| `created_at` | timestamp | Set automatically, never editable. This is the spec's "automatic timestamp". |
| `food` | text, up to 1000 characters | Optional. |
| `symptom` | text, up to 1000 characters | Optional. |
| `severity` | `low`, `medium`, `high`, or empty | Optional, only saved when there is a symptom. |
| `context` | any of `stress`, `travel`, `sleep`, `cycle` | Optional, multiple allowed. |
| `flagged` | boolean | The user's own "worth flagging" mark. Defaults to false. |

- An entry needs at least one of `food` or `symptom`, enforced by a database check constraint and by the API.
  This lets Maya log a symptom when she has not eaten.
- The user can edit and delete their entries.
  Delete asks for no confirmation but offers Undo for 10 seconds.
- **Layout** follows `docs/design-brief.md` sections 5 and 6.
  - The journal is a week view grouped by day.
  - A "New entry" button opens one focused card: a modal on desktop, a bottom sheet on phones.
  - Every entry shows the same labeled Food, Symptoms, and Context rows, with "None noted" for empty values.
  - Closing the card without saving keeps the draft on that device.
- Journaling is never blocked or gated by the screener, a positive screen, or anything else.

**Deliberately left out (spec 3.2)**
- No "safe" or "trigger" labels and no color coding of foods or severity.
- No streaks, points, badges, or celebrations.
- No calories, weight, or portion sizes.
- No ranking of foods by how often they came before symptoms.

**Acceptance criteria**
- Saving with both Food and Symptoms empty shows "This entry is empty. Add what you ate, a symptom, or both." and saves nothing.
- An entry saved on one device appears on another device after a reload.
- The words "safe", "trigger", "streak", and "calorie" do not appear anywhere in the journal UI (tone check, section 10).

### 5.3 Pattern surfacing (spec 3.3)

- The journal header shows observations for the visible week, and the summary shows them for its date range:
  - number of entries
  - number of days with a symptom noted
  - recurring symptom words
- **[Default]** Recurring words come from symptom notes only, matched against a fixed symptom vocabulary (bloating, cramping, pain, gas, diarrhea, constipation, nausea, urgency, fatigue, and similar).
  Recurring words from food notes are left out on purpose.
  Showing "pasta: 4 times" next to symptom counts would read as a ranking of foods, which breaks non-negotiable 3.
- Observations are sentences, not big numbers: "3 of 7 logged days mentioned bloating."
- The app never states cause and effect ("you are sensitive to X").
  Co-occurrence only appears as a suggested question for the doctor (section 5.4).

**Acceptance criteria**
- A unit test feeds known entries and checks the exact sentences produced.
- No UI string or generated sentence contains "because", "caused", "sensitive to", or "trigger" (tone check).

### 5.4 Appointment summary (spec 3.4)

**Input**
- A date range.
  **[Default]** It starts the day after the end of the last exported summary, or 30 days ago if there is none, and ends today.
  The user can change it.
- Optional: provider name and appointment date, shown in the summary header.

**Output, three sections**
1. **Pattern observed:** counts and frequency for the range, using section 5.3.
2. **Worth flagging:** the entries Maya flagged in the range, each with date, food, and symptom.
   **[Default]** Only user-flagged entries appear in the MVP.
   Suggesting entries automatically from keywords is Phase 2, together with the flagging logic.
3. **Questions to bring:** 2 to 4 suggested questions, which the user can edit, delete, or add to, up to 4.
   **[Default]** Questions come from fixed templates filled with observations, not from an AI model.
   Sending journal text to a model provider would send health data to a third party.
   Example: "Symptoms were noted on 4 of 5 days tagged stress. Is that worth looking into?"
   Every template is phrased as a question, never as a conclusion.

**User controls**
- Each flagged entry has an "Include" checkbox, checked by default.
  Unticking leaves it out of this summary only, and the entry stays in the journal.
- Review before sharing is enforced twice:
  - In the UI, Export stays disabled until "Worth flagging" has been on screen, as in the design brief.
  - In the API, Export only works on a summary the user has marked reviewed.
    Marking it reviewed saves a snapshot of exactly what will be exported, so later journal edits cannot change a reviewed summary.
- **Export options in the MVP:**
  - PDF download
  - copy to clipboard as plain text
  Shareable links are Phase 2, as expiring links.
- The PDF uses the compact layout from the design brief: header block, then date, Food, and Symptoms for each included entry, then the questions.
  A "Show PDF preview" disclosure shows it before export.
- Nothing is sent anywhere by Steady.
  The user downloads or copies the summary and shares it herself.

**Acceptance criteria**
- A request to export a summary with no `reviewed_at` returns 409 and produces no file.
- Excluded entries never appear in the PDF or the clipboard text.
- The PDF text matches the reviewed snapshot byte for byte, tested by extracting text from the generated file.
- Suggested questions never exceed 4, and empty questions are left out.

### 5.5 Eating-disorder risk screener, the gate (spec 3.1)

**When it runs**
- The first time the user tries to start an elimination diet.
- Again when the last screen is no longer current.
- **[Default]** A screen is current for 90 days from its completion.
- Re-screening triggered by journal warning signs is Phase 2.

**The instrument**
- **[Needs decision]** A validated, licensed questionnaire must be chosen by someone qualified, and its license confirmed for this use.
  This blocks shipping the gate to real users, not building it.
- Candidates to bring to that person, licensing not verified here:
  - SCOFF: short general screen.
  - EDE-QS: short form of a common questionnaire.
  - NIAS: screens for ARFID, the pattern most tied to GI symptoms and food fear, which may fit IBS patients better than general screens.
- Until then the app ships a placeholder instrument, labeled "Placeholder questions, not a clinical screen" on every screen and in the stored result.
- Instruments are data, not code: each has an id, version, questions, scoring rule, and threshold.
  Swapping the placeholder for the real one is a data change plus a new version, with no route or UI rewrite.

**Flow**
- One question per screen, with a review step before submitting, so a mis-tap can be fixed before it counts.
- Stored per attempt: raw answers, score, risk tier (`below` or `at_or_above`), instrument id and version, and completion time.
- The user never sees the numeric score.
- **Below threshold:** diet content unlocks, with a fixed end date for the elimination phase (section 5.6).
- **At or above threshold:**
  - Diet content stays hidden completely.
  - A calm, plain-language explanation appears: "Let's talk this through with someone first."
  - The referral flow is shown (section 5.7).
  - The journal and summaries keep working exactly as before.
- **[Default]** After an at-or-above result, the screener cannot be retaken until 90 days have passed.
  Retaking right away would be a path around a positive screen, which the spec forbids.
  **[Needs decision]** A qualified person should confirm the 90-day wait, since it may feel punitive.

**Expiry in the middle of a diet plan**
- **[Default]** When the screen expires, diet content locks until the user re-screens.
  The plan's progress is kept, but its end date is not extended.
- If the re-screen comes back at or above threshold, the plan is paused, diet content is hidden, and the referral flow is shown.

**Enforcement**
- The gate is enforced in the API, not only the UI.
  Hono middleware on every `/diet` route returns 403 unless the user has a current screen below threshold.
- Diet content lives only on the server and is served through the gated API.
  It is never bundled into the frontend JavaScript, where anyone could read it.
- The frontend route also checks gate status before rendering, but only to choose what to show.
  The API decides.

**Acceptance criteria**
- `GET /diet/*` returns 403 for: no screen, an expired screen, and a current at-or-above screen.
- `GET /diet/*` returns 200 only for a current below-threshold screen.
- A build check fails if any diet content string is found in the frontend bundle.
- No screen or API response contains "eating disorder", "you have", "diagnosis", or a numeric score.

### 5.6 Diet plan (spec 3.1, MVP scope)

- **[Needs decision]** The diet content itself (elimination phase, reintroduction schedule) must be written or reviewed by a dietitian.
  Until then, placeholder content is labeled as such.
- **[Default]** Starting the plan sets a fixed elimination end date, 4 weeks out, and shows a reintroduction schedule with fixed dates as read-only content.
  The spec requires a clear end date, and step-by-step reintroduction tracking is Phase 2.
- The plan contains no scores, no "safe" or "trigger" lists, and no portion sizes.

### 5.7 Referral flow (spec 3.5)

- Appears after an at-or-above screen.
- A short explanation, then:
  - a static list of resources to find a provider or dietitian
  - a "Message your care team" link, which opens the email or portal address the user saved in settings.
    If none is saved, the link opens settings to add one.
- **[Needs decision]** The resource list must be real, current, and region-appropriate, and someone has to verify it before launch.
  It should also include a crisis line, since a positive screen can reach someone in distress.
- Each time the referral is shown, it is logged with a timestamp in `referral_log`, visible only to the user in their own export.
- The user never has to prove they followed up, and nothing is limited if they do not.

## 6. Data model

All tables have `user_id` and are scoped by it.
Screener data sits in its own Postgres schema so it can never be joined into anything analytics-shaped by accident.

| Table | Key columns |
|---|---|
| `user`, `session`, `account`, `verification` | Better-Auth tables, plus `age_confirmed_at` and `care_team_link` on `user` |
| `journal_entry` | `occurred_at`, `created_at`, `updated_at`, `food`, `symptom`, `severity`, `context[]`, `flagged`; check: `food` or `symptom` is not null |
| `summary` | `range_start`, `range_end`, `provider_name`, `appointment_date`, `excluded_entry_ids[]`, `questions[]`, `reviewed_at`, `snapshot` (JSON), `exported_at` |
| `diet_plan` | `started_at`, `elimination_ends_at`, `status` (`active`, `paused`, `ended`) |
| `referral_log` | `shown_at` |
| `screening.instrument` | `id`, `version`, `questions`, `scoring`, `threshold`, `is_placeholder` |
| `screening.result` | `instrument_id`, `instrument_version`, `answers` (JSON), `score`, `tier`, `completed_at` |

Deleting the account deletes every row above for that user in one transaction.

## 7. Non-functional requirements

### Privacy and security

- TLS everywhere, with HSTS.
- Postgres is encrypted at rest by the host.
  **[Needs decision]** Pick a host that encrypts at rest and lets you choose the data region.
- No analytics of any kind in the MVP, first-party or third-party.
  This is the simplest way to guarantee that screener data stays out of analytics and that non-negotiable 5 holds.
- No third-party scripts, and fonts are self-hosted instead of loaded from Google Fonts, so no third party learns who uses a health app.
  A Content Security Policy blocks all other origins.
- Logs never include request bodies, journal text, screener answers, or summary content.
- **Export:** one button downloads all of the user's data as JSON: entries, summaries, screener results, diet plan, and referral log.
- **Deletion:** one button, with a typed confirmation, deletes the account and all data immediately.
  **[Default]** Database backups roll off within 30 days, and the deletion screen says so.
- Nothing goes to a third party, including a doctor, without the user's explicit action each time.
- **[Default]** HIPAA: as a student project with no provider integration, Steady is not a covered entity or business associate, so HIPAA likely does not apply.
  Steady must not claim to be HIPAA compliant.
  Revisit this before any provider integration.

### Accessibility

- WCAG 2.1 AA.
- Everything works from the keyboard, with a visible focus ring.
- Flagged and excluded states never rely on color alone.
  They also use text or an icon.
- Motion is removed when `prefers-reduced-motion` is set.
- Touch targets are at least 44 by 44 px.
- Tested with VoiceOver on iOS and macOS before each milestone ships.

### Tone

- Neutral, descriptive wording is a product requirement.
- A tone check runs in CI (section 10), and every PR that adds user-facing text goes through the tone checklist in the PR template:
  - describes, never judges
  - no diagnosis label
  - no scores shown to the user
  - no cause-and-effect claims
  - no urgency or guilt

### Performance and support

- The journal loads in under 2 seconds on a mid-range phone over 4G.
- Supports the last two versions of Chrome, Firefox, Safari, and Edge, and iOS Safari 17 or later.
- Works from 320 px wide up, with no horizontal scrolling.

## 8. Tech stack

From the stack map, scaffolded with `bun create better-fullstack@latest`.

| Layer | Choice |
|---|---|
| Frontend | React + TanStack Router |
| UI behavior | React Aria Components, styled with the design brief's tokens |
| API | Hono |
| ORM and migrations | Drizzle |
| Database | Postgres |
| Auth | Better-Auth |
| PDF | **[Default]** `@react-pdf/renderer`, run on the server from the reviewed snapshot. Confirm it runs under Bun in milestone 0, and pick another server-side library if not. |
| Tests | Unit tests with the scaffold's runner, end-to-end tests with Playwright |

## 9. Milestones

Each milestone ends with its acceptance criteria passing in CI.

| # | Milestone | Contents |
|---|---|---|
| 0 | Foundation | Scaffold, CI with all required checks, design tokens, self-hosted fonts, Better-Auth sign-up and sign-in, CSP |
| 1 | Journal | Entry create, edit, delete, week view, New entry card, flagging, weekly observations |
| 2 | Summary | Date range, three sections, include and exclude, question templates, review snapshot, PDF, clipboard |
| 3 | Screener gate | Instrument as data, placeholder instrument, flow, server gate, 90-day expiry, referral flow, placeholder diet plan |
| 4 | Account and polish | Export JSON, full deletion, settings (care team link), accessibility pass, tone review of every string |

The gate (milestone 3) is built before any diet content exists, so diet content is never reachable ungated, even during development.

## 10. Checks in CI

The standard checks: format and lint, type check, unit tests, production build, secret scan, dependency audit (blocking on high and critical), and Playwright end-to-end tests.

Steady-specific checks, one per safety rule, never skipped:

| Check | Protects |
|---|---|
| Gate test: `/diet` returns 403 for no screen, expired, and at-or-above | Non-negotiable 1 |
| Bundle scan: no diet content in frontend JavaScript | Non-negotiable 1 |
| Tone check: fails on banned words in UI strings and generated text ("eating disorder", "diagnosis", "you have", "safe food", "trigger", "streak", "points", "calorie", "caused") | Non-negotiables 2 and 3 |
| Export test: export without review returns 409 | Non-negotiable 4 |
| Origin check: the production build loads no third-party origins | Non-negotiable 5 |
| Ownership test: one user cannot read another user's rows | Privacy |

## 11. Phase 2 (not in the MVP)

- **Re-screen prompt from journal warning signs.**
  A gentle suggestion only, never a block.
  Starting numbers, to be checked with a clinician:
  - compare the last 14 days with the 28 days before
  - prompt when distinct foods logged drop by 40% or more
  - or when 3 or more entries in 14 days contain "skipped", "didn't eat", or "scared to eat"
  Keyword matching on free text will produce false positives, which is acceptable only because the result is a suggestion.
- Expiring share links for summaries.
- Step-by-step reintroduction tracking.
- A provider directory or booking.

## 12. Open questions

| Question | Blocks | Owner |
|---|---|---|
| Which screening instrument, and is it licensed for this use? | Shipping the gate to real users | Clinical advisor |
| Is a 90-day wait after a positive screen right? | Shipping the gate to real users | Clinical advisor |
| Who writes the diet and reintroduction content? | Shipping the diet plan | Dietitian |
| Which resources, and which crisis line, go in the referral list? | Shipping the referral flow | Clinical advisor |
| Which host and data region? | Milestone 0 deploy | Bianca |
| Does `@react-pdf/renderer` run under Bun? | Milestone 2 | Engineering, checked in milestone 0 |
