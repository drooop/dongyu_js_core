/**
 * IT-0143 E2E Integration Test
 *
 * Verifies the full legacy PIN deletion migration:
 * 1. Model 100 loads with new cell_connection + CELL_CONNECT format (no PIN_IN/PIN_OUT)
 * 2. mqttIncoming writes IN to root cell (0,0,0)
 * 3. cell_connection routes IN from (0,0,0) to processing cell (1,0,0)
 * 4. CELL_CONNECT wiring triggers on_model100_event_in function
 * 5. Function output propagates via CELL_CONNECT function output → cell_connection → (0,0,0)
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

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function pinPayloadRecords({
  opId,
  endpointWorkerId = 'R1',
  endpointModelId = 100,
  endpointPin = 'submit',
  originWorkerId = 'ui-server-test',
  originModelId = 100,
  originPin = 'submit',
  replyTargetWorkerId = 'ui-server-test',
  replyTargetModelId = 100,
  replyTargetPin = 'result',
  messageRole = 'request',
  payload,
  timestamp = 1700000000000,
}) {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', originWorkerId),
    mt('origin_model_id', 'int', originModelId),
    mt('origin_pin', 'str', originPin),
    mt('reply_target_worker_id', 'str', replyTargetWorkerId),
    mt('reply_target_model_id', 'int', replyTargetModelId),
    mt('reply_target_pin', 'str', replyTargetPin),
    mt('payload', 'json', payload),
    mt('timestamp', 'int', timestamp),
  ];
}

function externalPacket(records) {
  return { version: 'v1', type: 'pin_payload', payload: records };
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
  const result = rt.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
  assert(result.applied > 0, 'patch should apply records');

  const cellKey = '100|0|0|0';
  assert(rt.cellConnectGraph.has(cellKey), 'CELL_CONNECT graph for root cell must be registered');
  const graph = rt.cellConnectGraph.get(cellKey);
  assert(graph.has('self:submit'), 'root graph must expose self:submit');
  assert(graph.has('func:on_model100_submit_in:out'), 'root graph must expose function out endpoint');

  return { key: 'model100_new_format_load', status: 'PASS' };
}

// --- Test 4: IN label triggers cell_connection routing ---
function test_in_triggers_cell_connection() {
  const rt = new ModelTableRuntime();
  rt.setRuntimeMode('edit');
  const model = rt.createModel({ id: 50, name: 'test', type: 'test' });
  rt.applyPatch({
    version: 'mt.v0',
    records: [{
      op: 'add_label',
      model_id: model.id,
      p: 0,
      r: 0,
      c: 0,
      k: 'routing',
      t: 'pin.connect.cell',
      v: [{ from: [0, 0, 0, 'cmd'], to: [[1, 0, 0, 'input']] }],
    }],
  }, { trustedBootstrap: true });
  rt.addLabel(model, 0, 0, 0, { k: 'cmd', t: 'pin.in', v: null });
  rt.addLabel(model, 1, 0, 0, { k: 'input', t: 'pin.in', v: null });

  rt.setRuntimeMode('running');
  // Write IN to (0,0,0) — should route to (1,0,0) via cell_connection
  const payload = [{ id: 0, p: 0, r: 0, c: 0, k: 'message', t: 'str', v: 'hello' }];
  rt.addLabel(model, 0, 0, 0, { k: 'cmd', t: 'pin.in', v: payload });

  const target = rt.getCell(model, 1, 0, 0);
  const label = target.labels.get('input');
  assert(label, 'IN should route via cell_connection to target cell');
  assert.strictEqual(label.t, 'pin.in');
  assert.deepStrictEqual(label.v, payload);
  return { key: 'in_triggers_cell_connection', status: 'PASS' };
}

// --- Test 5: Full Model 100 async flow ---
async function test_model100_full_flow() {
  const rt = new ModelTableRuntime();
  const sysPatchPath = path.resolve(__dirname, '../../packages/worker-base/system-models/system_models.json');
  const modelPatchPath = path.resolve(__dirname, '../../packages/worker-base/system-models/test_model_100_full.json');

  rt.applyPatch(loadJson(sysPatchPath), { allowCreateModel: true, trustedBootstrap: true });
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  rt.applyPatch(loadJson(modelPatchPath), { allowCreateModel: true, trustedBootstrap: true });

  // Configure MQTT topic mode
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: 'R1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');

  const topic = 'UIPUT/ws/dam/pic/de/R1/100/submit';
  const payload = externalPacket(pinPayloadRecords({
    opId: 'test_0143_submit_001',
    payload: [
      mt('model_type', 'model.single', 'Data.RemoteSubmit'),
      mt('input_value', 'str', 'hello'),
    ],
  }));

  const handled = rt.mqttIncoming(topic, payload);
  assert(handled, 'mqttIncoming must handle the message');

  // Verify IN at root cell
  const rootIn = getLabel(rt, 100, 0, 0, 0, 'submit');
  assert(rootIn && rootIn.t === 'pin.in', 'IN label should be at cell(0,0,0)');

  // Wait for async CELL_CONNECT function execution
  await new Promise(resolve => setTimeout(resolve, 500));

  const patchOut = getLabel(rt, 100, 0, 0, 0, 'result');
  assert(patchOut && patchOut.t === 'pin.out', 'function output should be at root as pin.out');

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
