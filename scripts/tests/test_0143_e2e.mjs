/**
 * IT-0143 E2E Integration Test
 *
 * Verifies the full legacy PIN deletion migration:
 * 1. Model 100 loads with new cell_connection + CELL_CONNECT format (no PIN_IN/PIN_OUT)
 * 2. mqttIncoming writes IN to root cell (0,0,0)
 * 3. cell_connection routes IN from (0,0,0) to processing cell (1,0,0)
 * 4. CELL_CONNECT wiring triggers on_model100_event_in function
 * 5. Function output propagates via CELL_CONNECT (self,patch) → cell_connection → (0,0,0)
 * 6. bg_color is updated by the function
 * 7. No legacy PIN symbols remain (pinInSet, pinOutSet, pinInBindings deleted)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function getLabel(rt, modelId, p, r, c, k) {
  const m = rt.getModel(modelId);
  if (!m) return null;
  return rt.getCell(m, p, r, c).labels.get(k) || null;
}

// --- Test 1: Legacy PIN symbols removed ---
function test_no_legacy_pin_symbols() {
  const rt = new ModelTableRuntime();
  assert(rt.pinInSet === undefined, 'pinInSet must not exist');
  assert(rt.pinOutSet === undefined, 'pinOutSet must not exist');
  assert(rt.pinInBindings === undefined, 'pinInBindings must not exist');
  assert(typeof rt._pinKey !== 'function', '_pinKey must not exist');
  assert(typeof rt._parsePinKey !== 'function', '_parsePinKey must not exist');
  assert(typeof rt.resolvePinInRoute !== 'function', 'resolvePinInRoute must not exist');
  assert(typeof rt.findPinInBindingsForDelivery !== 'function', 'findPinInBindingsForDelivery must not exist');
  assert(typeof rt._pinRegistryCellFor !== 'function', '_pinRegistryCellFor must not exist');
  assert(typeof rt._pinMailboxCellFor !== 'function', '_pinMailboxCellFor must not exist');
  assert(typeof rt._applyPinDeclarations !== 'function', '_applyPinDeclarations must not exist');
  assert(typeof rt._applyMailboxTriggers !== 'function', '_applyMailboxTriggers must not exist');
  return { key: 'no_legacy_pin_symbols', status: 'PASS' };
}

// --- Test 2: New architecture symbols present ---
function test_new_arch_symbols() {
  const rt = new ModelTableRuntime();
  assert(rt.busInPorts instanceof Map, 'busInPorts must be a Map');
  assert(rt.busOutPorts instanceof Map, 'busOutPorts must be a Map');
  assert(rt.cellConnectGraph instanceof Map, 'cellConnectGraph must be a Map');
  assert(rt.cellConnectionRoutes instanceof Map, 'cellConnectionRoutes must be a Map');
  assert(rt.parentChildMap instanceof Map, 'parentChildMap must be a Map');
  assert(typeof rt._routeViaCellConnection === 'function', '_routeViaCellConnection must exist');
  assert(typeof rt._propagateCellConnect === 'function', '_propagateCellConnect must exist');
  assert(typeof rt._executeFuncViaCellConnect === 'function', '_executeFuncViaCellConnect must exist');
  assert(typeof rt._handleBusInMessage === 'function', '_handleBusInMessage must exist');
  return { key: 'new_arch_symbols', status: 'PASS' };
}

// --- Test 3: Model 100 loads with new format ---
function test_model100_new_format_load() {
  const rt = new ModelTableRuntime();
  const patchPath = path.resolve(__dirname, '../../packages/worker-base/system-models/test_model_100_full.json');
  const patch = loadJson(patchPath);
  const result = rt.applyPatch(patch, { allowCreateModel: true });
  assert(result.applied > 0, 'patch should apply records');

  // Check cell_connection parsed
  const routeKey = '100|0|0|0|event';
  assert(rt.cellConnectionRoutes.has(routeKey), 'cell_connection route for event must be registered');

  // Check CELL_CONNECT parsed
  const cellKey = '100|1|0|0';
  assert(rt.cellConnectGraph.has(cellKey), 'CELL_CONNECT graph for cell(1,0,0) must be registered');

  // Verify no legacy PIN registry cell usage
  const model100 = rt.getModel(100);
  const registryCell = rt.getCell(model100, 0, 0, 1);
  const hasPin = [...registryCell.labels.values()].some(l => l.t === 'PIN_IN' || l.t === 'PIN_OUT');
  assert(!hasPin, 'no PIN_IN/PIN_OUT labels should exist on registry cell');

  return { key: 'model100_new_format_load', status: 'PASS' };
}

// --- Test 4: IN label triggers cell_connection routing ---
function test_in_triggers_cell_connection() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 50, name: 'test', type: 'test' });
  rt.addLabel(model, 0, 0, 0, {
    k: 'routing',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'cmd'], to: [[1, 0, 0, 'input']] }],
  });

  // Write IN to (0,0,0) — should route to (1,0,0) via cell_connection
  rt.addLabel(model, 0, 0, 0, { k: 'cmd', t: 'pin.in', v: 'hello' });

  const target = rt.getCell(model, 1, 0, 0);
  const label = target.labels.get('input');
  assert(label, 'IN should route via cell_connection to target cell');
  assert.strictEqual(label.t, 'pin.in');
  assert.strictEqual(label.v, 'hello');
  return { key: 'in_triggers_cell_connection', status: 'PASS' };
}

// --- Test 5: Full Model 100 async flow ---
async function test_model100_full_flow() {
  const rt = new ModelTableRuntime();
  const sysPatchPath = path.resolve(__dirname, '../../packages/worker-base/system-models/system_models.json');
  const modelPatchPath = path.resolve(__dirname, '../../packages/worker-base/system-models/test_model_100_full.json');

  rt.applyPatch(loadJson(sysPatchPath), { allowCreateModel: true });
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  rt.applyPatch(loadJson(modelPatchPath), { allowCreateModel: true });

  // Configure MQTT topic mode
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de/sw' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'mt_v0' });

  // Simulate mqtt payload with records-only format
  const topic = 'UIPUT/ws/dam/pic/de/sw/100/event';
  const payload = {
    version: 'mt.v0',
    op_id: 'test_0143_submit_001',
    records: [
      { op: 'add_label', model_id: 100, p: 1, r: 0, c: 0, k: 'action', t: 'str', v: 'submit' },
      { op: 'add_label', model_id: 100, p: 1, r: 0, c: 0, k: 'data', t: 'json', v: null },
      { op: 'add_label', model_id: 100, p: 1, r: 0, c: 0, k: 'timestamp', t: 'str', v: String(Date.now()) },
    ],
  };

  const handled = rt.mqttIncoming(topic, payload);
  assert(handled, 'mqttIncoming must handle the message');

  // Verify IN at root cell
  const rootIn = getLabel(rt, 100, 0, 0, 0, 'event');
  assert(rootIn && rootIn.t === 'pin.in', 'IN label should be at cell(0,0,0)');

  // Verify cell_connection routed to (1,0,0)
  const routedIn = getLabel(rt, 100, 1, 0, 0, 'event');
  assert(routedIn && routedIn.t === 'pin.in', 'IN should route to cell(1,0,0) via cell_connection');

  // Wait for async CELL_CONNECT function execution
  await new Promise(resolve => setTimeout(resolve, 500));

  // Verify function executed: patch OUT at (1,0,0)
  const patchOut = getLabel(rt, 100, 1, 0, 0, 'patch');
  assert(patchOut && patchOut.t === 'OUT', 'function output should be at cell(1,0,0) as OUT');
  assert(patchOut.v && patchOut.v.version === 'mt.v0', 'output must be mt.v0 patch');

  // Verify cell_connection routed patch back to (0,0,0)
  const patchRouted = getLabel(rt, 100, 0, 0, 0, 'patch');
  assert(patchRouted && patchRouted.t === 'pin.in', 'patch should route back to cell(0,0,0) as IN');

  // Verify bg_color updated
  const bg = getLabel(rt, 100, 0, 0, 0, 'bg_color');
  assert(bg && typeof bg.v === 'string' && /^#[0-9a-fA-F]{6}$/.test(bg.v), 'bg_color must be updated');

  return { key: 'model100_full_flow', status: 'PASS' };
}

// --- Run all tests ---
const syncTests = [
  test_no_legacy_pin_symbols,
  test_new_arch_symbols,
  test_model100_new_format_load,
  test_in_triggers_cell_connection,
];

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

// Async test
try {
  const r = await test_model100_full_flow();
  process.stdout.write(`[${r.status}] ${r.key}\n`);
  passed += 1;
} catch (err) {
  process.stdout.write(`[FAIL] test_model100_full_flow: ${err.message}\n`);
  failed += 1;
}

process.stdout.write(`\n${passed} passed, ${failed} failed out of ${passed + failed}\n`);
process.exit(failed > 0 ? 1 : 0);
