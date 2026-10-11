// Checks run on submit so every problem shows at once, in the same words in every browser.
// The server checks again; these only save a round trip.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Errors = Record<string, string>;

export function checkSignIn(v: { email: string; password: string }): Errors {
  const e: Errors = {};
  if (!v.email.trim()) e.email = "Enter your email.";
  else if (!EMAIL.test(v.email.trim())) e.email = "Enter an email like name@example.com.";
  if (!v.password) e.password = "Enter your password.";
  return e;
}

export function checkSignUp(v: {
  name: string;
  email: string;
  password: string;
  adult: boolean;
}): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = "Enter your name.";
  else if (v.name.trim().length > 100) e.name = "Use a name up to 100 characters.";
  Object.assign(e, checkSignIn(v));
  if (!v.password) e.password = "Enter a password.";
  else if (v.password.length < 8) e.password = "Use at least 8 characters.";
  if (!v.adult) e.adult = "Steady is for adults. Confirm that you are 18 or older to continue.";
  return e;
}
