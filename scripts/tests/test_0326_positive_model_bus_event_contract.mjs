#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_POSITIVE_MODELS_PATH = join(
  __dirname,
  '..',
  '..',
  'packages/worker-base/system-models/workspace_positive_models.json'
);
const SERVER_PATH = join(
  __dirname,
  '..',
  '..',
  'packages/ui-model-demo-server/server.mjs'
);

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function test_positive_models_stop_using_ui_event_symbols() {
  const payload = loadJson(WORKSPACE_POSITIVE_MODELS_PATH);
  const records = Array.isArray(payload) ? payload : Array.isArray(payload.records) ? payload.records : [];

  const badRootEventLabels = records.filter((record) =>
    record
    && Number.isInteger(record.model_id)
    && record.model_id > 0
    && record.p === 0
    && record.r === 0
    && record.c === 2
    && record.k === 'ui_event'
  );
  assert.equal(badRootEventLabels.length, 0, 'positive models must not keep root cell ui_event labels');

  const dualBusConfigs = records.filter((record) => record && record.k === 'dual_bus_model' && record.v && typeof record.v === 'object');
  const badDualBusKeys = dualBusConfigs.filter((record) =>
    Object.prototype.hasOwnProperty.call(record.v, 'ui_event_func')
  );
  assert.equal(badDualBusKeys.length, 0, 'dual_bus_model configs must not keep ui_event_func');

  const serialized = JSON.stringify(records);
  assert.equal(serialized.includes('"ui_event"'), false, 'workspace_positive_models must not reference ui_event');
  return { key: 'positive_models_stop_using_ui_event_symbols', status: 'PASS' };
}

function test_server_uses_bus_event_for_positive_model_dual_bus() {
  const source = readFileSync(SERVER_PATH, 'utf8');
  assert.equal(source.includes('ui_event_func'), false, 'server dual-bus config must not read ui_event_func');
  assert.equal(source.includes("Generic dual-bus model: ui_event"), false, 'server generic dual-bus path must not document ui_event');
  assert.equal(source.includes("dbLabel.v.ui_event_func"), false, 'server generic dual-bus path must not read ui_event_func');
  return { key: 'server_uses_bus_event_for_positive_model_dual_bus', status: 'PASS' };
}

const tests = [
  test_positive_models_stop_using_ui_event_symbols,
  test_server_uses_bus_event_for_positive_model_dual_bus,
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
