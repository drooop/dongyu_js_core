#!/usr/bin/env node
// 0375 — executable contract for unified worker/model endpoint topics.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkerEngineV0 } from '../worker_engine_v0.mjs';
import { validateUnifiedEndpointTopicPacket, validateUnifiedMatrixEventPacket } from '../run_worker_v0.mjs';

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
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de' });
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
  messageRole = 'request',
  topic = null,
  responseTopic = null,
  payload = [mt('text', 'str', 'hello')],
} = {}) {
  const routeTopic = typeof topic === 'string' && topic.length > 0
    ? topic
    : `UIPUT/ws/dam/pic/de/${endpointWorkerId}/${endpointModelId}/${endpointPin}`;
  const routeResponseTopic = typeof responseTopic === 'string' && responseTopic.length > 0
    ? responseTopic
    : `UIPUT/ws/dam/pic/de/${replyTargetWorkerId}/${replyTargetModelId}/${replyTargetPin}`;
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('topic', 'str', routeTopic),
    mt('response_topic', 'str', routeResponseTopic),
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

function readPayloadValue(records, key) {
  const record = getPayloadLabel(records, key);
  return record ? record.v : undefined;
}

const removedReturnTopicKeys = ['return_topic', 'returnTopic', 'result_topic'];

function legacyReplyToRecord(key = 'reply_to') {
  return mt(key, 'json', { worker_id: 'U1', model_id: 2000, pin: 'result' });
}

function legacyReturnTopicRecord(key = 'return_topic') {
  return mt(key, 'str', 'UIPUT/ws/dam/pic/de/U1/2000/result');
}

function nestedLegacyPayloadRecords(key = 'source_model_id') {
  return pinPayloadRecords({
    opId: `req_0375_nested_${key.replaceAll('.', '_')}`,
    payload: [mt(key, key === 'source_model_id' ? 'int' : 'str', key === 'source_model_id' ? 2000 : 'legacy')],
  });
}

function deeplyNestedLegacyRecord(depth = 24, key = 'source_model_id') {
  let value = mt(key, key === 'source_model_id' ? 'int' : 'str', key === 'source_model_id' ? 2000 : 'legacy');
  for (let index = 0; index < depth; index += 1) {
    value = [mt(`nest_${index}`, 'json', value)];
  }
  return value;
}

function plainJsonLegacyPayloadRecords(key = 'source_model_id') {
  const legacyValue = key === 'source_model_id'
    ? 2000
    : (key === 'route' ? { to: { worker_id: 'R1', model_id: 3000, pin: 'submit' } } : 'legacy');
  return pinPayloadRecords({
    opId: `req_0375_plain_json_${key}`,
    payload: [mt('plain_json_legacy', 'json', { meta: { [key]: legacyValue } })],
  });
}

function withLegacyOwnProperty(records, key = 'source_model_id') {
  const legacyValue = key === 'source_model_id'
    ? 2000
    : (key === 'route' ? { to: { worker_id: 'R1', model_id: 3000, pin: 'submit' } } : 'legacy');
  return records.map((record, index) => index === 1 ? { ...record, [key]: legacyValue } : record);
}

function withRecordOverride(records, key, patch) {
  return records.map((record) => record.k === key ? { ...record, ...patch } : record);
}

function withoutRecords(records, keys) {
  const deny = new Set(keys);
  return records.filter((record) => !deny.has(record.k));
}

function withDuplicateRecord(records, key, patch = {}) {
  const record = records.find((item) => item && item.k === key);
  assert.ok(record, `missing record for duplicate ${key}`);
  return records.concat([{ ...record, ...patch }]);
}

function providerBundleResponsePayload() {
  return [
    mt('__mt_payload_kind', 'str', 'slide_app_bundle_response.v1'),
    mt('__mt_request_id', 'str', 'req_0389_provider_bundle'),
    mt('asset_id', 'str', 'r1-minimal-submit'),
    mt('bundle_payload', 'json', [
      mt('app_name', 'str', '最小 Submit 双总线示例'),
      mt('slide_capable', 'bool', true),
      mt('model_type', 'model.table', 'UI.MinimalSubmitDualBusZip'),
      { id: 0, p: 2, r: 3, c: 0, k: 'ui_component', t: 'str', v: 'Button' },
      {
        id: 0,
        p: 2,
        r: 3,
        c: 0,
        k: 'ui_bind_json',
        t: 'json',
        v: {
          write: {
            pin: 'click_event',
            value_t: 'modeltable',
            commit_policy: 'immediate',
          },
        },
      },
    ]),
  ];
}

function malformedPinPayloadV1Records() {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('payload', 'json', [mt('text', 'str', 'missing_endpoint_metadata')]),
  ];
}

function pinPayloadNamespaceKindRecords(kind) {
  return [
    mt('__mt_payload_kind', 'str', kind),
    mt('payload', 'json', [mt('text', 'str', 'must_not_store_malformed_kind')]),
  ];
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

  assert.equal(topic, 'UIPUT/ws/dam/pic/de/R1/3000/submit');
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
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3000/submit', externalPacket(records));
  const stored = model.getCell(0, 0, 0).labels.get('submit');

  assert.equal(accepted, true, 'unified 9-segment endpoint topic must be accepted');
  assert.equal(stored?.t, 'pin.in', 'endpoint pin must be written as pin.in');
  assert.deepEqual(stored?.v, records, 'incoming value must remain Temporary ModelTable records');
  assert.equal(getPayloadLabel(stored.v, 'endpoint_worker_id')?.v, 'R1');
  assert.equal(getPayloadLabel(stored.v, 'endpoint_model_id')?.v, 3000);
  assert.equal(getPayloadLabel(stored.v, 'endpoint_pin')?.v, 'submit');
  return { key: 'runtime_mqtt_incoming_accepts_unified_endpoint_topic_without_loose_pin', status: 'PASS' };
}

async function test_runtime_mqtt_incoming_ignores_response_role_on_endpoint_topic() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model = rt.createModel({ id: 3000, name: 'it0375_remote_response_echo', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3000/submit', externalPacket(pinPayloadRecords({
    messageRole: 'response',
    endpointWorkerId: 'R1',
    endpointModelId: 3000,
    endpointPin: 'submit',
    originWorkerId: 'R1',
    originModelId: 3000,
    originPin: 'submit',
    replyTargetWorkerId: 'U1',
    replyTargetModelId: 2000,
    replyTargetPin: 'result',
    payload: [mt('display_text', 'str', 'must_not_retrigger_remote')],
  })));

  assert.equal(accepted, false, 'remote runtime must ignore response packets echoed on its endpoint topic');
  assert.equal(model.getCell(0, 0, 0).labels.get('submit'), undefined, 'response echo must not trigger submit again');
  assert.equal(
    rt.mqttTrace.list().some((entry) => entry.type === 'inbound_rejected' && entry.payload?.reason === 'invalid_pin_payload_records'),
    true,
    'rejected response echo must be traceable',
  );
  return { key: 'runtime_mqtt_incoming_ignores_response_role_on_endpoint_topic', status: 'PASS' };
}

async function test_runtime_rejects_legacy_worker_model_pin_topic_even_with_legacy_packet() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model = rt.createModel({ id: 3000, name: 'it0375_old_topic_model', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const accepted = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/worker/R1/model/3000/pin/submit',
    externalPacket(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' })),
  );

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
  const missing = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3000', packet);
  const extra = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3000/submit/extra', packet);
  const oldTwoSegment = rt.mqttIncoming('UIPUT/ws/dam/pic/de/3000/submit', packet);

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

async function test_runtime_rejects_short_base_unified_topic_shape() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model0 = root(rt);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: 'R1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
  const model = rt.createModel({ id: 3000, name: 'it0375_short_base_topic', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const accepted = rt.mqttIncoming('UIPUT/R1/3000/submit', externalPacket(pinPayloadRecords({
    endpointWorkerId: 'R1',
    endpointModelId: 3000,
    endpointPin: 'submit',
  })));

  assert.equal(accepted, false, 'runtime must reject topics that do not have the full UIPUT/ws/dam/pic/de/<worker>/<model>/<pin> shape');
  assert.equal(model.getCell(0, 0, 0).labels.get('submit'), undefined, 'short-base topic must not write endpoint pin');
  return { key: 'runtime_rejects_short_base_unified_topic_shape', status: 'PASS' };
}

async function test_runtime_rejects_model0_and_invalid_model_endpoint_topics() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model0 = root(rt);
  const model3001 = rt.createModel({ id: 3001, name: 'it0375_endpoint_mismatch_target', type: 'test' });
  rt.addLabel(model0, 0, 0, 0, { k: 'inbox', t: 'pin.bus.cb.in', v: null });
  rt.addLabel(model3001, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const packet = externalPacket(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'inbox' }));
  const model0Accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/0/inbox', packet);
  const nonIntegerAccepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/not-a-model/inbox', packet);
  const mismatchAccepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3001/inbox', packet);

  assert.equal(model0Accepted, false, 'unified endpoint topic must reject model_id=0 and must not enter Model 0 bus.in directly');
  assert.equal(nonIntegerAccepted, false, 'unified endpoint topic must reject non-integer model_id');
  assert.equal(mismatchAccepted, false, 'unified endpoint topic must reject topic/payload endpoint model mismatch');
  assert.equal(model0.getCell(0, 0, 0).labels.get('inbox')?.v ?? null, null, 'rejected model_id=0 topic must not overwrite Model 0 bus.in value');
  return { key: 'runtime_rejects_model0_and_invalid_model_endpoint_topics', status: 'PASS' };
}

async function test_runtime_rejects_nonnormalized_model_id_topic_segments() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model1000 = rt.createModel({ id: 1000, name: 'it0375_nonnormalized_topic_target', type: 'test' });
  rt.addLabel(model1000, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  for (const segment of ['1e3', '01000', '1000.0', '0x3e8']) {
    const accepted = rt.mqttIncoming(
      `UIPUT/ws/dam/pic/de/R1/${segment}/submit`,
      externalPacket(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 1000, endpointPin: 'submit', opId: `req_0375_${segment}` })),
    );
    assert.equal(accepted, false, `unified endpoint topic must reject non-canonical model_id segment ${segment}`);
  }
  assert.equal(model1000.getCell(0, 0, 0).labels.get('submit'), undefined, 'non-canonical topic segments must not write endpoint pin');
  return { key: 'runtime_rejects_nonnormalized_model_id_topic_segments', status: 'PASS' };
}

async function test_runtime_rejects_loose_top_level_fields_on_unified_topic() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model = rt.createModel({ id: 3000, name: 'it0375_loose_fields_model', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3000/submit', {
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

async function test_runtime_rejects_unknown_top_level_fields_on_unified_topic() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model = rt.createModel({ id: 3000, name: 'it0375_unknown_top_level_model', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3000/submit', {
    ...externalPacket(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' })),
    reply_to: { worker_id: 'U1', model_id: 2000, pin: 'result' },
  });

  assert.equal(accepted, false, 'pin_payload transport packet must reject any top-level key beyond version/type/payload');
  assert.equal(model.getCell(0, 0, 0).labels.get('submit'), undefined, 'extra top-level fields must not write endpoint pin');
  assert.equal(
    rt.mqttTrace.list().some((entry) => entry.type === 'inbound_rejected' && entry.payload?.reason === 'loose_pin_payload_fields_removed'),
    true,
    'unknown top-level field rejection must be traceable',
  );
  return { key: 'runtime_rejects_unknown_top_level_fields_on_unified_topic', status: 'PASS' };
}

async function test_runtime_rejects_removed_topic_modes() {
  const records = pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' });

  const stage2 = new ModelTableRuntime();
  await stage2.setRuntimeMode('edit');
  const stage2Model = stage2.createModel({ id: 3000, name: 'it0375_stage2_removed', type: 'test' });
  stage2.addLabel(stage2Model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await stage2.setRuntimeMode('running');
  assert.equal(stage2.mqttIncoming('submit', externalPacket(records)), false, 'default/stage2 topic mode must fail closed');
  assert.equal(stage2Model.getCell(0, 0, 0).labels.get('submit'), undefined, 'default/stage2 topic mode must not write pin');

  const nineLayer = new ModelTableRuntime();
  await nineLayer.setRuntimeMode('edit');
  const nineLayerModel = nineLayer.createModel({ id: 3000, name: 'it0375_9layer_removed', type: 'test' });
  nineLayer.addLabel(nineLayer.getModel(0), 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_9layer_v2' });
  nineLayer.addLabel(nineLayer.getModel(0), 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
  nineLayer.addLabel(nineLayerModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await nineLayer.setRuntimeMode('running');
  assert.equal(nineLayer.mqttIncoming('UIPUT/in/ws/dam/pic/de/sw/3000/submit', externalPacket(records)), false, 'uiput_9layer_v2 topic mode must fail closed');
  assert.equal(nineLayerModel.getCell(0, 0, 0).labels.get('submit'), undefined, 'uiput_9layer_v2 topic mode must not write pin');

  return { key: 'runtime_rejects_removed_topic_modes', status: 'PASS' };
}

async function assertMissingMetadataRejected({ missingKey, label }) {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model = rt.createModel({ id: 3000, name: `it0375_missing_${missingKey}`, type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const missing = withoutRecords(pinPayloadRecords(), [missingKey]);
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3000/submit', externalPacket(missing));

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

async function test_runtime_rejects_missing_or_invalid_message_role() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model = rt.createModel({ id: 3000, name: 'it0375_message_role_required', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const missing = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(withoutRecords(pinPayloadRecords(), ['message_role'])),
  );
  const invalid = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(withRecordOverride(pinPayloadRecords({ opId: 'req_0375_bad_role' }), 'message_role', { v: 'ack' })),
  );

  assert.equal(missing, false, 'runtime MQTT ingress must require message_role');
  assert.equal(invalid, false, 'runtime MQTT ingress must reject unknown message_role values');
  assert.equal(model.getCell(0, 0, 0).labels.get('submit'), undefined, 'invalid message_role packets must not trigger endpoint pin');
  return { key: 'runtime_rejects_missing_or_invalid_message_role', status: 'PASS' };
}

async function test_runtime_rejects_duplicate_required_pin_payload_metadata() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model = rt.createModel({ id: 3000, name: 'it0375_duplicate_endpoint_metadata', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3000/submit', externalPacket(withDuplicateRecord(
    pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }),
    'endpoint_worker_id',
    { v: ' R1 ' },
  )));

  assert.equal(accepted, false, 'runtime MQTT ingress must reject duplicate required pin_payload metadata');
  assert.equal(model.getCell(0, 0, 0).labels.get('submit'), undefined, 'duplicate metadata packet must not write endpoint pin');
  return { key: 'runtime_rejects_duplicate_required_pin_payload_metadata', status: 'PASS' };
}

async function test_pin_bus_externalization_rejects_legacy_route_payload_records() {
  const rt = new ModelTableRuntime();
  const packet = rt._pinBusOutValueToExternalPayload(legacyRoutePinPayloadRecords());

  assert.equal(packet, null, 'externalization must reject legacy source_model_id/pin/route records');
  return { key: 'pin_bus_externalization_rejects_legacy_route_payload_records', status: 'PASS' };
}

async function test_pin_bus_externalization_rejects_nested_legacy_payload_records() {
  const rt = new ModelTableRuntime();

  for (const key of ['source_model_id', ...removedReturnTopicKeys]) {
    const packet = rt._pinBusOutValueToExternalPayload(nestedLegacyPayloadRecords(key));
    assert.equal(packet, null, `externalization must reject nested legacy ${key} records`);
  }
  return { key: 'pin_bus_externalization_rejects_nested_legacy_payload_records', status: 'PASS' };
}

async function test_pin_bus_externalization_rejects_deeply_nested_legacy_payload_records() {
  const rt = new ModelTableRuntime();
  const packet = rt._pinBusOutValueToExternalPayload(pinPayloadRecords({
    opId: 'req_0375_deep_nested_source_model_id',
    payload: deeplyNestedLegacyRecord(24, 'source_model_id'),
  }));

  assert.equal(packet, null, 'externalization must reject deeply nested legacy source_model_id records');
  return { key: 'pin_bus_externalization_rejects_deeply_nested_legacy_payload_records', status: 'PASS' };
}

async function test_pin_bus_externalization_rejects_plain_json_legacy_keys() {
  const rt = new ModelTableRuntime();
  for (const key of ['source_model_id', 'pin', 'route', ...removedReturnTopicKeys]) {
    const packet = rt._pinBusOutValueToExternalPayload(plainJsonLegacyPayloadRecords(key));
    assert.equal(packet, null, `externalization must reject plain JSON legacy ${key} keys`);
  }
  return { key: 'pin_bus_externalization_rejects_plain_json_legacy_keys', status: 'PASS' };
}

async function test_pin_bus_externalization_rejects_legacy_record_extra_properties() {
  const rt = new ModelTableRuntime();
  for (const key of ['source_model_id', 'pin', 'route', ...removedReturnTopicKeys]) {
    const packet = rt._pinBusOutValueToExternalPayload(withLegacyOwnProperty(pinPayloadRecords(), key));
    assert.equal(packet, null, `externalization must reject legacy extra record property ${key}`);
  }
  return { key: 'pin_bus_externalization_rejects_legacy_record_extra_properties', status: 'PASS' };
}

async function test_pin_bus_externalization_rejects_metadata_wrong_types() {
  const rt = new ModelTableRuntime();
  const cases = [
    ['__mt_payload_kind', { t: 'json', v: 'pin_payload.v1' }],
    ['__mt_request_id', { t: 'json', v: 'req_0375_wrong_request_type' }],
    ['op_id', { t: 'json', v: 'req_0375_wrong_op_type' }],
  ];
  for (const [key, patch] of cases) {
    const packet = rt._pinBusOutValueToExternalPayload(withRecordOverride(pinPayloadRecords(), key, patch));
    assert.equal(packet, null, `externalization must reject wrong metadata type for ${key}`);
  }
  return { key: 'pin_bus_externalization_rejects_metadata_wrong_types', status: 'PASS' };
}

async function test_pin_bus_externalization_rejects_missing_request_correlation() {
  const rt = new ModelTableRuntime();
  const packet = rt._pinBusOutValueToExternalPayload(withoutRecords(pinPayloadRecords(), ['__mt_request_id', 'op_id']));

  assert.equal(packet, null, 'externalization must reject pin_payload.v1 without op_id and __mt_request_id');
  return { key: 'pin_bus_externalization_rejects_missing_request_correlation', status: 'PASS' };
}

async function test_runtime_rejects_legacy_reply_to_records() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'R1');
  const model = rt.createModel({ id: 3000, name: 'it0375_legacy_reply_record', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const replyTo = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }).concat([legacyReplyToRecord()])),
  );
  const routeReplyTo = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit', opId: 'req_0375_route_reply_key' }).concat([legacyReplyToRecord('route.reply_to')])),
  );
  const nestedRouteReplyTo = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit', opId: 'req_0375_nested_route_reply' }).concat([
      mt('legacy_container', 'json', { route: { reply_to: { worker_id: 'U1', model_id: 2000, pin: 'result' } } }),
    ])),
  );
  const deeplyNestedRouteReplyTo = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit', opId: 'req_0375_deep_route_reply' }).concat([
      mt('legacy_deep_container', 'json', { meta: { nested: [{ route: { reply_to: { worker_id: 'U1', model_id: 2000, pin: 'result' } } }] } }),
    ])),
  );
  const nestedSourceModelId = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(nestedLegacyPayloadRecords('source_model_id')),
  );
  const deeplyNestedSourceModelId = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(pinPayloadRecords({ opId: 'req_0375_deep_nested_source_model_id', payload: deeplyNestedLegacyRecord(24, 'source_model_id') })),
  );
  const plainJsonSourceModelId = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(plainJsonLegacyPayloadRecords('source_model_id')),
  );
  const plainJsonPin = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(plainJsonLegacyPayloadRecords('pin')),
  );
  const plainJsonRoute = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(plainJsonLegacyPayloadRecords('route')),
  );
  const extraSourceModelId = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(withLegacyOwnProperty(pinPayloadRecords({ opId: 'req_0375_extra_source_model_id' }), 'source_model_id')),
  );
  const returnTopicRecords = removedReturnTopicKeys.map((key) => rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(pinPayloadRecords({
      endpointWorkerId: 'R1',
      endpointModelId: 3000,
      endpointPin: 'submit',
      opId: `req_0375_legacy_${key}`,
    }).concat([legacyReturnTopicRecord(key)])),
  ));
  const nestedReturnTopics = removedReturnTopicKeys.map((key) => rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(nestedLegacyPayloadRecords(key)),
  ));
  const plainJsonReturnTopics = removedReturnTopicKeys.map((key) => rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(plainJsonLegacyPayloadRecords(key)),
  ));
  const extraReturnTopics = removedReturnTopicKeys.map((key) => rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(withLegacyOwnProperty(pinPayloadRecords({ opId: `req_0375_extra_${key}` }), key)),
  ));
  const wrongOpIdType = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(withRecordOverride(pinPayloadRecords({ opId: 'req_0375_wrong_op_id_type' }), 'op_id', { t: 'json', v: 'req_0375_wrong_op_id_type' })),
  );
  const missingRequestCorrelation = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(withoutRecords(pinPayloadRecords(), ['__mt_request_id', 'op_id'])),
  );

  assert.equal(replyTo, false, 'runtime must reject legacy reply_to records');
  assert.equal(routeReplyTo, false, 'runtime must reject legacy route.reply_to records');
  assert.equal(nestedRouteReplyTo, false, 'runtime must reject nested route.reply_to values');
  assert.equal(deeplyNestedRouteReplyTo, false, 'runtime must reject deeply nested route.reply_to values');
  assert.equal(nestedSourceModelId, false, 'runtime must reject nested legacy source_model_id records');
  assert.equal(deeplyNestedSourceModelId, false, 'runtime must reject deeply nested legacy source_model_id records');
  assert.equal(plainJsonSourceModelId, false, 'runtime must reject plain JSON source_model_id keys');
  assert.equal(plainJsonPin, false, 'runtime must reject plain JSON pin keys');
  assert.equal(plainJsonRoute, false, 'runtime must reject plain JSON route keys');
  assert.equal(extraSourceModelId, false, 'runtime must reject legacy extra record properties');
  for (const [index, key] of removedReturnTopicKeys.entries()) {
    assert.equal(returnTopicRecords[index], false, `runtime must reject legacy ${key} records`);
    assert.equal(nestedReturnTopics[index], false, `runtime must reject nested legacy ${key} records`);
    assert.equal(plainJsonReturnTopics[index], false, `runtime must reject plain JSON ${key} keys`);
    assert.equal(extraReturnTopics[index], false, `runtime must reject extra record property ${key}`);
  }
  assert.equal(wrongOpIdType, false, 'runtime must reject wrong op_id metadata type');
  assert.equal(missingRequestCorrelation, false, 'runtime must reject pin_payload.v1 without op_id and __mt_request_id');
  assert.equal(model.getCell(0, 0, 0).labels.get('submit'), undefined, 'legacy reply records must not write endpoint pin');
  return { key: 'runtime_rejects_legacy_reply_to_records', status: 'PASS' };
}

async function test_runtime_bus_in_rejects_legacy_metadata_records() {
  const rt = new ModelTableRuntime();
  markDem(rt);
  const model0 = root(rt);
  const result = rt.addLabel(model0, 0, 0, 0, {
    k: 'legacy_bus_in',
    t: 'pin.bus.cb.in',
    v: nestedLegacyPayloadRecords('source_model_id'),
  });

  assert.equal(result.applied, false, 'runtime bus-in labels must reject legacy metadata records');
  assert.equal(model0.getCell(0, 0, 0).labels.has('legacy_bus_in'), false, 'legacy bus-in payload must not be stored');
  return { key: 'runtime_bus_in_rejects_legacy_metadata_records', status: 'PASS' };
}

async function test_runtime_bus_in_rejects_plain_json_legacy_keys() {
  const rt = new ModelTableRuntime();
  markDem(rt);
  const model0 = root(rt);
  const result = rt.addLabel(model0, 0, 0, 0, {
    k: 'legacy_json_bus_in',
    t: 'pin.bus.cb.in',
    v: plainJsonLegacyPayloadRecords('route'),
  });

  assert.equal(result.applied, false, 'runtime bus-in labels must reject plain JSON legacy route keys');
  assert.equal(model0.getCell(0, 0, 0).labels.has('legacy_json_bus_in'), false, 'legacy JSON bus-in payload must not be stored');
  return { key: 'runtime_bus_in_rejects_plain_json_legacy_keys', status: 'PASS' };
}

async function test_runtime_bus_in_rejects_legacy_record_extra_properties() {
  const rt = new ModelTableRuntime();
  markDem(rt);
  const model0 = root(rt);
  const result = rt.addLabel(model0, 0, 0, 0, {
    k: 'legacy_extra_bus_in',
    t: 'pin.bus.cb.in',
    v: withLegacyOwnProperty(pinPayloadRecords(), 'source_model_id'),
  });

  assert.equal(result.applied, false, 'runtime bus-in labels must reject legacy extra record properties');
  assert.equal(model0.getCell(0, 0, 0).labels.has('legacy_extra_bus_in'), false, 'legacy extra-property bus-in payload must not be stored');
  return { key: 'runtime_bus_in_rejects_legacy_record_extra_properties', status: 'PASS' };
}

async function test_runtime_bus_in_rejects_pin_payload_metadata_wrong_types() {
  const rt = new ModelTableRuntime();
  markDem(rt);
  const model0 = root(rt);
  const cases = [
    ['cb', 'pin.bus.cb.in'],
    ['mb', 'pin.bus.mb.in'],
  ];
  for (const [suffix, type] of cases) {
    for (const [key, patch] of [
      ['__mt_payload_kind', { t: 'json', v: 'pin_payload.v1' }],
      ['__mt_request_id', { t: 'json', v: 'req_0375_wrong_request_type' }],
      ['op_id', { t: 'json', v: 'req_0375_wrong_op_type' }],
      ['endpoint_worker_id', { t: 'json', v: 'R1' }],
    ]) {
      const labelKey = `wrong_type_bus_in_${suffix}_${key}`;
      const result = rt.addLabel(model0, 0, 0, 0, {
        k: labelKey,
        t: type,
        v: withRecordOverride(pinPayloadRecords(), key, patch),
      });
      assert.equal(result.applied, false, `${type} must reject pin_payload.v1 metadata with wrong label.t for ${key}`);
      assert.equal(model0.getCell(0, 0, 0).labels.has(labelKey), false, `${type} malformed pin_payload ${key} must not be stored`);
    }
    for (const [kindSuffix, kindValue] of [
      ['padded_kind', ' pin_payload.v1 '],
      ['unknown_kind', 'pin_payload.v2'],
    ]) {
      const labelKey = `wrong_type_bus_in_${suffix}_${kindSuffix}`;
      const result = rt.addLabel(model0, 0, 0, 0, {
        k: labelKey,
        t: type,
        v: pinPayloadNamespaceKindRecords(kindValue),
      });
      assert.equal(result.applied, false, `${type} must reject malformed ${kindValue} payload kind`);
      assert.equal(model0.getCell(0, 0, 0).labels.has(labelKey), false, `${type} malformed ${kindValue} payload kind must not be stored`);
    }
  }
  return { key: 'runtime_bus_in_rejects_pin_payload_metadata_wrong_types', status: 'PASS' };
}

async function test_runtime_bus_in_rejects_missing_request_correlation() {
  const rt = new ModelTableRuntime();
  markDem(rt);
  const model0 = root(rt);
  for (const [suffix, type] of [['cb', 'pin.bus.cb.in'], ['mb', 'pin.bus.mb.in'], ['cb_out', 'pin.bus.cb.out'], ['mb_out', 'pin.bus.mb.out']]) {
    const labelKey = `missing_request_${suffix}`;
    const result = rt.addLabel(model0, 0, 0, 0, {
      k: labelKey,
      t: type,
      v: withoutRecords(pinPayloadRecords(), ['__mt_request_id', 'op_id']),
    });
    assert.equal(result.applied, false, `${type} must reject pin_payload.v1 without op_id and __mt_request_id`);
    assert.equal(model0.getCell(0, 0, 0).labels.has(labelKey), false, `${type} missing request correlation must not be stored`);
  }
  return { key: 'runtime_bus_in_rejects_missing_request_correlation', status: 'PASS' };
}

async function test_mt_bus_send_rejects_deeply_nested_legacy_reply_to() {
  const rt = new ModelTableRuntime();
  markDem(rt);
  const model0 = root(rt);
  const payload = [
    mt('__mt_payload_kind', 'str', 'bus_send.v1'),
    mt('__mt_request_id', 'str', 'req_0375_deep_bus_send_reply'),
    mt('endpoint_worker_id', 'str', 'R1'),
    mt('endpoint_model_id', 'int', 3000),
    mt('endpoint_pin', 'str', 'submit'),
    mt('origin_worker_id', 'str', 'U1'),
    mt('origin_model_id', 'int', 2000),
    mt('origin_pin', 'str', 'submit'),
    mt('reply_target_worker_id', 'str', 'U1'),
    mt('reply_target_model_id', 'int', 2000),
    mt('reply_target_pin', 'str', 'result'),
    mt('bus_out_key', 'str', 'deep_reply_removed_out'),
    mt('payload', 'json', [mt('text', 'str', 'hello')]),
    mt('legacy_deep_container', 'json', { meta: { route: { reply_to: { worker_id: 'U1', model_id: 2000, pin: 'result' } } } }),
  ];
  const result = rt._applyBusSendPayload(model0, 0, 0, 0, payload);

  assert.equal(result.status, 'rejected', 'mt_bus_send must reject nested route.reply_to metadata');
  assert.equal(result.code, 'legacy_pin_payload_metadata_removed', 'mt_bus_send must reject nested route.reply_to with the hard-cut legacy metadata code');
  assert.equal(model0.getCell(0, 0, 0).labels.has('deep_reply_removed_out'), false, 'mt_bus_send must not materialize bus out when request contains nested route.reply_to');
  return { key: 'mt_bus_send_rejects_deeply_nested_legacy_reply_to', status: 'PASS' };
}

async function test_mt_bus_send_rejects_nested_legacy_payload_records() {
  const rt = new ModelTableRuntime();
  markDem(rt);
  const model0 = root(rt);
  const payload = [
    mt('__mt_payload_kind', 'str', 'bus_send.v1'),
    mt('__mt_request_id', 'str', 'req_0375_nested_bus_send_source_model_id'),
    mt('endpoint_worker_id', 'str', 'R1'),
    mt('endpoint_model_id', 'int', 3000),
    mt('endpoint_pin', 'str', 'submit'),
    mt('origin_worker_id', 'str', 'U1'),
    mt('origin_model_id', 'int', 2000),
    mt('origin_pin', 'str', 'submit'),
    mt('reply_target_worker_id', 'str', 'U1'),
    mt('reply_target_model_id', 'int', 2000),
    mt('reply_target_pin', 'str', 'result'),
    mt('bus_out_key', 'str', 'nested_source_removed_out'),
    mt('payload', 'json', [mt('source_model_id', 'int', 2000)]),
  ];
  const result = rt._applyBusSendPayload(model0, 0, 0, 0, payload);

  assert.equal(result.status, 'rejected', 'mt_bus_send must reject nested legacy source_model_id records');
  assert.equal(result.code, 'legacy_pin_payload_metadata_removed', 'mt_bus_send must use the hard-cut legacy metadata code');
  assert.equal(model0.getCell(0, 0, 0).labels.has('nested_source_removed_out'), false, 'mt_bus_send must not materialize bus out when nested payload contains source_model_id');
  return { key: 'mt_bus_send_rejects_nested_legacy_payload_records', status: 'PASS' };
}

async function test_mt_bus_send_rejects_plain_json_legacy_keys() {
  const rt = new ModelTableRuntime();
  markDem(rt);
  const model0 = root(rt);
  const payload = [
    mt('__mt_payload_kind', 'str', 'bus_send.v1'),
    mt('__mt_request_id', 'str', 'req_0375_plain_json_route_bus_send'),
    mt('endpoint_worker_id', 'str', 'R1'),
    mt('endpoint_model_id', 'int', 3000),
    mt('endpoint_pin', 'str', 'submit'),
    mt('origin_worker_id', 'str', 'U1'),
    mt('origin_model_id', 'int', 2000),
    mt('origin_pin', 'str', 'submit'),
    mt('reply_target_worker_id', 'str', 'U1'),
    mt('reply_target_model_id', 'int', 2000),
    mt('reply_target_pin', 'str', 'result'),
    mt('bus_out_key', 'str', 'plain_json_route_removed_out'),
    mt('payload', 'json', [mt('business_meta', 'json', { route: { to: { worker_id: 'R1', model_id: 3000, pin: 'submit' } } })]),
  ];
  const result = rt._applyBusSendPayload(model0, 0, 0, 0, payload);

  assert.equal(result.status, 'rejected', 'mt_bus_send must reject plain JSON legacy route keys');
  assert.equal(result.code, 'legacy_pin_payload_metadata_removed', 'mt_bus_send must use the hard-cut legacy metadata code');
  assert.equal(model0.getCell(0, 0, 0).labels.has('plain_json_route_removed_out'), false, 'mt_bus_send must not materialize bus out with plain JSON route keys');
  return { key: 'mt_bus_send_rejects_plain_json_legacy_keys', status: 'PASS' };
}

async function test_mt_bus_send_rejects_legacy_record_extra_properties() {
  const rt = new ModelTableRuntime();
  markDem(rt);
  const model0 = root(rt);
  const payload = withLegacyOwnProperty([
    mt('__mt_payload_kind', 'str', 'bus_send.v1'),
    mt('__mt_request_id', 'str', 'req_0375_extra_source_bus_send'),
    mt('endpoint_worker_id', 'str', 'R1'),
    mt('endpoint_model_id', 'int', 3000),
    mt('endpoint_pin', 'str', 'submit'),
    mt('origin_worker_id', 'str', 'U1'),
    mt('origin_model_id', 'int', 2000),
    mt('origin_pin', 'str', 'submit'),
    mt('reply_target_worker_id', 'str', 'U1'),
    mt('reply_target_model_id', 'int', 2000),
    mt('reply_target_pin', 'str', 'result'),
    mt('bus_out_key', 'str', 'extra_source_removed_out'),
    mt('payload', 'json', [mt('text', 'str', 'hello')]),
  ], 'source_model_id');
  const result = rt._applyBusSendPayload(model0, 0, 0, 0, payload);

  assert.equal(result.status, 'rejected', 'mt_bus_send must reject legacy extra record properties');
  assert.equal(model0.getCell(0, 0, 0).labels.has('extra_source_removed_out'), false, 'mt_bus_send must not materialize bus out with legacy extra record properties');
  return { key: 'mt_bus_send_rejects_legacy_record_extra_properties', status: 'PASS' };
}

async function test_split_bus_out_rejects_legacy_reply_to_records() {
  const rt = new ModelTableRuntime();
  markDem(rt);
  const model0 = root(rt);
  const result = rt.addLabel(model0, 0, 0, 0, {
    k: 'reply_to_removed_out',
    t: 'pin.bus.cb.out',
    v: pinPayloadRecords().concat([legacyReplyToRecord()]),
  });

  assert.equal(result.applied, false, 'split bus out must reject pin_payload.v1 with legacy reply_to records');
  assert.equal(model0.getCell(0, 0, 0).labels.has('reply_to_removed_out'), false, 'legacy reply_to bus out must not be stored');
  return { key: 'split_bus_out_rejects_legacy_reply_to_records', status: 'PASS' };
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

  assert.equal(valid.applied, true, 'split bus out must accept endpoint_* records with explicit topic and without route.to');
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
  assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/R1/3000/submit');
  assert.equal(Object.prototype.hasOwnProperty.call(published[0].payload, 'pin'), false, 'transport packet must not carry loose pin');
  assert.equal(Object.prototype.hasOwnProperty.call(published[0].payload, 'source_model_id'), false, 'transport packet must not carry loose source_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(published[0].payload, 'route'), false, 'transport packet must not carry legacy route');
  assert.deepEqual(published[0].payload.payload, pinPayloadRecords({ opId: 'req_0375_publish', endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }));
  return { key: 'worker_engine_publishes_control_bus_to_unified_endpoint_topic', status: 'PASS' };
}

async function test_worker_engine_publishes_response_to_response_topic() {
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

  const records = pinPayloadRecords({
    opId: 'resp_0375_publish',
    messageRole: 'response',
    endpointWorkerId: 'U1',
    endpointModelId: 2000,
    endpointPin: 'result',
    originWorkerId: 'R1',
    originModelId: 3000,
    originPin: 'submit1',
    replyTargetWorkerId: 'U1',
    replyTargetModelId: 2000,
    replyTargetPin: 'result',
    topic: 'UIPUT/ws/dam/pic/de/U1/2000/result',
    responseTopic: 'UIPUT/ws/dam/pic/de/U1/2000/result',
    payload: [mt('display_text', 'str', 'Submitted: response topic')],
  });
  rt.addLabel(model0, 0, 0, 0, {
    k: 'send_response_topic',
    t: 'pin.bus.cb.out',
    v: records,
  });
  await rt.setRuntimeMode('running');
  engine.tick();

  assert.equal(published.length, 1, 'response control bus out must publish exactly once');
  assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/U1/2000/result', 'response control bus publish must use response_topic');
  assert.equal(readPayloadValue(published[0].payload.payload, 'message_role'), 'response', 'response packet carries message_role=response');
  assert.equal(readPayloadValue(published[0].payload.payload, 'reply_target_worker_id'), 'U1', 'UI Server target remains payload metadata only');
  return { key: 'worker_engine_publishes_response_to_response_topic', status: 'PASS' };
}

async function test_worker_engine_rejects_short_payload_topic() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  markDem(rt);
  const model0 = root(rt);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: 'R1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
  const published = [];
  const engine = new WorkerEngineV0({
    runtime: rt,
    mqttPublish: (topic, payload) => published.push({ topic, payload }),
  });

  rt.addLabel(model0, 0, 0, 0, {
    k: 'send_to_remote_short_topic',
    t: 'pin.bus.cb.out',
    v: pinPayloadRecords({
      opId: 'req_0375_short_topic_publish',
      endpointWorkerId: 'R1',
      endpointModelId: 3000,
      endpointPin: 'submit',
      topic: 'UIPUT',
    }),
  });
  await rt.setRuntimeMode('running');
  engine.tick();

  assert.equal(published.length, 0, 'WorkerEngine must not publish short payload topics');
  assert.equal(model0.getCell(0, 0, 0).labels.get('split_bus_out_error')?.v?.code, 'invalid_split_bus_payload');
  return { key: 'worker_engine_rejects_short_payload_topic', status: 'PASS' };
}

async function test_worker_engine_rejects_padded_payload_topic() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  markDem(rt);
  const model0 = root(rt);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: ' UIPUT/ws/dam/pic/de ' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: 'R1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
  const published = [];
  const engine = new WorkerEngineV0({
    runtime: rt,
    mqttPublish: (topic, payload) => published.push({ topic, payload }),
  });

  rt.addLabel(model0, 0, 0, 0, {
    k: 'send_to_remote_padded_topic',
    t: 'pin.bus.cb.out',
    v: pinPayloadRecords({
      opId: 'req_0375_padded_topic_publish',
      endpointWorkerId: 'R1',
      endpointModelId: 3000,
      endpointPin: 'submit',
      topic: ' UIPUT/ws/dam/pic/de/R1/3000/submit ',
    }),
  });
  await rt.setRuntimeMode('running');
  engine.tick();

  assert.equal(published.length, 0, 'WorkerEngine must not trim padded payload topics');
  assert.equal(model0.getCell(0, 0, 0).labels.get('split_bus_out_error')?.v?.code, 'invalid_split_bus_payload');
  return { key: 'worker_engine_rejects_padded_payload_topic', status: 'PASS' };
}

async function test_generic_worker_bootstrap_subscribes_only_unified_endpoint_topics() {
  const source = readFileSync(new URL('../run_worker_v0.mjs', import.meta.url), 'utf8');
  assert.match(source, /\$\{base\}\/\+\/\+\/\+/, 'generic worker bootstrap must subscribe to the unified worker/model/pin topic');
  assert.doesNotMatch(source, /\/worker\/\+\/model\/\+\/pin\/\+/, 'generic worker bootstrap must not subscribe to legacy worker/model/pin topics');
  assert.doesNotMatch(source, /version\s*===\s*['"]mt\.v0['"]/, 'generic worker bootstrap must not accept mt.v0 compatibility packets');
  return { key: 'generic_worker_bootstrap_subscribes_only_unified_endpoint_topics', status: 'PASS' };
}

async function test_generic_worker_bootstrap_validates_topic_payload_endpoint_match() {
  const base = 'UIPUT/ws/dam/pic/de';
  const packet = externalPacket(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }));
  const providerBundleResponse = externalPacket(pinPayloadRecords({
    opId: 'req_0389_provider_bundle',
    endpointWorkerId: 'U1',
    endpointModelId: 1051,
    endpointPin: 'result',
    originWorkerId: 'R1',
    originModelId: 3100,
    originPin: 'bundle_request',
    replyTargetWorkerId: 'U1',
    replyTargetModelId: 1051,
    replyTargetPin: 'result',
    messageRole: 'response',
    topic: `${base}/U1/1051/result`,
    responseTopic: `${base}/U1/1051/result`,
    payload: providerBundleResponsePayload(),
  }));

  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, packet, base).ok, true, 'valid topic and matching endpoint records must pass bootstrap validation');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/U1/1051/result`, providerBundleResponse, base).ok, true, 'provider-owned slide app bundle response must pass bootstrap validation even when UI labels use write.pin inside bundle payload');
  assert.equal(validateUnifiedEndpointTopicPacket('UIPUT/R1/3000/submit', packet, 'UIPUT').ok, false, 'bootstrap validation must reject short-base unified topic shape');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, packet, ` ${base} `).ok, false, 'bootstrap validation must reject padded mqtt_topic_base');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/0/submit`, packet, base).ok, false, 'bootstrap validation must reject model_id=0');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/not-a-model/submit`, packet, base).ok, false, 'bootstrap validation must reject non-integer model_id');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3001/submit`, packet, base).ok, false, 'bootstrap validation must reject endpoint model mismatch');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/other`, packet, base).ok, false, 'bootstrap validation must reject endpoint pin mismatch');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/worker/R1/model/3000/pin/submit`, packet, base).ok, false, 'bootstrap validation must reject legacy worker/model/pin topic');
  for (const segment of ['1e3', '01000', '3000.0', '0xbb8']) {
    assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/${segment}/submit`, packet, base).ok, false, `bootstrap validation must reject non-canonical model_id segment ${segment}`);
  }
  const missingOrigin = externalPacket(withoutRecords(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }), ['origin_worker_id']));
  const missingReplyTarget = externalPacket(withoutRecords(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }), ['reply_target_model_id']));
  const missingKind = externalPacket(withoutRecords(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }), ['__mt_payload_kind']));
  const missingRequestCorrelation = externalPacket(withoutRecords(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }), ['__mt_request_id', 'op_id']));
  const malformedRecord = externalPacket(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }).concat([{ foo: 'not-a-temp-record' }]));
  const legacyReply = externalPacket(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }).concat([legacyReplyToRecord()]));
  const legacyReturnTopics = removedReturnTopicKeys.map((key) => externalPacket(
    pinPayloadRecords({
      endpointWorkerId: 'R1',
      endpointModelId: 3000,
      endpointPin: 'submit',
      opId: `req_0375_bootstrap_${key}`,
    }).concat([legacyReturnTopicRecord(key)]),
  ));
  const nestedLegacyReply = externalPacket(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }).concat([
    mt('legacy_nested', 'json', { route: { reply_to: { worker_id: 'U1', model_id: 2000, pin: 'result' } } }),
  ]));
  const nestedLegacySourceModelId = externalPacket(nestedLegacyPayloadRecords('source_model_id'));
  const nestedLegacyReturnTopics = removedReturnTopicKeys.map((key) => externalPacket(nestedLegacyPayloadRecords(key)));
  const deeplyNestedLegacySourceModelId = externalPacket(pinPayloadRecords({
    opId: 'req_0375_bootstrap_deep_nested_source_model_id',
    payload: deeplyNestedLegacyRecord(24, 'source_model_id'),
  }));
  const plainJsonLegacyRoute = externalPacket(plainJsonLegacyPayloadRecords('route'));
  const plainJsonLegacyPin = externalPacket(plainJsonLegacyPayloadRecords('pin'));
  const plainJsonLegacySourceModelId = externalPacket(plainJsonLegacyPayloadRecords('source_model_id'));
  const plainJsonLegacyReturnTopics = removedReturnTopicKeys.map((key) => externalPacket(plainJsonLegacyPayloadRecords(key)));
  const extraLegacySourceModelId = externalPacket(withLegacyOwnProperty(pinPayloadRecords(), 'source_model_id'));
  const extraLegacyReturnTopics = removedReturnTopicKeys.map((key) => externalPacket(withLegacyOwnProperty(
    pinPayloadRecords({ opId: `req_0375_bootstrap_extra_${key}` }),
    key,
  )));
  const duplicateEndpointWorkerId = externalPacket(withDuplicateRecord(
    pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }),
    'endpoint_worker_id',
    { v: ' R1 ' },
  ));
  const blankRequestCorrelation = externalPacket(withRecordOverride(
    withRecordOverride(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }), '__mt_request_id', { v: '   ' }),
    'op_id',
    { v: '   ' },
  ));
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, missingOrigin, base).ok, false, 'bootstrap validation must require origin records');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, missingReplyTarget, base).ok, false, 'bootstrap validation must require reply target records');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, missingKind, base).ok, false, 'bootstrap validation must require outer pin_payload.v1 kind record');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, missingRequestCorrelation, base).ok, false, 'bootstrap validation must require op_id or __mt_request_id');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, blankRequestCorrelation, base).ok, false, 'bootstrap validation must reject whitespace-only op_id and __mt_request_id');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, malformedRecord, base).ok, false, 'bootstrap validation must reject malformed Temporary ModelTable records');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, legacyReply, base).ok, false, 'bootstrap validation must reject legacy reply_to records');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, nestedLegacyReply, base).ok, false, 'bootstrap validation must reject nested route.reply_to records');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, nestedLegacySourceModelId, base).ok, false, 'bootstrap validation must reject nested legacy source_model_id records');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, deeplyNestedLegacySourceModelId, base).ok, false, 'bootstrap validation must reject deeply nested legacy source_model_id records');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, plainJsonLegacyRoute, base).ok, false, 'bootstrap validation must reject plain JSON route keys');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, plainJsonLegacyPin, base).ok, false, 'bootstrap validation must reject plain JSON pin keys');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, plainJsonLegacySourceModelId, base).ok, false, 'bootstrap validation must reject plain JSON source_model_id keys');
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, extraLegacySourceModelId, base).ok, false, 'bootstrap validation must reject legacy extra record properties');
  for (const [index, key] of removedReturnTopicKeys.entries()) {
    assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, legacyReturnTopics[index], base).ok, false, `bootstrap validation must reject legacy ${key} records`);
    assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, nestedLegacyReturnTopics[index], base).ok, false, `bootstrap validation must reject nested ${key} records`);
    assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, plainJsonLegacyReturnTopics[index], base).ok, false, `bootstrap validation must reject plain JSON ${key} keys`);
    assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, extraLegacyReturnTopics[index], base).ok, false, `bootstrap validation must reject extra record property ${key}`);
  }
  assert.equal(validateUnifiedEndpointTopicPacket(`${base}/R1/3000/submit`, duplicateEndpointWorkerId, base).ok, false, 'bootstrap validation must reject duplicate required metadata records');
  return { key: 'generic_worker_bootstrap_validates_topic_payload_endpoint_match', status: 'PASS' };
}

async function test_generic_worker_matrix_ingress_validates_strict_pin_payload_packet() {
  const valid = externalPacket(pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }));
  const version0 = { ...valid, version: 'v0' };
  const extraTop = { ...valid, op_id: 'loose_op' };
  const legacyRecord = externalPacket(pinPayloadRecords().concat([legacyReplyToRecord()]));
  const legacyReturnRecord = externalPacket(pinPayloadRecords({ opId: 'req_0375_matrix_return_topic' }).concat([legacyReturnTopicRecord('return_topic')]));
  const nestedLegacyReturnRecord = externalPacket(nestedLegacyPayloadRecords('returnTopic'));
  const malformedRecord = externalPacket(pinPayloadRecords().concat([{ foo: 'not-a-temp-record' }]));
  const wrongType = externalPacket(withRecordOverride(pinPayloadRecords(), 'endpoint_worker_id', { t: 'json', v: 'R1' }));
  const blankRequestCorrelation = externalPacket(withRecordOverride(
    withRecordOverride(pinPayloadRecords(), '__mt_request_id', { v: '   ' }),
    'op_id',
    { v: '   ' },
  ));

  assert.equal(validateUnifiedMatrixEventPacket(valid).ok, true, 'valid Matrix pin_payload event must pass');
  assert.equal(validateUnifiedMatrixEventPacket(version0).ok, false, 'Matrix ingress must reject version v0');
  assert.equal(validateUnifiedMatrixEventPacket(extraTop).ok, false, 'Matrix ingress must reject loose top-level fields');
  assert.equal(validateUnifiedMatrixEventPacket(externalPacket(withoutRecords(pinPayloadRecords(), ['__mt_request_id', 'op_id']))).ok, false, 'Matrix ingress must reject missing request correlation metadata');
  assert.equal(validateUnifiedMatrixEventPacket(blankRequestCorrelation).ok, false, 'Matrix ingress must reject whitespace-only request correlation metadata');
  assert.equal(validateUnifiedMatrixEventPacket(legacyRecord).ok, false, 'Matrix ingress must reject legacy metadata records');
  assert.equal(validateUnifiedMatrixEventPacket(legacyReturnRecord).ok, false, 'Matrix ingress must reject legacy return_topic metadata records');
  assert.equal(validateUnifiedMatrixEventPacket(nestedLegacyReturnRecord).ok, false, 'Matrix ingress must reject nested legacy returnTopic records');
  assert.equal(validateUnifiedMatrixEventPacket(malformedRecord).ok, false, 'Matrix ingress must reject malformed Temporary ModelTable records');
  assert.equal(validateUnifiedMatrixEventPacket(wrongType).ok, false, 'Matrix ingress must reject malformed metadata label types');
  return { key: 'generic_worker_matrix_ingress_validates_strict_pin_payload_packet', status: 'PASS' };
}

async function test_runtime_start_mqtt_loop_does_not_subscribe_model0_bus_in_topics() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, 'U1');
  const model0 = root(rt);
  rt.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.cb.in', v: null });
  const startResult = rt.startMqttLoop({
    transport: 'mock',
    host: 'localhost',
    port: 1883,
    client_id: 'it0375-no-model0-sub',
  });
  await rt.setRuntimeMode('running');

  assert.equal(startResult.status, 'running', 'mock MQTT runtime must start for subscription test');
  assert.equal(rt.mqttClient.subscriptions.has('UIPUT/ws/dam/pic/de/U1/0/ui_submit'), false, 'runtime must not subscribe disallowed Model 0 bus-in endpoint topics');
  return { key: 'runtime_start_mqtt_loop_does_not_subscribe_model0_bus_in_topics', status: 'PASS' };
}

async function test_runtime_direct_bus_out_publishes_endpoint_topic() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  markDem(rt);
  const model0 = root(rt);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_target_host', t: 'str', v: 'localhost' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_target_port', t: 'int', v: 1883 });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_target_client_id', t: 'str', v: 'it0375-direct' });
  configureUnifiedMqtt(rt, 'U1');
  await rt.setRuntimeMode('running');
  const startResult = rt.startMqttLoop({ transport: 'mock' });
  assert.equal(startResult.status, 'running', 'mock MQTT runtime must start for direct publish test');

  const records = pinPayloadRecords({
    opId: 'req_0375_direct_runtime',
    endpointWorkerId: 'R1',
    endpointModelId: 3000,
    endpointPin: 'submit',
    originWorkerId: 'U1',
    originModelId: 2000,
    originPin: 'submit',
  });
  rt.addLabel(model0, 0, 0, 0, {
    k: 'direct_runtime_out',
    t: 'pin.bus.mb.out',
    v: records,
  });

  const publish = rt.mqttTrace.list().find((entry) =>
    entry.type === 'publish'
    && entry.payload?.topic === 'UIPUT/ws/dam/pic/de/R1/3000/submit');
  assert.ok(publish, 'direct runtime bus out must publish to endpoint worker/model/pin topic');
  assert.deepEqual(Object.keys(publish.payload.payload).sort(), ['payload', 'type', 'version'], 'direct runtime packet must expose only version/type/payload');
  assert.equal(readPayloadValue(publish.payload.payload.payload, 'endpoint_worker_id'), 'R1');
  assert.equal(readPayloadValue(publish.payload.payload.payload, 'origin_worker_id'), 'U1');
  assert.equal(readPayloadValue(publish.payload.payload.payload, 'reply_target_worker_id'), 'U1');
  assert.equal(
    rt.mqttTrace.list().some((entry) => entry.type === 'publish' && entry.payload?.topic === 'UIPUT/ws/dam/pic/de/U1/0/direct_runtime_out'),
    false,
    'direct runtime bus out must not publish to local worker/model0/bus-key topic',
  );
  return { key: 'runtime_direct_bus_out_publishes_endpoint_topic', status: 'PASS' };
}

async function test_runtime_direct_bus_out_rejects_short_base_topic() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  markDem(rt);
  const model0 = root(rt);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_target_host', t: 'str', v: 'localhost' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_target_port', t: 'int', v: 1883 });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_target_client_id', t: 'str', v: 'it0375-direct-short-base' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: 'U1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
  await rt.setRuntimeMode('running');
  const startResult = rt.startMqttLoop({ transport: 'mock' });
  assert.equal(startResult.status, 'running', 'mock MQTT runtime must start for direct publish rejection test');

  rt.addLabel(model0, 0, 0, 0, {
    k: 'direct_runtime_short_base_out',
    t: 'pin.bus.mb.out',
    v: pinPayloadRecords({
      opId: 'req_0375_direct_short_base',
      endpointWorkerId: 'R1',
      endpointModelId: 3000,
      endpointPin: 'submit',
      originWorkerId: 'U1',
      originModelId: 2000,
      originPin: 'submit',
    }),
  });

  assert.equal(
    rt.mqttTrace.list().some((entry) => entry.type === 'publish' && entry.payload?.topic === 'UIPUT/R1/3000/submit'),
    false,
    'runtime direct bus out must not publish shortened endpoint topic',
  );
  return { key: 'runtime_direct_bus_out_rejects_short_base_topic', status: 'PASS' };
}

async function test_runtime_rejects_padded_configured_worker_id() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  configureUnifiedMqtt(rt, ' R1 ');
  const model = rt.createModel({ id: 3000, name: 'it0375_padded_worker_id_rejected', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'RemoteApp' });
  await rt.setRuntimeMode('running');

  const outboundTopic = rt._topicFor(3000, 'submit');
  const accepted = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3000/submit',
    externalPacket(pinPayloadRecords({
      endpointWorkerId: 'R1',
      endpointModelId: 3000,
      endpointPin: 'submit',
      opId: 'req_0375_padded_worker_id',
    })),
  );

  assert.equal(outboundTopic, null, 'runtime must not trim padded mqtt_worker_id for outbound topics');
  assert.equal(accepted, false, 'runtime must reject inbound topics when configured mqtt_worker_id is padded');
  assert.equal(model.getCell(0, 0, 0).labels.get('submit'), undefined, 'padded worker id config must not allow endpoint pin writes');
  return { key: 'runtime_rejects_padded_configured_worker_id', status: 'PASS' };
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
        messageRole: 'response',
        topic: `UIPUT/ws/dam/pic/de/U1/${replyTargetModelId}/result`,
        responseTopic: `UIPUT/ws/dam/pic/de/U1/${replyTargetModelId}/result`,
        endpointWorkerId: 'U1',
        endpointModelId: replyTargetModelId,
        endpointPin: 'result',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit1',
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

async function test_server_rejects_remote_endpoint_response() {
  await withServerState(async (state) => {
    const targetModelId = 1068;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_local_endpoint_result_rejected', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'dual_bus_model', t: 'json', v: { mode: 'imported_host_egress', egress_pins: ['submit'] } });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: pinPayloadRecords({
        opId: 'req_0375_local_endpoint_result',
        messageRole: 'response',
        topic: `UIPUT/ws/dam/pic/de/U1/${targetModelId}/result`,
        responseTopic: `UIPUT/ws/dam/pic/de/U1/${targetModelId}/result`,
        endpointWorkerId: 'R1',
        endpointModelId: 3000,
        endpointPin: 'submit1',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit1',
        replyTargetWorkerId: 'U1',
        replyTargetModelId: targetModelId,
        replyTargetPin: 'result',
        payload: [mt('display_text', 'str', 'must_not_write_local_endpoint')],
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('display_text'),
      undefined,
      'response packets must not materialize when endpoint does not match reply_target_*',
    );
  });
  return { key: 'server_rejects_remote_endpoint_response', status: 'PASS' };
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
        messageRole: 'response',
        topic: `UIPUT/ws/dam/pic/de/U1/${targetModelId}/result`,
        responseTopic: `UIPUT/ws/dam/pic/de/U1/${targetModelId}/result`,
        endpointWorkerId: 'U1',
        endpointModelId: targetModelId,
        endpointPin: 'result',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit1',
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

async function test_server_pin_payload_extra_top_level_field_is_rejected() {
  await withServerState(async (state) => {
    const targetModelId = 1057;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_extra_top_level_return', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'dual_bus_model', t: 'json', v: { mode: 'imported_host_egress', egress_pins: ['submit'] } });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      reply_to: { worker_id: 'U1', model_id: targetModelId, pin: 'result' },
      payload: pinPayloadRecords({
        opId: 'req_0375_extra_top',
        messageRole: 'response',
        endpointWorkerId: 'R1',
        endpointModelId: 3000,
        endpointPin: 'submit1',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit1',
        replyTargetWorkerId: 'U1',
        replyTargetModelId: targetModelId,
        replyTargetPin: 'result',
        payload: [mt('display_text', 'str', 'must_not_write_extra_top')],
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('display_text'),
      undefined,
      'server return path must reject any top-level key beyond version/type/payload',
    );
  });
  return { key: 'server_pin_payload_extra_top_level_field_is_rejected', status: 'PASS' };
}

async function test_server_direct_pin_rejects_legacy_reply_to_records_inside_arrays() {
  await withServerState(async (state) => {
    const model0 = state.runtime.getModel(0);
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.mb.in', v: null });
    const cases = [
      {
        suffix: 'pin_payload_reply_to',
        value: pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit' }).concat([legacyReplyToRecord()]),
      },
      {
        suffix: 'pin_payload_nested_route_reply_to',
        value: pinPayloadRecords({ endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit', opId: 'direct_nested_route_reply' }).concat([
          mt('legacy_nested', 'json', { meta: { route: { reply_to: { worker_id: 'U1', model_id: 2000, pin: 'result' } } } }),
        ]),
      },
      {
        suffix: 'bus_send_nested_route_reply_to',
        value: [
          mt('__mt_payload_kind', 'str', 'bus_send.v1'),
          mt('__mt_request_id', 'str', 'direct_bus_send_nested_route_reply'),
          mt('endpoint_worker_id', 'str', 'R1'),
          mt('endpoint_model_id', 'int', 3000),
          mt('endpoint_pin', 'str', 'submit'),
          mt('origin_worker_id', 'str', 'U1'),
          mt('origin_model_id', 'int', 2000),
          mt('origin_pin', 'str', 'submit'),
          mt('reply_target_worker_id', 'str', 'U1'),
          mt('reply_target_model_id', 'int', 2000),
          mt('reply_target_pin', 'str', 'result'),
          mt('payload', 'json', [mt('text', 'str', 'hello')]),
          mt('legacy_nested', 'json', { route: { reply_to: { worker_id: 'U1', model_id: 2000, pin: 'result' } } }),
        ],
      },
      {
        suffix: 'pin_payload_nested_source_model_id',
        value: nestedLegacyPayloadRecords('source_model_id'),
      },
      {
        suffix: 'pin_payload_return_topic',
        value: pinPayloadRecords({
          endpointWorkerId: 'R1',
          endpointModelId: 3000,
          endpointPin: 'submit',
          opId: 'req_0375_direct_return_topic',
        }).concat([legacyReturnTopicRecord('return_topic')]),
      },
      {
        suffix: 'pin_payload_nested_return_topic',
        value: nestedLegacyPayloadRecords('returnTopic'),
      },
      {
        suffix: 'pin_payload_deep_nested_source_model_id',
        value: pinPayloadRecords({
          opId: 'req_0375_direct_deep_nested_source_model_id',
          payload: deeplyNestedLegacyRecord(24, 'source_model_id'),
        }),
      },
      {
        suffix: 'pin_payload_plain_json_route',
        value: plainJsonLegacyPayloadRecords('route'),
      },
      {
        suffix: 'pin_payload_plain_json_result_topic',
        value: plainJsonLegacyPayloadRecords('result_topic'),
      },
      {
        suffix: 'pin_payload_extra_source_model_id',
        value: withLegacyOwnProperty(pinPayloadRecords(), 'source_model_id'),
      },
      {
        suffix: 'pin_payload_extra_return_topic',
        value: withLegacyOwnProperty(pinPayloadRecords(), 'return_topic'),
      },
    ];

    for (const item of cases) {
      const result = await state.submitEnvelope({
        event_id: Date.now(),
        type: 'ui_submit',
        payload: {
          meta: { op_id: `direct_legacy_${item.suffix}_${Date.now()}` },
          target: { model_id: 0, p: 0, r: 0, c: 0 },
          pin: 'ui_submit',
          value: item.value,
        },
        source: 'ui_renderer',
        ts: Date.now(),
      });
      assert.equal(result?.result, 'error', `${item.suffix} direct-pin payload must be rejected`);
      assert.equal(result?.code, 'invalid_bus_payload', `${item.suffix} direct-pin payload must fail with invalid_bus_payload`);
      assert.equal(model0.getCell(0, 0, 0).labels.get('ui_submit')?.v ?? null, null, `${item.suffix} must not overwrite Model 0 bus.in value`);
    }
  });
  return { key: 'server_direct_pin_rejects_legacy_reply_to_records_inside_arrays', status: 'PASS' };
}

async function test_server_direct_pin_rejects_legacy_reply_to_arrays_for_positive_and_negative_models() {
  await withServerState(async (state) => {
    const positiveModel = state.runtime.createModel({ id: 2060, name: 'it0375_direct_positive_legacy', type: 'test' });
    state.runtime.addLabel(positiveModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'DirectPositive' });
    const sysModel = state.runtime.getModel(-10);
    const cases = [
      {
        suffix: 'positive',
        model: positiveModel,
        target: { model_id: 2060, p: 0, r: 0, c: 0 },
        pin: 'submit',
      },
      {
        suffix: 'negative',
        model: sysModel,
        target: { model_id: -10, p: 0, r: 0, c: 0 },
        pin: 'sys_submit',
      },
    ];
    for (const item of cases) {
      const result = await state.submitEnvelope({
        event_id: Date.now(),
        type: 'ui_submit',
        payload: {
          meta: { op_id: `direct_${item.suffix}_legacy_reply_${Date.now()}` },
          target: item.target,
          pin: item.pin,
          value: withLegacyOwnProperty(pinPayloadRecords(), 'source_model_id'),
        },
        source: 'ui_renderer',
        ts: Date.now(),
      });
      assert.equal(result?.result, 'error', `${item.suffix} direct-pin nested legacy metadata payload must be rejected`);
      assert.equal(item.model.getCell(0, 0, 0).labels.get(item.pin), undefined, `${item.suffix} direct-pin nested legacy metadata must not be stored`);
    }
  });
  return { key: 'server_direct_pin_rejects_legacy_reply_to_arrays_for_positive_and_negative_models', status: 'PASS' };
}

async function test_server_direct_pin_rejects_malformed_pin_payload_arrays_for_positive_and_negative_models() {
  await withServerState(async (state) => {
    const positiveModel = state.runtime.createModel({ id: 2061, name: 'it0375_direct_positive_malformed_pin_payload', type: 'test' });
    state.runtime.addLabel(positiveModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'DirectPositive' });
    const sysModel = state.runtime.getModel(-10);
    const malformedPinPayload = [
      mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
      mt('payload', 'json', [mt('display_text', 'str', 'must_not_store_malformed_direct_pin')]),
    ];
    const malformedKindTypePinPayload = withRecordOverride(malformedPinPayload, '__mt_payload_kind', { t: 'json' });
    const paddedKindPinPayload = pinPayloadNamespaceKindRecords(' pin_payload.v1 ');
    const unknownKindPinPayload = pinPayloadNamespaceKindRecords('pin_payload.v2');
    const cases = [
      {
        suffix: 'positive',
        model: positiveModel,
        target: { model_id: 2061, p: 0, r: 0, c: 0 },
        pin: 'submit',
      },
      {
        suffix: 'negative',
        model: sysModel,
        target: { model_id: -10, p: 0, r: 0, c: 0 },
        pin: 'sys_submit',
      },
    ];
    for (const item of cases) {
      for (const [variant, value] of [
        ['missing_metadata', malformedPinPayload],
        ['wrong_kind_type', malformedKindTypePinPayload],
        ['padded_kind', paddedKindPinPayload],
        ['unknown_kind', unknownKindPinPayload],
      ]) {
        const result = await state.submitEnvelope({
          event_id: Date.now(),
          type: 'ui_submit',
          payload: {
            meta: { op_id: `direct_${item.suffix}_malformed_pin_payload_${variant}_${Date.now()}` },
            target: item.target,
            pin: item.pin,
            value,
          },
          source: 'ui_renderer',
          ts: Date.now(),
        });
        assert.equal(result?.result, 'error', `${item.suffix} direct-pin ${variant} pin_payload.v1 array must be rejected`);
        assert.equal(item.model.getCell(0, 0, 0).labels.get(item.pin), undefined, `${item.suffix} direct-pin ${variant} pin_payload.v1 array must not be stored`);
      }
    }
  });
  return { key: 'server_direct_pin_rejects_malformed_pin_payload_arrays_for_positive_and_negative_models', status: 'PASS' };
}

async function test_server_rejects_snapshot_delta_return_path() {
  await withServerState(async (state) => {
    const targetModelId = 1058;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_snapshot_delta_removed', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });

    state.programEngine.handleDyBusEvent({
      version: 'v0',
      type: 'snapshot_delta',
      op_id: 'req_0375_snapshot_removed',
      payload: {
        version: 'mt.v0',
        records: [{
          op: 'add_label',
          model_id: targetModelId,
          p: 0,
          r: 0,
          c: 0,
          k: 'display_text',
          t: 'str',
          v: 'must_not_write_snapshot_delta',
        }],
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('display_text'),
      undefined,
      'snapshot_delta/mt.v0 return path must not materialize without pin_payload reply target records',
    );
  });
  return { key: 'server_rejects_snapshot_delta_return_path', status: 'PASS' };
}

async function test_server_rejects_direct_mgmt_bus_console_ack() {
  await withServerState(async (state) => {
    const consoleModel = state.runtime.getModel(1036);
    state.runtime.addLabel(consoleModel, 0, 0, 0, { k: 'message_status', t: 'str', v: 'sending' });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'mgmt_bus_console_ack',
      payload: [
        mt('__mt_payload_kind', 'str', 'mgmt_bus_console.ack.v1'),
        mt('target_user_id', 'str', '@mbr:test'),
        mt('reply_text', 'str', 'ack should not direct-write'),
      ],
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(consoleModel, 0, 0, 0).labels.get('message_status')?.v,
      'sending',
      'direct mgmt_bus_console_ack must not update console without pin_payload envelope',
    );
  });
  return { key: 'server_rejects_direct_mgmt_bus_console_ack', status: 'PASS' };
}

async function test_server_rejects_mgmt_ack_with_wrong_reply_target() {
  await withServerState(async (state) => {
    const consoleModel = state.runtime.getModel(1036);
    state.runtime.addLabel(consoleModel, 0, 0, 0, { k: 'message_status', t: 'str', v: 'sending' });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: pinPayloadRecords({
        opId: 'req_0375_bad_console_ack_target',
        endpointWorkerId: 'U1',
        endpointModelId: 1036,
        endpointPin: 'result',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit',
        replyTargetWorkerId: 'OTHER',
        replyTargetModelId: 1036,
        replyTargetPin: 'other',
        payload: [
          mt('__mt_payload_kind', 'str', 'mgmt_bus_console.ack.v1'),
          mt('target_user_id', 'str', '@mbr:test'),
          mt('reply_text', 'str', 'bad target ack'),
        ],
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(consoleModel, 0, 0, 0).labels.get('message_status')?.v,
      'sending',
      'wrapped mgmt ack must not update console unless endpoint and reply_target worker/pin are UI Server result',
    );
  });
  return { key: 'server_rejects_mgmt_ack_with_wrong_reply_target', status: 'PASS' };
}

async function test_server_rejects_pin_payload_missing_outer_kind() {
  await withServerState(async (state) => {
    const consoleModel = state.runtime.getModel(1036);
    state.runtime.addLabel(consoleModel, 0, 0, 0, { k: 'message_status', t: 'str', v: 'sending' });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: withoutRecords(pinPayloadRecords({
        opId: 'req_0375_missing_outer_kind',
        endpointWorkerId: 'U1',
        endpointModelId: 1036,
        endpointPin: 'result',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit',
        replyTargetWorkerId: 'U1',
        replyTargetModelId: 1036,
        replyTargetPin: 'result',
        payload: [
          mt('__mt_payload_kind', 'str', 'mgmt_bus_console.ack.v1'),
          mt('target_user_id', 'str', '@mbr:test'),
          mt('reply_text', 'str', 'missing outer kind should fail'),
        ],
      }), ['__mt_payload_kind']),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(consoleModel, 0, 0, 0).labels.get('message_status')?.v,
      'sending',
      'server return path must reject pin_payload packets without outer __mt_payload_kind=pin_payload.v1',
    );
  });
  return { key: 'server_rejects_pin_payload_missing_outer_kind', status: 'PASS' };
}

async function test_server_rejects_pin_payload_metadata_wrong_types() {
  await withServerState(async (state) => {
    const targetModelId = 1064;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_wrong_metadata_type_removed', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'dual_bus_model', t: 'json', v: { mode: 'imported_host_egress', egress_pins: ['submit'] } });

    const cases = [
      ['__mt_payload_kind', { t: 'json', v: 'pin_payload.v1' }],
      ['__mt_request_id', { t: 'json', v: 'req_0375_wrong_request_type' }],
      ['op_id', { t: 'json', v: 'req_0375_wrong_op_type' }],
      ['endpoint_worker_id', { t: 'json', v: 'U1' }],
      ['endpoint_pin', { t: 'json', v: 'result' }],
      ['origin_worker_id', { t: 'json', v: 'R1' }],
      ['origin_pin', { t: 'json', v: 'submit' }],
      ['reply_target_worker_id', { t: 'json', v: 'U1' }],
      ['reply_target_pin', { t: 'json', v: 'result' }],
    ];

    for (const [key, patch] of cases) {
      state.programEngine.handleDyBusEvent({
        version: 'v1',
        type: 'pin_payload',
        payload: withRecordOverride(pinPayloadRecords({
          opId: `req_0375_wrong_type_${key}`,
          endpointWorkerId: 'U1',
          endpointModelId: targetModelId,
          endpointPin: 'result',
          originWorkerId: 'R1',
          originModelId: 3000,
          originPin: 'submit',
          replyTargetWorkerId: 'U1',
          replyTargetModelId: targetModelId,
          replyTargetPin: 'result',
          payload: [mt('display_text', 'str', `must_not_write_wrong_${key}`)],
        }), key, patch),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('display_text'),
      undefined,
      'server return path must reject non-str metadata fields instead of coercing them',
    );
  });
  return { key: 'server_rejects_pin_payload_metadata_wrong_types', status: 'PASS' };
}

async function test_server_rejects_missing_request_correlation() {
  await withServerState(async (state) => {
    const targetModelId = 1065;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_missing_request_correlation_removed', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'dual_bus_model', t: 'json', v: { mode: 'imported_host_egress', egress_pins: ['submit'] } });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: withoutRecords(pinPayloadRecords({
        endpointWorkerId: 'U1',
        endpointModelId: targetModelId,
        endpointPin: 'result',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit',
        replyTargetWorkerId: 'U1',
        replyTargetModelId: targetModelId,
        replyTargetPin: 'result',
        payload: [mt('display_text', 'str', 'must_not_write_missing_request')],
      }), ['__mt_request_id', 'op_id']),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('display_text'),
      undefined,
      'server return path must reject pin_payload.v1 without op_id and __mt_request_id',
    );
  });
  return { key: 'server_rejects_missing_request_correlation', status: 'PASS' };
}

async function test_server_rejects_matrix_mbr_ready_event() {
  await withServerState(async (state) => {
    const targetModelId = 1067;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_mbr_ready_removed', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'dual_bus_model', t: 'json', v: { mode: 'imported_host_egress', egress_pins: ['submit'] } });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'mbr_ready',
      op_id: 'legacy_mbr_ready_removed',
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('system_ready'),
      undefined,
      'Matrix mbr_ready compatibility event must not mutate model state outside strict pin_payload records',
    );
  });
  return { key: 'server_rejects_matrix_mbr_ready_event', status: 'PASS' };
}

async function test_server_rejects_padded_pin_payload_metadata() {
  await withServerState(async (state) => {
    const targetModelId = 1066;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_padded_metadata_removed', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'dual_bus_model', t: 'json', v: { mode: 'imported_host_egress', egress_pins: ['submit'] } });

    const padded = [
      ['__mt_payload_kind', ' pin_payload.v1 '],
      ['__mt_request_id', ' req_0375_padded '],
      ['op_id', ' req_0375_padded '],
      ['endpoint_worker_id', ' U1 '],
      ['endpoint_pin', ' result '],
      ['origin_worker_id', ' R1 '],
      ['origin_pin', ' submit '],
      ['reply_target_worker_id', ' U1 '],
      ['reply_target_pin', ' result '],
    ];
    let payload = pinPayloadRecords({
      opId: 'req_0375_padded',
      endpointWorkerId: 'U1',
      endpointModelId: targetModelId,
      endpointPin: 'result',
      originWorkerId: 'R1',
      originModelId: 3000,
      originPin: 'submit',
      replyTargetWorkerId: 'U1',
      replyTargetModelId: targetModelId,
      replyTargetPin: 'result',
      payload: [mt('display_text', 'str', 'must_not_write_padded_metadata')],
    });
    for (const [key, value] of padded) {
      payload = withRecordOverride(payload, key, { v: value });
    }

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload,
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('display_text'),
      undefined,
      'server return path must reject padded strict pin_payload metadata instead of trimming it',
    );
  });
  return { key: 'server_rejects_padded_pin_payload_metadata', status: 'PASS' };
}

async function test_server_rejects_origin_only_padded_pin_payload_metadata() {
  await withServerState(async (state) => {
    const targetModelId = 1068;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_origin_padded_metadata_removed', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'dual_bus_model', t: 'json', v: { mode: 'imported_host_egress', egress_pins: ['submit'] } });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: withRecordOverride(
        withRecordOverride(pinPayloadRecords({
          opId: 'req_0375_origin_padded',
          endpointWorkerId: 'U1',
          endpointModelId: targetModelId,
          endpointPin: 'result',
          originWorkerId: 'R1',
          originModelId: 3000,
          originPin: 'submit',
          replyTargetWorkerId: 'U1',
          replyTargetModelId: targetModelId,
          replyTargetPin: 'result',
          payload: [mt('display_text', 'str', 'must_not_write_origin_padded_metadata')],
        }), 'origin_worker_id', { v: ' R1 ' }),
        'origin_pin',
        { v: ' submit ' },
      ),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('display_text'),
      undefined,
      'server return path must reject padded origin metadata even when endpoint and reply target are exact',
    );
  });
  return { key: 'server_rejects_origin_only_padded_pin_payload_metadata', status: 'PASS' };
}

async function test_server_rejects_duplicate_required_pin_payload_metadata() {
  await withServerState(async (state) => {
    const targetModelId = 1069;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_duplicate_metadata_removed', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'dual_bus_model', t: 'json', v: { mode: 'imported_host_egress', egress_pins: ['submit'] } });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: withDuplicateRecord(pinPayloadRecords({
        opId: 'req_0375_duplicate_endpoint',
        endpointWorkerId: 'U1',
        endpointModelId: targetModelId,
        endpointPin: 'result',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit',
        replyTargetWorkerId: 'U1',
        replyTargetModelId: targetModelId,
        replyTargetPin: 'result',
        payload: [mt('display_text', 'str', 'must_not_write_duplicate_metadata')],
      }), 'endpoint_worker_id', { v: ' U1 ' }),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('display_text'),
      undefined,
      'server return path must reject duplicate required metadata records',
    );
  });
  return { key: 'server_rejects_duplicate_required_pin_payload_metadata', status: 'PASS' };
}

async function test_server_rejects_legacy_metadata_records_inside_pin_payload() {
  await withServerState(async (state) => {
    const targetModelId = 1059;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_legacy_record_removed', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: pinPayloadRecords({
        opId: 'req_0375_legacy_record',
        endpointWorkerId: 'U1',
        endpointModelId: targetModelId,
        endpointPin: 'result',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit',
        replyTargetWorkerId: 'U1',
        replyTargetModelId: targetModelId,
        replyTargetPin: 'result',
        payload: [mt('display_text', 'str', 'must_not_write_legacy_record')],
      }).concat([
        mt('route', 'json', { reply_to: { worker_id: 'U1', model_id: targetModelId, pin: 'result' } }),
      ]),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('display_text'),
      undefined,
      'pin_payload with legacy route/source metadata records must be rejected',
    );
  });
  return { key: 'server_rejects_legacy_metadata_records_inside_pin_payload', status: 'PASS' };
}

async function test_server_rejects_nested_legacy_metadata_records_inside_pin_payload() {
  await withServerState(async (state) => {
    const targetModelId = 1060;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_nested_legacy_record_removed', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: pinPayloadRecords({
        opId: 'req_0375_nested_legacy_record',
        endpointWorkerId: 'U1',
        endpointModelId: targetModelId,
        endpointPin: 'result',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit',
        replyTargetWorkerId: 'U1',
        replyTargetModelId: targetModelId,
        replyTargetPin: 'result',
        payload: [mt('source_model_id', 'int', 2000)],
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('source_model_id'),
      undefined,
      'pin_payload with nested legacy source_model_id records must be rejected',
    );
  });
  return { key: 'server_rejects_nested_legacy_metadata_records_inside_pin_payload', status: 'PASS' };
}

async function test_server_rejects_deeply_nested_legacy_metadata_records_inside_pin_payload() {
  await withServerState(async (state) => {
    const targetModelId = 1061;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_deep_nested_legacy_record_removed', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: pinPayloadRecords({
        opId: 'req_0375_deep_nested_legacy_record',
        endpointWorkerId: 'U1',
        endpointModelId: targetModelId,
        endpointPin: 'result',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit',
        replyTargetWorkerId: 'U1',
        replyTargetModelId: targetModelId,
        replyTargetPin: 'result',
        payload: deeplyNestedLegacyRecord(24, 'source_model_id'),
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('source_model_id'),
      undefined,
      'pin_payload with deeply nested legacy source_model_id records must be rejected',
    );
  });
  return { key: 'server_rejects_deeply_nested_legacy_metadata_records_inside_pin_payload', status: 'PASS' };
}

async function test_server_rejects_plain_json_legacy_keys_inside_pin_payload() {
  await withServerState(async (state) => {
    const targetModelId = 1062;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_plain_json_legacy_key_removed', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });

    for (const key of ['source_model_id', 'pin', 'route', ...removedReturnTopicKeys]) {
      state.programEngine.handleDyBusEvent({
        version: 'v1',
        type: 'pin_payload',
        payload: pinPayloadRecords({
          opId: `req_0375_plain_json_${key}`,
          endpointWorkerId: 'U1',
          endpointModelId: targetModelId,
          endpointPin: 'result',
          originWorkerId: 'R1',
          originModelId: 3000,
          originPin: 'submit',
          replyTargetWorkerId: 'U1',
          replyTargetModelId: targetModelId,
          replyTargetPin: 'result',
          payload: plainJsonLegacyPayloadRecords(key).find((record) => record.k === 'payload').v,
        }),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('plain_json_legacy'),
      undefined,
      'pin_payload with plain JSON legacy keys must be rejected',
    );
  });
  return { key: 'server_rejects_plain_json_legacy_keys_inside_pin_payload', status: 'PASS' };
}

async function test_server_rejects_legacy_record_extra_properties_inside_pin_payload() {
  await withServerState(async (state) => {
    const targetModelId = 1063;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_extra_legacy_record_property_removed', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });

    for (const key of ['source_model_id', ...removedReturnTopicKeys]) {
      state.programEngine.handleDyBusEvent({
        version: 'v1',
        type: 'pin_payload',
        payload: withLegacyOwnProperty(pinPayloadRecords({
          opId: `req_0375_extra_legacy_record_property_${key}`,
          endpointWorkerId: 'U1',
          endpointModelId: targetModelId,
          endpointPin: 'result',
          originWorkerId: 'R1',
          originModelId: 3000,
          originPin: 'submit',
          replyTargetWorkerId: 'U1',
          replyTargetModelId: targetModelId,
          replyTargetPin: 'result',
          payload: [mt('display_text', 'str', 'must_not_write_extra_prop')],
        }), key),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('display_text'),
      undefined,
      'pin_payload with legacy extra record properties must be rejected',
    );
  });
  return { key: 'server_rejects_legacy_record_extra_properties_inside_pin_payload', status: 'PASS' };
}

async function test_server_owner_materialization_rejects_malformed_nested_pin_payload_pin_label() {
  await withServerState(async (state) => {
    const targetModelId = 1070;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_owner_malformed_pin_payload_removed', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'dual_bus_model', t: 'json', v: { mode: 'imported_host_egress', egress_pins: ['submit'] } });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: pinPayloadRecords({
        opId: 'req_0375_owner_malformed_pin_payload',
        endpointWorkerId: 'U1',
        endpointModelId: targetModelId,
        endpointPin: 'result',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit',
        replyTargetWorkerId: 'U1',
        replyTargetModelId: targetModelId,
        replyTargetPin: 'result',
        payload: [mt('submit', 'pin.in', malformedPinPayloadV1Records())],
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('submit'),
      undefined,
      'owner materialization must not store malformed nested pin_payload.v1 pin labels',
    );
  });
  return { key: 'server_owner_materialization_rejects_malformed_nested_pin_payload_pin_label', status: 'PASS' };
}

async function test_server_return_accepts_safe_numeric_origin_segments() {
  await withServerState(async (state) => {
    const targetModelId = 1071;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0375_numeric_origin_segments', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'dual_bus_model', t: 'json', v: { mode: 'imported_host_egress', egress_pins: ['submit'] } });

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: pinPayloadRecords({
        opId: 'req_0375_numeric_origin_segments',
        messageRole: 'response',
        topic: `UIPUT/ws/dam/pic/de/U1/${targetModelId}/result`,
        responseTopic: `UIPUT/ws/dam/pic/de/U1/${targetModelId}/result`,
        endpointWorkerId: 'U1',
        endpointModelId: targetModelId,
        endpointPin: 'result',
        originWorkerId: '1',
        originModelId: 3000,
        originPin: '9',
        replyTargetWorkerId: 'U1',
        replyTargetModelId: targetModelId,
        replyTargetPin: 'result',
        payload: [mt('display_text', 'str', 'numeric origin accepted')],
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(
      state.runtime.getCell(targetModel, 0, 0, 0).labels.get('display_text')?.v,
      'numeric origin accepted',
      'server return parsing must accept 0375-safe numeric worker/pin origin segments',
    );
  });
  return { key: 'server_return_accepts_safe_numeric_origin_segments', status: 'PASS' };
}

function collectExecutableStrings(value, out = []) {
  if (!value) return out;
  if (Array.isArray(value)) {
    for (const item of value) collectExecutableStrings(item, out);
    return out;
  }
  if (typeof value !== 'object') return out;
  if (value.t === 'func.js' && value.v && typeof value.v.code === 'string') {
    out.push({ key: value.k || '', text: value.v.code });
  }
  for (const child of Object.values(value)) collectExecutableStrings(child, out);
  return out;
}

function collectModelTableRecords(value, out = []) {
  if (!value) return out;
  if (Array.isArray(value)) {
    for (const item of value) collectModelTableRecords(item, out);
    return out;
  }
  if (typeof value !== 'object') return out;
  const keys = Object.keys(value).sort().join(',');
  if (keys === 'c,id,k,p,r,t,v'
    && Number.isInteger(value.id)
    && Number.isInteger(value.p)
    && Number.isInteger(value.r)
    && Number.isInteger(value.c)
    && typeof value.k === 'string'
    && typeof value.t === 'string') {
    out.push(value);
  }
  for (const child of Object.values(value)) collectModelTableRecords(child, out);
  return out;
}

async function test_current_tier2_and_fixture_sources_have_no_legacy_transport_metadata() {
  const sourceFiles = [
    'deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json',
    'deploy/sys-v1ns/remote-worker/patches/10_model100.json',
    'deploy/sys-v1ns/remote-worker/patches/11_model1010.json',
    'deploy/sys-v1ns/remote-worker/patches/12_model1019.json',
    'deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json',
    'packages/worker-base/system-models/test_model_100_ui.json',
    'packages/worker-base/system-models/workspace_positive_models.json',
    'test_files/minimal_submit_dual_bus_app_payload.json',
    'test_files/imported_host_egress_app_payload.json',
  ];
  const legacyPatterns = [
    { name: 'old worker/model/pin topic', pattern: /UIPUT\/[^"'\s]+\/worker\/[^"'\s]+\/model\/[^"'\s]+\/pin\//u },
    { name: 'source_model_id metadata', pattern: /source_model_id/u },
    { name: 'reply_to metadata', pattern: /\breply_to\b/u },
    { name: 'route.reply_to metadata', pattern: /route\.reply_to/u },
    { name: 'return topic metadata', pattern: /return_topic|returnTopic|result_topic/u },
    { name: 'route record metadata', pattern: /\bk:\s*['"]route['"]|["']k["']\s*:\s*["']route["']/u },
  ];
  const failures = [];
  for (const relPath of sourceFiles) {
    const raw = readFileSync(new URL(relPath, repoRoot), 'utf8');
    if (/UIPUT\/[^"'\s]+\/worker\/[^"'\s]+\/model\/[^"'\s]+\/pin\//u.test(raw)) {
      failures.push(`${relPath}: old worker/model/pin topic`);
    }
    const json = JSON.parse(raw);
    for (const record of collectModelTableRecords(json)) {
      if (['source_model_id', 'pin', 'route', 'reply_to', 'route.reply_to', 'return_topic', 'returnTopic', 'result_topic'].includes(record.k)) {
        failures.push(`${relPath}: modeltable record ${record.k}`);
      }
    }
    for (const entry of collectExecutableStrings(json)) {
      for (const { name, pattern } of legacyPatterns.slice(1)) {
        if (pattern.test(entry.text)) failures.push(`${relPath}:${entry.key}: ${name}`);
      }
    }
  }
  assert.deepEqual(failures, [], `current Tier2 and app fixture sources must not use legacy transport metadata: ${failures.join('; ')}`);
  return { key: 'current_tier2_and_fixture_sources_have_no_legacy_transport_metadata', status: 'PASS' };
}

async function test_runtime_semantics_payload_contract_does_not_require_plain_pin() {
  const source = readFileSync(new URL('docs/ssot/runtime_semantics_modeltable_driven.md', repoRoot), 'utf8');
  const payloadSection = source.match(/### 7\.1 Payload[\s\S]*?### 7\.2 Routing/u)?.[0] || '';
  assert.ok(payloadSection, 'runtime semantics payload section must be present');
  assert.equal(/-\s+`pin`\s*(?:\n|$)/u.test(payloadSection), false, 'runtime semantics must not list plain pin as a required payload record');
  for (const required of [
    'message_role',
    'endpoint_worker_id',
    'endpoint_model_id',
    'endpoint_pin',
    'origin_worker_id',
    'origin_model_id',
    'origin_pin',
    'reply_target_worker_id',
    'reply_target_model_id',
    'reply_target_pin',
  ]) {
    assert.ok(payloadSection.includes(required), `runtime semantics payload section must require ${required}`);
  }
  assert.ok(payloadSection.includes('`pin=result`'), 'runtime semantics must explicitly name plain pin reply-target inference as forbidden');
  assert.match(payloadSection, /不得从 topic 末段/u, 'runtime semantics must explicitly reject inferring reply target from topic suffix');
  return { key: 'runtime_semantics_payload_contract_does_not_require_plain_pin', status: 'PASS' };
}

async function test_frontend_projection_does_not_parse_removed_console_ack_shape() {
  const source = readFileSync(new URL('packages/ui-model-demo-frontend/src/editor_page_state_derivers.js', repoRoot), 'utf8');
  assert.equal(source.includes("payload.type === 'mgmt_bus_console_ack'"), false, 'frontend projection must not parse retired direct mgmt_bus_console_ack packets');
  assert.equal(source.includes('payload.source_model_id'), false, 'frontend projection must not read retired loose source_model_id fields');
  return { key: 'frontend_projection_does_not_parse_removed_console_ack_shape', status: 'PASS' };
}

const tests = [
  test_runtime_topic_for_builds_unified_worker_model_topic,
  test_runtime_mqtt_incoming_accepts_unified_endpoint_topic_without_loose_pin,
  test_runtime_mqtt_incoming_ignores_response_role_on_endpoint_topic,
  test_runtime_rejects_legacy_worker_model_pin_topic_even_with_legacy_packet,
  test_runtime_rejects_missing_extra_and_old_two_segment_topic_forms,
  test_runtime_rejects_short_base_unified_topic_shape,
  test_runtime_rejects_model0_and_invalid_model_endpoint_topics,
  test_runtime_rejects_nonnormalized_model_id_topic_segments,
  test_runtime_rejects_loose_top_level_fields_on_unified_topic,
  test_runtime_rejects_unknown_top_level_fields_on_unified_topic,
  test_runtime_rejects_removed_topic_modes,
  test_runtime_rejects_missing_endpoint_records,
  test_runtime_rejects_missing_origin_records,
  test_runtime_rejects_missing_reply_target_records,
  test_runtime_rejects_missing_or_invalid_message_role,
  test_runtime_rejects_duplicate_required_pin_payload_metadata,
  test_pin_bus_externalization_rejects_legacy_route_payload_records,
  test_pin_bus_externalization_rejects_nested_legacy_payload_records,
  test_pin_bus_externalization_rejects_deeply_nested_legacy_payload_records,
  test_pin_bus_externalization_rejects_plain_json_legacy_keys,
  test_pin_bus_externalization_rejects_legacy_record_extra_properties,
  test_pin_bus_externalization_rejects_metadata_wrong_types,
  test_pin_bus_externalization_rejects_missing_request_correlation,
  test_runtime_rejects_legacy_reply_to_records,
  test_runtime_bus_in_rejects_legacy_metadata_records,
  test_runtime_bus_in_rejects_plain_json_legacy_keys,
  test_runtime_bus_in_rejects_legacy_record_extra_properties,
  test_runtime_bus_in_rejects_pin_payload_metadata_wrong_types,
  test_runtime_bus_in_rejects_missing_request_correlation,
  test_mt_bus_send_rejects_deeply_nested_legacy_reply_to,
  test_mt_bus_send_rejects_nested_legacy_payload_records,
  test_mt_bus_send_rejects_plain_json_legacy_keys,
  test_mt_bus_send_rejects_legacy_record_extra_properties,
  test_split_bus_out_rejects_legacy_reply_to_records,
  test_pin_bus_externalization_uses_only_record_array_payload_metadata,
  test_split_bus_out_accepts_endpoint_records_and_rejects_route_record,
  test_worker_engine_publishes_control_bus_to_unified_endpoint_topic,
  test_worker_engine_publishes_response_to_response_topic,
  test_worker_engine_rejects_short_payload_topic,
  test_worker_engine_rejects_padded_payload_topic,
  test_generic_worker_bootstrap_subscribes_only_unified_endpoint_topics,
  test_generic_worker_bootstrap_validates_topic_payload_endpoint_match,
  test_generic_worker_matrix_ingress_validates_strict_pin_payload_packet,
  test_runtime_start_mqtt_loop_does_not_subscribe_model0_bus_in_topics,
  test_runtime_direct_bus_out_publishes_endpoint_topic,
  test_runtime_direct_bus_out_rejects_short_base_topic,
  test_runtime_rejects_padded_configured_worker_id,
  test_server_pin_payload_return_materializes_by_reply_target_records,
  test_server_rejects_remote_endpoint_response,
  test_server_pin_payload_result_without_reply_target_is_rejected,
  test_server_pin_payload_extra_top_level_field_is_rejected,
  test_server_direct_pin_rejects_legacy_reply_to_records_inside_arrays,
  test_server_direct_pin_rejects_legacy_reply_to_arrays_for_positive_and_negative_models,
  test_server_direct_pin_rejects_malformed_pin_payload_arrays_for_positive_and_negative_models,
  test_server_rejects_snapshot_delta_return_path,
  test_server_rejects_direct_mgmt_bus_console_ack,
  test_server_rejects_mgmt_ack_with_wrong_reply_target,
  test_server_rejects_pin_payload_missing_outer_kind,
  test_server_rejects_pin_payload_metadata_wrong_types,
  test_server_rejects_missing_request_correlation,
  test_server_rejects_matrix_mbr_ready_event,
  test_server_rejects_padded_pin_payload_metadata,
  test_server_rejects_origin_only_padded_pin_payload_metadata,
  test_server_rejects_duplicate_required_pin_payload_metadata,
  test_server_rejects_legacy_metadata_records_inside_pin_payload,
  test_server_rejects_nested_legacy_metadata_records_inside_pin_payload,
  test_server_rejects_deeply_nested_legacy_metadata_records_inside_pin_payload,
  test_server_rejects_plain_json_legacy_keys_inside_pin_payload,
  test_server_rejects_legacy_record_extra_properties_inside_pin_payload,
  test_server_owner_materialization_rejects_malformed_nested_pin_payload_pin_label,
  test_server_return_accepts_safe_numeric_origin_segments,
  test_current_tier2_and_fixture_sources_have_no_legacy_transport_metadata,
  test_runtime_semantics_payload_contract_does_not_require_plain_pin,
  test_frontend_projection_does_not_parse_removed_console_ack_shape,
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
