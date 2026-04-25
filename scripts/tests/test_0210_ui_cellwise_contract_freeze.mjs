#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function assertContains(relPath, pattern, message) {
  const text = readText(relPath);
  assert.match(text, pattern, message);
}

function test_plan_contains_contract_matrix_and_migration_inventory_sections() {
  assertContains(
    'docs/iterations/0210-ui-cellwise-contract-freeze/plan.md',
    /^## Contract Classification Matrix$/m,
    'plan_missing_contract_classification_matrix',
  );
  assertContains(
    'docs/iterations/0210-ui-cellwise-contract-freeze/plan.md',
    /^## 0211 Migration Inventory$/m,
    'plan_missing_0211_migration_inventory',
  );
}

function test_resolution_contains_freeze_deliverables_section() {
  assertContains(
    'docs/iterations/0210-ui-cellwise-contract-freeze/resolution.md',
    /^## Freeze Deliverables$/m,
    'resolution_missing_freeze_deliverables',
  );
}

function test_runtime_semantics_freezes_ui_projection_contract() {
  assertContains(
    'docs/ssot/runtime_semantics_modeltable_driven.md',
    /^### 1\.5 UI Projection Contract \(0210 Freeze\)$/m,
    'runtime_semantics_missing_ui_projection_contract',
  );
  assertContains(
    'docs/ssot/runtime_semantics_modeltable_driven.md',
    /整页 `ui_ast_v0` 页面 JSON 只能视为 legacy-debt/,
    'runtime_semantics_missing_legacy_ui_ast_rule',
  );
  assertContains(
    'docs/ssot/runtime_semantics_modeltable_driven.md',
    /matrix 挂载同样必须通过显式 `model\.submt` hosting cell/,
    'runtime_semantics_missing_matrix_mount_rule',
  );
}

function test_label_registry_freezes_ui_bootstrap_boundary() {
  assertContains(
    'docs/ssot/label_type_registry.md',
    /^### 2\.1 UI Bootstrap Boundary \(0210 Freeze\)$/m,
    'label_registry_missing_ui_bootstrap_boundary',
  );
  assertContains(
    'docs/ssot/label_type_registry.md',
    /`ui_ast_v0`、`ws_selected_ast`、共享 mailbox root AST 都不是新的 label\.t 合同/,
    'label_registry_missing_legacy_bootstrap_note',
  );
}

function test_user_guide_exposes_allowed_forbidden_legacy_debt_table() {
  assertContains(
    'docs/user-guide/modeltable_user_guide.md',
    /^## 2\.2 UI Cellwise Contract \(0210 Freeze\)$/m,
    'user_guide_missing_ui_cellwise_contract_section',
  );
  assertContains(
    'docs/user-guide/modeltable_user_guide.md',
    /\| Classification \| Definition \| Current Examples \|/,
    'user_guide_missing_contract_table',
  );
}

const tests = [
  test_plan_contains_contract_matrix_and_migration_inventory_sections,
  test_resolution_contains_freeze_deliverables_section,
  test_runtime_semantics_freezes_ui_projection_contract,
  test_label_registry_freezes_ui_bootstrap_boundary,
  test_user_guide_exposes_allowed_forbidden_legacy_debt_table,
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
