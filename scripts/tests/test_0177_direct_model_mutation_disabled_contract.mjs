#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createLocalBusAdapter } from '../../packages/ui-model-demo-frontend/src/local_bus_adapter.js';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const repoRoot = resolve(import.meta.dirname, '..', '..');
const serverSource = fs.readFileSync(resolve(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');

function buildRuntimeForAdapter() {
  const rt = new ModelTableRuntime();
  rt.createModel({ id: -1, name: 'editor_mailbox', type: 'ui' });
  rt.createModel({ id: -2, name: 'editor_state', type: 'ui' });
  rt.createModel({ id: 100, name: 'main', type: 'app' });
  return rt;
}

function mailboxEnvelope(action, extra = {}) {
  return {
    type: action,
    source: { node_type: 'Button', node_id: `${action}_btn` },
    payload: {
      action,
      meta: { op_id: `op_${action}` },
      ...extra,
    },
  };
}

function submitToAdapter(adapter, runtime, envelope) {
  const mailboxModel = runtime.getModel(-1);
  runtime.addLabel(mailboxModel, 0, 0, 1, { k: 'ui_event', t: 'event', v: envelope });
  return adapter.consumeOnce();
}

function test_local_bus_adapter_mutations_are_disabled() {
  const runtime = buildRuntimeForAdapter();
  const adapter = createLocalBusAdapter({
    runtime,
    eventLog: [],
    mode: 'v1',
    mailboxModelId: -1,
    editorStateModelId: -2,
  });

  const createResult = submitToAdapter(adapter, runtime, mailboxEnvelope('submodel_create', {
    value: { t: 'json', v: { id: 101, name: 'M101', type: 'app' } },
  }));
  assert.equal(createResult.code, 'direct_model_mutation_disabled', 'submodel_create must be rejected');
  assert.equal(runtime.getModel(101), undefined, 'rejected submodel_create must not create model');

  const addLabelResult = submitToAdapter(adapter, runtime, mailboxEnvelope('label_add', {
    target: { model_id: 100, p: 1, r: 1, c: 1, k: 'title' },
    value: { t: 'str', v: 'hello' },
  }));
  assert.equal(addLabelResult.code, 'direct_model_mutation_disabled', 'label_add must be rejected');

  const cell = runtime.getCell(runtime.getModel(100), 1, 1, 1);
  assert.equal(cell.labels.has('title'), false, 'rejected label_add must not write target label');

  const removeResult = submitToAdapter(adapter, runtime, mailboxEnvelope('datatable_remove_label', {
    target: { model_id: 100, p: 1, r: 1, c: 1, k: 'title' },
  }));
  assert.equal(removeResult.code, 'direct_model_mutation_disabled', 'datatable_remove_label must be rejected');
}

function test_local_bus_adapter_allows_registered_editor_state_mutation_only() {
  const runtime = buildRuntimeForAdapter();
  const adapter = createLocalBusAdapter({
    runtime,
    eventLog: [],
    mode: 'v1',
    mailboxModelId: -1,
    editorStateModelId: -2,
  });

  const result = submitToAdapter(adapter, runtime, mailboxEnvelope('label_update', {
    target: { model_id: -2, p: 0, r: 0, c: 0, k: 'dt_filter_model_query' },
    value: { t: 'str', v: 'home' },
  }));
  assert.equal(result.result, 'ok', 'editor_state label_update must succeed');
  const stateCell = runtime.getCell(runtime.getModel(-2), 0, 0, 0);
  assert.equal(stateCell.labels.get('dt_filter_model_query')?.v, 'home', 'editor_state label_update must land on model -2');
}

function test_ui_server_patch_api_disabled_and_runtime_mode_endpoint_contract() {
  assert.match(serverSource, /url\.pathname === '\/api\/runtime\/mode'/, 'runtime_mode_route_missing');
  assert.match(serverSource, /nextMode !== 'running'/, 'runtime_mode_transition_guard_missing');
  assert.match(serverSource, /state\.activateRuntimeMode\(nextMode\)/, 'runtime_mode_activation_missing');
  assert.match(serverSource, /url\.pathname === '\/api\/modeltable\/patch'/, 'patch_route_missing');
  assert.match(serverSource, /error: 'direct_patch_api_disabled'/, 'direct_patch_api_disabled_missing');
}

function test_ui_server_allows_editor_state_label_updates_but_still_blocks_business_mutation_contract() {
  assert.match(serverSource, /const allowUiLocalMutation = isUiLocalMutableModelId\(directMutationTarget\);/, 'ui_local_mutation_gate_missing');
  assert.match(serverSource, /finishError\('direct_model_mutation_disabled', action\)/, 'direct_model_mutation_guard_missing');
  assert.match(serverSource, /const uiLocalAdapter = createLocalBusAdapter\(\{/, 'ui_local_adapter_missing');
  assert.match(serverSource, /editorStateModelId: directMutationTarget/, 'ui_local_adapter_target_missing');
  assert.match(serverSource, /updateDerived\(\);\s*await programEngine\.tick\(\);\s*return result;/, 'ui_local_mutation_followup_missing');
}

const tests = [
  test_local_bus_adapter_mutations_are_disabled,
  test_local_bus_adapter_allows_registered_editor_state_mutation_only,
  test_ui_server_patch_api_disabled_and_runtime_mode_endpoint_contract,
  test_ui_server_allows_editor_state_label_updates_but_still_blocks_business_mutation_contract,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
