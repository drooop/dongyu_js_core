#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;

function wait(ms = 180) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function pollUntil(check, { timeoutMs = 1600, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = check();
    if (value) return value;
    await wait(intervalMs);
  }
  return check();
}

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

function payloadWithIngressAndEgress() {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.ImportedHostEgressFlowApp' },
    { id: 0, p: 0, r: 0, c: 0, k: 'app_name', t: 'str', v: 'Imported Host Egress Flow App' },
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
        value_t: 'event',
        locator_kind: 'root_relative_cell',
        locator_value: { p: 0, r: 0, c: 0 },
        primary: true,
      }],
    } },
    { id: 0, p: 0, r: 0, c: 0, k: 'dual_bus_model', t: 'json', v: { mode: 'imported_host_egress' } },
    { id: 0, p: 0, r: 0, c: 0, k: 'submit_request', t: 'pin.in', v: null },
    { id: 0, p: 0, r: 0, c: 0, k: 'submit_request_wiring', t: 'pin.connect.label', v: [{ from: '(self, submit_request)', to: ['(func, handle_submit:in)'] }] },
    { id: 0, p: 0, r: 0, c: 0, k: 'submit_owner_route', t: 'pin.connect.label', v: [{ from: '(func, handle_submit:out)', to: ['submit_owner_req'] }] },
    { id: 0, p: 0, r: 0, c: 0, k: 'submit', t: 'pin.out', v: null },
    { id: 0, p: 0, r: 0, c: 0, k: 'root_routes', t: 'pin.connect.cell', v: [
      { from: [2, 3, 0, 'click_chain'], to: [[0, 0, 0, 'submit_request']] },
      { from: [0, 0, 0, 'submit_owner_req'], to: [[0, 1, 0, 'owner_apply']] },
    ] },
    { id: 0, p: 2, r: 3, c: 0, k: 'click_chain', t: 'pin.in', v: null },
    { id: 0, p: 0, r: 0, c: 0, k: 'handle_submit', t: 'func.js', v: { code: [
      "const event = label && label.v && typeof label.v === 'object' ? label.v : {};",
      "const text = String(event.text != null ? event.text : '').trim();",
      "const source = String(event.source || 'host_ingress');",
      "const payload = [",
      "  { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.ImportedHostSubmit' },",
      "  { id: 0, p: 0, r: 0, c: 0, k: 'message_text', t: 'str', v: text },",
      "  { id: 0, p: 0, r: 0, c: 0, k: 'route_mode', t: 'str', v: source },",
      "  { id: 0, p: 0, r: 0, c: 0, k: 'source_model_id', t: 'int', v: ctx.self.model_id }",
      "];",
      "V1N.addLabel('input_text', 'str', text);",
      "V1N.addLabel('last_submit_payload', 'json', payload);",
      "V1N.addLabel('status_text', 'str', text ? 'payload_ready' : 'empty_input');",
      "if (text) V1N.addLabel('submit', 'pin.out', payload);",
      "return;",
    ].join('\\n') } },
  ];
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0326-egress-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0326_egress_${Date.now()}`;
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

async function test_imported_egress_uses_bus_out_bridge_without_forward_func() {
  return withServerState(async (state) => {
    const matrixPublished = [];
    state.programEngine.matrixRoomId = '!it0326:localhost';
    state.programEngine.matrixDmPeerUserId = '@peer:localhost';
    state.programEngine.matrixAdapter = {
      publish: async (payload) => {
        matrixPublished.push(payload);
      },
    };
    state.runtime.startMqttLoop({
      host: 'localhost',
      port: 1883,
      client_id: '0326-egress',
      topic_prefix: 'it0326',
      transport: 'mock',
    });

    const uri = 'mxc://localhost/0326-egress';
    state.cacheUploadedMediaForTest(uri, {
      buffer: buildZipBuffer(payloadWithIngressAndEgress()),
      contentType: 'application/zip',
      filename: '0326-imported-egress.zip',
      userId: '@drop:localhost',
    });

    const importResult = state.runtime.hostApi.slideImportAppFromMxc(uri);
    assert.equal(importResult.ok, true, 'valid imported app must import');
    const importedId = importResult.data?.model_id;
    const sysLabels = state.runtime.getCell(state.runtime.getModel(-10), 0, 0, 0).labels;
    const forwardFunc = `forward_imported_submit_from_model0_${importedId}`;
    assert.equal(sysLabels.has(forwardFunc), false, 'legacy imported forward func must not be generated');

    const dualBus = state.runtime.getCell(state.runtime.getModel(importedId), 0, 0, 0).labels.get('dual_bus_model')?.v || {};
    assert.equal(Object.prototype.hasOwnProperty.call(dualBus, 'model0_egress_label'), false, 'legacy model0_egress_label must not be present');
    assert.equal(Object.prototype.hasOwnProperty.call(dualBus, 'model0_egress_func'), false, 'legacy model0_egress_func must not be present');

    const publishSubmit = async (messageText) => {
      state.runtime.addLabel(state.runtime.getModel(importedId), 0, 0, 0, {
        k: 'submit',
        t: 'pin.out',
        v: [
          { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.ImportedHostSubmit' },
          { id: 0, p: 0, r: 0, c: 0, k: 'message_text', t: 'str', v: messageText },
          { id: 0, p: 0, r: 0, c: 0, k: 'source_model_id', t: 'int', v: importedId },
        ],
      });
      await state.programEngine.tick();
      const mqttPublish = await pollUntil(() => state.runtime.mqttTrace.list().find((entry) =>
        entry.type === 'publish'
        && entry.payload?.payload?.type === 'pin_payload'
        && entry.payload?.payload?.source_model_id === importedId
        && entry.payload?.payload?.payload?.some?.((record) => record && record.k === 'message_text' && record.v === messageText)
      ));
      assert.ok(mqttPublish, `model0 pin.bus.out must publish MQTT payload for ${messageText}`);

      const matrixPacket = await pollUntil(() => matrixPublished.find((entry) =>
        entry?.type === 'pin_payload'
        && entry?.source_model_id === importedId
        && entry?.payload?.some?.((record) => record && record.k === 'message_text' && record.v === messageText)
      ));
      assert.ok(matrixPacket, `Matrix publish must occur via the new bridge for ${messageText}`);
      assert.equal(matrixPacket.pin, 'submit', 'Matrix bridge must preserve submit pin');
    };

    await publishSubmit('hello imported bridge #1');
    await publishSubmit('hello imported bridge #2');
    return { key: 'imported_egress_uses_bus_out_bridge_without_forward_func', status: 'PASS' };
  });
}

const tests = [test_imported_egress_uses_bus_out_bridge_without_forward_func];

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
