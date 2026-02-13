import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const ctlScript = path.resolve(__dirname, '../fill_table_only_mode_ctl.mjs');

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    ...options,
  });
  return {
    code: result.status ?? 1,
    out: `${result.stdout || ''}${result.stderr || ''}`,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function runCtl(args) {
  return run(process.execPath, [ctlScript, ...args]);
}

function includes(text, needle) {
  return String(text).includes(needle);
}

function getLocalModeRaw() {
  return run('git', ['config', '--bool', '--get', 'dongyu.fillTableOnly']);
}

function setLocalMode(enabled) {
  if (enabled) {
    const r = run('git', ['config', '--local', 'dongyu.fillTableOnly', 'true']);
    if (r.code !== 0) throw new Error(`failed to set local mode: ${r.out}`);
    return;
  }
  run('git', ['config', '--local', '--unset', 'dongyu.fillTableOnly']);
}

const originalMode = getLocalModeRaw();

function restoreOriginalMode() {
  if (originalMode.code === 0 && String(originalMode.stdout).trim().toLowerCase() === 'true') {
    setLocalMode(true);
    return;
  }
  setLocalMode(false);
}

function test_status_disabled_after_off() {
  const off = runCtl(['off']);
  assert.strictEqual(off.code, 0, 'off should succeed');
  const s = runCtl(['status']);
  assert.strictEqual(s.code, 0, 'status should succeed');
  assert(includes(s.out, 'fill_table_only=disabled'), 'status should be disabled after off');
  return { key: 'status_disabled_after_off', status: 'PASS' };
}

function test_on_then_status_enabled() {
  const on = runCtl(['on']);
  assert.strictEqual(on.code, 0, 'on should succeed');
  const s = runCtl(['status']);
  assert.strictEqual(s.code, 0, 'status should succeed');
  assert(includes(s.out, 'fill_table_only=enabled'), 'status should be enabled after on');
  return { key: 'on_then_status_enabled', status: 'PASS' };
}

function test_check_disallowed_fails() {
  const r = runCtl(['check', '--paths', 'packages/worker-base/src/runtime.js']);
  assert.strictEqual(r.code, 1, 'disallowed path should fail');
  assert(includes(r.out, 'required_action=write_runtime_capability_gap_report'), 'must require gap report');
  return { key: 'check_disallowed_fails', status: 'PASS' };
}

function test_check_allowed_passes() {
  const r = runCtl(['check', '--paths', 'docs/README.md,scripts/tests/test_0147_fill_table_only_auto_gate.mjs']);
  assert.strictEqual(r.code, 0, 'allowed paths should pass');
  assert(includes(r.out, '[PASS] fill-table-only guard'), 'should print PASS');
  return { key: 'check_allowed_passes', status: 'PASS' };
}

const tests = [
  test_status_disabled_after_off,
  test_on_then_status_enabled,
  test_check_disallowed_fails,
  test_check_allowed_passes,
];

let passed = 0;
let failed = 0;

try {
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
} finally {
  try {
    restoreOriginalMode();
  } catch (err) {
    console.log(`[WARN] failed to restore original local mode: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
