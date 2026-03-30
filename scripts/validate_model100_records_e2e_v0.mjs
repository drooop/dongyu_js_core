/**
 * Validate Model 100 records-only E2E (local simulation)
 *
 * Flow:
 * 1) Simulate Matrix ui_event arriving at MBR (mbr_role_v0 patch)
 * 2) Capture mqtt publish topic + payload (direct ui_event on /event)
 * 3) Deliver to a Worker runtime via mqttIncoming
 * 4) Consume run_func intercept and execute on_model100_event_in
 * 5) Assert returned OUT patch is mt.v0 and bg_color updated
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
  rt.addLabel(root, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'mt_v0' });
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

  // --- MBR side: convert ui_event -> mqtt publish (records-only) ---
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
    version: 'v0',
    type: 'ui_event',
    op_id: 'it0140_m100_submit_001',
    action: 'submit',
    source_model_id: 100,
    data: { meta: { op_id: 'it0140_m100_submit_001' } },
    timestamp: Date.now(),
  };
  mbrRt.addLabel(mbrRt.getModel(-10), 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: uiEvent });
  mbrRt.addLabel(mbrRt.getModel(-10), 0, 0, 0, { k: 'run_mbr_mgmt_to_mqtt', t: 'str', v: '1' });
  mbrEngine.tick();

  assert(publishedTopic === `${base}/100/event`, `expected publish topic ${base}/100/event, got ${publishedTopic}`);
  assert(publishedPayload && publishedPayload.version === 'v0', 'published event payload must stay direct v0 ui_event');
  assert(publishedPayload && publishedPayload.type === 'ui_event', 'published payload must preserve ui_event type');
  assert(publishedPayload && publishedPayload.op_id === uiEvent.op_id, 'published payload op_id mismatch');
  assert(publishedPayload && publishedPayload.action === 'submit', 'published payload must preserve action');
  assert(publishedPayload && publishedPayload.source_model_id === 100, 'published payload must preserve source_model_id');
  assert(!Array.isArray(publishedPayload.records), 'published event payload must not be mt.v0 patch records');

  // --- Worker side: consume mqttIncoming(ui_event) -> CELL_CONNECT -> function -> OUT ---
  const wRt = new ModelTableRuntime();
  loadSystemPatch(wRt);
  loadPatchDir(wRt, remoteWorkerPatchDir);
  wRt.setRuntimeMode('edit');
  wRt.setRuntimeMode('running');

  const handled = wRt.mqttIncoming(publishedTopic, publishedPayload);
  assert(handled, 'worker mqttIncoming must handle payload');

  // Check pin.in label written to root cell (0,0,0)
  const rootEvent = getLabel(wRt, 100, 0, 0, 0, 'event');
  assert(rootEvent && rootEvent.t === 'pin.in', 'worker should write pin.in label to root cell(0,0,0) key=event');
  assert(rootEvent.v && typeof rootEvent.v === 'object' && rootEvent.v.action === 'submit', 'pin.in value must preserve submit action');

  // Check pin.in routed to processing cell (1,0,0) via cell_connection
  const routedEvent = getLabel(wRt, 100, 1, 0, 0, 'event');
  assert(routedEvent && routedEvent.t === 'pin.in', 'cell_connection should route event pin.in to cell(1,0,0)');

  // CELL_CONNECT function execution is async — wait for completion
  await new Promise(resolve => setTimeout(resolve, 500));

  // Check function output at processing cell (1,0,0) as OUT
  const patchOut = getLabel(wRt, 100, 1, 0, 0, 'patch');
  assert(patchOut && patchOut.t === 'OUT', 'CELL_CONNECT should write OUT patch to cell(1,0,0)');
  assert(patchOut.v && patchOut.v.version === 'mt.v0' && Array.isArray(patchOut.v.records), 'OUT payload must be mt.v0 patch');

  const bg = getLabel(wRt, 100, 0, 0, 0, 'bg_color');
  assert(bg && typeof bg.v === 'string' && /^#[0-9a-fA-F]{6}$/.test(bg.v), 'bg_color must be updated');

  process.stdout.write('PASS: model100 records-only E2E (MBR -> mqttIncoming -> cell_connection -> CELL_CONNECT -> function)\n');
}

main().catch((err) => {
  process.stderr.write('FAIL\n');
  process.stderr.write(String(err && err.stack ? err.stack : err));
  process.stderr.write('\n');
  process.exitCode = 1;
});
