import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button, Form } from "react-aria-components";

import { CheckField, FormError, focusFirstError } from "@/components/fields";
import { getSession } from "@/lib/auth-client";
import { CONSENT_LABEL, CONSENT_MISSING, type Errors } from "@/lib/validate";

// Shown once to accounts made before sign-up asked for privacy consent. The API holds their data
// routes until they agree (apps/server/src/app.ts); export and deletion stay open either way.

export const Route = createFileRoute("/consent")({
  head: () => ({ meta: [{ title: "How Steady stores your data - Steady" }] }),
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) throw redirect({ to: "/sign-in" });
    if (session.user.privacyConsentAt) throw redirect({ to: "/journal" });
  },
  component: Consent,
});

function Consent() {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const found: Errors = agreed ? {} : { consent: CONSENT_MISSING };
    setErrors(found);
    if (!agreed) return focusFirstError(e.currentTarget, found);
    setPending(true);
    const res = await fetch("/api/consent", { method: "POST" }).catch(() => null);
    setPending(false);
    if (!res?.ok) {
      setError("That didn't save. Try again.");
      return;
    }
    await navigate({ to: "/journal" });
  }

  return (
    <main className="page auth">
      <div className="panel">
        <h1>How Steady stores your data</h1>
        <p>
          Steady now has a <Link to="/privacy">privacy page</Link> and{" "}
          <Link to="/terms">terms</Link>. Your journal stays the same, and nothing new is collected.
          Before you keep using it, please read them and agree.
        </p>
        <Form
          className="form"
          onSubmit={onSubmit}
          validationErrors={errors}
          validationBehavior="aria"
        >
          <FormError message={error} />
          <CheckField
            name="consent"
            isSelected={agreed}
            onChange={(v) => {
              setAgreed(v);
              if (v) setErrors({});
            }}
            error={errors.consent}
          >
            {CONSENT_LABEL}
          </CheckField>
          <Button type="submit" className="btn btn-primary" isDisabled={pending}>
            {pending ? "Saving" : "Continue"}
          </Button>
        </Form>
        <p className="small muted">
          Rather not? You can download your data or delete your account on the{" "}
          <Link to="/account">Account page</Link>.
        </p>
      </div>
    </main>
  );
}
