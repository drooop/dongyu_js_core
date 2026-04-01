#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createLocalBusAdapter } from '../../packages/ui-model-demo-frontend/src/local_bus_adapter.js';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const repoRoot = resolve(import.meta.dirname, '..', '..');
const workspacePatch = JSON.parse(fs.readFileSync(resolve(repoRoot, 'packages/worker-base/system-models/workspace_positive_models.json'), 'utf8'));
const records = Array.isArray(workspacePatch?.records) ? workspacePatch.records : [];
const STATIC_WORKSPACE_APP_MODEL_ID = 1011;
const STATIC_WORKSPACE_TRUTH_MODEL_ID = 1012;

function findRecord(predicate) {
  return records.find((record) => predicate(record)) || null;
}

function buildRuntimeForAdapter() {
  const rt = new ModelTableRuntime();
  rt.createModel({ id: -1, name: 'editor_mailbox', type: 'ui' });
  rt.createModel({ id: -2, name: 'editor_state', type: 'ui' });
  rt.createModel({ id: STATIC_WORKSPACE_TRUTH_MODEL_ID, name: 'static_truth', type: 'sliding_ui' });
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

function test_static_workspace_file_input_still_targets_truth_media_uri() {
  const fileInputBind = findRecord((record) => (
    record?.model_id === STATIC_WORKSPACE_APP_MODEL_ID
    && record?.k === 'ui_bind_json'
    && record?.v?.write?.target_ref?.model_id === STATIC_WORKSPACE_TRUTH_MODEL_ID
    && record?.v?.write?.target_ref?.k === 'static_media_uri'
  ));
  assert.ok(fileInputBind, 'static_workspace_file_input_bind_missing');
  return { key: 'static_workspace_file_input_still_targets_truth_media_uri', status: 'PASS' };
}

function test_static_workspace_has_delete_button_bound_to_delete_action() {
  const deleteButtonBind = findRecord((record) => (
    record?.model_id === STATIC_WORKSPACE_APP_MODEL_ID
    && record?.k === 'ui_bind_write_json'
    && record?.v?.action === 'static_project_delete'
    && record?.v?.target_ref?.model_id === STATIC_WORKSPACE_TRUTH_MODEL_ID
    && record?.v?.target_ref?.k === 'static_project_name'
    && record?.v?.value_ref?.t === 'str'
    && record?.v?.value_ref?.v?.$ref === 'row.name'
  ));
  assert.ok(deleteButtonBind, 'static_workspace_delete_button_bind_missing');
  return { key: 'static_workspace_has_delete_button_bound_to_delete_action', status: 'PASS' };
}

function test_static_delete_action_is_registered_as_remote_only_not_unknown() {
  const runtime = buildRuntimeForAdapter();
  const adapter = createLocalBusAdapter({
    runtime,
    eventLog: [],
    mode: 'v1',
    mailboxModelId: -1,
    editorStateModelId: -2,
  });
  const result = submitToAdapter(adapter, runtime, mailboxEnvelope('static_project_delete', {
    target: { model_id: STATIC_WORKSPACE_TRUTH_MODEL_ID, p: 0, r: 0, c: 0, k: 'static_project_name' },
    value: { t: 'str', v: 'demo' },
  }));
  assert.equal(result.result, 'error', 'static_project_delete_must_not_succeed_in_local_adapter');
  assert.equal(result.code, 'unsupported', 'static_project_delete_must_be_known_and_marked_remote_only');
  return { key: 'static_delete_action_is_registered_as_remote_only_not_unknown', status: 'PASS' };
}

const tests = [
  test_static_workspace_file_input_still_targets_truth_media_uri,
  test_static_workspace_has_delete_button_bound_to_delete_action,
  test_static_delete_action_is_registered_as_remote_only_not_unknown,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
