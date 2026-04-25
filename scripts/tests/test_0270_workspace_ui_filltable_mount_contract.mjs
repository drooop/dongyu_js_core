#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs';

import {
  EDITOR_STATE_MODEL_ID,
  WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID,
  WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID,
} from '../../packages/ui-model-demo-frontend/src/model_ids.js';

const repoRoot = resolve(import.meta.dirname, '..', '..');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(resolve(repoRoot, relPath), 'utf8'));
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

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

function test_workspace_filltable_example_is_registered_for_workspace_mount() {
  const positive = readJson('packages/worker-base/system-models/workspace_positive_models.json').records || [];
  const hierarchy = readJson('packages/worker-base/system-models/runtime_hierarchy_mounts.json').records || [];

  assert.ok(findRecord(positive, (record) => (
    record?.model_id === -2
    && record?.k === 'ws_apps_registry'
    && Array.isArray(record?.v)
    && record.v.some((entry) => entry?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID)
  )), 'workspace_registry_missing_0270_entry');

  assert.ok(findRecord(hierarchy, (record) => (
    record?.model_id === 0
    && record?.t === 'model.submt'
    && record?.v === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
  )), 'model0_missing_0270_app_mount');

  assert.ok(findRecord(positive, (record) => (
    record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    && record?.k === 'model_type'
    && record?.t === 'model.submt'
    && record?.v === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID
  )), 'app_host_missing_truth_submt');

  return { key: 'workspace_filltable_example_is_registered_for_workspace_mount', status: 'PASS' };
}

async function test_home_save_label_can_create_positive_model_from_root_model_type() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0270-home-create-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0270_home_create_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');

  const targetModelId = 19090;
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });

  try {
    await state.activateRuntimeMode('running');
    const result = await state.submitEnvelope(mailboxEnvelope('home_save_label', {
      opId: 'test_0270_home_create_positive_model',
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_model_id' },
      value: {
        model_id: targetModelId,
        p: 0,
        r: 0,
        c: 0,
        k: 'model_type',
        t: 'model.table',
        value_text: 'UI.RebuildExample',
      },
    }));
    assert.equal(result.result, 'ok', 'home_save_label_must_accept_create_root_model_type');

    const snap = state.clientSnap();
    const created = snap.models[String(targetModelId)];
    assert.ok(created, 'positive_model_must_be_created_by_home_save_label');
    assert.equal(created.cells['0,0,0'].labels.model_type?.t, 'model.table', 'created_model_root_must_materialize_model_type');
    assert.equal(created.cells['0,0,0'].labels.model_type?.v, 'UI.RebuildExample', 'created_model_root_must_preserve_model_type_value');
    return { key: 'home_save_label_can_create_positive_model_from_root_model_type', status: 'PASS' };
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
  test_workspace_filltable_example_is_registered_for_workspace_mount,
  test_home_save_label_can_create_positive_model_from_root_model_type,
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
      console.log(`[FAIL] ${test.name}: ${error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
