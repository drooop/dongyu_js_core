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

const workerActors = [
  {
    name: 'mbr',
    patch: 'deploy/sys-v1ns/mbr/patches/mbr_role_v0.json',
    patchDir: 'deploy/sys-v1ns/mbr/patches',
    workerId: '5/10/28/35/14',
    role: 'DEM',
  },
  {
    name: 'remote_worker',
    patch: 'deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json',
    patchDir: 'deploy/sys-v1ns/remote-worker/patches',
    workerId: '5/10/28/35/15',
    role: 'V1N',
  },
  {
    name: 'workspace_manager',
    patch: 'deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json',
    patchDir: 'deploy/sys-v1ns/workspace-manager/patches',
    workerId: '5/10/28/36/16',
    role: 'DEM',
  },
];

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

function paragraphHasTerms(source, terms) {
  return source
    .split(/\r?\n[ \t]*\r?\n/u)
    .some((paragraph) => terms.every((term) => term.test(paragraph)));
}

function assertWorkerIdentity(relPath, expectedRole) {
  const records = recordsOf(relPath);
  const id = rootLabel(records, 'sys_worker_id');
  const role = rootLabel(records, 'sys_worker_role');
  assert.ok(id, `${relPath}_must_seed_sys_worker_id`);
  assert.equal(id.t, 'worker.id', `${relPath}_sys_worker_id_must_use_worker_id_type`);
  assert.match(id.v, /^\d+\/\d+\/\d+\/\d+\/\d+$/u, `${relPath}_sys_worker_id_must_use_five_numeric_segments`);
  assert.ok(role, `${relPath}_must_seed_sys_worker_role`);
  assert.equal(role.t, 'worker.role', `${relPath}_sys_worker_role_must_use_worker_role_type`);
  assert.equal(role.v, expectedRole, `${relPath}_worker_role_mismatch`);
  assert.equal(rootLabel(records, 'is_DEM'), null, `${relPath}_must_not_seed_removed_is_DEM`);
  assert.equal(rootLabel(records, 'v1n_id'), null, `${relPath}_must_not_seed_removed_v1n_id`);
  assert.equal(rootLabel(records, 'worker.role'), null, `${relPath}_must_not_seed_legacy_worker_role_key`);
}

function test_worker_root_authority_distinguishes_v1n_from_ordinary_tables() {
  const claude = read('CLAUDE.md');
  const architecture = read('docs/architecture_mantanet_and_workers.md');
  const violations = [];
  if (!paragraphHasTerms(claude, [/(?:software worker|worker host|worker root)/iu, /Model 0/iu, /model\.v1n/iu])) {
    violations.push('claude_missing_worker_root_model_v1n');
  }
  if (!paragraphHasTerms(claude, [/(?:ordinary|non-worker)/iu, /model\.table/iu])) {
    violations.push('claude_missing_ordinary_model_table');
  }
  if (!paragraphHasTerms(architecture, [/(?:软件工人|software worker)/iu, /Model 0/iu, /model\.v1n/iu])) {
    violations.push('architecture_missing_model_v1n_form');
  }
  if (!paragraphHasTerms(architecture, [/(?:普通|非软件工人|ordinary|non-worker)/iu, /model\.table/iu])) {
    violations.push('architecture_missing_ordinary_model_table');
  }
  assert.deepEqual(violations, [], `worker_root_authority_conflicts:${violations.join(',')}`);
  return { key: 'worker_root_authority_distinguishes_v1n_from_ordinary_tables', status: 'PASS' };
}

function test_worker_role_patches_declare_v1n_before_identity_role_and_bus_pins() {
  const violations = [];
  for (const actor of workerActors) {
    const records = recordsOf(actor.patch);
    const formIndex = records.findIndex((record) => rootLabel([record], 'model_type')?.t === 'model.v1n');
    if (formIndex < 0) {
      violations.push(`${actor.name}_missing_root_model_v1n`);
      continue;
    }
    const dependentIndexes = records
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => rootLabel([record], record?.k) === record)
      .filter(({ record }) => record.k === 'sys_worker_id' || record.k === 'sys_worker_role' || /^pin\.bus\.(?:cb|mb)\.(?:in|out)$/u.test(record.t))
      .map(({ index }) => index);
    if (dependentIndexes.some((index) => index <= formIndex)) {
      violations.push(`${actor.name}_root_model_v1n_must_precede_identity_role_and_bus_pins`);
    }
  }
  assert.deepEqual(violations, [], `worker_root_patch_contract_violations:${violations.join(',')}`);
  return { key: 'worker_role_patches_declare_v1n_before_identity_role_and_bus_pins', status: 'PASS' };
}

function test_worker_roles_control_management_pin_legality() {
  const violations = [];
  for (const actor of workerActors) {
    const records = recordsOf(actor.patch);
    const managementPinTypes = new Set(records
      .filter((record) => rootLabel([record], record?.k) === record)
      .map((record) => record.t)
      .filter((type) => /^pin\.bus\.mb\.(?:in|out)$/u.test(type)));
    if (actor.role === 'V1N' && managementPinTypes.size > 0) {
      violations.push(`${actor.name}_v1n_must_not_declare_management_pins`);
    }
  }
  assert.deepEqual(violations, [], `worker_role_management_pin_violations:${violations.join(',')}`);
  return { key: 'worker_roles_control_management_pin_legality', status: 'PASS' };
}

function test_system_seed_does_not_lock_worker_identity() {
  const records = recordsOf('packages/worker-base/system-models/system_models.json');
  assert.equal(rootLabel(records, 'sys_worker_id'), null, 'system_seed_must_not_write_generic_sys_worker_id');
  assert.equal(rootLabel(records, 'sys_worker_role'), null, 'system_seed_must_not_write_generic_sys_worker_role');
  assert.equal(rootLabel(records, 'v1n_id'), null, 'system_seed_must_not_write_generic_v1n_id');
  assert.equal(rootLabel(records, 'worker.role'), null, 'system_seed_must_not_write_generic_role');
  assert.equal(rootLabel(records, 'is_DEM'), null, 'system_seed_must_not_write_removed_role');
  return { key: 'system_seed_does_not_lock_worker_identity', status: 'PASS' };
}

function test_worker_role_patches_are_explicit() {
  assertWorkerIdentity('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json', 'DEM');
  assertWorkerIdentity('deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json', 'V1N');
  assertWorkerIdentity('deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json', 'DEM');
  return { key: 'worker_role_patches_are_explicit', status: 'PASS' };
}

function assertLoadedWorkerIdentity(roleName, relDir, expectedId, expectedRole) {
  const rt = new ModelTableRuntime();
  rt.applyPatch(json('packages/worker-base/system-models/system_models.json'), {
    allowCreateModel: true,
    trustedBootstrap: true,
  });
  loadRolePatches(rt, relDir);
  const root = rt.getCell(rt.getModel(0), 0, 0, 0);
  assert.equal(root.labels.get('sys_worker_id')?.v, expectedId, `${roleName}_loaded_sys_worker_id_mismatch`);
  assert.equal(root.labels.get('sys_worker_role')?.v, expectedRole, `${roleName}_loaded_sys_worker_role_mismatch`);
  assert.equal(root.labels.has('is_DEM'), false, `${roleName}_must_not_load_removed_is_DEM`);
  assert.equal(root.labels.has('v1n_id'), false, `${roleName}_must_not_load_removed_v1n_id`);
  assert.equal(root.labels.has('worker.role'), false, `${roleName}_must_not_load_legacy_worker_role_key`);
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
    assert.equal(root.labels.get('sys_worker_id')?.v, '5/10/28/35/13', 'ui_server_loaded_sys_worker_id_mismatch');
    assert.equal(root.labels.get('sys_worker_role')?.v, 'DEM', 'ui_server_loaded_sys_worker_role_mismatch');
    assert.equal(root.labels.has('is_DEM'), false, 'ui_server_must_not_seed_removed_is_DEM');
    assert.equal(root.labels.has('v1n_id'), false, 'ui_server_must_not_seed_removed_v1n_id');
    assert.equal(root.labels.has('worker.role'), false, 'ui_server_must_not_seed_legacy_worker_role_key');
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
  assertLoadedWorkerIdentity('mbr', 'deploy/sys-v1ns/mbr/patches', '5/10/28/35/14', 'DEM');
  assertLoadedWorkerIdentity('remote_worker', 'deploy/sys-v1ns/remote-worker/patches', '5/10/28/35/15', 'V1N');
  assertLoadedWorkerIdentity('workspace_manager', 'deploy/sys-v1ns/workspace-manager/patches', '5/10/28/36/16', 'DEM');
  return { key: 'worker_identity_survives_actual_load_order', status: 'PASS' };
}

function test_loaded_worker_runtimes_preserve_v1n_root_form() {
  const violations = [];
  for (const actor of workerActors) {
    const rt = new ModelTableRuntime();
    rt.applyPatch(json('packages/worker-base/system-models/system_models.json'), {
      allowCreateModel: true,
      trustedBootstrap: true,
    });
    loadRolePatches(rt, actor.patchDir);
    const root = rt.getCell(rt.getModel(0), 0, 0, 0);
    if (root.labels.get('model_type')?.t !== 'model.v1n') violations.push(`${actor.name}_loaded_root_is_not_model_v1n`);
  }
  assert.deepEqual(violations, [], `loaded_worker_root_form_violations:${violations.join(',')}`);
  return { key: 'loaded_worker_runtimes_preserve_v1n_root_form', status: 'PASS' };
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
  test_worker_root_authority_distinguishes_v1n_from_ordinary_tables,
  test_worker_role_patches_declare_v1n_before_identity_role_and_bus_pins,
  test_worker_roles_control_management_pin_legality,
  test_worker_role_patches_are_explicit,
  test_worker_identity_survives_actual_load_order,
  test_loaded_worker_runtimes_preserve_v1n_root_form,
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
