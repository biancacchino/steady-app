// Creates the local demo account. Development only: the password is in the repo on purpose.
import { auth } from "@steady/auth";
import { env } from "@steady/env/server";
import { APIError } from "better-auth/api";

import { isLocalDatabase } from "./local-db";

const DEMO = { name: "Test User", email: "user@example.com", password: "Password123!" };

// The risk is the database the script writes to, not the machine running it: a laptop with the
// production DATABASE_URL in .env still has NODE_ENV unset. So check the target first.
if (!isLocalDatabase(env.DATABASE_URL)) {
  console.error(
    "Refusing to seed: the DATABASE_URL database is not on this machine. The demo account is for local development only.",
  );
  process.exit(1);
}
if (env.NODE_ENV === "production") {
  console.error(
    "Refusing to seed: NODE_ENV is production. The demo account is for local development only.",
  );
  process.exit(1);
}

try {
  // Goes through Better-Auth, so the password is hashed and the 18+ hook runs like a real sign-up.
  await auth.api.signUpEmail({ body: { ...DEMO, ageConfirmedAt: new Date() } });
  console.log("Created the demo account.");
} catch (e) {
  if (!(e instanceof APIError && e.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")) throw e;
  console.log("The demo account already exists.");
}
console.log(`Sign in with ${DEMO.email} / ${DEMO.password}`);
process.exit(0);
