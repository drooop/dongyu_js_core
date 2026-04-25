#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function test_deploy_local_supports_asset_sync_and_skip_build() {
  const source = read('scripts/ops/deploy_local.sh');
  assert.match(source, /sync_local_persisted_assets\.sh/, 'deploy_local must sync persisted assets before rollout');
  assert.match(source, /SKIP_IMAGE_BUILD/, 'deploy_local must support skipping docker builds for patch-only updates');
  assert.match(source, /local\.generated\.env/, 'deploy_local must support reusing generated Matrix bootstrap for patch-only updates');
  assert.match(source, /SKIP_MATRIX_BOOTSTRAP/, 'deploy_local must expose an explicit skip-bootstrap path');
}

function test_local_manifests_mount_persisted_asset_root() {
  const workers = read('k8s/local/workers.yaml');
  const uiSide = read('k8s/local/ui-side-worker.yaml');

  assert.match(workers, /DY_PERSISTED_ASSET_ROOT/, 'workers manifest must pass DY_PERSISTED_ASSET_ROOT');
  assert.match(uiSide, /DY_PERSISTED_ASSET_ROOT/, 'ui-side worker manifest must pass DY_PERSISTED_ASSET_ROOT');
  assert.match(workers, /mountPath:\s*\/app\/persisted-assets/, 'workers manifest must mount persisted asset root into containers');
  assert.match(uiSide, /mountPath:\s*\/app\/persisted-assets/, 'ui-side worker manifest must mount persisted asset root into containers');
  assert.match(workers, /hostPath:/, 'workers manifest must use hostPath for local persisted assets');
  assert.match(uiSide, /hostPath:/, 'ui-side worker manifest must use hostPath for local persisted assets');
}

function test_runtime_entrypoints_reference_persisted_asset_root() {
  const server = read('packages/ui-model-demo-server/server.mjs');
  const engine = read('scripts/worker_engine_v0.mjs');
  const mbr = read('scripts/run_worker_v0.mjs');
  const remote = read('scripts/run_worker_remote_v1.mjs');
  const uiSide = read('scripts/run_worker_ui_side_v0.mjs');

  assert.match(engine, /resolvePersistedAssetRoot/, 'worker engine must support persisted asset root resolution');
  assert.match(engine, /applyPersistedAssetEntries/, 'worker engine must support persisted asset manifest application');
  assert.match(server, /applyPersistedAssetEntries/, 'ui-server must load authoritative assets through persisted asset loader');
  assert.match(mbr, /applyPersistedAssetEntries/, 'mbr runner must load authoritative assets through persisted asset loader');
  assert.match(remote, /applyPersistedAssetEntries/, 'remote worker runner must load authoritative assets through persisted asset loader');
  assert.match(uiSide, /applyPersistedAssetEntries/, 'ui-side worker runner must load authoritative assets through persisted asset loader');
}

const tests = [
  test_deploy_local_supports_asset_sync_and_skip_build,
  test_local_manifests_mount_persisted_asset_root,
  test_runtime_entrypoints_reference_persisted_asset_root,
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
