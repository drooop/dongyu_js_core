/**
 * Validate MBR Role Patch v0
 *
 * Tests that the patch-driven MBR (mbr_role_v0.json) produces identical
 * behaviour to the hardcoded run_worker_mbr_v0.mjs implementation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { WorkerEngineV0, loadSystemPatch } from './worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');

const PATCH_PATH = path.resolve('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json');

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

function getLabel(rt, modelId, p, r, c, k) {
  const model = rt.getModel(modelId);
  if (!model) return null;
  const cell = rt.getCell(model, p, r, c);
  const label = cell.labels.get(k);
  return label ? label.v : null;
}

function getLabelEntry(rt, modelId, p, r, c, k) {
  const model = rt.getModel(modelId);
  if (!model) return null;
  const cell = rt.getCell(model, p, r, c);
  return cell.labels.get(k) || null;
}

function createPatchedRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  const patch = JSON.parse(fs.readFileSync(PATCH_PATH, 'utf-8'));
  rt.applyPatch(patch, { allowCreateModel: true });
  return rt;
}

// ── Test 1: Patch loads successfully ────────────────────────────────────────

process.stdout.write('\n=== Test Group 1: Patch Loading ===\n');

const rt1 = createPatchedRuntime();
const sys1 = rt1.getModel(-10);
assert(sys1 !== null, 'system model (-10) exists');

// ── Test 2: Connection parameter labels ─────────────────────────────────────

process.stdout.write('\n=== Test Group 2: Connection Parameter Labels ===\n');

const expectedConfigs = [
  ['mbr_matrix_room_id', 'str', ''],
  ['mbr_mqtt_host', 'str', '127.0.0.1'],
  ['mbr_mqtt_port', 'int', 1883],
  ['mbr_mqtt_user', 'str', 'u'],
  ['mbr_mqtt_pass', 'str', 'p'],
  ['mbr_remote_model_id', 'int', 2],
  ['mbr_heartbeat_interval_ms', 'int', 30000],
];
for (const [k, t, v] of expectedConfigs) {
  const entry = getLabelEntry(rt1, -10, 0, 0, 0, k);
  assert(entry !== null, `label ${k} exists`);
  if (entry) {
    assert(entry.t === t, `label ${k} type=${entry.t} expected=${t}`);
    assert(entry.v === v, `label ${k} value=${JSON.stringify(entry.v)} expected=${JSON.stringify(v)}`);
  }
}

// mqtt_model_ids is json array
const mids = getLabel(rt1, -10, 0, 0, 0, 'mbr_mqtt_model_ids');
assert(Array.isArray(mids), 'mbr_mqtt_model_ids is array');
assert(mids && mids.length === 2 && mids[0] === 2 && mids[1] === 100, 'mbr_mqtt_model_ids = [2, 100]');

// ── Test 3: Event routing labels ────────────────────────────────────────────

process.stdout.write('\n=== Test Group 3: Event Routing Labels ===\n');

const expectedRouting = [
  ['mbr_matrix_event_filter', 'ui_event'],
  ['mbr_matrix_inbox_label', 'mbr_mgmt_inbox'],
  ['mbr_matrix_trigger', 'run_mbr_mgmt_to_mqtt'],
  ['mbr_mqtt_inbox_label', 'mbr_mqtt_inbox'],
  ['mbr_mqtt_trigger', 'run_mbr_mqtt_to_mgmt'],
];
for (const [k, v] of expectedRouting) {
  const val = getLabel(rt1, -10, 0, 0, 0, k);
  assert(val === v, `${k} = '${val}' expected '${v}'`);
}

// ── Test 4: Business functions exist and are executable ─────────────────────

process.stdout.write('\n=== Test Group 4: Business Functions ===\n');

const expectedFunctions = ['mbr_mgmt_to_mqtt', 'mbr_mqtt_to_mgmt', 'mbr_heartbeat', 'mbr_ready'];
for (const name of expectedFunctions) {
  const entry = getLabelEntry(rt1, -10, 0, 0, 0, name);
  assert(entry !== null && entry.t === 'function', `function ${name} exists`);
  assert(typeof entry.v === 'string' && entry.v.length > 0, `function ${name} has code`);
  // Verify it compiles
  let compiles = false;
  try {
    new Function('ctx', entry.v);
    compiles = true;
  } catch (err) {
    process.stdout.write(`    compile error: ${err.message}\n`);
  }
  assert(compiles, `function ${name} compiles`);
}

// ── Test 5: mbr_mgmt_to_mqtt — ui_event conversion ─────────────────────────

process.stdout.write('\n=== Test Group 5: mbr_mgmt_to_mqtt (ui_event) ===\n');

{
  const rt = createPatchedRuntime();
  const sys = rt.getModel(-10);
  let publishedTopic = null;
  let publishedPayload = null;

  const engine = new WorkerEngineV0({
    runtime: rt,
    mgmtAdapter: null,
    mqttPublish: (topic, payload) => {
      publishedTopic = topic;
      publishedPayload = payload;
    },
  });

  // Simulate Matrix ui_event arriving
  const uiEvent = {
    version: 'v0',
    type: 'ui_event',
    op_id: 'test_op_001',
    action: 'label_update',
    data: { meta: { op_id: 'test_op_001' }, target: { model_id: 2, p: 0, r: 0, c: 0, k: 'title' }, value: { t: 'str', v: 'Hello' } },
    timestamp: Date.now(),
  };

  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: uiEvent });
  rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_mgmt_to_mqtt', t: 'str', v: '1' });
  engine.tick();

  assert(publishedTopic !== null, 'MQTT publish was called');
  assert(publishedTopic === 'UIPUT/ws/dam/pic/de/sw/2/patch_in', `topic=${publishedTopic} expected UIPUT/ws/dam/pic/de/sw/2/patch_in`);
  assert(publishedPayload && publishedPayload.version === 'mt.v0', 'payload is mt.v0');
  assert(publishedPayload && publishedPayload.op_id === 'test_op_001', 'payload has correct op_id');
  assert(publishedPayload && Array.isArray(publishedPayload.records) && publishedPayload.records.length === 1, 'payload has 1 record');
  if (publishedPayload && publishedPayload.records && publishedPayload.records[0]) {
    const rec = publishedPayload.records[0];
    assert(rec.op === 'add_label', 'record op=add_label');
    assert(rec.model_id === 2, 'record model_id=2');
    assert(rec.k === 'ui_event', 'record k=ui_event');
  }

  // Verify inbox and trigger cleaned up
  assert(getLabel(rt, -10, 0, 0, 0, 'mbr_mgmt_inbox') === null, 'inbox cleaned up');
  assert(getLabel(rt, -10, 0, 0, 0, 'run_mbr_mgmt_to_mqtt') === null, 'trigger cleaned up');

  // Verify dedup marker
  assert(getLabel(rt, -10, 0, 0, 0, 'mbr_seen_test_op_001') === '1', 'dedup marker set');
}

// ── Test 6: mbr_mgmt_to_mqtt — Model 100 routing ───────────────────────────

process.stdout.write('\n=== Test Group 6: mbr_mgmt_to_mqtt (Model 100) ===\n');

{
  const rt = createPatchedRuntime();
  const sys = rt.getModel(-10);
  let publishedTopic = null;
  let publishedPayload = null;

  const engine = new WorkerEngineV0({
    runtime: rt,
    mgmtAdapter: null,
    mqttPublish: (topic, payload) => {
      publishedTopic = topic;
      publishedPayload = payload;
    },
  });

  const uiEvent = {
    version: 'v0',
    type: 'ui_event',
    op_id: 'test_m100_001',
    action: 'some_action',
    source_model_id: 100,
    data: { foo: 'bar' },
    timestamp: Date.now(),
  };

  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: uiEvent });
  rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_mgmt_to_mqtt', t: 'str', v: '1' });
  engine.tick();

  assert(publishedTopic === 'UIPUT/ws/dam/pic/de/sw/100/event_in', `Model 100 topic=${publishedTopic}`);
  assert(publishedPayload && publishedPayload.records && publishedPayload.records.length === 0, 'Model 100 records empty (pass-through)');
  assert(publishedPayload && publishedPayload.action === 'some_action', 'Model 100 action preserved');
}

// ── Test 7: mbr_mgmt_to_mqtt — dedup ───────────────────────────────────────

process.stdout.write('\n=== Test Group 7: Dedup ===\n');

{
  const rt = createPatchedRuntime();
  const sys = rt.getModel(-10);
  let publishCount = 0;

  const engine = new WorkerEngineV0({
    runtime: rt,
    mgmtAdapter: null,
    mqttPublish: () => { publishCount += 1; },
  });

  const uiEvent = {
    version: 'v0', type: 'ui_event', op_id: 'dedup_001',
    action: 'test', data: {}, timestamp: Date.now(),
  };

  // First send
  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: uiEvent });
  rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_mgmt_to_mqtt', t: 'str', v: '1' });
  engine.tick();
  assert(publishCount === 1, 'first send published');

  // Second send with same op_id
  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: uiEvent });
  rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_mgmt_to_mqtt', t: 'str', v: '1' });
  engine.tick();
  assert(publishCount === 1, 'duplicate suppressed (still 1)');
}

// ── Test 8: mbr_mqtt_to_mgmt ────────────────────────────────────────────────

process.stdout.write('\n=== Test Group 8: mbr_mqtt_to_mgmt ===\n');

{
  const rt = createPatchedRuntime();
  const sys = rt.getModel(-10);
  let mgmtPublished = null;

  const engine = new WorkerEngineV0({
    runtime: rt,
    mgmtAdapter: {
      publish: (event) => {
        mgmtPublished = event;
        return Promise.resolve();
      },
    },
    mqttPublish: null,
  });

  const mqttPayload = {
    version: 'mt.v0',
    op_id: 'mqtt_ack_001',
    records: [
      { op: 'add_label', model_id: 1, p: 0, r: 0, c: 0, k: 'result', t: 'str', v: 'ACK' },
    ],
  };

  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mqtt_inbox', t: 'json', v: { topic: 'test/2/patch_out', payload: mqttPayload } });
  rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_mqtt_to_mgmt', t: 'str', v: '1' });
  engine.tick();

  assert(mgmtPublished !== null, 'MGMT_OUT was sent via Matrix');
  assert(mgmtPublished && mgmtPublished.version === 'v0', 'mgmt event version=v0');
  assert(mgmtPublished && mgmtPublished.type === 'snapshot_delta', 'mgmt event type=snapshot_delta');
  assert(mgmtPublished && mgmtPublished.op_id === 'mqtt_ack_001', 'mgmt event op_id correct');
  assert(mgmtPublished && mgmtPublished.payload && mgmtPublished.payload.version === 'mt.v0', 'mgmt payload is mt.v0');

  // Verify cleanup
  assert(getLabel(rt, -10, 0, 0, 0, 'mbr_mqtt_inbox') === null, 'mqtt inbox cleaned up');
  assert(getLabel(rt, -10, 0, 0, 0, 'run_mbr_mqtt_to_mgmt') === null, 'mqtt trigger cleaned up');
}

// ── Test 9: mbr_heartbeat ───────────────────────────────────────────────────

process.stdout.write('\n=== Test Group 9: mbr_heartbeat ===\n');

{
  const rt = createPatchedRuntime();
  const sys = rt.getModel(-10);
  let mgmtPublished = null;

  const engine = new WorkerEngineV0({
    runtime: rt,
    mgmtAdapter: {
      publish: (event) => {
        mgmtPublished = event;
        return Promise.resolve();
      },
    },
    mqttPublish: null,
  });

  rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_heartbeat', t: 'str', v: '1' });
  engine.tick();

  assert(mgmtPublished !== null, 'heartbeat MGMT_OUT sent');
  assert(mgmtPublished && mgmtPublished.version === 'v0', 'heartbeat version=v0');
  assert(mgmtPublished && mgmtPublished.type === 'mbr_ready', 'heartbeat type=mbr_ready');
  assert(mgmtPublished && mgmtPublished.op_id && mgmtPublished.op_id.startsWith('mbr_heartbeat_'), 'heartbeat op_id prefix');
}

// ── Test 10: mbr_ready ──────────────────────────────────────────────────────

process.stdout.write('\n=== Test Group 10: mbr_ready ===\n');

{
  const rt = createPatchedRuntime();
  const sys = rt.getModel(-10);
  let mgmtPublished = null;

  const engine = new WorkerEngineV0({
    runtime: rt,
    mgmtAdapter: {
      publish: (event) => {
        mgmtPublished = event;
        return Promise.resolve();
      },
    },
    mqttPublish: null,
  });

  rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_ready', t: 'str', v: '1' });
  engine.tick();

  assert(mgmtPublished !== null, 'ready MGMT_OUT sent');
  assert(mgmtPublished && mgmtPublished.type === 'mbr_ready', 'ready type=mbr_ready');
  assert(mgmtPublished && mgmtPublished.op_id && mgmtPublished.op_id.startsWith('mbr_ready_'), 'ready op_id prefix');
}

// ── Test 11: mbr_mgmt_to_mqtt — label_add/label_remove/cell_clear/submodel_create ──

process.stdout.write('\n=== Test Group 11: Legacy envelope actions ===\n');

{
  const rt = createPatchedRuntime();
  const sys = rt.getModel(-10);
  const published = [];

  const engine = new WorkerEngineV0({
    runtime: rt,
    mgmtAdapter: null,
    mqttPublish: (topic, payload) => { published.push({ topic, payload }); },
  });

  // label_add action (legacy envelope: no version/type at root → else branch)
  const labelAddEvent = {
    op_id: 'legacy_add_001',
    payload: {
      payload: {
        action: 'label_add',
        meta: { op_id: 'legacy_add_001' },
        target: { model_id: 2, p: 0, r: 0, c: 0, k: 'title' },
        value: { t: 'str', v: 'Hello' },
      },
    },
  };

  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: labelAddEvent });
  rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_mgmt_to_mqtt', t: 'str', v: '1' });
  engine.tick();
  assert(published.length === 1, 'label_add published');
  assert(published[0] && published[0].payload && published[0].payload.records[0].op === 'add_label', 'label_add -> add_label record');

  // label_remove action (legacy envelope)
  const labelRemoveEvent = {
    op_id: 'legacy_rm_001',
    payload: {
      payload: {
        action: 'label_remove',
        meta: { op_id: 'legacy_rm_001' },
        target: { model_id: 2, p: 0, r: 0, c: 0, k: 'title' },
      },
    },
  };

  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: labelRemoveEvent });
  rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_mgmt_to_mqtt', t: 'str', v: '1' });
  engine.tick();
  assert(published.length === 2, 'label_remove published');
  assert(published[1] && published[1].payload && published[1].payload.records[0].op === 'rm_label', 'label_remove -> rm_label record');

  // cell_clear action (legacy envelope)
  const cellClearEvent = {
    op_id: 'legacy_cc_001',
    payload: {
      payload: {
        action: 'cell_clear',
        meta: { op_id: 'legacy_cc_001' },
        target: { model_id: 2, p: 0, r: 0, c: 0 },
      },
    },
  };

  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: cellClearEvent });
  rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_mgmt_to_mqtt', t: 'str', v: '1' });
  engine.tick();
  assert(published.length === 3, 'cell_clear published');
  assert(published[2] && published[2].payload && published[2].payload.records[0].op === 'cell_clear', 'cell_clear -> cell_clear record');

  // submodel_create action (legacy envelope)
  const submodelEvent = {
    op_id: 'legacy_sm_001',
    payload: {
      payload: {
        action: 'submodel_create',
        meta: { op_id: 'legacy_sm_001' },
        target: { model_id: 2, p: 0, r: 0, c: 0, k: 'sub' },
        value: { t: 'json', v: { id: 5, name: 'Sub5', type: 'data' } },
      },
    },
  };

  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: submodelEvent });
  rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_mgmt_to_mqtt', t: 'str', v: '1' });
  engine.tick();
  assert(published.length === 4, 'submodel_create published');
  assert(published[3] && published[3].payload && published[3].payload.records[0].op === 'create_model', 'submodel_create -> create_model record');
}

// ── Test 12: mbr_remote_model_id read from label ────────────────────────────

process.stdout.write('\n=== Test Group 12: Dynamic remote model ID ===\n');

{
  const rt = createPatchedRuntime();
  const sys = rt.getModel(-10);
  let publishedTopic = null;

  // Override mbr_remote_model_id to 7
  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_remote_model_id', t: 'int', v: 7 });

  const engine = new WorkerEngineV0({
    runtime: rt,
    mgmtAdapter: null,
    mqttPublish: (topic) => { publishedTopic = topic; },
  });

  const uiEvent = {
    version: 'v0', type: 'ui_event', op_id: 'dyn_mid_001',
    action: 'test', data: {}, timestamp: Date.now(),
  };

  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: uiEvent });
  rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_mgmt_to_mqtt', t: 'str', v: '1' });
  engine.tick();

  assert(publishedTopic === 'UIPUT/ws/dam/pic/de/sw/7/patch_in', `dynamic model_id topic=${publishedTopic}`);
}

// ── Test 13: run_worker_v0.mjs syntax check ─────────────────────────────────

process.stdout.write('\n=== Test Group 13: Worker bootstrap syntax ===\n');

{
  const workerPath = path.resolve('scripts/run_worker_v0.mjs');
  assert(fs.existsSync(workerPath), 'run_worker_v0.mjs exists');
  // Verify it can be parsed (import syntax check)
  let parsed = false;
  try {
    const src = fs.readFileSync(workerPath, 'utf-8');
    // Basic checks
    assert(src.includes('loadSystemPatch'), 'imports loadSystemPatch');
    assert(src.includes('applyPatch'), 'calls applyPatch');
    assert(src.includes('labelOrEnv'), 'uses labelOrEnv helper');
    assert(src.includes('run_mbr_ready'), 'triggers mbr_ready');
    assert(src.includes('run_mbr_heartbeat'), 'triggers mbr_heartbeat');
    assert(src.includes('DY_ROLE_PATCH_DIR'), 'supports DY_ROLE_PATCH_DIR env');
    parsed = true;
  } catch (err) {
    process.stdout.write(`    parse error: ${err.message}\n`);
  }
  assert(parsed, 'run_worker_v0.mjs is readable');
}

// ── Summary ─────────────────────────────────────────────────────────────────

process.stdout.write('\n────────────────────────────────────\n');
process.stdout.write(`TOTAL: ${pass + fail}  PASS: ${pass}  FAIL: ${fail}\n`);
process.exitCode = fail > 0 ? 1 : 0;
