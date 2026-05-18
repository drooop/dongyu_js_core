---
title: "0379 - Explicit Management Route Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0379-explicit-management-route
id: 0379-explicit-management-route
phase: completed
---

# Iteration 0379-explicit-management-route Resolution

## Execution Strategy

Implement the smallest route-kind extension across the existing slide-app import path. Keep endpoint topic semantics unchanged and only change how UI Server chooses the host-owned system bus output.

The implementation must preserve the current control default, add explicit management behavior, and prove the full path with deterministic tests plus one real browser run.

## Step 1 — Contract and Planning Gate

- Scope:
  - Register iteration 0379.
  - Freeze plan and implementation steps.
  - Record user approval.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0379-explicit-management-route/plan.md`
  - `docs/iterations/0379-explicit-management-route/resolution.md`
  - `docs/iterations/0379-explicit-management-route/runlog.md`
- Verification:
  - Manual review of the plan against `docs/plans/current-stage-todo.md`.
  - `git diff --check`.
- Acceptance:
  - Iteration is registered.
  - Plan and resolution explain control default and explicit management route.
  - Review gate is approved.
- Rollback:
  - Remove the 0379 docs directory and index row.

## Step 2 — Runtime and Import Implementation

- Scope:
  - Extend `remote_bus_endpoint_v1` normalization to accept optional `route_kind`.
  - Preserve `route_kind` in slide-app export/import.
  - Generate imported host egress as `pin.bus.cb.out` for control and `pin.bus.mb.out` for management.
  - Generate matching `bus` and `route_kind` records in `bus_send.v1`.
  - Add a management-routed test slide app record if needed for deterministic and browser verification.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/test_model_100_ui.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/workspace_manager_asset_manager_ui.json`
  - relevant test fixture or system-model files if needed
- Verification:
  - `node --check packages/ui-model-demo-server/server.mjs`
  - targeted import/export checks
- Acceptance:
  - Missing route kind remains control.
  - Invalid route kind is rejected.
  - Explicit management route generates management bus output.
- Rollback:
  - Revert implementation changes and any management-routed test app records.

## Step 3 — Deterministic Tests

- Scope:
  - Add or update tests for route-kind parsing, export/import preservation, host egress type, generated payload records, and MBR management-to-control routing.
  - Keep existing 0376/0378 tests passing.
- Files:
  - `scripts/tests/test_0379_explicit_management_route_contract.mjs`
  - existing related tests if assertions need alignment
- Verification:
  - `node scripts/tests/test_0379_explicit_management_route_contract.mjs`
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
  - `node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
  - `node scripts/validate_model100_records_e2e_v0.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
- Acceptance:
  - All tests pass.
  - Tests prove the management route does not fall back to direct control bus.
- Rollback:
  - Remove new tests and revert implementation changes.

## Step 4 — Local Deployment and Browser Verification

- Scope:
  - Rebuild and deploy local UI Server with the 0379 changes.
  - Verify local cluster baseline.
  - Use Playwright against `http://127.0.0.1:30900/#/workspace`.
  - Install a management-routed slide app and click its submit/generate action.
- Files:
  - deployment assets only if needed
  - `docs/iterations/0379-explicit-management-route/runlog.md`
- Verification:
  - `bash scripts/ops/sync_local_persisted_assets.sh`
  - local image build and UI Server rollout
  - `bash scripts/ops/check_runtime_baseline.sh`
  - Playwright snapshot and click flow
  - runtime snapshot proving the submitted text materialized through `reply_target_model_id`
- Acceptance:
  - UI Server, MBR, Remote Worker, Workspace Manager are ready.
  - Browser flow updates the installed management-routed app through a Remote Worker round trip.
  - Evidence shows `route_kind = management` and `pin.bus.mb.out` on the UI Server side.
- Rollback:
  - Redeploy previous local image or revert branch changes.

## Step 5 — Review and Close

- Scope:
  - Run sub-agent code review using `codex-code-review`.
  - Fix any findings.
  - Update runlog and iteration status.
- Files:
  - `docs/iterations/0379-explicit-management-route/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - sub-agent review result
  - final `git diff --check`
- Acceptance:
  - Review decision is approved.
  - `docs/ITERATIONS.md` marks 0379 as Completed.
- Rollback:
  - Reopen status to In Progress if a blocking finding appears.
