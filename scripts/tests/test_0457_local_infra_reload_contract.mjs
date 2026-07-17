#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const deployLocal = readFileSync(resolve(repoRoot, 'scripts/ops/deploy_local.sh'), 'utf8');

function test_local_infrastructure_restarts_after_apply_before_status() {
  const commands = {
    mosquittoApply: 'kubectl apply -f "$REPO_DIR/k8s/local/mosquitto.yaml"',
    synapseApply: 'kubectl apply -f "$REPO_DIR/k8s/local/synapse.yaml"',
    synapseRestart: 'kubectl -n "$NAMESPACE" rollout restart deployment/synapse',
    mosquittoRestart: 'kubectl -n "$NAMESPACE" rollout restart deployment/mosquitto',
    synapseStatus: 'kubectl -n "$NAMESPACE" rollout status deployment/synapse --timeout=180s',
    mosquittoStatus: 'kubectl -n "$NAMESPACE" rollout status deployment/mosquitto --timeout=60s',
  };
  const indexes = Object.fromEntries(
    Object.entries(commands).map(([name, command]) => [name, deployLocal.indexOf(command)]),
  );
  const missing = Object.entries(indexes)
    .filter(([, index]) => index === -1)
    .map(([name]) => name);

  assert.deepEqual(
    missing,
    [],
    `deploy_local.sh must include every infrastructure reload command; missing: ${missing.join(', ')}`,
  );

  const lastApply = Math.max(indexes.mosquittoApply, indexes.synapseApply);
  const firstRestart = Math.min(indexes.synapseRestart, indexes.mosquittoRestart);
  const lastRestart = Math.max(indexes.synapseRestart, indexes.mosquittoRestart);
  const firstStatus = Math.min(indexes.synapseStatus, indexes.mosquittoStatus);

  assert.ok(
    lastApply < firstRestart,
    'deploy_local.sh must apply both local infrastructure manifests before restarting either deployment',
  );
  assert.ok(
    lastRestart < firstStatus,
    'deploy_local.sh must restart both local infrastructure deployments before checking either rollout status',
  );
}

const tests = [test_local_infrastructure_restarts_after_apply_before_status];
let failed = 0;

for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${test.name}`);
    console.error(error && error.message ? error.message : error);
  }
}

if (failed > 0) {
  console.error(`${failed} failed, ${tests.length - failed} passed out of ${tests.length}`);
  process.exit(1);
}

console.log(`${tests.length} passed, 0 failed out of ${tests.length}`);
