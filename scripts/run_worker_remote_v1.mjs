/**
 * Remote Worker v1 — Fill-Table Architecture (0144)
 *
 * Minimal bootstrap: load patches → startMqttLoop → runtime handles everything.
 * No WorkerEngineV0. No manual MQTT subscription. No manual event routing.
 *
 * Chain: startMqttLoop → mqttIncoming → IN label → cell_connection → CELL_CONNECT → AsyncFunction
 *
 * Usage:
 *   bun scripts/run_worker_remote_v1.mjs <patch_dir>
 *   DY_ROLE_PATCH_DIR=deploy/sys-v1ns/remote-worker/patches bun scripts/run_worker_remote_v1.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadSystemPatch } from './worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');

// --- Configuration from environment ---
const MQTT_HOST = process.env.DY_MQTT_HOST || process.env.MQTT_HOST || '127.0.0.1';
const MQTT_PORT = parseInt(process.env.DY_MQTT_PORT || process.env.MQTT_PORT || '1883', 10);
const MQTT_USER = process.env.DY_MQTT_USER || process.env.MQTT_USER || 'u';
const MQTT_PASS = process.env.DY_MQTT_PASS || process.env.MQTT_PASS || 'p';
const WORKER_ID = process.env.WORKER_ID || '2';
const PATCH_DIR = process.argv[2] || process.env.DY_ROLE_PATCH_DIR || '';

if (!PATCH_DIR) {
  process.stderr.write('Usage: bun scripts/run_worker_remote_v1.mjs <patch_dir>\n');
  process.stderr.write('  or: DY_ROLE_PATCH_DIR=... bun scripts/run_worker_remote_v1.mjs\n');
  process.exit(1);
}

const patchDirAbs = path.resolve(PATCH_DIR);
if (!fs.existsSync(patchDirAbs)) {
  process.stderr.write(`Patch directory not found: ${patchDirAbs}\n`);
  process.exit(1);
}

process.stdout.write(`[remote-worker-v1] Starting (fill-table architecture)\n`);
process.stdout.write(`[remote-worker-v1] MQTT: ${MQTT_HOST}:${MQTT_PORT}\n`);
process.stdout.write(`[remote-worker-v1] Patch dir: ${patchDirAbs}\n`);

// --- 1. Create runtime + load system patches ---
const rt = new ModelTableRuntime();
loadSystemPatch(rt);

// --- 2. Load role patches (alphabetical order) ---
const patchFiles = fs.readdirSync(patchDirAbs)
  .filter(f => f.endsWith('.json'))
  .sort();

for (const file of patchFiles) {
  const filePath = path.join(patchDirAbs, file);
  const patch = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const result = rt.applyPatch(patch, { allowCreateModel: true });
  process.stdout.write(`[remote-worker-v1] Loaded ${file}: applied=${result.applied}, rejected=${result.rejected}\n`);
}

// --- 3. Start MQTT loop (runtime handles everything) ---
const mqttResult = rt.startMqttLoop({
  transport: 'real',
  host: MQTT_HOST,
  port: MQTT_PORT,
  client_id: `dy-remote-worker-${WORKER_ID}-${Date.now()}`,
  username: MQTT_USER,
  password: MQTT_PASS,
  tls: false,
});
process.stdout.write(`[remote-worker-v1] MQTT startMqttLoop: ${JSON.stringify(mqttResult)}\n`);

if (mqttResult.status !== 'running') {
  process.stderr.write(`[remote-worker-v1] MQTT failed to start: ${JSON.stringify(mqttResult)}\n`);
  process.exit(1);
}

// --- 4. Report subscriptions ---
process.stdout.write(`[remote-worker-v1] BUS_IN ports: [${[...rt.busInPorts.keys()].join(', ')}]\n`);
process.stdout.write(`[remote-worker-v1] BUS_OUT ports: [${[...rt.busOutPorts.keys()].join(', ')}]\n`);

// Count MQTT_WILDCARD_SUB labels
let subCount = 0;
for (const [, model] of rt.models) {
  for (const [, cell] of model.cells) {
    for (const [, label] of cell.labels) {
      if (label.t === 'MQTT_WILDCARD_SUB') subCount++;
    }
  }
}
process.stdout.write(`[remote-worker-v1] MQTT_WILDCARD_SUB labels: ${subCount}\n`);

// --- 5. Heartbeat (optional diagnostic logging) ---
const heartbeatTimer = setInterval(() => {
  const model100 = rt.getModel(100);
  if (model100) {
    const cell = rt.getCell(model100, 0, 0, 0);
    const bgColor = cell.labels.get('bg_color')?.v || 'N/A';
    const status = cell.labels.get('status')?.v || 'N/A';
    process.stdout.write(`[remote-worker-v1] Heartbeat — Model 100: bg_color=${bgColor}, status=${status}\n`);
  }
}, 30000);
heartbeatTimer.unref();

process.stdout.write(`[remote-worker-v1] Ready. Runtime handles: mqttIncoming → IN → cell_connection → CELL_CONNECT → function\n`);
