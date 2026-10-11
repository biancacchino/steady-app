import { describe, expect, it } from "vitest";

import { app } from "./app";

describe("server", () => {
  it("rejects signed-out API requests with 401", async () => {
    const res = await app.request("/api/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in to continue." });
  });

  it("rejects signed-out requests to unknown API routes before revealing they do not exist", async () => {
    const res = await app.request("/api/anything");
    expect(res.status).toBe(401);
  });

  it("sends a Content Security Policy that allows only this origin", async () => {
    const res = await app.request("/api/me");
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/https?:\/\//);
  });
});
