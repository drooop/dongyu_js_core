#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

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
  v: { pin: 'task', type: 'ui_event' },
});

rt.addLabel(sys, 0, 0, 0, {
  k: 'mbr_mgmt_inbox',
  t: 'json',
  v: {
    version: 'v0',
    type: 'ui_event',
    op_id: 'route_101_001',
    action: 'submit',
    source_model_id: 101,
    data: { meta: { op_id: 'route_101_001' }, input_value: 'hello' },
    timestamp: 1700000000000,
  },
});

let published = null;
const ctx = {
  getLabel: (ref) => {
    const model = rt.getModel(ref.model_id);
    if (!model) return null;
    const cell = rt.getCell(model, ref.p, ref.r, ref.c);
    return cell.labels.get(ref.k)?.v ?? null;
  },
  writeLabel: (ref, t, v) => {
    const model = rt.getModel(ref.model_id);
    if (!model) return;
    rt.addLabel(model, ref.p, ref.r, ref.c, { k: ref.k, t, v });
  },
  rmLabel: (ref) => {
    const model = rt.getModel(ref.model_id);
    if (!model) return;
    rt.rmLabel(model, ref.p, ref.r, ref.c, ref.k);
  },
  publishMqtt: (topic, payload) => {
    published = { topic, payload };
  },
};

const fn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_to_mqtt')));
fn(ctx);

assert.ok(published, 'route-driven ui_event must publish to MQTT');
assert.equal(published.topic, 'UIPUT/ws/dam/pic/de/sw/101/task', 'route-driven bridge must use mbr_route_<modelId>.pin');
assert.equal(published.payload?.version, 'v0', 'route-driven bridge payload must now be direct event payload');
assert.equal(published.payload?.type, 'ui_event', 'route-driven bridge must preserve ui_event type');
assert.equal(published.payload?.action, 'submit', 'route-driven bridge must preserve action');
assert.equal(published.payload?.op_id, 'route_101_001', 'route-driven bridge must preserve op_id');
assert.equal(published.payload?.source_model_id, 101, 'route-driven bridge must preserve source model id');
assert.equal(published.payload?.data?.input_value, 'hello', 'route-driven bridge must preserve data payload');
assert.ok(!Array.isArray(published.payload?.records), 'route-driven bridge must not emit records patch');

console.log('PASS test_0179_mbr_route_contract');
