import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: "Steady" }] }),
  component: () => (
    <>
      <HeadContent />
      {/* The header repeats on every page, so keyboard users can jump past it (WCAG 2.4.1). */}
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <div id="content" tabIndex={-1}>
        <Outlet />
      </div>
      <SiteFooter />
    </>
  ),
});
