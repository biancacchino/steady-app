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
