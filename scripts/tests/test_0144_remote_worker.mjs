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
    rt.applyPatch(patch, { allowCreateModel: true });
  }
}

function createConfiguredRuntime() {
  const rt = new ModelTableRuntime();
  const sysPatch = JSON.parse(fs.readFileSync('packages/worker-base/system-models/system_models.json', 'utf8'));
  rt.applyPatch(sysPatch, { allowCreateModel: true });
  loadPatches(rt, 'deploy/sys-v1ns/remote-worker/patches');
  return rt;
}

function test_patches_load_successfully() {
  const rt = createConfiguredRuntime();
  assert(rt.getModel(0), 'Model 0 should exist');
  assert(rt.getModel(-10), 'Model -10 should exist');
  assert(rt.getModel(100), 'Model 100 should exist after loading patches');
  return { key: 'patches_load_successfully', status: 'PASS' };
}

function test_mqtt_wildcard_sub_registered() {
  const rt = createConfiguredRuntime();
  const model0 = rt.getModel(0);
  const cell = rt.getCell(model0, 0, 0, 0);

  const subEvent = cell.labels.get('sub_model100_event');
  assert(subEvent, 'sub_model100_event label should exist');
  assert.strictEqual(subEvent.t, 'MQTT_WILDCARD_SUB');
  assert(subEvent.v.includes('100/event'), 'should subscribe to model 100 event topic');

  const subPatch = cell.labels.get('sub_model100_patch');
  assert(subPatch, 'sub_model100_patch label should exist');
  assert.strictEqual(subPatch.t, 'MQTT_WILDCARD_SUB');

  return { key: 'mqtt_wildcard_sub_registered', status: 'PASS' };
}

function test_cell_connection_routing_declared() {
  const rt = createConfiguredRuntime();
  // Model 100 should have cell_connection: [0,0,0,"event"] → [1,0,0,"event"]
  const routeKey = '100|0|0|0|event';
  assert(rt.cellConnectionRoutes.has(routeKey), 'cell_connection route for event should be registered');
  const targets = rt.cellConnectionRoutes.get(routeKey);
  assert(targets.length >= 1, 'should have at least one target');
  assert.strictEqual(targets[0].p, 1);
  assert.strictEqual(targets[0].k, 'event');
  return { key: 'cell_connection_routing_declared', status: 'PASS' };
}

function test_cell_connect_wiring_declared() {
  const rt = createConfiguredRuntime();
  // Model 100, cell (1,0,0) should have CELL_CONNECT wiring
  const cellKey = '100|1|0|0';
  assert(rt.cellConnectGraph.has(cellKey), 'CELL_CONNECT graph should have model100 cell(1,0,0)');
  const graph = rt.cellConnectGraph.get(cellKey);
  assert(graph.has('self:event'), 'should have self:event endpoint');
  const targets = graph.get('self:event');
  assert(targets.length >= 1);
  assert.strictEqual(targets[0].prefix, 'func');
  assert(targets[0].port.includes('on_model100_event_in'), 'should wire to on_model100_event_in');
  return { key: 'cell_connect_wiring_declared', status: 'PASS' };
}

function test_mqtt_incoming_routes_to_model100() {
  const rt = createConfiguredRuntime();

  // Simulate MQTT message arriving on Model 100 event topic
  const topic = 'UIPUT/ws/dam/pic/de/sw/100/event';
  const payload = {
    version: 'mt.v0',
    op_id: 'test_0144_mqtt_001',
    records: [{
      op: 'add_label', model_id: 100, p: 1, r: 0, c: 0,
      k: 'action', t: 'str', v: 'submit'
    }]
  };

  const handled = rt.mqttIncoming(topic, payload);
  assert(handled, 'mqttIncoming should handle the message');

  // Verify IN label written to Model 100 root cell
  const model100 = rt.getModel(100);
  const rootCell = rt.getCell(model100, 0, 0, 0);
  const eventLabel = rootCell.labels.get('event');
  assert(eventLabel, 'event IN label should be written to root cell');
  assert.strictEqual(eventLabel.t, 'IN');

  return { key: 'mqtt_incoming_routes_to_model100', status: 'PASS' };
}

function test_cell_connection_propagates_to_processing_cell() {
  const rt = createConfiguredRuntime();

  // Write IN label to Model 100 (0,0,0) with key='event'
  const model100 = rt.getModel(100);
  rt.addLabel(model100, 0, 0, 0, { k: 'event', t: 'IN', v: { op_id: 'test_route_001' } });

  // Verify cell_connection routed to (1,0,0)
  const procCell = rt.getCell(model100, 1, 0, 0);
  const routedEvent = procCell.labels.get('event');
  assert(routedEvent, 'event should be routed to processing cell (1,0,0)');
  assert.strictEqual(routedEvent.t, 'IN');

  return { key: 'cell_connection_propagates_to_processing_cell', status: 'PASS' };
}

async function test_full_chain_async() {
  const rt = createConfiguredRuntime();

  // Simulate MQTT incoming → full chain
  const topic = 'UIPUT/ws/dam/pic/de/sw/100/event';
  const payload = {
    version: 'mt.v0',
    op_id: 'test_0144_full_001',
    records: [{
      op: 'add_label', model_id: 100, p: 1, r: 0, c: 0,
      k: 'action', t: 'str', v: 'submit'
    }, {
      op: 'add_label', model_id: 100, p: 1, r: 0, c: 0,
      k: 'data', t: 'json', v: { meta: { op_id: 'test_0144_full_001' } }
    }, {
      op: 'add_label', model_id: 100, p: 1, r: 0, c: 0,
      k: 'timestamp', t: 'int', v: Date.now()
    }]
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

  return { key: 'full_chain_async', status: 'PASS' };
}

// --- Run all tests ---
const syncTests = [
  test_patches_load_successfully,
  test_mqtt_wildcard_sub_registered,
  test_cell_connection_routing_declared,
  test_cell_connect_wiring_declared,
  test_mqtt_incoming_routes_to_model100,
  test_cell_connection_propagates_to_processing_cell,
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
