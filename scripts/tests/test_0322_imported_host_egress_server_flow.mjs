#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;

function wait(ms = 150) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

function pinEnvelope(target, pin, value = undefined) {
  return {
    event_id: Date.now(),
    type: pin,
    payload: {
      meta: { op_id: `${pin}_${Date.now()}` },
      target,
      pin,
      ...(value !== undefined ? { value } : {}),
    },
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

function uiEventPayload(labels = []) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
    ...labels.map((label) => ({ id: 0, p: 0, r: 0, c: 0, ...label })),
  ];
}

function findPayloadRecord(records, key) {
  return Array.isArray(records)
    ? records.find((record) => record && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key) || null
    : null;
}

function payloadString(records, key) {
  const record = findPayloadRecord(records, key);
  return record && record.t === 'str' && typeof record.v === 'string' ? record.v : '';
}

function payloadInt(records, key) {
  const record = findPayloadRecord(records, key);
  return record && record.t === 'int' && Number.isInteger(record.v) ? record.v : null;
}

function payloadJson(records, key) {
  const record = findPayloadRecord(records, key);
  return record && record.t === 'json' ? record.v : null;
}

function slideImportClickPayload() {
  return uiEventPayload([
    { k: 'target', t: 'json', v: { model_id: 1031, p: 0, r: 0, c: 0 } },
  ]);
}

function writeLabelPayload(targetCell, targetLabel, targetType, value, requestId = `req_${Date.now()}`) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'write_label.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_request_id', t: 'str', v: requestId },
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_from_cell', t: 'json', v: { p: 0, r: 0, c: 0 } },
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_target_cell', t: 'json', v: targetCell },
    { id: 0, p: 0, r: 0, c: 0, k: targetLabel, t: targetType, v: value },
  ];
}

function slideImportClickBusEvent() {
  return {
    type: 'bus_event_v2',
    bus_in_key: 'slide_import_click',
    value: writeLabelPayload(
      { p: 2, r: 4, c: 0 },
      'click',
      'pin.in',
      slideImportClickPayload(),
      `slide_import_click_${Date.now()}`,
    ),
    meta: { op_id: `slide_import_click_${Date.now()}`, source: 'test_0322' },
  };
}

function payloadWithIngressAndEgress() {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.ImportedHostEgressFlowApp' },
    { id: 0, p: 0, r: 0, c: 0, k: 'app_name', t: 'str', v: 'Imported Host Egress Flow App' },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_app_summary', t: 'str', v: 'Imported host egress server-flow fixture for dual-bus outbound behavior.' },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_worker', t: 'str', v: 'imported-host-egress-flow' },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_capable', t: 'bool', v: true },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_surface_type', t: 'str', v: 'workspace.page' },
    { id: 0, p: 0, r: 0, c: 0, k: 'from_user', t: 'str', v: '@host:test' },
    { id: 0, p: 0, r: 0, c: 0, k: 'to_user', t: 'str', v: '@drop:test' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_root_node_id', t: 'str', v: 'imported_host_egress_root' },
    { id: 0, p: 0, r: 0, c: 0, k: 'status_text', t: 'str', v: 'idle' },
    { id: 0, p: 0, r: 0, c: 0, k: 'input_text', t: 'str', v: '' },
    { id: 0, p: 0, r: 0, c: 0, k: 'last_submit_payload', t: 'json', v: null },
    { id: 0, p: 0, r: 0, c: 0, k: 'host_ingress_v1', t: 'json', v: {
      version: 'v1',
      boundaries: [{
        semantic: 'submit',
        pin_name: 'submit_request',
        value_t: 'modeltable',
        locator_kind: 'root_relative_cell',
        locator_value: { p: 0, r: 0, c: 0 },
        primary: true,
      }],
    } },
    { id: 0, p: 0, r: 0, c: 0, k: 'remote_bus_endpoint_v1', t: 'json', v: { transport: 'mqtt', to: { worker_id: 'R1', model_id: 3000 } } },
    { id: 0, p: 0, r: 0, c: 0, k: 'dual_bus_model', t: 'json', v: { mode: 'imported_host_egress', egress_pins: ['submit'] } },
    { id: 0, p: 0, r: 0, c: 0, k: 'submit_request', t: 'pin.in', v: null },
    { id: 0, p: 0, r: 0, c: 0, k: 'submit_request_wiring', t: 'pin.connect.label', v: [{ from: 'submit_request', to: ['handle_submit:in'] }] },
    { id: 0, p: 0, r: 0, c: 0, k: 'submit', t: 'pin.out', v: null },
    { id: 0, p: 0, r: 0, c: 0, k: 'root_routes', t: 'pin.connect.cell', v: [
      { from: [2, 3, 0, 'click_chain'], to: [[0, 0, 0, 'submit_request']] },
    ] },
    { id: 0, p: 0, r: 0, c: 0, k: 'handle_submit', t: 'func.js', v: { code: [
      "const records = Array.isArray(label && label.v) ? label.v : [];",
      "const readPayload = function(key, fallback) { const rec = records.find(function(item) { return item && item.id === 0 && item.p === 0 && item.r === 0 && item.c === 0 && item.k === key; }); return rec && Object.prototype.hasOwnProperty.call(rec, 'v') ? rec.v : fallback; };",
      "const nestedValue = readPayload('value', {});",
      "const text = String(readPayload('text', nestedValue && nestedValue.text != null ? nestedValue.text : '')).trim();",
      "const source = String(readPayload('source', nestedValue && nestedValue.source ? nestedValue.source : 'host_ingress'));",
      "const payload = [",
      "  { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.ImportedHostSubmit' },",
      "  { id: 0, p: 0, r: 0, c: 0, k: 'message_text', t: 'str', v: text },",
      "  { id: 0, p: 0, r: 0, c: 0, k: 'route_mode', t: 'str', v: source }",
      "];",
      "V1N.addLabel('input_text', 'str', text);",
      "V1N.addLabel('last_submit_payload', 'json', payload);",
      "V1N.addLabel('status_text', 'str', text ? 'payload_ready' : 'empty_input');",
      "if (text) V1N.addLabel('submit', 'pin.out', payload);",
      "return;",
    ].join('\n') } },
    { id: 0, p: 2, r: 3, c: 0, k: 'click_chain', t: 'pin.in', v: null },
  ];
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0322-flow-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0322_flow_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'ui-server-it0322';
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
    delete process.env.DY_UI_SERVER_WORKER_ID;
  }
}

async function test_imported_app_host_ingress_can_reach_bus_out_mqtt_and_matrix() {
  return withServerState(async (state) => {
    const matrixPublished = [];
    state.programEngine.matrixRoomId = '!it0322:localhost';
    state.programEngine.matrixDmPeerUserId = '@peer:localhost';
    state.programEngine.matrixAdapter = {
      publish: async (payload) => {
        matrixPublished.push(payload);
      },
    };
    const model0 = state.runtime.getModel(0);
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de/sw' });
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: 'ui-server-it0322' });
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
    state.runtime.startMqttLoop({
      host: 'localhost',
      port: 1883,
      client_id: '0322-flow',
      transport: 'mock',
    });
    state.cacheUploadedMediaForTest('mxc://localhost/0322-flow', {
      buffer: buildZipBuffer(payloadWithIngressAndEgress()),
      contentType: 'application/zip',
      filename: '0322-imported-host-egress.zip',
      userId: '@drop:localhost',
    });
    state.runtime.addLabel(state.runtime.getModel(1031), 0, 0, 0, { k: 'slide_import_media_uri', t: 'str', v: 'mxc://localhost/0322-flow' });
    const importResult = await state.submitEnvelope(slideImportClickBusEvent());
    assert.equal(importResult.result, 'ok', 'import_request_must_be_accepted');
    assert.equal(importResult.routed_by, 'model0_busin', 'import_request_must_route_by_model0_busin');
    await wait();

    const registry = state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    const importedEntry = registry.find((entry) => entry && entry.name === 'Imported Host Egress Flow App');
    assert.ok(importedEntry, 'imported_app_must_appear_in_registry');
    const importedId = importedEntry.model_id;
    const ingressKey = `imported_host_submit_${importedId}`;
    const busLabel = `imported_submit_${importedId}_bus`;
    const bridgeFunc = `bridge_imported_submit_to_mt_bus_send_${importedId}`;

    const model0Root = state.runtime.getCell(state.runtime.getModel(0), 0, 0, 0).labels;
    assert.ok(model0Root.has(ingressKey), 'host_ingress_adapter_must_exist_before_egress_flow');
    state.runtime.addLabel(state.runtime.getModel(importedId), 2, 3, 0, {
      k: 'click_chain',
      t: 'pin.in',
      v: uiEventPayload([
        { k: 'text', t: 'str', v: 'hello imported host egress' },
        { k: 'source', t: 'str', v: 'host_ingress' },
      ]),
    });
    await wait(220);

    const importedRoot = state.runtime.getCell(state.runtime.getModel(importedId), 0, 0, 0).labels;
    assert.equal(importedRoot.get('status_text')?.v, 'payload_ready', 'imported_handler_must_prepare_payload');
    assert.ok(Array.isArray(importedRoot.get('last_submit_payload')?.v), 'imported_handler_must_materialize_payload_array');
    assert.equal(importedRoot.get('last_submit_payload')?.v?.find?.((record) => record && record.k === 'message_text')?.v, 'hello imported host egress', 'imported_payload_must_preserve_message_text');

    const mqttPublishes = state.runtime.mqttTrace.list().filter((entry) => entry.type === 'publish');
    assert.ok(mqttPublishes.some((entry) =>
      entry.payload?.topic === 'UIPUT/ws/dam/pic/de/sw/R1/3000/submit'
      && entry.payload?.payload?.type === 'pin_payload'
      && payloadString(entry.payload.payload.payload, 'message_role') === 'request'
      && payloadString(entry.payload.payload.payload, 'endpoint_worker_id') === 'R1'
      && payloadInt(entry.payload.payload.payload, 'endpoint_model_id') === 3000
      && payloadString(entry.payload.payload.payload, 'endpoint_pin') === 'submit'
      && payloadString(entry.payload.payload.payload, 'origin_worker_id') === 'ui-server-it0322'
      && payloadInt(entry.payload.payload.payload, 'origin_model_id') === importedId
      && payloadString(entry.payload.payload.payload, 'reply_target_worker_id') === 'ui-server-it0322'
      && payloadInt(entry.payload.payload.payload, 'reply_target_model_id') === importedId
      && payloadString(entry.payload.payload.payload, 'reply_target_pin') === 'result'
      && payloadJson(entry.payload.payload.payload, 'payload')?.find?.((record) => record && record.k === 'message_text')?.v === 'hello imported host egress',
    ), 'model0_bus_out_must_publish_endpoint_record_packet_to_mqtt');

    assert.equal(matrixPublished.length, 1, 'matrix_publish_must_be_called_once');
    assert.equal(matrixPublished[0]?.type, 'pin_payload', 'matrix_publish_must_use_pin_payload_transport');
    assert.deepEqual(Object.keys(matrixPublished[0] || {}).sort(), ['payload', 'type', 'version'], 'matrix packet must expose only version/type/payload');
    assert.equal(payloadString(matrixPublished[0]?.payload, 'message_role'), 'request', 'matrix_publish_must_mark_request_role');
    assert.equal(payloadString(matrixPublished[0]?.payload, 'endpoint_worker_id'), 'R1', 'matrix_publish_must_use_remote_worker_endpoint');
    assert.equal(payloadInt(matrixPublished[0]?.payload, 'endpoint_model_id'), 3000, 'matrix_publish_must_use_remote_model_endpoint');
    assert.equal(payloadString(matrixPublished[0]?.payload, 'endpoint_pin'), 'submit', 'matrix_publish_must_preserve_submit_pin_as_endpoint');
    assert.equal(payloadString(matrixPublished[0]?.payload, 'origin_worker_id'), 'ui-server-it0322', 'matrix_publish_must_use_ui_server_origin_worker');
    assert.equal(payloadInt(matrixPublished[0]?.payload, 'origin_model_id'), importedId, 'matrix_publish_must_use_imported_model_id_as_origin');
    assert.equal(payloadInt(matrixPublished[0]?.payload, 'reply_target_model_id'), importedId, 'matrix_publish_must_reply_to_local_imported_model_id');
    assert.equal(payloadJson(matrixPublished[0]?.payload, 'payload')?.find?.((record) => record && record.k === 'message_text')?.v, 'hello imported host egress', 'matrix_payload_must_preserve_message_text');

    const deleteResult = state.runtime.hostApi.wsDeleteApp(importedId);
    assert.equal(deleteResult.ok, true, 'delete_must_succeed');
    const rootCell = state.runtime.getCell(model0, 0, 0, 0).labels;
    assert.ok(!rootCell.has(ingressKey), 'delete_must_remove_host_ingress_port');
    assert.ok(!rootCell.has(busLabel), 'delete_must_remove_model0_bus_out_label');
    assert.ok(!rootCell.has(bridgeFunc), 'delete_must_remove_generated_bridge_function');
    return { key: 'imported_app_host_ingress_can_reach_bus_out_mqtt_and_matrix', status: 'PASS' };
  });
}

const tests = [
  test_imported_app_host_ingress_can_reach_bus_out_mqtt_and_matrix,
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
