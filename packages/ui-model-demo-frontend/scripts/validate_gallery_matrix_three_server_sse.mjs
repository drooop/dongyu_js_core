#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reactive } from 'vue';

import { createGalleryStore } from '../src/gallery_store.js';
import {
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
  return label;
}

const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0217-gallery-server-'));

process.env.DY_AUTH = '0';
process.env.WORKER_BASE_WORKSPACE = `it0217_gallery_server_${Date.now()}`;
process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
process.env.DOCS_ROOT = join(tempRoot, 'docs');
process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

const { createServerState } = await import(new URL('../../ui-model-demo-server/server.mjs', import.meta.url));
const state = createServerState({ dbPath: null });

try {
  const snapshot = reactive(state.clientSnap());
  const refreshSnapshot = () => {
    const next = state.clientSnap();
    snapshot.models = next.models;
    snapshot.v1nConfig = next.v1nConfig;
  };

  const remoteSourceStore = {
    snapshot,
    async dispatchAddLabel(label) {
      const result = await state.submitEnvelope(label.v);
      refreshSnapshot();
      return result;
    },
    dispatchRmLabel() {
      return undefined;
    },
    consumeOnce() {
      refreshSnapshot();
      return { consumed: false };
    },
  };

  const galleryStore = createGalleryStore({ sourceStore: remoteSourceStore });
  await state.activateRuntimeMode('running');
  refreshSnapshot();

  let label = dispatchButton(galleryStore, 'gallery_matrix_refresh_button');
  let result = await galleryStore.dispatchAddLabel(label);
  galleryStore.consumeOnce();
  assert.equal(result?.result, 'ok', 'gallery_matrix_refresh_button_must_succeed_remotely');
  assert.match(
    String(state.clientSnap()?.models?.['-2']?.cells?.['0,0,0']?.labels?.matrix_debug_status_text?.v || ''),
    /refresh:/,
    'gallery_matrix_refresh_button_must_use_authoritative_matrix_debug_path',
  );

  label = dispatchButton(galleryStore, 'gallery_examples_promote_button');
  result = await galleryStore.dispatchAddLabel(label);
  galleryStore.consumeOnce();
  assert.equal(result?.result, 'ok', 'gallery_examples_promote_button_must_succeed_remotely');
  assert.equal(
    state.clientSnap()?.models?.[String(UI_EXAMPLE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.review_stage?.v,
    'review',
    'gallery_examples_promote_button_must_mutate_authoritative_child_review_stage',
  );

  label = dispatchButton(galleryStore, 'gallery_three_create_button');
  result = await galleryStore.dispatchAddLabel(label);
  galleryStore.consumeOnce();
  assert.equal(result?.result, 'ok', 'gallery_three_create_button_must_succeed_remotely');
  const entities = state.clientSnap()?.models?.[String(THREE_SCENE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.scene_graph_v0?.v?.entities;
  assert(Array.isArray(entities) && entities.some((entity) => entity?.id === 'sphere-2'), 'gallery_three_create_button_must_mutate_authoritative_scene_graph');

  console.log('validate_gallery_matrix_three_server_sse: PASS');
  process.exit(0);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  delete process.env.WORKER_BASE_WORKSPACE;
  delete process.env.WORKER_BASE_DATA_ROOT;
  delete process.env.DOCS_ROOT;
  delete process.env.STATIC_PROJECTS_ROOT;
}
