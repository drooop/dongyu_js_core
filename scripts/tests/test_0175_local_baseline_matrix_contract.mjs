#!/usr/bin/env node

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return readFileSync(resolve(repoRoot, relPath), 'utf8');
}

const checkBaseline = read('scripts/ops/check_runtime_baseline.sh');
const ensureBaseline = read('scripts/ops/ensure_runtime_baseline.sh');
const runRoundtrip = read('scripts/ops/run_model100_submit_roundtrip_local.sh');
const deployCommon = read('scripts/ops/_deploy_common.sh');
const deployLocal = read('scripts/ops/deploy_local.sh');

assert.match(
  runRoundtrip,
  /ensure_runtime_baseline\.sh/,
  'run_model100_submit_roundtrip_local.sh must use ensure_runtime_baseline.sh so one-click local verification can auto-heal stale baseline state',
);

assert.match(
  checkBaseline,
  /MODELTABLE_PATCH_JSON/,
  'check_runtime_baseline.sh must validate bootstrap patch readiness, not only deployment replicas',
);

assert.match(
  checkBaseline,
  /matrix_room_id/,
  'check_runtime_baseline.sh must inspect matrix_room_id inside the bootstrap patch',
);

assert.match(
  checkBaseline,
  /placeholder-will-update-after-synapse-setup/,
  'check_runtime_baseline.sh must reject placeholder token values inside the bootstrap patch as baseline-not-ready',
);

assert.match(
  ensureBaseline,
  /check_runtime_baseline\.sh/,
  'ensure_runtime_baseline.sh must delegate readiness judgment to check_runtime_baseline.sh so stale Matrix secrets trigger auto-repair',
);

assert.match(
  deployCommon,
  /mbr_worker_bootstrap_v0/,
  '_deploy_common.sh must generate the mbr bootstrap patch into MODELTABLE_PATCH_JSON',
);

assert.match(
  deployLocal,
  /update_k8s_secrets "\$SERVER_TOKEN" "\$MBR_TOKEN" "\$ROOM_ID"/,
  'deploy_local.sh must pass ROOM_ID into update_k8s_secrets so generated bootstrap patch includes the actual Matrix room id',
);

console.log('PASS test_0175_local_baseline_matrix_contract');
