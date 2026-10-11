import { describe, expect, it } from "vitest";

import { isLocalDatabase } from "./local-db";

describe("isLocalDatabase", () => {
  it("accepts databases on this machine", () => {
    expect(isLocalDatabase("postgresql://localhost:5432/steady")).toBe(true);
    expect(isLocalDatabase("postgresql://127.0.0.1:5432/steady")).toBe(true);
    expect(isLocalDatabase("postgresql://[::1]:5432/steady")).toBe(true);
  });

  it("refuses any other host, including look-alikes", () => {
    expect(isLocalDatabase("postgresql://db.example.com:5432/steady")).toBe(false);
    expect(isLocalDatabase("postgresql://localhost.example.com:5432/steady")).toBe(false);
    expect(isLocalDatabase("not a url")).toBe(false);
  });
});
