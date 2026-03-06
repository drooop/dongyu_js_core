#!/usr/bin/env node

import assert from 'node:assert';
import {
  DEFAULT_FILLTABLE_POLICY,
  normalizeFilltablePolicy,
  validateFilltableCandidateChanges,
  buildFilltableDigest,
  evaluateApplyPreviewGuard,
} from '../../packages/ui-model-demo-server/filltable_policy.mjs';

function test_normalize_policy_defaults() {
  const out = normalizeFilltablePolicy(null);
  assert.strictEqual(out.allow_positive_model_ids, true);
  assert.strictEqual(out.allow_negative_model_ids, false);
  assert.strictEqual(out.max_changes_per_apply, DEFAULT_FILLTABLE_POLICY.max_changes_per_apply);
  assert(Array.isArray(out.allowed_label_types));
  assert(out.allowed_label_types.includes('str'));
  assert(Array.isArray(out.protected_label_keys));
  assert(out.protected_label_keys.includes('intent.v0'));
  return { key: 'normalize_policy_defaults', status: 'PASS' };
}

function test_validate_changes_positive_and_negative_models() {
  const changes = [
    {
      action: 'set_label',
      target: { model_id: 100, p: 0, r: 0, c: 0, k: 'title' },
      label: { t: 'str', v: 'hello' },
    },
    {
      action: 'set_label',
      target: { model_id: -1, p: 0, r: 0, c: 0, k: 'bad' },
      label: { t: 'str', v: 'x' },
    },
  ];
  const out = validateFilltableCandidateChanges(changes, normalizeFilltablePolicy(null));
  assert.strictEqual(out.accepted_changes.length, 1);
  assert.strictEqual(out.rejected_changes.length, 1);
  assert.strictEqual(out.rejected_changes[0].code, 'model_id_not_allowed');
  return { key: 'validate_changes_positive_and_negative_models', status: 'PASS' };
}

function test_validate_changes_protected_key_rejected() {
  const changes = [
    {
      action: 'set_label',
      target: { model_id: 100, p: 0, r: 0, c: 0, k: 'dual_bus_model' },
      label: { t: 'json', v: { a: 1 } },
    },
  ];
  const out = validateFilltableCandidateChanges(changes, normalizeFilltablePolicy(null));
  assert.strictEqual(out.accepted_changes.length, 0);
  assert.strictEqual(out.rejected_changes.length, 1);
  assert.strictEqual(out.rejected_changes[0].code, 'protected_label_key');
  return { key: 'validate_changes_protected_key_rejected', status: 'PASS' };
}

function test_validate_changes_size_limit() {
  const policy = normalizeFilltablePolicy({
    max_value_bytes: 256,
    max_total_bytes: 512,
  });
  const changes = [
    {
      action: 'set_label',
      target: { model_id: 100, p: 0, r: 0, c: 0, k: 'title' },
      label: { t: 'str', v: 'x'.repeat(300) },
    },
  ];
  const out = validateFilltableCandidateChanges(changes, policy);
  assert.strictEqual(out.accepted_changes.length, 0);
  assert.strictEqual(out.rejected_changes.length, 1);
  assert.strictEqual(out.rejected_changes[0].code, 'value_too_large');
  return { key: 'validate_changes_size_limit', status: 'PASS' };
}

function test_digest_is_stable() {
  const changes = [
    { action: 'remove_label', target: { model_id: 100, p: 0, r: 0, c: 0, k: 'x' } },
    { action: 'set_label', target: { model_id: 101, p: 1, r: 2, c: 3, k: 'y' }, label: { t: 'int', v: 7 } },
  ];
  const a = buildFilltableDigest(changes);
  const b = buildFilltableDigest(changes);
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
  const changes = [
    {
      action: 'set_label',
      target: { model_id: 100, p: 0, r: 0, c: 0, k: 'cmd' },
      label: { t: 'pin.table.in', v: null },
    },
    {
      action: 'set_label',
      target: { model_id: 100, p: 0, r: 0, c: 1, k: 'sig' },
      label: { t: 'pin.single.in', v: 'port_in' },
    },
    {
      action: 'set_label',
      target: { model_id: 100, p: 0, r: 0, c: 2, k: 'handler' },
      label: { t: 'func.js', v: { code: 'return 1;' } },
    },
    {
      action: 'set_label',
      target: { model_id: 100, p: 0, r: 0, c: 3, k: 'connect' },
      label: { t: 'pin.connect.label', v: [{ from: 'in', to: ['out'] }] },
    },
  ];
  const out = validateFilltableCandidateChanges(changes, normalizeFilltablePolicy(null));
  assert.strictEqual(out.accepted_changes.length, 0);
  assert.strictEqual(out.rejected_changes.length, 4);
  assert(out.rejected_changes.every((item) => item.code === 'structural_label_type_forbidden'));
  return { key: 'structural_type_default_denied', status: 'PASS' };
}

function test_structural_type_allowed_by_flag() {
  const changes = [
    {
      action: 'set_label',
      target: { model_id: 100, p: 0, r: 0, c: 0, k: 'handler' },
      label: { t: 'func.js', v: { code: 'return 1;', modelName: 'demo' } },
    },
    {
      action: 'set_label',
      target: { model_id: 100, p: 0, r: 0, c: 1, k: 'connect' },
      label: { t: 'pin.connect.label', v: [{ from: 'in', to: ['out'] }] },
    },
    {
      action: 'set_label',
      target: { model_id: 100, p: 0, r: 0, c: 2, k: 'cmd' },
      label: { t: 'pin.table.in', v: null },
    },
    {
      action: 'set_label',
      target: { model_id: 101, p: 0, r: 0, c: 0, k: 'signal' },
      label: { t: 'pin.single.out', v: 'done' },
    },
    {
      action: 'set_label',
      target: { model_id: 102, p: 0, r: 0, c: 0, k: 'shape' },
      label: { t: 'model.single', v: 'demo.single' },
    },
  ];
  const out = validateFilltableCandidateChanges(changes, normalizeFilltablePolicy({
    allow_structural_types: true,
  }));
  assert.strictEqual(out.accepted_changes.length, 5);
  assert.strictEqual(out.rejected_changes.length, 0);
  return { key: 'structural_type_allowed_by_flag', status: 'PASS' };
}

function test_structural_values_must_match_type_contract() {
  const invalidFunc = validateFilltableCandidateChanges([
    {
      action: 'set_label',
      target: { model_id: 100, p: 0, r: 0, c: 0, k: 'handler' },
      label: { t: 'func.js', v: { modelName: 'demo' } },
    },
  ], normalizeFilltablePolicy({ allow_structural_types: true }));
  assert.strictEqual(invalidFunc.accepted_changes.length, 0);
  assert.strictEqual(invalidFunc.rejected_changes[0].code, 'invalid_func_value');

  const invalidConnect = validateFilltableCandidateChanges([
    {
      action: 'set_label',
      target: { model_id: 100, p: 0, r: 0, c: 0, k: 'connect' },
      label: { t: 'pin.connect.label', v: { from: 'in', to: ['out'] } },
    },
  ], normalizeFilltablePolicy({ allow_structural_types: true }));
  assert.strictEqual(invalidConnect.accepted_changes.length, 0);
  assert.strictEqual(invalidConnect.rejected_changes[0].code, 'invalid_connect_value');
  return { key: 'structural_values_must_match_type_contract', status: 'PASS' };
}

function test_remove_label_requires_no_label_payload() {
  const out = validateFilltableCandidateChanges([
    {
      action: 'remove_label',
      target: { model_id: 100, p: 0, r: 0, c: 0, k: 'obsolete_key' },
    },
  ], normalizeFilltablePolicy(null));
  assert.strictEqual(out.accepted_changes.length, 1);
  assert.strictEqual(out.rejected_changes.length, 0);
  assert.strictEqual(out.accepted_changes[0].action, 'remove_label');
  return { key: 'remove_label_requires_no_label_payload', status: 'PASS' };
}

function test_model_zero_is_forbidden_in_owner_chain() {
  const out = validateFilltableCandidateChanges([
    {
      action: 'set_label',
      target: { model_id: 0, p: 0, r: 0, c: 0, k: 'bus_evt' },
      label: { t: 'pin.bus.in', v: null },
    },
  ], normalizeFilltablePolicy({ allow_structural_types: true }));
  assert.strictEqual(out.accepted_changes.length, 0);
  assert.strictEqual(out.rejected_changes.length, 1);
  assert.strictEqual(out.rejected_changes[0].code, 'model_id_not_allowed');
  return { key: 'model_zero_is_forbidden_in_owner_chain', status: 'PASS' };
}

const tests = [
  test_normalize_policy_defaults,
  test_validate_changes_positive_and_negative_models,
  test_validate_changes_protected_key_rejected,
  test_validate_changes_size_limit,
  test_digest_is_stable,
  test_apply_guard_states,
  test_structural_type_default_denied,
  test_structural_type_allowed_by_flag,
  test_structural_values_must_match_type_contract,
  test_remove_label_requires_no_label_payload,
  test_model_zero_is_forbidden_in_owner_chain,
];

let failed = 0;
for (const testFn of tests) {
  try {
    const result = testFn();
    console.log(`[${result.status}] ${result.key}`);
  } catch (err) {
    failed += 1;
    console.error(`[FAIL] ${testFn.name}:`, err.message);
  }
}

if (failed > 0) {
  console.error(`test_0155_prompt_filltable_policy: ${failed} failed`);
  process.exit(1);
}

console.log('test_0155_prompt_filltable_policy: PASS');
