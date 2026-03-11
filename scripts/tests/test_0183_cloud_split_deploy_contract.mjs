#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const fullPath = resolve(repoRoot, 'scripts/ops/deploy_cloud_full.sh');
const appPath = resolve(repoRoot, 'scripts/ops/deploy_cloud_app.sh');

assert.ok(existsSync(fullPath), '0183 contract requires scripts/ops/deploy_cloud_full.sh');
assert.ok(existsSync(appPath), '0183 contract requires scripts/ops/deploy_cloud_app.sh');

const fullText = read('scripts/ops/deploy_cloud_full.sh');
assert.match(fullText, /register_synapse_users/, 'full deploy must retain synapse bootstrap ownership');
assert.match(fullText, /update_k8s_secrets/, 'full deploy must own secret/bootstrap refresh');
assert.match(fullText, /patch_manifest/, 'full deploy must apply canonical manifests');

const appText = read('scripts/ops/deploy_cloud_app.sh');
assert.match(appText, /--target/, 'app deploy must require --target');
assert.match(appText, /ui-server|mbr-worker|remote-worker/, 'app deploy must restrict target set');
assert.doesNotMatch(appText, /register_synapse_users/, 'app deploy must not bootstrap synapse');
assert.doesNotMatch(appText, /update_k8s_secrets/, 'app deploy must not recreate secrets');
assert.doesNotMatch(appText, /create_matrix_room_and_join/, 'app deploy must not recreate matrix room');

const wrapperText = read('scripts/ops/deploy_cloud.sh');
assert.match(
  wrapperText,
  /deploy_cloud_full\.sh/,
  'deploy_cloud.sh must become a wrapper that delegates to deploy_cloud_full.sh',
);

console.log('PASS test_0183_cloud_split_deploy_contract');
