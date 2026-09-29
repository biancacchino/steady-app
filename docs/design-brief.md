# Steady - Design Brief (v0.1)

Visual direction for the Steady IBS app, drawn from polarity.so, cohere.com, and ada.cx.
Values marked "measured" come from computed styles on the live sites, captured 2026-09-28.
ada.cx blocked automated capture, so its values are "sampled" from pixel colors in screenshots, and its type details are inferred by eye.
The working reference page is `design/steady-design.html` (published at https://claude.ai/artifact/7R3iBaY7ADAs197F2vjYMC), and `design/flow.test.mjs` runs its end-to-end checks.

## 1. The one-line direction

A calm, editorial health tool: one quiet serif for moments that matter, a plain grotesque for everything else, warm-neutral paper, one deep green, hairline structure, almost no decoration.

It should feel like a well-kept notebook a clinician would respect, not a wellness app and not a tracker.

## 2. What we take from each reference

### Polarity (polarity.so)

- **Serif display over a grotesque body.**
  Display is Exposure at 48px, line-height 43px (0.9), tracking -3.36px (measured).
  Body and UI are Cursor Gothic at 14-16px, weights 400 and 500 only (measured).
- **Monochrome with one accent.**
  Ink `#000614` / `#0a0a0a`, body grey `#3d3d3d`, white `#fefefe` (measured).
  A single saturated blue line carries meaning in diagrams (inferred from screenshot).
- **Hairlines instead of shadows.**
  1px borders at 24% white on dark, radius 4px everywhere, zero box-shadows (measured).
- **Line-drawn explanatory diagrams.**
  Thin isometric and network drawings explain the product instead of stock imagery.
- **Huge vertical whitespace.**
  Section padding of 144-160px, content left-aligned, ~7 screens deep (measured).

### Cohere (cohere.com)

- **One display serif, one workhorse sans.**
  Hero in CohereText at 96px, tracking -1.92px (measured).
  Everything else in Unica77, a neutral grotesque, weight 400 for 91% of text (measured).
- **Warm neutrals with a deep green and a coral.**
  `--volcanic #212121`, `--marble #fafafa`, `--green #39594d`, `--coral #ff7759`, warm surface `#f0eee9` (measured CSS variables).
- **Pill buttons, soft cards.**
  Buttons radius 9999px, cards and images 8 / 12 / 20 / 22px (measured).
- **Product UI framed on organic imagery.**
  Real screenshots sit on textured nature photography, with alternating light and dark full-bleed bands.
- **Fast, plain UI motion.**
  150ms `cubic-bezier(0.4, 0, 0.2, 1)` on opacity, color, and transform (measured).
  Entrances use fadeInUp at 0.5-0.8s (measured).
- **Short declarative headlines.**
  "Your AI. Your rules." Two short sentences, no jargon.

### Ada (ada.cx)

- **A soft sage green for actions.**
  Primary pill buttons are `#8fbe8e` with dark text (sampled).
  Against a dark slate like `#16242a` it measures 7.52:1, so it works as a dark-mode primary.
- **Dark slate, not pure black.**
  Page backgrounds sample at `#16242a` and `#1b2127`, a blue-green slate.
  Cards sit a step darker (`#0e1216`) with a faint 1px border.
- **Pills everywhere.**
  Nav bar, buttons, the email field, filter chips, and category tabs are all fully rounded.
  The selected chip gets a green tint and a green border, the others stay neutral.
- **One italic word in a headline.**
  "Real results. For real *businesses*" uses italic for emphasis.
  Observed but not taken, see section 3.
- **Uppercase eyebrow labels.**
  Small tracked caps ("INTELLIGENCE LAYER", "AI AGENT") sit above headings, in sage or a muted coral.
  Observed but not taken, see section 3.
- **Light-weight display type.**
  Headlines are a large, light grotesque with tight tracking (inferred from screenshots).

### Shared by all three

- Two typefaces, mostly weight 400, hierarchy from size and tracking rather than bold.
- Negative tracking on display type, normal tracking on body.
- Neutral page, one brand color, no gradients on components.
- 150ms ease-out transitions.

## 3. What we deliberately do not take

- **Dark-first design, glass, and blurred photo backgrounds.**
  Ada is dark throughout, with frosted panels over blurred photography.
  Steady borrows Ada's colors for its dark mode only.
- **Dark hero sections.**
  All three sites open or alternate with near-black bands.
  Steady users may open the app while anxious or unwell, so the app stays light-first with a proper dark mode, not dramatic contrast bands.
- **Coral as a signal color.**
  Cohere's `#ff7759` on white is 2.61:1, which fails WCAG for text.
  Ada's terracotta `#ca6a42` (sampled) on its selected tab has the same problem of meaning.
  In a health app, a warm red-orange also reads as "warning", which conflicts with the no-good-food/bad-food rule (spec 3.2).
- **Food photography.**
  Cohere-style imagery is fine, but never pictures of food.
  Showing food invites judgment of food, which the spec forbids.
- **Infinite animations.**
  Polarity has a 4s looping "banner-breathe" and Cohere a 69s marquee (measured).
  Nothing in Steady loops.
- **Uppercase eyebrow labels.**
  Steady uses no eyebrows at all: no small label above or beside a heading, in caps or not.
  The information goes where it does work instead: into the heading, into a real form field, into a labeled block under the title, or next to the action it relates to.
- **Italic emphasis in headlines.**
  Ada's italic accent word reads as marketing, and Steady should read as professional and clinical.
- **Big stat tiles and live counters.**
  Polarity's "72% / 2.4x / +8%", Ada's "8x / 162% / 357%" and its live conversation counter are persuasive marketing.
  In Steady, large numbers about symptoms would read as a score, which spec 3.3 rules out.
- **The warm-cream + serif + coral look as a whole.**
  Combined, it is a very common template look.
  Steady takes Cohere's green as its brand, not the coral.

## 4. Tokens

These are proposals derived from the measured values, not copies.
The references use commercial fonts (Exposure, Cursor Gothic, Unica77) that we cannot license, so the type roles use free substitutes with a similar feel.

### Color (light)

| Token | Value | Source | Use |
|---|---|---|---|
| `--bg` | `#fafafa` | Cohere `--marble` | Page |
| `--surface` | `#ffffff` | both | Cards, journal entries |
| `--surface-warm` | `#f0eee9` | Cohere | Summary document, calm panels |
| `--ink` | `#212121` | Cohere `--volcanic` | Text, 15.4:1 on `--bg` |
| `--muted` | `#6b6b80` | adjusted from Cohere `#73738a` | Secondary text, 4.98:1 on `--bg` |
| `--line` | `#e4e2dc` | derived | Hairlines, input borders |
| `--primary` | `#39594d` | Cohere `--green` | Buttons, links, focus, 7.42:1 on `--bg` |
| `--on-primary` | `#ffffff` | | Text on primary, 7.75:1 |

Cohere's muted `#73738a` measures 4.42:1 on `#fafafa`, just under the 4.5:1 body-text minimum, so Steady darkens it to `#6b6b80`.

### Color (dark)

| Token | Value | Note |
|---|---|---|
| `--bg` | `#16242a` | Ada slate (sampled) |
| `--surface` | `#1c2d34` | derived, one step lighter |
| `--ink` | `#fafafa` | 15.24:1 on `--bg` |
| `--muted` | `#97a3a6` | derived, 6.14:1 on `--bg`, 5.50:1 on `--surface` |
| `--line` | `rgb(255 255 255 / 0.12)` | translucent hairline, Polarity-style |
| `--primary` | `#8fbe8e` | Ada sage (sampled), 7.52:1 on `--bg` |
| `--on-primary` | `#16242a` | dark text on sage, 7.52:1, as Ada does |

Light mode keeps Cohere's deep green, dark mode uses Ada's sage.
Both are the same family, so the brand reads as one green that brightens in the dark.
Neither Polarity nor Cohere offered a dark variant to measure, and Ada's colors come from screenshots.

### No semantic red

Flagged entries use `--primary` plus a filled flag icon and the word "Flagged", never color alone.
There is no error-red in journal or summary views.
A real destructive action (delete account) is the only place a red appears.

### Type

| Role | Face | Size / line-height / tracking | Weight |
|---|---|---|---|
| Display | Newsreader (Google Fonts) | 40-56px / 1.0 / -0.03em | 400 |
| Heading | Hanken Grotesk | 24px / 1.25 / -0.01em | 500 |
| Body | Hanken Grotesk | 16px / 1.6 / normal | 400 |
| Small | Hanken Grotesk | 14px / 1.5 / normal | 400 |
| Label | Hanken Grotesk | 12px / 1.4 / +0.02em | 500 |

Display serif appears in a few places only: screen titles, the screener result message, and the summary title.
Display lines stay plain: no italic, bold, or color for emphasis.
Hierarchy comes from size and color, with weights limited to 400 and 500, like the references.
Dates and counts use `font-variant-numeric: tabular-nums`.
Journal body text keeps a 60-70 character measure.

### Space, shape, depth

- Base unit 4px, ladder `4 / 8 / 12 / 16 / 24 / 40 / 64`.
  Cohere's most common paddings are 24 / 16 / 4 / 12 / 40 (measured), which this matches.
- Radius: 8px for cards and inputs, 16px for sheets and dialogs, 9999px for buttons, tags, and filter chips.
- Selected chip, following Ada: green-tinted fill plus a green border, not a solid fill.
- Depth: hairline borders only.
  One soft shadow for floating layers (menus, dialogs), nothing on cards.
- No gradients, glow, or glass on components.
- Texture: a fine, fixed grain on the page background only, like Arc's window texture but without its color gradients, and not user-customizable.
  It is a tiled SVG noise (`--grain`): dark specks at 6% in light mode, light specks at 7% in dark mode.
  Cards, fields, and the PDF paper stay flat, so text never sits on the grain except page-level copy.
  Measured: secondary text (`--muted`) stays at 4.64:1 or better even on the darkest light-mode speck, and 5.09:1 in dark mode.

### Motion

- UI transitions: 150ms `cubic-bezier(0.4, 0, 0.2, 1)`, on opacity, color, and transform only.
- Sheets and dialogs: 250ms ease-out, fade plus 8px rise.
- No entrance animations inside the app; they are for a marketing page only.
- `prefers-reduced-motion: reduce` turns all of it off.

## 5. How it applies to each screen

- **Screener.**
  One question per screen, large readable options as full-width pill-shaped choices.
  No progress bar that looks like a score.
  The result screen uses the display serif for one calm sentence, then plain body text.
- **Journal.**
  One panel, not a card per entry.
  Entries are grouped by day, agenda-style: a date column on the left shows the weekday, a large date in the display serif, and the month, and stays pinned while that day scrolls.
  A full-width hairline separates days, and a shorter inset hairline separates entries within a day, so a new day is obvious at a glance.
  The time sits in its own column next to each entry, in tabular numbers.
  Every entry has the same three labeled rows: Food, Symptoms, Context, with labels in a muted column on the left.
  When no symptom was logged, the Symptoms row says "None noted", so every entry has the same shape.
  Context is plain text, not a pill.
  No color coding by food or severity.
- **Flagging.**
  Every journal entry has a Flag toggle button on the right (above the entry on phones).
  Pressed, it reads "Flagged" with a filled icon and a green tint; unpressed, it reads "Flag" with an outline.
  Flagged entries are what appear under "Worth flagging" in the appointment summary.
  Spec 3.4 also describes keyword matching, so the app can pre-flag matching entries, and the user can always unflag them.
- **Week header.**
  The panel title is the month and year ("October 2026"), in the display serif, with previous and next week buttons beside it, like a calendar week view.
  The week strip underneath shows the exact days.
  When a week spans two months, the title shows both ("September - October 2026").
  Next is disabled on the current week.
  Below it, one plain sentence: "This week: 3 of 7 logged days mentioned bloating."
- **Week strip.**
  Sits under the week header.
  Each day shows its short name, its date in the display serif, and a small mark on one shared hairline, Polarity-style.
  A filled mark means the symptom was mentioned that day, and the word appears under it, so the meaning does not rely on color.
  Picking a day scrolls the journal to it.
  Observations as sentences ("3 of 7 logged days mentioned bloating"), never as big numbers.
- **Appointment summary.**
  Rendered on `--surface-warm` like a sheet of paper, with the display serif title "Appointment summary".
  Under the title, a labeled block in the same style as entry rows: For (the provider), Period (the date range, since the last summary), and Appointment (follows the reminder date).
  Then the three sections from spec 3.4.
  On screen, "Worth flagging" uses the journal's exact layout (same renderer): date column, time, and Food, Symptoms, Context rows.
  Where the journal has the Flag button, each entry has an "Include" checkbox pill, checked by default.
  Unticking dims the entry and says "Left out of this summary. Still in your journal.", which is how spec 3.4's exclude-without-deleting works.
  The exported PDF does not copy the screen layout.
  It keeps a compact list for a 12-minute visit: date, then Food and Symptoms, no Context, no controls, included entries only.
  Before the review, the Export button is disabled with the hint "Read through Worth flagging to continue." beside it.
  Once "Worth flagging" has been on screen, the hint is replaced by a "Show PDF preview" button, the same size as Export (both full width on phones).
  It is a disclosure (`aria-expanded`), closed by default, that reveals a live sheet showing exactly what the PDF contains, always on white paper, even in dark mode; its label switches to "Hide PDF preview" when open.
  Questions are edited in place, up to four, and empty ones are left out.
  Export sits at the end of the sheet, labeled "Reviewed, export PDF", and stays disabled until "Worth flagging" has been on screen, so the only path to export runs through the review (spec 3.4).
- **Referral.**
  Same calm layout as the screener result, one primary action, no urgency cues.

## 6. Behavior (Fogg persuasive tools)

Four tools are used, each tied to a spec goal.
Surveillance and Conditioning are not used at all: leaderboards, streaks, points, badges, and celebrations are banned by spec 3.2 and section 6.

- **Reduction: one entry at a time.**
  The journal is a read view with a single "New entry" button in its header (full width under the month on phones).
  The button opens a focused card: a modal dialog on desktop, a bottom sheet on phones.
  Fields, in the same order as entry rows: Food, Symptoms, Context (one-tap chips), and When (Date defaulting to today, Time defaulting to now), with severity behind "Add severity".
  An entry needs at least one of Food or Symptoms, so a symptom with nothing eaten can be logged; the missing one shows as "None noted".
  Save is never disabled; saving an empty entry shows "This entry is empty. Add what you ate, a symptom, or both." with an icon, and marks both fields.
  Closing (Cancel, the close button, Esc, or clicking outside) keeps the draft, and a toast says so; reopening restores it.
  Accessibility: native modal dialog, so the page behind is inert; focus goes to Food on open and back to "New entry" on close; the error is announced; 44px targets; no animation with reduced motion.
- **Suggestion: appointment reminder.**
  The user can set an optional next appointment date.
  From two days before, a band at the top of the journal reads "Your appointment is on Tuesday 20 October. 3 flagged entries are ready to review." with a Review summary button.
  Further out, it only states the date and says the reminder will appear two days before.
  In-app only, unless the user turns on notifications.
  The appointment date is new data the spec does not list, and it needs the same protection as the journal.
- **Self-Monitoring: flag feedback.**
  Flagging or unflagging shows a short confirmation ("Added to your appointment summary.") in a polite live region, and the reminder's flagged count updates.
  The count describes entries, it is never a score.
- **Tunneling: review before export.**
  See the appointment summary section above.

## 7. Component library

Recommendation: React Aria Components (react-aria.adobe.com).
It is unstyled, so it adds keyboard behavior, focus handling, and screen reader support without a visual style of its own.
The look comes entirely from this brief's tokens.
A styled kit like shadcn/ui's defaults would pull the app toward the generic look this brief avoids.

| Steady piece | React Aria component |
|---|---|
| Week strip | `ToggleButtonGroup` |
| Flag on an entry | `ToggleButton` |
| Previous / next week | `Button` |
| New entry | `Modal` + `Dialog`, `Form`, `TextField`, `ToggleButtonGroup` (context), `DateField`, `TimeField`, `Disclosure` (severity) |
| Appointment date | `DateField` |
| Flag confirmation | polite live region (`role="status"`) |
| Journal entries | `GridList` |
| Worth flagging (screen) | one `GridList` per day, `Checkbox` labeled "Include" |
| Context tags | `TagGroup` |
| Screener answers | `RadioGroup` |
| Summary date range | `DateRangePicker` |

Not yet confirmed: whether Better Fullstack's scaffold offers a UI library option, or whether React Aria gets added by hand after scaffolding.

## 8. Open items

- **Ada's typeface is unconfirmed.**
  It could not be measured from screenshots.
  The brief takes its behavior (light weight, tight tracking), not the face.
- **Font licensing.**
  Newsreader and Hanken Grotesk are free (OFL).
  If you want a closer match to Unica77 or Exposure, that is a paid license.
- **Component library.**
  If you add shadcn/ui, map `--primary` to the green and keep shadcn's `--accent` as its neutral hover tint.
