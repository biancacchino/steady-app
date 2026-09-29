# Lessons

## Design

- Keep Steady's type professional and plain.
  No italic, bold, or colored accent words inside headlines, even when a reference site does it.
- No eyebrows anywhere in Steady, in any case or color.
  An eyebrow is any small label sitting above or beside a heading: "Question 2 of 5" above a question, "Today, Sunday 18 October" beside "New entry", a date range above "For Dr. Osei".
  Move the information where it does work: into the heading ("October 2026"), into a real field (a Date field defaulting to today), into a labeled block under the title (For / Period / Appointment), or next to the related action ("Question 2 of 5" beside Continue).
  Grouping, like a new day, has to be visible from layout (a date column, full-width dividers), not from a tiny label.
  Before publishing, scan every heading for small text directly above or beside it.
- "Looks AI-generated" is usually a layout pattern problem (boxed cards with label stacks, equal bordered tiles, a header-row table for two rows), not a component library problem.
  Fix the pattern first, then pick an unstyled library to carry behavior.
- Clarity beats minimalism for health data.
  Do not drop field labels and rely on position or a decorative rule to say which line is food and which is a symptom.
  A cue that only shows up on some entries (like a rule only when a symptom exists) makes entries look inconsistent.
  Use the same labeled rows on every entry, with an explicit empty value like "None noted".
