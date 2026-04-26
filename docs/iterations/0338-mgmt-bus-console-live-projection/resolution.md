---
title: "0338 — Mgmt Bus Console Live Projection Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-26
source: ai
iteration_id: 0338-mgmt-bus-console-live-projection
id: 0338-mgmt-bus-console-live-projection
phase: phase1
---

# 0338 — Mgmt Bus Console Live Projection Resolution

## Execution Strategy
This is a planning-only iteration. Do not implement live projection in this iteration.

The later implementation should proceed with TDD and small review checkpoints. It should use existing projection sources first, keep Model `1036` as UI state only, and route all formal refresh / send actions through Model 0 `pin.bus.in`.

## Step 1 — Add Live Projection Contract Tests
- Scope:
  - Add tests that seed source projection labels and assert the Console renders non-empty subject / timeline / inspector / route display.
  - Add tests that prove changing source projection labels changes the Console projection without copying truth into Model `1036`.
  - Add tests that reject forbidden truth and secret-like keys in `1036`.
- Files:
  - `scripts/tests/test_0338_mgmt_bus_console_live_projection_contract.mjs`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - source projection fixtures only if needed under `scripts/fixtures/`
- Verification:
  - `node scripts/tests/test_0338_mgmt_bus_console_live_projection_contract.mjs`
- Acceptance:
  - The initial red test fails because Model `1036` still has empty projection slots.
  - The passing test proves projection is source-owned, not duplicated into `1036`.
- Rollback:
  - Remove the new test and any fixture-only files.

## Step 2 — Implement Read-Only Projection Wiring
- Scope:
  - Wire Model `1036` UI rows to existing projection state.
  - Prefer reading from `Model -2` Matrix Debug projection labels for UI-safe text.
  - Use Model 0 / MBR status only through a projection adapter or explicit read-only projection records.
  - Keep `1036` fields limited to local UI state and display binding declarations.
- Files:
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js` or existing projection code only if model labels cannot express the binding directly.
  - targeted tests under `scripts/tests/`
- Verification:
  - `node scripts/tests/test_0338_mgmt_bus_console_live_projection_contract.mjs`
  - `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
- Acceptance:
  - Subject / timeline / inspector / route regions are populated from projection sources.
  - No Matrix event truth, route truth, or secrets are stored in `1036`.
- Rollback:
  - Revert the projection wiring and restore empty projection slots.

## Step 3 — Add Refresh Action Through Model 0
- Scope:
  - Add a refresh button or tab action that emits `bus_event_v2` to Model 0.
  - Payload must be a temporary ModelTable record array.
  - Route must target an explicit system/projection handler, not frontend direct writes.
- Files:
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/system_models.json`
  - `packages/ui-model-demo-server/server.mjs` only if a new allowed bus key is required.
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - targeted tests under `scripts/tests/`
- Verification:
  - targeted refresh dispatch test
  - `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
  - `node scripts/tests/test_bus_in_out.mjs`
- Acceptance:
  - Refresh action reaches Model 0 `pin.bus.in`.
  - Invalid refresh payload is rejected with observable error.
  - No direct writes to Matrix / MBR truth models occur from the browser.
- Rollback:
  - Remove the refresh binding, route key, and handler labels.

## Step 4 — Guard Against Secret And CRUD Regressions
- Scope:
  - Add deterministic guards for secret-like data in client snapshot / Console labels.
  - Add or reuse MBR generic CRUD rejection checks for Console-triggered actions.
  - Ensure Matrix initial sync / backfill remains outside live projection unless explicitly projected by the existing debug source.
- Files:
  - targeted `scripts/tests/test_*.mjs`
  - existing Matrix / MBR tests if already present
- Verification:
  - targeted negative tests
  - `node scripts/validate_builtins_v0.mjs`
- Acceptance:
  - Tests fail if secret-like keys/values appear in `1036`.
  - Tests fail if Console sends generic CRUD or object-envelope payloads.
- Rollback:
  - Revert only the new guard tests and narrow guard changes.

## Step 5 — Local Deploy And Browser Verification
- Scope:
  - Redeploy or restart local stack because Workspace UI/runtime behavior changes.
  - Use Playwright against `http://127.0.0.1:30900/#/workspace`.
  - Open `Mgmt Bus Console`, trigger refresh, inspect populated projection, then verify existing Send still works.
- Files:
  - no expected source edits unless verification reveals a defect.
- Verification:
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - Playwright browser flow on `http://127.0.0.1:30900/#/workspace`
- Acceptance:
  - Browser renders live projection rows.
  - Refresh uses `/bus_event`, not direct Matrix.
  - Browser resource entries for `/_matrix/client` remain `0`.
  - Existing Send still routes to `-10.mgmt_bus_console_intent`.
- Rollback:
  - Restore the previous `dev` deployment and revert the 0338 implementation commit.

## Step 6 — Review And Completion
- Scope:
  - After each implementation stage, spawn a sub-agent with `codex-code-review`.
  - Fix findings before proceeding.
  - Final review must approve the full diff.
- Files:
  - `docs/iterations/0338-mgmt-bus-console-live-projection/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - final targeted tests
  - frontend test/build
  - local deploy baseline
  - Playwright browser evidence
- Acceptance:
  - All stage reviews and final review are recorded in runlog.
  - `docs/ITERATIONS.md` can be moved to `Completed` only after local deployment and browser verification pass.
- Rollback:
  - Revert the 0338 implementation branch before merging to `dev`.

## Notes
- `main` is not part of this iteration unless the user explicitly declares a release / milestone.
- If existing UI components are insufficient, stop at a component-contract sub-plan before adding new renderer components.
