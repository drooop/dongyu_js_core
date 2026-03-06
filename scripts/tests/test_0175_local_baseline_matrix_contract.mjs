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
  /mbr-worker-secret/,
  'check_runtime_baseline.sh must validate mbr-worker-secret readiness, not only deployment replicas',
);

assert.match(
  checkBaseline,
  /MATRIX_MBR_BOT_ACCESS_TOKEN/,
  'check_runtime_baseline.sh must inspect MATRIX_MBR_BOT_ACCESS_TOKEN for the local mbr-worker path',
);

assert.match(
  checkBaseline,
  /placeholder-will-update-after-synapse-setup/,
  'check_runtime_baseline.sh must reject placeholder Matrix token values as baseline-not-ready',
);

assert.match(
  ensureBaseline,
  /check_runtime_baseline\.sh/,
  'ensure_runtime_baseline.sh must delegate readiness judgment to check_runtime_baseline.sh so stale Matrix secrets trigger auto-repair',
);

assert.match(
  deployCommon,
  /placeholder-will-update-after-synapse-setup/,
  '_deploy_common.sh must patch the mbr-worker placeholder token when applying local workers.yaml',
);

assert.match(
  deployLocal,
  /patch_manifest "\$REPO_DIR\/k8s\/local\/workers\.yaml" "\$ROOM_ID" "\$SERVER_PASSWORD" "\$MBR_TOKEN"/,
  'deploy_local.sh must pass MBR_TOKEN into patch_manifest so manifest apply does not overwrite mbr-worker-secret back to placeholder',
);

console.log('PASS test_0175_local_baseline_matrix_contract');
