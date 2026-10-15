// Weekly observations (PRD 5.3, milestone 1 decisions 9 and 10). Runs on the server so the week
// view and the appointment summary show the same sentences. Symptom notes only: food words are
// never counted, so nothing reads as a ranking of foods.

// Each symptom and the forms people write it in. The sentence uses the key.
const SYMPTOMS: Record<string, string[]> = {
  bloating: ["bloat", "bloated", "bloating", "bloaty"],
  constipation: ["constipation", "constipated"],
  cramping: ["cramp", "cramps", "cramped", "cramping", "crampy"],
  diarrhea: ["diarrhea", "diarrhoea"],
  fatigue: ["fatigue", "fatigued", "tired"],
  gas: ["gas", "gassy"],
  nausea: ["nausea", "nauseous", "nauseated"],
  pain: ["pain", "pains", "painful"],
  urgency: ["urgency", "urgent"],
};
const SYMPTOM_BY_FORM = new Map(
  Object.entries(SYMPTOMS).flatMap(([symptom, forms]) => forms.map((form) => [form, symptom])),
);

// Everyday two-word phrases, rewritten to a symptom word before matching (decision 11), so the
// negation rule below applies to them too. Clinical review of this list is open in PRD section 12.
const PHRASES: [RegExp, string][] = [
  [/\bstomach[ -]?aches?\b/g, "pain"],
  [/\bloose stools?\b/g, "diarrhea"],
];

// A negation covers the words after it until the next comma or period (decision 9).
// ponytail: a word rule, so "no pain but bloated" skips "bloated" too. A clinician-reviewed
// parser is the upgrade if these sentences ever need to be exact.
const NEGATIONS = new Set(["no", "not", "without", "didn't"]);

type Entry = { occurredAt: Date; timeZone: string; symptom: string | null };

/** The symptoms a note mentions, skipping negated ones. */
export function symptomsIn(note: string): Set<string> {
  const found = new Set<string>();
  // Phone keyboards type a curly apostrophe in "didn't".
  let text = note.toLowerCase().replace(/\u2019/g, "'");
  for (const [phrase, symptom] of PHRASES) text = text.replace(phrase, symptom);
  for (const clause of text.split(/[,.]/)) {
    let negated = false;
    for (const word of clause.match(/[a-z']+/g) ?? []) {
      if (NEGATIONS.has(word)) negated = true;
      const symptom = SYMPTOM_BY_FORM.get(word);
      if (symptom && !negated) found.add(symptom);
    }
  }
  return found;
}

/** The entry's calendar day in its own zone (decision 4), as YYYY-MM-DD. */
function localDay({ occurredAt, timeZone }: Entry): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(occurredAt);
}

/** Plain sentences about a range of entries: the count, then symptoms noted on 2 or more days. */
export function observe(entries: Entry[]): string[] {
  if (entries.length === 0) return ["No entries logged."];

  const days = new Set<string>();
  const daysBySymptom = new Map<string, Set<string>>();
  for (const entry of entries) {
    const day = localDay(entry);
    days.add(day);
    for (const symptom of symptomsIn(entry.symptom ?? "")) {
      daysBySymptom.set(symptom, (daysBySymptom.get(symptom) ?? new Set()).add(day));
    }
  }

  const sentences = [
    `You logged ${entries.length === 1 ? "1 entry" : `${entries.length} entries`} on ${days.size} day${days.size === 1 ? "" : "s"}.`,
  ];
  const recurring = [...daysBySymptom]
    .map(([symptom, symptomDays]) => ({ symptom, count: symptomDays.size }))
    .filter(({ count }) => count >= 2)
    .sort((a, b) => b.count - a.count || a.symptom.localeCompare(b.symptom));
  const [top, ...rest] = recurring;
  if (top) {
    const parts = [
      `${top.count} of ${days.size} logged days mentioned ${top.symptom}`,
      ...rest.map(({ symptom, count }) => `${count} mentioned ${symptom}`),
    ];
    sentences.push(`${parts.join(", ")}.`);
  }
  return sentences;
}
