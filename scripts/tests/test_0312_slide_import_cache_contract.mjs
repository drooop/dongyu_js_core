#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';
import { once } from 'node:events';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const guidePath = path.join(repoRoot, 'docs/user-guide/slide_upload_auth_and_cache_contract_v1.md');

function buildImportZipBuffer() {
  const payload = [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.SlideCacheContractApp' },
    { id: 0, p: 0, r: 0, c: 0, k: 'app_name', t: 'str', v: '0312 Cache Contract App' },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_worker', t: 'str', v: 'zip-import' },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_capable', t: 'bool', v: true },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_surface_type', t: 'str', v: 'workspace.page' },
    { id: 0, p: 0, r: 0, c: 0, k: 'from_user', t: 'str', v: '@cache:localhost' },
    { id: 0, p: 0, r: 0, c: 0, k: 'to_user', t: 'str', v: '@drop:localhost' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_root_node_id', t: 'str', v: 'cache_root' },
  ];
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0312-cache-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0312_cache_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.MATRIX_HOMESERVER_URL = 'https://matrix.test';
  process.env.MATRIX_MBR_BOT_ACCESS_TOKEN = 'bot-token-0312';
  process.env.MATRIX_MBR_BOT_USER = '@bot:test';
  const originalFetch = global.fetch;
  global.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
    if (url.startsWith('https://matrix.test/_matrix/media/v3/upload')) {
      assert.equal(init?.method, 'POST', 'matrix_upload_must_post');
      assert.equal(init?.headers?.authorization, 'Bearer bot-token-0312', 'matrix_upload_must_use_bot_token');
      return new Response(JSON.stringify({ content_uri: 'mxc://localhost/0312-uploaded' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  };
  const { createServerState, handleMediaUploadRequest } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  await state.activateRuntimeMode('running');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    if (req.method === 'POST' && url.pathname === '/api/media/upload') {
      await handleMediaUploadRequest(req, res, state, null);
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'not_found' }));
  });
  server.listen(0, '127.0.0.1');
  try {
    if (!server.listening) {
      await once(server, 'listening');
    }
    return await fn(server, state);
  } finally {
    global.fetch = originalFetch;
    await new Promise((resolve) => server.close(() => resolve()));
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.MATRIX_HOMESERVER_URL;
    delete process.env.MATRIX_MBR_BOT_ACCESS_TOKEN;
    delete process.env.MATRIX_MBR_BOT_USER;
  }
}

async function readJson(response) {
  return response.json().catch(() => ({}));
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

function writeLabelPayload(targetCell, targetLabel, targetType, value, requestId = `req_${Date.now()}`) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'write_label.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_request_id', t: 'str', v: requestId },
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_from_cell', t: 'json', v: { p: 0, r: 0, c: 0 } },
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_target_cell', t: 'json', v: targetCell },
    { id: 0, p: 0, r: 0, c: 0, k: targetLabel, t: targetType, v: value },
  ];
}

function slideImportMediaUriBusEvent(uri) {
  return {
    type: 'bus_event_v2',
    bus_in_key: 'slide_import_media_uri_update',
    value: writeLabelPayload(
      { p: 0, r: 0, c: 0 },
      'slide_import_media_uri',
      'str',
      uri,
      `slide_import_uri_${Date.now()}`,
    ),
    meta: { op_id: `slide_import_uri_${Date.now()}`, source: 'test_0312' },
  };
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
    meta: { op_id: `slide_import_click_${Date.now()}`, source: 'test_0312' },
  };
}

function malformedSlideImportClickBusEvent() {
  return {
    type: 'bus_event_v2',
    bus_in_key: 'slide_import_click',
    value: writeLabelPayload(
      { p: 2, r: 4, c: 0 },
      'click',
      'pin.in',
      uiEventPayload([
        { k: 'action', t: 'str', v: 'click' },
      ]),
      `slide_import_click_malformed_${Date.now()}`,
    ),
    meta: { op_id: `slide_import_click_malformed_${Date.now()}`, source: 'test_0312' },
  };
}

function legacyOwnerLabelUpdateEnvelope(uri) {
  return {
    event_id: Date.now(),
    type: 'ui_owner_label_update',
    payload: {
      action: 'ui_owner_label_update',
      meta: { op_id: `legacy_uri_update_${Date.now()}` },
      target: { model_id: 1031, p: 0, r: 0, c: 0, k: 'slide_import_media_uri' },
      value: { t: 'str', v: uri },
    },
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

function legacyImporterButtonBind() {
  return {
    write: {
      action: 'slide_app_import',
      target_ref: {
        model_id: 1031,
        p: 0,
        r: 0,
        c: 0,
        k: 'slide_import_media_uri',
      },
    },
  };
}

function removeImporterClickContract(state) {
  const runtime = state.runtime;
  const model0 = runtime.getModel(0);
  const importer = runtime.getModel(1030);
  assert.ok(model0, 'model0_missing');
  assert.ok(importer, 'slide_importer_model_missing');
  runtime.rmLabel(importer, 0, 0, 0, 'bucket_c_cell_routes');
  runtime.rmLabel(importer, 0, 0, 0, 'slide_import_request');
  runtime.rmLabel(model0, 0, 0, 0, 'slide_import_request_route');
  runtime.rmLabel(model0, 0, 0, 0, 'slide_import_media_uri_update_route');
  runtime.rmLabel(importer, 2, 4, 0, 'click_route');
  runtime.rmLabel(importer, 2, 4, 0, 'handle_slide_import_click');
  runtime.rmLabel(importer, 2, 4, 0, 'scope_privileged');
  runtime.addLabel(importer, 2, 4, 0, {
    k: 'ui_bind_json',
    t: 'json',
    v: legacyImporterButtonBind(),
  });
}

function writeLegacyScalarImporterClickPin(state) {
  const runtime = state.runtime;
  const importer = runtime.getModel(1030);
  assert.ok(importer, 'slide_importer_model_missing');
  runtime.rmLabel(importer, 2, 4, 0, 'click');
  runtime.addLabel(importer, 2, 4, 0, {
    k: 'click',
    t: 'pin.in',
    v: { legacy: true, route: 'direct_click_compat' },
  });
}

function readLabelFromState(state, modelId, p, r, c, k) {
  const model = state.runtime.getModel(modelId);
  if (!model) return null;
  const cell = state.runtime.getCell(model, p, r, c);
  return cell.labels.get(k) || null;
}

async function test_slide_import_requires_cache_priming_before_import() {
  return withServerState(async (server, state) => {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const missing = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0312-missing');
    assert.equal(missing.ok, false, 'uncached_slide_import_must_fail');
    assert.equal(missing.code, 'invalid_target', 'uncached_slide_import_must_report_invalid_target');
    assert.equal(missing.detail, 'media_not_cached', 'uncached_slide_import_must_report_media_not_cached');

    const response = await fetch(`${baseUrl}/api/media/upload?filename=0312-cache-contract.zip`, {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: buildImportZipBuffer(),
    });
    const data = await readJson(response);
    assert.equal(response.status, 200, 'upload_route_must_accept_zip');
    assert.equal(data.ok, true, 'upload_route_must_return_ok');
    assert.equal(data.uri, 'mxc://localhost/0312-uploaded', 'upload_route_must_return_matrix_uri');
    const uriUpdate = await state.submitEnvelope(slideImportMediaUriBusEvent(data.uri));
    assert.equal(uriUpdate.result, 'ok', 'uri_update_bus_event_must_succeed');
    assert.equal(uriUpdate.routed_by, 'model0_busin', 'uri_update_must_route_by_model0_busin');
    assert.equal(
      state.clientSnap().models?.['1031']?.cells?.['0,0,0']?.labels?.slide_import_media_uri?.v,
      data.uri,
      'uri_update_bus_event_must_write_media_uri',
    );

    const directImportClick = await state.submitEnvelope(pinEnvelope(
      { model_id: 1030, p: 2, r: 4, c: 0 },
      'click',
      slideImportClickPayload(),
    ));
    assert.equal(directImportClick.result, 'error', 'direct_importer_click_must_be_rejected');
    assert.equal(directImportClick.code, 'direct_pin_disabled', 'direct_importer_click_must_report_disabled');

    const importClick = await state.submitEnvelope(slideImportClickBusEvent());
    assert.equal(importClick.result, 'ok', 'cached_click_bus_event_must_be_accepted');
    assert.equal(importClick.routed_by, 'model0_busin', 'cached_click_must_route_by_model0_busin');

    const snap = state.clientSnap();
    const importedStatus = snap.models?.['1031']?.cells?.['0,0,0']?.labels?.slide_import_status?.v;
    const importedName = snap.models?.['1031']?.cells?.['0,0,0']?.labels?.slide_import_last_app_name?.v;
    const registry = snap.models?.['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    assert.equal(importedStatus, 'imported: 0312 Cache Contract App', 'uploaded_uri_must_be_cache_primed_for_import');
    assert.equal(importedName, '0312 Cache Contract App', 'cached_import_must_record_last_app_name');
    assert.ok(registry.some((entry) => entry && entry.name === '0312 Cache Contract App'), 'cached_import_must_materialize_workspace_entry');

    assert.ok(fs.existsSync(guidePath), 'slide_upload_auth_and_cache_contract_doc_missing');
    const guideText = fs.readFileSync(guidePath, 'utf8');
    assert.match(guideText, /\/api\/media\/upload/, 'contract_doc_must_name_cache_priming_entrypoint');
    assert.match(guideText, /media_not_cached/, 'contract_doc_must_name_media_not_cached');
    assert.match(guideText, /当前 ui-server 已缓存/, 'contract_doc_must_state_server_cached_requirement');
    return { key: 'slide_import_requires_cache_priming_before_import', status: 'PASS' };
  });
}

async function test_slide_import_rejects_legacy_owner_update_and_malformed_click_payload() {
  return withServerState(async (server, state) => {
    const legacyUri = 'mxc://localhost/0312-legacy-owner-update';
    const legacyUpdate = await state.submitEnvelope(legacyOwnerLabelUpdateEnvelope(legacyUri));
    assert.equal(legacyUpdate.result, 'error', 'legacy_owner_update_must_be_rejected');
    assert.equal(legacyUpdate.code, 'direct_owner_update_disabled', 'legacy_owner_update_must_report_disabled');
    assert.notEqual(
      state.clientSnap().models?.['1031']?.cells?.['0,0,0']?.labels?.slide_import_media_uri?.v,
      legacyUri,
      'legacy_owner_update_must_not_write_import_uri',
    );

    const malformedClick = await state.submitEnvelope(malformedSlideImportClickBusEvent());
    assert.equal(malformedClick.result, 'ok', 'malformed_click_still_reaches_model0_for_visible_modeltable_failure');
    assert.equal(malformedClick.routed_by, 'model0_busin', 'malformed_click_must_route_by_model0_busin');
    const errorLabel = readLabelFromState(state, 1030, 2, 4, 0, 'slide_import_click_error');
    assert.equal(errorLabel?.t, 'json', 'malformed_click_must_write_visible_error_label');
    assert.equal(errorLabel?.v?.code, 'invalid_target', 'malformed_click_must_report_missing_target');
    const snap = state.clientSnap();
    const registry = snap.models?.['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    assert.ok(
      !registry.some((entry) => entry && entry.name === '0312 Cache Contract App'),
      'malformed_click_must_not_materialize_imported_app',
    );
    return { key: 'slide_import_rejects_legacy_owner_update_and_malformed_click_payload', status: 'PASS' };
  });
}

async function test_slide_importer_repairs_legacy_persisted_click_contract() {
  return withServerState(async (server, state) => {
    removeImporterClickContract(state);
    writeLegacyScalarImporterClickPin(state);

    await state.applyModelTablePatch({ records: [] });

    const fileInputBind = readLabelFromState(state, 1030, 2, 3, 0, 'ui_bind_json')?.v;
    assert.equal(fileInputBind?.write?.bus_event_v2, true, 'repair_must_restore_fileinput_model0_bus_event_binding');
    assert.equal(fileInputBind?.write?.bus_in_key, 'slide_import_media_uri_update', 'repair_must_restore_fileinput_uri_update_bus_key');
    assert.equal(fileInputBind?.write?.value_t, 'modeltable', 'repair_must_restore_fileinput_modeltable_payload');
    assert.ok(!fileInputBind?.write?.action, 'repair_must_remove_fileinput_direct_owner_label_update');

    const buttonBind = readLabelFromState(state, 1030, 2, 4, 0, 'ui_bind_json')?.v;
    assert.equal(buttonBind?.write?.bus_event_v2, true, 'repair_must_restore_model0_bus_event_binding');
    assert.equal(buttonBind?.write?.bus_in_key, 'slide_import_click', 'repair_must_use_dedicated_import_bus_key');
    assert.equal(buttonBind?.write?.value_t, 'modeltable', 'repair_must_restore_modeltable_click_payload');
    const repairedClick = readLabelFromState(state, 1030, 2, 4, 0, 'click');
    assert.equal(repairedClick?.t, 'pin.in', 'repair_must_keep_click_as_pin_in');
    assert.equal(repairedClick?.v, null, 'repair_must_clear_legacy_scalar_click_payload');
    assert.equal(readLabelFromState(state, 1030, 0, 0, 0, 'bucket_c_cell_routes')?.t, 'pin.connect.cell', 'repair_must_restore_bucket_c_route');
    assert.equal(readLabelFromState(state, 1030, 0, 0, 0, 'slide_import_request')?.t, 'pin.out', 'repair_must_restore_import_request_pin');
    assert.equal(readLabelFromState(state, 0, 0, 0, 0, 'slide_import_click_route')?.t, 'pin.connect.model', 'repair_must_restore_model0_click_ingress_route');
    assert.equal(readLabelFromState(state, 0, 0, 0, 0, 'slide_import_media_uri_update_route')?.t, 'pin.connect.model', 'repair_must_restore_model0_uri_update_route');
    assert.equal(readLabelFromState(state, 0, 0, 0, 0, 'slide_import_request_route')?.t, 'pin.connect.model', 'repair_must_restore_model0_import_route');
    assert.equal(readLabelFromState(state, 1030, 2, 4, 0, 'click_route')?.t, 'pin.connect.label', 'repair_must_restore_button_click_route');
    const repairedHandler = readLabelFromState(state, 1030, 2, 4, 0, 'handle_slide_import_click');
    assert.equal(repairedHandler?.t, 'func.js', 'repair_must_restore_click_handler');
    assert.match(repairedHandler?.v?.code || '', /temporary_modeltable_required/, 'click_handler_must_reject_non_modeltable_payload');
    assert.doesNotMatch(repairedHandler?.v?.code || '', /Array\.isArray\(label && label\.v\) \? label\.v : \[\]/, 'click_handler_must_not_fallback_to_empty_payload');

    const uri = 'mxc://localhost/0312-repaired-importer';
    state.cacheUploadedMediaForTest(uri, {
      buffer: buildImportZipBuffer(),
      contentType: 'application/zip',
      filename: '0312-cache-contract.zip',
      userId: '@drop:localhost',
    });
    const uriUpdate = await state.submitEnvelope(slideImportMediaUriBusEvent(uri));
    assert.equal(uriUpdate.result, 'ok', 'uri_update_bus_event_must_succeed_after_repair');
    assert.equal(uriUpdate.routed_by, 'model0_busin', 'repaired_uri_update_must_route_by_model0_busin');

    const importClick = await state.submitEnvelope(slideImportClickBusEvent());
    assert.equal(importClick.result, 'ok', 'repaired_click_must_be_accepted');

    const snap = state.clientSnap();
    const importedStatus = snap.models?.['1031']?.cells?.['0,0,0']?.labels?.slide_import_status?.v;
    const registry = snap.models?.['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    assert.equal(importedStatus, 'imported: 0312 Cache Contract App', 'repaired_click_must_import_uploaded_app');
    assert.ok(registry.some((entry) => entry && entry.name === '0312 Cache Contract App'), 'repaired_click_must_materialize_workspace_entry');
    return { key: 'slide_importer_repairs_legacy_persisted_click_contract', status: 'PASS' };
  });
}

const tests = [
  test_slide_import_requires_cache_priming_before_import,
  test_slide_import_rejects_legacy_owner_update_and_malformed_click_payload,
  test_slide_importer_repairs_legacy_persisted_click_contract,
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
