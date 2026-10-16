import {
  createFileRoute,
  type ErrorComponentProps,
  Link,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import { Button, Input, Label, TextField } from "react-aria-components";

import type { CardEntry } from "@/components/entry-card";
import { EntryFields } from "@/components/entry-fields";
import { getSession } from "@/lib/auth-client";
import { entryTime, formatDate, groupByDay, todayIn } from "@/lib/week";

type Preview = {
  from: string;
  to: string;
  observations: string[];
  flagged: CardEntry[];
  questions: string[];
};
type Snapshot = {
  observations: string[];
  flagged: { day: string; time: string; food: string; symptom: string }[];
  questions: string[];
};
const MAX_QUESTIONS = 4;
const MESSAGE_MS = 4000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const Route = createFileRoute("/summary")({
  head: () => ({ meta: [{ title: "Appointment summary - Steady" }] }),
  // The range lives in the URL, like the journal's week, so Refresh and Back keep it.
  validateSearch: (search: Record<string, unknown>): { from?: string; to?: string } => ({
    ...(typeof search.from === "string" ? { from: search.from } : {}),
    ...(typeof search.to === "string" ? { to: search.to } : {}),
  }),
  beforeLoad: async () => {
    if (!(await getSession())) throw redirect({ to: "/sign-in" });
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const today = todayIn();
    const ask = (params: Record<string, string>) =>
      fetch(`/api/summaries/preview?${new URLSearchParams(params)}`);
    const to = deps.to && deps.to <= today ? deps.to : today;
    let res = await ask(deps.from ? { from: deps.from, to } : { to });
    // A broken range in the URL falls back to the default one instead of an error.
    if (res.status === 400) res = await ask({ to: today });
    if (res.status === 401) throw redirect({ to: "/sign-in" });
    if (!res.ok) throw new Error("Could not load the summary.");
    return { today, ...((await res.json()) as Preview) };
  },
  component: Summary,
  errorComponent: LoadError,
});

const longDay = (date: string) =>
  formatDate(date, { weekday: "long", day: "numeric", month: "long" });

function Summary() {
  const data = Route.useLoaderData();
  const navigate = useNavigate({ from: "/summary" });
  const [from, setFrom] = useState(data.from);
  const [to, setTo] = useState(data.to);
  // Kept across range changes: the provider and the date do not depend on the range.
  const [provider, setProvider] = useState("");
  const [appointment, setAppointment] = useState("");

  // Only a complete, ordered range up to today changes the URL (and reloads the preview).
  function setRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (DATE.test(nextFrom) && DATE.test(nextTo) && nextFrom <= nextTo && nextTo <= data.today) {
      void navigate({ search: { from: nextFrom, to: nextTo } });
    }
  }

  return (
    <>
      <header className="site-head">
        <span className="wordmark">Steady</span>
        <Link to="/journal" className="btn btn-secondary btn-sm">
          Back to journal
        </Link>
      </header>
      <main className="page">
        <section className="sum-setup" aria-labelledby="setup-title">
          <h1 id="setup-title">Get ready for your appointment</h1>
          <div className="when">
            <TextField className="field" type="date" value={from} onChange={(v) => setRange(v, to)}>
              <Label className="label">From</Label>
              <Input className="input" max={to} />
            </TextField>
            <TextField className="field" type="date" value={to} onChange={(v) => setRange(from, v)}>
              <Label className="label">To</Label>
              <Input className="input" min={from} max={data.today} />
            </TextField>
          </div>
          <div className="sum-inputs">
            <TextField className="field" value={provider} onChange={setProvider} maxLength={100}>
              <Label className="label">For (optional)</Label>
              <Input className="input" />
            </TextField>
            <TextField className="field" type="date" value={appointment} onChange={setAppointment}>
              <Label className="label">Appointment (optional)</Label>
              <Input className="input" />
            </TextField>
          </div>
        </section>
        {/* A new range starts a new summary, so the entries left out and the questions reset. */}
        <Sheet
          key={`${data.from}/${data.to}`}
          preview={data}
          provider={provider}
          appointment={appointment}
        />
      </main>
    </>
  );
}

function Sheet({
  preview,
  provider,
  appointment,
}: {
  preview: Preview;
  provider: string;
  appointment: string;
}) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [questions, setQuestions] = useState(preview.questions);
  const [seen, setSeen] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  // What the server says for the current choices: the PDF preview, the counts without left-out
  // entries, and fresh suggestions. Replaces the first load's values once it arrives.
  const [live, setLive] = useState<{
    header: string[];
    snapshot: Snapshot;
    suggested: string[];
  } | null>(null);
  const [edited, setEdited] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string } | null>(null);
  const flagsEnd = useRef<HTMLDivElement>(null);
  const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const choices = {
    from: preview.from,
    to: preview.to,
    providerName: provider.trim() || null,
    appointmentDate: DATE.test(appointment) ? appointment : null,
    excludedEntryIds: [...excluded],
    questions,
  };
  const body = JSON.stringify(choices);

  // PRD 5.4 and the design brief: export stays disabled until Worth flagging has been on screen,
  // so the only way to export runs through the review. The API refuses unreviewed exports too.
  useEffect(() => {
    const end = flagsEnd.current;
    if (!end) return;
    const observer = new IntersectionObserver((seenEntries) => {
      if (seenEntries.some((e) => e.isIntersecting)) {
        setSeen(true);
        observer.disconnect();
      }
    });
    observer.observe(end);
    return () => observer.disconnect();
  }, []);

  // Built by the same code as the export, so the screen, the preview, and the file agree.
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/summaries/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: abort.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(setLive)
      .catch(() => {});
    return () => abort.abort();
  }, [body]);

  // Suggested questions follow the choices until the user edits one; then they are the user's.
  useEffect(() => {
    if (live && !edited && live.suggested.join("\n") !== questions.join("\n")) {
      setQuestions(live.suggested);
    }
  }, [live, edited, questions]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [message]);

  // Save the choices, mark them reviewed, then export the saved snapshot (PRD 5.4).
  async function reviewed(kind: "pdf" | "text"): Promise<Response> {
    const post = (path: string, data?: string) =>
      fetch(path, {
        method: "POST",
        headers: data ? { "content-type": "application/json" } : {},
        body: data,
      });
    const created = await post("/api/summaries", body);
    if (!created.ok) throw new Error();
    const { id } = (await created.json()) as { id: string };
    if (!(await post(`/api/summaries/${id}/review`)).ok) throw new Error();
    const res = await post(`/api/summaries/${id}/${kind}`);
    if (!res.ok) throw new Error();
    return res;
  }

  async function exportPdf() {
    setPending(true);
    try {
      const res = await reviewed("pdf");
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `appointment-summary-${preview.to}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({ text: "Your PDF is downloading. Steady doesn't send it anywhere." });
    } catch {
      setMessage({ text: "Your summary could not be exported. Try again." });
    } finally {
      setPending(false);
    }
  }

  async function copyText() {
    setPending(true);
    try {
      // The text is passed as a promise so the copy keeps the click's permission while the
      // summary is saved, which Safari requires.
      const text = reviewed("text").then(
        async (res) => new Blob([await res.text()], { type: "text/plain" }),
      );
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": text })]);
      setMessage({ text: "Copied. Paste it wherever you share it." });
    } catch {
      setMessage({ text: "Your summary could not be copied. Try again." });
    } finally {
      setPending(false);
    }
  }

  const groups = groupByDay(preview.flagged);
  const period =
    preview.from === preview.to
      ? formatDate(preview.from, { day: "numeric", month: "long", year: "numeric" })
      : `${formatDate(preview.from, { day: "numeric", month: "long" })} to ${formatDate(preview.to, { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <>
      <article className="sheet" aria-labelledby="sum-title">
        <div className="sum-head">
          <h2 className="title" id="sum-title">
            Appointment summary
          </h2>
          <dl className="fields sum-meta">
            {choices.providerName && (
              <>
                <dt className="k">For</dt>
                <dd className="v">{choices.providerName}</dd>
              </>
            )}
            <dt className="k">Period</dt>
            <dd className="v">{period}</dd>
            {choices.appointmentDate && (
              <>
                <dt className="k">Appointment</dt>
                <dd className="v">{longDay(choices.appointmentDate)}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="part">
          <h3>Pattern observed</h3>
          {(live?.snapshot.observations ?? preview.observations).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        <div className="part">
          <h3>Worth flagging</h3>
          <p className="small muted">
            Entries you flagged in your journal. Untick Include to leave one out of this summary.
          </p>
          <div className="flags">
            {groups.length === 0 && (
              <p className="flags-empty">No flagged entries in this period.</p>
            )}
            {groups.map(([date, dayEntries]) => (
              <div key={date} className="day-group">
                <h4 className="day-date" aria-label={longDay(date)}>
                  <span className="dd-w">{formatDate(date, { weekday: "short" })}</span>
                  <span className="dd-n">{formatDate(date, { day: "numeric" })}</span>
                  <span className="dd-m">{formatDate(date, { month: "short" })}</span>
                </h4>
                <div className="day-entries">
                  {dayEntries.map((entry) => {
                    const time = entryTime(entry, viewerZone);
                    const included = !excluded.has(entry.id);
                    return (
                      <div key={entry.id} className="entry">
                        <div className="entry-time">
                          <time dateTime={entry.occurredAt}>{time}</time>
                        </div>
                        <EntryFields entry={entry} />
                        {/* Words and a checkmark, never color alone (PRD 7). */}
                        <label className="incl">
                          <input
                            type="checkbox"
                            checked={included}
                            aria-label={`Include, ${longDay(date)} ${time}`}
                            onChange={(e) => {
                              const next = new Set(excluded);
                              if (e.target.checked) next.delete(entry.id);
                              else next.add(entry.id);
                              setExcluded(next);
                            }}
                          />
                          Include
                        </label>
                        <p className="excl-note">
                          Left out of this summary. Still in your journal.
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div ref={flagsEnd} aria-hidden="true" />
        </div>

        <div className="part">
          <h3>Questions to bring</h3>
          <p className="small muted">
            Edit them in place or add your own. Empty ones are left out.
          </p>
          <ul className="qs">
            {questions.map((q, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: questions are edited in place by position.
              <li key={i}>
                <textarea
                  className="q-input"
                  rows={1}
                  maxLength={300}
                  aria-label={`Question ${i + 1}`}
                  value={q}
                  onChange={(e) => {
                    setEdited(true);
                    setQuestions(questions.map((x, j) => (j === i ? e.target.value : x)));
                  }}
                />
              </li>
            ))}
          </ul>
          {questions.length < MAX_QUESTIONS && (
            <div>
              <Button
                className="btn btn-secondary btn-sm"
                onPress={() => {
                  setEdited(true);
                  setQuestions([...questions, ""]);
                }}
              >
                Add a question
              </Button>
            </div>
          )}
        </div>

        <div className="export">
          <Button
            className="btn btn-primary"
            isDisabled={!seen || pending}
            aria-describedby={seen ? undefined : "export-hint"}
            onPress={() => void exportPdf()}
          >
            Reviewed, export PDF
          </Button>
          {seen ? (
            <>
              <Button
                className="btn btn-secondary"
                isDisabled={pending}
                onPress={() => void copyText()}
              >
                Copy as text
              </Button>
              <Button
                className="btn btn-secondary pdf-toggle"
                aria-expanded={showPdf}
                aria-controls="pdf-body"
                onPress={() => setShowPdf(!showPdf)}
              >
                {showPdf ? "Hide PDF preview" : "Show PDF preview"}
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </Button>
            </>
          ) : (
            <span id="export-hint" className="small muted">
              Read through Worth flagging to continue.
            </span>
          )}
        </div>
        <div className="pdf-body" id="pdf-body" hidden={!showPdf}>
          <p className="muted">
            This is what "Reviewed, export PDF" gives your provider. Only included entries and
            filled-in questions appear.
          </p>
          {live && <Paper header={live.header} snapshot={live.snapshot} />}
        </div>
      </article>
      <div className={message ? "toast shown" : "toast"}>
        <p className="toast-text">
          <span role="status">{message?.text}</span>
        </p>
      </div>
    </>
  );
}

// The compact list the PDF holds, on white paper even in dark mode (design brief).
function Paper({ header, snapshot }: { header: string[]; snapshot: Snapshot }) {
  return (
    <div className="paper" role="document" aria-label="PDF preview">
      <h4>Appointment summary</h4>
      <dl className="p-meta">
        {header.map((line) => {
          const [k, ...v] = line.split(": ");
          return (
            <Fragment key={line}>
              <dt>{k}</dt>
              <dd>{v.join(": ")}</dd>
            </Fragment>
          );
        })}
      </dl>
      <div>
        <h5>Pattern observed</h5>
        {snapshot.observations.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <div>
        <h5>Worth flagging</h5>
        {snapshot.flagged.length === 0 ? (
          <p className="none">No flagged entries in this period.</p>
        ) : (
          <ul className="p-list">
            {snapshot.flagged.map((f) => (
              <li key={`${f.day} ${f.time} ${f.food}`} className="p-row">
                <span>
                  {f.day}, {f.time}
                </span>
                <dl className="p-fields">
                  <dt>Food</dt>
                  <dd>{f.food}</dd>
                  <dt>Symptoms</dt>
                  <dd>{f.symptom}</dd>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h5>Questions to bring</h5>
        <ol className="p-q">
          {snapshot.questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function LoadError(_: ErrorComponentProps) {
  const router = useRouter();
  return (
    <main className="page">
      <div className="panel">
        <p>Your summary could not be loaded.</p>
        <Button className="btn btn-secondary" onPress={() => void router.invalidate()}>
          Try again
        </Button>
      </div>
    </main>
  );
}
