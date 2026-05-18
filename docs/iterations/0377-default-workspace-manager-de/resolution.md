---
title: "0377 - Default Workspace Manager DE Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0377-default-workspace-manager-de
id: 0377-default-workspace-manager-de
phase: completed
---

# Iteration 0377-default-workspace-manager-de Resolution

## Execution Strategy

Execute in small gated stages. Each stage makes one bounded change, runs deterministic checks, then requests `codex-code-review` from a sub-agent. If the review returns `CHANGE_REQUESTED`, fix the findings and re-run review before continuing. The final stage repeats review over the whole iteration.

Use fill-table-first implementation. Runtime/service code changes are allowed only if a deterministic test proves that the current interpreter cannot express the required current-spec behavior through ModelTable declarations.

## Step 1 — Governance and Architecture Contract

- Scope:
  - Register 0377 in `docs/ITERATIONS.md`.
  - Update iteration plan/resolution/runlog.
  - Update current docs that describe default system roles so they distinguish UI-Server host responsibilities from DE/DEM service ownership.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0377-default-workspace-manager-de/plan.md`
  - `docs/iterations/0377-default-workspace-manager-de/resolution.md`
  - `docs/iterations/0377-default-workspace-manager-de/runlog.md`
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md`
- Verification:
  - `rg -n "Workspace-Manager-DE|PICS-DE|UI-Server.*truth|pin.connect.model|is_DEM|v1n_id" docs/architecture_mantanet_and_workers.md docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md docs/iterations/0377-default-workspace-manager-de`
  - `node scripts/tests/test_0377_workspace_manager_de_contract.mjs --docs-only` after the validation script exists in Step 2; before that script exists, Step 1 must record a manual PASS/FAIL interpretation that every legacy term hit is in a forbidden/historical context rather than a current input example.
  - Sub-agent review: governance/docs contract slice.
- Acceptance:
  - Current docs say Workspace Manager and PICS are default DEs.
  - Docs do not describe them as UI-Server built-in business pages.
  - Review is `APPROVED`.
- Rollback:
  - Revert only the 0377 docs/index edits.

## Step 2 — Workspace Manager DEM Fill-Table Assets

- Scope:
  - Add `deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json`.
  - Add a minimal DEM service model patch if the action cannot live entirely in Model 0.
  - Register the patch in local persisted asset sync if needed.
- Files:
  - `deploy/sys-v1ns/workspace-manager/patches/*.json`
  - `scripts/ops/sync_local_persisted_assets.sh`
  - New or updated validation script under `scripts/tests/`.
- Verification:
  - `node scripts/tests/test_0377_workspace_manager_de_contract.mjs`
  - `! rg -n "pin.connect.model|\\(self,|\\(func,|pin\\.log\\.|is_DEM|v1n_id|\"k\": \"worker.role\"" deploy/sys-v1ns/workspace-manager`
  - Sub-agent review: fill-table asset slice.
- Acceptance:
  - Patch loads into `ModelTableRuntime` with `trustedBootstrap`.
  - Model 0 has `sys_worker_id`, `sys_worker_role=DEM`, and legal bus pins.
  - No legacy labels or compatibility forms are present.
- Rollback:
  - Remove the new workspace-manager role patch and the associated sync/test entries.

## Step 3 — Workspace Manager Slide App Contract

- Scope:
  - Add a minimal Workspace Manager positive slide app model that can be installed/mounted by UI-Server.
  - It should show a first asset tree projection with Workspace, Workspace-Manager-DE, its DEM, MBR, UI-Server, and R1.
  - It should expose a current-spec action pin for one DEM-backed query/refresh action.
- Files:
  - `packages/worker-base/system-models/workspace_positive_models.json` or a new role-specific positive patch if cleaner.
  - `test_files/` if a reusable import payload is needed.
  - `scripts/tests/test_0377_workspace_manager_de_contract.mjs`
- Verification:
  - `node scripts/tests/test_0377_workspace_manager_de_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - Sub-agent review: slide app model slice.
- Acceptance:
  - Workspace Manager appears as a slide app candidate in the Workspace catalog.
  - The app model uses cellwise UI labels, not one large HTML/blob string.
  - The app has no direct bus pin declarations.
- Rollback:
  - Remove the new positive model records and test expectations.

## Step 4 — Local Deployment and Real Browser Verification

- Scope:
  - Refresh local persisted assets/deployment.
  - Verify existing R1 examples still work.
  - Verify Workspace Manager app open/action path in a real browser.
- Files:
  - `docs/iterations/0377-default-workspace-manager-de/runlog.md`
  - optional browser evidence under `docs/iterations/0377-default-workspace-manager-de/assets/`.
- Verification:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - deploy/restart command chosen from current local runbook.
  - Playwright browser flow against `http://127.0.0.1:30900/#/workspace`.
  - Sub-agent review: local verification evidence.
- Acceptance:
  - Local service is actually redeployed or restarted after the model changes.
  - Browser can open Workspace Manager and observe a DEM-backed visible result.
  - Existing color/minimal submit smoke paths still pass or any unrelated failure is recorded with evidence.
- Rollback:
  - Re-run deployment from previous committed branch or remove the new workspace-manager role patch and positive model records, then redeploy.

## Step 5 — Final Review and Completion

- Scope:
  - Run the full targeted test set.
  - Review final diff with a sub-agent.
  - Update runlog and iteration index status.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0377-default-workspace-manager-de/runlog.md`
- Verification:
  - Targeted tests from Steps 2-4.
  - `git diff --check`
  - Final sub-agent review over the full 0377 diff.
- Acceptance:
  - All required reviews are recorded and approved.
  - All success criteria in plan are satisfied.
  - Worktree status is understood and no unrelated user changes are reverted.
- Rollback:
  - Revert 0377 commits or remove 0377-specific records/assets and rerun targeted verification.

## Notes

- Generated at: 2026-05-18
- The user explicitly approved execution after this planning step. The runlog records this as the Phase 2 gate.
