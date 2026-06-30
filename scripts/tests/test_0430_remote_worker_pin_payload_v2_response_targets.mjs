#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pinPayloadV2Records, mt, payloadRecords, payloadValue } from '../lib/pin_payload_v2_test_helpers.mjs';

function readPatch(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function funcCode(file, key) {
  const patch = readPatch(file);
  const record = patch.records.find((item) => item && item.k === key && item.t === 'func.js');
  assert.ok(record, `${file} must include ${key} func.js`);
  assert.equal(typeof record.v?.code, 'string', `${key} func.js must carry code`);
  return record.v.code;
}

function runFunc(code, inputRecords, fakeV1N) {
  const fn = new Function('label', 'V1N', code);
  return fn({ v: inputRecords }, fakeV1N);
}

function fakeV1N({ bundlePayload = [] } = {}) {
  const labels = [];
  return {
    labels,
    addLabel(k, t, v) {
      labels.push({ k, t, v });
    },
    readLabel(_p, _r, _c, key) {
      if (key === 'bundle_payload_r1_minimal_submit_dual_bus') {
        return { t: 'json', v: bundlePayload };
      }
      return null;
    },
    table: {
      addLabel(_p, _r, _c, k, t, v) {
        labels.push({ k, t, v });
      },
    },
  };
}

function appReplyTargetRequest({ endpointModelId, endpointPin, payloadRecords: businessRecords }) {
  return pinPayloadV2Records({
    opId: `0430_${endpointPin}_app_reply_target`,
    endpointWorkerId: 'R1',
    endpointTableId: 'host',
    endpointModelId,
    endpointPin,
    topic: `UIPUT/ws/dam/pic/de/R1/${endpointModelId}/${endpointPin}`,
    responseTopic: 'UIPUT/ws/dam/pic/de/U1/1087/result',
    originWorkerId: 'U1',
    originTableId: 'app:subject:drop:app-001',
    originModelId: 0,
    originPin: endpointPin,
    replyTargetWorkerId: 'U1',
    replyTargetTableId: 'app:subject:drop:app-001',
    replyTargetModelId: 0,
    replyTargetPin: 'result',
    payloadRecords: businessRecords,
  });
}

function assertHostResponseEndpoint(records) {
  assert.equal(payloadValue(records, '__mt_payload_kind'), 'pin_payload.v2');
  assert.equal(payloadValue(records, 'message_role'), 'response');
  assert.equal(payloadValue(records, 'topic'), 'UIPUT/ws/dam/pic/de/U1/1087/result');
  assert.equal(payloadValue(records, 'response_topic'), 'UIPUT/ws/dam/pic/de/U1/1087/result');
  assert.equal(payloadValue(records, 'endpoint_worker_id'), 'U1');
  assert.equal(payloadValue(records, 'endpoint_table_id'), 'host');
  assert.equal(payloadValue(records, 'endpoint_model_id'), 1087);
  assert.equal(payloadValue(records, 'endpoint_pin'), 'result');
  assert.equal(payloadValue(records, 'reply_target_worker_id'), 'U1');
  assert.equal(payloadValue(records, 'reply_target_table_id'), 'app:subject:drop:app-001');
  assert.equal(payloadValue(records, 'reply_target_model_id'), 0);
  assert.equal(payloadValue(records, 'reply_target_pin'), 'result');
}

function testMinimalSubmitResponseTarget() {
  const code = funcCode('deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json', 'submit1');
  const v1n = fakeV1N();
  const result = runFunc(code, appReplyTargetRequest({
    endpointModelId: 3000,
    endpointPin: 'submit1',
    payloadRecords: [
      mt('__mt_payload_kind', 'str', 'minimal_submit.request.v1'),
      mt('text', 'str', 'hello app table target'),
      mt('source', 'str', 'test'),
    ],
  }), v1n);

  assert.ok(Array.isArray(result), 'minimal submit must return pin payload records');
  assertHostResponseEndpoint(result);
  const business = payloadRecords(result);
  assert.equal(payloadValue(business, 'display_text', 1), 'Submitted: hello app table target');
  assert.equal(payloadValue(business, 'remote_status', 1), 'remote_processed');
  return { key: 'minimal_submit_response_target', status: 'PASS' };
}

function testBundleProviderResponseTarget() {
  const code = funcCode('deploy/sys-v1ns/remote-worker/patches/14_model3100_slide_app_bundle_provider.json', 'provide_slide_app_bundle');
  const bundlePayload = [
    mt('model_type', 'model.table', 'UI.MinimalSubmit'),
    mt('app_name', 'str', '最小 Submit 双总线示例'),
  ];
  const v1n = fakeV1N({ bundlePayload });
  const result = runFunc(code, appReplyTargetRequest({
    endpointModelId: 3100,
    endpointPin: 'bundle_request',
    payloadRecords: [
      mt('__mt_payload_kind', 'str', 'slide_app_bundle_request.v1'),
      mt('asset_id', 'str', 'r1-minimal-submit'),
      mt('requested_version', 'str', 'current'),
    ],
  }), v1n);

  assert.ok(Array.isArray(result), 'bundle provider must return pin payload records');
  assertHostResponseEndpoint(result);
  const business = payloadRecords(result);
  assert.equal(payloadValue(business, '__mt_payload_kind', 1), 'slide_app_bundle_response.v1');
  assert.equal(payloadValue(business, 'asset_id', 1), 'r1-minimal-submit');
  assert.equal(payloadValue(business, 'bundle_record_id_offset', 1), 100);
  assert.equal(result.find((record) => record.id === 100 && record.k === 'model_type')?.v, 'UI.MinimalSubmit');
  return { key: 'bundle_provider_response_target', status: 'PASS' };
}

const tests = [
  testMinimalSubmitResponseTarget,
  testBundleProviderResponseTarget,
];

let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`${result.key}: ${result.status}`);
  } catch (error) {
    failed += 1;
    console.error(`${test.name}: FAIL`);
    console.error(error && error.stack ? error.stack : error);
  }
}

if (failed > 0) {
  console.error(`FAILED ${failed} / ${tests.length}`);
  process.exit(1);
}

console.log(`PASSED ${tests.length} / ${tests.length}`);
