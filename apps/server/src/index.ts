import { serve } from "@hono/node-server";
import { env } from "@steady/env/server";

import { app } from "./app";

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Steady server on http://localhost:${info.port}`);
});
