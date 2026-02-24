#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const TARGETS = [
  {
    root: 'docs',
    title: 'docs',
    fix: 'node scripts/ops/obsidian_docs_migrate.mjs --root docs --phase all --apply',
  },
  {
    root: 'docs-shared',
    title: 'docs-shared',
    fix: 'node scripts/ops/obsidian_docs_migrate.mjs --root docs-shared --project dongyuapp --apply',
  },
];

function shouldCheck(rootDir) {
  return fs.existsSync(path.resolve(rootDir));
}

function runAudit(rootDir) {
  try {
    const out = execFileSync('node', ['scripts/ops/obsidian_docs_audit.mjs', '--root', rootDir, '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, data: JSON.parse(out) };
  } catch (err) {
    const detail = err && err.stderr ? String(err.stderr).trim() : String(err && err.message ? err.message : err);
    return { ok: false, detail };
  }
}

function collectBlockingReasons(data) {
  const reasons = [];
  if (data.withoutFrontmatter > 0) reasons.push(`without_frontmatter=${data.withoutFrontmatter}`);
  if (data.missingRequired > 0) reasons.push(`missing_required_frontmatter_docs=${data.missingRequired}`);
  if (data.withMarkdownMdLink > 0) reasons.push(`with_markdown_md_links_docs=${data.withMarkdownMdLink}`);
  if (data.withBareMdPath > 0) reasons.push(`with_bare_md_paths_docs=${data.withBareMdPath}`);
  return reasons;
}

function printFailure(title, reasons, sample, fixCommand) {
  console.error(`[obsidian-gate] ${title} FAILED`);
  for (const reason of reasons) {
    console.error(`  - ${reason}`);
  }
  const noFrontmatter = Array.isArray(sample && sample.noFrontmatter) ? sample.noFrontmatter.slice(0, 5) : [];
  const markdownMdLink = Array.isArray(sample && sample.markdownMdLink) ? sample.markdownMdLink.slice(0, 5) : [];
  const bareMdPath = Array.isArray(sample && sample.bareMdPath) ? sample.bareMdPath.slice(0, 5) : [];
  if (noFrontmatter.length > 0) console.error(`  - sample no_frontmatter: ${noFrontmatter.join(', ')}`);
  if (markdownMdLink.length > 0) console.error(`  - sample markdown_md_link: ${markdownMdLink.join(', ')}`);
  if (bareMdPath.length > 0) console.error(`  - sample bare_md_path: ${bareMdPath.join(', ')}`);
  console.error(`  - fix command: ${fixCommand}`);
}

function main() {
  if (process.env.SKIP_OBSIDIAN_DOCS_AUDIT === '1') return;

  for (const target of TARGETS) {
    if (!shouldCheck(target.root)) continue;

    const result = runAudit(target.root);
    if (!result.ok) {
      console.error(`[obsidian-gate] ${target.title} audit execution failed`);
      console.error(result.detail);
      process.exit(1);
    }

    const reasons = collectBlockingReasons(result.data);
    if (reasons.length > 0) {
      printFailure(target.title, reasons, result.data.samples, target.fix);
      process.exit(1);
    }
  }
}

main();
