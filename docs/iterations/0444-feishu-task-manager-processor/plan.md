---
title: "Iteration 0444 Feishu Task Manager Processor Plan"
doc_type: iteration-plan
status: completed
updated: 2026-07-08
source: ai
iteration_id: 0444-feishu-task-manager-processor
id: 0444-feishu-task-manager-processor
phase: phase1
---

# Iteration 0444-feishu-task-manager-processor Plan

## Goal

Implement the first real Feishu `task_data` business processor behind the 0443 message dispatch layer.

## Done Criteria

- `add_task` creates a task with a generated integer id and status `added_waiting_receive`.
- `edit_task` updates an existing task by id without changing its current status.
- `delete_task` marks an existing task as `deleted`.
- `receive_task` moves a task to `received_waiting_finish` and records receiver data.
- `finish_task` moves a task to `finished_waiting_archive` and records completion data.
- `archive_task` moves a task to `archived` and records archive/review data.
- Unknown task id fails closed with a concrete `task_not_found:<id>` reason.
- Runtime writes observable task state:
  - `runtime.intercepts` event `feishu_task_manager_event`
  - Model 0 labels `feishu_task_manager_tasks` and `feishu_task_manager_last_result`
- No synthetic `add_task_return` response packet is generated in this iteration; response publishing remains a later `response_topic`-aware iteration.

## Scope

In scope:

- In-memory runtime task manager state for Feishu message API processing.
- Visible labels that expose current task list and last task result.
- RED-first tests for task state transitions and missing ids.
- SSOT/runlog updates.

Out of scope:

- Durable database persistence.
- Cross-worker response publishing.
- To Do Board UI integration.
- Permission model beyond current message validation.

## Verification

Required commands before completion:

```bash
node scripts/tests/test_0444_feishu_task_manager_processor.mjs
node scripts/tests/test_0443_feishu_message_api_business_dispatch.mjs
node scripts/tests/test_0442_feishu_current_contract_alignment.mjs
node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs
node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs
node scripts/tests/test_0441_feishu_source_watch_contract.mjs
node --check packages/worker-base/src/runtime.mjs
node --check scripts/lib/feishu_message_api_v1.mjs
node --check scripts/tests/test_0444_feishu_task_manager_processor.mjs
git diff --check
node scripts/ops/validate_obsidian_docs_gate.mjs
```
