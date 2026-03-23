import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { createDemoStore } from '../src/demo_modeltable.js';
import { createGalleryStore } from '../src/gallery_store.js';
import {
  GALLERY_STATE_MODEL_ID,
  THREE_SCENE_CREATE_ENTITY_ACTION,
  THREE_SCENE_CHILD_MODEL_ID,
  THREE_SCENE_DELETE_ENTITY_ACTION,
  THREE_SCENE_SELECT_ENTITY_ACTION,
  THREE_SCENE_UPDATE_ENTITY_ACTION,
  UI_EXAMPLE_CHILD_MODEL_ID,
  UI_EXAMPLE_PROMOTE_CHILD_ACTION,
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

function getLabelValue(runtime, ref) {
  const model = runtime.getModel(ref.model_id);
  assert(model, `missing_model:${ref.model_id}`);
  const cell = runtime.getCell(model, ref.p, ref.r, ref.c);
  const label = cell.labels.get(ref.k);
  return label ? label.v : undefined;
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

function dispatchButton(store, ast, buttonId) {
  const calls = [];
  const renderer = createRenderer({
    host: createHostAdapter(() => store.snapshot, calls),
  });
  const button = findNode(ast, (node) => node?.id === buttonId);
  assert(button, `gallery_button_missing:${buttonId}`);
  const label = renderer.dispatchEvent(button, { click: true });
  assert(label?.t === 'event', `gallery_button_must_dispatch_event:${buttonId}`);
  assert(calls.length === 1 && calls[0].type === 'add', `gallery_button_must_emit_mailbox_add:${buttonId}`);
  return label;
}

try {
  const sourceStore = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const store = createGalleryStore({ sourceStore });
  const ast = store.getUiAst();

  // 1) showcase-local state stays on Model -102.
  store.dispatchAddLabel({
    p: 0,
    r: 0,
    c: 1,
    k: 'ui_event',
    t: 'event',
    v: mailboxEnvelope('label_update', {
      opId: 'gallery_focus_three',
      target: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 11, c: 0, k: 'gallery_showcase_tab' },
      value: { t: 'str', v: 'three' },
    }),
  });
  store.consumeOnce();
  assert(
    getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 11, c: 0, k: 'gallery_showcase_tab' }) === 'three',
    'gallery_showcase_tab_not_updated',
  );

  store.dispatchAddLabel({
    p: 0,
    r: 0,
    c: 1,
    k: 'ui_event',
    t: 'event',
    v: mailboxEnvelope('label_update', {
      opId: 'gallery_examples_parent',
      target: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 11, c: 1, k: 'gallery_examples_focus' },
      value: { t: 'str', v: 'parent' },
    }),
  });
  store.consumeOnce();
  assert(
    getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 11, c: 1, k: 'gallery_examples_focus' }) === 'parent',
    'gallery_examples_focus_not_updated',
  );

  store.dispatchAddLabel({
    p: 0,
    r: 0,
    c: 1,
    k: 'ui_event',
    t: 'event',
    v: mailboxEnvelope('label_update', {
      opId: 'gallery_three_audit',
      target: { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 11, c: 2, k: 'gallery_three_focus' },
      value: { t: 'str', v: 'audit' },
    }),
  });
  store.consumeOnce();
  assert(
    getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 11, c: 2, k: 'gallery_three_focus' }) === 'audit',
    'gallery_three_focus_not_updated',
  );

  // 2) showcase-local buttons remain label_update -> Model -102.
  let label = dispatchButton(store, ast, 'gallery_focus_examples_button');
  assert(label?.v?.payload?.action === 'label_update', 'gallery_focus_examples_button_action_mismatch');
  assert.deepEqual(
    label?.v?.payload?.target,
    { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 11, c: 0, k: 'gallery_showcase_tab' },
    'gallery_focus_examples_button_target_invalid',
  );
  assert.deepEqual(label?.v?.payload?.value, { t: 'str', v: 'examples' }, 'gallery_focus_examples_button_value_invalid');

  label = dispatchButton(store, ast, 'gallery_examples_focus_parent_button');
  assert(label?.v?.payload?.action === 'label_update', 'gallery_examples_focus_parent_button_action_mismatch');
  assert.deepEqual(
    label?.v?.payload?.target,
    { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 11, c: 1, k: 'gallery_examples_focus' },
    'gallery_examples_focus_parent_button_target_invalid',
  );
  assert.deepEqual(label?.v?.payload?.value, { t: 'str', v: 'parent' }, 'gallery_examples_focus_parent_button_value_invalid');

  label = dispatchButton(store, ast, 'gallery_three_focus_audit_button');
  assert(label?.v?.payload?.action === 'label_update', 'gallery_three_focus_audit_button_action_mismatch');
  assert.deepEqual(
    label?.v?.payload?.target,
    { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 11, c: 2, k: 'gallery_three_focus' },
    'gallery_three_focus_audit_button_target_invalid',
  );
  assert.deepEqual(label?.v?.payload?.value, { t: 'str', v: 'audit' }, 'gallery_three_focus_audit_button_value_invalid');

  // 3) integration buttons emit only existing authoritative action names.
  label = dispatchButton(store, ast, 'gallery_matrix_refresh_button');
  assert(label?.v?.payload?.action === 'matrix_debug_refresh', 'gallery_matrix_refresh_button_action_mismatch');
  assert.deepEqual(
    label?.v?.payload?.target,
    { model_id: -2, p: 0, r: 0, c: 0, k: 'matrix_debug_subject_selected' },
    'gallery_matrix_refresh_button_target_invalid',
  );

  label = dispatchButton(store, ast, 'gallery_examples_promote_button');
  assert(label?.v?.payload?.action === UI_EXAMPLE_PROMOTE_CHILD_ACTION, 'gallery_examples_promote_button_action_mismatch');
  assert.deepEqual(
    label?.v?.payload?.target,
    { model_id: UI_EXAMPLE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'review_stage' },
    'gallery_examples_promote_button_target_invalid',
  );

  label = dispatchButton(store, ast, 'gallery_three_create_button');
  assert(label?.v?.payload?.action === THREE_SCENE_CREATE_ENTITY_ACTION, 'gallery_three_create_button_action_mismatch');
  assert.deepEqual(
    label?.v?.payload?.target,
    { model_id: THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'scene_graph_v0' },
    'gallery_three_create_button_target_invalid',
  );

  label = dispatchButton(store, ast, 'gallery_three_select_button');
  assert(label?.v?.payload?.action === THREE_SCENE_SELECT_ENTITY_ACTION, 'gallery_three_select_button_action_mismatch');

  label = dispatchButton(store, ast, 'gallery_three_update_button');
  assert(label?.v?.payload?.action === THREE_SCENE_UPDATE_ENTITY_ACTION, 'gallery_three_update_button_action_mismatch');
  assert(label?.v?.payload?.value?.v?.id === 'cube-1', 'gallery_three_update_button_selected_entity_resolution_missing');

  label = dispatchButton(store, ast, 'gallery_three_delete_button');
  assert(label?.v?.payload?.action === THREE_SCENE_DELETE_ENTITY_ACTION, 'gallery_three_delete_button_action_mismatch');
  assert(label?.v?.payload?.value?.v === 'cube-1', 'gallery_three_delete_button_selected_entity_resolution_missing');

  label = dispatchButton(store, ast, 'gallery_examples_workspace_button');
  assert(label?.v?.payload?.action === 'label_update', 'gallery_examples_workspace_button_action_mismatch');
  assert.deepEqual(
    label?.v?.payload?.target,
    { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'nav_to' },
    'gallery_examples_workspace_button_target_invalid',
  );
  assert.deepEqual(label?.v?.payload?.value, { t: 'str', v: '/workspace' }, 'gallery_examples_workspace_button_value_invalid');

  console.log('validate_gallery_events: PASS');
  process.exit(0);
} catch (err) {
  console.error('validate_gallery_events: FAIL');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
