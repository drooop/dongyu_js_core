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
const deployCommon = read('scripts/ops/_deploy_common.sh');
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

assert.match(
  deployCommon,
  /--from-literal="MODELTABLE_PATCH_JSON=\$ui_patch"/,
  '_deploy_common.sh must persist the ui-server ModelTable bootstrap patch',
);

for (const requiredModel0Label of [
  /"k": "matrix_server", "t": "matrix\.server"/,
  /"k": "local_ip", "t": "mqtt\.local\.ip"/,
  /"k": "local_port", "t": "mqtt\.local\.port"/,
]) {
  assert.match(
    deployCommon,
    requiredModel0Label,
    '_deploy_common.sh must keep Matrix and MQTT runtime configuration in the Model 0 bootstrap patch',
  );
}

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
    `${name} must inject MODELTABLE_PATCH_JSON as the canonical Matrix/MQTT runtime bootstrap`,
  );

  // 0403 added this endpoint for the Matrix SSO allowlist/default. It is not a
  // replacement for the Model 0 transport labels or a source of credentials.
  assert.match(
    content,
    /- name: MATRIX_HOMESERVER_URL\s+value: null\s+valueFrom:\s+secretKeyRef:\s+name: ui-server-secret\s+key: MATRIX_HOMESERVER_URL/,
    `${name} may expose the 0403 Matrix SSO homeserver endpoint only through ui-server-secret`,
  );

  for (const forbidden of [
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
