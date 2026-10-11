import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button, Form } from "react-aria-components";

import { Field, FormError, focusFirstError } from "@/components/fields";
import { authClient, getSession } from "@/lib/auth-client";
import { checkSignIn, type Errors } from "@/lib/validate";

export const Route = createFileRoute("/sign-in")({
  head: () => ({ meta: [{ title: "Sign in - Steady" }] }),
  beforeLoad: async () => {
    if (await getSession()) throw redirect({ to: "/journal" });
  },
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    const found = checkSignIn({ email, password });
    setErrors(found);
    if (Object.keys(found).length) return focusFirstError(e.currentTarget, found);
    setPending(true);
    const { error } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many attempts. Wait a few seconds, then try again."
          : error.status === 401
            ? "That email and password do not match an account."
            : "Sign-in did not work. Try again in a moment.",
      );
      return;
    }
    await navigate({ to: "/journal" });
  }

  return (
    <main className="page auth">
      <div className="panel">
        <h1>Sign in</h1>
        <Form
          className="form"
          onSubmit={onSubmit}
          validationErrors={errors}
          validationBehavior="aria"
        >
          <FormError message={error} />
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
            autoComplete="current-password"
            isRequired
            value={password}
            onChange={edit("password", setPassword)}
          />
          <Button type="submit" className="btn btn-primary" isDisabled={pending}>
            {pending ? "Signing in" : "Sign in"}
          </Button>
        </Form>
        <p className="small muted">
          New to Steady? <Link to="/sign-up">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
