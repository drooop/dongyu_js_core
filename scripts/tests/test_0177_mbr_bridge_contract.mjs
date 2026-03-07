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

function buildCtx(rt, publishSpy) {
  return {
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
      publishSpy.push({ topic, payload });
    },
  };
}

function test_model100_ui_event_still_publishes() {
  const rt = loadRuntime();
  const sys = rt.getModel(-10);
  const published = [];

  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_inbox',
    t: 'json',
    v: {
      version: 'v0',
      type: 'ui_event',
      op_id: 'mbr_ok_001',
      action: 'submit',
      source_model_id: 100,
      data: { meta: { op_id: 'mbr_ok_001' } },
      timestamp: Date.now(),
    },
  });

  const fn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_to_mqtt')));
  fn(buildCtx(rt, published));

  assert.equal(published.length, 1, 'standard Model 100 ui_event must still publish to MQTT');
  assert.match(published[0].topic, /\/100\/event$/, 'standard Model 100 ui_event must publish to /100/event');
}

function test_generic_crud_events_are_rejected() {
  const rt = loadRuntime();
  const sys = rt.getModel(-10);
  const published = [];

  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_inbox',
    t: 'json',
    v: {
      version: 'v0',
      type: 'snapshot_delta',
      op_id: 'mbr_reject_001',
      payload: {
        action: 'label_add',
        meta: { op_id: 'mbr_reject_001' },
        target: { model_id: 100, p: 0, r: 0, c: 0, k: 'title' },
        value: { t: 'str', v: 'blocked' },
      },
    },
  });

  const fn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_to_mqtt')));
  fn(buildCtx(rt, published));

  assert.equal(published.length, 0, 'generic CRUD bridge messages must not publish to MQTT');
  const errorLabel = rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_error');
  assert(errorLabel, 'rejected generic CRUD bridge messages must write mbr_mgmt_error');
  assert.equal(errorLabel.v?.code, 'direct_model_mutation_disabled', 'rejected generic CRUD bridge must expose direct_model_mutation_disabled');
}

const tests = [
  test_model100_ui_event_still_publishes,
  test_generic_crud_events_are_rejected,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
