import { Link, useNavigate } from "@tanstack/react-router";
import { type KeyboardEvent, type MouseEvent, useEffect, useId, useRef, useState } from "react";
import { Button } from "react-aria-components";

import { FormError } from "@/components/fields";
import { authClient } from "@/lib/auth-client";
import { clearDraft } from "@/lib/draft";

// Sign-up is invite only, so visitors without a code ask by email. Nothing is stored in Steady.
export const WAITLIST_EMAIL = "steadyappjournal@gmail.com";
export const WAITLIST_HREF = `mailto:${WAITLIST_EMAIL}?subject=Steady%20waitlist`;

/**
 * The header on every page. Signed out, it offers the waitlist and sign in; signed in, the app's
 * pages and sign out. Nothing session-specific shows until the session is known, so the wrong
 * button never flashes.
 */
export function SiteHeader() {
  const { data, isPending } = authClient.useSession();
  const navigate = useNavigate();
  const menu = useDisclosure();
  const [error, setError] = useState<string | null>(null);

  // Leave only once the server has ended the session. Otherwise the sign-in page would see
  // the session and send the user straight back with no explanation.
  async function signOut(userId: string) {
    setError(null);
    try {
      const { error } = await authClient.signOut();
      if (error) throw error;
    } catch {
      setError("Sign-out did not work. Try again.");
      return;
    }
    // An unsaved draft must not outlive the session on a shared device (decision 14).
    clearDraft(userId);
    await navigate({ to: "/sign-in" });
  }

  return (
    <>
      <header className="site-header">
        <div className="site-header-in">
          <Link to="/" className="wordmark" activeOptions={{ exact: true }}>
            Steady
          </Link>
          {/* On narrow screens the links sit behind Menu; on wide ones Menu is hidden. */}
          <div className="nav-wrap" {...menu.root}>
            <Button className="btn btn-secondary btn-sm menu-btn" {...menu.button}>
              Menu
            </Button>
            <nav
              id={menu.id}
              className="site-nav"
              aria-label="Main"
              data-open={menu.open || undefined}
            >
              {!isPending && (
                <>
                  <ul className="nav-links">
                    {data ? <AppLinks /> : <SectionLinks />}
                    <li>
                      <HowItsMade />
                    </li>
                  </ul>
                  <div className="nav-actions">
                    {data ? (
                      <Button
                        className="btn btn-secondary btn-sm"
                        onPress={() => void signOut(data.user.id)}
                      >
                        Sign out
                      </Button>
                    ) : (
                      <>
                        <Link to="/sign-in" className="btn btn-secondary btn-sm">
                          Sign in
                        </Link>
                        <a href={WAITLIST_HREF} className="btn btn-primary btn-sm">
                          Join the waitlist
                        </a>
                      </>
                    )}
                  </div>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>
      {error && (
        <div className="site-error">
          <FormError message={error} />
        </div>
      )}
    </>
  );
}

/** The app's pages, shared with the footer. TanStack's Link marks the current one aria-current. */
export function AppLinks() {
  return (
    <>
      <li>
        <Link to="/journal" className="nav-link">
          Journal
        </Link>
      </li>
      <li>
        <Link to="/summary" className="nav-link">
          Appointment summary
        </Link>
      </li>
      <li>
        <Link to="/diet" className="nav-link">
          Diet plan
        </Link>
      </li>
      <li>
        <Link to="/account" className="nav-link">
          Account
        </Link>
      </li>
    </>
  );
}

/** The landing page's sections, shared with the footer. */
export function SectionLinks() {
  const exact = { exact: true, includeHash: true };
  return (
    <>
      <li>
        <Link to="/" hash="why-title" activeOptions={exact} className="nav-link">
          Why Steady
        </Link>
      </li>
      <li>
        <Link to="/" hash="how-title" activeOptions={exact} className="nav-link">
          How it works
        </Link>
      </li>
    </>
  );
}

export function AboutLinks() {
  return (
    <>
      <li>
        <Link to="/about/healthcare" className="nav-link">
          Healthcare perspective
        </Link>
      </li>
      <li>
        <Link to="/about/software" className="nav-link">
          Software perspective
        </Link>
      </li>
    </>
  );
}

function HowItsMade() {
  const made = useDisclosure();
  return (
    <div className="made" {...made.root}>
      <Button className="nav-link made-btn" {...made.button}>
        How it's made
        <svg className="chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </Button>
      <ul id={made.id} className="made-list" hidden={!made.open}>
        <AboutLinks />
      </ul>
    </div>
  );
}

/**
 * A button that shows and hides a list of links (the APG disclosure navigation pattern, not an
 * ARIA menu). It closes on Esc, returning focus to the button, on a press outside, and when one
 * of its links is followed. Esc closes only the innermost one, so a second Esc closes Menu.
 */
function useDisclosure() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return {
    open,
    id,
    root: {
      ref: rootRef,
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key !== "Escape" || !open) return;
        e.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      },
      onClick: (e: MouseEvent) => {
        if ((e.target as Element).closest("a")) setOpen(false);
      },
    },
    button: {
      ref: buttonRef,
      "aria-expanded": open,
      "aria-controls": id,
      onPress: () => setOpen((o) => !o),
    },
  };
}
