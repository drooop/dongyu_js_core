#!/usr/bin/env node

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

function test_runtime_semantics_freezes_scoped_patch_rules() {
  const text = read('docs/ssot/runtime_semantics_modeltable_driven.md');
  assert.match(text, /applyPatch\(... allowCreateModel=true\).*不是公共能力/u, 'runtime semantics must keep bootstrap-only global applyPatch rule');
  assert.match(text, /只允许 bootstrap loader/u, 'runtime semantics must explicitly limit global applyPatch to bootstrap loaders');
  assert.match(text, /applyScopedPatch/u, 'runtime semantics must define applyScopedPatch');
  assert.match(text, /owner materialization|helper/u, 'runtime semantics must define helper or owner materialization path');
  assert.match(text, /direct patch bypass|规约违规/u, 'runtime semantics must mark direct return-path applyPatch as non-conformant');
  return { key: 'runtime_semantics_freezes_scoped_patch_rules', status: 'PASS' };
}

function test_host_ctx_api_removes_runtime_wide_patch_surface() {
  const text = read('docs/ssot/host_ctx_api.md');
  assert.match(text, /ctx 不暴露全局 runtime 或 runtime-wide patch 能力/u, 'ctx api must forbid exposing global runtime patch capability');
  assert.match(text, /用户程序.*不得直接调用.*applyPatch|applyScopedPatch/u, 'ctx api must forbid user programs from direct patch invocation');
  assert.match(text, /helper request pin|owner_request|owner materialize/u, 'ctx api must describe helper-mediated materialization path');
  return { key: 'host_ctx_api_removes_runtime_wide_patch_surface', status: 'PASS' };
}

function test_label_registry_freezes_helper_contract() {
  const text = read('docs/ssot/label_type_registry.md');
  assert.match(text, /reserved helper executor cell|owner materialize/u, 'label registry must mention reserved helper or owner materialization contract');
  assert.match(text, /model\.submt.*只负责父子挂载|只负责父子挂载/u, 'label registry must clarify model.submt only establishes mounting');
  return { key: 'label_registry_freezes_helper_contract', status: 'PASS' };
}

function test_user_guide_mentions_helper_only_materialization() {
  const text = read('docs/user-guide/modeltable_user_guide.md');
  assert.match(text, /通过.*helper|owner materialize/u, 'user guide must explain helper-mediated writes');
  assert.match(text, /不得.*direct .*applyPatch|不得.*direct patch/u, 'user guide must forbid direct patch bypass');
  return { key: 'user_guide_mentions_helper_only_materialization', status: 'PASS' };
}

const tests = [
  test_runtime_semantics_freezes_scoped_patch_rules,
  test_host_ctx_api_removes_runtime_wide_patch_surface,
  test_label_registry_freezes_helper_contract,
  test_user_guide_mentions_helper_only_materialization,
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
