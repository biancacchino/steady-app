import assert from "node:assert/strict";
import { test } from "node:test";

import { findToneIssues } from "./check-tone.mjs";

test("tone: passes neutral, descriptive text", () => {
  const src = `<p className="muted">3 of 7 logged days mentioned bloating.</p>`;
  assert.deepEqual(findToneIssues(src), []);
});

test("tone: flags banned words in JSX text and strings", () => {
  const words = findToneIssues(`
    <p>This food is a trigger for you.</p>
    const msg = "You have an eating disorder";
    toast(\`3 day streak!\`);
  `).map((i) => i.word.toLowerCase());
  assert.deepEqual(words.sort(), ["eating disorder", "streak", "trigger", "you have"]);
});

test("tone: flags banned words in JSX text around a {value}", () => {
  const words = findToneIssues("<p>You logged {n} trigger foods</p>").map((i) =>
    i.word.toLowerCase(),
  );
  assert.deepEqual(words, ["trigger"]);
});

test("tone: reads text after a URL on the same line", () => {
  const jsx = findToneIssues('<a href="https://help.example.com">Log your trigger foods</a>');
  const str = findToneIssues('const tip = "See https://example.com for trigger foods";');
  assert.deepEqual(
    jsx.map((i) => i.word),
    ["trigger"],
  );
  assert.deepEqual(
    str.map((i) => i.word),
    ["trigger"],
  );
});

test("tone: reads text that contains a spaced //", () => {
  const jsx = findToneIssues("<p>Breakfast // lunch trigger list</p>");
  const str = findToneIssues('const s = "Use A // B as a trigger";');
  assert.deepEqual(
    jsx.map((i) => i.word),
    ["trigger"],
  );
  assert.deepEqual(
    str.map((i) => i.word),
    ["trigger"],
  );
});

test("tone: ignores plain code that sits between > and {", () => {
  const src = `
    try { run(); } catch (cause) { report(cause); }
    if (total > points) { go(); }
  `;
  assert.deepEqual(findToneIssues(src, "code.ts"), []);
});

test("tone: reports the line of the problem", () => {
  const src = 'const a = 1;\n// a note about calories\nconst msg = "Your streak";';
  assert.deepEqual(
    findToneIssues(src).map((i) => i.line),
    [3],
  );
});

test("tone: ignores code names and comments", () => {
  const src = `
    import { DialogTrigger } from "react-aria-components";
    // a comment about calories is fine
    <DialogTrigger><Button>Open</Button></DialogTrigger>
  `;
  assert.deepEqual(findToneIssues(src), []);
});

test("bundle: finds diet content in a bundle and passes a clean one", async () => {
  const { contentStrings, leaks } = await import("./check-bundle.mjs");
  const strings = contentStrings({ a: "Short", b: ["A phrase that is long enough to count"] });
  assert.deepEqual(strings, ["A phrase that is long enough to count"]);
  assert.deepEqual(leaks(strings, "x();A phrase that is long enough to count;y()"), strings);
  assert.deepEqual(leaks(strings, "const unrelated = 1;"), []);
});
