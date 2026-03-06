#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function test_package_manager_is_bun() {
  const rootPkg = readJson('package.json');
  const frontendPkg = readJson('packages/ui-model-demo-frontend/package.json');
  assert.match(rootPkg.packageManager || '', /^bun@/, 'root packageManager must be bun');
  assert.match(frontendPkg.packageManager || '', /^bun@/, 'frontend packageManager must be bun');
  return { key: 'package_manager_is_bun', status: 'PASS' };
}

function test_server_default_prompt_mentions_new_pin_types() {
  const text = readText('packages/ui-model-demo-server/server.mjs');
  assert.match(text, /candidate_changes/, 'server template must require candidate_changes');
  assert.match(text, /pin\.bus\.in/, 'server template must mention pin.bus.in');
  assert.match(text, /pin\.bus\.out/, 'server template must mention pin.bus.out');
  assert.match(text, /pin\.table\.in/, 'server template must mention pin.table.in');
  assert.match(text, /pin\.table\.out/, 'server template must mention pin.table.out');
  assert.match(text, /pin\.single\.in/, 'server template must mention pin.single.in');
  assert.match(text, /pin\.single\.out/, 'server template must mention pin.single.out');
  assert.match(text, /positive model ids/, 'server template must constrain candidate_changes to positive model ids');
  assert.match(text, /do not target model_id=0 or any negative model_id/, 'server template must forbid model 0 and negative model ids in owner-chain preview');
  return { key: 'server_default_prompt_mentions_new_pin_types', status: 'PASS' };
}

function test_system_prompt_template_mentions_new_pin_types() {
  const patch = readJson('packages/worker-base/system-models/llm_cognition_config.json');
  const record = patch.records.find((item) => item.k === 'llm_filltable_prompt_template');
  assert(record && typeof record.v === 'string', 'llm_filltable_prompt_template record missing');
  const text = record.v;
  assert.match(text, /candidate_changes/, 'system prompt must require candidate_changes');
  assert.match(text, /pin\.bus\.in/, 'system prompt must mention pin.bus.in');
  assert.match(text, /pin\.bus\.out/, 'system prompt must mention pin.bus.out');
  assert.match(text, /pin\.table\.in/, 'system prompt must mention pin.table.in');
  assert.match(text, /pin\.table\.out/, 'system prompt must mention pin.table.out');
  assert.match(text, /pin\.single\.in/, 'system prompt must mention pin.single.in');
  assert.match(text, /pin\.single\.out/, 'system prompt must mention pin.single.out');
  assert.match(text, /do not target model_id=0 or any negative model_id/, 'system prompt must forbid non-owner-chain model ids');
  return { key: 'system_prompt_template_mentions_new_pin_types', status: 'PASS' };
}

const tests = [
  test_package_manager_is_bun,
  test_server_default_prompt_mentions_new_pin_types,
  test_system_prompt_template_mentions_new_pin_types,
];

let passed = 0;
let failed = 0;
for (const testFn of tests) {
  try {
    const result = testFn();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${testFn.name}: ${err.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
