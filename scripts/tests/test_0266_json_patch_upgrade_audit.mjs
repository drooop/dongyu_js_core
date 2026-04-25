#!/usr/bin/env node

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const scanRoots = [
  'packages/worker-base/system-models',
  'deploy/sys-v1ns',
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.json')) continue;
    if (entry.name.endsWith('.legacy')) continue;
    out.push(abs);
  }
  return out;
}

function rel(abs) {
  return path.relative(repoRoot, abs);
}

function test_authoritative_json_patches_do_not_use_runtime_wide_patch_or_runtime_mutators() {
  const offenders = [];
  for (const root of scanRoots) {
    const absRoot = path.join(repoRoot, root);
    for (const abs of walk(absRoot)) {
      const text = fs.readFileSync(abs, 'utf8');
      if (/ctx\.runtime\.applyPatch/.test(text)) offenders.push(`${rel(abs)}: ctx.runtime.applyPatch`);
      if (/ctx\.runtime\.addLabel/.test(text)) offenders.push(`${rel(abs)}: ctx.runtime.addLabel`);
      if (/ctx\.runtime\.rmLabel/.test(text)) offenders.push(`${rel(abs)}: ctx.runtime.rmLabel`);
    }
  }
  assert.deepEqual(offenders, [], `authoritative json patches still expose runtime-wide or runtime mutator bypasses:\n${offenders.join('\n')}`);
  return { key: 'authoritative_json_patches_do_not_use_runtime_wide_patch_or_runtime_mutators', status: 'PASS' };
}

const tests = [
  test_authoritative_json_patches_do_not_use_runtime_wide_patch_or_runtime_mutators,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
