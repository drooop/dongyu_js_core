import http from 'node:http';
import { createRequire } from 'node:module';
import { WorkerEngineV0, loadSystemPatch } from './worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');

function parseIntEnv(name, fallback) {
  const raw = process.env[name] ? String(process.env[name]) : '';
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) ? n : fallback;
}

function main() {
  const remoteModelId = parseIntEnv('DY_REMOTE_MODEL_ID', 2);
  const httpPort = parseIntEnv('DY_REMOTE_WORKER_HTTP_PORT', 9102);

  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  if (!rt.getModel(remoteModelId)) rt.createModel({ id: remoteModelId, name: `Remote_${remoteModelId}`, type: 'data' });

  // Configure MQTT (writes to ModelTable page0; OK for local test).
  rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'mt_v0' });
  rt.startMqttLoop({
    transport: 'real',
    host: '127.0.0.1',
    port: 1883,
    client_id: `dy-remote-${remoteModelId}-${Date.now()}`,
    username: 'u',
    password: 'p',
    tls: false,
  });

  // Declare pins in uiput_mm_v1 mode (system patch sets mqtt_topic_mode/topic_base).
  const m = rt.getModel(remoteModelId);
  rt.addLabel(m, 0, 0, 1, { k: 'patch_in', t: 'PIN_IN', v: 'patch_in' });
  rt.addLabel(m, 0, 0, 1, { k: 'patch_out', t: 'PIN_OUT', v: 'patch_out' });

  // Remote worker function: consume IN(patch_in), apply patch, emit OUT(patch_out).
  const sys = rt.getModel(-10);
  rt.addLabel(sys, 0, 0, 0, {
    k: 'remote_apply_patch_in',
    t: 'function',
    v: [
      `const mid = ${remoteModelId};`,
      "const model = ctx.runtime.getModel(mid); if (!model) return;",
      "const cell = ctx.runtime.getCell(model, 0, 1, 1);",
      "const label = cell.labels.get('patch_in');",
      "if (!label || label.t !== 'IN') return;",
      "const payload = label.v;",
      "const patch = payload && typeof payload === 'object' ? payload : null;",
      "if (!patch || patch.version !== 'mt.v0' || !Array.isArray(patch.records)) return;",
      "ctx.runtime.applyPatch(patch, { allowCreateModel: true });",
      "ctx.runtime.rmLabel(model, 0, 1, 1, 'patch_in');",
      "const v = ctx.runtime.getCell(model, 0, 0, 0).labels.get('slide_demo_text')?.v ?? '';",
      "const baseRecords = Array.isArray(patch.records) ? patch.records.slice() : [];",
      "baseRecords.push({ op: 'add_label', model_id: 1, p: 0, r: 0, c: 0, k: 'slide_demo_text', t: 'str', v: 'ACK:' + String(v) });",
      "const ack = { version: 'mt.v0', op_id: String(patch.op_id || '') + '#ack', records: baseRecords };",
      "ctx.writeLabel({ model_id: mid, p: 0, r: 1, c: 1, k: 'patch_out' }, 'OUT', ack);",
      "try { console.log('[remote-worker] applied patch and queued OUT', { in_op_id: String(patch.op_id || ''), out_op_id: String(ack.op_id || '') }); } catch (_) {}",
      "ctx.rmLabel({ model_id: -10, p: 0, r: 0, c: 0, k: 'run_remote_apply_patch_in' });",
    ].join(' '),
  });

  // Ensure a visible label to mutate.
  rt.addLabel(m, 0, 0, 0, { k: 'slide_demo_text', t: 'str', v: '' });

  const engine = new WorkerEngineV0({ runtime: rt, mgmtAdapter: null, mqttPublish: null });
  let eventCursor = 0;

  const timer = setInterval(() => {
    const events = rt.eventLog.list();
    for (; eventCursor < events.length; eventCursor += 1) {
      const e = events[eventCursor];
      if (!e || e.op !== 'add_label') continue;
      if (!e.cell || e.cell.model_id !== remoteModelId || e.cell.p !== 0 || e.cell.r !== 1 || e.cell.c !== 1) continue;
      if (!e.label || e.label.t !== 'IN' || e.label.k !== 'patch_in') continue;
      rt.addLabel(sys, 0, 0, 0, { k: 'run_remote_apply_patch_in', t: 'str', v: '1' });
    }
    engine.tick();
  }, 50);
  timer.unref();

  const server = http.createServer((req, res) => {
    if (!req || !req.url) {
      res.statusCode = 400;
      res.end('bad request');
      return;
    }
    if (req.url.startsWith('/value')) {
      const v = rt.getCell(m, 0, 0, 0).labels.get('slide_demo_text')?.v ?? '';
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ slide_demo_text: v }));
      return;
    }
    res.statusCode = 200;
    res.end('ok');
  });

  server.listen(httpPort, '127.0.0.1', () => {
    process.stdout.write(`[remote-worker] READY http://127.0.0.1:${httpPort}/value model_id=${remoteModelId}\n`);
  });

  process.on('SIGINT', () => {
    try {
      if (rt.mqttClient && typeof rt.mqttClient.close === 'function') rt.mqttClient.close();
    } catch (_) {}
    try { server.close(); } catch (_) {}
    process.exit(0);
  });
}

try {
  main();
} catch (err) {
  process.stderr.write('[remote-worker] FAILED\n');
  process.stderr.write(String(err && err.stack ? err.stack : err));
  process.stderr.write('\n');
  process.exitCode = 1;
}
