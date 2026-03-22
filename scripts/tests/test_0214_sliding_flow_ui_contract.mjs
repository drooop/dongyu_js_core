#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import {
  ACTION_LIFECYCLE_MODEL_ID,
  EDITOR_STATE_MODEL_ID,
  FLOW_SHELL_ANCHOR_MODEL_ID,
  FLOW_SHELL_DEFAULT_TAB,
  FLOW_SHELL_FORBIDDEN_WRITE_MODEL_IDS,
  FLOW_SHELL_INPUT_MODEL_IDS,
  FLOW_SHELL_TAB_LABEL,
  MATRIX_DEBUG_MODEL_ID,
  MODEL_100_ID,
  SCENE_CONTEXT_MODEL_ID,
  WORKSPACE_CATALOG_MODEL_ID,
} from '../../packages/ui-model-demo-frontend/src/model_ids.js';
import {
  deriveMatrixDebugView,
  deriveSlidingFlowShellState,
  isFlowCapableWorkspaceApp,
} from '../../packages/ui-model-demo-frontend/src/editor_page_state_derivers.js';

function setRuntimeLabel(runtime, modelId, p, r, c, label) {
  const model = runtime.getModel(modelId);
  assert.ok(model, `missing model ${modelId}`);
  runtime.addLabel(model, p, r, c, label);
}

function getSnapshotLabel(snapshot, modelId, cellKey, labelKey) {
  return snapshot?.models?.[String(modelId)]?.cells?.[cellKey]?.labels?.[labelKey] ?? null;
}

function test_flow_contract_model_ids_are_explicit() {
  assert.equal(SCENE_CONTEXT_MODEL_ID, -12, 'scene_context must stay on Model -12');
  assert.equal(ACTION_LIFECYCLE_MODEL_ID, -1, 'action_lifecycle must stay on Model -1 mailbox model');
  assert.equal(WORKSPACE_CATALOG_MODEL_ID, -25, 'workspace catalog must stay on Model -25');
  assert.equal(MATRIX_DEBUG_MODEL_ID, -100, 'matrix debug truth must stay on Model -100');
  assert.equal(FLOW_SHELL_ANCHOR_MODEL_ID, MODEL_100_ID, 'Model 100 must stay the executable flow anchor');
  assert.equal(FLOW_SHELL_TAB_LABEL, 'flow_tab_selected', 'flow UI-only tab label must stay explicit');
  assert.equal(FLOW_SHELL_DEFAULT_TAB, 'process', 'flow shell default tab must stay process');
  assert.deepEqual(
    FLOW_SHELL_INPUT_MODEL_IDS,
    [EDITOR_STATE_MODEL_ID, ACTION_LIFECYCLE_MODEL_ID, SCENE_CONTEXT_MODEL_ID, MATRIX_DEBUG_MODEL_ID],
    'flow shell inputs must stay limited to UI state + existing truth sources',
  );
  assert.deepEqual(
    FLOW_SHELL_FORBIDDEN_WRITE_MODEL_IDS,
    [0, SCENE_CONTEXT_MODEL_ID, MATRIX_DEBUG_MODEL_ID],
    'flow shell must forbid direct-write to Model 0 / scene_context / matrix_debug truth',
  );
}

function test_local_demo_bootstraps_flow_truth_sources_and_ui_only_state() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const snapshot = store.snapshot;

  assert.deepEqual(
    getSnapshotLabel(snapshot, SCENE_CONTEXT_MODEL_ID, '0,0,0', 'scene_context')?.v,
    {
      current_app: 100,
      active_flow: null,
      flow_step: 0,
      recent_intents: [],
      last_action_result: null,
      session_vars: {},
    },
    'local demo must load Model -12 scene_context truth source',
  );
  assert.deepEqual(
    getSnapshotLabel(snapshot, ACTION_LIFECYCLE_MODEL_ID, '0,0,1', 'action_lifecycle')?.v,
    {
      op_id: '',
      action: '',
      status: 'idle',
      started_at: 0,
      completed_at: null,
      result: null,
      confidence: 1,
    },
    'local demo must load mailbox action_lifecycle truth source',
  );
  assert.equal(
    getSnapshotLabel(snapshot, EDITOR_STATE_MODEL_ID, '0,0,0', FLOW_SHELL_TAB_LABEL)?.v,
    FLOW_SHELL_DEFAULT_TAB,
    'local demo must seed flow_tab_selected on Model -2 only',
  );
  assert.equal(
    getSnapshotLabel(snapshot, SCENE_CONTEXT_MODEL_ID, '0,0,0', FLOW_SHELL_TAB_LABEL),
    null,
    'flow_tab_selected must not be written into Model -12',
  );
  assert.equal(
    getSnapshotLabel(snapshot, MATRIX_DEBUG_MODEL_ID, '0,0,0', FLOW_SHELL_TAB_LABEL),
    null,
    'flow_tab_selected must not be written into Model -100',
  );
}

function test_model100_is_the_only_frozen_flow_capable_anchor_in_step1() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  setRuntimeLabel(store.runtime, EDITOR_STATE_MODEL_ID, 0, 0, 0, { k: 'ws_app_selected', t: 'int', v: 100 });
  setRuntimeLabel(store.runtime, EDITOR_STATE_MODEL_ID, 0, 0, 0, { k: 'selected_model_id', t: 'str', v: '100' });
  setRuntimeLabel(store.runtime, SCENE_CONTEXT_MODEL_ID, 0, 0, 0, {
    k: 'scene_context',
    t: 'json',
    v: {
      current_app: 100,
      active_flow: 'submit_color_request',
      flow_step: 2,
      recent_intents: [{ action: 'submit', op_id: 'op_demo', ts: 123, model_id: 100 }],
      last_action_result: null,
      session_vars: { draft: 'color' },
    },
  });
  setRuntimeLabel(store.runtime, ACTION_LIFECYCLE_MODEL_ID, 0, 0, 1, {
    k: 'action_lifecycle',
    t: 'json',
    v: {
      op_id: 'op_demo',
      action: 'submit',
      status: 'running',
      started_at: 123,
      completed_at: null,
      result: null,
      confidence: 0.9,
    },
  });
  store.refreshSnapshot();

  assert.equal(isFlowCapableWorkspaceApp(store.snapshot, MODEL_100_ID), true, 'Model 100 must be flow-capable');
  assert.equal(isFlowCapableWorkspaceApp(store.snapshot, 1001), false, 'non-anchor apps must not be frozen as flow-capable in Step 1');

  const derived = deriveSlidingFlowShellState(store.snapshot, EDITOR_STATE_MODEL_ID);
  assert.equal(derived.flowCapable, true, 'selected Model 100 must derive a flow-capable shell state');
  assert.equal(derived.anchorModelId, MODEL_100_ID, 'derived anchor must stay on Model 100');
  assert.equal(derived.selectedModelId, MODEL_100_ID, 'shell state must follow the selected workspace app');
  assert.equal(derived.uiState.activeTab, FLOW_SHELL_DEFAULT_TAB, 'shell state must read UI-only tab from Model -2');
  assert.equal(derived.sceneContext.active_flow, 'submit_color_request', 'shell state must read Model -12 scene_context');
  assert.equal(derived.sceneContext.flow_step, 2, 'shell state must read flow_step from Model -12');
  assert.equal(derived.actionLifecycle.status, 'running', 'shell state must read Model -1 action_lifecycle');
  assert.deepEqual(
    derived.matrixDebug,
    deriveMatrixDebugView(store.snapshot, EDITOR_STATE_MODEL_ID),
    'shell state must reuse 0213 matrix debug projection instead of redefining debug truth',
  );
}

async function test_server_state_matches_local_flow_ui_seed_boundary() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0214-sliding-flow-'));
  process.env.DY_AUTH = '0';
  process.env.WORKER_BASE_WORKSPACE = `it0214_sliding_flow_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });

  try {
    const snapshot = state.clientSnap();
    assert.equal(
      getSnapshotLabel(snapshot, EDITOR_STATE_MODEL_ID, '0,0,0', FLOW_SHELL_TAB_LABEL)?.v,
      FLOW_SHELL_DEFAULT_TAB,
      'server path must seed the same Model -2 flow_tab_selected default as local demo',
    );
    assert.equal(
      getSnapshotLabel(snapshot, SCENE_CONTEXT_MODEL_ID, '0,0,0', FLOW_SHELL_TAB_LABEL),
      null,
      'server path must not mirror flow_tab_selected into Model -12',
    );
    assert.equal(
      getSnapshotLabel(snapshot, MATRIX_DEBUG_MODEL_ID, '0,0,0', FLOW_SHELL_TAB_LABEL),
      null,
      'server path must not mirror flow_tab_selected into Model -100',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
  }
}

const tests = [
  test_flow_contract_model_ids_are_explicit,
  test_local_demo_bootstraps_flow_truth_sources_and_ui_only_state,
  test_model100_is_the_only_frozen_flow_capable_anchor_in_step1,
  test_server_state_matches_local_flow_ui_seed_boundary,
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
