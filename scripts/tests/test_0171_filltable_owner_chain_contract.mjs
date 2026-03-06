#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const serverText = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');

assert.match(serverText, /accepted_changes/, 'server preview/apply contract must use accepted_changes');
assert.match(serverText, /rejected_changes/, 'server preview/apply contract must use rejected_changes');
assert.match(serverText, /applied_changes/, 'server apply result must use applied_changes');
assert.doesNotMatch(serverText, /accepted_records/, 'server preview/apply contract must stop exposing accepted_records');
assert.doesNotMatch(serverText, /applied_records/, 'server apply result must stop exposing applied_records');
assert.match(serverText, /resolveFilltableOwner\s*\(/, 'server must define resolveFilltableOwner() for owner-chain');
assert.match(serverText, /materializeFilltableChange\s*\(/, 'server must define materializeFilltableChange() for owner-side materialization');

console.log('test_0171_filltable_owner_chain_contract: PASS');
