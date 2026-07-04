#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pinPayloadV2Records } from '../lib/pin_payload_v2_test_helpers.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function loadPatches(rt, patchDir) {
  const files = fs.readdirSync(patchDir).filter((f) => f.endsWith('.json')).sort();
  for (const file of files) {
    const patch = JSON.parse(fs.readFileSync(path.join(patchDir, file), 'utf8'));
    rt.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
  }
}

function createConfiguredRuntime() {
  const rt = new ModelTableRuntime();
  const sysPatch = JSON.parse(fs.readFileSync('packages/worker-base/system-models/system_models.json', 'utf8'));
  rt.applyPatch(sysPatch, { allowCreateModel: true, trustedBootstrap: true });
  loadPatches(rt, 'deploy/sys-v1ns/remote-worker/patches');
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  return rt;
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function pinPayload({ endpointModelId, pin = 'submit', payload }) {
  const opId = `it0328_${endpointModelId}_${Date.now()}`;
  return {
    version: 'v1',
    type: 'pin_payload',
    payload: pinPayloadV2Records({
      opId,
      endpointWorkerId: 'R1',
      endpointModelId,
      endpointPin: pin,
      originWorkerId: 'ui-server-test',
      originModelId: endpointModelId,
      originPin: pin,
      replyTargetWorkerId: 'ui-server-test',
      replyTargetModelId: endpointModelId,
      replyTargetPin: 'result',
      payloadRecords: payload,
      timestamp: Date.now(),
    }),
  };
}

function pinPayloadMissing({ endpointModelId, missingKey, pin = 'submit', payload }) {
  const packet = pinPayload({ endpointModelId, pin, payload });
  packet.payload = packet.payload.filter((record) => record.k !== missingKey);
  return packet;
}

async function waitForSettle(ms = 1200) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function test_model100_submit_updates_root_state() {
  const rt = createConfiguredRuntime();
  const handled = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/100/submit',
    pinPayload({
      endpointModelId: 100,
      payload: [
        { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'hello-0328' },
      ],
    }),
  );
  assert.equal(handled, true, 'model100_mqtt_incoming_must_be_handled');
  await waitForSettle();
  const root = rt.getCell(rt.getModel(100), 0, 0, 0).labels;
  assert.equal(root.get('status')?.v, 'processed', 'model100_status_must_be_processed');
  return { key: 'model100_submit_updates_root_state', status: 'PASS' };
}

async function test_model100_rejects_missing_table_refs() {
  for (const missingKey of ['endpoint_table_id', 'origin_table_id', 'reply_target_table_id']) {
    const rt = createConfiguredRuntime();
    const handled = rt.mqttIncoming(
      'UIPUT/ws/dam/pic/de/R1/100/submit',
      pinPayloadMissing({
        endpointModelId: 100,
        missingKey,
        payload: [
          { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'must-not-process' },
        ],
      }),
    );
    assert.equal(handled, false, `model100_mqtt_incoming_must_reject_without_${missingKey}`);
    await waitForSettle();
    const root = rt.getCell(rt.getModel(100), 0, 0, 0).labels;
    assert.notEqual(root.get('status')?.v, 'processed', `model100_must_not_process_missing_${missingKey}`);
    assert.equal(root.get('mqtt_inbound_error')?.v?.code, `missing_${missingKey}`, `model100_must_write_visible_missing_${missingKey}_error`);
  }
  return { key: 'model100_rejects_missing_table_refs', status: 'PASS' };
}

function test_remote_worker_patches_stop_using_legacy_ctx_mutators() {
  const targets = [
    'deploy/sys-v1ns/remote-worker/patches/10_model100.json',
    'deploy/sys-v1ns/remote-worker/patches/11_model1010.json',
    'deploy/sys-v1ns/remote-worker/patches/12_model1019.json',
  ];
  for (const relPath of targets) {
    const source = fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
    assert(!source.includes('ctx.writeLabel('), `${relPath} must not use ctx.writeLabel`);
    assert(!source.includes('ctx.getLabel('), `${relPath} must not use ctx.getLabel`);
    assert(source.includes('V1N.table.addLabel('), `${relPath} must use V1N.table.addLabel`);
  }
  return { key: 'remote_worker_patches_stop_using_legacy_ctx_mutators', status: 'PASS' };
}

async function test_model1010_submit_updates_root_state() {
  const rt = createConfiguredRuntime();
  const handled = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/1010/submit',
    pinPayload({
      endpointModelId: 1010,
      payload: [
        { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'workspace-0328' },
      ],
    }),
  );
  assert.equal(handled, true, 'model1010_mqtt_incoming_must_be_handled');
  await waitForSettle();
  const root = rt.getCell(rt.getModel(1010), 0, 0, 0).labels;
  assert.equal(root.get('result_status')?.v, 'remote_processed', 'model1010_result_status_must_be_remote_processed');
  return { key: 'model1010_submit_updates_root_state', status: 'PASS' };
}

const tests = [
  test_remote_worker_patches_stop_using_legacy_ctx_mutators,
  test_model100_submit_updates_root_state,
  test_model100_rejects_missing_table_refs,
  test_model1010_submit_updates_root_state,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
