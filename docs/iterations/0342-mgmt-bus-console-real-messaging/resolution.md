---
title: "0342 — Mgmt Bus Console Real Messaging Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-04-26
source: ai
iteration_id: 0342-mgmt-bus-console-real-messaging
id: 0342-mgmt-bus-console-real-messaging
phase: phase3
---

# 0342 — Mgmt Bus Console Real Messaging Resolution

## Execution Strategy

Use TDD in two implementation slices, then deploy and run browser verification. Keep the visible UI model-defined, keep the formal send path through Model `0`, and add the smallest system/MBR bridge needed to make the existing management console message produce a real MBR response.

## Step 1 — Register 0342 And Add Red Contract Tests

- Scope:
  - Register this iteration.
  - Add tests for compact asset-tree actions, model-defined target/response UI, server Matrix forwarding, and MBR response behavior.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0342-mgmt-bus-console-real-messaging/*`
  - `scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
  - `scripts/tests/test_0315_workspace_sidebar_layout_contract.mjs`
- Verification:
  - `node scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
  - `node scripts/tests/test_0315_workspace_sidebar_layout_contract.mjs`
- Acceptance:
  - New/updated tests fail for the expected missing compact layout and missing real messaging path.
- Rollback:
  - Remove the 0342 docs/index row and new test changes.

## Step 2 — Implement Compact Asset Tree And Model-Defined Messaging UI

- Scope:
  - Shrink the action column, remove fixed action overlay, shorten delete label, and preserve app-name readability.
  - Add Model `1036` target/status/sent-message local labels and UI bindings, with received transcript read from source-owned projection state.
  - Add `target_user_id` to the local UI-state whitelist.
- Files:
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `scripts/tests/test_0315_workspace_sidebar_layout_contract.mjs`
  - `scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
- Verification:
  - `node scripts/tests/test_0315_workspace_sidebar_layout_contract.mjs`
  - `node scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
- Acceptance:
  - Asset tree layout contract passes.
  - Model `1036` UI shows editable MBR target and visible source-owned sent/received transcript projection.
- Rollback:
  - Revert the catalog/UI-model and local-state whitelist changes.

## Step 3 — Implement Server Forwarding And MBR Response

- Scope:
  - Forward `-10.mgmt_bus_console_intent` to Matrix as a `pin_payload` submit packet.
  - Add a narrow MBR dispatcher that recognizes only Mgmt Bus Console messages from Model `1036` and replies with a temporary ModelTable `mgmt_bus_console_ack`.
  - Project return labels from source-owned Matrix trace state instead of marking Model `1036` as an external response truth owner.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
- Verification:
  - `node scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
  - `node scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
  - `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
  - `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
- Acceptance:
  - Server test records a Matrix packet for a UI send.
  - MBR test records a `mgmt_bus_console_ack` payload and no generic CRUD acceptance.
  - Existing management console route tests remain green.
- Rollback:
  - Revert server forwarding, MBR dispatcher, and source-owned projection changes.

## Step 4 — Stage Review

- Scope:
  - Spawn a sub-agent using `codex-code-review` for Steps 1-3.
  - Fix concrete findings and re-review if needed.
- Files:
  - Files touched in Steps 1-3.
- Verification:
  - Targeted tests requested by review.
- Acceptance:
  - Review decision is `APPROVED`.
- Rollback:
  - Revert the current implementation stage.

## Step 5 — Deploy And Browser Verification

- Scope:
  - Run deterministic checks and frontend build.
  - Sync/redeploy local assets and affected deployments.
  - Use a real browser at `http://127.0.0.1:30900/#/workspace`.
  - Verify color generator still changes color.
  - Verify Mgmt Bus Console can send to `@mbr:<host_url>` and display the returned MBR response.
- Files:
  - No source edits unless verification finds defects.
- Verification:
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - local deploy/restart commands
  - browser flow
- Acceptance:
  - Deployed page passes the two requested user flows.
  - Browser shows no direct Matrix requests.
- Rollback:
  - Revert 0342 commits and redeploy prior `dev`.

## Step 6 — Final Review And Completion

- Scope:
  - Spawn final `codex-code-review`.
  - Update runlog and `docs/ITERATIONS.md`.
  - Commit verified changes.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0342-mgmt-bus-console-real-messaging/runlog.md`
- Verification:
  - Final targeted checks
  - `git diff --check`
- Acceptance:
  - Final review `APPROVED`.
  - 0342 status can be marked `Completed`.
- Rollback:
  - Revert the 0342 commit if post-completion validation fails.

- Generated at: 2026-04-26
