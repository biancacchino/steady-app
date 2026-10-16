import {
  createFileRoute,
  type ErrorComponentProps,
  Link,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button, ToggleButton } from "react-aria-components";

import { type CardEntry, type CardTarget, EntryCard } from "@/components/entry-card";
import { EntryFields } from "@/components/entry-fields";
import { FormError } from "@/components/fields";
import { authClient, getSession } from "@/lib/auth-client";
import { clearDraft } from "@/lib/draft";
import {
  addDays,
  daySymptom,
  entryDay,
  entryTime,
  formatDate,
  groupByDay,
  mondayOf,
  todayIn,
  weekFromSearch,
  weekRange,
  weekTitle,
} from "@/lib/week";

type Entry = CardEntry & { symptoms: string[] };
type Week = { entries: Entry[]; observations: string[] };
// Entries deleted in the last 10 seconds, all brought back by one Undo (PRD 5.2). Kept apart from
// messages, so a message never takes Undo away. `byPointer` is true when the latest Delete was
// clicked or tapped, rather than pressed with a keyboard or screen reader.
type Deleted = { entries: CardEntry[]; byPointer: boolean };
const UNDO_MS = 10_000;
const MESSAGE_MS = 4000;
const countEntries = (n: number, done: string) =>
  n === 1 ? `Entry ${done}.` : `${n} entries ${done}.`;

export const Route = createFileRoute("/journal")({
  head: () => ({ meta: [{ title: "Journal - Steady" }] }),
  // The visible week lives in the URL, so Refresh and Back keep it (decision 12).
  validateSearch: (search: Record<string, unknown>): { week?: string } =>
    typeof search.week === "string" ? { week: search.week } : {},
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) throw redirect({ to: "/sign-in" });
    return { userId: session.user.id };
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
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate({ from: "/journal" });
  const router = useRouter();
  const [target, setTarget] = useState<CardTarget | null>(null);
  // An object, so the same text shown twice still restarts its 4 seconds.
  const [message, setMessage] = useState<{ text: string } | null>(null);
  const [deleted, setDeleted] = useState<Deleted | null>(null);
  // A restored entry has a new id; its Edit button takes focus when it first renders.
  const [focusId, setFocusId] = useState<string | null>(null);
  const newEntryButton = useRef<HTMLButtonElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const restoring = useRef(false);
  // WCAG 2.2.1: Undo's 10 seconds wait while the pointer is over it, or while it has focus after a
  // keyboard or screen reader delete, and start again when they leave. Focus moved here after a
  // click does not count, or a mouse user's Undo would never go away.
  // ponytail: a mouse user who deletes, then Tabs back to Undo, gets no pause (hover still works).
  // Telling that Tab apart needs React Aria's input modality, which is not exported.
  const [undoFocused, setUndoFocused] = useState(false);
  const [undoHovered, setUndoHovered] = useState(false);
  const undoInUse = deleted !== null && ((undoFocused && !deleted.byPointer) || undoHovered);

  // A deleted entry's own button is gone, so each delete moves focus to Undo rather than the page
  // body. When Undo goes away, React Aria reports neither hover nor focus ending, so both reset here;
  // a stale hover would keep the next Undo on screen forever.
  useEffect(() => {
    if (deleted) {
      undoButton.current?.focus();
    } else {
      setUndoFocused(false);
      setUndoHovered(false);
    }
  }, [deleted]);

  // Each delete makes a new `deleted`, which restarts the 10 seconds.
  useEffect(() => {
    if (!deleted || undoInUse) return;
    const timer = setTimeout(() => {
      if (document.activeElement === undoButton.current) newEntryButton.current?.focus();
      setDeleted(null);
    }, UNDO_MS);
    return () => clearTimeout(timer);
  }, [deleted, undoInUse]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      setMessage(null);
      setFocusId(null);
    }, MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [message]);

  // After a save, show the week the entry landed in, so it never seems to vanish.
  function showSaved(entry: { occurredAt: string; timeZone: string }) {
    void navigate({ search: { week: mondayOf(entryDay(entry)) } });
    void router.invalidate();
  }

  // Undo saves each entry again with the same fields. Each gets a new id and created_at, because
  // created_at is never set by a client (PRD 5.2).
  async function undo(pending: Deleted) {
    if (restoring.current) return;
    restoring.current = true;
    const failed: CardEntry[] = [];
    let last: CardEntry | null = null;
    for (const entry of pending.entries) {
      const { occurredAt, timeZone, food, symptom, severity, context, flagged } = entry;
      try {
        const res = await fetch("/api/entries", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ occurredAt, timeZone, food, symptom, severity, context, flagged }),
        });
        if (!res.ok) throw new Error();
        last = (await res.json()) as CardEntry;
      } catch {
        failed.push(entry);
      }
    }
    restoring.current = false;
    // Only the entries this Undo handled leave the list: one deleted while it ran keeps its Undo.
    // Failed ones stay, and the new list restarts the 10 seconds, so there is time to try again.
    const handled = new Set(pending.entries.map((entry) => entry.id));
    setDeleted((current) => {
      const left = [...(current?.entries ?? []).filter((e) => !handled.has(e.id)), ...failed];
      // `current` is null when the 10 seconds ran out mid-restore; the failed entries keep how
      // their delete was pressed, so a keyboard user's focus still pauses them.
      return left.length > 0
        ? { entries: left, byPointer: current?.byPointer ?? pending.byPointer }
        : null;
    });
    if (failed.length > 0) {
      const restored = pending.entries.length - failed.length;
      const notRestored =
        failed.length === 1
          ? "1 entry could not be restored. Try again."
          : `${failed.length} entries could not be restored. Try again.`;
      // Say what did come back too, so a retry is not mistaken for redoing all of them.
      setMessage({
        text: restored > 0 ? `${countEntries(restored, "restored")} ${notRestored}` : notRestored,
      });
    } else if (last) {
      setFocusId(last.id);
      setMessage({ text: countEntries(pending.entries.length, "restored") });
    }
    if (last) showSaved(last);
  }

  const deletedText = deleted ? countEntries(deleted.entries.length, "deleted") : "";
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
            <Button
              ref={newEntryButton}
              className="btn btn-primary btn-sm new-entry"
              onPress={() => setTarget({ mode: "new" })}
            >
              New entry
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
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    viewerZone={viewerZone}
                    autoFocus={entry.id === focusId}
                    onEdit={() => setTarget({ mode: "edit", entry })}
                    onToast={(text) => setMessage({ text })}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>
      {target && (
        <EntryCard
          key={target.mode === "edit" ? target.entry.id : "new"}
          target={target}
          userId={userId}
          onClose={(keptDraft) => {
            setTarget(null);
            if (keptDraft) setMessage({ text: "Draft kept on this device." });
          }}
          onSaved={showSaved}
          onDeleted={(entry, byPointer) => {
            setDeleted((current) => ({ entries: [...(current?.entries ?? []), entry], byPointer }));
            void router.invalidate();
          }}
        />
      )}
      <div className={deleted || message ? "toast shown" : "toast"}>
        {/* Two live regions, always mounted: when the message clears, the delete count does not
            change, so a screen reader does not announce "Entry deleted." a second time. */}
        <p className="toast-text">
          <span role="status">{deletedText}</span>
          {deleted && message && " "}
          <span role="status">{message?.text}</span>
        </p>
        {deleted && (
          <Button
            ref={undoButton}
            className="toast-undo"
            onPress={() => void undo(deleted)}
            onFocusChange={setUndoFocused}
            onHoverChange={setUndoHovered}
          >
            Undo
          </Button>
        )}
      </div>
    </>
  );
}

function EntryRow({
  entry,
  viewerZone,
  autoFocus,
  onEdit,
  onToast,
}: {
  entry: Entry;
  viewerZone: string;
  autoFocus: boolean;
  onEdit: () => void;
  onToast: (message: string) => void;
}) {
  const router = useRouter();
  const [flagged, setFlagged] = useState(entry.flagged);
  const saving = useRef(false);
  const time = entryTime(entry, viewerZone);
  const when = `${longDay(entryDay(entry))} ${time}`;

  // Shown at once, put back if the save fails. One save at a time, so two quick presses
  // cannot reach the server out of order.
  async function flag(on: boolean) {
    if (saving.current) return;
    saving.current = true;
    setFlagged(on);
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flagged: on }),
      });
      if (!res.ok) throw new Error();
      onToast(on ? "Added to your appointment summary." : "Removed from your appointment summary.");
      // Keeps the loaded entry current, so Undo after a delete brings back the right flag.
      void router.invalidate();
    } catch {
      setFlagged(!on);
      onToast("Your flag could not be saved. Try again.");
    } finally {
      saving.current = false;
    }
  }

  return (
    <div className="entry">
      {/* Decision 15: one short tab stop per entry; CSS stretches it over the whole entry. */}
      <Button
        className="entry-edit"
        autoFocus={autoFocus}
        aria-label={`Edit entry, ${when}`}
        onPress={onEdit}
      />
      <div className="entry-time">
        <time dateTime={entry.occurredAt}>{time}</time>
      </div>
      <EntryFields entry={entry} />
      {/* Words and a filled icon, never color alone (design brief, "Flagging"). The visible word
          starts the name, and the time tells entries apart for screen readers. */}
      <ToggleButton
        className="chip flag"
        aria-label={`${flagged ? "Flagged" : "Flag"}, ${when}`}
        isSelected={flagged}
        onChange={(on) => void flag(on)}
      >
        <svg className="flag-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 14.5V2h8l-2 3.25L12 8.5H4" />
        </svg>
        {flagged ? "Flagged" : "Flag"}
      </ToggleButton>
    </div>
  );
}

function SiteHead() {
  const { userId } = Route.useRouteContext();
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
    // An unsaved draft must not outlive the session on a shared device (decision 14).
    clearDraft(userId);
    await navigate({ to: "/sign-in" });
  }

  return (
    <>
      <header className="site-head">
        <span className="wordmark">Steady</span>
        <div className="head-actions">
          <Link to="/summary" className="btn btn-secondary btn-sm">
            Appointment summary
          </Link>
          <Link to="/diet" className="btn btn-secondary btn-sm">
            Diet plan
          </Link>
          <Link to="/account" className="btn btn-secondary btn-sm">
            Account
          </Link>
          <Button className="btn btn-secondary btn-sm" onPress={() => void signOut()}>
            Sign out
          </Button>
        </div>
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
