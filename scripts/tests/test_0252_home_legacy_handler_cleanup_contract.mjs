#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const patch = JSON.parse(fs.readFileSync(resolve(repoRoot, 'packages/worker-base/system-models/intent_handlers_home.json'), 'utf8'));
const records = Array.isArray(patch.records) ? patch.records : [];

const HOME_LEGACY_HANDLERS = [
  'handle_home_refresh',
  'handle_home_select_row',
  'handle_home_open_create',
  'handle_home_open_edit',
  'handle_home_save_label',
  'handle_home_delete_label',
  'handle_home_view_detail',
  'handle_home_close_detail',
  'handle_home_close_edit',
];

function findRecord(k) {
  return records.find((record) => record?.model_id === -10 && record?.p === 0 && record?.r === 0 && record?.c === 0 && record?.k === k) || null;
}

function test_legacy_home_direct_write_handlers_are_removed() {
  for (const k of HOME_LEGACY_HANDLERS) {
    const record = findRecord(k);
    assert.equal(record, null, `legacy_handler_must_be_removed:${k}`);
  }
  return { key: 'legacy_home_direct_write_handlers_are_removed', status: 'PASS' };
}

function test_pin_only_home_contract_is_preserved() {
  assert(findRecord('handle_home_emit_owner_requests'), 'pin_source_emitter_must_remain');
  assert(findRecord('handle_home_pin_only_dispatch_blocked'), 'pin_only_dispatch_blocker_must_remain');
  assert(findRecord('home_pin_wiring'), 'home_pin_wiring_must_remain');
  return { key: 'pin_only_home_contract_is_preserved', status: 'PASS' };
}

const tests = [
  test_legacy_home_direct_write_handlers_are_removed,
  test_pin_only_home_contract_is_preserved,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[PASS] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
