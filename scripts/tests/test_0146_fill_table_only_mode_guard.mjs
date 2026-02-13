import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const guardScript = path.resolve(__dirname, '../validate_fill_table_only_mode.mjs');

function runGuard(args = [], env = {}) {
  const result = spawnSync(process.execPath, [guardScript, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return {
    code: result.status,
    out: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

function assertIncludes(text, needle, message) {
  assert(String(text).includes(needle), message || `expected output to include ${needle}`);
}

function test_skip_when_mode_not_enabled() {
  const r = runGuard(['--paths', 'packages/worker-base/src/runtime.js']);
  assert.strictEqual(r.code, 0, 'mode disabled should exit 0');
  assertIncludes(r.out, '[SKIP] fill-table-only mode not enabled', 'should print SKIP');
  return { key: 'skip_when_mode_not_enabled', status: 'PASS' };
}

function test_pass_for_allowed_paths_when_enabled() {
  const r = runGuard([
    '--mode',
    'fill-table-only',
    '--paths',
    'docs/README.md,scripts/tests/test_0146_fill_table_only_mode_guard.mjs',
  ]);
  assert.strictEqual(r.code, 0, 'allowed paths should pass');
  assertIncludes(r.out, '[PASS] fill-table-only guard', 'should print PASS');
  return { key: 'pass_for_allowed_paths_when_enabled', status: 'PASS' };
}

function test_fail_for_disallowed_paths_when_enabled() {
  const r = runGuard(['--mode', 'fill-table-only', '--paths', 'packages/worker-base/src/runtime.js']);
  assert.strictEqual(r.code, 1, 'disallowed path should fail');
  assertIncludes(r.out, '[FAIL] fill-table-only guard', 'should print FAIL');
  assertIncludes(
    r.out,
    'required_action=write_runtime_capability_gap_report',
    'should require capability gap report on failure',
  );
  return { key: 'fail_for_disallowed_paths_when_enabled', status: 'PASS' };
}

function test_env_toggle_works() {
  const r = runGuard(['--paths', 'docs/ssot/fill_table_only_mode.md'], { FILL_TABLE_ONLY: '1' });
  assert.strictEqual(r.code, 0, 'FILL_TABLE_ONLY=1 should enable mode');
  assertIncludes(r.out, '[PASS] fill-table-only guard', 'env-enabled mode should pass for allowed path');
  return { key: 'env_toggle_works', status: 'PASS' };
}

function test_governance_paths_allowed() {
  const r = runGuard([
    '--mode',
    'fill-table-only',
    '--paths',
    '.githooks/pre-commit,scripts/ops/install_git_hooks.sh,scripts/fill_table_only_mode_ctl.mjs',
  ]);
  assert.strictEqual(r.code, 0, 'governance automation paths should be allowed');
  assertIncludes(r.out, '[PASS] fill-table-only guard', 'should pass for governance paths');
  return { key: 'governance_paths_allowed', status: 'PASS' };
}

const tests = [
  test_skip_when_mode_not_enabled,
  test_pass_for_allowed_paths_when_enabled,
  test_fail_for_disallowed_paths_when_enabled,
  test_env_toggle_works,
  test_governance_paths_allowed,
];

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    const r = t();
    console.log(`[${r.status}] ${r.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${t.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
