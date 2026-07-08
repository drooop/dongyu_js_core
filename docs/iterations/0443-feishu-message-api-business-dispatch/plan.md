---
title: "Iteration 0443 Feishu Message API Business Dispatch Plan"
doc_type: iteration-plan
status: completed
updated: 2026-07-08
source: ai
iteration_id: 0443-feishu-message-api-business-dispatch
id: 0443-feishu-message-api-business-dispatch
phase: phase1
---

# Iteration 0443-feishu-message-api-business-dispatch Plan

## Goal

Add the first runtime business dispatch layer for the Feishu-current public message APIs accepted in 0442.

## Done Criteria

- A new RED-first test proves Feishu `pin_payload.v1` messages do more than pass validation: they produce an observable handler result.
- Resource messages dispatch to a `resource` family with actions such as `report`, `request`, and `result`.
- Data messages dispatch to a `data` family with actions such as `save_modeltable`, `load_modeltable`, `save_flow`, and `load_flow`.
- UI messages dispatch to a `ui` family with actions such as `update_data`, `tmp_data`, `form_data`, and `refresh_data`.
- Task messages dispatch to a `task` family using the documented endpoint pin action.
- Missing required task fields fail closed with a concrete reason before dispatch.
- Dispatch writes both an intercept event and visible Model 0 labels, so later server/UI/DAM code can consume the result without guessing.
- Existing 0442 parsing/validation and 0432/0440 table isolation regressions remain green.

## Scope

In scope:

- Runtime parsing detail returned from the Feishu `pin_payload.v1` parser.
- A small handler dispatcher that classifies `sys_msg_type` into `resource`, `data`, `ui`, or `task`.
- Visible labels on Model 0:
  - `feishu_message_api_last_type`
  - `feishu_message_api_last_family`
  - `feishu_message_api_last_action`
  - `feishu_message_api_last_result`
- Intercept record:
  - `feishu_message_api_dispatch`
- Focused contract tests and SSOT/runlog updates.

Out of scope:

- Real DAM persistence.
- Real resource catalog mutation.
- Real UI label mutation from message payload.
- Real task table state transitions.
- Any synthetic response packet generation. Response publishing must remain a later iteration because 0430-era response routing requires exact `response_topic` and table-qualified reply target semantics.

## Design

0442 made Feishu-current messages valid inputs. 0443 adds a narrow dispatch layer after a bus input label has been accepted. The dispatcher reads the already validated Feishu payload, classifies `sys_msg_type`, records the result in `runtime.intercepts`, and mirrors the last result to Model 0 labels. This gives downstream code a deterministic handoff point without bypassing bus, payload, or table boundaries.

Task messages are the only slice with strict business required fields in this iteration because the Feishu source gives concrete fields per task pin. For example, `add_task` requires `title`, `body`, `publisher`, and `publish_time`; `finish_task` requires `id`, `end_time`, and `is_success`. Missing fields reject at bus ingress with a reason such as `bus_in_missing_task_field:title`.

## Verification

Required commands before completion:

```bash
node scripts/tests/test_0443_feishu_message_api_business_dispatch.mjs
node scripts/tests/test_0442_feishu_current_contract_alignment.mjs
node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs
node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs
node scripts/tests/test_0441_feishu_source_watch_contract.mjs
node --check packages/worker-base/src/runtime.mjs
node --check scripts/lib/feishu_message_api_v1.mjs
node --check scripts/tests/test_0443_feishu_message_api_business_dispatch.mjs
git diff --check
node scripts/ops/validate_obsidian_docs_gate.mjs
```
