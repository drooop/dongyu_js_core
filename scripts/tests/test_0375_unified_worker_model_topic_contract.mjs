#!/usr/bin/env node
// 0375 — executable contract for unified worker/model endpoint topics.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkerEngineV0 } from '../worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const repoRoot = new URL('../..', import.meta.url);

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function root(rt) {
  return rt.getModel(0);
}

function markDem(rt) {
  rt.addLabel(root(rt), 0, 0, 0, { k: 'sys_worker_role', t: 'worker.role', v: 'DEM' });
}

function configureUnifiedMqtt(rt, workerId = 'R1') {
  const model0 = root(rt);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de/sw' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: workerId });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
}

function pinPayloadRecords({
  opId = 'req_0375',
  endpointWorkerId = 'R1',
  endpointModelId = 3000,
  endpointPin = 'submit',
  originWorkerId = 'U1',
  originModelId = 2000,
  originPin = 'submit',
  replyTargetWorkerId = 'U1',
  replyTargetModelId = 2000,
  replyTargetPin = 'result',
  payload = [mt('text', 'str', 'hello')],
} = {}) {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', originWorkerId),
    mt('origin_model_id', 'int', originModelId),
    mt('origin_pin', 'str', originPin),
    mt('reply_target_worker_id', 'str', replyTargetWorkerId),
    mt('reply_target_model_id', 'int', replyTargetModelId),
    mt('reply_target_pin', 'str', replyTargetPin),
    mt('payload', 'json', payload),
    mt('timestamp', 'int', 1),
  ];
}

function legacyRoutePinPayloadRecords({
  opId = 'legacy_req_0375',
  sourceModelId = 2000,
  pin = 'submit',
  payload = [mt('text', 'str', 'hello')],
} = {}) {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('source_model_id', 'int', sourceModelId),
    mt('pin', 'str', pin),
    mt('payload', 'json', payload),
    mt('route', 'json', {
      to: { worker_id: 'R1', model_id: 3000, pin },
      reply_to: { worker_id: 'U1', model_id: sourceModelId, pin: 'result' },
    }),
  ];
}

function externalPacket(records) {
  return {
    version: 'v1',
    type: 'pin_payload',
    payload: records,
  };
}

function getPayloadLabel(records, key) {
  assert.equal(Array.isArray(records), true, `expected records array for ${key}`);
  return records.find((record) => record && record.k === key) || null;
}

function withoutRecords(records, keys) {
  const deny = new Set(keys);
  return records.filter((record) => !deny.has(record.k));
}

async function withServerState(fn) {
  const previous = {
    dyAuth: process.env.DY_AUTH,
    persistedAssetRoot: process.env.DY_PERSISTED_ASSET_ROOT,
    workerId: process.env.DY_UI_SERVER_WORKER_ID,
    workspace: process.env.WORKER_BASE_WORKSPACE,
    dataRoot: process.env.WORKER_BASE_DATA_ROOT,
    docsRoot: process.env.DOCS_ROOT,
    staticRoot: process.env.STATIC_PROJECTS_ROOT,
  };
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0375-server-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  process.env.WORKER_BASE_WORKSPACE = `it0375_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  try {
    const { createServerState } = await import(new URL('packages/ui-model-demo-server/server.mjs', repoRoot));
    const state = createServerState({ dbPath: null });
    await state.activateRuntimeMode('running');
    return await fn(state);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    const restore = (key, value) => {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    };
    restore('DY_AUTH', previous.dyAuth);
    restore('DY_PERSISTED_ASSET_ROOT', previous.persistedAssetRoot);
    restore('DY_UI_SERVER_WORKER_ID', previous.workerId);
    restore('WORKER_BASE_WORKSPACE', previous.workspace);
    restore('WORKER_BASE_DATA_ROOT', previous.dataRoot);
    restore('DOCS_ROOT', previous.docsRoot);
    restore('STATIC_PROJECTS_ROOT', previous.staticRoot);
  }
}

async function test_runtime_topic_for_builds_unified_worker_model_topic() {
  const rt = new ModelTableRuntime();
  configureUnifiedMqtt(rt, 'R1');

  const topic = rt._topicFor(3000, 'submit', 'in');

  assert.equal(topic, 'UIPUT/ws/dam/pic/de/sw/R1/3000/submit');
  return { key: 'runtime_topic_for_builds_unified_worker_model_topic', status: 'PASS' };
}

async function test_runtime_mqtt_incoming_accepts_unified_endpoint_topic_without_loose_pin() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model = rt.createModel({ id: 3000, name: 'it0375_remote_model', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const records = pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' });
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/R1/3000/submit', externalPacket(records));
  const stored = model.getCell(0, 0, 0).labels.get('submit');

  assert.equal(accepted, true, 'unified 9-segment endpoint topic must be accepted');
  assert.equal(stored?.t, 'pin.in', 'endpoint pin must be written as pin.in');
  assert.deepEqual(stored?.v, records, 'incoming value must remain Temporary ModelTable records');
  assert.equal(getPayloadLabel(stored.v, 'endpoint_worker_id')?.v, 'R1');
  assert.equal(getPayloadLabel(stored.v, 'endpoint_model_id')?.v, 3000);
  assert.equal(getPayloadLabel(stored.v, 'endpoint_pin')?.v, 'submit');
  return { key: 'runtime_mqtt_incoming_accepts_unified_endpoint_topic_without_loose_pin', status: 'PASS' };
}

async function test_runtime_rejects_legacy_worker_model_pin_topic_even_with_legacy_packet() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model = rt.createModel({ id: 3000, name: 'it0375_old_topic_model', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/worker/R1/model/3000/pin/submit', {
    version: 'v1',
    type: 'pin_payload',
    pin: 'submit',
    source_model_id: 2000,
    payload: pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }),
  });

  assert.equal(accepted, false, 'old worker/model/pin topic must fail closed');
  assert.equal(model.getCell(0, 0, 0).labels.get('submit'), undefined, 'old topic must not write endpoint pin');
  assert.equal(
    rt.mqttTrace.list().some((entry) => entry.type === 'inbound_rejected' && entry.payload?.reason === 'worker_model_pin_topic_removed'),
    true,
    'old topic rejection must be traceable',
  );
  return { key: 'runtime_rejects_legacy_worker_model_pin_topic_even_with_legacy_packet', status: 'PASS' };
}

async function test_runtime_rejects_missing_extra_and_old_two_segment_topic_forms() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model = rt.createModel({ id: 3000, name: 'it0375_topic_boundaries', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const packet = externalPacket(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }));
  const missing = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/R1/3000', packet);
  const extra = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/R1/3000/submit/extra', packet);
  const oldTwoSegment = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/3000/submit', packet);

  assert.equal(missing, false, 'missing pin segment must fail closed');
  assert.equal(extra, false, 'extra segment must fail closed');
  assert.equal(oldTwoSegment, false, 'old model/pin two-segment form must fail closed');
  assert.equal(model.getCell(0, 0, 0).labels.get('submit'), undefined, 'invalid topic forms must not write endpoint pin');
  assert.equal(
    rt.mqttTrace.list().filter((entry) => entry.type === 'inbound_rejected' && entry.payload?.reason === 'invalid_unified_endpoint_topic').length >= 3,
    true,
    'invalid topic forms must be traceable',
  );
  return { key: 'runtime_rejects_missing_extra_and_old_two_segment_topic_forms', status: 'PASS' };
}

async function test_runtime_rejects_loose_top_level_fields_on_unified_topic() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model = rt.createModel({ id: 3000, name: 'it0375_loose_fields_model', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/R1/3000/submit', {
    version: 'v1',
    type: 'pin_payload',
    pin: 'submit',
    source_model_id: 2000,
    route: {
      to: { worker_id: 'R1', model_id: 3000, pin: 'submit' },
      reply_to: { worker_id: 'U1', model_id: 2000, pin: 'result' },
    },
    payload: pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }),
  });

  assert.equal(accepted, false, 'new unified topic must still reject loose top-level pin/source_model_id/route');
  assert.equal(model.getCell(0, 0, 0).labels.get('submit'), undefined, 'loose top-level payload must not write endpoint pin');
  assert.equal(
    rt.mqttTrace.list().some((entry) => entry.type === 'inbound_rejected' && entry.payload?.reason === 'loose_pin_payload_fields_removed'),
    true,
    'loose field rejection must be traceable',
  );
  return { key: 'runtime_rejects_loose_top_level_fields_on_unified_topic', status: 'PASS' };
}

async function assertMissingMetadataRejected({ missingKey, label }) {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model = rt.createModel({ id: 3000, name: `it0375_missing_${missingKey}`, type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const missing = withoutRecords(pinPayloadRecords(), [missingKey]);
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/R1/3000/submit', externalPacket(missing));

  assert.equal(accepted, false, `pin_payload.v1 must reject missing ${label}`);
  assert.equal(model.getCell(0, 0, 0).labels.get('submit'), undefined, `missing ${label} must not write endpoint pin`);
  assert.equal(
    rt.mqttTrace.list().some((entry) => entry.type === 'inbound_rejected' && entry.payload?.reason === 'invalid_pin_payload_records'),
    true,
    `missing ${label} rejection must be traceable`,
  );
}

async function test_runtime_rejects_missing_endpoint_records() {
  await assertMissingMetadataRejected({ missingKey: 'endpoint_worker_id', label: 'endpoint metadata' });
  return { key: 'runtime_rejects_missing_endpoint_records', status: 'PASS' };
}

async function test_runtime_rejects_missing_origin_records() {
  await assertMissingMetadataRejected({ missingKey: 'origin_model_id', label: 'origin metadata' });
  return { key: 'runtime_rejects_missing_origin_records', status: 'PASS' };
}

async function test_runtime_rejects_missing_reply_target_records() {
  await assertMissingMetadataRejected({ missingKey: 'reply_target_model_id', label: 'reply target metadata' });
  return { key: 'runtime_rejects_missing_reply_target_records', status: 'PASS' };
}

async function test_pin_bus_externalization_rejects_legacy_route_payload_records() {
  const rt = new ModelTableRuntime();
  const packet = rt._pinBusOutValueToExternalPayload(legacyRoutePinPayloadRecords());

  assert.equal(packet, null, 'externalization must reject legacy source_model_id/pin/route records');
  return { key: 'pin_bus_externalization_rejects_legacy_route_payload_records', status: 'PASS' };
}

async function test_pin_bus_externalization_uses_only_record_array_payload_metadata() {
  const rt = new ModelTableRuntime();
  const records = pinPayloadRecords({ opId: 'req_0375_externalize' });
  const packet = rt._pinBusOutValueToExternalPayload(records);

  assert.ok(packet, 'valid endpoint/origin/reply target records must externalize');
  assert.deepEqual(Object.keys(packet).sort(), ['payload', 'type', 'version'], 'transport packet must expose only version/type/payload at top level');
  assert.equal(packet.version, 'v1');
  assert.equal(packet.type, 'pin_payload');
  assert.deepEqual(packet.payload, records);
  assert.equal(Object.prototype.hasOwnProperty.call(packet, 'op_id'), false, 'transport packet must not carry loose op_id');
  assert.equal(Object.prototype.hasOwnProperty.call(packet, 'pin'), false, 'transport packet must not carry loose pin');
  assert.equal(Object.prototype.hasOwnProperty.call(packet, 'source_model_id'), false, 'transport packet must not carry loose source_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(packet, 'route'), false, 'transport packet must not carry legacy route');
  return { key: 'pin_bus_externalization_uses_only_record_array_payload_metadata', status: 'PASS' };
}

async function test_split_bus_out_accepts_endpoint_records_and_rejects_route_record() {
  const rt = new ModelTableRuntime();
  markDem(rt);
  const model0 = root(rt);

  const valid = rt.addLabel(model0, 0, 0, 0, {
    k: 'valid_endpoint_out',
    t: 'pin.bus.cb.out',
    v: pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }),
  });
  const withRoute = pinPayloadRecords({ opId: 'req_0375_route' }).concat([
    mt('route', 'json', { to: { worker_id: 'R1', model_id: 3000, pin: 'submit' } }),
  ]);
  const legacy = rt.addLabel(model0, 0, 0, 0, {
    k: 'legacy_route_out',
    t: 'pin.bus.cb.out',
    v: withRoute,
  });

  assert.equal(valid.applied, true, 'split bus out must accept endpoint_* records without route.to');
  assert.equal(legacy.applied, false, 'split bus out must reject legacy route records');
  assert.equal(model0.getCell(0, 0, 0).labels.has('legacy_route_out'), false, 'legacy route payload must not be stored');
  return { key: 'split_bus_out_accepts_endpoint_records_and_rejects_route_record', status: 'PASS' };
}

async function test_worker_engine_publishes_control_bus_to_unified_endpoint_topic() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  markDem(rt);
  configureUnifiedMqtt(rt, 'R1');
  const model0 = root(rt);
  const published = [];
  const engine = new WorkerEngineV0({
    runtime: rt,
    mqttPublish: (topic, payload) => published.push({ topic, payload }),
  });

  rt.addLabel(model0, 0, 0, 0, {
    k: 'send_to_remote',
    t: 'pin.bus.cb.out',
    v: pinPayloadRecords({ opId: 'req_0375_publish', endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }),
  });
  await rt.setRuntimeMode('running');
  engine.tick();

  assert.equal(published.length, 1, 'control bus out must publish exactly once');
  assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/sw/R1/3000/submit');
  assert.equal(Object.prototype.hasOwnProperty.call(published[0].payload, 'pin'), false, 'transport packet must not carry loose pin');
  assert.equal(Object.prototype.hasOwnProperty.call(published[0].payload, 'source_model_id'), false, 'transport packet must not carry loose source_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(published[0].payload, 'route'), false, 'transport packet must not carry legacy route');
  assert.deepEqual(published[0].payload.payload, pinPayloadRecords({ opId: 'req_0375_publish', endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }));
  return { key: 'worker_engine_publishes_control_bus_to_unified_endpoint_topic', status: 'PASS' };
}

async function test_server_pin_payload_return_materializes_by_reply_target_records() {
  await withServerState(async (state) => {
    const endpointModelId = 1054;
    const replyTargetModelId = 1055;
    const endpointModel = state.runtime.createModel({ id: endpointModelId, name: 'it0375_wrong_endpoint_target', type: 'test' });
    const replyTargetModel = state.runtime.createModel({ id: replyTargetModelId, name: 'it0375_return_target', type: 'test' });
    for (const model of [endpointModel, replyTargetModel]) {
      state.runtime.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });
      state.runtime.addLabel(model, 0, 0, 0, { k: 'dual_bus_model', t: 'json', v: { mode: 'imported_host_egress', egress_pins: ['submit'] } });
    }

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: pinPayloadRecords({
        opId: 'req_0375_result',
        endpointWorkerId: 'U1',
        endpointModelId,
        endpointPin: 'result',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit',
        replyTargetWorkerId: 'U1',
        replyTargetModelId,
        replyTargetPin: 'result',
        payload: [mt('display_text', 'str', 'Submitted: hello')],
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(replyTargetModel, 0, 0, 0).labels.get('display_text')?.v,
      'Submitted: hello',
      'return path must materialize payload into reply_target_model_id',
    );
    assert.equal(
      state.runtime.getCell(endpointModel, 0, 0, 0).labels.get('display_text'),
      undefined,
      'return path must not materialize by endpoint_model_id when reply target differs',
    );
  });
  return { key: 'server_pin_payload_return_materializes_by_reply_target_records', status: 'PASS' };
}

async function test_server_pin_payload_result_without_reply_target_is_rejected() {
  await withServerState(async (state) => {
    const targetModelId = 1056;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_missing_reply_target', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'dual_bus_model', t: 'json', v: { mode: 'imported_host_egress', egress_pins: ['submit'] } });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: withoutRecords(pinPayloadRecords({
        opId: 'req_0375_missing_reply',
        endpointWorkerId: 'U1',
        endpointModelId: targetModelId,
        endpointPin: 'result',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit',
        replyTargetWorkerId: 'U1',
        replyTargetModelId: targetModelId,
        replyTargetPin: 'result',
        payload: [mt('display_text', 'str', 'must_not_write')],
      }), ['reply_target_worker_id', 'reply_target_model_id', 'reply_target_pin']),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('display_text'),
      undefined,
      'pin=result without reply target records must not materialize into UI model',
    );
  });
  return { key: 'server_pin_payload_result_without_reply_target_is_rejected', status: 'PASS' };
}

const tests = [
  test_runtime_topic_for_builds_unified_worker_model_topic,
  test_runtime_mqtt_incoming_accepts_unified_endpoint_topic_without_loose_pin,
  test_runtime_rejects_legacy_worker_model_pin_topic_even_with_legacy_packet,
  test_runtime_rejects_missing_extra_and_old_two_segment_topic_forms,
  test_runtime_rejects_loose_top_level_fields_on_unified_topic,
  test_runtime_rejects_missing_endpoint_records,
  test_runtime_rejects_missing_origin_records,
  test_runtime_rejects_missing_reply_target_records,
  test_pin_bus_externalization_rejects_legacy_route_payload_records,
  test_pin_bus_externalization_uses_only_record_array_payload_metadata,
  test_split_bus_out_accepts_endpoint_records_and_rejects_route_record,
  test_worker_engine_publishes_control_bus_to_unified_endpoint_topic,
  test_server_pin_payload_return_materializes_by_reply_target_records,
  test_server_pin_payload_result_without_reply_target_is_rejected,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      const result = await t();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (err) {
      console.log(`[FAIL] ${t.name}: ${err.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
