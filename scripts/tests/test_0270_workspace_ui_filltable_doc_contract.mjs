#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(resolve(repoRoot, relPath), 'utf8');
}

function test_workspace_ui_filltable_doc_covers_required_sections() {
  const text = read('docs/user-guide/workspace_ui_filltable_example.md');
  assert.match(text, /Workspace.*侧边栏/u, 'doc_must_cover_workspace_sidebar_mount');
  assert.match(text, /Add Label[\s\S]*model_type|model_type[\s\S]*自动创建/u, 'doc_must_cover_positive_model_creation');
  assert.match(text, /Input.*Button.*Label/u, 'doc_must_cover_component_placement');
  assert.match(text, /远端模式|双总线/u, 'doc_must_cover_remote_mode');
  assert.match(text, /本地模式/u, 'doc_must_cover_local_mode');
  assert.match(text, /processor_routes/u, 'doc_must_cover_route_switch_label');
  assert.match(text, /layout_direction/u, 'doc_must_cover_layout_label');
  assert.match(text, /input_font_size/u, 'doc_must_cover_input_font_size');
  assert.match(text, /button_color/u, 'doc_must_cover_button_color');
  assert.match(text, /重建|重新挂载/u, 'doc_must_cover_rebuild_flow');
  return { key: 'workspace_ui_filltable_doc_covers_required_sections', status: 'PASS' };
}

function test_user_guide_index_links_new_workspace_example_doc() {
  const text = read('docs/user-guide/README.md');
  assert.match(text, /workspace_ui_filltable_example\.md/u, 'user_guide_index_must_link_0270_doc');
  return { key: 'user_guide_index_links_new_workspace_example_doc', status: 'PASS' };
}

const tests = [
  test_workspace_ui_filltable_doc_covers_required_sections,
  test_user_guide_index_links_new_workspace_example_doc,
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
