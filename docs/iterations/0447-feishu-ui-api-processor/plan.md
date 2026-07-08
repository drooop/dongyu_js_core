---
title: "Iteration 0447 Feishu UI API Processor Plan"
doc_type: iteration-plan
status: completed
updated: 2026-07-09
source: ai
iteration_id: 0447-feishu-ui-api-processor
id: 0447-feishu-ui-api-processor
phase: phase1
---

# Iteration 0447-feishu-ui-api-processor Plan

## Goal

Implement the first Feishu `ui.update_data` / `ui.tmp_data` / `ui.form_data` / `ui.refresh_data` processor behind the 0443 message dispatch layer.

## Done Criteria

- `ui.update_data` records current backend-bound UI data and appends a visible history entry.
- `ui.tmp_data` records current temporary UI data without appending persistent history.
- `ui.form_data` records visible form submissions.
- `ui.refresh_data` records pending refresh payload data without directly mutating UI labels.
- UI messages require a `Data` payload root and at least one payload record beyond metadata.
- Malformed UI messages fail closed before state mutation:
  - `missing_ui_payload_records`
  - `invalid_ui_payload_type`
- Runtime writes:
  - `feishu_ui_manager_state`
  - `feishu_ui_manager_last_result`
  - intercept `feishu_ui_manager_event`
- Existing 0442-0446 message/data/resource/task tests remain green.

## Scope

In scope:

- Runtime-owned in-memory UI manager state.
- Payload record extraction from Feishu child table records.
- Visible labels and intercepts.
- RED-first tests and SSOT/runlog updates.

Out of scope:

- Direct UI label mutation.
- Frontend refresh/SSE implementation.
- Durable UI operation history persistence.
- Automatic response publishing.
- Cross-worker authorization or federation.

## Verification

Required commands before completion:

```bash
node scripts/tests/test_0447_feishu_ui_api_processor.mjs
node scripts/tests/test_0446_feishu_data_api_processor.mjs
node scripts/tests/test_0445_feishu_resource_api_processor.mjs
node scripts/tests/test_0444_feishu_task_manager_processor.mjs
node scripts/tests/test_0443_feishu_message_api_business_dispatch.mjs
node scripts/tests/test_0442_feishu_current_contract_alignment.mjs
node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs
node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs
node scripts/tests/test_0441_feishu_source_watch_contract.mjs
node --check packages/worker-base/src/runtime.mjs
node --check scripts/lib/feishu_message_api_v1.mjs
node --check scripts/tests/test_0447_feishu_ui_api_processor.mjs
git diff --check
node scripts/ops/validate_obsidian_docs_gate.mjs
```
