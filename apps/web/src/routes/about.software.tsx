import { createFileRoute } from "@tanstack/react-router";

// For people who want to see how Steady was built, mostly tech recruiters. Every claim here is
// something the repo does today; check the code before adding one.

export const Route = createFileRoute("/about/software")({
  head: () => ({ meta: [{ title: "How Steady is built - Steady" }] }),
  component: AboutSoftware,
});

function AboutSoftware() {
  return (
    <main className="land">
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">How Steady is built</h1>
        <div className="lede">
          <p>
            I'm Bianca Javier, a third-year computer science student. I built Steady end to end: the
            database, the server, the web app, the tests, and the deploy. My sister Beatrice, a
            registered nurse, brought the research and the product idea.
          </p>
          <p>
            It's a health app, so most of the work went into what it refuses to do: load anything
            from another site, write health data to logs, or share a summary you haven't read.
          </p>
        </div>
        <div className="land-actions">
          <a href="https://github.com/biancacchino/steady-app" className="btn btn-primary">
            Read the code on GitHub
          </a>
        </div>
      </section>

      <section className="land-sec" aria-labelledby="stack-title">
        <div className="sec-head">
          <h2 id="stack-title">What it's made of</h2>
          <p className="muted">One TypeScript repo with npm workspaces and Turborepo.</p>
        </div>
        <div className="items">
          <div className="item">
            <h3>The web app</h3>
            <p>
              React 19 with TanStack Router for typed routes, and React Aria Components for keyboard
              and screen reader behavior. The styling is plain CSS, and every color comes from a
              design token.
            </p>
          </div>
          <div className="item">
            <h3>The server</h3>
            <p>
              Hono on Node 24, Better-Auth for accounts, and Drizzle with Postgres 18. Every schema
              change is a committed migration. The appointment summary PDF is made on the server
              with pdfkit.
            </p>
          </div>
          <div className="item">
            <h3>Hosting</h3>
            <p>
              One Render service serves both the API and the built app, so the site and the API
              share one origin. There's no CORS to configure, and cookies stay SameSite=Lax.
              Postgres runs on Neon.
            </p>
          </div>
        </div>
      </section>

      <section className="land-sec" aria-labelledby="flow-title">
        <div className="sec-head">
          <h2 id="flow-title">What happens when you save an entry</h2>
          <p className="muted">One request, from the button to the database.</p>
        </div>
        <div className="items">
          <ol className="steps">
            <li>
              The browser sends the entry to <code>/api/entries</code> with the session cookie. Same
              origin, so nothing crosses to another site.
            </li>
            <li>
              The server checks the session. Every route except sign-in and sign-up needs one.
            </li>
            <li>
              A Zod schema checks the body: text length, allowed context values, and that the entry
              has food or a symptom. The database has the same rules as check constraints.
            </li>
            <li>
              The row is saved with the signed-in user's id. Every read, edit, and delete filters by
              that id, so one person asking for another's entry gets a 404.
            </li>
            <li>
              The log line holds the method, path, and status. It never includes the body or an
              error object, because a database error includes the query's values.
            </li>
          </ol>
        </div>
      </section>

      <section className="land-sec" aria-labelledby="decisions-title">
        <div className="sec-head">
          <h2 id="decisions-title">Decisions I'd defend</h2>
          <p className="muted">Each one is backed by a test or a server check.</p>
        </div>
        <div className="items">
          <div className="item">
            <h3>The safety rules live on the server</h3>
            <p>
              The app only decides what to show. The API refuses to export a summary you haven't
              reviewed, and it saves the exact copy you approved, so the file can't differ from what
              you read.
            </p>
          </div>
          <div className="item">
            <h3>Nothing loads from another site</h3>
            <p>
              The Content Security Policy is strict, with no exceptions. Fonts are self-hosted.
              React Aria's modal injects a style the policy blocks, so the entry card uses a native
              dialog instead. Every end-to-end test fails if the page loads another origin or hits a
              policy violation.
            </p>
          </div>
          <div className="item">
            <h3>Deleting your account deletes everything</h3>
            <p>
              Every table with your data cascades from your user row, and a test fails if a new
              table forgets to. Deleting asks for your password and a typed phrase, even on a fresh
              session.
            </p>
          </div>
          <div className="item">
            <h3>Sign-up is invite only, and hard to probe</h3>
            <p>
              The invite code is compared in constant time, before the server looks up the email, so
              the sign-up form can't be used to find out who has an account. Sign-in is rate limited
              by an address read from one trusted header.
            </p>
          </div>
        </div>
      </section>

      <section className="land-sec" aria-labelledby="tests-title">
        <div className="sec-head">
          <h2 id="tests-title">How it's tested</h2>
          <p className="muted">CI runs all of it on every pull request.</p>
        </div>
        <div className="items">
          <div className="item">
            <h3>Server tests with Vitest</h3>
            <p>
              They run against a real Postgres: ownership, validation, the review rule for
              summaries, account deletion, and the PDF.
            </p>
          </div>
          <div className="item">
            <h3>Browser tests with Playwright</h3>
            <p>
              They run in Chromium, Firefox, WebKit, and an iPhone viewport, and cover the journal
              by keyboard, 44px tap targets, reduced motion, and no sideways scroll on small
              screens.
            </p>
          </div>
          <div className="item">
            <h3>A check for wording</h3>
            <p>
              A small script reads every piece of text a user can see and fails the build if it
              sorts foods into good and bad lists, turns logging into a game, or names a condition.
              Those rules are in the product requirements.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
