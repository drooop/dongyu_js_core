/**
 * Validate Model 100 records-only E2E (local simulation)
 *
 * Flow:
 * 1) Simulate Matrix pin_payload arriving at MBR (mbr_role_v0 patch)
 * 2) Capture mqtt publish topic + payload (pin_payload on /submit)
 * 3) Deliver to a Worker runtime via mqttIncoming
 * 4) Assert D0 function executes and emits temporary-modeltable result payload
 * 5) Assert bg_color updated
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { WorkerEngineV0, loadSystemPatch } from './worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadPatchDir(rt, patchDir) {
  const files = fs.readdirSync(patchDir).filter((name) => name.endsWith('.json')).sort();
  for (const file of files) {
    rt.applyPatch(loadJson(path.join(patchDir, file)), { allowCreateModel: true, trustedBootstrap: true });
  }
}

function setMmV1MtV0Config(rt, base) {
  const root = rt.getModel(0);
  rt.addLabel(root, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(root, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: base });
  rt.addLabel(root, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
}

function getLabel(rt, modelId, p, r, c, k) {
  const m = rt.getModel(modelId);
  if (!m) return null;
  return rt.getCell(m, p, r, c).labels.get(k) || null;
}

async function main() {
  const base = 'UIPUT/ws/dam/pic/de/sw';
  const mbrPatchPath = path.resolve('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json');
  const remoteWorkerPatchDir = path.resolve('deploy/sys-v1ns/remote-worker/patches');

  // --- MBR side: convert pin_payload -> mqtt publish ---
  const mbrRt = new ModelTableRuntime();
  loadSystemPatch(mbrRt);
  if (!mbrRt.getModel(-10)) mbrRt.createModel({ id: -10, name: 'system', type: 'system' });
  setMmV1MtV0Config(mbrRt, base);
  mbrRt.applyPatch(loadJson(mbrPatchPath), { allowCreateModel: true });
  mbrRt.setRuntimeMode('edit');
  mbrRt.setRuntimeMode('running');

  let publishedTopic = null;
  let publishedPayload = null;
  const mbrEngine = new WorkerEngineV0({
    runtime: mbrRt,
    mgmtAdapter: null,
    mqttPublish: (topic, payload) => {
      publishedTopic = topic;
      publishedPayload = payload;
    },
  });

  const uiEvent = {
    version: 'v1',
    type: 'pin_payload',
    op_id: 'it0140_m100_submit_001',
    source_model_id: 100,
    pin: 'submit',
    payload: [
      { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
      { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'hello' },
    ],
    timestamp: Date.now(),
  };
  mbrRt.addLabel(mbrRt.getModel(-10), 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: uiEvent });
  mbrRt.addLabel(mbrRt.getModel(-10), 0, 0, 0, { k: 'run_mbr_mgmt_to_mqtt', t: 'str', v: '1' });
  mbrEngine.tick();

  assert(publishedTopic === `${base}/100/submit`, `expected publish topic ${base}/100/submit, got ${publishedTopic}`);
  assert(publishedPayload && publishedPayload.version === 'v1', 'published payload must be pin_payload v1');
  assert(publishedPayload && publishedPayload.type === 'pin_payload', 'published payload must preserve pin_payload type');
  assert(publishedPayload && publishedPayload.op_id === uiEvent.op_id, 'published payload op_id mismatch');
  assert(publishedPayload && publishedPayload.pin === 'submit', 'published payload must preserve submit pin');
  assert(publishedPayload && publishedPayload.source_model_id === 100, 'published payload must preserve source_model_id');
  assert(Array.isArray(publishedPayload.payload), 'published payload must carry temporary-modeltable array');

  // --- Worker side: consume mqttIncoming(pin_payload) -> D0 function -> pin.out ---
  const wRt = new ModelTableRuntime();
  loadSystemPatch(wRt);
  loadPatchDir(wRt, remoteWorkerPatchDir);
  wRt.setRuntimeMode('edit');
  wRt.setRuntimeMode('running');

  const handled = wRt.mqttIncoming(publishedTopic, publishedPayload);
  assert(handled, 'worker mqttIncoming must handle payload');

  const rootEvent = getLabel(wRt, 100, 0, 0, 0, 'submit');
  assert(rootEvent && rootEvent.t === 'pin.in', 'worker should write pin.in label to root cell(0,0,0) key=submit');
  assert(Array.isArray(rootEvent.v), 'pin.in value must be temporary-modeltable array');

  // CELL_CONNECT function execution is async — wait for completion
  await new Promise(resolve => setTimeout(resolve, 500));

  const patchOut = getLabel(wRt, 100, 0, 0, 0, 'result');
  assert(patchOut && patchOut.t === 'pin.out', 'D0 function should write pin.out result on root');
  assert(Array.isArray(patchOut.v), 'result payload must be temporary-modeltable array');

  const bg = getLabel(wRt, 100, 0, 0, 0, 'bg_color');
  assert(bg && typeof bg.v === 'string' && /^#[0-9a-fA-F]{6}$/.test(bg.v), 'bg_color must be updated');

  process.stdout.write('PASS: model100 temporary-modeltable E2E (MBR -> mqttIncoming -> D0 function)\n');
}

main().catch((err) => {
  process.stderr.write('FAIL\n');
  process.stderr.write(String(err && err.stack ? err.stack : err));
  process.stderr.write('\n');
  process.exitCode = 1;
});
