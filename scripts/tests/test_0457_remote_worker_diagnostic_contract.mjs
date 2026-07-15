#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const diagnosticModulePath = resolve(repoRoot, 'scripts/lib/de_runtime_diagnostics.mjs');
const secretSentinel = '0457-secret-must-never-reach-diagnostic-log';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

async function loadDiagnosticModule() {
  try {
    return await import('../lib/de_runtime_diagnostics.mjs');
  } catch (error) {
    assert.fail(`missing generic DE runtime diagnostic helper: ${error && error.message ? error.message : error}`);
  }
}

function addRootLabel(runtime, model, k, t, v) {
  const result = runtime.addLabel(model, 0, 0, 0, { k, t, v });
  assert.equal(result?.applied, true, `fixture label ${k} must apply`);
}

function mt(k, t, v, id = '0', p = 0, r = 0, c = 0) {
  return { id, p, r, c, k, t, v };
}

function fakeLegacyPacket(marker) {
  const topic = 'UIPUT/ws/dam/pic/de/R1/3200/resource';
  const responseTopic = `UIPUT/ws/dam/pic/de/U1/3200/legacy_probe_${marker}`;
  return {
    version: 'v1',
    type: 'pin_payload',
    payload: [
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
    ],
  };
}

function fakeRuntimeTrace(marker, ts) {
  return {
    type: 'inbound_rejected',
    ts,
    payload: {
      topic: 'UIPUT/ws/dam/pic/de/R1/3200/resource',
      payload: fakeLegacyPacket(marker),
      mode: 'pin_payload_v1',
      reason: 'legacy_feishu_message_api_v1_removed',
    },
  };
}

function expectedProjectedTrace(marker, ts, outerPacketSha256) {
  return {
    type: 'inbound_rejected',
    ts,
    payload: {
      topic: 'UIPUT/ws/dam/pic/de/R1/3200/resource',
      pin: 'resource',
      ingress_pin: 'r1_cb_in',
      reason: 'legacy_feishu_message_api_v1_removed',
      probe_marker: marker,
      response_topic: `UIPUT/ws/dam/pic/de/U1/3200/legacy_probe_${marker}`,
      outer_packet_sha256: outerPacketSha256,
    },
  };
}

function traceEntriesFromLines(lines) {
  const line = lines.find((entry) => entry.startsWith('DE_RUNTIME_TRACE '));
  assert.ok(line, 'shared emitter must write one DE_RUNTIME_TRACE line');
  const parsed = JSON.parse(line.slice('DE_RUNTIME_TRACE '.length));
  assert.equal(parsed.schema, 'de_runtime_trace.v1');
  assert.equal(Array.isArray(parsed.entries), true);
  return parsed.entries;
}

async function test_diagnostic_helper_is_stable_pure_and_non_secret() {
  const {
    DE_RUNTIME_DIAGNOSTIC_MARKER,
    buildDeRuntimeDiagnostic,
    buildDeRuntimeTraceEvidence,
    createDeRuntimeDiagnosticEmitter,
    emitDeRuntimeDiagnosticLogLines,
    formatDeRuntimeDiagnosticLogLines,
    stableSha256,
  } = await loadDiagnosticModule();
  assert.equal(DE_RUNTIME_DIAGNOSTIC_MARKER, 'DE_RUNTIME_DIAGNOSTIC');
  assert.equal(typeof buildDeRuntimeDiagnostic, 'function');
  assert.equal(typeof buildDeRuntimeTraceEvidence, 'function');
  assert.equal(typeof createDeRuntimeDiagnosticEmitter, 'function');
  assert.equal(typeof emitDeRuntimeDiagnosticLogLines, 'function');
  assert.equal(typeof formatDeRuntimeDiagnosticLogLines, 'function');
  assert.equal(typeof stableSha256, 'function');
  assert.equal(
    stableSha256('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    'stableSha256 must implement the standard SHA-256 digest, not only return a hash-shaped value',
  );
  assert.equal(
    stableSha256({ b: 2, nested: { y: 2, x: 1 }, a: 1 }),
    stableSha256({ a: 1, nested: { x: 1, y: 2 }, b: 2 }),
    'hash must not depend on object insertion order',
  );
  assert.notEqual(
    stableSha256({ a: 1, nested: { value: 'before' } }),
    stableSha256({ a: 1, nested: { value: 'after' } }),
    'different nested values must produce different hashes',
  );
  assert.notEqual(
    stableSha256({ ordered: ['first', 'second'] }),
    stableSha256({ ordered: ['second', 'first'] }),
    'array order is semantic and must affect the hash',
  );

  const runtime = new ModelTableRuntime();
  const model0 = runtime.getModel(0);
  const model3200 = runtime.createModel({ id: 3200, name: 'DE diagnostic actor', type: 'model.table' });
  addRootLabel(runtime, model0, 'mqtt_inbound_error', 'json', {
    code: 'legacy_feishu_message_api_v1_removed',
    topic: 'UIPUT/ws/dam/pic/de/R1/3200/resource',
    pin: 'resource',
    ingress_pin: 'r1_cb_in',
    ts: 1773379200000,
    secret_material: 'must-never-appear',
  });
  addRootLabel(runtime, model3200, 'result', 'json', { status: 'unchanged', op_id: 'baseline' });
  addRootLabel(runtime, model3200, 'private_fixture_value', 'str', 'must-never-appear');

  assert.throws(
    () => buildDeRuntimeDiagnostic({ runtime: new ModelTableRuntime(), reason: 'missing_actor' }),
    /model3200 snapshot is required/u,
    'an absent Model3200 must fail closed instead of hashing null as evidence',
  );
  const missingResultRuntime = new ModelTableRuntime();
  missingResultRuntime.createModel({ id: 3200, name: 'missing result', type: 'model.table' });
  assert.throws(
    () => buildDeRuntimeDiagnostic({ runtime: missingResultRuntime, reason: 'missing_result' }),
    /model3200 result is required/u,
    'an absent Model3200 result must fail closed instead of hashing null as evidence',
  );

  const before = JSON.stringify(runtime.snapshot());
  const expectedSnapshot = runtime.snapshot().models['3200'];
  const expectedResult = expectedSnapshot.cells['0,0,0'].labels.result;
  const diagnostic = buildDeRuntimeDiagnostic({ runtime, reason: 'interval' });
  const after = JSON.stringify(runtime.snapshot());

  assert.equal(after, before, 'building diagnostic evidence must not mutate actor state');
  assert.deepEqual(diagnostic, {
    schema: 'de_runtime_diagnostic.v1',
    reason: 'interval',
    mqtt_inbound_error: {
      code: 'legacy_feishu_message_api_v1_removed',
      topic: 'UIPUT/ws/dam/pic/de/R1/3200/resource',
      pin: 'resource',
      ingress_pin: 'r1_cb_in',
      ts: 1773379200000,
    },
    model3200_sha256: stableSha256(expectedSnapshot),
    model3200_result_sha256: stableSha256(expectedResult),
  });
  assert.match(diagnostic.model3200_sha256, /^[a-f0-9]{64}$/u);
  assert.match(diagnostic.model3200_result_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(diagnostic).includes('must-never-appear'), false, 'diagnostic must emit hashes, not actor values');

  const formatterInput = {
    runtime,
    reason: 'emitter_contract',
    traceEntries: [],
  };
  const expectedLines = formatDeRuntimeDiagnosticLogLines(formatterInput);
  assert.equal(expectedLines.length, 2, 'shared formatter must return exactly diagnostic and trace lines');
  assert.equal(
    expectedLines.every((line) => typeof line === 'string' && !line.endsWith('\n')),
    true,
    'formatter returns complete lines without transport-specific newline bytes',
  );
  const writtenLines = [];
  const emittedLines = emitDeRuntimeDiagnosticLogLines({
    ...formatterInput,
    writeLine: (line) => writtenLines.push(line),
  });
  assert.deepEqual(emittedLines, expectedLines, 'emitter must return the exact shared formatter result');
  assert.deepEqual(writtenLines, expectedLines, 'emitter writer must receive exactly the shared formatter lines in order');

  let writerAttempts = 0;
  assert.throws(
    () => emitDeRuntimeDiagnosticLogLines({
      ...formatterInput,
      writeLine: () => {
        writerAttempts += 1;
        throw new Error('diagnostic_writer_failed');
      },
    }),
    /diagnostic_writer_failed/u,
    'writer failures must remain visible to the runner',
  );
  assert.equal(writerAttempts, 1, 'emitter must stop after the first writer failure');
  assert.throws(
    () => emitDeRuntimeDiagnosticLogLines({ ...formatterInput, writeLine: null }),
    /writeLine/u,
    'emitter must fail closed without an injected line writer',
  );

  const diagnosticModuleSource = readFileSync(diagnosticModulePath, 'utf8');
  assert.match(
    diagnosticModuleSource,
    /\bcreateDeRuntimeDiagnosticEmitter\b[\s\S]*?\bemitDeRuntimeDiagnosticLogLines\s*\(/u,
    'cursor factory must delegate every emission to the shared diagnostic/trace emitter',
  );

  const traceEntries = [fakeRuntimeTrace('cursor_first', 1773379200100)];
  const firstProjection = expectedProjectedTrace(
    'cursor_first',
    1773379200100,
    stableSha256(traceEntries[0].payload.payload),
  );
  runtime.mqttTrace = {
    list: () => traceEntries.slice(),
  };
  let cursorLines = [];
  const emitWithCursor = createDeRuntimeDiagnosticEmitter({
    runtime,
    writeLine: (line) => cursorLines.push(line),
  });
  assert.equal(typeof emitWithCursor, 'function', 'cursor factory must return emit(reason)');

  emitWithCursor('cursor_first');
  assert.deepEqual(
    cursorLines,
    formatDeRuntimeDiagnosticLogLines({ runtime, reason: 'cursor_first', traceEntries: [traceEntries[0]] }),
    'first cursor emission must use the complete current trace delta through the shared formatter/emitter',
  );
  assert.deepEqual(traceEntriesFromLines(cursorLines), [firstProjection]);

  const unsafeMarkerEntry = fakeRuntimeTrace(secretSentinel, 1773379200150);
  const unsafeResponsePacket = fakeLegacyPacket('safe_marker');
  unsafeResponsePacket.payload.find((entry) => entry.k === 'response_pin').v = `UIPUT/${secretSentinel}`;
  const unsafeResponseEntry = {
    ...fakeRuntimeTrace('safe_marker', 1773379200151),
    payload: {
      ...fakeRuntimeTrace('safe_marker', 1773379200151).payload,
      payload: unsafeResponsePacket,
    },
  };
  const unsafeTopicEntry = {
    ...fakeRuntimeTrace('safe_marker', 1773379200152),
    payload: {
      ...fakeRuntimeTrace('safe_marker', 1773379200152).payload,
      topic: `UIPUT/${secretSentinel}`,
    },
  };
  const untrustedIngressEntry = {
    ...fakeRuntimeTrace('safe_marker', 1773379200153),
    payload: {
      ...fakeRuntimeTrace('safe_marker', 1773379200153).payload,
      ingress_pin: secretSentinel,
    },
  };
  const redactedTrace = buildDeRuntimeTraceEvidence({
    runtime,
    reason: 'strict_correlation',
    traceEntries: [unsafeMarkerEntry, unsafeResponseEntry, unsafeTopicEntry, untrustedIngressEntry],
  });
  assert.equal(redactedTrace.entries.length, 1, 'only the exact safe probe-shaped trace may be projected');
  assert.equal(redactedTrace.entries[0].payload.ingress_pin, 'r1_cb_in');
  assert.equal(
    JSON.stringify(redactedTrace).includes(secretSentinel),
    false,
    'marker, response topic, MQTT topic, and ingress metadata must never copy arbitrary payload text into trace logs',
  );

  traceEntries.push(fakeRuntimeTrace('cursor_second', 1773379200200));
  const secondProjection = expectedProjectedTrace(
    'cursor_second',
    1773379200200,
    stableSha256(traceEntries[1].payload.payload),
  );
  cursorLines = [];
  emitWithCursor('cursor_second');
  assert.deepEqual(
    cursorLines,
    formatDeRuntimeDiagnosticLogLines({ runtime, reason: 'cursor_second', traceEntries: [traceEntries[1]] }),
    'second cursor emission must contain only the newly appended trace entry',
  );
  assert.deepEqual(traceEntriesFromLines(cursorLines), [secondProjection]);

  cursorLines = [];
  emitWithCursor('cursor_empty_delta');
  assert.deepEqual(
    cursorLines,
    formatDeRuntimeDiagnosticLogLines({ runtime, reason: 'cursor_empty_delta', traceEntries: [] }),
    'an unchanged trace list must emit an empty delta rather than replay an old entry',
  );
  assert.deepEqual(traceEntriesFromLines(cursorLines), []);

  const retryTraceEntries = [fakeRuntimeTrace('cursor_retry', 1773379200300)];
  const retryProjection = expectedProjectedTrace(
    'cursor_retry',
    1773379200300,
    stableSha256(retryTraceEntries[0].payload.payload),
  );
  runtime.mqttTrace = {
    list: () => retryTraceEntries.slice(),
  };
  let failWriter = true;
  let writerCall = 0;
  let retryLines = [];
  const emitWithRetry = createDeRuntimeDiagnosticEmitter({
    runtime,
    writeLine: (line) => {
      writerCall += 1;
      if (failWriter && writerCall === 2) throw new Error('cursor_writer_failed');
      retryLines.push(line);
    },
  });
  assert.throws(
    () => emitWithRetry('cursor_failed_write'),
    /cursor_writer_failed/u,
    'shared cursor emitter must not swallow writer failures',
  );
  failWriter = false;
  writerCall = 0;
  retryLines = [];
  emitWithRetry('cursor_retry');
  assert.deepEqual(
    retryLines,
    formatDeRuntimeDiagnosticLogLines({ runtime, reason: 'cursor_retry', traceEntries: retryTraceEntries }),
    'cursor must advance only after the complete shared emitter write succeeds',
  );
  assert.deepEqual(traceEntriesFromLines(retryLines), [retryProjection]);
  retryLines = [];
  emitWithRetry('cursor_retry_empty');
  assert.deepEqual(traceEntriesFromLines(retryLines), [], 'successful retry must advance the cursor exactly once');

  return { key: 'diagnostic_helper_is_stable_pure_and_non_secret', status: 'PASS' };
}

function test_remote_worker_emits_machine_readable_diagnostic_marker() {
  const source = readFileSync(resolve(repoRoot, 'scripts/run_worker_remote_v1.mjs'), 'utf8');
  assert.match(
    source,
    /import\s*\{[^}]*\bcreateRoleScopedDeRuntimeDiagnosticHeartbeat\b[^}]*\}\s*from\s*['"]\.\/lib\/de_runtime_diagnostics\.mjs['"]/su,
    'shared runner must import the role-scoped diagnostic heartbeat factory',
  );
  assert.match(
    source,
    /const\s+runtimeDiagnostics\s*=\s*createRoleScopedDeRuntimeDiagnosticHeartbeat\(\{[\s\S]*?workerScope:\s*WORKER_SCOPE,[\s\S]*?runtime:\s*rt,[\s\S]*?heartbeatIntervalMs:\s*10000,[\s\S]*?\}\);/u,
    'runner must bind diagnostics to the actual worker scope and the shared runtime',
  );
  assert.match(source, /^runtimeDiagnostics\.start\(\);$/mu, 'runner must start the role-scoped lifecycle after MQTT startup');
  assert.match(source, /^\s*runtimeDiagnostics\.stop\(\);$/mu, 'runner shutdown must stop the role-scoped lifecycle');
  assert.doesNotMatch(source, /\bcreateDeRuntimeDiagnosticEmitter\b/u, 'shared runner must not bypass role scoping');
  assert.doesNotMatch(source, /function\s+emitMqttDiagnostics\b/u, 'runner must not keep a local diagnostic implementation');
  assert.doesNotMatch(source, /\bmqttTraceCursor\b/u, 'runner must not own the trace cursor');
  assert.doesNotMatch(source, /\bmqttTrace\.list\s*\(/u, 'runner must not read the trace list directly');
  assert.doesNotMatch(source, /\btrace\.slice\s*\(/u, 'runner must not slice a local trace list');
  assert.doesNotMatch(source, /\b(?:const|let|var)\s+delta\b/u, 'runner must not calculate a local trace delta');
  assert.doesNotMatch(
    source,
    /\b(?:emitDeRuntimeDiagnosticLogLines|formatDeRuntimeDiagnosticLogLines)\b/u,
    'runner must use only the shared cursor-owning factory, not lower-level emitters or formatters',
  );
  assert.doesNotMatch(source, /JSON\.stringify\(\s*(?:delta|trace)\b/u, 'runner must not serialize raw trace or delta');
  assert.doesNotMatch(source, /\bDE_RUNTIME_(?:DIAGNOSTIC|TRACE)_MARKER\b/u);
  assert.doesNotMatch(source, /MQTT trace delta:/u);
  assert.doesNotMatch(source, /DE_RUNTIME_DIAGNOSTIC[^\n]*(?:password|token|secret)/iu);

  return { key: 'remote_worker_emits_machine_readable_diagnostic_marker', status: 'PASS' };
}

async function test_role_scoped_diagnostics_skip_wm1_and_keep_r1_missing_model_fail_closed() {
  const {
    createDeRuntimeDiagnosticEmitter,
    createRoleScopedDeRuntimeDiagnosticHeartbeat,
  } = await loadDiagnosticModule();

  let wmFactoryCalls = 0;
  let wmTimerCalls = 0;
  let wmBeforeEmitCalls = 0;
  const wmLifecycle = createRoleScopedDeRuntimeDiagnosticHeartbeat({
    workerScope: 'workspace-manager',
    runtime: null,
    writeLine: () => {},
    beforeEmit: () => { wmBeforeEmitCalls += 1; },
    diagnosticFactory: () => {
      wmFactoryCalls += 1;
      throw new Error('wm1_diagnostic_factory_must_not_run');
    },
    setIntervalFn: () => {
      wmTimerCalls += 1;
      throw new Error('wm1_diagnostic_timer_must_not_run');
    },
    clearIntervalFn: () => {},
    heartbeatIntervalMs: 10000,
  });
  assert.equal(wmLifecycle.enabled, false);
  assert.deepEqual(wmLifecycle.start(), []);
  wmLifecycle.stop();
  assert.equal(wmFactoryCalls, 0, 'WM1 must not create the Model3200 diagnostic emitter');
  assert.equal(wmTimerCalls, 0, 'WM1 must not register the Model3200 diagnostic/trace timer');
  assert.equal(wmBeforeEmitCalls, 0, 'WM1 must not call any diagnostic emission hook');

  const missingRuntime = new ModelTableRuntime();
  let r1FactoryCalls = 0;
  let r1TimerCalls = 0;
  const missingR1Lifecycle = createRoleScopedDeRuntimeDiagnosticHeartbeat({
    workerScope: 'remote-worker',
    runtime: missingRuntime,
    writeLine: () => {},
    diagnosticFactory: (options) => {
      r1FactoryCalls += 1;
      return createDeRuntimeDiagnosticEmitter(options);
    },
    setIntervalFn: () => {
      r1TimerCalls += 1;
      return 1;
    },
    clearIntervalFn: () => {},
    heartbeatIntervalMs: 10000,
  });
  assert.equal(missingR1Lifecycle.enabled, true);
  assert.equal(r1FactoryCalls, 1, 'R1 must create the real Model3200 diagnostic emitter');
  assert.throws(
    () => missingR1Lifecycle.start(),
    /model3200 snapshot is required/u,
    'R1 without Model3200 must remain fail-closed',
  );
  assert.equal(r1TimerCalls, 0, 'R1 must fail before registering a misleading heartbeat timer');

  const reasons = [];
  let intervalCallback = null;
  let intervalDelay = null;
  let clearCount = 0;
  const timerHandle = { unrefCalls: 0, unref() { this.unrefCalls += 1; } };
  const healthyR1Lifecycle = createRoleScopedDeRuntimeDiagnosticHeartbeat({
    workerScope: 'remote-worker',
    runtime: {},
    writeLine: () => {},
    beforeEmit: (reason) => reasons.push(`before:${reason}`),
    diagnosticFactory: () => (reason) => {
      reasons.push(`emit:${reason}`);
      return [reason];
    },
    setIntervalFn: (callback, delay) => {
      intervalCallback = callback;
      intervalDelay = delay;
      return timerHandle;
    },
    clearIntervalFn: (handle) => {
      assert.equal(handle, timerHandle);
      clearCount += 1;
    },
    heartbeatIntervalMs: 10000,
  });
  assert.deepEqual(healthyR1Lifecycle.start(), ['after_start']);
  assert.equal(intervalDelay, 10000);
  assert.equal(timerHandle.unrefCalls, 1);
  intervalCallback();
  healthyR1Lifecycle.stop();
  healthyR1Lifecycle.stop();
  assert.deepEqual(reasons, [
    'before:after_start',
    'emit:after_start',
    'before:interval',
    'emit:interval',
  ]);
  assert.equal(clearCount, 1);

  return { key: 'role_scoped_diagnostics_skip_wm1_and_keep_r1_missing_model_fail_closed', status: 'PASS' };
}

const tests = [
  test_diagnostic_helper_is_stable_pure_and_non_secret,
  test_remote_worker_emits_machine_readable_diagnostic_marker,
  test_role_scoped_diagnostics_skip_wm1_and_keep_r1_missing_model_fail_closed,
];

let failed = 0;
const results = [];
for (const test of tests) {
  try {
    results.push(await test());
  } catch (error) {
    failed += 1;
    results.push({ key: test.name, status: 'FAIL', error: error?.stack || String(error) });
  }
}

for (const result of results) {
  if (result.status === 'PASS') {
    process.stdout.write(`[PASS] ${result.key}\n`);
  } else {
    process.stderr.write(`[FAIL] ${result.key}\n${result.error}\n`);
  }
}
process.stdout.write(`${tests.length - failed} passed, ${failed} failed out of ${tests.length}\n`);
if (failed > 0) process.exit(1);
