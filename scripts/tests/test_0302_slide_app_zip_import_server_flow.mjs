#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;

const SLIDE_IMPORTER_TRUTH_MODEL_ID = 1031;

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}` },
  };
  if (Number.isInteger(options.modelId)) payload.meta.model_id = options.modelId;
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
    { id: 0, p: 0, r: 2, c: 0, k: 'model_type', t: 'model.submt', v: 1 },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_node_id', t: 'str', v: 'zip_root' },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_component', t: 'str', v: 'Container' },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_layout', t: 'str', v: 'column' },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_gap', t: 'int', v: 12 },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_node_id', t: 'str', v: 'zip_title' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_component', t: 'str', v: 'Text' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_parent', t: 'str', v: 'zip_root' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_bind_json', t: 'json', v: { read: { model_id: 1, p: 0, r: 0, c: 0, k: 'headline' } } },
    { id: 0, p: 2, r: 2, c: 0, k: 'ui_node_id', t: 'str', v: 'zip_input' },
    { id: 0, p: 2, r: 2, c: 0, k: 'ui_component', t: 'str', v: 'Input' },
    { id: 0, p: 2, r: 2, c: 0, k: 'ui_parent', t: 'str', v: 'zip_root' },
    { id: 0, p: 2, r: 2, c: 0, k: 'ui_bind_json', t: 'json', v: {
      read: { model_id: 1, p: 0, r: 0, c: 0, k: 'input_value' },
      write: {
        action: 'ui_owner_label_update',
        target_ref: { model_id: 1, p: 0, r: 0, c: 0, k: 'input_value' },
      },
    } },
    { id: 1, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.SlideZipImportedTruth' },
    { id: 1, p: 0, r: 0, c: 0, k: 'headline', t: 'str', v: 'Imported Zip Headline' },
    { id: 1, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'Editable from imported app' },
  ];

  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0302-zip-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0302_zip_${Date.now()}`;
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

async function test_zip_import_materializes_workspace_app_and_delete_cleans_up() {
  return withServerState(async (state) => {
    assert.equal(typeof state.cacheUploadedMediaForTest, 'function', 'server_state_missing_cacheUploadedMediaForTest');

    const uri = 'mxc://localhost/test-slide-import';
    state.cacheUploadedMediaForTest(uri, {
      buffer: buildImportZipBuffer(),
      contentType: 'application/zip',
      filename: 'slide-import.zip',
      userId: '@drop:localhost',
    });

    const runtime = state.runtime;
    const importerTruth = runtime.getModel(SLIDE_IMPORTER_TRUTH_MODEL_ID);
    assert.ok(importerTruth, 'slide_importer_truth_model_missing');
    runtime.addLabel(importerTruth, 0, 0, 0, { k: 'slide_import_media_uri', t: 'str', v: uri });
    runtime.addLabel(importerTruth, 0, 0, 0, { k: 'slide_import_media_name', t: 'str', v: 'slide-import.zip' });

    const importResult = await state.submitEnvelope(mailboxEnvelope('slide_app_import', {
      target: { model_id: SLIDE_IMPORTER_TRUTH_MODEL_ID, p: 0, r: 0, c: 0, k: 'slide_import_media_uri' },
    }));
    assert.equal(importResult.result, 'ok', 'slide_app_import_must_be_accepted');
    await wait();

    const snapAfterImport = state.clientSnap();
    const registry = snapAfterImport.models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v;
    assert.ok(Array.isArray(registry), 'workspace_registry_missing_after_import');
    const importedEntry = registry.find((entry) => entry && entry.name === 'Imported Zip App');
    assert.ok(importedEntry, 'imported_app_missing_from_workspace_registry');
    assert.equal(importedEntry.deletable, true, 'imported_app_must_be_deletable');
    assert.equal(importedEntry.slide_capable, true, 'imported_app_must_be_slide_capable');
    assert.equal(importedEntry.slide_surface_type, 'workspace.page', 'imported_app_must_keep_slide_surface_type');

    const importedModelId = importedEntry.model_id;
    assert.ok(Number.isInteger(importedModelId) && importedModelId > SLIDE_IMPORTER_TRUTH_MODEL_ID, 'imported_app_id_must_be_new_positive_model');
    const importedTruthId = importedModelId + 1;

    const importedRoot = snapAfterImport.models[String(importedModelId)]?.cells?.['0,0,0']?.labels || {};
    assert.equal(importedRoot.app_name?.v, 'Imported Zip App', 'imported_root_must_materialize_app_name');
    assert.equal(importedRoot.from_user?.v, '@test-user:localhost', 'imported_root_must_materialize_from_user');
    assert.equal(importedRoot.to_user?.v, '@drop:localhost', 'imported_root_must_materialize_to_user');
    assert.equal(importedRoot.slide_capable?.v, true, 'imported_root_must_materialize_slide_capable');

    const importedHostNode = snapAfterImport.models[String(importedModelId)]?.cells?.['2,2,0']?.labels?.ui_bind_json?.v;
    assert.equal(importedHostNode?.read?.model_id, importedTruthId, 'imported_bind_model_id_must_be_remapped');
    assert.equal(importedHostNode?.write?.target_ref?.model_id, importedTruthId, 'imported_write_target_model_id_must_be_remapped');

    const importedTruth = snapAfterImport.models[String(importedTruthId)]?.cells?.['0,0,0']?.labels || {};
    assert.equal(importedTruth.headline?.v, 'Imported Zip Headline', 'imported_truth_headline_missing');

    const deleteResult = await state.submitEnvelope(mailboxEnvelope('ws_app_delete', {
      value: { t: 'int', v: importedModelId },
    }));
    assert.equal(deleteResult.result, 'ok', 'ws_app_delete_must_be_accepted');
    await wait();

    const snapAfterDelete = state.clientSnap();
    const registryAfterDelete = snapAfterDelete.models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    assert.ok(!registryAfterDelete.some((entry) => entry && entry.model_id === importedModelId), 'deleted_app_must_leave_workspace_registry');
    assert.equal(snapAfterDelete.models[String(importedModelId)], undefined, 'deleted_root_model_must_be_removed');
    assert.equal(snapAfterDelete.models[String(importedTruthId)], undefined, 'deleted_truth_model_must_be_removed');
    return { key: 'zip_import_materializes_workspace_app_and_delete_cleans_up', status: 'PASS' };
  });
}

const tests = [
  test_zip_import_materializes_workspace_app_and_delete_cleans_up,
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
