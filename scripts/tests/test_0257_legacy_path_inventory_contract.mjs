#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

const AUTHORITATIVE_PATCHES = [
  'packages/worker-base/system-models/home_catalog_ui.json',
  'packages/worker-base/system-models/docs_catalog_ui.json',
  'packages/worker-base/system-models/static_catalog_ui.json',
  'packages/worker-base/system-models/prompt_catalog_ui.json',
  'packages/worker-base/system-models/gallery_catalog_ui.json',
  'packages/worker-base/system-models/workspace_catalog_ui.json',
  'packages/worker-base/system-models/workspace_positive_models.json',
];
const TRANCHE_A_MODELS = [1004, 1005, 1006, 1007];
const ALLOWED_LOCAL_UI_LABEL_UPDATES = new Set([
  '1036:selected_event_id',
  '1036:target_user_id',
  '1036:composer_draft',
]);

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function collectPositiveDirectLabelUpdates(node, out = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => collectPositiveDirectLabelUpdates(child, out));
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  if (
    node.action === 'label_update'
    && node.target_ref
    && typeof node.target_ref === 'object'
    && Number.isInteger(node.target_ref.model_id)
    && node.target_ref.model_id > 0
  ) {
    out.push({
      model_id: node.target_ref.model_id,
      k: node.target_ref.k,
    });
  }
  Object.values(node).forEach((value) => collectPositiveDirectLabelUpdates(value, out));
  return out;
}

function countPageAssetAuthoringRecords(records) {
  return records.filter((record) => (
    record
    && record.op === 'add_label'
    && record.k === 'page_asset_v0'
    && record.t === 'json'
  )).length;
}

function collectPageAssetAuthoringModels(records) {
  return records
    .filter((record) => (
      record
      && record.op === 'add_label'
      && record.k === 'page_asset_v0'
      && record.t === 'json'
      && Number.isInteger(record.model_id)
    ))
    .map((record) => record.model_id);
}

function findRootLabelValue(records, modelId, key) {
  const hit = records.find((record) => (
    record
    && record.op === 'add_label'
    && record.model_id === modelId
    && record.p === 0
    && record.r === 0
    && record.c === 0
    && record.k === key
  ));
  return hit ? hit.v : undefined;
}

function test_authoritative_patches_have_no_direct_positive_label_update() {
  const hits = [];
  for (const rel of AUTHORITATIVE_PATCHES) {
    const obj = loadJson(rel);
    const localHits = collectPositiveDirectLabelUpdates(obj);
    localHits
      .filter((hit) => !ALLOWED_LOCAL_UI_LABEL_UPDATES.has(`${hit.model_id}:${hit.k}`))
      .forEach((hit) => hits.push({ file: rel, ...hit }));
  }
  assert.deepEqual(hits, [], 'authoritative_ui_patches_must_not_keep_direct_positive_business_label_update');
  return { key: 'authoritative_patches_have_no_direct_positive_label_update', status: 'PASS' };
}

function test_authoritative_page_asset_v0_authoring_source_is_fully_removed() {
  const counts = [];
  for (const rel of AUTHORITATIVE_PATCHES) {
    const obj = loadJson(rel);
    const records = Array.isArray(obj.records) ? obj.records : [];
    const count = countPageAssetAuthoringRecords(records);
    if (count > 0) counts.push({ file: rel, count });
  }
  assert.deepEqual(counts, [], 'authoritative_page_asset_v0_authoring_source_must_be_removed');
  return { key: 'authoritative_page_asset_v0_authoring_source_is_fully_removed', status: 'PASS' };
}

function test_tranche_a_models_remove_page_asset_authoring_source() {
  const workspaceModels = loadJson('packages/worker-base/system-models/workspace_positive_models.json');
  const records = Array.isArray(workspaceModels.records) ? workspaceModels.records : [];
  const pageAssetModels = new Set(collectPageAssetAuthoringModels(records));
  const stale = TRANCHE_A_MODELS.filter((modelId) => pageAssetModels.has(modelId));
  assert.deepEqual(stale, [], 'tranche_a_models_must_not_keep_page_asset_v0_authoring_source');
  return { key: 'tranche_a_models_remove_page_asset_authoring_source', status: 'PASS' };
}

function test_tranche_a_models_declare_cellwise_authoring_root() {
  const workspaceModels = loadJson('packages/worker-base/system-models/workspace_positive_models.json');
  const records = Array.isArray(workspaceModels.records) ? workspaceModels.records : [];
  for (const modelId of TRANCHE_A_MODELS) {
    assert.equal(
      findRootLabelValue(records, modelId, 'ui_authoring_version'),
      'cellwise.ui.v1',
      `model_${modelId}_must_declare_cellwise_ui_authoring_version`,
    );
    assert.equal(
      typeof findRootLabelValue(records, modelId, 'ui_root_node_id'),
      'string',
      `model_${modelId}_must_declare_ui_root_node_id`,
    );
  }
  return { key: 'tranche_a_models_declare_cellwise_authoring_root', status: 'PASS' };
}

const tests = [
  test_authoritative_patches_have_no_direct_positive_label_update,
  test_authoritative_page_asset_v0_authoring_source_is_fully_removed,
  test_tranche_a_models_remove_page_asset_authoring_source,
  test_tranche_a_models_declare_cellwise_authoring_root,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[PASS] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
