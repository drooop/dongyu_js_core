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
  k: 'mbr_mgmt_inbox',
  t: 'json',
  v: {
    version: 'v1',
    type: 'pin_payload',
    op_id: 'mbr_submit_001',
    source_model_id: 100,
    pin: 'submit',
    payload: [
      { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
      { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'hello' },
    ],
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

assert.ok(published, 'route-driven pin_payload must publish to MQTT');
assert.equal(published.topic, 'UIPUT/ws/dam/pic/de/sw/100/submit', 'Model 100 submit must publish to /100/submit');
assert.equal(published.payload?.version, 'v1', 'MBR bridge must publish v1 pin_payload transport');
assert.equal(published.payload?.type, 'pin_payload', 'MBR bridge must preserve pin_payload type');
assert.equal(published.payload?.pin, 'submit', 'MBR bridge must preserve pin name');
assert.equal(published.payload?.source_model_id, 100, 'MBR bridge must preserve source_model_id');
assert.ok(Array.isArray(published.payload?.payload), 'MBR bridge must preserve temporary-modeltable payload array');
assert.equal(published.payload?.payload?.[1]?.v, 'hello', 'MBR bridge must preserve payload data');
assert.ok(!Array.isArray(published.payload?.records), 'MBR bridge must not emit records patch to worker business cells');

console.log('PASS test_0184_mbr_direct_event_bridge_contract');
