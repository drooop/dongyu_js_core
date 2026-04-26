---
title: "0341 — Mgmt Bus Console Event Projection Implementation Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-04-26
source: ai
iteration_id: 0341-mgmt-bus-console-event-projection-impl
id: 0341-mgmt-bus-console-event-projection-impl
phase: phase3
---

# 0341 — Mgmt Bus Console Event Projection Implementation Resolution

## Execution Strategy
Use TDD and small stages. Write the event projection contract test first, verify it fails for the old behavior, then make the smallest implementation changes required to pass.

After each implementation stage, spawn a sub-agent using `codex-code-review`; fix concrete findings before continuing. Keep implementation table-first and projection-first. Do not add new frontend components unless existing components are proven insufficient, which would require a separate planning iteration.

## Step 1 — Register 0341 And Add Red Contract Test
- Scope:
  - Register `0341` in `docs/ITERATIONS.md`.
  - Add a failing event projection contract test.
  - Cover source-owned event rows, selected-event inspector rows/text, local selection path, redaction, and preservation of 0336/0339 formal actions.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0341-mgmt-bus-console-event-projection-impl/*`
  - `scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
- Verification:
  - `node scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
- Acceptance:
  - Test fails for the expected missing event projection and local selection binding.
- Rollback:
  - Remove 0341 docs, index row, and the new test.

## Step 2 — Extend Source-Owned Event Projection
- Scope:
  - Extend the management console projection deriver with event rows, inspector rows/text, and composer action rows.
  - Keep projection output redacted and display-only.
  - Ensure server sync writes the new projection labels to Model `-2`.
- Files:
  - `packages/ui-model-demo-server/mgmt_bus_console_projection.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
- Verification:
  - `node scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
  - `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
- Acceptance:
  - Projection test passes for deriver output and server label names.
  - No raw secret-like value appears in event row preview or inspector detail.
- Rollback:
  - Revert the projection deriver and server sync changes.

## Step 3 — Bind Model 1036 Timeline And Inspector
- Scope:
  - Add event timeline table bound to Model `-2` event rows.
  - Add selected event local input bound to Model `1036` local state.
  - Add event inspector table / terminal bound to Model `-2` inspector projection labels.
  - Keep existing 0339 summary and route surfaces intact.
- Files:
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
- Verification:
  - `node scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
  - `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
  - `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
- Acceptance:
  - Event rows and inspector rows render from Model `-2`.
  - Local event selection dispatch is not a `bus_event_v2`.
  - Existing send and refresh actions still route through Model 0.
- Rollback:
  - Revert the Model `1036` UI bindings and local state labels.

## Step 4 — Stage Review And Negative Guards
- Scope:
  - Spawn `codex-code-review` for Steps 1-3.
  - Address findings.
  - Strengthen tests if review identifies unproven data ownership, redaction, or bus-path invariants.
- Files:
  - targeted source files and tests.
- Verification:
  - targeted tests
  - `node scripts/validate_builtins_v0.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
- Acceptance:
  - Review decision is `APPROVED`.
  - Negative guards fail on wrong-path implementations and pass on current implementation.
- Rollback:
  - Revert the current implementation stage.

## Step 5 — Local Deploy And Browser Verification
- Scope:
  - Run deterministic checks and frontend test/build.
  - Redeploy local stack.
  - Use Playwright on `http://127.0.0.1:30900/#/workspace`.
  - Open `Mgmt Bus Console`, verify event table and inspector render, change selected event locally, click refresh/send, and confirm no browser direct Matrix traffic.
- Files:
  - no source edits unless verification finds defects.
- Verification:
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - Playwright browser flow
- Acceptance:
  - Deployed UI renders event projection.
  - Local selection does not create a `/bus_event` request.
  - Refresh and send do create `/bus_event` requests with ModelTable record arrays.
  - Browser resource entries for `/_matrix/client` remain `0`.
- Rollback:
  - Revert 0341 commits and redeploy prior `dev`.

## Step 6 — Final Review, Completion, Merge
- Scope:
  - Spawn final `codex-code-review` for the full diff.
  - Update runlog and `docs/ITERATIONS.md`.
  - Commit, merge to `dev`, and push `dev`.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0341-mgmt-bus-console-event-projection-impl/runlog.md`
- Verification:
  - final targeted tests
  - `git diff --check`
  - clean worktree before merge / push
- Acceptance:
  - Final review `APPROVED`.
  - 0341 status `Completed`.
  - `dev` pushed to origin.
- Rollback:
  - Revert the merge commit on `dev` if post-merge validation fails.
