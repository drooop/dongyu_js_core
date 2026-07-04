---
title: "Iteration 0436 Runtime Snapshot Build Latency Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-07-04
source: ai
iteration_id: 0436-runtime-snapshot-build-latency
id: 0436-runtime-snapshot-build-latency
phase: completed
---

# Iteration 0436-runtime-snapshot-build-latency Resolution

## Execution Strategy

Use TDD and keep the change narrow. First make the current cost observable and add a failing contract for direct visible snapshot construction. Then add a scoped builder that reads only the requested `{table_id, model_id}` model plus minimal sanitized config, without full graph serialization. Finally validate through local deployment and browser timing.

## Step 1

- Scope: Planning gate and baseline instrumentation design.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0436-runtime-snapshot-build-latency/plan.md`
  - `docs/iterations/0436-runtime-snapshot-build-latency/resolution.md`
  - `docs/iterations/0436-runtime-snapshot-build-latency/runlog.md`
- Verification:
  - Plan reviewed by sub-agent using `codex-code-review`.
- Acceptance:
  - Review decision is Approved.
  - Runlog contains review gate record and the 0435 baseline used for comparison.
- Rollback:
  - Revert the 0436 docs/iteration registry changes.

## Step 2

- Scope: Add failing-first direct-build contract and lock observable timing evidence.
- Files:
  - `scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
- Acceptance:
  - Initial test proves the ready explicit App-table visible path currently lacks a direct scoped builder and would not protect the route from full snapshot/client snapshot construction.
  - HTTP-level regression proves the ready `/snapshot?profile=visible&visible_model_ref=...` route itself uses the scoped path rather than only the helper.
  - Existing response timing plus browser metrics are sufficient to compare visible snapshot latency before and after this iteration; deeper per-substage timing remains a later optimization if needed.
- Rollback:
  - Remove the new test and any timing-only export if the scoped builder design changes.

## Step 3

- Scope: Implement scoped visible snapshot build path for ready explicit App/model requests.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
- Verification:
  - `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
  - `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
  - `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
  - `node scripts/tests/test_0425_principal_desktop_state_contract.mjs`
  - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
- Acceptance:
  - Explicit `profile=visible` for `{table_id, model_id}` produces the same client-visible shape as 0435.
  - The path does not call full `runtime.snapshot()` / `state.clientSnap()` for response construction when the requested ref can be validated from runtime metadata.
  - Unauthorized/missing/invisible refs still fail closed.
  - Cross-principal App table refs are rejected.
  - Host/App-table `model_id` collisions remain isolated by `table_id`.
  - Subtable owner checks are not bypassed by direct scoped build.
- Rollback:
  - Restore the previous `getProfiledClientSnapForRuntime(...)` route for visible requests and keep tests documenting the blocker.

## Step 4

- Scope: Local deployed verification, metrics, and final review.
- Files:
  - `docs/iterations/0436-runtime-snapshot-build-latency/runlog.md`
  - Browser artifacts under `output/playwright/` if screenshots/metrics are captured.
- Verification:
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
  - `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
  - `node scripts/tests/test_0425_principal_desktop_state_contract.mjs`
  - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
  - `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
  - `node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs`
  - `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - Playwright real browser check for `/snapshot?profile=visible...`, `/stream?profile=bootstrap&visible_model_ref=...`, and E2E color generator button.
  - `bash scripts/ops/playwright_session_guard.sh check-clean`
- Acceptance:
  - All deterministic checks pass.
  - Local browser metrics are recorded before/after, with explicit conclusion on whether the 50% visible snapshot target was met.
  - SSE bootstrap visible-ref response still contains bootstrap shell plus requested App table model, and does not expand to full.
  - E2E color generator still changes color after clicking `Generate Color`.
  - Sub-agent final review is Approved.
- Rollback:
  - Revert Step 3 runtime changes and keep only measured runlog evidence if performance target cannot be met safely.

## Notes

- Generated at: 2026-07-04
- Each implementation step must be followed by sub-agent review and required fixes before continuing.
