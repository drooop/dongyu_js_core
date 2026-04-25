#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const repoRoot = resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return readFileSync(resolve(repoRoot, relPath), 'utf8');
}

function findRuntimeModeLabel(runtime) {
  const model0 = runtime.getModel(0);
  const cell = runtime.getCell(model0, 0, 0, 0);
  return cell.labels.get('runtime_mode') || null;
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function pinPayload(opId) {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('source_model_id', 'int', 100),
    mt('pin', 'str', 'submit'),
    mt('payload', 'json', [mt('phase', 'str', 'running')]),
    mt('timestamp', 'int', Date.now()),
  ];
}

function test_runtime_mode_and_trusted_bootstrap() {
  const rt = new ModelTableRuntime();
  assert.equal(typeof rt.getRuntimeMode, 'function', 'runtime must expose getRuntimeMode()');
  assert.equal(typeof rt.setRuntimeMode, 'function', 'runtime must expose setRuntimeMode(mode)');
  assert.equal(rt.getRuntimeMode(), 'boot', 'runtime must start in boot mode');
  assert.equal(rt.isRunLoopActive(), false, 'runtime must start with run loop disabled');
  assert.equal(findRuntimeModeLabel(rt)?.v, 'boot', 'Model 0 (0,0,0) must expose runtime_mode=boot');

  const model0 = rt.getModel(0);
  rt.registerFunction(model0, 'demo', () => {});

  rt.addLabel(model0, 0, 0, 0, { k: 'run_demo', t: 'str', v: '1' });
  assert.equal(
    rt.intercepts.list().filter((entry) => entry && entry.type === 'run_func').length,
    0,
    'boot mode must not enqueue run_* execution',
  );

  const mqttPublishes = [];
  rt.mqttClient = {
    publish(topic, payload) {
      mqttPublishes.push({ topic, payload });
    },
  };
  rt.addLabel(model0, 0, 0, 0, { k: 'boot_out', t: 'pin.bus.out', v: pinPayload('boot_out') });
  assert.equal(mqttPublishes.length, 0, 'boot/edit mode must not publish pin.bus.out side effects');

  const untrustedCreate = rt.applyPatch({
    version: 'mt.v0',
    op_id: 'untrusted_create_model',
    records: [{ op: 'create_model', model_id: 1, name: 'M1', type: 'app' }],
  }, { allowCreateModel: true });
  assert.equal(rt.getModel(1), undefined, 'untrusted applyPatch must not create model');
  assert.equal(untrustedCreate.rejected, 1, 'untrusted create_model must be rejected');

  const trustedCreate = rt.applyPatch({
    version: 'mt.v0',
    op_id: 'trusted_create_model',
    records: [{ op: 'create_model', model_id: 1, name: 'M1', type: 'app' }],
  }, { allowCreateModel: true, trustedBootstrap: true });
  assert(rt.getModel(1), 'trusted bootstrap patch must be able to create model');
  assert.equal(trustedCreate.rejected, 0, 'trusted bootstrap create_model must pass');

  rt.setRuntimeMode('edit');
  rt.intercepts.reset();
  rt.addLabel(model0, 0, 0, 0, { k: 'run_demo', t: 'str', v: '1' });
  assert.equal(
    rt.intercepts.list().filter((entry) => entry && entry.type === 'run_func').length,
    0,
    'edit mode must not enqueue run_* execution',
  );

  rt.setRuntimeMode('running');
  rt.intercepts.reset();
  rt.addLabel(model0, 0, 0, 0, { k: 'run_demo', t: 'str', v: '1' });
  assert.equal(
    rt.intercepts.list().filter((entry) => entry && entry.type === 'run_func').length,
    1,
    'running mode must enqueue run_* execution',
  );

  rt.addLabel(model0, 0, 0, 0, { k: 'running_out', t: 'pin.bus.out', v: pinPayload('running_out') });
  assert.equal(mqttPublishes.length, 1, 'running mode must re-enable pin.bus.out side effects');
  assert.equal(findRuntimeModeLabel(rt)?.v, 'running', 'runtime must update Model 0 runtime_mode label when entering running');
}

function test_worker_bootstrap_no_env_fallback_contract() {
  const matrixLive = read('packages/worker-base/src/matrix_live.js');
  const runWorker = read('scripts/run_worker_v0.mjs');

  assert.doesNotMatch(
    matrixLive,
    /process\\.env\\.MATRIX_/,
    'matrix_live.js must not fallback to MATRIX_* env vars on the product path',
  );

  assert.match(
    runWorker,
    /setRuntimeMode\(['"]running['"]\)|setRunLoopActive\(true\)/,
    'run_worker_v0.mjs must explicitly activate runtime after bootstrap is complete',
  );
}

const tests = [
  test_runtime_mode_and_trusted_bootstrap,
  test_worker_bootstrap_no_env_fallback_contract,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
