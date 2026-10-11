import { createFileRoute, redirect } from "@tanstack/react-router";

import { getSession } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    throw redirect({ to: (await getSession()) ? "/journal" : "/sign-in" });
  },
});
