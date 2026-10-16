// Screener rules (PRD 5.5). Pure functions, so the gate's arithmetic is tested without a database.
import { SCREEN_VALID_DAYS } from "@steady/db/schema/screening";

export { SCREEN_VALID_DAYS };

export type Question = {
  id: string;
  text: string;
  options: { label: string; value: number }[];
};

const DAY_MS = 86_400_000;

/**
 * The sum of the chosen options' values, or null when the answers do not fit the questions:
 * one option index per question, in order, and every index a whole number inside the options.
 * ponytail: only the "sum" rule exists. A second rule is added with the instrument that needs it.
 */
export function scoreAnswers(questions: Question[], answers: number[]): number | null {
  if (answers.length !== questions.length) return null;
  let total = 0;
  for (const [i, question] of questions.entries()) {
    const option = question.options[answers[i] as number];
    if (!option) return null;
    total += option.value;
  }
  return total;
}

type Latest = { tier: string; completedAt: Date };

export type Gate =
  | { state: "none" }
  | { state: "expired" }
  | { state: "below"; expiresAt: Date }
  | { state: "at_or_above"; retakeAt: Date };

/** What the user's latest result means right now. A result is current for 90 days. */
export function gateState(latest: Latest | null, now: Date): Gate {
  if (!latest) return { state: "none" };
  const endsAt = new Date(latest.completedAt.getTime() + SCREEN_VALID_DAYS * DAY_MS);
  if (endsAt <= now) return { state: "expired" };
  return latest.tier === "below"
    ? { state: "below", expiresAt: endsAt }
    : { state: "at_or_above", retakeAt: endsAt };
}
