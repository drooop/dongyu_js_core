/**
 * IT-0143 E2E Integration Test
 *
 * Verifies the current R1 declared-PIN architecture:
 * 1. Legacy PIN registries and helpers remain deleted.
 * 2. Real R1 patches declare pin.connect.cell and pin.connect.label wiring.
 * 3. Model -10 dispatcher and Model 100 are mounted under the Model 0 worker root.
 * 4. A flat, table-qualified pin_payload.v2 request follows
 *    MQTT -> Model 0 r1_cb_in -> Model -10 dispatcher -> mounted Model 100 submit.
 * 5. Model 100 completes its business behavior and emits a flat pin_payload.v2 response.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  externalPacket,
  mt,
  payloadRecords,
  payloadValue,
  pinPayloadV2Records,
} from '../lib/pin_payload_v2_test_helpers.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const remoteWorkerPatchDir = path.join(repoRoot, 'deploy/sys-v1ns/remote-worker/patches');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadPatches(rt, patchDir) {
  const files = fs.readdirSync(patchDir).filter((file) => file.endsWith('.json')).sort();
  for (const file of files) {
    rt.applyPatch(loadJson(path.join(patchDir, file)), {
      allowCreateModel: true,
      trustedBootstrap: true,
    });
  }
}

function createConfiguredRuntime() {
  const rt = new ModelTableRuntime();
  rt.applyPatch(loadJson(path.join(repoRoot, 'packages/worker-base/system-models/system_models.json')), {
    allowCreateModel: true,
    trustedBootstrap: true,
  });
  loadPatches(rt, remoteWorkerPatchDir);
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  return rt;
}

function getLabel(rt, modelId, p, r, c, key) {
  const model = rt.getModel(modelId);
  return model ? rt.getCell(model, p, r, c).labels.get(key) || null : null;
}

function createModel100Request() {
  const records = pinPayloadV2Records({
    opId: 'test_0143_submit_001',
    endpointWorkerId: 'R1',
    endpointTableId: 'host',
    endpointModelId: 100,
    endpointPin: 'submit',
    originWorkerId: 'ui-server-test',
    originTableId: 'host',
    originModelId: 100,
    originPin: 'submit',
    replyTargetWorkerId: 'ui-server-test',
    replyTargetTableId: 'host',
    replyTargetModelId: 100,
    replyTargetPin: 'result',
    payloadModelId: 1,
    payloadRecords: [
      mt('model_type', 'model.table', 'Data.RemoteSubmit'),
      mt('input_value', 'str', 'hello-0143'),
    ],
    timestamp: 1700000000143,
  });
  return { records, packet: externalPacket(records) };
}

async function waitUntil(predicate, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('timed out waiting for declared PIN propagation');
}

function test_no_legacy_pin_symbols() {
  const rt = new ModelTableRuntime();
  assert.equal(rt.pinInSet, undefined, 'pinInSet must not exist');
  assert.equal(rt.pinOutSet, undefined, 'pinOutSet must not exist');
  assert.equal(rt.pinInBindings, undefined, 'pinInBindings must not exist');
  assert.notEqual(typeof rt._pinKey, 'function', '_pinKey must not exist');
  assert.notEqual(typeof rt._parsePinKey, 'function', '_parsePinKey must not exist');
  assert.notEqual(typeof rt.resolvePinInRoute, 'function', 'resolvePinInRoute must not exist');
  assert.notEqual(typeof rt.findPinInBindingsForDelivery, 'function', 'findPinInBindingsForDelivery must not exist');
  assert.notEqual(typeof rt._pinRegistryCellFor, 'function', '_pinRegistryCellFor must not exist');
  assert.notEqual(typeof rt._pinMailboxCellFor, 'function', '_pinMailboxCellFor must not exist');
  assert.notEqual(typeof rt._applyPinDeclarations, 'function', '_applyPinDeclarations must not exist');
  assert.notEqual(typeof rt._applyMailboxTriggers, 'function', '_applyMailboxTriggers must not exist');
  return { key: 'no_legacy_pin_symbols', status: 'PASS' };
}

function test_real_r1_uses_current_pin_connect_types() {
  const rt = createConfiguredRuntime();
  assert(rt.cellConnectionRoutes instanceof Map, 'pin.connect.cell routes must be registered');
  assert(rt.cellConnectGraph instanceof Map, 'pin.connect.label graph must be registered');

  const ingressRoutes = getLabel(rt, 0, 0, 0, 0, 'r1_dispatch_routes');
  assert.equal(ingressRoutes?.t, 'pin.connect.cell', 'Model 0 ingress must use pin.connect.cell');
  assert.equal(
    ingressRoutes.v.some((route) => JSON.stringify(route.from) === JSON.stringify([0, 0, 0, 'r1_cb_in'])),
    true,
    'Model 0 pin.connect.cell must start at r1_cb_in',
  );

  const dispatcherWiring = getLabel(rt, -10, 0, 0, 0, 'r1_dispatch_wiring');
  assert.equal(dispatcherWiring?.t, 'pin.connect.label', 'Model -10 dispatcher must use pin.connect.label');
  const model100Wiring = getLabel(rt, 100, 0, 0, 0, 'root_routes');
  assert.equal(model100Wiring?.t, 'pin.connect.label', 'Model 100 handler must use pin.connect.label');
  return { key: 'real_r1_uses_current_pin_connect_types', status: 'PASS' };
}

function test_real_r1_mounts_dispatcher_and_model100() {
  const rt = createConfiguredRuntime();
  assert.equal(getLabel(rt, 0, 0, 0, 0, 'model_type')?.t, 'model.v1n', 'R1 root must be model.v1n');
  assert.equal(getLabel(rt, -10, 0, 0, 0, 'model_type')?.t, 'model.submt', 'dispatcher must be model.submt');
  assert.equal(getLabel(rt, 100, 0, 0, 0, 'model_type')?.t, 'model.submt', 'Model 100 must be model.submt');

  const dispatcherMount = rt.parentChildMap.get('host|-10');
  assert.deepEqual(dispatcherMount?.parent, { table_id: 'host', model_id: 0 });
  assert.deepEqual(dispatcherMount?.child, { table_id: 'host', model_id: -10 });
  assert.deepEqual(dispatcherMount?.hostingCell, { p: 1, r: 0, c: 1 });

  const model100Mount = rt.parentChildMap.get('host|100');
  assert.deepEqual(model100Mount?.parent, { table_id: 'host', model_id: 0 });
  assert.deepEqual(model100Mount?.child, { table_id: 'host', model_id: 100 });
  assert.deepEqual(model100Mount?.hostingCell, { p: 1, r: 0, c: 0 });
  assert.equal(
    rt.cellConnectionRoutes.has('host|0|1|0|1|r1_dispatch_100_submit'),
    true,
    'dispatcher output must have a declared route to the mounted Model 100 pin',
  );
  return { key: 'real_r1_mounts_dispatcher_and_model100', status: 'PASS' };
}

function test_request_is_flat_numeric_table_qualified_v2() {
  const { records } = createModel100Request();
  assert.equal(payloadValue(records, '__mt_payload_kind'), 'pin_payload.v2');
  assert.equal(records.every((record) => ['id', 'p', 'r', 'c'].every((key) => Number.isInteger(record[key]))), true);
  assert.equal(records.every((record) => Object.keys(record).sort().join(',') === 'c,id,k,p,r,t,v'), true);
  assert.equal(records.some((record) => record.k === 'payload'), false, 'nested payload record must not exist');
  assert.equal(records.some((record) => typeof record.id === 'string' && record.id.includes('.')), false, 'dotted ids must not exist');
  assert.equal(payloadValue(records, 'endpoint_table_id'), 'host');
  assert.equal(payloadValue(records, 'origin_table_id'), 'host');
  assert.equal(payloadValue(records, 'reply_target_table_id'), 'host');
  assert.equal(payloadValue(records, 'payload_model_id'), 1);
  assert.equal(payloadValue(records, 'model_type', 1), 'Data.RemoteSubmit');
  return { key: 'request_is_flat_numeric_table_qualified_v2', status: 'PASS' };
}

async function test_mqtt_to_model100_declared_pin_chain() {
  const rt = createConfiguredRuntime();
  const { records, packet } = createModel100Request();
  const handled = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/100/submit', packet);
  assert.equal(handled, true, 'MQTT request must be accepted by the declared R1 ingress');

  await waitUntil(() => (
    getLabel(rt, 100, 0, 0, 0, 'status')?.v === 'processed'
    && payloadValue(getLabel(rt, 100, 0, 0, 0, 'result')?.v, '__mt_payload_kind') === 'pin_payload.v2'
  ));

  const chain = [
    [0, 0, 0, 0, 'r1_cb_in', 'pin.bus.cb.in'],
    [0, 1, 0, 1, 'r1_dispatch_in', 'pin.in'],
    [-10, 0, 0, 0, 'r1_dispatch_in', 'pin.in'],
    [-10, 0, 0, 0, 'r1_dispatch_100_submit', 'pin.out'],
    [0, 1, 0, 1, 'r1_dispatch_100_submit', 'pin.out'],
    [0, 1, 0, 0, 'submit', 'pin.in'],
    [100, 0, 0, 0, 'submit', 'pin.in'],
  ];
  for (const [modelId, p, r, c, key, type] of chain) {
    const label = getLabel(rt, modelId, p, r, c, key);
    assert.equal(label?.t, type, `${modelId}:${p},${r},${c}:${key} must carry the declared PIN type`);
    assert.deepEqual(label.v, records, `${modelId}:${p},${r},${c}:${key} must carry the unchanged v2 request`);
  }

  assert.equal(getLabel(rt, 100, 0, 0, 0, 'status')?.v, 'processed');
  const bgColor = getLabel(rt, 100, 0, 0, 0, 'bg_color');
  assert.match(bgColor?.v || '', /^#[0-9a-fA-F]{6}$/, 'Model 100 must complete its color update');

  const result = getLabel(rt, 100, 0, 0, 0, 'result');
  assert.equal(result?.t, 'pin.out', 'Model 100 must emit its declared result pin');
  assert.equal(payloadValue(result.v, '__mt_payload_kind'), 'pin_payload.v2');
  assert.equal(payloadValue(result.v, 'message_role'), 'response');
  assert.equal(payloadValue(result.v, 'endpoint_table_id'), 'host');
  assert.equal(result.v.some((record) => record.k === 'payload'), false, 'response must remain flat');
  const businessResult = payloadRecords(result.v);
  assert.equal(businessResult.some((record) => record.k === 'status' && record.v === 'processed'), true);
  assert.equal(businessResult.some((record) => record.k === 'bg_color' && record.v === bgColor.v), true);

  const busOut = getLabel(rt, 0, 0, 0, 0, 'remote_result_bus');
  assert.equal(busOut?.t, 'pin.bus.cb.out', 'result must return through the declared Model 0 control bus');
  assert.deepEqual(busOut.v, result.v);
  return { key: 'mqtt_to_model100_declared_pin_chain', status: 'PASS' };
}

const tests = [
  test_no_legacy_pin_symbols,
  test_real_r1_uses_current_pin_connect_types,
  test_real_r1_mounts_dispatcher_and_model100,
  test_request_is_flat_numeric_table_qualified_v2,
  test_mqtt_to_model100_declared_pin_chain,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    process.stdout.write(`[${result.status}] ${result.key}\n`);
    passed += 1;
  } catch (error) {
    process.stdout.write(`[FAIL] ${test.name}: ${error.message}\n`);
    failed += 1;
  }
}

process.stdout.write(`\n${passed} passed, ${failed} failed out of ${tests.length}\n`);
process.exit(failed > 0 ? 1 : 0);
