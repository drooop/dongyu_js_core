#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function assertContains(text, needle, file) {
  assert.ok(text.includes(needle), `${file} missing: ${needle}`);
}

function assertNotContains(text, needle, file) {
  assert.ok(!text.includes(needle), `${file} must not contain: ${needle}`);
}

const ssotFile = 'docs/ssot/data_model_tier2_implementation_v1.md';
const guideFile = 'docs/user-guide/data_models_filltable_guide.md';
const runtimeFile = 'docs/ssot/runtime_semantics_modeltable_driven.md';

const ssot = read(ssotFile);
const guide = read(guideFile);
const runtime = read(runtimeFile);

for (const needle of [
  'Data Model Tier 2 Implementation v1',
  'Data.* behavior is Tier 2 fill-table capability.',
  '`Data.Single`',
  'Form: `model.single`',
  'Collection-like Data.* models',
  '`add_data:in`',
  '`get_size:out`',
  'Temporary ModelTable Message',
  'explicitly materializes',
  'No compatibility aliases',
  '`Data.Array.One`',
  '`Data.FlowTicket`',
  'packages/worker-base/src/data_models.js',
  'Do not copy these as new canonical examples',
]) {
  assertContains(ssot, needle, ssotFile);
}

for (const needle of [
  '`add_data_in`',
  '`enqueue_data_in`',
  '`push_data_in`',
  '`ctx.writeLabel`',
  '`ctx.getLabel`',
  '`ctx.rmLabel`',
]) {
  assertContains(ssot, needle, ssotFile);
}

for (const forbidden of [
  'Every Data.* type is a model table or matrix',
  'Each Data.* type is a model table or matrix',
  'Runtime code should implement data-structure algorithms',
]) {
  assertNotContains(ssot, forbidden, ssotFile);
}

assertContains(guide, 'docs/ssot/data_model_tier2_implementation_v1.md', guideFile);
assertContains(guide, '`Data.Single` is a `model.single` element cell.', guideFile);
assertContains(guide, 'Public pins use colon names only.', guideFile);
assertContains(guide, 'Persistence happens only after explicit materialization', guideFile);

assertContains(runtime, 'data_model_tier2_implementation_v1.md', runtimeFile);
assertContains(runtime, '`Data.Single` 是 `model.single` element cell', runtimeFile);
assertContains(runtime, '运行时不硬编码数据结构算法', runtimeFile);

console.log('PASS test_0349_data_model_tier2_plan');
