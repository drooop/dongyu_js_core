---
title: "Iteration 0442 Feishu Current Contract Alignment Plan"
doc_type: iteration-plan
status: completed
updated: 2026-07-08
source: ai
iteration_id: 0442-feishu-current-contract-alignment
id: 0442-feishu-current-contract-alignment
phase: phase1
---

# Iteration 0442-feishu-current-contract-alignment Plan

## Goal

Align the repository runtime, validators, and public message contract with the two current Feishu source documents fixed in 0441:

- `软件工人模型2`
- `软件工人消息API文档`

This iteration treats the user's 2026-07-08 decisions as the implementation direction:

1. `model.v1n` must be implemented according to the Feishu document.
2. Numeric `model.subtableconnection.v` must be re-evaluated instead of treated as an automatic conflict.
3. Message payload must support the Feishu child ModelTable structure such as `0.1`.
4. Resource / data / UI / task `sys_msg_type` APIs must be improved strictly according to the Feishu message API document.

## Done Criteria

- Current Feishu-focused baseline remains reproducible through the 0441 watcher.
- `model.v1n` is a formal accepted model label in docs, runtime, validation, and tests.
- Numeric `model.subtableconnection.v` is supported as the Feishu document input form and normalized deterministically at runtime.
- Feishu `pin_payload.v1` message records can be parsed and validated with:
  - version / response info at message model `0`, cell `0,0,1`
  - bus / pin info at `0,1,0` / `0,1,1` / `0,1,2`
  - payload child ModelTable connection at `0,2,0`
  - payload records under child id such as `0.1`
- The message API recognizes and validates the documented `sys_msg_type` values:
  - `resource.report`
  - `resource.request`
  - `resource.result`
  - `data.save_modeltable`
  - `data.load_modeltable`
  - `data.save_flow`
  - `data.load_flow`
  - `ui.update_data`
  - `ui.tmp_data`
  - `ui.form_data`
  - `ui.refresh_data`
  - `task_data`
- Task-manager pins documented by Feishu are accepted as message targets:
  - `add_task`
  - `add_task_return`
  - `edit_task`
  - `delete_task`
  - `receive_task`
  - `finish_task`
  - `archive_task`
- Existing table-qualified App instance behavior remains protected; accepting Feishu numeric `subtableconnection` must not collapse principal-scoped child table isolation.
- All new behavior is covered by RED-first tests.
- CJS and ESM runtime implementations remain behavior-aligned.

## Subtableconnection Decision

After re-checking the current Feishu text and the 0431/0432 implementation history, numeric `model.subtableconnection.v` is not inherently a semantic conflict.

The better interpretation is:

- Feishu input form: `v` is the child table id allocated by the parent table, for example `1`, and records under `0.1` describe the child payload table.
- Existing implementation form: `v` is a table-qualified descriptor, for example `{ table_id, root_model_id, mount_kind, owner_principal_id? }`, needed for durable App instance tables and principal isolation.

Target rule:

- The runtime must accept Feishu numeric `model.subtableconnection.v` as a first-class input.
- When materialized inside a durable parent table, numeric input must be normalized to an internal table-qualified descriptor using the parent table id plus the numeric child table id.
- When used inside a temporary message payload, numeric input must resolve to the corresponding temporary child id such as `0.1`, without requiring durable `table_id`.
- Existing explicit object descriptors remain valid for durable child tables.

This is an input-shape expansion, not a return to `pin.connect.model` and not a weakening of child-table boundaries.

## Scope

In scope:

- Update current SSOT docs to reflect the user-confirmed Feishu direction.
- Implement `model.v1n` in runtime and validation.
- Add numeric `model.subtableconnection` normalization.
- Add Feishu `pin_payload.v1` parser / validator for the documented message shape.
- Add message API classification and validation for documented `sys_msg_type` values.
- Add task-manager pin acceptance tests.
- Update implementation evidence in this iteration's runlog.

Out of scope:

- Automatic mutation of Feishu documents.
- Removing existing table-qualified runtime data structures.
- Replacing the 0441 watcher.
- Implementing unrelated data model families such as `Data.CircularBuffer` unless required by a documented message API test.
- Remote deployment unless a later step explicitly requires local UI/server verification.

## Invariants

- Feishu documents are source input, and the user's current decisions decide this iteration's target direction.
- `model.v1n` must not become a loose alias accepted anywhere; it represents the software worker main model table.
- Numeric `model.subtableconnection.v` must be deterministic. If a stable child id cannot be derived, the operation must fail visibly.
- Child table routing still goes through parent connection Cell and child root boundary pins.
- No direct UI truth writes are allowed; UI changes must still pass through ModelTable labels.
- All side effects remain `add_label` / `rm_label`.
- Unknown `sys_msg_type` must fail closed with an observable error.
- The implementation must not silently reinterpret a durable principal-scoped App table as a bare numeric host model.

## Verification Summary

Required commands before completion:

```bash
node scripts/tests/test_0442_feishu_current_contract_alignment.mjs
node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs
node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs
node scripts/tests/test_0441_feishu_source_watch_contract.mjs
node --check scripts/ops/feishu_source_watch.mjs
node --check scripts/tests/test_0442_feishu_current_contract_alignment.mjs
git diff --check
node scripts/ops/validate_obsidian_docs_gate.mjs
```

If runtime changes touch frontend-visible behavior, local UI/server verification must be added to the runlog before completion.

## Inputs

- Current Feishu baseline report: `test_files/feishu_source_watch_focus_jyn_wbz/report-current-baseline.md`
- Current Feishu vs implementation report: `docs/iterations/0441-feishu-source-watch/current-version-implementation-diff.md`
- User confirmation message on 2026-07-08:
  - implement `model.v1n` according to Feishu
  - re-check numeric `model.subtableconnection.v`
  - improve payload structure according to Feishu child table form
  - strictly improve the documented `sys_msg_type` APIs
