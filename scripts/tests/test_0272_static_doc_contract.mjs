#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function test_static_workspace_doc_covers_required_topics() {
  const text = read('docs/user-guide/static_workspace_rebuild.md');
  assert.match(text, /Workspace/u, 'doc_must_cover_workspace_entry');
  assert.match(text, /Model 1011/u, 'doc_must_cover_app_host');
  assert.match(text, /Model 1012/u, 'doc_must_cover_truth_model');
  assert.match(text, /HTML/u, 'doc_must_cover_html_upload');
  assert.match(text, /ZIP/u, 'doc_must_cover_zip_upload');
  assert.match(text, /\/p\/<projectName>\//u, 'doc_must_cover_public_mount_rule');
  assert.match(text, /static_project_name/u, 'doc_must_cover_truth_labels');
  return { key: 'static_workspace_doc_covers_required_topics', status: 'PASS' };
}

function test_user_guide_index_links_static_doc() {
  const text = read('docs/user-guide/README.md');
  assert.match(text, /static_workspace_rebuild\.md/u, 'user_guide_index_must_link_static_doc');
  return { key: 'user_guide_index_links_static_doc', status: 'PASS' };
}

const tests = [
  test_static_workspace_doc_covers_required_topics,
  test_user_guide_index_links_static_doc,
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
