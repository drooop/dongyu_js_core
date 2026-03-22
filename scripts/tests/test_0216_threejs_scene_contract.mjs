#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import * as modelIds from '../../packages/ui-model-demo-frontend/src/model_ids.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function test_three_dependency_is_frozen_in_frontend_manifest() {
  const frontendManifest = readJson('packages/ui-model-demo-frontend/package.json');
  assert.equal(
    typeof frontendManifest?.dependencies?.three,
    'string',
    'frontend_manifest_must_declare_three_dependency',
  );
}

function test_three_dependency_is_locked_in_frontend_package_lock() {
  const frontendLockfile = readJson('packages/ui-model-demo-frontend/package-lock.json');
  assert.equal(
    frontendLockfile?.packages?.['']?.dependencies?.katex,
    '^0.16.22',
    'frontend_package_lock_must_include_existing_katex_dependency',
  );
  assert.equal(
    frontendLockfile?.packages?.['']?.dependencies?.three,
    '^0.174.0',
    'frontend_package_lock_must_include_three_dependency',
  );
  assert.equal(
    typeof frontendLockfile?.packages?.['node_modules/three']?.version,
    'string',
    'frontend_package_lock_must_materialize_three_package',
  );
}

function test_three_scene_contract_ids_are_frozen() {
  assert.equal(
    modelIds.THREE_SCENE_COMPONENT_TYPE,
    'ThreeScene',
    'three_scene_component_type_must_be_frozen',
  );
  assert.equal(
    modelIds.THREE_SCENE_APP_MODEL_ID,
    1007,
    'three_scene_app_model_id_must_be_1007',
  );
  assert.equal(
    modelIds.THREE_SCENE_CHILD_MODEL_ID,
    1008,
    'three_scene_child_model_id_must_be_1008',
  );
  assert.ok(
    modelIds.THREE_SCENE_CHILD_MODEL_ID > modelIds.THREE_SCENE_APP_MODEL_ID,
    'three_scene_child_model_id_must_follow_parent_model_id',
  );
}

function test_three_scene_actions_are_frozen() {
  assert.equal(
    modelIds.THREE_SCENE_CREATE_ENTITY_ACTION,
    'three_scene_create_entity',
    'three_scene_create_entity_action_must_be_frozen',
  );
  assert.equal(
    modelIds.THREE_SCENE_SELECT_ENTITY_ACTION,
    'three_scene_select_entity',
    'three_scene_select_entity_action_must_be_frozen',
  );
  assert.equal(
    modelIds.THREE_SCENE_UPDATE_ENTITY_ACTION,
    'three_scene_update_entity',
    'three_scene_update_entity_action_must_be_frozen',
  );
  assert.equal(
    modelIds.THREE_SCENE_DELETE_ENTITY_ACTION,
    'three_scene_delete_entity',
    'three_scene_delete_entity_action_must_be_frozen',
  );
}

const tests = [
  test_three_dependency_is_frozen_in_frontend_manifest,
  test_three_dependency_is_locked_in_frontend_package_lock,
  test_three_scene_contract_ids_are_frozen,
  test_three_scene_actions_are_frozen,
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
