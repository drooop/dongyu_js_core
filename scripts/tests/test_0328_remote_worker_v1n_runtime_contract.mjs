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

function createConfiguredRuntime() {
  const rt = new ModelTableRuntime();
  const sysPatch = JSON.parse(fs.readFileSync('packages/worker-base/system-models/system_models.json', 'utf8'));
  rt.applyPatch(sysPatch, { allowCreateModel: true, trustedBootstrap: true });
  loadPatches(rt, 'deploy/sys-v1ns/remote-worker/patches');
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  return rt;
}

function pinPayload({ sourceModelId, pin = 'submit', payload }) {
  return {
    version: 'v1',
    type: 'pin_payload',
    op_id: `it0328_${sourceModelId}_${Date.now()}`,
    source_model_id: sourceModelId,
    pin,
    payload,
    timestamp: Date.now(),
  };
}

async function waitForSettle(ms = 1200) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function test_model100_submit_updates_root_state() {
  const rt = createConfiguredRuntime();
  const handled = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/sw/100/submit',
    pinPayload({
      sourceModelId: 100,
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
    'UIPUT/ws/dam/pic/de/sw/1010/submit',
    pinPayload({
      sourceModelId: 1010,
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

async function test_model1019_submit_updates_root_state() {
  const rt = createConfiguredRuntime();
  const handled = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/sw/1019/submit',
    pinPayload({
      sourceModelId: 1019,
      payload: [
        { id: 0, p: 0, r: 0, c: 0, k: 'message_text', t: 'str', v: 'matrix-0328' },
        { id: 0, p: 0, r: 0, c: 0, k: 'sender_user_id', t: 'str', v: '@drop:localhost' },
        { id: 0, p: 0, r: 0, c: 0, k: 'room_id', t: 'str', v: '!phase2-group:localhost' },
        { id: 0, p: 0, r: 0, c: 0, k: 'room_name', t: 'str', v: 'Phase 2 Group' },
        { id: 0, p: 0, r: 0, c: 0, k: 'room_kind', t: 'str', v: 'group' },
      ],
    }),
  );
  assert.equal(handled, true, 'model1019_mqtt_incoming_must_be_handled');
  await waitForSettle();
  const root = rt.getCell(rt.getModel(1019), 0, 0, 0).labels;
  assert.equal(root.get('conversation_status')?.v, 'remote_processed', 'model1019_conversation_status_must_be_remote_processed');
  return { key: 'model1019_submit_updates_root_state', status: 'PASS' };
}

const tests = [
  test_remote_worker_patches_stop_using_legacy_ctx_mutators,
  test_model100_submit_updates_root_state,
  test_model1010_submit_updates_root_state,
  test_model1019_submit_updates_root_state,
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
