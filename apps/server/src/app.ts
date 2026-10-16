import { fileURLToPath } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
import { auth } from "@steady/auth";
import { env } from "@steady/env/server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";

import { entries } from "./entries";
import { summaries } from "./summaries";

export type Variables = { user: typeof auth.$Infer.Session.user };

export const app = new Hono<{ Variables: Variables }>();

// Method, path, and status only. Never the query string or body, so no health data reaches logs.
app.use(async (c, next) => {
  const start = Date.now();
  await next();
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${Date.now() - start}ms`);
});

// The page may load nothing from other origins. `data:` images are allowed for the
// background grain, which is an inline SVG in the stylesheet.
app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  }),
);

// No request needs more than a few kilobytes yet. The limit stops one request from storing megabytes.
app.use(
  "/api/*",
  bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: "Request too large." }, 413) }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Every other API route needs a signed-in user.
app.use("/api/*", async (c, next) => {
  if (c.req.path.startsWith("/api/auth/")) return next();
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Sign in to continue." }, 401);
  c.set("user", session.user);
  return next();
});

// Never print the error itself. A database error's message includes the query's values, which can be
// journal text, and logs hold method, path, and status only.
app.onError((err, c) => {
  console.error(`${c.req.method} ${c.req.path} 500 ${err.name}`);
  return c.json({ error: "Something went wrong. Try again." }, 500);
});

app.route("/api/entries", entries);
app.route("/api/summaries", summaries);

app.get("/api/me", (c) => {
  const { id, email, name } = c.get("user");
  return c.json({ id, email, name });
});

app.all("/api/*", (c) => c.json({ error: "Not found." }, 404));

// In production the server also serves the built web app, so the site and the API share one origin.
if (env.NODE_ENV === "production") {
  const root = fileURLToPath(new URL("../../web/dist", import.meta.url));
  app.use("/*", serveStatic({ root }));
  // A missing build file is a real 404. Without this, an old tab asking for a file from a previous
  // deploy would get the app page back as HTML.
  app.all("/assets/*", (c) => c.text("Not found.", 404));
  app.get("/*", serveStatic({ root, path: "index.html" }));
}
