---
id: 0368
title: worker-role-mbr-refill-submit-docs
doc_type: iteration_resolution
status: Approved
updated: 2026-05-11
source: ai
branch: dev_0368-worker-role-mbr-refill-submit-docs
iteration_id: 0368-worker-role-mbr-refill-submit-docs
phase: phase1
---

# Iteration 0368 Worker Role, MBR Refill, And Minimal Submit Docs Resolution

## Execution Strategy

Execute in small review-gated stages. Each stage must add or update deterministic checks before or alongside production changes, record evidence in `runlog.md`, and pass a bounded `codex-code-review` sub-agent review before the next stage starts.

## Step 1 - Planning And Gate

- Scope: Fill plan, resolution, runlog, and register 0368 in the iteration index.
- Files: `docs/iterations/0368-worker-role-mbr-refill-submit-docs/*`, `docs/ITERATIONS.md`.
- Verification: `git diff --check`; bounded plan review.
- Acceptance: Plan covers worker role, initialization ordering, MBR dual paths, remote-worker refill, minimal Submit docs, local deploy, browser verification, and no-compat constraints.
- Rollback: Remove 0368 scaffold and index row before implementation.

## Step 2 - Worker Role And Startup Contract

- Scope: Replace active `is_DEM` role truth with `worker.role`, preserve `v1n_id` lock wording, and update startup order wording in SSOT/user guides.
- Files: `docs/ssot/runtime_semantics_modeltable_driven.md`, `docs/user-guide/modeltable_user_guide.md`, `docs/architecture_mantanet_and_workers.md`, `docs/ssot/label_type_registry.md`, runtime/server role tests.
- Verification: New/updated tests fail before implementation and pass after implementation; static scan rejects active `is_DEM`.
- Acceptance: Role semantics are expressed only as `worker.role = "dem" | "worker"` in active implementation and current docs.
- Rollback: Revert docs/tests/runtime/server changes for this step.

## Step 3 - Runtime And UI Server Role Enforcement

- Scope: Change runtime and server/demo bootstrap to read/write `worker.role`; reject illegal management bus pins for non-DEM workers without fallback.
- Files: `packages/worker-base/src/runtime.mjs`, `packages/worker-base/src/runtime.js`, `packages/ui-model-demo-server/server.mjs`, `packages/ui-model-demo-frontend/src/*`, affected tests.
- Verification: Runtime split-bus tests, builtins validation, and server import/ingress tests.
- Acceptance: No active role path depends on `is_DEM`; `pin.bus.mb.*` remains DEM-only.
- Rollback: Revert runtime/server/frontend/test changes for this step.

## Step 4 - MBR And Remote-Worker Refill

- Scope: Refill `deploy/sys-v1ns/mbr`, `deploy/sys-v1ns/remote-worker`, synced local persisted assets if needed, and tests for MBR management-to-control plus management-to-management routes.
- Files: `deploy/sys-v1ns/mbr/**`, `deploy/sys-v1ns/remote-worker/**`, `scripts/worker_engine_v0.mjs`, `packages/ui-model-demo-server/server.mjs` worker bridge surfaces if needed, `scripts/tests/*`.
- Verification: MBR patch validator, route contract tests, static no-legacy scan.
- Acceptance: MBR uses Tier 2 ModelTable paths for both required functions; remote-worker uses control-bus-only role and does not publish provider replies directly.
- Rollback: Revert deploy/runtime bridge/test changes for this step.

## Step 5 - Minimal Submit JSON Patch And HTML Explanation

- Scope: Update saved JSON patch/ZIP and HTML docs so each label group is explained, especially event binding and button-to-program-to-bus flow.
- Files: `test_files/minimal_submit_dual_bus_app_payload.json`, `test_files/minimal_submit_dual_bus.zip`, `docs/user-guide/slide-app-runtime/**`, `scripts/ops/sync_ui_public_docs.sh`, docs contract tests.
- Verification: Docs contract tests, ZIP contract tests, no forbidden labels in examples.
- Acceptance: The HTML document describes the exact current patch labels and no longer teaches direct transport shortcuts.
- Rollback: Revert docs/assets/tests for this step.

## Step 6 - Local Deploy And Real Browser E2E

- Scope: Rebuild and redeploy the affected local UI server, MBR, and remote-worker stack, then test in a real browser.
- Files: deployment assets only if verification exposes a missing synced file.
- Verification: Local baseline check, affected deterministic tests, frontend build, Playwright against `http://127.0.0.1:30900/#/workspace`.
- Acceptance: Browser verifies Workspace slide import/open, color generator button changes color, and minimal Submit sends through the dual-bus path and displays the returned text.
- Rollback: Restore previous local runtime assets or re-run the previous known-good deployment if verification fails after changes are reverted.

## Step 7 - Closure

- Scope: Final review, runlog completion, status update, commit, and merge readiness.
- Files: `docs/iterations/0368-worker-role-mbr-refill-submit-docs/runlog.md`, `docs/ITERATIONS.md`.
- Verification: Final `codex-code-review`, `git diff --check`, targeted deterministic checks.
- Acceptance: All stages have PASS evidence and review findings are closed.
- Rollback: Reopen iteration status and revert final status update before merge.
