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

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function payloadValue(packetOrRecords, key) {
  const records = Array.isArray(packetOrRecords)
    ? packetOrRecords
    : (Array.isArray(packetOrRecords?.payload) ? packetOrRecords.payload : []);
  return records.find((record) => record && record.k === key)?.v;
}

function assertStrictPinPacket(packet, message = 'packet') {
  assert.deepEqual(Object.keys(packet || {}).sort(), ['payload', 'type', 'version'], `${message}_must_only_expose_version_type_payload`);
  assert.equal(packet.version, 'v1', `${message}_must_be_v1`);
  assert.equal(packet.type, 'pin_payload', `${message}_must_use_pin_payload_transport`);
  assert.equal(Array.isArray(packet.payload), true, `${message}_payload_must_be_modeltable_records`);
  for (const forbidden of ['source_model_id', 'pin', 'route', 'reply_to', 'return_topic', 'returnTopic', 'result_topic']) {
    assert.equal(Object.hasOwn(packet, forbidden), false, `${message}_must_not_expose_${forbidden}`);
  }
}

function pinPayloadRecords({
  opId,
  messageRole = 'request',
  endpointWorkerId,
  endpointModelId,
  endpointPin,
  originWorkerId,
  originModelId,
  originPin,
  replyTargetWorkerId,
  replyTargetModelId,
  replyTargetPin,
  payloadRecords,
  timestamp = 1700000000000,
}) {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', originWorkerId),
    mt('origin_model_id', 'int', originModelId),
    mt('origin_pin', 'str', originPin),
    mt('reply_target_worker_id', 'str', replyTargetWorkerId),
    mt('reply_target_model_id', 'int', replyTargetModelId),
    mt('reply_target_pin', 'str', replyTargetPin),
    mt('payload', 'json', payloadRecords),
    mt('timestamp', 'int', timestamp),
  ];
}

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

function test_remote_mode_role_patches_cover_model1010() {
  const systemPatch = readJson('packages/worker-base/system-models/system_models.json').records || [];
  const mbrPatch = readJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json').records || [];
  const remoteCfg = readJson('deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json').records || [];
  const remoteTruth = readJson('deploy/sys-v1ns/remote-worker/patches/11_model1010.json').records || [];

  assert.equal(systemPatch.some((record) => String(record?.k || '').startsWith('mbr_route_')), false, 'system_models_must_not_seed_static_mbr_routes');
  assert.equal(mbrPatch.some((record) => record?.k === 'mbr_mqtt_model_ids'), false, 'mbr_role_must_not_seed_static_model_ids');
  assert.ok(findRecord(remoteCfg, (record) => record?.k === 'remote_subscriptions' && Array.isArray(record?.v) && record.v.includes('UIPUT/ws/dam/pic/de/R1/1010/submit')), 'remote_worker_config_missing_1010_route_topic');
  assert.ok(findRecord(remoteTruth, (record) => record?.model_id === 1010 && record?.k === 'mqtt_topic_base' && record?.v === 'UIPUT/ws/dam/pic/de'), 'remote_truth_missing_mqtt_topic_base');
  assert.equal(findRecord(remoteTruth, (record) => record?.model_id === 1010 && record?.k === 'result_out_topic'), null, 'remote_truth_must_not_use_static_result_out_topic');
  return { key: 'remote_mode_role_patches_cover_model1010', status: 'PASS' };
}

async function test_remote_mode_submits_to_matrix_and_accepts_pin_payload_return() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0270-remote-mode-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0270_remote_mode_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'ui-server-it0270';

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
    assertStrictPinPacket(published[0], 'remote_payload');
    assert.equal(payloadValue(published[0], '__mt_payload_kind'), 'pin_payload.v1', 'remote_payload_must_declare_pin_payload_v1');
    assert.equal(payloadValue(published[0], 'endpoint_worker_id'), 'R1', 'remote_payload_must_include_endpoint_worker');
    assert.equal(payloadValue(published[0], 'endpoint_model_id'), WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID, 'remote_payload_must_include_endpoint_model');
    assert.equal(payloadValue(published[0], 'endpoint_pin'), 'submit', 'remote_payload_must_use_submit_endpoint_pin');
    assert.equal(payloadValue(published[0], 'origin_worker_id'), 'ui-server-it0270', 'remote_payload_must_include_origin_worker');
    assert.equal(payloadValue(published[0], 'origin_model_id'), WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID, 'remote_payload_must_include_origin_model');
    assert.equal(payloadValue(published[0], 'origin_pin'), 'submit', 'remote_payload_must_include_origin_pin');
    assert.equal(payloadValue(published[0], 'reply_target_worker_id'), 'ui-server-it0270', 'remote_payload_must_include_reply_target_worker');
    assert.equal(payloadValue(published[0], 'reply_target_model_id'), WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID, 'remote_payload_must_include_reply_target_model');
    assert.equal(payloadValue(published[0], 'reply_target_pin'), 'result', 'remote_payload_must_include_reply_target_pin');
    assert.ok(Array.isArray(payloadValue(published[0], 'payload')), 'remote_payload_must_carry_temporary_modeltable_array');
    assert.ok(payloadValue(published[0], 'payload')?.some?.((record) => record && record.k === 'input_value' && record.v === 'Gamma1'), 'remote_payload_must_use_truth_input_draft');

    const beforeReturn = state.clientSnap().models[String(WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID)].cells['0,0,0'].labels.result_status?.v;
    assert.equal(beforeReturn, 'loading', 'remote_submit_must_set_loading_status_before_return');

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: pinPayloadRecords({
        opId: 'test_0270_remote_return',
        messageRole: 'response',
        endpointWorkerId: 'R1',
        endpointModelId: WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID,
        endpointPin: 'submit',
        originWorkerId: 'R1',
        originModelId: WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID,
        originPin: 'submit',
        replyTargetWorkerId: 'ui-server-it0270',
        replyTargetModelId: WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID,
        replyTargetPin: 'result',
        payloadRecords: [
        { id: 0, p: 0, r: 0, c: 0, k: 'generated_color_text', t: 'str', v: '#123abc' },
        { id: 0, p: 0, r: 0, c: 0, k: 'result_status', t: 'str', v: 'remote_processed' },
        { id: 0, p: 0, r: 0, c: 0, k: 'submit_inflight', t: 'bool', v: false },
        ],
      }),
    });
    await wait();

    const after = state.clientSnap().models[String(WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID)].cells['0,0,0'].labels;
    assert.equal(after.generated_color_text?.v, '#123abc', 'pin_payload_return_must_materialize_generated_color_text');
    assert.equal(after.result_status?.v, 'remote_processed', 'pin_payload_return_must_materialize_remote_status');
    assert.equal(after.submit_inflight?.v, false, 'pin_payload_return_must_clear_submit_inflight');
    return { key: 'remote_mode_submits_to_matrix_and_accepts_pin_payload_return', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.DY_UI_SERVER_WORKER_ID;
  }
}

const tests = [
  test_remote_mode_role_patches_cover_model1010,
  test_remote_mode_submits_to_matrix_and_accepts_pin_payload_return,
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
