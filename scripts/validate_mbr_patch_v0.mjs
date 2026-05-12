#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { WorkerEngineV0, buildWorkerHostApi, loadSystemPatch } from './worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');

const PATCH_PATH = path.resolve('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json');
const RUN_WORKER_PATH = path.resolve('scripts/run_worker_v0.mjs');
const TOPIC_BASE = 'UIPUT/ws/dam/pic/de/sw';
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
  payloadRecords = businessPayload(),
  timestamp = 1700000000000,
} = {}) {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', originWorkerId),
    mt('origin_model_id', 'int', originModelId),
    mt('origin_pin', 'str', originPin),
    mt('reply_target_worker_id', 'str', replyTargetWorkerId),
    mt('reply_target_model_id', 'int', replyTargetModelId),
    mt('reply_target_pin', 'str', replyTargetPin),
    mt('payload', 'json', payloadRecords),
    mt('timestamp', 'int', timestamp),
  ];
}

function externalPacket(records) {
  return { version: 'v1', type: 'pin_payload', payload: records };
}

function payloadValue(records, key) {
  return Array.isArray(records) ? records.find((record) => record && record.k === key)?.v : undefined;
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

function execMbrFunction(rt, name, ctx = { hostApi: buildWorkerHostApi(rt) }) {
  const entry = getLabelEntry(rt, -10, 0, 0, 0, name);
  const code = getFunctionCode(entry);
  const fn = new Function('ctx', code);
  fn(ctx);
}

function toExternalPinPacket(rt, labelOrKey) {
  const label = typeof labelOrKey === 'string'
    ? getLabelEntry(rt, 0, 0, 0, 0, labelOrKey)
    : labelOrKey;
  if (!label || typeof rt._pinBusOutValueToExternalPayload !== 'function') return null;
  return rt._pinBusOutValueToExternalPayload(label.v);
}

function drainWorkerEngine(rt, options = {}) {
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
  engine.tick();
  return { engine, mqttPublished, mgmtPublished };
}

function writeMgmtInbox(rt, packet) {
  rt.addLabel(rt.getModel(-10), 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: packet });
}

function writeMqttInbox(rt, topic, packet) {
  rt.addLabel(rt.getModel(-10), 0, 0, 0, { k: 'mbr_mqtt_inbox', t: 'json', v: { topic, payload: packet } });
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
    ['mbr_matrix_inbox_label', 'str'],
    ['mbr_mqtt_inbox_label', 'str'],
  ]) {
    const entry = getLabelEntry(rt, -10, 0, 0, 0, k) || getLabelEntry(rt, 0, 0, 0, 0, k);
    assert(entry !== null, `label ${k} exists`);
    if (entry) assert(entry.t === t, `label ${k} type=${entry.t} expected=${t}`);
  }
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
      new Function('ctx', getFunctionCode(entry));
      compiles = true;
    } catch (err) {
      process.stdout.write(`    compile error ${name}: ${err.message}\n`);
    }
    assert(compiles, `function ${name} compiles`);
  }
}

process.stdout.write('\n=== Test Group 3: Mgmt Bus To Control Bus ===\n');
{
  const rt = createPatchedRuntime();
  writeMgmtInbox(rt, externalPacket(pinPayloadRecords({ opId: 'm100_001' })));
  execMbrFunction(rt, 'mbr_mgmt_to_mqtt');
  const cbOut = getLabelEntry(rt, 0, 0, 0, 0, 'mbr_cb_out');
  assert(cbOut !== null && cbOut.t === 'pin.bus.cb.out', 'mbr_mgmt_to_mqtt writes control-bus out pin');
  assertStrictPacket(toExternalPinPacket(rt, cbOut), 'control-bus out packet');
  const { mqttPublished } = drainWorkerEngine(rt);
  assert(mqttPublished.length === 1, 'control-bus out published once');
  assert(mqttPublished[0]?.topic === `${TOPIC_BASE}/R1/100/submit`, 'control-bus topic uses endpoint worker/model/pin');
  assertStrictPacket(mqttPublished[0]?.payload, 'published control-bus packet');
  assert(payloadValue(mqttPublished[0]?.payload?.payload, 'endpoint_worker_id') === 'R1', 'published packet keeps endpoint_worker_id=R1');
  assert(payloadValue(mqttPublished[0]?.payload?.payload, 'origin_model_id') === 100, 'published packet keeps origin_model_id');
  assert(getLabelEntry(rt, -10, 0, 0, 0, 'mbr_mgmt_inbox') === null, 'management inbox cleaned after bridge');
}

process.stdout.write('\n=== Test Group 4: Route-Independent Endpoint Model ===\n');
{
  const rt = createPatchedRuntime();
  writeMgmtInbox(rt, externalPacket(pinPayloadRecords({
    opId: 'route_101_001',
    endpointWorkerId: 'R1',
    endpointModelId: 3000,
    endpointPin: 'task',
    originModelId: 101,
    replyTargetModelId: 101,
  })));
  execMbrFunction(rt, 'mbr_mgmt_to_mqtt');
  const { mqttPublished } = drainWorkerEngine(rt);
  assert(mqttPublished.length === 1, 'endpoint-directed pin_payload published');
  assert(mqttPublished[0]?.topic === `${TOPIC_BASE}/R1/3000/task`, 'topic is derived only from endpoint records');
  assertStrictPacket(mqttPublished[0]?.payload, 'endpoint-directed packet');
  assert(payloadValue(mqttPublished[0]?.payload?.payload, 'origin_model_id') === 101, 'origin model remains payload metadata');
}

process.stdout.write('\n=== Test Group 5: Generic CRUD Rejected ===\n');
{
  const rt = createPatchedRuntime();
  writeMgmtInbox(rt, {
    version: 'v0',
    type: 'snapshot_delta',
    op_id: 'reject_001',
    payload: { action: 'label_add', target: { model_id: 100, p: 0, r: 0, c: 0, k: 'title' } },
  });
  execMbrFunction(rt, 'mbr_mgmt_to_mqtt');
  assert(drainWorkerEngine(rt).mqttPublished.length === 0, 'generic CRUD not published');
  assert(getLabel(rt, -10, 0, 0, 0, 'mbr_mgmt_error')?.code === 'direct_model_mutation_disabled', 'generic CRUD writes mbr_mgmt_error');
}

process.stdout.write('\n=== Test Group 6: Control Bus To Mgmt Bus ===\n');
{
  const rt = createPatchedRuntime();
  const topic = `${TOPIC_BASE}/ui-server-local/100/result`;
  writeMqttInbox(rt, topic, externalPacket(pinPayloadRecords({
    opId: 'ack_001',
    endpointWorkerId: 'ui-server-local',
    endpointModelId: 100,
    endpointPin: 'result',
    originWorkerId: 'R1',
    originModelId: 100,
    originPin: 'submit',
    replyTargetWorkerId: 'ui-server-local',
    replyTargetModelId: 100,
    replyTargetPin: 'result',
    payloadRecords: [mt('bg_color', 'str', '#fff')],
  })));
  execMbrFunction(rt, 'mbr_mqtt_to_mgmt');
  const mbOut = getLabelEntry(rt, 0, 0, 0, 0, 'mbr_mb_out');
  assert(mbOut !== null && mbOut.t === 'pin.bus.mb.out', 'mbr_mqtt_to_mgmt writes management-bus out pin');
  const packet = toExternalPinPacket(rt, mbOut);
  assertStrictPacket(packet, 'management-bus out packet');
  assert(payloadValue(packet?.payload, 'endpoint_worker_id') === 'ui-server-local', 'management out endpoint is reply target');
  assert(getLabelEntry(rt, -10, 0, 0, 0, 'mbr_mqtt_inbox') === null, 'mqtt inbox cleaned after bridge');
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
      endpointWorkerId: 'ui-server-local',
      endpointModelId: 1036,
      endpointPin: 'result',
      originWorkerId: 'mbr',
      originModelId: 1036,
      originPin: 'submit',
      replyTargetWorkerId: 'ui-server-local',
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
      endpointWorkerId: 'ui-server-local',
      endpointModelId: 1036,
      endpointPin: 'result',
      originWorkerId: 'mbr',
      originModelId: 1036,
      originPin: 'submit',
      replyTargetWorkerId: 'ui-server-local',
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
    endpointWorkerId: 'ui-server-local',
    endpointModelId: 1036,
    endpointPin: 'result',
    originWorkerId: 'mbr',
    originModelId: 1036,
    originPin: 'submit',
    replyTargetWorkerId: 'ui-server-local',
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
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'same_key_mb_out') === null, 'later same-key management bus message is removed only after its own success');
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
}

process.stdout.write('\n----------------------------------------\n');
process.stdout.write(`TOTAL: ${pass + fail}  PASS: ${pass}  FAIL: ${fail}\n`);
process.exitCode = fail > 0 ? 1 : 0;
