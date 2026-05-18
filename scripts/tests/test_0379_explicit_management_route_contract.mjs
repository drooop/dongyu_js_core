#!/usr/bin/env node
// 0379 — imported slide apps may explicitly choose management-bus egress.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';
import { WorkerEngineV0, buildWorkerHostApi, loadSystemPatch } from '../worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;
const repoRoot = new URL('../..', import.meta.url).pathname;
const payloadPath = join(repoRoot, 'test_files', 'minimal_submit_dual_bus_app_payload.json');

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

function tempPayload(text = 'management route submit') {
  return [
    mt('model_type', 'model.single', 'Data.MinimalSubmit'),
    mt('text', 'str', text),
  ];
}

function pinPayloadRecords({
  opId = '0379_mgmt_request',
  routeKind = 'management',
  bus = routeKind,
  topic = 'UIPUT/ws/dam/pic/de/sw/R1/3000/submit1',
  endpointWorkerId = 'R1',
  endpointModelId = 3000,
  endpointPin = 'submit1',
  originWorkerId = 'U1',
  originModelId = 2000,
  originPin = 'submit1',
  replyTargetWorkerId = 'U1',
  replyTargetModelId = 2000,
  replyTargetPin = 'result',
  messageRole = 'request',
  payload = tempPayload(),
  timestamp = 1700000000000,
} = {}) {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('topic', 'str', topic),
    mt('route_kind', 'str', routeKind),
    mt('bus', 'str', bus),
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
    mt('timestamp', 'int', timestamp),
  ];
}

function externalPacket(records) {
  return { version: 'v1', type: 'pin_payload', payload: records };
}

function getFunctionCode(label) {
  if (!label) return '';
  if (typeof label.v === 'string') return label.v;
  if (label.v && typeof label.v === 'object' && typeof label.v.code === 'string') return label.v.code;
  return '';
}

function withRemoteEndpointRouteKind(routeKind) {
  return readJson(payloadPath).map((record) => {
    if (record && record.k === 'remote_bus_endpoint_v1') {
      return {
        ...record,
        v: {
          ...record.v,
          route_kind: routeKind,
        },
      };
    }
    return record;
  });
}

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

function cacheZip(state, uri, payload) {
  state.cacheUploadedMediaForTest(uri, {
    buffer: buildZipBuffer(payload),
    contentType: 'application/zip',
    filename: 'minimal-submit-0379.zip',
    userId: '@manual:localhost',
  });
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0379-import-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0379_import_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  try {
    const { buildSlideAppExportPayload, createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
    const state = createServerState({ dbPath: null });
    await state.activateRuntimeMode('running');
    return await fn(state, buildSlideAppExportPayload);
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

function wait(ms = 160) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadMbrRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  rt.applyPatch(readJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json'), {
    allowCreateModel: true,
    trustedBootstrap: true,
  });
  return rt;
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

async function test_imported_app_route_kind_management_generates_management_bus_egress() {
  return withServerState(async (state, buildSlideAppExportPayload) => {
    const payload = withRemoteEndpointRouteKind('management');
    cacheZip(state, 'mxc://localhost/0379-management', payload);
    const importResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0379-management');
    assert.equal(importResult.ok, true, 'management-routed provider zip must import');
    const importedId = importResult.data?.model_id;
    assert.equal(Number.isInteger(importedId), true, 'import must allocate a local model id');

    const model0 = state.runtime.getModel(0);
    const root = state.runtime.getCell(state.runtime.getModel(importedId), 0, 0, 0).labels;
    assert.deepEqual(root.get('remote_bus_endpoint_v1')?.v, {
      transport: 'mqtt',
      route_kind: 'management',
      to: { worker_id: 'R1', model_id: 3000 },
    }, 'imported endpoint declaration must preserve explicit management route_kind');

    const binding = Array.from(root.values()).find((label) => label && label.t === 'ui.egress.binding.v1');
    assert.equal(binding?.v?.bus, 'management', 'host-owned binding must mark management route');
    assert.equal(binding?.v?.host_pin_type, 'pin.bus.mb.out', 'host-owned binding must use management bus out');
    assert.equal(binding?.v?.target?.route_kind, 'management', 'binding target must expose route_kind for introspection');
    assert.equal(binding?.v?.target?.topic, 'UIPUT/ws/dam/pic/de/sw/R1/3000/submit1', 'binding target must expose payload topic truth');
    assert.equal(state.runtime.getCell(model0, 0, 0, 0).labels.get(binding.v.host_pin_key)?.t, 'pin.bus.mb.out', 'generated Model 0 bus pin must be management out');

    state.runtime.addLabel(state.runtime.getModel(importedId), 0, 0, 0, {
      k: 'submit1',
      t: 'pin.out',
      v: tempPayload('0379 management route'),
    });
    await wait();
    await state.programEngine.tick();
    const emitted = state.runtime.getCell(model0, 0, 0, 0).labels.get(binding.v.host_pin_key);
    assert.equal(emitted?.t, 'pin.bus.mb.out', 'runtime egress must write management bus out');
    assert.equal(payloadString(emitted?.v, 'bus'), 'management', 'runtime egress must carry bus=management');
    assert.equal(payloadString(emitted?.v, 'route_kind'), 'management', 'runtime egress must carry route_kind=management');
    assert.equal(payloadString(emitted?.v, 'topic'), 'UIPUT/ws/dam/pic/de/sw/R1/3000/submit1', 'runtime egress must still route by payload topic');
    assert.equal(payloadInt(emitted?.v, 'reply_target_model_id'), importedId, 'runtime egress must return to the local imported model id');
    assert.equal(payloadString(payloadJson(emitted?.v, 'payload'), 'text'), '0379 management route', 'runtime egress must preserve submitted business payload');

    const exportResult = buildSlideAppExportPayload(state.runtime, importedId);
    assert.equal(exportResult.ok, true, 'export must succeed after management-routed import');
    const exportedEndpoint = exportResult.data.payload.find((record) => record.k === 'remote_bus_endpoint_v1');
    assert.deepEqual(exportedEndpoint?.v, {
      transport: 'mqtt',
      route_kind: 'management',
      to: { worker_id: 'R1', model_id: 3000 },
    }, 'export must preserve provider-owned management route_kind');
    assert.equal(exportResult.data.payload.some((record) => typeof record.t === 'string' && record.t.startsWith('pin.bus.')), false, 'export must not leak host-owned bus pins');
    assert.equal(exportResult.data.payload.some((record) => record.t === 'ui.egress.binding.v1'), false, 'export must not leak host-owned egress binding');

    return { key: 'imported_app_route_kind_management_generates_management_bus_egress', status: 'PASS' };
  });
}

async function test_import_rejects_invalid_remote_endpoint_route_kind() {
  return withServerState(async (state) => {
    cacheZip(state, 'mxc://localhost/0379-invalid-route-kind', withRemoteEndpointRouteKind('legacy'));
    const result = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0379-invalid-route-kind');
    assert.equal(result.ok, false, 'invalid remote endpoint route_kind must fail closed');
    assert.equal(result.detail, 'invalid_remote_bus_endpoint_route_kind', 'invalid route_kind rejection must be explicit');
    return { key: 'import_rejects_invalid_remote_endpoint_route_kind', status: 'PASS' };
  });
}

function test_mbr_management_ingress_forwards_to_control_bus_topic() {
  const rt = loadMbrRuntime();
  const sys = rt.getModel(-10);
  const fn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_to_mqtt')));
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_inbox',
    t: 'json',
    v: externalPacket(pinPayloadRecords()),
  });
  fn({ hostApi: buildWorkerHostApi(rt) });
  const cbOut = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_cb_out');
  assert.equal(cbOut?.t, 'pin.bus.cb.out', 'MBR management ingress must forward request to control bus out');
  assert.equal(payloadString(cbOut?.v, 'route_kind'), 'management', 'MBR must preserve management route_kind in forwarded payload');
  assert.equal(payloadString(cbOut?.v, 'topic'), 'UIPUT/ws/dam/pic/de/sw/R1/3000/submit1', 'MBR forwarded control-bus packet must keep payload topic truth');
  assert.equal(payloadString(cbOut?.v, 'endpoint_worker_id'), 'R1', 'MBR must not reinterpret endpoint worker id');
  assert.equal(payloadInt(cbOut?.v, 'endpoint_model_id'), 3000, 'MBR must not reinterpret endpoint model id');
  assert.equal(rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_mb_out')?.v ?? null, null, 'management ingress request must not echo to management out');
  const { mqttPublished, mgmtPublished } = drainWorkerEngine(rt);
  assert.equal(mqttPublished.length, 1, 'MBR forwarded packet must publish to MQTT control bus');
  assert.equal(mqttPublished[0].topic, 'UIPUT/ws/dam/pic/de/sw/R1/3000/submit1', 'MQTT publish topic must come from payload topic');
  assert.equal(payloadString(mqttPublished[0].payload.payload, 'route_kind'), 'management', 'MQTT payload must preserve explicit management route_kind');
  assert.equal(mgmtPublished.length, 0, 'management-ingress forwarding must not re-publish to management bus');
  return { key: 'mbr_management_ingress_forwards_to_control_bus_topic', status: 'PASS' };
}

const tests = [
  test_imported_app_route_kind_management_generates_management_bus_egress,
  test_import_rejects_invalid_remote_endpoint_route_kind,
  test_mbr_management_ingress_forwards_to_control_bus_topic,
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
