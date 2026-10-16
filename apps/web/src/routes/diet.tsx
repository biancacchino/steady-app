import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "react-aria-components";

import { FormError } from "@/components/fields";
import { PageHead } from "@/components/page-head";
import { getSession } from "@/lib/auth-client";
import { longDate } from "@/lib/dates";

type Step = { title: string; summary: string; from: string | null; to: string | null };
type Diet = {
  plan: { startedAt: string; eliminationEndsAt: string; status: string } | null;
  content: {
    placeholderNotice: string;
    intro: string;
    elimination: { title: string; lengthDays: number; summary: string };
    reintroduction: Step[];
  };
};
// The API gates diet content; this page only chooses what to show (PRD 5.5).
type Loaded = { kind: "plan"; diet: Diet } | { kind: "locked"; status: string };

export const Route = createFileRoute("/diet")({
  head: () => ({ meta: [{ title: "Diet plan - Steady" }] }),
  beforeLoad: async () => {
    if (!(await getSession())) throw redirect({ to: "/sign-in" });
  },
  loader: async (): Promise<Loaded> => {
    const res = await fetch("/api/diet");
    if (res.status === 401) throw redirect({ to: "/sign-in" });
    if (res.ok) return { kind: "plan", diet: (await res.json()) as Diet };
    if (res.status !== 403) throw new Error("Could not load the diet plan.");
    const screen = await fetch("/api/screening");
    if (!screen.ok) throw new Error("Could not load the diet plan.");
    return { kind: "locked", status: ((await screen.json()) as { status: string }).status };
  },
  component: DietPage,
});

function DietPage() {
  const data = Route.useLoaderData();
  return (
    <>
      <PageHead />
      <main className="page">
        {data.kind === "plan" ? <Plan diet={data.diet} /> : <Locked status={data.status} />}
      </main>
    </>
  );
}

function Locked({ status }: { status: string }) {
  if (status === "at_or_above") {
    return (
      <section className="panel" aria-labelledby="diet-title">
        <h1 id="diet-title">Let's talk this through with someone first</h1>
        <p>The diet plan is not available right now. Your journal works the same as before.</p>
        <Link to="/referral" className="btn btn-primary">
          See who can help
        </Link>
      </section>
    );
  }
  return (
    <section className="panel" aria-labelledby="diet-title">
      <h1 id="diet-title">A few questions first</h1>
      <p>
        Before the diet plan, we ask a few short questions. It takes about a minute, and your
        answers stay private.
      </p>
      <Link to="/screening" className="btn btn-primary">
        {status === "expired" ? "Answer again" : "Start the questions"}
      </Link>
    </section>
  );
}

function Plan({ diet }: { diet: Diet }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { content } = diet;
  // Set from the start request's own answer. Re-reading the page's data after the start raced with a
  // load already in flight, and about 1 run in 4 under load still showed "Start the plan".
  const [started, setStarted] = useState<NonNullable<Diet["plan"]> | null>(null);
  const plan = started ?? diet.plan;

  async function start() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/diet/start", { method: "POST" });
      if (res.status === 409) await router.invalidate();
      else if (res.ok) setStarted((await res.json()) as NonNullable<Diet["plan"]>);
      else throw new Error("start failed");
    } catch {
      setError("The plan could not be started. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="panel" aria-labelledby="diet-title">
        <p className="notice">{content.placeholderNotice}</p>
        <h1 id="diet-title">Diet plan</h1>
        <p>{content.intro}</p>
      </section>
      <section className="panel" aria-labelledby="elim-title">
        <h2 id="elim-title">{content.elimination.title}</h2>
        <p>{content.elimination.summary}</p>
        {plan ? (
          <p>
            Started {longDate(plan.startedAt)}. This phase ends on{" "}
            <strong>{longDate(plan.eliminationEndsAt)}</strong>.
          </p>
        ) : (
          <>
            <p>It lasts {content.elimination.lengthDays} days, with a fixed end date.</p>
            {error && <FormError message={error} />}
            <Button className="btn btn-primary" isDisabled={pending} onPress={() => void start()}>
              Start the plan
            </Button>
          </>
        )}
      </section>
      <section className="panel" aria-labelledby="reintro-title">
        <h2 id="reintro-title">Reintroduction</h2>
        <ol className="steps">
          {content.reintroduction.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              {step.from && step.to && (
                <span className="muted">
                  {longDate(step.from)} to {longDate(step.to)}
                </span>
              )}
              <span>{step.summary}</span>
            </li>
          ))}
        </ol>
        {!plan && <p className="muted small">Dates appear once you start the plan.</p>}
      </section>
    </>
  );
}
