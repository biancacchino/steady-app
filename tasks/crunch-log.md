# Crunch log

Work built with `/ship-crunch`, so no `comprehend` or `reason` session ran.
This is the study list for after the deadline.

## Milestone 3: Screener gate (PR #16)

`comprehend`:
- `apps/server/src/screening.ts`: `scoreAnswers`, `gateState`.
- `apps/server/src/screening-routes.ts`: `requireScreen`, the transaction in `POST /api/screening`, `activeInstrument`.
- `packages/db/src/schema/screening.ts` and migration `0003`: the `screening` schema, the composite foreign key to the instrument.
- `scripts/check-bundle.mjs`.

`reason`:
- Latest result decides the gate, not the best one.
- Retake rules: below any time, at-or-above locked 90 days.
- Plan pauses and resumes with the same dates.
- Referral list and crisis line wording (placeholder, needs a person).
- Placeholder instrument text and threshold 4.
