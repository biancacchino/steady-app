import { describe, expect, it } from "vitest";

import { buildSnapshot, cleanQuestions, suggestQuestions, summaryText } from "./summary-content";

const zone = "America/Toronto";
let n = 0;
const entry = (
  day: string,
  fields: { food?: string; symptom?: string; context?: string[]; flagged?: boolean } = {},
) => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  occurredAt: new Date(`${day}T16:30:00Z`),
  timeZone: zone,
  food: fields.food ?? null,
  symptom: fields.symptom ?? null,
  severity: null,
  context: fields.context ?? [],
  flagged: fields.flagged ?? false,
});

describe("suggestQuestions", () => {
  it("fills the templates from the range, most frequent first, as questions", () => {
    const entries = [
      entry("2026-10-05", { symptom: "bloated", context: ["stress"], flagged: true }),
      entry("2026-10-06", { symptom: "bloating, cramps", context: ["stress"] }),
      entry("2026-10-07", { symptom: "bloating", context: ["stress"] }),
      entry("2026-10-08", { food: "rice", context: ["stress"] }),
      entry("2026-10-09", { food: "toast" }),
    ];
    expect(suggestQuestions(entries, 1)).toEqual([
      "Bloating was noted on 3 of 5 logged days. Is that worth looking into?",
      "Symptoms were noted on 3 of 4 days tagged stress. Is that worth looking into?",
      "I flagged 1 entry. Could we go through it together?",
      "What would be most useful to keep noting before my next visit?",
    ]);
  });

  it("always offers at least two questions, even for an empty range", () => {
    expect(suggestQuestions([], 0)).toEqual([
      "What would be most useful to keep noting before my next visit?",
      "Is there anything in this summary you'd like to look at more closely?",
    ]);
  });

  it("phrases every template as a question, with no banned wording", () => {
    const entries = [
      entry("2026-10-05", { symptom: "pain", context: ["sleep"] }),
      entry("2026-10-06", { symptom: "pain", context: ["sleep"] }),
    ];
    for (const q of suggestQuestions(entries, 2)) {
      expect(q.endsWith("?")).toBe(true);
      expect(q).not.toMatch(/because|caused|trigger|sensitive to/i);
    }
  });
});

describe("cleanQuestions", () => {
  it("drops empty questions, trims the rest, and keeps at most 4", () => {
    expect(cleanQuestions([" a? ", "", " ", "b?", "c?", "d?", "e?"])).toEqual([
      "a?",
      "b?",
      "c?",
      "d?",
    ]);
  });
});

describe("buildSnapshot and summaryText", () => {
  const kept = entry("2026-10-05", { food: "Pasta", symptom: "bloating", flagged: true });
  const left = entry("2026-10-06", { food: "Secret soup", symptom: "cramps", flagged: true });
  const notFlagged = entry("2026-10-07", { food: "Rice", symptom: "bloating" });
  const snapshot = buildSnapshot({
    entries: [kept, left, notFlagged],
    rangeStart: "2026-10-01",
    rangeEnd: "2026-10-14",
    providerName: "Dr. Osei",
    appointmentDate: "2026-10-20",
    excludedEntryIds: [left.id],
    questions: ["Is the bloating worth looking into?", " "],
  });

  it("leaves a left-out entry out of the counts too, so its symptoms stay private", () => {
    const private_ = entry("2026-10-08", { symptom: "diarrhea", flagged: true });
    const counted = entry("2026-10-09", { symptom: "diarrhea" });
    const result = buildSnapshot({
      entries: [private_, counted, entry("2026-10-10", { symptom: "diarrhea" })],
      rangeStart: "2026-10-01",
      rangeEnd: "2026-10-14",
      providerName: null,
      appointmentDate: null,
      excludedEntryIds: [private_.id],
      questions: [],
    });
    expect(result.observations).toEqual([
      "You logged 2 entries on 2 days.",
      "2 of 2 logged days mentioned diarrhea.",
    ]);
  });

  it("keeps only flagged entries the user did not leave out", () => {
    expect(snapshot.flagged).toEqual([
      { day: "Mon 5 October", time: "12:30 PM", food: "Pasta", symptom: "bloating" },
    ]);
    expect(snapshot.questions).toEqual(["Is the bloating worth looking into?"]);
  });

  it("writes the plain text in the PDF's order, without left-out entries", () => {
    const text = summaryText(snapshot);
    expect(text).toBe(
      [
        "Appointment summary",
        "For: Dr. Osei",
        "Period: 1 October 2026 to 14 October 2026",
        "Appointment: Tuesday 20 October",
        "",
        "Pattern observed",
        "You logged 2 entries on 2 days.",
        "2 of 2 logged days mentioned bloating.",
        "",
        "Worth flagging",
        "Mon 5 October, 12:30 PM",
        "Food: Pasta",
        "Symptoms: bloating",
        "",
        "Questions to bring",
        "1. Is the bloating worth looking into?",
        "",
      ].join("\n"),
    );
    expect(text).not.toContain("Secret soup");
  });

  it("says so when nothing was flagged", () => {
    const empty = buildSnapshot({
      entries: [],
      rangeStart: "2026-10-01",
      rangeEnd: "2026-10-01",
      providerName: null,
      appointmentDate: null,
      excludedEntryIds: [],
      questions: [],
    });
    expect(summaryText(empty)).toContain("Worth flagging\nNo flagged entries in this period.\n");
    expect(summaryText(empty)).toContain("Period: 1 October 2026\n");
  });
});
