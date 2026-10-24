#!/usr/bin/env node
/**
 * Briitely OS button standard (README → "Buttons and icons"):
 * - Add / Create / New buttons show the Plus icon.
 * - Edit buttons show the Pencil icon and name what they edit ("Edit Event Details", never just "Edit").
 * - List row actions (className={rowAction}) stay text-only so rows line up.
 *
 * Run: npm run check:ui
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

// The text a person reads on the button: JSX tags, {expressions} and extra spaces removed.
function labelOf(inner) {
  let text = inner;
  for (let i = 0; i < 4; i++) text = text.replace(/\{[^{}]*\}/g, " ");
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const problems = [];
for (const file of files(SRC)) {
  const text = readFileSync(file, "utf8");
  // Attributes may hold {expressions} with "=>" or nested braces, so braces are matched before ">" ends the tag.
  const attr = String.raw`(?:[^>{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*`;
  const pattern = new RegExp(String.raw`<(Button|button|Link)\b(${attr})>([\s\S]*?)<\/\1>`, "g");
  for (const match of text.matchAll(pattern)) {
    const [, , attrs, inner] = match;
    const label = labelOf(inner);
    const line = text.slice(0, match.index).split("\n").length;
    // Examples in code comments aren't buttons.
    if (/^\s*(\*|\/\/)/.test(text.split("\n")[line - 1])) continue;
    const where = `${relative(ROOT, file)}:${line}`;
    const rowAction = /rowAction/.test(attrs);
    if (/^(Add|Create|New)\b/.test(label) && !rowAction && !/<Plus\b/.test(inner)) problems.push(`${where}  "${label}" needs the Plus icon`);
    if (/^Edit$/.test(label)) problems.push(`${where}  "Edit" must name what it edits`);
    if (/^Edit\b/.test(label) && !rowAction && !/<Pencil\b/.test(inner)) problems.push(`${where}  "${label}" needs the Pencil icon`);
    if (rowAction && /<[A-Z][A-Za-z]*\s[^>]*className="h-4 w-4"/.test(inner)) problems.push(`${where}  row action "${label}" should be text-only`);
    if (/>\s*\+\s*[A-Z]/.test(inner)) problems.push(`${where}  "${label}" uses a typed "+"; use the Plus icon`);
  }
}

if (problems.length) {
  console.log(`Button standard: ${problems.length} to fix\n` + problems.join("\n"));
  process.exit(1);
}
console.log("Button standard: all Add, Create, New and Edit buttons follow the standard.");
