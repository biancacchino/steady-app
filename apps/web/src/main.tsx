import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/site.css";
import "./styles/landing.css";
import "./styles/summary.css";
import "./styles/screening.css";

import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import { routeTree } from "./routeTree.gen";

const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app");
if (!rootElement) throw new Error("Root element not found");
ReactDOM.createRoot(rootElement).render(<RouterProvider router={router} />);
