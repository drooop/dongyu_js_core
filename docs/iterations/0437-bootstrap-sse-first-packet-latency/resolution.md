---
title: "Iteration 0437 Bootstrap SSE First Packet Latency Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-07-04
source: ai
iteration_id: 0437-bootstrap-sse-first-packet-latency
id: 0437-bootstrap-sse-first-packet-latency
phase: completed
---

# Iteration 0437-bootstrap-sse-first-packet-latency Resolution

## Execution Strategy

Use TDD and keep the optimization narrow. First add failing HTTP/SSE contract tests that poison full snapshot builders and prove bootstrap still depends on them today. Then introduce a scoped bootstrap builder that reuses 0436's direct runtime model serialization and authorization checks. Finally redeploy locally and record browser metrics for bootstrap snapshot, SSE first snapshot, and E2E color-generator sanity.

## Step 1

- Scope: Planning gate and baseline freeze.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0437-bootstrap-sse-first-packet-latency/plan.md`
  - `docs/iterations/0437-bootstrap-sse-first-packet-latency/resolution.md`
  - `docs/iterations/0437-bootstrap-sse-first-packet-latency/runlog.md`
- Verification:
  - Sub-agent review using `codex-code-review`.
- Acceptance:
  - Review decision is Approved.
  - Runlog records the 0436 baseline used for comparison.
- Rollback:
  - Revert the 0437 docs and iteration registry row.

## Step 2

- Scope: Add failing-first bootstrap/SSE direct-build contract tests.
- Files:
  - `scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs`
  - `packages/ui-model-demo-server/server.mjs` only if a test-only export is required before implementation.
- Verification:
  - `node scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs`
- Acceptance:
  - Tests initially fail because ready bootstrap snapshot or SSE first snapshot still calls `runtime.snapshot()` / `state.clientSnap()`.
  - Tests cover plain bootstrap, bootstrap + App-table visible ref, bootstrap + host-table visible ref, and SSE first `snapshot` event.
- Rollback:
  - Remove the new failing test if the planned direct-build seam changes before implementation.

## Step 3

- Scope: Implement scoped bootstrap snapshot build path.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs`
- Verification:
  - `node scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs`
  - `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
- Acceptance:
  - Bootstrap and bootstrap+visible-ref routes pass while full snapshot builders are poisoned.
  - SSE first snapshot event passes while full snapshot builders are poisoned.
  - Response shape remains compatible: bootstrap host models are still present, requested App tables are still under `snapshot.tables`, and `visible_model_refs` metadata remains table-qualified.
  - Any scoped validation failure is visible; no broad/full fallback is introduced.
- Rollback:
  - Restore bootstrap handling to the pre-0437 `getClientSnapForRuntime(...)` path and keep tests documenting the blocker.

## Step 4

- Scope: Full regression, local deploy, browser metrics, and final review.
- Files:
  - `docs/iterations/0437-bootstrap-sse-first-packet-latency/runlog.md`
  - Browser artifacts under `output/playwright/` only if screenshots or metric dumps are captured.
- Verification:
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
  - `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
  - `node scripts/tests/test_0425_principal_desktop_state_contract.mjs`
  - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
  - `node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs`
  - `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
  - `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
  - `node scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs`
  - `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - Playwright real browser check for fake login, bootstrap snapshot, SSE first snapshot, explicit visible snapshots, and E2E color generator.
  - `bash scripts/ops/playwright_session_guard.sh cleanup`
- Acceptance:
  - All deterministic checks pass.
  - Local deployed browser metrics are recorded and compared to 0436 baseline.
  - Target improvement is met, or remaining dominant node is measured and documented.
  - Sub-agent final review is Approved.
- Rollback:
  - Revert Step 3 runtime changes if scoped bootstrap cannot preserve security/shape invariants safely.

## Notes

- Generated at: 2026-07-04
- Each implementation step must be followed by sub-agent review and required fixes before continuing.
