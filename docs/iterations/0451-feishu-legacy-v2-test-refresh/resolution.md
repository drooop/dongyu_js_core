---
title: "Iteration 0451 Feishu Legacy V2 Test Refresh Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-07-09
source: ai
iteration_id: 0451-feishu-legacy-v2-test-refresh
id: 0451-feishu-legacy-v2-test-refresh
phase: phase1
---

# Iteration 0451-feishu-legacy-v2-test-refresh Resolution

## Step 1 - Register And Reproduce

- Register 0451 in `docs/ITERATIONS.md`.
- Reproduce the two known historical failures:
  - `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
  - `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Record the failing assertions and legacy packet fields in `runlog.md`.

## Step 2 - Refresh Historical Tests

- Update 0417 response packet builders to formal `pin_payload.v2`, including `reply_target_table_id` and `payload_model_id`.
- Update the 0332 `mt_bus_send` expectations from legacy v1 kind to current v2 output.
- Keep the behavioral assertions about principal isolation, reply target routing, rejection, and no fallback.

## Step 3 - Minimal Runtime Fixes If Needed

- If refreshed tests expose a current v2 runtime defect, fix only that defect.
- Do not add v1 compatibility.
- Record the root cause and verification in `runlog.md`.

## Step 4 - Verify And Close

- Run focused tests:
  - `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
  - `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Run regression tests:
  - `node scripts/tests/test_0450_feishu_response_materialization.mjs`
  - `node scripts/tests/test_0449_feishu_response_outbox_publish.mjs`
  - `node scripts/tests/test_0448_feishu_message_api_response_outbox.mjs`
  - `node scripts/tests/test_0447_feishu_ui_api_processor.mjs`
  - `node scripts/tests/test_0446_feishu_data_api_processor.mjs`
  - `node scripts/tests/test_0445_feishu_resource_api_processor.mjs`
  - `node scripts/tests/test_0444_feishu_task_manager_processor.mjs`
  - `node scripts/tests/test_0443_feishu_message_api_business_dispatch.mjs`
  - `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
- Run static guards:
  - `node --check packages/worker-base/src/runtime.mjs`
  - `node --check scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
  - `node --check scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
  - `git diff --check`
  - `node scripts/ops/validate_obsidian_docs_gate.mjs`

## Rollback

- Revert 0451 edits in the two historical test files and any minimal runtime fix.
- Remove the 0451 iteration directory and registry row.
- Keep 0441-0450 artifacts intact.
