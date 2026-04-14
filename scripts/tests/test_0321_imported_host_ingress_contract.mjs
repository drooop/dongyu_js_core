#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

function basePayload(extraRootLabels = [], extraRecords = []) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.HostIngressImportedApp' },
    { id: 0, p: 0, r: 0, c: 0, k: 'app_name', t: 'str', v: 'Host Ingress Imported App' },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_worker', t: 'str', v: 'host-ingress-import' },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_capable', t: 'bool', v: true },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_surface_type', t: 'str', v: 'workspace.page' },
    { id: 0, p: 0, r: 0, c: 0, k: 'from_user', t: 'str', v: '@host:test' },
    { id: 0, p: 0, r: 0, c: 0, k: 'to_user', t: 'str', v: '@drop:test' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_root_node_id', t: 'str', v: 'host_ingress_root' },
    { id: 0, p: 0, r: 0, c: 0, k: 'status_text', t: 'str', v: 'idle' },
    ...extraRootLabels,
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_node_id', t: 'str', v: 'host_ingress_root' },
    { id: 0, p: 2, r: 0, c: 0, k: 'ui_component', t: 'str', v: 'Container' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_node_id', t: 'str', v: 'status_text' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_component', t: 'str', v: 'Text' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_parent', t: 'str', v: 'host_ingress_root' },
    { id: 0, p: 2, r: 1, c: 0, k: 'ui_bind_json', t: 'json', v: { read: { model_id: 0, p: 0, r: 0, c: 0, k: 'status_text' } } },
    ...extraRecords,
  ];
}

function hostIngressLabel(boundaries) {
  return {
    id: 0,
    p: 0,
    r: 0,
    c: 0,
    k: 'host_ingress_v1',
    t: 'json',
    v: {
      version: 'v1',
      boundaries,
    },
  };
}

function validBoundary(overrides = {}) {
  return {
    semantic: 'submit',
    pin_name: 'submit_request',
    value_t: 'event',
    locator_kind: 'root_relative_cell',
    locator_value: { p: 2, r: 2, c: 0 },
    primary: true,
    ...overrides,
  };
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0321-contract-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0321_contract_${Date.now()}`;
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

async function importPayload(state, payload, uri) {
  state.cacheUploadedMediaForTest(uri, {
    buffer: buildZipBuffer(payload),
    contentType: 'application/zip',
    filename: '0321-host-ingress.zip',
    userId: '@drop:localhost',
  });
  return state.runtime.hostApi.slideImportAppFromMxc(uri);
}

async function test_import_rejects_non_root_relative_locator_kind() {
  return withServerState(async (state) => {
    const payload = basePayload(
      [hostIngressLabel([validBoundary({ locator_kind: 'boundary_id', locator_value: 'submit-root' })])],
      [{ id: 0, p: 2, r: 2, c: 0, k: 'submit_request', t: 'pin.in', v: null }],
    );
    const result = await importPayload(state, payload, 'mxc://localhost/0321-contract-invalid-locator');
    assert.equal(result.ok, false, 'boundary_id_locator_must_be_rejected');
    assert.equal(result.detail, 'unsupported_host_ingress_locator_kind', 'rejection_reason_must_be_explicit');
    return { key: 'import_rejects_non_root_relative_locator_kind', status: 'PASS' };
  });
}

async function test_import_requires_one_primary_boundary_pin_declaration() {
  return withServerState(async (state) => {
    const payload = basePayload(
      [hostIngressLabel([
        validBoundary({ primary: false }),
        validBoundary({ pin_name: 'submit_request_2', locator_value: { p: 2, r: 3, c: 0 }, primary: true }),
      ])],
      [
        { id: 0, p: 2, r: 2, c: 0, k: 'submit_request', t: 'pin.in', v: null },
        { id: 0, p: 2, r: 3, c: 0, k: 'submit_request_2', t: 'pin.in', v: null },
      ],
    );
    const result = await importPayload(state, payload, 'mxc://localhost/0321-contract-primary');
    assert.equal(result.ok, false, 'multiple_boundaries_must_be_rejected_in_mvp');
    assert.equal(result.detail, 'must_have_exactly_one_primary_host_ingress_boundary', 'primary_boundary_rejection_reason_must_be_explicit');
    return { key: 'import_requires_one_primary_boundary_pin_declaration', status: 'PASS' };
  });
}

async function test_import_generates_model0_host_route_for_valid_boundary_pin() {
  return withServerState(async (state) => {
    const payload = basePayload(
      [hostIngressLabel([validBoundary()])],
      [
        { id: 0, p: 2, r: 2, c: 0, k: 'submit_request', t: 'pin.in', v: null },
        { id: 0, p: 2, r: 2, c: 0, k: 'submit_request_wiring', t: 'pin.connect.label', v: [{ from: '(self, submit_request)', to: ['(func, handle_submit:in)'] }] },
        { id: 0, p: 2, r: 2, c: 0, k: 'handle_submit', t: 'func.js', v: { code: "return [{ p: 0, r: 0, c: 0, k: 'status_text', t: 'str', v: 'host_ingress_ok' }];" } },
      ],
    );
    const result = await importPayload(state, payload, 'mxc://localhost/0321-contract-valid');
    assert.equal(result.ok, true, 'valid_host_ingress_payload_must_import');
    const importedId = result.data?.model_id;
    const model0Labels = state.runtime.getCell(state.runtime.getModel(0), 0, 0, 0).labels;
    assert.ok(model0Labels.has(`imported_host_submit_${importedId}`), 'model0_host_ingress_port_must_be_generated');
    assert.ok(model0Labels.has(`imported_host_submit_${importedId}_route`), 'model0_host_ingress_route_must_be_generated');
    return { key: 'import_generates_model0_host_route_for_valid_boundary_pin', status: 'PASS' };
  });
}

const tests = [
  test_import_rejects_non_root_relative_locator_kind,
  test_import_requires_one_primary_boundary_pin_declaration,
  test_import_generates_model0_host_route_for_valid_boundary_pin,
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
