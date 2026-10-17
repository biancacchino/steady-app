import { createFileRoute, Link } from "@tanstack/react-router";

import { WAITLIST_EMAIL } from "@/components/site-header";

// Every line here has to be true of the code today (docs/prd.md section 7). Check the code before
// changing a claim, and change this page in the same PR as any change to what Steady stores.
// Written to follow PIPEDA's principles; not reviewed by a lawyer yet (tasks/privacy-terms.md).

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy - Steady" }] }),
  component: Privacy,
});

function Privacy() {
  return (
    <main className="land">
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Privacy</h1>
        <div className="lede">
          <p>
            Steady holds health information, so here is exactly what it keeps, where, and what you
            can do about it. Nothing is used for anything other than running Steady for you.
          </p>
          <p className="small muted">Last updated 16 October 2026.</p>
        </div>
      </section>

      <section className="land-sec" aria-labelledby="stored-title">
        <div className="sec-head">
          <h2 id="stored-title">What Steady stores</h2>
        </div>
        <div className="items">
          <div className="item">
            <h3>Your account</h3>
            <p>
              Your name, email, and password. The password is stored scrambled (hashed), so nobody
              can read it, including us. Steady also records when you confirmed you're 18 or older
              and when you agreed to this page, and your care team's email or link if you add one.
            </p>
          </div>
          <div className="item">
            <h3>What you write</h3>
            <p>
              Your journal entries (food, symptoms, how strong they were, context, flags, and the
              time and time zone), your appointment summaries, your screener answers and which
              result they led to, your diet plan dates, and the times the referral page was shown to
              you.
            </p>
          </div>
          <div className="item">
            <h3>Signing in</h3>
            <p>
              One cookie keeps you signed in. For each sign-in, Steady stores the IP address and
              browser name, so a session can be checked and ended. There are no other cookies.
            </p>
          </div>
          <div className="item">
            <h3>On your device</h3>
            <p>
              A new entry you haven't saved yet stays in your browser's storage, so it isn't lost if
              the page closes. It's cleared when you save it or sign out.
            </p>
          </div>
        </div>
      </section>

      <section className="land-sec" aria-labelledby="not-title">
        <div className="sec-head">
          <h2 id="not-title">What Steady doesn't do</h2>
        </div>
        <div className="items">
          <div className="item">
            <p>
              No analytics, no ads, and no tracking of any kind. Pages load nothing from other
              sites, so no other company learns that you use a health app.
            </p>
            <p>
              Your data is never sold or shared. A summary reaches your doctor only when you
              download or copy it and send it yourself.
            </p>
            <p>
              Server logs hold the kind of request, the page address, and whether it worked. They
              never hold what you wrote.
            </p>
          </div>
        </div>
      </section>

      <section className="land-sec" aria-labelledby="where-title">
        <div className="sec-head">
          <h2 id="where-title">Where it's kept and who can see it</h2>
        </div>
        <div className="items">
          <div className="item">
            <p>
              Steady's server runs on Render and its database on Neon, both in Ohio, in the United
              States. Your data travels encrypted, and the database is encrypted on disk. Because
              it's stored in the US, US law applies to it there, and US authorities could lawfully
              ask for it.
            </p>
            <p>
              Render and its network provider, Cloudflare, see the traffic to Steady and keep their
              own short access logs, such as IP addresses.
            </p>
            <p>
              Bianca Javier, who builds Steady, can reach the database to keep it running. She only
              looks at account data when you ask her to fix something or to deal with a security
              problem.
            </p>
          </div>
        </div>
      </section>

      <section className="land-sec" aria-labelledby="control-title">
        <div className="sec-head">
          <h2 id="control-title">What you can do</h2>
        </div>
        <div className="items">
          <div className="item">
            <h3>See and correct it</h3>
            <p>
              You can edit or delete any entry at any time. The <Link to="/account">Account</Link>{" "}
              page downloads everything Steady holds about you as one file.
            </p>
          </div>
          <div className="item">
            <h3>Delete it</h3>
            <p>
              Deleting your account on the Account page removes your account and everything in it
              right away. Copies in database backups are removed within 30 days. This is also how
              you take back your consent.
            </p>
          </div>
          <div className="item">
            <h3>Ask or complain</h3>
            <p>
              Bianca Javier is responsible for privacy at Steady. Email {WAITLIST_EMAIL} with any
              question or concern. If you aren't happy with the answer, you can complain to the
              Office of the Privacy Commissioner of Canada at{" "}
              <a href="https://www.priv.gc.ca">priv.gc.ca</a>.
            </p>
          </div>
        </div>
      </section>

      <section className="land-sec" aria-labelledby="wrong-title">
        <div className="sec-head">
          <h2 id="wrong-title">If something goes wrong or changes</h2>
        </div>
        <div className="items">
          <div className="item">
            <p>
              If someone gets at your data who shouldn't, and it could harm you, we'll email you as
              soon as we can, tell you what happened, and report it to the Privacy Commissioner.
            </p>
            <p>
              If this page changes in a way that affects your data, we'll email you and ask you to
              agree again before the change applies to you.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
