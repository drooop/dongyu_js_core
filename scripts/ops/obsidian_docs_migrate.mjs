#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const LEGACY_TARGET_MAP = new Map([
  ['docs/roadmap/dongyu_app_next_runtime.md', 'roadmaps/dongyu-app-next-runtime.md'],
  ['roadmap/dongyu_app_next_runtime.md', 'roadmaps/dongyu-app-next-runtime.md'],
  ['docs/roadmaps/dongyu-app-next-runtime-elysia.md', 'roadmaps/dongyu-app-next-runtime.md'],
  ['roadmaps/dongyu-app-next-runtime-elysia.md', 'roadmaps/dongyu-app-next-runtime.md'],
]);

function usage() {
  console.log(`Usage:\n  node scripts/ops/obsidian_docs_migrate.mjs [options]\n\nOptions:\n  --root <dir>           Docs root (default: docs)\n  --project <name>       Project name for docs-shared frontmatter (default: dongyuapp)\n  --apply                Apply changes (default: dry-run)\n  --phase <A|B|all>      Migration phase scope (default: all)\n  --today <YYYY-MM-DD>   Override updated date\n  -h, --help             Show help`);
}

function formatDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function collectMarkdownFiles(rootDir) {
  const out = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(abs);
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        out.push(abs);
      }
    }
  }
  walk(rootDir);
  return out;
}

function phaseFilter(relPath, phase) {
  if (phase === 'all') return true;
  const p = relPath.replaceAll('\\', '/');
  const in015x = /^iterations\/015[1-5][^/]*\//.test(p);
  const inRoots = /^(README\.md|WORKFLOW\.md|ITERATIONS\.md|AGENTS\.md)$/.test(p);
  const inAGroup = p.startsWith('ssot/') || p.startsWith('user-guide/') || p.startsWith('handover/') || p.startsWith('_templates/') || p.startsWith('architecture_') || in015x || inRoots;
  if (phase === 'A') return inAGroup;
  if (phase === 'B') return !inAGroup;
  return true;
}

function splitFrontmatter(raw) {
  const text = raw.replace(/^\uFEFF/, '');
  if (!text.startsWith('---\n')) {
    return { hasFrontmatter: false, frontmatter: '', body: text };
  }
  const end = text.indexOf('\n---\n', 4);
  if (end < 0) {
    return { hasFrontmatter: false, frontmatter: '', body: text };
  }
  const fm = text.slice(4, end);
  const body = text.slice(end + 5);
  return { hasFrontmatter: true, frontmatter: fm, body };
}

function getFirstHeading(body, fallbackBase) {
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^#\s+(.+?)\s*$/);
    if (m) return m[1].trim();
  }
  return fallbackBase;
}

function inferDocType(relPath) {
  const p = relPath.replaceAll('\\', '/');
  const base = path.basename(p).toLowerCase();
  if (p.startsWith('iterations/')) {
    if (base === 'plan.md') return 'iteration-plan';
    if (base === 'resolution.md') return 'iteration-resolution';
    if (base === 'runlog.md') return 'iteration-runlog';
    return 'iteration-note';
  }
  if (p.startsWith('ssot/')) return 'ssot';
  if (p.startsWith('user-guide/')) return 'user-guide';
  if (p.startsWith('handover/')) return 'handover';
  if (p.startsWith('_templates/')) return 'template';
  if (p.startsWith('roadmaps/')) return 'roadmap';
  if (p.startsWith('deployment/')) return 'deployment';
  if (p.startsWith('charters/')) return 'charter';
  if (base === 'workflow.md' || base === 'iterations.md' || base === 'readme.md' || base === 'agents.md') {
    return 'governance';
  }
  return 'note';
}

function inferStatus(relPath) {
  const p = relPath.replaceAll('\\', '/');
  const base = path.basename(p).toLowerCase();
  if (p.startsWith('iterations/')) {
    if (base === 'plan.md' || base === 'resolution.md') return 'planned';
    if (base === 'runlog.md') return 'active';
    return 'active';
  }
  if (p.startsWith('_templates/')) return 'active';
  return 'active';
}

function hasField(frontmatter, key) {
  const re = new RegExp(`^${key}:\\s*`, 'm');
  return re.test(frontmatter);
}

function upsertScalarField(frontmatter, key, value) {
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key}:\\s*.*$`, 'm');
  if (re.test(frontmatter)) {
    return frontmatter.replace(re, line);
  }
  const suffix = frontmatter.endsWith('\n') || frontmatter.length === 0 ? '' : '\n';
  return `${frontmatter}${suffix}${line}`;
}

function ensureFrontmatter({ relPath, body, frontmatter, hasFrontmatter, today, isSharedRoot, project }) {
  const baseName = path.basename(relPath, '.md');
  const title = getFirstHeading(body, baseName);
  const docType = inferDocType(relPath);
  const status = inferStatus(relPath);

  let fm = hasFrontmatter ? frontmatter : '';
  fm = upsertScalarField(fm, 'title', JSON.stringify(title));
  fm = upsertScalarField(fm, 'doc_type', docType);
  fm = upsertScalarField(fm, 'status', status);
  fm = upsertScalarField(fm, 'updated', today);
  fm = upsertScalarField(fm, 'source', 'ai');
  if (isSharedRoot) {
    fm = upsertScalarField(fm, 'project', project);
  }

  if (relPath.replaceAll('\\', '/').startsWith('iterations/')) {
    const parts = relPath.replaceAll('\\', '/').split('/');
    const iterId = parts.length > 1 ? parts[1] : '';
    if (iterId) {
      fm = upsertScalarField(fm, 'iteration_id', iterId);
      if (!hasField(fm, 'id')) fm = upsertScalarField(fm, 'id', iterId);
      const name = path.basename(relPath).toLowerCase();
      if (name === 'plan.md') fm = upsertScalarField(fm, 'phase', 'phase1');
      else if (name === 'resolution.md') fm = upsertScalarField(fm, 'phase', 'phase1');
      else if (name === 'runlog.md') fm = upsertScalarField(fm, 'phase', 'phase3');
    }
  }

  const normalizedFm = fm.split(/\r?\n/).filter(Boolean).join('\n');
  return `---\n${normalizedFm}\n---\n\n${body.replace(/^\n+/, '')}`;
}

function normalizeRelMdPath(ref) {
  const cleaned = ref.trim().replace(/^<|>$/g, '');
  const hashPos = cleaned.indexOf('#');
  const pathPart = hashPos >= 0 ? cleaned.slice(0, hashPos) : cleaned;
  const anchor = hashPos >= 0 ? cleaned.slice(hashPos + 1) : '';
  return { pathPart, anchor };
}

function toWikilink({ relTargetNoExt, anchor, alias }) {
  const target = anchor ? `${relTargetNoExt}#${anchor}` : relTargetNoExt;
  if (!alias) return `[[${target}]]`;
  return `[[${target}|${alias}]]`;
}

function resolveTargetRel(currentRel, rawTarget, allRelSet) {
  if (!rawTarget || rawTarget.startsWith('http://') || rawTarget.startsWith('https://') || rawTarget.startsWith('mailto:') || rawTarget.startsWith('app://')) {
    return null;
  }
  const { pathPart, anchor } = normalizeRelMdPath(rawTarget);
  if (!pathPart.toLowerCase().endsWith('.md')) return null;

  const curDir = path.posix.dirname(currentRel.replaceAll('\\', '/'));
  const candidates = [];
  const normalized = pathPart.replaceAll('\\', '/').replace(/^\.\//, '');

  if (normalized.startsWith('docs/')) {
    candidates.push(normalized.slice(5));
  }
  if (normalized.startsWith('/')) {
    candidates.push(normalized.slice(1));
  }
  candidates.push(path.posix.normalize(path.posix.join(curDir, normalized)));
  candidates.push(path.posix.normalize(normalized));
  if (LEGACY_TARGET_MAP.has(normalized)) {
    candidates.push(LEGACY_TARGET_MAP.get(normalized));
  }

  let stripUp = normalized;
  while (stripUp.startsWith('../')) {
    stripUp = stripUp.slice(3);
    if (stripUp) candidates.push(stripUp);
    if (LEGACY_TARGET_MAP.has(stripUp)) {
      candidates.push(LEGACY_TARGET_MAP.get(stripUp));
    }
  }

  for (const cand of candidates) {
    const clean = cand.replace(/^\.(\/|$)/, '').replace(/^\//, '');
    if (allRelSet.has(clean)) {
      return { relMd: clean, anchor };
    }
  }
  return null;
}

function convertBodyLinks(body, relPath, allRelSet, counters) {
  const chunks = body.split(/(```[\s\S]*?```)/g);
  for (let i = 0; i < chunks.length; i += 1) {
    if (i % 2 === 1) continue;
    let segment = chunks[i];

    const protectedTokens = [];
    segment = segment.replace(/\[\[[^\]]+\]\]/g, (m) => {
      const key = `__DY_PROTECTED_WL_${protectedTokens.length}__`;
      protectedTokens.push(m);
      return key;
    });
    segment = segment.replace(/`[^`\n]+`/g, (m) => {
      const key = `__DY_PROTECTED_IC_${protectedTokens.length}__`;
      protectedTokens.push(m);
      return key;
    });

    segment = segment.replace(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g, (full, text, href) => {
      const resolved = resolveTargetRel(relPath, href, allRelSet);
      if (!resolved) return full;
      const relNoExt = resolved.relMd.replace(/\.md$/i, '');
      const base = path.posix.basename(relNoExt);
      const alias = (text === base || text === resolved.relMd || text === relNoExt) ? '' : text;
      counters.convertedMarkdown += 1;
      return toWikilink({ relTargetNoExt: relNoExt, anchor: resolved.anchor, alias });
    });

    segment = segment.replace(/(^|[^\[\w\/])((?:docs\/)?[A-Za-z0-9_\-./]*\/[A-Za-z0-9_\-./]+\.md(?:#[A-Za-z0-9_\-./]+)?)(?=\s|$|[),.;:!?])/g, (full, prefix, raw) => {
      const resolved = resolveTargetRel(relPath, raw, allRelSet);
      if (!resolved) return full;
      const relNoExt = resolved.relMd.replace(/\.md$/i, '');
      counters.convertedBare += 1;
      return `${prefix}${toWikilink({ relTargetNoExt: relNoExt, anchor: resolved.anchor, alias: '' })}`;
    });

    segment = segment.replace(/__DY_PROTECTED_(?:WL|IC)_(\d+)__/g, (full, idx) => {
      const n = Number(idx);
      return Number.isInteger(n) && n >= 0 && n < protectedTokens.length ? protectedTokens[n] : full;
    });

    chunks[i] = segment;
  }
  return chunks.join('');
}

async function main() {
  const args = process.argv.slice(2);
  let root = 'docs';
  let project = 'dongyuapp';
  let apply = false;
  let phase = 'all';
  let today = formatDate();

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--root') root = args[++i];
    else if (a === '--project') project = args[++i];
    else if (a === '--apply') apply = true;
    else if (a === '--phase') phase = (args[++i] || 'all').toUpperCase();
    else if (a === '--today') today = args[++i];
    else if (a === '-h' || a === '--help') return usage();
    else throw new Error(`unknown_arg:${a}`);
  }

  if (!['A', 'B', 'ALL'].includes(phase)) {
    throw new Error(`invalid_phase:${phase}`);
  }
  const phaseNorm = phase === 'ALL' ? 'all' : phase;
  const rootAbs = path.resolve(root);
  const isSharedRoot = path.basename(rootAbs) === 'docs-shared';
  const filesAbs = collectMarkdownFiles(rootAbs);
  const relAll = filesAbs.map((f) => path.relative(rootAbs, f).replaceAll('\\', '/'));
  const allRelSet = new Set(relAll);

  const counters = {
    total: filesAbs.length,
    selected: 0,
    changed: 0,
    frontmatterAdded: 0,
    frontmatterUpdated: 0,
    convertedMarkdown: 0,
    convertedBare: 0,
  };

  for (const abs of filesAbs) {
    const rel = path.relative(rootAbs, abs).replaceAll('\\', '/');
    if (!phaseFilter(rel, phaseNorm)) continue;
    counters.selected += 1;

    const raw = await fsp.readFile(abs, 'utf8');
    const { hasFrontmatter, frontmatter, body } = splitFrontmatter(raw);

    const withFm = ensureFrontmatter({
      relPath: rel,
      body,
      frontmatter,
      hasFrontmatter,
      today,
      isSharedRoot,
      project,
    });
    const split = splitFrontmatter(withFm);
    const convertedBody = convertBodyLinks(split.body, rel, allRelSet, counters);
    const next = `---\n${split.frontmatter}\n---\n\n${convertedBody.replace(/^\n+/, '')}`;

    if (next !== raw.replace(/^\uFEFF/, '')) {
      counters.changed += 1;
      if (!hasFrontmatter) counters.frontmatterAdded += 1;
      else counters.frontmatterUpdated += 1;
      if (apply) {
        await fsp.writeFile(abs, next, 'utf8');
      }
    }
  }

  console.log(JSON.stringify({
    root: rootAbs,
    shared_root: isSharedRoot,
    project,
    phase: phaseNorm,
    apply,
    ...counters,
  }, null, 2));
}

main().catch((err) => {
  console.error('[obsidian_docs_migrate] failed:', err && err.message ? err.message : err);
  process.exit(1);
});
