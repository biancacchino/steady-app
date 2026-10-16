import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    // The address people open in the browser. The web app and the API share it,
    // so sign-in cookies stay first-party (SameSite=Lax) and no CORS is needed.
    // In production it must be https, so session cookies are marked Secure. Localhost is allowed
    // because the end-to-end tests run the production build on http://localhost:3100.
    BETTER_AUTH_URL: z
      .url()
      .refine(
        (url) =>
          process.env.NODE_ENV !== "production" ||
          url.startsWith("https://") ||
          ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
        "BETTER_AUTH_URL must use https in production.",
      ),
    // Sign-up is invite only: the shared code people need to create an account.
    // At least 16 characters, so it cannot be guessed within the sign-up rate limit.
    INVITE_CODE: z.string().min(16),
    PORT: z.coerce.number().int().default(3000),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
