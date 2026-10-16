import { createFileRoute, Link } from "@tanstack/react-router";

import { getSession } from "@/lib/auth-client";

// The landing page is for everyone. Only the hero actions depend on the session.
// Sign-up is invite only, so visitors without a code ask by email. Nothing is stored in Steady.
const WAITLIST_EMAIL = "steadyappjournal@gmail.com";

export const Route = createFileRoute("/")({
  loader: async () => ({ signedIn: Boolean(await getSession()) }),
  component: Landing,
});

function Landing() {
  const { signedIn } = Route.useLoaderData();

  return (
    <>
      <header className="site-head land-head">
        <span className="wordmark">Steady</span>
      </header>
      <main className="land">
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">
            An IBS journal that asks how you feel about food before it asks you to cut anything out.
          </h1>
          <div className="lede">
            <p>
              Steady is an early version of an IBS app. It's built so cutting foods is never the
              first step, and so your provider gets a clear picture of what changed.
            </p>
            <p>
              The food and symptom journal works today. The appointment summary and the food
              check-in come next.
            </p>
          </div>
          <div className="land-actions">
            {signedIn ? (
              <Link to="/journal" className="btn btn-primary">
                Open your journal
              </Link>
            ) : (
              <>
                <a
                  href={`mailto:${WAITLIST_EMAIL}?subject=Steady%20waitlist`}
                  className="btn btn-primary"
                >
                  Join the waitlist
                </a>
                <Link to="/sign-in" className="btn btn-secondary">
                  Sign in
                </Link>
              </>
            )}
          </div>
          {/* The mailto link does nothing without a default mail app, so the address is also shown. */}
          {!signedIn && <p className="muted">Or email {WAITLIST_EMAIL}</p>}
        </section>

        <section className="land-sec" aria-labelledby="why-title">
          <div className="sec-head">
            <h2 id="why-title">Why Steady exists</h2>
            <p className="muted">Steady started from two problems.</p>
          </div>
          <div className="items">
            <div className="item">
              <h3>Elimination diets can help, and can also backfire</h3>
              <p>
                Low-FODMAP and similar elimination diets ease symptoms for many people with IBS.
                Reintroduction, testing one food group at a time, is also where worry about a food
                can harden into avoiding it for good. That overlaps with disordered eating, so
                screening has to come before any restriction starts.
              </p>
            </div>
            <div className="item">
              <h3>Changing symptoms don't fit a short visit</h3>
              <p>
                A provider with 12 minutes doesn't have time to scroll through weeks of a raw diary.
                A short summary helps more. It shows what changed and what you flagged, so you can
                hand it over instead of trying to remember it all.
              </p>
            </div>
          </div>
        </section>

        <section className="land-sec" aria-labelledby="how-title">
          <div className="sec-head">
            <h2 id="how-title">How Steady handles it</h2>
            <p className="muted">
              Here's how Steady answers each one. The journal works today, and the other two parts
              are next.
            </p>
          </div>
          <div className="items">
            <div className="item">
              <h3>Log food and symptoms in plain words</h3>
              <p>
                Write what you ate and any symptoms, and add context like stress, travel, sleep, or
                your cycle. Severity is optional: low, medium, or high. Flag any entry you want to
                bring up at your next appointment. Each week shows a few plain sentences, like "3 of
                5 logged days mentioned bloating." There are no scores, colors, or food rankings,
                and nothing asks you to track every sensation. This part works today.
              </p>
              <SampleEntry />
            </div>
            <div className="item">
              <h3>A check-in comes before any diet advice</h3>
              <p>
                A short questionnaire runs before Steady shows any elimination-diet content. You
                never see a score, just what happens next. If the answers suggest talking it through
                first, diet content stays hidden and Steady recommends talking with a doctor or
                dietitian. Until a clinical advisor picks a licensed questionnaire, such as SCOFF or
                NIAS, the questions are placeholders and say so. The journal keeps working whatever
                the answers are. This part comes after the summary.
              </p>
            </div>
            <div className="item">
              <h3>Review your summary before you share it</h3>
              <p>
                You pick a date range and build a one-page summary from your journal: what was
                observed, the entries you flagged, and up to four questions to bring. You read it
                through and leave out anything you don't want to share. Only then can you export it.
                Steady never sends it anywhere; you download or copy it and share it yourself. This
                part is coming next.
              </p>
            </div>
          </div>
        </section>

        <section className="land-sec" aria-labelledby="source-title">
          <div className="sec-head">
            <h2 id="source-title">Where this is coming from</h2>
            <p className="muted">
              Steady started with research by Beatrice Javier, a nurse practitioner. Each design
              choice traces back to her sources.
            </p>
          </div>
          <div className="items">
            <div className="item">
              <h3>Elimination diets carry a known risk of disordered eating.</h3>
              <p>
                Low-FODMAP and similar diets help many people with IBS, and the guidance that
                supports them also says to screen for eating concerns before starting one.
                Reintroduction, more than the first cut, is when avoiding a food tends to settle in.
              </p>
            </div>
            <div className="item">
              <h3>
                Tested questionnaires exist, so Steady will adapt one instead of inventing its own.
              </h3>
              <p>
                Candidates include SCOFF, a short general screen, and NIAS, which looks at food
                avoidance and fear. A qualified clinical advisor will choose one and confirm its
                license. Until then, Steady's questions are placeholders.
              </p>
            </div>
            <div className="item">
              <h3>A short visit can't hold weeks of changing symptoms.</h3>
              <p>
                A one-page summary of what was observed, the entries you flagged, and your questions
                is much easier to get through in a 12-minute visit than a raw log.
              </p>
            </div>
            <div className="item">
              <h3>This is a prototype, not a clinical tool.</h3>
              <p>
                The screening questions and thresholds are placeholders. A real version needs a
                licensed questionnaire and clinical oversight before it reaches anyone. Steady does
                not claim HIPAA compliance. It has no analytics and no ads.
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="land-foot">
        <div className="land-foot-in">
          <div className="credits">
            <p>
              Research and product idea by <span className="name">Beatrice Javier</span>
            </p>
            <p>
              Software by <span className="name">Bianca Javier</span>
            </p>
          </div>
          <p className="small muted">Steady is a prototype and a work in progress.</p>
        </div>
      </footer>
    </>
  );
}

// A static copy of one journal entry: the same markup and class names as the journal's entry
// rows (date column, time, Food / Symptoms / Context), with nothing to press.
function SampleEntry() {
  return (
    <figure className="sample">
      <div className="sample-panel">
        <div className="day-group">
          <div className="day-date">
            <span className="dd-w">Tue</span>
            <span className="dd-n">13</span>
            <span className="dd-m">Oct</span>
          </div>
          <div className="day-entries">
            <div className="entry">
              <div className="entry-time">
                <time dateTime="12:30">12:30</time>
              </div>
              <dl className="fields">
                <dt className="k">Food</dt>
                <dd className="v">Leftover pasta with pesto, sparkling water</dd>
                <dt className="k">Symptoms</dt>
                <dd className="v">
                  Bloating in the afternoon <span className="sev-note">· Severity medium</span>
                </dd>
                <dt className="k">Context</dt>
                <dd className="v none">None noted</dd>
              </dl>
              <span className="chip flag">
                <svg className="flag-icon" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 14.5V2h8l-2 3.25L12 8.5H4" />
                </svg>
                Flag
              </span>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="small muted">A made-up entry, shown for this page only.</figcaption>
    </figure>
  );
}
