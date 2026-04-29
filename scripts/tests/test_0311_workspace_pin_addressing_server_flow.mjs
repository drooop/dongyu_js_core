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

function wsAddNamePayload(name) {
  return workspacePinPayload('ws_add_name.v1', [
    { k: 'name', t: 'str', v: name },
  ]);
}

function wsAddPayload() {
  return workspacePinPayload('ws_add_app.v1');
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
    meta: { op_id: `slide_import_click_${Date.now()}`, source: 'test_0311_workspace' },
  };
}

function slideCreateClickPayload() {
  return uiEventPayload([
    { k: 'target', t: 'json', v: { model_id: 1035, p: 0, r: 0, c: 0 } },
  ]);
}

function buildImportZipBuffer() {
  const payload = [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.SlideZipImportedApp' },
    { id: 0, p: 0, r: 0, c: 0, k: 'app_name', t: 'str', v: '0311 Pin Imported App' },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_worker', t: 'str', v: 'zip-import' },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_capable', t: 'bool', v: true },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_surface_type', t: 'str', v: 'workspace.page' },
    { id: 0, p: 0, r: 0, c: 0, k: 'from_user', t: 'str', v: '@test-user:localhost' },
    { id: 0, p: 0, r: 0, c: 0, k: 'to_user', t: 'str', v: '@drop:localhost' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_root_node_id', t: 'str', v: 'zip_root' },
    { id: 1, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.SlideZipImportedTruth' },
    { id: 0, p: 0, r: 2, c: 0, k: 'model_type', t: 'model.submt', v: 1 },
    { id: 1, p: 0, r: 0, c: 0, k: 'headline', t: 'str', v: '0311 imported headline' },
  ];
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0311-workspace-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0311_workspace_${Date.now()}`;
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

async function test_workspace_pin_addressing_handles_add_import_create_select_delete() {
  return withServerState(async (state) => {
    const runtime = state.runtime;

    const addNameResult = await state.submitEnvelope(pinEnvelope(
      { model_id: -25, p: 2, r: 10, c: 0 },
      'change',
      wsAddNamePayload('0311 Pin Added App'),
    ));
    assert.equal(addNameResult.result, 'ok', 'ws_add_input_pin_must_be_accepted');
    const addResult = await state.submitEnvelope(pinEnvelope(
      { model_id: -25, p: 2, r: 11, c: 0 },
      'click',
      wsAddPayload(),
    ));
    assert.equal(addResult.result, 'ok', 'ws_app_add_pin_must_be_accepted');
    await wait();

    const registryAfterAdd = state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    const addedEntry = registryAfterAdd.find((entry) => entry && entry.name === '0311 Pin Added App');
    assert.ok(addedEntry, 'ws_app_add_pin_must_materialize_registry_entry');

    runtime.addLabel(runtime.getModel(1035), 0, 0, 0, { k: 'create_app_name', t: 'str', v: '0311 Pin Created App' });
    runtime.addLabel(runtime.getModel(1035), 0, 0, 0, { k: 'create_source_worker', t: 'str', v: 'filltable-create' });
    runtime.addLabel(runtime.getModel(1035), 0, 0, 0, { k: 'create_slide_surface_type', t: 'str', v: 'workspace.page' });
    runtime.addLabel(runtime.getModel(1035), 0, 0, 0, { k: 'create_headline', t: 'str', v: '0311 headline' });
    runtime.addLabel(runtime.getModel(1035), 0, 0, 0, { k: 'create_body_text', t: 'str', v: '0311 body' });
    const createResult = await state.submitEnvelope(pinEnvelope(
      { model_id: 1034, p: 2, r: 8, c: 0 },
      'click',
      slideCreateClickPayload(),
    ));
    assert.equal(createResult.result, 'ok', 'slide_app_create_pin_must_be_accepted');
    await wait();

    state.cacheUploadedMediaForTest('mxc://localhost/0311-pin-import', {
      buffer: buildImportZipBuffer(),
      contentType: 'application/zip',
      filename: '0311-pin-import.zip',
      userId: '@drop:localhost',
    });
    runtime.addLabel(runtime.getModel(1031), 0, 0, 0, { k: 'slide_import_media_uri', t: 'str', v: 'mxc://localhost/0311-pin-import' });
    const importResult = await state.submitEnvelope(slideImportClickBusEvent());
    assert.equal(importResult.result, 'ok', 'slide_app_import_bus_event_must_be_accepted');
    assert.equal(importResult.routed_by, 'model0_busin', 'slide_app_import_must_route_by_model0_busin');
    await wait();

    const registryAfterImport = state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    const importedEntry = registryAfterImport.find((entry) => entry && entry.name === '0311 Pin Imported App');
    assert.ok(importedEntry, 'slide_app_import_bus_event_must_materialize_imported_entry');

    const selectResult = await state.submitEnvelope(pinEnvelope(
      { model_id: -25, p: 2, r: 7, c: 0 },
      'click',
      wsSelectPayload(importedEntry.model_id),
    ));
    assert.equal(selectResult.result, 'ok', 'ws_select_pin_must_be_accepted');
    await wait();
    assert.equal(
      state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_app_selected?.v,
      importedEntry.model_id,
      'ws_select_pin_must_update_selection',
    );

    const deleteResult = await state.submitEnvelope(pinEnvelope(
      { model_id: -25, p: 2, r: 7, c: 1 },
      'click',
      wsDeletePayload(importedEntry.model_id),
    ));
    assert.equal(deleteResult.result, 'ok', 'ws_delete_pin_must_be_accepted');
    await wait();

    const registryAfterDelete = state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    assert.ok(!registryAfterDelete.some((entry) => entry && entry.model_id === importedEntry.model_id), 'ws_delete_pin_must_remove_imported_entry');

    const events = runtime.eventLog.list();
    assert.ok(
      events.some((event) => event.op === 'add_label' && event.cell?.model_id === 1030 && event.cell?.p === 2 && event.cell?.r === 4 && event.cell?.c === 0 && event.label?.k === 'click' && event.label?.t === 'pin.in'),
      'slide_import_button_must_receive_click_pin',
    );
    assert.ok(
      events.some((event) => event.op === 'add_label' && event.cell?.model_id === 1034 && event.cell?.p === 2 && event.cell?.r === 8 && event.cell?.c === 0 && event.label?.k === 'click' && event.label?.t === 'pin.in'),
      'slide_creator_button_must_receive_click_pin',
    );
    assert.ok(
      events.some((event) => event.op === 'add_label' && event.cell?.model_id === -25 && event.cell?.p === 2 && event.cell?.r === 7 && event.cell?.c === 0 && event.label?.k === 'click' && event.label?.t === 'pin.in'),
      'workspace_select_button_must_receive_click_pin',
    );
    assert.ok(
      events.some((event) => event.op === 'add_label' && event.cell?.model_id === -25 && event.cell?.p === 2 && event.cell?.r === 7 && event.cell?.c === 1 && event.label?.k === 'click' && event.label?.t === 'pin.in'),
      'workspace_delete_button_must_receive_click_pin',
    );

    return { key: 'workspace_pin_addressing_handles_add_import_create_select_delete', status: 'PASS' };
  });
}

const tests = [
  test_workspace_pin_addressing_handles_add_import_create_select_delete,
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
