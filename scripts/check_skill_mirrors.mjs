import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

const codexRoot = join(repoRoot, ".codex", "skills");
const opencodeRoot = join(repoRoot, ".opencode", "skills");

function listFilesRecursive(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) {
        stack.push(p);
      } else if (ent.isFile()) {
        out.push(p);
      }
    }
  }
  return out;
}

function readText(p) {
  return readFileSync(p, "utf8");
}

function existsDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

if (!existsDir(codexRoot) || !existsDir(opencodeRoot)) {
  console.error("Missing .codex/skills or .opencode/skills; cannot compare.");
  process.exit(2);
}

const codexFiles = listFilesRecursive(codexRoot)
  .map((p) => relative(codexRoot, p))
  .sort();
const opencodeFiles = listFilesRecursive(opencodeRoot)
  .map((p) => relative(opencodeRoot, p))
  .sort();

const codexSet = new Set(codexFiles);
const opencodeSet = new Set(opencodeFiles);

const missingInOpencode = codexFiles.filter((p) => !opencodeSet.has(p));
const missingInCodex = opencodeFiles.filter((p) => !codexSet.has(p));

const changed = [];
for (const relPath of codexFiles) {
  if (!opencodeSet.has(relPath)) continue;
  const a = readText(join(codexRoot, relPath));
  const b = readText(join(opencodeRoot, relPath));
  if (a !== b) changed.push(relPath);
}

if (missingInOpencode.length || missingInCodex.length || changed.length) {
  console.error("Skill mirror mismatch detected between .codex/skills and .opencode/skills.");
  if (missingInOpencode.length) {
    console.error("Missing in .opencode/skills:");
    for (const p of missingInOpencode) console.error(`- ${p}`);
  }
  if (missingInCodex.length) {
    console.error("Missing in .codex/skills:");
    for (const p of missingInCodex) console.error(`- ${p}`);
  }
  if (changed.length) {
    console.error("Different content:");
    for (const p of changed) console.error(`- ${p}`);
  }
  process.exit(1);
}

console.log("OK: .codex/skills and .opencode/skills are identical.");
