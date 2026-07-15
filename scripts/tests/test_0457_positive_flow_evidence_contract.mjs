#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const helperPath = resolve(repoRoot, 'packages/worker-base/src/de_pin_flow_evidence.mjs');
const wiringPath = resolve(repoRoot, 'packages/worker-base/src/de_pin_flow_wiring.mjs');
const serverPath = resolve(repoRoot, 'packages/ui-model-demo-server/server.mjs');
const mbrRunnerPath = resolve(repoRoot, 'scripts/run_worker_v0.mjs');
const r1RunnerPath = resolve(repoRoot, 'scripts/run_worker_remote_v1.mjs');
const networkHelperPath = resolve(repoRoot, 'scripts/lib/de_network_boundary_evidence.mjs');
const mbrDockerfilePath = resolve(repoRoot, 'k8s/Dockerfile.mbr-worker');
const r1DockerfilePath = resolve(repoRoot, 'k8s/Dockerfile.remote-worker');
const uiDockerfilePaths = [
  resolve(repoRoot, 'k8s/Dockerfile.ui-server'),
  resolve(repoRoot, 'k8s/Dockerfile.ui-server-prebuilt'),
];

const fixedNow = 1773379200000;
const secretSentinel = '0457-positive-flow-secret-must-never-appear';

async function test_mqtt_publish_ack_waits_for_callback_and_preserves_failures() {
  const { publishMqttWithAck } = await import('../../packages/worker-base/src/mqtt_publish_ack.mjs');
  assert.equal(typeof publishMqttWithAck, 'function');
  const calls = [];
  const client = {
    publish(topic, body, callback) {
      calls.push({ topic, body });
      queueMicrotask(() => callback(null, { qos: 0 }));
      return this;
    },
  };
  const packetValue = { version: 'v1', type: 'pin_payload', payload: [] };
  assert.deepEqual(
    await publishMqttWithAck(client, 'local/topic', packetValue),
    { qos: 0 },
    'callback success must resolve with the MQTT acknowledgement value',
  );
  assert.deepEqual(calls, [{ topic: 'local/topic', body: JSON.stringify(packetValue) }]);

  await assert.rejects(
    publishMqttWithAck({
      publish(_topic, _body, callback) {
        queueMicrotask(() => callback(new Error('callback rejected')));
      },
    }, 'local/topic', packetValue),
    /callback rejected/u,
    'callback failure must reject instead of treating the returned client as success',
  );
  await assert.rejects(
    publishMqttWithAck({ publish() { throw new Error('sync publish rejected'); } }, 'local/topic', packetValue),
    /sync publish rejected/u,
  );
  const circular = {};
  circular.self = circular;
  await assert.rejects(
    publishMqttWithAck(client, 'local/topic', circular),
    /circular/u,
    'serialization failure must reject before invoking the MQTT client',
  );
  assert.equal(calls.length, 1, 'serialization failure must not create an outbound attempt');
  return { key: 'mqtt_publish_ack_waits_for_callback_and_preserves_failures', status: 'PASS' };
}

function mt(k, t, v, id = 0) {
  return { id, p: 0, r: 0, c: 0, k, t, v };
}

function packet({
  requestId = 'positive_flow_0457',
  opId = requestId,
  messageRole = 'request',
  bus = 'control',
  routeKind = bus,
  timestamp = fixedNow,
  endpoint = { worker_id: 'R1', table_id: 'host', model_id: 3200, pin: 'resource' },
  replyTarget = { worker_id: 'U1', table_id: 'app:workspace:a', model_id: 100, pin: 'result' },
} = {}) {
  return {
    version: 'v1',
    type: 'pin_payload',
    payload: [
      mt('__mt_payload_kind', 'str', 'pin_payload.v2'),
      mt('__mt_request_id', 'str', requestId),
      mt('op_id', 'str', opId),
      mt('message_role', 'str', messageRole),
      mt('bus', 'str', bus),
      mt('route_kind', 'str', routeKind),
      mt('topic', 'str', `UIPUT/ws/dam/pic/de/${endpoint.worker_id}/${endpoint.model_id}/${endpoint.pin}`),
      mt('response_topic', 'str', `UIPUT/ws/dam/pic/de/${replyTarget.worker_id}/${replyTarget.model_id}/${replyTarget.pin}`),
      mt('endpoint_worker_id', 'str', endpoint.worker_id),
      mt('endpoint_table_id', 'str', endpoint.table_id),
      mt('endpoint_model_id', 'int', endpoint.model_id),
      mt('endpoint_pin', 'str', endpoint.pin),
      mt('origin_worker_id', 'str', 'U1'),
      mt('origin_table_id', 'str', 'workspace-a'),
      mt('origin_model_id', 'int', 100),
      mt('origin_pin', 'str', 'submit'),
      mt('reply_target_worker_id', 'str', replyTarget.worker_id),
      mt('reply_target_table_id', 'str', replyTarget.table_id),
      mt('reply_target_model_id', 'int', replyTarget.model_id),
      mt('reply_target_pin', 'str', replyTarget.pin),
      mt('payload_model_id', 'int', 1),
      ...(timestamp === null ? [] : [mt('timestamp', 'int', timestamp)]),
      mt('body', 'json', {
        token: secretSentinel,
        access_token: secretSentinel,
        text: secretSentinel,
      }, 1),
    ],
  };
}

async function test_shared_schema_is_strict_correlated_fresh_and_non_secret() {
  const {
    DE_PIN_FLOW_EVIDENCE_MARKER,
    buildDePinFlowEvidence,
    createDePinFlowEvidenceEmitter,
    evaluateDePinFlowEvidence,
    evaluateDePinFlowEvidenceSequence,
    formatDePinFlowEvidenceLine,
    parseDePinFlowEvidenceLines,
    projectDePinFlowPacket,
  } = await import('../lib/../../packages/worker-base/src/de_pin_flow_evidence.mjs');

  assert.equal(DE_PIN_FLOW_EVIDENCE_MARKER, 'DE_PIN_FLOW_EVIDENCE');
  const input = packet();
  const inputBefore = JSON.stringify(input);
  const evidence = buildDePinFlowEvidence({
    producer: 'ui-server',
    stage: 'control_outbound_attempt',
    packet: input,
    ts: fixedNow,
  });
  assert.equal(JSON.stringify(input), inputBefore, 'building evidence must not mutate the packet');
  assert.deepEqual(Object.keys(evidence), [
    'schema',
    'ts',
    'producer',
    'stage',
    'request_id',
    'op_id',
    'message_role',
    'bus',
    'route_kind',
    'endpoint',
    'reply_target',
    'payload_sha256',
  ]);
  assert.deepEqual(evidence.endpoint, { table_id: 'host', model_id: 3200, pin: 'resource' });
  assert.deepEqual(evidence.reply_target, { table_id: 'app:workspace:a', model_id: 100, pin: 'result' });
  assert.match(evidence.payload_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(evidence).includes(secretSentinel), false, 'evidence must contain only a hash of the packet');
  assert.deepEqual(projectDePinFlowPacket(input), {
    request_id: 'positive_flow_0457',
    op_id: 'positive_flow_0457',
    message_role: 'request',
    bus: 'control',
    route_kind: 'control',
    endpoint: { table_id: 'host', model_id: 3200, pin: 'resource' },
    reply_target: { table_id: 'app:workspace:a', model_id: 100, pin: 'result' },
    payload_sha256: evidence.payload_sha256,
  });

  const line = formatDePinFlowEvidenceLine(evidence);
  assert.equal(line.includes(secretSentinel), false, 'formatted evidence must not expose payload values');
  assert.deepEqual(parseDePinFlowEvidenceLines(`noise\n${line}\n`), [evidence]);
  assert.deepEqual(
    evaluateDePinFlowEvidence(evidence, {
      since: fixedNow - 1,
      now: fixedNow + 100,
      maxAgeMs: 1000,
      requestId: 'positive_flow_0457',
      opId: 'positive_flow_0457',
      replyTarget: { table_id: 'app:workspace:a', model_id: 100, pin: 'result' },
    }),
    { ok: true, code: 'pin_flow_evidence_valid' },
  );
  assert.equal(
    evaluateDePinFlowEvidence(evidence, { since: fixedNow + 1, now: fixedNow + 2 }).code,
    'stale_pin_flow_evidence',
  );
  assert.equal(
    evaluateDePinFlowEvidence(evidence, { requestId: 'wrong-correlation' }).code,
    'pin_flow_correlation_mismatch',
  );
  assert.equal(
    evaluateDePinFlowEvidence(evidence, {
      replyTarget: { table_id: 'app:workspace:b', model_id: 100, pin: 'result' },
    }).code,
    'pin_flow_reply_target_mismatch',
  );
  assert.throws(
    () => parseDePinFlowEvidenceLines(`${DE_PIN_FLOW_EVIDENCE_MARKER} {"schema":"wrong"}`),
    /invalid_pin_flow_evidence/u,
    'a marker-shaped malformed line must fail closed',
  );

  const second = buildDePinFlowEvidence({
    producer: 'r1',
    stage: 'model_dispatch',
    packet: input,
    ts: fixedNow + 10,
  });
  assert.deepEqual(
    evaluateDePinFlowEvidenceSequence([evidence, second], {
      since: fixedNow - 1,
      now: fixedNow + 100,
      maxAgeMs: 1000,
      requestId: 'positive_flow_0457',
      opId: 'positive_flow_0457',
      replyTarget: { table_id: 'app:workspace:a', model_id: 100, pin: 'result' },
      requiredStages: [
        { producer: 'ui-server', stage: 'control_outbound_attempt' },
        { producer: 'r1', stage: 'model_dispatch' },
      ],
    }),
    { ok: true, code: 'pin_flow_sequence_complete' },
  );
  assert.equal(
    evaluateDePinFlowEvidenceSequence([evidence], {
      requestId: 'positive_flow_0457',
      requiredStages: [{ producer: 'r1', stage: 'model_dispatch' }],
    }).code,
    'pin_flow_stage_missing',
  );
  const reversedTime = buildDePinFlowEvidence({
    producer: 'r1',
    stage: 'model_dispatch',
    packet: input,
    ts: fixedNow - 10,
  });
  assert.equal(
    evaluateDePinFlowEvidenceSequence([evidence, reversedTime], {
      requestId: 'positive_flow_0457',
      opId: 'positive_flow_0457',
      requiredStages: [
        { producer: 'ui-server', stage: 'control_outbound_attempt' },
        { producer: 'r1', stage: 'model_dispatch' },
      ],
    }).code,
    'pin_flow_stage_order_mismatch',
    'required stages with decreasing event timestamps must fail closed',
  );
  const sameTimeDispatch = buildDePinFlowEvidence({
    producer: 'r1',
    stage: 'model_dispatch',
    packet: input,
    ts: fixedNow,
  });
  assert.equal(
    evaluateDePinFlowEvidenceSequence([sameTimeDispatch, evidence], {
      requestId: 'positive_flow_0457',
      opId: 'positive_flow_0457',
      requiredStages: [
        { producer: 'ui-server', stage: 'control_outbound_attempt' },
        { producer: 'r1', stage: 'model_dispatch' },
      ],
    }).code,
    'pin_flow_stage_order_mismatch',
    'equal-timestamp stages must preserve their actual input event order',
  );

  const emitted = [];
  const emit = createDePinFlowEvidenceEmitter({
    producer: 'mbr',
    writeLine: (value) => emitted.push(value),
    now: () => fixedNow,
  });
  emit('management_ingress', packet({ bus: 'management', routeKind: 'management' }));
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].includes(secretSentinel), false);

  for (const invalid of [
    packet({ requestId: '', opId: '' }),
    packet({ messageRole: 'unknown' }),
    packet({ replyTarget: { worker_id: 'U1', table_id: 'app:workspace:a', model_id: 100, pin: '../secret' } }),
  ]) {
    assert.throws(
      () => buildDePinFlowEvidence({ producer: 'ui-server', stage: 'control_outbound_attempt', packet: invalid, ts: fixedNow }),
      /invalid_pin_flow_packet/u,
    );
  }
  assert.throws(
    () => buildDePinFlowEvidence({ producer: 'r1', stage: 'management_ingress', packet: input, ts: fixedNow }),
    /invalid_pin_flow_stage/u,
  );
  assert.throws(
    () => buildDePinFlowEvidence({
      producer: 'r1',
      stage: 'control_ingress',
      packet: packet({ timestamp: null }),
      ts: fixedNow,
    }),
    /invalid_pin_flow_packet/u,
    'evidence must reject a packet that the canonical positive pin rejects for missing timestamp',
  );
  const invalidTimestamp = packet();
  const timestampRecord = invalidTimestamp.payload.find((record) => record.id === 0 && record.k === 'timestamp');
  timestampRecord.t = 'str';
  timestampRecord.v = String(timestampRecord.v);
  assert.throws(
    () => buildDePinFlowEvidence({
      producer: 'r1',
      stage: 'control_ingress',
      packet: invalidTimestamp,
      ts: fixedNow,
    }),
    /invalid_pin_flow_packet/u,
    'evidence must reject a packet with a non-integer payload timestamp',
  );

  return { key: 'shared_schema_is_strict_correlated_fresh_and_non_secret', status: 'PASS' };
}

function test_production_points_and_images_use_shared_evidence() {
  const helperSource = readFileSync(helperPath, 'utf8');
  const wiringSource = readFileSync(wiringPath, 'utf8');
  const serverSource = readFileSync(serverPath, 'utf8');
  const mbrSource = readFileSync(mbrRunnerPath, 'utf8');
  const r1Source = readFileSync(r1RunnerPath, 'utf8');
  const networkSource = readFileSync(networkHelperPath, 'utf8');

  assert.match(helperSource, /DE_PIN_FLOW_EVIDENCE/u);
  assert.doesNotMatch(helperSource, /feishu/iu, 'generic positive-flow evidence must not contain provider-specific branches');
  assert.doesNotMatch(helperSource, /addLabel|rmLabel|getModel|readCrossModel|writeCrossModel/u, 'evidence must not mutate or directly read actor state');

  assert.match(serverSource, /de_pin_flow_evidence\.mjs/u, 'UI server must import the shared evidence helper');
  for (const stage of ['control_outbound_attempt', 'management_outbound_attempt', 'validated_response_materialized']) {
    assert.match(serverSource, new RegExp(stage, 'u'), `missing production stage ${stage}`);
  }
  assert.match(mbrSource, /createMbrPinFlowEvidenceWiring/u, 'MBR runner must execute shared injectable wiring');
  assert.match(r1Source, /createR1PinFlowEvidenceWiring/u, 'R1/WM1 runner must execute shared injectable wiring');
  for (const stage of [
    'management_ingress',
    'control_forward',
    'control_response_ingress',
    'management_response_forward',
    'control_ingress',
    'model_dispatch',
    'control_response',
  ]) {
    assert.match(wiringSource, new RegExp(stage, 'u'), `missing shared production wiring stage ${stage}`);
  }
  for (const source of [serverSource, mbrSource, r1Source, wiringSource]) {
    assert.doesNotMatch(source, /DE_PIN_FLOW_EVIDENCE[^\n]*(?:payload|token|secret)/iu, 'processes must not build ad-hoc evidence lines');
  }

  assert.match(serverSource, /createDeNetworkBoundaryObservability/u, 'UI server must use the shared network-boundary helper');
  assert.match(networkSource, /['"]ui-server['"]/u, 'network schema must recognize the UI server producer');
  assert.match(networkSource, /service\s*===\s*['"]ui-server['"]/u, 'network allowlist must evaluate UI server destinations explicitly');

  const mbrDockerfile = readFileSync(mbrDockerfilePath, 'utf8');
  assert.match(mbrDockerfile, /COPY packages\/worker-base\/src\//u, 'MBR image must include the shared pin-flow helper through worker-base src');
  assert.match(mbrDockerfile, /de_network_boundary_evidence\.mjs/u, 'MBR image must include its imported network helper');
  assert.match(mbrDockerfile, /de_actor_attestation\.mjs/u, 'MBR image must include its imported attestation helper');
  assert.match(readFileSync(r1DockerfilePath, 'utf8'), /COPY packages\/worker-base\/src\//u);
  for (const dockerfilePath of uiDockerfilePaths) {
    const dockerfile = readFileSync(dockerfilePath, 'utf8');
    assert.match(dockerfile, /COPY packages\/worker-base\//u, 'UI image must include the shared pin-flow helper');
    assert.match(dockerfile, /de_network_boundary_evidence\.mjs/u, 'UI image must include its imported network helper');
  }

  return { key: 'production_points_and_images_use_shared_evidence', status: 'PASS' };
}

async function test_r1_wiring_emits_only_accepted_dispatch_and_successful_response() {
  const {
    createDePinFlowEvidenceEmitter,
    parseDePinFlowEvidenceLines,
  } = await import('../../packages/worker-base/src/de_pin_flow_evidence.mjs');
  const { createR1PinFlowEvidenceWiring } = await import('../../packages/worker-base/src/de_pin_flow_wiring.mjs');
  const lines = [];
  const evidenceErrors = [];
  let observer = null;
  let eventResult = 'applied';
  let observedPacket = null;
  const runtime = {
    eventLog: {
      setObserver: (value) => { observer = value; },
    },
    mqttIncoming: (_topic, value) => {
      observer({
        op: 'add_label',
        result: eventResult,
        reason: eventResult === 'applied' ? null : 'pin_payload_missing_timestamp',
        cell: { model_id: 3200, p: 0, r: 0, c: 0 },
        label: { k: 'resource', t: 'pin.in', v: (observedPacket || value).payload },
      });
      return true;
    },
  };
  let now = fixedNow;
  const emitEvidence = createDePinFlowEvidenceEmitter({
    producer: 'r1',
    writeLine: (line) => lines.push(line),
    now: () => now++,
  });
  const wiring = createR1PinFlowEvidenceWiring({
    runtime,
    emitEvidence,
    onEvidenceError: (error) => evidenceErrors.push(error),
  });
  assert.equal(typeof observer, 'function', 'R1 wiring must install the production event observer');

  const accepted = packet({ requestId: 'r1_accepted_0457' });
  assert.equal(wiring.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3200/resource', accepted), true);
  let evidence = parseDePinFlowEvidenceLines(lines.join('\n'));
  assert.deepEqual(evidence.map((entry) => entry.stage), ['control_ingress', 'model_dispatch']);
  assert.ok(evidence.every((entry) => entry.request_id === 'r1_accepted_0457'));

  const beforeRejected = lines.length;
  eventResult = 'rejected';
  const missingTimestamp = packet({ requestId: 'r1_missing_timestamp_0457', timestamp: null });
  assert.equal(wiring.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3200/resource', missingTimestamp), true);
  evidence = parseDePinFlowEvidenceLines(lines.slice(beforeRejected).join('\n'));
  assert.deepEqual(
    evidence.map((entry) => entry.stage),
    [],
    'a missing-timestamp packet and its rejected positive pin write must produce no flow evidence',
  );
  assert.deepEqual(evidenceErrors, [
    { code: 'pin_flow_evidence_rejected', stage: 'control_ingress' },
  ]);
  assert.equal(JSON.stringify(evidenceErrors).includes(secretSentinel), false, 'R1 evidence errors must stay redacted');
  observer({
    op: 'add_label',
    result: 'applied',
    cell: { model_id: 3200, p: 0, r: 0, c: 0 },
    label: { k: 'resource', t: 'pin.in', v: accepted.payload },
  });
  assert.equal(lines.length, beforeRejected, 'an applied pin write outside the accepted MQTT call must not emit dispatch');

  eventResult = 'applied';
  for (const [name, mismatched] of [
    ['request_id', packet({ requestId: 'r1_wrong_request_0457', opId: 'r1_accepted_0457' })],
    ['op_id', packet({ requestId: 'r1_accepted_0457', opId: 'r1_wrong_op_0457' })],
  ]) {
    observedPacket = mismatched;
    const beforeWrongCorrelation = lines.length;
    wiring.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3200/resource', accepted);
    evidence = parseDePinFlowEvidenceLines(lines.slice(beforeWrongCorrelation).join('\n'));
    assert.deepEqual(
      evidence.map((entry) => entry.stage),
      ['control_ingress'],
      `an applied pin event with a different ${name} must not emit model_dispatch`,
    );
  }
  observedPacket = null;

  const response = packet({ requestId: 'r1_response_0457', messageRole: 'response' });
  const publishCalls = [];
  const publishResult = wiring.publishControlResponse((topic, value) => {
    publishCalls.push({ topic, value });
    return 'published';
  }, 'UIPUT/ws/dam/pic/de/U1/100/result', response);
  assert.equal(publishResult, 'published');
  assert.equal(publishCalls.length, 1);
  assert.equal(parseDePinFlowEvidenceLines(lines.join('\n')).at(-1).stage, 'control_response');
  const beforeThrow = lines.length;
  assert.throws(
    () => wiring.publishControlResponse(() => { throw new Error('publish rejected'); }, 'topic', response),
    /publish rejected/u,
  );
  assert.equal(lines.length, beforeThrow, 'failed response publish must not emit evidence');
  await assert.rejects(
    wiring.publishControlResponse(
      () => Promise.reject(new Error('async publish rejected')),
      'topic',
      response,
    ),
    /async publish rejected/u,
  );
  assert.equal(lines.length, beforeThrow, 'async callback failure must not emit control_response evidence');
  assert.equal(lines.some((line) => line.includes(secretSentinel)), false, 'R1 evidence must redact packet secrets');

  return { key: 'r1_wiring_emits_only_accepted_dispatch_and_successful_response', status: 'PASS' };
}

async function test_mbr_wiring_executes_ingress_forward_response_and_rejections() {
  const {
    createDePinFlowEvidenceEmitter,
    parseDePinFlowEvidenceLines,
  } = await import('../../packages/worker-base/src/de_pin_flow_evidence.mjs');
  const { createMbrPinFlowEvidenceWiring } = await import('../../packages/worker-base/src/de_pin_flow_wiring.mjs');
  const lines = [];
  const evidenceErrors = [];
  let now = fixedNow;
  let outboundAttempts = 0;
  const emitEvidence = createDePinFlowEvidenceEmitter({
    producer: 'mbr',
    writeLine: (line) => lines.push(line),
    now: () => now++,
  });
  const wiring = createMbrPinFlowEvidenceWiring({
    emitEvidence,
    onEvidenceError: (error) => evidenceErrors.push(error),
  });
  const request = packet({
    requestId: 'mbr_roundtrip_0457',
    bus: 'management',
    routeKind: 'management',
  });
  const response = packet({
    requestId: 'mbr_roundtrip_0457',
    messageRole: 'response',
    bus: 'management',
    routeKind: 'management',
  });

  assert.deepEqual(wiring.recordManagementIngress(request, () => ({ applied: true })), { applied: true });
  const controlPublishes = [];
  outboundAttempts += 1;
  const publishResult = ((topic, value) => {
    controlPublishes.push({ topic, value });
    return 'published';
  })('UIPUT/ws/dam/pic/de/R1/3200/resource', request);
  wiring.recordControlForward(request, publishResult);
  assert.equal(controlPublishes.length, 1);
  assert.equal(outboundAttempts, 1);
  assert.deepEqual(wiring.recordControlResponseIngress(response, () => ({ applied: true })), { applied: true });
  const managementPublishes = [];
  await wiring.publishManagementResponse(async (value) => {
    managementPublishes.push(value);
    return 'sent';
  }, response);
  assert.equal(managementPublishes.length, 1);

  let evidence = parseDePinFlowEvidenceLines(lines.join('\n'));
  assert.deepEqual(evidence.map((entry) => entry.stage), [
    'management_ingress',
    'control_forward',
    'control_response_ingress',
    'management_response_forward',
  ]);
  assert.ok(evidence.every((entry) => entry.request_id === 'mbr_roundtrip_0457'));
  assert.ok(evidence.every((entry) => entry.op_id === 'mbr_roundtrip_0457'));

  const beforeRejected = lines.length;
  assert.deepEqual(wiring.recordManagementIngress(request, () => ({ applied: false })), { applied: false });
  assert.deepEqual(wiring.recordControlResponseIngress(response, () => ({ applied: false })), { applied: false });
  assert.throws(
    () => {
      const rejectedPublish = (() => { throw new Error('mqtt publish rejected'); })();
      wiring.recordControlForward(request, rejectedPublish);
    },
    /mqtt publish rejected/u,
  );
  await assert.rejects(
    wiring.recordControlForward(request, Promise.reject(new Error('mqtt callback rejected'))),
    /mqtt callback rejected/u,
  );
  await assert.rejects(
    wiring.publishManagementResponse(async () => { throw new Error('matrix publish rejected'); }, response),
    /matrix publish rejected/u,
  );
  evidence = parseDePinFlowEvidenceLines(lines.slice(beforeRejected).join('\n'));
  assert.deepEqual(evidence, [], 'rejected ingress and failed forwards must not emit success evidence');
  const malformedApplied = packet({ requestId: 'mbr_missing_timestamp_0457', timestamp: null });
  assert.deepEqual(
    wiring.recordManagementIngress(malformedApplied, () => ({ applied: true })),
    { applied: true },
  );
  assert.deepEqual(evidenceErrors, [
    { code: 'pin_flow_evidence_rejected', stage: 'management_ingress' },
  ]);
  assert.equal(JSON.stringify(evidenceErrors).includes(secretSentinel), false, 'MBR evidence errors must stay redacted');
  assert.equal(lines.some((line) => line.includes(secretSentinel)), false, 'MBR evidence must redact packet secrets');

  return { key: 'mbr_wiring_executes_ingress_forward_response_and_rejections', status: 'PASS' };
}

async function test_ui_server_owns_fresh_local_network_evidence_lifecycle() {
  const {
    buildDeNetworkBoundaryEvidence,
    evaluateDeNetworkBoundaryEvidence,
  } = await import('../lib/de_network_boundary_evidence.mjs');
  const localMqtt = buildDeNetworkBoundaryEvidence({
    kind: 'outbound_attempt',
    service: 'ui-server',
    destination: 'mqtt://mosquitto.dongyu.svc.cluster.local:1883',
    ts: fixedNow,
  });
  const localMatrix = buildDeNetworkBoundaryEvidence({
    kind: 'effective_config',
    service: 'ui-server',
    destination: 'http://synapse.dongyu.svc.cluster.local:8008',
    ts: fixedNow,
  });
  assert.deepEqual(evaluateDeNetworkBoundaryEvidence(localMqtt, { since: fixedNow }), {
    ok: true,
    code: 'network_boundary_allowed',
  });
  assert.deepEqual(evaluateDeNetworkBoundaryEvidence(localMatrix, { since: fixedNow }), {
    ok: true,
    code: 'network_boundary_allowed',
  });
  assert.equal(
    evaluateDeNetworkBoundaryEvidence(buildDeNetworkBoundaryEvidence({
      kind: 'outbound_attempt',
      service: 'ui-server',
      destination: 'mqtt://remote.example.test:1883',
      ts: fixedNow,
    }), { since: fixedNow }).code,
    'network_boundary_violation',
  );

  const previousPatch = process.env.MODELTABLE_PATCH_JSON;
  process.env.MODELTABLE_PATCH_JSON = JSON.stringify({
    version: 'mt.v0',
    op_id: 'positive_flow_ui_network_fixture',
    records: [
      { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'local_ip', t: 'mqtt.local.ip', v: ['mosquitto.dongyu.svc.cluster.local'] },
      { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'local_port', t: 'mqtt.local.port', v: ['1883'] },
      { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_server', t: 'matrix.server', v: 'http://synapse.dongyu.svc.cluster.local:8008' },
    ],
  });
  const installations = [];
  const attempts = [];
  const evidenceLines = [];
  const controlPublishes = [];
  const matrixPublishes = [];
  let stopped = 0;
  let state = null;
  try {
    const { createServerState } = await import('../../packages/ui-model-demo-server/server.mjs');
    state = createServerState({
      dbPath: null,
      seedSlidInApps: false,
      skipPersistedAssets: true,
      evidenceWriteLine: (line) => evidenceLines.push(line),
      evidenceNow: () => fixedNow,
      networkBoundaryObservabilityFactory: (options) => {
        installations.push(options);
        return {
          recordOutbound: (destination) => attempts.push(destination),
          stop: () => { stopped += 1; },
        };
      },
    });
    await state.whenReady();
    assert.equal(installations.length, 1, 'UI server must install one process-owned network observer');
    assert.equal(installations[0].service, 'ui-server');
    assert.deepEqual(installations[0].effectiveDestinations.sort(), [
      'http://synapse.dongyu.svc.cluster.local:8008',
      'mqtt://mosquitto.dongyu.svc.cluster.local:1883',
    ]);
    assert.equal(installations[0].heartbeatIntervalMs, 10000);
    state.runtime.setRuntimeMode('running');
    state.programEngine.controlBusClient = {
      connected: true,
      publish: (topic, body, callback) => {
        controlPublishes.push({ topic, body });
        callback(null);
      },
      end: (_force, _options, callback) => callback(),
      removeAllListeners: () => {},
    };
    const controlPacket = packet();
    await state.programEngine.sendControlBus('UIPUT/ws/dam/pic/de/R1/3200/resource', controlPacket);
    state.programEngine.matrixRoomId = '!positive-flow:local';
    state.programEngine.matrixDmPeerUserId = '@mbr:local';
    state.programEngine.matrixAdapter = {
      publish: async (value) => { matrixPublishes.push(value); },
      close: async () => {},
    };
    const managementPacket = packet({ bus: 'management', routeKind: 'management' });
    await state.programEngine.sendMatrix(managementPacket);
    assert.equal(controlPublishes.length, 1, 'control evidence must accompany a real MQTT publish call');
    assert.equal(matrixPublishes.length, 1, 'management evidence must accompany a real Matrix publish call');
    assert.deepEqual(attempts, [
      'mqtt://mosquitto.dongyu.svc.cluster.local:1883',
      'http://synapse.dongyu.svc.cluster.local:8008',
    ]);
    const flowEvidence = parseDePinFlowLines(evidenceLines);
    assert.deepEqual(flowEvidence.map((entry) => entry.stage), [
      'control_outbound_attempt',
      'management_outbound_attempt',
    ]);
    assert.equal(evidenceLines.some((line) => line.includes(secretSentinel)), false);
    await state.shutdown();
    assert.equal(stopped, 1, 'UI server shutdown must stop its periodic evidence heartbeat exactly once');
  } finally {
    if (state && stopped === 0) await state.shutdown().catch(() => {});
    if (previousPatch === undefined) delete process.env.MODELTABLE_PATCH_JSON;
    else process.env.MODELTABLE_PATCH_JSON = previousPatch;
  }

  return { key: 'ui_server_owns_fresh_local_network_evidence_lifecycle', status: 'PASS' };
}

function parseDePinFlowLines(lines) {
  return lines
    .filter((line) => line.startsWith('DE_PIN_FLOW_EVIDENCE '))
    .map((line) => JSON.parse(line.slice('DE_PIN_FLOW_EVIDENCE '.length)));
}

const tests = [
  test_mqtt_publish_ack_waits_for_callback_and_preserves_failures,
  test_shared_schema_is_strict_correlated_fresh_and_non_secret,
  test_production_points_and_images_use_shared_evidence,
  test_r1_wiring_emits_only_accepted_dispatch_and_successful_response,
  test_mbr_wiring_executes_ingress_forward_response_and_rejections,
  test_ui_server_owns_fresh_local_network_evidence_lifecycle,
];

let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    process.stdout.write(`[PASS] ${result.key}\n`);
  } catch (error) {
    failed += 1;
    process.stderr.write(`[FAIL] ${test.name}\n${error && error.stack ? error.stack : error}\n`);
  }
}
process.stdout.write(`${tests.length - failed} passed, ${failed} failed out of ${tests.length}\n`);
if (failed > 0) process.exit(1);
