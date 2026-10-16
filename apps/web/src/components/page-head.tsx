import { Link } from "@tanstack/react-router";

/** The header for pages reached from the journal: the wordmark and a way back. */
export function PageHead() {
  return (
    <header className="site-head">
      <Link to="/journal" className="wordmark">
        Steady
      </Link>
      <Link to="/journal" className="btn btn-secondary btn-sm">
        Back to journal
      </Link>
    </header>
  );
}
