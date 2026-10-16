// Fails when diet content reaches the built web app (PRD 10, non-negotiable 1).
// The content lives in apps/server/src/diet-content.ts and may only be sent by the gated API.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { dietContent } from "../apps/server/src/diet-content.ts";

/** Every string in the content that is long enough to be a phrase, not a word like "Step 1". */
export function contentStrings(value) {
  if (typeof value === "string") return value.length >= 20 ? [value] : [];
  if (value && typeof value === "object") return Object.values(value).flatMap(contentStrings);
  return [];
}

/** The strings that appear in the given text. */
export function leaks(strings, text) {
  return strings.filter((s) => text.includes(s));
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dist = process.argv[2] ?? "apps/web/dist";
  const strings = contentStrings(dietContent);
  if (strings.length === 0)
    throw new Error("No diet content strings found; the scan checks nothing.");
  let count = 0;
  for (const file of files(dist)) {
    if (!/\.(js|css|html|map|json|txt)$/.test(file)) continue;
    for (const s of leaks(strings, readFileSync(file, "utf8"))) {
      count++;
      console.error(`${file}: diet content found: "${s.slice(0, 50)}..."`);
    }
  }
  if (count) {
    console.error(`\nBundle check failed: ${count} diet content string(s) in ${dist}.`);
    process.exit(1);
  }
  console.log(`Bundle check passed: ${strings.length} diet strings, none in ${dist}.`);
}
