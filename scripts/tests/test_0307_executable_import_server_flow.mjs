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

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

function buildExecutablePayload() {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.ExecutableImportedApp' },
    { id: 0, p: 0, r: 0, c: 0, k: 'app_name', t: 'str', v: 'Executable Import App' },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_worker', t: 'str', v: 'exec-import' },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_capable', t: 'bool', v: true },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_surface_type', t: 'str', v: 'workspace.page' },
    { id: 0, p: 0, r: 0, c: 0, k: 'from_user', t: 'str', v: '@test-user:localhost' },
    { id: 0, p: 0, r: 0, c: 0, k: 'to_user', t: 'str', v: '@drop:localhost' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_root_node_id', t: 'str', v: 'exec_root' },
    { id: 0, p: 0, r: 0, c: 0, k: 'status_text', t: 'str', v: 'idle' },
    { id: 0, p: 0, r: 0, c: 0, k: 'submit_request', t: 'pin.in', v: null },
    { id: 0, p: 0, r: 0, c: 0, k: 'submit_request_wiring', t: 'pin.connect.label', v: [{ from: '(self, submit_request)', to: ['(func, handle_submit:in)'] }] },
    { id: 0, p: 0, r: 0, c: 0, k: 'submit_owner_route', t: 'pin.connect.label', v: [{ from: '(func, handle_submit:out)', to: ['submit_owner_req'] }] },
    { id: 0, p: 0, r: 0, c: 0, k: 'root_routes', t: 'pin.connect.cell', v: [
      { from: [2, 2, 0, 'local_owner_req'], to: [[0, 1, 0, 'owner_apply']] },
      { from: [2, 3, 0, 'click_chain'], to: [[0, 0, 0, 'submit_request']] },
      { from: [0, 0, 0, 'submit_owner_req'], to: [[0, 1, 0, 'owner_apply']] },
    ] },
    { id: 0, p: 0, r: 0, c: 0, k: 'handle_submit', t: 'func.js', v: { code: "return [{ p: 0, r: 0, c: 0, k: 'status_text', t: 'str', v: 'chain_processed' }];" } },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_node_id', t: 'str', v: 'exec_root' },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_component', t: 'str', v: 'Container' },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_layout', t: 'str', v: 'column' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_node_id', t: 'str', v: 'exec_status' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_component', t: 'str', v: 'Text' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_parent', t: 'str', v: 'exec_root' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_bind_json', t: 'json', v: { read: { model_id: 0, p: 0, r: 0, c: 0, k: 'status_text' } } },
    { id: 0, p: 2, r: 2, c: 0, k: 'ui_node_id', t: 'str', v: 'exec_local_button' },
    { id: 0, p: 2, r: 2, c: 0, k: 'ui_component', t: 'str', v: 'Button' },
    { id: 0, p: 2, r: 2, c: 0, k: 'ui_parent', t: 'str', v: 'exec_root' },
    { id: 0, p: 2, r: 2, c: 0, k: 'ui_label', t: 'str', v: 'Run Local Logic' },
    { id: 0, p: 2, r: 2, c: 0, k: 'ui_bind_json', t: 'json', v: { write: { pin: 'click_local', value_ref: { t: 'event', v: { trigger: 'local' } } } } },
    { id: 0, p: 2, r: 2, c: 0, k: 'click_local', t: 'pin.in', v: null },
    { id: 0, p: 2, r: 2, c: 0, k: 'click_local_route', t: 'pin.connect.label', v: [{ from: '(self, click_local)', to: ['(func, handle_local:in)'] }] },
    { id: 0, p: 2, r: 2, c: 0, k: 'click_local_owner', t: 'pin.connect.label', v: [{ from: '(func, handle_local:out)', to: ['local_owner_req'] }] },
    { id: 0, p: 2, r: 2, c: 0, k: 'handle_local', t: 'func.js', v: { code: "return [{ p: 0, r: 0, c: 0, k: 'status_text', t: 'str', v: 'local_processed' }];" } },
    { id: 0, p: 2, r: 3, c: 0, k: 'ui_node_id', t: 'str', v: 'exec_chain_button' },
    { id: 0, p: 2, r: 3, c: 0, k: 'ui_component', t: 'str', v: 'Button' },
    { id: 0, p: 2, r: 3, c: 0, k: 'ui_parent', t: 'str', v: 'exec_root' },
    { id: 0, p: 2, r: 3, c: 0, k: 'ui_label', t: 'str', v: 'Run Request Chain' },
    { id: 0, p: 2, r: 3, c: 0, k: 'ui_bind_json', t: 'json', v: { write: { pin: 'click_chain', value_ref: { t: 'event', v: { trigger: 'chain' } } } } },
    { id: 0, p: 2, r: 3, c: 0, k: 'click_chain', t: 'pin.in', v: null },
  ];
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0307-flow-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0307_flow_${Date.now()}`;
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

async function test_executable_import_runs_local_and_chain_paths() {
  return withServerState(async (state) => {
    state.cacheUploadedMediaForTest('mxc://localhost/0307-exec', {
      buffer: buildZipBuffer(buildExecutablePayload()),
      contentType: 'application/zip',
      filename: '0307-executable.zip',
      userId: '@drop:localhost',
    });
    state.runtime.addLabel(state.runtime.getModel(1031), 0, 0, 0, { k: 'slide_import_media_uri', t: 'str', v: 'mxc://localhost/0307-exec' });
    const importResult = await state.submitEnvelope(pinEnvelope(
      { model_id: 1030, p: 2, r: 4, c: 0 },
      'click',
      { click: true },
    ));
    assert.equal(importResult.result, 'ok', 'executable_import_pin_must_be_accepted');
    await wait();

    const registry = state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    const importedEntry = registry.find((entry) => entry && entry.name === 'Executable Import App');
    assert.ok(importedEntry, 'executable_import_app_missing_from_registry');
    const importedModelId = importedEntry.model_id;

    const localResult = await state.submitEnvelope(pinEnvelope(
      { model_id: importedModelId, p: 2, r: 2, c: 0 },
      'click_local',
      { trigger: 'local' },
    ));
    assert.equal(localResult.result, 'ok', 'local_button_pin_must_be_accepted');
    await wait();
    let labels = state.clientSnap().models[String(importedModelId)]?.cells?.['0,0,0']?.labels || {};
    assert.equal(labels.status_text?.v, 'local_processed', 'imported_local_func_js_must_update_status_text');

    const chainResult = await state.submitEnvelope(pinEnvelope(
      { model_id: importedModelId, p: 2, r: 3, c: 0 },
      'click_chain',
      { trigger: 'chain' },
    ));
    assert.equal(chainResult.result, 'ok', 'chain_button_pin_must_be_accepted');
    await wait();
    labels = state.clientSnap().models[String(importedModelId)]?.cells?.['0,0,0']?.labels || {};
    assert.equal(labels.status_text?.v, 'chain_processed', 'imported_chain_path_must_update_status_text');

    return { key: 'executable_import_runs_local_and_chain_paths', status: 'PASS' };
  });
}

const tests = [
  test_executable_import_runs_local_and_chain_paths,
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
