import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@steady/db";
import * as schema from "@steady/db/schema/auth";
import { env } from "@steady/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";

const MAX_NAME_LENGTH = 100;

// Hashing first gives both sides the same length, so the comparison takes the same time whatever
// was typed and leaks nothing about the code.
const digest = (text: string) => createHash("sha256").update(text).digest();
const isInviteCode = (code: unknown) =>
  typeof code === "string" && timingSafeEqual(digest(code), digest(env.INVITE_CODE));

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  // transaction: Better-Auth's sign-up writes the user, the password account, and the session.
  // The adapter's default runs them as three separate commits, so a failure part way left a user
  // who could not sign in, and each commit waited on its own disk flush, which under load kept
  // sign-up pending past 5 seconds. One transaction makes it all-or-nothing with one flush.
  // Trade-off: the transaction holds a pool connection while the password hashes (about 80ms).
  database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
  // Must match apps/web/src/lib/validate.ts. e2e/auth.spec.ts fails if the server side drifts.
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  user: {
    additionalFields: {
      // The browser sends a date only when the 18+ box is ticked.
      // The hooks below set the server's own time and keep it from being changed later.
      ageConfirmedAt: { type: "date", required: true, input: true },
      careTeamLink: { type: "string", required: false, input: false },
    },
  },
  // Sign-up is invite only (tasks/deploy.md). This runs before Better-Auth looks up the email, so
  // without the code nobody can learn whether an email already has an account.
  // ponytail: one shared code; single-use codes in the database if it leaks or many people use it.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" && !isInviteCode(ctx.body?.inviteCode)) {
        throw new APIError("FORBIDDEN", {
          message: "That invite code doesn't work. Check it and try again.",
        });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!user.ageConfirmedAt) {
            throw new APIError("BAD_REQUEST", { message: "Confirm that you are 18 or older." });
          }
          const name = user.name.trim();
          if (!name || name.length > MAX_NAME_LENGTH) {
            throw new APIError("BAD_REQUEST", {
              message: `Use a name between 1 and ${MAX_NAME_LENGTH} characters.`,
            });
          }
          return { data: { ...user, name, ageConfirmedAt: new Date() } };
        },
      },
      update: {
        // The confirmation time records when the user confirmed, so it never changes after sign-up.
        // Refuse instead of dropping the field: Better-Auth merges a hook's data over the original
        // update (with-hooks.mjs), so leaving the field out of the returned data does not remove it.
        before: async (data) => {
          if ("ageConfirmedAt" in data) {
            throw new APIError("BAD_REQUEST", {
              message: "The age confirmation cannot be changed.",
            });
          }
        },
      },
    },
  },
  // On in every environment, not only production (Better-Auth's default).
  // Sign-in and sign-up allow 3 attempts per 10 seconds per IP.
  // ponytail: in-memory store, resets on restart and is per server process; move to the
  // database store if Steady ever runs more than one server.
  // Deploy blocker: set advanced.ipAddress.trustedProxies to the host's proxy range (tasks/todo.md).
  rateLimit: { enabled: true },
});
