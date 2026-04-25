#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const workspacePatch = JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages/worker-base/system-models/workspace_positive_models.json'), 'utf8'));
const records = Array.isArray(workspacePatch?.records) ? workspacePatch.records : [];
const STATIC_WORKSPACE_APP_MODEL_ID = 1011;

function findRecord(predicate) {
  return records.find((record) => predicate(record)) || null;
}

function test_static_workspace_ui_nodes_exist() {
  assert.ok(findRecord((record) => record?.model_id === STATIC_WORKSPACE_APP_MODEL_ID && record?.k === 'app_name'), 'static_workspace_app_name_missing');
  for (const component of ['Input', 'Select', 'FileInput', 'Button', 'Table']) {
    assert.ok(
      findRecord((record) => record?.model_id === STATIC_WORKSPACE_APP_MODEL_ID && record?.k === 'ui_component' && record?.v === component),
      `static_workspace_missing_component_${component}`,
    );
  }
  return { key: 'static_workspace_ui_nodes_exist', status: 'PASS' };
}

const tests = [test_static_workspace_ui_nodes_exist];
let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
