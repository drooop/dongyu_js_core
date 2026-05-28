#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { validateUnifiedEndpointTopicPacket } from '../run_worker_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const topicBase = ['UIPUT', 'ws', 'dam', 'pic', 'de'].join('/');
const oldTopicBase = [topicBase, 'sw'].join('/');
const requestTopic = [topicBase, 'R1', '3000', 'submit1'].join('/');
const responseTopic = [topicBase, 'U1', '2000', 'result'].join('/');

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function configureRuntime(workerId = 'R1', base = topicBase) {
  const rt = new ModelTableRuntime();
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: base });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: workerId });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
  return rt;
}

function pinPayloadRecords({
  opId = 'req_0396',
  messageRole = 'request',
  topic = requestTopic,
  responseTopicValue = responseTopic,
  includeResponseTopic = true,
  endpoint = { worker_id: 'R1', model_id: 3000, pin: 'submit1' },
  origin = { worker_id: 'U1', model_id: 2000, pin: 'submit1' },
  replyTarget = { worker_id: 'U1', model_id: 2000, pin: 'result' },
  payload = [mt('text', 'str', 'hello 0396')],
} = {}) {
  const records = [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('topic', 'str', topic),
    mt('route_kind', 'str', 'control'),
    mt('bus', 'str', 'control'),
    mt('endpoint_worker_id', 'str', endpoint.worker_id),
    mt('endpoint_model_id', 'int', endpoint.model_id),
    mt('endpoint_pin', 'str', endpoint.pin),
    mt('origin_worker_id', 'str', origin.worker_id),
    mt('origin_model_id', 'int', origin.model_id),
    mt('origin_pin', 'str', origin.pin),
    mt('reply_target_worker_id', 'str', replyTarget.worker_id),
    mt('reply_target_model_id', 'int', replyTarget.model_id),
    mt('reply_target_pin', 'str', replyTarget.pin),
    mt('payload', 'json', payload),
    mt('timestamp', 'int', 1700000000000),
  ];
  if (includeResponseTopic) {
    records.splice(5, 0, mt('response_topic', 'str', responseTopicValue));
  }
  return records;
}

function packet(records) {
  return { version: 'v1', type: 'pin_payload', payload: records };
}

function busSendRecords({ responseTopicValue = responseTopic, includeResponseTopic = true } = {}) {
  const records = [
    mt('__mt_payload_kind', 'str', 'bus_send.v1'),
    mt('__mt_request_id', 'str', 'bus_send_0396'),
    mt('message_role', 'str', 'request'),
    mt('topic', 'str', requestTopic),
    mt('route_kind', 'str', 'control'),
    mt('bus', 'str', 'control'),
    mt('bus_out_key', 'str', 'test_bus_out'),
    mt('endpoint_worker_id', 'str', 'R1'),
    mt('endpoint_model_id', 'int', 3000),
    mt('endpoint_pin', 'str', 'submit1'),
    mt('origin_worker_id', 'str', 'U1'),
    mt('origin_model_id', 'int', 2000),
    mt('origin_pin', 'str', 'submit1'),
    mt('reply_target_worker_id', 'str', 'U1'),
    mt('reply_target_model_id', 'int', 2000),
    mt('reply_target_pin', 'str', 'result'),
    mt('payload', 'json', [mt('text', 'str', 'hello bus send 0396')]),
  ];
  if (includeResponseTopic) {
    records.splice(5, 0, mt('response_topic', 'str', responseTopicValue));
  }
  return records;
}

async function test_runtime_topic_base_omits_redundant_worker_segment() {
  const rt = configureRuntime('R1');
  assert.equal(rt._topicFor(3000, 'submit1'), requestTopic, 'runtime must build endpoint topic without redundant worker segment');

  const oldBaseRt = configureRuntime('R1', oldTopicBase);
  assert.equal(oldBaseRt._topicFor(3000, 'submit1'), null, 'runtime must reject old topic base shape');
  return { key: 'runtime_topic_base_omits_redundant_worker_segment', status: 'PASS' };
}

async function test_endpoint_packet_requires_response_topic_for_requests() {
  const ok = validateUnifiedEndpointTopicPacket(requestTopic, packet(pinPayloadRecords()), topicBase);
  assert.equal(ok.ok, true, 'request packet with distinct response_topic must pass');

  const missing = validateUnifiedEndpointTopicPacket(
    requestTopic,
    packet(pinPayloadRecords({ includeResponseTopic: false })),
    topicBase,
  );
  assert.equal(missing.ok, false, 'request packet without response_topic must fail');

  const same = validateUnifiedEndpointTopicPacket(
    requestTopic,
    packet(pinPayloadRecords({ responseTopicValue: requestTopic })),
    topicBase,
  );
  assert.equal(same.ok, false, 'request packet with response_topic equal to topic must fail');

  const malformed = validateUnifiedEndpointTopicPacket(
    requestTopic,
    packet(pinPayloadRecords({ responseTopicValue: [topicBase, 'U1', '02000', 'result'].join('/') })),
    topicBase,
  );
  assert.equal(malformed.ok, false, 'request packet with malformed response_topic must fail');

  const wrongReplyTarget = validateUnifiedEndpointTopicPacket(
    requestTopic,
    packet(pinPayloadRecords({ responseTopicValue: [topicBase, 'U2', '2000', 'result'].join('/') })),
    topicBase,
  );
  assert.equal(wrongReplyTarget.ok, false, 'request response_topic must match reply target derived topic');
  return { key: 'endpoint_packet_requires_response_topic_for_requests', status: 'PASS' };
}

async function test_response_packet_uses_response_topic_as_transport_topic() {
  const responsePacket = packet(pinPayloadRecords({
    opId: 'res_0396',
    messageRole: 'response',
    topic: responseTopic,
    responseTopicValue: responseTopic,
    endpoint: { worker_id: 'U1', model_id: 2000, pin: 'result' },
    origin: { worker_id: 'R1', model_id: 3000, pin: 'submit1' },
  }));
  const ok = validateUnifiedEndpointTopicPacket(responseTopic, responsePacket, topicBase);
  assert.equal(ok.ok, true, 'response packet must be valid only on response_topic');

  const deliveredToRequestTopic = validateUnifiedEndpointTopicPacket(requestTopic, responsePacket, topicBase);
  assert.equal(deliveredToRequestTopic.ok, false, 'response packet delivered on request topic must fail');

  const mismatchedPayloadTopic = validateUnifiedEndpointTopicPacket(
    responseTopic,
    packet(pinPayloadRecords({
      opId: 'res_bad_topic_0396',
      messageRole: 'response',
      topic: requestTopic,
      responseTopicValue: responseTopic,
      endpoint: { worker_id: 'U1', model_id: 2000, pin: 'result' },
      origin: { worker_id: 'R1', model_id: 3000, pin: 'submit1' },
    })),
    topicBase,
  );
  assert.equal(mismatchedPayloadTopic.ok, false, 'response payload topic must equal response_topic');

  const responseWithRemoteEndpoint = validateUnifiedEndpointTopicPacket(
    responseTopic,
    packet(pinPayloadRecords({
      opId: 'res_bad_endpoint_0396',
      messageRole: 'response',
      topic: responseTopic,
      responseTopicValue: responseTopic,
      endpoint: { worker_id: 'R1', model_id: 3000, pin: 'submit1' },
      origin: { worker_id: 'R1', model_id: 3000, pin: 'submit1' },
    })),
    topicBase,
  );
  assert.equal(responseWithRemoteEndpoint.ok, false, 'response endpoint must match reply target');
  return { key: 'response_packet_uses_response_topic_as_transport_topic', status: 'PASS' };
}

async function test_old_redundant_segment_topic_is_rejected() {
  const oldRequestTopic = [oldTopicBase, 'R1', '3000', 'submit1'].join('/');
  const oldPacket = packet(pinPayloadRecords({
    topic: oldRequestTopic,
    responseTopicValue: [oldTopicBase, 'U1', '2000', 'result'].join('/'),
  }));
  const rejected = validateUnifiedEndpointTopicPacket(oldRequestTopic, oldPacket, oldTopicBase);
  assert.equal(rejected.ok, false, 'old topic base and endpoint must fail closed');
  return { key: 'old_redundant_segment_topic_is_rejected', status: 'PASS' };
}

async function test_bus_send_requires_and_propagates_response_topic() {
  const rt = configureRuntime('U1');
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'test_bus_out', t: 'pin.bus.cb.out', v: null });
  const ok = rt._applyBusSendPayload(model0, 0, 0, 0, busSendRecords());
  assert.equal(ok.status, 'ok', 'bus_send with response_topic must pass');
  const busOutValue = rt.getLabelValue(model0, 0, 0, 0, 'test_bus_out');
  assert.equal(
    busOutValue.find((record) => record.k === 'response_topic')?.v,
    responseTopic,
    'bus_send output must preserve response_topic',
  );

  const missing = rt._applyBusSendPayload(model0, 0, 0, 0, busSendRecords({ includeResponseTopic: false }));
  assert.equal(missing.status, 'rejected', 'bus_send without response_topic must fail');
  assert.equal(missing.code, 'invalid_response_topic');

  const same = rt._applyBusSendPayload(model0, 0, 0, 0, busSendRecords({ responseTopicValue: requestTopic }));
  assert.equal(same.status, 'rejected', 'bus_send with same request/response topic must fail');
  assert.equal(same.code, 'response_topic_mismatch');

  const wrongReplyTarget = rt._applyBusSendPayload(
    model0,
    0,
    0,
    0,
    busSendRecords({ responseTopicValue: [topicBase, 'U2', '2000', 'result'].join('/') }),
  );
  assert.equal(wrongReplyTarget.status, 'rejected', 'bus_send response_topic must match reply target');
  assert.equal(wrongReplyTarget.code, 'response_topic_mismatch');
  return { key: 'bus_send_requires_and_propagates_response_topic', status: 'PASS' };
}

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function currentSurfaceFiles() {
  const roots = [
    'packages',
    'deploy',
    'scripts',
    path.join('docs', 'ssot'),
    path.join('docs', 'user-guide'),
    path.join('docs', 'plans'),
    'test_files',
  ];
  return roots.flatMap((root) => walkFiles(path.join(repoRoot, root)))
    .filter((file) => !file.endsWith(path.join('scripts', 'tests', 'test_0396_dual_topic_submit_response_contract.mjs')))
    .filter((file) => !file.includes(path.join('packages', 'ui-model-demo-frontend', 'dist') + path.sep))
    .filter((file) => !file.includes(path.join('packages', 'ui-model-demo-server', 'data') + path.sep));
}

function activeSurfacePatterns() {
  const concreteOld = [topicBase, 'sw'].join('/');
  const genericOld = new RegExp([
    'UIPUT',
    '<ws[^>]*>',
    '<dam[^>]*>',
    '<pic[^>]*>',
    '<de[^>]*>',
    '<sw[^>]*>',
  ].join('/'), 'u');
  const genericWorkerSegment = new RegExp(['<sw_id>', '<worker_id>.*<model_id>.*<pin>'].join('.*'), 'u');
  const sameEndpointPhrase = new RegExp(['same', 'endpoint', 'topic'].join('.*'), 'iu');
  const sameTopicPhrase = new RegExp(['same', 'topic', 'response'].join('.*'), 'iu');
  const zhSameTopic = new RegExp(['请求', '回包', '同', 'topic'].join('.*'), 'u');
  const zhSameEndpoint = new RegExp(['回包', '同', 'endpoint topic'].join('.*'), 'u');
  const zhContinue = new RegExp(['回包', '继续使用同一个'].join('.*'), 'u');
  const zhSameAny = new RegExp(['同一个', 'topic'].join('.*'), 'u');
  return [
    { name: 'old concrete topic base', test: (text) => text.includes(concreteOld) },
    { name: 'old generic topic base', test: (text) => genericOld.test(text) },
    { name: 'old generic worker segment', test: (text) => genericWorkerSegment.test(text) },
    { name: 'old same endpoint wording', test: (text) => sameEndpointPhrase.test(text) },
    { name: 'old same response wording', test: (text) => sameTopicPhrase.test(text) },
    { name: 'old zh request response wording', test: (text) => zhSameTopic.test(text) },
    { name: 'old zh endpoint wording', test: (text) => zhSameEndpoint.test(text) },
    { name: 'old zh continue wording', test: (text) => zhContinue.test(text) },
    { name: 'old zh same topic wording', test: (text) => zhSameAny.test(text) },
  ];
}

async function test_current_surfaces_do_not_publish_old_topic_contract() {
  const matches = [];
  const patterns = activeSurfacePatterns();
  for (const file of currentSurfaceFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    const hit = patterns.find((pattern) => pattern.test(text));
    if (hit) matches.push(`${path.relative(repoRoot, file)}: ${hit.name}`);
  }
  assert.deepEqual(matches.slice(0, 20), [], `current surfaces contain obsolete topic contract:\n${matches.slice(0, 20).join('\n')}`);
  return { key: 'current_surfaces_do_not_publish_old_topic_contract', status: 'PASS' };
}

const tests = [
  test_runtime_topic_base_omits_redundant_worker_segment,
  test_endpoint_packet_requires_response_topic_for_requests,
  test_response_packet_uses_response_topic_as_transport_topic,
  test_old_redundant_segment_topic_is_rejected,
  test_bus_send_requires_and_propagates_response_topic,
];

if (process.env.DY_SKIP_0396_SURFACE_SCAN !== '1') {
  tests.push(test_current_surfaces_do_not_publish_old_topic_contract);
}

for (const test of tests) {
  const result = await test();
  console.log(`PASS ${result.key}`);
}

console.log('PASS test_0396_dual_topic_submit_response_contract');
