#!/usr/bin/env node

import assert from 'node:assert';
import {
  DEFAULT_FILLTABLE_POLICY,
  normalizeFilltablePolicy,
  validateFilltableRecords,
  buildFilltableDigest,
  evaluateApplyPreviewGuard,
} from '../../packages/ui-model-demo-server/filltable_policy.mjs';

function test_normalize_policy_defaults() {
  const out = normalizeFilltablePolicy(null);
  assert.strictEqual(out.allow_positive_model_ids, true);
  assert.strictEqual(out.allow_negative_model_ids, false);
  assert.strictEqual(out.max_records_per_apply, DEFAULT_FILLTABLE_POLICY.max_records_per_apply);
  assert(Array.isArray(out.allowed_label_types));
  assert(out.allowed_label_types.includes('str'));
  assert(Array.isArray(out.protected_label_keys));
  assert(out.protected_label_keys.includes('intent.v0'));
  return { key: 'normalize_policy_defaults', status: 'PASS' };
}

function test_validate_records_positive_and_negative_models() {
  const records = [
    {
      op: 'add_label',
      model_id: 100,
      p: 0,
      r: 0,
      c: 0,
      k: 'title',
      t: 'str',
      v: 'hello',
    },
    {
      op: 'add_label',
      model_id: -1,
      p: 0,
      r: 0,
      c: 0,
      k: 'bad',
      t: 'str',
      v: 'x',
    },
  ];
  const out = validateFilltableRecords(records, normalizeFilltablePolicy(null));
  assert.strictEqual(out.accepted_records.length, 1);
  assert.strictEqual(out.rejected_records.length, 1);
  assert.strictEqual(out.rejected_records[0].code, 'model_id_not_allowed');
  return { key: 'validate_records_positive_and_negative_models', status: 'PASS' };
}

function test_validate_records_protected_key_rejected() {
  const records = [
    {
      op: 'add_label',
      model_id: 100,
      p: 0,
      r: 0,
      c: 0,
      k: 'dual_bus_model',
      t: 'json',
      v: { a: 1 },
    },
  ];
  const out = validateFilltableRecords(records, normalizeFilltablePolicy(null));
  assert.strictEqual(out.accepted_records.length, 0);
  assert.strictEqual(out.rejected_records.length, 1);
  assert.strictEqual(out.rejected_records[0].code, 'protected_label_key');
  return { key: 'validate_records_protected_key_rejected', status: 'PASS' };
}

function test_validate_records_size_limit() {
  const policy = normalizeFilltablePolicy({
    max_value_bytes: 256,
    max_total_bytes: 512,
  });
  const records = [
    {
      op: 'add_label',
      model_id: 100,
      p: 0,
      r: 0,
      c: 0,
      k: 'title',
      t: 'str',
      v: 'x'.repeat(300),
    },
  ];
  const out = validateFilltableRecords(records, policy);
  assert.strictEqual(out.accepted_records.length, 0);
  assert.strictEqual(out.rejected_records.length, 1);
  assert.strictEqual(out.rejected_records[0].code, 'value_too_large');
  return { key: 'validate_records_size_limit', status: 'PASS' };
}

function test_digest_is_stable() {
  const records = [
    { op: 'rm_label', model_id: 100, p: 0, r: 0, c: 0, k: 'x' },
    { op: 'add_label', model_id: 101, p: 1, r: 2, c: 3, k: 'y', t: 'int', v: 7 },
  ];
  const a = buildFilltableDigest(records);
  const b = buildFilltableDigest(records);
  assert.strictEqual(a, b);
  assert.strictEqual(typeof a, 'string');
  assert(a.length >= 16);
  return { key: 'digest_is_stable', status: 'PASS' };
}

function test_apply_guard_states() {
  const missing = evaluateApplyPreviewGuard({
    requested_preview_id: '',
    latest_preview_id: 'p1',
    last_applied_preview_id: '',
  });
  assert.strictEqual(missing.ok, false);
  assert.strictEqual(missing.code, 'missing_preview_id');

  const stale = evaluateApplyPreviewGuard({
    requested_preview_id: 'p0',
    latest_preview_id: 'p1',
    last_applied_preview_id: '',
  });
  assert.strictEqual(stale.ok, false);
  assert.strictEqual(stale.code, 'stale_preview');

  const replay = evaluateApplyPreviewGuard({
    requested_preview_id: 'p1',
    latest_preview_id: 'p1',
    last_applied_preview_id: 'p1',
  });
  assert.strictEqual(replay.ok, false);
  assert.strictEqual(replay.code, 'preview_replay');

  const ok = evaluateApplyPreviewGuard({
    requested_preview_id: 'p2',
    latest_preview_id: 'p2',
    last_applied_preview_id: 'p1',
  });
  assert.strictEqual(ok.ok, true);
  return { key: 'apply_guard_states', status: 'PASS' };
}

function test_structural_type_default_denied() {
  const records = [
    {
      op: 'add_label',
      model_id: 100,
      p: 0,
      r: 0,
      c: 0,
      k: 'handler',
      t: 'func.js',
      v: { code: 'return 1;' },
    },
  ];
  const out = validateFilltableRecords(records, normalizeFilltablePolicy(null));
  assert.strictEqual(out.accepted_records.length, 0);
  assert.strictEqual(out.rejected_records.length, 1);
  assert.strictEqual(out.rejected_records[0].code, 'structural_label_type_forbidden');
  return { key: 'structural_type_default_denied', status: 'PASS' };
}

function test_structural_type_allowed_by_flag() {
  const records = [
    {
      op: 'add_label',
      model_id: 100,
      p: 0,
      r: 0,
      c: 0,
      k: 'handler',
      t: 'func.js',
      v: { code: 'return 1;', modelName: 'demo' },
    },
    {
      op: 'add_label',
      model_id: 100,
      p: 0,
      r: 0,
      c: 1,
      k: 'connect',
      t: 'pin.connect.label',
      v: [{ from: 'in', to: ['out'] }],
    },
  ];
  const out = validateFilltableRecords(records, normalizeFilltablePolicy({
    allow_structural_types: true,
  }));
  assert.strictEqual(out.accepted_records.length, 2);
  assert.strictEqual(out.rejected_records.length, 0);
  return { key: 'structural_type_allowed_by_flag', status: 'PASS' };
}

function test_structural_values_must_match_type_contract() {
  const invalidFunc = validateFilltableRecords([
    {
      op: 'add_label',
      model_id: 100,
      p: 0,
      r: 0,
      c: 0,
      k: 'bad_func',
      t: 'func.js',
      v: 'return 1;',
    },
  ], normalizeFilltablePolicy({
    allow_structural_types: true,
  }));
  assert.strictEqual(invalidFunc.accepted_records.length, 0);
  assert.strictEqual(invalidFunc.rejected_records[0].code, 'invalid_func_value');

  const invalidConnect = validateFilltableRecords([
    {
      op: 'add_label',
      model_id: 100,
      p: 0,
      r: 0,
      c: 0,
      k: 'bad_connect',
      t: 'pin.connect.label',
      v: { from: 'in', to: ['out'] },
    },
  ], normalizeFilltablePolicy({
    allow_structural_types: true,
  }));
  assert.strictEqual(invalidConnect.accepted_records.length, 0);
  assert.strictEqual(invalidConnect.rejected_records[0].code, 'invalid_connect_value');

  return { key: 'structural_values_must_match_type_contract', status: 'PASS' };
}

const tests = [
  test_normalize_policy_defaults,
  test_validate_records_positive_and_negative_models,
  test_validate_records_protected_key_rejected,
  test_validate_records_size_limit,
  test_digest_is_stable,
  test_apply_guard_states,
  test_structural_type_default_denied,
  test_structural_type_allowed_by_flag,
  test_structural_values_must_match_type_contract,
];

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    const r = t();
    console.log(`[${r.status}] ${r.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${t.name}: ${err.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
