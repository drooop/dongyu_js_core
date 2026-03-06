import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function loadJson(p) {
  const fs = require('node:fs');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadSystemAndMbr() {
  const rt = new ModelTableRuntime();
  const sysPatch = loadJson('packages/worker-base/system-models/system_models.json');
  rt.applyPatch(sysPatch, { allowCreateModel: true });
  const mbrPatch = loadJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json');
  rt.applyPatch(mbrPatch, { allowCreateModel: true });
  return rt;
}

function getFunctionCode(label) {
  if (!label) return '';
  if (typeof label.v === 'string') return label.v;
  if (label.v && typeof label.v === 'object' && typeof label.v.code === 'string') return label.v.code;
  return '';
}

function test_mbr_patches_load() {
  const rt = loadSystemAndMbr();
  const sys = rt.getModel(-10);
  assert(sys, 'Model -10 should exist');
  const cell = rt.getCell(sys, 0, 0, 0);
  assert(cell.labels.has('mbr_mgmt_to_mqtt'), 'should have mbr_mgmt_to_mqtt function');
  assert(cell.labels.has('mbr_mqtt_to_mgmt'), 'should have mbr_mqtt_to_mgmt function');
  assert(cell.labels.has('mbr_heartbeat'), 'should have mbr_heartbeat function');
  assert(cell.labels.has('mbr_ready'), 'should have mbr_ready function');
  assert.strictEqual(cell.labels.get('mbr_mgmt_to_mqtt').t, 'func.js');
  assert.strictEqual(cell.labels.get('mbr_mqtt_to_mgmt').t, 'func.js');
  return { key: 'mbr_patches_load', status: 'PASS' };
}

function test_mbr_mgmt_to_mqtt_compile() {
  const rt = loadSystemAndMbr();
  const sys = rt.getModel(-10);
  const code = getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_to_mqtt'));
  assert(typeof code === 'string' && code.length > 0, 'function code must be non-empty string');
  // Compile without throwing
  const fn = new Function('ctx', 'label', code);
  assert(typeof fn === 'function', 'must compile to function');
  return { key: 'mbr_mgmt_to_mqtt_compile', status: 'PASS' };
}

function test_mbr_mqtt_to_mgmt_compile() {
  const rt = loadSystemAndMbr();
  const sys = rt.getModel(-10);
  const code = getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mqtt_to_mgmt'));
  const fn = new Function('ctx', 'label', code);
  assert(typeof fn === 'function', 'must compile to function');
  return { key: 'mbr_mqtt_to_mgmt_compile', status: 'PASS' };
}

function test_mbr_mgmt_to_mqtt_execute_model100() {
  const rt = loadSystemAndMbr();
  const sys = rt.getModel(-10);

  // Simulate incoming Matrix ui_event for Model 100
  const uiEvent = {
    version: 'v0',
    type: 'ui_event',
    op_id: 'test_0144_001',
    action: 'submit',
    source_model_id: 100,
    data: { meta: { op_id: 'test_0144_001' } },
    timestamp: Date.now(),
  };
  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: uiEvent });

  // Build ctx matching WorkerEngineV0's API
  let publishedTopic = null;
  let publishedPayload = null;
  const ctx = {
    getLabel: (ref) => {
      const model = rt.getModel(ref.model_id);
      if (!model) return null;
      const cell = rt.getCell(model, ref.p, ref.r, ref.c);
      return cell.labels.get(ref.k)?.v ?? null;
    },
    writeLabel: (ref, t, v) => {
      const model = rt.getModel(ref.model_id);
      if (!model) return;
      rt.addLabel(model, ref.p, ref.r, ref.c, { k: ref.k, t, v });
    },
    rmLabel: (ref) => {
      const model = rt.getModel(ref.model_id);
      if (!model) return;
      rt.rmLabel(model, ref.p, ref.r, ref.c, ref.k);
    },
    publishMqtt: (topic, payload) => {
      publishedTopic = topic;
      publishedPayload = payload;
    },
  };

  const code = getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_to_mqtt'));
  const fn = new Function('ctx', code);
  fn(ctx);

  assert(publishedTopic, 'should publish to MQTT');
  assert(publishedTopic.endsWith('/100/event'), `topic should end with /100/event, got ${publishedTopic}`);
  assert(publishedPayload && publishedPayload.version === 'mt.v0', 'payload must be mt.v0');
  assert(Array.isArray(publishedPayload.records), 'payload must have records');

  // Verify inbox cleaned up
  assert(!rt.getCell(sys, 0, 0, 0).labels.has('mbr_mgmt_inbox'), 'inbox should be cleaned');
  assert(!rt.getCell(sys, 0, 0, 0).labels.has('run_mbr_mgmt_to_mqtt'), 'trigger should be cleaned');

  // Verify dedup marker
  assert(rt.getCell(sys, 0, 0, 0).labels.has('mbr_seen_test_0144_001'), 'dedup marker should exist');

  return { key: 'mbr_mgmt_to_mqtt_execute_model100', status: 'PASS' };
}

function test_mbr_mqtt_to_mgmt_execute() {
  const rt = loadSystemAndMbr();
  const sys = rt.getModel(-10);

  // Simulate incoming MQTT patch
  const mqttPayload = {
    topic: 'UIPUT/ws/dam/pic/de/sw/100/patch_out',
    payload: {
      version: 'mt.v0',
      op_id: 'test_0144_002',
      records: [{
        op: 'add_label', model_id: 100, p: 0, r: 0, c: 0,
        k: 'bg_color', t: 'str', v: '#FF0000'
      }]
    }
  };
  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mqtt_inbox', t: 'json', v: mqttPayload });

  const ctx = {
    getLabel: (ref) => {
      const model = rt.getModel(ref.model_id);
      if (!model) return null;
      const cell = rt.getCell(model, ref.p, ref.r, ref.c);
      return cell.labels.get(ref.k)?.v ?? null;
    },
    writeLabel: (ref, t, v) => {
      const model = rt.getModel(ref.model_id);
      if (!model) return;
      rt.addLabel(model, ref.p, ref.r, ref.c, { k: ref.k, t, v });
    },
    rmLabel: (ref) => {
      const model = rt.getModel(ref.model_id);
      if (!model) return;
      rt.rmLabel(model, ref.p, ref.r, ref.c, ref.k);
    },
  };

  const code = getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mqtt_to_mgmt'));
  const fn = new Function('ctx', code);
  fn(ctx);

  // Verify MGMT_OUT written
  const changeOut = rt.getCell(sys, 0, 0, 0).labels.get('change_out');
  assert(changeOut, 'change_out label should exist');
  assert.strictEqual(changeOut.t, 'MGMT_OUT', 'change_out type must be MGMT_OUT');
  assert(changeOut.v && changeOut.v.type === 'snapshot_delta', 'MGMT_OUT value must be snapshot_delta');
  assert.strictEqual(changeOut.v.op_id, 'test_0144_002');

  // Verify inbox cleaned up
  assert(!rt.getCell(sys, 0, 0, 0).labels.has('mbr_mqtt_inbox'), 'inbox should be cleaned');

  return { key: 'mbr_mqtt_to_mgmt_execute', status: 'PASS' };
}

// --- Run all tests ---
const tests = [
  test_mbr_patches_load,
  test_mbr_mgmt_to_mqtt_compile,
  test_mbr_mqtt_to_mgmt_compile,
  test_mbr_mgmt_to_mqtt_execute_model100,
  test_mbr_mqtt_to_mgmt_execute,
];

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    const r = t();
    process.stdout.write(`[${r.status}] ${r.key}\n`);
    passed += 1;
  } catch (err) {
    process.stdout.write(`[FAIL] ${t.name}: ${err.message}\n`);
    failed += 1;
  }
}
process.stdout.write(`\n${passed} passed, ${failed} failed out of ${tests.length}\n`);
process.exit(failed > 0 ? 1 : 0);
