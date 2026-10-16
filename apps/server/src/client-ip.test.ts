// Which header gives the visitor's address for rate limiting (tasks/deploy.md step 4).
// On Render, X-Forwarded-For keeps whatever the visitor sent, so production reads Cloudflare's
// CF-Connecting-IP instead. Needs the local Postgres (npm run db:start).
import { afterAll, describe, expect, it, vi } from "vitest";

vi.stubEnv("CLIENT_IP_HEADER", "cf-connecting-ip");
const { app } = await import("./app");

afterAll(() => {
  vi.unstubAllEnvs();
});

const signIn = (headers: Record<string, string>) =>
  app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:5173", ...headers },
    body: JSON.stringify({ email: "nobody@example.com", password: "not-the-password" }),
  });

describe("client IP for rate limiting", () => {
  it("ignores a faked X-Forwarded-For and counts by CF-Connecting-IP", async () => {
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      const res = await signIn({
        "cf-connecting-ip": "203.0.113.7",
        "x-forwarded-for": `198.51.100.${i}`,
      });
      statuses.push(res.status);
    }
    expect(statuses.at(-1)).toBe(429);
  });

  it("gives each visitor address its own limit", async () => {
    const res = await signIn({ "cf-connecting-ip": "203.0.113.99" });
    expect(res.status).not.toBe(429);
  });
});
