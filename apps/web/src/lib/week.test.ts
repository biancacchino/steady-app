import { describe, expect, it } from "vitest";

import {
  addDays,
  daySymptom,
  entryDay,
  entryTime,
  groupByDay,
  mondayOf,
  todayIn,
  weekFromSearch,
  weekRange,
  weekTitle,
} from "./week";

describe("mondayOf", () => {
  it("snaps any day to the Monday of its week", () => {
    expect(mondayOf("2026-09-30")).toBe("2026-09-28");
    expect(mondayOf("2026-10-04")).toBe("2026-09-28");
    expect(mondayOf("2026-09-28")).toBe("2026-09-28");
  });
});

describe("weekFromSearch", () => {
  const today = "2026-10-15";

  it("snaps a date in the URL to its Monday", () => {
    expect(weekFromSearch("2026-09-30", today)).toBe("2026-09-28");
  });

  it("shows the current week for a missing, invalid, or future week", () => {
    for (const value of [undefined, "banana", "2026-02-30", "2027-03-01", 20260928]) {
      expect(weekFromSearch(value, today)).toBe("2026-10-12");
    }
  });
});

describe("todayIn", () => {
  it("is the calendar date in the given zone", () => {
    const late = new Date("2026-10-13T03:30:00Z");
    expect(todayIn("America/Toronto", late)).toBe("2026-10-12");
    expect(todayIn("UTC", late)).toBe("2026-10-13");
  });
});

describe("weekTitle", () => {
  it("names the month, or both months when the week spans two", () => {
    expect(weekTitle("2026-10-12")).toBe("October 2026");
    expect(weekTitle("2026-09-28")).toBe("September - October 2026");
    expect(weekTitle("2026-12-28")).toBe("December 2026 - January 2027");
  });
});

describe("addDays", () => {
  it("crosses months and years", () => {
    expect(addDays("2026-12-28", 6)).toBe("2027-01-03");
    expect(addDays("2026-10-12", -7)).toBe("2026-10-05");
  });
});

describe("entryDay and entryTime", () => {
  const entry = { occurredAt: "2026-10-12T16:30:00.000Z", timeZone: "America/Toronto" };

  it("uses the zone the entry was logged in", () => {
    expect(entryDay(entry)).toBe("2026-10-12");
    expect(entryTime(entry, "America/Toronto")).toBe("12:30");
  });

  it("names the entry's zone when the viewer is somewhere else", () => {
    expect(entryTime(entry, "America/Vancouver")).toBe("12:30 EDT");
  });
});

describe("daySymptom", () => {
  it("picks the symptom on the most entries that day, ties alphabetical", () => {
    expect(daySymptom([{ symptoms: ["cramping", "bloating"] }])).toBe("bloating");
    expect(daySymptom([{ symptoms: ["cramping"] }, { symptoms: ["cramping", "bloating"] }])).toBe(
      "cramping",
    );
    expect(daySymptom([{ symptoms: [] }])).toBeNull();
  });
});

describe("weekRange", () => {
  it("names the start month and year only when they differ from the end", () => {
    expect(weekRange("2026-10-12")).toBe("12-18 October");
    expect(weekRange("2026-09-28")).toBe("28 September - 4 October");
    expect(weekRange("2026-12-28")).toBe("28 December 2026 - 3 January 2027");
  });
});

describe("groupByDay", () => {
  it("lists days newest first, even when zones put a later moment on an earlier day", () => {
    const tokyo = { occurredAt: "2026-10-14T02:00:00.000Z", timeZone: "Asia/Tokyo" };
    const newYork = { occurredAt: "2026-10-14T02:30:00.000Z", timeZone: "America/New_York" };
    expect(groupByDay([tokyo, newYork]).map(([day]) => day)).toEqual(["2026-10-14", "2026-10-13"]);
  });

  it("lists a day's entries newest first", () => {
    const morning = { occurredAt: "2026-10-12T12:00:00.000Z", timeZone: "America/Toronto" };
    const evening = { occurredAt: "2026-10-12T23:00:00.000Z", timeZone: "America/Toronto" };
    expect(groupByDay([morning, evening])).toEqual([["2026-10-12", [evening, morning]]]);
  });
});
