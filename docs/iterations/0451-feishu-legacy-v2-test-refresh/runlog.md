---
title: "Iteration 0451 Feishu Legacy V2 Test Refresh Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-07-09
source: ai
iteration_id: 0451-feishu-legacy-v2-test-refresh
id: 0451-feishu-legacy-v2-test-refresh
phase: phase1
---

# Iteration 0451-feishu-legacy-v2-test-refresh Runlog

## Environment

- Date: 2026-07-09
- Branch: `dropx/dev_0451-feishu-legacy-v2-test-refresh`
- Starting context:
  - 0450 completed formal v2 response materialization.
  - Additional 0450 investigation found two historical tests still using or expecting legacy `pin_payload.v1`.

## Review Gate Records

Review Gate Record
- Iteration ID: 0451-feishu-legacy-v2-test-refresh
- Review Date: 2026-07-09
- Review Type: User direction
- Decision: Approved
- Notes: User said "同意,继续"; implementation slices the next concrete layer as historical test refresh from legacy v1 expectations to current v2 contract.

## Execution Records

Step 1 - Register And Reproduce
- Registered `0451-feishu-legacy-v2-test-refresh` in `docs/ITERATIONS.md`.
- Created `plan.md`, `resolution.md`, and `runlog.md`.
- Reproduced the two historical failures before refreshing tests:
  - `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
    - Result: FAIL `1/10`.
    - Failing assertion: `registry must accept response for a known principal reply target`.
    - Cause observed: the helper still emitted `__mt_payload_kind=pin_payload.v1` and nested `payload`.
  - `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
    - Result: FAIL `31 passed, 1 failed out of 32`.
    - Failing assertion: `mt_bus_send must materialize requested Model 0 bus out label`.
    - Cause observed: the `bus_send.v1` helper omitted current v2-required table-qualified metadata, response topic, payload model id, and non-nested payload records.

Step 2 - Refresh Historical Tests
- Updated `scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`:
  - The principal runtime response helper now emits formal `pin_payload.v2` records.
  - Payload records are placed in payload model id `1`, not nested under a `payload` json label.
  - `reply_target_table_id`, `origin_table_id`, `endpoint_table_id`, and `payload_model_id` are present.
  - Negative wrong-pin and missing-model cases now use response topics that match the specific rejected target they intend to test.
- Updated `scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`:
  - The `mt_bus_send` helper now supplies response topic, table-qualified endpoint/origin/reply target metadata, payload model id, and payload model records.
  - The bus out assertion now expects `pin_payload.v2` and confirms no nested `payload` label is emitted.
- No production/runtime code was changed.

Step 3 - Minimal Runtime Fixes If Needed
- No runtime fix was needed.
- Refreshed tests passed against the existing current-contract implementation.

## Verification

Completed.

Focused results:

- `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
  - PASS `10/10`.
- `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
  - PASS `32 passed, 0 failed out of 32`.

Regression results:

- `node scripts/tests/test_0450_feishu_response_materialization.mjs`
  - PASS `4 passed, 0 failed out of 4`.
- `node scripts/tests/test_0449_feishu_response_outbox_publish.mjs`
  - PASS `3 passed, 0 failed out of 3`.
- `node scripts/tests/test_0448_feishu_message_api_response_outbox.mjs`
  - PASS `4 passed, 0 failed out of 4`.
- `node scripts/tests/test_0447_feishu_ui_api_processor.mjs`
  - PASS `6 passed, 0 failed out of 6`.
- `node scripts/tests/test_0446_feishu_data_api_processor.mjs`
  - PASS `5 passed, 0 failed out of 5`.
- `node scripts/tests/test_0445_feishu_resource_api_processor.mjs`
  - PASS `4 passed, 0 failed out of 4`.
- `node scripts/tests/test_0444_feishu_task_manager_processor.mjs`
  - PASS `4 passed, 0 failed out of 4`.
- `node scripts/tests/test_0443_feishu_message_api_business_dispatch.mjs`
  - PASS `5 passed, 0 failed out of 5`.
- `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
  - PASS `14 passed, 0 failed out of 14`.
- `node scripts/tests/test_0396_dual_topic_submit_response_contract.mjs`
  - PASS.

Static/doc guards:

- `node --check packages/worker-base/src/runtime.mjs`
  - PASS.
- `node --check scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
  - PASS.
- `node --check scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
  - PASS.
- `git diff --check`
  - PASS.
- `node scripts/ops/validate_obsidian_docs_gate.mjs`
  - PASS.
