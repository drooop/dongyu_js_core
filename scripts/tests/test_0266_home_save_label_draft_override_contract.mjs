#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.resolve(repoRoot, relPath), 'utf8'));
}

function findRecord(records, predicate) {
  return (Array.isArray(records) ? records : []).find(predicate) || null;
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

function test_home_save_button_carries_draft_override() {
  const patch = readJson('packages/worker-base/system-models/home_catalog_ui.json');
  const saveButton = findRecord(patch.records, (record) => record?.k === 'ui_bind_json' && record?.model_id === -22 && record?.p === 2 && record?.r === 55 && record?.c === 0);
  assert(saveButton && saveButton.v && saveButton.v.write, 'home save button write binding must exist');
  const valueRef = saveButton.v.write.value_ref;
  assert(valueRef && typeof valueRef === 'object', 'home save button must carry draft override payload');
  assert.deepEqual(valueRef.model_id?.$label?.k, 'dt_edit_model_id');
  assert.deepEqual(valueRef.value_text?.$label?.k, 'dt_edit_v_text');
  assert.deepEqual(valueRef.value_int?.$label?.k, 'dt_edit_v_int');
  assert.deepEqual(valueRef.value_bool?.$label?.k, 'dt_edit_v_bool');
  return { key: 'home_save_button_carries_draft_override', status: 'PASS' };
}

async function test_home_save_label_prefers_draft_override_and_surfaces_error_status() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0266-home-save-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0266_home_save_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static_projects');

  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });

  try {
    await state.activateRuntimeMode('running');
    const stateModel = state.runtime.getModel(-2);
    const setState = (k, t, v) => state.runtime.addLabel(stateModel, 0, 0, 0, { k, t, v });

    setState('dt_edit_model_id', 'str', '-103');
    setState('dt_edit_p', 'str', '2');
    setState('dt_edit_r', 'str', '31');
    setState('dt_edit_c', 'str', '0');
    setState('dt_edit_k', 'str', 'ui_props_json');
    setState('dt_edit_t', 'str', 'json');
    setState('dt_edit_v_text', 'str', '{"options":[{"label":"Alpha","value":"alpha"},{"label":"Beta","value":"beta"},{"label":"Gamma","value":"gamma"}]}');

    const okResult = await state.submitEnvelope(mailboxEnvelope('home_save_label', {
      opId: 'home_save_override_ok',
      target: { model_id: -2, p: 0, r: 0, c: 0, k: 'dt_edit_model_id' },
      value: {
        model_id: '-103',
        p: '2',
        r: '31',
        c: '0',
        k: 'ui_props_json',
        t: 'json',
        value_text: '{"options":[{"label":"Alpha","value":"alpha"},{"label":"Beta","value":"beta"},{"label":"Gamma1","value":"gamma"}]}',
        value_int: 0,
        value_bool: false,
      },
    }));
    assert.equal(okResult.result, 'ok', 'home_save_label override save must succeed');

    let snapshot = state.clientSnap();
    assert.equal(
      snapshot.models['-103'].cells['2,31,0'].labels.ui_props_json?.v?.options?.[2]?.label,
      'Gamma1',
      'home_save_label must prefer draft override value over stale server edit state',
    );

    const badResult = await state.submitEnvelope(mailboxEnvelope('home_save_label', {
      opId: 'home_save_override_bad',
      target: { model_id: -2, p: 0, r: 0, c: 0, k: 'dt_edit_model_id' },
      value: {
        model_id: '-103',
        p: '2',
        r: '31',
        c: '0',
        k: 'ui_props_json',
        t: 'json',
        value_text: '{options:[{label:"Broken",value:"broken"}]}',
        value_int: 0,
        value_bool: false,
      },
    }));
    assert.equal(badResult.result, 'error', 'invalid json override must fail');
    assert.equal(badResult.code, 'invalid_json', 'invalid json override must report invalid_json');

    snapshot = state.clientSnap();
    assert.match(
      String(snapshot.models['-2'].cells['0,0,0'].labels.home_status_text?.v || ''),
      /invalid_json|parse_failed/i,
      'home save failure must surface explicit status text',
    );

    return { key: 'home_save_label_prefers_draft_override_and_surfaces_error_status', status: 'PASS' };
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
  test_home_save_button_carries_draft_override,
  test_home_save_label_prefers_draft_override_and_surfaces_error_status,
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
