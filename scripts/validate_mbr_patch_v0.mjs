#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { WorkerEngineV0, loadSystemPatch } from './worker_engine_v0.mjs';

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

process.stdout.write('\n=== Test Group 1: Patch Loading ===\n');
{
  const rt = createPatchedRuntime();
  assert(rt.getModel(-10) !== undefined, 'system model (-10) exists');
}

process.stdout.write('\n=== Test Group 2: Current Metadata Labels ===\n');
{
  const rt = createPatchedRuntime();
  const expectedPresent = [
    ['mbr_mqtt_model_ids', 'json'],
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

  const mids = getLabel(rt, -10, 0, 0, 0, 'mbr_mqtt_model_ids');
  assert(Array.isArray(mids), 'mbr_mqtt_model_ids is array');
  assert(JSON.stringify(mids) === JSON.stringify([2, 100, 1010, 1019]), 'mbr_mqtt_model_ids = [2,100,1010,1019]');
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
      payload: [
        { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
        { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'abc' },
      ],
      timestamp: 1700000000000,
    },
  });
  execMbrFunction(rt, 'mbr_mgmt_to_mqtt', {
    getLabel: (ref) => getLabel(rt, ref.model_id, ref.p, ref.r, ref.c, ref.k),
    writeLabel: (ref, t, v) => rt.addLabel(rt.getModel(ref.model_id), ref.p, ref.r, ref.c, { k: ref.k, t, v }),
    rmLabel: (ref) => rt.rmLabel(rt.getModel(ref.model_id), ref.p, ref.r, ref.c, ref.k),
    publishMqtt: (topic, payload) => { published = { topic, payload }; },
  });
  assert(published !== null, 'model100 pin_payload published');
  assert(published.topic === 'UIPUT/ws/dam/pic/de/sw/100/submit', 'model100 topic uses /100/submit');
  assert(published.payload && published.payload.version === 'v1', 'model100 payload uses pin_payload v1');
  assert(published.payload?.type === 'pin_payload', 'model100 payload preserves pin_payload type');
  assert(published.payload?.pin === 'submit', 'model100 payload preserves submit pin');
  assert(published.payload?.source_model_id === 100, 'model100 payload preserves source_model_id');
  assert(Array.isArray(published.payload?.payload), 'model100 payload carries temporary-modeltable array');
}

process.stdout.write('\n=== Test Group 5: Route-Driven Source Model ===\n');
{
  const rt = createPatchedRuntime();
  const sys = rt.getModel(-10);
  let published = null;
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_route_101',
    t: 'json',
    v: { pin: 'task', type: 'pin_payload' },
  });
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_inbox',
    t: 'json',
    v: {
      version: 'v1',
      type: 'pin_payload',
      op_id: 'route_101_001',
      source_model_id: 101,
      pin: 'task',
      payload: [
        { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
        { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'abc' },
      ],
      timestamp: 1700000000000,
    },
  });
  execMbrFunction(rt, 'mbr_mgmt_to_mqtt', {
    getLabel: (ref) => getLabel(rt, ref.model_id, ref.p, ref.r, ref.c, ref.k),
    writeLabel: (ref, t, v) => rt.addLabel(rt.getModel(ref.model_id), ref.p, ref.r, ref.c, { k: ref.k, t, v }),
    rmLabel: (ref) => rt.rmLabel(rt.getModel(ref.model_id), ref.p, ref.r, ref.c, ref.k),
    publishMqtt: (topic, payload) => { published = { topic, payload }; },
  });
  assert(published !== null, 'route-driven pin_payload published');
  assert(published.topic === 'UIPUT/ws/dam/pic/de/sw/101/task', 'route-driven topic uses mbr_route_<modelId>.pin');
  assert(published.payload?.version === 'v1', 'route-driven payload uses pin_payload v1');
  assert(published.payload?.source_model_id === 101, 'route-driven payload targets source model id');
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
    getLabel: (ref) => getLabel(rt, ref.model_id, ref.p, ref.r, ref.c, ref.k),
    writeLabel: (ref, t, v) => rt.addLabel(rt.getModel(ref.model_id), ref.p, ref.r, ref.c, { k: ref.k, t, v }),
    rmLabel: (ref) => rt.rmLabel(rt.getModel(ref.model_id), ref.p, ref.r, ref.c, ref.k),
    publishMqtt: () => { publishCount += 1; },
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
      topic: 'UIPUT/ws/dam/pic/de/sw/100/result',
      payload: {
        version: 'v1',
        type: 'pin_payload',
        op_id: 'ack_001',
        source_model_id: 100,
        pin: 'result',
        payload: [{ id: 0, p: 0, r: 0, c: 0, k: 'bg_color', t: 'str', v: '#fff' }],
      },
    },
  });
  execMbrFunction(rt, 'mbr_mqtt_to_mgmt', {
    getLabel: (ref) => getLabel(rt, ref.model_id, ref.p, ref.r, ref.c, ref.k),
    writeLabel: (ref, t, v) => rt.addLabel(rt.getModel(ref.model_id), ref.p, ref.r, ref.c, { k: ref.k, t, v }),
    rmLabel: (ref) => rt.rmLabel(rt.getModel(ref.model_id), ref.p, ref.r, ref.c, ref.k),
  });
  const changeOut = getLabelEntry(rt, -10, 0, 0, 0, 'change_out');
  assert(changeOut !== null && changeOut.t === 'MGMT_OUT', 'mbr_mqtt_to_mgmt writes MGMT_OUT');
  assert(changeOut?.v?.type === 'pin_payload', 'mbr_mqtt_to_mgmt emits pin_payload');
}

process.stdout.write('\n=== Test Group 8: Heartbeat / Ready Publish ===\n');
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
  assert(published.some((event) => event?.type === 'mbr_ready' && String(event.op_id || '').startsWith('mbr_ready_')), 'mbr_ready published to Matrix');
  assert(published.some((event) => event?.type === 'mbr_ready' && String(event.op_id || '').startsWith('mbr_heartbeat_')), 'mbr_heartbeat published to Matrix');
}

process.stdout.write('\n=== Test Group 9: Worker Bootstrap Source Contract ===\n');
{
  const src = fs.readFileSync(RUN_WORKER_PATH, 'utf8');
  assert(!src.includes("mbr_matrix_room_id"), 'run_worker_v0 does not read legacy mbr_matrix_room_id');
  assert(!src.includes("mbr_mqtt_host"), 'run_worker_v0 does not read legacy mbr_mqtt_host');
  assert(/if\s*\(!rt\.isRuntimeRunning\(\)\)\s*\{[\s\S]*return;[\s\S]*\}/.test(src), 'run_worker_v0 drops inbound bridge traffic before running');
}

process.stdout.write('\n────────────────────────────────────\n');
process.stdout.write(`TOTAL: ${pass + fail}  PASS: ${pass}  FAIL: ${fail}\n`);
process.exitCode = fail > 0 ? 1 : 0;
