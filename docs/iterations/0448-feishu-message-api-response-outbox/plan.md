---
title: "Iteration 0448 Feishu Message API Response Outbox Plan"
doc_type: iteration-plan
status: completed
updated: 2026-07-09
source: ai
iteration_id: 0448-feishu-message-api-response-outbox
id: 0448-feishu-message-api-response-outbox
phase: phase1
---

# Iteration 0448-feishu-message-api-response-outbox Plan

## Goal

Generate a formal `pin_payload.v2` response outbox for accepted Feishu-current `pin_payload.v1` message API requests when the request explicitly needs a response and provides a valid response destination.

## Done Criteria

- Accepted Feishu `pin_payload.v1` messages with `is_need_response=true` and valid full-topic `response_pin` write a Model 0 `pin.bus.cb.out` response label.
- The generated response uses formal v2 transport records:
  - `__mt_payload_kind = pin_payload.v2`
  - `message_role = response`
  - `topic = response_topic = <request response_pin>`
  - response endpoint equals the response topic endpoint.
  - response origin equals the original request endpoint.
  - reply target equals the response endpoint for host-table targets.
- Response payload records include the handled `sys_msg_type`, handler family/action, and handler result.
- Messages with `is_need_response=false` do not write a response outbox.
- Messages whose `response_pin` or endpoint pin cannot map to a valid v2 topic do not publish a request-topic fallback; they record a skipped response result.
- Existing 0442-0447 message/data/resource/ui/task tests remain green.

## Scope

In scope:

- Runtime-owned Feishu message API response outbox.
- Feishu v1 `response_pin` / `endpoint_pin` full-topic parsing into v2 endpoint metadata.
- Visible labels and intercepts for response generation or skip decisions.
- RED-first tests and SSOT/runlog updates.

Out of scope:

- UI Server response materialization.
- Durable response queue persistence.
- Cross-worker authorization or federation.
- Changing formal `pin_payload.v2` validation.
- Sending response to the original request topic.

## Verification

Required commands before completion:

```bash
node scripts/tests/test_0448_feishu_message_api_response_outbox.mjs
node scripts/tests/test_0447_feishu_ui_api_processor.mjs
node scripts/tests/test_0446_feishu_data_api_processor.mjs
node scripts/tests/test_0445_feishu_resource_api_processor.mjs
node scripts/tests/test_0444_feishu_task_manager_processor.mjs
node scripts/tests/test_0443_feishu_message_api_business_dispatch.mjs
node scripts/tests/test_0442_feishu_current_contract_alignment.mjs
node scripts/tests/test_0396_dual_topic_submit_response_contract.mjs
node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs
node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs
node scripts/tests/test_0441_feishu_source_watch_contract.mjs
node --check packages/worker-base/src/runtime.mjs
node --check scripts/lib/feishu_message_api_v1.mjs
node --check scripts/tests/test_0448_feishu_message_api_response_outbox.mjs
git diff --check
node scripts/ops/validate_obsidian_docs_gate.mjs
```
