/**
 * Generic Worker Bootstrap v0
 *
 * Loads system patch + role patches from a directory, applies optional
 * bootstrap patch from MODELTABLE_PATCH_JSON, reads connection
 * parameters from Model 0, initializes
 * adapters (Matrix / MQTT), wires event handlers via label-defined
 * triggers, and runs the tick loop.
 *
 * Usage:
 *   bun scripts/run_worker_v0.mjs <patch_dir>
 *   DY_ROLE_PATCH_DIR=deploy/sys-v1ns/mbr/patches bun scripts/run_worker_v0.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { WorkerEngineV0, loadSystemPatch } from './worker_engine_v0.mjs';
import { readMatrixBootstrapConfig, readMqttBootstrapConfig } from '../packages/worker-base/src/bootstrap_config.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');
const { createMatrixLiveAdapter } = require('../packages/worker-base/src/matrix_live.js');
const mqtt = require('mqtt');

// ── Helpers ─────────────────────────────────────────────────────────────────

function getLabel(rt, modelId, p, r, c, k) {
  const model = rt.getModel(modelId);
  if (!model) return null;
  const cell = rt.getCell(model, p, r, c);
  const label = cell.labels.get(k);
  return label ? label.v : null;
}

function log(msg) { process.stdout.write(`[worker] ${msg}\n`); }
function logErr(msg) { process.stderr.write(`[worker] ${msg}\n`); }

function readBootstrapPatchFromEnv() {
  const raw = process.env.MODELTABLE_PATCH_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`invalid MODELTABLE_PATCH_JSON: ${err && err.message ? err.message : err}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  // 1. Determine patch directory
  const patchDir = process.argv[2] || process.env.DY_ROLE_PATCH_DIR || '';
  if (!patchDir) {
    logErr('Usage: run_worker_v0.mjs <patch_dir>  or set DY_ROLE_PATCH_DIR');
    process.exitCode = 1;
    return;
  }
  const resolvedDir = path.resolve(patchDir);
  if (!fs.existsSync(resolvedDir)) {
    logErr(`Patch directory not found: ${resolvedDir}`);
    process.exitCode = 1;
    return;
  }

  // 2. Create runtime + load system patch
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });

  // 3. Load role patches (alphabetical order)
  const patchFiles = fs.readdirSync(resolvedDir)
    .filter(f => f.endsWith('.json'))
    .sort();
  for (const f of patchFiles) {
    const fullPath = path.join(resolvedDir, f);
    const patch = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    const result = rt.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
    log(`loaded patch: ${f} (applied=${result.applied} rejected=${result.rejected})`);
  }

  const bootstrapPatch = readBootstrapPatchFromEnv();
  if (bootstrapPatch) {
    const result = rt.applyPatch(bootstrapPatch, { allowCreateModel: true, trustedBootstrap: true });
    log(`loaded bootstrap patch from MODELTABLE_PATCH_JSON (applied=${result.applied} rejected=${result.rejected})`);
  }

  const sys = rt.getModel(-10);
  if (!sys) {
    logErr('System model (-10) not found after loading patches');
    process.exitCode = 1;
    return;
  }
  rt.setRuntimeMode('edit');
  log(`runtime_mode=${rt.getRuntimeMode()}`);

  // 4. Read connection parameters from Model 0 bootstrap labels.
  const matrixConfig = readMatrixBootstrapConfig(rt);
  const mqttConfig = readMqttBootstrapConfig(rt);
  const matrixRoomId = matrixConfig.roomId;
  const mqttHost = mqttConfig.host;
  const mqttPort = mqttConfig.port;
  const mqttUser = '';
  const mqttPass = '';
  if (!mqttHost || !Number.isInteger(mqttPort)) {
    logErr('missing mqtt.local.ip / mqtt.local.port on Model 0 (0,0,0)');
    process.exitCode = 1;
    return;
  }

  // 5. Read wiring config from labels
  const matrixEventFilter = String(getLabel(rt, -10, 0, 0, 0, 'mbr_matrix_event_filter') || 'ui_event');
  const matrixInboxLabel = String(getLabel(rt, -10, 0, 0, 0, 'mbr_matrix_inbox_label') || 'mbr_mgmt_inbox');
  const matrixTrigger = String(getLabel(rt, -10, 0, 0, 0, 'mbr_matrix_trigger') || 'run_mbr_mgmt_to_mqtt');
  const mqttInboxLabel = String(getLabel(rt, -10, 0, 0, 0, 'mbr_mqtt_inbox_label') || 'mbr_mqtt_inbox');
  const mqttTrigger = String(getLabel(rt, -10, 0, 0, 0, 'mbr_mqtt_trigger') || 'run_mbr_mqtt_to_mgmt');

  const mqttModelIds = getLabel(rt, -10, 0, 0, 0, 'mbr_mqtt_model_ids');
  const heartbeatRaw = getLabel(rt, -10, 0, 0, 0, 'mbr_heartbeat_interval_ms');
  const heartbeatMs = Number.isInteger(heartbeatRaw) ? heartbeatRaw : 30000;

  // 6. MQTT topic base (from system patch, Model 0)
  const base = String(getLabel(rt, 0, 0, 0, 0, 'mqtt_topic_base') || '').trim();
  if (!base) {
    logErr('missing mqtt_topic_base in Model 0');
    process.exitCode = 1;
    return;
  }

  // Build subscription topics from model IDs
  const modelIds = Array.isArray(mqttModelIds) ? mqttModelIds : [2];
  const subscribeTopics = [];
  for (const mid of modelIds) {
    subscribeTopics.push(`${base}/${mid}/patch_out`);
  }

  // 7. Create MQTT client
  const mqttUrl = `mqtt://${mqttHost}:${mqttPort}`;
  const mqttClient = mqtt.connect(mqttUrl, {
    username: mqttUser,
    password: mqttPass,
    clientId: `dy-worker-${Date.now()}`,
    reconnectPeriod: 500,
  });

  const mqttPublish = (topic, payload) => {
    const opId = payload && typeof payload === 'object' ? (payload.op_id || '') : '';
    log(`mqtt publish topic=${topic} op_id=${opId}`);
    mqttClient.publish(topic, JSON.stringify(payload));
  };

  // 8. Create engine
  const engine = new WorkerEngineV0({ runtime: rt, mgmtAdapter: null, mqttPublish });

  let mqttReady = false;
  let matrixReady = !matrixRoomId;
  let runtimeActivated = false;
  const maybeActivateRunning = () => {
    if (runtimeActivated || !mqttReady || !matrixReady) return;
    rt.setRuntimeMode('running');
    runtimeActivated = true;
    log(`runtime_mode=${rt.getRuntimeMode()}`);
    rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_ready', t: 'str', v: '1' });
    engine.tick();
    setInterval(() => {
      rt.addLabel(sys, 0, 0, 0, { k: 'run_mbr_heartbeat', t: 'str', v: '1' });
      engine.tick();
    }, heartbeatMs);
  };

  // 9. Matrix adapter (if room ID configured)
  let mgmtAdapter = null;
  if (matrixRoomId) {
    const filterTypes = matrixEventFilter.split(',').map(s => s.trim());

    createMatrixLiveAdapter({
      roomId: matrixRoomId,
      syncTimeoutMs: 20000,
      homeserverUrl: matrixConfig.homeserverUrl || undefined,
      accessToken: matrixConfig.accessToken || undefined,
      userId: matrixConfig.userId || undefined,
      password: matrixConfig.password || undefined,
      peerUserId: matrixConfig.peerUserId || undefined,
    })
      .then((adapter) => {
        mgmtAdapter = adapter;
        engine.mgmtAdapter = adapter;

        adapter.subscribe((event) => {
          if (!event || event.version !== 'v0') return;
          if (!filterTypes.includes(event.type)) return;
          log(`recv mgmt ${event.type} op_id=${event.op_id}`);
          rt.addLabel(sys, 0, 0, 0, { k: matrixInboxLabel, t: 'json', v: event });
          rt.addLabel(sys, 0, 0, 0, { k: matrixTrigger, t: 'str', v: '1' });
          engine.tick();
        });

        log(`mgmt READY room_id=${adapter.room_id}`);
        matrixReady = true;
        maybeActivateRunning();
      })
      .catch((err) => {
        logErr(`matrix adapter init failed: ${err && err.stack ? err.stack : err}`);
        process.exitCode = 1;
      });
  } else {
    log('No matrix room ID configured, skipping Matrix adapter');
  }

  // 10. MQTT event handler
  mqttClient.on('connect', () => {
    for (const topic of subscribeTopics) {
      mqttClient.subscribe(topic);
    }
    log(`mqtt READY subscribed=${subscribeTopics.join(', ')}`);
    mqttReady = true;
    maybeActivateRunning();
    log('READY');
  });

  mqttClient.on('message', (topic, buf) => {
    if (!subscribeTopics.includes(topic)) return;
    let payload = null;
    try {
      payload = JSON.parse(buf.toString('utf8'));
    } catch (_) {
      return;
    }
    if (!payload || typeof payload !== 'object' || payload.version !== 'mt.v0') return;
    log(`recv mqtt topic=${topic} op_id=${payload.op_id || ''}`);
    rt.addLabel(sys, 0, 0, 0, { k: mqttInboxLabel, t: 'json', v: { topic, payload } });
    rt.addLabel(sys, 0, 0, 0, { k: mqttTrigger, t: 'str', v: '1' });
    engine.tick();
  });

  // 11. Graceful shutdown
  process.on('SIGINT', () => {
    try { if (mgmtAdapter && mgmtAdapter.close) mgmtAdapter.close(); } catch (_) { /* */ }
    try { mqttClient.end(true); } catch (_) { /* */ }
    process.exit(0);
  });
}

try {
  main();
} catch (err) {
  logErr('FAILED');
  logErr(String(err && err.stack ? err.stack : err));
  process.exitCode = 1;
}
