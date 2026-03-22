#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

const claude = readText('CLAUDE.md');
const server = readText('packages/ui-model-demo-server/server.mjs');
const runtimeModeContract = readText('scripts/tests/test_0177_runtime_mode_contract.mjs');
const model100Contract = readText('scripts/tests/test_0182_model100_submit_chain_contract.mjs');

function test_model_id_registry_registers_trace_model() {
  assert.match(claude, /MODEL_ID_REGISTRY/, 'CLAUDE.md must keep MODEL_ID_REGISTRY');
  assert.match(
    claude,
    /Model -100\s+system capability layer: Matrix debug \/ bus trace model\./,
    'Model -100 must be explicitly registered for matrix debug / bus trace',
  );
  assert.match(
    claude,
    /server-owned ui_ast_v0 on this model is legacy debt only/,
    'Model -100 registry entry must forbid treating server ui_ast_v0 as formal surface contract',
  );
}

function test_server_marks_legacy_ui_ast_as_debt() {
  assert.match(server, /const TRACE_MODEL_ID = -100;/, 'server must keep TRACE_MODEL_ID=-100');
  assert.match(
    server,
    /server_ui_ast_v0_is_legacy_debt_only/,
    'server must explicitly mark the trace model ui_ast_v0 as legacy debt',
  );
  assert.match(
    server,
    /runtime\.addLabel\(traceModel,\s*0,\s*0,\s*0,\s*\{\s*k:\s*'ui_ast_v0'/,
    'Step 1 must still document the current server-owned ui_ast_v0 debt before Step 2 removes it',
  );
}

function test_matrix_debug_contract_depends_on_existing_guards() {
  assert.match(runtimeModeContract, /runtime_mode/, '0213 contract must continue to depend on runtime_mode guard');
  assert.equal(
    model100Contract.includes('/sendMatrix\\s*\\(/'),
    true,
    '0213 contract must continue to depend on the model100 no-direct-sendMatrix guard',
  );
  assert.match(
    model100Contract,
    /submit must leave local runtime via existing chain/,
    '0213 contract must continue to depend on the model100 submit-chain guard',
  );
}

const tests = [
  test_model_id_registry_registers_trace_model,
  test_server_marks_legacy_ui_ast_as_debt,
  test_matrix_debug_contract_depends_on_existing_guards,
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
