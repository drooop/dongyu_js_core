---
title: "0380 - Remove UI Side Worker Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0380-remove-ui-side-worker
id: 0380-remove-ui-side-worker
phase: completed
---

# Iteration 0380-remove-ui-side-worker Resolution

## Execution Strategy

- Treat `ui-side-worker` as a historical test worker and remove it from active runtime assembly.
- Delete its deployable assets first, then remove scripts/tests/docs that make it a required deployment.
- Keep historical iteration logs intact as archived evidence.

## Step 1 — Remove Active Runtime Assets

- Scope:
- Delete the `ui-side-worker` runner, Dockerfile, local/cloud manifests, and role patches.
- Remove it from deploy scripts, baseline checks, and persisted asset sync.
- Files:
- `scripts/run_worker_ui_side_v0.mjs`
- `k8s/Dockerfile.ui-side-worker`
- `k8s/local/ui-side-worker.yaml`
- `k8s/cloud/ui-side-worker.yaml`
- `deploy/sys-v1ns/ui-side-worker/**`
- `scripts/ops/*.sh`
- Verification:
- `rg -n "ui-side-worker|ui_side_worker|DY_UI_WORKER" scripts/ops k8s deploy/sys-v1ns`
- Acceptance:
- No active deploy path references `ui-side-worker`.
- Rollback:
- Restore deleted assets and script entries from git.

## Step 2 — Remove Active Contracts and Verify

- Scope:
- Update tests that previously required `ui-side-worker`.
- Add 0380 guard that fails if active runtime paths reintroduce it.
- Remove active docs dependency references while preserving historical records.
- Files:
- `scripts/tests/*`
- `docs/ITERATIONS.md`
- `docs/iterations/0380-remove-ui-side-worker/runlog.md`
- active docs under `docs/` when they describe current deployment targets
- Verification:
- targeted node tests
- `bash scripts/ops/check_runtime_baseline.sh`
- `kubectl -n dongyu get deploy,svc | rg ui-side-worker` returns no rows after cleanup
- `git diff --check`
- Acceptance:
- Local baseline and contract tests pass with no `ui-side-worker`.
- Active docs/scripts do not require `ui-side-worker`.
- Rollback:
- Re-add deployment assets and restore tests/scripts.

## Notes

- Completed at: 2026-05-19
- Local cluster cleanup removed the old `ui-side-worker` deployment, service, and configmap.
- Active docs/scripts/tests no longer depend on `ui-side-worker`; historical iteration records remain unchanged.
- Generated at: 2026-05-19
