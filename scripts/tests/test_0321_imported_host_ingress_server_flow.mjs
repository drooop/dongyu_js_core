#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;

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

function slideImportClickPayload() {
  return uiEventPayload([
    { k: 'target', t: 'json', v: { model_id: 1031, p: 0, r: 0, c: 0 } },
  ]);
}

function temporaryValuePayload(value) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'value', t: 'json', v: value },
  ];
}

function payloadWithHostIngress() {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.HostIngressFlowApp' },
    { id: 0, p: 0, r: 0, c: 0, k: 'app_name', t: 'str', v: 'Host Ingress Flow App' },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_worker', t: 'str', v: 'host-ingress-flow' },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_capable', t: 'bool', v: true },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_surface_type', t: 'str', v: 'workspace.page' },
    { id: 0, p: 0, r: 0, c: 0, k: 'from_user', t: 'str', v: '@host:test' },
    { id: 0, p: 0, r: 0, c: 0, k: 'to_user', t: 'str', v: '@drop:test' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_root_node_id', t: 'str', v: 'host_flow_root' },
    { id: 0, p: 0, r: 0, c: 0, k: 'status_text', t: 'str', v: 'idle' },
    { id: 0, p: 0, r: 0, c: 0, k: 'host_ingress_v1', t: 'json', v: {
      version: 'v1',
      boundaries: [{
        semantic: 'submit',
        pin_name: 'submit_request',
        value_t: 'modeltable',
        locator_kind: 'root_relative_cell',
        locator_value: { p: 2, r: 2, c: 0 },
        primary: true,
      }],
    } },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_node_id', t: 'str', v: 'host_flow_root' },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_component', t: 'str', v: 'Container' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_node_id', t: 'str', v: 'host_flow_status' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_component', t: 'str', v: 'Text' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_parent', t: 'str', v: 'host_flow_root' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_bind_json', t: 'json', v: { read: { model_id: 0, p: 0, r: 0, c: 0, k: 'status_text' } } },
    { id: 0, p: 0, r: 0, c: 0, k: 'root_routes', t: 'pin.connect.cell', v: [
      { from: [2, 2, 0, 'write_label_req'], to: [[0, 0, 0, 'mt_write_req']] },
    ] },
    { id: 0, p: 2, r: 2, c: 0, k: 'submit_request', t: 'pin.in', v: null },
    { id: 0, p: 2, r: 2, c: 0, k: 'submit_request_wiring', t: 'pin.connect.label', v: [{ from: '(self, submit_request)', to: ['(func, handle_submit:in)'] }] },
    { id: 0, p: 2, r: 2, c: 0, k: 'handle_submit', t: 'func.js', v: { code: "const records = Array.isArray(label && label.v) ? label.v : [];\nconst event = (records.find((rec) => rec && rec.k === 'value') || {}).v || {};\nif (event.trigger !== 'host_submit') return;\nV1N.writeLabel(0, 0, 0, { k: 'status_text', t: 'str', v: 'host_route_ok' });" } },
  ];
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0321-flow-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0321_flow_${Date.now()}`;
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

async function test_host_ingress_route_reaches_imported_boundary_and_cleans_up_on_delete() {
  return withServerState(async (state) => {
    state.runtime.startMqttLoop({
      host: 'localhost',
      port: 1883,
      client_id: '0321-flow',
      topic_prefix: 'it0321flow',
      transport: 'mock',
    });
    state.cacheUploadedMediaForTest('mxc://localhost/0321-flow', {
      buffer: buildZipBuffer(payloadWithHostIngress()),
      contentType: 'application/zip',
      filename: '0321-host-ingress.zip',
      userId: '@drop:localhost',
    });
    state.runtime.addLabel(state.runtime.getModel(1031), 0, 0, 0, { k: 'slide_import_media_uri', t: 'str', v: 'mxc://localhost/0321-flow' });
    const importResult = await state.submitEnvelope(pinEnvelope(
      { model_id: 1030, p: 2, r: 4, c: 0 },
      'click',
      slideImportClickPayload(),
    ));
    assert.equal(importResult.result, 'ok', 'import_request_must_be_accepted');
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));

    const registry = state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    const importedEntry = registry.find((entry) => entry && entry.name === 'Host Ingress Flow App');
    assert.ok(importedEntry, 'imported_app_must_appear_in_registry');
    const importedId = importedEntry.model_id;
    const ingressKey = `imported_host_submit_${importedId}`;
    const routeKey = `${ingressKey}_route`;
    const model0 = state.runtime.getModel(0);
    assert.ok(model0.getCell(0, 0, 0).labels.get(ingressKey), 'model0_ingress_port_must_exist');
    assert.ok(model0.getCell(0, 0, 0).labels.get(routeKey), 'model0_route_label_must_exist');
    assert.equal(state.runtime.busInPorts.has(ingressKey), true, 'imported_host_ingress_must_register_bus_in_port');
    assert.equal(state.runtime.mqttClient.subscriptions.has(`it0321flow/${ingressKey}`), true, 'imported_host_ingress_must_subscribe_runtime_topic');

    const hostIngressResult = await state.submitEnvelope(pinEnvelope(
      { model_id: 0, p: 0, r: 0, c: 0 },
      ingressKey,
      temporaryValuePayload({ trigger: 'host_submit' }),
    ));
    assert.equal(hostIngressResult.result, 'ok', 'host_ingress_pin_write_must_be_accepted');
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));

    const importedLabels = state.clientSnap().models[String(importedId)]?.cells?.['0,0,0']?.labels || {};
    assert.equal(importedLabels.status_text?.v, 'host_route_ok', 'host_ingress_must_drive_imported_boundary_submit');

    const deleteResult = state.runtime.hostApi.wsDeleteApp(importedId);
    assert.equal(deleteResult.ok, true, 'delete_must_succeed');
    const model0AfterDelete = state.runtime.getModel(0);
    assert.ok(!model0AfterDelete.getCell(0, 0, 0).labels.get(ingressKey), 'delete_must_remove_model0_ingress_port');
    assert.ok(!model0AfterDelete.getCell(0, 0, 0).labels.get(routeKey), 'delete_must_remove_model0_route_label');
    assert.equal(state.runtime.busInPorts.has(ingressKey), false, 'delete_must_unregister_bus_in_port');
    assert.equal(state.runtime.mqttClient.subscriptions.has(`it0321flow/${ingressKey}`), false, 'delete_must_unsubscribe_runtime_topic');
    return { key: 'host_ingress_route_reaches_imported_boundary_and_cleans_up_on_delete', status: 'PASS' };
  });
}

const tests = [
  test_host_ingress_route_reaches_imported_boundary_and_cleans_up_on_delete,
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
