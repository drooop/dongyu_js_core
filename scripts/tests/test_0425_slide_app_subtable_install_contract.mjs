#!/usr/bin/env node

import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import {
  buildClientSnapshotForPrincipal,
  buildSlideAppExportPayload,
  createServerState,
  deriveWorkspaceRegistryFromSnapshot,
  handleSlideAppExportRequest,
} from '../../packages/ui-model-demo-server/server.mjs';

function record(id, p, r, c, k, t, v) {
  return { id, p, r, c, k, t, v };
}

function minimalSlidePayload(appName = '0425 Subtable App') {
  return [
    record(0, 0, 0, 0, 'model_type', 'model.table', 'UI.SubtableSlideApp'),
    record(0, 0, 0, 0, 'app_name', 'str', appName),
    record(0, 0, 0, 0, 'slide_app_summary', 'str', `${appName} summary`),
    record(0, 0, 0, 0, 'source_worker', 'str', 'test-provider'),
    record(0, 0, 0, 0, 'slide_capable', 'bool', true),
    record(0, 0, 0, 0, 'slide_surface_type', 'str', 'workspace.page'),
    record(0, 0, 0, 0, 'from_user', 'str', '@provider:example'),
    record(0, 0, 0, 0, 'to_user', 'str', '@drop:example'),
    record(0, 0, 0, 0, 'ui_authoring_version', 'str', 'cellwise.ui.v1'),
    record(0, 0, 0, 0, 'ui_root_node_id', 'str', 'root'),
    record(0, 0, 1, 0, 'model_type', 'model.submt', 1),
    record(0, 2, 0, 0, 'ui_node_id', 'str', 'root'),
    record(0, 2, 0, 0, 'ui_component', 'str', 'Container'),
    record(0, 2, 1, 0, 'ui_node_id', 'str', 'title'),
    record(0, 2, 1, 0, 'ui_component', 'str', 'Text'),
    record(0, 2, 1, 0, 'ui_parent', 'str', 'root'),
    record(0, 2, 1, 0, 'ui_text_ref_model_id', 'int', 1),
    record(0, 2, 1, 0, 'ui_text_ref_p', 'int', 0),
    record(0, 2, 1, 0, 'ui_text_ref_r', 'int', 0),
    record(0, 2, 1, 0, 'ui_text_ref_c', 'int', 0),
    record(0, 2, 1, 0, 'ui_text_ref_k', 'str', 'title'),
    record(1, 0, 0, 0, 'model_type', 'model.table', 'Data.Title'),
    record(1, 0, 0, 0, 'title', 'str', `${appName} title`),
  ];
}

function zipBufferForPayload(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

function installPayload(state, payload, uri = `mxc://test/${Date.now()}-${Math.random().toString(16).slice(2)}`) {
  state.cacheUploadedMediaForTest(uri, { buffer: zipBufferForPayload(payload) });
  const result = state.runtime.hostApi.slideImportAppFromMxc(uri);
  assert.equal(result.ok, true, `slide import failed: ${JSON.stringify(result)}`);
  return result.data;
}

function captureResponse() {
  return {
    statusCode: null,
    headers: {},
    body: Buffer.alloc(0),
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers || {};
    },
    end(chunk) {
      this.body = chunk ? Buffer.from(chunk) : Buffer.alloc(0);
    },
  };
}

function mountRecords(runtime, tableId) {
  const model0 = runtime.getModel(0);
  const out = [];
  for (const cell of model0.cells.values()) {
    for (const label of cell.labels.values()) {
      if (label && label.t === 'model.subtable' && label.v?.table_id === tableId) {
        out.push({ cell, label });
      }
    }
  }
  return out;
}

function test_zip_import_materializes_child_model_table_not_host_models() {
  const state = createServerState({ dbPath: null });
  const installed = installPayload(state, minimalSlidePayload('0425 Install One'));
  const { runtime } = state;

  assert.equal(installed.model_id, 0, 'installed root model id must remain package-local 0');
  assert.equal(installed.model_ref.table_id, installed.table_id);
  assert.equal(installed.model_ref.model_id, 0);
  assert.ok(installed.table_id.startsWith('app:local-dev:0425-install-one:'), 'installer must allocate an app instance table id');
  assert.ok(runtime.getModel({ table_id: installed.table_id, model_id: 0 }), 'app root must live in the app table');
  assert.ok(runtime.getModel({ table_id: installed.table_id, model_id: 1 }), 'app child model must keep local id 1 in the app table');
  assert.equal(
    runtime.getLabelValue(runtime.getModel({ table_id: installed.table_id, model_id: 1 }), 0, 0, 0, 'title'),
    '0425 Install One title',
  );
  assert.equal(mountRecords(runtime, installed.table_id).length, 1, 'host model 0 must declare one model.subtable boundary');

  const registry = deriveWorkspaceRegistryFromSnapshot({ snapshot: runtime.snapshot() });
  assert.ok(
    registry.some((entry) => entry.table_id === installed.table_id && entry.model_id === 0 && entry.name === '0425 Install One'),
    'workspace registry must expose installed app by table-qualified model ref',
  );

  return { key: 'zip_import_materializes_child_model_table_not_host_models', status: 'PASS' };
}

function test_duplicate_imports_keep_independent_app_local_state() {
  const state = createServerState({ dbPath: null });
  const payload = minimalSlidePayload('0425 Duplicate App');
  const first = installPayload(state, payload, 'mxc://test/duplicate-a');
  const second = installPayload(state, payload, 'mxc://test/duplicate-b');
  const { runtime } = state;

  assert.notEqual(first.table_id, second.table_id, 'duplicate installs must allocate different app tables');
  assert.equal(mountRecords(runtime, first.table_id).length, 1, 'first duplicate install must keep its own host model.subtable boundary');
  assert.equal(mountRecords(runtime, second.table_id).length, 1, 'second duplicate install must keep its own host model.subtable boundary');
  runtime.addLabel(runtime.getModel({ table_id: first.table_id, model_id: 1 }), 0, 0, 0, {
    k: 'title',
    t: 'str',
    v: 'First instance title',
  });
  assert.equal(
    runtime.getLabelValue(runtime.getModel({ table_id: first.table_id, model_id: 1 }), 0, 0, 0, 'title'),
    'First instance title',
  );
  assert.equal(
    runtime.getLabelValue(runtime.getModel({ table_id: second.table_id, model_id: 1 }), 0, 0, 0, 'title'),
    '0425 Duplicate App title',
    'second install must keep its own app-local state',
  );

  const registry = deriveWorkspaceRegistryFromSnapshot({ snapshot: runtime.snapshot() });
  const duplicateEntries = registry.filter((entry) => entry.name === '0425 Duplicate App');
  assert.equal(duplicateEntries.length, 2, 'workspace registry must keep both table-qualified duplicate installs');

  const principalSnapshot = buildClientSnapshotForPrincipal(runtime.snapshot(), { subject: 'local-dev' });
  assert.ok(principalSnapshot.tables?.[first.table_id]?.models?.['0'], 'principal-filtered snapshot must keep the first duplicate app table');
  assert.ok(principalSnapshot.tables?.[second.table_id]?.models?.['0'], 'principal-filtered snapshot must keep the second duplicate app table');

  return { key: 'duplicate_imports_keep_independent_app_local_state', status: 'PASS' };
}

function test_subtable_export_emits_package_local_ids_without_table_leak() {
  const state = createServerState({ dbPath: null });
  const installed = installPayload(state, minimalSlidePayload('0425 Export App'));
  const result = buildSlideAppExportPayload(state.runtime, { table_id: installed.table_id, model_id: 0 });

  assert.equal(result.ok, true, `export failed: ${JSON.stringify(result)}`);
  const payload = result.data.payload;
  assert.deepEqual([...new Set(payload.map((entry) => entry.id))].sort((a, b) => a - b), [0, 1]);
  assert.equal(
    payload.find((entry) => entry.id === 0 && entry.k === 'model_type' && entry.t === 'model.submt')?.v,
    1,
    'model.submt must keep package-local child id',
  );
  assert.equal(payload.some((entry) => entry.k === 'installed_at'), false, 'export must omit install-time labels');
  assert.equal(payload.some((entry) => entry.k === 'imported_bundle_model_ids'), false, 'export must omit host diagnostic ids');
  assert.equal(JSON.stringify(payload).includes(installed.table_id), false, 'provider export must not leak concrete table_id');

  return { key: 'subtable_export_emits_package_local_ids_without_table_leak', status: 'PASS' };
}

async function test_registry_export_url_downloads_app_table_zip() {
  const state = createServerState({ dbPath: null });
  const installed = installPayload(state, minimalSlidePayload('0425 Export Route App'), 'mxc://test/export-route');
  const registry = deriveWorkspaceRegistryFromSnapshot({ snapshot: state.runtime.snapshot() });
  const entry = registry.find((item) => item.table_id === installed.table_id && item.model_id === 0);
  assert.ok(entry, 'registry must contain the installed app-table entry');
  assert.match(entry.export_url, /^\/api\/slide-apps\/export\.zip\?table_id=/u, 'app-table registry entry must expose table-qualified export URL');

  const res = captureResponse();
  const handled = handleSlideAppExportRequest({ method: 'GET', url: entry.export_url, headers: {} }, res, state, null);
  assert.equal(handled, true, 'table-qualified export handler must claim the registry URL');
  assert.equal(res.statusCode, 200, 'table-qualified export route must return zip');
  assert.match(res.headers['content-type'] || '', /application\/zip/u, 'export route must return application/zip');
  const exportedZip = new AdmZip(res.body);
  const entryFile = exportedZip.getEntry('app_payload.json');
  assert.ok(entryFile, 'exported route zip must contain app_payload.json');
  const payload = JSON.parse(entryFile.getData().toString('utf8'));
  assert.deepEqual([...new Set(payload.map((record) => record.id))].sort((a, b) => a - b), [0, 1], 'route export must keep package-local ids');
  assert.equal(JSON.stringify(payload).includes(installed.table_id), false, 'route export payload must not leak concrete app table id');
  return { key: 'registry_export_url_downloads_app_table_zip', status: 'PASS' };
}

async function test_export_route_requires_explicit_table_id_on_query_path() {
  const state = createServerState({ dbPath: null });
  const missingTableRes = captureResponse();
  const handledMissing = handleSlideAppExportRequest(
    { method: 'GET', url: '/api/slide-apps/export.zip?model_id=100', headers: {} },
    missingTableRes,
    state,
    null,
  );
  assert.equal(handledMissing, true, 'query export route must be handled even when rejecting invalid input');
  assert.equal(missingTableRes.statusCode, 400, 'query export route must reject missing table_id');
  assert.match(missingTableRes.body.toString('utf8'), /table_id_required/u, 'query export rejection must explain table_id is required');

  const legacyHostRes = captureResponse();
  const handledLegacy = handleSlideAppExportRequest(
    { method: 'GET', url: '/api/slide-apps/100/export.zip', headers: {} },
    legacyHostRes,
    state,
    null,
  );
  assert.equal(handledLegacy, true, 'legacy host export route must still be handled');
  assert.equal(legacyHostRes.statusCode, 200, 'legacy host export route must remain valid');
  assert.match(legacyHostRes.headers['content-type'] || '', /application\/zip/u, 'legacy host export route must return application/zip');
  return { key: 'export_route_requires_explicit_table_id_on_query_path', status: 'PASS' };
}

const tests = [
  test_zip_import_materializes_child_model_table_not_host_models,
  test_duplicate_imports_keep_independent_app_local_state,
  test_subtable_export_emits_package_local_ids_without_table_leak,
  test_registry_export_url_downloads_app_table_zip,
  test_export_route_requires_explicit_table_id_on_query_path,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err && err.stack ? err.stack : err}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
