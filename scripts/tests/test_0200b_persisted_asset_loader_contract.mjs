#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function writeJson(fp, value) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, `${JSON.stringify(value, null, 2)}\n`);
}

function mkAssetRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dy-assets-'));
}

async function loadLoaderModule() {
  return import(path.join(repoRoot, 'packages/worker-base/src/persisted_asset_loader.mjs'));
}

function runSyncLocalPersistedAssets(assetRoot) {
  const result = spawnSync('bash', ['scripts/ops/sync_local_persisted_assets.sh'], {
    cwd: repoRoot,
    env: { ...process.env, LOCAL_PERSISTED_ASSET_ROOT: assetRoot },
    encoding: 'utf8',
  });
  assert.equal(
    result.status,
    0,
    `sync_local_persisted_assets.sh must succeed for temp asset root: ${result.stderr || result.stdout}`,
  );
}

function readLabel(rt, modelId, p, r, c, k) {
  const model = rt.getModel(modelId);
  if (!model) return undefined;
  const cell = rt.getCell(model, p, r, c);
  return cell.labels.get(k)?.v;
}

async function test_manifest_loader_orders_and_filters_by_scope_phase_and_filter() {
  const assetRoot = mkAssetRoot();
  writeJson(path.join(assetRoot, 'system/base/system_models.json'), {
    version: 'mt.v0',
    op_id: 'system-base',
    records: [
      { op: 'create_model', model_id: 0, name: 'MT', type: 'main' },
      { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'base_label', t: 'str', v: 'base' },
    ],
  });
  writeJson(path.join(assetRoot, 'system/ui/nav_catalog_ui.json'), {
    version: 'mt.v0',
    op_id: 'ui-negative',
    records: [
      { op: 'create_model', model_id: -2, name: 'editor_state', type: 'ui' },
      { op: 'add_label', model_id: -2, p: 0, r: 0, c: 0, k: 'neg_label', t: 'str', v: 'neg' },
      { op: 'create_model', model_id: 7, name: 'should_not_load', type: 'main' },
    ],
  });
  writeJson(path.join(assetRoot, 'roles/remote-worker/patches/10_model100.json'), {
    version: 'mt.v0',
    op_id: 'remote-positive',
    records: [
      { op: 'create_model', model_id: 100, name: 'remote_model', type: 'main' },
      { op: 'add_label', model_id: 100, p: 0, r: 0, c: 0, k: 'remote_label', t: 'str', v: 'remote' },
    ],
  });
  writeJson(path.join(assetRoot, 'manifest.v0.json'), {
    version: 'dy.asset_manifest.v0',
    entries: [
      {
        id: 'remote-positive',
        phase: '40-role-positive',
        path: 'roles/remote-worker/patches/10_model100.json',
        kind: 'patch',
        scope: ['remote-worker'],
        authority: 'authoritative',
        filter: 'full',
        required: true,
      },
      {
        id: 'system-ui-negative',
        phase: '10-system-negative',
        path: 'system/ui/nav_catalog_ui.json',
        kind: 'patch',
        scope: ['ui-server', 'remote-worker'],
        authority: 'authoritative',
        filter: 'negative-only',
        required: true,
      },
      {
        id: 'system-base',
        phase: '00-system-base',
        path: 'system/base/system_models.json',
        kind: 'patch',
        scope: ['ui-server', 'mbr-worker', 'remote-worker', 'ui-side-worker'],
        authority: 'authoritative',
        filter: 'full',
        required: true,
      },
    ],
  });

  const { readPersistedAssetManifest, selectPersistedAssetEntries, applyPersistedAssetEntries } = await loadLoaderModule();

  const manifest = readPersistedAssetManifest(assetRoot);
  const selected = selectPersistedAssetEntries(manifest, { scope: 'remote-worker', authority: 'authoritative', kind: 'patch' });
  assert.deepEqual(
    selected.map((entry) => entry.id),
    ['system-base', 'system-ui-negative', 'remote-positive'],
    'entries must be ordered by phase and filtered by scope',
  );

  const rt = new ModelTableRuntime();
  const result = applyPersistedAssetEntries(rt, { assetRoot, scope: 'remote-worker', authority: 'authoritative', kind: 'patch' });
  assert.equal(result.entriesApplied, 3);
  assert.equal(readLabel(rt, 0, 0, 0, 0, 'base_label'), 'base');
  assert.equal(readLabel(rt, -2, 0, 0, 0, 'neg_label'), 'neg');
  assert.equal(rt.getModel(7), undefined, 'negative-only entry must not materialize positive model records');
  assert.equal(readLabel(rt, 100, 0, 0, 0, 'remote_label'), 'remote');
}

async function test_repo_sync_externalizes_matrix_debug_surface_and_handlers_for_ui_server() {
  const assetRoot = mkAssetRoot();
  runSyncLocalPersistedAssets(assetRoot);

  const matrixDebugSurfacePath = path.join(assetRoot, 'system/ui/matrix_debug_surface.json');
  const intentHandlersPath = path.join(assetRoot, 'system/ui/intent_handlers_matrix_debug.json');
  assert.equal(
    fs.existsSync(matrixDebugSurfacePath),
    true,
    'matrix_debug_surface must be externalized into persisted assets for ui-server',
  );
  assert.equal(
    fs.existsSync(intentHandlersPath),
    true,
    'intent_handlers_matrix_debug must be externalized into persisted assets for ui-server',
  );

  const { readPersistedAssetManifest, applyPersistedAssetEntries } = await loadLoaderModule();
  const manifest = readPersistedAssetManifest(assetRoot);
  const uiServerPaths = manifest.entries
    .filter((entry) => Array.isArray(entry.scope) && entry.scope.includes('ui-server'))
    .map((entry) => entry.path);

  assert.equal(
    uiServerPaths.includes('system/ui/matrix_debug_surface.json'),
    true,
    'manifest must include matrix_debug_surface for ui-server',
  );
  assert.equal(
    uiServerPaths.includes('system/ui/intent_handlers_matrix_debug.json'),
    true,
    'manifest must include intent_handlers_matrix_debug for ui-server',
  );

  const rt = new ModelTableRuntime();
  applyPersistedAssetEntries(rt, {
    assetRoot,
    scope: 'ui-server',
    authority: 'authoritative',
    kind: 'patch',
    phases: ['00-system-base', '10-system-negative', '30-system-positive'],
    applyOptions: { allowCreateModel: true, trustedBootstrap: true },
  });

  const pageAsset = readLabel(rt, -100, 0, 1, 0, 'page_asset_v0');
  const refreshHandler = readLabel(rt, -10, 0, 0, 0, 'handle_matrix_debug_refresh');
  assert.equal(pageAsset?.id, 'matrix_debug_root', 'persisted loader must materialize matrix_debug_root from synced assets');
  assert.equal(
    typeof refreshHandler?.code,
    'string',
    'persisted loader must materialize matrix debug refresh handler from synced assets',
  );
}

function fail(name, err) {
  console.log(`[FAIL] ${name}: ${err.message}`);
}

function pass(name) {
  console.log(`[PASS] ${name}`);
}

const tests = [
  test_manifest_loader_orders_and_filters_by_scope_phase_and_filter,
  test_repo_sync_externalizes_matrix_debug_surface_and_handlers_for_ui_server,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    await test();
    pass(test.name);
    passed += 1;
  } catch (err) {
    fail(test.name, err);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
