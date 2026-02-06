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
  const fp = path.join(process.cwd(), 'docs', 'roadmaps', 'dongyu-app-next-runtime.md');
  const t = readText(fp);
  assert(t.includes('Phase 4'), 'stage4:missing_phase4_section');
  const phase4LineOk = /\|\s*Phase 4\s*\|[^\n]*\|\s*Planned\s*\|/m.test(t);
  assert(phase4LineOk, 'stage4:status_not_planned');
  const phase4Line = (t.split(/\n/).find((l) => /\|\s*Phase 4\s*\|/.test(l)) || '');
  assert(!phase4Line.includes('0129-modeltable-editor-v0'), 'stage4:mentions_0129');

  const contractPath = path.join(process.cwd(), 'docs', 'iterations', '0132-dual-bus-contract-harness-v0', 'contract_dual_bus_v0.md');
  assert(fs.existsSync(contractPath), 'stage4:missing_contract_v0');
  const contract = readText(contractPath);
  assert(contract.includes('Redaction Rules'), 'stage4:missing_redaction_rules');
  assert(contract.includes('Auth Priority'), 'stage4:missing_auth_priority');

  const harnessPath = path.join(process.cwd(), 'scripts', 'validate_dual_bus_harness_v0.mjs');
  assert(fs.existsSync(harnessPath), 'stage4:missing_harness_script');

  process.stdout.write('stage4: PASS\n');
}

function validateForbiddenImports() {
  const candidates = [
    'packages/ui-renderer/src/renderer.js',
    'packages/ui-renderer/src/renderer.mjs',
    'packages/ui-model-demo-frontend/src/local_bus_adapter.js',
    'packages/ui-model-demo-server/server.mjs',
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
    'docs/roadmaps/dongyu-app-next-runtime.md',
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
