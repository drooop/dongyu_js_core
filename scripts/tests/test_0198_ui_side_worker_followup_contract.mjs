#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function loadJson(relPath) {
  return JSON.parse(read(relPath));
}

function test_ui_side_worker_bootstrap_parse_error_is_wrapped() {
  const source = read('scripts/run_worker_ui_side_v0.mjs');
  assert.match(source, /MODELTABLE_PATCH_JSON_PARSE_FAILED/, 'ui-side worker bootstrap parser must expose MODELTABLE_PATCH_JSON_PARSE_FAILED');
}

function test_ui_side_worker_snapshot_delta_function_checks_envelope_version() {
  const patch = loadJson('deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json');
  const func = patch.records.find((record) => record && record.k === 'ui_apply_snapshot_delta' && record.t === 'func.js');
  assert.ok(func, 'ui_apply_snapshot_delta func.js must exist');
  const code = func.v && typeof func.v === 'object' ? func.v.code : '';
  assert.match(code, /inbox\.version !== 'v0'/, 'ui_apply_snapshot_delta must reject inbox envelopes with non-v0 version');
  assert.doesNotMatch(code, /ctx\.runtime\.applyPatch/, 'ui_apply_snapshot_delta must not use runtime-wide applyPatch');
  assert.match(code, /ui_side_owner_req_1/, 'ui_apply_snapshot_delta must route snapshot_delta via owner request out pin');
  assert.doesNotMatch(code, /pin\.table\.out|pin\.single\.in|pin\.single\.out/, 'ui-side worker followup function must not use deprecated pin families');
}

const tests = [
  test_ui_side_worker_bootstrap_parse_error_is_wrapped,
  test_ui_side_worker_snapshot_delta_function_checks_envelope_version,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
