---
title: "Iteration 0450 Feishu Response Materialization Plan"
doc_type: iteration-plan
status: completed
updated: 2026-07-09
source: ai
iteration_id: 0450-feishu-response-materialization
id: 0450-feishu-response-materialization
phase: phase1
---

# Iteration 0450-feishu-response-materialization Plan

## Goal

Materialize formal `pin_payload.v2` response packets into the local reply target ModelTable instead of ignoring them or re-triggering endpoint programs.

## Done Criteria

- Incoming `message_role="response"` packets on the local response topic write payload records to `reply_target_table_id + reply_target_model_id`.
- Response materialization does not write `pin.in` to the response endpoint model and does not run the endpoint program path.
- App instance reply targets with non-host `reply_target_table_id` are supported.
- Reply targets for another worker or missing target models fail closed and do not fall back to host/shared runtime.
- Existing Feishu 0442-0449 tests and response topic regression tests remain green.

## Scope

In scope:

- Runtime `mqttIncoming` response materialization.
- Runtime-visible materialization result labels/intercepts.
- Focused RED/GREEN tests and SSOT/runlog updates.

Out of scope:

- Real broker ACK handling.
- Durable retry queue.
- Frontend rendering/SSE refresh policy.
- Principal runtime registry routing outside this runtime instance.

## Verification

Required commands before completion:

```bash
node scripts/tests/test_0450_feishu_response_materialization.mjs
node scripts/tests/test_0449_feishu_response_outbox_publish.mjs
node scripts/tests/test_0448_feishu_message_api_response_outbox.mjs
node scripts/tests/test_0447_feishu_ui_api_processor.mjs
node scripts/tests/test_0446_feishu_data_api_processor.mjs
node scripts/tests/test_0445_feishu_resource_api_processor.mjs
node scripts/tests/test_0444_feishu_task_manager_processor.mjs
node scripts/tests/test_0443_feishu_message_api_business_dispatch.mjs
node scripts/tests/test_0442_feishu_current_contract_alignment.mjs
node scripts/tests/test_0396_dual_topic_submit_response_contract.mjs
node --check packages/worker-base/src/runtime.mjs
node --check scripts/tests/test_0450_feishu_response_materialization.mjs
git diff --check
node scripts/ops/validate_obsidian_docs_gate.mjs
```
