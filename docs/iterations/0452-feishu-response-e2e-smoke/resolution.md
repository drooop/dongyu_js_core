---
title: "Iteration 0452 Feishu Response E2E Smoke Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-07-09
source: ai
iteration_id: 0452-feishu-response-e2e-smoke
id: 0452-feishu-response-e2e-smoke
phase: phase1
---

# Iteration 0452-feishu-response-e2e-smoke Resolution

## Step 1 - Register And Focused Smoke

- Register 0452 in `docs/ITERATIONS.md`.
- Create `scripts/tests/test_0452_feishu_response_e2e_smoke.mjs`.
- The smoke must set up both CJS and ESM runtimes with:
  - Model 0 configured for `uiput_mm_v1` and local worker `U1`.
  - A local reply target model `2000`.
  - A mock publish recorder.
- Run the focused smoke before any runtime fix. If it fails, treat that failure as the RED signal and investigate the broken boundary.

## Step 2 - Minimal Runtime Fix If Needed

- If the smoke fails because a current-contract path is disconnected, fix only that path.
- Do not add v1 compatibility or broker-specific behavior.
- Keep response loopback all-or-nothing.

## Step 3 - Verify And Close

- Run focused smoke:
  - `node scripts/tests/test_0452_feishu_response_e2e_smoke.mjs`
- Run adjacent regressions:
  - `node scripts/tests/test_0451` does not exist; rerun the 0451 refreshed historical surfaces:
    - `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
    - `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
  - `node scripts/tests/test_0450_feishu_response_materialization.mjs`
  - `node scripts/tests/test_0449_feishu_response_outbox_publish.mjs`
  - `node scripts/tests/test_0448_feishu_message_api_response_outbox.mjs`
  - `node scripts/tests/test_0447_feishu_ui_api_processor.mjs`
  - `node scripts/tests/test_0446_feishu_data_api_processor.mjs`
  - `node scripts/tests/test_0445_feishu_resource_api_processor.mjs`
  - `node scripts/tests/test_0444_feishu_task_manager_processor.mjs`
  - `node scripts/tests/test_0443_feishu_message_api_business_dispatch.mjs`
  - `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
  - `node scripts/tests/test_0396_dual_topic_submit_response_contract.mjs`
- Run static/doc guards:
  - `node --check packages/worker-base/src/runtime.mjs`
  - `node --check scripts/tests/test_0452_feishu_response_e2e_smoke.mjs`
  - `git diff --check`
  - `node scripts/ops/validate_obsidian_docs_gate.mjs`

## Rollback

- Remove the 0452 test and iteration files.
- Revert any minimal runtime change made for the smoke.
- Keep 0441-0451 artifacts intact.
