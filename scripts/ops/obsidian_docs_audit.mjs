#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.log(`Usage:\n  node scripts/ops/obsidian_docs_audit.mjs [options]\n\nOptions:\n  --root <dir>        Docs root (default: docs)\n  --json              Output JSON only\n  -h, --help          Show help`);
}

function collectMarkdownFiles(rootDir) {
  const out = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) out.push(abs);
    }
  }
  walk(rootDir);
  return out;
}

function splitFrontmatter(raw) {
  const text = raw.replace(/^\uFEFF/, '');
  if (!text.startsWith('---\n')) return { hasFrontmatter: false, frontmatter: '', body: text };
  const end = text.indexOf('\n---\n', 4);
  if (end < 0) return { hasFrontmatter: false, frontmatter: '', body: text };
  return {
    hasFrontmatter: true,
    frontmatter: text.slice(4, end),
    body: text.slice(end + 5),
  };
}

function hasField(fm, key) {
  return new RegExp(`^${key}:\\s*`, 'm').test(fm);
}

function stripCodeFences(body) {
  return body.replace(/```[\s\S]*?```/g, '');
}

function stripInlineCode(body) {
  return body.replace(/`[^`\n]+`/g, '');
}

function stripWikilinks(body) {
  return body.replace(/\[\[[^\]]+\]\]/g, '');
}

function audit(root) {
  const rootAbs = path.resolve(root);
  const files = collectMarkdownFiles(rootAbs);
  const isSharedRoot = path.basename(rootAbs) === 'docs-shared';
  const required = isSharedRoot
    ? ['title', 'status', 'updated', 'source', 'project']
    : ['title', 'doc_type', 'status', 'updated', 'source'];

  const out = {
    root: rootAbs,
    sharedRoot: isSharedRoot,
    total: files.length,
    withFrontmatter: 0,
    withoutFrontmatter: 0,
    missingRequired: 0,
    missingByField: Object.fromEntries(required.map((k) => [k, 0])),
    withWikilink: 0,
    withMarkdownMdLink: 0,
    withBareMdPath: 0,
    samples: {
      noFrontmatter: [],
      missingRequired: [],
      markdownMdLink: [],
      bareMdPath: [],
    },
  };

  for (const abs of files) {
    const rel = path.relative(rootAbs, abs).replaceAll('\\', '/');
    const raw = fs.readFileSync(abs, 'utf8');
    const { hasFrontmatter, frontmatter, body } = splitFrontmatter(raw);

    if (hasFrontmatter) out.withFrontmatter += 1;
    else {
      out.withoutFrontmatter += 1;
      if (out.samples.noFrontmatter.length < 20) out.samples.noFrontmatter.push(rel);
    }

    if (hasFrontmatter) {
      const missing = required.filter((k) => !hasField(frontmatter, k));
      if (missing.length > 0) {
        out.missingRequired += 1;
        for (const k of missing) out.missingByField[k] += 1;
        if (out.samples.missingRequired.length < 20) out.samples.missingRequired.push({ file: rel, missing });
      }
    }

    const bodyNoCode = stripCodeFences(body);
    if (/\[\[[^\]]+\]\]/.test(bodyNoCode)) out.withWikilink += 1;
    const safeBody = stripWikilinks(stripInlineCode(bodyNoCode));
    if (/(?<!!)\[[^\]]+\]\(([^)]+\.md(?:#[^)]+)?)\)/.test(safeBody)) {
      out.withMarkdownMdLink += 1;
      if (out.samples.markdownMdLink.length < 20) out.samples.markdownMdLink.push(rel);
    }
    if (/(^|[^\[\w\/])((?:docs\/)?[A-Za-z0-9_\-./]*\/[A-Za-z0-9_\-./]+\.md(?:#[A-Za-z0-9_\-./]+)?)(?=\s|$|[),.;:!?])/.test(safeBody)) {
      out.withBareMdPath += 1;
      if (out.samples.bareMdPath.length < 20) out.samples.bareMdPath.push(rel);
    }
  }

  return out;
}

function main() {
  const args = process.argv.slice(2);
  let root = 'docs';
  let jsonOnly = false;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--root') root = args[++i];
    else if (a === '--json') jsonOnly = true;
    else if (a === '-h' || a === '--help') return usage();
    else throw new Error(`unknown_arg:${a}`);
  }

  const result = audit(root);
  if (jsonOnly) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`# Obsidian Docs Audit`);
  console.log(`- root: ${result.root}`);
  console.log(`- shared_root: ${result.sharedRoot}`);
  console.log(`- total: ${result.total}`);
  console.log(`- with_frontmatter: ${result.withFrontmatter}`);
  console.log(`- without_frontmatter: ${result.withoutFrontmatter}`);
  console.log(`- missing_required_frontmatter_docs: ${result.missingRequired}`);
  console.log(`- with_wikilink_docs: ${result.withWikilink}`);
  console.log(`- with_markdown_md_links_docs: ${result.withMarkdownMdLink}`);
  console.log(`- with_bare_md_paths_docs: ${result.withBareMdPath}`);
  console.log(`- missing_by_field: ${JSON.stringify(result.missingByField)}`);
  if (result.samples.noFrontmatter.length) {
    console.log(`- sample_no_frontmatter: ${result.samples.noFrontmatter.join(', ')}`);
  }
  if (result.samples.markdownMdLink.length) {
    console.log(`- sample_markdown_md_link: ${result.samples.markdownMdLink.join(', ')}`);
  }
  if (result.samples.bareMdPath.length) {
    console.log(`- sample_bare_md_path: ${result.samples.bareMdPath.join(', ')}`);
  }
}

main();
