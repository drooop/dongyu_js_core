import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function parseArgs(argv) {
  const args = { case: 'all' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--case') {
      args.case = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listChangedFiles() {
  const out = execSync('git diff --name-only', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
  if (!out) return [];
  return out.split(/\n/).filter(Boolean);
}

function validateStage4() {
  const fp = path.join(process.cwd(), 'docs', 'roadmap', 'dongyu_app_next_runtime.md');
  const t = readText(fp);
  const idx = t.indexOf('# Phase 4');
  assert(idx >= 0, 'stage4:missing_phase4_header');
  const s = t.slice(idx);
  assert(s.includes('Status: PENDING'), 'stage4:status_not_pending');
  assert(!s.includes('0129-modeltable-editor-v0'), 'stage4:mentions_0129');
  process.stdout.write('stage4: PASS\n');
}

function validateForbiddenImports() {
  const candidates = [
    'packages/ui-renderer/src/renderer.js',
    'packages/ui-renderer/src/renderer.mjs',
    'packages/ui-model-demo-frontend/src/local_bus_adapter.js',
  ];
  const bad = [];
  for (const rel of candidates) {
    const fp = path.join(process.cwd(), rel);
    if (!fs.existsSync(fp)) continue;
    const t = readText(fp);
    const importLines = t.split(/\n/).filter((l) => l.includes('import') || l.includes('require('));
    for (const line of importLines) {
      if (line.includes('bus-adapters')) bad.push(`${rel}:bus-adapters`);
      if (line.includes('mqtt')) bad.push(`${rel}:mqtt`);
      if (line.includes('matrix')) bad.push(`${rel}:matrix`);
    }
  }
  assert(bad.length === 0, `forbidden_imports:${bad.join(',')}`);
  process.stdout.write('forbidden_imports: PASS\n');
}

function validateStep5ChangedFiles() {
  const allowed = new Set([
    'docs/ITERATIONS.md',
    'docs/roadmap/dongyu_app_next_runtime.md',
    'docs/iterations/0129-modeltable-editor-v0/runlog.md',
    'scripts/validate_iteration_guard.mjs',
  ]);
  const files = listChangedFiles();
  for (const f of files) {
    assert(allowed.has(f), `step5_changed_files:unexpected:${f}`);
  }
  process.stdout.write('step5_changed_files: PASS\n');
  process.stdout.write('working tree contains only allowed files for Step5 (scripted)\n');
}

function runCase(name) {
  if (name === 'stage4') return validateStage4();
  if (name === 'forbidden_imports') return validateForbiddenImports();
  if (name === 'step5_changed_files') return validateStep5ChangedFiles();
  throw new Error(`unknown_case:${name}`);
}

const args = parseArgs(process.argv.slice(2));

try {
  const cases = args.case === 'all' ? ['stage4', 'forbidden_imports', 'step5_changed_files'] : [args.case];
  for (const c of cases) runCase(c);
  process.exit(0);
} catch (err) {
  process.stderr.write(`FAIL: ${err.message}\n`);
  process.exit(1);
}
