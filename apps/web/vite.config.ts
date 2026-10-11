import path from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tanstackRouter({}), react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    // The browser only ever talks to this origin; /api is forwarded to the Hono server.
    proxy: { "/api": { target: "http://localhost:3000", xfwd: true } },
  },
  // Keep every asset a real file, never an inline data: URL, so the CSP can stay strict.
  build: { assetsInlineLimit: 0 },
});
