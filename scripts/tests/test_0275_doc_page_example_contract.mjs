#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function getRecords(patch) {
  return Array.isArray(patch?.records) ? patch.records : [];
}

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

function test_minimal_doc_page_patch_exists_and_uses_temp_model_1015() {
  const patch = readJson('packages/worker-base/system-models/doc_page_filltable_example_minimal.json');
  const records = getRecords(patch);
  assert.ok(findRecord(records, (record) => record?.op === 'create_model' && record?.model_id === 1015), 'doc_example_create_model_1015_missing');
  assert.ok(findRecord(records, (record) => record?.model_id === 1015 && record?.k === 'ui_authoring_version' && record?.v === 'cellwise.ui.v1'), 'doc_example_must_be_cellwise_ui_v1');
  assert.ok(findRecord(records, (record) => record?.model_id === 1015 && record?.k === 'ui_component' && record?.v === 'Section'), 'doc_example_section_missing');
  assert.ok(findRecord(records, (record) => record?.model_id === 1015 && record?.k === 'ui_component' && record?.v === 'Heading'), 'doc_example_heading_missing');
  assert.ok(findRecord(records, (record) => record?.model_id === 1015 && record?.k === 'ui_component' && record?.v === 'Callout'), 'doc_example_callout_missing');
  assert.ok(findRecord(records, (record) => record?.model_id === 1015 && record?.k === 'ui_component' && record?.v === 'List'), 'doc_example_list_missing');
  return { key: 'minimal_doc_page_patch_exists_and_uses_temp_model_1015', status: 'PASS' };
}

const tests = [test_minimal_doc_page_patch_exists_and_uses_temp_model_1015];
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
