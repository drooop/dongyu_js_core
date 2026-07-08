---
title: "Iteration 0442 Feishu Current Contract Alignment Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-07-08
source: ai
iteration_id: 0442-feishu-current-contract-alignment
id: 0442-feishu-current-contract-alignment
phase: phase1
---

# Iteration 0442-feishu-current-contract-alignment Resolution

## Step 1 - Register Direction And RED Tests

Files:

- Modify: `docs/ITERATIONS.md`
- Create: `docs/iterations/0442-feishu-current-contract-alignment/runlog.md`
- Create: `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`

Actions:

- Register the iteration as `Approved`.
- Record the user's 2026-07-08 direction as the Review Gate.
- Add failing tests for:
  - `model.v1n` accepted at software worker Model 0 root.
  - `model.v1n` rejected outside the allowed root position.
  - numeric `model.subtableconnection.v` accepted and normalized.
  - Feishu `pin_payload.v1` message shape with payload child id `0.1` parsed.
  - documented `sys_msg_type` values recognized.
  - unknown `sys_msg_type` rejected.

Verification:

```bash
node scripts/tests/test_0442_feishu_current_contract_alignment.mjs
```

Expected result before implementation: FAIL for missing or rejected behavior.

## Step 2 - Implement `model.v1n`

Files:

- Modify: `docs/ssot/label_type_registry.md`
- Modify: `docs/ssot/runtime_semantics_modeltable_driven.md`
- Modify: `docs/ssot/feishu_model_label_alignment_v1.md`
- Modify: `packages/worker-base/src/runtime.mjs`
- Modify: `packages/worker-base/src/runtime.js`
- Modify if needed: `packages/ui-model-demo-server/filltable_policy.mjs`
- Test: `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`

Actions:

- Register `model.v1n` as the Feishu-current software worker main model table form.
- Allow `model.v1n` only on host table Model 0 root `(0,0,0)`.
- Preserve worker identity labels `sys_worker_role` and `sys_worker_id`.
- Ensure code paths that treat `model.table` root as a table root also treat allowed `model.v1n` root as table-capable.
- Keep `model.table` valid for ordinary tables and non-worker table roots.

Verification:

```bash
node scripts/tests/test_0442_feishu_current_contract_alignment.mjs
node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs
```

## Step 3 - Normalize Numeric `model.subtableconnection`

Files:

- Modify: `docs/ssot/label_type_registry.md`
- Modify: `docs/ssot/principal_scoped_subtable_namespace_v1.md`
- Modify: `docs/ssot/runtime_semantics_modeltable_driven.md`
- Modify: `packages/worker-base/src/runtime.mjs`
- Modify: `packages/worker-base/src/runtime.js`
- Modify if needed: `packages/ui-model-demo-server/filltable_policy.mjs`
- Test: `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
- Regression test: `scripts/tests/test_0432_subtable_connection_runtime_contract.mjs`
- Regression test: `scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs`

Actions:

- Accept positive integer `model.subtableconnection.v`.
- For durable parent table use, normalize numeric `v` to:
  - `table_id`: child table id derived from parent table id and numeric child id.
  - `root_model_id`: `0`.
  - `mount_kind`: a deterministic Feishu-current mount kind.
- Preserve explicit object descriptor behavior for principal-scoped App instance tables.
- Reject non-positive numbers and ambiguous cases.
- Keep connection cells limited to boundary pins.

Verification:

```bash
node scripts/tests/test_0442_feishu_current_contract_alignment.mjs
node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs
node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs
```

## Step 4 - Add Feishu `pin_payload.v1` Message Parser

Files:

- Create or modify: `scripts/lib/feishu_pin_payload_v1.mjs`
- Modify: `packages/worker-base/src/runtime.mjs`
- Modify: `packages/worker-base/src/runtime.js`
- Modify if needed: `scripts/run_worker_v0.mjs`
- Test: `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`

Actions:

- Parse Feishu message records according to the current document:
  - message root id `0`
  - version / response labels in `0,0,1`
  - bus info in `0,1,0` / `0,1,1` / `0,1,2`
  - payload connection in `0,2,0`
  - payload child records under id like `0.1`
- Accept `__mt_payload_kind = pin_payload.v1` for this documented shape.
- Validate `route_kind`, `origin_pin`, `endpoint_pin`, `response_pin`, `message_server`, `between`, `send_user`, and `receive_user` according to the document.
- Preserve explicit failure for malformed or ambiguous payloads.

Verification:

```bash
node scripts/tests/test_0442_feishu_current_contract_alignment.mjs
```

## Step 5 - Add Documented `sys_msg_type` API Handling

Files:

- Create or modify: `scripts/lib/feishu_message_api_v1.mjs`
- Modify: `packages/worker-base/src/runtime.mjs`
- Modify: `packages/worker-base/src/runtime.js`
- Modify if needed: `packages/ui-model-demo-server/server.mjs`
- Test: `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`

Actions:

- Recognize documented resource message types:
  - `resource.report`
  - `resource.request`
  - `resource.result`
- Recognize documented data message types:
  - `data.save_modeltable`
  - `data.load_modeltable`
  - `data.save_flow`
  - `data.load_flow`
- Recognize documented UI message types:
  - `ui.update_data`
  - `ui.tmp_data`
  - `ui.form_data`
  - `ui.refresh_data`
- Recognize task manager API:
  - `task_data`
  - target pins `add_task`, `add_task_return`, `edit_task`, `delete_task`, `receive_task`, `finish_task`, `archive_task`
- For each type, validate the documented required fields and produce observable errors for unknown or malformed messages.
- Do not invent undocumented fields as requirements.

Verification:

```bash
node scripts/tests/test_0442_feishu_current_contract_alignment.mjs
```

## Step 6 - Living Docs And Regression

Files:

- Modify: `docs/ssot/label_type_registry.md`
- Modify: `docs/ssot/runtime_semantics_modeltable_driven.md`
- Modify: `docs/user-guide/modeltable_user_guide.md` if public behavior changes.
- Modify: `docs/iterations/0442-feishu-current-contract-alignment/runlog.md`

Actions:

- Update living docs for model labels, subtableconnection, payload structure, and message API.
- Record conformance review:
  - tier placement
  - model placement
  - data ownership
  - data flow
  - data chain

Verification:

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

## Rollback

- Revert iteration files and the 0442 row from `docs/ITERATIONS.md`.
- Revert runtime/doc changes made under 0442.
- Keep 0441 watcher artifacts intact; they are independent of this implementation iteration.
