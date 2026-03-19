#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);

const cases = [
  ['packages/worker-base/system-models/gallery_catalog_ui.json', -103, 'UI.GalleryCatalog'],
  ['packages/worker-base/system-models/home_catalog_ui.json', -22, 'UI.HomeCatalog'],
  ['packages/worker-base/system-models/docs_catalog_ui.json', -23, 'UI.DocsCatalog'],
  ['packages/worker-base/system-models/static_catalog_ui.json', -24, 'UI.StaticCatalog'],
  ['packages/worker-base/system-models/workspace_catalog_ui.json', -25, 'UI.WorkspaceCatalog'],
  ['packages/worker-base/system-models/editor_test_catalog_ui.json', -26, 'UI.EditorTestCatalog'],
];

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function test_catalog_assets_have_explicit_model_type() {
  for (const [relPath, modelId, expectedType] of cases) {
    const patch = loadJson(relPath);
    const records = Array.isArray(patch.records) ? patch.records : [];
    const label = records.find((record) => (
      record
      && record.op === 'add_label'
      && record.model_id === modelId
      && record.p === 0
      && record.r === 0
      && record.c === 0
      && record.k === 'model_type'
    ));
    assert.ok(label, `${relPath}:missing_model_type`);
    assert.equal(label.t, 'model.single', `${relPath}:model_type_t_mismatch`);
    assert.equal(label.v, expectedType, `${relPath}:model_type_v_mismatch`);
  }
}

const tests = [
  test_catalog_assets_have_explicit_model_type,
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
