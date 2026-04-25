#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { createDemoStore } from '../src/demo_modeltable.js';
import { createGalleryStore } from '../src/gallery_store.js';
import {
  GALLERY_STATE_MODEL_ID,
  THREE_SCENE_CHILD_MODEL_ID,
  UI_EXAMPLE_CHILD_MODEL_ID,
} from '../src/model_ids.js';

const require = createRequire(import.meta.url);
const { createRenderer } = require('../../ui-renderer/src/index.js');

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

function dispatchButton(store, buttonId) {
  const calls = [];
  const renderer = createRenderer({
    host: createHostAdapter(() => store.snapshot, calls),
  });
  const ast = store.getUiAst();
  const button = findNode(ast, (node) => node?.id === buttonId);
  assert(button, `gallery_button_missing:${buttonId}`);
  const label = renderer.dispatchEvent(button, { click: true });
  assert.equal(label?.t, 'event', `gallery_button_must_dispatch_event:${buttonId}`);
  assert.equal(calls.length, 1, `gallery_button_must_emit_single_mailbox_add:${buttonId}`);
  store.dispatchAddLabel(label);
  return store.consumeOnce();
}

try {
  const mainStore = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const galleryStore = createGalleryStore({ sourceStore: mainStore });

  let result = dispatchButton(galleryStore, 'gallery_focus_three_button');
  assert.equal(result?.result, 'ok', 'gallery_focus_three_button_must_update_local_showcase_state');
  assert.equal(
    mainStore.runtime.getLabelValue(mainStore.runtime.getModel(GALLERY_STATE_MODEL_ID), 0, 11, 0, 'gallery_showcase_tab'),
    'three',
    'gallery_showcase_tab_must_live_on_model_minus_102',
  );

  result = dispatchButton(galleryStore, 'gallery_matrix_refresh_button');
  assert.equal(result?.result, 'ok', 'gallery_matrix_refresh_button_must_succeed_locally');
  assert.match(
    String(mainStore.runtime.getLabelValue(mainStore.runtime.getModel(-2), 0, 0, 0, 'matrix_debug_status_text') || ''),
    /refresh:/,
    'gallery_matrix_refresh_button_must_update_authoritative_matrix_debug_state',
  );

  result = dispatchButton(galleryStore, 'gallery_examples_promote_button');
  const exampleError = mainStore.runtime.getLabelValue(mainStore.runtime.getModel(-1), 0, 0, 1, 'ui_event_error');
  assert.equal(result?.result, 'error', 'gallery_examples_promote_button_must_fail_in_local_mode');
  assert.equal(result?.code, 'unsupported', 'gallery_examples_promote_button_must_use_existing_remote_only_boundary');
  assert.equal(exampleError?.detail, 'ui_examples_remote_only', 'gallery_examples_promote_button_must_report_ui_examples_remote_only');
  assert.equal(
    mainStore.runtime.getLabelValue(mainStore.runtime.getModel(UI_EXAMPLE_CHILD_MODEL_ID), 0, 0, 0, 'review_stage'),
    'draft',
    'gallery_examples_promote_button_must_not_mutate_authoritative_child_truth',
  );

  const sceneGraphBefore = JSON.stringify(
    mainStore.runtime.getLabelValue(mainStore.runtime.getModel(THREE_SCENE_CHILD_MODEL_ID), 0, 0, 0, 'scene_graph_v0'),
  );
  result = dispatchButton(galleryStore, 'gallery_three_create_button');
  const threeError = mainStore.runtime.getLabelValue(mainStore.runtime.getModel(-1), 0, 0, 1, 'ui_event_error');
  assert.equal(result?.result, 'error', 'gallery_three_create_button_must_fail_in_local_mode');
  assert.equal(result?.code, 'unsupported', 'gallery_three_create_button_must_use_existing_remote_only_boundary');
  assert.equal(threeError?.detail, 'three_scene_remote_only', 'gallery_three_create_button_must_report_three_scene_remote_only');
  assert.equal(
    JSON.stringify(mainStore.runtime.getLabelValue(mainStore.runtime.getModel(THREE_SCENE_CHILD_MODEL_ID), 0, 0, 0, 'scene_graph_v0')),
    sceneGraphBefore,
    'gallery_three_create_button_must_not_mutate_scene_graph_locally',
  );

  console.log('validate_gallery_matrix_three_local: PASS');
  process.exit(0);
} catch (err) {
  console.error('validate_gallery_matrix_three_local: FAIL');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
