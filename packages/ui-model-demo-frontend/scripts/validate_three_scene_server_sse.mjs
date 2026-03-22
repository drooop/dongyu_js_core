#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildAstFromSchema } from '../src/ui_schema_projection.js';
import { resolveRouteUiAst } from '../src/route_ui_projection.js';
import {
  EDITOR_STATE_MODEL_ID,
  THREE_SCENE_APP_MODEL_ID,
  THREE_SCENE_CHILD_MODEL_ID,
  THREE_SCENE_COMPONENT_TYPE,
  THREE_SCENE_CREATE_ENTITY_ACTION,
  THREE_SCENE_DELETE_ENTITY_ACTION,
  THREE_SCENE_SELECT_ENTITY_ACTION,
  THREE_SCENE_UPDATE_ENTITY_ACTION,
} from '../src/model_ids.js';

const require = createRequire(import.meta.url);
const { createRenderer } = require('../../ui-renderer/src/index.js');

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}` },
  };
  if (options.target) payload.target = options.target;
  if (options.value !== undefined) payload.value = options.value;
  return {
    event_id: Date.now(),
    type: action,
    payload,
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

function findNode(ast, predicate) {
  let found = null;
  const visit = (node) => {
    if (!node || typeof node !== 'object' || found) return;
    if (predicate(node)) {
      found = node;
      return;
    }
    const children = Array.isArray(node.children) ? node.children : [];
    for (const child of children) visit(child);
  };
  visit(ast);
  return found;
}

function createHostAdapter(snapshotProvider, calls) {
  return {
    getSnapshot() {
      return snapshotProvider();
    },
    dispatchAddLabel(label) {
      calls.push({ type: 'add', label });
    },
    dispatchRmLabel(labelRef) {
      calls.push({ type: 'rm', labelRef });
    },
  };
}

function getWorkspaceAst(snapshot) {
  return resolveRouteUiAst(snapshot, '/workspace', { projectSchemaModel: buildAstFromSchema }).ast;
}

function dispatchWorkspaceButton(snapshotProvider, buttonId) {
  const calls = [];
  const renderer = createRenderer({
    host: createHostAdapter(snapshotProvider, calls),
  });
  const ast = getWorkspaceAst(snapshotProvider());
  const button = findNode(ast, (node) => node?.id === buttonId);
  assert(button, `workspace_button_missing:${buttonId}`);
  const label = renderer.dispatchEvent(button, { click: true });
  assert.equal(label?.t, 'event', `workspace_button_must_dispatch_event:${buttonId}`);
  assert.equal(calls.length, 1, `workspace_button_must_emit_single_mailbox_add:${buttonId}`);
  return label;
}

const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0216-three-scene-'));

process.env.DY_AUTH = '0';
process.env.WORKER_BASE_WORKSPACE = `it0216_three_scene_${Date.now()}`;
process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
process.env.DOCS_ROOT = join(tempRoot, 'docs');
process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

const { createServerState } = await import(new URL('../../ui-model-demo-server/server.mjs', import.meta.url));
const state = createServerState({ dbPath: null });

try {
  let snapshot = state.clientSnap();
  const workspaceRegistry = snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v;
  assert(Array.isArray(workspaceRegistry), 'server_workspace_registry_missing');
  assert(workspaceRegistry.some((entry) => entry?.model_id === THREE_SCENE_APP_MODEL_ID), 'server_workspace_registry_missing_three_scene_app');
  assert(workspaceRegistry.every((entry) => entry?.model_id !== THREE_SCENE_CHILD_MODEL_ID), 'server_workspace_registry_must_not_expose_child_directly');

  let result = await state.submitEnvelope(mailboxEnvelope('label_update', {
    opId: 'three_scene_set_workspace_page',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'ui_page' },
    value: { t: 'str', v: 'workspace' },
  }));
  assert.equal(result.result, 'ok', 'server_workspace_page_switch_failed');

  result = await state.submitEnvelope(mailboxEnvelope('label_update', {
    opId: 'three_scene_select_app',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'ws_app_selected' },
    value: { t: 'int', v: THREE_SCENE_APP_MODEL_ID },
  }));
  assert.equal(result.result, 'ok', 'server_workspace_three_scene_select_failed');

  snapshot = state.clientSnap();
  let ast = getWorkspaceAst(snapshot);
  const hostNode = findNode(ast, (node) => node?.type === THREE_SCENE_COMPONENT_TYPE);
  assert.equal(hostNode?.type, THREE_SCENE_COMPONENT_TYPE, 'server_workspace_ast_missing_three_scene_host');
  assert.equal(
    snapshot?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.selected_entity_id?.v,
    'cube-1',
    'server_three_scene_baseline_selected_entity_missing',
  );

  await state.activateRuntimeMode('running');

  let label = dispatchWorkspaceButton(() => state.clientSnap(), 'three_scene_action_create');
  assert.equal(label?.v?.payload?.action, THREE_SCENE_CREATE_ENTITY_ACTION, 'create_button_action_mismatch');
  result = await state.submitEnvelope({
    ...label.v,
    payload: {
      ...label.v.payload,
      meta: { ...(label.v.payload?.meta || {}), op_id: 'three_scene_create_sphere_2' },
    },
  });
  assert.equal(result.result, 'ok', 'server_three_scene_create_failed');

  snapshot = state.clientSnap();
  let entities = snapshot?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.scene_graph_v0?.v?.entities;
  assert(Array.isArray(entities) && entities.some((entity) => entity?.id === 'sphere-2'), 'server_three_scene_create_must_add_entity');
  assert.equal(
    snapshot?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.selected_entity_id?.v,
    'sphere-2',
    'server_three_scene_create_must_select_new_entity',
  );
  assert.match(
    String(snapshot?.models?.[String(THREE_SCENE_APP_MODEL_ID)]?.cells?.['0,0,0']?.labels?.scene_status_text?.v || ''),
    /created sphere-2/,
    'server_parent_status_must_report_create',
  );

  label = dispatchWorkspaceButton(() => state.clientSnap(), 'three_scene_action_select');
  assert.equal(label?.v?.payload?.value?.v, 'cube-1', 'select_button_payload_value_mismatch');
  result = await state.submitEnvelope({
    ...label.v,
    payload: {
      ...label.v.payload,
      meta: { ...(label.v.payload?.meta || {}), op_id: 'three_scene_select_cube_1' },
    },
  });
  assert.equal(result.result, 'ok', 'server_three_scene_select_failed');

  snapshot = state.clientSnap();
  assert.equal(
    snapshot?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.selected_entity_id?.v,
    'cube-1',
    'server_three_scene_select_must_update_selected_entity',
  );

  label = dispatchWorkspaceButton(() => state.clientSnap(), 'three_scene_action_update');
  assert.equal(label?.v?.payload?.value?.v?.id, 'cube-1', 'update_button_must_resolve_selected_entity_id');
  result = await state.submitEnvelope({
    ...label.v,
    payload: {
      ...label.v.payload,
      meta: { ...(label.v.payload?.meta || {}), op_id: 'three_scene_update_cube_1' },
    },
  });
  assert.equal(result.result, 'ok', 'server_three_scene_update_failed');

  snapshot = state.clientSnap();
  entities = snapshot?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.scene_graph_v0?.v?.entities;
  const updatedCube = Array.isArray(entities) ? entities.find((entity) => entity?.id === 'cube-1') : null;
  assert.equal(updatedCube?.color, '#f97316', 'server_three_scene_update_must_change_color');
  assert.deepEqual(updatedCube?.position, [2, 1, 0], 'server_three_scene_update_must_change_position');

  result = await state.submitEnvelope(mailboxEnvelope(THREE_SCENE_CREATE_ENTITY_ACTION, {
    opId: 'three_scene_create_cone_3',
    target: { model_id: THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'scene_graph_v0' },
    value: {
      t: 'json',
      v: {
        id: 'cone-3',
        type: 'cone',
        color: '#38bdf8',
        position: [3, 0.5, 0],
        rotation: [0, 0, 0],
        scale: [0.8, 1.1, 0.8],
        visible: true,
      },
    },
  }));
  assert.equal(result.result, 'ok', 'server_three_scene_create_cone_failed');

  result = await state.submitEnvelope(mailboxEnvelope(THREE_SCENE_SELECT_ENTITY_ACTION, {
    opId: 'three_scene_select_cone_3',
    target: { model_id: THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_entity_id' },
    value: { t: 'str', v: 'cone-3' },
  }));
  assert.equal(result.result, 'ok', 'server_three_scene_select_cone_failed');

  snapshot = state.clientSnap();
  assert.equal(
    snapshot?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.selected_entity_id?.v,
    'cone-3',
    'server_three_scene_select_cone_must_update_selected_entity',
  );

  const baselineBeforeInvalid = JSON.stringify(snapshot?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.scene_graph_v0?.v || {});
  for (const invalidCase of [
    {
      action: THREE_SCENE_CREATE_ENTITY_ACTION,
      target: { model_id: THREE_SCENE_CHILD_MODEL_ID, p: 9, r: 9, c: 9, k: 'wrong' },
      value: { t: 'json', v: { id: 'bad-create' } },
    },
    {
      action: THREE_SCENE_SELECT_ENTITY_ACTION,
      target: { model_id: THREE_SCENE_CHILD_MODEL_ID, p: 9, r: 9, c: 9, k: 'wrong' },
      value: { t: 'str', v: 'cube-1' },
    },
    {
      action: THREE_SCENE_UPDATE_ENTITY_ACTION,
      target: { model_id: THREE_SCENE_CHILD_MODEL_ID, p: 9, r: 9, c: 9, k: 'wrong' },
      value: { t: 'json', v: { id: 'cube-1', color: '#000000' } },
    },
    {
      action: THREE_SCENE_DELETE_ENTITY_ACTION,
      target: { model_id: THREE_SCENE_CHILD_MODEL_ID, p: 9, r: 9, c: 9, k: 'wrong' },
      value: { t: 'str', v: 'sphere-2' },
    },
  ]) {
    const invalidResult = await state.submitEnvelope(mailboxEnvelope(invalidCase.action, {
      opId: `invalid_${invalidCase.action}`,
      target: invalidCase.target,
      value: invalidCase.value,
    }));
    assert.equal(invalidResult.result, 'error', `invalid_target_must_fail:${invalidCase.action}`);
    assert.equal(invalidResult.code, 'invalid_target', `invalid_target_code_must_be_invalid_target:${invalidCase.action}`);
    assert.equal(invalidResult.detail, 'unexpected_target_ref', `invalid_target_detail_must_be_unexpected_target_ref:${invalidCase.action}`);
    const afterInvalid = state.clientSnap();
    assert.equal(
      JSON.stringify(afterInvalid?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.scene_graph_v0?.v || {}),
      baselineBeforeInvalid,
      `invalid_target_must_not_mutate_scene_graph:${invalidCase.action}`,
    );
  }

  result = await state.submitEnvelope(mailboxEnvelope(THREE_SCENE_DELETE_ENTITY_ACTION, {
    opId: 'three_scene_delete_non_selected_sphere_2',
    target: { model_id: THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_entity_id' },
    value: { t: 'str', v: 'sphere-2' },
  }));
  assert.equal(result.result, 'ok', 'server_three_scene_delete_non_selected_failed');

  snapshot = state.clientSnap();
  entities = snapshot?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.scene_graph_v0?.v?.entities;
  assert(Array.isArray(entities) && !entities.some((entity) => entity?.id === 'sphere-2'), 'server_three_scene_delete_non_selected_must_remove_target_entity');
  assert.equal(
    snapshot?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.selected_entity_id?.v,
    'cone-3',
    'server_three_scene_delete_non_selected_must_preserve_current_selection',
  );

  label = dispatchWorkspaceButton(() => state.clientSnap(), 'three_scene_action_delete');
  assert.equal(label?.v?.payload?.value?.v, 'cone-3', 'delete_button_must_resolve_selected_entity_id');
  result = await state.submitEnvelope({
    ...label.v,
    payload: {
      ...label.v.payload,
      meta: { ...(label.v.payload?.meta || {}), op_id: 'three_scene_delete_selected_cone_3' },
    },
  });
  assert.equal(result.result, 'ok', 'server_three_scene_delete_failed');

  snapshot = state.clientSnap();
  entities = snapshot?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.scene_graph_v0?.v?.entities;
  assert(Array.isArray(entities) && !entities.some((entity) => entity?.id === 'cone-3'), 'server_three_scene_delete_must_remove_entity');
  assert.equal(
    snapshot?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.selected_entity_id?.v,
    'cube-1',
    'server_three_scene_delete_must_fallback_to_remaining_entity',
  );
  assert.match(
    String(snapshot?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.scene_audit_log?.v || ''),
    /delete cone-3/,
    'server_three_scene_audit_log_must_record_delete',
  );
  assert.match(
    String(snapshot?.models?.[String(THREE_SCENE_APP_MODEL_ID)]?.cells?.['0,0,0']?.labels?.scene_summary_text?.v || ''),
    /entities=1 selected=cube-1/,
    'server_parent_summary_must_track_remaining_entity',
  );

  ast = resolveRouteUiAst(snapshot, '/workspace', { projectSchemaModel: buildAstFromSchema }).ast;
  assert.equal(findNode(ast, (node) => node?.type === THREE_SCENE_COMPONENT_TYPE)?.type, THREE_SCENE_COMPONENT_TYPE, 'server_three_scene_host_must_survive_crud');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  delete process.env.WORKER_BASE_WORKSPACE;
  delete process.env.WORKER_BASE_DATA_ROOT;
  delete process.env.DOCS_ROOT;
  delete process.env.STATIC_PROJECTS_ROOT;
}

console.log('validate_three_scene_server_sse: PASS');
