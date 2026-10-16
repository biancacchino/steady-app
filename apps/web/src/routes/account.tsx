import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button, Form } from "react-aria-components";

import { Field, FormError, focusFirstError } from "@/components/fields";
import { getSession } from "@/lib/auth-client";
import { clearDraft } from "@/lib/draft";
import type { Errors } from "@/lib/validate";

// Must match DELETE_PHRASE in packages/auth/src/index.ts, which the server checks.
const PHRASE = "delete my account";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account - Steady" }] }),
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) throw redirect({ to: "/sign-in" });
    return { user: session.user };
  },
  component: Account,
});

function Account() {
  const { user } = Route.useRouteContext();
  const [deleted, setDeleted] = useState(false);

  return (
    <>
      <header className="site-head">
        {deleted ? (
          <span className="wordmark">Steady</span>
        ) : (
          <>
            <Link to="/journal" className="wordmark">
              Steady
            </Link>
            <Link to="/journal" className="btn btn-secondary btn-sm">
              Back to journal
            </Link>
          </>
        )}
      </header>
      {deleted ? (
        <Deleted />
      ) : (
        <main className="page account">
          <h1>Account</h1>
          <section className="panel" aria-labelledby="details-title">
            <h2 id="details-title">Your details</h2>
            <dl className="details">
              <dt>Name</dt>
              <dd>{user.name}</dd>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </dl>
          </section>
          <CareTeam saved={user.careTeamLink ?? null} />
          <YourData />
          <DeleteAccount
            onDeleted={() => {
              // An unsaved draft must not outlive the account on this device (decision 14).
              clearDraft(user.id);
              setDeleted(true);
            }}
          />
        </main>
      )}
    </>
  );
}

// The address or link behind "Message your care team" on the referral page (PRD 5.7). The server
// turns an email address into a mailto link and accepts nothing but https links.
function CareTeam({ saved }: { saved: string | null }) {
  const [value, setValue] = useState(saved?.replace(/^mailto:/, "") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    const res = await fetch("/api/settings/care-team", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ link: value }),
    }).catch(() => null);
    setPending(false);
    if (!res) return setError("Your care team contact was not saved. Check your connection.");
    if (res.status === 400)
      return setError("Enter an email address or a link that starts with https://.");
    if (!res.ok) return setError("Your care team contact was not saved. Try again in a moment.");
    const { link } = (await res.json()) as { link: string | null };
    setValue(link?.replace(/^mailto:/, "") ?? "");
    setMessage(link ? "Saved." : "Removed.");
  }

  return (
    <section className="panel" aria-labelledby="care-title">
      <h2 id="care-title">Your care team</h2>
      <p>
        Add an email address or a portal link. It is only used for the "Message your care team" link
        on the page that lists people who can help. Steady never sends anything to it.
      </p>
      <Form className="form" onSubmit={onSubmit}>
        <FormError message={error} />
        <Field
          label="Email address or link"
          name="careTeam"
          autoComplete="off"
          hint="Leave it empty to remove it."
          value={value}
          onChange={(v) => {
            setValue(v);
            setMessage(null);
          }}
        />
        <Button type="submit" className="btn btn-secondary" isDisabled={pending}>
          {pending ? "Saving" : "Save"}
        </Button>
        <p role="status" className="small muted">
          {message}
        </p>
      </Form>
    </section>
  );
}

// Everything Steady holds about the user, as one JSON file (PRD 7). Nothing is sent anywhere.
function YourData() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/export", { method: "POST" });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `steady-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Your file is downloading. Steady doesn't send it anywhere.");
    } catch {
      setMessage("Your data could not be downloaded. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="data-title">
      <h2 id="data-title">Your data</h2>
      <p>
        Download your profile, journal entries, summaries, screening answers, diet plan, and
        referral views as one file. It does not include your password or sign-in details.
      </p>
      <Button className="btn btn-secondary" isDisabled={pending} onPress={() => void download()}>
        {pending ? "Preparing" : "Download my data"}
      </Button>
      <p role="status" className="small muted">
        {message}
      </p>
    </section>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const edit = (field: string, set: (v: string) => void) => (v: string) => {
    set(v);
    setErrors(({ [field]: _, ...rest }) => rest);
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    const found: Errors = {};
    if (!password) found.password = "Enter your password.";
    if (confirm.trim().toLowerCase() !== PHRASE) found.confirm = `Type "${PHRASE}" to confirm.`;
    setErrors(found);
    if (Object.keys(found).length) return focusFirstError(form, found);

    setPending(true);
    // Plain fetch: the auth client's types do not know the `confirm` field.
    const res = await fetch("/api/auth/delete-user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password, confirm }),
    }).catch(() => null);
    setPending(false);
    if (!res) return setError("Your account was not deleted. Check your connection and try again.");
    if (res.ok) return onDeleted();

    const { code } = (await res.json().catch(() => ({}))) as { code?: string };
    if (code === "INVALID_PASSWORD") {
      const wrong = { password: "That password is not right." };
      setErrors(wrong);
      return focusFirstError(form, wrong);
    }
    setError(
      res.status === 429
        ? "Too many attempts. Wait a few seconds, then try again."
        : "Your account was not deleted. Try again in a moment.",
    );
  }

  return (
    <section className="panel" aria-labelledby="delete-title">
      <h2 id="delete-title">Delete your account</h2>
      <p>
        This deletes your account and every journal entry right away. You can't undo it, and you can
        sign up again with the same email afterwards.
      </p>
      <p className="small muted">Copies in database backups are removed within 30 days.</p>
      <Form
        className="form"
        onSubmit={onSubmit}
        validationErrors={errors}
        validationBehavior="aria"
      >
        <FormError message={error} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          isRequired
          value={password}
          onChange={edit("password", setPassword)}
        />
        <Field
          label={`Type "${PHRASE}"`}
          name="confirm"
          autoComplete="off"
          isRequired
          value={confirm}
          onChange={edit("confirm", setConfirm)}
        />
        <Button type="submit" className="btn btn-secondary" isDisabled={pending}>
          {pending ? "Deleting" : "Delete my account"}
        </Button>
      </Form>
    </section>
  );
}

function Deleted() {
  const heading = useRef<HTMLHeadingElement>(null);
  // The form is gone, so move focus to the result instead of leaving it on the page body.
  useEffect(() => heading.current?.focus(), []);

  return (
    <main className="page auth">
      <div className="panel">
        <h1 ref={heading} tabIndex={-1}>
          Your account is deleted
        </h1>
        <p>Your account and journal entries are gone from Steady.</p>
        <Link to="/" className="btn btn-primary">
          Back to the home page
        </Link>
      </div>
    </main>
  );
}
