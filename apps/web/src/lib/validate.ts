// Checks run on submit so every problem shows at once, in the same words in every browser.
// The server checks again; these only save a round trip.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Errors = Record<string, string>;

// The privacy consent box on sign-up and on /consent. The server sets the time (packages/auth).
export const CONSENT_LABEL =
  "I agree to Steady storing my journal, summaries, and screener answers as the privacy page describes";
export const CONSENT_MISSING = "Agree to how Steady stores your data to continue.";

export function checkSignIn(v: { email: string; password: string }): Errors {
  const e: Errors = {};
  if (!v.email.trim()) e.email = "Enter your email.";
  else if (!EMAIL.test(v.email.trim())) e.email = "Enter an email like name@example.com.";
  if (!v.password) e.password = "Enter your password.";
  return e;
}

export function checkSignUp(v: {
  inviteCode: string;
  name: string;
  email: string;
  password: string;
  adult: boolean;
  consent: boolean;
}): Errors {
  const e: Errors = {};
  if (!v.inviteCode.trim()) e.inviteCode = "Enter your invite code.";
  if (!v.name.trim()) e.name = "Enter your name.";
  else if (v.name.trim().length > 100) e.name = "Use a name up to 100 characters.";
  Object.assign(e, checkSignIn(v));
  if (!v.password) e.password = "Enter a password.";
  else if (v.password.length < 8) e.password = "Use at least 8 characters.";
  if (!v.adult) e.adult = "Steady is for adults. Confirm that you are 18 or older to continue.";
  if (!v.consent) e.consent = CONSENT_MISSING;
  return e;
}
