// Calendar dates for the week view, as "YYYY-MM-DD" strings. Date math runs in UTC on purpose:
// these are calendar days, not moments, so no clock or zone can shift them.

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const toDate = (date: string) => new Date(`${date}T00:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  return toIso(new Date(toDate(date).getTime() + days * DAY_MS));
}

/** The Monday of the week the date falls in. */
export function mondayOf(date: string): string {
  return addDays(date, -((toDate(date).getUTCDay() + 6) % 7));
}

/** Today's calendar date in the zone (the browser's by default). */
export function todayIn(
  zone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  now = new Date(),
): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(now);
}

/**
 * The Monday to show for `?week=` (decision 12). Any date snaps to its Monday. A missing,
 * invalid, or future week shows the current week, so a typed or broken URL never fails.
 */
export function weekFromSearch(value: unknown, today: string): string {
  const current = mondayOf(today);
  if (typeof value !== "string" || !ISO_DATE.test(value)) return current;
  const date = toDate(value);
  // Rejects dates that do not exist, like 2026-02-30, which Date would roll into March.
  if (Number.isNaN(date.getTime()) || toIso(date) !== value) return current;
  const week = mondayOf(value);
  return week > current ? current : week;
}

/** Formats a calendar date without letting any zone move it. */
export function formatDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(toDate(date));
}

/** "October 2026", or "September - October 2026" when the week spans two months. */
export function weekTitle(monday: string): string {
  const sunday = addDays(monday, 6);
  const month = (date: string) => formatDate(date, { month: "long" });
  const year = (date: string) => date.slice(0, 4);
  if (month(monday) === month(sunday)) return `${month(monday)} ${year(monday)}`;
  if (year(monday) === year(sunday)) return `${month(monday)} - ${month(sunday)} ${year(sunday)}`;
  return `${month(monday)} ${year(monday)} - ${month(sunday)} ${year(sunday)}`;
}

/** "12-18 October", or "28 September - 4 October" when the week spans two months (or years). */
export function weekRange(monday: string): string {
  const sunday = addDays(monday, 6);
  const end = formatDate(sunday, { day: "numeric", month: "long" });
  if (monday.slice(0, 4) !== sunday.slice(0, 4)) {
    const full = { day: "numeric", month: "long", year: "numeric" } as const;
    return `${formatDate(monday, full)} - ${formatDate(sunday, full)}`;
  }
  if (monday.slice(5, 7) !== sunday.slice(5, 7)) {
    return `${formatDate(monday, { day: "numeric", month: "long" })} - ${end}`;
  }
  return `${formatDate(monday, { day: "numeric" })}-${end}`;
}

type Timed = { occurredAt: string; timeZone: string };

/** The entry's calendar day in the zone it was logged in (decision 4). */
export function entryDay({ occurredAt, timeZone }: Timed): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(occurredAt));
}

const clock = (moment: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(moment);

/**
 * The entry's time where it was logged (decision 3). When the viewer's clock would read
 * differently, the zone's short name follows: lunch in Toronto reads "12:30 EDT" in Vancouver.
 */
export function entryTime({ occurredAt, timeZone }: Timed, viewerZone: string): string {
  const moment = new Date(occurredAt);
  const time = clock(moment, timeZone);
  if (time === clock(moment, viewerZone)) return time;
  const zone = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
    .formatToParts(moment)
    .find((part) => part.type === "timeZoneName")?.value;
  return zone ? `${time} ${zone}` : time;
}

/** The symptom on the most of a day's entries, ties alphabetical (decision 13), or null. */
export function daySymptom(entries: { symptoms: string[] }[]): string | null {
  const counts = new Map<string, number>();
  for (const symptom of entries.flatMap((entry) => entry.symptoms)) {
    counts.set(symptom, (counts.get(symptom) ?? 0) + 1);
  }
  const [top] = [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  return top?.[0] ?? null;
}

/**
 * Entries grouped by the day they happened where logged, newest day first and newest entry
 * first within a day. Days are sorted by date, not by moment: with two zones, a later moment
 * can land on an earlier day.
 */
export function groupByDay<T extends Timed>(entries: T[]): [string, T[]][] {
  const byDay = new Map<string, T[]>();
  for (const entry of entries) {
    const day = entryDay(entry);
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }
  const newest = (a: T, b: T) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
  return [...byDay]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, dayEntries]) => [day, dayEntries.sort(newest)]);
}
