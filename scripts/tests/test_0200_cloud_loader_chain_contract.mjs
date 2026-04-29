#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function writeFile(filePath, content, mode = 0o644) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  fs.chmodSync(filePath, mode);
}

function runCloudAppDeployHarness(cloudEnvText) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dy-cloud-app-deploy-'));
  const scriptDir = path.join(root, 'scripts', 'ops');
  const binDir = path.join(root, 'bin');
  const logPath = path.join(root, 'ops.log');
  fs.mkdirSync(scriptDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });
  fs.copyFileSync(
    path.join(repoRoot, 'scripts/ops/deploy_cloud_app.sh'),
    path.join(scriptDir, 'deploy_cloud_app.sh'),
  );
  fs.chmodSync(path.join(scriptDir, 'deploy_cloud_app.sh'), 0o755);
  writeFile(path.join(scriptDir, '_deploy_common.sh'), `#!/usr/bin/env bash
load_env() {
  set -a
  # shellcheck disable=SC1090
  source "$1"
  set +a
}
wait_for_rollout() {
  echo "WAIT_FOR_ROLLOUT $*" >> "$TEST_LOG"
}
`, 0o755);
  writeFile(path.join(scriptDir, 'sync_local_persisted_assets.sh'), `#!/usr/bin/env bash
echo "SYNC_ASSETS $LOCAL_PERSISTED_ASSET_ROOT" >> "$TEST_LOG"
`, 0o755);
  writeFile(path.join(scriptDir, 'remote_preflight_guard.sh'), `#!/usr/bin/env bash
echo "REMOTE_PREFLIGHT $*" >> "$TEST_LOG"
if [ "$1" = "--print-socket" ]; then
  echo "/tmp/fake-containerd.sock"
fi
`, 0o755);
  writeFile(path.join(root, 'deploy/env/cloud.env'), cloudEnvText);
  writeFile(path.join(root, '.deploy-source-revision'), 'abc123\n');
  writeFile(path.join(binDir, 'id'), '#!/usr/bin/env bash\necho 0\n', 0o755);
  writeFile(path.join(binDir, 'docker'), `#!/usr/bin/env bash
echo "DOCKER $*" >> "$TEST_LOG"
exit 23
`, 0o755);
  const result = spawnSync('bash', [path.join(scriptDir, 'deploy_cloud_app.sh'), '--target', 'ui-server', '--revision', 'abc123', '--rebuild'], {
    cwd: root,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      TEST_LOG: logPath,
    },
    encoding: 'utf8',
  });
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  return { result, log };
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
  assert.match(workers, /type:\s*DirectoryOrCreate\n---\n# UI Server Deployment/s, 'cloud workers manifest must keep mbr-worker and ui-server as separate YAML documents');
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

function test_cloud_app_deploy_syncs_authoritative_assets_before_rollout() {
  const source = read('scripts/ops/deploy_cloud_app.sh');

  assert.match(source, /SYNC_PERSISTED_ASSETS="\$\{SYNC_PERSISTED_ASSETS:-1\}"/, 'cloud app deploy must sync persisted assets by default');
  assert.match(source, /sync_local_persisted_assets\.sh/, 'cloud app deploy must sync authoritative assets before rollout');
  assert.match(source, /CLOUD_PERSISTED_ASSET_ROOT="\$\{CLOUD_PERSISTED_ASSET_ROOT:-\/home\/wwpic\/dongyu\/volume\/persist\/assets\}"/, 'cloud app deploy must default to canonical cloud persisted asset root');
  assert.match(source, /LOCAL_PERSISTED_ASSET_ROOT="\$CLOUD_PERSISTED_ASSET_ROOT"/, 'cloud app deploy must pass the persisted asset root into sync script');
  assert.match(source, /if \[ "\$SYNC_PERSISTED_ASSETS" = "1" \]; then/, 'cloud app deploy must guard asset sync with explicit enabled value');
  assert.ok(
    source.indexOf('load_env "$REPO_DIR/deploy/env/cloud.env"') < source.indexOf('SYNC_PERSISTED_ASSETS must be 0 or 1'),
    'cloud app deploy must validate SYNC_PERSISTED_ASSETS after loading cloud.env',
  );
  assert.ok(
    source.indexOf('SYNC_PERSISTED_ASSETS must be 0 or 1') < source.indexOf('remote_preflight_guard.sh'),
    'cloud app deploy must reject invalid SYNC_PERSISTED_ASSETS before remote rollout work',
  );
  assert.ok(
    source.indexOf('sync_local_persisted_assets.sh') < source.indexOf('kubectl -n "$NAMESPACE" rollout restart'),
    'cloud app deploy must sync assets before rollout restart',
  );
}

function test_cloud_app_deploy_asset_sync_flag_behavior() {
  const defaultRun = runCloudAppDeployHarness('NAMESPACE=dongyu\n');
  assert.equal(defaultRun.result.status, 23, 'default sync harness must reach docker build sentinel');
  assert.match(defaultRun.log, /SYNC_ASSETS \/home\/wwpic\/dongyu\/volume\/persist\/assets/, 'default run must sync persisted assets');
  assert.ok(
    defaultRun.log.indexOf('SYNC_ASSETS') < defaultRun.log.indexOf('DOCKER build'),
    'default run must sync persisted assets before docker build',
  );

  const disabledRun = runCloudAppDeployHarness('NAMESPACE=dongyu\nSYNC_PERSISTED_ASSETS=0\n');
  assert.equal(disabledRun.result.status, 23, 'disabled sync harness must reach docker build sentinel');
  assert.doesNotMatch(disabledRun.log, /SYNC_ASSETS/, 'SYNC_PERSISTED_ASSETS=0 must skip persisted asset sync');
  assert.match(disabledRun.log, /DOCKER build/, 'SYNC_PERSISTED_ASSETS=0 must continue to build after skipping sync');

  const invalidSyncRun = runCloudAppDeployHarness('NAMESPACE=dongyu\nSYNC_PERSISTED_ASSETS=bad\n');
  assert.equal(invalidSyncRun.result.status, 1, 'invalid SYNC_PERSISTED_ASSETS must fail before deploy work');
  assert.match(invalidSyncRun.result.stderr, /SYNC_PERSISTED_ASSETS must be 0 or 1/, 'invalid SYNC_PERSISTED_ASSETS must report a clear error');
  assert.doesNotMatch(invalidSyncRun.log, /REMOTE_PREFLIGHT|SYNC_ASSETS|DOCKER/, 'invalid SYNC_PERSISTED_ASSETS must stop before preflight, sync, or build');

  const invalidCaRun = runCloudAppDeployHarness('NAMESPACE=dongyu\nINSTALL_SYSTEM_CA=bad\n');
  assert.equal(invalidCaRun.result.status, 1, 'invalid INSTALL_SYSTEM_CA loaded from cloud.env must fail before deploy work');
  assert.match(invalidCaRun.result.stderr, /INSTALL_SYSTEM_CA must be 0 or 1/, 'invalid INSTALL_SYSTEM_CA must report a clear error');
  assert.doesNotMatch(invalidCaRun.log, /REMOTE_PREFLIGHT|SYNC_ASSETS|DOCKER/, 'invalid INSTALL_SYSTEM_CA must stop before preflight, sync, or build');
}

const tests = [
  test_cloud_manifests_mount_persisted_asset_root_for_all_roles,
  test_cloud_full_deploy_syncs_assets_and_rolls_out_ui_side_worker,
  test_cloud_app_deploy_supports_ui_side_worker_target,
  test_cloud_app_deploy_syncs_authoritative_assets_before_rollout,
  test_cloud_app_deploy_asset_sync_flag_behavior,
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
