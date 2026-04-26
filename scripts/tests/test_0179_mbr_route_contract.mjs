#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildWorkerHostApi } from '../worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function loadJson(pathname) {
  const fs = require('node:fs');
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function getFunctionCode(label) {
  if (!label) return '';
  if (typeof label.v === 'string') return label.v;
  if (label.v && typeof label.v === 'object' && typeof label.v.code === 'string') return label.v.code;
  return '';
}

function loadRuntime() {
  const rt = new ModelTableRuntime();
  rt.applyPatch(loadJson('packages/worker-base/system-models/system_models.json'), {
    allowCreateModel: true,
    trustedBootstrap: true,
  });
  rt.applyPatch(loadJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json'), {
    allowCreateModel: true,
    trustedBootstrap: true,
  });
  return rt;
}

const rt = loadRuntime();
const sys = rt.getModel(-10);
assert(sys, 'system model must exist');

rt.addLabel(sys, 0, 0, 0, {
  k: 'mbr_route_101',
  t: 'json',
  v: { pin: 'task', type: 'pin_payload' },
});

rt.addLabel(sys, 0, 0, 0, {
  k: 'mbr_mgmt_inbox',
  t: 'json',
  v: {
    version: 'v1',
    type: 'pin_payload',
    op_id: 'route_101_001',
    source_model_id: 101,
    pin: 'task',
    payload: [
      { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
      { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'hello' },
    ],
    timestamp: 1700000000000,
  },
});

let published = null;
const ctx = {
  hostApi: buildWorkerHostApi(rt),
  publishMqtt: (topic, payload) => {
    published = { topic, payload };
  },
};

const fn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_to_mqtt')));
fn(ctx);

assert.ok(published, 'route-driven pin_payload must publish to MQTT');
assert.equal(published.topic, 'UIPUT/ws/dam/pic/de/sw/101/task', 'route-driven bridge must use mbr_route_<modelId>.pin');
assert.equal(published.payload?.version, 'v1', 'route-driven bridge payload must now be pin_payload');
assert.equal(published.payload?.type, 'pin_payload', 'route-driven bridge must preserve pin_payload type');
assert.equal(published.payload?.pin, 'task', 'route-driven bridge must preserve pin name');
assert.equal(published.payload?.op_id, 'route_101_001', 'route-driven bridge must preserve op_id');
assert.equal(published.payload?.source_model_id, 101, 'route-driven bridge must preserve source model id');
assert.equal(published.payload?.payload?.[1]?.v, 'hello', 'route-driven bridge must preserve temporary-modeltable content');
assert.ok(!Array.isArray(published.payload?.records), 'route-driven bridge must not emit records patch');

console.log('PASS test_0179_mbr_route_contract');
