#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function test_cloud_manifests_mount_persisted_asset_root_for_all_roles() {
  const workers = read('k8s/cloud/workers.yaml');
  const uiSide = read('k8s/cloud/ui-side-worker.yaml');

  assert.match(workers, /DY_PERSISTED_ASSET_ROOT/, 'cloud workers manifest must pass DY_PERSISTED_ASSET_ROOT');
  assert.match(uiSide, /DY_PERSISTED_ASSET_ROOT/, 'cloud ui-side worker manifest must pass DY_PERSISTED_ASSET_ROOT');
  assert.match(workers, /mountPath:\s*\/app\/persisted-assets/, 'cloud workers manifest must mount persisted asset root into containers');
  assert.match(uiSide, /mountPath:\s*\/app\/persisted-assets/, 'cloud ui-side worker manifest must mount persisted asset root into container');
  assert.match(workers, /path:\s*\/home\/wwpic\/dongyu\/volume\/persist\/assets/, 'cloud workers manifest must mount canonical cloud persisted asset hostPath');
  assert.match(uiSide, /path:\s*\/home\/wwpic\/dongyu\/volume\/persist\/assets/, 'cloud ui-side worker manifest must mount canonical cloud persisted asset hostPath');
}

function test_cloud_full_deploy_syncs_assets_and_rolls_out_ui_side_worker() {
  const source = read('scripts/ops/deploy_cloud_full.sh');

  assert.match(source, /sync_local_persisted_assets\.sh/, 'cloud full deploy must sync authoritative assets before rollout');
  assert.match(source, /CLOUD_PERSISTED_ASSET_ROOT="\$\{CLOUD_PERSISTED_ASSET_ROOT:-\/home\/wwpic\/dongyu\/volume\/persist\/assets\}"/, 'cloud full deploy must default to canonical cloud persisted asset root');
  assert.match(source, /LOCAL_PERSISTED_ASSET_ROOT="\$CLOUD_PERSISTED_ASSET_ROOT"/, 'cloud full deploy must pass the persisted asset root into sync script');
  assert.match(source, /Dockerfile\.ui-side-worker/, 'cloud full deploy must build ui-side-worker image');
  assert.match(source, /docker save dy-ui-side-worker:v1/, 'cloud full deploy must import ui-side-worker image');
  assert.match(source, /kubectl apply -f "\$REPO_DIR\/k8s\/cloud\/ui-side-worker\.yaml"/, 'cloud full deploy must apply ui-side-worker manifest');
  assert.match(source, /rollout restart deployment\/ui-side-worker/, 'cloud full deploy must restart ui-side-worker');
  assert.match(source, /wait_for_rollout ui-server mbr-worker remote-worker ui-side-worker/, 'cloud full deploy must wait for ui-side-worker rollout');
}

function test_cloud_app_deploy_supports_ui_side_worker_target() {
  const source = read('scripts/ops/deploy_cloud_app.sh');

  assert.match(source, /ui-server\|mbr-worker\|remote-worker\|ui-side-worker/, 'cloud app deploy must accept ui-side-worker target');
  assert.match(source, /k8s\/Dockerfile\.ui-side-worker/, 'cloud app deploy must define ui-side-worker dockerfile');
  assert.match(source, /DEPLOYMENT="ui-side-worker"/, 'cloud app deploy must define ui-side-worker deployment name');
}

const tests = [
  test_cloud_manifests_mount_persisted_asset_root_for_all_roles,
  test_cloud_full_deploy_syncs_assets_and_rolls_out_ui_side_worker,
  test_cloud_app_deploy_supports_ui_side_worker_target,
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
