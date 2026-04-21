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

function buildBasePayload(extraRoot = [], extraRecords = []) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.ImportedHostEgressApp' },
    { id: 0, p: 0, r: 0, c: 0, k: 'app_name', t: 'str', v: 'Imported Host Egress App' },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_worker', t: 'str', v: 'imported-host-egress' },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_capable', t: 'bool', v: true },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_surface_type', t: 'str', v: 'workspace.page' },
    { id: 0, p: 0, r: 0, c: 0, k: 'from_user', t: 'str', v: '@host:test' },
    { id: 0, p: 0, r: 0, c: 0, k: 'to_user', t: 'str', v: '@drop:test' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_root_node_id', t: 'str', v: 'imported_host_egress_root' },
    { id: 0, p: 0, r: 0, c: 0, k: 'status_text', t: 'str', v: 'idle' },
    ...extraRoot,
    ...extraRecords,
  ];
}

function hostIngressRootLabel() {
  return {
    id: 0,
    p: 0,
    r: 0,
    c: 0,
    k: 'host_ingress_v1',
    t: 'json',
    v: {
      version: 'v1',
      boundaries: [{
        semantic: 'submit',
        pin_name: 'submit_request',
        value_t: 'event',
        locator_kind: 'root_relative_cell',
        locator_value: { p: 0, r: 0, c: 0 },
        primary: true,
      }],
    },
  };
}

function dualBusRootLabel(value = {}) {
  return {
    id: 0,
    p: 0,
    r: 0,
    c: 0,
    k: 'dual_bus_model',
    t: 'json',
    v: {
      mode: 'imported_host_egress',
      ...value,
    },
  };
}

function validPayload() {
  return buildBasePayload(
    [hostIngressRootLabel(), dualBusRootLabel()],
    [
      { id: 0, p: 0, r: 0, c: 0, k: 'input_text', t: 'str', v: '' },
      { id: 0, p: 0, r: 0, c: 0, k: 'last_submit_payload', t: 'json', v: null },
      { id: 0, p: 0, r: 0, c: 0, k: 'submit_request', t: 'pin.in', v: null },
      { id: 0, p: 0, r: 0, c: 0, k: 'submit_request_wiring', t: 'pin.connect.label', v: [{ from: '(self, submit_request)', to: ['(func, handle_submit:in)'] }] },
      { id: 0, p: 0, r: 0, c: 0, k: 'submit_owner_route', t: 'pin.connect.label', v: [{ from: '(func, handle_submit:out)', to: ['submit_owner_req'] }] },
      { id: 0, p: 0, r: 0, c: 0, k: 'root_routes', t: 'pin.connect.cell', v: [
        { from: [2, 3, 0, 'click_chain'], to: [[0, 0, 0, 'submit_request']] },
        { from: [0, 0, 0, 'submit_owner_req'], to: [[0, 1, 0, 'owner_apply']] },
      ] },
      { id: 0, p: 0, r: 0, c: 0, k: 'submit', t: 'pin.out', v: null },
      { id: 0, p: 0, r: 0, c: 0, k: 'handle_submit', t: 'func.js', v: { code: [
        "const event = label && label.v && typeof label.v === 'object' ? label.v : {};",
        "const text = String(event.text != null ? event.text : '').trim();",
        "const SELF = ctx.self.model_id;",
        "const payload = [",
        "  { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.ImportedHostSubmit' },",
        "  { id: 0, p: 0, r: 0, c: 0, k: 'message_text', t: 'str', v: text },",
        "  { id: 0, p: 0, r: 0, c: 0, k: 'source_model_id', t: 'int', v: SELF },",
        "  { id: 0, p: 0, r: 0, c: 0, k: 'route_mode', t: 'str', v: String(event.source || 'host_ingress') }",
        "];",
        "ctx.writeLabel({ model_id: SELF, p: 0, r: 0, c: 0, k: 'input_text' }, 'str', text);",
        "ctx.writeLabel({ model_id: SELF, p: 0, r: 0, c: 0, k: 'last_submit_payload' }, 'json', payload);",
        "ctx.writeLabel({ model_id: SELF, p: 0, r: 0, c: 0, k: 'status_text' }, 'str', text ? 'payload_ready' : 'empty_input');",
        "if (text) ctx.writeLabel({ model_id: SELF, p: 0, r: 0, c: 0, k: 'submit' }, 'pin.out', payload);",
        "return;",
      ].join('\n') } },
      { id: 0, p: 2, r: 3, c: 0, k: 'click_chain', t: 'pin.in', v: null },
    ],
  );
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0322-contract-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0322_contract_${Date.now()}`;
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

async function importPayload(state, payload, uri) {
  state.cacheUploadedMediaForTest(uri, {
    buffer: buildZipBuffer(payload),
    contentType: 'application/zip',
    filename: '0322-imported-host-egress.zip',
    userId: '@drop:localhost',
  });
  return state.runtime.hostApi.slideImportAppFromMxc(uri);
}

async function test_import_rejects_dual_bus_model_without_root_submit_pin_out() {
  return withServerState(async (state) => {
    const payload = buildBasePayload(
      [hostIngressRootLabel(), dualBusRootLabel()],
      [
        { id: 0, p: 0, r: 0, c: 0, k: 'submit_request', t: 'pin.in', v: null },
      ],
    );
    const result = await importPayload(state, payload, 'mxc://localhost/0322-contract-missing-egress');
    assert.equal(result.ok, false, 'dual_bus_import_without_root_submit_pin_out_must_be_rejected');
    assert.equal(result.detail, 'host_egress_target_pin_missing', 'missing_root_submit_pin_out_reason_must_be_explicit');
    return { key: 'import_rejects_dual_bus_model_without_root_submit_pin_out', status: 'PASS' };
  });
}

async function test_import_generates_host_egress_adapter_for_valid_dual_bus_import() {
  return withServerState(async (state) => {
    const result = await importPayload(state, validPayload(), 'mxc://localhost/0322-contract-valid');
    assert.equal(result.ok, true, 'valid_dual_bus_import_must_succeed');
    const importedId = result.data?.model_id;
    const model0 = state.runtime.getModel(0);
    const rootLabels = state.runtime.getCell(model0, 0, 0, 0).labels;
    const importedRoot = state.runtime.getCell(state.runtime.getModel(importedId), 0, 0, 0).labels;
    const egressLabel = `imported_submit_${importedId}_out`;
    const busLabel = `imported_submit_${importedId}_bus`;
    const forwardFunc = `forward_imported_submit_from_model0_${importedId}`;
    assert.ok(rootLabels.has(egressLabel), 'model0_egress_label_must_be_generated');
    assert.ok(rootLabels.has(busLabel), 'model0_bus_out_label_must_be_generated');
    assert.ok(importedRoot.get('dual_bus_model')?.v?.model0_egress_label === egressLabel, 'dual_bus_model_must_be_patched_with_generated_model0_egress_label');
    assert.ok(importedRoot.get('dual_bus_model')?.v?.model0_egress_func === forwardFunc, 'dual_bus_model_must_be_patched_with_generated_forward_func');
    const sys = state.runtime.getModel(-10);
    assert.ok(state.runtime.getCell(sys, 0, 0, 0).labels.has(forwardFunc), 'system_forward_function_must_be_generated');
    return { key: 'import_generates_host_egress_adapter_for_valid_dual_bus_import', status: 'PASS' };
  });
}

const tests = [
  test_import_rejects_dual_bus_model_without_root_submit_pin_out,
  test_import_generates_host_egress_adapter_for_valid_dual_bus_import,
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
