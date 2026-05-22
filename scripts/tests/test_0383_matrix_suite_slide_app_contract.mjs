#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSystemPatch } from '../worker_engine_v0.mjs';
import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import {
  EDITOR_STATE_MODEL_ID,
  SCENE_CONTEXT_MODEL_ID,
} from '../../packages/ui-model-demo-frontend/src/model_ids.js';
import {
  deriveSlidingFlowShellProjectionLabels,
  deriveSlidingFlowShellState,
} from '../../packages/ui-model-demo-frontend/src/editor_page_state_derivers.js';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const MODEL_ID = 1080;
const BUS_KEY = 'matrix_suite_1080_bus_event';
const REQ_PIN = 'matrix_suite_request';
const workspacePath = 'packages/worker-base/system-models/workspace_positive_models.json';
const hierarchyPath = 'packages/worker-base/system-models/runtime_hierarchy_mounts.json';
const modelIdsPath = 'packages/ui-model-demo-frontend/src/model_ids.js';
const serverPath = 'packages/ui-model-demo-server/server.mjs';

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function recordsOf(pathname) {
  return readJson(pathname).records || [];
}

function labelValue(runtime, modelId, p, r, c, key) {
  const model = runtime.getModel(modelId);
  assert.ok(model, `missing model ${modelId}`);
  return runtime.getCell(model, p, r, c).labels.get(key)?.v;
}

function findNode(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function walkNodes(node, out = []) {
  if (!node) return out;
  out.push(node);
  for (const child of node.children || []) walkNodes(child, out);
  return out;
}

function loadRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  for (const pathname of [workspacePath, hierarchyPath]) {
    const result = rt.applyPatch(readJson(pathname), { allowCreateModel: true, trustedBootstrap: true });
    assert.equal(result.rejected, 0, `${pathname} must load without rejected records`);
  }
  return rt;
}

function payload(action, extra = []) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'action', t: 'str', v: action },
    ...extra,
  ];
}

async function dispatch(state, action, extra = []) {
  const result = await state.submitEnvelope({
    type: 'bus_event_v2',
    bus_in_key: BUS_KEY,
    value: payload(action, extra),
    meta: { op_id: `it0383_${action}_${Date.now()}` },
  });
  assert.equal(result.result, 'ok', `${action} must route through Model 0 bus_event_v2`);
  assert.equal(result.routed_by, 'model0_busin', `${action} must enter through Model 0 pin.bus.cb.in`);
  await new Promise((resolve) => setTimeout(resolve, 160));
  return result;
}

function test_workspace_entry_and_mount_contract() {
  const workspace = recordsOf(workspacePath);
  const hierarchy = recordsOf(hierarchyPath);
  const modelIds = fs.readFileSync(modelIdsPath, 'utf8');

  assert.ok(modelIds.includes('MATRIX_SUITE_APP_MODEL_ID = 1080'), 'frontend model ids must reserve Matrix Suite 1080');
  assert.ok(/WORKSPACE_ENTRY_MODEL_IDS[\s\S]*1080/u.test(modelIds), 'Workspace allowlist must include Matrix Suite');

  const registry = workspace.find((record) => record.model_id === -2 && record.k === 'ws_apps_registry')?.v;
  assert.ok(Array.isArray(registry) && registry.some((entry) => entry.model_id === MODEL_ID && entry.name === 'Matrix Suite'), 'Workspace registry must expose Matrix Suite');

  const mount = hierarchy.find((record) => record.model_id === 0 && record.p === 9 && record.r === 0 && record.c === MODEL_ID && record.k === 'model_type');
  assert.equal(mount?.t, 'model.submt', 'Matrix Suite must be mounted through a Model 0 model.submt hosting cell');
  assert.equal(mount?.v, MODEL_ID, 'hosting cell must mount model 1080');

  const mountPin = workspace.find((record) => record.model_id === 0 && record.p === 9 && record.r === 0 && record.c === MODEL_ID && record.k === REQ_PIN);
  assert.equal(mountPin?.t, 'pin.in', 'Model 0 hosting cell must declare the Matrix Suite ingress pin');

  const route = workspace.find((record) => record.model_id === 0 && record.k === 'matrix_suite_1080_ingress_route')?.v?.[0];
  assert.deepEqual(route?.from, [0, 0, 0, BUS_KEY], 'Model 0 route must start at the bus_event_v2 ingress key');
  assert.deepEqual(route?.to, [[9, 0, MODEL_ID, REQ_PIN]], 'Model 0 route must target the hosting cell, not the child root directly');
  return { key: 'workspace_entry_and_mount_contract', status: 'PASS' };
}

function test_cellwise_ui_and_required_actions() {
  const rt = loadRuntime();
  const ast = buildAstFromCellwiseModel(rt.snapshot(), MODEL_ID);
  assert.ok(ast, 'Matrix Suite must build a cellwise UI AST');
  assert.equal(ast.type, 'Container');
  const nodes = walkNodes(ast);
  assert.ok(nodes.length >= 40, `Matrix Suite must be fine-grained, got ${nodes.length} nodes`);

  for (const id of [
    'matrix_suite_send_button',
    'matrix_suite_edit_button',
    'matrix_suite_create_dm',
    'matrix_suite_create_room',
    'matrix_suite_update_channel',
    'matrix_suite_delete_room',
    'matrix_suite_video_button',
    'matrix_suite_voice_button',
    'matrix_suite_screen_button',
    'matrix_suite_file_input',
    'matrix_suite_share_file',
    'matrix_suite_save_settings',
    'matrix_suite_password_button',
  ]) {
    assert.ok(findNode(ast, id), `missing required UI node ${id}`);
  }

  for (const id of ['matrix_suite_send_button', 'matrix_suite_edit_button', 'matrix_suite_update_channel', 'matrix_suite_video_button', 'matrix_suite_share_file']) {
    assert.equal(findNode(ast, id)?.bind?.write?.bus_event_v2, true, `${id} must use bus_event_v2`);
    assert.equal(findNode(ast, id)?.bind?.write?.bus_in_key, BUS_KEY, `${id} must target Matrix Suite Model 0 ingress`);
  }

  const fileInput = findNode(ast, 'matrix_suite_file_input');
  const composer = findNode(ast, 'matrix_suite_composer');
  assert.equal(composer?.props?.wrap, true, 'composer must wrap action buttons instead of overflowing into the inspector');
  assert.equal(findNode(ast, 'matrix_suite_composer_input')?.bind?.write?.commit_policy, 'on_blur', 'composer must avoid per-keystroke persistence');
  assert.equal(fileInput?.type, 'FileInput', 'file sharing must use FileInput');
  assert.equal(fileInput?.bind?.write?.target_ref?.k, 'pending_file_uri', 'FileInput must persist the uploaded media URI before share_file');
  assert.equal(fileInput?.props?.nameTargetRef?.k, 'pending_file_name', 'FileInput must persist the uploaded file name before share_file');
  return { key: 'cellwise_ui_and_required_actions', status: 'PASS' };
}

async function test_program_actions_route_and_update_modeltable() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0383-matrix-suite-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0383_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  try {
    const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
    const state = createServerState({
      dbPath: null,
      matrixSuiteMatrixImpl: {
        sendMessage: async (input) => ({ ok: true, eventId: '$0383_send_' + Date.now(), ts: '12:00', input }),
        editMessage: async (input) => ({ ok: true, eventId: '$0383_edit_' + Date.now(), ts: '12:01', input }),
        createRoom: async (input) => ({ ok: true, roomId: '!0383-' + Date.now() + ':example', name: input.name, kind: input.kind || 'room' }),
        shareFile: async (input) => ({ ok: true, eventId: '$0383_file_' + Date.now(), ts: '12:02', input }),
      },
    });
    await state.activateRuntimeMode('running');
    const runtime = state.runtime;

    await dispatch(state, 'select_room', [{ id: 0, p: 0, r: 0, c: 0, k: 'room_id', t: 'str', v: '@bob:ui.local' }]);
    assert.equal(labelValue(runtime, MODEL_ID, 0, 0, 0, 'active_room_name'), 'Bob');

    await dispatch(state, 'send_message', [{ id: 0, p: 0, r: 0, c: 0, k: 'draft_text', t: 'str', v: 'hello matrix suite' }]);
    assert.match(labelValue(runtime, MODEL_ID, 0, 0, 0, 'timeline_markdown'), /hello matrix suite/u);
    const lastEventId = labelValue(runtime, MODEL_ID, 0, 0, 0, 'last_editable_event_id');
    await dispatch(state, 'edit_message', [
      { id: 0, p: 0, r: 0, c: 0, k: 'event_id', t: 'str', v: lastEventId },
      { id: 0, p: 0, r: 0, c: 0, k: 'edit_text', t: 'str', v: 'edited matrix suite' },
    ]);
    assert.match(labelValue(runtime, MODEL_ID, 0, 0, 0, 'timeline_markdown'), /edited matrix suite/u);

    await dispatch(state, 'create_channel', [
      { id: 0, p: 0, r: 0, c: 0, k: 'channel_kind', t: 'str', v: 'room' },
      { id: 0, p: 0, r: 0, c: 0, k: 'channel_name', t: 'str', v: 'Project greenroom' },
    ]);
    assert.match(labelValue(runtime, MODEL_ID, 0, 0, 0, 'rooms_text'), /Project greenroom/u);
    await dispatch(state, 'update_channel', [
      { id: 0, p: 0, r: 0, c: 0, k: 'room_id', t: 'str', v: labelValue(runtime, MODEL_ID, 0, 0, 0, 'active_room_id') },
      { id: 0, p: 0, r: 0, c: 0, k: 'channel_name', t: 'str', v: 'Project atrium' },
    ]);
    assert.match(labelValue(runtime, MODEL_ID, 0, 0, 0, 'rooms_text'), /Project atrium/u);
    assert.equal(labelValue(runtime, MODEL_ID, 0, 0, 0, 'active_room_name'), 'Project atrium');
    await dispatch(state, 'delete_channel', [
      { id: 0, p: 0, r: 0, c: 0, k: 'room_id', t: 'str', v: '@bob:ui.local' },
    ]);
    assert.doesNotMatch(labelValue(runtime, MODEL_ID, 0, 0, 0, 'rooms_text'), /Bob/u);
    assert.equal(labelValue(runtime, MODEL_ID, 0, 0, 0, 'active_room_name'), 'Project atrium');

    await dispatch(state, 'start_video');
    assert.equal(labelValue(runtime, MODEL_ID, 0, 0, 0, 'call_state'), 'requires_media_capability');
    await dispatch(state, 'start_voice');
    assert.equal(labelValue(runtime, MODEL_ID, 0, 0, 0, 'call_state'), 'requires_media_capability');
    await dispatch(state, 'start_screen');
    assert.equal(labelValue(runtime, MODEL_ID, 0, 0, 0, 'call_state'), 'requires_media_capability');
    assert.doesNotMatch(labelValue(runtime, MODEL_ID, 0, 0, 0, 'timeline_markdown'), /Video conference started|Voice message recorded|Screen sharing started/u);

    runtime.addLabel(runtime.getModel(MODEL_ID), 0, 0, 0, { k: 'pending_file_uri', t: 'str', v: 'mxc://local/test-file' });
    runtime.addLabel(runtime.getModel(MODEL_ID), 0, 0, 0, { k: 'pending_file_name', t: 'str', v: 'contract.txt' });
    await dispatch(state, 'share_file');
    assert.match(labelValue(runtime, MODEL_ID, 0, 0, 0, 'timeline_markdown'), /File shared: contract.txt/u);
    assert.equal(labelValue(runtime, MODEL_ID, 0, 0, 0, 'pending_file_uri'), '');
    assert.equal(labelValue(runtime, MODEL_ID, 0, 0, 0, 'pending_file_name'), '');

    await dispatch(state, 'save_settings', [
      { id: 0, p: 0, r: 0, c: 0, k: 'homeserver', t: 'str', v: 'https://matrix.example' },
      { id: 0, p: 0, r: 0, c: 0, k: 'user_id', t: 'str', v: '@user:example' },
    ]);
    assert.match(labelValue(runtime, MODEL_ID, 0, 0, 0, 'settings_status'), /settings saved/u);

    await dispatch(state, 'delete_channel');
    assert.match(labelValue(runtime, MODEL_ID, 0, 0, 0, 'status_text'), /Deleted/u);
    return { key: 'program_actions_route_and_update_modeltable', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function test_no_frontend_direct_matrix_send() {
  const source = fs.readFileSync(serverPath, 'utf8');
  const frontendFiles = [
    'packages/ui-model-demo-frontend/src/main.js',
    'packages/ui-model-demo-frontend/src/demo_app.js',
    'packages/ui-model-demo-frontend/src/remote_store.js',
    'packages/ui-renderer/src/renderer.mjs',
  ];
  for (const file of frontendFiles) {
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(text.includes('matrix-js-sdk'), false, `${file} must not import matrix-js-sdk`);
    assert.equal(/sendEvent\s*\(/u.test(text), false, `${file} must not directly send Matrix events`);
  }
  assert.ok(source.includes("type === 'bus_event_v2'"), 'server must keep bus_event_v2 path');
  return { key: 'no_frontend_direct_matrix_send', status: 'PASS' };
}

function test_flow_shell_display_uses_selected_workspace_app_over_stale_scene_context() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const stateModel = store.runtime.getModel(EDITOR_STATE_MODEL_ID);
  const sceneModel = store.runtime.getModel(SCENE_CONTEXT_MODEL_ID);
  assert.ok(stateModel, 'missing editor state model');
  assert.ok(sceneModel, 'missing scene context model');
  store.runtime.addLabel(stateModel, 0, 0, 0, { k: 'ws_app_selected', t: 'int', v: 100 });
  store.runtime.addLabel(stateModel, 0, 0, 0, { k: 'selected_model_id', t: 'str', v: '100' });
  store.runtime.addLabel(sceneModel, 0, 0, 0, {
    k: 'scene_context',
    t: 'json',
    v: {
      current_app: MODEL_ID,
      active_flow: null,
      flow_step: 0,
      recent_intents: [],
      last_action_result: null,
      session_vars: {},
    },
  });
  store.refreshSnapshot();

  const derived = deriveSlidingFlowShellState(store.snapshot, EDITOR_STATE_MODEL_ID);
  assert.equal(
    derived.processSummaryRows.find((row) => row.key === 'current_app')?.value,
    '100',
    'flow shell process summary must display the selected workspace app, not stale scene_context current_app',
  );
  const projection = deriveSlidingFlowShellProjectionLabels(derived, { title: 'E2E 颜色生成器' });
  assert.match(
    projection.find((label) => label.k === 'flow_app_meta')?.v || '',
    /current_app=100/u,
    'flow shell meta must display the selected workspace app when scene_context is stale',
  );
  return { key: 'flow_shell_selected_app_projection', status: 'PASS' };
}

const tests = [
  test_workspace_entry_and_mount_contract,
  test_cellwise_ui_and_required_actions,
  test_program_actions_route_and_update_modeltable,
  test_no_frontend_direct_matrix_send,
  test_flow_shell_display_uses_selected_workspace_app_over_stale_scene_context,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.stack || error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
