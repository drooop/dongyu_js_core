---
title: "Iteration 0446 Feishu Data API Processor Plan"
doc_type: iteration-plan
status: completed
updated: 2026-07-09
source: ai
iteration_id: 0446-feishu-data-api-processor
id: 0446-feishu-data-api-processor
phase: phase1
---

# Iteration 0446-feishu-data-api-processor Plan

## Goal

Implement the first Feishu `data.save_modeltable` / `data.load_modeltable` / `data.save_flow` / `data.load_flow` processor behind the 0443 message dispatch layer.

## Done Criteria

- `data.save_modeltable` accepts a Feishu payload child table whose root type is `Data` and records the modeltable payload in a visible runtime data store.
- `data.load_modeltable` accepts the same Feishu payload shape and records loaded modeltable data without synthesizing a response packet.
- `data.save_flow` and `data.load_flow` require a payload child table whose root type is `Flow` and record visible flow data.
- `data.*` messages without any data records beyond payload metadata fail closed with `missing_data_payload_records`.
- `data.save_flow` / `data.load_flow` with a non-`Flow` payload root fail closed with `invalid_data_payload_type`.
- Runtime writes:
  - `feishu_data_manager_store`
  - `feishu_data_manager_last_result`
  - intercept `feishu_data_manager_event`
- Existing 0442-0445 message/resource/task tests remain green.

## Scope

In scope:

- Runtime-owned in-memory data manager store.
- Payload data-record extraction from the Feishu child table.
- Visible labels and intercepts.
- RED-first tests and SSOT/runlog updates.

Out of scope:

- Durable DAM persistence.
- Automatic `data.*` response publishing.
- Cross-worker authorization or federation.
- Real Flow execution.
- UI materialization.

## Verification

Required commands before completion:

```bash
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
node --check scripts/tests/test_0446_feishu_data_api_processor.mjs
git diff --check
node scripts/ops/validate_obsidian_docs_gate.mjs
```
