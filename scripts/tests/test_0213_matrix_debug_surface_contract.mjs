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
const matrixDebugPatch = JSON.parse(readText('packages/worker-base/system-models/matrix_debug_surface.json'));
const workspacePatch = JSON.parse(readText('packages/worker-base/system-models/workspace_catalog_ui.json'));
const intentDispatchPatch = JSON.parse(readText('packages/worker-base/system-models/intent_dispatch_config.json'));
const intentHandlersMatrixDebug = JSON.parse(readText('packages/worker-base/system-models/intent_handlers_matrix_debug.json'));
const demoStoreSource = readText('packages/ui-model-demo-frontend/src/demo_modeltable.js');
const runtimeModeContract = readText('scripts/tests/test_0177_runtime_mode_contract.mjs');
const model100Contract = readText('scripts/tests/test_0182_model100_submit_chain_contract.mjs');

function hasRecord(patch, predicate) {
  return Array.isArray(patch.records) && patch.records.some(predicate);
}

function rootLabelValue(patch, key) {
  const record = Array.isArray(patch.records)
    ? patch.records.find((item) => item && item.model_id === -100 && item.p === 0 && item.r === 0 && item.c === 0 && item.k === key)
    : null;
  return record ? record.v : undefined;
}

function walkAst(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) walkAst(child, visit);
}

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

function test_matrix_debug_surface_is_model_defined_and_mounted() {
  assert.match(server, /const TRACE_MODEL_ID = -100;/, 'server must keep TRACE_MODEL_ID=-100');
  assert.equal(
    rootLabelValue(matrixDebugPatch, 'ui_authoring_version'),
    'cellwise.ui.v1',
    'matrix_debug_surface patch must define cellwise authoring on Model -100',
  );
  assert.equal(
    rootLabelValue(matrixDebugPatch, 'ui_root_node_id'),
    'matrix_debug_root',
    'matrix_debug_surface root node id must stay stable',
  );
  assert.equal(
    hasRecord(
      workspacePatch,
      (record) => record
        && record.op === 'add_label'
        && record.model_id === -25
        && record.k === 'model_type'
        && record.t === 'model.submt'
        && record.v === -100,
    ),
    true,
    'workspace_catalog_ui must mount Model -100 via model.submt',
  );
  assert.doesNotMatch(
    server,
    /runtime\.addLabel\(traceModel,\s*0,\s*0,\s*0,\s*\{\s*k:\s*'ui_ast_v0'/,
    'server must stop owning the formal trace surface via ui_ast_v0 after Step 2',
  );
  assert.match(
    demoStoreSource,
    /matrix_debug_surface\.json/,
    'local demo bootstrap must load matrix_debug_surface patch',
  );
  assert.match(
    server,
    /assetCell = model\.cells && model\.cells\['0,1,0'\]/,
    'server client snapshot must include Model -100 page_asset_v0 cell',
  );
}

function test_matrix_debug_actions_use_dispatch_contract() {
  const dispatchTable = hasRecord(
    intentDispatchPatch,
    (record) => record && record.model_id === -10 && record.k === 'intent_dispatch_table' && record.t === 'json',
  )
    ? intentDispatchPatch.records.find((record) => record && record.model_id === -10 && record.k === 'intent_dispatch_table').v
    : {};
  assert.equal(dispatchTable.matrix_debug_refresh, 'handle_matrix_debug_refresh', 'matrix_debug_refresh must be registered in intent_dispatch_table');
  assert.equal(dispatchTable.matrix_debug_clear_trace, 'handle_matrix_debug_clear_trace', 'matrix_debug_clear_trace must be registered in intent_dispatch_table');
  assert.equal(dispatchTable.matrix_debug_summarize, 'handle_matrix_debug_summarize', 'matrix_debug_summarize must be registered in intent_dispatch_table');
  assert.equal(
    hasRecord(intentHandlersMatrixDebug, (record) => record && record.k === 'handle_matrix_debug_refresh'),
    true,
    'matrix debug refresh handler must exist',
  );
  assert.equal(
    hasRecord(intentHandlersMatrixDebug, (record) => record && record.k === 'handle_matrix_debug_clear_trace'),
    true,
    'matrix debug clear handler must exist',
  );
  assert.equal(
    hasRecord(intentHandlersMatrixDebug, (record) => record && record.k === 'handle_matrix_debug_summarize'),
    true,
    'matrix debug summarize handler must exist',
  );
  const assetRecord = matrixDebugPatch.records.find((record) =>
    record && record.model_id === -100 && record.k === 'ui_bind_json'
  );
  let writesToTraceModel = false;
  for (const record of matrixDebugPatch.records || []) {
    const write = record?.k === 'ui_bind_json' && record?.v && typeof record.v === 'object' ? record.v.write : null;
    const targetRef = write && write.target_ref && typeof write.target_ref === 'object' ? write.target_ref : null;
    if (targetRef && targetRef.model_id === -100) writesToTraceModel = true;
  }
  assert.equal(writesToTraceModel, false, 'matrix debug surface must not direct-write Model -100 from the UI asset');
  assert.match(server, /matrixDebugRefresh:/, 'server hostApi must expose matrixDebugRefresh');
  assert.match(server, /matrixDebugClearTrace:/, 'server hostApi must expose matrixDebugClearTrace');
  assert.match(server, /matrixDebugSummarize:/, 'server hostApi must expose matrixDebugSummarize');
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
  test_matrix_debug_surface_is_model_defined_and_mounted,
  test_matrix_debug_actions_use_dispatch_contract,
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
