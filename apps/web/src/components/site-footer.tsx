import { Link } from "@tanstack/react-router";

import {
  AboutLinks,
  AppLinks,
  SectionLinks,
  WAITLIST_EMAIL,
  WAITLIST_HREF,
} from "@/components/site-header";
import { authClient } from "@/lib/auth-client";

/** The footer on every page: the header's links again, the privacy and terms pages, the credits, and the prototype note. */
export function SiteFooter() {
  const { data, isPending } = authClient.useSession();

  return (
    <footer className="site-footer">
      <div className="site-footer-in">
        <div className="foot-cols">
          {!isPending && (
            <nav aria-labelledby="foot-steady">
              <h2 id="foot-steady" className="foot-title">
                Steady
              </h2>
              <ul className="foot-links">
                {data ? (
                  <AppLinks />
                ) : (
                  <>
                    <SectionLinks />
                    <li>
                      <Link to="/sign-in" className="nav-link">
                        Sign in
                      </Link>
                    </li>
                    <li>
                      <a href={WAITLIST_HREF} className="nav-link">
                        Join the waitlist
                      </a>
                    </li>
                  </>
                )}
              </ul>
              {/* The mailto link does nothing without a default mail app, so the address is also shown. */}
              {!data && <p className="small muted">Or email {WAITLIST_EMAIL}</p>}
            </nav>
          )}
          <nav aria-labelledby="foot-made">
            <h2 id="foot-made" className="foot-title">
              How it's made
            </h2>
            <ul className="foot-links">
              <AboutLinks />
            </ul>
          </nav>
          <nav aria-labelledby="foot-rules">
            <h2 id="foot-rules" className="foot-title">
              Your data
            </h2>
            <ul className="foot-links">
              <li>
                <Link to="/privacy" className="nav-link">
                  Privacy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="nav-link">
                  Terms
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="credits">
          <p>
            Research and product idea by{" "}
            <Link to="/about/healthcare" className="name">
              Beatrice Javier
            </Link>
          </p>
          <p>
            Software by{" "}
            <Link to="/about/software" className="name">
              Bianca Javier
            </Link>
          </p>
        </div>
        <p className="small muted">
          Steady is a prototype and a work in progress. It doesn't give medical advice.
        </p>
      </div>
    </footer>
  );
}
