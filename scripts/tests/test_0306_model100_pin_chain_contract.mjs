#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function findRecord(records, predicate) {
  return Array.isArray(records) ? records.find(predicate) || null : null;
}

function test_model100_declares_submit_request_pin_and_wiring() {
  const workspacePatch = readJson('packages/worker-base/system-models/workspace_positive_models.json');
  const records = workspacePatch.records || [];

  assert.ok(
    findRecord(records, (record) => record?.model_id === 100 && record?.p === 0 && record?.r === 0 && record?.c === 0 && record?.k === 'submit_request' && record?.t === 'pin.in'),
    'workspace_model100_submit_request_pin_missing',
  );
  const wiring = findRecord(records, (record) => record?.model_id === 100 && record?.k === 'submit_request_wiring');
  assert.ok(wiring, 'workspace_model100_submit_request_wiring_missing');
  assert.match(
    JSON.stringify(wiring.v),
    /prepare_model100_submit_from_pin:in/,
    'workspace_model100_submit_request_wiring_must_target_pin_prepare_func',
  );
  return { key: 'model100_declares_submit_request_pin_and_wiring', status: 'PASS' };
}

function test_model0_declares_model100_submit_ingress_route() {
  const patch = readJson('packages/worker-base/system-models/test_model_100_ui.json');
  const records = patch.records || [];
  const route = findRecord(records, (record) => record?.model_id === 0 && record?.k === 'model100_submit_ingress_route' && record?.t === 'pin.connect.model');
  assert.ok(route, 'model100_submit_ingress_route_missing');
  assert.deepEqual(
    route.v,
    [{ from: [0, 'bus_event_submit_100_0_0_0'], to: [[100, 'submit_request']] }],
    'model100_submit_ingress_route_must_bind_model0_bus_event_submit_to_model100_submit_request',
  );
  return { key: 'model0_declares_model100_submit_ingress_route', status: 'PASS' };
}

function test_system_model_declares_prepare_model100_submit_from_pin() {
  const patch = readJson('packages/worker-base/system-models/test_model_100_ui.json');
  const records = patch.records || [];
  const fn = findRecord(records, (record) => record?.model_id === -10 && record?.k === 'prepare_model100_submit_from_pin' && record?.t === 'func.js');
  assert.ok(fn, 'prepare_model100_submit_from_pin_missing');
  assert.match(String(fn.v?.code || ''), /label\.v/, 'prepare_model100_submit_from_pin_must_read_from_pin_label_payload');
  assert.doesNotMatch(String(fn.v?.code || ''), /ctx\.getLabel|ctx\.writeLabel/, 'prepare_model100_submit_from_pin_must_not_use_legacy_ctx_label_api');
  assert.match(String(fn.v?.code || ''), /V1N\.readLabel\(/, 'prepare_model100_submit_from_pin_must_read_submit_state_via_v1n');
  assert.match(String(fn.v?.code || ''), /writeRoot\('submit',\s*'pin\.out'/, 'prepare_model100_submit_from_pin_must_write_model100_submit_pin_out_via_v1n_table');
  return { key: 'system_model_declares_prepare_model100_submit_from_pin', status: 'PASS' };
}

const tests = [
  test_model100_declares_submit_request_pin_and_wiring,
  test_model0_declares_model100_submit_ingress_route,
  test_system_model_declares_prepare_model100_submit_from_pin,
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
