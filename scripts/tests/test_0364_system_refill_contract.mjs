#!/usr/bin/env node
// 0364 — system/deploy refill contract for worker identity, role, and active UI model bus labels.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function read(relPath) {
  return readFileSync(resolve(repoRoot, relPath), 'utf8');
}

function json(relPath) {
  return JSON.parse(read(relPath));
}

function recordsOf(relPath) {
  const parsed = json(relPath);
  return Array.isArray(parsed.records) ? parsed.records : [];
}

function loadRolePatches(rt, relDir) {
  const { readdirSync } = require('node:fs');
  const { join } = require('node:path');
  const files = readdirSync(resolve(repoRoot, relDir)).filter((file) => file.endsWith('.json')).sort();
  for (const file of files) {
    rt.applyPatch(json(join(relDir, file)), { allowCreateModel: true, trustedBootstrap: true });
  }
}

function rootLabel(records, key) {
  return records.find((record) => (
    record
    && record.op === 'add_label'
    && record.model_id === 0
    && record.p === 0
    && record.r === 0
    && record.c === 0
    && record.k === key
  )) || null;
}

function assertWorkerIdentity(relPath, expectedDem) {
  const records = recordsOf(relPath);
  const id = rootLabel(records, 'v1n_id');
  const dem = rootLabel(records, 'is_DEM');
  assert.ok(id, `${relPath}_must_seed_v1n_id`);
  assert.equal(id.t, 'str', `${relPath}_v1n_id_must_be_str`);
  assert.match(id.v, /^\d+\/\d+\/\d+\/\d+\/\d+$/u, `${relPath}_v1n_id_must_use_five_numeric_segments`);
  assert.ok(dem, `${relPath}_must_seed_is_DEM`);
  assert.equal(dem.t, 'bool', `${relPath}_is_DEM_must_be_bool`);
  assert.equal(dem.v, expectedDem, `${relPath}_is_DEM_role_mismatch`);
}

function test_system_seed_does_not_lock_worker_identity() {
  const records = recordsOf('packages/worker-base/system-models/system_models.json');
  assert.equal(rootLabel(records, 'v1n_id'), null, 'system_seed_must_not_write_generic_v1n_id');
  assert.equal(rootLabel(records, 'is_DEM'), null, 'system_seed_must_not_write_generic_role');
  return { key: 'system_seed_does_not_lock_worker_identity', status: 'PASS' };
}

function test_worker_role_patches_are_explicit() {
  assertWorkerIdentity('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json', true);
  assertWorkerIdentity('deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json', false);
  assertWorkerIdentity('deploy/sys-v1ns/ui-side-worker/patches/00_ui_side_worker_config.json', false);
  return { key: 'worker_role_patches_are_explicit', status: 'PASS' };
}

function assertLoadedWorkerIdentity(roleName, relDir, expectedId, expectedDem) {
  const rt = new ModelTableRuntime();
  rt.applyPatch(json('packages/worker-base/system-models/system_models.json'), {
    allowCreateModel: true,
    trustedBootstrap: true,
  });
  loadRolePatches(rt, relDir);
  const root = rt.getCell(rt.getModel(0), 0, 0, 0);
  assert.equal(root.labels.get('v1n_id')?.v, expectedId, `${roleName}_loaded_v1n_id_mismatch`);
  assert.equal(root.labels.get('is_DEM')?.v, expectedDem, `${roleName}_loaded_is_DEM_mismatch`);
}

async function assertUiServerIdentity() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0364-ui-identity-'));
  process.env.DY_AUTH = '0';
  process.env.WORKER_BASE_WORKSPACE = `it0364_identity_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  try {
    const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
    const state = createServerState({ dbPath: null });
    const root = state.runtime.getCell(state.runtime.getModel(0), 0, 0, 0);
    assert.equal(root.labels.get('v1n_id')?.v, '5/10/28/35/13', 'ui_server_loaded_v1n_id_mismatch');
    assert.equal(root.labels.get('is_DEM')?.v, true, 'ui_server_loaded_is_DEM_mismatch');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.DY_AUTH;
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

function test_worker_identity_survives_actual_load_order() {
  assertLoadedWorkerIdentity('mbr', 'deploy/sys-v1ns/mbr/patches', '5/10/28/35/14', true);
  assertLoadedWorkerIdentity('remote_worker', 'deploy/sys-v1ns/remote-worker/patches', '5/10/28/35/15', false);
  assertLoadedWorkerIdentity('ui_side_worker', 'deploy/sys-v1ns/ui-side-worker/patches', '5/10/28/35/16', false);
  return { key: 'worker_identity_survives_actual_load_order', status: 'PASS' };
}

async function test_ui_server_identity_survives_actual_boot() {
  await assertUiServerIdentity();
  return { key: 'ui_server_identity_survives_actual_boot', status: 'PASS' };
}

function test_active_ui_models_do_not_teach_unsplit_bus_pins() {
  const activeFiles = [
    'packages/worker-base/system-models/home_catalog_ui.json',
    'packages/worker-base/system-models/llm_cognition_config.json',
    'packages/worker-base/system-models/workspace_positive_models.json',
    'packages/worker-base/system-models/test_model_100_ui.json',
    'test_files/minimal_submit_dual_bus_app_payload.json',
    'test_files/imported_host_egress_app_payload.json',
  ];
  for (const relPath of activeFiles) {
    const text = read(relPath);
    assert.equal(text.includes('pin.bus.in'), false, `${relPath}_must_not_reference_removed_pin_bus_in`);
    assert.equal(text.includes('pin.bus.out'), false, `${relPath}_must_not_reference_removed_pin_bus_out`);
  }

  const home = read('packages/worker-base/system-models/home_catalog_ui.json');
  assert.equal(home.includes('pin.bus.cb.in'), true, 'home_catalog_must_offer_control_bus_in');
  assert.equal(home.includes('pin.bus.mb.out'), true, 'home_catalog_must_offer_management_bus_out');

  const workspace = read('packages/worker-base/system-models/workspace_positive_models.json');
  assert.equal(workspace.includes('Model 0 pin.bus.mb.in'), true, 'workspace_docs_must_name_management_bus_in');
  assert.equal(workspace.includes('Model 0 pin.bus.in'), false, 'workspace_docs_must_not_name_unsplit_bus_in');
  return { key: 'active_ui_models_do_not_teach_unsplit_bus_pins', status: 'PASS' };
}

function test_slide_provider_payload_stays_provider_owned_only() {
  const payload = json('test_files/minimal_submit_dual_bus_app_payload.json');
  assert.equal(Array.isArray(payload), true, 'minimal_submit_payload_must_be_array');
  assert.equal(payload.some((record) => record.t === 'ui.egress.binding.v1'), false, 'provider_payload_must_not_include_host_binding');
  assert.equal(payload.some((record) => typeof record.t === 'string' && record.t.startsWith('pin.bus.')), false, 'provider_payload_must_not_include_bus_pins');
  assert.equal(payload.some((record) => record.k === 'remote_bus_endpoint_v1'), true, 'provider_payload_must_declare_remote_endpoint');
  assert.equal(payload.some((record) => record.k === 'dual_bus_model' && Array.isArray(record.v?.egress_pins)), true, 'provider_payload_must_declare_public_egress_pins');
  return { key: 'slide_provider_payload_stays_provider_owned_only', status: 'PASS' };
}

const tests = [
  test_system_seed_does_not_lock_worker_identity,
  test_worker_role_patches_are_explicit,
  test_worker_identity_survives_actual_load_order,
  test_ui_server_identity_survives_actual_boot,
  test_active_ui_models_do_not_teach_unsplit_bus_pins,
  test_slide_provider_payload_stays_provider_owned_only,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error && error.stack ? error.stack : error}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
