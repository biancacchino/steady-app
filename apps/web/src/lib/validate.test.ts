import { describe, expect, it } from "vitest";

import { checkSignIn, checkSignUp } from "./validate";

describe("checkSignUp", () => {
  it("reports every missing field at once, in form order", () => {
    const e = checkSignUp({ name: "", email: "", password: "", adult: false });
    expect(Object.keys(e)).toEqual(["name", "email", "password", "adult"]);
  });

  it("accepts a complete form", () => {
    const e = checkSignUp({
      name: "Maya",
      email: "maya@example.com",
      password: "12345678",
      adult: true,
    });
    expect(e).toEqual({});
  });

  it("explains a short password and a malformed email", () => {
    const e = checkSignUp({ name: "Maya", email: "maya@", password: "short", adult: true });
    expect(e).toEqual({
      email: "Enter an email like name@example.com.",
      password: "Use at least 8 characters.",
    });
  });
});

describe("checkSignUp name length", () => {
  it("matches the server's 100-character limit", () => {
    const base = { email: "maya@example.com", password: "12345678", adult: true };
    expect(checkSignUp({ ...base, name: "N".repeat(100) })).toEqual({});
    expect(checkSignUp({ ...base, name: "N".repeat(101) }).name).toBe(
      "Use a name up to 100 characters.",
    );
  });
});

describe("checkSignIn", () => {
  it("does not apply the new-password length rule to existing passwords", () => {
    expect(checkSignIn({ email: "maya@example.com", password: "short" })).toEqual({});
  });
});
