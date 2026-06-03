#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;
const repoRoot = new URL('../..', import.meta.url).pathname;
const payloadPath = join(repoRoot, 'test_files', 'minimal_submit_dual_bus_app_payload.json');
const zipPath = join(repoRoot, 'test_files', 'minimal_submit_dual_bus.zip');
const guidePath = join(repoRoot, 'docs', 'user-guide', 'slide-app-runtime', 'minimal_submit_app_provider_guide.md');
const visualizedPath = join(repoRoot, 'docs', 'user-guide', 'slide-app-runtime', 'minimal_submit_app_provider_visualized.md');
const interactivePath = join(repoRoot, 'docs', 'user-guide', 'slide-app-runtime', 'minimal_submit_app_provider_interactive.html');

function readPayload() {
  return JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
}

function assertTemporaryRecordArray(payload, label) {
  assert.ok(Array.isArray(payload), `${label}_must_be_array`);
  assert.ok(payload.length > 0, `${label}_must_not_be_empty`);
  for (const record of payload) {
    assert.equal(Number.isInteger(record.id), true, `${label}_record_id_must_be_temp_int`);
    assert.equal(Object.prototype.hasOwnProperty.call(record, 'model_id'), false, `${label}_must_not_use_patch_model_id`);
    assert.equal(Object.prototype.hasOwnProperty.call(record, 'op'), false, `${label}_must_not_use_patch_ops`);
    assert.equal(typeof record.k, 'string', `${label}_record_k_must_be_string`);
    assert.equal(typeof record.t, 'string', `${label}_record_t_must_be_string`);
  }
}

function assertNoLegacyPayloadSurface(payload, label) {
  const text = JSON.stringify(payload);
  assert.equal(text.includes('pin.connect.model'), false, `${label}_must_not_include_pin_connect_model`);
  assert.equal(/ctx\.(writeLabel|getLabel|rmLabel)/u.test(text), false, `${label}_must_not_include_legacy_ctx_label_api`);
  assert.equal(text.includes('"input_value"'), false, `${label}_must_not_include_input_value_fallback`);
  assert.equal(text.includes('host_egress_generated_'), false, `${label}_must_not_include_generated_host_egress_labels`);
  assert.equal(text.includes('host_ingress_generated_'), false, `${label}_must_not_include_generated_host_ingress_labels`);
  assert.equal(text.includes('"bus_event"'), false, `${label}_must_not_include_runtime_bus_event`);
  assert.equal(text.includes('"bus_event_last_op_id"'), false, `${label}_must_not_include_runtime_bus_event_last_op_id`);
  assert.equal(text.includes('"bus_event_error"'), false, `${label}_must_not_include_runtime_bus_event_error`);
  assert.equal(/"bus_event[^"]*"/u.test(text), false, `${label}_must_not_include_runtime_bus_event_prefix_labels`);
  assert.equal(text.includes('"owner_request"'), false, `${label}_must_not_include_runtime_owner_request_pin`);
  assert.equal(text.includes('"owner_route"'), false, `${label}_must_not_include_runtime_owner_route`);
  assert.equal(text.includes('__owner_last_'), false, `${label}_must_not_include_runtime_owner_last_state`);
}

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

function withoutSlideAppSummary(payload) {
  return payload.filter((record) => !(record && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === 'slide_app_summary'));
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0361-export-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0361_export_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { buildSlideAppExportZip, createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
    await state.activateRuntimeMode('running');
    return await fn(state, buildSlideAppExportZip);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

function test_saved_payload_and_zip_shape() {
  assert.equal(fs.existsSync(payloadPath), true, 'minimal_submit_payload_fixture_missing');
  assert.equal(fs.existsSync(zipPath), true, 'minimal_submit_zip_fixture_missing');
  const payload = readPayload();
  assertTemporaryRecordArray(payload, 'saved_payload');
  assertNoLegacyPayloadSurface(payload, 'saved_payload');
  assert.equal(
    payload.some((record) => record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === 'slide_app_summary' && typeof record.v === 'string' && record.v.trim().length >= 8),
    true,
    'saved_payload_must_include_slide_app_summary',
  );
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().filter((entry) => entry && !entry.isDirectory);
  assert.equal(entries.length, 1, 'minimal_submit_zip_must_contain_exactly_one_file');
  assert.equal(entries[0].entryName, 'app_payload.json', 'minimal_submit_zip_file_must_be_app_payload_json');
  const zippedPayload = JSON.parse(entries[0].getData().toString('utf8'));
  assert.deepEqual(zippedPayload, payload, 'zip_payload_must_match_saved_payload');
  return { key: 'saved_payload_and_zip_shape', status: 'PASS' };
}

async function test_import_rejects_slide_capable_payload_missing_summary() {
  return withServerState(async (state) => {
    const payload = withoutSlideAppSummary(readPayload());
    state.cacheUploadedMediaForTest('mxc://localhost/0361-missing-summary', {
      buffer: buildZipBuffer(payload),
      contentType: 'application/zip',
      filename: 'missing_summary.zip',
      userId: '@manual:localhost',
    });
    const importResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0361-missing-summary');
    assert.equal(importResult.ok, false, 'summaryless_slide_payload_must_be_rejected');
    assert.equal(importResult.detail, 'missing_slide_app_summary', 'summaryless_slide_payload_rejection_must_be_explicit');
    return { key: 'import_rejects_slide_capable_payload_missing_summary', status: 'PASS' };
  });
}

async function test_saved_zip_imports_and_exports_reimportable_zip() {
  return withServerState(async (state, buildSlideAppExportZip) => {
    const payload = readPayload();
    state.cacheUploadedMediaForTest('mxc://localhost/0361-minimal-submit', {
      buffer: buildZipBuffer(payload),
      contentType: 'application/zip',
      filename: 'minimal_submit_dual_bus.zip',
      userId: '@manual:localhost',
    });
    const importResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0361-minimal-submit');
    assert.equal(importResult.ok, true, 'saved_zip_import_must_succeed');
    const importedId = importResult.data?.model_id;
    assert.equal(Number.isInteger(importedId), true, 'imported_model_id_must_be_int');
    const importedModel = state.runtime.getModel(importedId);
    const root = state.runtime.getCell(importedModel, 0, 0, 0).labels;
    assert.equal(root.get('app_name')?.v, '最小 Submit 双总线示例', 'imported_app_name_must_match');
    assert.deepEqual(root.get('remote_bus_endpoint_v1')?.v, { transport: 'mqtt', to: { worker_id: 'R1', model_id: 3000 } }, 'remote_endpoint_must_be_preserved_without_reply_to');
    assert.deepEqual(root.get('dual_bus_model')?.v, { mode: 'imported_host_egress', egress_pins: ['submit1'] }, 'dual_bus_must_declare_public_egress_pin');
    assert.ok(root.has('host_egress_generated_model0_labels'), 'host_egress_adapter_must_be_generated');
    const statusCell = state.runtime.getCell(state.runtime.getModel(importedId), 2, 5, 0).labels;
    assert.deepEqual(statusCell.get('ui_bind_read_json')?.v, { p: 0, r: 0, c: 0, k: 'remote_status' }, 'status_badge_must_use_current_model_bind_read_without_model_id');
    assert.equal([...statusCell.keys()].some((key) => String(key).startsWith('ui_text_ref_')), false, 'status_badge_must_not_keep_scalar_ui_text_ref_bindings');
    state.runtime.addLabel(importedModel, 0, 0, 0, { k: 'owner_request', t: 'pin.in', v: [] });
    state.runtime.addLabel(importedModel, 0, 0, 0, { k: 'owner_route', t: 'pin.connect.label', v: [{ from: 'owner_request', to: ['owner_materialize:in'] }] });
    state.runtime.addLabel(importedModel, 0, 0, 0, { k: '__owner_last_action', t: 'str', v: 'pin_payload_result' });
    state.runtime.addLabel(importedModel, 0, 0, 2, { k: 'bus_event', t: 'event', v: null });
    state.runtime.addLabel(importedModel, 0, 0, 2, { k: 'bus_event_last_op_id', t: 'str', v: 'op_1' });
    state.runtime.addLabel(importedModel, 0, 0, 2, { k: 'bus_event_error', t: 'json', v: null });
    state.runtime.addLabel(importedModel, 0, 0, 2, { k: 'bus_event_custom', t: 'json', v: { runtime: true } });

    const exportResult = buildSlideAppExportZip(state.runtime, importedId);
    assert.equal(exportResult.ok, true, 'export_zip_must_succeed');
    const exportedZip = new AdmZip(exportResult.data.buffer);
    const entries = exportedZip.getEntries().filter((entry) => entry && !entry.isDirectory);
    assert.equal(entries.length, 1, 'export_zip_must_contain_exactly_one_file');
    assert.equal(entries[0].entryName, 'app_payload.json', 'export_zip_file_must_be_app_payload_json');
    const exportedPayload = JSON.parse(entries[0].getData().toString('utf8'));
    assertTemporaryRecordArray(exportedPayload, 'exported_payload');
    assertNoLegacyPayloadSurface(exportedPayload, 'exported_payload');
    assert.equal(exportedPayload.some((record) => record.k === 'remote_bus_endpoint_v1' && record.v?.to?.worker_id === 'R1' && record.v?.to?.model_id === 3000 && !Object.prototype.hasOwnProperty.call(record.v, 'reply_to')), true, 'exported_payload_must_keep_remote_endpoint_without_reply_to');
    assert.equal(exportedPayload.some((record) => record.k === 'dual_bus_model' && record.v?.mode === 'imported_host_egress' && Array.isArray(record.v.egress_pins) && record.v.egress_pins.includes('submit1')), true, 'exported_payload_must_keep_dual_bus_egress_pin');
    assert.equal(exportedPayload.some((record) => record.k === 'click_event' && record.p === 2 && record.r === 3 && record.t === 'pin.in'), true, 'exported_payload_must_keep_button_click_event_pin_in');
    assert.equal(exportedPayload.some((record) => record.k === 'click_event_wiring' && record.p === 2 && record.r === 3 && record.t === 'pin.connect.label'), true, 'exported_payload_must_keep_button_click_event_wiring');
    assert.equal(exportedPayload.some((record) => record.k === 'click_chain' && record.p === 2 && record.r === 3 && record.t === 'pin.out'), true, 'exported_payload_must_keep_button_click_chain_pin_out');
    assert.equal(exportedPayload.some((record) => record.k === 'ui_bind_json' && record.p === 2 && record.r === 3 && record.v?.write?.pin === 'click_event'), true, 'exported_payload_must_keep_button_write_binding_to_click_event');
    assert.equal(exportedPayload.some((record) => record.k === 'submit1' && record.t === 'pin.out'), true, 'exported_payload_must_keep_submit1_pin_out');
    assert.equal(exportedPayload.some((record) => record.k === 'submit' && record.t === 'pin.out'), false, 'exported_payload_must_not_recreate_legacy_submit_pin');
    assert.deepEqual(exportedPayload.find((record) => record.k === 'ui_bind_read_json' && record.p === 2 && record.r === 5 && record.c === 0)?.v, { p: 0, r: 0, c: 0, k: 'remote_status' }, 'exported_payload_must_keep_current_model_bind_read_without_model_id');
    assert.equal(exportedPayload.some((record) => String(record.k || '').startsWith('ui_text_ref_')), false, 'exported_payload_must_not_recreate_scalar_ui_text_ref_bindings');

    state.cacheUploadedMediaForTest('mxc://localhost/0361-reimported-export', {
      buffer: exportResult.data.buffer,
      contentType: 'application/zip',
      filename: exportResult.data.filename,
      userId: '@manual:localhost',
    });
    const reimportResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0361-reimported-export');
    assert.equal(reimportResult.ok, true, 'exported_zip_must_be_reimportable');
    return { key: 'saved_zip_imports_and_exports_reimportable_zip', status: 'PASS' };
  });
}

function test_docs_explain_generation_and_export_paths() {
  const guide = fs.readFileSync(guidePath, 'utf8');
  const visualized = fs.readFileSync(visualizedPath, 'utf8');
  const interactive = fs.readFileSync(interactivePath, 'utf8');
  for (const [label, text] of [
    ['guide', guide],
    ['visualized', visualized],
    ['interactive', interactive],
  ]) {
    assert.match(text, /app_payload\.json/u, `${label}_must_name_app_payload`);
    assert.match(text, /\/api\/slide-apps\/(?:<modelId>|&lt;modelId&gt;)\/export\.zip/u, `${label}_must_document_export_endpoint`);
    assert.match(text, /Zip/u, `${label}_must_document_workspace_zip_export`);
  }
  assert.match(guide, /test_files\/minimal_submit_dual_bus_app_payload\.json/u, 'guide_must_reference_saved_payload_fixture');
  assert.match(guide, /test_files\/minimal_submit_dual_bus\.zip/u, 'guide_must_reference_saved_zip_fixture');
  assert.match(guide, /host_ingress_generated_\*/u, 'guide_must_explain_generated_ingress_filter');
  assert.match(guide, /host_egress_generated_\*/u, 'guide_must_explain_generated_egress_filter');
  return { key: 'docs_explain_generation_and_export_paths', status: 'PASS' };
}

const tests = [
  test_saved_payload_and_zip_shape,
  test_import_rejects_slide_capable_payload_missing_summary,
  test_saved_zip_imports_and_exports_reimportable_zip,
  test_docs_explain_generation_and_export_paths,
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
      console.log(`[FAIL] ${test.name}: ${error && error.message ? error.message : error}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
