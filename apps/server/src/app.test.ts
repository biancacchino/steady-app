import { format } from "node:util";
import { describe, expect, it, vi } from "vitest";

import { app } from "./app";

// Registered before any request: Hono refuses new routes once it has routed one.
app.get("/test-error", () => {
  throw new Error("Toast and bloating");
});

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

  it("tells browsers not to store API answers, which can hold journal text", async () => {
    const res = await app.request("/api/me");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("logs a server error without its message, which can hold journal text", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await app.request("/test-error");
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("Toast");
    // format() prints an Error the way console.error does; JSON.stringify would show {}.
    expect(log.mock.calls.map((args) => format(...args)).join("\n")).not.toContain("Toast");
    log.mockRestore();
  });
});
