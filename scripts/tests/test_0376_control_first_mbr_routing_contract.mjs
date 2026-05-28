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

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function payloadRecord(records, key) {
  return Array.isArray(records) ? records.find((record) => record && record.k === key) || null : null;
}

function payloadString(records, key) {
  const record = payloadRecord(records, key);
  return record && record.t === 'str' ? record.v : '';
}

function payloadInt(records, key) {
  const record = payloadRecord(records, key);
  return record && record.t === 'int' ? record.v : null;
}

function payloadJson(records, key) {
  const record = payloadRecord(records, key);
  return record && record.t === 'json' ? record.v : null;
}

function pinPayloadPacket({ opId, endpoint, origin, replyTarget, payload, messageRole = 'response', topic = 'UIPUT/ws/dam/pic/de/R1/3000/submit1', responseTopic = null, routeKind = 'control' }) {
  const routeResponseTopic = responseTopic || `UIPUT/ws/dam/pic/de/${replyTarget.worker_id}/${replyTarget.model_id}/${replyTarget.pin}`;
  const records = [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('topic', 'str', topic),
    mt('response_topic', 'str', routeResponseTopic),
    mt('endpoint_worker_id', 'str', endpoint.worker_id),
    mt('endpoint_model_id', 'int', endpoint.model_id),
    mt('endpoint_pin', 'str', endpoint.pin),
    mt('origin_worker_id', 'str', origin.worker_id),
    mt('origin_model_id', 'int', origin.model_id),
    mt('origin_pin', 'str', origin.pin),
    mt('reply_target_worker_id', 'str', replyTarget.worker_id),
    mt('reply_target_model_id', 'int', replyTarget.model_id),
    mt('reply_target_pin', 'str', replyTarget.pin),
    mt('payload', 'json', payload),
    mt('timestamp', 'int', 1700000000000),
  ];
  if (routeKind !== null) records.splice(5, 0, mt('route_kind', 'str', routeKind));
  return {
    version: 'v1',
    type: 'pin_payload',
    payload: records,
  };
}

function tempPayload(text = 'hello control first') {
  return [
    mt('model_type', 'model.single', 'Data.MinimalSubmit'),
    mt('text', 'str', text),
  ];
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

function pinPayloadRecords({
  opId = '0376_control_first',
  topic = 'UIPUT/ws/dam/pic/de/R2/999/submit',
  responseTopic = 'UIPUT/ws/dam/pic/de/U1/2000/result',
  routeKind,
  endpointWorkerId = 'R1',
  endpointModelId = 3000,
  endpointPin = 'submit1',
  messageRole = 'request',
} = {}) {
  const records = [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('topic', 'str', topic),
    mt('response_topic', 'str', responseTopic),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', 'U1'),
    mt('origin_model_id', 'int', 2000),
    mt('origin_pin', 'str', 'submit1'),
    mt('reply_target_worker_id', 'str', 'U1'),
    mt('reply_target_model_id', 'int', 2000),
    mt('reply_target_pin', 'str', 'result'),
    mt('payload', 'json', tempPayload()),
    mt('timestamp', 'int', 1700000000000),
  ];
  if (routeKind !== undefined) records.push(mt('route_kind', 'str', routeKind));
  return records;
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

async function test_mbr_cb_dispatch_defaults_to_control_and_routes_by_topic() {
  const rt = loadMbrRuntime();
  const model0Root = rt.getCell(rt.getModel(0), 0, 0, 0).labels;
  assert.equal(model0Root.get('mbr_cb_in')?.t, 'pin.bus.cb.in', 'MBR must declare a control-bus ingress pin on Model 0');
  const wiring = model0Root.get('mbr_cb_in_wiring');
  assert.equal(wiring?.t, 'pin.connect.label', 'MBR control-bus ingress must wire to dispatch function');
  assert.deepEqual(wiring?.v, [{ from: 'mbr_cb_in', to: ['mbr_cb_dispatch:in'] }], 'MBR control-bus ingress must trigger mbr_cb_dispatch');
  rt.addLabel(rt.getModel(0), 0, 0, 0, {
    k: 'mbr_cb_in',
    t: 'pin.bus.cb.in',
    v: pinPayloadRecords({
      opId: '0376_mbr_default_control',
      topic: 'UIPUT/ws/dam/pic/de/R2/999/submit',
      endpointWorkerId: 'R2',
      endpointModelId: 999,
      endpointPin: 'submit',
    }),
  });
  const expectedTopic = 'UIPUT/ws/dam/pic/de/R2/999/submit';
  const cbOut = await waitUntil(() => {
    const label = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_cb_out');
    return payloadString(label?.v, 'topic') === expectedTopic ? label : null;
  });
  assert.equal(cbOut?.t, 'pin.bus.cb.out', 'default route_kind must write control bus out');
  assert.equal(payloadString(cbOut?.v, 'topic'), expectedTopic, 'MBR must preserve payload topic as route truth');
  assert.equal(payloadString(cbOut?.v, 'route_kind'), '', 'missing route_kind remains omitted while dispatch treats it as control');
  const { mqttPublished } = drainWorkerEngine(rt);
  assert.equal(mqttPublished[0]?.topic, 'UIPUT/ws/dam/pic/de/R2/999/submit', 'MBR control output must publish to payload topic');
  return { key: 'mbr_cb_dispatch_defaults_to_control_and_routes_by_topic', status: 'PASS' };
}

async function test_mbr_cb_dispatch_routes_explicit_management_and_rejects_invalid_route_fields() {
  {
    const rt = loadMbrRuntime();
    rt.addLabel(rt.getModel(0), 0, 0, 0, {
      k: 'mbr_cb_in',
      t: 'pin.bus.cb.in',
      v: pinPayloadRecords({
        opId: '0376_mbr_management',
        routeKind: 'management',
        topic: 'UIPUT/ws/dam/pic/de/R2/999/submit',
        endpointWorkerId: 'R2',
        endpointModelId: 999,
        endpointPin: 'submit',
      }),
    });
    const root = rt.getCell(rt.getModel(0), 0, 0, 0).labels;
    const mbOut = await waitUntil(() => {
      const label = root.get('mbr_mb_out');
      return payloadString(label?.v, 'route_kind') === 'management' ? label : null;
    });
    assert.equal(mbOut?.t, 'pin.bus.mb.out', 'explicit management route_kind must write management bus out');
    assert.equal(root.get('mbr_cb_out')?.v ?? null, null, 'explicit management route_kind must not also write control bus out');
    assert.equal(payloadString(mbOut?.v, 'route_kind'), 'management', 'management output must preserve route_kind');
    assert.equal(drainWorkerEngine(rt).mqttPublished.length, 0, 'explicit management route must not publish to MQTT control bus');
  }

  for (const [name, records, detail] of [
    ['missing_topic', withoutRecords(pinPayloadRecords({ opId: '0376_missing_topic' }), ['topic']), 'bus_in_invalid_topic'],
    ['invalid_route_kind', pinPayloadRecords({ opId: '0376_invalid_route_kind', routeKind: 'legacy' }), 'bus_in_invalid_route_kind'],
    ['legacy_return_topic', [...pinPayloadRecords({ opId: '0376_legacy_return_topic' }), mt('return_topic', 'str', 'UIPUT/ws/dam/pic/de/R2/999/submit')], 'legacy_pin_payload_metadata_removed'],
    ['legacy_route_reply_to', [...pinPayloadRecords({ opId: '0376_legacy_route_reply_to' }), mt('route.reply_to', 'str', 'UIPUT/ws/dam/pic/de/R2/999/result')], 'legacy_pin_payload_metadata_removed'],
    ['legacy_result_topic', [...pinPayloadRecords({ opId: '0376_legacy_result_topic' }), mt('result_topic', 'str', 'UIPUT/ws/dam/pic/de/R2/999/result')], 'legacy_pin_payload_metadata_removed'],
    ['unsafe_empty_topic', pinPayloadRecords({ opId: '0376_unsafe_empty_topic', topic: '' }), 'bus_in_invalid_topic'],
    ['unsafe_plus_topic', pinPayloadRecords({ opId: '0376_unsafe_plus_topic', topic: 'UIPUT/ws/dam/pic/de/R2/999/+' }), 'bus_in_invalid_topic'],
    ['unsafe_hash_topic', pinPayloadRecords({ opId: '0376_unsafe_hash_topic', topic: 'UIPUT/ws/dam/pic/de/R2/999/#' }), 'bus_in_invalid_topic'],
    ['unsafe_empty_segment_topic', pinPayloadRecords({ opId: '0376_unsafe_empty_segment_topic', topic: 'UIPUT/ws/dam/pic/de//999/submit' }), 'bus_in_invalid_topic'],
    ['unsafe_leading_slash_topic', pinPayloadRecords({ opId: '0376_unsafe_leading_slash_topic', topic: '/UIPUT/ws/dam/pic/de/R2/999/submit' }), 'bus_in_invalid_topic'],
    ['unsafe_trailing_slash_topic', pinPayloadRecords({ opId: '0376_unsafe_trailing_slash_topic', topic: 'UIPUT/ws/dam/pic/de/R2/999/submit/' }), 'bus_in_invalid_topic'],
    ['unsafe_zero_model_topic', pinPayloadRecords({ opId: '0376_unsafe_zero_model_topic', topic: 'UIPUT/ws/dam/pic/de/R2/0/submit' }), 'bus_in_invalid_topic'],
    ['unsafe_leading_zero_model_topic', pinPayloadRecords({ opId: '0376_unsafe_leading_zero_model_topic', topic: 'UIPUT/ws/dam/pic/de/R2/0999/submit' }), 'bus_in_invalid_topic'],
  ]) {
    const rt = loadMbrRuntime();
    const model0 = rt.getModel(0);
    rt.addLabel(model0, 0, 0, 0, {
      k: 'mbr_cb_in',
      t: 'pin.bus.cb.in',
      v: records,
    });
    await waitUntil(() => rt.getCell(model0, 0, 0, 0).labels.get('mbr_cb_error') || lastRejectedReason(rt));
    const root = rt.getCell(model0, 0, 0, 0).labels;
    assert.equal(root.get('mbr_cb_out')?.v ?? null, null, `${name} must not write control bus out`);
    assert.equal(root.get('mbr_mb_out')?.v ?? null, null, `${name} must not write management bus out`);
    const drained = drainWorkerEngine(rt);
    assert.equal(drained.mqttPublished.length, 0, `${name} must not publish to MQTT`);
    assert.equal(drained.mgmtPublished.length, 0, `${name} must not publish to management bus`);
    const explicitDetail = root.get('mbr_cb_error')?.v?.detail || lastRejectedReason(rt);
    assert.equal(explicitDetail, detail, `${name} must be rejected explicitly`);
  }
  return { key: 'mbr_cb_dispatch_routes_explicit_management_and_rejects_invalid_route_fields', status: 'PASS' };
}

async function test_mbr_cb_dispatch_accepts_provider_bundle_response_modeltable_payload() {
  const rt = loadMbrRuntime();
  const model0 = rt.getModel(0);
  const topic = 'UIPUT/ws/dam/pic/de/U1/2000/result';
  rt.addLabel(model0, 0, 0, 0, {
    k: 'mbr_cb_in',
    t: 'pin.bus.cb.in',
      v: pinPayloadRecords({
        opId: 'req_0389_provider_bundle_response',
        topic,
        responseTopic: topic,
        routeKind: 'control',
        endpointWorkerId: 'U1',
        endpointModelId: 2000,
        endpointPin: 'result',
        messageRole: 'response',
      }).map((record) => record.k === 'payload' ? { ...record, v: providerBundleResponsePayload() } : record),
  });
  const cbOut = await waitUntil(() => {
    const label = rt.getCell(model0, 0, 0, 0).labels.get('mbr_cb_out');
    return payloadString(label?.v, 'op_id') === 'req_0389_provider_bundle_response' ? label : null;
  });
  assert.equal(cbOut?.t, 'pin.bus.cb.out', 'valid provider bundle response must be forwarded by MBR');
  assert.equal(payloadString(cbOut?.v, 'topic'), topic, 'provider bundle response must publish on response_topic');
  assert.equal(rt.getCell(model0, 0, 0, 0).labels.get('mbr_cb_error')?.v ?? null, null, 'valid provider bundle response must not be rejected as legacy metadata');
  return { key: 'mbr_cb_dispatch_accepts_provider_bundle_response_modeltable_payload', status: 'PASS' };
}

async function test_mbr_cb_dispatch_rejects_legacy_label_inside_provider_bundle_payload() {
  const rt = loadMbrRuntime();
  const model0 = rt.getModel(0);
  const topic = 'UIPUT/ws/dam/pic/de/U1/2000/result';
  const payload = providerBundleResponsePayload().map((record) => {
    if (record.k !== 'bundle_payload') return record;
    return {
      ...record,
      v: [
        mt('app_name', 'str', 'must_not_forward_legacy_bundle_label'),
        mt('source_model_id', 'int', 100),
      ],
    };
  });
  rt.addLabel(model0, 0, 0, 0, {
    k: 'mbr_cb_in',
    t: 'pin.bus.cb.in',
      v: pinPayloadRecords({
        opId: 'req_0389_provider_bundle_legacy_label',
        topic,
        responseTopic: topic,
        routeKind: 'control',
        endpointWorkerId: 'U1',
        endpointModelId: 2000,
        endpointPin: 'result',
        messageRole: 'response',
      }).map((record) => record.k === 'payload' ? { ...record, v: payload } : record),
  });
  await waitUntil(() => rt.getCell(model0, 0, 0, 0).labels.get('mbr_cb_error') || lastRejectedReason(rt));
  const root = rt.getCell(model0, 0, 0, 0).labels;
  assert.equal(root.get('mbr_cb_out')?.v ?? null, null, 'provider bundle response with legacy bundle label must not be forwarded');
  assert.equal(root.get('mbr_cb_error')?.v?.detail || lastRejectedReason(rt), 'legacy_pin_payload_metadata_removed', 'legacy bundle label key must be rejected explicitly');
  return { key: 'mbr_cb_dispatch_rejects_legacy_label_inside_provider_bundle_payload', status: 'PASS' };
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
    v: pinPayloadRecords({
      opId: '0376_same_op_request_response',
      topic: 'UIPUT/ws/dam/pic/de/U1/2000/result',
      responseTopic: 'UIPUT/ws/dam/pic/de/U1/2000/result',
      endpointWorkerId: 'U1',
      endpointModelId: 2000,
      endpointPin: 'result',
      messageRole: 'response',
    }).map((record) => record.k === 'payload' ? { ...record, v: providerBundleResponsePayload() } : record),
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
    const importedId = importResult.data?.model_id;
    assert.equal(Number.isInteger(importedId), true, 'import must allocate local model id');

    const rootLabels = state.runtime.getCell(state.runtime.getModel(importedId), 0, 0, 0).labels;
    const binding = Array.from(rootLabels.values()).find((label) => label && label.t === 'ui.egress.binding.v1');
    assert.equal(binding?.v?.bus, 'control', 'imported app host egress binding must default to control bus');
    assert.equal(binding?.v?.host_pin_type, 'pin.bus.cb.out', 'imported app host egress must default to control bus out');
    assert.equal(binding?.v?.host_pin_key, `imported_submit1_${importedId}_bus`, 'host pin key must stay deterministic');

    const hostPin = state.runtime.getCell(model0, 0, 0, 0).labels.get(binding.v.host_pin_key);
    assert.equal(hostPin?.t, 'pin.bus.cb.out', 'generated host egress pin must be pin.bus.cb.out');
    const ingressLabels = rootLabels.get('host_ingress_generated_model0_labels')?.v || [];
    const ingressKey = ingressLabels.find((key) => key && key.includes('_submit_'));
    assert.equal(state.runtime.getCell(model0, 0, 0, 0).labels.get(ingressKey)?.t, 'pin.bus.cb.in', 'generated host ingress must default to control bus in');

    state.runtime.addLabel(state.runtime.getModel(importedId), 0, 0, 0, {
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
    const emittedBusinessPayload = payloadJson(emittedHostPin?.v, 'payload');
    assert.equal(payloadString(emittedBusinessPayload, 'text'), 'runtime egress payload', 'runtime egress must carry the business payload emitted by this submit1 write');
    assert.equal(payloadString(emittedHostPin?.v, 'endpoint_worker_id'), 'R1', 'runtime egress must preserve remote endpoint metadata for remote worker dispatch');
    assert.equal(payloadInt(emittedHostPin?.v, 'endpoint_model_id'), 3000, 'runtime egress must preserve remote endpoint model id');
    assert.equal(payloadString(emittedHostPin?.v, 'endpoint_pin'), 'submit1', 'runtime egress must preserve remote endpoint pin');
    return { key: 'imported_slide_app_default_binding_is_control_bus', status: 'PASS' };
  });
}

async function test_ui_server_control_bus_response_materializes_reply_target() {
  return withServerState(async (state) => {
    cacheMinimalZip(state, 'mxc://localhost/0376-control-return');
    const importResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0376-control-return');
    assert.equal(importResult.ok, true, 'valid provider zip must import');
    const importedId = importResult.data?.model_id;
    const responseTopic = `UIPUT/ws/dam/pic/de/ui-server-0376/${importedId}/result`;
    const handled = await state.programEngine.handleControlBusPacket(
      responseTopic,
      pinPayloadPacket({
        opId: '0376_control_return_materialize',
        topic: responseTopic,
        responseTopic,
        endpoint: { worker_id: 'ui-server-0376', model_id: importedId, pin: 'result' },
        origin: { worker_id: 'R1', model_id: 3000, pin: 'submit1' },
        replyTarget: { worker_id: 'ui-server-0376', model_id: importedId, pin: 'result' },
        payload: [
          mt('display_text', 'str', 'Submitted: control bus return'),
          mt('remote_status', 'str', 'remote_processed'),
          mt('submit_inflight', 'bool', false),
        ],
      }),
    );
    assert.equal(handled, true, 'UI server must accept control-bus response packets for its reply target');
    await wait();
    const root = state.clientSnap().models[String(importedId)]?.cells?.['0,0,0']?.labels || {};
    assert.equal(root.display_text?.v, 'Submitted: control bus return', 'control-bus response must materialize into the local UI model');
    return { key: 'ui_server_control_bus_response_materializes_reply_target', status: 'PASS' };
  });
}

async function test_ui_server_control_bus_response_rejects_non_strict_packets() {
  return withServerState(async (state) => {
    cacheMinimalZip(state, 'mxc://localhost/0376-control-return-strict');
    const importResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0376-control-return-strict');
    assert.equal(importResult.ok, true, 'valid provider zip must import');
    const importedId = importResult.data?.model_id;
    const topic = `UIPUT/ws/dam/pic/de/ui-server-0376/${importedId}/result`;
    const basePacket = (overrides = {}) => pinPayloadPacket({
      opId: overrides.opId || '0376_control_return_reject',
      endpoint: { worker_id: 'ui-server-0376', model_id: importedId, pin: 'result' },
      origin: { worker_id: 'R1', model_id: 3000, pin: 'submit1' },
      replyTarget: { worker_id: 'ui-server-0376', model_id: importedId, pin: 'result' },
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
    const root = state.clientSnap().models[String(importedId)]?.cells?.['0,0,0']?.labels || {};
    assert.notEqual(root.display_text?.v, 'Submitted: should not apply', 'rejected control-bus packets must not materialize into the local UI model');
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
  test_mbr_cb_dispatch_defaults_to_control_and_routes_by_topic,
  test_mbr_cb_dispatch_routes_explicit_management_and_rejects_invalid_route_fields,
  test_mbr_cb_dispatch_accepts_provider_bundle_response_modeltable_payload,
  test_mbr_cb_dispatch_rejects_legacy_label_inside_provider_bundle_payload,
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
