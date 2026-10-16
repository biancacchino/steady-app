import { createFileRoute, Link } from "@tanstack/react-router";

// The healthcare side of Steady, for recruiters and clinicians. Beatrice Javier, RN, writes this
// page; until her text arrives it only says so. Don't write clinical content here for her.

export const Route = createFileRoute("/about/healthcare")({
  head: () => ({ meta: [{ title: "The healthcare side of Steady - Steady" }] }),
  component: AboutHealthcare,
});

function AboutHealthcare() {
  return (
    <main className="land">
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">The healthcare side of Steady</h1>
        <div className="lede">
          <p>
            My sister, Beatrice Javier, RN, brought the research and the product idea behind Steady.
            She's writing this page herself, so it's short for now.
          </p>
          <p>Until it's ready, the home page lists the sources each design choice comes from.</p>
        </div>
        <div className="land-actions">
          <Link to="/" hash="source-title" className="btn btn-primary">
            See where Steady comes from
          </Link>
        </div>
      </section>
    </main>
  );
}
