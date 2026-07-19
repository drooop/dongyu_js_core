/**
 * Generic Worker Bootstrap v0
 *
 * Loads system patch + role patches from a directory, applies optional
 * bootstrap patch from MODELTABLE_PATCH_JSON, reads connection
 * parameters from Model 0, initializes adapters (Matrix / MQTT),
 * routes inbound events into Model 0 bus pins and runs the engine tick loop.
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
import {
  ACTOR_ATTESTATION_MARKER,
  buildDeActorAttestation,
  createDeActorAttestationHeartbeat,
} from './lib/de_actor_attestation.mjs';
import { createDeNetworkBoundaryObservability } from './lib/de_network_boundary_evidence.mjs';
import { readMatrixBootstrapConfig, readMqttBootstrapConfig } from '../packages/worker-base/src/bootstrap_config.mjs';
import { createDePinFlowEvidenceEmitter } from '../packages/worker-base/src/de_pin_flow_evidence.mjs';
import { createMbrPinFlowEvidenceWiring } from '../packages/worker-base/src/de_pin_flow_wiring.mjs';
import { publishMqttWithAck } from '../packages/worker-base/src/mqtt_publish_ack.mjs';
import {
  applyPersistedAssetEntries,
  readPersistedAssetManifest,
  resolvePersistedAssetRoot,
  selectPersistedAssetEntries,
} from '../packages/worker-base/src/persisted_asset_loader.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');
const { createMatrixLiveAdapter } = require('../packages/worker-base/src/matrix_live.js');
const mqtt = require('mqtt');

export function createMbrWorkerNetworkBoundaryObservability({
  mqttUrl,
  matrixHomeserverUrl,
  writeLine,
  now,
  setIntervalFn,
  clearIntervalFn,
  heartbeatIntervalMs,
}) {
  return createDeNetworkBoundaryObservability({
    service: 'mbr-worker',
    effectiveDestinations: [mqttUrl, matrixHomeserverUrl],
    writeLine,
    now,
    setIntervalFn,
    clearIntervalFn,
    heartbeatIntervalMs,
  });
}

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

function isValidTableQualifiedModelId(tableId, modelId) {
  return Number.isInteger(modelId) && (tableId === 'host' ? modelId > 0 : modelId >= 0);
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
  const replyTargetIsHost = !replyTarget || !replyTarget.table_id || replyTarget.table_id === 'host';
  if (replyTargetIsHost) {
    const expectedResponseTopic = endpointTopicFromBase(topicParts.base, replyTarget);
    if (!expectedResponseTopic || responseTopic !== expectedResponseTopic) return 'response_topic_mismatch';
  }
  if (messageRole === 'request') {
    if (topic === responseTopic) return 'response_topic_mismatch';
    if (!endpointMatches(topicParts.endpoint, endpoint)) return 'endpoint_mismatch';
    return null;
  }
  if (messageRole === 'response') {
    if (topic !== responseTopic) return 'response_topic_mismatch';
    if (!endpointMatches(topicParts.endpoint, endpoint)) return 'endpoint_mismatch';
    if (replyTargetIsHost && !endpointMatches(endpoint, replyTarget)) return 'endpoint_mismatch';
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

function recordsContainLegacyPinPayloadMetadata(records) {
  if (!isTemporaryPayloadRecordArray(records)) return true;
  for (const record of records) {
    if (isLegacyPinPayloadKey(record.k)) return true;
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
    if (record.id !== 0) continue;
    if (seen.has(record.k)) return true;
    seen.add(record.k);
  }
  return false;
}

function hasInvalidModelZeroRootRecords(payload) {
  if (!payload || !Array.isArray(payload.payload)) return true;
  const rootKeys = new Set();
  for (const record of payload.payload) {
    if (!record || record.id !== 0) continue;
    if (record.p !== 0 || record.r !== 0 || record.c !== 0) return true;
    if (rootKeys.has(record.k)) return true;
    rootKeys.add(record.k);
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
  if (kind === 'pin_payload.v1') {
    return { ok: false, reason: 'legacy_pin_payload_kind_removed' };
  }
  if (kind !== 'pin_payload.v2') {
    return { ok: false, reason: 'invalid_payload_kind' };
  }
  const stringMetadataKeys = [
    '__mt_request_id',
    'op_id',
    'message_role',
    'topic',
    'response_topic',
    'endpoint_worker_id',
    'endpoint_table_id',
    'endpoint_pin',
    'origin_worker_id',
    'origin_table_id',
    'origin_pin',
    'reply_target_worker_id',
    'reply_target_table_id',
    'reply_target_pin',
    'reply_target_principal_key',
    'bus',
    'route_kind',
  ];
  const metadataKeys = stringMetadataKeys.concat([
    '__mt_payload_kind',
    'endpoint_model_id',
    'origin_model_id',
    'reply_target_model_id',
    'payload_model_id',
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
  const bus = pinPayloadString(payload, 'bus');
  const routeKind = pinPayloadString(payload, 'route_kind');
  if ((bus !== 'control' && bus !== 'management')
    || (routeKind !== 'control' && routeKind !== 'management')) {
    return { ok: false, reason: 'invalid_route_kind' };
  }
  if (bus !== routeKind) {
    return { ok: false, reason: 'bus_route_kind_mismatch' };
  }
  const timestamp = pinPayloadRecord(payload, 'timestamp');
  if (!timestamp) {
    return { ok: false, reason: 'missing_timestamp' };
  }
  if (timestamp.t !== 'int' || !Number.isInteger(timestamp.v)) {
    return { ok: false, reason: 'invalid_timestamp' };
  }
  if (hasInvalidModelZeroRootRecords(payload)) {
    return { ok: false, reason: 'invalid_pin_payload_records' };
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
    if (containsLegacyPinPayloadMetadata(record.v)) {
      return { ok: false, reason: 'legacy_pin_payload_metadata_removed' };
    }
  }
  const endpointWorkerId = pinPayloadString(payload, 'endpoint_worker_id');
  const endpointTableId = pinPayloadString(payload, 'endpoint_table_id');
  const endpointModelId = pinPayloadInt(payload, 'endpoint_model_id');
  const endpointPin = pinPayloadString(payload, 'endpoint_pin');
  const originWorkerId = pinPayloadString(payload, 'origin_worker_id');
  const originTableId = pinPayloadString(payload, 'origin_table_id');
  const originModelId = pinPayloadInt(payload, 'origin_model_id');
  const originPin = pinPayloadString(payload, 'origin_pin');
  const replyTargetWorkerId = pinPayloadString(payload, 'reply_target_worker_id');
  const replyTargetTableId = pinPayloadString(payload, 'reply_target_table_id');
  const replyTargetModelId = pinPayloadInt(payload, 'reply_target_model_id');
  const replyTargetPin = pinPayloadString(payload, 'reply_target_pin');
  const payloadModelId = pinPayloadInt(payload, 'payload_model_id');
  const nestedPayload = pinPayloadRecord(payload, 'payload');
  if (nestedPayload) {
    return { ok: false, reason: 'nested_payload_removed' };
  }
  if (
    !isSafeTopicSegment(endpointWorkerId)
    || !isSafeTopicSegment(endpointTableId)
    || endpointTableId !== 'host'
    || !Number.isInteger(endpointModelId)
    || endpointModelId <= 0
    || !isSafeTopicSegment(endpointPin)
    || !isSafeTopicSegment(originWorkerId)
    || !isSafeTopicSegment(originTableId)
    || !isValidTableQualifiedModelId(originTableId, originModelId)
    || !isSafeTopicSegment(originPin)
    || !isSafeTopicSegment(replyTargetWorkerId)
    || !isSafeTopicSegment(replyTargetTableId)
    || !isValidTableQualifiedModelId(replyTargetTableId, replyTargetModelId)
    || !isSafeTopicSegment(replyTargetPin)
    || !Number.isInteger(payloadModelId)
    || payloadModelId <= 0
    || !payload.payload.some((record) => record && record.id === payloadModelId)
  ) {
    return { ok: false, reason: 'invalid_pin_payload_records' };
  }
  const endpoint = { worker_id: endpointWorkerId, table_id: endpointTableId, model_id: endpointModelId, pin: endpointPin };
  const origin = { worker_id: originWorkerId, table_id: originTableId, model_id: originModelId, pin: originPin };
  const replyTarget = { worker_id: replyTargetWorkerId, table_id: replyTargetTableId, model_id: replyTargetModelId, pin: replyTargetPin };
  const topicContractError = validatePinPayloadTopicContract({
    messageRole,
    topic: topicValue,
    responseTopic: responseTopicValue,
    endpoint,
    replyTarget,
  });
  if (topicContractError) {
    return { ok: false, reason: topicContractError };
  }
  return {
    ok: true,
    message_role: messageRole,
    bus,
    route_kind: routeKind,
    topic: topicValue,
    response_topic: responseTopicValue,
    endpoint,
    origin,
    reply_target: replyTarget,
  };
}

export function validateUnifiedMatrixEventPacket(event) {
  const validation = validatePinPayloadRecordEnvelope(event);
  if (!validation.ok) return validation;
  if (validation.bus !== 'management' || validation.route_kind !== 'management') {
    return { ok: false, reason: 'matrix_ingress_requires_management_route' };
  }
  return validation;
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
  return {
    ok: true,
    worker_id: workerId,
    model_id: modelId,
    pin,
    message_role: parsed.message_role,
    bus: parsed.bus,
    route_kind: parsed.route_kind,
  };
}

export function shouldBridgeMbrMqttPacket(validation) {
  return Boolean(validation
    && validation.ok === true
    && validation.message_role === 'response'
    && validation.bus === 'management'
    && validation.route_kind === 'management');
}

function packetOpId(payload) {
  if (!payload || !Array.isArray(payload.payload)) return '';
  const record = payload.payload.find((item) => item && item.id === 0 && item.p === 0 && item.r === 0 && item.c === 0 && (item.k === 'op_id' || item.k === '__mt_request_id'));
  return record && typeof record.v === 'string' ? record.v : '';
}

export function writeMbrIngressError(rt, model0, channel, reason) {
  if (!rt || !model0) return { applied: false };
  const normalizedChannel = channel === 'matrix' ? 'matrix' : 'mqtt';
  const normalizedReason = typeof reason === 'string' && reason ? reason : 'unknown';
  return rt.addLabel(model0, 0, 0, 0, {
    k: `mbr_${normalizedChannel}_inbound_error`,
    t: 'json',
    v: {
      code: `invalid_mbr_${normalizedChannel}_ingress`,
      reason: normalizedReason,
    },
  });
}

function bootstrapActorOverrideKey(_rt, patch) {
  const allowedTransportLabels = new Map([
    ['matrix_room_id', 'str'],
    ['matrix_server', 'matrix.server'],
    ['matrix_user', 'matrix.user'],
    ['matrix_passwd', 'matrix.passwd'],
    ['matrix_token', 'matrix.token'],
    ['matrix_contuser', 'matrix.contuser'],
    ['local_ip', 'mqtt.local.ip'],
    ['local_port', 'mqtt.local.port'],
    ['global_ip', 'mqtt.global.ip'],
    ['global_port', 'mqtt.global.port'],
  ]);
  const records = patch && Array.isArray(patch.records) ? patch.records : [];
  for (const record of records) {
    if (!record || typeof record !== 'object') return 'invalid_record';
    const recordKey = typeof record.k === 'string' && record.k
      ? record.k
      : `model:${String(record.model_id)}`;
    if (record.op !== 'add_label') return recordKey;
    if (record.model_id !== 0 || record.p !== 0 || record.r !== 0 || record.c !== 0) {
      return recordKey;
    }
    if (allowedTransportLabels.get(record.k) !== record.t) return recordKey;
  }
  return '';
}

// ── Main ────────────────────────────────────────────────────────────────────

export function main(options = {}) {
  const assetRoot = resolvePersistedAssetRoot();
  const repoRoot = path.resolve(import.meta.dirname, '..');
  // 1. Determine patch directory
  const patchDir = options.patchDir || process.argv[2] || process.env.DY_ROLE_PATCH_DIR || '';
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
  const sourceFiles = assetRoot
    ? selectPersistedAssetEntries(readPersistedAssetManifest(assetRoot), {
      scope: 'mbr-worker',
      authority: 'authoritative',
      kind: 'patch',
      phases: ['00-system-base', '20-role-negative', '40-role-positive'],
    })
      .filter((entry) => fs.existsSync(path.join(assetRoot, String(entry.path || ''))))
      .map((entry) => String(entry.path))
    : ['packages/worker-base/system-models/system_models.json'];
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
      sourceFiles.push(path.relative(repoRoot, fullPath).split(path.sep).join('/'));
      log(`loaded patch: ${f} (applied=${result.applied} rejected=${result.rejected})`);
    }
  }

  const bootstrapPatch = readBootstrapPatchFromEnv();
  if (bootstrapPatch) {
    const overriddenKey = bootstrapActorOverrideKey(rt, bootstrapPatch);
    if (overriddenKey) {
      throw new Error(`bootstrap_patch_overrides_attested_actor:${overriddenKey}`);
    }
    const result = rt.applyPatch(bootstrapPatch, { allowCreateModel: true, trustedBootstrap: true });
    sourceFiles.push('env:MODELTABLE_PATCH_JSON');
    log(`loaded bootstrap patch from MODELTABLE_PATCH_JSON (applied=${result.applied} rejected=${result.rejected})`);
  }

  if (!rt.getModel(-10)) {
    logErr('System model (-10) not found after loading patches');
    process.exitCode = 1;
    return;
  }
  rt.setRuntimeMode('edit');
  log(`runtime_mode=${rt.getRuntimeMode()}`);

  const actorAttestation = buildDeActorAttestation({ runtime: rt, sourceFiles });
  process.stdout.write(`${ACTOR_ATTESTATION_MARKER} ${JSON.stringify(actorAttestation)}\n`);
  if (process.env.DY_ACTOR_ATTEST_ONLY === '1') return;

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
  const readyFunc = String(getLabel(rt, -10, 0, 0, 0, 'mbr_ready_func') || '').trim();
  const heartbeatFunc = String(getLabel(rt, -10, 0, 0, 0, 'mbr_heartbeat_func') || '').trim();

  const heartbeatRaw = getLabel(rt, -10, 0, 0, 0, 'mbr_heartbeat_interval_ms');
  const heartbeatMs = Number.isInteger(heartbeatRaw) ? heartbeatRaw : 30000;

  if (!readyFunc || !heartbeatFunc) {
    logErr('missing MBR readiness function config labels');
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
  const installNetworkBoundaryObservability = options.installNetworkBoundaryObservability
    || createMbrWorkerNetworkBoundaryObservability;
  const writeEvidenceLine = options.writeLine || ((line) => process.stdout.write(`${line}\n`));
  const networkBoundaryObservability = installNetworkBoundaryObservability({
    service: 'mbr-worker',
    mqttUrl,
    matrixHomeserverUrl: matrixConfig.homeserverUrl,
    writeLine: options.writeLine || ((line) => process.stdout.write(`${line}\n`)),
    now: options.now || Date.now,
    setIntervalFn: options.setIntervalFn || setInterval,
    clearIntervalFn: options.clearIntervalFn || clearInterval,
    heartbeatIntervalMs: 10000,
  });
  const emitPinFlowEvidenceLine = createDePinFlowEvidenceEmitter({
    producer: 'mbr',
    writeLine: writeEvidenceLine,
    now: options.now || Date.now,
  });
  const mbrPinFlowWiring = createMbrPinFlowEvidenceWiring({
    emitEvidence: emitPinFlowEvidenceLine,
    onEvidenceError: ({ code, stage }) => {
      logErr(`${code} stage=${stage}`);
    },
  });
  let mqttClient;
  try {
    networkBoundaryObservability.recordOutbound(mqttUrl);
    mqttClient = mqtt.connect(mqttUrl, {
      username: mqttUser,
      password: mqttPass,
      clientId: `dy-worker-${Date.now()}`,
      reconnectPeriod: 500,
    });
  } catch (error) {
    networkBoundaryObservability.stop();
    throw error;
  }
  const actorAttestationHeartbeat = createDeActorAttestationHeartbeat({
    attestation: actorAttestation,
    writeLine: writeEvidenceLine,
    heartbeatIntervalMs: 10000,
  });

  const mqttPublish = (topic, payload) => {
    const opId = payload && typeof payload === 'object' ? (payload.op_id || '') : '';
    log(`mqtt publish topic=${topic} op_id=${opId}`);
    networkBoundaryObservability.recordOutbound(mqttUrl);
    const publishResult = publishMqttWithAck(mqttClient, topic, payload);
    return mbrPinFlowWiring.recordControlForward(payload, publishResult);
  };

  // 8. Create engine
  const engine = new WorkerEngineV0({ runtime: rt, mgmtAdapter: null, mqttPublish });
  const model0 = rt.getModel(0);
  if (!model0) {
    actorAttestationHeartbeat.stop();
    networkBoundaryObservability.stop();
    try { mqttClient.end(true); } catch (_) { /* */ }
    logErr('Model 0 not found after loading patches');
    process.exitCode = 1;
    return;
  }

  let mqttReady = false;
  let runtimeActivated = false;
  const maybeActivateRunning = () => {
    if (runtimeActivated || !mqttReady) return;
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

    networkBoundaryObservability.recordOutbound(matrixConfig.homeserverUrl);
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
        engine.mgmtAdapter = {
          publish: (packet) => mbrPinFlowWiring.publishManagementResponse(
            adapter.publish.bind(adapter),
            packet,
          ),
        };

        adapter.subscribe((event) => {
          const validation = validateUnifiedMatrixEventPacket(event);
          if (!validation.ok) {
            writeMbrIngressError(rt, model0, 'matrix', validation.reason || 'invalid');
            log(`drop invalid mgmt event reason=${validation.reason || 'invalid'}`);
            return;
          }
          if (!filterTypes.includes(event.type)) return;
          if (!rt.isRuntimeRunning()) {
            writeMbrIngressError(rt, model0, 'matrix', 'runtime_not_running');
            log(`drop pre-running mgmt ${event.type} op_id=${event.op_id || ''}`);
            return;
          }
          log(`recv mgmt ${event.type} op_id=${event.op_id}`);
          const ingressResult = mbrPinFlowWiring.recordManagementIngress(
            event,
            () => rt.addLabel(model0, 0, 0, 0, { k: 'mbr_mb_in', t: 'pin.bus.mb.in', v: event.payload }),
          );
          if (!ingressResult || !ingressResult.applied) {
            writeMbrIngressError(rt, model0, 'matrix', 'bus_write_rejected');
            return;
          }
          setTimeout(() => engine.tick(), 0);
        });

        log(`mgmt READY room_id=${adapter.room_id}`);
      })
      .catch((err) => {
        networkBoundaryObservability.stop();
        actorAttestationHeartbeat.stop();
        try { mqttClient.end(true); } catch (_) { /* */ }
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
    try {
      const packet = JSON.parse(buf.toString('utf8'));
      const validation = validateUnifiedEndpointTopicPacket(topic, packet, base);
      if (!validation.ok) {
        writeMbrIngressError(rt, model0, 'mqtt', validation.reason || 'invalid');
        log(`drop invalid mqtt topic=${topic} reason=${validation.reason}`);
        return;
      }
      const opId = packetOpId(packet);
      if (!rt.isRuntimeRunning()) {
        writeMbrIngressError(rt, model0, 'mqtt', 'runtime_not_running');
        log(`drop pre-running mqtt topic=${topic} op_id=${opId}`);
        return;
      }
      if (!shouldBridgeMbrMqttPacket(validation)) {
        log(`ignore non-bridge mqtt topic=${topic} role=${validation.message_role} route_kind=${validation.route_kind}`);
        return;
      }
      log(`recv mqtt topic=${topic} op_id=${opId}`);
      const ingressResult = mbrPinFlowWiring.recordControlResponseIngress(
        packet,
        () => rt.addLabel(model0, 0, 0, 0, { k: 'mbr_cb_in', t: 'pin.bus.cb.in', v: packet.payload }),
      );
      if (!ingressResult || !ingressResult.applied) {
        writeMbrIngressError(rt, model0, 'mqtt', 'bus_write_rejected');
        return;
      }
      setTimeout(() => engine.tick(), 0);
    } catch (error) {
      if (error instanceof SyntaxError) {
        writeMbrIngressError(rt, model0, 'mqtt', 'invalid_json');
        return;
      }
      writeMbrIngressError(rt, model0, 'mqtt', 'unexpected_error');
      throw error;
    }
  });

  // 11. Graceful shutdown
  let shutdownStarted = false;
  process.on('SIGINT', async () => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    try { if (mgmtAdapter && mgmtAdapter.close) await mgmtAdapter.close(); } catch (_) { /* */ }
    try { mqttClient.end(true); } catch (_) { /* */ }
    networkBoundaryObservability.stop();
    actorAttestationHeartbeat.stop();
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
