// What an appointment summary says (PRD 5.4). Pure functions, so the preview, the reviewed
// snapshot, the PDF, and the copied text all come from the same place.
import { cleanText } from "@steady/db/schema/journal";
import { MAX_QUESTIONS } from "@steady/db/schema/summary";

import { localDay, observe, symptomsIn } from "./observations";

export type SummaryEntry = {
  id: string;
  occurredAt: Date;
  timeZone: string;
  food: string | null;
  symptom: string | null;
  severity: string | null;
  context: string[];
  flagged: boolean;
};

/** Exactly what export sends. Saved at review, so later journal edits cannot change it. */
export type Snapshot = {
  providerName: string | null;
  appointmentDate: string | null;
  rangeStart: string;
  rangeEnd: string;
  observations: string[];
  flagged: { day: string; time: string; food: string; symptom: string }[];
  questions: string[];
};

const ALWAYS = "What would be most useful to keep noting before my next visit?";
const FALLBACK = "Is there anything in this summary you'd like to look at more closely?";
const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// Calendar dates are formatted in UTC so the date never shifts with the server's zone.
const formatDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );

/**
 * Suggested questions from fixed templates (PRD 5.4: never an AI model). Each is a question about
 * what was noted together, never a conclusion about a cause. Between 2 and 4.
 */
export function suggestQuestions(entries: SummaryEntry[], flaggedCount: number): string[] {
  const days = new Set<string>();
  const symptomDays = new Map<string, Set<string>>();
  const daysWithSymptom = new Set<string>();
  const contextDays = new Map<string, Set<string>>();
  for (const entry of entries) {
    const day = localDay(entry);
    days.add(day);
    if (entry.symptom) daysWithSymptom.add(day);
    for (const symptom of symptomsIn(entry.symptom ?? "")) {
      symptomDays.set(symptom, (symptomDays.get(symptom) ?? new Set()).add(day));
    }
    for (const tag of entry.context) {
      contextDays.set(tag, (contextDays.get(tag) ?? new Set()).add(day));
    }
  }

  // Most days first, ties alphabetical, the same order as the observations (PRD 5.3).
  const top = <T>(items: [string, T][], count: (value: T) => number) =>
    items
      .map(([name, value]) => ({ name, count: count(value), value }))
      .filter((item) => item.count >= 2)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))[0];

  const questions: string[] = [];
  const symptom = top([...symptomDays], (d) => d.size);
  if (symptom) {
    questions.push(
      `${capitalize(symptom.name)} was noted on ${symptom.count} of ${days.size} logged days. Is that worth looking into?`,
    );
  }
  const tag = top([...contextDays], (d) => [...d].filter((day) => daysWithSymptom.has(day)).length);
  if (tag) {
    questions.push(
      `Symptoms were noted on ${tag.count} of ${tag.value.size} days tagged ${tag.name}. Is that worth looking into?`,
    );
  }
  if (flaggedCount > 0) {
    questions.push(
      `I flagged ${flaggedCount} ${plural(flaggedCount, "entry", "entries")}. Could we go through ${plural(flaggedCount, "it", "them")} together?`,
    );
  }
  questions.push(ALWAYS);
  if (questions.length < 2) questions.push(FALLBACK);
  return questions.slice(0, MAX_QUESTIONS);
}

/** Trims each question, leaves out empty ones, and keeps at most 4 (PRD 5.4). */
export function cleanQuestions(questions: string[]): string[] {
  return questions
    .map((q) => cleanText(q))
    .filter((q): q is string => q !== null)
    .slice(0, MAX_QUESTIONS);
}

/** The entries still in the summary after the user left some out. */
export function keptEntries(entries: SummaryEntry[], excludedEntryIds: string[]): SummaryEntry[] {
  const excluded = new Set(excludedEntryIds);
  return entries.filter((e) => !excluded.has(e.id));
}

export function buildSnapshot(input: {
  entries: SummaryEntry[];
  rangeStart: string;
  rangeEnd: string;
  providerName: string | null;
  appointmentDate: string | null;
  excludedEntryIds: string[];
  questions: string[];
}): Snapshot {
  // A left-out entry is gone from the whole summary, counts included, so a symptom the user kept
  // private is not counted in what their provider reads.
  const kept = keptEntries(input.entries, input.excludedEntryIds);
  const flagged = kept
    .filter((e) => e.flagged)
    .map((e) => ({
      day: formatDate(localDay(e), { weekday: "short", day: "numeric", month: "long" }),
      time: new Intl.DateTimeFormat("en-US", {
        timeZone: e.timeZone,
        hour: "numeric",
        minute: "2-digit",
      }).format(e.occurredAt),
      food: e.food ?? "None noted",
      symptom: e.symptom
        ? `${e.symptom}${e.severity ? ` · Severity ${e.severity}` : ""}`
        : "None noted",
    }));
  return {
    providerName: input.providerName,
    appointmentDate: input.appointmentDate,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    observations: observe(kept),
    flagged,
    questions: cleanQuestions(input.questions),
  };
}

/** The header lines shared by the PDF and the copied text. */
export function headerLines(s: Snapshot): string[] {
  const long = { day: "numeric", month: "long", year: "numeric" } as const;
  const period =
    s.rangeStart === s.rangeEnd
      ? formatDate(s.rangeStart, long)
      : `${formatDate(s.rangeStart, long)} to ${formatDate(s.rangeEnd, long)}`;
  return [
    ...(s.providerName ? [`For: ${s.providerName}`] : []),
    `Period: ${period}`,
    ...(s.appointmentDate
      ? [
          `Appointment: ${formatDate(s.appointmentDate, { weekday: "long", day: "numeric", month: "long" })}`,
        ]
      : []),
  ];
}

export const NO_FLAGGED = "No flagged entries in this period.";

/** The summary as plain text, in the PDF's order (PRD 5.4, copy to clipboard). */
export function summaryText(s: Snapshot): string {
  const lines = [
    "Appointment summary",
    ...headerLines(s),
    "",
    "Pattern observed",
    ...s.observations,
    "",
    "Worth flagging",
  ];
  if (s.flagged.length === 0) lines.push(NO_FLAGGED);
  for (const f of s.flagged) {
    lines.push(`${f.day}, ${f.time}`, `Food: ${f.food}`, `Symptoms: ${f.symptom}`);
  }
  lines.push("", "Questions to bring", ...s.questions.map((q, i) => `${i + 1}. ${q}`), "");
  return lines.join("\n");
}
