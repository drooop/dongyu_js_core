---
title: "Iteration 0438 App Open Frontend Latency Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-07-04
source: ai
iteration_id: 0438-app-open-frontend-latency
id: 0438-app-open-frontend-latency
phase: planning
---

# Iteration 0438-app-open-frontend-latency Resolution

## Execution Strategy

Use a measure-first approach. The server path was optimized in 0435-0437, so this iteration must not guess. It will add bounded timing evidence around the foreground App open path, then make the smallest conformant optimization that addresses the measured bottleneck.

Each implementation step requires a sub-agent review using `codex-code-review`. A step is complete only after review findings are either resolved or explicitly recorded as non-blocking with evidence.

## Step 1 — Planning Gate

- Scope:
  - Register iteration 0438.
  - Freeze `plan.md` and `resolution.md`.
  - Review the plan before code changes.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0438-app-open-frontend-latency/plan.md`
  - `docs/iterations/0438-app-open-frontend-latency/resolution.md`
  - `docs/iterations/0438-app-open-frontend-latency/runlog.md`
- Verification:
  - `git diff --check`
  - Sub-agent review of plan and resolution.
- Acceptance:
  - 0438 is registered as `Planned`.
  - Sub-agent review decision is `Approved`.
- Rollback:
  - Remove the 0438 iteration row and iteration directory.

## Step 2 — Frontend Timing Baseline

- Scope:
  - Add minimal timing probes for the foreground App open path.
  - Capture a pre-optimization baseline in local Orbstack with real browser actions.
  - Keep probes deterministic, low-overhead, and test-addressable.
- Expected file areas:
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/foreground_app_load_state.js`
  - `scripts/tests/`
  - `output/playwright/0438-app-open-frontend-latency/` for browser evidence
- Verification:
  - Deterministic test that timing events are emitted for App open / visible snapshot apply.
  - Local deployment before browser test.
  - Real browser opens an installed App and exports timing metrics.
  - Sub-agent review of the baseline slice.
- Acceptance:
  - `runlog.md` records baseline timing values for click-to-loading, snapshot request/response, apply, projection/render, and click-to-content.
  - Existing App open behavior remains functional.
- Rollback:
  - Revert timing probe changes and remove any test added in this step.

## Step 3 — Bounded Optimization

- Scope:
  - Optimize only the measured dominant latency node.
  - Candidate fixes may include:
    - avoid duplicate or stale visible-ref requests during foreground App open
    - apply visible snapshot before waiting on non-visible shell refresh
    - replace indefinite loading with explicit timeout/error state
    - reduce unnecessary full-object replacement during visible App snapshot apply
    - avoid rebuilding unrelated foreground shell AST when only the target App snapshot changes
  - The actual fix must be chosen from Step 2 evidence, not from this candidate list alone.
- Expected file areas:
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/projection_store.js`
  - `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`
  - Server changes only if Step 2 proves the remaining bottleneck is still server response shape.
- Verification:
  - Targeted deterministic tests for the chosen fix.
  - Local deployment before browser timing capture if the changed files affect deployed frontend/server behavior.
  - Real browser timing capture after the optimization for the same App open scenarios used in Step 2.
  - `runlog.md` must record Step 2 baseline vs Step 3 post-change values for click-to-content and the dominant latency node before sub-agent review starts.
  - Existing snapshot-related regressions:
    - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
    - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
    - `node scripts/tests/test_0425_principal_desktop_state_contract.mjs`
    - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
    - `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
    - `node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs`
    - `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
    - `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
    - `node scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - Sub-agent review of the optimization slice.
- Acceptance:
  - Browser metrics improve against Step 2 baseline, or the dominant remaining bottleneck is proven external to this iteration's allowed scope with concrete browser timing evidence.
  - No hidden full-snapshot fallback is introduced.
  - Loading placeholder cannot hang silently.
- Rollback:
  - Revert the chosen optimization patch and keep Step 2 metrics if they are still useful for a follow-up.

## Step 4 — Local Deployment, Browser Verification, Completion Review

- Scope:
  - Deploy locally to Orbstack.
  - Verify real browser App open behavior and at least one existing App interaction.
  - Record final metrics and close iteration docs.
- Files:
  - `docs/iterations/0438-app-open-frontend-latency/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - Browser test against `http://localhost:30900`
  - App open timing capture for at least two Apps.
  - One functional interaction check, preferably `E2E 颜色生成器` button click.
  - Final sub-agent review.
- Acceptance:
  - `runlog.md` contains PASS records for tests, build, local deploy, browser metrics, and final review.
  - `docs/ITERATIONS.md` marks 0438 as `Completed` only after all verification passes.
- Rollback:
  - Revert the 0438 branch from `dev` if already merged; otherwise reset only the 0438 branch to the previous commit.

## Notes

- Generated at: 2026-07-04
- Phase 1 must remain docs-only.
