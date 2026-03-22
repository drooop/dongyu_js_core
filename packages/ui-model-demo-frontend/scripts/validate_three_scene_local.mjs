#!/usr/bin/env node

import { createRequire } from 'node:module';

import { createDemoStore } from '../src/demo_modeltable.js';
import {
  EDITOR_STATE_MODEL_ID,
  THREE_SCENE_APP_MODEL_ID,
  THREE_SCENE_CHILD_MODEL_ID,
  THREE_SCENE_COMPONENT_TYPE,
  THREE_SCENE_CREATE_ENTITY_ACTION,
  THREE_SCENE_DELETE_ENTITY_ACTION,
  THREE_SCENE_REMOTE_ONLY_DETAIL,
  THREE_SCENE_SELECT_ENTITY_ACTION,
  THREE_SCENE_UPDATE_ENTITY_ACTION,
} from '../src/model_ids.js';

const require = createRequire(import.meta.url);
const { createRenderer } = require('../../ui-renderer/src/index.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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

function selectWorkspaceModel(store, modelId) {
  const stateModel = store.runtime.getModel(EDITOR_STATE_MODEL_ID);
  store.runtime.addLabel(stateModel, 0, 0, 0, { k: 'ui_page', t: 'str', v: 'workspace' });
  store.runtime.addLabel(stateModel, 0, 0, 0, { k: 'ws_app_selected', t: 'int', v: modelId });
  store.runtime.addLabel(stateModel, 0, 0, 0, { k: 'selected_model_id', t: 'str', v: String(modelId) });
  store.refreshSnapshot();
  store.setRoutePath('/workspace');
  return store.getUiAst();
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

function dispatchWorkspaceButton(store, ast, buttonId) {
  const calls = [];
  const renderer = createRenderer({
    host: createHostAdapter(() => store.snapshot, calls),
  });
  const button = findNode(ast, (node) => node?.id === buttonId);
  assert(button, `workspace_button_missing:${buttonId}`);
  const label = renderer.dispatchEvent(button, { click: true });
  assert(label?.t === 'event', `workspace_button_must_dispatch_event:${buttonId}`);
  assert(calls.length === 1 && calls[0].type === 'add', `workspace_button_must_emit_mailbox_add:${buttonId}`);
  return label;
}

try {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const workspaceRegistry = store.runtime.getLabelValue(store.runtime.getModel(EDITOR_STATE_MODEL_ID), 0, 0, 0, 'ws_apps_registry');
  assert(Array.isArray(workspaceRegistry), 'workspace_registry_missing');
  assert(workspaceRegistry.some((entry) => entry?.model_id === THREE_SCENE_APP_MODEL_ID), 'workspace_registry_missing_three_scene_app');
  assert(workspaceRegistry.every((entry) => entry?.model_id !== THREE_SCENE_CHILD_MODEL_ID), 'workspace_registry_must_not_expose_three_scene_child');

  const ast = selectWorkspaceModel(store, THREE_SCENE_APP_MODEL_ID);
  const hostNode = findNode(ast, (node) => node?.type === THREE_SCENE_COMPONENT_TYPE);
  assert(hostNode?.type === THREE_SCENE_COMPONENT_TYPE, 'workspace_ast_missing_three_scene_host');
  assert(hostNode?.props?.sceneGraphRef?.model_id === THREE_SCENE_CHILD_MODEL_ID, 'three_scene_host_scene_graph_ref_invalid');

  const initialGraph = JSON.stringify(
    store.runtime.getLabelValue(store.runtime.getModel(THREE_SCENE_CHILD_MODEL_ID), 0, 0, 0, 'scene_graph_v0'),
  );
  const initialSelected = store.runtime.getLabelValue(store.runtime.getModel(THREE_SCENE_CHILD_MODEL_ID), 0, 0, 0, 'selected_entity_id');
  const initialStatus = store.runtime.getLabelValue(store.runtime.getModel(THREE_SCENE_CHILD_MODEL_ID), 0, 0, 0, 'scene_status');

  const actionCases = [
    { action: THREE_SCENE_CREATE_ENTITY_ACTION, buttonId: 'three_scene_action_create' },
    { action: THREE_SCENE_SELECT_ENTITY_ACTION, buttonId: 'three_scene_action_select' },
    { action: THREE_SCENE_UPDATE_ENTITY_ACTION, buttonId: 'three_scene_action_update' },
    { action: THREE_SCENE_DELETE_ENTITY_ACTION, buttonId: 'three_scene_action_delete' },
  ];

  for (const [index, actionCase] of actionCases.entries()) {
    const label = dispatchWorkspaceButton(store, ast, actionCase.buttonId);
    if (actionCase.action === THREE_SCENE_UPDATE_ENTITY_ACTION) {
      assert(
        label?.v?.payload?.value?.v?.id === initialSelected,
        'update_button_must_resolve_selected_entity_id_into_payload',
      );
    }
    if (actionCase.action === THREE_SCENE_DELETE_ENTITY_ACTION) {
      assert(
        label?.v?.payload?.value?.v === initialSelected,
        'delete_button_must_resolve_selected_entity_id_into_payload',
      );
    }
    store.dispatchAddLabel({
      p: 0,
      r: 0,
      c: 1,
      k: 'ui_event',
      t: 'event',
      v: {
        ...label.v,
        payload: {
          ...label.v.payload,
          meta: { ...(label.v.payload?.meta || {}), op_id: `three_scene_local_${index}` },
        },
      },
    });
    const result = store.consumeOnce();
    const eventError = store.runtime.getLabelValue(store.runtime.getModel(-1), 0, 0, 1, 'ui_event_error');
    assert(result?.result === 'error', `local_action_must_fail:${actionCase.action}`);
    assert(result?.code === 'unsupported', `local_action_must_fail_with_unsupported:${actionCase.action}`);
    assert(eventError?.detail === THREE_SCENE_REMOTE_ONLY_DETAIL, `local_action_must_report_remote_only:${actionCase.action}`);
    assert(
      JSON.stringify(store.runtime.getLabelValue(store.runtime.getModel(THREE_SCENE_CHILD_MODEL_ID), 0, 0, 0, 'scene_graph_v0')) === initialGraph,
      `local_action_must_not_mutate_scene_graph:${actionCase.action}`,
    );
    assert(
      store.runtime.getLabelValue(store.runtime.getModel(THREE_SCENE_CHILD_MODEL_ID), 0, 0, 0, 'selected_entity_id') === initialSelected,
      `local_action_must_not_mutate_selected_entity:${actionCase.action}`,
    );
    assert(
      store.runtime.getLabelValue(store.runtime.getModel(THREE_SCENE_CHILD_MODEL_ID), 0, 0, 0, 'scene_status') === initialStatus,
      `local_action_must_not_mutate_scene_status:${actionCase.action}`,
    );
  }

  console.log('validate_three_scene_local: PASS');
  process.exit(0);
} catch (err) {
  console.error('validate_three_scene_local: FAIL');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
