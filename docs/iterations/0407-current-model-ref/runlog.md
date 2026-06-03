---
title: "0407 Current Model Reference Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-06-03
iteration_id: 0407-current-model-ref
id: 0407-current-model-ref
source: ai
---

# 0407 Current Model Reference Runlog

## Environment

- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Branch: `dropx/dev_0407-current-model-ref`

## Review Gate

Review Gate Record
- Iteration ID: 0407-current-model-ref
- Review Date: 2026-06-03
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: User approved continuing after the proposed direction: same-model refs should not require deploy-time `model_id`; implement carefully, review, update docs, refill To Do Board and non-built-in slide apps.

## Execution Log

### Stage 1: Contract Tests

- Added `scripts/tests/test_0407_current_model_ref_contract.mjs`.
- Covered omitted current-model refs for `bind.read`, write targets, overlay write targets, `$label` in `bus_event_v2.value_ref` / `meta_ref`, `TodoBoard.tasksRef`, `TodoFocusList.tasksRef/filterRef`, `Include.props.ref`, `Pagination`, `Button.disabledRef`, and `singleFlight.releaseRef`.
- Added regression checks that developer ZIP payloads do not use `model_id: 0` as a current-model placeholder and that color proxy cross-model refs remain explicit.

Review:
- Sub-agent review 1: CHANGE_REQUESTED. Fixed missing overlay write target resolution.
- Sub-agent review 2: APPROVED.

Verification:
- PASS: `node scripts/tests/test_0407_current_model_ref_contract.mjs`

### Stage 2: Renderer And Overlay Resolution

- Updated CJS and ESM renderer paths so omitted `model_id` in UI refs resolves against the current AST node `cell_ref.model_id`.
- Preserved explicit `model_id`, including Model 0, negative runtime/system models, and deliberate cross-model positive refs.
- Ensured temporary ModelTable event records are not mutated with renderer `model_id`.

Review:
- Covered by Stage 1/2 sub-agent re-review: APPROVED.

Verification:
- PASS: `node scripts/tests/test_0407_current_model_ref_contract.mjs`
- PASS: `node scripts/tests/test_0405_todo_components_contract.mjs`
- PASS: `node scripts/tests/test_0405_todo_submit_overlay_contract.mjs`

### Stage 3: Refill Models And Examples

- Refilled `workspace_positive_models.json` same-model UI refs to omit `model_id`.
- Refilled To Do Board refs, basic UI validation payloads, minimal Submit payload, executable import payload, and relevant ZIP assets.
- Replaced minimal Submit old scalar `ui_text_ref_*` status binding with canonical `ui_bind_read_json`.
- Restored color generator proxy explicit cross-model refs to Model 100, model `-2`, and model `-1` after review found an over-broad removal.

Review:
- Sub-agent review 3: CHANGE_REQUESTED for color generator proxy cross-model refs and scalar `ui_text_ref_*` ambiguity.
- Fixed findings and added explicit regression coverage.

Verification:
- PASS: `node scripts/tests/test_0405_todo_slide_app_contract.mjs`
- PASS: `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
- PASS: `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
- PASS: `node scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs`
- PASS: `node scripts/tests/test_0303_color_generator_proxy_import_contract.mjs`
- PASS: `node scripts/tests/test_0303_color_generator_proxy_import_server_flow.mjs`
- PASS: `node scripts/tests/test_0307_executable_import_contract.mjs`
- PASS: `node scripts/tests/test_0307_executable_import_server_flow.mjs`

### Stage 4: Documentation

- Updated `docs/user-guide/ui_model_basic_filltable_guide.md` to state that same-model UI refs omit `model_id`, cross-model refs remain explicit, and `model_id: 0` must not be used as a current-model placeholder.
- Updated `docs/user-guide/ui_components_v2.md` with the same authoring rule and To Do component examples.
- Updated minimal Submit Markdown, visualized, and interactive docs from 63 records / old scalar `ui_text_ref_*` wording to 60 records / `ui_bind_read_json`.
- Living docs review:
  - `docs/user-guide/ui_model_basic_filltable_guide.md`: UPDATED.
  - `docs/user-guide/ui_components_v2.md`: UPDATED.
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`: UPDATED.
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md`: UPDATED.
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html`: UPDATED.
  - `docs/ssot/runtime_semantics_modeltable_driven.md`: NA; current change is UI ref authoring/resolution, not runtime pin semantics.
  - `docs/user-guide/modeltable_user_guide.md`: NA; no developer-facing UI ref example requiring model id correction found.
  - `docs/ssot/tier_boundary_and_conformance_testing.md`: NA; no boundary/conformance wording contradicted the current-model ref rule.

Review:
- Sub-agent review 4: CHANGE_REQUESTED for embedded provider bundle payloads that still shipped same-model `model_id: 0` UI refs.
- Fixed `bundle_payload_r1_color_generator` and `bundle_payload_r1_minimal_submit_dual_bus`.
- Sub-agent re-review: APPROVED.

Verification:
- PASS: documentation grep no longer finds old installer-remap wording; the remaining `model_id: 0` appears only as a negative example.
- PASS: `git diff --check`

### Stage 5: Final Verification

Review:
- Final sub-agent re-review: APPROVED. No findings, no open questions, no verification gaps.

Verification:
- PASS: `node scripts/tests/test_0407_current_model_ref_contract.mjs`
- PASS: `node scripts/tests/test_0405_todo_components_contract.mjs`
- PASS: `node scripts/tests/test_0405_todo_slide_app_contract.mjs`
- PASS: `node scripts/tests/test_0405_todo_submit_overlay_contract.mjs`
- PASS: `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
- PASS: `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
- PASS: `node scripts/tests/test_0303_color_generator_proxy_import_contract.mjs`
- PASS: `node scripts/tests/test_0303_color_generator_proxy_import_server_flow.mjs`
- PASS: `node scripts/validate_ui_ast_v0x.mjs --case all`
- PASS: `git diff --check`

Result:
- Completed.
