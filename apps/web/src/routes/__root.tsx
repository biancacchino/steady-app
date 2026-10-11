import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: "Steady" }] }),
  component: () => (
    <>
      <HeadContent />
      <Outlet />
    </>
  ),
});
