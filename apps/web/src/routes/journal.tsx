import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "react-aria-components";

import { FormError } from "@/components/fields";

import { authClient, getSession } from "@/lib/auth-client";

export const Route = createFileRoute("/journal")({
  head: () => ({ meta: [{ title: "Journal - Steady" }] }),
  beforeLoad: async () => {
    if (!(await getSession())) throw redirect({ to: "/sign-in" });
  },
  component: Journal,
});

function Journal() {
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
      <main className="page">
        <h1>Your journal</h1>
        <FormError message={error} />
        <p className="muted">Your journal starts here.</p>
      </main>
    </>
  );
}
