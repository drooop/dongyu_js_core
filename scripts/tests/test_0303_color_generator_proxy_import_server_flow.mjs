#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import path, { join } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const SLIDE_IMPORTER_TRUTH_MODEL_ID = 1031;
const ZIP_PATH = path.join(repoRoot, 'test_files', 'color_generator_proxy_import.zip');

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
    { k: 'target', t: 'json', v: { model_id: SLIDE_IMPORTER_TRUTH_MODEL_ID, p: 0, r: 0, c: 0 } },
  ]);
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0303-color-proxy-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0303_color_proxy_${Date.now()}`;
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

async function test_proxy_zip_import_reuses_model100_behaviour_contract() {
  return withServerState(async (state) => {
    const uri = 'mxc://localhost/color-proxy-import';
    state.cacheUploadedMediaForTest(uri, {
      buffer: fs.readFileSync(ZIP_PATH),
      contentType: 'application/zip',
      filename: 'color-generator-proxy.zip',
      userId: '@drop:localhost',
    });

    const runtime = state.runtime;
    const importerTruth = runtime.getModel(SLIDE_IMPORTER_TRUTH_MODEL_ID);
    assert.ok(importerTruth, 'slide_importer_truth_model_missing');
    runtime.addLabel(importerTruth, 0, 0, 0, { k: 'slide_import_media_uri', t: 'str', v: uri });
    runtime.addLabel(importerTruth, 0, 0, 0, { k: 'slide_import_media_name', t: 'str', v: 'color-generator-proxy.zip' });

    const importResult = await state.submitEnvelope(pinEnvelope(
      { model_id: 1030, p: 2, r: 4, c: 0 },
      'click',
      slideImportClickPayload(),
    ));
    assert.equal(importResult.result, 'ok', 'slide_app_import_pin_must_be_accepted');
    await wait();

    const snapAfterImport = state.clientSnap();
    const registry = snapAfterImport.models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    const importedEntry = registry.find((entry) => entry && entry.name === 'Imported Color Generator');
    assert.ok(importedEntry, 'imported_color_proxy_app_missing_from_registry');
    assert.equal(importedEntry.slide_surface_type, 'workspace.page', 'imported_color_proxy_must_keep_workspace_page_surface');
    assert.equal(importedEntry.deletable, true, 'imported_color_proxy_must_be_deletable');

    const importedModelId = importedEntry.model_id;
    const importedModel = snapAfterImport.models[String(importedModelId)];
    assert.ok(importedModel, 'imported_color_proxy_model_missing');

    const colorBind = importedModel.cells?.['2,2,0']?.labels?.ui_bind_json?.v;
    assert.equal(colorBind?.read?.model_id, 100, 'imported_color_proxy_color_box_must_read_model100');
    assert.equal(colorBind?.read?.k, 'bg_color', 'imported_color_proxy_color_box_must_read_bg_color');

    const inputBind = importedModel.cells?.['2,6,0']?.labels?.ui_bind_json?.v;
    assert.equal(inputBind?.read?.model_id, -2, 'imported_color_proxy_input_must_read_overlay_state');
    assert.equal(inputBind?.write?.target_ref?.model_id, -2, 'imported_color_proxy_input_must_write_overlay_state');
    assert.equal(inputBind?.write?.target_ref?.k, 'model100_input_draft', 'imported_color_proxy_input_must_target_model100_input_draft');

    const submitBind = importedModel.cells?.['2,9,0']?.labels?.ui_bind_json?.v;
    assert.equal(submitBind?.write?.pin, 'click', 'imported_color_proxy_button_must_now_use_pin_write');

    const deleteResult = await state.submitEnvelope(pinEnvelope(
      { model_id: -25, p: 2, r: 7, c: 1 },
      'click',
      importedModelId,
    ));
    assert.equal(deleteResult.result, 'ok', 'proxy_imported_app_delete_pin_must_succeed');
    await wait();

    const snapAfterDelete = state.clientSnap();
    const registryAfterDelete = snapAfterDelete.models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    assert.ok(!registryAfterDelete.some((entry) => entry && entry.model_id === importedModelId), 'deleted_color_proxy_must_leave_registry');
    assert.equal(snapAfterDelete.models[String(importedModelId)], undefined, 'deleted_color_proxy_model_must_be_removed');
    return { key: 'proxy_zip_import_reuses_model100_behaviour_contract', status: 'PASS' };
  });
}

const tests = [
  test_proxy_zip_import_reuses_model100_behaviour_contract,
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
