import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button, Form } from "react-aria-components";

import { CheckField, Field, FormError, focusFirstError } from "@/components/fields";
import { authClient, getSession } from "@/lib/auth-client";
import { checkSignUp, type Errors } from "@/lib/validate";

export const Route = createFileRoute("/sign-up")({
  head: () => ({ meta: [{ title: "Create an account - Steady" }] }),
  beforeLoad: async () => {
    if (await getSession()) throw redirect({ to: "/journal" });
  },
  component: SignUp,
});

function SignUp() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const edit = (field: string, set: (v: string) => void) => (v: string) => {
    set(v);
    setErrors(({ [field]: _, ...rest }) => rest);
  };
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const found = checkSignUp({ name, email, password, adult });
    setErrors(found);
    if (Object.keys(found).length) return focusFirstError(e.currentTarget, found);
    setPending(true);
    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
      ageConfirmedAt: new Date(),
    });
    setPending(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many attempts. Wait a few seconds, then try again."
          : error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "An account with this email already exists. Sign in instead."
            : (error.message ?? "Your account could not be created. Try again."),
      );
      return;
    }
    await navigate({ to: "/journal" });
  }

  return (
    <main className="page auth">
      <div className="panel">
        <h1>Create your account</h1>
        <Form
          className="form"
          onSubmit={onSubmit}
          validationErrors={errors}
          validationBehavior="aria"
        >
          <FormError message={error} />
          <Field
            label="Your name"
            name="name"
            autoComplete="name"
            isRequired
            hint="Shown on summaries you export for your appointments."
            value={name}
            onChange={edit("name", setName)}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            isRequired
            value={email}
            onChange={edit("email", setEmail)}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            isRequired
            hint="At least 8 characters."
            value={password}
            onChange={edit("password", setPassword)}
          />
          <CheckField
            name="adult"
            isSelected={adult}
            onChange={(v) => {
              setAdult(v);
              if (v) setErrors(({ adult: _, ...rest }) => rest);
            }}
            error={errors.adult}
          >
            I am 18 or older
          </CheckField>
          <Button type="submit" className="btn btn-primary" isDisabled={pending}>
            {pending ? "Creating account" : "Create account"}
          </Button>
        </Form>
        <p className="small muted">
          Already have an account? <Link to="/sign-in">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
