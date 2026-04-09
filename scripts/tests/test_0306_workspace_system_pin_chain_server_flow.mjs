#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;
const SLIDE_IMPORTER_TRUTH_MODEL_ID = 1031;
const SLIDE_CREATOR_TRUTH_MODEL_ID = 1035;

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

function buildImportZipBuffer() {
  const payload = [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.SlideZipImportedApp' },
    { id: 0, p: 0, r: 0, c: 0, k: 'app_name', t: 'str', v: '0306 Imported Zip App' },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_worker', t: 'str', v: 'zip-import' },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_capable', t: 'bool', v: true },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_surface_type', t: 'str', v: 'workspace.page' },
    { id: 0, p: 0, r: 0, c: 0, k: 'from_user', t: 'str', v: '@test-user:localhost' },
    { id: 0, p: 0, r: 0, c: 0, k: 'to_user', t: 'str', v: '@drop:localhost' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_root_node_id', t: 'str', v: 'zip_root' },
    { id: 1, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.SlideZipImportedTruth' },
    { id: 0, p: 0, r: 2, c: 0, k: 'model_type', t: 'model.submt', v: 1 },
    { id: 1, p: 0, r: 0, c: 0, k: 'headline', t: 'str', v: 'Imported by runtime pin chain' },
  ];
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0306-system-flow-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0306_system_flow_${Date.now()}`;
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

async function test_workspace_system_actions_use_runtime_pin_chain() {
  return withServerState(async (state) => {
    const runtime = state.runtime;
    const interceptsBefore = runtime.intercepts.list().length;

    runtime.addLabel(runtime.getModel(-2), 0, 0, 0, { k: 'ws_new_app_name', t: 'str', v: '0306 Runtime Add App' });
    const addResult = await state.submitEnvelope(mailboxEnvelope('ws_app_add'));
    assert.equal(addResult.result, 'ok', 'ws_app_add_must_be_accepted');
    await wait();

    const addedRegistry = state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    const addedEntry = addedRegistry.find((entry) => entry && entry.name === '0306 Runtime Add App');
    assert.ok(addedEntry, 'ws_app_add_must_materialize_registry_entry');

    const creatorTruth = runtime.getModel(SLIDE_CREATOR_TRUTH_MODEL_ID);
    runtime.addLabel(creatorTruth, 0, 0, 0, { k: 'create_app_name', t: 'str', v: '0306 Runtime Created App' });
    runtime.addLabel(creatorTruth, 0, 0, 0, { k: 'create_source_worker', t: 'str', v: 'filltable-create' });
    runtime.addLabel(creatorTruth, 0, 0, 0, { k: 'create_slide_surface_type', t: 'str', v: 'workspace.page' });
    runtime.addLabel(creatorTruth, 0, 0, 0, { k: 'create_headline', t: 'str', v: 'Created by pin chain' });
    runtime.addLabel(creatorTruth, 0, 0, 0, { k: 'create_body_text', t: 'str', v: '0306 body' });

    const createResult = await state.submitEnvelope(mailboxEnvelope('slide_app_create', {
      target: { model_id: SLIDE_CREATOR_TRUTH_MODEL_ID, p: 0, r: 0, c: 0, k: 'create_app_name' },
    }));
    assert.equal(createResult.result, 'ok', 'slide_app_create_must_be_accepted');
    await wait();

    state.cacheUploadedMediaForTest('mxc://localhost/0306-slide-import', {
      buffer: buildImportZipBuffer(),
      contentType: 'application/zip',
      filename: '0306-slide-import.zip',
      userId: '@drop:localhost',
    });
    const importerTruth = runtime.getModel(SLIDE_IMPORTER_TRUTH_MODEL_ID);
    runtime.addLabel(importerTruth, 0, 0, 0, { k: 'slide_import_media_uri', t: 'str', v: 'mxc://localhost/0306-slide-import' });

    const importResult = await state.submitEnvelope(mailboxEnvelope('slide_app_import', {
      target: { model_id: SLIDE_IMPORTER_TRUTH_MODEL_ID, p: 0, r: 0, c: 0, k: 'slide_import_media_uri' },
    }));
    assert.equal(importResult.result, 'ok', 'slide_app_import_must_be_accepted');
    await wait();

    const registryAfterImport = state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    const importedEntry = registryAfterImport.find((entry) => entry && entry.name === '0306 Imported Zip App');
    assert.ok(importedEntry, 'slide_app_import_must_materialize_registry_entry');

    const selectResult = await state.submitEnvelope(mailboxEnvelope('ws_app_select', {
      value: { t: 'int', v: importedEntry.model_id },
    }));
    assert.equal(selectResult.result, 'ok', 'ws_app_select_must_be_accepted');
    await wait();
    assert.equal(
      state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_app_selected?.v,
      importedEntry.model_id,
      'ws_app_select_must_update_workspace_selection',
    );

    const deleteResult = await state.submitEnvelope(mailboxEnvelope('ws_app_delete', {
      value: { t: 'int', v: importedEntry.model_id },
    }));
    assert.equal(deleteResult.result, 'ok', 'ws_app_delete_must_be_accepted');
    await wait();

    const events = runtime.eventLog.list();
    for (const labelKey of [
      'ui_event_ws_app_add',
      'ui_event_slide_app_create',
      'ui_event_slide_app_import',
      'ui_event_ws_app_select',
      'ui_event_ws_app_delete',
    ]) {
      assert.ok(
        events.some((event) => event.op === 'add_label' && event.cell?.model_id === 0 && event.cell?.p === 0 && event.cell?.r === 0 && event.cell?.c === 0 && event.label?.k === labelKey && event.label?.t === 'pin.bus.in'),
        `${labelKey}_must_be_written_to_model0_ingress`,
      );
    }
    for (const pinKey of [
      'ws_app_add_request',
      'slide_app_create_request',
      'slide_app_import_request',
      'ws_select_app_request',
      'ws_app_delete_request',
    ]) {
      assert.ok(
        events.some((event) => event.op === 'add_label' && event.cell?.model_id === -10 && event.cell?.p === 0 && event.cell?.r === 0 && event.cell?.c === 0 && event.label?.k === pinKey && event.label?.t === 'pin.in'),
        `${pinKey}_must_be_routed_into_negative_handler_pin`,
      );
    }

    const newIntercepts = runtime.intercepts.list().slice(interceptsBefore);
    const oldDirectFuncs = newIntercepts.filter((item) => item.type === 'run_func' && [
      'handle_ws_app_add',
      'handle_slide_app_create',
      'handle_slide_app_import',
      'handle_ws_select_app',
      'handle_ws_app_delete',
    ].includes(item.payload?.func));
    assert.equal(oldDirectFuncs.length, 0, 'migrated_workspace_actions_must_not_use_direct_run_func_dispatch');

    return { key: 'workspace_system_actions_use_runtime_pin_chain', status: 'PASS' };
  });
}

const tests = [
  test_workspace_system_actions_use_runtime_pin_chain,
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
