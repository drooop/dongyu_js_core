#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildAstFromSchema } from '../../packages/ui-model-demo-frontend/src/ui_schema_projection.js';
import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import { EDITOR_STATE_MODEL_ID } from '../../packages/ui-model-demo-frontend/src/model_ids.js';

function makeSnapshot(modelId, labelsByCell) {
  const cells = {};
  for (const [cellKey, labels] of Object.entries(labelsByCell)) {
    const out = {};
    for (const [k, { t, v }] of Object.entries(labels)) out[k] = { k, t, v };
    cells[cellKey] = { labels: out };
  }
  return {
    models: {
      [String(modelId)]: {
        id: modelId,
        name: `Model ${modelId}`,
        cells,
      },
    },
  };
}

function findNodeById(ast, id) {
  let found = null;
  const visit = (node) => {
    if (!node || typeof node !== 'object' || found) return;
    if (node.id === id) {
      found = node;
      return;
    }
    const children = Array.isArray(node.children) ? node.children : [];
    for (const child of children) visit(child);
  };
  visit(ast);
  return found;
}

function test_positive_schema_model_write_is_intent_not_direct_label_update() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const ast = buildAstFromSchema(store.snapshot, 1001);
  const inputNode = findNodeById(ast, 'schema_1001_applicant');
  assert(inputNode?.bind?.write, 'schema_input_write_missing');
  assert.equal(inputNode.bind.write.action, 'ui_owner_label_update', 'positive_schema_write_must_cut_over_to_owner_intent');
  assert.equal(inputNode.bind.write.mode, 'intent', 'positive_schema_write_must_be_intent_mode');
  assert.equal(inputNode.bind.write.commit_policy, 'on_blur', 'positive_input_default_commit_policy_must_be_on_blur');
  assert.deepEqual(
    inputNode.bind.write.target_ref,
    { model_id: 1001, p: 0, r: 0, c: 0, k: 'applicant' },
    'positive_schema_target_metadata_must_be_preserved',
  );
  return { key: 'positive_schema_model_write_is_intent_not_direct_label_update', status: 'PASS' };
}

function test_negative_schema_model_write_remains_local_label_update() {
  const snapshot = makeSnapshot(-3, {
    '1,0,0': {
      _field_order: { t: 'json', v: ['username'] },
      username: { t: 'str', v: 'Input' },
      username__label: { t: 'str', v: 'Username' },
    },
  });
  const ast = buildAstFromSchema(snapshot, -3);
  const inputNode = findNodeById(ast, 'schema_-3_username');
  assert(inputNode?.bind?.write, 'negative_schema_write_missing');
  assert.equal(inputNode.bind.write.action, 'label_update', 'negative_schema_write_must_remain_local_label_update');
  return { key: 'negative_schema_model_write_remains_local_label_update', status: 'PASS' };
}

async function test_server_ui_owner_label_update_materializes_positive_model() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0255-ui-owner-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0255_ui_owner_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });

  try {
    await state.activateRuntimeMode('running');
    const envelope = {
      event_id: Date.now(),
      type: 'ui_owner_label_update',
      payload: {
        action: 'ui_owner_label_update',
        meta: { op_id: `ui_owner_${Date.now()}` },
        target: { model_id: 1001, p: 0, r: 0, c: 0, k: 'applicant' },
        value: { t: 'str', v: 'hard-cut-owner-write' },
      },
      source: 'ui_renderer',
      ts: Date.now(),
    };
    const result = await state.submitEnvelope(envelope);
    assert.equal(result.result, 'ok', 'server_ui_owner_label_update_failed');
    assert.equal(result.routed_by, 'pin', 'server_ui_owner_label_update_must_route_by_pin');
    const snap = state.clientSnap();
    const value = snap.models['1001'].cells['0,0,0'].labels.applicant?.v;
    assert.equal(value, 'hard-cut-owner-write', 'server_ui_owner_label_update_must_materialize_target_label');
    return { key: 'server_ui_owner_label_update_materializes_positive_model', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

async function test_server_ui_owner_label_update_reports_runtime_not_running_before_activation() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0255-ui-owner-edit-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0255_ui_owner_edit_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });

  try {
    const envelope = {
      event_id: Date.now(),
      type: 'ui_owner_label_update',
      payload: {
        action: 'ui_owner_label_update',
        meta: { op_id: `ui_owner_edit_${Date.now()}` },
        target: { model_id: 1001, p: 0, r: 0, c: 0, k: 'applicant' },
        value: { t: 'str', v: 'should-not-write-while-edit' },
      },
      source: 'ui_renderer',
      ts: Date.now(),
    };
    const result = await state.submitEnvelope(envelope);
    assert.equal(result.result, 'error', 'ui_owner_label_update_must_error_when_runtime_not_running');
    assert.equal(result.code, 'runtime_not_running', 'ui_owner_label_update_must_report_runtime_not_running');
    return { key: 'server_ui_owner_label_update_reports_runtime_not_running_before_activation', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

const tests = [
  test_positive_schema_model_write_is_intent_not_direct_label_update,
  test_negative_schema_model_write_remains_local_label_update,
  test_server_ui_owner_label_update_reports_runtime_not_running_before_activation,
  test_server_ui_owner_label_update_materializes_positive_model,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[PASS] ${result.key}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
