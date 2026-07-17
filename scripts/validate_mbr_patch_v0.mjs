#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { WorkerEngineV0, buildWorkerHostApi, loadSystemPatch } from './worker_engine_v0.mjs';
import {
  DEFAULT_TOPIC_BASE,
  externalPacket,
  payloadRecords,
  payloadValue,
  pinPayloadV2Records,
} from './lib/pin_payload_v2_test_helpers.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');

const PATCH_PATH = path.resolve('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json');
const RUN_WORKER_PATH = path.resolve('scripts/run_worker_v0.mjs');
const TOPIC_BASE = DEFAULT_TOPIC_BASE;
const LEGACY_KEYS = ['source_model_id', 'pin', 'route', 'reply_to', 'route.reply_to', 'return_topic', 'returnTopic', 'result_topic'];

let pass = 0;
let fail = 0;

function assert(cond, name) {
  if (cond) {
    pass += 1;
    process.stdout.write(`  PASS  ${name}\n`);
    return;
  }
  fail += 1;
  process.stdout.write(`  FAIL  ${name}\n`);
}

function getCell(rt, modelId, p, r, c) {
  const model = rt.getModel(modelId);
  return model ? rt.getCell(model, p, r, c) : null;
}

function getLabelEntry(rt, modelId, p, r, c, k) {
  const cell = getCell(rt, modelId, p, r, c);
  return cell ? cell.labels.get(k) || null : null;
}

function getLabel(rt, modelId, p, r, c, k) {
  const entry = getLabelEntry(rt, modelId, p, r, c, k);
  return entry ? entry.v : null;
}

function getFunctionCode(entry) {
  if (!entry) return '';
  if (entry.v && typeof entry.v === 'object' && typeof entry.v.code === 'string') return entry.v.code;
  if (typeof entry.v === 'string') return entry.v;
  return '';
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function businessPayload(text = 'abc') {
  return [
    mt('model_type', 'model.single', 'Data.RemoteSubmit'),
    mt('input_value', 'str', text),
  ];
}

function pinPayloadRecords({
  opId = 'mbr_ok_001',
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
  payloadRecords = businessPayload(),
  timestamp = 1700000000000,
  topic = `${TOPIC_BASE}/${endpointWorkerId}/${endpointModelId}/${endpointPin}`,
  routeKind = 'control',
} = {}) {
  return pinPayloadV2Records({
    opId,
    messageRole,
    endpointWorkerId,
    endpointModelId,
    endpointPin,
    topic,
    routeKind,
    originWorkerId,
    originModelId,
    originPin,
    replyTargetWorkerId,
    replyTargetModelId,
    replyTargetPin,
    payloadRecords,
    timestamp,
  });
}

function withoutPayloadKey(records, key) {
  return records.filter((record) => record.k !== key);
}

function hasLegacy(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasLegacy(item, seen));
  return Object.entries(value).some(([key, child]) => {
    if (LEGACY_KEYS.includes(key)) return true;
    if (key === 'k' && typeof child === 'string' && LEGACY_KEYS.includes(child)) return true;
    return hasLegacy(child, seen);
  });
}

function assertStrictPacket(packet, name) {
  assert(JSON.stringify(Object.keys(packet || {}).sort()) === JSON.stringify(['payload', 'type', 'version']), `${name} exposes only version/type/payload`);
  assert(packet?.version === 'v1', `${name} version is v1`);
  assert(packet?.type === 'pin_payload', `${name} type is pin_payload`);
  assert(Array.isArray(packet?.payload), `${name} payload is ModelTable records`);
  assert(!hasLegacy(packet), `${name} contains no removed legacy metadata`);
}

function createPatchedRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  rt.applyPatch(JSON.parse(fs.readFileSync(PATCH_PATH, 'utf8')), { allowCreateModel: true, trustedBootstrap: true });
  return rt;
}

function execMbrFunction(rt, name, labelValue = null, ctx = null) {
  const entry = getLabelEntry(rt, -10, 0, 0, 0, name);
  const code = getFunctionCode(entry);
  const hostApi = buildWorkerHostApi(rt);
  const V1N = {
    readLabel(p, r, c, k) {
      const result = hostApi.readCrossModel(-10, p, r, c, k);
      return result && result.ok ? result.data : null;
    },
    addLabel(k, t, v) {
      const result = hostApi.writeCrossModel(-10, 0, 0, 0, k, t, v);
      if (!result || result.ok !== true) throw new Error(result?.code || 'v1n_add_failed');
    },
    removeLabel(k) {
      const result = hostApi.rmCrossModel(-10, 0, 0, 0, k);
      if (!result || result.ok !== true) throw new Error(result?.code || 'v1n_remove_failed');
    },
  };
  V1N.table = {
    addLabel(p, r, c, k, t, v) {
      const result = hostApi.writeCrossModel(-10, p, r, c, k, t, v);
      if (!result || result.ok !== true) throw new Error(result?.code || 'v1n_table_add_failed');
    },
    removeLabel(p, r, c, k) {
      const result = hostApi.rmCrossModel(-10, p, r, c, k);
      if (!result || result.ok !== true) throw new Error(result?.code || 'v1n_table_remove_failed');
    },
  };
  const functionContext = ctx || { runtime: rt, hostApi };
  const fn = new Function('ctx', 'label', 'V1N', code);
  return fn(functionContext, { k: name, t: 'pin.in', v: labelValue, sourcePin: null }, V1N);
}

function toExternalPinPacket(rt, labelOrKey) {
  const label = typeof labelOrKey === 'string'
    ? getLabelEntry(rt, 0, 0, 0, 0, labelOrKey)
    : labelOrKey;
  if (!label || typeof rt._pinBusOutValueToExternalPayload !== 'function') return null;
  return rt._pinBusOutValueToExternalPayload(label.v);
}

function createWorkerEngine(rt, options = {}) {
  const mqttPublished = [];
  const mgmtPublished = [];
  const hasMqttPublish = Object.prototype.hasOwnProperty.call(options, 'mqttPublish');
  const hasMgmtAdapter = Object.prototype.hasOwnProperty.call(options, 'mgmtAdapter');
  const engine = new WorkerEngineV0({
    runtime: rt,
    mqttPublish: hasMqttPublish ? options.mqttPublish : ((topic, payload) => { mqttPublished.push({ topic, payload }); }),
    mgmtAdapter: hasMgmtAdapter ? options.mgmtAdapter : { publish: async (event) => { mgmtPublished.push(event); } },
  });
  if (!rt.isRuntimeRunning || !rt.isRuntimeRunning()) {
    if (!rt.getRuntimeMode || rt.getRuntimeMode() === 'boot') rt.setRuntimeMode('edit');
    rt.setRuntimeMode('running');
  }
  return { engine, mqttPublished, mgmtPublished };
}

function drainWorkerEngine(rt, options = {}) {
  const state = createWorkerEngine(rt, options);
  state.engine.tick();
  return state;
}

async function settlePropagation(ms = 40) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeMbrIngress(rt, key, type, packetOrRecords) {
  if (!rt.isRuntimeRunning || !rt.isRuntimeRunning()) {
    if (!rt.getRuntimeMode || rt.getRuntimeMode() === 'boot') rt.setRuntimeMode('edit');
    rt.setRuntimeMode('running');
  }
  const records = Array.isArray(packetOrRecords) ? packetOrRecords : packetOrRecords?.payload;
  const result = rt.addLabel(rt.getModel(0), 0, 0, 0, { k: key, t: type, v: records });
  await settlePropagation();
  return result;
}

function writeManagementIngress(rt, packet) {
  return writeMbrIngress(rt, 'mbr_mb_in', 'pin.bus.mb.in', packet);
}

function writeControlIngress(rt, packet) {
  return writeMbrIngress(rt, 'mbr_cb_in', 'pin.bus.cb.in', packet);
}

function assertManagementIngressChain(rt, records, name = 'management ingress') {
  assert(sameJson(getLabelEntry(rt, 0, 0, 0, 0, 'mbr_mb_in')?.v, records), `${name} lands on Model 0 management BUS_IN`);
  assert(sameJson(getLabelEntry(rt, 0, 1, 0, 0, 'mbr_mb_ingress')?.v, records), `${name} crosses the connection Cell`);
  assert(sameJson(getLabelEntry(rt, -10, 0, 0, 0, 'mbr_mb_ingress')?.v, records), `${name} reaches Model -10 ingress`);
}

function assertControlIngressChain(rt, records, name = 'control ingress') {
  assert(sameJson(getLabelEntry(rt, 0, 0, 0, 0, 'mbr_cb_in')?.v, records), `${name} lands on Model 0 control BUS_IN`);
  assert(sameJson(getLabelEntry(rt, 0, 1, 0, 0, 'mbr_cb_ingress')?.v, records), `${name} crosses the connection Cell`);
  assert(sameJson(getLabelEntry(rt, -10, 0, 0, 0, 'mbr_cb_ingress')?.v, records), `${name} reaches Model -10 ingress`);
}

function busInError(rt) {
  return getLabel(rt, 0, 0, 0, 0, 'bus_in_error');
}

process.stdout.write('\n=== Test Group 1: Patch Loading And Metadata ===\n');
{
  const rt = createPatchedRuntime();
  assert(rt.getModel(-10) !== undefined, 'system model (-10) exists');
  for (const [k, t] of [
    ['sys_worker_role', 'worker.role'],
    ['sys_worker_id', 'worker.id'],
    ['mqtt_topic_mode', 'str'],
    ['mqtt_topic_base', 'str'],
    ['mbr_heartbeat_interval_ms', 'int'],
    ['mbr_matrix_event_filter', 'str'],
    ['mbr_cb_in', 'pin.bus.cb.in'],
    ['mbr_cb_out', 'pin.bus.cb.out'],
    ['mbr_mb_in', 'pin.bus.mb.in'],
    ['mbr_mb_out', 'pin.bus.mb.out'],
    ['mbr_cb_ingress', 'pin.in'],
    ['mbr_mb_ingress', 'pin.in'],
  ]) {
    const entry = getLabelEntry(rt, -10, 0, 0, 0, k) || getLabelEntry(rt, 0, 0, 0, 0, k);
    assert(entry !== null, `label ${k} exists`);
    if (entry) assert(entry.t === t, `label ${k} type=${entry.t} expected=${t}`);
  }
  assert(getLabelEntry(rt, -10, 0, 0, 0, 'mbr_matrix_inbox_label') === null, 'removed mbr_matrix_inbox_label is absent');
  assert(getLabelEntry(rt, -10, 0, 0, 0, 'mbr_mqtt_inbox_label') === null, 'removed mbr_mqtt_inbox_label is absent');
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'mbr_bus_routes')?.t === 'pin.connect.cell', 'Model 0 declares structural MBR bus routes');
  assert(getLabelEntry(rt, -10, 0, 0, 0, 'mbr_dispatch_wiring')?.t === 'pin.connect.label', 'Model -10 declares ingress-to-function wiring');
  assert(getLabelEntry(rt, -10, 0, 0, 0, 'mbr_mqtt_model_ids') === null, 'mbr_mqtt_model_ids static list absent');
  for (const legacyKey of ['mbr_matrix_room_id', 'mbr_mqtt_host', 'mbr_mqtt_port', 'mbr_mqtt_user', 'mbr_mqtt_pass', 'mbr_remote_model_id']) {
    assert(getLabelEntry(rt, -10, 0, 0, 0, legacyKey) === null, `legacy dead-config label ${legacyKey} absent`);
  }
}

process.stdout.write('\n=== Test Group 2: Functions Compile ===\n');
{
  const rt = createPatchedRuntime();
  for (const name of ['mbr_mgmt_to_mqtt', 'mbr_mqtt_to_mgmt', 'mbr_heartbeat', 'mbr_ready']) {
    const entry = getLabelEntry(rt, -10, 0, 0, 0, name);
    assert(entry !== null && entry.t === 'func.js', `function ${name} exists`);
    let compiles = false;
    try {
      new Function('ctx', 'label', 'V1N', getFunctionCode(entry));
      compiles = true;
    } catch (err) {
      process.stdout.write(`    compile error ${name}: ${err.message}\n`);
    }
    assert(compiles, `function ${name} compiles`);
  }
  const directRecords = pinPayloadRecords({ opId: 'direct_func_label_v_001', routeKind: 'management' });
  execMbrFunction(rt, 'mbr_mgmt_to_mqtt', directRecords);
  assert(
    sameJson(getLabelEntry(rt, -10, 0, 0, 0, 'mbr_cb_egress')?.v, directRecords),
    'execMbrFunction passes current func.js input through label.v',
  );
}

process.stdout.write('\n=== Test Group 3: Mgmt Bus To Control Bus ===\n');
{
  const rt = createPatchedRuntime();
  const records = pinPayloadRecords({ opId: 'm100_001', routeKind: 'management' });
  const { engine, mqttPublished } = createWorkerEngine(rt);
  await writeManagementIngress(rt, records);
  assertManagementIngressChain(rt, records);
  const cbOut = getLabelEntry(rt, 0, 0, 0, 0, 'mbr_cb_out');
  assert(cbOut !== null && cbOut.t === 'pin.bus.cb.out', 'mbr_mgmt_to_mqtt writes control-bus out pin');
  assertStrictPacket(toExternalPinPacket(rt, cbOut), 'control-bus out packet');
  engine.tick();
  assert(mqttPublished.length === 1, 'control-bus out published once');
  assert(mqttPublished[0]?.topic === `${TOPIC_BASE}/R1/100/submit`, 'control-bus topic uses payload topic record');
  assertStrictPacket(mqttPublished[0]?.payload, 'published control-bus packet');
  assert(payloadValue(mqttPublished[0]?.payload?.payload, 'endpoint_worker_id') === 'R1', 'published packet keeps endpoint_worker_id=R1');
  assert(payloadValue(mqttPublished[0]?.payload?.payload, 'origin_model_id') === 100, 'published packet keeps origin_model_id');
  assert(payloadValue(mqttPublished[0]?.payload?.payload, '__mt_payload_kind') === 'pin_payload.v2', 'published packet keeps pin_payload.v2 kind');
  assert(payloadValue(mqttPublished[0]?.payload?.payload, 'payload') === undefined, 'published packet does not carry nested payload label');
  assert(payloadRecords(mqttPublished[0]?.payload?.payload).some((record) => record.k === 'input_value'), 'published packet keeps business payload records by payload_model_id');
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'mbr_cb_out')?.t === 'pin.bus.cb.out', 'structural control-bus out pin remains declared after publish');
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'mbr_cb_out')?.v === null, 'structural control-bus out pin is acknowledged with null');
}

process.stdout.write('\n=== Test Group 4: Route-Independent Endpoint Model ===\n');
{
  const rt = createPatchedRuntime();
  const records = pinPayloadRecords({
    opId: 'route_101_001',
    endpointWorkerId: 'R1',
    endpointModelId: 3000,
    endpointPin: 'task',
    originModelId: 101,
    replyTargetModelId: 101,
    routeKind: 'management',
  });
  const { engine, mqttPublished } = createWorkerEngine(rt);
  await writeManagementIngress(rt, records);
  assertManagementIngressChain(rt, records, 'route-independent management ingress');
  engine.tick();
  assert(mqttPublished.length === 1, 'endpoint-directed pin_payload published');
  assert(mqttPublished[0]?.topic === `${TOPIC_BASE}/R1/3000/task`, 'topic comes from payload topic record');
  assertStrictPacket(mqttPublished[0]?.payload, 'endpoint-directed packet');
  assert(payloadValue(mqttPublished[0]?.payload?.payload, 'origin_model_id') === 101, 'origin model remains payload metadata');
}

process.stdout.write('\n=== Test Group 5: Generic CRUD Rejected ===\n');
{
  const rt = createPatchedRuntime();
  const state = createWorkerEngine(rt);
  const write = await writeManagementIngress(rt, {
    version: 'v0',
    type: 'snapshot_delta',
    op_id: 'reject_001',
    payload: { action: 'label_add', target: { model_id: 100, p: 0, r: 0, c: 0, k: 'title' } },
  });
  state.engine.tick();
  assert(write?.applied === false, 'generic CRUD is rejected at the structural management ingress');
  assert(state.mqttPublished.length === 0, 'generic CRUD not published');
  assert(typeof busInError(rt)?.code === 'string', 'generic CRUD rejection is visible on Model 0');
}

process.stdout.write('\n=== Test Group 5a: Non-Canonical Topic Rejected Before Publish ===\n');
for (const [name, topic] of [
  ['zero model', `${TOPIC_BASE}/R1/0/submit`],
  ['leading zero model', `${TOPIC_BASE}/R1/0100/submit`],
]) {
  const rt = createPatchedRuntime();
  const state = createWorkerEngine(rt);
  const write = await writeManagementIngress(rt, pinPayloadRecords({ opId: `bad_topic_${name.replaceAll(' ', '_')}`, topic, routeKind: 'management' }));
  state.engine.tick();
  assert(write?.applied === false, `structural management ingress rejects ${name} topic`);
  assert(state.mqttPublished.length === 0, `mbr_mgmt_to_mqtt rejects ${name} topic before MQTT publish`);
  assert(typeof busInError(rt)?.code === 'string', `mbr_mgmt_to_mqtt writes visible error for ${name} topic`);
  assert((getLabelEntry(rt, 0, 0, 0, 0, 'mbr_cb_out')?.v ?? null) === null, `${name} topic never reaches structural control egress`);
}

process.stdout.write('\n=== Test Group 5c: Missing Table-Qualified Refs Rejected ===\n');
for (const missingKey of ['endpoint_table_id', 'origin_table_id', 'reply_target_table_id']) {
  const rt = createPatchedRuntime();
  const state = createWorkerEngine(rt);
  const write = await writeManagementIngress(rt, withoutPayloadKey(pinPayloadRecords({ opId: `missing_${missingKey}`, routeKind: 'management' }), missingKey));
  state.engine.tick();
  assert(write?.applied === false, `mbr_mgmt_to_mqtt rejects missing ${missingKey}`);
  assert(state.mqttPublished.length === 0, `missing ${missingKey} is not published`);
  assert(typeof busInError(rt)?.code === 'string', `mbr_mgmt_to_mqtt writes visible error for missing ${missingKey}`);
  assert((getLabelEntry(rt, 0, 0, 0, 0, 'mbr_cb_out')?.v ?? null) === null, `missing ${missingKey} never reaches control egress`);
}

for (const missingKey of ['endpoint_table_id', 'origin_table_id', 'reply_target_table_id']) {
  const rt = createPatchedRuntime();
  const topic = `${TOPIC_BASE}/U1/100/result`;
  const state = createWorkerEngine(rt);
  const write = await writeControlIngress(rt, withoutPayloadKey(pinPayloadRecords({
    opId: `missing_mqtt_${missingKey}`,
    messageRole: 'response',
    topic,
    endpointWorkerId: 'U1',
    endpointModelId: 100,
    endpointPin: 'result',
    originWorkerId: 'R1',
    originModelId: 100,
    originPin: 'submit',
    replyTargetWorkerId: 'U1',
    replyTargetModelId: 100,
    replyTargetPin: 'result',
    payloadRecords: [mt('bg_color', 'str', '#fff')],
  }), missingKey));
  state.engine.tick();
  assert(write?.applied === false, `control ingress rejects missing ${missingKey}`);
  assert((getLabelEntry(rt, 0, 0, 0, 0, 'mbr_cb_out')?.v ?? null) === null, `mbr_mqtt_to_mgmt rejects missing ${missingKey}`);
  assert(typeof busInError(rt)?.code === 'string', `mbr_mqtt_to_mgmt writes visible error for missing ${missingKey}`);
}

process.stdout.write('\n=== Test Group 5b: MBR Destination Uses Structural Management Chain ===\n');
{
  const rt = createPatchedRuntime();
  const records = pinPayloadRecords({
    opId: 'mbr_dispatch_no_direct_ack',
    endpointWorkerId: 'mbr',
    endpointModelId: 1036,
    endpointPin: 'submit',
    originWorkerId: 'ui-server-test',
    originModelId: 1036,
    originPin: 'submit',
    replyTargetWorkerId: 'ui-server-test',
    replyTargetModelId: 1036,
    replyTargetPin: 'result',
    routeKind: 'management',
    payloadRecords: [
      mt('__mt_payload_kind', 'str', 'mgmt_bus_console.send.v1'),
      mt('target_user_id', 'str', '@mbr:localhost'),
      mt('draft', 'str', 'hello mbr dispatch'),
    ],
  });
  const { engine, mqttPublished } = createWorkerEngine(rt);
  await writeManagementIngress(rt, records);
  assertManagementIngressChain(rt, records, 'MBR-destination management ingress');
  assert((getLabelEntry(rt, 0, 0, 0, 0, 'mbr_mb_out')?.v ?? null) === null, 'mbr_mgmt_dispatch must not directly emit management-bus responses');
  assert(getLabelEntry(rt, -10, 0, 0, 0, 'run_mbr_mgmt_to_mqtt') === null, 'management forwarding does not depend on a run trigger');
  engine.tick();
  assert(mqttPublished.length === 1, 'MBR-destination request is forwarded once through structural control egress');
  assert(mqttPublished[0]?.topic === `${TOPIC_BASE}/mbr/1036/submit`, 'MBR-destination request keeps its endpoint topic');
}

process.stdout.write('\n=== Test Group 6: Control Ingress Routing ===\n');
{
  const rt = createPatchedRuntime();
  const topic = `${TOPIC_BASE}/U1/100/result`;
  const state = createWorkerEngine(rt);
  const records = pinPayloadRecords({
    opId: 'ack_001',
    messageRole: 'response',
    topic,
    endpointWorkerId: 'U1',
    endpointModelId: 100,
    endpointPin: 'result',
    originWorkerId: 'R1',
    originModelId: 100,
    originPin: 'submit',
    replyTargetWorkerId: 'U1',
    replyTargetModelId: 100,
    replyTargetPin: 'result',
    payloadRecords: [mt('bg_color', 'str', '#fff')],
  });
  await writeControlIngress(rt, records);
  assertControlIngressChain(rt, records);
  state.engine.tick();
  assert((getLabelEntry(rt, 0, 0, 0, 0, 'mbr_cb_out')?.v ?? null) === null, 'direct control response is not echoed to control-bus out');
  assert((getLabelEntry(rt, 0, 0, 0, 0, 'mbr_mb_out')?.v ?? null) === null, 'direct control response is not bridged to management bus');
  assert(state.mqttPublished.length === 0, 'direct control response is not republished to MQTT');
  assert(state.mgmtPublished.length === 0, 'direct control response is not published to Matrix');
  assert(getLabel(rt, -10, 0, 0, 0, 'mbr_mqtt_error')?.detail === 'invalid_response_route', 'direct control response rejection is visible in Model -10');
}

{
  const rt = createPatchedRuntime();
  const topic = `${TOPIC_BASE}/U1/1036/result`;
  const records = pinPayloadRecords({
    opId: 'management_response_001',
    messageRole: 'response',
    routeKind: 'management',
    topic,
    endpointWorkerId: 'U1',
    endpointModelId: 1036,
    endpointPin: 'result',
    originWorkerId: 'mbr',
    originModelId: 1036,
    originPin: 'submit',
    replyTargetWorkerId: 'U1',
    replyTargetModelId: 1036,
    replyTargetPin: 'result',
    payloadRecords: [mt('reply_text', 'str', 'management response')],
  });
  const { engine, mqttPublished, mgmtPublished } = createWorkerEngine(rt);
  await writeControlIngress(rt, records);
  assertControlIngressChain(rt, records, 'management response control ingress');
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'mbr_mb_out')?.t === 'pin.bus.mb.out', 'management response reaches structural management-bus out pin');
  engine.tick();
  await settlePropagation(20);
  assert(mqttPublished.length === 0, 'management response does not publish to MQTT');
  assert(mgmtPublished.length === 1, 'management response publishes once through management adapter');
  assertStrictPacket(mgmtPublished[0], 'published management-bus packet');
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'mbr_mb_out')?.t === 'pin.bus.mb.out', 'structural management-bus out pin remains declared after publish');
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'mbr_mb_out')?.v === null, 'structural management-bus out pin is acknowledged with null');
}

{
  const rt = createPatchedRuntime();
  const topic = `${TOPIC_BASE}/R1/100/submit`;
  const records = pinPayloadRecords({ opId: 'request_echo_001' });
  await writeControlIngress(rt, records);
  assertControlIngressChain(rt, records, 'request echo control ingress');
  assert((getLabelEntry(rt, 0, 0, 0, 0, 'mbr_mb_out')?.v ?? null) === null, 'request echo on endpoint topic is not forwarded to management bus');
  assert(getLabel(rt, -10, 0, 0, 0, 'mbr_mqtt_error')?.detail === 'invalid_response_route', 'request echo rejection is visible in Model -10');
}

{
  for (const [name, topic] of [
    ['zero model', `${TOPIC_BASE}/R1/0/submit`],
    ['leading zero model', `${TOPIC_BASE}/R1/0100/submit`],
  ]) {
    const rt = createPatchedRuntime();
    const state = createWorkerEngine(rt);
    const write = await writeControlIngress(rt, pinPayloadRecords({
      opId: `bad_mqtt_topic_${name.replaceAll(' ', '_')}`,
      topic,
      messageRole: 'response',
    }));
    state.engine.tick();
    assert(write?.applied === false, `structural control ingress rejects ${name} topic`);
    assert((getLabelEntry(rt, 0, 0, 0, 0, 'mbr_cb_out')?.v ?? null) === null, `mbr_mqtt_to_mgmt rejects ${name} topic before control out`);
    assert(typeof busInError(rt)?.code === 'string', `mbr_mqtt_to_mgmt writes visible error for ${name} topic`);
  }
}

process.stdout.write('\n=== Test Group 7: Heartbeat / Ready Local Status ===\n');
{
  const rt = createPatchedRuntime();
  const { engine, mgmtPublished } = drainWorkerEngine(rt, { mqttPublish: null });
  rt.addLabel(rt.getModel(-10), 0, 0, 0, { k: 'run_mbr_ready', t: 'str', v: '1' });
  rt.addLabel(rt.getModel(-10), 0, 0, 0, { k: 'run_mbr_heartbeat', t: 'str', v: '1' });
  engine.tick();
  assert(mgmtPublished.length === 0, 'mbr_ready and mbr_heartbeat do not publish route-less Matrix packets');
  assert(getLabel(rt, -10, 0, 0, 0, 'mbr_ready_status')?.status === 'ready', 'mbr_ready writes local status');
  assert(getLabel(rt, -10, 0, 0, 0, 'mbr_heartbeat_status')?.status === 'ready', 'mbr_heartbeat writes local status');
}

process.stdout.write('\n=== Test Group 8: Worker Bootstrap Source Contract ===\n');
{
  const src = fs.readFileSync(RUN_WORKER_PATH, 'utf8');
  assert(!src.includes("mbr_matrix_room_id"), 'run_worker_v0 does not read legacy mbr_matrix_room_id');
  assert(!src.includes("mbr_mqtt_model_ids"), 'run_worker_v0 does not read static MBR model id subscriptions');
  assert(!src.includes('/worker/+/model/+/pin/+'), 'run_worker_v0 does not subscribe old worker/model/pin wildcard');
  assert(src.includes('${base}/+/+/+'), 'run_worker_v0 subscribes unified worker/model/pin wildcard');
  assert(/if\s*\(!rt\.isRuntimeRunning\(\)\)\s*\{[\s\S]*return;[\s\S]*\}/.test(src), 'run_worker_v0 drops inbound bridge traffic before running');
}

process.stdout.write('\n=== Test Group 9: Split Bus Failure And Retry ===\n');
{
  const rt = createPatchedRuntime();
  const model0 = rt.getModel(0);
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  rt.addLabel(model0, 0, 0, 0, {
    k: 'bad_raw_object_bus_out',
    t: 'pin.bus.cb.out',
    v: { version: 'v1', type: 'pin_payload', source_model_id: 100, payload: [] },
  });
  const { engine } = drainWorkerEngine(rt, { mqttPublish: () => { throw new Error('raw_object_must_not_publish'); } });
  engine.tick();
  assert(getLabel(rt, 0, 0, 0, 0, 'split_bus_out_error')?.code === 'invalid_split_bus_payload', 'invalid raw object bus out writes observable error');
}

{
  const rt = createPatchedRuntime();
  const model0 = rt.getModel(0);
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  rt.addLabel(model0, 0, 0, 0, {
    k: 'missing_adapter_bus_out',
    t: 'pin.bus.mb.out',
    v: pinPayloadRecords({
      opId: 'missing_adapter_001',
      messageRole: 'response',
      endpointWorkerId: 'U1',
      endpointModelId: 1036,
      endpointPin: 'result',
      originWorkerId: 'mbr',
      originModelId: 1036,
      originPin: 'submit',
      replyTargetWorkerId: 'U1',
      replyTargetModelId: 1036,
      replyTargetPin: 'result',
      payloadRecords: [mt('reply_text', 'str', 'x')],
    }),
  });
  const { engine } = drainWorkerEngine(rt, { mqttPublish: null, mgmtAdapter: null });
  engine.tick();
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'missing_adapter_bus_out') !== null, 'unsent management bus out is retained when adapter missing');
  assert(getLabel(rt, 0, 0, 0, 0, 'split_bus_out_error')?.code === 'missing_split_bus_mgmt_adapter', 'missing management adapter writes observable error');
}

{
  const rt = createPatchedRuntime();
  const model0 = rt.getModel(0);
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  rt.addLabel(model0, 0, 0, 0, {
    k: 'rejecting_adapter_bus_out',
    t: 'pin.bus.mb.out',
    v: pinPayloadRecords({
      opId: 'rejecting_adapter_001',
      messageRole: 'response',
      endpointWorkerId: 'U1',
      endpointModelId: 1036,
      endpointPin: 'result',
      originWorkerId: 'mbr',
      originModelId: 1036,
      originPin: 'submit',
      replyTargetWorkerId: 'U1',
      replyTargetModelId: 1036,
      replyTargetPin: 'result',
      payloadRecords: [mt('reply_text', 'str', 'x')],
    }),
  });
  const { engine } = drainWorkerEngine(rt, {
    mqttPublish: null,
    mgmtAdapter: { publish: async () => { throw new Error('matrix down'); } },
  });
  engine.tick();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'rejecting_adapter_bus_out') !== null, 'rejected management bus out is retained for retry');
  assert(getLabel(rt, 0, 0, 0, 0, 'split_bus_out_error')?.code === 'split_bus_mgmt_publish_failed', 'rejected management adapter publish writes observable error');
  const retried = [];
  engine.mgmtAdapter = { publish: async (packet) => { retried.push(packet); } };
  engine.tick();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert(retried.length === 1, 'same WorkerEngine retries retained management pin after adapter replacement');
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'rejecting_adapter_bus_out') === null, 'retried dynamic management pin is removed after success');
}

{
  const rt = createPatchedRuntime();
  const model0 = rt.getModel(0);
  const published = [];
  let resolveFirst = null;
  const firstPublish = new Promise((resolve) => { resolveFirst = resolve; });
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const makeMgmtValue = (opId, text) => pinPayloadRecords({
    opId,
    messageRole: 'response',
    endpointWorkerId: 'U1',
    endpointModelId: 1036,
    endpointPin: 'result',
    originWorkerId: 'mbr',
    originModelId: 1036,
    originPin: 'submit',
    replyTargetWorkerId: 'U1',
    replyTargetModelId: 1036,
    replyTargetPin: 'result',
    payloadRecords: [mt('reply_text', 'str', text)],
  });
  rt.addLabel(model0, 0, 0, 0, { k: 'same_key_mb_out', t: 'pin.bus.mb.out', v: makeMgmtValue('same_key_op_001', 'first') });
  const { engine } = drainWorkerEngine(rt, {
    mqttPublish: null,
    mgmtAdapter: {
      publish: (packet) => {
        published.push(packet);
        return published.length === 1 ? firstPublish : Promise.resolve();
      },
    },
  });
  rt.addLabel(model0, 0, 0, 0, { k: 'same_key_mb_out', t: 'pin.bus.mb.out', v: makeMgmtValue('same_key_op_002', 'second') });
  resolveFirst();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const current = getLabelEntry(rt, 0, 0, 0, 0, 'same_key_mb_out');
  const currentPacket = current ? toExternalPinPacket(rt, current) : null;
  assert(payloadValue(currentPacket?.payload, 'op_id') === 'same_key_op_002', 'first async success must not remove later same-key management bus message');
  engine.tick();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert(published.some((packet) => payloadValue(packet?.payload, 'op_id') === 'same_key_op_002'), 'later same-key management bus message remains sendable after first success resolves');
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'same_key_mb_out') === null, 'later dynamic same-key management message is removed only after its own success');
  const publishedAfterAck = published.length;
  engine.tick();
  assert(published.length === publishedAfterAck, 'removed management bus pin does not republish on an idle tick');
}

{
  const rt = createPatchedRuntime();
  const model0 = rt.getModel(0);
  const published = [];
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  rt.addLabel(model0, 0, 0, 0, {
    k: 'same_engine_retry_cb_out',
    t: 'pin.bus.cb.out',
    v: pinPayloadRecords({ opId: 'same_engine_retry_cb_001', endpointWorkerId: 'R1', endpointModelId: 3000, endpointPin: 'submit1' }),
  });
  const { engine } = drainWorkerEngine(rt, { mqttPublish: null, mgmtAdapter: null });
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'same_engine_retry_cb_out') !== null, 'same-engine retry starts with retained control pin');
  engine.mqttPublish = (topic, packet) => { published.push({ topic, packet }); };
  engine.tick();
  assert(published.length === 1, 'same WorkerEngine retries retained control pin after MQTT adapter is restored');
  assert(published[0]?.topic === `${TOPIC_BASE}/R1/3000/submit1`, 'retry publishes unified topic');
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'same_engine_retry_cb_out') === null, 'same-engine control retry removes pin only after success');
  engine.tick();
  assert(published.length === 1, 'removed dynamic control pin remains one-shot on later idle ticks');
}

process.stdout.write('\n----------------------------------------\n');
process.stdout.write(`TOTAL: ${pass + fail}  PASS: ${pass}  FAIL: ${fail}\n`);
process.exitCode = fail > 0 ? 1 : 0;
