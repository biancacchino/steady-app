/** "16 October 2026" for a timestamp from the server, in the viewer's own time zone. */
export function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
