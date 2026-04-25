---
title: "0336 — mgmt-bus-console-implementation Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-04-26
source: ai
iteration_id: 0336-mgmt-bus-console-implementation
id: 0336-mgmt-bus-console-implementation
phase: phase3
---

# 0336 — mgmt-bus-console-implementation Resolution

## Execution Strategy

Use TDD and small stages. Each implementation stage gets a spawned sub-agent `codex-code-review` pass before moving on. Keep the first version model-table-first: fill model `1036`, extend only the generic renderer/event bridge if the approved contract cannot be expressed by existing `cellwise.ui.v1`.

## Step 1 — Register And Test The Model Contract
- Scope:
  - Register this implementation iteration.
  - Add failing tests for model `1036` metadata, cellwise four-region UI, label-driven text, and no-secret guard.
- Files:
  - `docs/ITERATIONS.md`
  - `scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
  - `packages/worker-base/system-models/workspace_positive_models.json`
- Verification:
  - `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
- Acceptance:
  - Test fails before model `1036` exists and passes after the fill-table model is added.
- Rollback:
  - Remove the new test and model `1036` records.

## Step 2 — Add Formal Bus Event Dispatch Support If Needed
- Scope:
  - If existing renderer bind semantics cannot express `bus_event_v2`, add the smallest generic bind contract for `bind.write.bus_event_v2`.
  - Keep generated labels in the existing `Model 0 bus_in_event` shape.
- Files:
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`
  - `packages/ui-model-demo-frontend/src/bus_event_v2.js`
  - targeted tests under `scripts/tests/` or package tests.
- Verification:
  - targeted renderer / bus event tests
  - `npm -C packages/ui-model-demo-frontend run test`
- Acceptance:
  - Button click emits `bus_event_v2` with temporary ModelTable records and does not emit direct Matrix traffic.
- Rollback:
  - Revert the generic bind extension and model button binding.

## Step 3 — Negative Contract Checks
- Scope:
  - Add or reuse deterministic checks for invalid payload rejection, Matrix live-only event handling, and MBR generic CRUD rejection.
- Files:
  - targeted `scripts/tests/test_*.mjs`
  - existing Matrix / MBR adapter tests if already present.
- Verification:
  - targeted scripts report PASS.
- Acceptance:
  - The checks prove the approved validation contract rather than legacy compatibility paths.
- Rollback:
  - Revert added test files and any narrow guard changes.

## Step 4 — Local Deploy And Browser Verification
- Scope:
  - Build/restart the local stack as required by `CLAUDE.md`.
  - Open Workspace, select `Mgmt Bus Console`, inspect layout, and exercise composer/send.
- Files:
  - no expected source edits unless verification reveals a defect.
- Verification:
  - `npm -C packages/ui-model-demo-frontend run build`
  - local deploy/restart command used by the repo
  - browser automation against `http://127.0.0.1:30900/#/workspace`
- Acceptance:
  - The deployed UI renders the model-table surface and send action reaches the Model 0 ingress path.
- Rollback:
  - Restore prior deployment from the previous branch/commit and remove model `1036` records if needed.
