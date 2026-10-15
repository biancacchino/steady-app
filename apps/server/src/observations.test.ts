// Weekly observations (PRD 5.3, milestone 1 decisions 9 and 10). Exact sentences, as the PRD's
// acceptance criteria require.
import { describe, expect, it } from "vitest";

import { observe } from "./observations";

const zone = "America/Toronto";

/** An entry at noon Toronto time on the given October 2026 day. */
function on(day: number, symptom: string | null) {
  const date = `2026-10-${String(day).padStart(2, "0")}T16:00:00Z`;
  return { occurredAt: new Date(date), timeZone: zone, symptom };
}

describe("observe", () => {
  it("describes Maya's week: entries, then symptoms on 2 or more days, most days first", () => {
    const week = [
      on(12, "bloating after lunch"),
      on(12, null),
      on(13, "cramping, bloating"),
      on(13, null),
      on(14, "felt bloated"),
      on(15, "cramps all afternoon"),
      on(15, null),
      on(16, "tired"),
      on(16, "fatigue"),
    ];
    // "tired" and "fatigue" on the same day are one day of fatigue, so it stays below 2 days.
    expect(observe(week)).toEqual([
      "You logged 9 entries on 5 days.",
      "3 of 5 logged days mentioned bloating, 2 mentioned cramping.",
    ]);
  });

  it("counts several mentions on one day once", () => {
    const week = [on(12, "bloating"), on(12, "still bloated"), on(13, "bloaty")];
    expect(observe(week)[1]).toBe("2 of 2 logged days mentioned bloating.");
  });

  it("skips a symptom after no, not, without, or didn't, until the next comma or period", () => {
    const week = [
      on(12, "no bloating today, just tired"),
      on(13, "not bloated"),
      on(14, "without cramping"),
      on(15, "didn't have any pain"),
      on(16, "didn\u2019t feel nauseous"), // curly apostrophe, as phone keyboards type it
    ];
    expect(observe(week)).toEqual(["You logged 5 entries on 5 days."]);
  });

  it("ends a negation at a comma or period", () => {
    const week = [on(12, "no idea why, bloated all evening"), on(13, "No pain. Bloating later")];
    expect(observe(week)[1]).toBe("2 of 2 logged days mentioned bloating.");
  });

  // Known limit (decision 9): with no punctuation, the negation reaches the next symptom too.
  it("misses a symptom after a negation in the same unpunctuated stretch", () => {
    expect(observe([on(12, "no pain but bloated"), on(13, "bloated")])[1]).toBeUndefined();
  });

  // Decision 11: everyday words for three symptoms.
  it("counts tired as fatigue, stomach ache as pain, and loose stools as diarrhea", () => {
    const week = [
      on(12, "tired, stomach ache, loose stools"),
      on(13, "so tired. Stomachache and loose stool"),
      on(14, "stomach-ache"),
    ];
    expect(observe(week)[1]).toBe(
      "3 of 3 logged days mentioned pain, 2 mentioned diarrhea, 2 mentioned fatigue.",
    );
  });

  it("applies negation to everyday phrases too", () => {
    const week = [
      on(12, "no stomach ache, bloated"),
      on(13, "stomach ache"),
      on(14, "stomach aches"),
    ];
    // Pain on 13 and 14 only. If the negation missed the phrase, this would say 3.
    expect(observe(week)[1]).toBe("2 of 3 logged days mentioned pain.");
  });

  it("orders symptoms on the same number of days alphabetically", () => {
    const week = [on(12, "nausea, gas"), on(13, "gassy, nauseous")];
    expect(observe(week)[1]).toBe("2 of 2 logged days mentioned gas, 2 mentioned nausea.");
  });

  it("puts each entry on the day it happened in its own zone", () => {
    // 00:30 Tuesday in Toronto, and 23:30 Monday in Toronto: two days, not one.
    const week = [
      { occurredAt: new Date("2026-10-13T04:30:00Z"), timeZone: zone, symptom: "bloating" },
      { occurredAt: new Date("2026-10-13T03:30:00Z"), timeZone: zone, symptom: "bloating" },
    ];
    expect(observe(week)).toEqual([
      "You logged 2 entries on 2 days.",
      "2 of 2 logged days mentioned bloating.",
    ]);
  });

  it("leaves out symptoms noted on only one day", () => {
    expect(observe([on(12, "fatigue"), on(13, "cramping")])).toEqual([
      "You logged 2 entries on 2 days.",
    ]);
  });

  it("uses singular words for one entry on one day", () => {
    expect(observe([on(12, null)])).toEqual(["You logged 1 entry on 1 day."]);
  });

  it("says plainly when there are no entries", () => {
    expect(observe([])).toEqual(["No entries logged."]);
  });

  it("never names a food", () => {
    const entry = { ...on(12, "bloating"), food: "pasta" };
    expect(
      observe([entry, { ...entry, occurredAt: new Date("2026-10-13T16:00:00Z") }]).join(" "),
    ).not.toContain("pasta");
  });
});
