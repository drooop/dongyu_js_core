#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  externalPacket,
  mt,
  pinPayloadV2Records,
} from '../lib/pin_payload_v2_test_helpers.mjs';

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

const topic = 'UIPUT/ws/dam/pic/de/R1/100/submit';
const records = pinPayloadV2Records({
  opId: 'wildcard_dispatch_v2_001',
  endpointWorkerId: 'R1',
  endpointModelId: 100,
  endpointPin: 'submit',
  topic,
  originWorkerId: 'ui-server-test',
  originModelId: 100,
  originPin: 'submit',
  replyTargetWorkerId: 'ui-server-test',
  replyTargetModelId: 100,
  replyTargetPin: 'result',
  payloadRecords: [
    mt('model_type', 'model.table', 'Data.RemoteSubmit'),
    mt('input_value', 'str', 'hello'),
  ],
});
const packet = externalPacket(records);

const modelMinus10 = rt.getModel(-10);
const subscriptions = rt.getCell(modelMinus10, 0, 0, 0).labels.get('remote_subscriptions');
assert.equal(subscriptions?.t, 'json', 'R1 must declare its MQTT subscription topics in Model -10');
assert.equal(subscriptions.v.includes(topic), true, 'R1 must subscribe to the Model 100 endpoint topic');

const handled = rt.mqttIncoming(topic, packet);
assert.equal(handled, true, 'runtime mqttIncoming must accept formal pin_payload.v2 on a declared endpoint topic');

const model0 = rt.getModel(0);
const model0Root = rt.getCell(model0, 0, 0, 0);
const ingress = model0Root.labels.get('r1_cb_in');
assert.equal(ingress?.t, 'pin.bus.cb.in', 'MQTT ingress must first enter the declared Model 0 control-bus pin');
assert.deepEqual(ingress.v, records, 'Model 0 ingress must preserve the formal temporary ModelTable payload');

await new Promise((resolve) => setTimeout(resolve, 1000));

const dispatcherInput = rt.getCell(modelMinus10, 0, 0, 0).labels.get('r1_dispatch_in');
const dispatcherOutput = rt.getCell(modelMinus10, 0, 0, 0).labels.get('r1_dispatch_100_submit');
assert.deepEqual(dispatcherInput?.v, records, 'Model 0 ingress must route to the Model -10 dispatcher input');
assert.deepEqual(dispatcherOutput?.v, records, 'Model -10 dispatcher must select the declared Model 100 submit route');

const model100Mount = rt.getCell(model0, 1, 0, 0).labels.get('model_type');
assert.equal(model100Mount?.t, 'model.submtconnection', 'Model 100 endpoint must be mounted under Model 0');
assert.equal(model100Mount?.v, 100, 'Model 100 mount must target the declared positive model');

const model100 = rt.getModel(100);
const model100Root = rt.getCell(model100, 0, 0, 0);
const submit = model100Root.labels.get('submit');
assert.equal(submit?.t, 'pin.in', 'dispatcher must deliver through the mounted Model 100 submit pin');
assert.deepEqual(submit.v, records, 'mounted positive model must receive the unchanged formal payload');
const status = rt.getCell(model100, 0, 0, 0).labels.get('status');
assert(status, 'status label should exist after the declared endpoint event');
assert.equal(status.v, 'processed', 'remote worker must process the event through the declared software-worker chain');
assert.equal(model100Root.labels.has('mqtt_inbound_error'), false, 'transport errors must not be written to the positive model');

const inboundTrace = rt.mqttTrace.list().find((entry) => (
  entry.type === 'inbound'
  && entry.payload?.topic === topic
  && entry.payload?.ingress_pin === 'r1_cb_in'
));
assert(inboundTrace, 'accepted endpoint topic must remain visible in MQTT trace with its Model 0 ingress pin');

const positiveModelBeforeLegacyPacket = JSON.stringify(rt.snapshot().models['100']);
const legacyRecords = records.map((record) => (
  record.k === '__mt_payload_kind' ? { ...record, v: 'pin_payload.v1' } : record
));
const legacyHandled = rt.mqttIncoming(topic, externalPacket(legacyRecords));
assert.equal(legacyHandled, false, 'legacy pin_payload.v1 must fail closed instead of entering a positive model directly');
assert.equal(
  JSON.stringify(rt.snapshot().models['100']),
  positiveModelBeforeLegacyPacket,
  'rejected legacy ingress must not mutate the mounted positive model',
);

const visibleError = model0Root.labels.get('mqtt_inbound_error');
assert.equal(visibleError?.t, 'json', 'rejected endpoint traffic must write a visible Model 0 error');
assert.equal(visibleError?.v?.code, 'legacy_pin_payload_kind_removed', 'visible error must preserve the v1 removal reason');
assert.equal(visibleError?.v?.topic, topic, 'visible error must preserve the rejected endpoint topic');
assert.equal(visibleError?.v?.pin, 'submit', 'visible error must preserve the rejected endpoint pin');
assert.equal(visibleError?.v?.ingress_pin, 'r1_cb_in', 'visible error must identify the declared Model 0 ingress');
assert.equal(model100Root.labels.has('mqtt_inbound_error'), false, 'legacy rejection errors must stay on Model 0');

const rejectedTrace = rt.mqttTrace.list().find((entry) => (
  entry.type === 'inbound_rejected'
  && entry.payload?.topic === topic
  && entry.payload?.reason === 'invalid_pin_payload_records'
));
assert(rejectedTrace, 'legacy endpoint rejection must remain visible in MQTT trace');

console.log('PASS test_0184_remote_worker_wildcard_event_contract');
