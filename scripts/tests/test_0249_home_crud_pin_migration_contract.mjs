#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { EDITOR_STATE_MODEL_ID } from '../../packages/ui-model-demo-frontend/src/model_ids.js';

const repoRoot = resolve(import.meta.dirname, '..', '..');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(resolve(repoRoot, relPath), 'utf8'));
}

function getPatchRecords(patch) {
  return Array.isArray(patch?.records) ? patch.records : [];
}

function getRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}` },
  };
  if (options.target) payload.target = options.target;
  if (options.value !== undefined) payload.value = options.value;
  return {
    event_id: Date.now(),
    type: action,
    payload,
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

const homeHandlerPatch = readJson('packages/worker-base/system-models/intent_handlers_home.json');
const intentDispatchPatch = readJson('packages/worker-base/system-models/intent_dispatch_config.json');
const HOME_ACTIONS = [
  'home_refresh',
  'home_select_row',
  'home_open_create',
  'home_open_edit',
  'home_save_label',
  'home_delete_label',
  'home_view_detail',
  'home_close_detail',
  'home_close_edit',
];
const HOME_PIN_ONLY_DISPATCH_HANDLER = 'handle_home_pin_only_dispatch_blocked';

function test_home_pin_source_contract_is_declared() {
  const records = getPatchRecords(homeHandlerPatch);
  for (const action of HOME_ACTIONS) {
    assert(
      getRecord(records, (record) => (
        record?.model_id === -10
        && record?.p === 0
        && record?.r === 0
        && record?.c === 0
        && record?.k === action
        && record?.t === 'pin.in'
      )),
      `home_pin_input_missing:${action}`,
    );
  }
  const wiring = getRecord(records, (record) => (
    record?.model_id === -10
    && record?.p === 0
    && record?.r === 0
    && record?.c === 0
    && record?.k === 'home_pin_wiring'
    && record?.t === 'pin.connect.label'
  ));
  assert(wiring, 'home_pin_wiring_missing');
  return { key: 'home_pin_source_contract_is_declared', status: 'PASS' };
}

function test_home_dispatch_is_converged_to_pin_only() {
  const dispatchRecords = getPatchRecords(intentDispatchPatch);
  const dispatchTableRecord = getRecord(dispatchRecords, (record) => (
    record?.model_id === -10
    && record?.k === 'intent_dispatch_table'
    && record?.t === 'json'
  ));
  assert(dispatchTableRecord && dispatchTableRecord.v && typeof dispatchTableRecord.v === 'object', 'intent_dispatch_table_missing');
  for (const action of HOME_ACTIONS) {
    assert.equal(
      dispatchTableRecord.v[action],
      HOME_PIN_ONLY_DISPATCH_HANDLER,
      `home_dispatch_must_converge_to_pin_only:${action}`,
    );
  }
  const handlerRecords = getPatchRecords(homeHandlerPatch);
  const pinOnlyHandler = getRecord(handlerRecords, (record) => (
    record?.model_id === -10
    && record?.k === HOME_PIN_ONLY_DISPATCH_HANDLER
    && record?.t === 'func.js'
  ));
  assert(pinOnlyHandler, 'home_pin_only_dispatch_handler_missing');
  return { key: 'home_dispatch_is_converged_to_pin_only', status: 'PASS' };
}

function assertOriginEnvelope(request, expectedAction, key) {
  assert(Array.isArray(request), `${key}_must_use_modeltable_payload`);
  const read = (payloadKey) => request.find((record) =>
    record && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === payloadKey)?.v;
  assert.equal(read('request'), undefined, `${key}_must_not_embed_legacy_request`);
  assert.equal(read('origin_action'), expectedAction, `${key}_origin_action_mismatch`);
  assert(Number.isInteger(read('target_model_id')), `${key}_target_model_id_missing`);
  assert(Array.isArray(read('write_labels')), `${key}_write_labels_missing`);
  assert(Array.isArray(read('remove_labels')), `${key}_remove_labels_missing`);
}

async function test_server_home_crud_is_routed_by_pin_and_materializes() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0249-home-pin-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0249_home_pin_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });

  try {
    await state.activateRuntimeMode('running');

    let result = await state.submitEnvelope(mailboxEnvelope('label_update', {
      opId: 'home_set_model',
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_model_id' },
      value: { t: 'str', v: '1003' },
    }));
    assert.equal(result.result, 'ok', 'set_selected_model_id_failed');

    async function setState(key, type, value, opId) {
      return state.submitEnvelope(mailboxEnvelope('label_update', {
        opId,
        target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: key },
        value: { t: type, v: value },
      }));
    }

    result = await state.submitEnvelope(mailboxEnvelope('home_open_create', {
      opId: 'home_open_create',
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_model_id' },
    }));
    assert.equal(result.result, 'ok', 'home_open_create_failed');
    assert.equal(result.routed_by, 'pin', 'home_open_create_must_route_by_pin');
    const stateOwnerRequest = state.runtime.getCell(state.runtime.getModel(-2), 0, 0, 0).labels.get('home_owner_request');
    assertOriginEnvelope(stateOwnerRequest?.v, 'home_open_create', 'open_create');

    await setState('dt_edit_p', 'str', '0', 'set_p');
    await setState('dt_edit_r', 'str', '0', 'set_r');
    await setState('dt_edit_c', 'str', '0', 'set_c');
    await setState('dt_edit_k', 'str', 'pin_home_demo', 'set_k');
    await setState('dt_edit_t', 'str', 'str', 'set_t');
    await setState('dt_edit_v_text', 'str', 'pin-home-value', 'set_v');

    result = await state.submitEnvelope(mailboxEnvelope('home_save_label', {
      opId: 'home_save_create',
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_model_id' },
    }));
    assert.equal(result.result, 'ok', 'home_save_label_create_failed');
    assert.equal(result.routed_by, 'pin', 'home_save_label_create_must_route_by_pin');
    const createOwnerRequest = state.runtime.getCell(state.runtime.getModel(1003), 0, 0, 0).labels.get('home_owner_request');
    assertOriginEnvelope(createOwnerRequest?.v, 'home_save_label', 'save_create');

    let snapshot = state.clientSnap();
    let targetLabel = snapshot.models['1003'].cells['0,0,0'].labels.pin_home_demo;
    assert.equal(targetLabel?.v, 'pin-home-value', 'created_label_value_must_match');
    let rows = snapshot.models['-2'].cells['0,0,0'].labels.home_table_rows_json?.v || [];
    assert.equal(rows.some((row) => row && row.k === 'home_owner_request'), true, 'debug_home_table_must_show_owner_request_row');
    assert.equal(rows.some((row) => row && row.k === 'home_owner_materialize'), true, 'debug_home_table_must_show_owner_func_row');

    result = await state.submitEnvelope(mailboxEnvelope('home_open_edit', {
      opId: 'home_open_edit',
      target: { model_id: 1003, p: 0, r: 0, c: 0, k: 'pin_home_demo' },
    }));
    assert.equal(result.result, 'ok', 'home_open_edit_failed');
    assert.equal(result.routed_by, 'pin', 'home_open_edit_must_route_by_pin');

    await setState('dt_edit_v_text', 'str', 'pin-home-value-updated', 'set_v_updated');

    result = await state.submitEnvelope(mailboxEnvelope('home_save_label', {
      opId: 'home_save_edit',
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_model_id' },
    }));
    assert.equal(result.result, 'ok', 'home_save_label_edit_failed');
    assert.equal(result.routed_by, 'pin', 'home_save_label_edit_must_route_by_pin');

    snapshot = state.clientSnap();
    targetLabel = snapshot.models['1003'].cells['0,0,0'].labels.pin_home_demo;
    assert.equal(targetLabel?.v, 'pin-home-value-updated', 'edited_label_value_must_update');

    result = await state.submitEnvelope(mailboxEnvelope('home_delete_label', {
      opId: 'home_delete_label',
      target: { model_id: 1003, p: 0, r: 0, c: 0, k: 'pin_home_demo' },
    }));
    assert.equal(result.result, 'ok', 'home_delete_label_failed');
    assert.equal(result.routed_by, 'pin', 'home_delete_label_must_route_by_pin');
    const deleteOwnerRequest = state.runtime.getCell(state.runtime.getModel(1003), 0, 0, 0).labels.get('home_owner_request');
    assertOriginEnvelope(deleteOwnerRequest?.v, 'home_delete_label', 'delete_label');

    snapshot = state.clientSnap();
    assert.equal(Boolean(snapshot.models['1003'].cells['0,0,0'].labels.pin_home_demo), false, 'home_delete_label_must_remove_target_label');

    return { key: 'server_home_crud_is_routed_by_pin_and_materializes', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

const tests = [
  test_home_dispatch_is_converged_to_pin_only,
  test_home_pin_source_contract_is_declared,
  test_server_home_crud_is_routed_by_pin_and_materializes,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[PASS] ${result.key || test.name}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
