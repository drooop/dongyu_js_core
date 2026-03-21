#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return readFileSync(resolve(repoRoot, relPath), 'utf8');
}

const runWorker = read('scripts/run_worker_v0.mjs');
const startLocalUi = read('scripts/ops/start_local_ui_server_k8s_matrix.sh');
const localWorkers = read('k8s/local/workers.yaml');
const cloudWorkers = read('k8s/cloud/workers.yaml');

assert.match(
  runWorker,
  /MODELTABLE_PATCH_JSON/,
  'run_worker_v0.mjs must support MODELTABLE_PATCH_JSON bootstrap so runtime config is initialized via patch, not ad-hoc env reads',
);

assert.doesNotMatch(
  runWorker,
  /labelOrEnv\(rt,\s*'mbr_matrix_room_id'/,
  'run_worker_v0.mjs must not keep reading matrix room id from legacy env-or-system-label path',
);

assert.doesNotMatch(
  runWorker,
  /labelOrEnv\(rt,\s*'mbr_mqtt_host'/,
  'run_worker_v0.mjs must not keep reading mqtt host from legacy env-or-system-label path',
);

assert.match(
  startLocalUi,
  /MODELTABLE_PATCH_JSON=/,
  'start_local_ui_server_k8s_matrix.sh must inject MODELTABLE_PATCH_JSON for local bootstrap',
);

assert.match(
  startLocalUi,
  /\.data\.MODELTABLE_PATCH_JSON/,
  'start_local_ui_server_k8s_matrix.sh must read MODELTABLE_PATCH_JSON from ui-server-secret instead of legacy Matrix secret keys',
);

for (const forbidden of [
  'DY_MATRIX_ROOM_ID=',
  'DY_MATRIX_DM_PEER_USER_ID=',
  'MATRIX_HOMESERVER_URL=',
  'MATRIX_MBR_BOT_USER=',
  'MATRIX_MBR_USER=',
  'MATRIX_MBR_PASSWORD=',
  'MATRIX_MBR_ACCESS_TOKEN=',
]) {
  assert.ok(
    !startLocalUi.includes(forbidden),
    `start_local_ui_server_k8s_matrix.sh must not inject ${forbidden} directly once patch bootstrap is canonical`,
  );
}

for (const forbiddenRead of [
  '.data.DY_MATRIX_ROOM_ID',
  '.data.MATRIX_HOMESERVER_URL',
  '.data.MATRIX_MBR_BOT_USER',
  '.data.MATRIX_MBR_PASSWORD',
  '.data.MATRIX_MBR_ACCESS_TOKEN',
  '.name==\\"MATRIX_MBR_USER\\"',
]) {
  assert.ok(
    !startLocalUi.includes(forbiddenRead),
    `start_local_ui_server_k8s_matrix.sh must not keep reading legacy bootstrap source ${forbiddenRead}`,
  );
}

for (const [name, content] of [
  ['k8s/local/workers.yaml', localWorkers],
  ['k8s/cloud/workers.yaml', cloudWorkers],
]) {
  assert.match(
    content,
    /- name: MODELTABLE_PATCH_JSON/,
    `${name} must inject MODELTABLE_PATCH_JSON into ui-server instead of direct Matrix env vars`,
  );

  for (const forbidden of [
    '- name: MATRIX_HOMESERVER_URL',
    '- name: MATRIX_MBR_USER',
    '- name: MATRIX_MBR_BOT_USER',
    '- name: MATRIX_MBR_ACCESS_TOKEN',
    '- name: MATRIX_MBR_PASSWORD',
    '- name: DY_MATRIX_ROOM_ID',
    '- name: DY_MATRIX_DM_PEER_USER_ID',
  ]) {
    assert.ok(
      !content.includes(forbidden),
      `${name} must drop direct ui-server env injection for ${forbidden}`,
    );
  }
}

console.log('PASS test_0175_matrix_patch_bootstrap_contract');
