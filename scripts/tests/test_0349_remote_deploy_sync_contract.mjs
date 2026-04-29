#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function assertContains(text, needle, file) {
  assert.ok(text.includes(needle), `${file} missing: ${needle}`);
}

function assertNotContains(text, needle, file) {
  assert.ok(!text.includes(needle), `${file} must not contain: ${needle}`);
}

const dockerignoreFile = '.dockerignore';
const dockerignore = read(dockerignoreFile);
for (const needle of [
  '.git',
  '**/node_modules',
  'docs',
  'docs-shared',
  'archive',
  'test_files',
  'output',
  'scripts/tests',
  'scripts/fixtures',
  'scripts/orchestrator',
]) {
  assertContains(dockerignore, needle, dockerignoreFile);
}
assertNotContains(dockerignore, '**/dist', dockerignoreFile);
assertNotContains(dockerignore, 'packages/ui-model-demo-frontend/dist', dockerignoreFile);
for (const forbidden of [
  '\npackages\n',
  '\nscripts\n',
  '\nk8s\n',
  '\ndeploy\n',
]) {
  assertNotContains(`\n${dockerignore}\n`, forbidden, dockerignoreFile);
}

const syncFile = 'scripts/ops/sync_cloud_source.sh';
const sync = read(syncFile);
for (const needle of [
  'RESOLVED_REVISION=',
  'DEPLOY_ARCHIVE_PATHS=',
  '".dockerignore"',
  '"packages"',
  '"scripts/ops"',
  '"scripts/run_worker_v0.mjs"',
  '"scripts/run_worker_remote_v1.mjs"',
  '"scripts/run_worker_ui_side_v0.mjs"',
  '"scripts/worker_engine_v0.mjs"',
  '"deploy/sys-v1ns"',
  '"deploy/env/cloud.env.example"',
  '"k8s"',
  'archive "$REVISION" -- "${DEPLOY_ARCHIVE_PATHS[@]}"',
  '.sync-work',
  'mktemp -d \\"\\$sync_work/archive.XXXXXX\\"',
  '.deploy-source-revision',
]) {
  assertContains(sync, needle, syncFile);
}
assertNotContains(sync, 'archive "$REVISION" |', syncFile);
assertNotContains(sync, 'mktemp -d)"', syncFile);
assertNotContains(sync, "printf '%s\\n' '$REVISION' > '$REMOTE_REPO/.deploy-source-revision'", syncFile);

const appDeployFile = 'scripts/ops/deploy_cloud_app.sh';
const appDeploy = read(appDeployFile);
assertContains(appDeploy, '.deploy-source-revision', appDeployFile);
assertContains(appDeploy, 'current repo revision $SOURCE_REV does not match expected $EXPECTED_REVISION', appDeployFile);
assertContains(appDeploy, '--install-system-ca', appDeployFile);
assertContains(appDeploy, '--build-arg INSTALL_SYSTEM_CA=1', appDeployFile);
assertNotContains(appDeploy, 'printf \'%s\' "$EXPECTED_REVISION"', appDeployFile);
assert.ok(
  appDeploy.indexOf('.deploy-source-revision') < appDeploy.indexOf('DEPLOY_SOURCE_REV'),
  `${appDeployFile} must prefer sync stamp before DEPLOY_SOURCE_REV`,
);

const fullDeployFile = 'scripts/ops/deploy_cloud_full.sh';
const fullDeploy = read(fullDeployFile);
assertContains(fullDeploy, '--revision', fullDeployFile);
assertContains(fullDeploy, 'EXPECTED_REVISION=', fullDeployFile);
assertContains(fullDeploy, '--install-system-ca', fullDeployFile);
assertContains(fullDeploy, 'BUN_BUILD_ARGS', fullDeployFile);
assertContains(fullDeploy, '--build-arg INSTALL_SYSTEM_CA=1', fullDeployFile);
assertContains(fullDeploy, 'current repo revision $SOURCE_REV does not match expected $EXPECTED_REVISION', fullDeployFile);
assertContains(fullDeploy, '.deploy-source-revision', fullDeployFile);
assert.ok(
  fullDeploy.indexOf('.deploy-source-revision') < fullDeploy.indexOf('rev-parse --short HEAD'),
  `${fullDeployFile} must prefer sync stamp before git HEAD`,
);
assert.ok(
  fullDeploy.indexOf('.deploy-source-revision') < fullDeploy.indexOf('DEPLOY_SOURCE_REV'),
  `${fullDeployFile} must prefer sync stamp before DEPLOY_SOURCE_REV`,
);

const readmeFile = 'scripts/ops/README.md';
const readme = read(readmeFile);
assertContains(readme, '.deploy-source-revision', readmeFile);
assertContains(readme, '.dockerignore', readmeFile);
assertContains(readme, 'archive fallback', readmeFile);
assertContains(readme, 'deploy_cloud_full.sh --revision', readmeFile);
assertContains(readme, '--install-system-ca', readmeFile);

for (const dockerfile of [
  'k8s/Dockerfile.ui-server',
  'k8s/Dockerfile.ui-server-prebuilt',
  'k8s/Dockerfile.remote-worker',
]) {
  const source = read(dockerfile);
  assertContains(source, 'ARG INSTALL_SYSTEM_CA=0', dockerfile);
  assertContains(source, 'Skipping apt ca-certificates install', dockerfile);
  assertNotContains(source, '\nRUN apt-get update', dockerfile);
}

console.log('PASS test_0349_remote_deploy_sync_contract');
