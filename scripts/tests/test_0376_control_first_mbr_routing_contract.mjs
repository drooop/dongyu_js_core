#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';
import { WorkerEngineV0, loadSystemPatch } from '../worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;
const repoRoot = new URL('../..', import.meta.url).pathname;
const minimalPayloadPath = join(repoRoot, 'test_files', 'minimal_submit_dual_bus_app_payload.json');

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function mt(k, t, v, id = 0) {
  return { id, p: 0, r: 0, c: 0, k, t, v };
}

function payloadRecord(records, key, id = 0) {
  return Array.isArray(records)
    ? records.find((record) => record && record.id === id && record.k === key) || null
    : null;
}

function payloadString(records, key, id = 0) {
  const record = payloadRecord(records, key, id);
  return record && record.t === 'str' ? record.v : '';
}

function payloadInt(records, key, id = 0) {
  const record = payloadRecord(records, key, id);
  return record && record.t === 'int' ? record.v : null;
}

function externalPacket(records) {
  return { version: 'v1', type: 'pin_payload', payload: records };
}

function tempPayload(text = 'hello control first') {
  return [
    mt('model_type', 'model.table', 'Data.MinimalSubmit'),
    mt('text', 'str', text),
  ];
}

function providerBundleResponsePayload() {
  return [
    mt('__mt_payload_kind', 'str', 'slide_app_bundle_response.v1'),
    mt('__mt_request_id', 'str', 'req_0389_provider_bundle'),
    mt('asset_id', 'str', 'r1-minimal-submit'),
    mt('bundle_record_id_offset', 'int', 100),
  ];
}

function providerBundleResponseExtraRecords() {
  return [
    mt('app_name', 'str', '最小 Submit 双总线示例', 100),
    mt('slide_capable', 'bool', true, 100),
    mt('model_type', 'model.table', 'UI.MinimalSubmitDualBusZip', 100),
    { id: 100, p: 2, r: 3, c: 0, k: 'ui_component', t: 'str', v: 'Button' },
    {
      id: 100,
      p: 2,
      r: 3,
      c: 0,
      k: 'ui_bind_json',
      t: 'json',
      v: {
        write: {
          bus_event_v2: true,
          bus_in_key: 'submit_request',
          value_t: 'modeltable',
          commit_policy: 'immediate',
        },
      },
    },
  ];
}

function pinPayloadRecords({
  opId = '0376_control_first',
  topic = null,
  responseTopic = null,
  routeKind = 'control',
  bus = routeKind,
  endpointWorkerId = 'R1',
  endpointModelId = 3000,
  endpointPin = 'submit1',
  endpointTableId = 'host',
  originWorkerId = 'U1',
  originModelId = 2000,
  originPin = 'submit1',
  originTableId = 'app:0376:control-first',
  replyTargetWorkerId = 'U1',
  replyTargetModelId = 0,
  replyTargetPin = 'result',
  replyTargetTableId = 'app:0376:control-first',
  messageRole = 'request',
  payload = tempPayload(),
  payloadModelId = 1,
  extraRecords = [],
  isNeedResponse = true,
} = {}) {
  const routeTopic = topic === null
    ? `UIPUT/ws/dam/pic/de/${endpointWorkerId}/${endpointModelId}/${endpointPin}`
    : topic;
  const routeResponseTopic = responseTopic === null
    ? `UIPUT/ws/dam/pic/de/${replyTargetWorkerId}/${replyTargetTableId === 'host' ? replyTargetModelId : 1051}/${replyTargetPin}`
    : responseTopic;
  const records = [
    mt('__mt_payload_kind', 'str', 'pin_payload.v2'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('topic', 'str', routeTopic),
    mt('response_topic', 'str', routeResponseTopic),
    ...(routeKind === null ? [] : [mt('route_kind', 'str', routeKind)]),
    ...(bus === null ? [] : [mt('bus', 'str', bus)]),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    mt('endpoint_table_id', 'str', endpointTableId),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', originWorkerId),
    mt('origin_table_id', 'str', originTableId),
    mt('origin_model_id', 'int', originModelId),
    mt('origin_pin', 'str', originPin),
    mt('reply_target_worker_id', 'str', replyTargetWorkerId),
    mt('reply_target_table_id', 'str', replyTargetTableId),
    mt('reply_target_model_id', 'int', replyTargetModelId),
    mt('reply_target_pin', 'str', replyTargetPin),
    mt('payload_model_id', 'int', payloadModelId),
    mt('timestamp', 'int', 1700000000000),
    mt('is_need_response', 'bool', isNeedResponse),
    ...payload.map((record) => ({ ...record, id: payloadModelId })),
    ...extraRecords,
  ];
  return records;
}

function pinPayloadPacket(options) {
  const {
    endpoint,
    origin,
    replyTarget,
    payload,
    messageRole = 'response',
    ...rest
  } = options;
  return externalPacket(pinPayloadRecords({
    ...rest,
    messageRole,
    endpointWorkerId: endpoint.worker_id,
    endpointTableId: endpoint.table_id,
    endpointModelId: endpoint.model_id,
    endpointPin: endpoint.pin,
    originWorkerId: origin.worker_id,
    originTableId: origin.table_id,
    originModelId: origin.model_id,
    originPin: origin.pin,
    replyTargetWorkerId: replyTarget.worker_id,
    replyTargetTableId: replyTarget.table_id,
    replyTargetModelId: replyTarget.model_id,
    replyTargetPin: replyTarget.pin,
    payload,
  }));
}

function mbrResponseRecords(options = {}) {
  const topic = 'UIPUT/ws/dam/pic/de/U1/2000/result';
  return pinPayloadRecords({
    messageRole: 'response',
    topic,
    responseTopic: topic,
    endpointWorkerId: 'U1',
    endpointTableId: 'host',
    endpointModelId: 2000,
    endpointPin: 'result',
    originWorkerId: 'R1',
    originTableId: 'host',
    originModelId: 3100,
    originPin: 'bundle_request',
    ...options,
  });
}

function withoutRecords(records, keys) {
  const deny = new Set(keys);
  return records.filter((record) => !deny.has(record.k));
}

function loadMbrRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  rt.applyPatch(readJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json'), {
    allowCreateModel: true,
    trustedBootstrap: true,
  });
  if (!rt.isRuntimeRunning || !rt.isRuntimeRunning()) {
    if (!rt.getRuntimeMode || rt.getRuntimeMode() === 'boot') rt.setRuntimeMode('edit');
    rt.setRuntimeMode('running');
  }
  return rt;
}

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0376-import-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0376_import_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'ui-server-0376';
  try {
    const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
    const state = createServerState({ dbPath: null });
    await state.activateRuntimeMode('running');
    return await fn(state);
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

async function test_ui_server_cb_out_publishes_control_bus_not_matrix() {
  return withServerState(async (state) => {
    const published = [];
    let matrixCalled = false;
    if (state.programEngine.controlBusClient && typeof state.programEngine.controlBusClient.end === 'function') {
      state.programEngine.controlBusClient.end(true);
    }
    state.programEngine.controlBusClient = {
      connected: true,
      publish: (topic, payload, cb) => {
        published.push({ topic, payload: JSON.parse(payload) });
        cb && cb(null);
      },
    };
    state.programEngine.matrixAdapter = {
      publish: async () => {
        matrixCalled = true;
        return true;
      },
    };
    state.programEngine.matrixRoomId = '!room:local';
    state.programEngine.matrixDmPeerUserId = '@mbr:local';
    const model0 = state.runtime.getModel(0);
    const records = pinPayloadRecords({
      opId: 'ui_server_cb_out_0376',
      topic: 'UIPUT/ws/dam/pic/de/R1/100/submit',
      routeKind: 'control',
      endpointWorkerId: 'R1',
      endpointModelId: 100,
      endpointPin: 'submit',
    });
    state.runtime.addLabel(model0, 0, 0, 0, {
      k: 'ui_server_test_cb_out',
      t: 'pin.bus.cb.out',
      v: records,
    });
    state.programEngine.schedulePendingModel0Egress();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(published.length, 1, 'ui-server pin.bus.cb.out must publish exactly once to MQTT control bus');
    assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/R1/100/submit', 'ui-server control publish must use payload topic record');
    assert.equal(matrixCalled, false, 'ui-server pin.bus.cb.out must not use Matrix management adapter');
    return { key: 'ui_server_cb_out_publishes_control_bus_not_matrix', status: 'PASS' };
  });
}

async function test_ui_server_cb_out_dedup_distinguishes_request_and_response_for_same_op_id() {
  return withServerState(async (state) => {
    const published = [];
    if (state.programEngine.controlBusClient && typeof state.programEngine.controlBusClient.end === 'function') {
      state.programEngine.controlBusClient.end(true);
    }
    state.programEngine.controlBusClient = {
      connected: true,
      publish: (topic, payload, cb) => {
        published.push({ topic, payload: JSON.parse(payload) });
        cb && cb(null);
      },
    };
    const model0 = state.runtime.getModel(0);
    const common = {
      opId: 'same_op_ui_server_0376',
      topic: 'UIPUT/ws/dam/pic/de/R1/100/submit',
      routeKind: 'control',
      endpointWorkerId: 'R1',
      endpointModelId: 100,
      endpointPin: 'submit',
    };
    state.runtime.addLabel(model0, 0, 0, 0, {
      k: 'ui_server_same_op_cb_out',
      t: 'pin.bus.cb.out',
      v: pinPayloadRecords({ ...common, messageRole: 'request' }),
    });
    state.programEngine.schedulePendingModel0Egress();
    await new Promise((resolve) => setTimeout(resolve, 0));
    state.runtime.addLabel(model0, 0, 0, 0, {
      k: 'ui_server_same_op_cb_out',
      t: 'pin.bus.cb.out',
      v: pinPayloadRecords({
        ...common,
        messageRole: 'response',
        topic: 'UIPUT/ws/dam/pic/de/U1/2000/result',
        responseTopic: 'UIPUT/ws/dam/pic/de/U1/2000/result',
        endpointWorkerId: 'U1',
        endpointModelId: 2000,
        endpointPin: 'result',
      }),
    });
    state.programEngine.schedulePendingModel0Egress();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(published.length, 2, 'ui-server must publish request and response even when op_id and bus key match');
    assert.equal(payloadString(published[0].payload.payload, 'message_role'), 'request', 'first ui-server publish must be request');
    assert.equal(payloadString(published[1].payload.payload, 'message_role'), 'response', 'second ui-server publish must be response');
    return { key: 'ui_server_cb_out_dedup_distinguishes_request_and_response_for_same_op_id', status: 'PASS' };
  });
}

function wait(ms = 160) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(predicate, { timeoutMs = 1000, intervalMs = 25 } = {}) {
  const started = Date.now();
  while (Date.now() - started <= timeoutMs) {
    const value = predicate();
    if (value) return value;
    await wait(intervalMs);
  }
  return predicate();
}

function cacheMinimalZip(state, uri) {
  const payload = JSON.parse(fs.readFileSync(minimalPayloadPath, 'utf8'));
  state.cacheUploadedMediaForTest(uri, {
    buffer: buildZipBuffer(payload),
    contentType: 'application/zip',
    filename: 'minimal-submit-0376.zip',
    userId: '@manual:localhost',
  });
}

function drainWorkerEngine(rt) {
  const mqttPublished = [];
  const mgmtPublished = [];
  const engine = new WorkerEngineV0({
    runtime: rt,
    mqttPublish: (topic, payload) => mqttPublished.push({ topic, payload }),
    mgmtAdapter: { publish: async (event) => mgmtPublished.push(event) },
  });
  if (!rt.isRuntimeRunning || !rt.isRuntimeRunning()) {
    if (!rt.getRuntimeMode || rt.getRuntimeMode() === 'boot') rt.setRuntimeMode('edit');
    rt.setRuntimeMode('running');
  }
  engine.tick();
  return { mqttPublished, mgmtPublished };
}

function lastRejectedReason(rt) {
  const rejected = rt.eventLog.list().filter((event) => event && event.result === 'rejected');
  return rejected.length ? rejected[rejected.length - 1].reason : '';
}

function lastMbrControlIngressError(rt) {
  return rt.getCell(rt.getModel(-10), 0, 0, 0).labels.get('mbr_mqtt_error')?.v?.detail
    || lastRejectedReason(rt);
}

function test_worker_engine_publishes_cb_out_to_payload_topic_without_endpoint_fallback() {
  {
    const rt = loadMbrRuntime();
    const model0 = rt.getModel(0);
    rt.addLabel(model0, 0, 0, 0, {
      k: 'mbr_cb_out',
      t: 'pin.bus.cb.out',
      v: pinPayloadRecords({
        opId: '0376_engine_topic_truth',
        topic: 'UIPUT/ws/dam/pic/de/R2/999/submit',
        endpointWorkerId: 'R2',
        endpointModelId: 999,
        endpointPin: 'submit',
      }),
    });
    const { mqttPublished } = drainWorkerEngine(rt);
    assert.equal(mqttPublished.length, 1, 'control bus out must publish once');
    assert.equal(mqttPublished[0].topic, 'UIPUT/ws/dam/pic/de/R2/999/submit', 'published topic must come from payload topic record, not endpoint records');
  }

  {
    const rt = loadMbrRuntime();
    const model0 = rt.getModel(0);
    rt.addLabel(model0, 0, 0, 0, {
      k: 'mbr_cb_out_missing_topic',
      t: 'pin.bus.cb.out',
      v: withoutRecords(pinPayloadRecords({ opId: '0376_engine_missing_topic' }), ['topic']),
    });
    const afterMissing = drainWorkerEngine(rt);
    assert.equal(afterMissing.mqttPublished.length, 0, 'missing topic must fail closed instead of deriving from endpoint records');
    assert.equal(afterMissing.mgmtPublished.length, 0, 'missing topic must not publish to management bus');
    assert.equal(rt.getCell(model0, 0, 0, 0).labels.get('split_bus_out_error')?.v?.code, 'invalid_split_bus_payload', 'missing topic must write visible split bus error');
  }
  return { key: 'worker_engine_publishes_cb_out_to_payload_topic_without_endpoint_fallback', status: 'PASS' };
}

function test_worker_engine_rejects_unsafe_payload_topics() {
  for (const [name, topic] of [
    ['empty', ''],
    ['not_uiput', 'not-uiput'],
    ['wrong_prefix', 'NOPE/ws/dam/pic/de/sw/R2/999/submit'],
    ['wrong_segment_count', 'UIPUT/ws/dam/pic/de/R2/999'],
    ['wildcard_plus', 'UIPUT/ws/dam/pic/de/R2/999/+'],
    ['wildcard_hash', 'UIPUT/ws/dam/pic/de/R2/999/#'],
    ['empty_segment', 'UIPUT/ws/dam/pic/de//999/submit'],
    ['zero_model', 'UIPUT/ws/dam/pic/de/R2/0/submit'],
    ['leading_zero_model', 'UIPUT/ws/dam/pic/de/R2/0999/submit'],
  ]) {
    const rt = loadMbrRuntime();
    const model0 = rt.getModel(0);
    rt.addLabel(model0, 0, 0, 0, {
      k: `mbr_cb_out_${name}`,
      t: 'pin.bus.cb.out',
      v: pinPayloadRecords({ opId: `0376_unsafe_${name}`, topic }),
    });
    const { mqttPublished } = drainWorkerEngine(rt);
    assert.equal(mqttPublished.length, 0, `${name} topic must not publish`);
    assert.equal(rt.getCell(model0, 0, 0, 0).labels.get('split_bus_out_error')?.v?.code, 'invalid_split_bus_payload', `${name} topic must write visible split bus error`);
  }
  return { key: 'worker_engine_rejects_unsafe_payload_topics', status: 'PASS' };
}

async function test_mbr_control_ingress_uses_model_zero_to_minus10_pin_chain_and_routes_by_topic() {
  const rt = loadMbrRuntime();
  const model0Root = rt.getCell(rt.getModel(0), 0, 0, 0).labels;
  assert.equal(model0Root.get('mbr_cb_in')?.t, 'pin.bus.cb.in', 'MBR must declare a control-bus ingress pin on Model 0');
  const infrastructureFunctions = new Set(['mt_write', 'mt_bus_receive', 'mt_bus_send']);
  assert.equal(
    Array.from(model0Root.entries()).some(([key, label]) => label?.t === 'func.js' && !infrastructureFunctions.has(key)),
    false,
    'MBR Model 0 must remain a structural bus boundary without business functions',
  );
  const mount = rt.getCell(rt.getModel(0), 1, 0, 0).labels;
  assert.equal(mount.get('model_type')?.t, 'model.submtconnection', 'MBR Model 0 must mount Model -10 through a connection Cell');
  assert.equal(mount.get('model_type')?.v, -10, 'MBR connection Cell must target Model -10');
  assert.equal(mount.get('mbr_cb_ingress')?.t, 'pin.in', 'MBR connection Cell must expose control ingress pin');
  assert.equal(mount.get('mbr_cb_egress')?.t, 'pin.out', 'MBR connection Cell must expose control egress pin');
  const routes = model0Root.get('mbr_bus_routes');
  assert.equal(routes?.t, 'pin.connect.cell', 'MBR Model 0 bus pins must route structurally through the connection Cell');
  assert.equal(
    routes.v.some((route) => JSON.stringify(route) === JSON.stringify({
      from: [0, 0, 0, 'mbr_cb_in'],
      to: [[1, 0, 0, 'mbr_cb_ingress']],
    })),
    true,
    'MBR control ingress must route from Model 0 to Model -10 boundary',
  );
  assert.equal(
    routes.v.some((route) => JSON.stringify(route) === JSON.stringify({
      from: [1, 0, 0, 'mbr_cb_egress'],
      to: [[0, 0, 0, 'mbr_cb_out']],
    })),
    true,
    'MBR control egress must route from Model -10 back to Model 0',
  );
  const systemRoot = rt.getCell(rt.getModel(-10), 0, 0, 0).labels;
  assert.equal(systemRoot.get('mbr_cb_ingress')?.t, 'pin.in', 'Model -10 must declare the child-side control ingress pin');
  assert.equal(systemRoot.get('mbr_mqtt_to_mgmt')?.t, 'func.js', 'Model -10 must own the MQTT response routing function');
  assert.deepEqual(
    systemRoot.get('mbr_dispatch_wiring')?.v?.find((route) => route.from === 'mbr_cb_ingress'),
    { from: 'mbr_cb_ingress', to: ['mbr_mqtt_to_mgmt:in'] },
    'Model -10 control ingress pin must trigger its declared response router',
  );
  const topic = 'UIPUT/ws/dam/pic/de/U1/2000/result';
  rt.addLabel(rt.getModel(0), 0, 0, 0, {
    k: 'mbr_cb_in',
    t: 'pin.bus.cb.in',
    v: pinPayloadRecords({
      opId: '0376_mbr_control_response',
      topic,
      responseTopic: topic,
      routeKind: 'control',
      messageRole: 'response',
      endpointWorkerId: 'U1',
      endpointModelId: 2000,
      endpointPin: 'result',
      originWorkerId: 'R1',
      originTableId: 'host',
      originModelId: 3100,
      originPin: 'bundle_request',
    }),
  });
  const cbOut = await waitUntil(() => {
    const label = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_cb_out');
    return payloadString(label?.v, 'op_id') === '0376_mbr_control_response' ? label : null;
  });
  assert.equal(cbOut?.t, 'pin.bus.cb.out', 'control response must traverse Model -10 and write Model 0 control bus out');
  assert.equal(payloadString(cbOut?.v, 'topic'), topic, 'MBR must preserve payload topic as route truth');
  assert.equal(payloadString(cbOut?.v, 'route_kind'), 'control', 'v2 control response must preserve explicit route_kind');
  const { mqttPublished } = drainWorkerEngine(rt);
  assert.equal(mqttPublished[0]?.topic, topic, 'MBR control output must publish to payload topic');
  return { key: 'mbr_control_ingress_uses_model_zero_to_minus10_pin_chain_and_routes_by_topic', status: 'PASS' };
}

async function test_mbr_control_ingress_routes_management_response_and_rejects_invalid_v2_fields() {
  {
    const rt = loadMbrRuntime();
    const topic = 'UIPUT/ws/dam/pic/de/U1/2000/result';
    rt.addLabel(rt.getModel(0), 0, 0, 0, {
      k: 'mbr_cb_in',
      t: 'pin.bus.cb.in',
      v: pinPayloadRecords({
        opId: '0376_mbr_management_response',
        routeKind: 'management',
        topic,
        responseTopic: topic,
        messageRole: 'response',
        endpointWorkerId: 'U1',
        endpointModelId: 2000,
        endpointPin: 'result',
        originWorkerId: 'R1',
        originTableId: 'host',
        originModelId: 3100,
        originPin: 'bundle_request',
      }),
    });
    const root = rt.getCell(rt.getModel(0), 0, 0, 0).labels;
    const mbOut = await waitUntil(() => {
      const label = root.get('mbr_mb_out');
      return payloadString(label?.v, 'op_id') === '0376_mbr_management_response' ? label : null;
    });
    assert.equal(mbOut?.t, 'pin.bus.mb.out', 'management response must traverse Model -10 and write management bus out');
    assert.equal(root.get('mbr_cb_out')?.v ?? null, null, 'management response must not also write control bus out');
    assert.equal(payloadString(mbOut?.v, 'route_kind'), 'management', 'management output must preserve route_kind');
    assert.equal(drainWorkerEngine(rt).mqttPublished.length, 0, 'management response must not publish to MQTT control bus');
  }

  for (const [name, records, detail] of [
    ['missing_topic', withoutRecords(mbrResponseRecords({ opId: '0376_missing_topic' }), ['topic']), 'bus_in_invalid_topic'],
    ['invalid_route_kind', mbrResponseRecords({ opId: '0376_invalid_route_kind', routeKind: 'legacy' }), 'bus_in_invalid_route_kind'],
    ['legacy_return_topic', [...mbrResponseRecords({ opId: '0376_legacy_return_topic' }), mt('return_topic', 'str', 'UIPUT/ws/dam/pic/de/U1/2000/result')], 'legacy_pin_payload_metadata_removed'],
    ['legacy_route_reply_to', [...mbrResponseRecords({ opId: '0376_legacy_route_reply_to' }), mt('route.reply_to', 'str', 'UIPUT/ws/dam/pic/de/U1/2000/result')], 'legacy_pin_payload_metadata_removed'],
    ['legacy_result_topic', [...mbrResponseRecords({ opId: '0376_legacy_result_topic' }), mt('result_topic', 'str', 'UIPUT/ws/dam/pic/de/U1/2000/result')], 'legacy_pin_payload_metadata_removed'],
    ['unsafe_empty_topic', mbrResponseRecords({ opId: '0376_unsafe_empty_topic', topic: '' }), 'bus_in_invalid_topic'],
    ['unsafe_plus_topic', mbrResponseRecords({ opId: '0376_unsafe_plus_topic', topic: 'UIPUT/ws/dam/pic/de/U1/2000/+' }), 'bus_in_invalid_topic'],
    ['unsafe_hash_topic', mbrResponseRecords({ opId: '0376_unsafe_hash_topic', topic: 'UIPUT/ws/dam/pic/de/U1/2000/#' }), 'bus_in_invalid_topic'],
    ['unsafe_empty_segment_topic', mbrResponseRecords({ opId: '0376_unsafe_empty_segment_topic', topic: 'UIPUT/ws/dam/pic/de//2000/result' }), 'bus_in_invalid_topic'],
    ['unsafe_leading_slash_topic', mbrResponseRecords({ opId: '0376_unsafe_leading_slash_topic', topic: '/UIPUT/ws/dam/pic/de/U1/2000/result' }), 'bus_in_invalid_topic'],
    ['unsafe_trailing_slash_topic', mbrResponseRecords({ opId: '0376_unsafe_trailing_slash_topic', topic: 'UIPUT/ws/dam/pic/de/U1/2000/result/' }), 'bus_in_invalid_topic'],
    ['unsafe_zero_model_topic', mbrResponseRecords({ opId: '0376_unsafe_zero_model_topic', topic: 'UIPUT/ws/dam/pic/de/U1/0/result' }), 'bus_in_invalid_topic'],
    ['unsafe_leading_zero_model_topic', mbrResponseRecords({ opId: '0376_unsafe_leading_zero_model_topic', topic: 'UIPUT/ws/dam/pic/de/U1/02000/result' }), 'bus_in_invalid_topic'],
  ]) {
    const rt = loadMbrRuntime();
    const model0 = rt.getModel(0);
    rt.addLabel(model0, 0, 0, 0, {
      k: 'mbr_cb_in',
      t: 'pin.bus.cb.in',
      v: records,
    });
    await waitUntil(() => lastMbrControlIngressError(rt));
    const root = rt.getCell(model0, 0, 0, 0).labels;
    assert.equal(root.get('mbr_cb_out')?.v ?? null, null, `${name} must not write control bus out`);
    assert.equal(root.get('mbr_mb_out')?.v ?? null, null, `${name} must not write management bus out`);
    const drained = drainWorkerEngine(rt);
    assert.equal(drained.mqttPublished.length, 0, `${name} must not publish to MQTT`);
    assert.equal(drained.mgmtPublished.length, 0, `${name} must not publish to management bus`);
    const explicitDetail = lastMbrControlIngressError(rt);
    assert.equal(explicitDetail, detail, `${name} must be rejected explicitly`);
  }
  return { key: 'mbr_control_ingress_routes_management_response_and_rejects_invalid_v2_fields', status: 'PASS' };
}

async function test_mbr_pin_chain_accepts_provider_bundle_response_modeltable_payload() {
  const rt = loadMbrRuntime();
  const model0 = rt.getModel(0);
  const topic = 'UIPUT/ws/dam/pic/de/U1/2000/result';
  rt.addLabel(model0, 0, 0, 0, {
    k: 'mbr_cb_in',
    t: 'pin.bus.cb.in',
      v: mbrResponseRecords({
        opId: 'req_0389_provider_bundle_response',
        topic,
        responseTopic: topic,
        routeKind: 'control',
        payload: providerBundleResponsePayload(),
        extraRecords: providerBundleResponseExtraRecords(),
      }),
  });
  const cbOut = await waitUntil(() => {
    const label = rt.getCell(model0, 0, 0, 0).labels.get('mbr_cb_out');
    return payloadString(label?.v, 'op_id') === 'req_0389_provider_bundle_response' ? label : null;
  });
  assert.equal(cbOut?.t, 'pin.bus.cb.out', 'valid provider bundle response must be forwarded by MBR');
  assert.equal(payloadString(cbOut?.v, 'topic'), topic, 'provider bundle response must publish on response_topic');
  assert.equal(lastMbrControlIngressError(rt), '', 'valid provider bundle response must not be rejected as legacy metadata');
  assert.equal(payloadString(cbOut?.v, '__mt_payload_kind'), 'pin_payload.v2', 'forwarded provider response must retain v2 envelope kind');
  assert.equal(payloadString(cbOut?.v, '__mt_payload_kind', 1), 'slide_app_bundle_response.v1', 'provider business kind must be an inline payload-model record');
  assert.equal(payloadString(cbOut?.v, 'app_name', 100), '最小 Submit 双总线示例', 'provider bundle records must remain non-nested and offset-addressable');
  return { key: 'mbr_pin_chain_accepts_provider_bundle_response_modeltable_payload', status: 'PASS' };
}

async function test_mbr_pin_chain_rejects_legacy_label_inside_provider_bundle_payload() {
  const rt = loadMbrRuntime();
  const model0 = rt.getModel(0);
  const topic = 'UIPUT/ws/dam/pic/de/U1/2000/result';
  const bundleRecords = providerBundleResponseExtraRecords().concat([
    mt('source_model_id', 'int', 100, 100),
  ]);
  rt.addLabel(model0, 0, 0, 0, {
    k: 'mbr_cb_in',
    t: 'pin.bus.cb.in',
      v: mbrResponseRecords({
        opId: 'req_0389_provider_bundle_legacy_label',
        topic,
        responseTopic: topic,
        routeKind: 'control',
        payload: providerBundleResponsePayload(),
        extraRecords: bundleRecords,
      }),
  });
  await waitUntil(() => lastMbrControlIngressError(rt));
  const root = rt.getCell(model0, 0, 0, 0).labels;
  assert.equal(root.get('mbr_cb_out')?.v ?? null, null, 'provider bundle response with legacy bundle label must not be forwarded');
  assert.equal(lastMbrControlIngressError(rt), 'legacy_pin_payload_metadata_removed', 'legacy bundle label key must be rejected explicitly');
  return { key: 'mbr_pin_chain_rejects_legacy_label_inside_provider_bundle_payload', status: 'PASS' };
}

async function test_split_bus_dedup_distinguishes_request_and_response_for_same_op_id() {
  const rt = loadMbrRuntime();
  const model0 = rt.getModel(0);
  const mqttPublished = [];
  const engine = new WorkerEngineV0({
    runtime: rt,
    mqttPublish: (topic, payload) => mqttPublished.push({ topic, payload }),
    mgmtAdapter: { publish: async () => {} },
  });
  rt.addLabel(model0, 0, 0, 0, {
    k: 'mbr_cb_out',
    t: 'pin.bus.cb.out',
    v: pinPayloadRecords({
      opId: '0376_same_op_request_response',
      topic: 'UIPUT/ws/dam/pic/de/R1/3100/bundle_request',
      endpointWorkerId: 'R1',
      endpointModelId: 3100,
      endpointPin: 'bundle_request',
      messageRole: 'request',
    }),
  });
  engine.tick();
  rt.addLabel(model0, 0, 0, 0, {
    k: 'mbr_cb_out',
    t: 'pin.bus.cb.out',
    v: mbrResponseRecords({
      opId: '0376_same_op_request_response',
      topic: 'UIPUT/ws/dam/pic/de/U1/2000/result',
      responseTopic: 'UIPUT/ws/dam/pic/de/U1/2000/result',
      payload: providerBundleResponsePayload(),
      extraRecords: providerBundleResponseExtraRecords(),
    }),
  });
  engine.tick();
  assert.equal(mqttPublished.length, 2, 'request and response with the same op_id must both be published');
  assert.equal(payloadString(mqttPublished[0]?.payload?.payload, 'message_role'), 'request', 'first publish must be request');
  assert.equal(payloadString(mqttPublished[1]?.payload?.payload, 'message_role'), 'response', 'second publish must be response');
  return { key: 'split_bus_dedup_distinguishes_request_and_response_for_same_op_id', status: 'PASS' };
}

async function test_imported_slide_app_default_binding_is_control_bus() {
  return withServerState(async (state) => {
    const model0 = state.runtime.getModel(0);
    cacheMinimalZip(state, 'mxc://localhost/0376-valid');
    const importResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0376-valid');
    assert.equal(importResult.ok, true, 'valid provider zip must import');
    const importedTableId = importResult.data?.table_id;
    const importedId = importResult.data?.model_id;
    assert.equal(Number.isInteger(importedId), true, 'import must allocate local model id');
    assert.equal(typeof importedTableId === 'string' && importedTableId.length > 0, true, 'import must return the child table id');
    assert.notEqual(importedTableId, 'host', 'slide app import must be isolated in a child table');
    const importedRef = { table_id: importedTableId, model_id: importedId };
    assert.deepEqual(importResult.data?.model_ref, importedRef, 'import result must expose one table-qualified model identity');

    const importedModel = state.runtime.getModel(importedRef);
    assert.ok(importedModel, 'table-qualified imported root model must exist');
    const rootLabels = state.runtime.getCell(importedModel, 0, 0, 0).labels;
    const binding = Array.from(rootLabels.values()).find((label) => label && label.t === 'ui.egress.binding.v1');
    assert.equal(binding?.v?.bus, 'control', 'imported app host egress binding must default to control bus');
    assert.equal(binding?.v?.host_pin_type, 'pin.bus.cb.out', 'imported app host egress must default to control bus out');
    const tableSuffix = importedTableId
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'app';
    assert.equal(binding?.v?.host_pin_key, `imported_submit1_${tableSuffix}_${importedId}_bus`, 'host pin key must stay deterministic and table-qualified');

    const hostPin = state.runtime.getCell(model0, 0, 0, 0).labels.get(binding.v.host_pin_key);
    assert.equal(hostPin?.t, 'pin.bus.cb.out', 'generated host egress pin must be pin.bus.cb.out');
    const ingressLabels = rootLabels.get('host_ingress_generated_model0_labels')?.v || [];
    const ingressKey = ingressLabels.find((key) => key && key.includes('_submit_'));
    assert.equal(state.runtime.getCell(model0, 0, 0, 0).labels.get(ingressKey)?.t, 'pin.bus.cb.in', 'generated host ingress must default to control bus in');

    state.runtime.addLabel(importedModel, 0, 0, 0, {
      k: 'submit1',
      t: 'pin.out',
      v: tempPayload('runtime egress payload'),
    });
    await wait();
    await state.programEngine.tick();
    const emittedHostPin = state.runtime.getCell(model0, 0, 0, 0).labels.get(binding.v.host_pin_key);
    assert.equal(emittedHostPin?.t, 'pin.bus.cb.out', 'runtime egress must write the control bus out pin');
    assert.equal(payloadString(emittedHostPin?.v, 'route_kind'), 'control', 'runtime egress payload must carry route_kind control');
    assert.equal(payloadString(emittedHostPin?.v, 'topic'), 'UIPUT/ws/dam/pic/de/R1/3000/submit1', 'runtime egress payload must carry full topic record');
    assert.equal(payloadString(emittedHostPin?.v, 'bus'), 'control', 'runtime egress payload must carry bus control');
    assert.equal(payloadString(emittedHostPin?.v, '__mt_payload_kind'), 'pin_payload.v2', 'runtime egress must use pin_payload.v2');
    const payloadModelId = payloadInt(emittedHostPin?.v, 'payload_model_id');
    assert.equal(payloadString(emittedHostPin?.v, 'text', payloadModelId), 'runtime egress payload', 'runtime egress must carry non-nested business records emitted by this submit1 write');
    assert.equal(payloadString(emittedHostPin?.v, 'endpoint_worker_id'), 'R1', 'runtime egress must preserve remote endpoint metadata for remote worker dispatch');
    assert.equal(payloadString(emittedHostPin?.v, 'endpoint_table_id'), 'host', 'remote transport endpoint must stay in the host table');
    assert.equal(payloadInt(emittedHostPin?.v, 'endpoint_model_id'), 3000, 'runtime egress must preserve remote endpoint model id');
    assert.equal(payloadString(emittedHostPin?.v, 'endpoint_pin'), 'submit1', 'runtime egress must preserve remote endpoint pin');
    assert.equal(payloadString(emittedHostPin?.v, 'origin_table_id'), importedTableId, 'runtime egress must preserve imported child table origin');
    assert.equal(payloadInt(emittedHostPin?.v, 'origin_model_id'), importedId, 'runtime egress must preserve imported child model origin');
    assert.equal(payloadString(emittedHostPin?.v, 'reply_target_table_id'), importedTableId, 'runtime egress must preserve table-qualified reply target');
    assert.equal(payloadInt(emittedHostPin?.v, 'reply_target_model_id'), importedId, 'runtime egress must preserve reply target model id');
    return { key: 'imported_slide_app_default_binding_is_control_bus', status: 'PASS' };
  });
}

async function test_ui_server_control_bus_response_materializes_reply_target() {
  return withServerState(async (state) => {
    cacheMinimalZip(state, 'mxc://localhost/0376-control-return');
    const importResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0376-control-return');
    assert.equal(importResult.ok, true, 'valid provider zip must import');
    const importedTableId = importResult.data?.table_id;
    const importedId = importResult.data?.model_id;
    const importedRef = { table_id: importedTableId, model_id: importedId };
    assert.deepEqual(importResult.data?.model_ref, importedRef, 'response target must use the imported table-qualified identity');
    const responseTopic = 'UIPUT/ws/dam/pic/de/ui-server-0376/1051/result';
    const packet = pinPayloadPacket({
      opId: '0376_control_return_materialize',
      topic: responseTopic,
      responseTopic,
      endpoint: { worker_id: 'ui-server-0376', table_id: 'host', model_id: 1051, pin: 'result' },
      origin: { worker_id: 'R1', table_id: 'host', model_id: 3000, pin: 'submit1' },
      replyTarget: { worker_id: 'ui-server-0376', table_id: importedTableId, model_id: importedId, pin: 'result' },
      payload: [
        mt('display_text', 'str', 'Submitted: control bus return'),
        mt('remote_status', 'str', 'remote_processed'),
        mt('submit_inflight', 'bool', false),
      ],
    });
    const { parsePinPayloadRecordEnvelope } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
    const parsed = parsePinPayloadRecordEnvelope(packet);
    assert.equal(parsed.ok, true, `table-qualified response packet must parse: ${parsed.code || 'unknown'}`);
    assert.deepEqual(parsed.replyTarget, {
      worker_id: 'ui-server-0376',
      table_id: importedTableId,
      table_id_present: true,
      model_id: importedId,
      pin: 'result',
    }, 'parsed response must preserve the table-qualified reply target');
    const handled = await state.programEngine.handleControlBusPacket(responseTopic, packet);
    assert.equal(handled, true, 'UI server must accept control-bus response packets for its reply target');
    await wait();
    const importedRoot = state.runtime.getCell(state.runtime.getModel(importedRef), 0, 0, 0).labels;
    assert.equal(importedRoot.get('display_text')?.v, 'Submitted: control bus return', 'control-bus response must materialize into the table-qualified UI model');
    const snapshotRoot = state.clientSnap().tables?.[importedTableId]?.models?.[String(importedId)]?.cells?.['0,0,0']?.labels || {};
    assert.equal(snapshotRoot.display_text?.v, 'Submitted: control bus return', 'client projection must retain the imported table identity');
    return { key: 'ui_server_control_bus_response_materializes_reply_target', status: 'PASS' };
  });
}

async function test_ui_server_control_bus_response_rejects_non_strict_packets() {
  return withServerState(async (state) => {
    cacheMinimalZip(state, 'mxc://localhost/0376-control-return-strict');
    const importResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0376-control-return-strict');
    assert.equal(importResult.ok, true, 'valid provider zip must import');
    const importedTableId = importResult.data?.table_id;
    const importedId = importResult.data?.model_id;
    const importedRef = { table_id: importedTableId, model_id: importedId };
    assert.deepEqual(importResult.data?.model_ref, importedRef, 'strict response cases must target the imported child table');
    const topic = 'UIPUT/ws/dam/pic/de/ui-server-0376/1051/result';
    const basePacket = (overrides = {}) => pinPayloadPacket({
      opId: overrides.opId || '0376_control_return_reject',
      endpoint: { worker_id: 'ui-server-0376', table_id: 'host', model_id: 1051, pin: 'result' },
      origin: { worker_id: 'R1', table_id: 'host', model_id: 3000, pin: 'submit1' },
      replyTarget: { worker_id: 'ui-server-0376', table_id: importedTableId, model_id: importedId, pin: 'result' },
      payload: [
        mt('display_text', 'str', overrides.text || 'Submitted: should not apply'),
        mt('remote_status', 'str', 'remote_processed'),
        mt('submit_inflight', 'bool', false),
      ],
      messageRole: overrides.messageRole || 'response',
      routeKind: Object.prototype.hasOwnProperty.call(overrides, 'routeKind') ? overrides.routeKind : 'control',
      topic,
      responseTopic: topic,
    });
    const cases = [
      ['missing_route_kind', basePacket({ opId: '0376_missing_route_kind', routeKind: null })],
      ['duplicate_topic', (() => {
        const packet = basePacket({ opId: '0376_duplicate_topic' });
        packet.payload.push(mt('topic', 'str', topic));
        return packet;
      })()],
      ['duplicate_route_kind', (() => {
        const packet = basePacket({ opId: '0376_duplicate_route_kind' });
        packet.payload.push(mt('route_kind', 'str', 'control'));
        return packet;
      })()],
      ['request_echo', basePacket({ opId: '0376_request_echo', messageRole: 'request' })],
    ];
    for (const [name, packet] of cases) {
      const handled = await state.programEngine.handleControlBusPacket(topic, packet);
      assert.equal(handled, false, `${name} must be rejected by the UI server control-bus return path`);
    }
    await wait();
    const root = state.runtime.getCell(state.runtime.getModel(importedRef), 0, 0, 0).labels;
    assert.notEqual(root.get('display_text')?.v, 'Submitted: should not apply', 'rejected control-bus packets must not materialize into the table-qualified UI model');
    return { key: 'ui_server_control_bus_response_rejects_non_strict_packets', status: 'PASS' };
  });
}

function test_user_guide_documents_payload_topic_as_route_truth() {
  const text = fs.readFileSync(join(repoRoot, 'docs/user-guide/modeltable_user_guide.md'), 'utf8');
  assert.equal(
    text.includes('MBR 根据 `endpoint_*` records 发布到 remote-worker 的控制总线 topic'),
    false,
    'user guide must not describe endpoint-derived topic routing',
  );
  assert.equal(
    text.includes('endpoint metadata 决定目标'),
    false,
    'user guide topic section must not describe endpoint metadata as the route selector',
  );
  assert.ok(
    text.includes('MBR 转发时只使用消息 payload records 中的 `topic` record 决定目标'),
    'user guide topic section must say payload topic decides MBR target',
  );
  assert.ok(
    text.includes('MBR 只根据 payload 里的 `topic` record 发布到 remote-worker 的控制总线 topic'),
    'user guide must describe payload topic as the route truth',
  );
  const resultSection = text.slice(text.indexOf('### 9.2 Result'), text.indexOf('## 10.', text.indexOf('### 9.2 Result')) > 0 ? text.indexOf('## 10.', text.indexOf('### 9.2 Result')) : undefined);
  assert.ok(
    resultSection.includes('"k": "topic"') && resultSection.includes('"v": "UIPUT/ws/dam/pic/de/U1/1055/result"'),
    'result example must include the required topic record',
  );
  return { key: 'user_guide_documents_payload_topic_as_route_truth', status: 'PASS' };
}

function test_deploy_bootstrap_writes_ui_server_control_bus_config() {
  const text = fs.readFileSync(join(repoRoot, 'scripts/ops/_deploy_common.sh'), 'utf8');
  const uiPatchStart = text.indexOf('ui_patch="$(');
  const mbrPatchStart = text.indexOf('mbr_patch="$(');
  assert.ok(uiPatchStart >= 0 && mbrPatchStart > uiPatchStart, 'deploy helper must build ui_patch before mbr_patch');
  const uiPatchBlock = text.slice(uiPatchStart, mbrPatchStart);
  assert.ok(uiPatchBlock.includes('MQTT_HOST="${MQTT_HOST}"'), 'ui-server bootstrap must receive MQTT_HOST for control-bus return subscription');
  assert.ok(uiPatchBlock.includes('MQTT_PORT="${MQTT_PORT}"'), 'ui-server bootstrap must receive MQTT_PORT for control-bus return subscription');
  assert.ok(uiPatchBlock.includes('"k": "local_ip"'), 'ui-server bootstrap must write mqtt.local.ip label');
  assert.ok(uiPatchBlock.includes('"k": "local_port"'), 'ui-server bootstrap must write mqtt.local.port label');
  return { key: 'deploy_bootstrap_writes_ui_server_control_bus_config', status: 'PASS' };
}

const tests = [
  test_worker_engine_publishes_cb_out_to_payload_topic_without_endpoint_fallback,
  test_worker_engine_rejects_unsafe_payload_topics,
  test_mbr_control_ingress_uses_model_zero_to_minus10_pin_chain_and_routes_by_topic,
  test_mbr_control_ingress_routes_management_response_and_rejects_invalid_v2_fields,
  test_mbr_pin_chain_accepts_provider_bundle_response_modeltable_payload,
  test_mbr_pin_chain_rejects_legacy_label_inside_provider_bundle_payload,
  test_split_bus_dedup_distinguishes_request_and_response_for_same_op_id,
  test_imported_slide_app_default_binding_is_control_bus,
  test_ui_server_cb_out_publishes_control_bus_not_matrix,
  test_ui_server_cb_out_dedup_distinguishes_request_and_response_for_same_op_id,
  test_ui_server_control_bus_response_materializes_reply_target,
  test_ui_server_control_bus_response_rejects_non_strict_packets,
  test_user_guide_documents_payload_topic_as_route_truth,
  test_deploy_bootstrap_writes_ui_server_control_bus_config,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error && error.stack ? error.stack : error}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
