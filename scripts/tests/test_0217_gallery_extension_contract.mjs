#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import * as galleryStoreModule from '../../packages/ui-model-demo-frontend/src/gallery_store.js';
import {
  MATRIX_DEBUG_MODEL_ID,
  MODEL_100_ID,
  SLIDE_CREATOR_APP_MODEL_ID,
  SLIDE_CREATOR_TRUTH_MODEL_ID,
  SLIDE_IMPORTER_APP_MODEL_ID,
  SLIDE_IMPORTER_TRUTH_MODEL_ID,
  THREE_SCENE_APP_MODEL_ID,
  THREE_SCENE_CHILD_MODEL_ID,
  THREE_SCENE_CREATE_ENTITY_ACTION,
  THREE_SCENE_DELETE_ENTITY_ACTION,
  THREE_SCENE_SELECT_ENTITY_ACTION,
  THREE_SCENE_UPDATE_ENTITY_ACTION,
  UI_EXAMPLE_CHILD_MODEL_ID,
  UI_EXAMPLE_PAGE_ASSET_MODEL_ID,
  UI_EXAMPLE_PARENT_MODEL_ID,
  UI_EXAMPLE_PROMOTE_CHILD_ACTION,
  UI_EXAMPLE_SCHEMA_MODEL_ID,
} from '../../packages/ui-model-demo-frontend/src/model_ids.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function getPatchRecords(patch) {
  return Array.isArray(patch?.records) ? patch.records : [];
}

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

function walkAst(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) walkAst(child, visit);
}

function findNodeById(ast, id) {
  let found = null;
  walkAst(ast, (node) => {
    if (!found && node?.id === id) found = node;
  });
  return found;
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

const mainSource = readText('packages/ui-model-demo-frontend/src/main.js');
const demoAppSource = readText('packages/ui-model-demo-frontend/src/demo_app.js');
const galleryPatch = readJson('packages/worker-base/system-models/gallery_catalog_ui.json');

function test_gallery_store_exports_frozen_mode_alignment_and_upstream_contract() {
  const modeAlignment = galleryStoreModule.GALLERY_MODE_ALIGNMENT;
  const upstream = galleryStoreModule.GALLERY_INTEGRATION_CONTRACT;
  const pageAssetRef = galleryStoreModule.GALLERY_PAGE_ASSET_REF;

  assert.deepEqual(
    modeAlignment,
    {
      local: 'shared_runtime_gallery_mailbox',
      remote: 'shared_snapshot_dispatch',
      standalone: 'standalone_local_runtime',
    },
    'gallery_mode_alignment_must_be_frozen',
  );
  assert.deepEqual(
    pageAssetRef,
    { model_id: -103, p: 0, r: 1, c: 0, k: 'page_asset_v0' },
    'gallery_page_asset_ref_must_point_to_model_minus_103_page_asset_v0',
  );
  assert.deepEqual(
    upstream,
    {
      matrixDebug: {
        model_id: MATRIX_DEBUG_MODEL_ID,
        actions: ['matrix_debug_refresh', 'matrix_debug_clear_trace', 'matrix_debug_summarize'],
      },
      slideMainline: {
        model_ids: [
          MODEL_100_ID,
          SLIDE_IMPORTER_APP_MODEL_ID,
          SLIDE_IMPORTER_TRUTH_MODEL_ID,
          SLIDE_CREATOR_APP_MODEL_ID,
          SLIDE_CREATOR_TRUTH_MODEL_ID,
        ],
        actions: ['slide_app_import', 'slide_app_create'],
      },
      canonicalExamples: {
        model_ids: [
          UI_EXAMPLE_SCHEMA_MODEL_ID,
          UI_EXAMPLE_PAGE_ASSET_MODEL_ID,
          UI_EXAMPLE_PARENT_MODEL_ID,
          UI_EXAMPLE_CHILD_MODEL_ID,
        ],
        actions: [UI_EXAMPLE_PROMOTE_CHILD_ACTION],
      },
      threeScene: {
        model_ids: [THREE_SCENE_APP_MODEL_ID, THREE_SCENE_CHILD_MODEL_ID],
        actions: [
          THREE_SCENE_CREATE_ENTITY_ACTION,
          THREE_SCENE_SELECT_ENTITY_ACTION,
          THREE_SCENE_UPDATE_ENTITY_ACTION,
          THREE_SCENE_DELETE_ENTITY_ACTION,
        ],
      },
    },
    'gallery_upstream_contract_must_freeze_models_and_action_names',
  );
}

function test_gallery_store_local_mode_uses_shared_runtime_but_keeps_gallery_local_state_boundary() {
  const mainStore = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const galleryStore = galleryStoreModule.createGalleryStore({ sourceStore: mainStore });

  assert.equal(galleryStore.sourceMode, 'shared_runtime_gallery_mailbox', 'gallery_local_mode_must_be_shared_runtime');
  assert.equal(galleryStore.runtime, mainStore.runtime, 'gallery_local_mode_must_share_runtime');
  assert.equal(galleryStore.snapshot, mainStore.snapshot, 'gallery_local_mode_must_share_snapshot');
  assert.equal(typeof galleryStore.getUiAst, 'function', 'gallery_store_getUiAst_missing');
}

function test_gallery_store_remote_mode_delegates_to_authoritative_snapshot_dispatch() {
  const baseStore = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const calls = [];
  const remoteSourceStore = {
    snapshot: baseStore.snapshot,
    dispatchAddLabel(label) {
      calls.push({ type: 'add', label });
    },
    dispatchRmLabel(labelRef) {
      calls.push({ type: 'rm', labelRef });
    },
    consumeOnce() {
      calls.push({ type: 'consume' });
      return { consumed: false };
    },
  };

  const galleryStore = galleryStoreModule.createGalleryStore({ sourceStore: remoteSourceStore });
  assert.equal(galleryStore.sourceMode, 'shared_snapshot_dispatch', 'gallery_remote_mode_must_be_shared_snapshot_dispatch');
  assert.equal(galleryStore.runtime, null, 'gallery_remote_mode_must_not_create_isolated_runtime');
  assert.equal(galleryStore.snapshot, remoteSourceStore.snapshot, 'gallery_remote_mode_must_share_authoritative_snapshot');

  galleryStore.dispatchAddLabel({
    p: 0,
    r: 0,
    c: 1,
    k: 'ui_event',
    t: 'event',
    v: mailboxEnvelope('matrix_debug_refresh', {
      target: { model_id: -102, p: 0, r: 0, c: 0, k: 'matrix_debug_status_text' },
    }),
  });
  galleryStore.dispatchRmLabel({ p: 0, r: 0, c: 1, k: 'ui_event' });
  galleryStore.consumeOnce();

  assert.deepEqual(
    calls.map((entry) => entry.type),
    ['add', 'rm', 'consume'],
    'gallery_remote_mode_must_delegate_dispatch_to_shared_store',
  );
}

function test_main_entry_uses_single_gallery_source_strategy_for_local_and_remote() {
  assert.match(
    mainSource,
    /const galleryStore = createGalleryStore\(\{ sourceStore: store \}\);/,
    'main_local_gallery_store_must_bind_to_shared_source_store',
  );
  assert.equal(
    mainSource.includes('const galleryStore = createGalleryStore();'),
    false,
    'main_remote_gallery_store_must_not_boot_isolated_gallery_runtime',
  );
}

function test_app_shell_syncs_gallery_route_explicitly() {
  assert.match(
    demoAppSource,
    /galleryStore && typeof galleryStore\.setRoutePath === 'function'/,
    'app_shell_must_explicitly_sync_gallery_route',
  );
}

function test_gallery_patch_materializes_showcase_state_without_copying_upstream_truth() {
  const records = getPatchRecords(galleryPatch);
  const stateRecords = records.filter((record) => record?.model_id === -102 && record?.op === 'add_label');
  const galleryUiRecords = records.filter((record) => record?.model_id === -103 && record?.op === 'add_label');

  for (const labelKey of ['gallery_showcase_tab', 'gallery_examples_focus', 'gallery_three_focus']) {
    assert.ok(
      findRecord(stateRecords, (record) => record?.k === labelKey),
      `gallery_showcase_state_missing:${labelKey}`,
    );
  }

  for (const forbiddenKey of [
    'trace_log_text',
    'trace_count',
    'page_asset_v0',
    'scene_graph_v0',
    'camera_state_v0',
    'selected_entity_id',
    'scene_audit_log',
    'review_stage',
  ]) {
    assert.equal(
      Boolean(findRecord(stateRecords, (record) => record?.k === forbiddenKey)),
      false,
      `gallery_state_must_not_duplicate_upstream_truth:${forbiddenKey}`,
    );
  }

  assert.equal(
    findRecord(galleryUiRecords, (record) => record?.k === 'ui_authoring_version')?.v,
    'cellwise.ui.v1',
    'gallery_must_declare_cellwise_authoring',
  );
  assert.equal(
    findRecord(galleryUiRecords, (record) => record?.k === 'ui_root_node_id')?.v,
    'root',
    'gallery_root_node_id_must_stay_stable',
  );
  for (const nodeId of [
    'gallery_matrix_showcase_card',
    'gallery_examples_showcase_card',
    'gallery_three_showcase_card',
    'gallery_three_viewer',
    'gallery_examples_audit_terminal',
  ]) {
    assert.ok(
      findRecord(galleryUiRecords, (record) => record?.k === 'ui_node_id' && record?.v === nodeId),
      `gallery_ui_node_missing:${nodeId}`,
    );
  }

  const writeActions = new Set();
  const readModelIds = new Set();
  for (const record of galleryUiRecords) {
    const bind = record?.k === 'ui_bind_json' && record?.v && typeof record.v === 'object' ? record.v : null;
    const read = bind?.read;
    if (read && Number.isInteger(read.model_id)) readModelIds.add(read.model_id);
    const write = bind?.write;
    if (write && typeof write.action === 'string') writeActions.add(write.action);
  }

  for (const requiredAction of [
    'label_update',
    'matrix_debug_refresh',
    'matrix_debug_summarize',
    UI_EXAMPLE_PROMOTE_CHILD_ACTION,
    THREE_SCENE_CREATE_ENTITY_ACTION,
    THREE_SCENE_SELECT_ENTITY_ACTION,
    THREE_SCENE_UPDATE_ENTITY_ACTION,
    THREE_SCENE_DELETE_ENTITY_ACTION,
  ]) {
    assert.ok(writeActions.has(requiredAction), `gallery_showcase_action_missing:${requiredAction}`);
  }

  for (const requiredModelId of [
    -102,
    MATRIX_DEBUG_MODEL_ID,
    UI_EXAMPLE_PAGE_ASSET_MODEL_ID,
    UI_EXAMPLE_PARENT_MODEL_ID,
    UI_EXAMPLE_CHILD_MODEL_ID,
    THREE_SCENE_APP_MODEL_ID,
    THREE_SCENE_CHILD_MODEL_ID,
  ]) {
    assert.ok(readModelIds.has(requiredModelId), `gallery_showcase_read_ref_missing:${requiredModelId}`);
  }
}

const tests = [
  test_gallery_store_exports_frozen_mode_alignment_and_upstream_contract,
  test_gallery_store_local_mode_uses_shared_runtime_but_keeps_gallery_local_state_boundary,
  test_gallery_store_remote_mode_delegates_to_authoritative_snapshot_dispatch,
  test_main_entry_uses_single_gallery_source_strategy_for_local_and_remote,
  test_app_shell_syncs_gallery_route_explicitly,
  test_gallery_patch_materializes_showcase_state_without_copying_upstream_truth,
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
