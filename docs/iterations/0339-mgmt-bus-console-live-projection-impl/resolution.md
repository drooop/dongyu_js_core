---
title: "0339 — Mgmt Bus Console Live Projection Implementation Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-04-26
source: ai
iteration_id: 0339-mgmt-bus-console-live-projection-impl
id: 0339-mgmt-bus-console-live-projection-impl
phase: phase3
---

# 0339 — Mgmt Bus Console Live Projection Implementation Resolution

## Execution Strategy
Use TDD and small implementation stages. Write failing tests before production changes. After each stage, spawn a sub-agent using `codex-code-review`; fix any findings before moving to the next stage.

Keep the implementation model-table-first. Use existing components and existing projection labels first. Add only narrow generic bridge code if the current renderer cannot express the approved contract.

## Step 1 — Register 0339 And Add Red Contract Test
- Scope:
  - Register 0339 in `docs/ITERATIONS.md`.
  - Add a failing live projection contract test.
  - Test seeded source projection labels, source changes, forbidden truth in `1036`, refresh dispatch shape, and 0336 send preservation.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0339-mgmt-bus-console-live-projection-impl/*`
  - `scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
- Verification:
  - `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
- Acceptance:
  - Test fails for the expected missing live projection / refresh contract.
- Rollback:
  - Remove 0339 docs and the new test.

## Step 2 — Wire Read-Only Projection
- Scope:
  - Make Console regions read from source-owned projection labels.
  - Use existing `Table`, `Terminal`, `Tabs`, and `StatusBadge` surfaces.
  - Keep source data in `Model -2` / existing projection sources or explicit projection adapter output, not in `1036`.
- Files:
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js` only if required by the existing binding model.
  - `scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
- Verification:
  - `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
  - `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
- Acceptance:
  - Projection test passes.
  - 0336 contract remains green.
  - `1036` remains free of copied Matrix / route truth and secrets.
- Rollback:
  - Revert the projection labels / deriver change and restore empty projection slots.

## Step 3 — Add Refresh Through Model 0
- Scope:
  - Add a refresh button that emits `bus_event_v2`.
  - Add Model 0 route and system target pin if needed.
  - Add a narrow handler / server allow-list entry if needed.
  - Invalid refresh payload must be rejected.
- Files:
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/system_models.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - targeted tests
- Verification:
  - `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
  - `node scripts/tests/test_bus_in_out.mjs`
- Acceptance:
  - Refresh reaches Model 0 `pin.bus.in` and routes to an explicit target.
  - Invalid object payload is rejected.
  - No frontend direct Matrix or direct truth-model writes are introduced.
- Rollback:
  - Remove refresh button binding, bus key, route, target pin, and allow-list entry.

## Step 4 — Stage Review And Negative Guards
- Scope:
  - Spawn `codex-code-review` for Steps 1-3.
  - Address findings.
  - Add or strengthen negative checks for secret-like keys, copied truth, object-envelope payloads, and generic CRUD-like actions.
- Files:
  - targeted tests and runlog.
- Verification:
  - targeted tests
  - `node scripts/validate_builtins_v0.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
- Acceptance:
  - Review decision is APPROVED.
  - Negative tests fail on the wrong path and pass on the implemented path.
- Rollback:
  - Revert the current implementation stage.

## Step 5 — Local Deploy And Browser Verification
- Scope:
  - Run deterministic checks and frontend test/build.
  - Deploy local stack.
  - Use Playwright on `http://127.0.0.1:30900/#/workspace`.
  - Open `Mgmt Bus Console`, trigger refresh, verify rendered projection, send composer message, and verify direct Matrix count stays zero.
- Files:
  - no source edits unless verification finds defects.
- Verification:
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - Playwright browser flow
- Acceptance:
  - Deployed UI renders live projection.
  - Refresh and send both use `/bus_event`.
  - Snapshot shows expected routed target labels.
  - Browser resource entries for `/_matrix/client` remain `0`.
- Rollback:
  - Revert 0339 commits and redeploy prior `dev`.

## Step 6 — Final Review, Completion, Merge
- Scope:
  - Spawn final `codex-code-review` for the full diff.
  - Update runlog and `docs/ITERATIONS.md`.
  - Commit, merge to `dev`, push `dev`.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0339-mgmt-bus-console-live-projection-impl/runlog.md`
- Verification:
  - final targeted tests
  - `git diff --check`
  - clean worktree before merge / push
- Acceptance:
  - Final review APPROVED.
  - 0339 status Completed.
  - `dev` pushed to origin.
- Rollback:
  - Revert merge commit on `dev` if post-merge validation fails.
