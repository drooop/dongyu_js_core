/**
 * 0144 Remote Worker unit tests (no Docker needed)
 *
 * Tests the fill-table architecture: load patches → runtime handles routing
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function loadPatches(rt, patchDir) {
  const files = fs.readdirSync(patchDir).filter(f => f.endsWith('.json')).sort();
  for (const file of files) {
    const patch = JSON.parse(fs.readFileSync(path.join(patchDir, file), 'utf8'));
    rt.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
  }
}

function createConfiguredRuntime() {
  const rt = new ModelTableRuntime();
  const sysPatch = JSON.parse(fs.readFileSync('packages/worker-base/system-models/system_models.json', 'utf8'));
  rt.applyPatch(sysPatch, { allowCreateModel: true, trustedBootstrap: true });
  loadPatches(rt, 'deploy/sys-v1ns/remote-worker/patches');
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  return rt;
}

function test_patches_load_successfully() {
  const rt = createConfiguredRuntime();
  assert(rt.getModel(0), 'Model 0 should exist');
  assert(rt.getModel(-10), 'Model -10 should exist');
  assert(rt.getModel(100), 'Model 100 should exist after loading patches');
  return { key: 'patches_load_successfully', status: 'PASS' };
}

function test_remote_subscription_config_registered() {
  const rt = createConfiguredRuntime();
  const sys = rt.getModel(-10);
  const cell = rt.getCell(sys, 0, 0, 0);

  const subs = cell.labels.get('remote_subscriptions');
  assert(subs, 'remote_subscriptions label should exist');
  assert.strictEqual(subs.t, 'json');
  assert(Array.isArray(subs.v), 'remote_subscriptions must be an array');
  assert(subs.v.some((topic) => String(topic).includes('100/submit')), 'remote_subscriptions must include model 100 submit topic');
  assert(subs.v.some((topic) => String(topic).includes('100/result')), 'remote_subscriptions must include model 100 result topic');

  return { key: 'remote_subscription_config_registered', status: 'PASS' };
}

function test_root_submit_wiring_declared() {
  const rt = createConfiguredRuntime();
  const cellKey = '100|0|0|0';
  assert(rt.cellConnectGraph.has(cellKey), 'CELL_CONNECT graph should have model100 root cell');
  const graph = rt.cellConnectGraph.get(cellKey);
  assert(graph.has('self:submit'), 'root graph should have self:submit endpoint');
  const targets = graph.get('self:submit');
  assert(targets.length >= 1, 'should have at least one target');
  assert.strictEqual(targets[0].prefix, 'func');
  assert(targets[0].port.includes('on_model100_submit_in'), 'root submit must wire to on_model100_submit_in');
  return { key: 'root_submit_wiring_declared', status: 'PASS' };
}

function test_root_result_wiring_declared() {
  const rt = createConfiguredRuntime();
  const cellKey = '100|0|0|0';
  assert(rt.cellConnectGraph.has(cellKey), 'CELL_CONNECT graph should have model100 root cell');
  const graph = rt.cellConnectGraph.get(cellKey);
  assert(graph.has('func:on_model100_submit_in:out'), 'root graph should expose function out endpoint');
  const targets = graph.get('func:on_model100_submit_in:out');
  assert(targets.length >= 1);
  assert.strictEqual(targets[0].prefix, 'self');
  assert.strictEqual(targets[0].port, 'result');
  return { key: 'root_result_wiring_declared', status: 'PASS' };
}

function test_mqtt_incoming_routes_to_model100() {
  const rt = createConfiguredRuntime();

  // Simulate MQTT message arriving on Model 100 event topic
  const topic = 'UIPUT/ws/dam/pic/de/sw/100/submit';
  const payload = {
    version: 'v1',
    type: 'pin_payload',
    op_id: 'test_0144_mqtt_001',
    source_model_id: 100,
    pin: 'submit',
    payload: [
      { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
      { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'hello' },
    ],
    timestamp: Date.now(),
  };

  const handled = rt.mqttIncoming(topic, payload);
  assert(handled, 'mqttIncoming should handle the message');

  // Verify IN label written to Model 100 root cell
  const model100 = rt.getModel(100);
  const rootCell = rt.getCell(model100, 0, 0, 0);
  const eventLabel = rootCell.labels.get('submit');
  assert(eventLabel, 'submit IN label should be written to root cell');
  assert.strictEqual(eventLabel.t, 'pin.in');
  assert.ok(Array.isArray(eventLabel.v), 'submit pin must carry temporary-modeltable payload array');

  return { key: 'mqtt_incoming_routes_to_model100', status: 'PASS' };
}

function test_root_submit_triggers_processing() {
  const rt = createConfiguredRuntime();

  // Write IN label to Model 100 (0,0,0) with key='submit'
  const model100 = rt.getModel(100);
  rt.addLabel(model100, 0, 0, 0, { k: 'submit', t: 'pin.in', v: [{ id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'hello' }] });

  const rootCell = rt.getCell(model100, 0, 0, 0);
  const routedResult = rootCell.labels.get('result');
  assert(routedResult, 'submit should trigger root result wiring');
  assert.strictEqual(routedResult.t, 'pin.out');

  return { key: 'root_submit_triggers_processing', status: 'PASS' };
}

async function test_full_chain_async() {
  const rt = createConfiguredRuntime();

  // Simulate MQTT incoming → full chain
  const topic = 'UIPUT/ws/dam/pic/de/sw/100/submit';
  const payload = {
    version: 'v1',
    type: 'pin_payload',
    op_id: 'test_0144_full_001',
    source_model_id: 100,
    pin: 'submit',
    payload: [
      { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
      { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'hello' },
    ],
    timestamp: Date.now(),
  };

  const handled = rt.mqttIncoming(topic, payload);
  assert(handled, 'mqttIncoming should handle');

  // Wait for async CELL_CONNECT function execution
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Verify function executed: bg_color should be updated
  const model100 = rt.getModel(100);
  const rootCell = rt.getCell(model100, 0, 0, 0);
  const bgColor = rootCell.labels.get('bg_color');
  assert(bgColor, 'bg_color label should exist');
  // Function generates random color — just check it changed from default #FFFFFF
  // or that status was updated
  const status = rootCell.labels.get('status');
  assert(status, 'status label should exist');
  assert.strictEqual(status.v, 'processed', `status should be 'processed', got '${status.v}'`);

  const procCell = rt.getCell(model100, 0, 0, 0);
  const funcError = procCell.labels.get('__error_on_model100_submit_in');
  assert(!funcError, 'on_model100_event_in must not leave a cross-model access error');

  const patchOut = procCell.labels.get('result');
  assert(patchOut, 'processing cell result label should exist');
  assert.ok(Array.isArray(patchOut.v), 'processing cell must emit temporary-modeltable payload array');
  assert.ok(patchOut.v.some((record) => record && record.k === 'bg_color'), 'processing cell result payload must contain bg_color');

  return { key: 'full_chain_async', status: 'PASS' };
}

// --- Run all tests ---
const syncTests = [
  test_patches_load_successfully,
  test_remote_subscription_config_registered,
  test_root_submit_wiring_declared,
  test_root_result_wiring_declared,
  test_mqtt_incoming_routes_to_model100,
  test_root_submit_triggers_processing,
];

const asyncTests = [
  test_full_chain_async,
];

async function main() {
  let passed = 0;
  let failed = 0;

  for (const t of syncTests) {
    try {
      const r = t();
      process.stdout.write(`[${r.status}] ${r.key}\n`);
      passed += 1;
    } catch (err) {
      process.stdout.write(`[FAIL] ${t.name}: ${err.message}\n`);
      failed += 1;
    }
  }

  for (const t of asyncTests) {
    try {
      const r = await t();
      process.stdout.write(`[${r.status}] ${r.key}\n`);
      passed += 1;
    } catch (err) {
      process.stdout.write(`[FAIL] ${t.name}: ${err.message}\n`);
      failed += 1;
    }
  }

  process.stdout.write(`\n${passed} passed, ${failed} failed out of ${syncTests.length + asyncTests.length}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
