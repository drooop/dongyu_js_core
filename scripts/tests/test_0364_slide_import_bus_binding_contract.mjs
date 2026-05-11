#!/usr/bin/env node
// 0364 — UI-server installer/importer contract for split bus and host-owned egress binding.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;
const repoRoot = new URL('../..', import.meta.url).pathname;
const payloadPath = join(repoRoot, 'test_files', 'minimal_submit_dual_bus_app_payload.json');

function readPayload() {
  return JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
}

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0364-import-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0364_import_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'ui-server-0364';
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

function cacheZip(state, uri, payload) {
  state.cacheUploadedMediaForTest(uri, {
    buffer: buildZipBuffer(payload),
    contentType: 'application/zip',
    filename: 'minimal-submit-0364.zip',
    userId: '@manual:localhost',
  });
}

async function test_import_generates_host_owned_binding_and_split_bus_pins() {
  return withServerState(async (state, buildSlideAppExportPayload) => {
    const model0 = state.runtime.getModel(0);
    assert.equal(model0.getCell(0, 0, 0).labels.get('sys_worker_id')?.v, '5/10/28/35/13', 'ui_server_runtime_must_seed_explicit_worker_id');
    assert.equal(model0.getCell(0, 0, 0).labels.get('sys_worker_role')?.v, 'DEM', 'ui_server_runtime_must_seed_dem_role_before_bus_materialization');
    assert.equal(model0.getCell(0, 0, 0).labels.has('v1n_id'), false, 'ui_server_runtime_must_not_seed_removed_v1n_id');
    assert.equal(model0.getCell(0, 0, 0).labels.has('worker.role'), false, 'ui_server_runtime_must_not_seed_legacy_worker_role_key');

    cacheZip(state, 'mxc://localhost/0364-valid', readPayload());
    const importResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0364-valid');
    assert.equal(importResult.ok, true, 'valid_provider_zip_must_import');
    const importedId = importResult.data?.model_id;
    assert.equal(Number.isInteger(importedId), true, 'import_must_allocate_local_model_id');

    const rootLabels = state.runtime.getCell(state.runtime.getModel(importedId), 0, 0, 0).labels;
    const bindings = Array.from(rootLabels.values()).filter((label) => label && label.t === 'ui.egress.binding.v1');
    assert.equal(bindings.length, 1, 'installer_must_create_one_host_owned_egress_binding_for_submit1');
    const binding = bindings[0];
    assert.equal(binding.k, 'ui_egress_submit1_binding', 'binding_key_must_be_stable_and_provider_visible');
    assert.deepEqual(binding.v, {
      from_pin: 'submit1',
      bus: 'management',
      host_model_id: 0,
      host_cell: [0, 0, 0],
      host_pin_type: 'pin.bus.mb.out',
      host_pin_key: `imported_submit1_${importedId}_bus`,
      target: { worker_id: 'RE', model_id: 3000, pin: 'submit1' },
      reply_pin: 'result',
      owned_by: 'ui-server-installer',
    }, 'binding_value_must_describe_actual_management_bus_route');

    const generatedModel0Labels = rootLabels.get('host_egress_generated_model0_labels')?.v || [];
    assert.equal(generatedModel0Labels.includes(binding.v.host_pin_key), true, 'host_egress_cleanup_list_must_include_bus_out_pin');
    assert.equal(generatedModel0Labels.includes(binding.k), false, 'binding_is_not_a_model0_label');

    const hostPin = state.runtime.getCell(model0, 0, 0, 0).labels.get(binding.v.host_pin_key);
    assert.equal(hostPin?.t, 'pin.bus.mb.out', 'generated_host_egress_pin_must_use_management_bus_out');

    const ingressLabels = rootLabels.get('host_ingress_generated_model0_labels')?.v || [];
    const ingressKey = ingressLabels.find((key) => key && key.includes('_submit_'));
    assert.ok(ingressKey, 'host_ingress_cleanup_list_must_include_model0_ingress_pin');
    assert.equal(state.runtime.getCell(model0, 0, 0, 0).labels.get(ingressKey)?.t, 'pin.bus.mb.in', 'generated_host_ingress_pin_must_use_management_bus_in');

    const exportResult = buildSlideAppExportPayload(state.runtime, importedId);
    assert.equal(exportResult.ok, true, 'export_must_succeed_after_import');
    assert.equal(exportResult.data.payload.some((record) => record.t === 'ui.egress.binding.v1'), false, 'export_must_not_include_host_owned_binding');
    assert.equal(exportResult.data.payload.some((record) => typeof record.t === 'string' && record.t.startsWith('pin.bus.')), false, 'export_must_not_include_host_bus_pins');
    return { key: 'import_generates_host_owned_binding_and_split_bus_pins', status: 'PASS' };
  });
}

async function test_import_rejects_provider_owned_binding_and_bus_pins() {
  return withServerState(async (state) => {
    const payload = readPayload();
    const bindingPayload = [
      ...payload,
      { id: 0, p: 0, r: 0, c: 0, k: 'ui_egress_submit1_binding', t: 'ui.egress.binding.v1', v: { owned_by: 'provider' } },
    ];
    cacheZip(state, 'mxc://localhost/0364-provider-binding', bindingPayload);
    const bindingResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0364-provider-binding');
    assert.equal(bindingResult.ok, false, 'provider_owned_binding_must_be_rejected');
    assert.equal(bindingResult.detail, 'forbidden_label_type:ui.egress.binding.v1', 'binding_rejection_must_name_forbidden_type');

    const busPayload = [
      ...payload,
      { id: 0, p: 0, r: 0, c: 0, k: 'provider_bus_out', t: 'pin.bus.mb.out', v: null },
    ];
    cacheZip(state, 'mxc://localhost/0364-provider-bus', busPayload);
    const busResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0364-provider-bus');
    assert.equal(busResult.ok, false, 'provider_owned_bus_pin_must_be_rejected');
    assert.equal(busResult.detail, 'forbidden_label_type:pin.bus.mb.out', 'bus_rejection_must_name_forbidden_type');
    return { key: 'import_rejects_provider_owned_binding_and_bus_pins', status: 'PASS' };
  });
}

const tests = [
  test_import_generates_host_owned_binding_and_split_bus_pins,
  test_import_rejects_provider_owned_binding_and_bus_pins,
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
      console.log(`[FAIL] ${test.name}: ${error && error.stack ? error.stack : error}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
