#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID } from '../../packages/ui-model-demo-frontend/src/model_ids.js';

const repoRoot = resolve(import.meta.dirname, '..', '..');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(resolve(repoRoot, relPath), 'utf8'));
}

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}`, model_id: options.modelId || WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID },
  };
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

function test_remote_mode_role_patches_cover_model1010() {
  const systemPatch = readJson('packages/worker-base/system-models/system_models.json').records || [];
  const mbrPatch = readJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json').records || [];
  const remoteCfg = readJson('deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json').records || [];
  const remoteTruth = readJson('deploy/sys-v1ns/remote-worker/patches/11_model1010.json').records || [];

  assert.ok(findRecord(systemPatch, (record) => record?.k === 'mbr_route_1010'), 'system_models_missing_mbr_route_1010');
  assert.ok(findRecord(mbrPatch, (record) => record?.k === 'mbr_mqtt_model_ids' && Array.isArray(record?.v) && record.v.includes(1010)), 'mbr_role_missing_1010_model_id');
  assert.ok(findRecord(remoteCfg, (record) => record?.k === 'remote_subscriptions' && Array.isArray(record?.v) && record.v.some((topic) => String(topic).endsWith('/1010/event')) && record.v.some((topic) => String(topic).endsWith('/1010/patch'))), 'remote_worker_config_missing_1010_topics');
  assert.ok(findRecord(remoteTruth, (record) => record?.model_id === 1010 && record?.k === 'patch_out_topic' && String(record?.v).endsWith('/1010/patch_out')), 'remote_truth_missing_patch_out_topic');
  return { key: 'remote_mode_role_patches_cover_model1010', status: 'PASS' };
}

async function test_remote_mode_submits_to_matrix_and_accepts_snapshot_delta_return() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0270-remote-mode-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0270_remote_mode_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');

  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });

  try {
    await state.activateRuntimeMode('running');
    const truth = state.runtime.getModel(WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID);
    state.runtime.addLabel(truth, 0, 0, 0, { k: 'input_draft', t: 'str', v: 'Gamma1' });

    const published = [];
    state.programEngine.matrixAdapter = {
      publish: async (payload) => {
        published.push(payload);
      },
      subscribe: () => () => {},
    };
    state.programEngine.matrixRoomId = '!test:example';
    state.programEngine.matrixDmPeerUserId = '@peer:example';

    const result = await state.submitEnvelope(mailboxEnvelope('submit', {
      opId: 'test_0270_remote_submit',
      modelId: WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID,
      value: { t: 'event', v: { action: 'submit', meta: { op_id: 'test_0270_remote_submit', model_id: WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID } } },
    }));
    assert.equal(result.result, 'ok', 'remote_submit_envelope_must_be_accepted');

    await wait();
    assert.equal(published.length, 1, 'remote_mode_must_publish_one_matrix_payload');
    assert.equal(published[0]?.source_model_id, WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID, 'remote_payload_must_preserve_source_model_id');
    assert.equal(published[0]?.action, 'submit', 'remote_payload_must_preserve_action');
    assert.equal(published[0]?.data?.input_value, 'Gamma1', 'remote_payload_must_use_truth_input_draft');

    const beforeReturn = state.clientSnap().models[String(WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID)].cells['0,0,0'].labels.result_status?.v;
    assert.equal(beforeReturn, 'loading', 'remote_submit_must_set_loading_status_before_return');

    state.programEngine.handleDyBusEvent({
      version: 'v0',
      type: 'snapshot_delta',
      op_id: 'test_0270_remote_return',
      payload: {
        version: 'mt.v0',
        op_id: 'test_0270_remote_return',
        records: [
          { op: 'add_label', model_id: WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID, p: 0, r: 0, c: 0, k: 'generated_color_text', t: 'str', v: '#123abc' },
          { op: 'add_label', model_id: WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID, p: 0, r: 0, c: 0, k: 'result_status', t: 'str', v: 'remote_processed' },
          { op: 'add_label', model_id: WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID, p: 0, r: 0, c: 0, k: 'submit_inflight', t: 'bool', v: false },
        ],
      },
    });
    await wait();

    const after = state.clientSnap().models[String(WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID)].cells['0,0,0'].labels;
    assert.equal(after.generated_color_text?.v, '#123abc', 'snapshot_delta_return_must_materialize_generated_color_text');
    assert.equal(after.result_status?.v, 'remote_processed', 'snapshot_delta_return_must_materialize_remote_status');
    assert.equal(after.submit_inflight?.v, false, 'snapshot_delta_return_must_clear_submit_inflight');
    return { key: 'remote_mode_submits_to_matrix_and_accepts_snapshot_delta_return', status: 'PASS' };
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
  test_remote_mode_role_patches_cover_model1010,
  test_remote_mode_submits_to_matrix_and_accepts_snapshot_delta_return,
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
