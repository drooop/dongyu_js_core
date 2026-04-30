#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}` },
  };
  if (options.value !== undefined) payload.value = options.value;
  if (options.target !== undefined) payload.target = options.target;
  return {
    event_id: Date.now(),
    type: action,
    payload,
    source: 'ui_renderer',
    ts: Date.now(),
  };
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

function workspacePinPayload(kind, labels = []) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: kind },
    ...labels.map((label) => ({ id: 0, p: 0, r: 0, c: 0, ...label })),
  ];
}

function wsSelectPayload(modelId) {
  return workspacePinPayload('ws_select_app.v1', [
    { k: 'model_id', t: 'int', v: modelId },
  ]);
}

function wsDeletePayload(modelId) {
  return workspacePinPayload('ws_delete_app.v1', [
    { k: 'model_id', t: 'int', v: modelId },
  ]);
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
    meta: { op_id: `slide_import_click_${Date.now()}`, source: 'test_0289' },
  };
}

function buildImportZipBuffer() {
  const payload = [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.SlideZipImportedApp' },
    { id: 0, p: 0, r: 0, c: 0, k: 'app_name', t: 'str', v: 'Imported Zip App' },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_worker', t: 'str', v: 'zip-import' },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_capable', t: 'bool', v: true },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_surface_type', t: 'str', v: 'workspace.page' },
    { id: 0, p: 0, r: 0, c: 0, k: 'from_user', t: 'str', v: '@test-user:localhost' },
    { id: 0, p: 0, r: 0, c: 0, k: 'to_user', t: 'str', v: '@drop:localhost' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_root_node_id', t: 'str', v: 'zip_root' },
    { id: 1, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.SlideZipImportedTruth' },
    { id: 0, p: 0, r: 2, c: 0, k: 'model_type', t: 'model.submt', v: 1 },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_node_id', t: 'str', v: 'zip_root' },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_component', t: 'str', v: 'Container' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_node_id', t: 'str', v: 'zip_title' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_component', t: 'str', v: 'Text' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_parent', t: 'str', v: 'zip_root' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_bind_json', t: 'json', v: { read: { model_id: 1, p: 0, r: 0, c: 0, k: 'headline' } } },
    { id: 1, p: 0, r: 0, c: 0, k: 'headline', t: 'str', v: 'Imported Zip Headline' },
  ];
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0289-slide-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0289_slide_${Date.now()}`;
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

async function test_builtin_and_imported_apps_share_workspace_contract() {
  return withServerState(async (state) => {
    const beforeRegistry = state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    const model100Entry = beforeRegistry.find((entry) => entry && entry.model_id === 100);
    assert.ok(model100Entry, 'model100_must_exist_in_registry');
    assert.equal(model100Entry.slide_capable, true, 'model100_must_be_slide_capable');
    assert.equal(typeof model100Entry.slide_surface_type, 'string', 'model100_must_expose_slide_surface_type');
    assert.equal(model100Entry.delete_disabled, true, 'built_in_slide_apps_must_not_be_deletable');

    state.cacheUploadedMediaForTest('mxc://localhost/test-slide-import', {
      buffer: buildImportZipBuffer(),
      contentType: 'application/zip',
      filename: 'slide-import.zip',
      userId: '@drop:localhost',
    });
    const importerTruth = state.runtime.getModel(1031);
    state.runtime.addLabel(importerTruth, 0, 0, 0, { k: 'slide_import_media_uri', t: 'str', v: 'mxc://localhost/test-slide-import' });

    const importResult = await state.submitEnvelope(slideImportClickBusEvent());
    assert.equal(importResult.result, 'ok', 'slide_app_import_bus_event_must_succeed');
    assert.equal(importResult.routed_by, 'model0_busin', 'slide_app_import_must_route_by_model0_busin');
    await wait();

    const afterImportRegistry = state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    const importedEntry = afterImportRegistry.find((entry) => entry && entry.name === 'Imported Zip App');
    assert.ok(importedEntry, 'imported_zip_app_must_appear_in_registry');
    assert.equal(importedEntry.slide_capable, true, 'imported_zip_app_must_be_slide_capable');
    assert.equal(importedEntry.slide_surface_type, 'workspace.page', 'imported_zip_app_must_publish_surface_type');
    assert.equal(importedEntry.delete_disabled, false, 'imported_zip_app_must_be_deletable');
    assert.equal(importedEntry.from_user, '@test-user:localhost', 'imported_zip_app_must_publish_from_user');
    assert.equal(importedEntry.to_user, '@drop:localhost', 'imported_zip_app_must_publish_to_user');

    const selectImported = await state.submitEnvelope(pinEnvelope(
      { model_id: -25, p: 2, r: 7, c: 0 },
      'click',
      wsSelectPayload(importedEntry.model_id),
    ));
    assert.equal(selectImported.result, 'ok', 'ws_app_select_imported_pin_must_succeed');
    await wait();
    assert.equal(
      state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_app_selected?.v,
      importedEntry.model_id,
      'workspace_selection_must_accept_imported_app',
    );

    const selectBuiltin = await state.submitEnvelope(pinEnvelope(
      { model_id: -25, p: 2, r: 7, c: 0 },
      'click',
      wsSelectPayload(100),
    ));
    assert.equal(selectBuiltin.result, 'ok', 'ws_app_select_builtin_pin_must_succeed');
    await wait();
    assert.equal(
      state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_app_selected?.v,
      100,
      'workspace_selection_must_accept_builtin_slide_app',
    );

    const deleteImported = await state.submitEnvelope(pinEnvelope(
      { model_id: -25, p: 2, r: 7, c: 1 },
      'click',
      wsDeletePayload(importedEntry.model_id),
    ));
    assert.equal(deleteImported.result, 'ok', 'delete_imported_slide_app_pin_must_succeed');
    await wait();
    const afterDeleteRegistry = state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    assert.ok(!afterDeleteRegistry.some((entry) => entry && entry.model_id === importedEntry.model_id), 'deleted_imported_app_must_leave_registry');

    return { key: 'builtin_and_imported_apps_share_workspace_contract', status: 'PASS' };
  });
}

const tests = [
  test_builtin_and_imported_apps_share_workspace_contract,
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
