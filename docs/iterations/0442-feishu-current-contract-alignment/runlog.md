---
title: "Iteration 0442 Feishu Current Contract Alignment Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-07-08
source: ai
iteration_id: 0442-feishu-current-contract-alignment
id: 0442-feishu-current-contract-alignment
phase: phase1
---

# Iteration 0442-feishu-current-contract-alignment Runlog

## Environment

- Date: 2026-07-08
- Branch: `dropx/dev_0442-feishu-current-contract-alignment`
- Starting context:
  - 0441 fixed current Feishu Markdown baselines for `feishu-model2` and `feishu-message-api`.
  - User confirmed the direction for `model.v1n`, Feishu child payload structure, and documented `sys_msg_type` APIs.
  - User asked to re-check whether numeric `model.subtableconnection.v` is truly a conflict.

## Review Gate Records

Review Gate Record
- Iteration ID: 0442-feishu-current-contract-alignment
- Review Date: 2026-07-08
- Review Type: User direction
- Review Index: 1
- Decision: Approved
- Notes: User directed implementation according to current Feishu docs for `model.v1n`, message payload child ModelTable structure, and resource/data/UI/task `sys_msg_type` APIs. User requested re-check on numeric `model.subtableconnection.v`; analysis concluded it is not inherently a semantic conflict if numeric Feishu input is normalized without weakening durable table-qualified boundaries.

## Execution Records

### Step 0 - Planning Registration

- Commands:
  - `git switch -c dropx/dev_0442-feishu-current-contract-alignment`
  - `mkdir -p docs/iterations/0442-feishu-current-contract-alignment`
- Added:
  - `docs/iterations/0442-feishu-current-contract-alignment/plan.md`
  - `docs/iterations/0442-feishu-current-contract-alignment/resolution.md`
  - `docs/iterations/0442-feishu-current-contract-alignment/runlog.md`
- Result: PASS.

### Step 1 - RED Contract Tests

- Added:
  - `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
- Command:
  - `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
- Key output:
  - `test_model_v1n_is_accepted_at_worker_root`: FAIL, current runtime rejects `model.v1n`.
  - `test_model_v1n_is_rejected_outside_worker_root`: FAIL, current rejection reason is still generic removed label handling, not the new scoped reason.
  - `test_numeric_subtableconnection_is_normalized_from_feishu_input`: FAIL, current runtime rejects numeric `model.subtableconnection.v`.
  - `test_feishu_pin_payload_v1_child_table_payload_is_parsed`: FAIL, `scripts/lib/feishu_message_api_v1.mjs` does not exist.
  - `test_feishu_message_api_recognizes_documented_sys_msg_types`: FAIL, `scripts/lib/feishu_message_api_v1.mjs` does not exist.
  - Summary: `5 failed, 0 passed out of 5`.
- Result: RED PASS.

### Step 2 - GREEN Runtime And Message API Contract

- Changed:
  - `packages/worker-base/src/runtime.mjs`
  - `scripts/lib/feishu_message_api_v1.mjs`
  - `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
- Implemented:
  - `model.v1n` is accepted only at host table Model 0 root `(0,0,0)`.
  - Numeric Feishu `model.subtableconnection.v` is accepted and normalized into a deterministic child table mount.
  - Feishu-current `pin_payload.v1` child ModelTable payload records such as `0.1` are parsed and accepted at bus ingress.
  - Documented `sys_msg_type` values are recognized and unknown values fail closed.
  - Feishu envelope fields are validated: `route_kind` accepts `control` / `manage`; `message_server` accepts `local` / `global`; `between` accepts `WSM_DEM` / `DEM_V1N`; `manage` messages require management users.
  - `task_data` must target a documented task manager pin such as `add_task`, `edit_task`, `finish_task`, or `archive_task`.
- Command:
  - `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
- Result:
  - `14 passed, 0 failed out of 14`

### Step 3 - Living Docs

- Changed:
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/feishu_model_label_alignment_v1.md`
- Recorded:
  - `model.v1n` is now the Feishu-current software worker root input.
  - Numeric `model.subtableconnection.v` is a formal Feishu input form, not a replacement for durable table-qualified descriptors.
  - Feishu `pin_payload.v1` is accepted as an input API shape while existing table-qualified `pin_payload.v2` transport remains protected.

### Step 4 - Regression Verification

- Commands:
  - `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
  - `node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs`
  - `node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs`
  - `node scripts/tests/test_0441_feishu_source_watch_contract.mjs`
  - `node --check scripts/ops/feishu_source_watch.mjs`
  - `node --check packages/worker-base/src/runtime.mjs`
  - `node --check scripts/lib/feishu_message_api_v1.mjs`
  - `node --check scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
  - `git diff --check`
  - `node scripts/ops/validate_obsidian_docs_gate.mjs`
- Result: PASS.

### Boundary Note

0442 completes the public message API entry contract and runtime acceptance / rejection rules. It does not implement the full business processors behind resource manager, DAM save/load, UI refresh, or task manager state transitions. Those business handlers should remain separate follow-up iterations so this protocol correction stays reviewable.

## Current Subtableconnection Finding

Numeric `model.subtableconnection.v` is not inherently a semantic conflict.

- Feishu current document uses numeric `v` to refer to a child table id allocated by the parent, and examples use child ids such as `0.1`.
- Current implementation uses object descriptors to preserve durable table identity and principal-scoped App isolation.
- Target implementation should accept numeric Feishu input and normalize it deterministically, while preserving object descriptors for durable App instance tables.

## Verification

Completed in Step 4.
