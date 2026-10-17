import { createFileRoute, Link } from "@tanstack/react-router";

import { WAITLIST_EMAIL } from "@/components/site-header";

// Plain terms for the invite-only beta. Not reviewed by a lawyer yet (tasks/privacy-terms.md).
// The medical paragraph waits on Beatrice's wording; don't add clinical detail to it.

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms - Steady" }] }),
  component: Terms,
});

function Terms() {
  return (
    <main className="land">
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Terms</h1>
        <div className="lede">
          <p>
            Steady is a free, invite-only test version made by Bianca and Beatrice Javier. These are
            the ground rules for using it.
          </p>
          <p className="small muted">Last updated 16 October 2026.</p>
        </div>
      </section>

      <section className="land-sec" aria-labelledby="medical-title">
        <div className="sec-head">
          <h2 id="medical-title">Steady isn't medical care</h2>
        </div>
        <div className="items">
          <div className="item">
            <p>
              Steady is a journal. It can't tell you what's causing your symptoms or how to treat
              them, and it doesn't give medical advice. Its questions and diet information don't
              replace a doctor or dietitian. If your symptoms are severe or they worry you, contact
              a doctor. In an emergency, call 911.
            </p>
          </div>
        </div>
      </section>

      <section className="land-sec" aria-labelledby="who-title">
        <div className="sec-head">
          <h2 id="who-title">Who can use it</h2>
        </div>
        <div className="items">
          <div className="item">
            <p>
              You need to be 18 or older and have an invite. Keep your password to yourself, and use
              Steady only for your own journal. Don't try to get into other accounts or break the
              service.
            </p>
          </div>
        </div>
      </section>

      <section className="land-sec" aria-labelledby="yours-title">
        <div className="sec-head">
          <h2 id="yours-title">Your data is yours</h2>
        </div>
        <div className="items">
          <div className="item">
            <p>
              You own what you write. Steady uses it only to run the app for you, as the{" "}
              <Link to="/privacy">privacy page</Link> describes. You can download it or delete it on
              the <Link to="/account">Account</Link> page at any time.
            </p>
          </div>
        </div>
      </section>

      <section className="land-sec" aria-labelledby="test-title">
        <div className="sec-head">
          <h2 id="test-title">It's a test version</h2>
        </div>
        <div className="items">
          <div className="item">
            <p>
              Steady may have bugs, go down, or change. Download a copy of anything you'd hate to
              lose. It's free and offered as is, and as far as the law allows, we aren't responsible
              for losses that come from using it.
            </p>
            <p>
              If we end the test, we'll email you at least 30 days ahead so you can download your
              data, and then delete everything. If an account breaks these terms, we'll tell you
              before closing it, and you can still download your data first.
            </p>
          </div>
        </div>
      </section>

      <section className="land-sec" aria-labelledby="changes-title">
        <div className="sec-head">
          <h2 id="changes-title">Changes and questions</h2>
        </div>
        <div className="items">
          <div className="item">
            <p>
              If these terms change, we'll email you before the change applies. The laws of Ontario
              and Canada apply to them. Questions go to {WAITLIST_EMAIL}.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
