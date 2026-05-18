---
title: "0378 - Workspace Asset Manager Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0378-workspace-asset-manager
id: 0378-workspace-asset-manager
phase: completed
---

# Iteration 0378-workspace-asset-manager Resolution

## Execution Strategy

Execute in small gated stages. Each stage changes one slice, runs deterministic checks, then requests `codex-code-review` from a sub-agent. Continue only after review is `APPROVED`.

The implementation uses the current simplified shape: Workspace Manager is a DE with one DEM worker. Asset catalog data is fixed ModelTable `Data.Array.One`-style data for this iteration, but its format should look like a future worker asset-reporting record so it can later be produced by other workers through a topic.

## Step 1 — Planning and Contract Freeze

- Scope:
  - Register 0378 in `docs/ITERATIONS.md`.
  - Freeze the asset catalog and interaction contract in plan/resolution/runlog.
  - Confirm local cluster currently has `workspace-manager` deployed.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0378-workspace-asset-manager/plan.md`
  - `docs/iterations/0378-workspace-asset-manager/resolution.md`
  - `docs/iterations/0378-workspace-asset-manager/runlog.md`
- Verification:
  - `kubectl -n dongyu get deploy workspace-manager`
  - Sub-agent review: planning/contract slice.
- Acceptance:
  - Plan clearly states interactive list, detail Dialog, install action, fixed `Data.Array.One`-style test catalog, and simplified DEM-only deployment shape.
  - Review is `APPROVED`.
- Rollback:
  - Remove 0378 docs/index row only.

## Step 2 — Asset Catalog Data and Workspace Manager UI

- Scope:
  - Add Workspace Manager asset catalog records:
    - ordinary worker/DEM assets for `Workspace Manager DEM`, `MBR`, `UI-Server`, and `RemoteWorker R1`;
    - slide-app assets for `E2E 颜色生成器` and `最小 Submit 双总线示例`.
  - Render the catalog as an interactive Cellwise list/table.
  - Add selection state, basic info panel, and detail Dialog state.
- Files:
  - `deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json`
  - `packages/worker-base/system-models/workspace_manager_asset_manager_ui.json`
  - `packages/worker-base/system-models/workspace_positive_models.json` if a direct overlay is simpler
  - `scripts/ops/sync_local_persisted_assets.sh`
  - `scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
- Verification:
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - legacy-form grep over Workspace Manager assets/UI.
  - Sub-agent review: asset data/UI slice.
- Acceptance:
  - Asset data is ModelTable data, not frontend hardcode.
  - UI has clickable rows/buttons and a detail Dialog.
  - RemoteWorker R1 exposes two slide-app assets in the UI.
- Rollback:
  - Remove the new UI overlay/system-positive entry and DEM catalog additions.

## Step 3 — Local Slide-App Install Action

- Scope:
  - Add a UI Server host action for installing an asset whose catalog entry points to a local source slide-app model.
  - Reuse the existing slide-app export/import materialization logic: source model -> ModelTable JSON payload -> local materialized app with new model id and workspace mount.
  - Update status labels after install so the UI shows the result.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/workspace_manager_asset_manager_ui.json`
  - `scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
- Verification:
  - Deterministic install test creates a new model from source model `100` or `1050`.
  - Installed app appears in derived workspace catalog rows.
  - Sub-agent review: install action slice.
- Acceptance:
  - Install button does not fake success; a new model id is allocated.
  - The new app can be opened from Workspace.
- Rollback:
  - Remove the action handler and related UI labels.

## Step 4 — Local Deployment and Browser E2E

- Scope:
  - Rebuild/sync/restart local services affected by the change.
  - Use a real browser to verify:
    - `工作区管理器` opens;
    - asset list is visible and interactive;
    - ordinary asset selection updates basic info;
    - detail Dialog opens;
    - slide-app install creates a new sidebar item;
    - installed slide app can open.
- Files:
  - `docs/iterations/0378-workspace-asset-manager/runlog.md`
  - optional screenshots under `output/playwright/`.
- Verification:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - Playwright against `http://127.0.0.1:30900/#/workspace`
  - Browser console check.
  - Sub-agent review: local/browser evidence slice.
- Acceptance:
  - Local cluster and browser evidence prove the path.
  - Review is `APPROVED`.
- Rollback:
  - Re-sync previous assets and restart local UI Server.

## Step 5 — Final Review and Completion

- Scope:
  - Run targeted tests and final code review.
  - Update `docs/ITERATIONS.md` status and runlog.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0378-workspace-asset-manager/runlog.md`
- Verification:
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
  - `node scripts/tests/test_0377_workspace_manager_de_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `git diff --check`
  - Final sub-agent review.
- Acceptance:
  - Final review is `APPROVED`.
  - Work is deployed locally and browser-tested.
- Rollback:
  - Revert 0378-specific files/records and redeploy.

## Notes

- Generated at: 2026-05-18
