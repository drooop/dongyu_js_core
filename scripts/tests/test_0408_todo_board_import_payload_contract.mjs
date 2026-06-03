#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;
const repoRoot = new URL('../..', import.meta.url).pathname;
const payloadPath = join(repoRoot, 'test_files', 'todo_board_app_payload.json');
const zipPath = join(repoRoot, 'test_files', 'todo_board_app.zip');

function wait(ms = 160) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function readPayload() {
  return JSON.parse(readFileSync(payloadPath, 'utf8'));
}

function payloadZipBuffer() {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  assert.equal(entries.length, 1, 'todo_board_zip_must_contain_one_file');
  assert.equal(entries[0].entryName, 'app_payload.json', 'todo_board_zip_file_name_must_be_app_payload_json');
  return readFileSync(zipPath);
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

function uiEventPayload(labels = []) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
    ...labels.map((label) => ({ id: 0, p: 0, r: 0, c: 0, ...label })),
  ];
}

function slideImportClickBusEvent() {
  const value = uiEventPayload([
    { k: 'target', t: 'json', v: { model_id: 1031, p: 0, r: 0, c: 0 } },
  ]);
  return {
    type: 'bus_event_v2',
    bus_in_key: 'slide_import_click',
    value: writeLabelPayload({ p: 2, r: 4, c: 0 }, 'click', 'pin.in', value, `slide_import_click_${Date.now()}`),
    meta: { op_id: `slide_import_click_${Date.now()}`, source: 'test_0408' },
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

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0408-todo-import-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0408_todo_import_${Date.now()}`;
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

function assertPortablePayloadShape() {
  const payload = readPayload();
  assert.equal(payload.length, 270, 'todo_board_payload_record_count_must_stay_expected');
  for (const record of payload) {
    assert.deepEqual(
      Object.keys(record).sort(),
      ['c', 'id', 'k', 'p', 'r', 't', 'v'],
      'todo_board_payload_records_must_be_temporary_modeltable_records',
    );
  }
  const text = JSON.stringify(payload);
  assert.equal(text.includes('"model_id"'), false, 'todo_board_payload_must_not_require_deployment_model_id');
  assert.equal(text.includes('todo_1086_bus_event'), false, 'todo_board_payload_must_not_keep_builtin_bus_key');
  assert.equal(text.includes('bus_event_submit_0_0_0_0'), true, 'todo_board_payload_must_use_import_remappable_bus_key');
  assert.equal(payload.some((record) => record.k === 'host_ingress_v1'), true, 'todo_board_payload_must_declare_host_ingress');
  assert.equal(payload.some((record) => record.k === 'from_user'), true, 'todo_board_payload_must_declare_from_user');
  assert.equal(payload.some((record) => record.k === 'to_user'), true, 'todo_board_payload_must_declare_to_user');
}

async function assertImportedTodoBoardCanCreateTask() {
  return withServerState(async (state) => {
    state.cacheUploadedMediaForTest('mxc://localhost/0408-todo-board', {
      buffer: payloadZipBuffer(),
      contentType: 'application/zip',
      filename: 'todo_board_app.zip',
      userId: '@drop:localhost',
    });
    state.runtime.addLabel(state.runtime.getModel(1031), 0, 0, 0, {
      k: 'slide_import_media_uri',
      t: 'str',
      v: 'mxc://localhost/0408-todo-board',
    });

    const importResult = await state.submitEnvelope(slideImportClickBusEvent());
    assert.equal(importResult.result, 'ok', 'todo_board_import_bus_event_must_succeed');
    await wait();

    const registry = state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    const importedEntry = registry.find((entry) => (
      entry
      && entry.name === 'To Do Board'
      && entry.delete_disabled === false
    ));
    assert.ok(importedEntry, 'todo_board_import_must_appear_in_registry');
    const importedId = importedEntry.model_id;
    const ingressKey = `imported_host_submit_${importedId}`;
    const installedText = JSON.stringify(state.clientSnap().models[String(importedId)] || {});
    assert.equal(installedText.includes(ingressKey), true, 'todo_board_installed_bindings_must_use_generated_ingress_key');
    assert.equal(installedText.includes('todo_1086_bus_event'), false, 'todo_board_installed_bindings_must_not_keep_builtin_bus_key');

    const submitResult = await state.submitEnvelope(pinEnvelope(
      { model_id: 0, p: 0, r: 0, c: 0 },
      ingressKey,
      uiEventPayload([
        { k: 'todo_action', t: 'str', v: 'create_task' },
        { k: 'title', t: 'str', v: 'Imported To Do task' },
        { k: 'body', t: 'str', v: 'Created through imported host ingress.' },
        { k: 'status', t: 'str', v: 'doing' },
      ]),
    ));
    assert.equal(submitResult.result, 'ok', 'todo_board_imported_ingress_must_accept_submit');
    await wait();

    const labels = state.clientSnap().models[String(importedId)]?.cells?.['0,0,0']?.labels || {};
    assert.equal(labels.todo_status?.v, 'created: Imported To Do task', 'todo_board_program_must_update_status');
    assert.equal(labels.tasks_json?.v?.[0]?.title, 'Imported To Do task', 'todo_board_program_must_insert_task');
    assert.equal(labels.tasks_json?.v?.[0]?.status, 'doing', 'todo_board_program_must_preserve_submitted_status');
  });
}

try {
  assertPortablePayloadShape();
  await assertImportedTodoBoardCanCreateTask();
  console.log('PASS test_0408_todo_board_import_payload_contract');
} catch (error) {
  console.error(`FAIL test_0408_todo_board_import_payload_contract: ${error.message}`);
  process.exit(1);
}
