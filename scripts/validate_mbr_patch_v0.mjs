#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { WorkerEngineV0, buildWorkerHostApi, loadSystemPatch } from './worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');

const PATCH_PATH = path.resolve('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json');
const RUN_WORKER_PATH = path.resolve('scripts/run_worker_v0.mjs');

let pass = 0;
let fail = 0;

function assert(cond, name) {
  if (cond) {
    pass += 1;
    process.stdout.write(`  PASS  ${name}\n`);
  } else {
    fail += 1;
    process.stdout.write(`  FAIL  ${name}\n`);
  }
}

function getCell(rt, modelId, p, r, c) {
  const model = rt.getModel(modelId);
  if (!model) return null;
  return rt.getCell(model, p, r, c);
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
  return '';
}

function createPatchedRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  const patch = JSON.parse(fs.readFileSync(PATCH_PATH, 'utf8'));
  rt.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
  return rt;
}

function execMbrFunction(rt, name, ctx) {
  const entry = getLabelEntry(rt, -10, 0, 0, 0, name);
  const code = getFunctionCode(entry);
  const fn = new Function('ctx', code);
  fn(ctx);
}

function toExternalPinPacket(rt, label) {
  if (!label || typeof rt._pinBusOutValueToExternalPayload !== 'function') return null;
  return rt._pinBusOutValueToExternalPayload(label.v);
}

function drainWorkerEngine(rt, options = {}) {
  const mqttPublished = [];
  const mgmtPublished = [];
  const engine = new WorkerEngineV0({
    runtime: rt,
    mqttPublish: options.mqttPublish || ((topic, payload) => { mqttPublished.push({ topic, payload }); }),
    mgmtAdapter: options.mgmtAdapter || {
      publish: async (event) => { mgmtPublished.push(event); },
    },
  });
  if (!rt.isRuntimeRunning || !rt.isRuntimeRunning()) {
    if (!rt.getRuntimeMode || rt.getRuntimeMode() === 'boot') rt.setRuntimeMode('edit');
    rt.setRuntimeMode('running');
  }
  engine.tick();
  return { mqttPublished, mgmtPublished };
}

process.stdout.write('\n=== Test Group 1: Patch Loading ===\n');
{
  const rt = createPatchedRuntime();
  assert(rt.getModel(-10) !== undefined, 'system model (-10) exists');
}

process.stdout.write('\n=== Test Group 2: Current Metadata Labels ===\n');
{
  const rt = createPatchedRuntime();
  const expectedPresent = [
    ['mbr_heartbeat_interval_ms', 'int'],
    ['mbr_matrix_event_filter', 'str'],
    ['mbr_matrix_inbox_label', 'str'],
    ['mbr_mqtt_inbox_label', 'str'],
  ];
  for (const [k, t] of expectedPresent) {
    const entry = getLabelEntry(rt, -10, 0, 0, 0, k);
    assert(entry !== null, `label ${k} exists`);
    if (entry) {
      assert(entry.t === t, `label ${k} type=${entry.t} expected=${t}`);
    }
  }

  assert(getLabelEntry(rt, -10, 0, 0, 0, 'mbr_mqtt_model_ids') === null, 'mbr_mqtt_model_ids static list absent');
  assert(getLabel(rt, -10, 0, 0, 0, 'mbr_heartbeat_interval_ms') === 30000, 'mbr_heartbeat_interval_ms = 30000');

  for (const legacyKey of [
    'mbr_matrix_room_id',
    'mbr_mqtt_host',
    'mbr_mqtt_port',
    'mbr_mqtt_user',
    'mbr_mqtt_pass',
    'mbr_remote_model_id',
  ]) {
    assert(getLabelEntry(rt, -10, 0, 0, 0, legacyKey) === null, `legacy dead-config label ${legacyKey} absent`);
  }
}

process.stdout.write('\n=== Test Group 3: Functions Compile ===\n');
{
  const rt = createPatchedRuntime();
  for (const name of ['mbr_mgmt_to_mqtt', 'mbr_mqtt_to_mgmt', 'mbr_heartbeat', 'mbr_ready']) {
    const entry = getLabelEntry(rt, -10, 0, 0, 0, name);
    assert(entry !== null && entry.t === 'func.js', `function ${name} exists`);
    const code = getFunctionCode(entry);
    let compiles = false;
    try {
      new Function('ctx', code);
      compiles = true;
    } catch (err) {
      process.stdout.write(`    compile error ${name}: ${err.message}\n`);
    }
    assert(compiles, `function ${name} compiles`);
  }
}

process.stdout.write('\n=== Test Group 4: Model 100 Bridge ===\n');
{
  const rt = createPatchedRuntime();
  const sys = rt.getModel(-10);
  let published = null;
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_inbox',
    t: 'json',
    v: {
      version: 'v1',
      type: 'pin_payload',
      op_id: 'm100_001',
      source_model_id: 100,
      pin: 'submit',
      route: {
        to: { worker_id: 'RE', model_id: 100, pin: 'submit' },
        reply_to: { worker_id: 'ui-server-test', model_id: 100, pin: 'result' },
      },
      payload: [
        { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
        { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'abc' },
      ],
      timestamp: 1700000000000,
    },
  });
  execMbrFunction(rt, 'mbr_mgmt_to_mqtt', { hostApi: buildWorkerHostApi(rt) });
  const cbOut = getLabelEntry(rt, 0, 0, 0, 0, 'mbr_cb_out');
  const packet = toExternalPinPacket(rt, cbOut);
  assert(cbOut !== null && cbOut.t === 'pin.bus.cb.out', 'model100 bridge writes control-bus out pin');
  assert(packet?.type === 'pin_payload', 'model100 control-bus pin carries pin_payload');
  const drained = drainWorkerEngine(rt);
  published = drained.mqttPublished[0] || null;
  assert(published !== null, 'model100 pin_payload published');
  assert(published.topic === 'UIPUT/ws/dam/pic/de/sw/worker/RE/model/100/pin/submit', 'model100 topic uses route.to worker/model/pin');
  assert(published.payload && published.payload.version === 'v1', 'model100 payload uses pin_payload v1');
  assert(published.payload?.type === 'pin_payload', 'model100 payload preserves pin_payload type');
  assert(published.payload?.pin === 'submit', 'model100 payload preserves submit pin');
  assert(published.payload?.source_model_id === 100, 'model100 payload preserves source_model_id');
  assert(published.payload?.route?.to?.worker_id === 'RE', 'model100 payload preserves route.to');
  assert(Array.isArray(published.payload?.payload), 'model100 payload carries temporary-modeltable array');
}

process.stdout.write('\n=== Test Group 5: Route-Driven Source Model ===\n');
{
  const rt = createPatchedRuntime();
  const sys = rt.getModel(-10);
  let published = null;
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_inbox',
    t: 'json',
    v: {
      version: 'v1',
      type: 'pin_payload',
      op_id: 'route_101_001',
      source_model_id: 101,
      pin: 'task',
      route: {
        to: { worker_id: 'RE', model_id: 3000, pin: 'task' },
        reply_to: { worker_id: 'ui-server-test', model_id: 101, pin: 'result' },
      },
      payload: [
        { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
        { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'abc' },
      ],
      timestamp: 1700000000000,
    },
  });
  execMbrFunction(rt, 'mbr_mgmt_to_mqtt', { hostApi: buildWorkerHostApi(rt) });
  const cbOut = getLabelEntry(rt, 0, 0, 0, 0, 'mbr_cb_out');
  const packet = toExternalPinPacket(rt, cbOut);
  assert(cbOut !== null && cbOut.t === 'pin.bus.cb.out', 'route-driven bridge writes control-bus out pin');
  assert(packet?.type === 'pin_payload', 'route-driven control-bus pin carries pin_payload');
  const drained = drainWorkerEngine(rt);
  published = drained.mqttPublished[0] || null;
  assert(published !== null, 'route-driven pin_payload published');
  assert(published.topic === 'UIPUT/ws/dam/pic/de/sw/worker/RE/model/3000/pin/task', 'route-driven topic uses message route.to');
  assert(published.payload?.version === 'v1', 'route-driven payload uses pin_payload v1');
  assert(published.payload?.source_model_id === 101, 'route-driven payload preserves local source model id');
  assert(published.payload?.route?.reply_to?.model_id === 101, 'route-driven payload preserves reply_to');
  assert(Array.isArray(published.payload?.payload), 'route-driven payload preserves temporary-modeltable array');
}

process.stdout.write('\n=== Test Group 6: Generic CRUD Rejected ===\n');
{
  const rt = createPatchedRuntime();
  const sys = rt.getModel(-10);
  let publishCount = 0;
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_inbox',
    t: 'json',
    v: {
      version: 'v0',
      type: 'snapshot_delta',
      op_id: 'reject_001',
      payload: {
        action: 'label_add',
        target: { model_id: 100, p: 0, r: 0, c: 0, k: 'title' },
        value: { t: 'str', v: 'x' },
      },
    },
  });
  execMbrFunction(rt, 'mbr_mgmt_to_mqtt', {
    hostApi: buildWorkerHostApi(rt),
  });
  assert(publishCount === 0, 'generic CRUD not published');
  assert(getLabel(rt, -10, 0, 0, 0, 'mbr_mgmt_error')?.code === 'direct_model_mutation_disabled', 'generic CRUD writes mbr_mgmt_error');
}

process.stdout.write('\n=== Test Group 7: MQTT -> pin_payload ===\n');
{
  const rt = createPatchedRuntime();
  const sys = rt.getModel(-10);
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mqtt_inbox',
    t: 'json',
    v: {
      topic: 'UIPUT/ws/dam/pic/de/sw/worker/ui-server-local/model/100/pin/result',
      payload: {
        version: 'v1',
        type: 'pin_payload',
        op_id: 'ack_001',
        source_model_id: 100,
        pin: 'result',
        route: { to: { worker_id: 'ui-server-local', model_id: 100, pin: 'result' } },
        payload: [{ id: 0, p: 0, r: 0, c: 0, k: 'bg_color', t: 'str', v: '#fff' }],
      },
    },
  });
  execMbrFunction(rt, 'mbr_mqtt_to_mgmt', {
    hostApi: buildWorkerHostApi(rt),
  });
  const mbOut = getLabelEntry(rt, 0, 0, 0, 0, 'mbr_mb_out');
  const packet = toExternalPinPacket(rt, mbOut);
  assert(mbOut !== null && mbOut.t === 'pin.bus.mb.out', 'mbr_mqtt_to_mgmt writes management-bus out pin');
  assert(packet?.type === 'pin_payload', 'mbr_mqtt_to_mgmt emits pin_payload');
}

process.stdout.write('\n=== Test Group 8: Heartbeat / Ready Local Status ===\n');
{
  const rt = createPatchedRuntime();
  let published = [];
  const engine = new WorkerEngineV0({
    runtime: rt,
    mgmtAdapter: {
      publish: async (event) => {
        published.push(event);
      },
    },
    mqttPublish: null,
  });
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  rt.addLabel(rt.getModel(-10), 0, 0, 0, { k: 'run_mbr_ready', t: 'str', v: '1' });
  rt.addLabel(rt.getModel(-10), 0, 0, 0, { k: 'run_mbr_heartbeat', t: 'str', v: '1' });
  engine.tick();
  assert(published.length === 0, 'mbr_ready and mbr_heartbeat do not publish route-less Matrix packets');
  assert(getLabel(rt, -10, 0, 0, 0, 'mbr_ready_status')?.status === 'ready', 'mbr_ready writes local status');
  assert(getLabel(rt, -10, 0, 0, 0, 'mbr_heartbeat_status')?.status === 'ready', 'mbr_heartbeat writes local status');
}

process.stdout.write('\n=== Test Group 9: Worker Bootstrap Source Contract ===\n');
{
  const src = fs.readFileSync(RUN_WORKER_PATH, 'utf8');
  assert(!src.includes("mbr_matrix_room_id"), 'run_worker_v0 does not read legacy mbr_matrix_room_id');
  assert(!src.includes("mbr_mqtt_host"), 'run_worker_v0 does not read legacy mbr_mqtt_host');
  assert(!src.includes("mbr_mqtt_model_ids"), 'run_worker_v0 does not read static MBR model id subscriptions');
  assert(src.includes('/worker/+/model/+/pin/+'), 'run_worker_v0 subscribes generic worker/model/pin wildcard');
  assert(/if\s*\(!rt\.isRuntimeRunning\(\)\)\s*\{[\s\S]*return;[\s\S]*\}/.test(src), 'run_worker_v0 drops inbound bridge traffic before running');
}

process.stdout.write('\n=== Test Group 10: Split Bus Out Failure Is Observable ===\n');
{
  const rt = createPatchedRuntime();
  const model0 = rt.getModel(0);
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  rt.addLabel(model0, 0, 0, 0, {
    k: 'bad_raw_object_bus_out',
    t: 'pin.bus.cb.out',
    v: {
      version: 'v1',
      type: 'pin_payload',
      op_id: 'raw_object_should_reject',
      source_model_id: 100,
      pin: 'submit',
      payload: [],
      route: { to: { worker_id: 'RE', model_id: 100, pin: 'submit' } },
    },
  });
  const engine = new WorkerEngineV0({
    runtime: rt,
    mqttPublish: () => { throw new Error('raw_object_must_not_publish'); },
    mgmtAdapter: { publish: async () => { throw new Error('raw_object_must_not_publish'); } },
  });
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
    v: [
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'pin_payload.v1' },
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_request_id', t: 'str', v: 'missing_adapter_001' },
      { id: 0, p: 0, r: 0, c: 0, k: 'op_id', t: 'str', v: 'missing_adapter_001' },
      { id: 0, p: 0, r: 0, c: 0, k: 'source_model_id', t: 'int', v: 1036 },
      { id: 0, p: 0, r: 0, c: 0, k: 'pin', t: 'str', v: 'result' },
      { id: 0, p: 0, r: 0, c: 0, k: 'payload', t: 'json', v: [{ id: 0, p: 0, r: 0, c: 0, k: 'reply_text', t: 'str', v: 'x' }] },
      { id: 0, p: 0, r: 0, c: 0, k: 'route', t: 'json', v: { to: { worker_id: 'ui-server-local', model_id: 1036, pin: 'result' } } },
      { id: 0, p: 0, r: 0, c: 0, k: 'timestamp', t: 'int', v: Date.now() },
    ],
  });
  const engine = new WorkerEngineV0({ runtime: rt, mqttPublish: null, mgmtAdapter: null });
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
    v: [
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'pin_payload.v1' },
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_request_id', t: 'str', v: 'rejecting_adapter_001' },
      { id: 0, p: 0, r: 0, c: 0, k: 'op_id', t: 'str', v: 'rejecting_adapter_001' },
      { id: 0, p: 0, r: 0, c: 0, k: 'source_model_id', t: 'int', v: 1036 },
      { id: 0, p: 0, r: 0, c: 0, k: 'pin', t: 'str', v: 'result' },
      { id: 0, p: 0, r: 0, c: 0, k: 'payload', t: 'json', v: [{ id: 0, p: 0, r: 0, c: 0, k: 'reply_text', t: 'str', v: 'x' }] },
      { id: 0, p: 0, r: 0, c: 0, k: 'route', t: 'json', v: { to: { worker_id: 'ui-server-local', model_id: 1036, pin: 'result' } } },
      { id: 0, p: 0, r: 0, c: 0, k: 'timestamp', t: 'int', v: Date.now() },
    ],
  });
  const engine = new WorkerEngineV0({
    runtime: rt,
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
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  rt.addLabel(model0, 0, 0, 0, {
    k: 'same_engine_retry_mb_out',
    t: 'pin.bus.mb.out',
    v: [
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'pin_payload.v1' },
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_request_id', t: 'str', v: 'same_engine_retry_mb_001' },
      { id: 0, p: 0, r: 0, c: 0, k: 'op_id', t: 'str', v: 'same_engine_retry_mb_001' },
      { id: 0, p: 0, r: 0, c: 0, k: 'source_model_id', t: 'int', v: 1036 },
      { id: 0, p: 0, r: 0, c: 0, k: 'pin', t: 'str', v: 'result' },
      { id: 0, p: 0, r: 0, c: 0, k: 'payload', t: 'json', v: [{ id: 0, p: 0, r: 0, c: 0, k: 'reply_text', t: 'str', v: 'x' }] },
      { id: 0, p: 0, r: 0, c: 0, k: 'route', t: 'json', v: { to: { worker_id: 'ui-server-local', model_id: 1036, pin: 'result' } } },
      { id: 0, p: 0, r: 0, c: 0, k: 'timestamp', t: 'int', v: Date.now() },
    ],
  });
  const engine = new WorkerEngineV0({ runtime: rt, mqttPublish: null, mgmtAdapter: null });
  engine.tick();
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'same_engine_retry_mb_out') !== null, 'same-engine retry starts with retained management pin');
  engine.mgmtAdapter = { publish: async (event) => { published.push(event); } };
  engine.tick();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert(published.length === 1, 'same WorkerEngine retries retained management pin after adapter is restored');
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'same_engine_retry_mb_out') === null, 'same-engine management retry removes pin only after success');
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
    v: [
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'pin_payload.v1' },
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_request_id', t: 'str', v: 'same_engine_retry_cb_001' },
      { id: 0, p: 0, r: 0, c: 0, k: 'op_id', t: 'str', v: 'same_engine_retry_cb_001' },
      { id: 0, p: 0, r: 0, c: 0, k: 'source_model_id', t: 'int', v: 100 },
      { id: 0, p: 0, r: 0, c: 0, k: 'pin', t: 'str', v: 'submit' },
      { id: 0, p: 0, r: 0, c: 0, k: 'payload', t: 'json', v: [] },
      { id: 0, p: 0, r: 0, c: 0, k: 'route', t: 'json', v: { to: { worker_id: 'R1', model_id: 3000, pin: 'submit1' } } },
      { id: 0, p: 0, r: 0, c: 0, k: 'timestamp', t: 'int', v: Date.now() },
    ],
  });
  const engine = new WorkerEngineV0({ runtime: rt, mqttPublish: null, mgmtAdapter: null });
  engine.tick();
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'same_engine_retry_cb_out') !== null, 'same-engine retry starts with retained control pin');
  engine.mqttPublish = (topic, packet) => { published.push({ topic, packet }); };
  engine.tick();
  assert(published.length === 1, 'same WorkerEngine retries retained control pin after MQTT adapter is restored');
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'same_engine_retry_cb_out') === null, 'same-engine control retry removes pin only after success');
}

{
  const rt = createPatchedRuntime();
  const model0 = rt.getModel(0);
  let resolveFirst = null;
  const firstPublish = new Promise((resolve) => { resolveFirst = resolve; });
  const published = [];
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const makeValue = (opId, text) => [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'pin_payload.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_request_id', t: 'str', v: opId },
    { id: 0, p: 0, r: 0, c: 0, k: 'op_id', t: 'str', v: opId },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_model_id', t: 'int', v: 1036 },
    { id: 0, p: 0, r: 0, c: 0, k: 'pin', t: 'str', v: 'result' },
    { id: 0, p: 0, r: 0, c: 0, k: 'payload', t: 'json', v: [{ id: 0, p: 0, r: 0, c: 0, k: 'reply_text', t: 'str', v: text }] },
    { id: 0, p: 0, r: 0, c: 0, k: 'route', t: 'json', v: { to: { worker_id: 'ui-server-local', model_id: 1036, pin: 'result' } } },
    { id: 0, p: 0, r: 0, c: 0, k: 'timestamp', t: 'int', v: Date.now() },
  ];
  const engine = new WorkerEngineV0({
    runtime: rt,
    mqttPublish: null,
    mgmtAdapter: {
      publish: (event) => {
        published.push(event);
        return published.length === 1 ? firstPublish : Promise.resolve();
      },
    },
  });
  rt.addLabel(model0, 0, 0, 0, { k: 'same_key_mb_out', t: 'pin.bus.mb.out', v: makeValue('same_key_op_001', 'first') });
  engine.tick();
  rt.addLabel(model0, 0, 0, 0, { k: 'same_key_mb_out', t: 'pin.bus.mb.out', v: makeValue('same_key_op_002', 'second') });
  resolveFirst();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const current = getLabelEntry(rt, 0, 0, 0, 0, 'same_key_mb_out');
  const currentPacket = current ? toExternalPinPacket(rt, current) : null;
  assert(currentPacket?.op_id === 'same_key_op_002', 'first async success must not remove later same-key bus message');
  engine.tick();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert(published.some((event) => event?.op_id === 'same_key_op_002'), 'later same-key bus message remains sendable after first success resolves');
  assert(getLabelEntry(rt, 0, 0, 0, 0, 'same_key_mb_out') === null, 'later same-key bus message is removed only after its own success');
}

process.stdout.write('\n────────────────────────────────────\n');
process.stdout.write(`TOTAL: ${pass + fail}  PASS: ${pass}  FAIL: ${fail}\n`);
process.exitCode = fail > 0 ? 1 : 0;
