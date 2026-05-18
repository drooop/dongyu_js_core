---
title: "0380 - Remove UI Side Worker Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0380-remove-ui-side-worker
id: 0380-remove-ui-side-worker
phase: completed
---

# Iteration 0380-remove-ui-side-worker Runlog

## Environment

- Date: 2026-05-19
- Branch: `dropx/dev_0379-explicit-management-route`
- Runtime: local Kubernetes namespace `dongyu`

## Execution Records

### Step 1 — Discovery

- Command: inspect local deployments, manifests, runner, and 0198 docs.
- Key output: `ui-side-worker` is a historical test worker from 0198; it listens to Matrix `snapshot_delta`, exposes HTTP `9101`, and is not part of the current formal UI Server / MBR / Remote Worker / Workspace Manager role set.
- Result: PASS
- Commit: N/A

### Step 2 — Remove Active Runtime Assets

- Command: remove runner, Dockerfile, local/cloud manifests, role patches, deploy target entries, persisted-asset scope, and active user-guide runbook dependency.
- Key output: active runtime paths no longer contain `ui-side-worker`, `run_worker_ui_side`, `dy-ui-side-worker`, or `Dockerfile.ui-side-worker`.
- Result: PASS
- Commit: pending

### Step 3 — Verify and Cleanup Local Cluster

- Command:
- `node scripts/tests/test_0380_remove_ui_side_worker_contract.mjs`
- `node scripts/tests/test_0200_cloud_loader_chain_contract.mjs`
- `node scripts/tests/test_0200b_local_externalization_contract.mjs`
- `node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
- `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
- `node scripts/tests/test_0298_pin_cleanup_contract.mjs`
- `node scripts/tests/test_0328_worker_images_include_runtime_assets.mjs`
- `node scripts/tests/test_0349_remote_deploy_sync_contract.mjs`
- `node scripts/tests/test_0364_system_refill_contract.mjs`
- `kubectl -n dongyu delete deploy ui-side-worker --ignore-not-found`
- `kubectl -n dongyu delete svc ui-side-worker --ignore-not-found`
- `kubectl -n dongyu delete configmap ui-side-worker-config --ignore-not-found`
- `SKIP_IMAGE_BUILD=1 SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- `kubectl -n dongyu delete pod remote-worker-7f857c6447-4m78m --ignore-not-found`
- `bash scripts/ops/check_runtime_baseline.sh`
- `kubectl -n dongyu get deploy,svc,configmap | rg 'ui-side-worker' || true`
- `kubectl -n dongyu get pods`
- `rg -n "ui-side-worker|ui_side_worker|run_worker_ui_side|DY_UI_WORKER|dy-ui-side-worker|Dockerfile\\.ui-side-worker" scripts/ops k8s deploy/sys-v1ns docs/ssot docs/user-guide docs/architecture_mantanet_and_workers.md docs/plans/current-stage-todo.md packages viz-model-mounting-data.js viz-model-mounting.html`
- `git diff --check`
- Key output: local deploy path completes without recreating `ui-side-worker`; local baseline reports `mosquitto`, `synapse`, `remote-worker`, `workspace-manager`, `mbr-worker`, and `ui-server` ready; no `ui-side-worker` deployment/service/configmap/pod remains.
- Result: PASS
- Commit: pending

### Observed Existing Non-0380 Issue

- Command: `node scripts/tests/test_0263_model_mounting_profiles.mjs`
- Key output: FAIL because the current `ui-server` profile already has 5 unmounted models and 5 duplicate mounts.
- Result: not caused by 0380; tracked as existing model mounting cleanup work, not a `ui-side-worker` dependency.

## Docs Updated

- [x] active deploy docs reviewed for `ui-side-worker` dependency
- [x] active tests reviewed for `ui-side-worker` dependency
- [x] historical iteration logs intentionally left unchanged
