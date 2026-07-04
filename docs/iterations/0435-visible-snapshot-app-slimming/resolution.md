---
title: "Iteration 0435 Visible Snapshot App Slimming Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-07-03
source: ai
iteration_id: 0435-visible-snapshot-app-slimming
id: 0435-visible-snapshot-app-slimming
phase: completed
---

# Iteration 0435-visible-snapshot-app-slimming Resolution

## Execution Strategy

Use TDD and keep the optimization small. First add tests that fail on the current broad `visible` profile behavior. Then change the server profile builder so `profile=visible` starts from an empty model set while `profile=bootstrap` keeps the shell allowlist. Finally verify frontend lazy-load merge and local browser performance. Do not change the business bus path in this iteration.

## Step 1 — RED contract for visible App snapshot boundary

- Scope: deterministic tests only.
- Files:
  - `scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
  - `docs/iterations/0435-visible-snapshot-app-slimming/runlog.md`
- Verification:
  - `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
- Acceptance:
  - The new test fails for the expected reason: current `profile=visible` includes host bootstrap models when only an App table model is requested.
  - The failure message names the broad visible payload, not an unrelated syntax/import failure.
- Rollback:
  - Remove the new test file and runlog entry.

## Step 2 — Server profile fix and regression coverage

- Scope: change snapshot profile construction only.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
  - Existing snapshot/profile tests if their assertions encoded the old broad visible behavior:
    - `scripts/tests/test_0423_snapshot_granularity_contract.mjs`
    - `scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
- Verification:
  - `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
  - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
- Acceptance:
  - `profile=visible` contains only requested visible refs.
  - `profile=bootstrap` contains bootstrap allowlist.
  - `profile=bootstrap` plus visible refs contains bootstrap allowlist plus requested refs.
  - Snapshot stats report the new lower visible-model payload without counting filtered host bootstrap models.
  - Secret filtering and permission checks are unchanged.
- Rollback:
  - Revert server/test changes from this step.

## Step 3 — Frontend merge contract and local build

- Scope: verify or minimally adjust frontend lazy-load behavior.
- Files:
  - `packages/ui-model-demo-frontend/src/remote_store.js` only if existing merge cannot handle target-only visible snapshots.
  - `scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `scripts/tests/test_0423_snapshot_granularity_contract.mjs`
- Verification:
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
- Acceptance:
  - Opening a visible App target fetches `profile=visible`.
  - Applying that response with `mergeWithCurrentModels` preserves existing shell models and adds the visible App table model.
  - No startup or App-open path requests `profile=full`.
- Rollback:
  - Revert frontend/test changes from this step.

## Step 4 — Local deployment and browser performance verification

- Scope: deploy local stack and measure the same path as the baseline.
- Files:
  - `docs/iterations/0435-visible-snapshot-app-slimming/runlog.md`
  - `docs/iterations/0435-visible-snapshot-app-slimming/assets/` if screenshots or JSON measurements are saved.
- Verification:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - Fixed Playwright session through `scripts/ops/playwright_session_guard.sh`.
  - Browser resource/request inspection must assert that startup and App-open did not request `/snapshot?profile=full`.
  - Browser flow: `Fake Drop` -> open `E2E 颜色生成器` -> click `Generate Color`.
  - `bash scripts/ops/playwright_session_guard.sh cleanup`
- Acceptance:
  - Local root returns 200.
  - E2E App opens as `app:drop:e2e:2-0-20:1 / model 0`.
  - Color changes after `Generate Color`.
  - Metrics compare before/after visible snapshot bytes/duration and button end-to-end duration.
  - Network evidence contains `profile=bootstrap`, `profile=visible`, `/bus_event`, and no `profile=full`.
  - No project Playwright session or managed browser process remains.
- Rollback:
  - Restore prior local deployment inputs or revert this iteration branch.

## Notes

- Generated at: 2026-07-03
