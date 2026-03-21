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

const handled = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/100/event', {
  version: 'v0',
  type: 'ui_event',
  op_id: 'wildcard_direct_001',
  source_model_id: 100,
  action: 'submit',
  data: { input_value: 'hello' },
  timestamp: Date.now(),
});

assert.equal(handled, true, 'runtime mqttIncoming must accept direct v0 ui_event on wildcard topic');
await new Promise((resolve) => setTimeout(resolve, 1000));

const model100 = rt.getModel(100);
const status = rt.getCell(model100, 0, 0, 0).labels.get('status');
assert(status, 'status label should exist after direct wildcard event');
assert.equal(status.v, 'processed', 'remote worker must process direct wildcard event through software-worker chain');

console.log('PASS test_0184_remote_worker_wildcard_event_contract');
