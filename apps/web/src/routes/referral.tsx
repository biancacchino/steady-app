import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PageHead } from "@/components/page-head";
import { getSession } from "@/lib/auth-client";

type Referral = {
  resources: { name: string; description: string }[];
  crisis: string;
  careTeamLink: string | null;
};

export const Route = createFileRoute("/referral")({
  head: () => ({ meta: [{ title: "Who can help - Steady" }] }),
  beforeLoad: async () => {
    if (!(await getSession())) throw redirect({ to: "/sign-in" });
  },
  component: ReferralPage,
});

// Only https and mailto links are opened. The user saves the care-team link on the Account page.
const safeLink = (link: string | null) => (link && /^(https:|mailto:)/i.test(link) ? link : null);

function ReferralPage() {
  const [data, setData] = useState<Referral | null>(null);
  const [failed, setFailed] = useState(false);

  // The server logs each time this is shown (PRD 5.7). It runs here, not in the route loader, because
  // the router preloads loaders when a link is hovered, and a preload is not the page being shown.
  useEffect(() => {
    void fetch("/api/referral", { method: "POST" })
      .then((res) => (res.ok ? (res.json() as Promise<Referral>) : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const care = safeLink(data?.careTeamLink ?? null);
  return (
    <>
      <PageHead />
      <main className="page">
        <section className="panel" aria-labelledby="ref-title">
          <h1 id="ref-title">People who can help</h1>
          <p>
            Talking with someone first can make food and eating feel easier. You do not need to have
            it all figured out before you reach out.
          </p>
          {failed && <p>The list could not be loaded. Try again in a moment.</p>}
          {data && (
            <>
              <p className="notice">Placeholder list. It will be checked before launch.</p>
              <ul className="resources">
                {data.resources.map((r) => (
                  <li key={r.name}>
                    <strong>{r.name}</strong>
                    <span>{r.description}</span>
                  </li>
                ))}
              </ul>
              {care ? (
                <a className="btn btn-primary" href={care}>
                  Message your care team
                </a>
              ) : (
                <Link to="/account" className="btn btn-primary">
                  Add your care team's contact
                </Link>
              )}
              <p>{data.crisis}</p>
            </>
          )}
        </section>
      </main>
    </>
  );
}
