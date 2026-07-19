#!/usr/bin/env node

import { execFile as execFileCallback, spawn as spawnChild } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isDeepStrictEqual, promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import AdmZipPkg from 'adm-zip';
import dotenv from 'dotenv';
import mqtt from 'mqtt';
import { ACTOR_ATTESTATION_MARKER } from './lib/de_actor_attestation.mjs';
import {
  buildLegacyPublicBoundaryProbe,
  evaluateLegacyPublicBoundaryEvidence,
  parseR1DiagnosticLog,
  parseR1TraceDeltaLog,
} from './lib/legacy_public_boundary_probe.mjs';
import {
  buildDeNetworkBoundaryEvidence,
  evaluateDeNetworkBoundaryEvidence,
  parseDeNetworkBoundaryEvidenceLines,
} from './lib/de_network_boundary_evidence.mjs';
import {
  evaluateDePinFlowEvidence,
  evaluateDePinFlowEvidenceSequence,
  parseDePinFlowEvidenceLines,
} from '../packages/worker-base/src/de_pin_flow_evidence.mjs';

export const LEGACY_PUBLIC_BOUNDARY_RESPONSE_QUIET_PERIOD_MS = 1000;
export const LEGACY_PUBLIC_BOUNDARY_PORT_FORWARD_READY_TIMEOUT_MS = 5000;
export const LEGACY_PUBLIC_BOUNDARY_PORT_FORWARD_CLOSE_TIMEOUT_MS = 1000;
export const LEGACY_PUBLIC_BOUNDARY_EVIDENCE_POLL_TIMEOUT_MS = 40000;
export const LEGACY_PUBLIC_BOUNDARY_EVIDENCE_POLL_INTERVAL_MS = 250;
export const LEGACY_PUBLIC_BOUNDARY_LOG_READ_TIMEOUT_MS = 7500;
export const LEGACY_PUBLIC_BOUNDARY_OPERATION_TIMEOUT_MS = 5000;
export const LEGACY_PUBLIC_BOUNDARY_EVIDENCE_OPERATION_TIMEOUT_MS = 45000;
export const LEGACY_PUBLIC_BOUNDARY_NETWORK_AUDIT_TIMEOUT_MS = 90000;
export const LEGACY_PUBLIC_BOUNDARY_MQTT_ADAPTER_TIMEOUT_MS = 4000;
export const LEGACY_PUBLIC_BOUNDARY_MQTT_CLEANUP_TIMEOUT_MS = 500;
export const LEGACY_PUBLIC_BOUNDARY_LOCAL_CHECK_TIMEOUT_MS = 60000;

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;
const PUBLIC_TOPIC = 'UIPUT/ws/dam/pic/de/R1/3200/resource';
export const REVISION4_LIVE_FIXTURE_APP_NAME = '0457 Revision 4 Local V2 Acceptance';
export const REVISION4_LIVE_FIXTURE_RELATIVE_PATH = 'scripts/fixtures/0457/feishu_message_api_v2_orbstack_app_payload.json';
export const REVISION4_LIVE_FIXTURE_MARKER = 'it0457-revision4-local-v2-acceptance.v1';
export const REVISION4_LIVE_HTTP_TIMEOUT_MS = 20000;
export const REVISION4_LIVE_POLL_TIMEOUT_MS = 30000;
export const REVISION4_LIVE_POLL_INTERVAL_MS = 250;
const REVISION4_LIVE_BASE_URL = 'http://127.0.0.1:30900';
const REVISION4_LOCAL_PERSIST_ROOT = '/Users/drop/dongyu/volume/persist/ui-server';
const REVISION4_LIVE_FIXTURE_SOURCE_WORKER = 'it0457-revision4-local-acceptance';
const REVISION4_UI_SERVER_DEPLOYMENT = 'deployment/ui-server';
const REVISION4_ENVELOPE_EXTENSION_KEYS = Object.freeze([
  'is_need_response',
  'message_server',
  'between',
  'send_user',
  'receive_user',
  'custom_trace',
]);
const REVISION4_ACTOR_CONTRACTS = Object.freeze([
  {
    name: 'mbr',
    deployment: 'deployment/mbr-worker',
    worker_id: '5/10/28/35/14',
    worker_role: 'DEM',
    worker_alias: null,
    bus_pins: [
      { key: 'mbr_cb_in', type: 'pin.bus.cb.in' },
      { key: 'mbr_cb_out', type: 'pin.bus.cb.out' },
      { key: 'mbr_mb_in', type: 'pin.bus.mb.in' },
      { key: 'mbr_mb_out', type: 'pin.bus.mb.out' },
    ],
    mounted_models: [-10],
    source_files: [
      'system/base/system_models.json',
      'roles/mbr/patches/mbr_role_v0.json',
      'env:MODELTABLE_PATCH_JSON',
    ],
  },
  {
    name: 'r1',
    deployment: 'deployment/remote-worker',
    worker_id: '5/10/28/35/15',
    worker_role: 'V1N',
    worker_alias: 'R1',
    bus_pins: [
      { key: 'r1_cb_in', type: 'pin.bus.cb.in' },
      { key: 'remote_result_bus', type: 'pin.bus.cb.out' },
    ],
    mounted_models: [-10, 100, 1010, 1019, 3000, 3100, 3200],
    source_files: [
      'system/base/system_models.json',
      'roles/remote-worker/patches/00_remote_worker_config.json',
      'roles/remote-worker/patches/10_model100.json',
      'roles/remote-worker/patches/11_model1010.json',
      'roles/remote-worker/patches/12_model1019.json',
      'roles/remote-worker/patches/13_model3000_minimal_submit.json',
      'roles/remote-worker/patches/14_model3100_slide_app_bundle_provider.json',
      'roles/remote-worker/patches/15_model3200_feishu_message_api.json',
    ],
  },
  {
    name: 'wm1',
    deployment: 'deployment/workspace-manager',
    worker_id: '5/10/28/36/16',
    worker_role: 'DEM',
    worker_alias: 'WM1',
    bus_pins: [
      { key: 'wm_cb_in', type: 'pin.bus.cb.in' },
      { key: 'wm_cb_out', type: 'pin.bus.cb.out' },
      { key: 'wm_mb_in', type: 'pin.bus.mb.in' },
      { key: 'wm_mb_out', type: 'pin.bus.mb.out' },
    ],
    mounted_models: [4000],
    source_files: [
      'system/base/system_models.json',
      'roles/workspace-manager/patches/00_workspace_manager_dem_config.json',
    ],
  },
]);
const ACCEPTANCE_WINDOW_DEPLOYMENTS = [
  'deployment/mbr-worker',
  'deployment/remote-worker',
  'deployment/workspace-manager',
  'deployment/synapse',
  'deployment/mosquitto',
];
const SYNAPSE_HEALTH_SCRIPT = "fetch('http://synapse.dongyu.svc.cluster.local:8008/_matrix/client/versions').then(async response => { if (!response.ok) throw new Error('status_' + response.status); const body = await response.json(); if (!Array.isArray(body.versions)) throw new Error('versions_missing'); process.stdout.write('synapse_service_ready\\n'); }).catch(error => { process.stderr.write(String(error && error.message ? error.message : error) + '\\n'); process.exit(1); })";

const defaultExecFile = promisify(execFileCallback);
const defaultDelay = (timeoutMs) => new Promise((resolvePromise) => setTimeout(resolvePromise, timeoutMs));
const LOCAL_ACCEPTANCE_ENV_KEYS = Object.freeze([
  'MATRIX_HOMESERVER_URL',
  'DY_MQTT_HOST',
  'DY_MQTT_PORT',
  'MQTT_HOST',
  'MQTT_PORT',
  'DY_OIDC_ISSUER',
  'DY_OIDC_PROXY_URL',
  'FEISHU_API_BASE',
]);
const LOCAL_ACCEPTANCE_ENV_KEY_SET = new Set(LOCAL_ACCEPTANCE_ENV_KEYS);

function parseAllowlistedLocalEnvironment(source) {
  const allowedLines = String(source || '').split(/\r?\n/u).filter((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/u);
    return Boolean(match && LOCAL_ACCEPTANCE_ENV_KEY_SET.has(match[1]));
  });
  return dotenv.parse(allowedLines.join('\n'));
}

export function loadLocalAcceptanceEnvironment({
  processEnv = process.env,
  localEnvPath = resolve(repoRoot, 'deploy/env/local.env'),
  exists = existsSync,
  readFile = readFileSync,
} = {}) {
  let localValues = {};
  if (exists(localEnvPath)) {
    localValues = parseAllowlistedLocalEnvironment(readFile(localEnvPath));
  }
  const environment = {};
  for (const key of LOCAL_ACCEPTANCE_ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(localValues, key)) environment[key] = localValues[key];
    if (Object.prototype.hasOwnProperty.call(processEnv, key)) environment[key] = processEnv[key];
  }
  return environment;
}

function errorMessage(error) {
  return String(error && error.message ? error.message : error);
}

function hasExactLocalSynapseListener(configText) {
  return /^[ \t]*-[ \t]+port:[ \t]*8008[ \t]*(?:#.*)?\r?\n[ \t]+bind_addresses:[ \t]*\[[ \t]*(?:0\.0\.0\.0|"0\.0\.0\.0"|'0\.0\.0\.0')[ \t]*\][ \t]*(?:#.*)?$/mu
    .test(String(configText || ''));
}

function hasExactLocalMosquittoListener(configText) {
  return /^[ \t]*listener[ \t]+1883[ \t]+0\.0\.0\.0[ \t]*(?:#.*)?$/mu
    .test(String(configText || ''));
}

function codedError(code, error = null) {
  return new Error(error ? `${code}:${errorMessage(error)}` : code);
}

function mtRecord(k, t, v, id = 0, p = 0, r = 0, c = 0) {
  return { id, p, r, c, k, t, v };
}

function exactRootRecord(records, key) {
  return Array.isArray(records)
    ? records.find((record) => record?.id === 0 && record?.p === 0 && record?.r === 0 && record?.c === 0 && record?.k === key) || null
    : null;
}

function snapshotRegistry(snapshot) {
  const registry = snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v;
  return Array.isArray(registry) ? registry : [];
}

function snapshotModel(snapshot, ref) {
  if (!ref || !Number.isInteger(ref.model_id)) return null;
  if (!ref.table_id || ref.table_id === 'host') return snapshot?.models?.[String(ref.model_id)] || null;
  return snapshot?.tables?.[ref.table_id]?.models?.[String(ref.model_id)] || null;
}

function snapshotRootLabels(snapshot, ref) {
  return snapshotModel(snapshot, ref)?.cells?.['0,0,0']?.labels || {};
}

function uniqueModelRefs(refs) {
  const unique = new Map();
  for (const ref of Array.isArray(refs) ? refs : []) {
    if (!ref || typeof ref.table_id !== 'string' || !ref.table_id || !Number.isInteger(ref.model_id)) continue;
    unique.set(`${ref.table_id}|${ref.model_id}`, { table_id: ref.table_id, model_id: ref.model_id });
  }
  return [...unique.values()];
}

function sameJson(left, right) {
  return isDeepStrictEqual(left, right);
}

function fixtureDigest(records) {
  const digestInput = records.filter((record) => !(
    record?.id === 0 && record?.p === 0 && record?.r === 0 && record?.c === 0
    && record?.k === 'revision4_fixture_digest'
  ));
  return createHash('sha256').update(JSON.stringify(digestInput)).digest('hex');
}

function expectedFixtureIdentity(records) {
  const marker = exactRootRecord(records, 'revision4_fixture_marker')?.v;
  const digest = exactRootRecord(records, 'revision4_fixture_digest')?.v;
  const sourceWorker = exactRootRecord(records, 'source_worker')?.v;
  return { marker, digest, sourceWorker };
}

function hasExactFixtureTopology(labels) {
  const bindingMatches = (pinName, routeKind, hostPinType) => {
    const value = labels[`ui_egress_${pinName}_binding`]?.v;
    return value?.from_pin === pinName
      && value?.bus === routeKind
      && value?.host_model_id === 0
      && sameJson(value?.host_cell, [0, 0, 0])
      && value?.host_pin_type === hostPinType
      && typeof value?.host_pin_key === 'string'
      && value.host_pin_key.length > 0
      && value?.target?.transport === 'mqtt'
      && value?.target?.route_kind === routeKind
      && value?.target?.worker_id === 'R1'
      && value?.target?.model_id === 3200
      && value?.target?.pin === pinName
      && value?.reply_pin === 'result'
      && value?.owned_by === 'ui-server-installer';
  };
  return sameJson(labels.remote_bus_endpoint_v1?.v, {
    transport: 'mqtt',
    route_kind: 'control',
    to: { worker_id: 'R1', model_id: 3200 },
  })
    && sameJson(labels.dual_bus_model?.v, {
      mode: 'imported_host_egress',
      egress_pins: ['resource', 'data'],
      egress_routes: [
        { pin_name: 'resource', route_kind: 'control' },
        { pin_name: 'data', route_kind: 'management' },
      ],
      envelope_extension_keys: REVISION4_ENVELOPE_EXTENSION_KEYS,
    })
    && labels.resource?.t === 'pin.out'
    && labels.data?.t === 'pin.out'
    && labels.result?.t === 'pin.in'
    && bindingMatches('resource', 'control', 'pin.bus.cb.out')
    && bindingMatches('data', 'management', 'pin.bus.mb.out');
}

function isExactFixtureModel(snapshot, ref, fixture) {
  const labels = snapshotRootLabels(snapshot, ref);
  const expected = expectedFixtureIdentity(fixture);
  return Boolean(snapshotModel(snapshot, ref))
    && labels.app_name?.v === REVISION4_LIVE_FIXTURE_APP_NAME
    && labels.source_worker?.v === expected.sourceWorker
    && labels.revision4_fixture_marker?.v === expected.marker
    && labels.revision4_fixture_digest?.v === expected.digest
    && hasExactFixtureTopology(labels);
}

function exactReplyTarget(ref) {
  return { table_id: ref.table_id, model_id: ref.model_id, pin: 'result' };
}

function isCorrelationId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value);
}

function requiredPositiveFlowStages(kind) {
  const directR1 = [
    { producer: 'r1', stage: 'control_ingress', message_role: 'request' },
    { producer: 'r1', stage: 'model_dispatch', message_role: 'request' },
    { producer: 'r1', stage: 'control_response', message_role: 'response' },
  ];
  if (kind === 'control') {
    return [
      { producer: 'ui-server', stage: 'control_outbound_attempt', message_role: 'request' },
      ...directR1,
      { producer: 'ui-server', stage: 'validated_response_materialized', message_role: 'response' },
    ];
  }
  return [
    { producer: 'ui-server', stage: 'management_outbound_attempt', message_role: 'request' },
    { producer: 'mbr', stage: 'management_ingress', message_role: 'request' },
    { producer: 'mbr', stage: 'control_forward', message_role: 'request' },
    ...directR1,
    { producer: 'mbr', stage: 'control_response_ingress', message_role: 'response' },
    { producer: 'mbr', stage: 'management_response_forward', message_role: 'response' },
    { producer: 'ui-server', stage: 'validated_response_materialized', message_role: 'response' },
  ];
}

export function evaluateRevision4PositiveCorrelationEvidence(evidence, {
  since,
  now = Number.POSITIVE_INFINITY,
  ref,
  scenario,
  seenOpIds = new Set(),
  seenRequestIds = new Set(),
} = {}) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
    || !Array.isArray(evidence.entries)) {
    throw codedError('revision4_positive_evidence_invalid_schema');
  }
  if (!ref || typeof ref.table_id !== 'string' || !Number.isInteger(ref.model_id)) {
    throw codedError('revision4_positive_evidence_ref_invalid');
  }
  if (!scenario || !['control', 'management'].includes(scenario.kind)) {
    throw codedError('revision4_positive_evidence_scenario_invalid');
  }
  if (!isCorrelationId(evidence.op_id)) throw codedError('revision4_positive_op_id_invalid');
  if (!isCorrelationId(evidence.request_id)) throw codedError('revision4_positive_request_id_invalid');
  if (seenOpIds.has(evidence.op_id)) throw codedError('revision4_positive_op_id_reused');
  if (seenRequestIds.has(evidence.request_id)) throw codedError('revision4_positive_request_id_reused');
  const replyTarget = exactReplyTarget(ref);
  const sequence = evaluateDePinFlowEvidenceSequence(evidence.entries, {
    since,
    now,
    requestId: evidence.request_id,
    opId: evidence.op_id,
    replyTarget,
    requiredStages: requiredPositiveFlowStages(scenario.kind),
  });
  if (!sequence.ok) throw codedError(`revision4_positive_${sequence.code}`);
  const orderedStages = requiredPositiveFlowStages(scenario.kind);
  const orderedPoints = orderedStages.map((required) => evidence.entries.filter((entry) => (
    entry?.op_id === evidence.op_id
    && entry?.request_id === evidence.request_id
    && entry?.producer === required.producer
    && entry?.stage === required.stage
  )));
  if (orderedPoints.some((matches) => matches.length !== 1)) {
    throw codedError('revision4_positive_stage_cardinality_invalid');
  }
  for (const [point] of orderedPoints) {
    if (point.bus !== scenario.kind || point.route_kind !== scenario.kind) {
      throw codedError('revision4_positive_evidence_route_mismatch');
    }
  }
  for (let index = 1; index < orderedPoints.length; index += 1) {
    if (orderedPoints[index][0].ts < orderedPoints[index - 1][0].ts) {
      throw codedError('revision4_positive_stage_order_invalid');
    }
  }
  const expectedEndpoint = { table_id: 'host', model_id: 3200, pin: scenario.pin };
  const expectedOutboundStage = scenario.kind === 'control'
    ? 'control_outbound_attempt'
    : 'management_outbound_attempt';
  const requiredExactPoints = [
    { producer: 'ui-server', stage: expectedOutboundStage },
    { producer: 'r1', stage: 'model_dispatch' },
  ];
  for (const required of requiredExactPoints) {
    const point = evidence.entries.find((entry) => entry?.op_id === evidence.op_id
      && entry?.request_id === evidence.request_id
      && entry?.producer === required.producer
      && entry?.stage === required.stage);
    const evaluated = evaluateDePinFlowEvidence(point, {
      since,
      now,
      opId: evidence.op_id,
      requestId: evidence.request_id,
      replyTarget,
      endpoint: expectedEndpoint,
      producer: required.producer,
      stage: required.stage,
    });
    if (!evaluated.ok) throw codedError(`revision4_positive_${evaluated.code}`);
  }
  seenOpIds.add(evidence.op_id);
  seenRequestIds.add(evidence.request_id);
  return {
    op_id: evidence.op_id,
    request_id: evidence.request_id,
    reply_target: replyTarget,
  };
}

function uiBoundaryEndpoint(entry) {
  return `${entry.protocol}//${entry.hostname}:${entry.port}`;
}

export function evaluateRevision4UiServerBoundaryEvidence(evidence, {
  since,
  now = Number.POSITIVE_INFINITY,
} = {}) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
    || evidence.deployment !== REVISION4_UI_SERVER_DEPLOYMENT
    || !Array.isArray(evidence.entries)) {
    throw codedError('revision4_ui_server_boundary_invalid_schema');
  }
  if (!Number.isFinite(since)
    || !(Number.isFinite(now) || now === Number.POSITIVE_INFINITY)) {
    throw codedError('revision4_ui_server_boundary_window_invalid');
  }
  for (const entry of evidence.entries) {
    if (entry?.service !== 'ui-server') throw codedError('revision4_ui_server_boundary_actor_mismatch');
    const evaluated = evaluateDeNetworkBoundaryEvidence(entry, { since });
    if (!evaluated.ok) throw codedError(`revision4_ui_server_boundary_${evaluated.code}`);
  }
  const fresh = evidence.entries;
  if (Number.isFinite(now) && fresh.some((entry) => entry.ts > now + 5000)) {
    throw codedError('revision4_ui_server_boundary_future_evidence');
  }
  const requiredEndpoints = [
    'http://synapse.dongyu.svc.cluster.local:8008',
    'mqtt://mosquitto.dongyu.svc.cluster.local:1883',
  ];
  for (const endpoint of requiredEndpoints) {
    if (!fresh.some((entry) => entry.kind === 'effective_config' && uiBoundaryEndpoint(entry) === endpoint)) {
      throw codedError('revision4_ui_server_boundary_missing_fresh_effective_config');
    }
    if (!fresh.some((entry) => entry.kind === 'outbound_attempt' && uiBoundaryEndpoint(entry) === endpoint)) {
      throw codedError('revision4_ui_server_boundary_missing_fresh_outbound');
    }
  }
  return { ok: true, deployment: REVISION4_UI_SERVER_DEPLOYMENT, evidence_count: fresh.length };
}

function validateFixtureRecords(records) {
  if (!Array.isArray(records) || records.length === 0) throw codedError('revision4_fixture_invalid');
  if (!records.every((record) => record && typeof record === 'object' && !Array.isArray(record)
    && Number.isInteger(record.id) && Number.isInteger(record.p) && Number.isInteger(record.r) && Number.isInteger(record.c)
    && typeof record.k === 'string' && record.k && typeof record.t === 'string' && record.t
    && Object.prototype.hasOwnProperty.call(record, 'v'))) {
    throw codedError('revision4_fixture_record_shape_invalid');
  }
  if (exactRootRecord(records, 'app_name')?.v !== REVISION4_LIVE_FIXTURE_APP_NAME) {
    throw codedError('revision4_fixture_app_name_mismatch');
  }
  if (exactRootRecord(records, 'source_worker')?.v !== REVISION4_LIVE_FIXTURE_SOURCE_WORKER) {
    throw codedError('revision4_fixture_source_worker_mismatch');
  }
  if (exactRootRecord(records, 'revision4_fixture_marker')?.v !== REVISION4_LIVE_FIXTURE_MARKER) {
    throw codedError('revision4_fixture_marker_mismatch');
  }
  const declaredDigest = exactRootRecord(records, 'revision4_fixture_digest')?.v;
  if (typeof declaredDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(declaredDigest)
    || declaredDigest !== fixtureDigest(records)) {
    throw codedError('revision4_fixture_digest_mismatch');
  }
  if (!sameJson(exactRootRecord(records, 'remote_bus_endpoint_v1')?.v, {
    transport: 'mqtt',
    route_kind: 'control',
    to: { worker_id: 'R1', model_id: 3200 },
  })) {
    throw codedError('revision4_fixture_endpoint_mismatch');
  }
  const declaration = exactRootRecord(records, 'dual_bus_model')?.v;
  if (!declaration || declaration.mode !== 'imported_host_egress'
    || JSON.stringify(declaration.egress_pins) !== JSON.stringify(['resource', 'data'])
    || JSON.stringify(declaration.egress_routes) !== JSON.stringify([
      { pin_name: 'resource', route_kind: 'control' },
      { pin_name: 'data', route_kind: 'management' },
    ])
    || JSON.stringify(declaration.envelope_extension_keys) !== JSON.stringify(REVISION4_ENVELOPE_EXTENSION_KEYS)) {
    throw codedError('revision4_fixture_dual_bus_contract_mismatch');
  }
  if (exactRootRecord(records, 'resource')?.t !== 'pin.out'
    || exactRootRecord(records, 'data')?.t !== 'pin.out'
    || exactRootRecord(records, 'result')?.t !== 'pin.in') {
    throw codedError('revision4_fixture_pin_contract_mismatch');
  }
  return records;
}

export function loadRevision4LiveFixture({
  fixturePath = resolve(repoRoot, REVISION4_LIVE_FIXTURE_RELATIVE_PATH),
  exists = existsSync,
  readFile = readFileSync,
} = {}) {
  const expectedPath = resolve(repoRoot, REVISION4_LIVE_FIXTURE_RELATIVE_PATH);
  if (resolve(fixturePath) !== expectedPath) throw codedError('revision4_fixture_path_must_be_committed');
  if (!exists(expectedPath)) throw codedError('revision4_fixture_missing');
  let records;
  try {
    records = JSON.parse(readFile(expectedPath, 'utf8'));
  } catch (error) {
    throw codedError('revision4_fixture_json_invalid', error);
  }
  return validateFixtureRecords(records);
}

export function buildRevision4LiveScenarioPayload({ kind, marker } = {}) {
  const safeMarker = String(marker || '').trim();
  if (!/^[a-z][a-z0-9_-]{0,63}$/u.test(safeMarker)) throw codedError('revision4_marker_invalid');
  if (kind === 'control') {
    return [
      mtRecord('model_type', 'model.table', 'Data'),
      mtRecord('sys_msg_type', 'str', 'resource.report'),
      mtRecord('is_need_response', 'bool', true),
      mtRecord('message_server', 'str', 'local'),
      mtRecord('between', 'str', 'DEM_V1N'),
      mtRecord('custom_trace', 'json', { marker: safeMarker, path: 'control' }),
      mtRecord('type', 'str', 'UI', 0, 1, 0, 0),
      mtRecord('resource', 'list', [`UI.0457.${safeMarker}.control`], 0, 1, 0, 0),
    ];
  }
  if (kind === 'management') {
    return [
      mtRecord('model_type', 'model.table', 'Data'),
      mtRecord('sys_msg_type', 'str', 'data.save_modeltable'),
      mtRecord('is_need_response', 'bool', true),
      mtRecord('message_server', 'str', 'global'),
      mtRecord('between', 'str', 'WSM_DEM'),
      mtRecord('send_user', 'str', 'U1'),
      mtRecord('receive_user', 'str', 'R1'),
      mtRecord('custom_trace', 'json', { marker: safeMarker, path: 'management' }),
      mtRecord('acceptance_value', 'str', `revision4-${safeMarker}`, 0, 1, 0, 0),
    ];
  }
  throw codedError('revision4_scenario_kind_invalid');
}

export function buildWorkspaceManagerNetworkAuditProbe({ marker, timestamp = Date.now() } = {}) {
  const safeMarker = String(marker || '').trim();
  if (!/^[a-z][a-z0-9_-]{0,63}$/u.test(safeMarker)) {
    throw codedError('workspace_manager_network_audit_marker_invalid');
  }
  if (!Number.isInteger(timestamp) || timestamp < 0) {
    throw codedError('workspace_manager_network_audit_timestamp_invalid');
  }
  const topic = 'UIPUT/ws/dam/pic/de/WM1/4000/refresh';
  const responsePin = `wm_audit_result_${safeMarker}`;
  const responseTopic = `UIPUT/ws/dam/pic/de/E2E/1/${responsePin}`;
  const opId = `wm_network_audit_${safeMarker}`;
  const payload = [
    mtRecord('__mt_payload_kind', 'str', 'pin_payload.v2'),
    mtRecord('__mt_request_id', 'str', opId),
    mtRecord('op_id', 'str', opId),
    mtRecord('message_role', 'str', 'request'),
    mtRecord('topic', 'str', topic),
    mtRecord('response_topic', 'str', responseTopic),
    mtRecord('bus', 'str', 'control'),
    mtRecord('route_kind', 'str', 'control'),
    mtRecord('endpoint_worker_id', 'str', 'WM1'),
    mtRecord('endpoint_table_id', 'str', 'host'),
    mtRecord('endpoint_model_id', 'int', 4000),
    mtRecord('endpoint_pin', 'str', 'refresh'),
    mtRecord('origin_worker_id', 'str', 'E2E'),
    mtRecord('origin_table_id', 'str', 'host'),
    mtRecord('origin_model_id', 'int', 1),
    mtRecord('origin_pin', 'str', 'wm_audit'),
    mtRecord('reply_target_worker_id', 'str', 'E2E'),
    mtRecord('reply_target_table_id', 'str', 'host'),
    mtRecord('reply_target_model_id', 'int', 1),
    mtRecord('reply_target_pin', 'str', responsePin),
    mtRecord('payload_model_id', 'int', 1),
    mtRecord('timestamp', 'int', timestamp),
    mtRecord('audit_marker', 'str', safeMarker, 1),
  ];
  return {
    topic,
    response_topic: responseTopic,
    packet: { version: 'v1', type: 'pin_payload', payload },
  };
}

export function evaluateWorkspaceManagerNetworkAuditResponse({ probe, message, notBefore } = {}) {
  const fail = (code) => ({ ok: false, code });
  if (!probe || typeof probe.response_topic !== 'string' || !probe.response_topic) {
    return fail('workspace_manager_probe_invalid');
  }
  if (!message || String(message.topic || '') !== probe.response_topic) {
    return fail('response_topic_mismatch');
  }
  let packet;
  try {
    packet = JSON.parse(String(message.payload ?? ''));
  } catch {
    return fail('response_json_invalid');
  }
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)
    || Object.keys(packet).sort().join(',') !== 'payload,type,version'
    || packet.version !== 'v1'
    || packet.type !== 'pin_payload'
    || !Array.isArray(packet.payload)
    || packet.payload.length === 0) {
    return fail('response_outer_envelope_invalid');
  }

  const records = packet.payload;
  const recordIdentities = new Set();
  const rootRecords = new Map();
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)
      || Object.keys(record).sort().join(',') !== 'c,id,k,p,r,t,v'
      || !Number.isInteger(record.id)
      || !Number.isInteger(record.p)
      || !Number.isInteger(record.r)
      || !Number.isInteger(record.c)
      || typeof record.k !== 'string'
      || !record.k
      || typeof record.t !== 'string'
      || !record.t
      || !Object.prototype.hasOwnProperty.call(record, 'v')) {
      return fail('response_record_invalid');
    }
    if (record.id === 0 && (record.p !== 0 || record.r !== 0 || record.c !== 0)) {
      return fail('nonroot_model_zero_record');
    }
    const identity = `${record.id}:${record.p}:${record.r}:${record.c}:${record.k}`;
    if (recordIdentities.has(identity)) {
      return fail(record.id === 0 ? 'duplicate_model_zero_root_key' : 'duplicate_response_record');
    }
    recordIdentities.add(identity);
    if (record.id === 0) rootRecords.set(record.k, record);
  }

  const expectedRootKeys = new Set([
    '__mt_payload_kind',
    '__mt_request_id',
    'op_id',
    'message_role',
    'topic',
    'response_topic',
    'route_kind',
    'bus',
    'endpoint_worker_id',
    'endpoint_table_id',
    'endpoint_model_id',
    'endpoint_pin',
    'origin_worker_id',
    'origin_table_id',
    'origin_model_id',
    'origin_pin',
    'reply_target_worker_id',
    'reply_target_table_id',
    'reply_target_model_id',
    'reply_target_pin',
    'payload_model_id',
    'timestamp',
  ]);
  if (rootRecords.size !== expectedRootKeys.size
    || [...rootRecords.keys()].some((key) => !expectedRootKeys.has(key))) {
    return fail('response_root_contract_invalid');
  }
  const has = (key, type, value) => {
    const record = rootRecords.get(key);
    return Boolean(record && record.t === type && Object.is(record.v, value));
  };
  const responsePin = probe.response_topic.split('/').at(-1);
  if (!has('__mt_payload_kind', 'str', 'pin_payload.v2')
    || !has('message_role', 'str', 'response')
    || !has('topic', 'str', probe.response_topic)
    || !has('response_topic', 'str', probe.response_topic)
    || !has('bus', 'str', 'control')
    || !has('route_kind', 'str', 'control')) {
    return fail('response_transport_contract_invalid');
  }
  const requestId = rootRecords.get('__mt_request_id');
  const opId = rootRecords.get('op_id');
  if (requestId?.t !== 'str' || opId?.t !== 'str' || requestId.v !== opId.v
    || !/^wm_refresh_result_[0-9]+$/u.test(requestId.v)) {
    return fail('response_correlation_invalid');
  }
  if (!has('endpoint_worker_id', 'str', 'E2E')
    || !has('endpoint_table_id', 'str', 'host')
    || !has('endpoint_model_id', 'int', 1)
    || !has('endpoint_pin', 'str', responsePin)
    || !has('reply_target_worker_id', 'str', 'E2E')
    || !has('reply_target_table_id', 'str', 'host')
    || !has('reply_target_model_id', 'int', 1)
    || !has('reply_target_pin', 'str', responsePin)) {
    return fail('response_target_mismatch');
  }
  if (!has('origin_worker_id', 'str', 'WM1')
    || !has('origin_table_id', 'str', 'host')
    || !has('origin_model_id', 'int', 4000)
    || !has('origin_pin', 'str', 'refresh')) {
    return fail('response_origin_mismatch');
  }
  const timestampRecord = rootRecords.get('timestamp');
  if (timestampRecord?.t !== 'int' || !Number.isInteger(timestampRecord.v)) {
    return fail('response_timestamp_invalid');
  }
  if (!Number.isFinite(notBefore) || timestampRecord.v < notBefore) {
    return fail('response_timestamp_stale');
  }
  const payloadModelId = rootRecords.get('payload_model_id');
  if (payloadModelId?.t !== 'int' || !Number.isInteger(payloadModelId.v) || payloadModelId.v <= 0) {
    return fail('response_payload_model_invalid');
  }
  const payloadRecords = records.filter((record) => record.id === payloadModelId.v);
  if (payloadRecords.length === 0
    || records.some((record) => record.id !== 0 && record.id !== payloadModelId.v)
    || !payloadRecords.some((record) => (
      record.p === 0 && record.r === 0 && record.c === 0
      && record.k === 'workspace_manager_status' && record.t === 'str' && record.v === 'ready'
    ))) {
    return fail('response_business_payload_invalid');
  }
  return {
    ok: true,
    code: 'workspace_manager_network_audit_verified',
    response_topic: probe.response_topic,
  };
}

export async function runWorkspaceManagerNetworkAuditRoundtrip({
  mqttClient,
  marker,
  now = Date.now,
  operation = async (_stage, work) => work(),
} = {}) {
  if (!mqttClient || typeof mqttClient.on !== 'function'
    || typeof mqttClient.subscribe !== 'function'
    || typeof mqttClient.publish !== 'function') {
    throw codedError('workspace_manager_network_audit_mqtt_client_invalid');
  }
  const requestTimestamp = now();
  const probe = buildWorkspaceManagerNetworkAuditProbe({ marker, timestamp: requestTimestamp });
  let resolveResponse;
  let rejectResponse;
  const responsePromise = new Promise((resolveResponsePromise, rejectResponsePromise) => {
    resolveResponse = resolveResponsePromise;
    rejectResponse = rejectResponsePromise;
  });
  // MQTT can fail while subscribe/publish is still awaited. Mark the response
  // promise handled immediately; awaiting the original promise below still
  // preserves the exact rejection for the caller.
  responsePromise.catch(() => undefined);
  const disposeMessage = mqttClient.on('message', (messageTopic, payload) => {
    if (String(messageTopic) !== probe.response_topic) return;
    resolveResponse({ topic: String(messageTopic), payload: String(payload) });
  });
  const disposeError = mqttClient.on('error', (error) => {
    rejectResponse(codedError('workspace_manager_network_audit_mqtt_error', error));
  });
  try {
    await operation('workspace_manager_subscribe', () => mqttClient.subscribe(probe.response_topic));
    await operation('workspace_manager_outbound_probe', () => mqttClient.publish(probe.topic, probe.packet));
    const message = await operation('workspace_manager_response', () => responsePromise);
    const evaluated = evaluateWorkspaceManagerNetworkAuditResponse({
      probe,
      message,
      notBefore: requestTimestamp,
    });
    if (!evaluated.ok) throw codedError(evaluated.code);
    return evaluated;
  } finally {
    for (const dispose of [disposeMessage, disposeError]) {
      if (typeof dispose === 'function') dispose();
    }
  }
}

function buildWriteLabelPayload(targetCell, targetLabel, targetType, value, requestId) {
  return [
    mtRecord('__mt_payload_kind', 'str', 'write_label.v1'),
    mtRecord('__mt_request_id', 'str', requestId),
    mtRecord('__mt_from_cell', 'json', { p: 0, r: 0, c: 0 }),
    mtRecord('__mt_target_cell', 'json', targetCell),
    mtRecord(targetLabel, targetType, value),
  ];
}

function buildSlideImportMediaEnvelope(uri, marker) {
  const opId = `revision4_import_uri_${marker}`;
  return {
    type: 'bus_event_v2',
    bus_in_key: 'slide_import_media_uri_update',
    value: buildWriteLabelPayload(
      { p: 0, r: 0, c: 0 },
      'slide_import_media_uri',
      'str',
      uri,
      opId,
    ),
    meta: { op_id: opId, source: 'revision4_live_acceptance' },
  };
}

function buildSlideImportClickEnvelope(marker) {
  const opId = `revision4_import_click_${marker}`;
  return {
    type: 'bus_event_v2',
    bus_in_key: 'slide_import_click',
    value: buildWriteLabelPayload(
      { p: 2, r: 4, c: 0 },
      'click',
      'pin.in',
      [
        mtRecord('__mt_payload_kind', 'str', 'ui_event.v1'),
        mtRecord('target', 'json', { model_id: 1031, p: 0, r: 0, c: 0 }),
        mtRecord('action', 'str', 'click'),
      ],
      opId,
    ),
    meta: { op_id: opId, source: 'revision4_live_acceptance' },
  };
}

function buildOwnerPinEnvelope(ref, scenario, payload, marker) {
  const opId = `revision4_${scenario.kind}_${marker}`;
  return {
    type: 'ui_owner_label_update',
    payload: {
      action: 'ui_owner_label_update',
      meta: { op_id: opId, source: 'revision4_live_acceptance' },
      target: {
        table_id: ref.table_id,
        model_id: ref.model_id,
        p: 0,
        r: 0,
        c: 0,
        k: scenario.pin,
      },
      value: { t: 'pin.out', v: payload },
    },
  };
}

function buildOwnerUninstallEnvelope(ref, marker) {
  const opId = `revision4_uninstall_${marker}_${Date.now()}`;
  return {
    type: 'click',
    payload: {
      meta: { op_id: opId, source: 'revision4_live_acceptance' },
      target: { model_id: -25, p: 2, r: 7, c: 1 },
      pin: 'click',
      value: [
        mtRecord('__mt_payload_kind', 'str', 'ws_delete_app.v1'),
        mtRecord('table_id', 'str', ref.table_id),
        mtRecord('model_id', 'int', ref.model_id),
      ],
    },
    source: 'revision4_live_acceptance',
  };
}

function parseAttestationLog(text, contract) {
  const lines = String(text || '').split(/\r?\n/u)
    .filter((line) => line.startsWith(`${ACTOR_ATTESTATION_MARKER} `));
  if (lines.length === 0) throw codedError(`revision4_actor_attestation_missing:${contract.name}`);
  const attestations = lines.map((line) => {
    try {
      return JSON.parse(line.slice(ACTOR_ATTESTATION_MARKER.length + 1));
    } catch (error) {
      throw codedError(`revision4_actor_attestation_invalid:${contract.name}`, error);
    }
  });
  const expectedKeys = [
    'bus_pins',
    'mounted_models',
    'root_form',
    'source_files',
    'topic_base',
    'worker_alias',
    'worker_id',
    'worker_role',
  ];
  for (const attestation of attestations) {
    const valid = attestation
      && typeof attestation === 'object'
      && !Array.isArray(attestation)
      && JSON.stringify(Object.keys(attestation).sort()) === JSON.stringify(expectedKeys)
      && attestation.worker_id === contract.worker_id
      && attestation.worker_role === contract.worker_role
      && attestation.worker_alias === contract.worker_alias
      && attestation.topic_base === 'UIPUT/ws/dam/pic/de'
      && JSON.stringify(attestation.root_form) === JSON.stringify({
        key: 'model_type',
        type: 'model.v1n',
        value: '',
      })
      && JSON.stringify(attestation.bus_pins) === JSON.stringify(contract.bus_pins)
      && JSON.stringify(attestation.mounted_models) === JSON.stringify(contract.mounted_models)
      && JSON.stringify(attestation.source_files) === JSON.stringify(contract.source_files);
    if (!valid) throw codedError(`revision4_actor_attestation_mismatch:${contract.name}`);
  }
  const attestation = attestations.at(-1);
  return {
    worker_id: attestation.worker_id,
    worker_role: attestation.worker_role,
    worker_alias: attestation.worker_alias,
    mounted_models: [...attestation.mounted_models],
  };
}

function keepHandled(execution) {
  execution.catch(() => undefined);
  return execution;
}

function withTimeout(promiseOrFactory, {
  timeoutMs,
  code,
  setTimer,
  clearTimer,
}) {
  let timer = null;
  let settled = false;
  const execution = new Promise((resolvePromise, rejectPromise) => {
    timer = setTimer(() => {
      if (settled) return;
      settled = true;
      rejectPromise(codedError(code));
    }, timeoutMs);
    let operation;
    try {
      operation = typeof promiseOrFactory === 'function' ? promiseOrFactory() : promiseOrFactory;
    } catch (error) {
      settled = true;
      clearTimer(timer);
      rejectPromise(error);
      return;
    }
    Promise.resolve(operation).then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimer(timer);
        resolvePromise(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimer(timer);
        rejectPromise(error);
      },
    );
  });
  return execution;
}

export function createRevision4LiveHttpClient({
  baseUrl = REVISION4_LIVE_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = REVISION4_LIVE_HTTP_TIMEOUT_MS,
  pollTimeoutMs = REVISION4_LIVE_POLL_TIMEOUT_MS,
  pollIntervalMs = REVISION4_LIVE_POLL_INTERVAL_MS,
  delay = defaultDelay,
  monotonicNow = () => Date.now(),
} = {}) {
  const parsedBase = parseExactUrl(baseUrl, 'revision4_ui_server_url_invalid');
  if (parsedBase.protocol !== 'http:' || parsedBase.hostname !== '127.0.0.1' || parsedBase.port !== '30900'
    || parsedBase.username || parsedBase.password || parsedBase.pathname !== '/') {
    throw codedError('revision4_local_ui_server_required');
  }
  if (typeof fetchImpl !== 'function') throw codedError('revision4_fetch_unavailable');
  const normalizedBase = parsedBase.origin;

  const request = async (pathname, { method = 'GET', json = undefined, rawBody = undefined, headers = {} } = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${normalizedBase}${pathname}`, {
        method,
        headers: {
          accept: 'application/json',
          ...(json === undefined ? {} : { 'content-type': 'application/json; charset=utf-8' }),
          ...headers,
        },
        body: json === undefined ? rawBody : JSON.stringify(json),
        signal: controller.signal,
      });
      const textBody = await response.text();
      let data = {};
      if (textBody) {
        try {
          data = JSON.parse(textBody);
        } catch {
          throw codedError(`revision4_http_json_invalid:${pathname}`);
        }
      }
      if (!response.ok) {
        const reason = typeof data?.error === 'string' ? data.error : `status_${response.status}`;
        throw codedError(`revision4_http_failed:${pathname}:${reason}`);
      }
      return { status: response.status, data };
    } catch (error) {
      if (error?.name === 'AbortError') throw codedError(`revision4_http_timeout:${pathname}`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  const poll = async (read, accept, timeoutCode) => {
    const deadline = monotonicNow() + pollTimeoutMs;
    let lastValue = null;
    while (true) {
      lastValue = await read();
      const accepted = accept(lastValue);
      if (accepted) return accepted === true ? lastValue : accepted;
      const remaining = deadline - monotonicNow();
      if (remaining <= 0) throw codedError(timeoutCode);
      await delay(Math.min(pollIntervalMs, remaining));
    }
  };

  const getSnapshot = async () => poll(
    () => request('/snapshot?profile=full'),
    (response) => response.status === 200 && response.data?.snapshot ? response.data.snapshot : false,
    'revision4_snapshot_ready_timeout',
  );

  const ensureRuntimeRunning = async () => poll(
    () => request('/api/runtime/mode', { method: 'POST', json: { mode: 'running' } }),
    (response) => response.status === 200 && response.data?.ok === true && response.data?.mode === 'running',
    'revision4_runtime_running_timeout',
  );

  const postBusEvent = async (envelope) => {
    const response = await request('/bus_event', { method: 'POST', json: envelope });
    if (response.data?.ok !== true || response.data?.result === 'error' || response.data?.bus_event_error) {
      const reason = response.data?.code || response.data?.bus_event_error?.code || response.data?.detail || 'unknown';
      throw codedError(`revision4_owner_event_rejected:${reason}`);
    }
    return response.data;
  };

  const findFixtureApps = async ({
    appName = REVISION4_LIVE_FIXTURE_APP_NAME,
    fixture = loadRevision4LiveFixture(),
  } = {}) => {
    validateFixtureRecords(fixture);
    const snapshot = await getSnapshot();
    const registryRefs = snapshotRegistry(snapshot)
      .filter((entry) => entry?.name === appName && typeof entry.table_id === 'string' && Number.isInteger(entry.model_id))
      .map((entry) => ({ table_id: entry.table_id, model_id: entry.model_id }));
    const tableRefs = [];
    for (const [tableId, table] of Object.entries(snapshot?.tables || {})) {
      for (const [modelIdText, model] of Object.entries(table?.models || {})) {
        const modelId = Number(modelIdText);
        if (!Number.isInteger(modelId)) continue;
        const labels = model?.cells?.['0,0,0']?.labels || {};
        if (labels.app_name?.v === appName) tableRefs.push({ table_id: tableId, model_id: modelId });
      }
    }
    const candidates = uniqueModelRefs([...registryRefs, ...tableRefs]);
    const owned = [];
    const conflicts = [];
    for (const ref of candidates) {
      if (isExactFixtureModel(snapshot, ref, fixture)) owned.push(ref);
      else conflicts.push(ref);
    }
    if (conflicts.length > 0) {
      const conflictRefs = conflicts.map((ref) => `${ref.table_id}|${ref.model_id}`).join(',');
      throw codedError(`revision4_same_name_nonfixture_conflict:${conflictRefs}`);
    }
    return owned;
  };

  const installFixture = async ({ fixture, appName = REVISION4_LIVE_FIXTURE_APP_NAME, marker }) => {
    validateFixtureRecords(fixture);
    await ensureRuntimeRunning();
    const beforeSnapshot = await getSnapshot();
    const previousRefs = new Set(snapshotRegistry(beforeSnapshot)
      .filter((entry) => entry?.name === appName)
      .map((entry) => `${entry.table_id}|${entry.model_id}`));
    const zip = new AdmZip();
    zip.addFile('app_payload.json', Buffer.from(JSON.stringify(fixture, null, 2), 'utf8'));
    const upload = await request(
      `/api/media/upload?filename=${encodeURIComponent(`0457-revision4-${marker}.zip`)}&purpose=slide-import`,
      {
        method: 'POST',
        rawBody: zip.toBuffer(),
        headers: { 'content-type': 'application/zip' },
      },
    );
    if (upload.data?.ok !== true || typeof upload.data?.uri !== 'string' || !upload.data.uri) {
      throw codedError('revision4_fixture_upload_failed');
    }
    const mediaRoute = await postBusEvent(buildSlideImportMediaEnvelope(upload.data.uri, marker));
    if (mediaRoute.routed_by !== 'model0_busin') {
      throw codedError('revision4_import_media_model0_route_required');
    }
    const clickRoute = await postBusEvent(buildSlideImportClickEnvelope(marker));
    if (clickRoute.routed_by !== 'model0_busin') {
      throw codedError('revision4_import_click_model0_route_required');
    }
    return poll(
      getSnapshot,
      (snapshot) => {
        const entry = snapshotRegistry(snapshot).find((candidate) => candidate?.name === appName
          && typeof candidate.table_id === 'string' && candidate.table_id !== 'host'
          && Number.isInteger(candidate.model_id)
          && !previousRefs.has(`${candidate.table_id}|${candidate.model_id}`));
        if (!entry) return false;
        const ref = { table_id: entry.table_id, model_id: entry.model_id };
        return isExactFixtureModel(snapshot, ref, fixture) ? ref : false;
      },
      'revision4_fixture_install_timeout',
    );
  };

  const assertInstalledTopology = async ({ ref, fixture = loadRevision4LiveFixture() }) => {
    validateFixtureRecords(fixture);
    const snapshot = await getSnapshot();
    if (!isExactFixtureModel(snapshot, ref, fixture)) {
      throw codedError('revision4_installed_topology_mismatch');
    }
    return { ok: true };
  };

  const triggerScenario = async ({ ref, scenario, payload, marker }) => {
    const response = await postBusEvent(buildOwnerPinEnvelope(ref, scenario, payload, marker));
    if (response.routed_by !== 'owner_materialization') {
      throw codedError(`revision4_owner_route_required:${scenario.kind}`);
    }
    return response;
  };

  const waitForMaterializedResponse = async ({ ref, scenario }) => poll(
    getSnapshot,
    (snapshot) => {
      const labels = snapshotRootLabels(snapshot, ref);
      const status = labels.status?.v;
      const action = labels.action?.v;
      const handlerResult = labels.handler_result?.v;
      if (status !== 'accepted' || action !== scenario.expected_action
        || !handlerResult || handlerResult.status === 'rejected' || handlerResult.action !== scenario.expected_action) {
        return false;
      }
      return {
        table_id: ref.table_id,
        model_id: ref.model_id,
        status,
        action,
      };
    },
    `revision4_${scenario.kind}_response_timeout`,
  );

  const uninstallFixture = async ({ ref, marker, fixture = loadRevision4LiveFixture() }) => {
    validateFixtureRecords(fixture);
    const snapshot = await getSnapshot();
    if (!isExactFixtureModel(snapshot, ref, fixture)) {
      throw codedError('revision4_uninstall_fixture_identity_mismatch');
    }
    const response = await postBusEvent(buildOwnerUninstallEnvelope(ref, marker));
    if (response.routed_by !== 'direct_pin') throw codedError('revision4_uninstall_pin_route_required');
    return { ok: true };
  };

  const assertNoFixtureResidue = async ({ refs, appName = REVISION4_LIVE_FIXTURE_APP_NAME }) => poll(
    getSnapshot,
    (snapshot) => {
      const exactRegistryResidue = snapshotRegistry(snapshot).some((entry) => entry?.name === appName);
      if (exactRegistryResidue) return false;
      const exactTableResidue = Object.values(snapshot?.tables || {}).some((table) => Object.values(table?.models || {}).some((model) => (
        model?.cells?.['0,0,0']?.labels?.app_name?.v === appName
      )));
      if (exactTableResidue) return false;
      for (const ref of uniqueModelRefs(refs)) {
        if (snapshotModel(snapshot, ref)) return false;
        const model0Cells = snapshot?.models?.['0']?.cells || {};
        const mountResidue = Object.values(model0Cells).some((cell) => Object.values(cell?.labels || {}).some((label) => (
          label?.t === 'model.subtableconnection' && label?.v?.table_id === ref.table_id
        )));
        if (mountResidue) return false;
      }
      return { ok: true };
    },
    'revision4_fixture_cleanup_timeout',
  );

  return {
    request,
    getSnapshot,
    ensureRuntimeRunning,
    postBusEvent,
    findFixtureApps,
    installFixture,
    assertInstalledTopology,
    triggerScenario,
    waitForMaterializedResponse,
    uninstallFixture,
    assertNoFixtureResidue,
  };
}

function parseExactUrl(value, code) {
  try {
    return new URL(String(value || ''));
  } catch {
    throw codedError(code);
  }
}

function isExactMatrixUrl(value) {
  const parsed = parseExactUrl(value, 'local_matrix_required');
  return parsed.protocol === 'http:'
    && parsed.hostname === 'synapse.dongyu.svc.cluster.local'
    && parsed.port === '8008'
    && parsed.username === ''
    && parsed.password === '';
}

function isApprovedFeishuUrl(value) {
  const parsed = parseExactUrl(value || 'https://open.feishu.cn/open-apis', 'feishu_https_required');
  if (parsed.protocol !== 'https:') throw codedError('feishu_https_required');
  if (parsed.hostname !== 'open.feishu.cn' || parsed.port !== '' || parsed.username || parsed.password) {
    throw codedError('approved_feishu_host_required');
  }
  return true;
}

function createMqttAdapter({
  mqttConnect,
  host,
  port,
  timeoutMs,
  cleanupTimeoutMs,
  setTimer,
  clearTimer,
}) {
  let rawClient;
  try {
    rawClient = mqttConnect({ host, port });
  } catch (error) {
    return keepHandled(Promise.reject(codedError('mqtt_connect_error', error)));
  }
  if (!rawClient || typeof rawClient.on !== 'function') {
    return keepHandled(Promise.reject(codedError('mqtt_connect_error', 'invalid MQTT client')));
  }

  let rawEnded = false;
  const endRaw = () => {
    if (rawEnded || typeof rawClient.end !== 'function') return Promise.resolve();
    rawEnded = true;
    return new Promise((resolvePromise) => {
      let called = false;
      let cleanupTimer = null;
      const done = () => {
        if (called) return;
        called = true;
        clearTimer(cleanupTimer);
        resolvePromise();
      };
      const boundedCleanupTimeoutMs = Math.max(
        1,
        Math.min(cleanupTimeoutMs, Math.floor(timeoutMs / 4)),
      );
      cleanupTimer = setTimer(done, boundedCleanupTimeoutMs);
      try {
        rawClient.end(false, {}, done);
      } catch {
        done();
      }
    });
  };

  const connectExecution = new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    let timer = null;
    const removeConnectListener = () => {
      rawClient.off('connect', onConnect);
    };
    const rejectConnect = async (code, error = null) => {
      if (settled) return;
      settled = true;
      clearTimer(timer);
      removeConnectListener();
      await endRaw();
      rawClient.off('error', onConnectError);
      rejectPromise(codedError(code, error));
    };
    const onConnectError = (error) => {
      void rejectConnect('mqtt_connect_error', error);
    };
    const onConnect = () => {
      if (settled) return;
      settled = true;
      clearTimer(timer);
      removeConnectListener();
      rawClient.off('error', onConnectError);

      let connectionError = null;
      let closePromise = null;
      const externalListeners = new Set();
      const onManagedError = (error) => {
        connectionError = error || new Error('unknown MQTT connection error');
      };
      rawClient.on('error', onManagedError);

      const rejectIfDisconnected = () => {
        if (connectionError) throw codedError('mqtt_connection_error', connectionError);
      };
      const callbackOperation = (kind, start) => {
        try {
          rejectIfDisconnected();
        } catch (error) {
          return Promise.reject(error);
        }
        return keepHandled(new Promise((resolveOperation, rejectOperation) => {
          let operationSettled = false;
          const operationTimer = setTimer(() => {
            if (operationSettled) return;
            operationSettled = true;
            rejectOperation(codedError(`mqtt_${kind}_timeout`));
          }, timeoutMs);
          const callback = (error, value) => {
            if (operationSettled) return;
            operationSettled = true;
            clearTimer(operationTimer);
            if (error) rejectOperation(codedError(`mqtt_${kind}_error`, error));
            else resolveOperation(value);
          };
          try {
            start(callback);
          } catch (error) {
            callback(error);
          }
        }));
      };

      const adapter = {
        on(event, listener) {
          if (event !== 'message' && event !== 'error') throw new Error(`unsupported_mqtt_listener:${event}`);
          rawClient.on(event, listener);
          const registration = { event, listener, disposed: false };
          externalListeners.add(registration);
          return () => {
            if (registration.disposed) return;
            registration.disposed = true;
            externalListeners.delete(registration);
            rawClient.off(event, listener);
          };
        },
        subscribe(topic) {
          return callbackOperation('subscribe', (callback) => rawClient.subscribe(topic, callback));
        },
        publish(topic, packet) {
          return callbackOperation('publish', (callback) => rawClient.publish(topic, JSON.stringify(packet), callback));
        },
        close() {
          if (closePromise) return closePromise;
          closePromise = (async () => {
            for (const registration of [...externalListeners]) {
              registration.disposed = true;
              externalListeners.delete(registration);
              rawClient.off(registration.event, registration.listener);
            }
            try {
              if (rawEnded || typeof rawClient.end !== 'function') return;
              rawEnded = true;
              await new Promise((resolveClose, rejectClose) => {
                let closeSettled = false;
                const closeTimer = setTimer(() => {
                  if (closeSettled) return;
                  closeSettled = true;
                  rejectClose(codedError('mqtt_close_timeout'));
                }, timeoutMs);
                const done = (error) => {
                  if (closeSettled) return;
                  closeSettled = true;
                  clearTimer(closeTimer);
                  if (error) rejectClose(codedError('mqtt_close_error', error));
                  else resolveClose();
                };
                try {
                  rawClient.end(false, {}, done);
                } catch (error) {
                  done(error);
                }
              });
            } finally {
              rawClient.off('error', onManagedError);
            }
          })();
          keepHandled(closePromise);
          return closePromise;
        },
      };
      resolvePromise(adapter);
    };

    rawClient.on('connect', onConnect);
    rawClient.on('error', onConnectError);
    timer = setTimer(() => {
      void rejectConnect('mqtt_connect_timeout');
    }, timeoutMs);
  });
  return keepHandled(connectExecution);
}

export function createDefaultLegacyPublicBoundaryProbeDependencies({
  execFile = defaultExecFile,
  spawn = spawnChild,
  mqttConnect = (options) => mqtt.connect(options),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  delay = defaultDelay,
  monotonicNow = () => Date.now(),
  now = Date.now,
  env = loadLocalAcceptanceEnvironment(),
  localCheckTimeoutMs = LEGACY_PUBLIC_BOUNDARY_LOCAL_CHECK_TIMEOUT_MS,
  portForwardReadyTimeoutMs = LEGACY_PUBLIC_BOUNDARY_PORT_FORWARD_READY_TIMEOUT_MS,
  portForwardCloseTimeoutMs = LEGACY_PUBLIC_BOUNDARY_PORT_FORWARD_CLOSE_TIMEOUT_MS,
  evidencePollTimeoutMs = LEGACY_PUBLIC_BOUNDARY_EVIDENCE_POLL_TIMEOUT_MS,
  evidencePollIntervalMs = LEGACY_PUBLIC_BOUNDARY_EVIDENCE_POLL_INTERVAL_MS,
  logReadTimeoutMs = LEGACY_PUBLIC_BOUNDARY_LOG_READ_TIMEOUT_MS,
  mqttOperationTimeoutMs = LEGACY_PUBLIC_BOUNDARY_MQTT_ADAPTER_TIMEOUT_MS,
  mqttCleanupTimeoutMs = LEGACY_PUBLIC_BOUNDARY_MQTT_CLEANUP_TIMEOUT_MS,
} = {}) {
  const boundedExec = async (command, args, options, timeoutCode, failedCode) => {
    try {
      return await withTimeout(
        () => execFile(command, args, options),
        { timeoutMs: options.timeout, code: timeoutCode, setTimer, clearTimer },
      );
    } catch (error) {
      if (errorMessage(error).includes(timeoutCode)) throw error;
      throw codedError(failedCode, error);
    }
  };

  const readDeployment = async ({ deployment, args, kind, timeoutMs = logReadTimeoutMs }) => {
    const timeoutCode = `acceptance_window_${kind}_read_timeout:${deployment}`;
    const failedCode = `acceptance_window_${kind}_read_failed:${deployment}`;
    const result = await boundedExec('kubectl', args, { timeout: timeoutMs }, timeoutCode, failedCode);
    return String(result?.stdout || '');
  };

  const pollR1 = async ({ kind, since, parse }) => {
    const started = monotonicNow();
    const deadline = started + evidencePollTimeoutMs;
    const timeoutCode = kind === 'diagnostic' ? 'r1_diagnostic_timeout' : 'r1_trace_timeout';
    while (true) {
      const remainingBeforeRead = deadline - monotonicNow();
      if (remainingBeforeRead <= 0) throw codedError(timeoutCode);
      const readTimeoutMs = Math.max(1, Math.min(logReadTimeoutMs, remainingBeforeRead));
      try {
        const result = await withTimeout(
          () => execFile('kubectl', [
            '-n', 'dongyu', 'logs', 'deployment/remote-worker', '--since-time', new Date(since).toISOString(),
          ], { timeout: readTimeoutMs }),
          { timeoutMs: readTimeoutMs, code: 'r1_log_read_timeout', setTimer, clearTimer },
        );
        const parsed = parse(String(result?.stdout || ''));
        if (parsed && (!Array.isArray(parsed) || parsed.length > 0)) return parsed;
      } catch {
        // A single bounded log read may fail while the pod log stream rotates.
      }
      const remaining = deadline - monotonicNow();
      if (remaining <= 0) throw codedError(timeoutCode);
      await delay(Math.min(evidencePollIntervalMs, remaining));
    }
  };

  return {
    now,
    setTimer,
    clearTimer,
    async assertLocalOrbStack() {
      let context;
      try {
        context = await execFile('kubectl', ['config', 'current-context'], { timeout: localCheckTimeoutMs });
      } catch (error) {
        throw codedError('orbstack_context_check_failed', error);
      }
      if (String(context?.stdout || '').trim() !== 'orbstack') throw codedError('orbstack_context_required');

      let matrixLocal = false;
      try {
        matrixLocal = isExactMatrixUrl(env.MATRIX_HOMESERVER_URL);
      } catch {
        matrixLocal = false;
      }
      if (!matrixLocal) throw codedError('local_matrix_required');
      const mqttHost = String(env.DY_MQTT_HOST || env.MQTT_HOST || '');
      const mqttPort = Number(env.DY_MQTT_PORT || env.MQTT_PORT || 1883);
      if (mqttHost !== 'mosquitto.dongyu.svc.cluster.local' || mqttPort !== 1883) {
        throw codedError('local_mqtt_required');
      }
      if (String(env.DY_OIDC_ISSUER || '') || String(env.DY_OIDC_PROXY_URL || '')) {
        throw codedError('remote_oidc_forbidden');
      }
      isApprovedFeishuUrl(env.FEISHU_API_BASE);

      try {
        await execFile('bash', [resolve(repoRoot, 'scripts/ops/check_runtime_baseline.sh')], {
          cwd: repoRoot,
          timeout: localCheckTimeoutMs,
        });
      } catch (error) {
        throw codedError('runtime_baseline_failed', error);
      }
      try {
        await execFile('kubectl', [
          '-n', 'dongyu', 'exec', 'deployment/mbr-worker', '--', 'node', '-e', SYNAPSE_HEALTH_SCRIPT,
        ], { timeout: localCheckTimeoutMs });
      } catch (error) {
        throw codedError('local_synapse_health_failed', error);
      }
    },
    openMosquittoTunnel({ namespace, service, host }) {
      const child = spawn('kubectl', [
        '-n', namespace, 'port-forward', '--address', host, service, '31883:1883',
      ]);
      let terminated = false;
      let forceKilled = false;
      let childExited = false;
      let ready = false;
      let readinessTimer = null;
      let closePromise = null;
      child.once('exit', () => {
        childExited = true;
      });
      const terminateOnce = ({ evenIfExited = false } = {}) => {
        if (terminated || (childExited && !evenIfExited)) return;
        terminated = true;
        child.kill('SIGTERM');
      };
      const forceKillOnce = () => {
        if (forceKilled || childExited) return;
        forceKilled = true;
        child.kill('SIGKILL');
      };
      const waitForExit = (timeoutMs) => {
        if (childExited) return Promise.resolve(true);
        return new Promise((resolveWait) => {
          let settled = false;
          let timer = null;
          const finish = (didExit) => {
            if (settled) return;
            settled = true;
            clearTimer(timer);
            child.off('exit', onExit);
            resolveWait(didExit);
          };
          const onExit = () => finish(true);
          child.once('exit', onExit);
          timer = setTimer(() => finish(false), timeoutMs);
        });
      };
      return new Promise((resolveTunnel, rejectTunnel) => {
        const cleanupReadiness = () => {
          clearTimer(readinessTimer);
          child.stdout?.off('data', onData);
          child.off('error', onError);
          child.off('exit', onExit);
        };
        const fail = (code, error = null) => {
          if (ready) return;
          ready = true;
          cleanupReadiness();
          const cleanup = (async () => {
            terminateOnce({ evenIfExited: true });
            if (await waitForExit(portForwardCloseTimeoutMs)) return;
            forceKillOnce();
            if (await waitForExit(portForwardCloseTimeoutMs)) return;
            throw codedError('port_forward_startup_cleanup_timeout');
          })();
          keepHandled(cleanup);
          cleanup.then(
            () => rejectTunnel(codedError(code, error)),
            (cleanupError) => rejectTunnel(codedError(`port_forward_startup_cleanup_failed:${code}`, cleanupError)),
          );
        };
        const onData = (chunk) => {
          if (ready || !String(chunk).includes('Forwarding from 127.0.0.1:31883')) return;
          ready = true;
          cleanupReadiness();
          resolveTunnel({
            host,
            port: 31883,
            close() {
              if (closePromise) return closePromise;
              closePromise = (async () => {
                if (childExited) return;
                terminateOnce();
                if (await waitForExit(portForwardCloseTimeoutMs)) return;
                forceKillOnce();
                if (await waitForExit(portForwardCloseTimeoutMs)) return;
                throw codedError('port_forward_close_timeout');
              })();
              keepHandled(closePromise);
              return closePromise;
            },
          });
        };
        const onError = (error) => fail('port_forward_child_error', error);
        const onExit = () => fail('port_forward_exited_before_ready');
        child.stdout?.on('data', onData);
        child.on('error', onError);
        child.on('exit', onExit);
        readinessTimer = setTimer(() => fail('port_forward_ready_timeout'), portForwardReadyTimeoutMs);
      });
    },
    connectMqtt({ host, port }) {
      return createMqttAdapter({
        mqttConnect,
        host,
        port,
        timeoutMs: mqttOperationTimeoutMs,
        cleanupTimeoutMs: mqttCleanupTimeoutMs,
        setTimer,
        clearTimer,
      });
    },
    readR1Diagnostic({ since, phase, notBefore = null }) {
      return pollR1({
        kind: 'diagnostic',
        since,
        parse: (text) => parseR1DiagnosticLog(text, { phase, notBefore }),
      });
    },
    readR1TraceDelta(options) {
      return pollR1({
        kind: 'trace',
        since: options.since,
        parse: (text) => parseR1TraceDeltaLog(text, options),
      });
    },
    async waitForSilence({ timeoutMs }) {
      await delay(timeoutMs);
    },
    assertAcceptanceWindowNetworkBoundary({ since }) {
      const execution = (async () => {
        const deadline = monotonicNow() + evidencePollTimeoutMs;
        let pendingMissing = null;
        const missingEvidenceError = () => codedError(
          `missing_fresh_network_boundary_evidence:${pendingMissing[0]}:${pendingMissing[1]}`,
        );
        const remainingReadBudget = () => {
          const remaining = deadline - monotonicNow();
          if (remaining <= 0) throw codedError('acceptance_window_network_budget_exhausted');
          return Math.max(1, Math.min(logReadTimeoutMs, remaining));
        };
        const readWithinBudget = async (options) => {
          const timeoutMs = remainingReadBudget();
          let text;
          try {
            text = await readDeployment({ ...options, timeoutMs });
          } catch (error) {
            const timeoutCode = `acceptance_window_${options.kind}_read_timeout:${options.deployment}`;
            if (pendingMissing && timeoutMs < logReadTimeoutMs && errorMessage(error).includes(timeoutCode)) {
              throw missingEvidenceError();
            }
            throw error;
          }
          if (monotonicNow() >= deadline) {
            if (pendingMissing) throw missingEvidenceError();
            throw codedError('acceptance_window_network_budget_exhausted');
          }
          return text;
        };
        const synapseText = await readWithinBudget({
          deployment: 'deployment/synapse',
          args: ['-n', 'dongyu', 'exec', 'deployment/synapse', '--', 'cat', '/data/homeserver.yaml'],
          kind: 'config',
        });
        const mosquittoText = await readWithinBudget({
          deployment: 'deployment/mosquitto',
          args: ['-n', 'dongyu', 'exec', 'deployment/mosquitto', '--', 'cat', '/mosquitto/config/mosquitto.conf'],
          kind: 'config',
        });

        const staticEvidence = [];
        if (hasExactLocalSynapseListener(synapseText)) {
          staticEvidence.push(buildDeNetworkBoundaryEvidence({
            kind: 'effective_config',
            service: 'synapse',
            destination: 'http://0.0.0.0:8008',
            ts: since,
          }));
        }
        if (hasExactLocalMosquittoListener(mosquittoText)) {
          staticEvidence.push(buildDeNetworkBoundaryEvidence({
            kind: 'effective_config',
            service: 'mosquitto',
            destination: 'mqtt://0.0.0.0:1883',
            ts: since,
          }));
        }

        const actorDeployments = [
          ['deployment/mbr-worker', 'mbr-worker'],
          ['deployment/remote-worker', 'remote-worker'],
          ['deployment/workspace-manager', 'workspace-manager'],
        ];
        while (true) {
          if (monotonicNow() >= deadline && pendingMissing) {
            throw missingEvidenceError();
          }
          const actorEvidence = [];
          for (const [deployment, expectedService] of actorDeployments) {
            const text = await readWithinBudget({
              deployment,
              args: ['-n', 'dongyu', 'logs', deployment, '--since-time', new Date(since).toISOString()],
              kind: 'log',
            });
            let parsed;
            try {
              parsed = parseDeNetworkBoundaryEvidenceLines(text, { since });
            } catch (error) {
              throw codedError('invalid_network_boundary_evidence', error);
            }
            for (const entry of parsed) {
              if (entry.service !== expectedService) {
                throw codedError('acceptance_window_network_boundary_violation:actor_identity');
              }
              const evaluated = evaluateDeNetworkBoundaryEvidence(entry, { since });
              if (!evaluated?.ok) {
                throw codedError(`acceptance_window_network_boundary_violation:${evaluated?.code || 'unknown'}`);
              }
              actorEvidence.push(entry);
            }
          }

          const allEvidence = [...actorEvidence, ...staticEvidence];
          const required = [
            ['mbr-worker', 'effective_config', 'http:'],
            ['mbr-worker', 'effective_config', 'mqtt:'],
            ['remote-worker', 'effective_config', 'mqtt:'],
            ['workspace-manager', 'effective_config', 'mqtt:'],
            ['workspace-manager', 'outbound_attempt', 'mqtt:'],
            ['synapse', 'effective_config', 'http:'],
            ['mosquitto', 'effective_config', 'mqtt:'],
          ];
          const missing = required.find(([service, kind, protocol]) => !allEvidence.some((entry) => (
            entry.service === service && entry.kind === kind && entry.protocol === protocol
          )));
          if (!missing) {
            return { ok: true, scanned_deployments: [...ACCEPTANCE_WINDOW_DEPLOYMENTS] };
          }
          pendingMissing = missing;
          const remaining = deadline - monotonicNow();
          if (remaining <= 0) {
            throw codedError(`missing_fresh_network_boundary_evidence:${missing[0]}:${missing[1]}`);
          }
          await delay(Math.min(evidencePollIntervalMs, remaining));
        }
      })();
      execution.catch(() => undefined);
      return execution;
    },
    evaluateEvidence: evaluateLegacyPublicBoundaryEvidence,
  };
}

async function executeLegacyPublicBoundaryProbe({
  marker = `probe_${Date.now()}`,
  operationTimeoutMs = LEGACY_PUBLIC_BOUNDARY_OPERATION_TIMEOUT_MS,
  networkBoundaryTimeoutMs = LEGACY_PUBLIC_BOUNDARY_NETWORK_AUDIT_TIMEOUT_MS,
  responseQuietPeriodMs = LEGACY_PUBLIC_BOUNDARY_RESPONSE_QUIET_PERIOD_MS,
  timeline = null,
  dependencies = {},
} = {}) {
  const defaults = createDefaultLegacyPublicBoundaryProbeDependencies();
  const deps = { ...defaults, ...dependencies };
  const usesDefaultNetworkBoundaryAudit = (
    deps.assertAcceptanceWindowNetworkBoundary === defaults.assertAcceptanceWindowNetworkBoundary
  );
  const setTimer = deps.setTimer || setTimeout;
  const clearTimer = deps.clearTimer || clearTimeout;
  const operation = (stage, work, timeoutMs = operationTimeoutMs) => withTimeout(work, {
    timeoutMs,
    code: `${stage}_timeout`,
    setTimer,
    clearTimer,
  });

  const startedAt = deps.now();
  if (timeline && typeof timeline === 'object') timeline.acceptance_started_at = startedAt;
  const probe = buildLegacyPublicBoundaryProbe({ marker });
  const responseMessages = [];
  let tunnel = null;
  let mqttClient = null;
  let disposeMessage = null;
  let disposeError = null;
  let mqttConnectionError = null;
  let result;
  let primaryError = null;

  const assertMqttConnected = () => {
    if (mqttConnectionError) throw codedError('mqtt_connection_lost', mqttConnectionError);
  };

  try {
    await deps.assertLocalOrbStack();
    tunnel = await operation('port_forward', () => deps.openMosquittoTunnel({
      namespace: 'dongyu',
      service: 'svc/mosquitto',
      host: '127.0.0.1',
    }));
    mqttClient = await operation('mqtt_connect', () => deps.connectMqtt({ host: tunnel.host, port: tunnel.port }));
    disposeMessage = mqttClient.on('message', (messageTopic, payload) => {
      if (String(messageTopic) === probe.response_topic) {
        responseMessages.push({ topic: String(messageTopic), payload: String(payload) });
      }
    });
    disposeError = mqttClient.on('error', (error) => {
      mqttConnectionError = error || new Error('unknown MQTT connection loss');
    });
    await operation('mqtt_subscribe', () => mqttClient.subscribe(probe.response_topic));
    const before = await operation(
      'r1_diagnostic_before',
      () => deps.readR1Diagnostic({ since: startedAt, phase: 'before' }),
      LEGACY_PUBLIC_BOUNDARY_EVIDENCE_OPERATION_TIMEOUT_MS,
    );
    assertMqttConnected();
    const publishedAt = deps.now();
    if (timeline && typeof timeline === 'object') timeline.published_at = publishedAt;
    await operation('mqtt_publish', () => mqttClient.publish(probe.topic, probe.packet));
    assertMqttConnected();
    const after = await operation(
      'r1_diagnostic_after',
      () => deps.readR1Diagnostic({ since: startedAt, phase: 'after', notBefore: publishedAt }),
      LEGACY_PUBLIC_BOUNDARY_EVIDENCE_OPERATION_TIMEOUT_MS,
    );
    assertMqttConnected();
    const traceDelta = await operation(
      'r1_trace',
      () => deps.readR1TraceDelta({
        since: startedAt,
        notBefore: publishedAt,
        topic: probe.topic,
        marker,
        responseTopic: probe.response_topic,
        outerPacketSha256: probe.outer_packet_sha256,
      }),
      LEGACY_PUBLIC_BOUNDARY_EVIDENCE_OPERATION_TIMEOUT_MS,
    );
    assertMqttConnected();
    await operation('response_silence', () => deps.waitForSilence({
      timeoutMs: responseQuietPeriodMs,
      notBefore: publishedAt,
    }));
    assertMqttConnected();
    if (usesDefaultNetworkBoundaryAudit) {
      await runWorkspaceManagerNetworkAuditRoundtrip({ mqttClient, marker, operation });
      assertMqttConnected();
    }
    const boundary = await operation(
      'network_boundary',
      () => deps.assertAcceptanceWindowNetworkBoundary({ since: startedAt }),
      networkBoundaryTimeoutMs,
    );
    if (boundary && boundary.ok === false) throw codedError('acceptance_window_network_boundary_violation');
    assertMqttConnected();
    result = deps.evaluateEvidence({
      before,
      after,
      traceDelta,
      traceSince: startedAt,
      responseMessages,
      topic: probe.topic,
      startedAt,
      publishedAt,
      marker,
      responseTopic: probe.response_topic,
      outerPacketSha256: probe.outer_packet_sha256,
    });
  } catch (error) {
    primaryError = error;
  }

  const cleanupErrors = [];
  for (const dispose of [disposeMessage, disposeError]) {
    if (typeof dispose !== 'function') continue;
    try {
      dispose();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (mqttClient && typeof mqttClient.close === 'function') {
    try {
      await mqttClient.close();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (tunnel && typeof tunnel.close === 'function') {
    try {
      await tunnel.close();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  if (primaryError) throw primaryError;
  if (result && result.ok === false) return result;
  if (cleanupErrors.length > 0) throw cleanupErrors[0];
  return result;
}

export function runLegacyPublicBoundaryProbe(options = {}) {
  const execution = executeLegacyPublicBoundaryProbe(options);
  // Some deterministic timeout tests intentionally attach their assertion only
  // after firing the injected timer. Keep that short window handled without
  // changing the promise returned to callers.
  execution.catch(() => undefined);
  return execution;
}

export function createDefaultRevision4LiveAcceptanceDependencies({
  execFile = defaultExecFile,
  httpClient = createRevision4LiveHttpClient(),
  legacyDependencies = createDefaultLegacyPublicBoundaryProbeDependencies({ execFile }),
  persistRoot = process.env.DY_UI_SERVER_PERSIST_ROOT || REVISION4_LOCAL_PERSIST_ROOT,
  now = Date.now,
  monotonicNow = () => Date.now(),
  delay = defaultDelay,
  positiveEvidencePollTimeoutMs = REVISION4_LIVE_POLL_TIMEOUT_MS,
  positiveEvidencePollIntervalMs = REVISION4_LIVE_POLL_INTERVAL_MS,
} = {}) {
  const assertActorAttestations = async ({ since }) => {
    if (!Number.isFinite(since)) throw codedError('revision4_actor_attestation_window_invalid');
    const evidence = {};
    const pending = new Map(REVISION4_ACTOR_CONTRACTS.map((contract) => [contract.name, contract]));
    const deadline = monotonicNow() + positiveEvidencePollTimeoutMs;
    while (pending.size > 0) {
      for (const [name, contract] of [...pending.entries()]) {
        const remainingBeforeRead = deadline - monotonicNow();
        if (remainingBeforeRead <= 0) {
          throw codedError(`revision4_actor_attestation_timeout:${[...pending.keys()].join(',')}`);
        }
        const readTimeoutMs = Math.max(1, Math.min(REVISION4_LIVE_HTTP_TIMEOUT_MS, remainingBeforeRead));
        let result;
        try {
          result = await execFile('kubectl', [
            '-n', 'dongyu', 'logs', contract.deployment, '--since-time', new Date(since).toISOString(),
          ], { timeout: readTimeoutMs });
        } catch (error) {
          throw codedError(`revision4_actor_attestation_read_failed:${contract.name}`, error);
        }
        try {
          evidence[name] = parseAttestationLog(result?.stdout, contract);
          pending.delete(name);
        } catch (error) {
          if (!errorMessage(error).includes(`revision4_actor_attestation_missing:${name}`)) throw error;
        }
      }
      if (pending.size === 0) break;
      const remaining = deadline - monotonicNow();
      if (remaining <= 0) {
        throw codedError(`revision4_actor_attestation_timeout:${[...pending.keys()].join(',')}`);
      }
      await delay(Math.min(positiveEvidencePollIntervalMs, remaining));
    }
    return evidence;
  };

  const assertPersistedNoFixtureResidue = async ({ ref }) => {
    if (!ref || typeof ref.table_id !== 'string' || ref.table_id === 'host') {
      throw codedError('revision4_persisted_ref_invalid');
    }
    const script = `
      import { existsSync, readdirSync, statSync } from 'node:fs';
      import { join } from 'node:path';
      import { Database } from 'bun:sqlite';
      const root = ${JSON.stringify(resolve(persistRoot))};
      const tableId = ${JSON.stringify(ref.table_id)};
      const files = [];
      const walk = (dir) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          const stat = statSync(full);
          if (stat.isDirectory()) walk(full);
          else if (stat.isFile() && /\\.(?:db|sqlite)$/u.test(name)) files.push(full);
        }
      };
      if (!existsSync(root)) throw new Error('persist_root_missing');
      walk(root);
      const checked = [];
      const residues = [];
      for (const file of files) {
        let db = null;
        try {
          db = new Database(file, { readonly: true });
          const hasTable = db.query("select count(*) as count from sqlite_master where type='table' and name='mt_data'").get();
          if (!hasTable || Number(hasTable.count) < 1) continue;
          checked.push(file);
          const columns = db.query('pragma table_info(mt_data)').all().map((column) => column.name);
          const hasTableId = columns.includes('table_id');
          let residueCount = hasTableId
            ? Number(db.query('select count(*) as count from mt_data where table_id = ?').get(tableId)?.count || 0)
            : 0;
          const ownershipSql = hasTableId
            ? "select mt_id, p, r, c, k, t, v from mt_data where table_id = 'host' and ((mt_id = -2 and p = 0 and r = 0 and c = 0 and k = 'ws_apps_registry') or t = 'model.subtableconnection')"
            : "select mt_id, p, r, c, k, t, v from mt_data where (mt_id = -2 and p = 0 and r = 0 and c = 0 and k = 'ws_apps_registry') or t = 'model.subtableconnection'";
          for (const row of db.query(ownershipSql).all()) {
            let value;
            try {
              value = JSON.parse(row.v);
            } catch {
              residueCount += 1;
              continue;
            }
            if (row.k === 'ws_apps_registry') {
              if (row.t !== 'json' || !Array.isArray(value)) {
                residueCount += 1;
                continue;
              }
              const malformed = value.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry)
                || (Object.prototype.hasOwnProperty.call(entry, 'table_id')
                  && (typeof entry.table_id !== 'string' || !entry.table_id.trim())));
              if (malformed || value.some((entry) => typeof entry.table_id === 'string' && entry.table_id.trim() === tableId)) {
                residueCount += 1;
              }
              continue;
            }
            if (Number.isInteger(value)) {
              if (value <= 0) residueCount += 1;
              continue;
            }
            const allowedDescriptorKeys = new Set(['table_id', 'root_model_id', 'mount_kind', 'owner_principal_id']);
            const descriptorKeys = value && typeof value === 'object' && !Array.isArray(value)
              ? Object.keys(value)
              : [];
            const ownerPrincipalId = value && typeof value === 'object' ? value.owner_principal_id : undefined;
            const descriptorIsValid = value && typeof value === 'object' && !Array.isArray(value)
              && descriptorKeys.every((key) => allowedDescriptorKeys.has(key))
              && typeof value.table_id === 'string' && value.table_id.trim() && value.table_id.trim() !== 'host'
              && Number.isInteger(value.root_model_id) && value.root_model_id >= 0
              && typeof value.mount_kind === 'string' && value.mount_kind.trim()
              && (ownerPrincipalId === undefined || ownerPrincipalId === null || typeof ownerPrincipalId === 'string');
            if (!descriptorIsValid) {
              residueCount += 1;
              continue;
            }
            if (value.table_id.trim() === tableId) residueCount += 1;
          }
          if (residueCount > 0) residues.push({ file, count: residueCount });
        } finally {
          if (db) db.close();
        }
      }
      process.stdout.write(JSON.stringify({ checked: checked.length, residues }));
    `;
    let result;
    try {
      result = await execFile('bun', ['--eval', script], {
        cwd: repoRoot,
        timeout: REVISION4_LIVE_HTTP_TIMEOUT_MS,
      });
    } catch (error) {
      throw codedError('revision4_persisted_residue_check_failed', error);
    }
    let evidence;
    try {
      evidence = JSON.parse(String(result?.stdout || ''));
    } catch (error) {
      throw codedError('revision4_persisted_residue_evidence_invalid', error);
    }
    if (!Number.isInteger(evidence?.checked) || evidence.checked < 1) {
      throw codedError('revision4_persisted_database_missing');
    }
    if (!Array.isArray(evidence.residues) || evidence.residues.length > 0) {
      throw codedError('revision4_persisted_fixture_residue');
    }
    return { ok: true, checked_databases: evidence.checked };
  };

  const readPositiveCorrelationEvidence = async ({ since, ref, scenario }) => {
    const deadline = monotonicNow() + positiveEvidencePollTimeoutMs;
    const deploymentByProducer = [
      ['ui-server', 'deployment/ui-server'],
      ['mbr', 'deployment/mbr-worker'],
      ['r1', 'deployment/remote-worker'],
    ];
    const outboundStage = scenario.kind === 'control'
      ? 'control_outbound_attempt'
      : 'management_outbound_attempt';
    const replyTarget = exactReplyTarget(ref);
    const endpoint = { table_id: 'host', model_id: 3200, pin: scenario.pin };
    while (true) {
      const entries = [];
      for (const [producer, deployment] of deploymentByProducer) {
        const remainingBeforeRead = deadline - monotonicNow();
        if (remainingBeforeRead <= 0) {
          throw codedError('revision4_positive_correlation_evidence_timeout');
        }
        const readTimeoutMs = Math.max(1, Math.min(REVISION4_LIVE_HTTP_TIMEOUT_MS, remainingBeforeRead));
        let result;
        try {
          result = await execFile('kubectl', [
            '-n', 'dongyu', 'logs', deployment, '--since-time', new Date(since).toISOString(),
          ], { timeout: readTimeoutMs });
        } catch (error) {
          throw codedError(`revision4_positive_evidence_read_failed:${producer}`, error);
        }
        let parsed;
        try {
          parsed = parseDePinFlowEvidenceLines(String(result?.stdout || ''), { since });
        } catch (error) {
          throw codedError(`revision4_positive_evidence_parse_failed:${producer}`, error);
        }
        entries.push(...parsed);
      }
      const candidates = entries.filter((entry) => entry.producer === 'ui-server'
        && entry.stage === outboundStage
        && entry.message_role === 'request'
        && entry.bus === scenario.kind
        && entry.route_kind === scenario.kind
        && sameJson(entry.endpoint, endpoint)
        && sameJson(entry.reply_target, replyTarget));
      const complete = [];
      for (const candidate of candidates) {
        const wrapper = {
          op_id: candidate.op_id,
          request_id: candidate.request_id,
          entries,
        };
        try {
          evaluateRevision4PositiveCorrelationEvidence(wrapper, {
            since,
            ref,
            scenario,
          });
          complete.push(wrapper);
        } catch (error) {
          if (!/revision4_positive_(?:pin_flow_stage_missing|pin_flow_correlation_missing)/u.test(errorMessage(error))) {
            throw error;
          }
        }
      }
      const uniqueComplete = new Map(complete.map((item) => [`${item.op_id}|${item.request_id}`, item]));
      if (uniqueComplete.size === 1) return [...uniqueComplete.values()][0];
      if (uniqueComplete.size > 1) throw codedError('revision4_positive_correlation_ambiguous');
      const remaining = deadline - monotonicNow();
      if (remaining <= 0) throw codedError('revision4_positive_correlation_evidence_timeout');
      await delay(Math.min(positiveEvidencePollIntervalMs, remaining));
    }
  };

  const readUiServerBoundaryEvidence = async ({ since }) => {
    const deadline = monotonicNow() + positiveEvidencePollTimeoutMs;
    while (true) {
      const remainingBeforeRead = deadline - monotonicNow();
      if (remainingBeforeRead <= 0) {
        throw codedError('revision4_ui_server_boundary_evidence_timeout');
      }
      const readTimeoutMs = Math.max(1, Math.min(REVISION4_LIVE_HTTP_TIMEOUT_MS, remainingBeforeRead));
      let result;
      try {
        result = await execFile('kubectl', [
          '-n', 'dongyu', 'logs', REVISION4_UI_SERVER_DEPLOYMENT,
          '--since-time', new Date(since).toISOString(),
        ], { timeout: readTimeoutMs });
      } catch (error) {
        throw codedError('revision4_ui_server_boundary_read_failed', error);
      }
      let entries;
      try {
        entries = parseDeNetworkBoundaryEvidenceLines(String(result?.stdout || ''), { since });
      } catch (error) {
        throw codedError('revision4_ui_server_boundary_parse_failed', error);
      }
      const evidence = { deployment: REVISION4_UI_SERVER_DEPLOYMENT, entries };
      try {
        evaluateRevision4UiServerBoundaryEvidence(evidence, { since, now: now() });
        return evidence;
      } catch (error) {
        if (!/revision4_ui_server_boundary_missing_fresh_(?:effective_config|outbound)/u.test(errorMessage(error))) {
          throw error;
        }
      }
      const remaining = deadline - monotonicNow();
      if (remaining <= 0) throw codedError('revision4_ui_server_boundary_evidence_timeout');
      await delay(Math.min(positiveEvidencePollIntervalMs, remaining));
    }
  };

  return {
    now,
    loadFixture: () => loadRevision4LiveFixture(),
    assertLocalOrbStack: legacyDependencies.assertLocalOrbStack,
    assertActorAttestations,
    findFixtureApps: httpClient.findFixtureApps,
    installFixture: httpClient.installFixture,
    assertInstalledTopology: httpClient.assertInstalledTopology,
    triggerScenario: httpClient.triggerScenario,
    waitForMaterializedResponse: httpClient.waitForMaterializedResponse,
    readPositiveCorrelationEvidence,
    runLegacyProbe: (options) => runLegacyPublicBoundaryProbe(options),
    assertAcceptanceWindowNetworkBoundary: legacyDependencies.assertAcceptanceWindowNetworkBoundary,
    readUiServerBoundaryEvidence,
    uninstallFixture: httpClient.uninstallFixture,
    assertNoFixtureResidue: httpClient.assertNoFixtureResidue,
    assertPersistedNoFixtureResidue,
  };
}

export async function runRevision4LiveAcceptance({
  marker = `local_${Date.now()}`,
  timeline = null,
  dependencies = {},
} = {}) {
  const safeMarker = String(marker || '').trim();
  if (!/^[a-z][a-z0-9_-]{0,63}$/u.test(safeMarker)) throw codedError('revision4_marker_invalid');
  const defaults = createDefaultRevision4LiveAcceptanceDependencies();
  const deps = { ...defaults, ...dependencies };
  const startedAt = deps.now();
  if (timeline && typeof timeline === 'object') timeline.acceptance_started_at = startedAt;
  const fixture = deps.loadFixture();
  const scenarios = [
    { kind: 'control', pin: 'resource', expected_action: 'report' },
    { kind: 'management', pin: 'data', expected_action: 'save_modeltable' },
  ];
  let installedRef = null;
  let installationAttempted = false;
  let primaryError = null;
  let acceptanceResult = null;
  const cleanupErrors = [];
  const removedRefs = [];
  const seenPositiveOpIds = new Set();
  const seenPositiveRequestIds = new Set();

  try {
    await deps.assertLocalOrbStack();
    await deps.assertActorAttestations({ since: startedAt });

    const staleRefs = uniqueModelRefs(await deps.findFixtureApps({
      appName: REVISION4_LIVE_FIXTURE_APP_NAME,
      fixture,
    }));
    if (staleRefs.length > 0) {
      for (const ref of staleRefs) {
        await deps.uninstallFixture({ ref, marker: `${safeMarker}_stale`, fixture });
      }
      await deps.assertNoFixtureResidue({ refs: staleRefs, appName: REVISION4_LIVE_FIXTURE_APP_NAME });
      for (const ref of staleRefs) await deps.assertPersistedNoFixtureResidue({ ref });
    }

    installationAttempted = true;
    installedRef = await deps.installFixture({
      fixture,
      appName: REVISION4_LIVE_FIXTURE_APP_NAME,
      marker: safeMarker,
    });
    if (!installedRef || typeof installedRef.table_id !== 'string' || installedRef.table_id === 'host'
      || !Number.isInteger(installedRef.model_id)) {
      throw codedError('revision4_install_ref_invalid');
    }
    await deps.assertInstalledTopology({ ref: installedRef, fixture });

    const scenarioResults = [];
    for (const scenario of scenarios) {
      const payload = buildRevision4LiveScenarioPayload({ kind: scenario.kind, marker: safeMarker });
      await deps.triggerScenario({
        ref: installedRef,
        scenario,
        payload,
        marker: safeMarker,
      });
      const response = await deps.waitForMaterializedResponse({
        ref: installedRef,
        scenario,
        marker: safeMarker,
      });
      if (response?.table_id !== installedRef.table_id || response?.model_id !== installedRef.model_id
        || response?.status !== 'accepted' || response?.action !== scenario.expected_action) {
        throw codedError(`revision4_${scenario.kind}_table_qualified_response_invalid`);
      }
      const positiveEvidence = await deps.readPositiveCorrelationEvidence({
        since: startedAt,
        ref: installedRef,
        scenario,
        marker: safeMarker,
        response,
      });
      const correlation = evaluateRevision4PositiveCorrelationEvidence(positiveEvidence, {
        since: startedAt,
        now: deps.now(),
        ref: installedRef,
        scenario,
        seenOpIds: seenPositiveOpIds,
        seenRequestIds: seenPositiveRequestIds,
      });
      scenarioResults.push({
        kind: scenario.kind,
        table_id: response.table_id,
        model_id: response.model_id,
        status: response.status,
        action: response.action,
        op_id: correlation.op_id,
        request_id: correlation.request_id,
        reply_target: correlation.reply_target,
      });
    }

    const legacyTimeline = {};
    const legacyResult = await deps.runLegacyProbe({
      marker: `${safeMarker}_legacy`,
      timeline: legacyTimeline,
    });
    if (!legacyResult?.ok) throw codedError(`revision4_legacy_negative_failed:${legacyResult?.code || 'unknown'}`);
    if (timeline && typeof timeline === 'object') {
      timeline.legacy_acceptance_started_at = legacyTimeline.acceptance_started_at;
      timeline.legacy_published_at = legacyTimeline.published_at;
    }
    const networkBoundary = await deps.assertAcceptanceWindowNetworkBoundary({ since: startedAt });
    if (!networkBoundary || networkBoundary.ok !== true) {
      throw codedError('revision4_acceptance_window_network_boundary_failed');
    }
    const uiServerBoundaryEvidence = await deps.readUiServerBoundaryEvidence({ since: startedAt });
    const uiServerBoundary = evaluateRevision4UiServerBoundaryEvidence(uiServerBoundaryEvidence, {
      since: startedAt,
      now: deps.now(),
    });
    acceptanceResult = {
      ok: true,
      code: 'revision4_live_verified',
      acceptance_started_at: startedAt,
      installed_ref: { ...installedRef },
      scenarios: scenarioResults,
      legacy: {
        result: legacyResult,
        acceptance_started_at: legacyTimeline.acceptance_started_at,
        published_at: legacyTimeline.published_at,
      },
      ui_server_boundary: uiServerBoundary,
    };
  } catch (error) {
    primaryError = error;
  }

  if (installationAttempted) {
    let cleanupRefs = installedRef ? [installedRef] : [];
    if (!installedRef) {
      try {
        cleanupRefs = uniqueModelRefs(await deps.findFixtureApps({
          appName: REVISION4_LIVE_FIXTURE_APP_NAME,
          fixture,
        }));
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    cleanupRefs = uniqueModelRefs(cleanupRefs);
    for (const ref of cleanupRefs) {
      try {
        await deps.uninstallFixture({ ref, marker: safeMarker, fixture });
        removedRefs.push(ref);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      await deps.assertNoFixtureResidue({ refs: cleanupRefs, appName: REVISION4_LIVE_FIXTURE_APP_NAME });
    } catch (error) {
      cleanupErrors.push(error);
    }
    for (const ref of cleanupRefs) {
      try {
        await deps.assertPersistedNoFixtureResidue({ ref });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }

  if (primaryError) {
    if (cleanupErrors.length > 0) primaryError.cleanup_errors = cleanupErrors;
    throw primaryError;
  }
  if (cleanupErrors.length > 0) {
    cleanupErrors[0].cleanup_errors = cleanupErrors;
    throw cleanupErrors[0];
  }
  return {
    ...acceptanceResult,
    cleanup: { ok: true, removed_refs: removedRefs },
  };
}

async function main() {
  const marker = process.argv[2] || `local_${Date.now()}`;
  const result = await runRevision4LiveAcceptance({ marker });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result?.ok) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
