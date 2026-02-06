import { createRequire } from 'node:module';
import { WorkerEngineV0, loadSystemPatch } from './worker_engine_v0.mjs';

// MBR Worker should use BOT credentials (separate from UI Server's drop user)
// This allows UI Server to filter messages by sender and accept only from @mbr:localhost
if (process.env.MATRIX_MBR_BOT_USER && process.env.MATRIX_MBR_BOT_ACCESS_TOKEN) {
  process.env.MATRIX_MBR_USER = process.env.MATRIX_MBR_BOT_USER;
  process.env.MATRIX_MBR_ACCESS_TOKEN = process.env.MATRIX_MBR_BOT_ACCESS_TOKEN;
  console.log('[mbr-worker] Using BOT credentials:', process.env.MATRIX_MBR_USER);
}

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');
const { createMatrixLiveAdapter } = require('../packages/bus-mgmt/src/matrix_live.js');
const mqtt = require('mqtt');

function env(name, fallback = '') {
  return process.env[name] ? String(process.env[name]) : fallback;
}

function parseIntEnv(name, fallback) {
  const raw = env(name, '');
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) ? n : fallback;
}

function getLabelValue(rt, ref) {
  const model = rt.getModel(ref.model_id);
  if (!model) return null;
  const cell = rt.getCell(model, ref.p, ref.r, ref.c);
  return cell.labels.get(ref.k)?.v ?? null;
}

function main() {
  const roomId = env('DY_MATRIX_ROOM_ID', '');
  if (!roomId) throw new Error('missing_env:DY_MATRIX_ROOM_ID');

  const remoteModelId = parseIntEnv('DY_REMOTE_MODEL_ID', 2);
  const mqttHost = env('DY_MQTT_HOST', '127.0.0.1');
  const mqttPort = parseIntEnv('DY_MQTT_PORT', 1883);
  const mqttUser = env('DY_MQTT_USER', 'u');
  const mqttPass = env('DY_MQTT_PASS', 'p');

  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });

  const sys = rt.getModel(-10);

  // MBR functions are stored in ModelTable (system negative model) and triggered via run_*.
  // This function handles ui_event messages from Matrix and forwards them to MQTT
  // Updated to support Model 100 (source_model_id based routing)
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_to_mqtt',
    t: 'function',
    v: [
      "const inbox = ctx.getLabel({ model_id: -10, p: 0, r: 0, c: 0, k: 'mbr_mgmt_inbox' });",
      "console.log('[mbr_mgmt_to_mqtt] inbox:', JSON.stringify(inbox));",
      "if (!inbox || typeof inbox !== 'object') return;",
      "let patch = null;",
      "let opId = String(inbox.op_id || '');",
      "let targetModelId = " + remoteModelId + ";",  // Default to remoteModelId
      "let pinName = 'patch_in';",  // Default PIN name
      "if (inbox.version === 'v0' && inbox.type === 'ui_event') {",
      "  const data = inbox.data || {};",
      "  const action = String(inbox.action || data.action || 'unknown');",
      "  const sourceModelId = inbox.source_model_id || null;",
      "  if (!opId) opId = (data.meta && data.meta.op_id) || ('ui_' + Date.now());",
      "  if (sourceModelId === 100) {",
      "    targetModelId = 100;",
      "    pinName = 'event_in';",
      "    // 构造 mt.v0 格式的 payload，包含 records 数组以通过 runtime 验证",
      "    // 整个 payload 会被写入 PIN mailbox，K8s Worker 程序模型从中读取 action/data",
      "    patch = { version: 'mt.v0', op_id: opId, records: [], action: action, data: data, timestamp: inbox.timestamp };",
      "    console.log('[mbr_mgmt_to_mqtt] Model 100 ui_event, routing to event_in');",
      "  } else {",
      "    patch = { version: 'mt.v0', op_id: opId, records: [{ op: 'add_label', model_id: targetModelId, p: 0, r: 0, c: 0, k: 'ui_event', t: 'json', v: { action: action, data: data, timestamp: inbox.timestamp } }] };",
      "  }",
      "  console.log('[mbr_mgmt_to_mqtt] Converted ui_event to patch:', JSON.stringify(patch));",
      "} else {",
      "  const msg = inbox.payload;",
      "  if (msg && typeof msg === 'object' && msg.version === 'mt.v0') {",
      "    patch = msg;",
      "    if (!opId) opId = String(patch.op_id || '');",
      "  } else if (msg && typeof msg === 'object' && msg.payload && typeof msg.payload === 'object') {",
      "    const act = String(msg.payload.action || '');",
      "    const meta = msg.payload.meta && typeof msg.payload.meta === 'object' ? msg.payload.meta : null;",
      "    if (!opId) opId = meta && typeof meta.op_id === 'string' ? meta.op_id : '';",
      "    const target = msg.payload.target && typeof msg.payload.target === 'object' ? msg.payload.target : null;",
      "    const value = msg.payload.value && typeof msg.payload.value === 'object' ? msg.payload.value : null;",
      "    if (act === 'label_add' || act === 'label_update') {",
      "      if (!target || !Number.isInteger(target.model_id) || !Number.isInteger(target.p) || !Number.isInteger(target.r) || !Number.isInteger(target.c) || typeof target.k !== 'string') return;",
      "      if (!value || typeof value.t !== 'string') return;",
      "      patch = { version: 'mt.v0', op_id: opId, records: [{ op: 'add_label', model_id: target.model_id, p: target.p, r: target.r, c: target.c, k: target.k, t: value.t, v: value.v }] };",
      "    } else if (act === 'label_remove') {",
      "      if (!target || !Number.isInteger(target.model_id) || !Number.isInteger(target.p) || !Number.isInteger(target.r) || !Number.isInteger(target.c) || typeof target.k !== 'string') return;",
      "      patch = { version: 'mt.v0', op_id: opId, records: [{ op: 'rm_label', model_id: target.model_id, p: target.p, r: target.r, c: target.c, k: target.k }] };",
      "    } else if (act === 'cell_clear') {",
      "      if (!target || !Number.isInteger(target.model_id) || !Number.isInteger(target.p) || !Number.isInteger(target.r) || !Number.isInteger(target.c)) return;",
      "      patch = { version: 'mt.v0', op_id: opId, records: [{ op: 'cell_clear', model_id: target.model_id, p: target.p, r: target.r, c: target.c }] };",
      "    } else if (act === 'submodel_create') {",
      "      if (!value || value.t !== 'json' || !value.v || typeof value.v !== 'object') return;",
      "      const mid = value.v.id;",
      "      const mname = value.v.name;",
      "      const mtype = value.v.type;",
      "      if (!Number.isInteger(mid) || mid === 0) return;",
      "      if (typeof mname !== 'string' || mname.length === 0) return;",
      "      if (typeof mtype !== 'string' || mtype.length === 0) return;",
      "      patch = { version: 'mt.v0', op_id: opId, records: [{ op: 'create_model', model_id: mid, name: mname, type: mtype }] };",
      "    } else { return; }",
      "  } else { return; }",
      "}",
      "if (!opId) return;",
      "const seenKey = 'mbr_seen_' + opId;",
      "if (ctx.getLabel({ model_id: -10, p: 0, r: 0, c: 0, k: seenKey })) {",
      "  ctx.rmLabel({ model_id: -10, p: 0, r: 0, c: 0, k: 'mbr_mgmt_inbox' });",
      "  ctx.rmLabel({ model_id: -10, p: 0, r: 0, c: 0, k: 'run_mbr_mgmt_to_mqtt' });",
      "  return;",
      "}",
      "ctx.writeLabel({ model_id: -10, p: 0, r: 0, c: 0, k: seenKey }, 'str', '1');",
      "if (!patch) return;",
      "const base = String(ctx.getLabel({ model_id: 0, p: 0, r: 0, c: 0, k: 'mqtt_topic_base' }) || '');",
      "console.log('[mbr_mgmt_to_mqtt] mqtt_topic_base from model 0:', base);",
      "const topic = base ? (base + '/' + targetModelId + '/' + pinName) : '';",
      "console.log('[mbr_mgmt_to_mqtt] Publishing to MQTT topic:', topic, 'targetModelId:', targetModelId, 'pinName:', pinName);",
      "if (!topic) { console.log('[mbr_mgmt_to_mqtt] ERROR: topic is empty, base was:', base); return; }",
      "ctx.publishMqtt(topic, patch);",
      "ctx.rmLabel({ model_id: -10, p: 0, r: 0, c: 0, k: 'mbr_mgmt_inbox' });",
      "ctx.rmLabel({ model_id: -10, p: 0, r: 0, c: 0, k: 'run_mbr_mgmt_to_mqtt' });",
    ].join('\n'),
  });

  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mqtt_to_mgmt',
    t: 'function',
    v: [
      "const inbox = ctx.getLabel({ model_id: -10, p: 0, r: 0, c: 0, k: 'mbr_mqtt_inbox' });",
      "if (!inbox || typeof inbox !== 'object') return;",
      "const payload = inbox.payload;",
      "if (!payload || typeof payload !== 'object') return;",
      "const patch = payload;",
      "if (!patch || patch.version !== 'mt.v0' || !Array.isArray(patch.records)) return;",
      "const opId = String(patch.op_id || '');",
      "if (!opId) return;",
      "const seenKey = 'mbr_seen_' + opId;",
      "if (!ctx.getLabel({ model_id: -10, p: 0, r: 0, c: 0, k: seenKey })) { ctx.writeLabel({ model_id: -10, p: 0, r: 0, c: 0, k: seenKey }, 'str', '1'); }",
      "const mgmtEvent = { version: 'v0', type: 'snapshot_delta', op_id: opId, payload: patch };",
      "ctx.writeLabel({ model_id: -10, p: 0, r: 0, c: 0, k: 'change_out' }, 'MGMT_OUT', mgmtEvent);",
      "ctx.rmLabel({ model_id: -10, p: 0, r: 0, c: 0, k: 'mbr_mqtt_inbox' });",
      "ctx.rmLabel({ model_id: -10, p: 0, r: 0, c: 0, k: 'run_mbr_mqtt_to_mgmt' });",
    ].join(' '),
  });

  // Mgmt live adapter
  const adapterPromise = createMatrixLiveAdapter({ roomId, syncTimeoutMs: 20000 });

  // MQTT client for bridge ingress/egress
  const base = String(getLabelValue(rt, { model_id: 0, p: 0, r: 0, c: 0, k: 'mqtt_topic_base' }) || '').trim();
  if (!base) throw new Error('missing_mqtt_topic_base');
  const topicOut = `${base}/${remoteModelId}/patch_out`;
  const topicOut100 = `${base}/100/patch_out`;  // Model 100 patch_out

  const mqttUrl = `mqtt://${mqttHost}:${mqttPort}`;
  const mqttClient = mqtt.connect(mqttUrl, {
    username: mqttUser,
    password: mqttPass,
    clientId: `dy-mbr-${Date.now()}`,
    reconnectPeriod: 500,
  });

  const mqttPublish = (topic, payload) => {
    try {
      const opId = payload && typeof payload === 'object' ? (payload.op_id || '') : '';
      const t = payload && payload.t ? payload.t : 'patch';
      process.stdout.write(`[mbr-worker] mqtt publish topic=${topic} t=${t} op_id=${opId}\n`);
    } catch (_) {
      // ignore
    }
    mqttClient.publish(topic, JSON.stringify(payload));
  };

  const engine = new WorkerEngineV0({ runtime: rt, mgmtAdapter: null, mqttPublish });

  let mgmtAdapter = null;
  adapterPromise.then((adapter) => {
    mgmtAdapter = adapter;
    engine.mgmtAdapter = adapter;

    adapter.subscribe((event) => {
      if (!event || event.version !== 'v0') return;
      if (event.type !== 'ui_event') return;
      process.stdout.write(`[mbr-worker] recv mgmt ui_event op_id=${event.op_id}\n`);
      rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: event });
      rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_mgmt_to_mqtt', t: 'str', v: '1' });
      engine.tick();
    });

    process.stdout.write(`[mbr-worker] mgmt READY room_id=${adapter.room_id}\n`);

    // Send initial mbr_ready signal
    adapter.publish({
      version: 'v0',
      type: 'mbr_ready',
      op_id: `mbr_ready_${Date.now()}`,
      timestamp: Date.now(),
    }).then(() => {
      process.stdout.write('[mbr-worker] mbr_ready signal sent to Matrix\n');
    }).catch((err) => {
      process.stderr.write(`[mbr-worker] mbr_ready send failed: ${err.message}\n`);
    });

    // Send mbr_ready heartbeat every 30 seconds
    // This ensures UI Server receives mbr_ready even if it restarts after MBR
    setInterval(() => {
      adapter.publish({
        version: 'v0',
        type: 'mbr_ready',
        op_id: `mbr_heartbeat_${Date.now()}`,
        timestamp: Date.now(),
      }).catch(() => {
        // Ignore heartbeat failures silently
      });
    }, 30000);
  }).catch((err) => {
    process.stderr.write('[mbr-worker] matrix adapter init failed\n');
    process.stderr.write(String(err && err.stack ? err.stack : err));
    process.stderr.write('\n');
    process.exitCode = 1;
  });

  mqttClient.on('connect', () => {
    mqttClient.subscribe(topicOut);
    mqttClient.subscribe(topicOut100);  // Subscribe to Model 100 patch_out
    process.stdout.write(`[mbr-worker] mqtt READY subscribed=${topicOut}, ${topicOut100}\n`);
    process.stdout.write('[mbr-worker] READY\n');
  });

  mqttClient.on('message', (topic, buf) => {
    if (topic !== topicOut && topic !== topicOut100) return;
    let payload = null;
    try {
      payload = JSON.parse(buf.toString('utf8'));
    } catch (_) {
      return;
    }
    if (!payload || typeof payload !== 'object' || payload.version !== 'mt.v0') return;
    process.stdout.write(`[mbr-worker] recv mqtt OUT topic=${topic} op_id=${payload.op_id || ''}\n`);
    rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mqtt_inbox', t: 'json', v: { topic, payload } });
    rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_mqtt_to_mgmt', t: 'str', v: '1' });
    engine.tick();
  });

  process.on('SIGINT', () => {
    try { if (mgmtAdapter && mgmtAdapter.close) mgmtAdapter.close(); } catch (_) {}
    try { mqttClient.end(true); } catch (_) {}
    process.exit(0);
  });
}

try {
  main();
} catch (err) {
  process.stderr.write('[mbr-worker] FAILED\n');
  process.stderr.write(String(err && err.stack ? err.stack : err));
  process.stderr.write('\n');
  process.exitCode = 1;
}
