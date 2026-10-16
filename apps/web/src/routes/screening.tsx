import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button, Radio, RadioGroup } from "react-aria-components";

import { FormError } from "@/components/fields";
import { PageHead } from "@/components/page-head";
import { getSession } from "@/lib/auth-client";
import { longDate } from "@/lib/dates";

type Question = { id: string; text: string; options: { label: string }[] };
type Status = {
  status: "none" | "expired" | "below" | "at_or_above";
  canTake: boolean;
  retakeAt?: string;
  instrument?: { id: string; version: number; isPlaceholder: boolean; questions: Question[] };
};
type Outcome = "below" | "at_or_above";

export const Route = createFileRoute("/screening")({
  head: () => ({ meta: [{ title: "A few questions - Steady" }] }),
  beforeLoad: async () => {
    if (!(await getSession())) throw redirect({ to: "/sign-in" });
  },
  loader: async () => {
    const res = await fetch("/api/screening");
    if (res.status === 401) throw redirect({ to: "/sign-in" });
    if (!res.ok) throw new Error("Could not load the questions.");
    return (await res.json()) as Status;
  },
  component: Screening,
});

const PLACEHOLDER = "Placeholder questions, not a clinical screen";

function Screening() {
  const status = Route.useLoaderData();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  return (
    <>
      <PageHead />
      <main className="page">
        {outcome ? (
          <Outcome outcome={outcome} />
        ) : status.canTake && status.instrument ? (
          <Flow instrument={status.instrument} onDone={setOutcome} />
        ) : (
          <Locked retakeAt={status.retakeAt} />
        )}
      </main>
    </>
  );
}

// Shown to someone whose last answers point to talking with a person first. The page does not
// name a result or a score (PRD 5.5), and the journal keeps working.
function Locked({ retakeAt }: { retakeAt?: string }) {
  return (
    <section className="panel" aria-labelledby="locked-title">
      <h1 id="locked-title">Let's talk this through with someone first</h1>
      <p>
        Your last answers suggest it would help to talk with a doctor or dietitian before changing
        how you eat. Your journal and appointment summaries work the same as before.
      </p>
      {retakeAt && <p className="muted">You can answer these again on {longDate(retakeAt)}.</p>}
      <Link to="/referral" className="btn btn-primary">
        See who can help
      </Link>
    </section>
  );
}

function Outcome({ outcome }: { outcome: Outcome }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return outcome === "below" ? (
    <section className="panel" aria-labelledby="done-title">
      <h1 id="done-title" ref={heading} tabIndex={-1}>
        Thank you for answering
      </h1>
      <p>Your answers are saved. The diet plan is now available.</p>
      <Link to="/diet" className="btn btn-primary">
        Go to the diet plan
      </Link>
    </section>
  ) : (
    <section className="panel" aria-labelledby="done-title">
      <h1 id="done-title" ref={heading} tabIndex={-1}>
        Let's talk this through with someone first
      </h1>
      <p>
        Your answers suggest it would help to talk with a doctor or dietitian before changing how
        you eat. Your journal and appointment summaries work the same as before.
      </p>
      <Link to="/referral" className="btn btn-primary">
        See who can help
      </Link>
    </section>
  );
}

function Flow({
  instrument,
  onDone,
}: {
  instrument: NonNullable<Status["instrument"]>;
  onDone: (outcome: Outcome) => void;
}) {
  const { questions } = instrument;
  // 0 to n-1 are the questions, n is the review step.
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const reviewing = step === questions.length;
  const question = questions[step];
  const current = answers[step];

  // A new screen starts at its heading, so a screen reader announces the new question.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the step is the trigger
  useEffect(() => heading.current?.focus(), [step]);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/screening", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instrumentId: instrument.id,
          instrumentVersion: instrument.version,
          answers,
        }),
      });
      if (res.status === 401) {
        window.location.assign("/sign-in");
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Your answers could not be saved. Try again.");
        return;
      }
      onDone(((await res.json()) as { status: Outcome }).status);
    } catch {
      setError("Your answers could not be saved. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel screen" aria-labelledby="step-title">
      {instrument.isPlaceholder && <p className="notice">{PLACEHOLDER}</p>}
      {reviewing ? (
        <>
          <h1 id="step-title" ref={heading} tabIndex={-1}>
            Check your answers
          </h1>
          <ol className="review">
            {questions.map((q, i) => (
              <li key={q.id}>
                <span>{q.text}</span>
                <strong>{q.options[answers[i] as number]?.label}</strong>
                <Button className="btn btn-secondary btn-sm" onPress={() => setStep(i)}>
                  Change<span className="sr-only"> answer to: {q.text}</span>
                </Button>
              </li>
            ))}
          </ol>
          {error && <FormError message={error} />}
          <div className="screen-actions">
            <Button className="btn btn-secondary" onPress={() => setStep(step - 1)}>
              Back
            </Button>
            <Button className="btn btn-primary" isDisabled={pending} onPress={() => void submit()}>
              {pending ? "Saving" : "Submit answers"}
            </Button>
          </div>
        </>
      ) : (
        question && (
          <>
            <h1 id="step-title" ref={heading} tabIndex={-1}>
              {question.text}
            </h1>
            <RadioGroup
              aria-labelledby="step-title"
              className="choices"
              value={current === null || current === undefined ? null : String(current)}
              onChange={(v) => setAnswers(answers.map((a, i) => (i === step ? Number(v) : a)))}
            >
              {question.options.map((o, i) => (
                <Radio key={o.label} value={String(i)} className="choice">
                  {o.label}
                </Radio>
              ))}
            </RadioGroup>
            <div className="screen-actions">
              {step > 0 && (
                <Button className="btn btn-secondary" onPress={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              <Button
                className="btn btn-primary"
                isDisabled={current === null}
                onPress={() => setStep(step + 1)}
              >
                Continue
              </Button>
              <span className="muted small">
                Question {step + 1} of {questions.length}
              </span>
            </div>
          </>
        )
      )}
    </section>
  );
}
