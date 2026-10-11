// Fails when user-facing text uses wording banned by docs/prd.md section 10.
// It reads only what a user can see: string literals, template text, and JSX text.
// The TypeScript parser finds those exactly, so comments and code names such as
// `DialogTrigger` or `catch (cause)` are never checked.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

export const BANNED = [
  [/\beating disorders?\b/i, "never name a diagnosis"],
  [/\bdiagnos\w*/i, "never diagnose"],
  [/\byou have\b/i, "no statements about what the user has"],
  [/\bsafe foods?\b/i, "no safe or trigger food labels"],
  [/\btrigger\w*/i, "no safe or trigger food labels"],
  [/\bstreaks?\b/i, "no gamification"],
  [/\bpoints?\b/i, "no gamification"],
  [/\bcalori\w*/i, "no calories, weight, or portions"],
  [/\bcaused?\b/i, "no cause-and-effect claims"],
];

/** User-facing text in a source file, as [line, text] pairs. */
export function visibleText(source, fileName = "file.tsx") {
  const kind = /\.[jt]sx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const out = [];
  const visit = (node) => {
    const isText =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      (ts.isJsxText(node) && !node.containsOnlyTriviaWhiteSpaces);
    if (isText) {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
      out.push([line + 1, node.text.trim()]);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

export function findToneIssues(source, fileName = "file.tsx") {
  const issues = [];
  for (const [line, text] of visibleText(source, fileName)) {
    for (const [pattern, why] of BANNED) {
      const hit = text.match(pattern);
      if (hit) issues.push({ line, word: hit[0], why, text });
    }
  }
  return issues;
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|jsx?)$/.test(name) && !name.endsWith(".gen.ts") ? [path] : [];
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Every folder whose text can reach a user: the web app, and the server's error messages.
  const dirs = process.argv.length > 2 ? process.argv.slice(2) : ["apps/web/src"];
  let count = 0;
  for (const file of dirs.flatMap(files)) {
    for (const i of findToneIssues(readFileSync(file, "utf8"), file)) {
      count++;
      console.error(`${file}:${i.line}  "${i.word}" (${i.why}): ${i.text}`);
    }
  }
  if (count) {
    console.error(`\nTone check failed: ${count} issue(s). See docs/prd.md section 10.`);
    process.exit(1);
  }
  console.log(`Tone check passed for ${dirs.join(", ")}.`);
}
