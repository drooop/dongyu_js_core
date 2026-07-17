#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSsotDeActor } from '../lib/ssot_de_actor_test_helpers.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const verifierPath = resolve(repoRoot, 'scripts/test_e2e_0457_feishu_message_api_v2_orbstack.mjs');
const liveFixturePath = resolve(repoRoot, 'scripts/fixtures/0457/feishu_message_api_v2_orbstack_app_payload.json');
const runnerPath = resolve(repoRoot, 'scripts/run_worker_remote_v1.mjs');
const networkBoundaryModulePath = resolve(repoRoot, 'scripts/lib/de_network_boundary_evidence.mjs');
const topic = 'UIPUT/ws/dam/pic/de/R1/3200/resource';
const rejectionCode = 'legacy_feishu_message_api_v1_removed';
const actorAttestationMarker = 'DE_ACTOR_ATTESTATION';
const defaultResponseQuietPeriodMs = 1000;
const unitResponseQuietPeriodMs = 7;
const defaultPortForwardReadyTimeoutMs = 5000;
const defaultPortForwardCloseTimeoutMs = 1000;
const defaultEvidencePollTimeoutMs = 40000;
const defaultEvidencePollIntervalMs = 250;
const defaultEvidenceOperationTimeoutMs = 45000;
const defaultLogReadTimeoutMs = 7500;
const defaultOperationTimeoutMs = 5000;
const defaultNetworkBoundaryOperationTimeoutMs = 90000;
const defaultMqttAdapterTimeoutMs = 4000;
const defaultMqttCleanupTimeoutMs = 500;
const unitOperationTimeoutMs = 7;
const unitNetworkBoundaryOperationTimeoutMs = 11;
const defaultLocalCheckTimeoutMs = 60000;
const unitLocalCheckTimeoutMs = 100;
const unitLogReadTimeoutMs = 4;
const networkHeartbeatIntervalMs = 10000;
const acceptanceWindowDeployments = [
  'deployment/mbr-worker',
  'deployment/remote-worker',
  'deployment/workspace-manager',
  'deployment/synapse',
  'deployment/mosquitto',
];
const requiredNetworkBoundaryEvidence = [
  { service: 'mbr-worker', kind: 'effective_config', protocol: 'http:' },
  { service: 'mbr-worker', kind: 'effective_config', protocol: 'mqtt:' },
  { service: 'remote-worker', kind: 'effective_config', protocol: 'mqtt:' },
  { service: 'workspace-manager', kind: 'effective_config', protocol: 'mqtt:' },
  { service: 'workspace-manager', kind: 'outbound_attempt', protocol: 'mqtt:' },
  { service: 'synapse', kind: 'effective_config', protocol: 'http:' },
  { service: 'mosquitto', kind: 'effective_config', protocol: 'mqtt:' },
];
const allowedFeishuHostname = 'open.feishu.cn';
const liveFixtureAppName = '0457 Revision 4 Local V2 Acceptance';
const liveFixtureMarker = 'it0457-revision4-local-v2-acceptance.v1';
const startedAt = 1773379200000;
const publishedAt = startedAt + 100;
const secretSentinel = '0457-secret-must-never-reach-runner-log';
const tokenSentinel = '0457-token-must-never-reach-runner-log';
const synapseHealthScript = "fetch('http://synapse.dongyu.svc.cluster.local:8008/_matrix/client/versions').then(async response => { if (!response.ok) throw new Error('status_' + response.status); const body = await response.json(); if (!Array.isArray(body.versions)) throw new Error('versions_missing'); process.stdout.write('synapse_service_ready\\n'); }).catch(error => { process.stderr.write(String(error && error.message ? error.message : error) + '\\n'); process.exit(1); })";

function mt(k, t, v, id = '0', p = 0, r = 0, c = 0) {
  return { id, p, r, c, k, t, v };
}

function createPersistenceFixtureDb(dbPath, { tableQualified, rows }) {
  const columns = tableQualified
    ? 'table_id text, mt_id integer, p integer, r integer, c integer, k text, t text, v text, s text, i integer, m text'
    : 'mt_id integer, p integer, r integer, c integer, k text, t text, v text, s text, i integer, m text';
  const placeholders = tableQualified ? '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?' : '?, ?, ?, ?, ?, ?, ?, ?, ?, ?';
  const script = `
    import { Database } from 'bun:sqlite';
    const db = new Database(${JSON.stringify(dbPath)});
    db.query(${JSON.stringify(`create table mt_data (${columns})`)}).run();
    const insert = db.query(${JSON.stringify(`insert into mt_data values (${placeholders})`)});
    for (const row of ${JSON.stringify(rows)}) insert.run(...row);
    db.close();
  `;
  execFileSync('bun', ['--eval', script], { cwd: repoRoot, stdio: 'pipe' });
}

function expectedRemovedLegacyRecords(marker, responseTopic) {
  return [
    mt('model_type', 'model.subtable', 'Data'),
    mt('model_type', 'model.single', 'Data.Single', '0', 0, 0, 1),
    mt('__mt_payload_kind', 'str', 'pin_payload.v1', '0', 0, 0, 1),
    mt('is_need_response', 'bool', true, '0', 0, 0, 1),
    mt('model_type', 'model.matrix', 'Data', '0', 0, 1, 0),
    mt('model_size', 'model.matrix.size', {
      min_p: 0,
      min_r: 1,
      min_c: 0,
      max_p: 0,
      max_r: 1,
      max_c: 2,
    }, '0', 0, 1, 0),
    mt('route_kind', 'str', 'control', '0', 0, 1, 0),
    mt('origin_pin', 'str', responseTopic, '0', 0, 1, 0),
    mt('endpoint_pin', 'str', topic, '0', 0, 1, 0),
    mt('response_pin', 'str', responseTopic, '0', 0, 1, 0),
    mt('model_type', 'model.single', 'Data.Single', '0', 0, 1, 1),
    mt('message_server', 'str', 'local', '0', 0, 1, 1),
    mt('between', 'str', 'DEM_V1N', '0', 0, 1, 1),
    mt('model_type', 'model.subtableconnection', 1, '0', 0, 2, 0),
    mt('model_type', 'model.subtable', 'Data', '0.1'),
    mt('model_name', 'model.name', 'payload', '0.1'),
    mt('sys_msg_type', 'str', 'resource.report', '0.1'),
    mt('type', 'str', 'UI', '0.1', 0, 0, 1),
    mt('resource', 'list', [`UI.legacy_probe_${marker}`], '0.1', 0, 0, 1),
  ];
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function legacyOuterPacket(marker, responseTopic) {
  return {
    version: 'v1',
    type: 'pin_payload',
    payload: expectedRemovedLegacyRecords(marker, responseTopic),
  };
}

function responseTopicFor(marker) {
  return `UIPUT/ws/dam/pic/de/U1/3200/legacy_probe_${marker}`;
}

function probeCorrelation(marker = 'probe123') {
  const responseTopic = responseTopicFor(marker);
  const packet = legacyOuterPacket(marker, responseTopic);
  return {
    marker,
    responseTopic,
    packet,
    outerPacketSha256: sha256(packet),
  };
}

function positiveReplyTarget(ref) {
  return { table_id: ref.table_id, model_id: ref.model_id, pin: 'result' };
}

function positiveEvidence({
  kind,
  ref,
  opId = `imported_${kind}_op`,
  requestId = `imported_${kind}_request`,
  observedAt = startedAt + 1,
} = {}) {
  const pin = kind === 'control' ? 'resource' : 'data';
  const replyTarget = positiveReplyTarget(ref);
  const requestEndpoint = { table_id: 'host', model_id: 3200, pin };
  const stageDefinitions = kind === 'control' ? [
    ['ui-server', 'control_outbound_attempt', 'request', 'control'],
    ['r1', 'control_ingress', 'request', 'control'],
    ['r1', 'model_dispatch', 'request', 'control'],
    ['r1', 'control_response', 'response', 'control'],
    ['ui-server', 'validated_response_materialized', 'response', 'control'],
  ] : [
    ['ui-server', 'management_outbound_attempt', 'request', 'management'],
    ['mbr', 'management_ingress', 'request', 'management'],
    ['mbr', 'control_forward', 'request', 'management'],
    ['r1', 'control_ingress', 'request', 'management'],
    ['r1', 'model_dispatch', 'request', 'management'],
    ['r1', 'control_response', 'response', 'management'],
    ['mbr', 'control_response_ingress', 'response', 'management'],
    ['mbr', 'management_response_forward', 'response', 'management'],
    ['ui-server', 'validated_response_materialized', 'response', 'management'],
  ];
  const entries = stageDefinitions.map(([producer, stage, messageRole, bus], index) => ({
    schema: 'de_pin_flow_evidence.v1',
    ts: observedAt + index,
    producer,
    stage,
    op_id: opId,
    request_id: requestId,
    message_role: messageRole,
    bus,
    route_kind: kind,
    endpoint: messageRole === 'request' ? requestEndpoint : replyTarget,
    reply_target: replyTarget,
    payload_sha256: (messageRole === 'request' ? 'a' : 'b').repeat(64),
  }));
  return {
    op_id: opId,
    request_id: requestId,
    entries,
  };
}

function uiServerBoundaryEntry(kind, protocol, hostname, port, ts = startedAt + 1) {
  return {
    schema: 'de_network_boundary_evidence.v1',
    kind,
    service: 'ui-server',
    ts,
    protocol,
    hostname,
    port,
  };
}

function validUiServerBoundaryEvidence(extraEntries = []) {
  return {
    deployment: 'deployment/ui-server',
    entries: [
      uiServerBoundaryEntry('effective_config', 'http:', 'synapse.dongyu.svc.cluster.local', 8008),
      uiServerBoundaryEntry('effective_config', 'mqtt:', 'mosquitto.dongyu.svc.cluster.local', 1883),
      uiServerBoundaryEntry('outbound_attempt', 'http:', 'synapse.dongyu.svc.cluster.local', 8008, startedAt + 2),
      uiServerBoundaryEntry('outbound_attempt', 'mqtt:', 'mosquitto.dongyu.svc.cluster.local', 1883, startedAt + 2),
      ...extraEntries,
    ],
  };
}

function validDiagnostic(error = null) {
  return {
    schema: 'de_runtime_diagnostic.v1',
    model3200_sha256: 'a'.repeat(64),
    model3200_result_sha256: 'b'.repeat(64),
    mqtt_inbound_error: error,
  };
}

function exactRejection(overrides = {}) {
  return {
    code: rejectionCode,
    topic,
    pin: 'resource',
    ingress_pin: 'r1_cb_in',
    ts: publishedAt + 1,
    ...overrides,
  };
}

function exactTrace(overrides = {}) {
  const correlation = probeCorrelation();
  return {
    type: 'inbound_rejected',
    ts: publishedAt + 2,
    payload: {
      topic,
      pin: 'resource',
      ingress_pin: 'r1_cb_in',
      reason: rejectionCode,
      probe_marker: correlation.marker,
      response_topic: correlation.responseTopic,
      outer_packet_sha256: correlation.outerPacketSha256,
    },
    ...overrides,
  };
}

function exactAcceptedTrace(correlation, overrides = {}) {
  return {
    type: 'inbound',
    ts: publishedAt + 1,
    payload: {
      topic,
      pin: 'resource',
      ingress_pin: 'r1_cb_in',
      probe_marker: correlation.marker,
      response_topic: correlation.responseTopic,
      outer_packet_sha256: correlation.outerPacketSha256,
    },
    ...overrides,
  };
}

function diagnosticLogLine(diagnostic) {
  return `DE_RUNTIME_DIAGNOSTIC ${JSON.stringify(diagnostic)}`;
}

function traceLogLine(entries, reason = 'interval') {
  return `DE_RUNTIME_TRACE ${JSON.stringify({
    schema: 'de_runtime_trace.v1',
    reason,
    entries,
  })}`;
}

function omit(object, key) {
  const copy = { ...object };
  delete copy[key];
  return copy;
}

function fakePortForwardProcess({
  onKill = () => undefined,
  exitOnSignals = ['SIGTERM', 'SIGKILL'],
} = {}) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = (signal) => {
    onKill(signal);
    if (exitOnSignals.includes(signal)) queueMicrotask(() => child.emit('exit', null, signal));
    return true;
  };
  return child;
}

function fakeMqttJsClient({ autoEnd = false } = {}) {
  const client = new EventEmitter();
  const calls = [];
  const callbacks = {
    subscribe: [],
    publish: [],
    end: [],
  };
  const callbackFrom = (args) => [...args].reverse().find((entry) => typeof entry === 'function') || null;
  client.subscribe = (...args) => {
    calls.push(['subscribe', ...args.filter((entry) => typeof entry !== 'function')]);
    callbacks.subscribe.push(callbackFrom(args));
    return client;
  };
  client.publish = (...args) => {
    calls.push(['publish', ...args.filter((entry) => typeof entry !== 'function')]);
    callbacks.publish.push(callbackFrom(args));
    return client;
  };
  client.end = (...args) => {
    calls.push(['end', ...args.filter((entry) => typeof entry !== 'function')]);
    const callback = callbackFrom(args);
    callbacks.end.push(callback);
    if (autoEnd && callback) queueMicrotask(() => callback(null));
    return client;
  };
  return { callbacks, calls, client };
}

function createProbeListenerHarness({ onRegister = () => undefined } = {}) {
  const emitter = new EventEmitter();
  const registrations = { message: 0, error: 0 };
  const disposals = { message: 0, error: 0 };
  const on = (event, listener) => {
    assert.equal(event === 'message' || event === 'error', true, `unsupported probe listener event: ${event}`);
    assert.equal(typeof listener, 'function', `${event} listener must be callable`);
    registrations[event] += 1;
    onRegister(event, listener);
    emitter.on(event, listener);
    let disposed = false;
    return () => {
      disposals[event] += 1;
      if (disposed) return;
      disposed = true;
      emitter.off(event, listener);
    };
  };
  return {
    emitter,
    on,
    registrations,
    disposals,
    listenerCount: (event) => emitter.listenerCount(event),
  };
}

function assertProbeListenersDisposed(listeners, expectedRegistrations, message) {
  assert.deepEqual(listeners.registrations, expectedRegistrations, `${message}: exact listener registrations`);
  assert.deepEqual(listeners.disposals, expectedRegistrations, `${message}: every disposer called exactly once`);
  assert.equal(listeners.listenerCount('message'), 0, `${message}: message listener removed`);
  assert.equal(listeners.listenerCount('error'), 0, `${message}: error listener removed`);
}

function createManualTimerHarness({ onFire = () => undefined } = {}) {
  let nextId = 1;
  const active = new Map();
  const cleared = [];
  const scheduled = [];
  const setTimer = (callback, timeoutMs) => {
    const id = nextId;
    nextId += 1;
    active.set(id, { callback, timeoutMs });
    scheduled.push(timeoutMs);
    return id;
  };
  const clearTimer = (id) => {
    if (!active.has(id)) return;
    active.delete(id);
    cleared.push(id);
  };
  const fire = async (id) => {
    const timer = active.get(id);
    assert.ok(timer, `manual timer ${id} must be active before fire`);
    active.delete(id);
    onFire(timer.timeoutMs);
    timer.callback();
    await flushAsyncTurn();
  };
  const fireByTimeout = async (timeoutMs) => {
    const entry = [...active.entries()].find(([, timer]) => timer.timeoutMs === timeoutMs);
    assert.ok(entry, `manual timer with timeout ${timeoutMs}ms must exist`);
    await fire(entry[0]);
  };
  return {
    active,
    cleared,
    scheduled,
    setTimer,
    clearTimer,
    fire,
    fireByTimeout,
  };
}

async function flushAsyncTurn() {
  await new Promise((resolvePromise) => setImmediate(resolvePromise));
}

async function assertPromptRejection(promise, pattern, message) {
  let settled = false;
  let fulfilled = false;
  let rejection = null;
  promise.then(
    () => {
      settled = true;
      fulfilled = true;
    },
    (error) => {
      settled = true;
      rejection = error;
    },
  );
  await flushAsyncTurn();
  assert.equal(settled, true, `${message}: promise must settle without waiting for another timer`);
  assert.equal(fulfilled, false, `${message}: promise must reject`);
  assert.match(String(rejection?.message || rejection), pattern, message);
  return rejection;
}

async function loadProbeModule() {
  try {
    return await import('../lib/legacy_public_boundary_probe.mjs');
  } catch (error) {
    assert.fail(`missing live legacy-probe helper: ${error && error.message ? error.message : error}`);
  }
}

async function loadDiagnosticModule() {
  try {
    return await import('../lib/de_runtime_diagnostics.mjs');
  } catch (error) {
    assert.fail(`missing DE runtime diagnostic/trace serializer: ${error && error.message ? error.message : error}`);
  }
}

async function loadNetworkBoundaryModule() {
  try {
    return await import('../lib/de_network_boundary_evidence.mjs');
  } catch (error) {
    assert.fail(`missing shared DE network-boundary evidence helper: ${error && error.message ? error.message : error}`);
  }
}

async function loadPinFlowEvidenceModule() {
  try {
    return await import('../../packages/worker-base/src/de_pin_flow_evidence.mjs');
  } catch (error) {
    assert.fail(`missing shared DE pin-flow evidence helper: ${error && error.message ? error.message : error}`);
  }
}

async function loadVerifierModule() {
  assert.equal(existsSync(verifierPath), true, 'committed OrbStack verifier must exist');
  return import('../test_e2e_0457_feishu_message_api_v2_orbstack.mjs');
}

function fixtureRootLabel(records, key) {
  return Array.isArray(records)
    ? records.find((record) => record?.id === 0 && record?.p === 0 && record?.r === 0 && record?.c === 0 && record?.k === key) || null
    : null;
}

function fixtureEgressBinding(pinName, routeKind, hostPinType) {
  return {
    t: 'ui.egress.binding.v1',
    v: {
      from_pin: pinName,
      bus: routeKind,
      host_model_id: 0,
      host_cell: [0, 0, 0],
      host_pin_type: hostPinType,
      host_pin_key: `fixture_${pinName}_bus`,
      target: {
        transport: 'mqtt',
        route_kind: routeKind,
        worker_id: 'R1',
        model_id: 3200,
        pin: pinName,
      },
      reply_pin: 'result',
      owned_by: 'ui-server-installer',
    },
  };
}

async function test_revision4_live_fixture_is_committed_and_declares_both_routes() {
  assert.equal(existsSync(liveFixturePath), true, 'Revision 4 live fixture must be committed under scripts/fixtures/0457');
  const records = JSON.parse(readFileSync(liveFixturePath, 'utf8'));
  assert.equal(Array.isArray(records), true, 'Revision 4 fixture must be a Temporary ModelTable record array');
  assert.equal(fixtureRootLabel(records, 'app_name')?.v, liveFixtureAppName);
  assert.equal(fixtureRootLabel(records, 'model_type')?.t, 'model.table');
  assert.equal(fixtureRootLabel(records, 'source_worker')?.v, 'it0457-revision4-local-acceptance');
  assert.equal(fixtureRootLabel(records, 'revision4_fixture_marker')?.v, liveFixtureMarker);
  const declaredDigest = fixtureRootLabel(records, 'revision4_fixture_digest')?.v;
  const digestInput = records.filter((record) => fixtureRootLabel([record], 'revision4_fixture_digest') === null);
  assert.equal(declaredDigest, createHash('sha256').update(JSON.stringify(digestInput)).digest('hex'));
  assert.deepEqual(fixtureRootLabel(records, 'remote_bus_endpoint_v1')?.v, {
    transport: 'mqtt',
    route_kind: 'control',
    to: { worker_id: 'R1', model_id: 3200 },
  });
  assert.deepEqual(fixtureRootLabel(records, 'dual_bus_model')?.v, {
    mode: 'imported_host_egress',
    egress_pins: ['resource', 'data'],
    egress_routes: [
      { pin_name: 'resource', route_kind: 'control' },
      { pin_name: 'data', route_kind: 'management' },
    ],
    envelope_extension_keys: [
      'is_need_response',
      'message_server',
      'between',
      'send_user',
      'receive_user',
      'custom_trace',
    ],
  });
  assert.equal(fixtureRootLabel(records, 'resource')?.t, 'pin.out');
  assert.equal(fixtureRootLabel(records, 'data')?.t, 'pin.out');
  assert.equal(fixtureRootLabel(records, 'result')?.t, 'pin.in');
  assert.equal(JSON.stringify(records).includes('token'), false, 'committed fixture must not contain credentials');
  assert.equal(JSON.stringify(records).includes('secret'), false, 'committed fixture must not contain secrets');
  return { key: 'revision4_live_fixture_is_committed_and_declares_both_routes', status: 'PASS' };
}

async function test_revision4_full_live_acceptance_uses_owner_paths_and_cleans_up() {
  const {
    REVISION4_LIVE_FIXTURE_APP_NAME,
    buildRevision4LiveScenarioPayload,
    runRevision4LiveAcceptance,
  } = await loadVerifierModule();
  assert.equal(REVISION4_LIVE_FIXTURE_APP_NAME, liveFixtureAppName);
  assert.equal(typeof buildRevision4LiveScenarioPayload, 'function');
  assert.equal(typeof runRevision4LiveAcceptance, 'function');
  const appRef = { table_id: 'app:local-dev:0457-revision-4-local-v2-acceptance:2-0-7:1', model_id: 0 };
  const events = [];
  const controlPayload = buildRevision4LiveScenarioPayload({ kind: 'control', marker: 'unit_full' });
  const managementPayload = buildRevision4LiveScenarioPayload({ kind: 'management', marker: 'unit_full' });
  assert.equal(fixtureRootLabel(controlPayload, 'is_need_response')?.v, true);
  assert.equal(fixtureRootLabel(controlPayload, 'message_server')?.v, 'local');
  assert.equal(fixtureRootLabel(controlPayload, 'between')?.v, 'DEM_V1N');
  assert.equal(fixtureRootLabel(controlPayload, 'send_user'), null);
  assert.equal(fixtureRootLabel(controlPayload, 'receive_user'), null);
  assert.equal(fixtureRootLabel(controlPayload, 'sys_msg_type')?.v, 'resource.report');
  assert.equal(fixtureRootLabel(managementPayload, 'message_server')?.v, 'global');
  assert.equal(fixtureRootLabel(managementPayload, 'between')?.v, 'WSM_DEM');
  assert.equal(fixtureRootLabel(managementPayload, 'send_user')?.v, 'U1');
  assert.equal(fixtureRootLabel(managementPayload, 'receive_user')?.v, 'R1');
  assert.equal(fixtureRootLabel(managementPayload, 'sys_msg_type')?.v, 'data.save_modeltable');

  const timeline = {};
  const result = await runRevision4LiveAcceptance({
    marker: 'unit_full',
    timeline,
    dependencies: {
      now: () => startedAt,
      loadFixture: () => [{ fixture: true }],
      assertLocalOrbStack: async () => events.push('preflight:local'),
      assertActorAttestations: async ({ since }) => {
        assert.equal(since, startedAt);
        events.push('preflight:actors');
        return { mbr: true, r1: true, wm1: true };
      },
      findFixtureApps: async () => {
        events.push('fixture:find');
        return [];
      },
      installFixture: async ({ appName, fixture }) => {
        assert.equal(appName, liveFixtureAppName);
        assert.deepEqual(fixture, [{ fixture: true }]);
        events.push('fixture:install');
        return appRef;
      },
      assertInstalledTopology: async ({ ref }) => {
        assert.deepEqual(ref, appRef);
        events.push('fixture:topology');
      },
      triggerScenario: async ({ ref, scenario, payload }) => {
        assert.deepEqual(ref, appRef);
        assert.deepEqual(payload, buildRevision4LiveScenarioPayload({ kind: scenario.kind, marker: 'unit_full' }));
        events.push(`scenario:${scenario.kind}:owner`);
      },
      waitForMaterializedResponse: async ({ ref, scenario }) => {
        assert.deepEqual(ref, appRef);
        events.push(`scenario:${scenario.kind}:response`);
        return {
          table_id: ref.table_id,
          model_id: ref.model_id,
          status: 'accepted',
          action: scenario.expected_action,
        };
      },
      readPositiveCorrelationEvidence: async ({ since, ref, scenario, marker, response }) => {
        assert.equal(since, startedAt);
        assert.deepEqual(ref, appRef);
        assert.equal(marker, 'unit_full');
        assert.equal(response.status, 'accepted');
        events.push(`scenario:${scenario.kind}:correlation`);
        return positiveEvidence({
          kind: scenario.kind,
          ref,
          marker,
          opId: `imported_${scenario.kind}_op`,
          requestId: `imported_${scenario.kind}_request`,
        });
      },
      runLegacyProbe: async ({ marker, timeline: legacyTimeline }) => {
        assert.equal(marker, 'unit_full_legacy');
        legacyTimeline.acceptance_started_at = startedAt + 10;
        legacyTimeline.published_at = publishedAt;
        events.push('legacy:v1-negative');
        return { ok: true, code: 'verified' };
      },
      assertAcceptanceWindowNetworkBoundary: async ({ since }) => {
        assert.equal(since, startedAt);
        events.push('audit:no-remote');
        return { ok: true };
      },
      readUiServerBoundaryEvidence: async ({ since }) => {
        assert.equal(since, startedAt);
        events.push('audit:ui-server');
        return validUiServerBoundaryEvidence();
      },
      uninstallFixture: async ({ ref }) => {
        assert.deepEqual(ref, appRef);
        events.push('fixture:uninstall');
      },
      assertNoFixtureResidue: async ({ refs, appName }) => {
        assert.deepEqual(refs, [appRef]);
        assert.equal(appName, liveFixtureAppName);
        events.push('fixture:residue-none');
      },
      assertPersistedNoFixtureResidue: async ({ ref }) => {
        assert.deepEqual(ref, appRef);
        events.push('fixture:persisted-none');
      },
    },
  });
  assert.deepEqual(result, {
    ok: true,
    code: 'revision4_live_verified',
    acceptance_started_at: startedAt,
    installed_ref: appRef,
    scenarios: [
      {
        kind: 'control',
        table_id: appRef.table_id,
        model_id: 0,
        status: 'accepted',
        action: 'report',
        op_id: 'imported_control_op',
        request_id: 'imported_control_request',
        reply_target: positiveReplyTarget(appRef),
      },
      {
        kind: 'management',
        table_id: appRef.table_id,
        model_id: 0,
        status: 'accepted',
        action: 'save_modeltable',
        op_id: 'imported_management_op',
        request_id: 'imported_management_request',
        reply_target: positiveReplyTarget(appRef),
      },
    ],
    legacy: {
      result: { ok: true, code: 'verified' },
      acceptance_started_at: startedAt + 10,
      published_at: publishedAt,
    },
    ui_server_boundary: {
      ok: true,
      deployment: 'deployment/ui-server',
      evidence_count: 4,
    },
    cleanup: { ok: true, removed_refs: [appRef] },
  });
  assert.deepEqual(timeline, {
    acceptance_started_at: startedAt,
    legacy_acceptance_started_at: startedAt + 10,
    legacy_published_at: publishedAt,
  });
  assert.deepEqual(events, [
    'preflight:local',
    'preflight:actors',
    'fixture:find',
    'fixture:install',
    'fixture:topology',
    'scenario:control:owner',
    'scenario:control:response',
    'scenario:control:correlation',
    'scenario:management:owner',
    'scenario:management:response',
    'scenario:management:correlation',
    'legacy:v1-negative',
    'audit:no-remote',
    'audit:ui-server',
    'fixture:uninstall',
    'fixture:residue-none',
    'fixture:persisted-none',
  ]);
  return { key: 'revision4_full_live_acceptance_uses_owner_paths_and_cleans_up', status: 'PASS' };
}

async function test_revision4_cleanup_never_hides_primary_failure() {
  const { runRevision4LiveAcceptance } = await loadVerifierModule();
  const primary = new Error('control_roundtrip_failed');
  const cleanup = new Error('owner_uninstall_failed');
  const appRef = { table_id: 'app:local-dev:0457-cleanup:2-0-9:1', model_id: 0 };
  let residueChecks = 0;
  let persistedChecks = 0;
  await assert.rejects(
    runRevision4LiveAcceptance({
      marker: 'cleanup_primary',
      dependencies: {
        now: () => startedAt,
        loadFixture: () => [],
        assertLocalOrbStack: async () => undefined,
        assertActorAttestations: async () => ({}),
        findFixtureApps: async () => [],
        installFixture: async () => appRef,
        assertInstalledTopology: async () => undefined,
        triggerScenario: async () => { throw primary; },
        waitForMaterializedResponse: async () => assert.fail('response wait must not run after trigger failure'),
        runLegacyProbe: async () => assert.fail('legacy probe must not run after positive-flow failure'),
        assertAcceptanceWindowNetworkBoundary: async () => assert.fail('network audit must not run after positive-flow failure'),
        uninstallFixture: async () => { throw cleanup; },
        assertNoFixtureResidue: async () => { residueChecks += 1; },
        assertPersistedNoFixtureResidue: async () => { persistedChecks += 1; },
      },
    }),
    (error) => {
      assert.equal(error, primary, 'cleanup failure must not replace the primary acceptance failure');
      assert.deepEqual(error.cleanup_errors?.map((item) => item.message), ['owner_uninstall_failed']);
      return true;
    },
  );
  assert.equal(residueChecks, 1, 'residue verification must still be attempted after uninstall failure');
  assert.equal(persistedChecks, 1, 'persisted verification must still be attempted after uninstall failure');
  return { key: 'revision4_cleanup_never_hides_primary_failure', status: 'PASS' };
}

async function test_revision4_default_http_client_uses_import_owner_and_uninstall_endpoints() {
  const {
    buildRevision4LiveScenarioPayload,
    createRevision4LiveHttpClient,
    loadRevision4LiveFixture,
  } = await loadVerifierModule();
  const fixture = loadRevision4LiveFixture();
  const appRef = { table_id: 'app:local-dev:0457-revision-4-local-v2-acceptance:2-0-4:1', model_id: 0 };
  const calls = [];
  let installed = false;
  let responseAction = '';
  const response = (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data),
  });
  const fullSnapshot = () => ({
    models: {
      '-2': {
        cells: {
          '0,0,0': {
            labels: {
              ws_apps_registry: {
                t: 'json',
                v: installed ? [{ name: liveFixtureAppName, ...appRef }] : [],
              },
            },
          },
        },
      },
      '0': { cells: { '0,0,0': { labels: {} } } },
    },
    ...(installed ? {
      tables: {
        [appRef.table_id]: {
          table_id: appRef.table_id,
          models: {
            '0': {
              table_id: appRef.table_id,
              id: 0,
              cells: {
                '0,0,0': {
                  labels: {
                    app_name: fixtureRootLabel(fixture, 'app_name'),
                    source_worker: fixtureRootLabel(fixture, 'source_worker'),
                    revision4_fixture_marker: fixtureRootLabel(fixture, 'revision4_fixture_marker'),
                    revision4_fixture_digest: fixtureRootLabel(fixture, 'revision4_fixture_digest'),
                    remote_bus_endpoint_v1: {
                      ...fixtureRootLabel(fixture, 'remote_bus_endpoint_v1'),
                      v: {
                        transport: 'mqtt',
                        to: { worker_id: 'R1', model_id: 3200 },
                        route_kind: 'control',
                      },
                    },
                    dual_bus_model: fixtureRootLabel(fixture, 'dual_bus_model'),
                    resource: fixtureRootLabel(fixture, 'resource'),
                    data: fixtureRootLabel(fixture, 'data'),
                    result: fixtureRootLabel(fixture, 'result'),
                    ui_egress_resource_binding: fixtureEgressBinding('resource', 'control', 'pin.bus.cb.out'),
                    ui_egress_data_binding: fixtureEgressBinding('data', 'management', 'pin.bus.mb.out'),
                    ...(responseAction ? {
                      status: { t: 'str', v: 'accepted' },
                      action: { t: 'str', v: responseAction },
                      handler_result: { t: 'json', v: { status: 'accepted', action: responseAction } },
                    } : {}),
                  },
                },
              },
            },
          },
        },
      },
    } : {}),
  });
  const fetchImpl = async (urlValue, options = {}) => {
    const url = new URL(urlValue);
    const method = options.method || 'GET';
    const body = options.body && typeof options.body === 'string' ? JSON.parse(options.body) : null;
    calls.push({ method, pathname: url.pathname, search: url.search, body });
    if (method === 'GET' && url.pathname === '/snapshot') {
      assert.equal(url.searchParams.get('profile'), 'full');
      return response({ snapshot: fullSnapshot() });
    }
    if (method === 'POST' && url.pathname === '/api/runtime/mode') {
      assert.deepEqual(body, { mode: 'running' });
      return response({ ok: true, mode: 'running' });
    }
    if (method === 'POST' && url.pathname === '/api/media/upload') {
      assert.equal(url.searchParams.get('purpose'), 'slide-import');
      assert.match(url.searchParams.get('filename') || '', /^0457-revision4-unit_http\.zip$/u);
      assert.equal(Buffer.isBuffer(options.body) || options.body instanceof Uint8Array, true);
      return response({ ok: true, uri: 'mxc://localhost/revision4-unit-http' });
    }
    if (method === 'POST' && url.pathname === '/bus_event') {
      if (body?.type === 'bus_event_v2' && body.bus_in_key === 'slide_import_media_uri_update') {
        assert.equal(fixtureRootLabel(body.value, 'slide_import_media_uri')?.v, 'mxc://localhost/revision4-unit-http');
        return response({ ok: true, result: 'ok', routed_by: 'model0_busin' });
      }
      if (body?.type === 'bus_event_v2' && body.bus_in_key === 'slide_import_click') {
        installed = true;
        return response({ ok: true, result: 'ok', routed_by: 'model0_busin' });
      }
      if (body?.type === 'ui_owner_label_update') {
        assert.deepEqual(
          { table_id: body.payload?.target?.table_id, model_id: body.payload?.target?.model_id },
          appRef,
        );
        assert.equal(body.payload?.value?.t, 'pin.out');
        responseAction = body.payload.target.k === 'resource' ? 'report' : 'save_modeltable';
        return response({ ok: true, result: 'ok', routed_by: 'owner_materialization' });
      }
      if (body?.type === 'click' && body.payload?.target?.model_id === -25) {
        assert.equal(fixtureRootLabel(body.payload.value, '__mt_payload_kind')?.v, 'ws_delete_app.v1');
        assert.equal(fixtureRootLabel(body.payload.value, 'table_id')?.v, appRef.table_id);
        installed = false;
        responseAction = '';
        return response({ ok: true, result: 'ok', routed_by: 'direct_pin' });
      }
    }
    return response({ ok: false, error: 'unexpected_request' }, 500);
  };
  let pollClock = 0;
  const client = createRevision4LiveHttpClient({
    fetchImpl,
    pollTimeoutMs: 10,
    pollIntervalMs: 1,
    monotonicNow: () => pollClock,
    delay: async (timeoutMs) => { pollClock += timeoutMs; },
  });
  assert.deepEqual(await client.findFixtureApps(), []);
  const installedRef = await client.installFixture({ fixture, appName: liveFixtureAppName, marker: 'unit_http' });
  assert.deepEqual(installedRef, appRef);
  assert.deepEqual(await client.findFixtureApps({ fixture }), [appRef]);
  assert.deepEqual(await client.assertInstalledTopology({ ref: appRef }), { ok: true });
  for (const scenario of [
    { kind: 'control', pin: 'resource', expected_action: 'report' },
    { kind: 'management', pin: 'data', expected_action: 'save_modeltable' },
  ]) {
    const payload = buildRevision4LiveScenarioPayload({ kind: scenario.kind, marker: 'unit_http' });
    await client.triggerScenario({ ref: appRef, scenario, payload, marker: 'unit_http' });
    assert.deepEqual(await client.waitForMaterializedResponse({ ref: appRef, scenario }), {
      table_id: appRef.table_id,
      model_id: 0,
      status: 'accepted',
      action: scenario.expected_action,
    });
  }
  await client.uninstallFixture({ ref: appRef, marker: 'unit_http' });
  assert.deepEqual(await client.assertNoFixtureResidue({ refs: [appRef], appName: liveFixtureAppName }), { ok: true });
  assert.equal(calls.some((call) => call.pathname === '/api/media/upload' && call.search.includes('purpose=slide-import')), true);
  assert.equal(calls.filter((call) => call.pathname === '/bus_event' && call.body?.type === 'ui_owner_label_update').length, 2);
  assert.equal(calls.filter((call) => call.pathname === '/bus_event' && call.body?.payload?.target?.model_id === -25).length, 1);
  return { key: 'revision4_default_http_client_uses_import_owner_and_uninstall_endpoints', status: 'PASS' };
}

async function test_revision4_same_name_nonfixture_is_preserved_and_fails_closed() {
  const {
    createRevision4LiveHttpClient,
    loadRevision4LiveFixture,
    runRevision4LiveAcceptance,
  } = await loadVerifierModule();
  const fixture = loadRevision4LiveFixture();
  const nonfixtureRef = { table_id: 'app:local-dev:user-owned-same-name:9', model_id: 0 };
  const wrongTopologyDataBinding = fixtureEgressBinding('data', 'management', 'pin.bus.mb.out');
  wrongTopologyDataBinding.v.target.model_id = 3199;
  const snapshot = {
    models: {
      '-2': {
        cells: {
          '0,0,0': {
            labels: {
              ws_apps_registry: { t: 'json', v: [{ name: liveFixtureAppName, ...nonfixtureRef }] },
            },
          },
        },
      },
    },
    tables: {
      [nonfixtureRef.table_id]: {
        models: {
          '0': {
            cells: {
              '0,0,0': {
                labels: {
                  app_name: fixtureRootLabel(fixture, 'app_name'),
                  source_worker: fixtureRootLabel(fixture, 'source_worker'),
                  revision4_fixture_marker: fixtureRootLabel(fixture, 'revision4_fixture_marker'),
                  revision4_fixture_digest: fixtureRootLabel(fixture, 'revision4_fixture_digest'),
                  remote_bus_endpoint_v1: fixtureRootLabel(fixture, 'remote_bus_endpoint_v1'),
                  dual_bus_model: fixtureRootLabel(fixture, 'dual_bus_model'),
                  resource: fixtureRootLabel(fixture, 'resource'),
                  data: fixtureRootLabel(fixture, 'data'),
                  result: fixtureRootLabel(fixture, 'result'),
                  ui_egress_resource_binding: fixtureEgressBinding('resource', 'control', 'pin.bus.cb.out'),
                  ui_egress_data_binding: wrongTopologyDataBinding,
                },
              },
            },
          },
        },
      },
    },
  };
  const calls = [];
  const client = createRevision4LiveHttpClient({
    fetchImpl: async (urlValue, options = {}) => {
      const url = new URL(urlValue);
      calls.push({ pathname: url.pathname, method: options.method || 'GET' });
      assert.equal(url.pathname, '/snapshot', 'conflict discovery must stay read-only');
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ snapshot }),
      };
    },
    delay: async () => undefined,
  });
  let uninstallCalls = 0;
  await assert.rejects(
    runRevision4LiveAcceptance({
      marker: 'same_name_conflict',
      dependencies: {
        now: () => startedAt,
        loadFixture: () => fixture,
        assertLocalOrbStack: async () => undefined,
        assertActorAttestations: async () => ({}),
        findFixtureApps: client.findFixtureApps,
        installFixture: async () => assert.fail('same-name conflict must stop before import'),
        uninstallFixture: async () => { uninstallCalls += 1; },
      },
    }),
    /revision4_same_name_nonfixture_conflict/u,
  );
  assert.equal(uninstallCalls, 0, 'same-name nonfixture must never be passed to uninstall');
  assert.deepEqual(calls, [{ pathname: '/snapshot', method: 'GET' }]);
  return { key: 'revision4_same_name_nonfixture_is_preserved_and_fails_closed', status: 'PASS' };
}

async function test_revision4_import_and_uninstall_require_exact_routing_owners() {
  const { createRevision4LiveHttpClient, loadRevision4LiveFixture } = await loadVerifierModule();
  const fixture = loadRevision4LiveFixture();
  const appRef = { table_id: 'app:local-dev:revision4-route-owner:1', model_id: 0 };
  const response = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify(data) });
  const strictSnapshot = {
    models: {
      '-2': {
        cells: {
          '0,0,0': {
            labels: { ws_apps_registry: { t: 'json', v: [{ name: liveFixtureAppName, ...appRef }] } },
          },
        },
      },
    },
    tables: {
      [appRef.table_id]: {
        models: {
          '0': {
            cells: {
              '0,0,0': {
                labels: {
                  app_name: fixtureRootLabel(fixture, 'app_name'),
                  source_worker: fixtureRootLabel(fixture, 'source_worker'),
                  revision4_fixture_marker: fixtureRootLabel(fixture, 'revision4_fixture_marker'),
                  revision4_fixture_digest: fixtureRootLabel(fixture, 'revision4_fixture_digest'),
                  remote_bus_endpoint_v1: fixtureRootLabel(fixture, 'remote_bus_endpoint_v1'),
                  dual_bus_model: fixtureRootLabel(fixture, 'dual_bus_model'),
                  resource: fixtureRootLabel(fixture, 'resource'),
                  data: fixtureRootLabel(fixture, 'data'),
                  result: fixtureRootLabel(fixture, 'result'),
                  ui_egress_resource_binding: fixtureEgressBinding('resource', 'control', 'pin.bus.cb.out'),
                  ui_egress_data_binding: fixtureEgressBinding('data', 'management', 'pin.bus.mb.out'),
                },
              },
            },
          },
        },
      },
    },
  };
  const importClient = (badStage) => createRevision4LiveHttpClient({
    fetchImpl: async (urlValue, options = {}) => {
      const url = new URL(urlValue);
      const method = options.method || 'GET';
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : null;
      if (method === 'GET' && url.pathname === '/snapshot') {
        return response({ snapshot: { models: { '-2': { cells: { '0,0,0': { labels: { ws_apps_registry: { v: [] } } } } } } } });
      }
      if (url.pathname === '/api/runtime/mode') return response({ ok: true, mode: 'running' });
      if (url.pathname === '/api/media/upload') return response({ ok: true, uri: 'mxc://localhost/route-owner' });
      if (url.pathname === '/bus_event' && body?.bus_in_key === 'slide_import_media_uri_update') {
        return response({ ok: true, result: 'ok', routed_by: badStage === 'media' ? 'pin' : 'model0_busin' });
      }
      if (url.pathname === '/bus_event' && body?.bus_in_key === 'slide_import_click') {
        return response({ ok: true, result: 'ok', routed_by: badStage === 'click' ? 'owner_materialization' : 'model0_busin' });
      }
      assert.fail(`unexpected import route request: ${method} ${url.pathname}`);
    },
    delay: async () => undefined,
  });
  await assert.rejects(
    importClient('media').installFixture({ fixture, marker: 'bad_media_route' }),
    /revision4_import_media_model0_route_required/u,
  );
  await assert.rejects(
    importClient('click').installFixture({ fixture, marker: 'bad_click_route' }),
    /revision4_import_click_model0_route_required/u,
  );

  const uninstallClient = createRevision4LiveHttpClient({
    fetchImpl: async (urlValue, options = {}) => {
      const url = new URL(urlValue);
      if ((options.method || 'GET') === 'GET' && url.pathname === '/snapshot') {
        return response({ snapshot: strictSnapshot });
      }
      if (url.pathname === '/bus_event') {
        return response({ ok: true, result: 'ok', routed_by: 'owner_materialization' });
      }
      assert.fail(`unexpected uninstall route request: ${url.pathname}`);
    },
    delay: async () => undefined,
  });
  await assert.rejects(
    uninstallClient.uninstallFixture({ ref: appRef, marker: 'bad_uninstall_route', fixture }),
    /revision4_uninstall_pin_route_required/u,
  );
  return { key: 'revision4_import_and_uninstall_require_exact_routing_owners', status: 'PASS' };
}

async function test_revision4_default_operational_dependencies_read_attestations_and_persistence_only() {
  const { createDefaultRevision4LiveAcceptanceDependencies } = await loadVerifierModule();
  const calls = [];
  const attestations = {
    'deployment/mbr-worker': {
      worker_id: '5/10/28/35/14',
      worker_role: 'DEM',
      worker_alias: null,
      topic_base: 'UIPUT/ws/dam/pic/de',
      root_form: { key: 'model_type', type: 'model.v1n', value: '' },
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
    'deployment/remote-worker': {
      worker_id: '5/10/28/35/15',
      worker_role: 'V1N',
      worker_alias: 'R1',
      topic_base: 'UIPUT/ws/dam/pic/de',
      root_form: { key: 'model_type', type: 'model.v1n', value: '' },
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
    'deployment/workspace-manager': {
      worker_id: '5/10/28/36/16',
      worker_role: 'DEM',
      worker_alias: 'WM1',
      topic_base: 'UIPUT/ws/dam/pic/de',
      root_form: { key: 'model_type', type: 'model.v1n', value: '' },
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
  };
  const execFile = async (command, args, options) => {
    calls.push({ command, args, options });
    if (command === 'kubectl') {
      const attestation = attestations[args[3]];
      assert.ok(attestation, `unexpected attestation deployment: ${args[3]}`);
      return { stdout: `${actorAttestationMarker} ${JSON.stringify(attestation)}\n` };
    }
    if (command === 'bun') {
      assert.deepEqual(args.slice(0, 1), ['--eval']);
      assert.match(args[1], /select count\(\*\) as count from mt_data where table_id = \?/u);
      assert.equal(args[1].includes('app:unit:persisted:1'), true, 'table id must be passed only inside the direct Bun program');
      return { stdout: JSON.stringify({ checked: 2, residues: [] }) };
    }
    assert.fail(`unexpected operational command: ${command}`);
  };
  const noOp = async () => undefined;
  const dependencies = createDefaultRevision4LiveAcceptanceDependencies({
    execFile,
    persistRoot: '/tmp/revision4-persist-fixture',
    httpClient: {
      findFixtureApps: noOp,
      installFixture: noOp,
      assertInstalledTopology: noOp,
      triggerScenario: noOp,
      waitForMaterializedResponse: noOp,
      uninstallFixture: noOp,
      assertNoFixtureResidue: noOp,
    },
    legacyDependencies: {
      assertLocalOrbStack: noOp,
      assertAcceptanceWindowNetworkBoundary: noOp,
    },
  });
  const actorEvidence = await dependencies.assertActorAttestations({ since: startedAt });
  assert.deepEqual(Object.keys(actorEvidence), ['mbr', 'r1', 'wm1']);
  assert.equal(actorEvidence.r1.mounted_models.includes(3200), true);
  assert.deepEqual(
    await dependencies.assertPersistedNoFixtureResidue({
      ref: { table_id: 'app:unit:persisted:1', model_id: 0 },
    }),
    { ok: true, checked_databases: 2 },
  );
  assert.deepEqual(
    calls.filter((call) => call.command === 'kubectl').map((call) => call.args),
    [
      ['-n', 'dongyu', 'logs', 'deployment/mbr-worker', '--since-time', new Date(startedAt).toISOString()],
      ['-n', 'dongyu', 'logs', 'deployment/remote-worker', '--since-time', new Date(startedAt).toISOString()],
      ['-n', 'dongyu', 'logs', 'deployment/workspace-manager', '--since-time', new Date(startedAt).toISOString()],
    ],
  );
  assert.equal(calls.filter((call) => call.command === 'bun').length, 1);

  let monotonicTime = 0;
  const heartbeatReads = new Map();
  const heartbeatDependencies = createDefaultRevision4LiveAcceptanceDependencies({
    execFile: async (command, args) => {
      assert.equal(command, 'kubectl');
      const deployment = args[3];
      const reads = (heartbeatReads.get(deployment) || 0) + 1;
      heartbeatReads.set(deployment, reads);
      return {
        stdout: reads === 1 ? '' : `${actorAttestationMarker} ${JSON.stringify(attestations[deployment])}\n`,
      };
    },
    monotonicNow: () => monotonicTime,
    delay: async (timeoutMs) => { monotonicTime += timeoutMs; },
    positiveEvidencePollTimeoutMs: 1000,
    positiveEvidencePollIntervalMs: 25,
    httpClient: {
      findFixtureApps: noOp,
      installFixture: noOp,
      assertInstalledTopology: noOp,
      triggerScenario: noOp,
      waitForMaterializedResponse: noOp,
      uninstallFixture: noOp,
      assertNoFixtureResidue: noOp,
    },
    legacyDependencies: {
      assertLocalOrbStack: noOp,
      assertAcceptanceWindowNetworkBoundary: noOp,
    },
  });
  const heartbeatEvidence = await heartbeatDependencies.assertActorAttestations({ since: startedAt });
  assert.deepEqual(Object.keys(heartbeatEvidence), ['mbr', 'r1', 'wm1']);
  assert.deepEqual([...heartbeatReads.values()], [2, 2, 2]);
  assert.equal(monotonicTime, 25, 'fresh attestation reader must poll until the first post-start heartbeat');

  const assertActorAttestationRejected = async (targetDeployment, buildLog, expected) => {
    const strictDependencies = createDefaultRevision4LiveAcceptanceDependencies({
      execFile: async (command, args) => {
        assert.equal(command, 'kubectl');
        const deployment = args[3];
        const attestation = attestations[deployment];
        assert.ok(attestation, `unexpected strict attestation deployment: ${deployment}`);
        return {
          stdout: deployment === targetDeployment
            ? buildLog(structuredClone(attestation))
            : `${actorAttestationMarker} ${JSON.stringify(attestation)}\n`,
        };
      },
      positiveEvidencePollTimeoutMs: 100,
      positiveEvidencePollIntervalMs: 1,
      httpClient: {
        findFixtureApps: noOp,
        installFixture: noOp,
        assertInstalledTopology: noOp,
        triggerScenario: noOp,
        waitForMaterializedResponse: noOp,
        uninstallFixture: noOp,
        assertNoFixtureResidue: noOp,
      },
      legacyDependencies: {
        assertLocalOrbStack: noOp,
        assertAcceptanceWindowNetworkBoundary: noOp,
      },
    });
    await assert.rejects(
      strictDependencies.assertActorAttestations({ since: startedAt }),
      expected,
    );
  };
  const markerLine = (attestation) => `${actorAttestationMarker} ${JSON.stringify(attestation)}\n`;
  for (const [name, mutate] of [
    ['extra_management_pin', (attestation) => attestation.bus_pins.push({ key: 'r1_mb_in', type: 'pin.bus.mb.in' })],
    ['wrong_control_pin_key', (attestation) => { attestation.bus_pins[0].key = 'wrong_cb_in'; }],
    ['extra_mount', (attestation) => attestation.mounted_models.push(9999)],
    ['extra_source', (attestation) => attestation.source_files.push('env:MODELTABLE_PATCH_JSON')],
  ]) {
    await assertActorAttestationRejected('deployment/remote-worker', (attestation) => {
      mutate(attestation);
      return markerLine(attestation);
    }, new RegExp(`revision4_actor_attestation_mismatch:r1`, 'u'), name);
  }
  await assertActorAttestationRejected(
    'deployment/mbr-worker',
    (attestation) => {
      attestation.source_files.pop();
      return markerLine(attestation);
    },
    /revision4_actor_attestation_mismatch:mbr/u,
  );
  await assertActorAttestationRejected(
    'deployment/mbr-worker',
    (attestation) => {
      attestation.source_files.push('env:UNTRUSTED_BOOTSTRAP');
      return markerLine(attestation);
    },
    /revision4_actor_attestation_mismatch:mbr/u,
  );
  await assertActorAttestationRejected(
    'deployment/workspace-manager',
    (attestation) => {
      attestation.source_files.push('env:MODELTABLE_PATCH_JSON');
      return markerLine(attestation);
    },
    /revision4_actor_attestation_mismatch:wm1/u,
  );
  await assertActorAttestationRejected(
    'deployment/remote-worker',
    (attestation) => `${actorAttestationMarker} {malformed\n${markerLine(attestation)}`,
    /revision4_actor_attestation_invalid:r1/u,
  );
  return { key: 'revision4_default_operational_dependencies_read_attestations_and_persistence_only', status: 'PASS' };
}

async function test_revision4_persisted_residue_scan_distinguishes_ownership_from_evidence() {
  const { createDefaultRevision4LiveAcceptanceDependencies } = await loadVerifierModule();
  const persistRoot = mkdtempSync(join(tmpdir(), 'revision4-persisted-residue-'));
  const tableId = 'app:unit:revision4-cleanup:1';
  const legacyPath = join(persistRoot, '00-legacy.db');
  const modernPath = join(persistRoot, '10-modern.db');
  const registryPath = join(persistRoot, '20-registry.db');
  const modernMountPath = join(persistRoot, '30-modern-mount.db');
  const legacyMountPath = join(persistRoot, '40-legacy-mount.db');
  const malformedPath = join(persistRoot, '50-malformed.db');
  const structuralMalformedPath = join(persistRoot, '55-structural-malformed.db');
  const ownedPath = join(persistRoot, '60-owned.db');
  const noOp = async () => undefined;
  const dependencies = createDefaultRevision4LiveAcceptanceDependencies({
    persistRoot,
    httpClient: {
      findFixtureApps: noOp,
      installFixture: noOp,
      assertInstalledTopology: noOp,
      triggerScenario: noOp,
      waitForMaterializedResponse: noOp,
      uninstallFixture: noOp,
      assertNoFixtureResidue: noOp,
    },
    legacyDependencies: {
      assertLocalOrbStack: noOp,
      assertAcceptanceWindowNetworkBoundary: noOp,
    },
  });

  try {
    createPersistenceFixtureDb(legacyPath, {
      tableQualified: false,
      rows: [
        [-100, 0, 0, 0, 'trace_event', 'json', JSON.stringify({ reply_target: { table_id: tableId } }), null, null, null],
        [0, 2, 0, 20, 'model_type', 'model.subtableconnection', JSON.stringify(378779425816183014), null, null, null],
      ],
    });
    createPersistenceFixtureDb(modernPath, {
      tableQualified: true,
      rows: [
        ['host', -100, 0, 0, 0, 'trace_log_text', 'str', `historical ${tableId}`, null, null, null],
        ['host', -25, 2, 7, 1, 'click', 'pin.in', JSON.stringify({ table_id: tableId }), null, null, null],
      ],
    });
    assert.deepEqual(
      await dependencies.assertPersistedNoFixtureResidue({ ref: { table_id: tableId, model_id: 0 } }),
      { ok: true, checked_databases: 2 },
      'legacy schemas and historical trace/transient PIN evidence must not be mistaken for installed app ownership',
    );

    createPersistenceFixtureDb(registryPath, {
      tableQualified: true,
      rows: [[
        'host', -2, 0, 0, 0, 'ws_apps_registry', 'json', JSON.stringify([{ table_id: tableId, model_id: 0 }]), null, null, null,
      ]],
    });
    await assert.rejects(
      dependencies.assertPersistedNoFixtureResidue({ ref: { table_id: tableId, model_id: 0 } }),
      /revision4_persisted_fixture_residue/u,
      'persisted workspace ownership references must remain fail-closed',
    );
    rmSync(registryPath, { force: true });

    createPersistenceFixtureDb(modernMountPath, {
      tableQualified: true,
      rows: [[
        'host', 0, 2, 0, 20, 'model_type', 'model.subtableconnection', JSON.stringify({
          table_id: tableId,
          root_model_id: 0,
          mount_kind: 'slide_app',
        }), null, null, null,
      ]],
    });
    await assert.rejects(
      dependencies.assertPersistedNoFixtureResidue({ ref: { table_id: tableId, model_id: 0 } }),
      /revision4_persisted_fixture_residue/u,
      'a modern host subtable mount must remain fail-closed',
    );
    rmSync(modernMountPath, { force: true });

    createPersistenceFixtureDb(legacyMountPath, {
      tableQualified: false,
      rows: [[
        0, 2, 0, 20, 'model_type', 'model.subtableconnection', JSON.stringify({
          table_id: tableId,
          root_model_id: 0,
          mount_kind: 'slide_app',
        }), null, null, null,
      ]],
    });
    await assert.rejects(
      dependencies.assertPersistedNoFixtureResidue({ ref: { table_id: tableId, model_id: 0 } }),
      /revision4_persisted_fixture_residue/u,
      'an implicit-host legacy subtable mount must remain fail-closed',
    );
    rmSync(legacyMountPath, { force: true });

    createPersistenceFixtureDb(malformedPath, {
      tableQualified: true,
      rows: [[
        'host', -2, 0, 0, 0, 'ws_apps_registry', 'json', '[{"table_id":', null, null, null,
      ]],
    });
    await assert.rejects(
      dependencies.assertPersistedNoFixtureResidue({ ref: { table_id: tableId, model_id: 0 } }),
      /revision4_persisted_fixture_residue/u,
      'malformed ownership JSON must fail closed',
    );
    rmSync(malformedPath, { force: true });

    const malformedOwnershipRows = [
      {
        name: 'registry_wrong_type',
        row: ['host', -2, 0, 0, 0, 'ws_apps_registry', 'str', '[]', null, null, null],
      },
      {
        name: 'numeric_mount_zero',
        row: ['host', 0, 2, 0, 20, 'model_type', 'model.subtableconnection', JSON.stringify(0), null, null, null],
      },
      {
        name: 'descriptor_missing_fields',
        row: ['host', 0, 2, 0, 20, 'model_type', 'model.subtableconnection', JSON.stringify({ table_id: 'app:other' }), null, null, null],
      },
      {
        name: 'descriptor_unknown_field',
        row: ['host', 0, 2, 0, 20, 'model_type', 'model.subtableconnection', JSON.stringify({
          table_id: 'app:other', root_model_id: 0, mount_kind: 'slide_app', extra: true,
        }), null, null, null],
      },
      {
        name: 'descriptor_invalid_root',
        row: ['host', 0, 2, 0, 20, 'model_type', 'model.subtableconnection', JSON.stringify({
          table_id: 'app:other', root_model_id: -1, mount_kind: 'slide_app',
        }), null, null, null],
      },
      {
        name: 'descriptor_blank_mount_kind',
        row: ['host', 0, 2, 0, 20, 'model_type', 'model.subtableconnection', JSON.stringify({
          table_id: 'app:other', root_model_id: 0, mount_kind: ' ',
        }), null, null, null],
      },
      {
        name: 'descriptor_invalid_owner',
        row: ['host', 0, 2, 0, 20, 'model_type', 'model.subtableconnection', JSON.stringify({
          table_id: 'app:other', root_model_id: 0, mount_kind: 'slide_app', owner_principal_id: 42,
        }), null, null, null],
      },
      {
        name: 'descriptor_host_table',
        row: ['host', 0, 2, 0, 20, 'model_type', 'model.subtableconnection', JSON.stringify({
          table_id: 'host', root_model_id: 0, mount_kind: 'slide_app',
        }), null, null, null],
      },
    ];
    for (const testCase of malformedOwnershipRows) {
      createPersistenceFixtureDb(structuralMalformedPath, {
        tableQualified: true,
        rows: [testCase.row],
      });
      await assert.rejects(
        dependencies.assertPersistedNoFixtureResidue({ ref: { table_id: tableId, model_id: 0 } }),
        /revision4_persisted_fixture_residue/u,
        `${testCase.name} must fail closed`,
      );
      rmSync(structuralMalformedPath, { force: true });
    }

    createPersistenceFixtureDb(ownedPath, {
      tableQualified: true,
      rows: [[
        tableId, 0, 0, 0, 0, 'model_type', 'model.v1n', '""', null, null, null,
      ]],
    });
    await assert.rejects(
      dependencies.assertPersistedNoFixtureResidue({ ref: { table_id: tableId, model_id: 0 } }),
      /revision4_persisted_fixture_residue/u,
      'any row owned by the imported app table must remain fail-closed',
    );
  } finally {
    rmSync(persistRoot, { recursive: true, force: true });
  }

  return { key: 'revision4_persisted_residue_scan_distinguishes_ownership_from_evidence', status: 'PASS' };
}

async function test_revision4_positive_flow_rejects_stale_wrong_ids_reply_targets_and_reuse() {
  const { evaluateRevision4PositiveCorrelationEvidence } = await loadVerifierModule();
  const ref = { table_id: 'app:local-dev:revision4-positive-evidence:1', model_id: 0 };
  const scenario = { kind: 'management', pin: 'data', expected_action: 'save_modeltable' };
  const valid = positiveEvidence({
    kind: 'management',
    ref,
    opId: 'positive_management_op',
    requestId: 'positive_management_request',
  });
  assert.deepEqual(
    evaluateRevision4PositiveCorrelationEvidence(valid, { since: startedAt, ref, scenario }),
    {
      op_id: 'positive_management_op',
      request_id: 'positive_management_request',
      reply_target: positiveReplyTarget(ref),
    },
  );

  const wrongOpId = structuredClone(valid);
  wrongOpId.entries.find((entry) => entry.stage === 'model_dispatch').op_id = 'different_op';
  assert.throws(
    () => evaluateRevision4PositiveCorrelationEvidence(wrongOpId, { since: startedAt, ref, scenario }),
    /revision4_positive_pin_flow_stage_missing/u,
    'a required actor point with the wrong op_id must not satisfy the exact correlation',
  );

  const stale = structuredClone(valid);
  stale.entries.find((entry) => entry.stage === 'model_dispatch').ts = startedAt - 1;
  assert.throws(
    () => evaluateRevision4PositiveCorrelationEvidence(stale, { since: startedAt, ref, scenario }),
    /revision4_positive_stale_pin_flow_evidence/u,
    'stale Model3200 dispatch evidence must fail even when newer status/action labels exist',
  );

  const outOfOrder = structuredClone(valid);
  outOfOrder.entries.find((entry) => entry.stage === 'model_dispatch').ts = startedAt + 1;
  assert.throws(
    () => evaluateRevision4PositiveCorrelationEvidence(outOfOrder, { since: startedAt, ref, scenario }),
    /revision4_positive_pin_flow_stage_order_mismatch/u,
    'correlated markers must still appear in the actual request/response order',
  );

  const wrongReplyTarget = structuredClone(valid);
  wrongReplyTarget.entries.find((entry) => entry.stage === 'validated_response_materialized').reply_target = {
    table_id: ref.table_id,
    model_id: ref.model_id,
    pin: 'wrong_result',
  };
  assert.throws(
    () => evaluateRevision4PositiveCorrelationEvidence(wrongReplyTarget, { since: startedAt, ref, scenario }),
    /revision4_positive_pin_flow_reply_target_mismatch/u,
    'a response materialized to the wrong pin must fail table-qualified verification',
  );

  const wrongLogicalBus = structuredClone(valid);
  wrongLogicalBus.entries.find((entry) => entry.producer === 'r1' && entry.stage === 'model_dispatch').bus = 'control';
  assert.throws(
    () => evaluateRevision4PositiveCorrelationEvidence(wrongLogicalBus, { since: startedAt, ref, scenario }),
    /revision4_positive_evidence_route_mismatch/u,
    'management route evidence must remain logically management while traversing the MQTT control transport',
  );

  const duplicateMaterialization = structuredClone(valid);
  duplicateMaterialization.entries.push(structuredClone(
    duplicateMaterialization.entries.find((entry) => entry.producer === 'ui-server' && entry.stage === 'validated_response_materialized'),
  ));
  assert.throws(
    () => evaluateRevision4PositiveCorrelationEvidence(duplicateMaterialization, { since: startedAt, ref, scenario }),
    /revision4_positive_stage_cardinality_invalid/u,
    'one remote response must materialize exactly once and duplicate MBR echoes must fail the live gate',
  );

  const wrongMbrControlForwardBus = structuredClone(valid);
  wrongMbrControlForwardBus.entries.find((entry) => (
    entry.producer === 'mbr' && entry.stage === 'control_forward'
  )).bus = 'control';
  assert.throws(
    () => evaluateRevision4PositiveCorrelationEvidence(wrongMbrControlForwardBus, { since: startedAt, ref, scenario }),
    /revision4_positive_evidence_route_mismatch/u,
    'every correlated MBR forwarding point must retain the scenario logical bus',
  );

  const wrongManagementResponseForwardRouteKind = structuredClone(valid);
  wrongManagementResponseForwardRouteKind.entries.find((entry) => (
    entry.producer === 'mbr' && entry.stage === 'management_response_forward'
  )).route_kind = 'control';
  assert.throws(
    () => evaluateRevision4PositiveCorrelationEvidence(
      wrongManagementResponseForwardRouteKind,
      { since: startedAt, ref, scenario },
    ),
    /revision4_positive_evidence_route_mismatch/u,
    'every correlated MBR response point must retain the scenario route kind',
  );

  const seenOpIds = new Set();
  const seenRequestIds = new Set();
  evaluateRevision4PositiveCorrelationEvidence(valid, {
    since: startedAt,
    ref,
    scenario,
    seenOpIds,
    seenRequestIds,
  });
  const reused = positiveEvidence({
    kind: 'control',
    ref,
    opId: 'positive_management_op',
    requestId: 'fresh_control_request',
  });
  assert.throws(
    () => evaluateRevision4PositiveCorrelationEvidence(reused, {
      since: startedAt,
      ref,
      scenario: { kind: 'control', pin: 'resource', expected_action: 'report' },
      seenOpIds,
      seenRequestIds,
    }),
    /revision4_positive_op_id_reused/u,
    'control and management requests must never reuse an op_id',
  );
  return { key: 'revision4_positive_flow_rejects_stale_wrong_ids_reply_targets_and_reuse', status: 'PASS' };
}

async function test_revision4_default_positive_reader_uses_fresh_shared_pin_flow_logs() {
  const { createDefaultRevision4LiveAcceptanceDependencies } = await loadVerifierModule();
  const { formatDePinFlowEvidenceLine } = await loadPinFlowEvidenceModule();
  const ref = { table_id: 'app:local-dev:revision4-default-reader:1', model_id: 0 };
  const scenario = { kind: 'control', pin: 'resource', expected_action: 'report' };
  const expected = positiveEvidence({
    kind: 'control',
    ref,
    opId: 'default_reader_control_op',
    requestId: 'default_reader_control_request',
  });
  const logByDeployment = new Map([
    ['deployment/ui-server', expected.entries.filter((entry) => entry.producer === 'ui-server')],
    ['deployment/mbr-worker', expected.entries.filter((entry) => entry.producer === 'mbr')],
    ['deployment/remote-worker', expected.entries.filter((entry) => entry.producer === 'r1')],
  ]);
  const calls = [];
  const noOp = async () => undefined;
  const dependencies = createDefaultRevision4LiveAcceptanceDependencies({
    execFile: async (command, args, options) => {
      calls.push([command, args, options]);
      assert.equal(command, 'kubectl');
      assert.equal(logByDeployment.has(args[3]), true, `unexpected pin-flow deployment ${args[3]}`);
      return {
        stdout: logByDeployment.get(args[3]).map(formatDePinFlowEvidenceLine).join('\n'),
      };
    },
    httpClient: {
      findFixtureApps: noOp,
      installFixture: noOp,
      assertInstalledTopology: noOp,
      triggerScenario: noOp,
      waitForMaterializedResponse: noOp,
      uninstallFixture: noOp,
      assertNoFixtureResidue: noOp,
    },
    legacyDependencies: {
      assertLocalOrbStack: noOp,
      assertAcceptanceWindowNetworkBoundary: noOp,
    },
    delay: async () => assert.fail('complete fresh evidence must not poll again'),
  });
  const actual = await dependencies.readPositiveCorrelationEvidence({ since: startedAt, ref, scenario });
  assert.equal(actual.op_id, expected.op_id);
  assert.equal(actual.request_id, expected.request_id);
  assert.equal(actual.entries.length, expected.entries.length);
  assert.deepEqual(
    calls,
    ['deployment/ui-server', 'deployment/mbr-worker', 'deployment/remote-worker'].map((deployment) => [
      'kubectl',
      ['-n', 'dongyu', 'logs', deployment, '--since-time', new Date(startedAt).toISOString()],
      { timeout: 20000 },
    ]),
  );
  return { key: 'revision4_default_positive_reader_uses_fresh_shared_pin_flow_logs', status: 'PASS' };
}

async function test_revision4_ui_server_boundary_requires_fresh_local_effective_and_outbound_evidence() {
  const { evaluateRevision4UiServerBoundaryEvidence } = await loadVerifierModule();
  assert.deepEqual(
    evaluateRevision4UiServerBoundaryEvidence(validUiServerBoundaryEvidence(), { since: startedAt }),
    { ok: true, deployment: 'deployment/ui-server', evidence_count: 4 },
  );
  const remoteOutbound = validUiServerBoundaryEvidence([
    uiServerBoundaryEntry('outbound_attempt', 'https:', 'matrix.dongyudigital.com', 443, startedAt + 3),
  ]);
  assert.throws(
    () => evaluateRevision4UiServerBoundaryEvidence(remoteOutbound, { since: startedAt }),
    /revision4_ui_server_boundary_network_boundary_violation/u,
    'fresh remote UI Server outbound evidence must fail the local-only acceptance',
  );
  const staleOnly = validUiServerBoundaryEvidence().entries.map((entry) => ({ ...entry, ts: startedAt - 1 }));
  assert.throws(
    () => evaluateRevision4UiServerBoundaryEvidence({
      deployment: 'deployment/ui-server',
      entries: staleOnly,
    }, { since: startedAt }),
    /revision4_ui_server_boundary_stale_network_boundary_evidence/u,
  );
  return {
    key: 'revision4_ui_server_boundary_requires_fresh_local_effective_and_outbound_evidence',
    status: 'PASS',
  };
}

async function test_revision4_default_ui_server_boundary_reader_uses_fresh_shared_logs() {
  const { createDefaultRevision4LiveAcceptanceDependencies } = await loadVerifierModule();
  const { formatDeNetworkBoundaryEvidenceLine } = await loadNetworkBoundaryModule();
  const evidence = validUiServerBoundaryEvidence();
  const calls = [];
  const noOp = async () => undefined;
  const createDependencies = (entries) => createDefaultRevision4LiveAcceptanceDependencies({
    execFile: async (command, args, options) => {
      calls.push([command, args, options]);
      return { stdout: entries.map(formatDeNetworkBoundaryEvidenceLine).join('\n') };
    },
    now: () => startedAt + 100,
    monotonicNow: () => 0,
    delay: async () => assert.fail('complete UI Server boundary evidence must not poll again'),
    httpClient: {
      findFixtureApps: noOp,
      installFixture: noOp,
      assertInstalledTopology: noOp,
      triggerScenario: noOp,
      waitForMaterializedResponse: noOp,
      uninstallFixture: noOp,
      assertNoFixtureResidue: noOp,
    },
    legacyDependencies: {
      assertLocalOrbStack: noOp,
      assertAcceptanceWindowNetworkBoundary: noOp,
    },
  });
  assert.deepEqual(
    await createDependencies(evidence.entries).readUiServerBoundaryEvidence({ since: startedAt }),
    evidence,
  );
  assert.deepEqual(calls, [[
    'kubectl',
    [
      '-n', 'dongyu', 'logs', 'deployment/ui-server',
      '--since-time', new Date(startedAt).toISOString(),
    ],
    { timeout: 20000 },
  ]]);

  const remoteOutbound = [
    ...evidence.entries,
    uiServerBoundaryEntry('outbound_attempt', 'https:', 'matrix.dongyudigital.com', 443, startedAt + 3),
  ];
  await assert.rejects(
    createDependencies(remoteOutbound).readUiServerBoundaryEvidence({ since: startedAt }),
    /revision4_ui_server_boundary_network_boundary_violation/u,
    'the default log reader must reject a fresh remote UI Server outbound attempt',
  );
  return { key: 'revision4_default_ui_server_boundary_reader_uses_fresh_shared_logs', status: 'PASS' };
}

async function test_shared_network_boundary_evidence_is_redacted_fresh_and_fail_closed() {
  const {
    DE_NETWORK_BOUNDARY_MARKER,
    buildDeNetworkBoundaryEvidence,
    evaluateDeNetworkBoundaryEvidence,
    formatDeNetworkBoundaryEvidenceLine,
    parseDeNetworkBoundaryEvidenceLines,
  } = await loadNetworkBoundaryModule();
  assert.equal(DE_NETWORK_BOUNDARY_MARKER, 'DE_NETWORK_BOUNDARY');
  assert.equal(typeof buildDeNetworkBoundaryEvidence, 'function');
  assert.equal(typeof evaluateDeNetworkBoundaryEvidence, 'function');
  assert.equal(typeof formatDeNetworkBoundaryEvidenceLine, 'function');
  assert.equal(typeof parseDeNetworkBoundaryEvidenceLines, 'function');

  const build = (kind, service, destination, ts = startedAt + 1) => buildDeNetworkBoundaryEvidence({
    kind,
    service,
    destination,
    ts,
  });
  const evidence = [
    build('effective_config', 'mbr-worker', 'http://synapse.dongyu.svc.cluster.local:8008'),
    build('outbound_attempt', 'mbr-worker', 'http://synapse.dongyu.svc.cluster.local:8008', startedAt + 2),
    build('effective_config', 'remote-worker', 'mqtt://mosquitto.dongyu.svc.cluster.local:1883'),
    build('outbound_attempt', 'remote-worker', 'mqtt://mosquitto.dongyu.svc.cluster.local:1883', startedAt + 2),
    build('effective_config', 'workspace-manager', 'mqtt://mosquitto.dongyu.svc.cluster.local:1883'),
    build('outbound_attempt', 'workspace-manager', 'mqtt://mosquitto.dongyu.svc.cluster.local:1883', startedAt + 2),
    build('effective_config', 'synapse', 'http://0.0.0.0:8008'),
    build('effective_config', 'mosquitto', 'mqtt://0.0.0.0:1883'),
  ];
  assert.deepEqual(evidence, [
    {
      schema: 'de_network_boundary_evidence.v1',
      kind: 'effective_config',
      service: 'mbr-worker',
      ts: startedAt + 1,
      protocol: 'http:',
      hostname: 'synapse.dongyu.svc.cluster.local',
      port: 8008,
    },
    {
      schema: 'de_network_boundary_evidence.v1',
      kind: 'outbound_attempt',
      service: 'mbr-worker',
      ts: startedAt + 2,
      protocol: 'http:',
      hostname: 'synapse.dongyu.svc.cluster.local',
      port: 8008,
    },
    {
      schema: 'de_network_boundary_evidence.v1',
      kind: 'effective_config',
      service: 'remote-worker',
      ts: startedAt + 1,
      protocol: 'mqtt:',
      hostname: 'mosquitto.dongyu.svc.cluster.local',
      port: 1883,
    },
    {
      schema: 'de_network_boundary_evidence.v1',
      kind: 'outbound_attempt',
      service: 'remote-worker',
      ts: startedAt + 2,
      protocol: 'mqtt:',
      hostname: 'mosquitto.dongyu.svc.cluster.local',
      port: 1883,
    },
    {
      schema: 'de_network_boundary_evidence.v1',
      kind: 'effective_config',
      service: 'workspace-manager',
      ts: startedAt + 1,
      protocol: 'mqtt:',
      hostname: 'mosquitto.dongyu.svc.cluster.local',
      port: 1883,
    },
    {
      schema: 'de_network_boundary_evidence.v1',
      kind: 'outbound_attempt',
      service: 'workspace-manager',
      ts: startedAt + 2,
      protocol: 'mqtt:',
      hostname: 'mosquitto.dongyu.svc.cluster.local',
      port: 1883,
    },
    {
      schema: 'de_network_boundary_evidence.v1',
      kind: 'effective_config',
      service: 'synapse',
      ts: startedAt + 1,
      protocol: 'http:',
      hostname: '0.0.0.0',
      port: 8008,
    },
    {
      schema: 'de_network_boundary_evidence.v1',
      kind: 'effective_config',
      service: 'mosquitto',
      ts: startedAt + 1,
      protocol: 'mqtt:',
      hostname: '0.0.0.0',
      port: 1883,
    },
  ]);
  for (const entry of evidence) {
    assert.deepEqual(
      Object.keys(entry).sort(),
      ['schema', 'kind', 'service', 'ts', 'protocol', 'hostname', 'port'].sort(),
      'network evidence must expose only the shared non-secret allowlist',
    );
  }

  const sanitizedFeishu = build(
    'outbound_attempt',
    'remote-worker',
    'https://user:secret-value@open.feishu.cn/open-apis?token=secret-query',
    startedAt + 3,
  );
  assert.deepEqual(sanitizedFeishu, {
    schema: 'de_network_boundary_evidence.v1',
    kind: 'outbound_attempt',
    service: 'remote-worker',
    ts: startedAt + 3,
    protocol: 'https:',
    hostname: allowedFeishuHostname,
    port: 443,
  });
  const feishuLine = formatDeNetworkBoundaryEvidenceLine(sanitizedFeishu);
  assert.equal(feishuLine, `${DE_NETWORK_BOUNDARY_MARKER} ${JSON.stringify(sanitizedFeishu)}`);
  assert.equal(feishuLine.includes('secret-value'), false, 'userinfo must never enter network evidence');
  assert.equal(feishuLine.includes('secret-query'), false, 'URL query must never enter network evidence');
  assert.equal(feishuLine.includes('/open-apis'), false, 'URL path must never enter network evidence');

  const stale = build(
    'effective_config',
    'remote-worker',
    'mqtt://mosquitto.dongyu.svc.cluster.local:1883',
    startedAt - 1,
  );
  const exactLines = evidence.map((entry) => formatDeNetworkBoundaryEvidenceLine(entry));
  const parsed = parseDeNetworkBoundaryEvidenceLines([
    '[worker] an unrelated application log remains ignorable',
    formatDeNetworkBoundaryEvidenceLine(stale),
    ...exactLines,
    feishuLine,
  ].join('\n'), { since: startedAt });
  assert.deepEqual(parsed, [...evidence, sanitizedFeishu], 'parser must keep exact fresh evidence while ignoring non-marker logs and stale records');
  for (const [name, malformedLine] of [
    ['invalid_json', `${DE_NETWORK_BOUNDARY_MARKER} {malformed-json`],
    [
      'extra_field_outbound',
      `${DE_NETWORK_BOUNDARY_MARKER} ${JSON.stringify({
        ...evidence[1],
        secret: 'forbidden-extra-field',
      })}`,
    ],
    [
      'wrong_type_outbound',
      `${DE_NETWORK_BOUNDARY_MARKER} ${JSON.stringify({
        ...evidence[1],
        port: '8008',
      })}`,
    ],
    [
      'stale_extra_field_outbound',
      `${DE_NETWORK_BOUNDARY_MARKER} ${JSON.stringify({
        ...evidence[1],
        ts: startedAt - 1,
        unexpected: true,
      })}`,
    ],
  ]) {
    assert.throws(
      () => parseDeNetworkBoundaryEvidenceLines([
        exactLines[0],
        malformedLine,
        ...exactLines.slice(1),
      ].join('\n'), { since: startedAt }),
      /invalid_network_boundary_evidence/u,
      `${name}: one malformed marker line must fail closed even beside valid required evidence`,
    );
  }
  for (const entry of parsed) {
    const result = evaluateDeNetworkBoundaryEvidence(entry, { since: startedAt });
    assert.equal(result?.ok, true, `${entry.service}/${entry.kind}/${entry.protocol}: local or exact Feishu evidence`);
    assert.equal(typeof result?.code, 'string', 'shared evaluator must return a machine-readable code');
  }
  assert.equal(
    evaluateDeNetworkBoundaryEvidence(
      stale,
      { since: startedAt },
    ).ok,
    false,
    'stale required evidence must not satisfy the acceptance window',
  );

  for (const [name, entry] of [
    ['remote_matrix', build('outbound_attempt', 'mbr-worker', 'https://matrix.dongyudigital.com')],
    ['matrix_lookalike', build('outbound_attempt', 'mbr-worker', 'http://synapse.dongyu.svc.cluster.local.evil.test:8008')],
    ['remote_mqtt', build('outbound_attempt', 'remote-worker', 'mqtt://mqtt.dongyudigital.com:1883')],
    ['workspace_manager_remote_mqtt', build('outbound_attempt', 'workspace-manager', 'mqtt://mqtt.dongyudigital.com:1883')],
    ['mqtt_lookalike', build('outbound_attempt', 'remote-worker', 'mqtt://mosquitto.dongyu.svc.cluster.local.evil.test:1883')],
    ['mqtt_wrong_port', build('outbound_attempt', 'remote-worker', 'mqtt://mosquitto.dongyu.svc.cluster.local:8883')],
    ['remote_oidc', build('outbound_attempt', 'remote-worker', 'https://id.dongyudigital.com')],
    ['oidc_lookalike', build('outbound_attempt', 'remote-worker', 'https://open.feishu.cn.evil.test')],
    ['non_https_feishu', build('outbound_attempt', 'remote-worker', 'http://open.feishu.cn/open-apis')],
    ['feishu_wrong_port', build('outbound_attempt', 'remote-worker', 'https://open.feishu.cn:444/open-apis')],
    ['feishu_userinfo_lookalike', build('outbound_attempt', 'remote-worker', 'https://open.feishu.cn@evil.test/open-apis')],
  ]) {
    const result = evaluateDeNetworkBoundaryEvidence(entry, { since: startedAt });
    assert.equal(result?.ok, false, `${name}: remote/lookalike evidence must fail closed`);
    assert.match(String(result?.code || ''), /network_boundary_violation/u, `${name}: explicit boundary code`);
  }

  const helperSource = readFileSync(networkBoundaryModulePath, 'utf8');
  assert.doesNotMatch(helperSource, /\b(?:username|password|userinfo|pathname|query|searchParams|token|secret)\s*:/iu);

  const runnerSource = readFileSync(runnerPath, 'utf8');
  assert.match(
    runnerSource,
    /createRemoteWorkerNetworkBoundaryObservability\(\{[\s\S]*?workerScope:\s*WORKER_SCOPE,[\s\S]*?mqttDestination,/u,
    'the shared runner must bind network evidence to DY_WORKER_SCOPE instead of always reporting R1',
  );
  assert.match(
    runnerSource,
    /createDeNetworkBoundaryObservability\(\{[\s\S]*?service:\s*workerScope,/u,
    'the shared runner helper must pass the selected R1 or WM1 service identity to the shared schema',
  );
  assert.match(
    runnerSource,
    /rt\.mqttClient\.publish\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?networkBoundaryObservability\.recordOutbound\(mqttDestination\)/u,
    'every shared-runner MQTT publish must emit an actual scoped outbound-attempt record',
  );

  return { key: 'shared_network_boundary_evidence_is_redacted_fresh_and_fail_closed', status: 'PASS' };
}

async function test_workspace_manager_network_audit_probe_is_exact_local_v2_roundtrip() {
  const {
    buildWorkspaceManagerNetworkAuditProbe,
    evaluateWorkspaceManagerNetworkAuditResponse,
    runWorkspaceManagerNetworkAuditRoundtrip,
  } = await loadVerifierModule();
  assert.equal(typeof buildWorkspaceManagerNetworkAuditProbe, 'function');
  assert.equal(typeof evaluateWorkspaceManagerNetworkAuditResponse, 'function');
  assert.equal(typeof runWorkspaceManagerNetworkAuditRoundtrip, 'function');

  const marker = 'wm_audit_probe';
  const timestamp = startedAt + 7;
  const probe = buildWorkspaceManagerNetworkAuditProbe({ marker, timestamp });
  const responsePin = `wm_audit_result_${marker}`;
  const responseTopic = `UIPUT/ws/dam/pic/de/E2E/1/${responsePin}`;
  assert.equal(probe.topic, 'UIPUT/ws/dam/pic/de/WM1/4000/refresh');
  assert.equal(probe.response_topic, responseTopic);
  assert.notEqual(probe.topic, probe.response_topic, 'the request and response topics must remain distinct');
  assert.deepEqual(Object.keys(probe.packet).sort(), ['payload', 'type', 'version']);
  assert.equal(probe.packet.version, 'v1');
  assert.equal(probe.packet.type, 'pin_payload');
  assert.ok(Array.isArray(probe.packet.payload));

  for (const record of probe.packet.payload) {
    assert.deepEqual(
      Object.keys(record).sort(),
      ['c', 'id', 'k', 'p', 'r', 't', 'v'],
      `${record.k}: every record must keep the exact Temporary ModelTable shape`,
    );
    for (const coordinate of ['id', 'p', 'r', 'c']) {
      assert.equal(Number.isInteger(record[coordinate]), true, `${record.k}.${coordinate}: integer required`);
    }
  }
  const root = (key) => probe.packet.payload.find((record) => (
    record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key
  )) || null;
  assert.equal(root('__mt_payload_kind')?.v, 'pin_payload.v2');
  assert.equal(root('__mt_request_id')?.v, `wm_network_audit_${marker}`);
  assert.equal(root('op_id')?.v, `wm_network_audit_${marker}`);
  assert.equal(root('message_role')?.v, 'request');
  assert.equal(root('topic')?.v, probe.topic);
  assert.equal(root('response_topic')?.v, responseTopic);
  assert.equal(root('bus')?.v, 'control');
  assert.equal(root('route_kind')?.v, 'control');
  assert.equal(root('endpoint_worker_id')?.v, 'WM1');
  assert.equal(root('endpoint_table_id')?.v, 'host');
  assert.equal(root('endpoint_model_id')?.v, 4000);
  assert.equal(root('endpoint_pin')?.v, 'refresh');
  assert.equal(root('origin_worker_id')?.v, 'E2E');
  assert.equal(root('origin_table_id')?.v, 'host');
  assert.equal(root('origin_model_id')?.v, 1);
  assert.equal(root('origin_pin')?.v, 'wm_audit');
  assert.equal(root('reply_target_worker_id')?.v, 'E2E');
  assert.equal(root('reply_target_table_id')?.v, 'host');
  assert.equal(root('reply_target_model_id')?.v, 1);
  assert.equal(root('reply_target_pin')?.v, responsePin);
  assert.equal(root('payload_model_id')?.v, 1);
  assert.equal(root('timestamp')?.t, 'int');
  assert.equal(root('timestamp')?.v, timestamp);
  assert.deepEqual(
    probe.packet.payload.filter((record) => record.id === 1),
    [{ id: 1, p: 0, r: 0, c: 0, k: 'audit_marker', t: 'str', v: marker }],
  );

  const responseTimestamp = timestamp + 1;
  const responseOpId = `wm_refresh_result_${responseTimestamp}`;
  const responseRecord = (k, t, v, id = 0) => ({ id, p: 0, r: 0, c: 0, k, t, v });
  const responsePacket = {
    version: 'v1',
    type: 'pin_payload',
    payload: [
      responseRecord('__mt_payload_kind', 'str', 'pin_payload.v2'),
      responseRecord('__mt_request_id', 'str', responseOpId),
      responseRecord('op_id', 'str', responseOpId),
      responseRecord('message_role', 'str', 'response'),
      responseRecord('topic', 'str', responseTopic),
      responseRecord('response_topic', 'str', responseTopic),
      responseRecord('route_kind', 'str', 'control'),
      responseRecord('bus', 'str', 'control'),
      responseRecord('endpoint_worker_id', 'str', 'E2E'),
      responseRecord('endpoint_table_id', 'str', 'host'),
      responseRecord('endpoint_model_id', 'int', 1),
      responseRecord('endpoint_pin', 'str', responsePin),
      responseRecord('origin_worker_id', 'str', 'WM1'),
      responseRecord('origin_table_id', 'str', 'host'),
      responseRecord('origin_model_id', 'int', 4000),
      responseRecord('origin_pin', 'str', 'refresh'),
      responseRecord('reply_target_worker_id', 'str', 'E2E'),
      responseRecord('reply_target_table_id', 'str', 'host'),
      responseRecord('reply_target_model_id', 'int', 1),
      responseRecord('reply_target_pin', 'str', responsePin),
      responseRecord('payload_model_id', 'int', 1),
      responseRecord('timestamp', 'int', responseTimestamp),
      responseRecord('workspace_manager_status', 'str', 'ready', 1),
    ],
  };
  assert.deepEqual(
    evaluateWorkspaceManagerNetworkAuditResponse({
      probe,
      message: { topic: responseTopic, payload: JSON.stringify(responsePacket) },
      notBefore: timestamp,
    }),
    { ok: true, code: 'workspace_manager_network_audit_verified', response_topic: responseTopic },
  );
  for (const [name, mutate, pattern] of [
    ['wrong_topic', (packet) => ({ topic: `${responseTopic}_other`, payload: JSON.stringify(packet) }), /response_topic_mismatch/u],
    ['stale_timestamp', (packet) => {
      const copy = structuredClone(packet);
      copy.payload.find((record) => record.k === 'timestamp').v = timestamp - 1;
      return { topic: responseTopic, payload: JSON.stringify(copy) };
    }, /response_timestamp_stale/u],
    ['wrong_origin', (packet) => {
      const copy = structuredClone(packet);
      copy.payload.find((record) => record.k === 'origin_worker_id').v = 'R1';
      return { topic: responseTopic, payload: JSON.stringify(copy) };
    }, /response_origin_mismatch/u],
    ['duplicate_root', (packet) => {
      const copy = structuredClone(packet);
      copy.payload.push(responseRecord('bus', 'str', 'control'));
      return { topic: responseTopic, payload: JSON.stringify(copy) };
    }, /duplicate_model_zero_root_key/u],
  ]) {
    const evaluated = evaluateWorkspaceManagerNetworkAuditResponse({
      probe,
      message: mutate(responsePacket),
      notBefore: timestamp,
    });
    assert.equal(evaluated?.ok, false, `${name}: malformed or uncorrelated WM1 response must fail closed`);
    assert.match(String(evaluated?.code || ''), pattern, `${name}: exact failure reason`);
  }

  const events = [];
  const listeners = new Map();
  const mqttClient = {
    on(event, listener) {
      events.push(`on:${event}`);
      listeners.set(event, listener);
      return () => {
        events.push(`off:${event}`);
        listeners.delete(event);
      };
    },
    async subscribe(subscribedTopic) {
      events.push(`subscribe:${subscribedTopic}`);
      assert.equal(subscribedTopic, responseTopic);
    },
    async publish(publishedTopic, packet) {
      events.push(`publish:${publishedTopic}`);
      assert.equal(publishedTopic, probe.topic);
      assert.deepEqual(packet, probe.packet);
      queueMicrotask(() => {
        events.push(`message:${responseTopic}`);
        listeners.get('message')?.(responseTopic, JSON.stringify(responsePacket));
      });
    },
  };
  const roundtrip = await runWorkspaceManagerNetworkAuditRoundtrip({
    mqttClient,
    marker,
    now: () => timestamp,
    operation: async (stage, work) => {
      events.push(`operation:${stage}:start`);
      const value = await work();
      events.push(`operation:${stage}:end`);
      return value;
    },
  });
  assert.deepEqual(roundtrip, {
    ok: true,
    code: 'workspace_manager_network_audit_verified',
    response_topic: responseTopic,
  });
  const eventIndex = (value) => {
    const index = events.indexOf(value);
    assert.ok(index >= 0, `missing event: ${value}`);
    return index;
  };
  assert.ok(
    eventIndex(`subscribe:${responseTopic}`) < eventIndex(`publish:${probe.topic}`)
      && eventIndex(`publish:${probe.topic}`) < eventIndex(`message:${responseTopic}`)
      && eventIndex(`message:${responseTopic}`) < eventIndex('off:message'),
    'the roundtrip must subscribe, publish, observe the unique response, validate it, and then dispose its listener',
  );
  assert.equal(listeners.size, 0, 'the WM1 response/error listeners must be disposed after success');

  for (const errorStage of ['subscribe', 'publish']) {
    const stageListeners = new Map();
    const unhandled = [];
    const onUnhandled = (reason) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const failingClient = {
        on(event, listener) {
          stageListeners.set(event, listener);
          return () => stageListeners.delete(event);
        },
        async subscribe() {
          if (errorStage === 'subscribe') {
            stageListeners.get('error')?.(new Error('during subscribe'));
            await new Promise((resolvePromise) => setImmediate(resolvePromise));
          }
        },
        async publish() {
          if (errorStage === 'publish') {
            stageListeners.get('error')?.(new Error('during publish'));
            await new Promise((resolvePromise) => setImmediate(resolvePromise));
          }
        },
      };
      await assert.rejects(
        runWorkspaceManagerNetworkAuditRoundtrip({
          mqttClient: failingClient,
          marker: `${marker}_${errorStage}`,
          now: () => timestamp,
        }),
        new RegExp(`workspace_manager_network_audit_mqtt_error:during ${errorStage}`, 'u'),
        `${errorStage}: MQTT loss must reject the correlated roundtrip with the original stage error`,
      );
      await new Promise((resolvePromise) => setImmediate(resolvePromise));
      assert.deepEqual(
        unhandled,
        [],
        `${errorStage}: response rejection must be handled immediately even before the response await begins`,
      );
      assert.equal(stageListeners.size, 0, `${errorStage}: failure must dispose both dedicated listeners`);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  }

  const verifierSource = readFileSync(verifierPath, 'utf8');
  const executionStart = verifierSource.indexOf('async function executeLegacyPublicBoundaryProbe');
  const executionEnd = verifierSource.indexOf('export function runLegacyPublicBoundaryProbe', executionStart);
  const executionSource = verifierSource.slice(executionStart, executionEnd);
  const legacySilenceIndex = executionSource.indexOf("operation('response_silence'");
  const workspaceRoundtripIndex = executionSource.indexOf('runWorkspaceManagerNetworkAuditRoundtrip');
  const networkAuditIndex = executionSource.indexOf("'network_boundary'");
  assert.ok(legacySilenceIndex >= 0, 'the removed-v1 silence window must still be observed');
  assert.ok(
    workspaceRoundtripIndex > legacySilenceIndex && workspaceRoundtripIndex < networkAuditIndex,
    'the correlated WM1 roundtrip must finish after the v1 silence window and before the acceptance-window audit',
  );
  assert.match(
    executionSource,
    /deps\.assertAcceptanceWindowNetworkBoundary\s*===\s*defaults\.assertAcceptanceWindowNetworkBoundary/u,
    'only the real default network audit path may add the WM1 business roundtrip',
  );

  return { key: 'workspace_manager_network_audit_probe_is_exact_local_v2_roundtrip', status: 'PASS' };
}

async function test_probe_builds_exact_removed_outer_packet() {
  const { buildLegacyPublicBoundaryProbe } = await loadProbeModule();
  assert.equal(typeof buildLegacyPublicBoundaryProbe, 'function');
  const probe = buildLegacyPublicBoundaryProbe({ marker: 'probe123' });
  const correlation = probeCorrelation();

  assert.equal(probe.topic, topic);
  assert.equal(probe.response_topic, correlation.responseTopic);
  assert.deepEqual(probe.packet, correlation.packet);
  assert.equal(probe.outer_packet_sha256, correlation.outerPacketSha256);
  for (const marker of [
    '',
    '1starts_with_number',
    'Uppercase',
    'contains/slash',
    'contains space',
    'a'.repeat(65),
    secretSentinel,
  ]) {
    assert.throws(
      () => buildLegacyPublicBoundaryProbe({ marker }),
      /probe marker must match/u,
      `unsafe probe marker must fail before it can enter a response topic or trace: ${marker}`,
    );
  }

  return { key: 'probe_builds_exact_removed_outer_packet', status: 'PASS' };
}

async function test_probe_evidence_requires_rejection_immutability_and_silence() {
  const { evaluateLegacyPublicBoundaryEvidence } = await loadProbeModule();
  assert.equal(typeof evaluateLegacyPublicBoundaryEvidence, 'function');
  const correlation = probeCorrelation();
  const before = validDiagnostic();
  const after = validDiagnostic(exactRejection());
  const traceDelta = [exactTrace()];
  const valid = {
    before,
    after,
    traceDelta,
    traceSince: startedAt,
    responseMessages: [],
    topic,
    startedAt,
    publishedAt,
    marker: correlation.marker,
    responseTopic: correlation.responseTopic,
    outerPacketSha256: correlation.outerPacketSha256,
  };
  assert.deepEqual(evaluateLegacyPublicBoundaryEvidence(valid), { ok: true, code: 'verified' });

  const failures = [
    ['missing_before_schema', { before: omit(before, 'schema') }, 'invalid_diagnostic_schema'],
    ['wrong_after_schema', { after: { ...after, schema: 'de_runtime_diagnostic.v0' } }, 'invalid_diagnostic_schema'],
    ['missing_before_snapshot_hash', { before: omit(before, 'model3200_sha256') }, 'invalid_diagnostic_hash'],
    ['short_after_snapshot_hash', { after: { ...after, model3200_sha256: 'a'.repeat(63) } }, 'invalid_diagnostic_hash'],
    ['long_before_result_hash', { before: { ...before, model3200_result_sha256: 'b'.repeat(65) } }, 'invalid_diagnostic_hash'],
    ['non_hex_after_result_hash', { after: { ...after, model3200_result_sha256: 'g'.repeat(64) } }, 'invalid_diagnostic_hash'],
    ['uppercase_hash_is_not_canonical', { after: { ...after, model3200_sha256: 'A'.repeat(64) } }, 'invalid_diagnostic_hash'],
    [
      'missing_model3200_snapshot_hashes_null',
      {
        before: { ...before, model3200_sha256: sha256(null) },
        after: { ...after, model3200_sha256: sha256(null) },
      },
      'missing_model3200_evidence',
    ],
    [
      'missing_model3200_result_hashes_null',
      {
        before: { ...before, model3200_result_sha256: sha256(null) },
        after: { ...after, model3200_result_sha256: sha256(null) },
      },
      'missing_model3200_evidence',
    ],
    ['snapshot_changed', { after: { ...after, model3200_sha256: 'c'.repeat(64) } }, 'model3200_snapshot_changed'],
    ['result_changed', { after: { ...after, model3200_result_sha256: 'c'.repeat(64) } }, 'model3200_result_changed'],
    ['wrong_error_reason', { after: validDiagnostic(exactRejection({ code: 'invalid_payload' })) }, 'missing_exact_legacy_rejection'],
    ['wrong_error_topic', { after: validDiagnostic(exactRejection({ topic: `${topic}/wrong` })) }, 'missing_exact_legacy_rejection'],
    ['wrong_error_pin', { after: validDiagnostic(exactRejection({ pin: 'result' })) }, 'missing_exact_legacy_rejection'],
    ['wrong_error_ingress', { after: validDiagnostic(exactRejection({ ingress_pin: 'r1_mb_in' })) }, 'missing_exact_legacy_rejection'],
    ['stale_error_time', { after: validDiagnostic(exactRejection({ ts: startedAt - 1 })) }, 'stale_legacy_rejection'],
    [
      'same_kind_error_after_start_but_before_publish',
      { after: validDiagnostic(exactRejection({ ts: publishedAt - 1 })) },
      'stale_legacy_rejection',
    ],
    [
      'same_before_after_rejection_is_not_fresh',
      { before: validDiagnostic(exactRejection()), after: validDiagnostic(exactRejection()) },
      'stale_legacy_rejection',
    ],
    ['trace_since_must_equal_acceptance_start', { traceSince: startedAt - 1 }, 'invalid_trace_window'],
    ['missing_trace', { traceDelta: [] }, 'missing_rejection_trace'],
    [
      'wrong_trace_topic',
      { traceDelta: [exactTrace({ payload: { ...exactTrace().payload, topic: `${topic}/wrong` } })] },
      'missing_rejection_trace',
    ],
    [
      'wrong_trace_reason',
      { traceDelta: [exactTrace({ payload: { ...exactTrace().payload, reason: 'invalid_payload' } })] },
      'missing_rejection_trace',
    ],
    [
      'wrong_trace_marker',
      { traceDelta: [exactTrace({ payload: { ...exactTrace().payload, probe_marker: 'other-probe' } })] },
      'missing_rejection_trace',
    ],
    [
      'wrong_trace_response_topic',
      { traceDelta: [exactTrace({ payload: { ...exactTrace().payload, response_topic: `${correlation.responseTopic}-wrong` } })] },
      'missing_rejection_trace',
    ],
    [
      'wrong_trace_outer_packet_hash',
      { traceDelta: [exactTrace({ payload: { ...exactTrace().payload, outer_packet_sha256: 'c'.repeat(64) } })] },
      'missing_rejection_trace',
    ],
    ['trace_before_acceptance_start', { traceDelta: [exactTrace({ ts: startedAt - 1 })] }, 'missing_rejection_trace'],
    [
      'same_kind_trace_after_start_but_before_publish',
      { traceDelta: [exactTrace({ ts: publishedAt - 1 })] },
      'missing_rejection_trace',
    ],
    [
      'accepted_trace',
      {
        traceDelta: [
          ...traceDelta,
          {
            type: 'inbound',
            ts: publishedAt + 3,
            payload: {
              topic,
              pin: 'resource',
              ingress_pin: 'r1_cb_in',
              probe_marker: correlation.marker,
              response_topic: correlation.responseTopic,
              outer_packet_sha256: correlation.outerPacketSha256,
            },
          },
        ],
      },
      'legacy_packet_reached_ingress',
    ],
    [
      'response_emitted',
      {
        responseMessages: [{
          topic: correlation.responseTopic,
          payload: '{"unexpected":true}',
        }],
      },
      'legacy_response_emitted',
    ],
  ];
  for (const [name, override, code] of failures) {
    assert.deepEqual(
      evaluateLegacyPublicBoundaryEvidence({ ...valid, ...override }),
      { ok: false, code },
      name,
    );
  }

  return { key: 'probe_evidence_requires_rejection_immutability_and_silence', status: 'PASS' };
}

async function test_actual_runtime_rejection_round_trips_through_runner_log_schema_and_parser() {
  const {
    DE_RUNTIME_DIAGNOSTIC_MARKER,
    DE_RUNTIME_TRACE_MARKER,
    buildDeRuntimeDiagnostic,
    buildDeRuntimeTraceEvidence,
    createDeRuntimeDiagnosticEmitter,
  } = await loadDiagnosticModule();
  const {
    evaluateLegacyPublicBoundaryEvidence,
    parseR1DiagnosticLog,
    parseR1TraceDeltaLog,
  } = await loadProbeModule();
  assert.equal(DE_RUNTIME_DIAGNOSTIC_MARKER, 'DE_RUNTIME_DIAGNOSTIC');
  assert.equal(DE_RUNTIME_TRACE_MARKER, 'DE_RUNTIME_TRACE');
  assert.equal(typeof buildDeRuntimeTraceEvidence, 'function');
  assert.equal(typeof createDeRuntimeDiagnosticEmitter, 'function');
  assert.equal(typeof parseR1DiagnosticLog, 'function');
  assert.equal(typeof parseR1TraceDeltaLog, 'function');

  const correlation = probeCorrelation('runtime_round_trip');
  const r1 = loadSsotDeActor('r1');
  r1.runtime.setRuntimeMode('edit');
  r1.runtime.setRuntimeMode('running');
  const emittedLines = [];
  const emitRuntimeDiagnostics = createDeRuntimeDiagnosticEmitter({
    runtime: r1.runtime,
    writeLine: (line) => emittedLines.push(line),
  });
  assert.equal(typeof emitRuntimeDiagnostics, 'function', 'cursor factory must return one reason-driven emitter');
  const initialLines = emitRuntimeDiagnostics('probe_before');
  assert.deepEqual(
    emittedLines,
    initialLines,
    'the first cursor emission must return exactly the lines written through its injected writer',
  );
  const before = parseR1DiagnosticLog(initialLines.join('\n'), { since: startedAt, phase: 'before' });
  assert.deepEqual(
    before,
    buildDeRuntimeDiagnostic({ runtime: r1.runtime, reason: 'probe_before' }),
    'the production parser must consume the factory-produced baseline diagnostic',
  );
  assert.deepEqual(
    parseR1TraceDeltaLog(initialLines.join('\n'), {
      since: startedAt,
      notBefore: publishedAt,
      topic,
      marker: correlation.marker,
      responseTopic: correlation.responseTopic,
      outerPacketSha256: correlation.outerPacketSha256,
    }),
    [],
    'the cursor baseline must not fabricate a correlated rejection',
  );
  const traceCursor = r1.runtime.mqttTrace.list().length;
  const originalNow = Date.now;
  let handled;
  try {
    Date.now = () => publishedAt + 1;
    handled = r1.runtime.mqttIncoming(topic, correlation.packet);
  } finally {
    Date.now = originalNow;
  }
  assert.equal(handled, false, 'the exact legacy outer packet must be rejected by the actual R1 runtime');
  const actualTraceDelta = r1.runtime.mqttTrace.list().slice(traceCursor);
  const rawRejection = actualTraceDelta.find((entry) => entry?.type === 'inbound_rejected');
  assert.deepEqual(rawRejection?.payload?.payload, correlation.packet, 'raw runtime trace must retain the complete outer packet');

  const after = buildDeRuntimeDiagnostic({ runtime: r1.runtime, reason: 'probe_after' });
  const sensitiveTraceDelta = actualTraceDelta.map((entry) => entry === rawRejection
    ? {
        ...entry,
        payload: {
          ...entry.payload,
          secret_material: secretSentinel,
          token: tokenSentinel,
        },
      }
    : entry);
  sensitiveTraceDelta.unshift({
    type: 'inbound',
    payload: {
      topic,
      payload: correlation.packet,
    },
  });
  sensitiveTraceDelta.push({
    type: 'debug_probe_context',
    payload: {
      raw_payload: correlation.packet,
      secret_material: secretSentinel,
      token: tokenSentinel,
    },
  });
  const traceEvidence = buildDeRuntimeTraceEvidence({
    runtime: r1.runtime,
    reason: 'probe_after',
    traceEntries: sensitiveTraceDelta,
  });
  const expectedProjectedTrace = {
    type: 'inbound_rejected',
    ts: publishedAt + 1,
    payload: {
      topic,
      pin: 'resource',
      ingress_pin: 'r1_cb_in',
      reason: rejectionCode,
      probe_marker: correlation.marker,
      response_topic: correlation.responseTopic,
      outer_packet_sha256: correlation.outerPacketSha256,
    },
  };
  assert.deepEqual(traceEvidence, {
    schema: 'de_runtime_trace.v1',
    reason: 'probe_after',
    entries: [expectedProjectedTrace],
  }, 'trace evidence must ignore transport receipt and project only accepted ingress or exact rejection');

  const beforeAfterEmissionCount = emittedLines.length;
  let afterLines;
  try {
    Date.now = () => publishedAt + 1;
    afterLines = emitRuntimeDiagnostics('probe_after');
  } finally {
    Date.now = originalNow;
  }
  assert.deepEqual(
    emittedLines.slice(beforeAfterEmissionCount),
    afterLines,
    'the factory must write exactly its second cursor emission',
  );
  assert.deepEqual(afterLines, [
    `${DE_RUNTIME_DIAGNOSTIC_MARKER} ${JSON.stringify(after)}`,
    `${DE_RUNTIME_TRACE_MARKER} ${JSON.stringify(traceEvidence)}`,
  ], 'the cursor factory must consume the actual runtime delta and emit the exact machine-readable lines');

  const noDeltaStart = emittedLines.length;
  const noDeltaLines = emitRuntimeDiagnostics('probe_without_delta');
  assert.deepEqual(emittedLines.slice(noDeltaStart), noDeltaLines);
  const noDeltaText = noDeltaLines.join('\n');
  assert.deepEqual(
    parseR1TraceDeltaLog(noDeltaText, {
      since: startedAt,
      notBefore: publishedAt,
      topic,
      marker: correlation.marker,
      responseTopic: correlation.responseTopic,
      outerPacketSha256: correlation.outerPacketSha256,
    }),
    [],
    'an old runtime rejection must not be rediscovered when the runner cursor delta is empty',
  );
  assert.equal(
    noDeltaText.includes(correlation.outerPacketSha256),
    false,
    'empty traceEntries must not project the old packet from current runtime state',
  );

  const sensitiveTraceEvidence = buildDeRuntimeTraceEvidence({
    runtime: r1.runtime,
    reason: 'probe_after',
    traceEntries: sensitiveTraceDelta,
  });
  assert.deepEqual(sensitiveTraceEvidence, traceEvidence, 'allowlisted projection must ignore raw secret aliases');
  const logText = afterLines.join('\n');
  assert.equal(logText.includes(secretSentinel), false, 'formatted runner evidence must omit raw secret material');
  assert.equal(logText.includes(tokenSentinel), false, 'formatted runner evidence must omit raw token material');
  assert.equal(logText.includes('"traceEntries"'), false, 'formatted runner evidence must not serialize the raw trace container');
  assert.equal(logText.includes('"raw_payload"'), false, 'formatted runner evidence must not serialize unrelated raw payload copies');
  assert.doesNotMatch(logText, /"payload":\{"version":"v1","type":"pin_payload"/u);
  const parsedAfter = parseR1DiagnosticLog(logText, { since: startedAt, phase: 'after' });
  const parsedTrace = parseR1TraceDeltaLog(logText, {
    since: startedAt,
    notBefore: publishedAt,
    topic,
    marker: correlation.marker,
    responseTopic: correlation.responseTopic,
    outerPacketSha256: correlation.outerPacketSha256,
  });
  assert.deepEqual(parsedAfter, after, 'production parser must consume the runner diagnostic marker');
  assert.equal(Array.isArray(parsedTrace), true, 'production parser must return a trace delta');
  const parsedRejection = parsedTrace.find((entry) => entry?.type === 'inbound_rejected');
  assert.deepEqual(
    parsedRejection,
    expectedProjectedTrace,
    'runner trace evidence must bind the rejection to the full packet and unique response address',
  );
  assert.deepEqual(evaluateLegacyPublicBoundaryEvidence({
    before,
    after: parsedAfter,
    traceDelta: parsedTrace,
    traceSince: startedAt,
    responseMessages: [],
    topic,
    startedAt,
    publishedAt,
    marker: correlation.marker,
    responseTopic: correlation.responseTopic,
    outerPacketSha256: correlation.outerPacketSha256,
  }), { ok: true, code: 'verified' });

  const runnerSource = readFileSync(runnerPath, 'utf8');
  assert.match(
    runnerSource,
    /const\s+runtimeDiagnostics\s*=\s*createRoleScopedDeRuntimeDiagnosticHeartbeat\(\{[\s\S]*?workerScope:\s*WORKER_SCOPE,[\s\S]*?runtime:\s*rt,/u,
    'shared runner must delegate cursor ownership through the production role-scoped lifecycle',
  );
  assert.match(runnerSource, /^runtimeDiagnostics\.start\(\);$/mu, 'runner must start the lifecycle after MQTT startup');
  assert.doesNotMatch(runnerSource, /\bcreateDeRuntimeDiagnosticEmitter\b/u, 'shared runner must not bypass role scoping');
  assert.doesNotMatch(runnerSource, /\bmqttTraceCursor\b|\bmqttTrace\.list\s*\(/u, 'runner must not retain a second cursor path');
  assert.doesNotMatch(runnerSource, /\bemitDeRuntimeDiagnosticLogLines\b/u, 'runner must not bypass the cursor factory');
  assert.doesNotMatch(
    runnerSource,
    /MQTT trace delta:/u,
    'runner must remove the raw MQTT trace-delta log once the allowlisted trace formatter exists',
  );
  assert.doesNotMatch(runnerSource, /DE_RUNTIME_(?:DIAGNOSTIC|TRACE)_MARKER[^\n]*JSON\.stringify/u);

  return { key: 'actual_runtime_rejection_round_trips_through_runner_log_schema_and_parser', status: 'PASS' };
}

async function test_production_parsers_select_newest_fresh_correlated_evidence_from_cumulative_logs() {
  const {
    parseR1DiagnosticLog,
    parseR1TraceDeltaLog,
  } = await loadProbeModule();
  assert.equal(typeof parseR1DiagnosticLog, 'function');
  assert.equal(typeof parseR1TraceDeltaLog, 'function');
  const correlation = probeCorrelation();
  const staleDiagnostic = validDiagnostic(exactRejection({ ts: publishedAt - 1 }));
  const olderFreshDiagnostic = validDiagnostic(exactRejection({ ts: publishedAt + 1 }));
  const newestFreshDiagnostic = validDiagnostic(exactRejection({ ts: publishedAt + 9 }));
  const cumulativeDiagnosticLog = [
    diagnosticLogLine(staleDiagnostic),
    'DE_RUNTIME_DIAGNOSTIC {malformed-json',
    diagnosticLogLine(olderFreshDiagnostic),
    diagnosticLogLine(validDiagnostic()),
    diagnosticLogLine(newestFreshDiagnostic),
  ].join('\n');
  assert.deepEqual(
    parseR1DiagnosticLog(cumulativeDiagnosticLog, {
      since: startedAt,
      phase: 'after',
      notBefore: publishedAt,
    }),
    newestFreshDiagnostic,
    'the production diagnostic parser must ignore stale, malformed, and wrong-phase records and select the newest fresh after record',
  );
  assert.deepEqual(
    parseR1DiagnosticLog(cumulativeDiagnosticLog, {
      since: startedAt,
      phase: 'before',
    }),
    newestFreshDiagnostic,
    'the before baseline must use the newest diagnostic even when it carries an older persisted error',
  );

  const staleTrace = exactTrace({ ts: publishedAt - 1 });
  const olderFreshTrace = exactTrace({ ts: publishedAt + 2 });
  const wrongCorrelationTrace = exactTrace({
    ts: publishedAt + 20,
    payload: {
      ...exactTrace().payload,
      probe_marker: 'different-probe',
    },
  });
  const newestFreshTrace = exactTrace({ ts: publishedAt + 10 });
  const cumulativeTraceLog = [
    traceLogLine([staleTrace]),
    traceLogLine([olderFreshTrace]),
    'DE_RUNTIME_TRACE {malformed-json',
    traceLogLine([wrongCorrelationTrace]),
    traceLogLine([newestFreshTrace]),
  ].join('\n');
  assert.deepEqual(
    parseR1TraceDeltaLog(cumulativeTraceLog, {
      since: startedAt,
      notBefore: publishedAt,
      topic,
      marker: correlation.marker,
      responseTopic: correlation.responseTopic,
      outerPacketSha256: correlation.outerPacketSha256,
    }),
    [newestFreshTrace],
    'the production trace parser must ignore stale, malformed, and wrong-correlation records and select the newest matching delta',
  );

  return {
    key: 'production_parsers_select_newest_fresh_correlated_evidence_from_cumulative_logs',
    status: 'PASS',
  };
}

async function test_cursor_emitter_and_parser_preserve_all_fresh_correlated_events() {
  const { createDeRuntimeDiagnosticEmitter } = await loadDiagnosticModule();
  const {
    evaluateLegacyPublicBoundaryEvidence,
    parseR1DiagnosticLog,
    parseR1TraceDeltaLog,
  } = await loadProbeModule();
  const correlation = probeCorrelation('cursor_cumulative');
  const r1 = loadSsotDeActor('r1');
  r1.runtime.setRuntimeMode('edit');
  r1.runtime.setRuntimeMode('running');
  const lines = [];
  const emitRuntimeDiagnostics = createDeRuntimeDiagnosticEmitter({
    runtime: r1.runtime,
    writeLine: (line) => lines.push(line),
  });
  assert.equal(typeof emitRuntimeDiagnostics, 'function');
  const baselineLines = emitRuntimeDiagnostics('probe_before');
  const before = parseR1DiagnosticLog(baselineLines.join('\n'), { since: startedAt, phase: 'before' });
  assert.ok(before, 'factory baseline must produce a parseable before diagnostic');

  const originalNow = Date.now;
  let handled;
  try {
    Date.now = () => publishedAt + 1;
    r1.runtime.mqttTrace.record('inbound', {
      topic,
      payload: correlation.packet,
      mode: 'pin_payload_v1',
      ingress_pin: 'r1_cb_in',
    });
    emitRuntimeDiagnostics('accepted_delta');

    Date.now = () => publishedAt + 2;
    handled = r1.runtime.mqttIncoming(topic, correlation.packet);
    emitRuntimeDiagnostics('rejected_delta');
  } finally {
    Date.now = originalNow;
  }
  assert.equal(handled, false, 'the actual runtime must still reject the removed packet');

  const expectedAccepted = exactAcceptedTrace(correlation);
  const expectedRejected = exactTrace({
    ts: publishedAt + 2,
    payload: {
      ...exactTrace().payload,
      probe_marker: correlation.marker,
      response_topic: correlation.responseTopic,
      outer_packet_sha256: correlation.outerPacketSha256,
    },
  });
  const cumulativeLog = lines.join('\n');
  const parsedTrace = parseR1TraceDeltaLog(cumulativeLog, {
    since: startedAt,
    notBefore: publishedAt,
    topic,
    marker: correlation.marker,
    responseTopic: correlation.responseTopic,
    outerPacketSha256: correlation.outerPacketSha256,
  });
  assert.deepEqual(
    parsedTrace,
    [expectedAccepted, expectedRejected],
    'cumulative parser may deduplicate repeated entries but must not discard an earlier fresh correlated ingress event',
  );
  const after = parseR1DiagnosticLog(cumulativeLog, {
    since: startedAt,
    phase: 'after',
    notBefore: publishedAt,
  });
  assert.ok(after, 'factory rejection emission must produce a parseable fresh after diagnostic');
  assert.deepEqual(
    evaluateLegacyPublicBoundaryEvidence({
      before,
      after,
      traceDelta: parsedTrace,
      traceSince: startedAt,
      responseMessages: [],
      topic,
      startedAt,
      publishedAt,
      marker: correlation.marker,
      responseTopic: correlation.responseTopic,
      outerPacketSha256: correlation.outerPacketSha256,
    }),
    { ok: false, code: 'legacy_packet_reached_ingress' },
    'a newer rejection must not hide an earlier accepted ingress for the same exact packet',
  );

  return { key: 'cursor_emitter_and_parser_preserve_all_fresh_correlated_events', status: 'PASS' };
}

async function test_verifier_executes_local_mosquitto_probe_without_actor_mutation() {
  const {
    LEGACY_PUBLIC_BOUNDARY_EVIDENCE_OPERATION_TIMEOUT_MS,
    LEGACY_PUBLIC_BOUNDARY_NETWORK_AUDIT_TIMEOUT_MS,
    LEGACY_PUBLIC_BOUNDARY_OPERATION_TIMEOUT_MS,
    LEGACY_PUBLIC_BOUNDARY_RESPONSE_QUIET_PERIOD_MS,
    runLegacyPublicBoundaryProbe,
  } = await loadVerifierModule();
  assert.equal(LEGACY_PUBLIC_BOUNDARY_RESPONSE_QUIET_PERIOD_MS, defaultResponseQuietPeriodMs);
  assert.equal(LEGACY_PUBLIC_BOUNDARY_OPERATION_TIMEOUT_MS, defaultOperationTimeoutMs);
  assert.equal(
    LEGACY_PUBLIC_BOUNDARY_EVIDENCE_OPERATION_TIMEOUT_MS,
    defaultEvidenceOperationTimeoutMs,
  );
  assert.ok(
    LEGACY_PUBLIC_BOUNDARY_EVIDENCE_OPERATION_TIMEOUT_MS > defaultEvidencePollTimeoutMs,
    'diagnostic and trace outer deadlines must leave the full inner heartbeat poll budget intact',
  );
  assert.equal(
    LEGACY_PUBLIC_BOUNDARY_NETWORK_AUDIT_TIMEOUT_MS,
    defaultNetworkBoundaryOperationTimeoutMs,
    'network audit must have a dedicated outer timeout longer than one producer heartbeat',
  );
  const source = readFileSync(verifierPath, 'utf8');
  assert.doesNotMatch(source, /\b(?:addLabel|removeLabel|rmLabel|applyPatch)\s*\(/u);
  assert.doesNotMatch(source, /dependencies\.responseMessages\b/u);

  const { evaluateLegacyPublicBoundaryEvidence } = await loadProbeModule();
  assert.equal(typeof runLegacyPublicBoundaryProbe, 'function');
  const correlation = probeCorrelation();
  const before = validDiagnostic();
  const after = validDiagnostic(exactRejection());
  const events = [];
  const diagnostics = [before, after];
  let messageListener = null;
  let errorListener = null;
  let evaluatedEvidence = null;
  const timers = createManualTimerHarness();
  const listeners = createProbeListenerHarness({
    onRegister: (event, listener) => {
      events.push(`mqtt:on:${event}`);
      if (event === 'message') messageListener = listener;
      if (event === 'error') errorListener = listener;
    },
  });
  const tunnel = {
    host: '127.0.0.1',
    port: 31883,
    close: async () => events.push('tunnel:close'),
  };
  const mqttClient = {
    on: listeners.on,
    subscribe: async (responseTopic) => events.push(`mqtt:subscribe:${responseTopic}`),
    publish: async (publishTopic, packet) => {
      events.push(`mqtt:publish:${publishTopic}`);
      assert.equal(publishTopic, topic);
      assert.deepEqual(packet, correlation.packet);
    },
    close: async () => events.push('mqtt:close'),
  };
  const result = await runLegacyPublicBoundaryProbe({
    marker: 'probe123',
    operationTimeoutMs: unitOperationTimeoutMs,
    networkBoundaryTimeoutMs: unitNetworkBoundaryOperationTimeoutMs,
    responseQuietPeriodMs: unitResponseQuietPeriodMs,
    dependencies: {
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      now: (() => {
        const values = [
          ['clock:acceptance', startedAt],
          ['clock:publish', publishedAt],
        ];
        return () => {
          assert.notEqual(values.length, 0, 'clock must be read only for acceptance start and publish time');
          const [event, value] = values.shift();
          events.push(event);
          return value;
        };
      })(),
      assertLocalOrbStack: async () => {
        assert.equal(
          timers.active.size,
          0,
          'local preflight must rely on its three command-level deadlines instead of a generic five-second outer cutoff',
        );
        events.push('context:orbstack');
      },
      openMosquittoTunnel: async (options) => {
        events.push(`tunnel:open:${options.namespace}:${options.service}:${options.host}`);
        assert.deepEqual(options, { namespace: 'dongyu', service: 'svc/mosquitto', host: '127.0.0.1' });
        return tunnel;
      },
      connectMqtt: async (options) => {
        events.push(`mqtt:connect:${options.host}:${options.port}`);
        assert.deepEqual(options, { host: tunnel.host, port: tunnel.port });
        return mqttClient;
      },
      readR1Diagnostic: async (options) => {
        const phase = diagnostics.length === 2 ? 'before' : 'after';
        events.push(`diagnostic:${phase}:${options.since}:${options.notBefore ?? 'none'}`);
        assert.deepEqual(
          options,
          phase === 'before'
            ? { since: startedAt, phase }
            : { since: startedAt, phase, notBefore: publishedAt },
        );
        return diagnostics.shift();
      },
      waitForSilence: async (options) => {
        events.push(`silence:${options.timeoutMs}`);
        assert.deepEqual(options, { timeoutMs: unitResponseQuietPeriodMs, notBefore: publishedAt });
        assert.equal(typeof messageListener, 'function', 'MQTT response collector must be active during the silence window');
        assert.equal(typeof errorListener, 'function', 'MQTT connection-error observer must be active during the silence window');
      },
      assertAcceptanceWindowNetworkBoundary: async (options) => {
        events.push(`network:audit:${options.since}`);
        assert.deepEqual(options, { since: startedAt });
        return { ok: true, scanned_deployments: acceptanceWindowDeployments };
      },
      readR1TraceDelta: async (options) => {
        events.push(`trace:${options.since}:${options.notBefore}`);
        assert.deepEqual(options, {
          since: startedAt,
          notBefore: publishedAt,
          topic,
          marker: correlation.marker,
          responseTopic: correlation.responseTopic,
          outerPacketSha256: correlation.outerPacketSha256,
        });
        return [exactTrace()];
      },
      evaluateEvidence: (evidence) => {
        events.push('evidence:evaluate');
        evaluatedEvidence = evidence;
        return evaluateLegacyPublicBoundaryEvidence(evidence);
      },
    },
  });
  assert.deepEqual(result, { ok: true, code: 'verified' });
  assertProbeListenersDisposed(listeners, { message: 1, error: 1 }, 'successful probe');
  assert.ok(timers.cleared.length > 0, 'successful probe must use the injected operation timers');
  assert.equal(
    timers.scheduled.filter((timeoutMs) => timeoutMs === unitNetworkBoundaryOperationTimeoutMs).length,
    1,
    'successful probe must wrap only the network audit in its dedicated outer timeout',
  );
  assert.equal(
    timers.scheduled.filter((timeoutMs) => timeoutMs === defaultEvidenceOperationTimeoutMs).length,
    3,
    'before diagnostic, after diagnostic, and trace must each use the dedicated evidence timeout',
  );
  assert.equal(timers.active.size, 0, 'successful probe must leave no operation timer behind');
  assert.deepEqual(evaluatedEvidence, {
    before,
    after,
    traceDelta: [exactTrace()],
    traceSince: startedAt,
    responseMessages: [],
    topic,
    startedAt,
    publishedAt,
    marker: correlation.marker,
    responseTopic: correlation.responseTopic,
    outerPacketSha256: correlation.outerPacketSha256,
  });
  assert.deepEqual(events, [
    'clock:acceptance',
    'context:orbstack',
    'tunnel:open:dongyu:svc/mosquitto:127.0.0.1',
    'mqtt:connect:127.0.0.1:31883',
    'mqtt:on:message',
    'mqtt:on:error',
    `mqtt:subscribe:${correlation.responseTopic}`,
    `diagnostic:before:${startedAt}:none`,
    'clock:publish',
    `mqtt:publish:${topic}`,
    `diagnostic:after:${startedAt}:${publishedAt}`,
    `trace:${startedAt}:${publishedAt}`,
    `silence:${unitResponseQuietPeriodMs}`,
    `network:audit:${startedAt}`,
    'evidence:evaluate',
    'mqtt:close',
    'tunnel:close',
  ]);

  return { key: 'verifier_executes_local_mosquitto_probe_without_actor_mutation', status: 'PASS' };
}

async function test_verifier_rejects_post_publish_mqtt_loss_during_silence_and_disposes_listeners() {
  const { runLegacyPublicBoundaryProbe } = await loadVerifierModule();
  let mqttCloses = 0;
  let tunnelCloses = 0;
  let diagnosticRead = 0;
  let evaluateCalls = 0;
  const timers = createManualTimerHarness();
  const listeners = createProbeListenerHarness();
  const execution = runLegacyPublicBoundaryProbe({
    marker: 'post_publish_mqtt_loss',
    operationTimeoutMs: unitOperationTimeoutMs,
    responseQuietPeriodMs: unitResponseQuietPeriodMs,
    dependencies: {
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      now: (() => {
        const values = [startedAt, publishedAt];
        return () => values.shift() ?? publishedAt;
      })(),
      assertLocalOrbStack: async () => undefined,
      openMosquittoTunnel: async () => ({
        host: '127.0.0.1',
        port: 31883,
        close: async () => {
          tunnelCloses += 1;
        },
      }),
      connectMqtt: async () => ({
        on: listeners.on,
        subscribe: async () => undefined,
        publish: async () => undefined,
        close: async () => {
          mqttCloses += 1;
        },
      }),
      readR1Diagnostic: async () => {
        diagnosticRead += 1;
        return diagnosticRead === 1 ? validDiagnostic() : validDiagnostic(exactRejection());
      },
      readR1TraceDelta: async () => [exactTrace()],
      waitForSilence: async () => {
        assert.equal(listeners.listenerCount('error'), 1, 'connection-error observer must stay active during silence');
        listeners.emitter.emit('error', new Error('simulated post-publish MQTT transport loss'));
        await flushAsyncTurn();
      },
      evaluateEvidence: () => {
        evaluateCalls += 1;
        return { ok: true, code: 'verified' };
      },
    },
  });

  await assert.rejects(
    execution,
    /mqtt_connection_lost/u,
    'a post-publish MQTT error during the silence window must fail instead of returning verified',
  );
  assert.equal(evaluateCalls, 0, 'evidence must not be evaluated after the MQTT connection is lost');
  assert.equal(mqttCloses, 1, 'post-publish MQTT loss closes the MQTT adapter exactly once');
  assert.equal(tunnelCloses, 1, 'post-publish MQTT loss closes the tunnel exactly once');
  assertProbeListenersDisposed(listeners, { message: 1, error: 1 }, 'post-publish MQTT loss');
  assert.equal(timers.active.size, 0, 'post-publish MQTT loss must leave no operation timer behind');

  return {
    key: 'verifier_rejects_post_publish_mqtt_loss_during_silence_and_disposes_listeners',
    status: 'PASS',
  };
}

async function test_verifier_closes_each_created_resource_once_at_every_failure_stage() {
  const { runLegacyPublicBoundaryProbe } = await loadVerifierModule();
  const stages = [
    ['context', 0, 0],
    ['tunnel', 0, 0],
    ['connect', 0, 1],
    ['subscribe', 1, 1],
    ['diagnostic_before', 1, 1],
    ['publish', 1, 1],
    ['diagnostic_after', 1, 1],
    ['trace', 1, 1],
    ['silence', 1, 1],
    ['network_boundary', 1, 1],
    ['evaluation', 1, 1],
  ];

  for (const [failureStage, expectedMqttCloses, expectedTunnelCloses] of stages) {
    let mqttCloses = 0;
    let tunnelCloses = 0;
    let diagnosticRead = 0;
    let messageListener = null;
    let errorListener = null;
    const timers = createManualTimerHarness();
    const listeners = createProbeListenerHarness({
      onRegister: (event, listener) => {
        if (event === 'message') messageListener = listener;
        if (event === 'error') errorListener = listener;
      },
    });
    const fail = (stage) => {
      if (failureStage === stage) throw new Error(`${stage} failure`);
    };
    const mqttClient = {
      on: listeners.on,
      subscribe: async () => fail('subscribe'),
      publish: async () => fail('publish'),
      close: async () => {
        mqttCloses += 1;
      },
    };
    const execution = runLegacyPublicBoundaryProbe({
      marker: `failure_${failureStage}`,
      responseQuietPeriodMs: unitResponseQuietPeriodMs,
      dependencies: {
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
        now: (() => {
          const values = [startedAt, publishedAt];
          return () => values.shift() ?? publishedAt;
        })(),
        assertLocalOrbStack: async () => fail('context'),
        openMosquittoTunnel: async () => {
          fail('tunnel');
          return {
            host: '127.0.0.1',
            port: 31883,
            close: async () => {
              tunnelCloses += 1;
            },
          };
        },
        connectMqtt: async () => {
          fail('connect');
          return mqttClient;
        },
        readR1Diagnostic: async () => {
          diagnosticRead += 1;
          const phase = diagnosticRead === 1 ? 'diagnostic_before' : 'diagnostic_after';
          fail(phase);
          return phase === 'diagnostic_before' ? validDiagnostic() : validDiagnostic(exactRejection());
        },
        waitForSilence: async () => fail('silence'),
        assertAcceptanceWindowNetworkBoundary: async () => {
          fail('network_boundary');
          return { ok: true, scanned_deployments: acceptanceWindowDeployments };
        },
        readR1TraceDelta: async () => {
          fail('trace');
          return [exactTrace()];
        },
        evaluateEvidence: () => {
          fail('evaluation');
          return { ok: true, code: 'verified' };
        },
      },
    });
    await assert.rejects(execution, new RegExp(`${failureStage} failure`, 'u'), failureStage);
    assert.equal(mqttCloses, expectedMqttCloses, `${failureStage}: MQTT close count`);
    assert.equal(tunnelCloses, expectedTunnelCloses, `${failureStage}: tunnel close count`);
    if (expectedMqttCloses === 1) {
      assert.equal(typeof messageListener, 'function', `${failureStage}: response collector registered before failure`);
      assert.equal(typeof errorListener, 'function', `${failureStage}: connection error listener registered before failure`);
    }
    const expectedRegistrations = expectedMqttCloses === 1
      ? { message: 1, error: 1 }
      : { message: 0, error: 0 };
    assertProbeListenersDisposed(listeners, expectedRegistrations, `${failureStage} failure`);
    assert.equal(timers.active.size, 0, `${failureStage}: failure must leave no operation timer behind`);
  }

  let resultMqttCloses = 0;
  let resultTunnelCloses = 0;
  const resultListeners = createProbeListenerHarness();
  const resultTimers = createManualTimerHarness();
  let diagnosticRead = 0;
  let evaluatedMessages = null;
  const evaluationFailure = await runLegacyPublicBoundaryProbe({
    marker: 'evaluation_result',
    responseQuietPeriodMs: unitResponseQuietPeriodMs,
    dependencies: {
      setTimer: resultTimers.setTimer,
      clearTimer: resultTimers.clearTimer,
      now: (() => {
        const values = [startedAt, publishedAt];
        return () => values.shift() ?? publishedAt;
      })(),
      assertLocalOrbStack: async () => undefined,
      openMosquittoTunnel: async () => ({
        host: '127.0.0.1',
        port: 31883,
        close: async () => {
          resultTunnelCloses += 1;
        },
      }),
      connectMqtt: async () => ({
        on: resultListeners.on,
        subscribe: async () => undefined,
        publish: async () => undefined,
        close: async () => {
          resultMqttCloses += 1;
        },
      }),
      readR1Diagnostic: async () => {
        diagnosticRead += 1;
        return diagnosticRead === 1 ? validDiagnostic() : validDiagnostic(exactRejection());
      },
      waitForSilence: async () => {
        assert.equal(resultListeners.listenerCount('message'), 1, 'message listener must remain registered at silence-window start');
        assert.equal(resultListeners.listenerCount('error'), 1, 'error listener must remain registered at silence-window start');
        await flushAsyncTurn();
        resultListeners.emitter.emit(
          'message',
          'UIPUT/ws/dam/pic/de/U1/3200/legacy_probe_evaluation_result',
          Buffer.from('{"unexpected":true}'),
        );
        await flushAsyncTurn();
        assert.equal(resultListeners.listenerCount('message'), 1, 'late response must be observed before the silence-window listener is disposed');
        assert.equal(resultListeners.listenerCount('error'), 1, 'error listener must remain registered through silence-window completion');
      },
      readR1TraceDelta: async () => [exactTrace()],
      assertAcceptanceWindowNetworkBoundary: async () => ({
        ok: true,
        scanned_deployments: acceptanceWindowDeployments,
      }),
      evaluateEvidence: (evidence) => {
        evaluatedMessages = evidence.responseMessages;
        return { ok: false, code: 'legacy_response_emitted' };
      },
    },
  });
  assert.deepEqual(evaluationFailure, { ok: false, code: 'legacy_response_emitted' });
  assert.deepEqual(evaluatedMessages, [{
    topic: 'UIPUT/ws/dam/pic/de/U1/3200/legacy_probe_evaluation_result',
    payload: '{"unexpected":true}',
  }]);
  assert.equal(resultMqttCloses, 1, 'evaluation failure result: MQTT closes exactly once');
  assert.equal(resultTunnelCloses, 1, 'evaluation failure result: tunnel closes exactly once');
  assertProbeListenersDisposed(
    resultListeners,
    { message: 1, error: 1 },
    'evaluation failure result',
  );
  assert.equal(resultTimers.active.size, 0, 'evaluation failure result must leave no operation timer behind');

  for (const {
    name,
    mqttCleanupFailure,
    tunnelCleanupFailure,
    primaryFailure,
    expectedFailure,
  } of [
    {
      name: 'mqtt_cleanup_failure',
      mqttCleanupFailure: true,
      tunnelCleanupFailure: false,
      primaryFailure: false,
      expectedFailure: 'mqtt cleanup failure',
    },
    {
      name: 'tunnel_cleanup_failure',
      mqttCleanupFailure: false,
      tunnelCleanupFailure: true,
      primaryFailure: false,
      expectedFailure: 'tunnel cleanup failure',
    },
    {
      name: 'thrown_primary_survives_mqtt_cleanup_failure',
      mqttCleanupFailure: true,
      tunnelCleanupFailure: false,
      primaryFailure: true,
      expectedFailure: 'primary probe failure',
    },
    {
      name: 'thrown_primary_survives_tunnel_cleanup_failure',
      mqttCleanupFailure: false,
      tunnelCleanupFailure: true,
      primaryFailure: true,
      expectedFailure: 'primary probe failure',
    },
    {
      name: 'thrown_primary_survives_both_cleanup_failures',
      mqttCleanupFailure: true,
      tunnelCleanupFailure: true,
      primaryFailure: true,
      expectedFailure: 'primary probe failure',
    },
  ]) {
    let cleanupMqttCloses = 0;
    let cleanupTunnelCloses = 0;
    const cleanupListeners = createProbeListenerHarness();
    const cleanupTimers = createManualTimerHarness();
    const execution = runLegacyPublicBoundaryProbe({
      marker: `cleanup_${name}`,
      responseQuietPeriodMs: unitResponseQuietPeriodMs,
      dependencies: {
        setTimer: cleanupTimers.setTimer,
        clearTimer: cleanupTimers.clearTimer,
        now: (() => {
          const values = [startedAt, publishedAt];
          return () => values.shift() ?? publishedAt;
        })(),
        assertLocalOrbStack: async () => undefined,
        openMosquittoTunnel: async () => ({
          host: '127.0.0.1',
          port: 31883,
          close: async () => {
            cleanupTunnelCloses += 1;
            if (tunnelCleanupFailure) throw new Error('tunnel cleanup failure');
          },
        }),
        connectMqtt: async () => ({
          on: cleanupListeners.on,
          subscribe: async () => undefined,
          publish: async () => undefined,
          close: async () => {
            cleanupMqttCloses += 1;
            if (mqttCleanupFailure) throw new Error('mqtt cleanup failure');
          },
        }),
        readR1Diagnostic: async ({ phase }) => phase === 'before'
          ? validDiagnostic()
          : validDiagnostic(exactRejection()),
        waitForSilence: async () => undefined,
        assertAcceptanceWindowNetworkBoundary: async () => ({
          ok: true,
          scanned_deployments: acceptanceWindowDeployments,
        }),
        readR1TraceDelta: async () => [exactTrace()],
        evaluateEvidence: () => {
          if (primaryFailure) throw new Error('primary probe failure');
          return { ok: true, code: 'verified' };
        },
      },
    });
    await assert.rejects(execution, (error) => {
      assert.equal(error?.message, expectedFailure, `${name}: preserve the primary failure exactly`);
      return true;
    }, name);
    assert.equal(cleanupMqttCloses, 1, `${name}: MQTT cleanup must be attempted exactly once`);
    assert.equal(cleanupTunnelCloses, 1, `${name}: tunnel cleanup must be attempted exactly once`);
    assertProbeListenersDisposed(cleanupListeners, { message: 1, error: 1 }, name);
    assert.equal(cleanupTimers.active.size, 0, `${name}: cleanup must leave no operation timer behind`);
  }

  for (const [name, mqttCleanupFailure, tunnelCleanupFailure] of [
    ['failed_result_survives_mqtt_cleanup_failure', true, false],
    ['failed_result_survives_tunnel_cleanup_failure', false, true],
    ['failed_result_survives_both_cleanup_failures', true, true],
  ]) {
    let cleanupMqttCloses = 0;
    let cleanupTunnelCloses = 0;
    const cleanupListeners = createProbeListenerHarness();
    const cleanupTimers = createManualTimerHarness();
    const failedResult = { ok: false, code: 'legacy_response_emitted' };
    const result = await runLegacyPublicBoundaryProbe({
      marker: `cleanup_${name}`,
      responseQuietPeriodMs: unitResponseQuietPeriodMs,
      dependencies: {
        setTimer: cleanupTimers.setTimer,
        clearTimer: cleanupTimers.clearTimer,
        now: (() => {
          const values = [startedAt, publishedAt];
          return () => values.shift() ?? publishedAt;
        })(),
        assertLocalOrbStack: async () => undefined,
        openMosquittoTunnel: async () => ({
          host: '127.0.0.1',
          port: 31883,
          close: async () => {
            cleanupTunnelCloses += 1;
            if (tunnelCleanupFailure) throw new Error('tunnel cleanup failure');
          },
        }),
        connectMqtt: async () => ({
          on: cleanupListeners.on,
          subscribe: async () => undefined,
          publish: async () => undefined,
          close: async () => {
            cleanupMqttCloses += 1;
            if (mqttCleanupFailure) throw new Error('mqtt cleanup failure');
          },
        }),
        readR1Diagnostic: async ({ phase }) => phase === 'before'
          ? validDiagnostic()
          : validDiagnostic(exactRejection()),
        waitForSilence: async () => undefined,
        assertAcceptanceWindowNetworkBoundary: async () => ({
          ok: true,
          scanned_deployments: acceptanceWindowDeployments,
        }),
        readR1TraceDelta: async () => [exactTrace()],
        evaluateEvidence: () => failedResult,
      },
    });
    assert.deepEqual(result, failedResult, `${name}: cleanup errors must not replace the primary failed result`);
    assert.equal(cleanupMqttCloses, 1, `${name}: MQTT cleanup must be attempted exactly once`);
    assert.equal(cleanupTunnelCloses, 1, `${name}: tunnel cleanup must be attempted exactly once`);
    assertProbeListenersDisposed(cleanupListeners, { message: 1, error: 1 }, name);
    assert.equal(cleanupTimers.active.size, 0, `${name}: failed result cleanup must leave no operation timer behind`);
  }

  return { key: 'verifier_closes_each_created_resource_once_at_every_failure_stage', status: 'PASS' };
}

async function test_verifier_times_out_each_network_operation_and_cleans_up_once() {
  const {
    LEGACY_PUBLIC_BOUNDARY_NETWORK_AUDIT_TIMEOUT_MS,
    LEGACY_PUBLIC_BOUNDARY_OPERATION_TIMEOUT_MS,
    runLegacyPublicBoundaryProbe,
  } = await loadVerifierModule();
  assert.equal(LEGACY_PUBLIC_BOUNDARY_OPERATION_TIMEOUT_MS, defaultOperationTimeoutMs);
  assert.equal(LEGACY_PUBLIC_BOUNDARY_NETWORK_AUDIT_TIMEOUT_MS, defaultNetworkBoundaryOperationTimeoutMs);
  const never = () => new Promise(() => undefined);

  for (const [stage, expectedCode, expectedMqttCloses] of [
    ['connect', 'mqtt_connect_timeout', 0],
    ['subscribe', 'mqtt_subscribe_timeout', 1],
    ['publish', 'mqtt_publish_timeout', 1],
    ['network_boundary', 'network_boundary_timeout', 1],
  ]) {
    let mqttCloses = 0;
    let tunnelCloses = 0;
    const timers = createManualTimerHarness();
    const listeners = createProbeListenerHarness();
    const mqttClient = {
      on: listeners.on,
      subscribe: stage === 'subscribe' ? never : async () => undefined,
      publish: stage === 'publish' ? never : async () => undefined,
      close: async () => {
        mqttCloses += 1;
      },
    };
    const dependencies = {
      now: (() => {
        const values = [startedAt, publishedAt];
        return () => values.shift() ?? publishedAt;
      })(),
      assertLocalOrbStack: async () => undefined,
      openMosquittoTunnel: async () => ({
        host: '127.0.0.1',
        port: 31883,
        close: async () => {
          tunnelCloses += 1;
        },
      }),
      connectMqtt: stage === 'connect' ? never : async () => mqttClient,
      readR1Diagnostic: async ({ phase }) => phase === 'before'
        ? validDiagnostic()
        : validDiagnostic(exactRejection()),
      readR1TraceDelta: async () => [exactTrace()],
      waitForSilence: async () => undefined,
      assertAcceptanceWindowNetworkBoundary: stage === 'network_boundary'
        ? never
        : async () => ({ ok: true, scanned_deployments: acceptanceWindowDeployments }),
      evaluateEvidence: () => ({ ok: true, code: 'verified' }),
    };
    dependencies.setTimer = timers.setTimer;
    dependencies.clearTimer = timers.clearTimer;

    const execution = runLegacyPublicBoundaryProbe({
      marker: `operation_timeout_${stage}`,
      operationTimeoutMs: unitOperationTimeoutMs,
      networkBoundaryTimeoutMs: unitNetworkBoundaryOperationTimeoutMs,
      responseQuietPeriodMs: unitResponseQuietPeriodMs,
      dependencies,
    });
    await flushAsyncTurn();
    assert.equal(timers.active.size, 1, `${stage}: pending operation must own exactly one timeout`);
    const expectedStageTimeoutMs = stage === 'network_boundary'
      ? unitNetworkBoundaryOperationTimeoutMs
      : unitOperationTimeoutMs;
    assert.equal(
      [...timers.active.values()][0].timeoutMs,
      expectedStageTimeoutMs,
      `${stage}: the currently pending stage must own its designated timeout budget`,
    );
    await timers.fireByTimeout(expectedStageTimeoutMs);
    await assert.rejects(
      execution,
      new RegExp(expectedCode, 'u'),
      `${stage} must fail within the injected operation timeout`,
    );
    assert.equal(mqttCloses, expectedMqttCloses, `${stage}: MQTT close count after timeout`);
    assert.equal(tunnelCloses, 1, `${stage}: tunnel close count after timeout`);
    assertProbeListenersDisposed(
      listeners,
      expectedMqttCloses === 1 ? { message: 1, error: 1 } : { message: 0, error: 0 },
      `${stage} operation timeout`,
    );
    assert.equal(timers.active.size, 0, `${stage}: timeout cleanup must leave no operation timer behind`);
    if (stage === 'network_boundary') {
      assert.equal(
        timers.scheduled.filter((timeoutMs) => timeoutMs === unitNetworkBoundaryOperationTimeoutMs).length,
        1,
        'network audit must schedule its dedicated outer timeout exactly once',
      );
    } else {
      assert.equal(
        timers.scheduled.includes(unitNetworkBoundaryOperationTimeoutMs),
        false,
        `${stage}: short MQTT stages must never consume the network-audit timeout budget`,
      );
    }
  }

  return { key: 'verifier_times_out_each_network_operation_and_cleans_up_once', status: 'PASS' };
}

async function test_default_dependencies_factory_locks_orbstack_local_mqtt_and_fresh_r1_logs() {
  const {
    LEGACY_PUBLIC_BOUNDARY_EVIDENCE_POLL_INTERVAL_MS,
    LEGACY_PUBLIC_BOUNDARY_EVIDENCE_POLL_TIMEOUT_MS,
    LEGACY_PUBLIC_BOUNDARY_LOG_READ_TIMEOUT_MS,
    LEGACY_PUBLIC_BOUNDARY_LOCAL_CHECK_TIMEOUT_MS,
    LEGACY_PUBLIC_BOUNDARY_MQTT_ADAPTER_TIMEOUT_MS,
    LEGACY_PUBLIC_BOUNDARY_NETWORK_AUDIT_TIMEOUT_MS,
    LEGACY_PUBLIC_BOUNDARY_PORT_FORWARD_CLOSE_TIMEOUT_MS,
    LEGACY_PUBLIC_BOUNDARY_PORT_FORWARD_READY_TIMEOUT_MS,
    createDefaultLegacyPublicBoundaryProbeDependencies,
    loadLocalAcceptanceEnvironment,
  } = await loadVerifierModule();
  const {
    buildDeNetworkBoundaryEvidence,
    formatDeNetworkBoundaryEvidenceLine,
  } = await loadNetworkBoundaryModule();
  assert.equal(typeof createDefaultLegacyPublicBoundaryProbeDependencies, 'function');
  assert.equal(typeof loadLocalAcceptanceEnvironment, 'function');
  assert.equal(LEGACY_PUBLIC_BOUNDARY_PORT_FORWARD_READY_TIMEOUT_MS, defaultPortForwardReadyTimeoutMs);
  assert.equal(LEGACY_PUBLIC_BOUNDARY_PORT_FORWARD_CLOSE_TIMEOUT_MS, defaultPortForwardCloseTimeoutMs);
  assert.equal(LEGACY_PUBLIC_BOUNDARY_EVIDENCE_POLL_TIMEOUT_MS, defaultEvidencePollTimeoutMs);
  assert.equal(LEGACY_PUBLIC_BOUNDARY_EVIDENCE_POLL_INTERVAL_MS, defaultEvidencePollIntervalMs);
  assert.equal(LEGACY_PUBLIC_BOUNDARY_LOG_READ_TIMEOUT_MS, defaultLogReadTimeoutMs);
  assert.equal(LEGACY_PUBLIC_BOUNDARY_LOCAL_CHECK_TIMEOUT_MS, defaultLocalCheckTimeoutMs);
  assert.equal(LEGACY_PUBLIC_BOUNDARY_MQTT_ADAPTER_TIMEOUT_MS, defaultMqttAdapterTimeoutMs);
  assert.equal(LEGACY_PUBLIC_BOUNDARY_NETWORK_AUDIT_TIMEOUT_MS, defaultNetworkBoundaryOperationTimeoutMs);
  assert.ok(
    LEGACY_PUBLIC_BOUNDARY_LOG_READ_TIMEOUT_MS < LEGACY_PUBLIC_BOUNDARY_EVIDENCE_POLL_TIMEOUT_MS,
    'one kubectl log read must time out strictly inside the total evidence-poll budget',
  );
  const localEnvPath = resolve(repoRoot, 'deploy/env/local.env');
  let loadedPath = null;
  const loadedEnvironment = loadLocalAcceptanceEnvironment({
    processEnv: {
      MQTT_HOST: 'process-override.example',
      FEISHU_API_BASE: 'https://open.feishu.cn/open-apis',
      FEISHU_APP_SECRET: 'process-secret-must-not-load',
    },
    localEnvPath,
    exists: (path) => {
      assert.equal(path, localEnvPath);
      return true;
    },
    readFile: (path) => {
      loadedPath = path;
      return [
        'MATRIX_HOMESERVER_URL=http://synapse.dongyu.svc.cluster.local:8008',
        'MQTT_HOST=mosquitto.dongyu.svc.cluster.local',
        'MQTT_PORT=1883',
        'FEISHU_API_BASE=https://wrong.example/open-apis',
        'FEISHU_APP_SECRET=file-secret-must-not-load',
        'MATRIX_ACCESS_TOKEN=file-token-must-not-load',
        'DY_MQTT_PASSWORD=file-password-must-not-load',
      ].join('\n');
    },
  });
  assert.equal(loadedPath, localEnvPath, 'clean-shell defaults may inspect only the ignored local endpoint env file');
  assert.deepEqual(loadedEnvironment, {
    MATRIX_HOMESERVER_URL: 'http://synapse.dongyu.svc.cluster.local:8008',
    MQTT_HOST: 'process-override.example',
    MQTT_PORT: '1883',
    FEISHU_API_BASE: 'https://open.feishu.cn/open-apis',
  }, 'only the endpoint allowlist is loaded and process environment values win');
  assert.equal(JSON.stringify(loadedEnvironment).includes('secret-must-not-load'), false);
  assert.equal(JSON.stringify(loadedEnvironment).includes('token-must-not-load'), false);
  assert.equal(JSON.stringify(loadedEnvironment).includes('password-must-not-load'), false);
  assert.ok(
    Math.max(networkHeartbeatIntervalMs, 3 * LEGACY_PUBLIC_BOUNDARY_LOG_READ_TIMEOUT_MS)
      + (2 * LEGACY_PUBLIC_BOUNDARY_LOG_READ_TIMEOUT_MS)
      + LEGACY_PUBLIC_BOUNDARY_EVIDENCE_POLL_INTERVAL_MS
      < LEGACY_PUBLIC_BOUNDARY_EVIDENCE_POLL_TIMEOUT_MS,
    'the evidence poll window must include heartbeat/config inspection, all three actor reads, and a poll interval',
  );
  assert.ok(
    LEGACY_PUBLIC_BOUNDARY_EVIDENCE_POLL_TIMEOUT_MS
      + (5 * LEGACY_PUBLIC_BOUNDARY_LOG_READ_TIMEOUT_MS)
      < LEGACY_PUBLIC_BOUNDARY_NETWORK_AUDIT_TIMEOUT_MS,
    'the dedicated network-audit timeout must leave room for the inner poll, three actor-log reads, two config reads, and cleanup',
  );
  assert.ok(
    defaultOperationTimeoutMs > LEGACY_PUBLIC_BOUNDARY_MQTT_ADAPTER_TIMEOUT_MS,
    'outer probe operation timeout must leave room for inner MQTT cleanup to finish first',
  );
  const correlation = probeCorrelation();
  const calls = [];
  const tunnelProcess = fakePortForwardProcess({ onKill: (signal) => calls.push(['kill', signal]) });
  const mqttJs = fakeMqttJsClient();
  const staleDiagnostic = validDiagnostic(exactRejection({ ts: publishedAt - 1 }));
  const freshDiagnostic = validDiagnostic(exactRejection({ ts: publishedAt + 9 }));
  const diagnosticMissing = diagnosticLogLine(staleDiagnostic);
  const diagnosticMalformed = `${diagnosticMissing}\nDE_RUNTIME_DIAGNOSTIC {malformed-json`;
  const diagnosticFresh = `${diagnosticMalformed}\n${diagnosticLogLine(freshDiagnostic)}`;
  const traceMissing = diagnosticFresh;
  const traceStale = `${traceMissing}\n${traceLogLine([exactTrace({ ts: publishedAt - 1 })])}\nDE_RUNTIME_TRACE {malformed-json`;
  const traceFresh = [
    traceStale,
    traceLogLine([exactTrace({
      ts: publishedAt + 20,
      payload: { ...exactTrace().payload, probe_marker: 'different-probe' },
    })]),
    traceLogLine([exactTrace({ ts: publishedAt + 10 })]),
  ].join('\n');
  const logOutputs = [
    diagnosticMissing,
    diagnosticMalformed,
    diagnosticFresh,
    traceMissing,
    traceStale,
    traceFresh,
  ];
  const networkLine = (kind, service, destination, ts) => formatDeNetworkBoundaryEvidenceLine(
    buildDeNetworkBoundaryEvidence({ kind, service, destination, ts }),
  );
  const acceptedNetworkLogs = new Map([
    [
      'deployment/mbr-worker',
      [
        networkLine('effective_config', 'mbr-worker', 'http://synapse.dongyu.svc.cluster.local:8008', startedAt - 1),
        networkLine('effective_config', 'mbr-worker', 'http://synapse.dongyu.svc.cluster.local:8008', startedAt + 1),
        networkLine('effective_config', 'mbr-worker', 'mqtt://mosquitto.dongyu.svc.cluster.local:1883', startedAt - 1),
        networkLine('effective_config', 'mbr-worker', 'mqtt://mosquitto.dongyu.svc.cluster.local:1883', startedAt + 1),
      ].join('\n'),
    ],
    [
      'deployment/remote-worker',
      [
        networkLine('effective_config', 'remote-worker', 'mqtt://mosquitto.dongyu.svc.cluster.local:1883', startedAt - 1),
        networkLine('effective_config', 'remote-worker', 'mqtt://mosquitto.dongyu.svc.cluster.local:1883', startedAt + 1),
      ].join('\n'),
    ],
    [
      'deployment/workspace-manager',
      [
        networkLine('effective_config', 'workspace-manager', 'mqtt://mosquitto.dongyu.svc.cluster.local:1883', startedAt - 1),
        networkLine('effective_config', 'workspace-manager', 'mqtt://mosquitto.dongyu.svc.cluster.local:1883', startedAt + 1),
        networkLine('outbound_attempt', 'workspace-manager', 'mqtt://mosquitto.dongyu.svc.cluster.local:1883', startedAt + 2),
      ].join('\n'),
    ],
  ]);
  const acceptedInspectedConfigs = new Map([
    ['deployment/synapse', 'listeners:\n  - port: 8008\n    bind_addresses: [0.0.0.0]\n'],
    ['deployment/mosquitto', 'listener 1883 0.0.0.0\nallow_anonymous false\n'],
  ]);
  let monotonicTime = 0;
  const dependencies = createDefaultLegacyPublicBoundaryProbeDependencies({
    execFile: async (command, args, options) => {
      calls.push(['execFile', command, args, options]);
      if (args[0] === 'config') return { stdout: 'orbstack\n' };
      if (command === 'bash') return { stdout: '[check] PASS local baseline\n' };
      if (args[0] === '-n' && args[2] === 'exec' && args[3] === 'deployment/mbr-worker') {
        return { stdout: '' };
      }
      if (args[0] === '-n' && args[2] === 'exec' && acceptedInspectedConfigs.has(args[3])) {
        return { stdout: acceptedInspectedConfigs.get(args[3]) };
      }
      if (args[0] === '-n' && args[2] === 'logs') {
        if (logOutputs.length > 0) return { stdout: logOutputs.shift() };
        assert.equal(
          acceptedNetworkLogs.has(args[3]),
          true,
          `unexpected deployment in acceptance-window network audit: ${args[3]}`,
        );
        return { stdout: acceptedNetworkLogs.get(args[3]) };
      }
      assert.fail(`unexpected default-dependency command: ${command} ${args.join(' ')}`);
    },
    spawn: (command, args) => {
      calls.push(['spawn', command, args]);
      queueMicrotask(() => tunnelProcess.stdout.emit('data', Buffer.from('Forwarding from 127.0.0.1:31883 -> 1883\n')));
      return tunnelProcess;
    },
    mqttConnect: (options) => {
      calls.push(['mqttConnect', options]);
      return mqttJs.client;
    },
    delay: async (timeoutMs) => {
      calls.push(['delay', timeoutMs]);
      monotonicTime += timeoutMs;
    },
    monotonicNow: () => monotonicTime,
    localCheckTimeoutMs: unitLocalCheckTimeoutMs,
    portForwardReadyTimeoutMs: 100,
    evidencePollTimeoutMs: 100,
    evidencePollIntervalMs: 5,
    logReadTimeoutMs: unitLogReadTimeoutMs,
    mqttOperationTimeoutMs: 100,
    env: {
      MATRIX_HOMESERVER_URL: 'http://synapse.dongyu.svc.cluster.local:8008',
      MQTT_HOST: 'mosquitto.dongyu.svc.cluster.local',
      DY_OIDC_ISSUER: '',
      DY_OIDC_PROXY_URL: '',
      FEISHU_API_BASE: 'https://open.feishu.cn/open-apis',
    },
  });

  await dependencies.assertLocalOrbStack();
  const tunnel = await dependencies.openMosquittoTunnel({
    namespace: 'dongyu',
    service: 'svc/mosquitto',
    host: '127.0.0.1',
  });
  assert.deepEqual({ host: tunnel.host, port: tunnel.port }, { host: '127.0.0.1', port: 31883 });
  let connectSettled = false;
  const connectPromise = dependencies.connectMqtt({ host: tunnel.host, port: tunnel.port });
  connectPromise.then(
    () => { connectSettled = true; },
    () => { connectSettled = true; },
  );
  await flushAsyncTurn();
  assert.equal(connectSettled, false, 'default MQTT adapter must not resolve before MQTT.js emits connect');
  mqttJs.client.emit('connect', { sessionPresent: false });
  const mqttAdapter = await connectPromise;
  assert.notEqual(mqttAdapter, mqttJs.client, 'default dependencies must return an awaited adapter, not the raw MQTT.js client');
  assert.equal(typeof mqttAdapter.on, 'function');
  assert.equal(typeof mqttAdapter.subscribe, 'function');
  assert.equal(typeof mqttAdapter.publish, 'function');
  assert.equal(typeof mqttAdapter.close, 'function');
  const messageListener = () => undefined;
  const errorListener = () => undefined;
  const disposeMessageListener = mqttAdapter.on('message', messageListener);
  const disposeErrorListener = mqttAdapter.on('error', errorListener);
  assert.equal(typeof disposeMessageListener, 'function', 'adapter.on(message) must return an explicit disposer');
  assert.equal(typeof disposeErrorListener, 'function', 'adapter.on(error) must return an explicit disposer');
  assert.equal(mqttJs.client.listenerCount('message'), 1, 'adapter.on must delegate message collection to MQTT.js');
  assert.equal(
    mqttJs.client.listenerCount('error'),
    2,
    'adapter.on(error) must add one external observer alongside the managed connection listener',
  );

  let subscribeSettled = false;
  const subscribePromise = mqttAdapter.subscribe(correlation.responseTopic);
  subscribePromise.then(
    () => { subscribeSettled = true; },
    () => { subscribeSettled = true; },
  );
  await flushAsyncTurn();
  assert.equal(subscribeSettled, false, 'subscribe must wait for the MQTT.js SUBACK callback');
  assert.equal(mqttJs.callbacks.subscribe.length, 1);
  mqttJs.callbacks.subscribe[0](null, [{ topic: correlation.responseTopic, qos: 0 }]);
  await subscribePromise;

  let publishSettled = false;
  const publishPromise = mqttAdapter.publish(topic, correlation.packet);
  publishPromise.then(
    () => { publishSettled = true; },
    () => { publishSettled = true; },
  );
  await flushAsyncTurn();
  assert.equal(publishSettled, false, 'publish must wait for the MQTT.js publish callback');
  const rawPublish = mqttJs.calls.find(([kind]) => kind === 'publish');
  assert.equal(rawPublish?.[1], topic);
  assert.deepEqual(JSON.parse(String(rawPublish?.[2])), correlation.packet, 'adapter must serialize the exact probe packet once');
  assert.equal(mqttJs.callbacks.publish.length, 1);
  mqttJs.callbacks.publish[0](null);
  await publishPromise;

  assert.deepEqual(
    await dependencies.readR1Diagnostic({ since: startedAt, phase: 'after', notBefore: publishedAt }),
    freshDiagnostic,
  );
  assert.deepEqual(
    await dependencies.readR1TraceDelta({
      since: startedAt,
      notBefore: publishedAt,
      topic,
      marker: correlation.marker,
      responseTopic: correlation.responseTopic,
      outerPacketSha256: correlation.outerPacketSha256,
    }),
    [exactTrace({ ts: publishedAt + 10 })],
  );
  await dependencies.waitForSilence({ timeoutMs: defaultResponseQuietPeriodMs, notBefore: publishedAt });
  assert.deepEqual(
    await dependencies.assertAcceptanceWindowNetworkBoundary({
      since: startedAt,
    }),
    { ok: true, scanned_deployments: acceptanceWindowDeployments },
    'the default verifier must scan every acceptance-window deployment before accepting the probe',
  );

  disposeMessageListener();
  disposeErrorListener();
  assert.equal(mqttJs.client.listenerCount('message'), 0, 'message disposer removes the raw MQTT.js listener');
  assert.equal(mqttJs.client.listenerCount('error'), 1, 'error disposer leaves only the managed connection listener');

  let closeSettled = false;
  const closePromise = mqttAdapter.close();
  closePromise.then(
    () => { closeSettled = true; },
    () => { closeSettled = true; },
  );
  await flushAsyncTurn();
  assert.equal(closeSettled, false, 'close must wait for the MQTT.js end callback');
  assert.equal(mqttJs.callbacks.end.length, 1);
  mqttJs.callbacks.end[0](null);
  await closePromise;
  await mqttAdapter.close();
  assert.equal(mqttJs.calls.filter(([kind]) => kind === 'end').length, 1, 'adapter cleanup must end MQTT.js exactly once');
  assert.equal(mqttJs.client.listenerCount('message'), 0, 'adapter close leaves no raw message listener');
  assert.equal(mqttJs.client.listenerCount('error'), 0, 'adapter close leaves no raw error listener');
  await tunnel.close();

  const sinceTime = new Date(startedAt).toISOString();
  assert.deepEqual(calls[0], [
    'execFile',
    'kubectl',
    ['config', 'current-context'],
    { timeout: unitLocalCheckTimeoutMs },
  ]);
  assert.deepEqual(calls[1], [
    'execFile',
    'bash',
    [resolve(repoRoot, 'scripts/ops/check_runtime_baseline.sh')],
    { cwd: repoRoot, timeout: unitLocalCheckTimeoutMs },
  ], 'default boundary must execute the existing deployed-baseline truth check');
  assert.deepEqual(calls[2], [
    'execFile',
    'kubectl',
    [
      '-n',
      'dongyu',
      'exec',
      'deployment/mbr-worker',
      '--',
      'node',
      '-e',
      synapseHealthScript,
    ],
    { timeout: unitLocalCheckTimeoutMs },
  ], 'default boundary must perform a bounded in-cluster local Synapse health fetch');
  assert.deepEqual(calls[3], ['spawn', 'kubectl', [
    '-n', 'dongyu', 'port-forward', '--address', '127.0.0.1', 'svc/mosquitto', '31883:1883',
  ]]);
  assert.deepEqual(calls.find((entry) => entry[0] === 'mqttConnect'), ['mqttConnect', { host: '127.0.0.1', port: 31883 }]);
  const logCalls = calls.filter((entry) => (
    entry[0] === 'execFile'
    && entry[2]?.[0] === '-n'
    && entry[2]?.[2] === 'logs'
  ));
  assert.equal(logCalls.length, 9, 'six R1 evidence reads plus fresh MBR/R1/WM1 network evidence reads are required');
  const evidenceLogCalls = logCalls.slice(0, 6);
  const networkAuditLogCalls = logCalls.slice(6);
  for (const entry of evidenceLogCalls) {
    assert.deepEqual(entry, ['execFile', 'kubectl', [
      '-n', 'dongyu', 'logs', 'deployment/remote-worker', '--since-time', sinceTime,
    ], { timeout: unitLogReadTimeoutMs }], 'every R1 evidence read must use the dedicated bounded timeout');
  }
  assert.deepEqual(
    networkAuditLogCalls,
    ['deployment/mbr-worker', 'deployment/remote-worker', 'deployment/workspace-manager'].map((deployment) => ['execFile', 'kubectl', [
      '-n', 'dongyu', 'logs', deployment, '--since-time', sinceTime,
    ], { timeout: unitLogReadTimeoutMs }]),
    'the post-acceptance audit must read fresh effective-config/outbound evidence from MBR, R1, and WM1',
  );
  assert.deepEqual(
    calls.filter((entry) => (
      entry[0] === 'execFile'
      && entry[2]?.[0] === '-n'
      && entry[2]?.[2] === 'exec'
      && ['deployment/synapse', 'deployment/mosquitto'].includes(entry[2]?.[3])
    )),
    [
      ['execFile', 'kubectl', [
        '-n', 'dongyu', 'exec', 'deployment/synapse', '--', 'cat', '/data/homeserver.yaml',
      ], { timeout: unitLogReadTimeoutMs }],
      ['execFile', 'kubectl', [
        '-n', 'dongyu', 'exec', 'deployment/mosquitto', '--', 'cat', '/mosquitto/config/mosquitto.conf',
      ], { timeout: unitLogReadTimeoutMs }],
    ],
    'Synapse and Mosquitto evidence must come from bounded inspection of deployed effective config',
  );
  assert.deepEqual(calls.filter((entry) => entry[0] === 'delay'), [
    ['delay', 5],
    ['delay', 5],
    ['delay', 5],
    ['delay', 5],
    ['delay', defaultResponseQuietPeriodMs],
  ]);
  assert.deepEqual(calls.at(-1), ['kill', 'SIGTERM']);

  return { key: 'default_dependencies_factory_locks_orbstack_local_mqtt_and_fresh_r1_logs', status: 'PASS' };
}

async function test_default_acceptance_window_network_audit_is_bounded_and_fail_closed() {
  const { createDefaultLegacyPublicBoundaryProbeDependencies } = await loadVerifierModule();
  const {
    buildDeNetworkBoundaryEvidence,
    formatDeNetworkBoundaryEvidenceLine,
    parseDeNetworkBoundaryEvidenceLines,
  } = await loadNetworkBoundaryModule();
  const verifierSource = readFileSync(verifierPath, 'utf8');
  const networkImport = verifierSource.match(
    /import\s*\{([^}]*)\}\s*from\s*['"]\.\/lib\/de_network_boundary_evidence\.mjs['"]/su,
  );
  assert.ok(networkImport, 'verifier must import the shared network evidence module');
  for (const exportedName of [
    'buildDeNetworkBoundaryEvidence',
    'evaluateDeNetworkBoundaryEvidence',
    'parseDeNetworkBoundaryEvidenceLines',
  ]) {
    assert.match(
      networkImport[1],
      new RegExp(`\\b${exportedName}\\b`, 'u'),
      `verifier must consume shared ${exportedName}`,
    );
  }
  assert.doesNotMatch(
    verifierSource,
    /(?:const|let|var)\s+DE_NETWORK_BOUNDARY_MARKER\b|function\s+(?:build|parse|evaluate)DeNetworkBoundaryEvidence\b/u,
    'verifier must not duplicate the shared marker or network evidence implementation',
  );
  const baseEnv = {
    MATRIX_HOMESERVER_URL: 'http://synapse.dongyu.svc.cluster.local:8008',
    DY_MQTT_HOST: '',
    DY_MQTT_PORT: '',
    MQTT_HOST: 'mosquitto.dongyu.svc.cluster.local',
    MQTT_PORT: '1883',
    DY_OIDC_ISSUER: '',
    DY_OIDC_PROXY_URL: '',
    FEISHU_API_BASE: 'https://open.feishu.cn/open-apis',
  };
  const line = (kind, service, destination, ts) => formatDeNetworkBoundaryEvidenceLine(
    buildDeNetworkBoundaryEvidence({ kind, service, destination, ts }),
  );
  const actorProducerOutput = (service, destination) => {
    const staleStartup = buildDeNetworkBoundaryEvidence({
      kind: 'effective_config',
      service,
      destination,
      ts: startedAt - 1,
    });
    const freshInterval = buildDeNetworkBoundaryEvidence({
      kind: 'effective_config',
      service,
      destination,
      ts: startedAt + networkHeartbeatIntervalMs,
    });
    const log = [staleStartup, freshInterval]
      .map((entry) => formatDeNetworkBoundaryEvidenceLine(entry))
      .join('\n');
    assert.deepEqual(
      parseDeNetworkBoundaryEvidenceLines(log, { since: startedAt }),
      [freshInterval],
      `${service}: shared parser must preserve the fresh interval producer record unchanged and exclude startup evidence`,
    );
    return { freshInterval, log, staleStartup };
  };
  const mbrMatrixProducerOutput = actorProducerOutput(
    'mbr-worker',
    'http://synapse.dongyu.svc.cluster.local:8008',
  );
  const mbrMqttProducerOutput = actorProducerOutput(
    'mbr-worker',
    'mqtt://mosquitto.dongyu.svc.cluster.local:1883',
  );
  const remoteProducerOutput = actorProducerOutput(
    'remote-worker',
    'mqtt://mosquitto.dongyu.svc.cluster.local:1883',
  );
  const workspaceEffectiveProducerOutput = actorProducerOutput(
    'workspace-manager',
    'mqtt://mosquitto.dongyu.svc.cluster.local:1883',
  );
  const workspaceOutboundProducerOutput = {
    freshInterval: buildDeNetworkBoundaryEvidence({
      kind: 'outbound_attempt',
      service: 'workspace-manager',
      destination: 'mqtt://mosquitto.dongyu.svc.cluster.local:1883',
      ts: startedAt + networkHeartbeatIntervalMs,
    }),
  };
  workspaceOutboundProducerOutput.log = formatDeNetworkBoundaryEvidenceLine(
    workspaceOutboundProducerOutput.freshInterval,
  );
  const acceptedLogs = {
    'deployment/mbr-worker': [mbrMatrixProducerOutput.log, mbrMqttProducerOutput.log].join('\n'),
    'deployment/remote-worker': remoteProducerOutput.log,
    'deployment/workspace-manager': [
      workspaceEffectiveProducerOutput.log,
      workspaceOutboundProducerOutput.log,
    ].join('\n'),
  };
  const delayedAcceptedLogs = {
    'deployment/mbr-worker': (elapsedMs) => [
      formatDeNetworkBoundaryEvidenceLine(mbrMatrixProducerOutput.staleStartup),
      formatDeNetworkBoundaryEvidenceLine(mbrMqttProducerOutput.staleStartup),
      ...(elapsedMs >= networkHeartbeatIntervalMs
        ? [
          formatDeNetworkBoundaryEvidenceLine(mbrMatrixProducerOutput.freshInterval),
          formatDeNetworkBoundaryEvidenceLine(mbrMqttProducerOutput.freshInterval),
        ]
        : []),
    ].join('\n'),
    'deployment/remote-worker': (elapsedMs) => [
      formatDeNetworkBoundaryEvidenceLine(remoteProducerOutput.staleStartup),
      ...(elapsedMs >= networkHeartbeatIntervalMs
        ? [formatDeNetworkBoundaryEvidenceLine(remoteProducerOutput.freshInterval)]
        : []),
    ].join('\n'),
    'deployment/workspace-manager': (elapsedMs) => [
      formatDeNetworkBoundaryEvidenceLine(workspaceEffectiveProducerOutput.staleStartup),
      ...(elapsedMs >= networkHeartbeatIntervalMs
        ? [
          formatDeNetworkBoundaryEvidenceLine(workspaceEffectiveProducerOutput.freshInterval),
          workspaceOutboundProducerOutput.log,
        ]
        : []),
    ].join('\n'),
  };
  const acceptedConfigs = {
    'deployment/synapse': 'listeners:\n  - port: 8008\n    bind_addresses: [0.0.0.0]\n',
    'deployment/mosquitto': 'listener 1883 0.0.0.0\nallow_anonymous false\n',
  };
  const createAudit = ({
    logs = acceptedLogs,
    configs = acceptedConfigs,
    execFileOverride = null,
    timers = createManualTimerHarness(),
    env = baseEnv,
    evidencePollIntervalMs = 1000,
    evidencePollTimeoutMs = defaultEvidencePollTimeoutMs,
    execDurationMs = 0,
  } = {}) => {
    const calls = [];
    let monotonicTime = 0;
    const defaultExec = async (command, args) => {
      assert.equal(command, 'kubectl', 'the acceptance-window audit may only inspect local Kubernetes resources');
      assert.equal(args[0], '-n');
      assert.equal(args[1], 'dongyu');
      if (args[2] === 'logs') {
        assert.equal(Object.hasOwn(logs, args[3]), true, `missing audit log fixture for ${args[3]}`);
        const output = logs[args[3]];
        return { stdout: typeof output === 'function' ? output(monotonicTime) : output };
      }
      if (args[2] === 'exec') {
        assert.equal(Object.hasOwn(configs, args[3]), true, `missing deployed-config fixture for ${args[3]}`);
        return { stdout: configs[args[3]] };
      }
      assert.fail(`unexpected acceptance-window inspection: ${command} ${args.join(' ')}`);
    };
    const dependencies = createDefaultLegacyPublicBoundaryProbeDependencies({
      execFile: async (command, args, options) => {
        calls.push(['execFile', command, args, options]);
        if (execFileOverride) {
          const overridden = await execFileOverride(command, args, options);
          if (overridden !== undefined) {
            monotonicTime += execDurationMs;
            return overridden;
          }
        }
        const result = await defaultExec(command, args, options);
        monotonicTime += execDurationMs;
        return result;
      },
      spawn: () => assert.fail('the acceptance-window audit must not create another tunnel'),
      mqttConnect: () => assert.fail('the acceptance-window audit must not create another MQTT connection'),
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      delay: async (timeoutMs) => {
        calls.push(['delay', timeoutMs]);
        monotonicTime += timeoutMs;
      },
      monotonicNow: () => monotonicTime,
      evidencePollIntervalMs,
      evidencePollTimeoutMs,
      logReadTimeoutMs: unitLogReadTimeoutMs,
      env,
    });
    return { calls, dependencies, monotonicNow: () => monotonicTime, timers };
  };
  const auditOptions = { since: startedAt };
  const sinceTime = new Date(startedAt).toISOString();

  const accepted = createAudit({ logs: delayedAcceptedLogs });
  assert.deepEqual(
    await accepted.dependencies.assertAcceptanceWindowNetworkBoundary(auditOptions),
    { ok: true, scanned_deployments: acceptanceWindowDeployments },
  );
  const acceptedLogCalls = accepted.calls.filter((entry) => entry[0] === 'execFile' && entry[2]?.[2] === 'logs');
  assert.equal(
    acceptedLogCalls.length,
    33,
    'audit must read all three actor logs at t=0 and each second through the first real ten-second heartbeat',
  );
  for (const deployment of ['deployment/mbr-worker', 'deployment/remote-worker', 'deployment/workspace-manager']) {
    assert.deepEqual(
      acceptedLogCalls.filter((entry) => entry[2]?.[3] === deployment),
      Array.from({ length: 11 }, () => ['execFile', 'kubectl', [
        '-n', 'dongyu', 'logs', deployment, '--since-time', sinceTime,
      ], { timeout: unitLogReadTimeoutMs }]),
      `${deployment}: every actor-log poll must remain local and individually bounded`,
    );
  }
  assert.deepEqual(
    accepted.calls.filter((entry) => entry[0] === 'delay'),
    Array.from({ length: 10 }, () => ['delay', 1000]),
    'stale-only evidence must keep the audit pending until the next real heartbeat becomes visible',
  );
  assert.equal(accepted.monotonicNow(), networkHeartbeatIntervalMs, 'accepted audit must advance exactly one heartbeat interval');
  assert.deepEqual(
    accepted.calls.filter((entry) => entry[0] === 'execFile' && entry[2]?.[2] === 'exec'),
    [
      ['execFile', 'kubectl', [
        '-n', 'dongyu', 'exec', 'deployment/synapse', '--', 'cat', '/data/homeserver.yaml',
      ], { timeout: unitLogReadTimeoutMs }],
      ['execFile', 'kubectl', [
        '-n', 'dongyu', 'exec', 'deployment/mosquitto', '--', 'cat', '/mosquitto/config/mosquitto.conf',
      ], { timeout: unitLogReadTimeoutMs }],
    ],
    'deployed Synapse and Mosquitto configuration must each be inspected once, not on every actor-log poll',
  );
  assert.equal(accepted.timers.active.size, 0, 'successful network audit must clear every read/inspection timer');

  const worstCaseReadAccepted = createAudit({
    logs: delayedAcceptedLogs,
    execDurationMs: defaultLogReadTimeoutMs,
  });
  assert.deepEqual(
    await worstCaseReadAccepted.dependencies.assertAcceptanceWindowNetworkBoundary(auditOptions),
    { ok: true, scanned_deployments: acceptanceWindowDeployments },
    'the inner deadline must survive two config reads and both actor reads at their allowed worst-case duration',
  );
  assert.equal(worstCaseReadAccepted.timers.active.size, 0, 'worst-case successful audit must clear every timer');

  const swappedActorIdentity = createAudit({
    logs: {
      'deployment/mbr-worker': remoteProducerOutput.log,
      'deployment/remote-worker': [mbrMatrixProducerOutput.log, mbrMqttProducerOutput.log].join('\n'),
      'deployment/workspace-manager': acceptedLogs['deployment/workspace-manager'],
    },
  });
  await assert.rejects(
    swappedActorIdentity.dependencies.assertAcceptanceWindowNetworkBoundary(auditOptions),
    /(?:acceptance_window_network_boundary_violation|missing_fresh_network_boundary_evidence)/u,
    'fresh evidence must be attributed to the deployment whose actor service produced it',
  );
  assert.equal(swappedActorIdentity.timers.active.size, 0, 'actor-identity mismatch must clear every timer');

  const exactFeishuAttempt = createAudit({
    logs: {
      ...acceptedLogs,
      'deployment/remote-worker': [
        acceptedLogs['deployment/remote-worker'],
        line(
          'outbound_attempt',
          'remote-worker',
          `https://${allowedFeishuHostname}/open-apis`,
          startedAt + 2,
        ),
      ].join('\n'),
    },
  });
  assert.deepEqual(
    await exactFeishuAttempt.dependencies.assertAcceptanceWindowNetworkBoundary(auditOptions),
    { ok: true, scanned_deployments: acceptanceWindowDeployments },
    'an optional outbound attempt may pass only for exact HTTPS open.feishu.cn',
  );
  assert.equal(exactFeishuAttempt.timers.active.size, 0, 'allowed optional outbound attempt must clear every timer');

  for (const [name, malformedLine] of [
    ['invalid_json_outbound', 'DE_NETWORK_BOUNDARY {malformed-outbound-json'],
    [
      'extra_field_outbound',
      `DE_NETWORK_BOUNDARY ${JSON.stringify({
        ...remoteProducerOutput.freshInterval,
        kind: 'outbound_attempt',
        unexpected: true,
      })}`,
    ],
    [
      'stale_extra_field_outbound',
      `DE_NETWORK_BOUNDARY ${JSON.stringify({
        ...remoteProducerOutput.staleStartup,
        kind: 'outbound_attempt',
        unexpected: true,
      })}`,
    ],
  ]) {
    const malformed = createAudit({
      logs: {
        ...acceptedLogs,
        'deployment/remote-worker': `${acceptedLogs['deployment/remote-worker']}\n${malformedLine}`,
      },
    });
    await assert.rejects(
      malformed.dependencies.assertAcceptanceWindowNetworkBoundary(auditOptions),
      /invalid_network_boundary_evidence/u,
      `${name}: a valid heartbeat must never hide a malformed outbound marker`,
    );
    assert.equal(malformed.timers.active.size, 0, `${name}: malformed evidence rejection must clear every timer`);
  }

  for (const required of requiredNetworkBoundaryEvidence.filter((entry) => (
    entry.service === 'mbr-worker' || entry.service === 'remote-worker'
  ))) {
    const deployment = `deployment/${required.service}`;
    const retainedLines = acceptedLogs[deployment].split('\n').filter((rawLine) => {
      const payload = JSON.parse(rawLine.slice('DE_NETWORK_BOUNDARY '.length));
      return !(
        payload.service === required.service
        && payload.kind === required.kind
        && payload.protocol === required.protocol
      );
    });
    const missing = createAudit({ logs: { ...acceptedLogs, [deployment]: retainedLines.join('\n') } });
    await assert.rejects(
      missing.dependencies.assertAcceptanceWindowNetworkBoundary(auditOptions),
      new RegExp(`missing_fresh_network_boundary_evidence:${required.service}:${required.kind}`, 'u'),
      `missing ${required.service}/${required.kind} must fail closed`,
    );
    assert.equal(missing.timers.active.size, 0, 'missing evidence rejection must clear every timer');
  }

  const staleOnly = createAudit({
    logs: {
      'deployment/mbr-worker': [
        formatDeNetworkBoundaryEvidenceLine(mbrMatrixProducerOutput.staleStartup),
        formatDeNetworkBoundaryEvidenceLine(mbrMqttProducerOutput.staleStartup),
      ].join('\n'),
      'deployment/remote-worker': formatDeNetworkBoundaryEvidenceLine(remoteProducerOutput.staleStartup),
      'deployment/workspace-manager': formatDeNetworkBoundaryEvidenceLine(
        workspaceEffectiveProducerOutput.staleStartup,
      ),
    },
  });
  await assert.rejects(
    staleOnly.dependencies.assertAcceptanceWindowNetworkBoundary(auditOptions),
    /missing_fresh_network_boundary_evidence/u,
    'stale-only actor evidence must wait for the full bounded poll window before failing closed',
  );
  assert.equal(
    staleOnly.monotonicNow(),
    defaultEvidencePollTimeoutMs,
    'stale-only evidence must consume exactly the fifteen-second inner poll budget',
  );
  assert.deepEqual(
    staleOnly.calls.filter((entry) => entry[0] === 'delay'),
    Array.from({ length: defaultEvidencePollTimeoutMs / 1000 }, () => ['delay', 1000]),
    'stale-only evidence must poll deterministically until its inner deadline',
  );
  assert.equal(staleOnly.timers.active.size, 0, 'stale-only timeout must clear every read/inspection timer');

  for (const [name, logs, configs, pattern] of [
    ['empty_runtime_logs', {
      'deployment/mbr-worker': '',
      'deployment/remote-worker': '',
      'deployment/workspace-manager': '',
    }, acceptedConfigs, /missing_fresh_network_boundary_evidence/u],
    ['missing_only_mbr_mqtt_effective_config', {
      ...acceptedLogs,
      'deployment/mbr-worker': mbrMatrixProducerOutput.log,
    }, acceptedConfigs, /missing_fresh_network_boundary_evidence:mbr-worker:effective_config/u],
    ['only_stale_remote_worker_startup_evidence', {
      ...acceptedLogs,
      'deployment/remote-worker': formatDeNetworkBoundaryEvidenceLine(remoteProducerOutput.staleStartup),
    }, acceptedConfigs, /missing_fresh_network_boundary_evidence:remote-worker/u],
    ['missing_synapse_effective_config', acceptedLogs, {
      ...acceptedConfigs,
      'deployment/synapse': 'server_name: localhost\n',
    }, /missing_fresh_network_boundary_evidence:synapse:effective_config/u],
    ['synapse_bind_belongs_to_a_different_listener', acceptedLogs, {
      ...acceptedConfigs,
      'deployment/synapse': [
        'listeners:',
        '  - port: 8008',
        '    bind_addresses: ["127.0.0.1"]',
        '  - port: 9000',
        '    bind_addresses: ["0.0.0.0"]',
        '',
      ].join('\n'),
    }, /missing_fresh_network_boundary_evidence:synapse:effective_config/u],
    ['missing_mosquitto_effective_config', acceptedLogs, {
      ...acceptedConfigs,
      'deployment/mosquitto': 'allow_anonymous false\n',
    }, /missing_fresh_network_boundary_evidence:mosquitto:effective_config/u],
    ['commented_mosquitto_listener_is_not_effective_config', acceptedLogs, {
      ...acceptedConfigs,
      'deployment/mosquitto': '# listener 1883 0.0.0.0\nlistener 1883 127.0.0.1\n',
    }, /missing_fresh_network_boundary_evidence:mosquitto:effective_config/u],
  ]) {
    const missing = createAudit({ logs, configs });
    await assert.rejects(missing.dependencies.assertAcceptanceWindowNetworkBoundary(auditOptions), pattern, name);
    assert.equal(missing.timers.active.size, 0, `${name}: fail-closed audit must clear every timer`);
  }

  for (const [name, deployment, evidence] of [
    [
      'remote_matrix',
      'deployment/mbr-worker',
      line('outbound_attempt', 'mbr-worker', 'https://matrix.dongyudigital.com', startedAt + 4),
    ],
    [
      'matrix_lookalike',
      'deployment/mbr-worker',
      line('outbound_attempt', 'mbr-worker', 'http://synapse.dongyu.svc.cluster.local.evil.test:8008', startedAt + 4),
    ],
    [
      'remote_mqtt',
      'deployment/remote-worker',
      line('outbound_attempt', 'remote-worker', 'mqtt://mqtt.dongyudigital.com:1883', startedAt + 4),
    ],
    [
      'workspace_manager_remote_mqtt',
      'deployment/workspace-manager',
      line('outbound_attempt', 'workspace-manager', 'mqtt://mqtt.dongyudigital.com:1883', startedAt + 4),
    ],
    [
      'mqtt_lookalike',
      'deployment/remote-worker',
      line('outbound_attempt', 'remote-worker', 'mqtt://mosquitto.dongyu.svc.cluster.local.evil.test:1883', startedAt + 4),
    ],
    [
      'remote_oidc',
      'deployment/remote-worker',
      line('outbound_attempt', 'remote-worker', 'https://id.dongyudigital.com', startedAt + 4),
    ],
    [
      'oidc_lookalike',
      'deployment/remote-worker',
      line('outbound_attempt', 'remote-worker', 'https://id.dongyudigital.com.evil.test', startedAt + 4),
    ],
    [
      'non_https_feishu',
      'deployment/remote-worker',
      line('outbound_attempt', 'remote-worker', 'http://open.feishu.cn/open-apis', startedAt + 4),
    ],
    [
      'feishu_hostname_lookalike',
      'deployment/remote-worker',
      line('outbound_attempt', 'remote-worker', 'https://open.feishu.cn.evil.test/open-apis', startedAt + 4),
    ],
    [
      'feishu_wrong_port',
      'deployment/remote-worker',
      line('outbound_attempt', 'remote-worker', 'https://open.feishu.cn:444/open-apis', startedAt + 4),
    ],
    [
      'feishu_userinfo_lookalike',
      'deployment/remote-worker',
      line('outbound_attempt', 'remote-worker', 'https://open.feishu.cn@evil.test/open-apis', startedAt + 4),
    ],
  ]) {
    const boundary = createAudit({
      logs: { ...acceptedLogs, [deployment]: `${acceptedLogs[deployment]}\n${evidence}` },
    });
    await assert.rejects(
      boundary.dependencies.assertAcceptanceWindowNetworkBoundary(auditOptions),
      /acceptance_window_network_boundary_violation/u,
      name,
    );
    assert.equal(boundary.timers.active.size, 0, `${name}: rejection must clear every deployment-log timer`);
  }

  for (const [stage, target] of [
    ['runtime_log', 'deployment/mbr-worker'],
    ['synapse_inspection', 'deployment/synapse'],
    ['mosquitto_inspection', 'deployment/mosquitto'],
  ]) {
    const readFailure = createAudit({
      execFileOverride: async (_command, args) => {
        if (args[3] === target) throw new Error(`simulated ${stage} read failure`);
        return undefined;
      },
    });
    await assert.rejects(
      readFailure.dependencies.assertAcceptanceWindowNetworkBoundary(auditOptions),
      /acceptance_window_(?:log|config)_read_failed.*simulated/u,
      `${stage} failures must fail closed`,
    );
    assert.equal(readFailure.timers.active.size, 0, `${stage} failure must clear every timer`);
  }

  const timeoutTimers = createManualTimerHarness();
  const never = new Promise(() => undefined);
  const timedOut = createAudit({
    timers: timeoutTimers,
    execFileOverride: async () => never,
  });
  const timedOutExecution = timedOut.dependencies.assertAcceptanceWindowNetworkBoundary(auditOptions);
  await flushAsyncTurn();
  assert.ok(timeoutTimers.active.size > 0, 'pending deployment-log reads must own bounded timers');
  const firstReadTimer = [...timeoutTimers.active.entries()]
    .find(([, timer]) => timer.timeoutMs === unitLogReadTimeoutMs);
  assert.ok(firstReadTimer, 'at least one deployment-log read must use the dedicated timeout');
  await timeoutTimers.fire(firstReadTimer[0]);
  await assert.rejects(
    timedOutExecution,
    /acceptance_window_(?:log|config)_read_timeout/u,
    'a never-resolving log/config inspection must reject within its own timeout',
  );
  assert.equal(timeoutTimers.active.size, 0, 'timed-out deployment-log audit must leave no timer behind');

  const deadlineCappedTimers = createManualTimerHarness();
  let deadlineCappedMbrReads = 0;
  const deadlineCappedMissing = createAudit({
    configs: {
      ...acceptedConfigs,
      'deployment/synapse': 'server_name: localhost\n',
    },
    timers: deadlineCappedTimers,
    evidencePollTimeoutMs: 12,
    evidencePollIntervalMs: 1,
    execDurationMs: 2,
    execFileOverride: async (_command, args) => {
      if (args[2] !== 'logs' || args[3] !== 'deployment/mbr-worker') return undefined;
      deadlineCappedMbrReads += 1;
      return deadlineCappedMbrReads === 2 ? never : undefined;
    },
  });
  const deadlineCappedExecution = deadlineCappedMissing.dependencies
    .assertAcceptanceWindowNetworkBoundary(auditOptions);
  await flushAsyncTurn();
  assert.equal(deadlineCappedMbrReads, 2, 'the audit must enter one deadline-capped retry after recording the known gap');
  const deadlineCappedReadTimer = [...deadlineCappedTimers.active.entries()]
    .find(([, timer]) => timer.timeoutMs === 1);
  assert.ok(deadlineCappedReadTimer, 'the final MBR read must be capped to the one millisecond remaining poll budget');
  await deadlineCappedTimers.fire(deadlineCappedReadTimer[0]);
  const deadlineCappedError = await deadlineCappedExecution.then(
    () => null,
    (error) => error,
  );
  assert.ok(deadlineCappedError instanceof Error, 'the deadline-capped audit must reject');
  assert.match(
    String(deadlineCappedError.message || deadlineCappedError),
    /missing_fresh_network_boundary_evidence:synapse:effective_config/u,
    `a deadline-capped retry must preserve the known Synapse evidence gap; actual=${deadlineCappedError.message}`,
  );
  assert.equal(deadlineCappedTimers.active.size, 0, 'deadline-capped missing-evidence rejection must clear every timer');

  const remainingBudget = createAudit({
    evidencePollTimeoutMs: 10,
    execDurationMs: 3,
  });
  await assert.rejects(
    remainingBudget.dependencies.assertAcceptanceWindowNetworkBoundary(auditOptions),
    /acceptance_window_network_budget_exhausted/u,
    'sequential successful reads that consume the total poll window must still fail within that window',
  );
  assert.deepEqual(
    remainingBudget.calls
      .filter((entry) => entry[0] === 'execFile')
      .map((entry) => entry[3]?.timeout),
    [4, 4, 4, 1],
    'every sequential config/log read must be capped by min(per-read timeout, remaining poll budget)',
  );
  assert.equal(remainingBudget.monotonicNow(), 12);
  assert.equal(remainingBudget.timers.active.size, 0, 'remaining-budget exhaustion must clear every read timer');

  return { key: 'default_acceptance_window_network_audit_is_bounded_and_fail_closed', status: 'PASS' };
}

async function test_default_mqtt_adapter_rejects_event_callback_and_timeout_failures_with_cleanup() {
  const { createDefaultLegacyPublicBoundaryProbeDependencies } = await loadVerifierModule();
  const env = {
    MATRIX_HOMESERVER_URL: 'http://synapse.dongyu.svc.cluster.local:8008',
    MQTT_HOST: 'mosquitto.dongyu.svc.cluster.local',
    DY_OIDC_ISSUER: '',
    DY_OIDC_PROXY_URL: '',
    FEISHU_API_BASE: 'https://open.feishu.cn/open-apis',
  };
  const dependenciesFor = (mqttJs, timers, mqttOperationTimeoutMs = 100) => createDefaultLegacyPublicBoundaryProbeDependencies({
    execFile: async () => assert.fail('MQTT adapter unit contract must not execute kubectl'),
    spawn: () => assert.fail('MQTT adapter unit contract must not create a tunnel'),
    mqttConnect: () => mqttJs.client,
    mqttOperationTimeoutMs,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    env,
  });
  const connectAdapter = async (mqttJs, timers, mqttOperationTimeoutMs = 100) => {
    const pending = dependenciesFor(mqttJs, timers, mqttOperationTimeoutMs).connectMqtt({ host: '127.0.0.1', port: 31883 });
    await flushAsyncTurn();
    assert.equal(timers.active.size, 1, 'connect must own exactly one temporary timeout');
    assert.equal(mqttJs.client.listenerCount('connect'), 1, 'connect must install one temporary connect listener');
    assert.equal(mqttJs.client.listenerCount('error'), 1, 'connect must install one temporary error listener');
    mqttJs.client.emit('connect', { sessionPresent: false });
    const adapter = await pending;
    assert.equal(timers.active.size, 0, 'successful connect must clear its temporary timeout');
    assert.equal(mqttJs.client.listenerCount('connect'), 0, 'successful connect must remove its temporary connect listener');
    assert.equal(mqttJs.client.listenerCount('error'), 1, 'connected adapter must retain exactly one managed error listener');
    return adapter;
  };
  const assertNoRawListenersOrTimers = (mqttJs, timers, message) => {
    assert.equal(mqttJs.client.listenerCount('message'), 0, `${message}: no raw message listener remains`);
    assert.equal(mqttJs.client.listenerCount('error'), 0, `${message}: no raw error listener remains`);
    assert.equal(timers.active.size, 0, `${message}: no adapter timer remains`);
  };

  {
    const mqttJs = fakeMqttJsClient({ autoEnd: true });
    const timers = createManualTimerHarness();
    const pending = dependenciesFor(mqttJs, timers).connectMqtt({ host: '127.0.0.1', port: 31883 });
    await flushAsyncTurn();
    mqttJs.client.emit('error', new Error('broker rejected connection'));
    await assertPromptRejection(pending, /mqtt_connect_error/u, 'MQTT.js connect error events must reject');
    assert.equal(timers.active.size, 0, 'connect error must clear its timeout');
    assert.equal(mqttJs.client.listenerCount('connect'), 0, 'connect error must remove connect listener');
    assert.equal(mqttJs.client.listenerCount('error'), 0, 'connect error cleanup must remove temporary error listener');
    assert.equal(mqttJs.calls.filter(([kind]) => kind === 'end').length, 1, 'connect error must end the raw client once');
    assertNoRawListenersOrTimers(mqttJs, timers, 'connect error cleanup');
  }

  {
    const mqttJs = fakeMqttJsClient({ autoEnd: true });
    const timers = createManualTimerHarness();
    const pending = dependenciesFor(mqttJs, timers, 20).connectMqtt({ host: '127.0.0.1', port: 31883 });
    await flushAsyncTurn();
    await timers.fireByTimeout(20);
    await assertPromptRejection(pending, /mqtt_connect_timeout/u, 'a missing MQTT.js connect event must reject within the adapter timeout');
    assert.equal(timers.active.size, 0, 'connect timeout must consume and clear every temporary timer');
    assert.equal(mqttJs.client.listenerCount('connect'), 0);
    assert.equal(mqttJs.client.listenerCount('error'), 0);
    assert.equal(mqttJs.calls.filter(([kind]) => kind === 'end').length, 1, 'connect timeout must end the raw client once');
    assertNoRawListenersOrTimers(mqttJs, timers, 'connect timeout cleanup');
  }

  {
    const mqttJs = fakeMqttJsClient();
    const timers = createManualTimerHarness();
    const adapter = await connectAdapter(mqttJs, timers);

    const subscribePending = adapter.subscribe(responseTopicFor('adapter_success_subscribe'));
    await flushAsyncTurn();
    assert.equal(timers.active.size, 1, 'subscribe must own one temporary callback timeout');
    mqttJs.callbacks.subscribe[0](null, [{ topic: responseTopicFor('adapter_success_subscribe'), qos: 0 }]);
    await subscribePending;
    assert.equal(timers.active.size, 0, 'successful SUBACK must clear its timeout');

    const publishPending = adapter.publish(topic, probeCorrelation('adapter_success_publish').packet);
    await flushAsyncTurn();
    assert.equal(timers.active.size, 1, 'publish must own one temporary callback timeout');
    mqttJs.callbacks.publish[0](null);
    await publishPending;
    assert.equal(timers.active.size, 0, 'successful publish callback must clear its timeout');

    const closePending = adapter.close();
    await flushAsyncTurn();
    assert.equal(timers.active.size, 1, 'close must own one temporary end-callback timeout');
    mqttJs.callbacks.end[0](null);
    await closePending;
    assert.equal(timers.active.size, 0, 'successful end callback must clear its timeout');
    assert.equal(mqttJs.client.listenerCount('error'), 0, 'close must remove the managed error listener');
    await adapter.close();
    assert.equal(mqttJs.calls.filter(([kind]) => kind === 'end').length, 1, 'successful adapter close remains idempotent');
    assertNoRawListenersOrTimers(mqttJs, timers, 'successful adapter cleanup');
  }

  for (const [operation, expectedError, expectedTimeout, callbackGroup] of [
    ['subscribe', /mqtt_subscribe_error/u, /mqtt_subscribe_timeout/u, 'subscribe'],
    ['publish', /mqtt_publish_error/u, /mqtt_publish_timeout/u, 'publish'],
  ]) {
    const errorClient = fakeMqttJsClient({ autoEnd: true });
    const errorTimers = createManualTimerHarness();
    const errorAdapter = await connectAdapter(errorClient, errorTimers);
    const errorPending = operation === 'subscribe'
      ? errorAdapter.subscribe(responseTopicFor(`adapter_error_${operation}`))
      : errorAdapter.publish(topic, probeCorrelation(`adapter_error_${operation}`).packet);
    await flushAsyncTurn();
    assert.equal(errorClient.callbacks[callbackGroup].length, 1, `${operation}: MQTT.js callback must be installed`);
    errorClient.callbacks[callbackGroup][0](new Error(`${operation} callback failure`));
    await assertPromptRejection(errorPending, expectedError, `${operation}: callback errors must reject`);
    assert.equal(errorTimers.active.size, 0, `${operation}: callback error must clear its timeout`);
    assert.equal(errorClient.client.listenerCount('error'), 1, `${operation}: managed error listener remains until close`);
    await errorAdapter.close();
    assert.equal(errorClient.client.listenerCount('error'), 0, `${operation}: close removes managed error listener`);
    assert.equal(errorClient.calls.filter(([kind]) => kind === 'end').length, 1, `${operation} callback error: cleanup once`);
    assertNoRawListenersOrTimers(errorClient, errorTimers, `${operation} callback error cleanup`);

    const timeoutClient = fakeMqttJsClient({ autoEnd: true });
    const timeoutTimers = createManualTimerHarness();
    const timeoutAdapter = await connectAdapter(timeoutClient, timeoutTimers, 20);
    const timeoutPending = operation === 'subscribe'
      ? timeoutAdapter.subscribe(responseTopicFor(`adapter_timeout_${operation}`))
      : timeoutAdapter.publish(topic, probeCorrelation(`adapter_timeout_${operation}`).packet);
    await flushAsyncTurn();
    await timeoutTimers.fireByTimeout(20);
    await assertPromptRejection(timeoutPending, expectedTimeout, `${operation}: missing callback must time out`);
    assert.equal(timeoutTimers.active.size, 0, `${operation}: timeout must leave no temporary timer`);
    await timeoutAdapter.close();
    assert.equal(timeoutClient.client.listenerCount('error'), 0, `${operation}: timeout cleanup removes managed listener`);
    assert.equal(timeoutClient.calls.filter(([kind]) => kind === 'end').length, 1, `${operation} timeout: cleanup once`);
    assertNoRawListenersOrTimers(timeoutClient, timeoutTimers, `${operation} timeout cleanup`);
  }

  {
    const mqttJs = fakeMqttJsClient({ autoEnd: true });
    const timers = createManualTimerHarness();
    const adapter = await connectAdapter(mqttJs, timers);
    assert.doesNotThrow(
      () => mqttJs.client.emit('error', new Error('post-connect transport failure')),
      'managed MQTT error listener must prevent an unhandled EventEmitter error after connect',
    );
    await assertPromptRejection(
      adapter.subscribe(responseTopicFor('post_connect_error')),
      /mqtt_connection_error/u,
      'the next MQTT operation must fail explicitly after a managed connection error',
    );
    assert.equal(timers.active.size, 0, 'terminal connection error must reject subsequent operations without a latent timer');
    await adapter.close();
    assert.equal(mqttJs.client.listenerCount('error'), 0, 'close removes managed error listener after connection failure');
    assertNoRawListenersOrTimers(mqttJs, timers, 'post-connect connection-error cleanup');
  }

  {
    const mqttJs = fakeMqttJsClient();
    const timers = createManualTimerHarness();
    const adapter = await connectAdapter(mqttJs, timers, 20);
    const closePending = adapter.close();
    await flushAsyncTurn();
    await timers.fireByTimeout(20);
    await assertPromptRejection(closePending, /mqtt_close_timeout/u, 'a missing MQTT.js end callback must reject within the adapter timeout');
    assert.equal(timers.active.size, 0, 'close timeout must consume its temporary timer');
    assert.equal(mqttJs.client.listenerCount('error'), 0, 'close timeout must still remove managed error listener');
    assert.equal(mqttJs.calls.filter(([kind]) => kind === 'end').length, 1, 'close timeout must attempt MQTT.js end exactly once');
    assertNoRawListenersOrTimers(mqttJs, timers, 'close timeout cleanup');
  }

  {
    const mqttJs = fakeMqttJsClient();
    const timers = createManualTimerHarness();
    const originalEnd = mqttJs.client.end;
    mqttJs.client.end = (...args) => {
      const callback = [...args].reverse().find((entry) => typeof entry === 'function') || null;
      const result = originalEnd(...args);
      queueMicrotask(() => mqttJs.client.emit('error', new Error('asynchronous shutdown transport error')));
      setImmediate(() => setImmediate(() => callback?.(null)));
      return result;
    };
    const adapter = await connectAdapter(mqttJs, timers);
    const closePending = adapter.close();
    await flushAsyncTurn();
    assert.equal(
      mqttJs.client.listenerCount('error'),
      1,
      'managed MQTT error listener must remain installed until the asynchronous end callback settles',
    );
    await closePending;
    assert.equal(mqttJs.client.listenerCount('error'), 0, 'managed listener is removed only after shutdown settles');
    assert.equal(mqttJs.calls.filter(([kind]) => kind === 'end').length, 1);
    assertNoRawListenersOrTimers(mqttJs, timers, 'asynchronous shutdown-error cleanup');
  }

  return {
    key: 'default_mqtt_adapter_rejects_event_callback_and_timeout_failures_with_cleanup',
    status: 'PASS',
  };
}

async function test_default_adapter_timeout_finishes_before_outer_probe_timeout() {
  const {
    LEGACY_PUBLIC_BOUNDARY_MQTT_CLEANUP_TIMEOUT_MS,
    LEGACY_PUBLIC_BOUNDARY_MQTT_ADAPTER_TIMEOUT_MS,
    LEGACY_PUBLIC_BOUNDARY_OPERATION_TIMEOUT_MS,
    createDefaultLegacyPublicBoundaryProbeDependencies,
    runLegacyPublicBoundaryProbe,
  } = await loadVerifierModule();
  assert.equal(LEGACY_PUBLIC_BOUNDARY_MQTT_ADAPTER_TIMEOUT_MS, defaultMqttAdapterTimeoutMs);
  assert.equal(LEGACY_PUBLIC_BOUNDARY_MQTT_CLEANUP_TIMEOUT_MS, defaultMqttCleanupTimeoutMs);
  assert.equal(LEGACY_PUBLIC_BOUNDARY_OPERATION_TIMEOUT_MS, defaultOperationTimeoutMs);
  assert.ok(
    LEGACY_PUBLIC_BOUNDARY_OPERATION_TIMEOUT_MS
      > LEGACY_PUBLIC_BOUNDARY_MQTT_ADAPTER_TIMEOUT_MS + LEGACY_PUBLIC_BOUNDARY_MQTT_CLEANUP_TIMEOUT_MS,
    'outer timeout must leave a strict safety margin after adapter timeout plus bounded raw cleanup',
  );

  const events = [];
  const timers = createManualTimerHarness();
  const tunnelProcess = fakePortForwardProcess({
    onKill: () => events.push('tunnel:close'),
  });
  const mqttJs = fakeMqttJsClient();
  const originalEnd = mqttJs.client.end;
  mqttJs.client.end = (...args) => {
    events.push('mqtt:end:start');
    const callback = [...args].reverse().find((entry) => typeof entry === 'function') || null;
    const result = originalEnd(...args);
    queueMicrotask(() => {
      events.push('mqtt:end:done');
      if (callback) callback(null);
    });
    return result;
  };
  const dependencies = createDefaultLegacyPublicBoundaryProbeDependencies({
    execFile: async (command, args) => {
      if (command === 'kubectl' && args[0] === 'config') return { stdout: 'orbstack\n' };
      if (command === 'bash') return { stdout: '[check] PASS local baseline\n' };
      if (command === 'kubectl' && args[0] === '-n' && args[2] === 'exec') return { stdout: '' };
      assert.fail(`no log read is expected before MQTT connect: ${command} ${args.join(' ')}`);
    },
    spawn: () => {
      queueMicrotask(() => tunnelProcess.stdout.emit('data', Buffer.from('Forwarding from 127.0.0.1:31883 -> 1883\n')));
      return tunnelProcess;
    },
    mqttConnect: () => mqttJs.client,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    env: {
      MATRIX_HOMESERVER_URL: 'http://synapse.dongyu.svc.cluster.local:8008',
      MQTT_HOST: 'mosquitto.dongyu.svc.cluster.local',
      DY_OIDC_ISSUER: '',
      DY_OIDC_PROXY_URL: '',
      FEISHU_API_BASE: 'https://open.feishu.cn/open-apis',
    },
  });
  const execution = runLegacyPublicBoundaryProbe({ marker: 'combined_default_connect_timeout', dependencies });
  for (let attempt = 0; attempt < 8; attempt += 1) await flushAsyncTurn();
  const activeTimeouts = [...timers.active.values()].map((timer) => timer.timeoutMs).sort((a, b) => a - b);
  assert.deepEqual(
    activeTimeouts,
    [defaultMqttAdapterTimeoutMs, defaultOperationTimeoutMs],
    'real default adapter and outer probe must expose distinct nested connect deadlines',
  );

  await timers.fireByTimeout(defaultMqttAdapterTimeoutMs);
  await assertPromptRejection(
    execution,
    /mqtt_connect_timeout/u,
    'inner adapter timeout must reject before the outer probe deadline',
  );
  assert.deepEqual(
    events,
    ['mqtt:end:start', 'mqtt:end:done', 'tunnel:close'],
    'raw MQTT end callback must complete before the outer probe closes its tunnel',
  );
  assert.equal(timers.active.size, 0, 'inner rejection must clear the unused outer deadline');
  assert.equal(mqttJs.client.listenerCount('connect'), 0);
  assert.equal(mqttJs.client.listenerCount('message'), 0);
  assert.equal(mqttJs.client.listenerCount('error'), 0);
  assert.equal(mqttJs.calls.filter(([kind]) => kind === 'end').length, 1, 'raw MQTT cleanup happens exactly once');

  const neverEndingEvents = [];
  const neverEndingTimers = createManualTimerHarness();
  const neverEndingTunnel = fakePortForwardProcess({
    onKill: () => neverEndingEvents.push('tunnel:close'),
  });
  const neverEndingMqtt = fakeMqttJsClient();
  neverEndingMqtt.client.end = (...args) => {
    neverEndingEvents.push('mqtt:end:start');
    neverEndingMqtt.calls.push(['end', ...args.filter((entry) => typeof entry !== 'function')]);
    return neverEndingMqtt.client;
  };
  const neverEndingDependencies = createDefaultLegacyPublicBoundaryProbeDependencies({
    execFile: async (command, args) => {
      if (command === 'kubectl' && args[0] === 'config') return { stdout: 'orbstack\n' };
      if (command === 'bash') return { stdout: '[check] PASS local baseline\n' };
      if (command === 'kubectl' && args[0] === '-n' && args[2] === 'exec') return { stdout: '' };
      assert.fail(`no log read is expected before MQTT connect: ${command} ${args.join(' ')}`);
    },
    spawn: () => {
      queueMicrotask(() => neverEndingTunnel.stdout.emit('data', Buffer.from('Forwarding from 127.0.0.1:31883 -> 1883\n')));
      return neverEndingTunnel;
    },
    mqttConnect: () => neverEndingMqtt.client,
    setTimer: neverEndingTimers.setTimer,
    clearTimer: neverEndingTimers.clearTimer,
    env: {
      MATRIX_HOMESERVER_URL: 'http://synapse.dongyu.svc.cluster.local:8008',
      MQTT_HOST: 'mosquitto.dongyu.svc.cluster.local',
      DY_OIDC_ISSUER: '',
      DY_OIDC_PROXY_URL: '',
      FEISHU_API_BASE: 'https://open.feishu.cn/open-apis',
    },
  });
  const neverEndingExecution = runLegacyPublicBoundaryProbe({
    marker: 'never_ending_connect_cleanup',
    dependencies: neverEndingDependencies,
  });
  for (let attempt = 0; attempt < 8; attempt += 1) await flushAsyncTurn();
  await neverEndingTimers.fireByTimeout(defaultMqttAdapterTimeoutMs);
  await flushAsyncTurn();
  assert.deepEqual(
    [...neverEndingTimers.active.values()].map((timer) => timer.timeoutMs).sort((left, right) => left - right),
    [defaultMqttCleanupTimeoutMs, defaultOperationTimeoutMs],
    'after connect timeout, bounded raw cleanup and the later outer deadline must both remain visible',
  );
  assert.equal(
    neverEndingMqtt.client.listenerCount('error'),
    1,
    'connect error listener must remain installed while raw end is still pending',
  );
  await neverEndingTimers.fireByTimeout(defaultMqttCleanupTimeoutMs);
  await assertPromptRejection(
    neverEndingExecution,
    /mqtt_connect_timeout/u,
    'bounded inner cleanup must settle the connect timeout before the outer deadline even when raw end never calls back',
  );
  assert.deepEqual(neverEndingEvents, ['mqtt:end:start', 'tunnel:close']);
  assert.equal(neverEndingTimers.scheduled.includes(defaultOperationTimeoutMs), true);
  assert.equal(neverEndingTimers.active.size, 0, 'inner cleanup completion must clear the still-unused outer deadline');
  assert.equal(neverEndingMqtt.client.listenerCount('connect'), 0);
  assert.equal(neverEndingMqtt.client.listenerCount('error'), 0);
  assert.equal(neverEndingMqtt.calls.filter(([kind]) => kind === 'end').length, 1);

  return { key: 'default_adapter_timeout_finishes_before_outer_probe_timeout', status: 'PASS' };
}

async function test_port_forward_startup_failures_kill_child_exactly_once() {
  const { createDefaultLegacyPublicBoundaryProbeDependencies } = await loadVerifierModule();
  for (const [stage, expectedCode, trigger] of [
    ['readiness_timeout', 'port_forward_ready_timeout', () => undefined],
    ['child_error', 'port_forward_child_error', (child) => queueMicrotask(() => child.emit('error', new Error('spawn failed')))],
    ['early_exit', 'port_forward_exited_before_ready', (child) => queueMicrotask(() => child.emit('exit', 1, null))],
  ]) {
    let killCount = 0;
    const child = fakePortForwardProcess({
      onKill: (signal) => {
        assert.equal(signal, 'SIGTERM', `${stage}: cleanup signal`);
        killCount += 1;
      },
    });
    const dependencies = createDefaultLegacyPublicBoundaryProbeDependencies({
      execFile: async () => ({ stdout: '' }),
      spawn: () => {
        trigger(child);
        return child;
      },
      mqttConnect: async () => assert.fail(`${stage}: MQTT must not connect before tunnel readiness`),
      delay: async () => undefined,
      portForwardReadyTimeoutMs: 5,
      env: {
        MATRIX_HOMESERVER_URL: 'http://synapse.dongyu.svc.cluster.local:8008',
        MQTT_HOST: 'mosquitto.dongyu.svc.cluster.local',
        DY_OIDC_ISSUER: '',
        DY_OIDC_PROXY_URL: '',
        FEISHU_API_BASE: 'https://open.feishu.cn/open-apis',
      },
    });

    await assert.rejects(
      dependencies.openMosquittoTunnel({ namespace: 'dongyu', service: 'svc/mosquitto', host: '127.0.0.1' }),
      new RegExp(expectedCode, 'u'),
      stage,
    );
    assert.equal(killCount, 1, `${stage}: child must be killed exactly once`);
  }

  for (const [stage, expectedCode, triggerFailure] of [
    ['readiness_timeout_ignores_sigterm', 'port_forward_ready_timeout', async (timers) => {
      await timers.fireByTimeout(10);
    }],
    ['child_error_ignores_sigterm', 'port_forward_child_error', async (_timers, child) => {
      child.emit('error', new Error('spawn failed and ignored SIGTERM'));
      await flushAsyncTurn();
    }],
  ]) {
    const timers = createManualTimerHarness();
    const signals = [];
    const child = fakePortForwardProcess({
      onKill: (signal) => signals.push(signal),
      exitOnSignals: ['SIGKILL'],
    });
    const dependencies = createDefaultLegacyPublicBoundaryProbeDependencies({
      execFile: async () => ({ stdout: '' }),
      spawn: () => child,
      mqttConnect: async () => assert.fail(`${stage}: MQTT must not connect before tunnel readiness`),
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      portForwardReadyTimeoutMs: 10,
      portForwardCloseTimeoutMs: defaultPortForwardCloseTimeoutMs,
      env: {
        MATRIX_HOMESERVER_URL: 'http://synapse.dongyu.svc.cluster.local:8008',
        MQTT_HOST: 'mosquitto.dongyu.svc.cluster.local',
        DY_OIDC_ISSUER: '',
        DY_OIDC_PROXY_URL: '',
        FEISHU_API_BASE: 'https://open.feishu.cn/open-apis',
      },
    });
    const pending = dependencies.openMosquittoTunnel({
      namespace: 'dongyu',
      service: 'svc/mosquitto',
      host: '127.0.0.1',
    });
    const rejection = assert.rejects(pending, new RegExp(expectedCode, 'u'), stage);
    await triggerFailure(timers, child);
    assert.deepEqual(signals, ['SIGTERM'], `${stage}: bounded cleanup starts with SIGTERM`);
    assert.equal(
      [...timers.active.values()].some((timer) => timer.timeoutMs === defaultPortForwardCloseTimeoutMs),
      true,
      `${stage}: SIGTERM wait must be bounded`,
    );
    await timers.fireByTimeout(defaultPortForwardCloseTimeoutMs);
    await rejection;
    assert.deepEqual(signals, ['SIGTERM', 'SIGKILL'], `${stage}: ignored SIGTERM must escalate once`);
    assert.equal(timers.active.size, 0, `${stage}: startup cleanup must settle without timers`);
  }

  return { key: 'port_forward_startup_failures_kill_child_exactly_once', status: 'PASS' };
}

async function test_port_forward_close_waits_then_sigkills_and_is_idempotent() {
  const { createDefaultLegacyPublicBoundaryProbeDependencies } = await loadVerifierModule();
  const timers = createManualTimerHarness();
  const signals = [];
  const child = fakePortForwardProcess({
    onKill: (signal) => signals.push(signal),
    exitOnSignals: ['SIGKILL'],
  });
  const dependencies = createDefaultLegacyPublicBoundaryProbeDependencies({
    execFile: async () => ({ stdout: '' }),
    spawn: () => child,
    mqttConnect: () => assert.fail('port-forward close contract must not connect MQTT'),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    portForwardReadyTimeoutMs: 100,
    portForwardCloseTimeoutMs: defaultPortForwardCloseTimeoutMs,
    env: {
      MATRIX_HOMESERVER_URL: 'http://synapse.dongyu.svc.cluster.local:8008',
      MQTT_HOST: 'mosquitto.dongyu.svc.cluster.local',
      DY_OIDC_ISSUER: '',
      DY_OIDC_PROXY_URL: '',
      FEISHU_API_BASE: 'https://open.feishu.cn/open-apis',
    },
  });
  const tunnelPending = dependencies.openMosquittoTunnel({
    namespace: 'dongyu',
    service: 'svc/mosquitto',
    host: '127.0.0.1',
  });
  child.stdout.emit('data', Buffer.from('Forwarding from 127.0.0.1:31883 -> 1883\n'));
  const tunnel = await tunnelPending;
  const firstClose = tunnel.close();
  const secondClose = tunnel.close();
  assert.equal(firstClose, secondClose, 'repeated close calls must share one in-flight promise');
  await flushAsyncTurn();
  assert.deepEqual(signals, ['SIGTERM']);
  assert.equal(
    [...timers.active.values()].some((timer) => timer.timeoutMs === defaultPortForwardCloseTimeoutMs),
    true,
    'SIGTERM must own a bounded wait-for-exit timer',
  );
  await timers.fireByTimeout(defaultPortForwardCloseTimeoutMs);
  await firstClose;
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  assert.equal(timers.active.size, 0, 'forced close must clear every wait-for-exit timer');
  assert.equal(tunnel.close(), firstClose, 'completed close remains idempotent');
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  return { key: 'port_forward_close_waits_then_sigkills_and_is_idempotent', status: 'PASS' };
}

async function test_default_boundary_rejects_remote_matrix_mqtt_oidc_but_allows_feishu_https() {
  const { createDefaultLegacyPublicBoundaryProbeDependencies } = await loadVerifierModule();
  const baseEnv = {
    MATRIX_HOMESERVER_URL: 'http://synapse.dongyu.svc.cluster.local:8008',
    DY_MQTT_HOST: '',
    DY_MQTT_PORT: '',
    MQTT_HOST: 'mosquitto.dongyu.svc.cluster.local',
    MQTT_PORT: '1883',
    DY_OIDC_ISSUER: '',
    DY_OIDC_PROXY_URL: '',
    FEISHU_API_BASE: 'https://open.feishu.cn/open-apis',
  };
  const createBoundary = (env, {
    context = 'orbstack\n',
    failBaseline = false,
    failSynapse = false,
  } = {}) => {
    const calls = [];
    const dependencies = createDefaultLegacyPublicBoundaryProbeDependencies({
      execFile: async (command, args, options) => {
        calls.push([command, args, options]);
        if (command === 'kubectl' && args[0] === 'config') return { stdout: context };
        if (command === 'bash') {
          if (failBaseline) throw new Error('simulated baseline command failure');
          return { stdout: '[check] PASS local baseline\n' };
        }
        if (command === 'kubectl' && args[0] === '-n' && args[2] === 'exec') {
          if (failSynapse) throw new Error('simulated Synapse fetch failure');
          return { stdout: '' };
        }
        assert.fail(`unexpected local-boundary command: ${command} ${args.join(' ')}`);
      },
      spawn: () => assert.fail('boundary validation must finish before tunnel creation'),
      mqttConnect: async () => assert.fail('boundary validation must finish before MQTT connection'),
      delay: async () => undefined,
      localCheckTimeoutMs: unitLocalCheckTimeoutMs,
      env,
    });
    return { calls, dependencies };
  };

  const local = createBoundary(baseEnv);
  await local.dependencies.assertLocalOrbStack();
  assert.deepEqual(local.calls, [
    ['kubectl', ['config', 'current-context'], { timeout: unitLocalCheckTimeoutMs }],
    [
      'bash',
      [resolve(repoRoot, 'scripts/ops/check_runtime_baseline.sh')],
      { cwd: repoRoot, timeout: unitLocalCheckTimeoutMs },
    ],
    [
      'kubectl',
      [
        '-n',
        'dongyu',
        'exec',
        'deployment/mbr-worker',
        '--',
        'node',
        '-e',
        synapseHealthScript,
      ],
      { timeout: unitLocalCheckTimeoutMs },
    ],
  ], 'local acceptance must use deployed baseline truth plus a bounded in-cluster Synapse request');

  const highPriorityLocalMqtt = createBoundary({
    ...baseEnv,
    DY_MQTT_HOST: 'mosquitto.dongyu.svc.cluster.local',
    DY_MQTT_PORT: '1883',
    MQTT_HOST: 'mqtt.dongyudigital.com',
    MQTT_PORT: '8883',
  });
  await highPriorityLocalMqtt.dependencies.assertLocalOrbStack();
  await createBoundary({
    ...baseEnv,
    FEISHU_API_BASE: 'https://open.feishu.cn:443/open-apis',
  }).dependencies.assertLocalOrbStack();

  for (const [name, env, context, pattern] of [
    ['near_miss_context', baseEnv, 'remote-orbstack\n', /orbstack_context_required/u],
    ['remote_matrix', { ...baseEnv, MATRIX_HOMESERVER_URL: 'https://matrix.dongyudigital.com' }, 'orbstack\n', /local_matrix_required/u],
    ['matrix_lookalike', { ...baseEnv, MATRIX_HOMESERVER_URL: 'http://synapse.dongyu.svc.cluster.local.evil.test:8008' }, 'orbstack\n', /local_matrix_required/u],
    ['missing_matrix', { ...baseEnv, MATRIX_HOMESERVER_URL: '' }, 'orbstack\n', /local_matrix_required/u],
    ['remote_mqtt_low_priority', { ...baseEnv, MQTT_HOST: 'mqtt.dongyudigital.com' }, 'orbstack\n', /local_mqtt_required/u],
    ['remote_mqtt_high_priority', { ...baseEnv, DY_MQTT_HOST: 'mqtt.dongyudigital.com' }, 'orbstack\n', /local_mqtt_required/u],
    ['mqtt_high_priority_lookalike', { ...baseEnv, DY_MQTT_HOST: 'mosquitto.dongyu.svc.cluster.local.evil.test' }, 'orbstack\n', /local_mqtt_required/u],
    ['mqtt_high_priority_wrong_port', { ...baseEnv, DY_MQTT_PORT: '8883' }, 'orbstack\n', /local_mqtt_required/u],
    ['missing_mqtt', { ...baseEnv, DY_MQTT_HOST: '', MQTT_HOST: '', DY_MQTT_PORT: '', MQTT_PORT: '' }, 'orbstack\n', /local_mqtt_required/u],
    ['remote_oidc', { ...baseEnv, DY_OIDC_ISSUER: 'https://id.dongyudigital.com' }, 'orbstack\n', /remote_oidc_forbidden/u],
    ['oidc_lookalike', { ...baseEnv, DY_OIDC_ISSUER: 'https://open.feishu.cn.evil.test' }, 'orbstack\n', /remote_oidc_forbidden/u],
    ['remote_oidc_proxy', { ...baseEnv, DY_OIDC_PROXY_URL: 'https://id-proxy.dongyudigital.com' }, 'orbstack\n', /remote_oidc_forbidden/u],
    ['non_https_feishu', { ...baseEnv, FEISHU_API_BASE: 'http://open.feishu.cn/open-apis' }, 'orbstack\n', /feishu_https_required/u],
    ['feishu_wrong_port', { ...baseEnv, FEISHU_API_BASE: 'https://open.feishu.cn:444/open-apis' }, 'orbstack\n', /approved_feishu_host_required/u],
    ['other_https_host', { ...baseEnv, FEISHU_API_BASE: 'https://example.com/open-apis' }, 'orbstack\n', /approved_feishu_host_required/u],
    ['lookalike_https_host', { ...baseEnv, FEISHU_API_BASE: 'https://open.feishu.cn.evil.test/open-apis' }, 'orbstack\n', /approved_feishu_host_required/u],
  ]) {
    const boundary = createBoundary(env, { context });
    await assert.rejects(boundary.dependencies.assertLocalOrbStack(), pattern, name);
  }

  const baselineFailure = createBoundary(baseEnv, { failBaseline: true });
  await assert.rejects(
    baselineFailure.dependencies.assertLocalOrbStack(),
    /runtime_baseline_failed/u,
    'a failed deployed baseline must fail the verifier before any probe',
  );
  assert.equal(
    baselineFailure.calls.some(([command]) => command === 'bash'),
    true,
    'baseline failure path must execute the real checker',
  );

  const synapseFailure = createBoundary(baseEnv, { failSynapse: true });
  await assert.rejects(
    synapseFailure.dependencies.assertLocalOrbStack(),
    /local_synapse_health_failed/u,
    'a failed in-cluster Synapse request must fail the verifier before any probe',
  );
  assert.equal(
    synapseFailure.calls.some(([, args]) => args[0] === '-n' && args[2] === 'exec'),
    true,
    'Synapse failure path must execute the bounded in-cluster health request',
  );

  return { key: 'default_boundary_rejects_remote_matrix_mqtt_oidc_but_allows_feishu_https', status: 'PASS' };
}

async function test_default_diagnostic_and_trace_poll_timeouts_close_mqtt_and_tunnel_once() {
  const {
    createDefaultLegacyPublicBoundaryProbeDependencies,
    runLegacyPublicBoundaryProbe,
  } = await loadVerifierModule();
  for (const [stage, expectedCode] of [
    ['diagnostic', /r1_diagnostic_timeout/u],
    ['trace', /r1_trace_timeout/u],
  ]) {
    let tunnelCloses = 0;
    const logCalls = [];
    const tunnelProcess = fakePortForwardProcess({
      onKill: () => {
        tunnelCloses += 1;
      },
    });
    const mqttJs = fakeMqttJsClient({ autoEnd: true });
    const originalSubscribe = mqttJs.client.subscribe;
    const originalPublish = mqttJs.client.publish;
    mqttJs.client.subscribe = (...args) => {
      const result = originalSubscribe(...args);
      const callback = mqttJs.callbacks.subscribe.at(-1);
      queueMicrotask(() => callback(null, [{ topic: args[0], qos: 0 }]));
      return result;
    };
    mqttJs.client.publish = (...args) => {
      const result = originalPublish(...args);
      const callback = mqttJs.callbacks.publish.at(-1);
      queueMicrotask(() => callback(null));
      return result;
    };
    const diagnosticOnlyLog = [
      diagnosticLogLine(validDiagnostic()),
      'DE_RUNTIME_DIAGNOSTIC {malformed-json',
      diagnosticLogLine(validDiagnostic(exactRejection({ ts: publishedAt - 1 }))),
    ].join('\n');
    const diagnosticAndNoFreshTraceLog = [
      diagnosticLogLine(validDiagnostic()),
      diagnosticLogLine(validDiagnostic(exactRejection())),
      traceLogLine([exactTrace({ ts: publishedAt - 1 })]),
      'DE_RUNTIME_TRACE {malformed-json',
      traceLogLine([exactTrace({
        ts: publishedAt + 3,
        payload: { ...exactTrace().payload, probe_marker: 'different-probe' },
      })]),
    ].join('\n');
    const dependencies = createDefaultLegacyPublicBoundaryProbeDependencies({
      execFile: async (command, args, options) => {
        if (command === 'kubectl' && args[0] === 'config') return { stdout: 'orbstack\n' };
        if (command === 'bash') return { stdout: '[check] PASS local baseline\n' };
        if (command === 'kubectl' && args[0] === '-n' && args[2] === 'exec') return { stdout: '' };
        logCalls.push(['execFile', command, args, options]);
        return { stdout: stage === 'diagnostic' ? diagnosticOnlyLog : diagnosticAndNoFreshTraceLog };
      },
      spawn: () => {
        queueMicrotask(() => tunnelProcess.stdout.emit('data', Buffer.from('Forwarding from 127.0.0.1:31883 -> 1883\n')));
        return tunnelProcess;
      },
      mqttConnect: () => {
        queueMicrotask(() => mqttJs.client.emit('connect', { sessionPresent: false }));
        return mqttJs.client;
      },
      localCheckTimeoutMs: unitLocalCheckTimeoutMs,
      mqttOperationTimeoutMs: 100,
      portForwardReadyTimeoutMs: 100,
      evidencePollTimeoutMs: 10,
      evidencePollIntervalMs: 5,
      logReadTimeoutMs: unitLogReadTimeoutMs,
      now: (() => {
        const values = [startedAt, publishedAt];
        return () => values.shift() ?? publishedAt;
      })(),
      env: {
        MATRIX_HOMESERVER_URL: 'http://synapse.dongyu.svc.cluster.local:8008',
        MQTT_HOST: 'mosquitto.dongyu.svc.cluster.local',
        DY_OIDC_ISSUER: '',
        DY_OIDC_PROXY_URL: '',
        FEISHU_API_BASE: 'https://open.feishu.cn/open-apis',
      },
    });

    await assert.rejects(
      runLegacyPublicBoundaryProbe({
        marker: 'probe123',
        responseQuietPeriodMs: unitResponseQuietPeriodMs,
        dependencies,
      }),
      expectedCode,
      `${stage} polling must report its distinct timeout code`,
    );
    assert.equal(mqttJs.calls.filter(([kind]) => kind === 'end').length, 1, `${stage} timeout must close MQTT exactly once`);
    assert.equal(tunnelCloses, 1, `${stage} timeout must close port-forward exactly once`);
    assert.equal(mqttJs.client.listenerCount('message'), 0, `${stage} timeout must remove the raw response collector`);
    assert.equal(mqttJs.client.listenerCount('error'), 0, `${stage} timeout must remove every raw error listener`);
    assert.equal(logCalls.length > 0, true, `${stage} timeout must execute bounded kubectl logs polling`);
    const sinceTime = new Date(startedAt).toISOString();
    for (const entry of logCalls) {
      assert.deepEqual(entry.slice(0, 3), ['execFile', 'kubectl', [
        '-n', 'dongyu', 'logs', 'deployment/remote-worker', '--since-time', sinceTime,
      ]], `${stage}: every log read must use the exact bounded kubectl logs command`);
      const timeoutMs = entry[3]?.timeout;
      assert.equal(Number.isInteger(timeoutMs), true, `${stage}: every log read timeout must be an integer`);
      assert.equal(
        timeoutMs >= 1 && timeoutMs <= unitLogReadTimeoutMs,
        true,
        `${stage}: every log read must stay within the per-read and remaining poll budgets`,
      );
    }
  }

  return {
    key: 'default_diagnostic_and_trace_poll_timeouts_close_mqtt_and_tunnel_once',
    status: 'PASS',
  };
}

async function test_never_resolving_log_read_stays_inside_poll_budget_and_cleans_up() {
  const {
    createDefaultLegacyPublicBoundaryProbeDependencies,
    runLegacyPublicBoundaryProbe,
  } = await loadVerifierModule();
  let monotonicTime = 0;
  const firedTimeouts = [];
  const timers = createManualTimerHarness({
    onFire: (timeoutMs) => {
      monotonicTime += timeoutMs;
      firedTimeouts.push(timeoutMs);
    },
  });
  const never = new Promise(() => undefined);
  const logCalls = [];
  let tunnelCloses = 0;
  const tunnelProcess = fakePortForwardProcess({ onKill: () => { tunnelCloses += 1; } });
  const mqttJs = fakeMqttJsClient({ autoEnd: true });
  const originalSubscribe = mqttJs.client.subscribe;
  const originalPublish = mqttJs.client.publish;
  mqttJs.client.subscribe = (...args) => {
    const result = originalSubscribe(...args);
    queueMicrotask(() => mqttJs.callbacks.subscribe.at(-1)(null, [{ topic: args[0], qos: 0 }]));
    return result;
  };
  mqttJs.client.publish = (...args) => {
    const result = originalPublish(...args);
    queueMicrotask(() => mqttJs.callbacks.publish.at(-1)(null));
    return result;
  };
  const dependencies = createDefaultLegacyPublicBoundaryProbeDependencies({
    execFile: async (command, args, options) => {
      if (command === 'kubectl' && args[0] === 'config') return { stdout: 'orbstack\n' };
      if (command === 'bash') return { stdout: '[check] PASS local baseline\n' };
      if (command === 'kubectl' && args[0] === '-n' && args[2] === 'exec') return { stdout: '' };
      logCalls.push(['execFile', command, args, options]);
      return never;
    },
    spawn: () => {
      queueMicrotask(() => tunnelProcess.stdout.emit('data', Buffer.from('Forwarding from 127.0.0.1:31883 -> 1883\n')));
      return tunnelProcess;
    },
    mqttConnect: () => {
      queueMicrotask(() => mqttJs.client.emit('connect', { sessionPresent: false }));
      return mqttJs.client;
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    logReadTimeoutMs: unitLogReadTimeoutMs,
    evidencePollTimeoutMs: 10,
    evidencePollIntervalMs: 1,
    monotonicNow: () => monotonicTime,
    delay: async (timeoutMs) => {
      monotonicTime += timeoutMs;
    },
    now: (() => {
      const values = [startedAt, publishedAt];
      return () => values.shift() ?? publishedAt;
    })(),
    env: {
      MATRIX_HOMESERVER_URL: 'http://synapse.dongyu.svc.cluster.local:8008',
      MQTT_HOST: 'mosquitto.dongyu.svc.cluster.local',
      DY_OIDC_ISSUER: '',
      DY_OIDC_PROXY_URL: '',
      FEISHU_API_BASE: 'https://open.feishu.cn/open-apis',
    },
  });
  const execution = runLegacyPublicBoundaryProbe({ marker: 'never_resolving_log_read', dependencies });
  let settled = false;
  execution.then(
    () => { settled = true; },
    () => { settled = true; },
  );
  for (let attempt = 0; attempt < 8 && !settled; attempt += 1) {
    await flushAsyncTurn();
    if (settled) break;
    const logReadTimer = [...timers.active.entries()]
      .filter(([, timer]) => timer.timeoutMs <= unitLogReadTimeoutMs)
      .sort((a, b) => a[1].timeoutMs - b[1].timeoutMs)[0];
    assert.ok(logReadTimer, 'a never-resolving kubectl logs call must be bounded by an injected per-read timer');
    await timers.fire(logReadTimer[0]);
  }
  await assert.rejects(
    execution,
    /r1_diagnostic_timeout/u,
    'per-read failures must remain contained by the total diagnostic poll deadline',
  );
  assert.ok(firedTimeouts.length > 0, 'at least one dedicated log-read timer must fire');
  assert.equal(
    firedTimeouts.every((timeoutMs) => timeoutMs <= unitLogReadTimeoutMs),
    true,
    'each individual log read must use no more than its dedicated timeout budget',
  );
  assert.ok(monotonicTime <= 10, 'never-resolving reads must not exceed the total evidence-poll budget');
  assert.equal(logCalls.length > 0, true, 'the verifier must attempt the production kubectl logs path');
  for (const entry of logCalls) {
    assert.deepEqual(entry, ['execFile', 'kubectl', [
      '-n', 'dongyu', 'logs', 'deployment/remote-worker', '--since-time', new Date(startedAt).toISOString(),
    ], { timeout: unitLogReadTimeoutMs }]);
  }
  assert.equal(mqttJs.calls.filter(([kind]) => kind === 'end').length, 1, 'log timeout must close MQTT once');
  assert.equal(tunnelCloses, 1, 'log timeout must close the tunnel once');
  assert.equal(mqttJs.client.listenerCount('message'), 0, 'log timeout cleanup must remove the raw response collector');
  assert.equal(mqttJs.client.listenerCount('error'), 0, 'log timeout cleanup must remove every raw error listener');
  assert.equal(timers.active.size, 0, 'log timeout cleanup must leave no active operation timer');

  return { key: 'never_resolving_log_read_stays_inside_poll_budget_and_cleans_up', status: 'PASS' };
}

const tests = [
  test_revision4_live_fixture_is_committed_and_declares_both_routes,
  test_revision4_full_live_acceptance_uses_owner_paths_and_cleans_up,
  test_revision4_cleanup_never_hides_primary_failure,
  test_revision4_default_http_client_uses_import_owner_and_uninstall_endpoints,
  test_revision4_same_name_nonfixture_is_preserved_and_fails_closed,
  test_revision4_import_and_uninstall_require_exact_routing_owners,
  test_revision4_default_operational_dependencies_read_attestations_and_persistence_only,
  test_revision4_persisted_residue_scan_distinguishes_ownership_from_evidence,
  test_revision4_positive_flow_rejects_stale_wrong_ids_reply_targets_and_reuse,
  test_revision4_default_positive_reader_uses_fresh_shared_pin_flow_logs,
  test_revision4_ui_server_boundary_requires_fresh_local_effective_and_outbound_evidence,
  test_revision4_default_ui_server_boundary_reader_uses_fresh_shared_logs,
  test_shared_network_boundary_evidence_is_redacted_fresh_and_fail_closed,
  test_workspace_manager_network_audit_probe_is_exact_local_v2_roundtrip,
  test_probe_builds_exact_removed_outer_packet,
  test_probe_evidence_requires_rejection_immutability_and_silence,
  test_actual_runtime_rejection_round_trips_through_runner_log_schema_and_parser,
  test_production_parsers_select_newest_fresh_correlated_evidence_from_cumulative_logs,
  test_cursor_emitter_and_parser_preserve_all_fresh_correlated_events,
  test_verifier_executes_local_mosquitto_probe_without_actor_mutation,
  test_verifier_rejects_post_publish_mqtt_loss_during_silence_and_disposes_listeners,
  test_verifier_closes_each_created_resource_once_at_every_failure_stage,
  test_verifier_times_out_each_network_operation_and_cleans_up_once,
  test_default_dependencies_factory_locks_orbstack_local_mqtt_and_fresh_r1_logs,
  test_default_acceptance_window_network_audit_is_bounded_and_fail_closed,
  test_default_mqtt_adapter_rejects_event_callback_and_timeout_failures_with_cleanup,
  test_default_adapter_timeout_finishes_before_outer_probe_timeout,
  test_port_forward_startup_failures_kill_child_exactly_once,
  test_port_forward_close_waits_then_sigkills_and_is_idempotent,
  test_default_boundary_rejects_remote_matrix_mqtt_oidc_but_allows_feishu_https,
  test_default_diagnostic_and_trace_poll_timeouts_close_mqtt_and_tunnel_once,
  test_never_resolving_log_read_stays_inside_poll_budget_and_cleans_up,
];

const requestedFilter = process.env.DY_0457_TEST_FILTER || '';
const selectedTests = requestedFilter
  ? tests.filter((test) => test.name.includes(requestedFilter))
  : tests;
assert.ok(selectedTests.length > 0, 'no verifier contract case matched DY_0457_TEST_FILTER');

let failed = 0;
for (const test of selectedTests) {
  try {
    const result = await test();
    process.stdout.write(`[PASS] ${result.key}\n`);
  } catch (error) {
    failed += 1;
    process.stderr.write(`[FAIL] ${test.name}\n${error?.stack || error}\n`);
  }
}
process.stdout.write(`${selectedTests.length - failed} passed, ${failed} failed out of ${selectedTests.length}\n`);
if (failed > 0) process.exit(1);
