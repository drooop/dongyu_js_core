#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const surfaces = [
  'packages/worker-base/system-models/test_model_100_ui.json',
  'packages/worker-base/system-models/workspace_positive_models.json',
  'deploy/sys-v1ns/remote-worker/patches/14_model3100_slide_app_bundle_provider.json',
];

function recordCellIdentity(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || typeof record.k !== 'string') return null;
  if (record.op === 'add_label') {
    return Number.isInteger(record.model_id) && Number.isInteger(record.p) && Number.isInteger(record.r) && Number.isInteger(record.c)
      ? ['op', record.model_id, record.p, record.r, record.c]
      : null;
  }
  return Number.isInteger(record.id) && Number.isInteger(record.p) && Number.isInteger(record.r) && Number.isInteger(record.c)
    ? ['record', record.id, record.p, record.r, record.c]
    : null;
}

function sameIdentity(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function findNodeCells(value, nodeId, cells = []) {
  if (Array.isArray(value)) {
    for (const record of value) {
      const identity = recordCellIdentity(record);
      if (!identity || record.k !== 'ui_node_id' || record.v !== nodeId) continue;
      cells.push(value.filter((candidate) => {
        const candidateIdentity = recordCellIdentity(candidate);
        return candidateIdentity && sameIdentity(candidateIdentity, identity);
      }));
    }
    for (const item of value) findNodeCells(item, nodeId, cells);
    return cells;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) findNodeCells(item, nodeId, cells);
  }
  return cells;
}

function assertInflightStatusBadge(document, relativePath) {
  const cells = findNodeCells(document, 'model100_submit_inflight');
  assert.equal(cells.length, 1, `${relativePath}: exactly one model100_submit_inflight UI node`);
  const labels = new Map(cells[0].map((record) => [record.k, record]));
  assert.equal(labels.get('ui_component')?.v, 'StatusBadge', `${relativePath}: inflight node component`);
  assert.equal(labels.get('ui_label')?.v, '提交中', `${relativePath}: inflight node label`);
  const binding = labels.get('ui_bind_read_json');
  assert.equal(binding?.t, 'json', `${relativePath}: inflight binding type`);
  assert.equal(binding?.v?.k, 'submit_inflight', `${relativePath}: inflight binding key`);
  assert.equal(binding?.v?.p, 0, `${relativePath}: inflight binding p`);
  assert.equal(binding?.v?.r, 0, `${relativePath}: inflight binding r`);
  assert.equal(binding?.v?.c, 0, `${relativePath}: inflight binding c`);
  if (Object.hasOwn(binding.v, 'model_id')) {
    assert.equal(binding.v.model_id, 100, `${relativePath}: inflight binding model`);
  }
}

function test_model100_ui_surfaces_describe_direct_control_route() {
  for (const relativePath of surfaces) {
    const source = readFileSync(resolve(repoRoot, relativePath), 'utf8');
    assert.match(source, /Model 0 `mt_bus_send` \/ `pin\.bus\.cb\.out` -> local MQTT/u, `${relativePath}: direct control egress`);
    assert.match(source, /response on `response_topic` -> local MQTT -> UI Server Model 0 `pin\.bus\.cb\.in` \(MBR no-echo\)/u, `${relativePath}: direct response and MBR no-echo`);
    assert.doesNotMatch(source, /pin\.bus\.cb\.out` -> MBR/u, `${relativePath}: stale control request route`);
    assert.doesNotMatch(source, /MQTT response on response_topic -> MBR/u, `${relativePath}: stale control response route`);
    assert.doesNotMatch(source, /UI、MBR、Worker 回包链路/u, `${relativePath}: stale user-visible MBR control summary`);
    if (relativePath.endsWith('workspace_positive_models.json')) {
      assert.match(source, /UI Server、本地 MQTT、R1 回包链路/u, `${relativePath}: current user-visible control summary`);
    }
  }
}

function test_model100_ui_surfaces_do_not_bind_removed_readiness() {
  for (const relativePath of surfaces) {
    const source = readFileSync(resolve(repoRoot, relativePath), 'utf8');
    const document = JSON.parse(source);
    assert.doesNotMatch(source, /"v": "MBR Ready"/u, `${relativePath}: stale MBR-ready label`);
    assert.doesNotMatch(source, /"k": "system_ready"/u, `${relativePath}: removed readiness binding`);
    assertInflightStatusBadge(document, relativePath);

    const corrupted = JSON.parse(source);
    const corruptedCells = findNodeCells(corrupted, 'model100_submit_inflight');
    const corruptedBinding = corruptedCells[0].find((record) => record.k === 'ui_bind_read_json');
    corruptedBinding.v.k = 'status';
    assert.throws(
      () => assertInflightStatusBadge(corrupted, `${relativePath}:corrupted`),
      /inflight binding key/u,
      `${relativePath}: guard must detect a wrong binding even when submit_inflight appears elsewhere`,
    );
  }
}

const tests = [
  test_model100_ui_surfaces_describe_direct_control_route,
  test_model100_ui_surfaces_do_not_bind_removed_readiness,
];

let passed = 0;
for (const test of tests) {
  try {
    test();
    passed += 1;
    console.log(`PASS ${test.name}`);
  } catch (error) {
    console.error(`FAIL ${test.name}: ${error.message}`);
  }
}
console.log(JSON.stringify({ passed, total: tests.length }));
if (passed !== tests.length) process.exit(1);
