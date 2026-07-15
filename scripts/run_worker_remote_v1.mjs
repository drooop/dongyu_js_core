/**
 * Remote Worker v1 — Fill-Table Architecture (0144)
 *
 * Minimal bootstrap: load patches → startMqttLoop → apply patch-configured subscriptions.
 * No WorkerEngineV0. No manual business dispatch logic. Subscription topics remain patch-driven.
 *
 * Chain: startMqttLoop → mqttIncoming → Model 0 bus ingress → parent connection → child function
 *
 * Usage:
 *   bun scripts/run_worker_remote_v1.mjs <patch_dir>
 *   DY_ROLE_PATCH_DIR=deploy/sys-v1ns/remote-worker/patches bun scripts/run_worker_remote_v1.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  ACTOR_ATTESTATION_MARKER,
  buildDeActorAttestation,
  createDeActorAttestationHeartbeat,
} from './lib/de_actor_attestation.mjs';
import { createRoleScopedDeRuntimeDiagnosticHeartbeat } from './lib/de_runtime_diagnostics.mjs';
import { createDeNetworkBoundaryObservability } from './lib/de_network_boundary_evidence.mjs';
import {
  createDePinFlowEvidenceEmitter,
} from '../packages/worker-base/src/de_pin_flow_evidence.mjs';
import { createR1PinFlowEvidenceWiring } from '../packages/worker-base/src/de_pin_flow_wiring.mjs';
import { loadSystemPatch } from './worker_engine_v0.mjs';
import {
  applyPersistedAssetEntries,
  readPersistedAssetManifest,
  resolvePersistedAssetRoot,
  selectPersistedAssetEntries,
} from '../packages/worker-base/src/persisted_asset_loader.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');

export function createRemoteWorkerNetworkBoundaryObservability({
  workerScope = 'remote-worker',
  mqttDestination,
  writeLine,
  now,
  setIntervalFn,
  clearIntervalFn,
  heartbeatIntervalMs,
}) {
  if (workerScope !== 'remote-worker' && workerScope !== 'workspace-manager') {
    throw new TypeError('workerScope must be remote-worker or workspace-manager');
  }
  return createDeNetworkBoundaryObservability({
    service: workerScope,
    effectiveDestinations: [mqttDestination],
    writeLine,
    now,
    setIntervalFn,
    clearIntervalFn,
    heartbeatIntervalMs,
  });
}

// --- Configuration from environment ---
const MQTT_HOST = process.env.DY_MQTT_HOST || process.env.MQTT_HOST || '127.0.0.1';
const MQTT_PORT = parseInt(process.env.DY_MQTT_PORT || process.env.MQTT_PORT || '1883', 10);
const MQTT_USER = process.env.DY_MQTT_USER || process.env.MQTT_USER || 'u';
const MQTT_PASS = process.env.DY_MQTT_PASS || process.env.MQTT_PASS || 'p';
const mqttDestination = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
const WORKER_ID = process.env.WORKER_ID || '2';
const PATCH_DIR = process.argv[2] || process.env.DY_ROLE_PATCH_DIR || '';
const ASSET_ROOT = resolvePersistedAssetRoot();
const WORKER_SCOPE = process.env.DY_WORKER_SCOPE || 'remote-worker';
const LOG_PREFIX = process.env.DY_WORKER_LOG_PREFIX || WORKER_SCOPE;
const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const sourceFiles = ASSET_ROOT
  ? selectPersistedAssetEntries(readPersistedAssetManifest(ASSET_ROOT), {
    scope: WORKER_SCOPE,
    authority: 'authoritative',
    kind: 'patch',
    phases: ['00-system-base', '20-role-negative', '40-role-positive'],
  })
    .filter((entry) => fs.existsSync(path.join(ASSET_ROOT, String(entry.path || ''))))
    .map((entry) => String(entry.path))
  : ['packages/worker-base/system-models/system_models.json'];

if (!ASSET_ROOT && !PATCH_DIR) {
  process.stderr.write('Usage: bun scripts/run_worker_remote_v1.mjs <patch_dir>\n');
  process.stderr.write('  or: DY_ROLE_PATCH_DIR=... bun scripts/run_worker_remote_v1.mjs\n');
  process.exit(1);
}

const patchDirAbs = PATCH_DIR ? path.resolve(PATCH_DIR) : '';
if (!ASSET_ROOT && !fs.existsSync(patchDirAbs)) {
  process.stderr.write(`Patch directory not found: ${patchDirAbs}\n`);
  process.exit(1);
}

process.stdout.write(`[${LOG_PREFIX}] Starting (fill-table architecture, scope=${WORKER_SCOPE})\n`);
process.stdout.write(`[${LOG_PREFIX}] MQTT: ${MQTT_HOST}:${MQTT_PORT}\n`);
if (ASSET_ROOT) {
  process.stdout.write(`[${LOG_PREFIX}] Persisted asset root: ${ASSET_ROOT}\n`);
} else {
  process.stdout.write(`[${LOG_PREFIX}] Patch dir: ${patchDirAbs}\n`);
}

// --- 1. Create runtime + load system patches ---
const rt = new ModelTableRuntime();
loadSystemPatch(rt, { assetRoot: ASSET_ROOT, scope: WORKER_SCOPE });
const runtimeDiagnostics = createRoleScopedDeRuntimeDiagnosticHeartbeat({
  workerScope: WORKER_SCOPE,
  runtime: rt,
  writeLine: (line) => process.stdout.write(`${line}\n`),
  beforeEmit: (reason) => {
    process.stdout.write(`[${LOG_PREFIX}] MQTT connected: ${Boolean(rt.mqttClient && rt.mqttClient.connected)} status=${mqttRuntimeStatus()} reason=${reason}\n`);
    process.stdout.write(`[${LOG_PREFIX}] MQTT subscriptions: ${JSON.stringify(rt.mqttClient ? [...rt.mqttClient.subscriptions].sort() : [])}\n`);
  },
  setIntervalFn: setInterval,
  clearIntervalFn: clearInterval,
  heartbeatIntervalMs: 10000,
});
const emitPinFlowEvidenceLine = createDePinFlowEvidenceEmitter({
  producer: 'r1',
  writeLine: (line) => process.stdout.write(`${line}\n`),
  now: Date.now,
});

const r1PinFlowWiring = createR1PinFlowEvidenceWiring({
  runtime: rt,
  emitEvidence: emitPinFlowEvidenceLine,
  onEvidenceError: ({ code, stage }) => {
    process.stderr.write(`[${LOG_PREFIX}] ${code} stage=${stage}\n`);
  },
});
rt.mqttIncoming = r1PinFlowWiring.mqttIncoming;

function mqttRuntimeStatus() {
  const model0 = rt.getModel(0);
  if (!model0) return 'missing_model0';
  const root = rt.getCell(model0, 0, 0, 0);
  return String(root.labels.get('mqtt_runtime_status')?.v || 'unknown');
}

// --- 2. Load role patches (alphabetical order) ---
if (ASSET_ROOT) {
  const result = applyPersistedAssetEntries(rt, {
    assetRoot: ASSET_ROOT,
    scope: WORKER_SCOPE,
    authority: 'authoritative',
    kind: 'patch',
    phases: ['20-role-negative', '40-role-positive'],
    applyOptions: { allowCreateModel: true, trustedBootstrap: true },
  });
  process.stdout.write(`[${LOG_PREFIX}] Loaded persisted assets: entries=${result.entriesApplied}, patches=${result.patchObjectsApplied}\n`);
} else {
  const patchFiles = fs.readdirSync(patchDirAbs)
    .filter(f => f.endsWith('.json'))
    .sort();

  for (const file of patchFiles) {
    const filePath = path.join(patchDirAbs, file);
    const patch = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const result = rt.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
    sourceFiles.push(path.relative(REPO_ROOT, filePath));
    process.stdout.write(`[${LOG_PREFIX}] Loaded ${file}: applied=${result.applied}, rejected=${result.rejected}\n`);
  }
}
rt.setRuntimeMode('edit');
process.stdout.write(`[${LOG_PREFIX}] runtime_mode=${rt.getRuntimeMode()}\n`);

const actorAttestation = buildDeActorAttestation({ runtime: rt, sourceFiles });
process.stdout.write(`${ACTOR_ATTESTATION_MARKER} ${JSON.stringify(actorAttestation)}\n`);
if (process.env.DY_ACTOR_ATTEST_ONLY === '1') process.exit(0);

const sysModel = rt.getModel(-10);
const remoteSubConfig = sysModel ? rt.getLabelValue(sysModel, 0, 0, 0, 'remote_subscriptions') : null;
const remoteSubscriptions = Array.isArray(remoteSubConfig)
  ? remoteSubConfig.filter((topic) => typeof topic === 'string' && topic.trim())
  : [];

// --- 3. Start MQTT loop (runtime handles everything) ---
const networkBoundaryObservability = createRemoteWorkerNetworkBoundaryObservability({
  workerScope: WORKER_SCOPE,
  mqttDestination,
  writeLine: (line) => process.stdout.write(`${line}\n`),
  now: Date.now,
  setIntervalFn: setInterval,
  clearIntervalFn: clearInterval,
  heartbeatIntervalMs: 10000,
});
process.once('exit', () => networkBoundaryObservability.stop());
networkBoundaryObservability.recordOutbound(mqttDestination);
const mqttResult = rt.startMqttLoop({
  transport: 'real',
  host: MQTT_HOST,
  port: MQTT_PORT,
  client_id: `dy-${WORKER_SCOPE}-${WORKER_ID}-${Date.now()}`,
  username: MQTT_USER,
  password: MQTT_PASS,
  tls: false,
});
process.stdout.write(`[${LOG_PREFIX}] MQTT startMqttLoop: ${JSON.stringify(mqttResult)}\n`);

if (mqttResult.status !== 'running') {
  networkBoundaryObservability.stop();
  process.stderr.write(`[${LOG_PREFIX}] MQTT failed to start: ${JSON.stringify(mqttResult)}\n`);
  process.exit(1);
}
const actorAttestationHeartbeat = createDeActorAttestationHeartbeat({
  attestation: actorAttestation,
  writeLine: (line) => process.stdout.write(`${line}\n`),
  heartbeatIntervalMs: 10000,
});
process.once('exit', () => actorAttestationHeartbeat.stop());
const runtimeMqttPublish = rt.mqttClient.publish.bind(rt.mqttClient);
rt.mqttClient.publish = (topic, packet) => {
  networkBoundaryObservability.recordOutbound(mqttDestination);
  return r1PinFlowWiring.publishControlResponse(runtimeMqttPublish, topic, packet);
};
rt.setRuntimeMode('running');
process.stdout.write(`[${LOG_PREFIX}] runtime_mode=${rt.getRuntimeMode()}\n`);

// --- 4. Report subscriptions ---
for (const topic of remoteSubscriptions) {
  rt.mqttClient.subscribe(topic);
}
process.stdout.write(`[${LOG_PREFIX}] bus.in ports: [${[...rt.busInPorts.keys()].join(', ')}]\n`);
process.stdout.write(`[${LOG_PREFIX}] bus.out ports: [${[...rt.busOutPorts.keys()].join(', ')}]\n`);
process.stdout.write(`[${LOG_PREFIX}] patch subscriptions: ${JSON.stringify(remoteSubscriptions)}\n`);
runtimeDiagnostics.start();

// --- 5. Heartbeat (optional non-Model3200 diagnostic logging) ---

const heartbeatTimer = setInterval(() => {
  const model100 = rt.getModel(100);
  if (model100) {
    const cell = rt.getCell(model100, 0, 0, 0);
    const bgColor = cell.labels.get('bg_color')?.v || 'N/A';
    const status = cell.labels.get('status')?.v || 'N/A';
    process.stdout.write(`[${LOG_PREFIX}] Heartbeat — Model 100: bg_color=${bgColor}, status=${status}\n`);
  }
}, 30000);
heartbeatTimer.unref();

process.once('SIGINT', () => {
  networkBoundaryObservability.stop();
  actorAttestationHeartbeat.stop();
  runtimeDiagnostics.stop();
  clearInterval(heartbeatTimer);
  process.exit(0);
});

process.stdout.write(`[${LOG_PREFIX}] Ready. Runtime handles: mqttIncoming -> Model 0 bus ingress -> parent connection -> child function\n`);
