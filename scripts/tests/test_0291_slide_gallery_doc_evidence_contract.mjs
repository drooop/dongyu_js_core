#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function getRecords(relPath) {
  return Array.isArray(readJson(relPath)?.records) ? readJson(relPath).records : [];
}

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

async function test_gallery_store_exports_slide_mainline_contract() {
  const ids = await import(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/model_ids.js'));
  const galleryStore = await import(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/gallery_store.js'));
  assert.deepEqual(
    galleryStore.GALLERY_INTEGRATION_CONTRACT.slideMainline,
    {
      model_ids: [
        ids.MODEL_100_ID,
        ids.SLIDE_IMPORTER_APP_MODEL_ID,
        ids.SLIDE_IMPORTER_TRUTH_MODEL_ID,
        ids.SLIDE_CREATOR_APP_MODEL_ID,
        ids.SLIDE_CREATOR_TRUTH_MODEL_ID,
      ],
      actions: ['slide_app_import', 'slide_app_create'],
    },
    'gallery_slide_mainline_contract_must_freeze_models_and_actions',
  );
  return { key: 'gallery_store_exports_slide_mainline_contract', status: 'PASS' };
}

function test_gallery_patch_defines_slide_showcase_and_state() {
  const records = getRecords('packages/worker-base/system-models/gallery_catalog_ui.json');
  const galleryStateRecords = records.filter((record) => record?.model_id === -102 && record?.op === 'add_label');
  const galleryUiRecords = records.filter((record) => record?.model_id === -103 && record?.op === 'add_label');

  for (const key of [
    'gallery_slide_focus',
    'gallery_slide_summary_text',
    'gallery_slide_registry_count_text',
    'gallery_slide_models_text',
    'gallery_slide_creator_status_text',
    'gallery_slide_last_created_text',
    'gallery_slide_docs_text',
    'gallery_slide_evidence_local_text',
    'gallery_slide_evidence_remote_text',
  ]) {
    assert.ok(findRecord(galleryStateRecords, (record) => record?.k === key), `gallery_slide_state_missing:${key}`);
  }

  for (const nodeId of [
    'gallery_slide_showcase_card',
    'gallery_slide_intro',
    'gallery_slide_focus_row',
    'gallery_slide_focus_topology_button',
    'gallery_slide_focus_workspace_button',
    'gallery_slide_focus_create_button',
    'gallery_slide_focus_evidence_button',
    'gallery_slide_workspace_button',
    'gallery_slide_summary_text',
    'gallery_slide_registry_text',
    'gallery_slide_models_text',
    'gallery_slide_creator_status_text',
    'gallery_slide_last_created_text',
    'gallery_slide_docs_terminal',
    'gallery_slide_evidence_local_terminal',
    'gallery_slide_evidence_remote_terminal',
  ]) {
    assert.ok(
      findRecord(galleryUiRecords, (record) => record?.k === 'ui_node_id' && record?.v === nodeId),
      `gallery_slide_ui_node_missing:${nodeId}`,
    );
  }

  const focusWriteTargets = new Set();
  let workspaceNavFound = false;
  const readModelIds = new Set();
  for (const record of galleryUiRecords) {
    const bind = record?.k === 'ui_bind_json' && record?.v && typeof record.v === 'object' ? record.v : null;
    if (!bind) continue;
    const read = bind.read;
    if (read && Number.isInteger(read.model_id)) readModelIds.add(read.model_id);
    const write = bind.write;
    if (write?.target_ref?.k === 'gallery_slide_focus' && write?.value_ref?.v) {
      focusWriteTargets.add(write.value_ref.v);
    }
    if (write?.target_ref?.k === 'nav_to' && write?.value_ref?.v === '/workspace') {
      workspaceNavFound = true;
    }
  }

  assert.deepEqual(
    [...focusWriteTargets].sort(),
    ['create', 'evidence', 'topology', 'workspace'],
    'gallery_slide_focus_buttons_must_cover_all_focus_values',
  );
  assert.equal(workspaceNavFound, true, 'gallery_slide_workspace_button_must_navigate_to_workspace');

  for (const modelId of [-102]) {
    assert.ok(readModelIds.has(modelId), `gallery_slide_showcase_read_ref_missing:${modelId}`);
  }

  return { key: 'gallery_patch_defines_slide_showcase_and_state', status: 'PASS' };
}

function test_slide_phaseD_docs_exist_and_index_them() {
  const readme = readText('docs/user-guide/README.md');
  const mainlineGuide = readText('docs/user-guide/slide_ui_mainline_guide.md');
  const evidenceGuide = readText('docs/user-guide/slide_ui_evidence_runbook.md');

  assert.match(readme, /slide_ui_mainline_guide\.md/, 'user_guide_index_must_include_slide_ui_mainline_guide');
  assert.match(readme, /slide_ui_evidence_runbook\.md/, 'user_guide_index_must_include_slide_ui_evidence_runbook');
  assert.match(mainlineGuide, /0291|Gallery|Workspace|滑动 APP 导入|滑动 APP 创建/, 'slide_ui_mainline_guide_must_describe_gallery_and_workspace_entrypoints');
  assert.match(evidenceGuide, /127\.0\.0\.1:30900|app\.dongyudigital\.com|#\/gallery|#\/workspace/, 'slide_ui_evidence_runbook_must_capture_local_and_remote_entrypoints');
  return { key: 'slide_phaseD_docs_exist_and_index_them', status: 'PASS' };
}

function test_app_shell_consumes_gallery_nav_to_in_remote_mode() {
  const source = readText('packages/ui-model-demo-frontend/src/demo_app.js');
  assert.match(source, /galleryNavTarget/, 'app_shell_must_track_gallery_nav_target');
  assert.match(source, /target:\s*\{\s*model_id:\s*-102,\s*p:\s*0,\s*r:\s*0,\s*c:\s*0,\s*k:\s*'nav_to'/, 'app_shell_must_clear_gallery_nav_to_after_route_change');
  return { key: 'app_shell_consumes_gallery_nav_to_in_remote_mode', status: 'PASS' };
}

const tests = [
  test_gallery_store_exports_slide_mainline_contract,
  test_gallery_patch_defines_slide_showcase_and_state,
  test_slide_phaseD_docs_exist_and_index_them,
  test_app_shell_consumes_gallery_nav_to_in_remote_mode,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
