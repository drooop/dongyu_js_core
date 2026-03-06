#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  normalizeFilltablePolicy,
  validateFilltableCandidateChanges,
  buildFilltableDigest,
} from '../../packages/ui-model-demo-server/filltable_policy.mjs';

const policy = normalizeFilltablePolicy(null);

assert.equal(typeof validateFilltableCandidateChanges, 'function', 'filltable_policy must export validateFilltableCandidateChanges()');

const out = validateFilltableCandidateChanges([
  {
    action: 'set_label',
    target: { model_id: 100, p: 0, r: 0, c: 0, k: 'title' },
    label: { t: 'str', v: 'demo' },
  },
  {
    action: 'remove_label',
    target: { model_id: -1, p: 0, r: 0, c: 1, k: 'ui_event' },
  },
], policy);

assert.ok(Array.isArray(out.accepted_changes), 'validateFilltableCandidateChanges must return accepted_changes');
assert.ok(Array.isArray(out.rejected_changes), 'validateFilltableCandidateChanges must return rejected_changes');
assert.equal(out.accepted_changes.length, 1, 'positive-model set_label should be accepted');
assert.equal(out.rejected_changes.length, 1, 'negative-model remove_label should be rejected');
assert.equal(out.rejected_changes[0].code, 'model_id_not_allowed');

const digest = buildFilltableDigest(out.accepted_changes);
assert.equal(typeof digest, 'string');
assert.ok(digest.length >= 16);

console.log('test_0171_filltable_owner_materialization: PASS');
