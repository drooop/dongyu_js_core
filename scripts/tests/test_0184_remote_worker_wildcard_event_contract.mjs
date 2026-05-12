#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function loadPatches(rt, patchDir) {
  const files = fs.readdirSync(patchDir).filter((f) => f.endsWith('.json')).sort();
  for (const file of files) {
    const patch = JSON.parse(fs.readFileSync(path.join(patchDir, file), 'utf8'));
    rt.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
  }
}

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const rt = new ModelTableRuntime();
const sysPatch = JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages/worker-base/system-models/system_models.json'), 'utf8'));
rt.applyPatch(sysPatch, { allowCreateModel: true, trustedBootstrap: true });
loadPatches(rt, path.join(repoRoot, 'deploy/sys-v1ns/remote-worker/patches'));
rt.setRuntimeMode('edit');
rt.setRuntimeMode('running');

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function pinPayloadRecords({
  opId,
  payload,
  endpointWorkerId = 'R1',
  endpointModelId = 100,
  endpointPin = 'submit',
  originWorkerId = 'ui-server-test',
  originModelId = 100,
  originPin = 'submit',
  replyTargetWorkerId = 'ui-server-test',
  replyTargetModelId = 100,
  replyTargetPin = 'result',
  timestamp = 1700000000000,
}) {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', originWorkerId),
    mt('origin_model_id', 'int', originModelId),
    mt('origin_pin', 'str', originPin),
    mt('reply_target_worker_id', 'str', replyTargetWorkerId),
    mt('reply_target_model_id', 'int', replyTargetModelId),
    mt('reply_target_pin', 'str', replyTargetPin),
    mt('payload', 'json', payload),
    mt('timestamp', 'int', timestamp),
  ];
}

const handled = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/R1/100/submit', {
  version: 'v1',
  type: 'pin_payload',
  payload: pinPayloadRecords({
    opId: 'wildcard_direct_001',
    payload: [
      mt('model_type', 'model.single', 'Data.RemoteSubmit'),
      mt('input_value', 'str', 'hello'),
    ],
  }),
});

assert.equal(handled, true, 'runtime mqttIncoming must accept direct v1 pin_payload on unified endpoint topic');
await new Promise((resolve) => setTimeout(resolve, 1000));

const model100 = rt.getModel(100);
const status = rt.getCell(model100, 0, 0, 0).labels.get('status');
assert(status, 'status label should exist after direct wildcard event');
assert.equal(status.v, 'processed', 'remote worker must process direct wildcard event through software-worker chain');

console.log('PASS test_0184_remote_worker_wildcard_event_contract');
