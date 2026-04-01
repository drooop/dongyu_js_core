#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(resolve(repoRoot, relPath), 'utf8');
}

function test_authoring_contract_mentions_doc_page_label_k_fields() {
  const text = read('docs/plans/2026-03-27-cellwise-ui-authoring-contract-v1.md');
  for (const key of [
    'ui_heading_level',
    'ui_list_type',
    'ui_callout_type',
    'ui_image_src',
    'ui_image_alt',
    'ui_mermaid_code',
    'ui_code_language',
    'ui_section_number',
  ]) {
    assert.match(text, new RegExp(key), `${key}_missing_from_authoring_contract`);
  }
  return { key: 'authoring_contract_mentions_doc_page_label_k_fields', status: 'PASS' };
}

function test_doc_page_user_guide_exists_and_covers_minimal_example() {
  const text = read('docs/user-guide/doc_page_filltable_guide.md');
  assert.match(text, /Heading/u, 'doc_guide_must_cover_heading');
  assert.match(text, /Paragraph/u, 'doc_guide_must_cover_paragraph');
  assert.match(text, /Callout/u, 'doc_guide_must_cover_callout');
  assert.match(text, /List/u, 'doc_guide_must_cover_list');
  assert.match(text, /1015/u, 'doc_guide_must_cover_temp_model_example');
  assert.doesNotMatch(text, /label_type_registry\.md/u, 'doc_guide_must_not_direct_users_to_modify_label_type_registry');
  return { key: 'doc_page_user_guide_exists_and_covers_minimal_example', status: 'PASS' };
}

const tests = [
  test_authoring_contract_mentions_doc_page_label_k_fields,
  test_doc_page_user_guide_exists_and_covers_minimal_example,
];

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
