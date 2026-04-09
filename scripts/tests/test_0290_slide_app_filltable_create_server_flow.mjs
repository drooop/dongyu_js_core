#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SLIDE_CREATOR_TRUTH_MODEL_ID = 1035;

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}` },
  };
  if (options.value !== undefined) payload.value = options.value;
  if (options.target !== undefined) payload.target = options.target;
  return {
    event_id: Date.now(),
    type: action,
    payload,
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0290-filltable-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0290_filltable_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
    await state.activateRuntimeMode('running');
    return await fn(state);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

async function test_filltable_create_materializes_workspace_app_and_delete_cleans_up() {
  return withServerState(async (state) => {
    const runtime = state.runtime;
    const creatorTruth = runtime.getModel(SLIDE_CREATOR_TRUTH_MODEL_ID);
    assert.ok(creatorTruth, 'slide_creator_truth_model_missing');

    runtime.addLabel(creatorTruth, 0, 0, 0, { k: 'create_app_name', t: 'str', v: 'Filltable Created App' });
    runtime.addLabel(creatorTruth, 0, 0, 0, { k: 'create_source_worker', t: 'str', v: 'filltable-create' });
    runtime.addLabel(creatorTruth, 0, 0, 0, { k: 'create_slide_surface_type', t: 'str', v: 'workspace.page' });
    runtime.addLabel(creatorTruth, 0, 0, 0, { k: 'create_headline', t: 'str', v: 'Created by Filltable' });
    runtime.addLabel(creatorTruth, 0, 0, 0, { k: 'create_body_text', t: 'str', v: 'This app came from the creator form.' });

    const createResult = await state.submitEnvelope(mailboxEnvelope('slide_app_create', {
      target: { model_id: SLIDE_CREATOR_TRUTH_MODEL_ID, p: 0, r: 0, c: 0, k: 'create_app_name' },
    }));
    assert.equal(createResult.result, 'ok', 'slide_app_create_must_be_accepted');
    await wait();

    const snapAfterCreate = state.clientSnap();
    const registry = snapAfterCreate.models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    const createdEntry = registry.find((entry) => entry && entry.name === 'Filltable Created App');
    assert.ok(createdEntry, 'created_filltable_app_missing_from_registry');
    assert.equal(createdEntry.slide_capable, true, 'created_filltable_app_must_be_slide_capable');
    assert.equal(createdEntry.slide_surface_type, 'workspace.page', 'created_filltable_app_must_publish_surface_type');
    assert.equal(createdEntry.delete_disabled, false, 'created_filltable_app_must_be_deletable');
    assert.equal(createdEntry.source, 'filltable-create', 'created_filltable_app_must_publish_source_worker');

    const createdModelId = createdEntry.model_id;
    const createdTruthId = createdModelId + 1;
    const createdRoot = snapAfterCreate.models[String(createdModelId)]?.cells?.['0,0,0']?.labels || {};
    assert.equal(createdRoot.app_name?.v, 'Filltable Created App', 'created_root_must_materialize_app_name');
    assert.equal(createdRoot.source_worker?.v, 'filltable-create', 'created_root_must_materialize_source_worker');
    assert.equal(createdRoot.slide_capable?.v, true, 'created_root_must_materialize_slide_capable');
    assert.equal(createdRoot.slide_surface_type?.v, 'workspace.page', 'created_root_must_materialize_surface_type');

    const createdTruth = snapAfterCreate.models[String(createdTruthId)]?.cells?.['0,0,0']?.labels || {};
    assert.equal(createdTruth.headline?.v, 'Created by Filltable', 'created_truth_must_materialize_headline');
    assert.equal(createdTruth.body_text?.v, 'This app came from the creator form.', 'created_truth_must_materialize_body_text');

    const createdBind = snapAfterCreate.models[String(createdModelId)]?.cells?.['2,3,0']?.labels?.ui_bind_json?.v;
    assert.equal(createdBind?.read?.model_id, createdTruthId, 'created_app_bind_read_model_id_must_point_to_created_truth');
    assert.equal(createdBind?.write?.target_ref?.model_id, createdTruthId, 'created_app_bind_write_model_id_must_point_to_created_truth');
    assert.equal(createdBind?.write?.commit_policy, 'on_blur', 'created_app_positive_input_must_use_on_blur_commit_policy');

    assert.equal(
      snapAfterCreate.models['-2']?.cells?.['0,0,0']?.labels?.ws_app_selected?.v,
      createdModelId,
      'creator_flow_must_select_new_app_after_create',
    );

    const deleteResult = await state.submitEnvelope(mailboxEnvelope('ws_app_delete', {
      value: { t: 'int', v: createdModelId },
    }));
    assert.equal(deleteResult.result, 'ok', 'delete_created_filltable_app_must_succeed');
    await wait();

    const snapAfterDelete = state.clientSnap();
    const registryAfterDelete = snapAfterDelete.models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    assert.ok(!registryAfterDelete.some((entry) => entry && entry.model_id === createdModelId), 'deleted_filltable_app_must_leave_registry');
    assert.equal(snapAfterDelete.models[String(createdModelId)], undefined, 'deleted_filltable_root_model_must_be_removed');
    assert.equal(snapAfterDelete.models[String(createdTruthId)], undefined, 'deleted_filltable_truth_model_must_be_removed');

    return { key: 'filltable_create_materializes_workspace_app_and_delete_cleans_up', status: 'PASS' };
  });
}

const tests = [
  test_filltable_create_materializes_workspace_app_and_delete_cleans_up,
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
