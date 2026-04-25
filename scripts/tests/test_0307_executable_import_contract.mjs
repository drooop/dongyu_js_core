#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;

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

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

function buildExecutablePayload(extraRecords = []) {
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
    { id: 0, p: 0, r: 0, c: 0, k: 'root_routes', t: 'pin.connect.cell', v: [
      { from: [0, 0, 0, 'write_label_req'], to: [[0, 0, 0, 'mt_write_req']] },
      { from: [2, 2, 0, 'write_label_req'], to: [[0, 0, 0, 'mt_write_req']] },
      { from: [2, 3, 0, 'write_label_req'], to: [[0, 0, 0, 'mt_write_req']] },
    ] },
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
    { id: 0, p: 2, r: 2, c: 0, k: 'ui_bind_json', t: 'json', v: { write: { pin: 'click_local', value_ref: uiEventPayload([{ k: 'trigger', t: 'str', v: 'local' }]), value_t: 'modeltable' } } },
    { id: 0, p: 2, r: 2, c: 0, k: 'click_local', t: 'pin.in', v: null },
    { id: 0, p: 2, r: 2, c: 0, k: 'click_local_route', t: 'pin.connect.label', v: [{ from: '(self, click_local)', to: ['(func, handle_local:in)'] }] },
    { id: 0, p: 2, r: 2, c: 0, k: 'handle_local', t: 'func.js', v: { code: "V1N.writeLabel(0, 0, 0, { k: 'status_text', t: 'str', v: 'local_processed' });" } },
    { id: 0, p: 2, r: 3, c: 0, k: 'ui_node_id', t: 'str', v: 'exec_chain_button' },
    { id: 0, p: 2, r: 3, c: 0, k: 'ui_component', t: 'str', v: 'Button' },
    { id: 0, p: 2, r: 3, c: 0, k: 'ui_parent', t: 'str', v: 'exec_root' },
    { id: 0, p: 2, r: 3, c: 0, k: 'ui_label', t: 'str', v: 'Run Request Chain' },
    { id: 0, p: 2, r: 3, c: 0, k: 'ui_bind_json', t: 'json', v: { write: { pin: 'click_chain', value_ref: uiEventPayload([{ k: 'trigger', t: 'str', v: 'chain' }]), value_t: 'modeltable' } } },
    { id: 0, p: 2, r: 3, c: 0, k: 'click_chain', t: 'pin.in', v: null },
    { id: 0, p: 2, r: 3, c: 0, k: 'click_chain_route', t: 'pin.connect.label', v: [{ from: '(self, click_chain)', to: ['(func, handle_chain:in)'] }] },
    { id: 0, p: 2, r: 3, c: 0, k: 'handle_chain', t: 'func.js', v: { code: "V1N.writeLabel(0, 0, 0, { k: 'status_text', t: 'str', v: 'chain_processed' });" } },
    ...extraRecords,
  ];
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0307-contract-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0307_contract_${Date.now()}`;
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

async function test_executable_import_allows_func_js_within_positive_models() {
  return withServerState(async (state) => {
    state.cacheUploadedMediaForTest('mxc://localhost/0307-contract-pass', {
      buffer: buildZipBuffer(buildExecutablePayload()),
      contentType: 'application/zip',
      filename: '0307-executable.zip',
      userId: '@drop:localhost',
    });
    state.runtime.addLabel(state.runtime.getModel(1031), 0, 0, 0, { k: 'slide_import_media_uri', t: 'str', v: 'mxc://localhost/0307-contract-pass' });
    const result = await state.submitEnvelope(pinEnvelope(
      { model_id: 1030, p: 2, r: 4, c: 0 },
      'click',
      slideImportClickPayload(),
    ));
    assert.equal(result.result, 'ok', 'executable_import_pin_request_must_be_accepted');
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
    const registry = state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    assert.ok(
      registry.some((entry) => entry && entry.name === 'Executable Import App'),
      'executable_import_with_func_js_must_materialize_workspace_entry',
    );
    return { key: 'executable_import_allows_func_js_within_positive_models', status: 'PASS' };
  });
}

async function test_executable_import_rejects_helper_override_and_system_boundary_types() {
  return withServerState(async (state) => {
    const payload = buildExecutablePayload([
      { id: 0, p: 0, r: 1, c: 0, k: 'scope_privileged', t: 'bool', v: true },
    ]);
    state.cacheUploadedMediaForTest('mxc://localhost/0307-contract-fail', {
      buffer: buildZipBuffer(payload),
      contentType: 'application/zip',
      filename: '0307-executable-forbidden.zip',
      userId: '@drop:localhost',
    });
    state.runtime.addLabel(state.runtime.getModel(1031), 0, 0, 0, { k: 'slide_import_media_uri', t: 'str', v: 'mxc://localhost/0307-contract-fail' });
    const result = await state.submitEnvelope(pinEnvelope(
      { model_id: 1030, p: 2, r: 4, c: 0 },
      'click',
      slideImportClickPayload(),
    ));
    assert.equal(result.result, 'ok', 'forbidden_executable_import_pin_request_still_enters_runtime_ingress');
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
    const statusText = state.clientSnap().models?.['1031']?.cells?.['0,0,0']?.labels?.slide_import_status?.v || '';
    assert.match(String(statusText), /forbidden_label_key:scope_privileged/, 'helper_override_rejection_reason_must_be_explicit');
    return { key: 'executable_import_rejects_helper_override_and_system_boundary_types', status: 'PASS' };
  });
}

const tests = [
  test_executable_import_allows_func_js_within_positive_models,
  test_executable_import_rejects_helper_override_and_system_boundary_types,
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
