import {
  createFileRoute,
  type ErrorComponentProps,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "react-aria-components";

import { FormError } from "@/components/fields";
import { authClient, getSession } from "@/lib/auth-client";
import {
  addDays,
  daySymptom,
  entryTime,
  formatDate,
  groupByDay,
  mondayOf,
  todayIn,
  weekFromSearch,
  weekRange,
  weekTitle,
} from "@/lib/week";

type Entry = {
  id: string;
  occurredAt: string;
  timeZone: string;
  food: string | null;
  symptom: string | null;
  severity: string | null;
  context: string[];
  symptoms: string[];
};
type Week = { entries: Entry[]; observations: string[] };

export const Route = createFileRoute("/journal")({
  head: () => ({ meta: [{ title: "Journal - Steady" }] }),
  // The visible week lives in the URL, so Refresh and Back keep it (decision 12).
  validateSearch: (search: Record<string, unknown>): { week?: string } =>
    typeof search.week === "string" ? { week: search.week } : {},
  beforeLoad: async () => {
    if (!(await getSession())) throw redirect({ to: "/sign-in" });
  },
  loaderDeps: ({ search }) => ({ week: weekFromSearch(search.week, todayIn()) }),
  loader: async ({ deps: { week } }) => {
    const res = await fetch(`/api/entries?from=${week}&to=${addDays(week, 6)}`);
    if (res.status === 401) throw redirect({ to: "/sign-in" });
    if (!res.ok) throw new Error("Could not load the journal.");
    return { week, ...((await res.json()) as Week) };
  },
  component: Journal,
  errorComponent: LoadError,
});

const longDay = (date: string) =>
  formatDate(date, { weekday: "long", day: "numeric", month: "long" });

function Journal() {
  const { week, entries, observations } = Route.useLoaderData();
  const navigate = useNavigate({ from: "/journal" });
  const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isCurrentWeek = week === mondayOf(todayIn());
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  // Grouped by the day each entry happened where it was logged (decision 4), newest first.
  const groups = groupByDay(entries);
  const byDay = new Map(groups);

  // Picking a day in the strip moves to that day's heading, for sight and for screen readers.
  function showDay(date: string) {
    const heading = document.getElementById(`day-${date}`);
    heading?.closest(".day-group")?.scrollIntoView({ block: "start" });
    heading?.focus({ preventScroll: true });
  }

  return (
    <>
      <SiteHead />
      <main className="page">
        <section className="journal" aria-labelledby="week-title">
          <div className="journal-head">
            <Button
              className="icon-btn"
              aria-label={`Previous week, ${weekRange(addDays(week, -7))}`}
              onPress={() => void navigate({ search: { week: addDays(week, -7) } })}
            >
              <svg className="chevron" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M10 3.5 5.5 8 10 12.5" />
              </svg>
            </Button>
            <h1 id="week-title">{weekTitle(week)}</h1>
            <Button
              className="icon-btn"
              aria-label={`Next week, ${weekRange(addDays(week, 7))}`}
              isDisabled={isCurrentWeek}
              onPress={() => void navigate({ search: { week: addDays(week, 7) } })}
            >
              <svg className="chevron" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
            </Button>
          </div>
          <p className="journal-obs muted">{observations.join(" ")}</p>

          <ol className="week" aria-label={`Days of the week, ${weekRange(week)}`}>
            {days.map((date) => {
              const dayEntries = byDay.get(date);
              const symptom = dayEntries ? daySymptom(dayEntries) : null;
              const parts = (
                <>
                  <span className="wd-d">{formatDate(date, { weekday: "short" })}</span>
                  <span className="wd-n">{formatDate(date, { day: "numeric" })}</span>
                  <span className="wd-m">
                    <i className={symptom ? "on" : undefined} />
                  </span>
                  <span className="wd-w">{symptom ?? ""}</span>
                </>
              );
              const label = `${longDay(date)}${symptom ? `, ${symptom} mentioned` : ""}`;
              const today = date === todayIn() ? "date" : undefined;
              return (
                <li key={date}>
                  {dayEntries ? (
                    <Button
                      className="wd"
                      aria-label={label}
                      aria-current={today}
                      onPress={() => showDay(date)}
                    >
                      {parts}
                    </Button>
                  ) : (
                    // No entries, so nothing to scroll to: plain text, not a button.
                    <div className="wd" aria-current={today}>
                      {parts}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {groups.map(([date, dayEntries]) => (
            <div key={date} className="day-group">
              {/* A heading per day, so screen readers can move day to day. */}
              <h2 id={`day-${date}`} className="day-date" tabIndex={-1} aria-label={longDay(date)}>
                <span className="dd-w">{formatDate(date, { weekday: "short" })}</span>
                <span className="dd-n">{formatDate(date, { day: "numeric" })}</span>
                <span className="dd-m">{formatDate(date, { month: "short" })}</span>
              </h2>
              <div className="day-entries">
                {dayEntries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} viewerZone={viewerZone} />
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}

// The same three labeled rows on every entry, with an explicit empty value (tasks/lessons.md).
function EntryRow({ entry, viewerZone }: { entry: Entry; viewerZone: string }) {
  const none = <dd className="v none">None noted</dd>;
  return (
    <div className="entry">
      <div className="entry-time">
        <time dateTime={entry.occurredAt}>{entryTime(entry, viewerZone)}</time>
      </div>
      <dl className="fields">
        <dt className="k">Food</dt>
        {entry.food ? <dd className="v">{entry.food}</dd> : none}
        <dt className="k">Symptoms</dt>
        {entry.symptom ? (
          <dd className="v">
            {entry.symptom}
            {entry.severity && (
              <>
                {" "}
                <span className="sev-note">· Severity {entry.severity}</span>
              </>
            )}
          </dd>
        ) : (
          none
        )}
        <dt className="k">Context</dt>
        {entry.context.length > 0 ? (
          <dd className="v">
            {entry.context.map((c) => c[0]?.toUpperCase() + c.slice(1)).join(", ")}
          </dd>
        ) : (
          <dd className="v none">None</dd>
        )}
      </dl>
    </div>
  );
}

function SiteHead() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  // Leave only once the server has ended the session. Otherwise the sign-in page would see
  // the session and send the user straight back here with no explanation.
  async function signOut() {
    setError(null);
    try {
      const { error } = await authClient.signOut();
      if (error) throw error;
    } catch {
      setError("Sign-out did not work. Try again.");
      return;
    }
    await navigate({ to: "/sign-in" });
  }

  return (
    <>
      <header className="site-head">
        <span className="wordmark">Steady</span>
        <Button className="btn btn-secondary btn-sm" onPress={() => void signOut()}>
          Sign out
        </Button>
      </header>
      {error && (
        <div className="site-error">
          <FormError message={error} />
        </div>
      )}
    </>
  );
}

function LoadError(_: ErrorComponentProps) {
  const router = useRouter();
  return (
    <>
      <SiteHead />
      <main className="page">
        <div className="panel">
          <p>Your journal could not be loaded.</p>
          <Button className="btn btn-secondary" onPress={() => void router.invalidate()}>
            Try again
          </Button>
        </div>
      </main>
    </>
  );
}
