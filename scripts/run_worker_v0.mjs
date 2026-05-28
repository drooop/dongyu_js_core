/**
 * Generic Worker Bootstrap v0
 *
 * Loads system patch + role patches from a directory, applies optional
 * bootstrap patch from MODELTABLE_PATCH_JSON, reads connection
 * parameters from Model 0, initializes adapters (Matrix / MQTT),
 * routes inbound events into configured inbox labels, executes
 * configured role functions by name, and runs the engine tick loop.
 *
 * Usage:
 *   bun scripts/run_worker_v0.mjs <patch_dir>
 *   DY_ROLE_PATCH_DIR=deploy/sys-v1ns/mbr/patches bun scripts/run_worker_v0.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { WorkerEngineV0, loadSystemPatch } from './worker_engine_v0.mjs';
import { readMatrixBootstrapConfig, readMqttBootstrapConfig } from '../packages/worker-base/src/bootstrap_config.mjs';
import { applyPersistedAssetEntries, resolvePersistedAssetRoot } from '../packages/worker-base/src/persisted_asset_loader.mjs';

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

function runtimeBridgeActive(runtime) {
  if (!runtime) return false;
  if (typeof runtime.isRuntimeRunning === 'function') {
    return runtime.isRuntimeRunning();
  }
  if (typeof runtime.isRunLoopActive === 'function') {
    return runtime.isRunLoopActive();
  }
  return false;
}

function topicMatchesSubscription(subscription, topic) {
  if (subscription === topic) return true;
  if (typeof subscription !== 'string' || typeof topic !== 'string') return false;
  const subParts = subscription.split('/');
  const topicParts = topic.split('/');
  for (let index = 0; index < subParts.length; index += 1) {
    const part = subParts[index];
    if (part === '#') return index === subParts.length - 1;
    if (index >= topicParts.length) return false;
    if (part === '+') continue;
    if (part !== topicParts[index]) return false;
  }
  return subParts.length === topicParts.length;
}

export function isStrictPinPayloadPacket(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const keys = Object.keys(payload).sort();
  if (keys.length !== 3 || keys[0] !== 'payload' || keys[1] !== 'type' || keys[2] !== 'version') return false;
  return payload.version === 'v1' && payload.type === 'pin_payload' && Array.isArray(payload.payload);
}

function isSafeTopicSegment(value) {
  return typeof value === 'string'
    && value.trim() === value
    && value.length > 0
    && !value.includes('/')
    && !value.includes('+')
    && !value.includes('#');
}

function isCanonicalPositiveIntSegment(value) {
  return typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
}

function isValidUnifiedTopicBase(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
  const parts = value.split('/');
  return parts.length === 5
    && parts[0] === 'UIPUT'
    && parts.every((part) => isSafeTopicSegment(part));
}

function isValidPayloadTopic(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
  const parts = value.split('/');
  return parts.length === 8
    && parts[0] === 'UIPUT'
    && parts.every((part) => isSafeTopicSegment(part))
    && isCanonicalPositiveIntSegment(parts[6]);
}

function payloadTopicParts(value) {
  if (!isValidPayloadTopic(value)) return null;
  const parts = value.split('/');
  return {
    base: parts.slice(0, 5).join('/'),
    endpoint: {
      worker_id: parts[5],
      model_id: Number(parts[6]),
      pin: parts[7],
    },
  };
}

function endpointMatches(left, right) {
  return Boolean(left && right
    && left.worker_id === right.worker_id
    && left.model_id === right.model_id
    && left.pin === right.pin);
}

function endpointTopicFromBase(base, endpoint) {
  if (!isValidUnifiedTopicBase(base) || !endpoint) return '';
  if (!isSafeTopicSegment(endpoint.worker_id)) return '';
  if (!Number.isInteger(endpoint.model_id) || endpoint.model_id <= 0) return '';
  if (!isSafeTopicSegment(endpoint.pin)) return '';
  return `${base}/${endpoint.worker_id}/${endpoint.model_id}/${endpoint.pin}`;
}

function validatePinPayloadTopicContract({ messageRole, topic, responseTopic, endpoint, replyTarget }) {
  const topicParts = payloadTopicParts(topic);
  if (!topicParts) return 'invalid_topic';
  const responseTopicParts = payloadTopicParts(responseTopic);
  if (!responseTopicParts) return 'invalid_response_topic';
  if (responseTopicParts.base !== topicParts.base) return 'response_topic_mismatch';
  const expectedResponseTopic = endpointTopicFromBase(topicParts.base, replyTarget);
  if (!expectedResponseTopic || responseTopic !== expectedResponseTopic) return 'response_topic_mismatch';
  if (messageRole === 'request') {
    if (topic === responseTopic) return 'response_topic_mismatch';
    if (!endpointMatches(topicParts.endpoint, endpoint)) return 'endpoint_mismatch';
    return null;
  }
  if (messageRole === 'response') {
    if (topic !== responseTopic) return 'response_topic_mismatch';
    if (!endpointMatches(endpoint, replyTarget)) return 'endpoint_mismatch';
    if (!endpointMatches(topicParts.endpoint, replyTarget)) return 'endpoint_mismatch';
    return null;
  }
  return 'invalid_message_role';
}

function isTemporaryPayloadRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  const keys = Object.keys(record).sort();
  if (keys.length !== 7 || keys.join('|') !== 'c|id|k|p|r|t|v') return false;
  return Number.isInteger(record.id)
    && Number.isInteger(record.p)
    && Number.isInteger(record.r)
    && Number.isInteger(record.c)
    && typeof record.k === 'string'
    && record.k.length > 0
    && typeof record.t === 'string'
    && record.t.length > 0;
}

function isTemporaryPayloadRecordArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isTemporaryPayloadRecord);
}

function isLegacyPinPayloadKey(key) {
  return key === 'source_model_id'
    || key === 'pin'
    || key === 'route'
    || key === 'reply_to'
    || key === 'route.reply_to'
    || key === 'return_topic'
    || key === 'returnTopic'
    || key === 'result_topic';
}

function containsLegacyPinPayloadMetadata(value, seen = new WeakSet()) {
  if (!value) return false;
  if (Array.isArray(value)) {
    if (seen.has(value)) return false;
    seen.add(value);
    return value.some((item) => containsLegacyPinPayloadMetadata(item, seen));
  }
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (isLegacyPinPayloadKey(key)) return true;
    if (key === 'k' && typeof child === 'string' && isLegacyPinPayloadKey(child)) return true;
    if (key === 'route' && child && typeof child === 'object' && !Array.isArray(child) && Object.prototype.hasOwnProperty.call(child, 'reply_to')) return true;
    if (containsLegacyPinPayloadMetadata(child, seen)) return true;
  }
  return false;
}

function isSlideAppBundleResponsePayload(records) {
  if (!isTemporaryPayloadRecordArray(records)) return false;
  const kind = records.find((record) => record
    && record.id === 0
    && record.p === 0
    && record.r === 0
    && record.c === 0
    && record.k === '__mt_payload_kind');
  return kind && kind.t === 'str' && kind.v === 'slide_app_bundle_response.v1';
}

function recordsContainLegacyPinPayloadMetadata(records, options = {}) {
  if (!isTemporaryPayloadRecordArray(records)) return true;
  const allowSlideAppBundlePayload = options.allowSlideAppBundlePayload === true
    && isSlideAppBundleResponsePayload(records);
  for (const record of records) {
    if (isLegacyPinPayloadKey(record.k)) return true;
    if (allowSlideAppBundlePayload && record.k === 'bundle_payload') {
      if (!isTemporaryPayloadRecordArray(record.v)) return true;
      if (record.v.some((bundleRecord) => isLegacyPinPayloadKey(bundleRecord.k))) return true;
      continue;
    }
    if (containsLegacyPinPayloadMetadata(record.v)) return true;
  }
  return false;
}

function pinPayloadRecord(payload, key) {
  if (!payload || !Array.isArray(payload.payload)) return null;
  return payload.payload.find((item) => item
    && item.id === 0
    && item.p === 0
    && item.r === 0
    && item.c === 0
    && item.k === key) || null;
}

function pinPayloadString(payload, key) {
  const record = pinPayloadRecord(payload, key);
  return record && record.t === 'str' && typeof record.v === 'string' ? record.v : '';
}

function pinPayloadInt(payload, key) {
  const record = pinPayloadRecord(payload, key);
  return record && record.t === 'int' && Number.isInteger(record.v) ? record.v : null;
}

function hasInvalidPinPayloadStringRecord(payload, key) {
  const record = pinPayloadRecord(payload, key);
  return Boolean(record && (record.t !== 'str' || typeof record.v !== 'string'));
}

function hasDuplicatePinPayloadRecordKeys(payload, keys) {
  if (!payload || !Array.isArray(payload.payload)) return false;
  const watched = new Set(keys);
  const seen = new Set();
  for (const record of payload.payload) {
    if (!record || !watched.has(record.k)) continue;
    if (seen.has(record.k)) return true;
    seen.add(record.k);
  }
  return false;
}

function isStrictNonBlankString(value) {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function validatePinPayloadRecordEnvelope(payload) {
  if (!isStrictPinPayloadPacket(payload)) {
    return { ok: false, reason: 'invalid_pin_payload_packet' };
  }
  if (!isTemporaryPayloadRecordArray(payload.payload)) {
    return { ok: false, reason: 'invalid_pin_payload_records' };
  }
  const kind = pinPayloadString(payload, '__mt_payload_kind');
  if (kind !== 'pin_payload.v1') {
    return { ok: false, reason: 'invalid_payload_kind' };
  }
  const stringMetadataKeys = [
    '__mt_request_id',
    'op_id',
    'message_role',
    'topic',
    'response_topic',
    'endpoint_worker_id',
    'endpoint_pin',
    'origin_worker_id',
    'origin_pin',
    'reply_target_worker_id',
    'reply_target_pin',
  ];
  const metadataKeys = stringMetadataKeys.concat([
    '__mt_payload_kind',
    'endpoint_model_id',
    'origin_model_id',
    'reply_target_model_id',
    'payload',
    'timestamp',
    'bus_out_key',
    'bus',
    'route_kind',
  ]);
  if (hasDuplicatePinPayloadRecordKeys(payload, metadataKeys)) {
    return { ok: false, reason: 'invalid_pin_payload_records' };
  }
  for (const key of stringMetadataKeys) {
    if (hasInvalidPinPayloadStringRecord(payload, key)) {
      return { ok: false, reason: 'invalid_pin_payload_records' };
    }
  }
  const requestId = pinPayloadString(payload, '__mt_request_id');
  const opId = pinPayloadString(payload, 'op_id');
  const requestIdIsValid = requestId === '' || isStrictNonBlankString(requestId);
  const opIdIsValid = opId === '' || isStrictNonBlankString(opId);
  if (!requestIdIsValid || !opIdIsValid) {
    return { ok: false, reason: 'invalid_pin_payload_records' };
  }
  if (!requestId && !opId) {
    return { ok: false, reason: 'missing_request_correlation' };
  }
  const messageRole = pinPayloadString(payload, 'message_role');
  if (messageRole !== 'request' && messageRole !== 'response') {
    return { ok: false, reason: 'invalid_message_role' };
  }
  const topicValue = pinPayloadString(payload, 'topic');
  const responseTopicValue = pinPayloadString(payload, 'response_topic');
  if (!isValidPayloadTopic(topicValue)) {
    return { ok: false, reason: 'invalid_topic' };
  }
  if (!isValidPayloadTopic(responseTopicValue)) {
    return { ok: false, reason: 'invalid_response_topic' };
  }
  for (const record of payload.payload) {
    if (isLegacyPinPayloadKey(record.k)) {
      return { ok: false, reason: 'legacy_pin_payload_metadata_removed' };
    }
    if (record.k !== 'payload' && containsLegacyPinPayloadMetadata(record.v)) {
      return { ok: false, reason: 'legacy_pin_payload_metadata_removed' };
    }
  }
  const endpointWorkerId = pinPayloadString(payload, 'endpoint_worker_id');
  const endpointModelId = pinPayloadInt(payload, 'endpoint_model_id');
  const endpointPin = pinPayloadString(payload, 'endpoint_pin');
  const originWorkerId = pinPayloadString(payload, 'origin_worker_id');
  const originModelId = pinPayloadInt(payload, 'origin_model_id');
  const originPin = pinPayloadString(payload, 'origin_pin');
  const replyTargetWorkerId = pinPayloadString(payload, 'reply_target_worker_id');
  const replyTargetModelId = pinPayloadInt(payload, 'reply_target_model_id');
  const replyTargetPin = pinPayloadString(payload, 'reply_target_pin');
  const nestedPayload = pinPayloadRecord(payload, 'payload');
  if (
    !isSafeTopicSegment(endpointWorkerId)
    || !Number.isInteger(endpointModelId)
    || endpointModelId <= 0
    || !isSafeTopicSegment(endpointPin)
    || !isSafeTopicSegment(originWorkerId)
    || !Number.isInteger(originModelId)
    || originModelId <= 0
    || !isSafeTopicSegment(originPin)
    || !isSafeTopicSegment(replyTargetWorkerId)
    || !Number.isInteger(replyTargetModelId)
    || replyTargetModelId <= 0
    || !isSafeTopicSegment(replyTargetPin)
    || !nestedPayload
    || nestedPayload.t !== 'json'
    || !isTemporaryPayloadRecordArray(nestedPayload.v)
  ) {
    return { ok: false, reason: 'invalid_pin_payload_records' };
  }
  if (recordsContainLegacyPinPayloadMetadata(nestedPayload.v, { allowSlideAppBundlePayload: true })) {
    return { ok: false, reason: 'legacy_pin_payload_metadata_removed' };
  }
  const topicContractError = validatePinPayloadTopicContract({
    messageRole,
    topic: topicValue,
    responseTopic: responseTopicValue,
    endpoint: { worker_id: endpointWorkerId, model_id: endpointModelId, pin: endpointPin },
    replyTarget: { worker_id: replyTargetWorkerId, model_id: replyTargetModelId, pin: replyTargetPin },
  });
  if (topicContractError) {
    return { ok: false, reason: topicContractError };
  }
  return {
    ok: true,
    message_role: messageRole,
    topic: topicValue,
    response_topic: responseTopicValue,
    endpoint: { worker_id: endpointWorkerId, model_id: endpointModelId, pin: endpointPin },
    origin: { worker_id: originWorkerId, model_id: originModelId, pin: originPin },
    reply_target: { worker_id: replyTargetWorkerId, model_id: replyTargetModelId, pin: replyTargetPin },
  };
}

export function validateUnifiedMatrixEventPacket(event) {
  return validatePinPayloadRecordEnvelope(event);
}

export function validateUnifiedEndpointTopicPacket(topic, payload, base) {
  const topicBase = typeof base === 'string' ? base : '';
  if (!isValidUnifiedTopicBase(topicBase) || typeof topic !== 'string' || !topic.startsWith(`${topicBase}/`)) {
    return { ok: false, reason: 'invalid_topic_base' };
  }
  const parts = topic.slice(topicBase.length + 1).split('/');
  if (parts.length !== 3) {
    return { ok: false, reason: 'invalid_unified_endpoint_topic' };
  }
  const [workerId, modelIdRaw, pin] = parts;
  if (!isCanonicalPositiveIntSegment(modelIdRaw)) {
    return { ok: false, reason: 'invalid_unified_endpoint_topic' };
  }
  const modelId = Number(modelIdRaw);
  if (!isSafeTopicSegment(workerId) || !Number.isInteger(modelId) || modelId <= 0 || !isSafeTopicSegment(pin)) {
    return { ok: false, reason: 'invalid_unified_endpoint_topic' };
  }
  const parsed = validatePinPayloadRecordEnvelope(payload);
  if (!parsed.ok) return parsed;
  const { endpoint } = parsed;
  if (endpoint.worker_id !== workerId || endpoint.model_id !== modelId || endpoint.pin !== pin) {
    return { ok: false, reason: 'endpoint_mismatch' };
  }
  if (parsed.topic !== topic) {
    return { ok: false, reason: 'topic_mismatch' };
  }
  return { ok: true, worker_id: workerId, model_id: modelId, pin };
}

function packetOpId(payload) {
  if (!payload || !Array.isArray(payload.payload)) return '';
  const record = payload.payload.find((item) => item && item.id === 0 && item.p === 0 && item.r === 0 && item.c === 0 && (item.k === 'op_id' || item.k === '__mt_request_id'));
  return record && typeof record.v === 'string' ? record.v : '';
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  const assetRoot = resolvePersistedAssetRoot();
  // 1. Determine patch directory
  const patchDir = process.argv[2] || process.env.DY_ROLE_PATCH_DIR || '';
  if (!assetRoot && !patchDir) {
    logErr('Usage: run_worker_v0.mjs <patch_dir>  or set DY_ROLE_PATCH_DIR');
    process.exitCode = 1;
    return;
  }
  const resolvedDir = patchDir ? path.resolve(patchDir) : '';
  if (!assetRoot && !fs.existsSync(resolvedDir)) {
    logErr(`Patch directory not found: ${resolvedDir}`);
    process.exitCode = 1;
    return;
  }

  // 2. Create runtime + load system patch
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt, { assetRoot, scope: 'mbr-worker' });
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });

  // 3. Load role patches
  if (assetRoot) {
    const result = applyPersistedAssetEntries(rt, {
      assetRoot,
      scope: 'mbr-worker',
      authority: 'authoritative',
      kind: 'patch',
      phases: ['20-role-negative', '40-role-positive'],
      applyOptions: { allowCreateModel: true, trustedBootstrap: true },
    });
    log(`loaded persisted assets for mbr-worker (entries=${result.entriesApplied} patches=${result.patchObjectsApplied})`);
  } else {
    const patchFiles = fs.readdirSync(resolvedDir)
      .filter(f => f.endsWith('.json'))
      .sort();
    for (const f of patchFiles) {
      const fullPath = path.join(resolvedDir, f);
      const patch = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const result = rt.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
      log(`loaded patch: ${f} (applied=${result.applied} rejected=${result.rejected})`);
    }
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
  const matrixEventFilter = String(getLabel(rt, -10, 0, 0, 0, 'mbr_matrix_event_filter') || 'pin_payload');
  const matrixInboxLabel = String(getLabel(rt, -10, 0, 0, 0, 'mbr_matrix_inbox_label') || 'mbr_mgmt_inbox');
  const matrixFunc = String(getLabel(rt, -10, 0, 0, 0, 'mbr_matrix_func') || '').trim();
  const mqttInboxLabel = String(getLabel(rt, -10, 0, 0, 0, 'mbr_mqtt_inbox_label') || 'mbr_mqtt_inbox');
  const mqttFunc = String(getLabel(rt, -10, 0, 0, 0, 'mbr_mqtt_func') || '').trim();
  const readyFunc = String(getLabel(rt, -10, 0, 0, 0, 'mbr_ready_func') || '').trim();
  const heartbeatFunc = String(getLabel(rt, -10, 0, 0, 0, 'mbr_heartbeat_func') || '').trim();

  const heartbeatRaw = getLabel(rt, -10, 0, 0, 0, 'mbr_heartbeat_interval_ms');
  const heartbeatMs = Number.isInteger(heartbeatRaw) ? heartbeatRaw : 30000;

  if (!mqttInboxLabel || !mqttFunc || !readyFunc || !heartbeatFunc) {
    logErr('missing MBR function/inbox config labels');
    process.exitCode = 1;
    return;
  }
  if (matrixRoomId && (!matrixInboxLabel || !matrixFunc)) {
    logErr('missing mbr_matrix_inbox_label / mbr_matrix_func config labels');
    process.exitCode = 1;
    return;
  }

  // 6. MQTT topic base (from system patch, Model 0)
  const base = String(getLabel(rt, 0, 0, 0, 0, 'mqtt_topic_base') || '');
  if (!isValidUnifiedTopicBase(base)) {
    logErr('missing mqtt_topic_base in Model 0');
    process.exitCode = 1;
    return;
  }

  const subscribeTopics = [`${base}/+/+/+`];

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
    engine.executeFunction(readyFunc);
    engine.tick();
    setInterval(() => {
      engine.executeFunction(heartbeatFunc);
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
          const validation = validateUnifiedMatrixEventPacket(event);
          if (!validation.ok) {
            log(`drop invalid mgmt event reason=${validation.reason || 'invalid'}`);
            return;
          }
          if (!filterTypes.includes(event.type)) return;
          if (!rt.isRuntimeRunning()) {
            log(`drop pre-running mgmt ${event.type} op_id=${event.op_id || ''}`);
            return;
          }
          log(`recv mgmt ${event.type} op_id=${event.op_id}`);
          rt.addLabel(sys, 0, 0, 0, { k: matrixInboxLabel, t: 'json', v: event });
          engine.executeFunction(matrixFunc);
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
    if (!subscribeTopics.some((subscription) => topicMatchesSubscription(subscription, topic))) return;
    let payload = null;
    try {
      payload = JSON.parse(buf.toString('utf8'));
    } catch (_) {
      return;
    }
    const validation = validateUnifiedEndpointTopicPacket(topic, payload, base);
    if (!validation.ok) {
      log(`drop invalid mqtt topic=${topic} reason=${validation.reason}`);
      return;
    }
    const opId = packetOpId(payload);
    if (!rt.isRuntimeRunning()) {
      log(`drop pre-running mqtt topic=${topic} op_id=${opId}`);
      return;
    }
    log(`recv mqtt topic=${topic} op_id=${opId}`);
    rt.addLabel(sys, 0, 0, 0, { k: mqttInboxLabel, t: 'json', v: { topic, payload } });
    engine.executeFunction(mqttFunc);
    engine.tick();
  });

  // 11. Graceful shutdown
  process.on('SIGINT', () => {
    try { if (mgmtAdapter && mgmtAdapter.close) mgmtAdapter.close(); } catch (_) { /* */ }
    try { mqttClient.end(true); } catch (_) { /* */ }
    process.exit(0);
  });
}

const entrypointUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entrypointUrl) {
  try {
    main();
  } catch (err) {
    logErr('FAILED');
    logErr(String(err && err.stack ? err.stack : err));
    process.exitCode = 1;
  }
}
