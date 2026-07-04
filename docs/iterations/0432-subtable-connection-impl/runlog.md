---
title: "Iteration 0432 Subtable Connection Implementation Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-07-02
source: ai
iteration_id: 0432-subtable-connection-impl
id: 0432-subtable-connection-impl
phase: completed
---

# Iteration 0432-subtable-connection-impl Runlog

## Environment

- Date: 2026-07-02
- Branch: `dropx/dev_0432-subtable-connection-impl`
- Runtime: implementation stage for 0431 SSOT correction.
- Base commit: `4f1a0c7 docs(ssot): align subtable connection labels [0431]`
- Governing docs:
  - `CLAUDE.md`
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/principal_scoped_subtable_namespace_v1.md`

## Review Gate Record

- Iteration ID: `0432-subtable-connection-impl`
- Review Date: 2026-07-02
- Review Type: AI-assisted sub-agent
- Review Index: 1
- Decision: Change Requested
- Notes:
  - Required explicit connection Cell restrictions and single-parent semantics.
  - Required deterministic post-edit stale-label scans.
  - Required Workspace Manager browser install/open path unless blocked.
  - Required exact placeholder-search command.

- Iteration ID: `0432-subtable-connection-impl`
- Review Date: 2026-07-02
- Review Type: AI-assisted sub-agent
- Review Index: 2
- Decision: Change Requested
- Notes:
  - `model.subtableconnection` value shape was too loose and mentioned alias
    metadata.
  - Fix required strict `table_id` / `root_model_id` / `mount_kind` plus
    optional `owner_principal_id`.

- Iteration ID: `0432-subtable-connection-impl`
- Review Date: 2026-07-02
- Review Type: AI-assisted sub-agent
- Review Index: 3
- Decision: Approved
- Notes:
  - Findings: none.
  - Open questions: none.
  - Verification gaps: none.

## Execution Records

### Step 0: Plan Gate

- Command:
  - `git diff --check -- docs/ITERATIONS.md docs/iterations/0432-subtable-connection-impl`
  - `rg -n --glob '!runlog.md' "\\[(TO)DO\\]|Descri[b]e the iteration objective|Explai[n] implementation approach|PLACEHOLD[E]R|pendin[g]|alias metadata" docs/iterations/0432-subtable-connection-impl docs/ITERATIONS.md`
  - Sub-agent `codex-code-review` plan review, three rounds.
- Key output:
  - `git diff --check`: no output.
  - Placeholder/alias search: no matches.
  - Review 1: Change Requested.
  - Review 2: Change Requested.
  - Review 3: Approved.
- Result: PASS
- Commit:

### Step 1: Runtime Label Semantics

- Command:
  - RED: `node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs`
  - GREEN:
    - `node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs`
    - `node scripts/tests/test_0425_runtime_table_namespace_contract.mjs`
    - `node scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`
    - `node scripts/tests/test_submodel_register.mjs`
    - `node scripts/tests/test_submodel_connect.mjs`
    - `node scripts/tests/test_0357_pin_connection_hard_cut.mjs`
  - `rg -n "resolvedType === 'submt'|model\\.subtableconnection'\\s*\\|\\||model\\.submtconnection'\\s*\\|\\||subtable_requires_host_table|submodel_host_cell|subtable_host_cell|_normalizeSubtableDescriptor|parentChildMap\\.get\\(model\\.id\\)|parentChildMap\\.set\\(childModelId|parentChildMap\\.delete\\(childModelId" packages/worker-base/src/runtime.mjs scripts/tests/test_0432_subtable_connection_runtime_contract.mjs scripts/tests/test_0425_runtime_table_namespace_contract.mjs scripts/tests/test_submodel_register.mjs scripts/tests/test_submodel_connect.mjs scripts/tests/test_0357_pin_connection_hard_cut.mjs scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`
  - `git diff --check -- packages/worker-base/src/runtime.mjs scripts/tests/test_0432_subtable_connection_runtime_contract.mjs scripts/tests/test_0425_runtime_table_namespace_contract.mjs scripts/tests/test_0430_feishu_operational_ssot_contract.mjs scripts/tests/test_submodel_register.mjs scripts/tests/test_submodel_connect.mjs scripts/tests/test_0357_pin_connection_hard_cut.mjs`
- Key output:
  - RED output: `0 passed, 16 failed out of 16`.
  - GREEN output:
    - `test_0432_subtable_connection_runtime_contract`: `16 passed, 0 failed out of 16`.
    - `test_0425_runtime_table_namespace_contract`: `14 passed, 0 failed out of 14`.
    - `test_0430_feishu_operational_ssot_contract`: `PASSED`.
    - `test_submodel_register`: `4 passed, 0 failed out of 4`.
    - `test_submodel_connect`: `3 passed, 0 failed out of 3`.
    - `test_0357_pin_connection_hard_cut`: all listed checks `PASS`.
  - Residual old-runtime-semantics search: no matches.
  - `git diff --check`: no output.
  - Sub-agent review 1: `CHANGE_REQUESTED`.
    - Finding: replacing a connection label left the old `parentChildMap` /
      `subtableMounts` index alive.
    - Finding: same-cell `model.submtconnection` metadata/target updates could
      be marked applied while runtime maps stayed stale.
  - Added failing replacement coverage:
    - `testSubmtConnectionReplacementCleansOldIndex`
    - `testSubtableConnectionReplacementCleansOldIndex`
    - `testSubtableConnectionMetadataUpdateIsSynchronized`
  - RED for replacement coverage: `18 passed, 4 failed out of 22`.
  - Fix: added index cleanup helpers and clear previous index before registering
    replacement connection labels.
  - GREEN after fix:
    - `test_0432_subtable_connection_runtime_contract`: `22 passed, 0 failed out of 22`.
    - `test_0425_runtime_table_namespace_contract`: `14 passed, 0 failed out of 14`.
    - `test_0430_feishu_operational_ssot_contract`: `PASSED`.
    - `test_submodel_register`: `4 passed, 0 failed out of 4`.
    - `test_submodel_connect`: `3 passed, 0 failed out of 3`.
    - `test_0357_pin_connection_hard_cut`: all listed checks `PASS`.
  - Sub-agent review 2: `CHANGE_REQUESTED`.
    - Finding: same key cross-type replacement between
      `model.submtconnection` and `model.subtableconnection` could be applied
      and leave stale maps.
    - Finding: duplicate `model.subtableconnection` records could index the
      same `table_id` from multiple Cells.
  - Added failing coverage:
    - `testConnectionIndexCannotChangeTypeInPlace`
    - `testSubtableConnectionRejectsDuplicateTableId`
  - RED for second-review coverage: `22 passed, 4 failed out of 26`.
  - Fix: reject in-place cross-type connection index replacement and reject a
    second parent Cell indexing the same child table id.
  - Additional stale-test cleanup:
    - Updated `test_0142_integration` fixture and assertions from parent-side
      `model.submt` to parent-side `model.submtconnection`.
    - Updated `test_0177_submt_mapping_contract` to verify connection Cell
      rules plus child-side `model.submt` declaration.
  - GREEN after second fix:
    - `node --check packages/worker-base/src/runtime.mjs`: no output.
    - `test_0432_subtable_connection_runtime_contract`: `26 passed, 0 failed out of 26`.
    - `test_0425_runtime_table_namespace_contract`: `14 passed, 0 failed out of 14`.
    - `test_0430_feishu_operational_ssot_contract`: `PASSED`.
    - `test_0142_integration`: `3 passed, 0 failed out of 3`.
    - `test_0177_submt_mapping_contract`: `PASS`.
    - `test_submodel_register`: `4 passed, 0 failed out of 4`.
    - `test_submodel_connect`: `3 passed, 0 failed out of 3`.
    - `test_0357_pin_connection_hard_cut`: all listed checks `PASS`.
  - Residual stale-runtime/test search:
    - `rg -n "\"t\": \"submt\"|t:\s*'submt'|t:\s*\"submt\"|parentChildMap\.has\([0-9]|parentChildMap\.get\([0-9]|submodel_host_cell_forbidden_label|subtable_requires_host_table|submodel_host_cell|subtable_host_cell|_normalizeSubtableDescriptor|model\.subtableconnection'\s*\|\||model\.submtconnection'\s*\|\||resolvedType === 'submt'|parentChildMap\.get\(model\.id\)|parentChildMap\.set\(childModelId|parentChildMap\.delete\(childModelId" packages/worker-base/src scripts/tests`
    - Output: no matches.
  - `git diff --check`: no output.
  - Sub-agent review 3: `CHANGE_REQUESTED`.
    - Finding: same-key overwrite of a relationship label by a non-connection
      label could apply while leaving stale runtime indexes alive.
    - Finding: same-key overwrite of a relationship label by a boundary pin
      could apply while leaving stale runtime indexes alive.
  - Added failing coverage:
    - `testConnectionIndexCannotBeOverwrittenByNonConnectionLabel`
    - `testConnectionIndexCannotBeOverwrittenByBoundaryPin`
  - RED for third-review coverage: `26 passed, 4 failed out of 30`.
  - Fix: if the previous same-key label was a connection index, the new label
    must be the same connection-index type; otherwise the write is rejected with
    `connection_cell_index_type_change_forbidden`.
  - GREEN after third fix:
    - `node --check packages/worker-base/src/runtime.mjs`: no output.
    - `test_0432_subtable_connection_runtime_contract`: `30 passed, 0 failed out of 30`.
    - `test_0425_runtime_table_namespace_contract`: `14 passed, 0 failed out of 14`.
    - `test_0430_feishu_operational_ssot_contract`: `PASSED`.
    - `test_0142_integration`: `3 passed, 0 failed out of 3`.
    - `test_0177_submt_mapping_contract`: `PASS`.
    - `test_submodel_register`: `4 passed, 0 failed out of 4`.
    - `test_submodel_connect`: `3 passed, 0 failed out of 3`.
    - `test_0357_pin_connection_hard_cut`: all listed checks `PASS`.
  - Residual stale-runtime/test search after third fix: no matches.
  - `git diff --check`: no output.
  - Sub-agent review 4: `APPROVED`.
    - Findings: none.
    - Open questions: none.
    - Verification gaps: none.
- Result: PASS
- Commit:

### Step 2: Slide App Import And Lifecycle

- Command:
  - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
  - `node scripts/tests/test_0302_slide_app_zip_import_contract.mjs`
  - `node scripts/tests/test_0312_slide_import_cache_contract.mjs`
  - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
  - `node --check packages/ui-model-demo-server/server.mjs`
- Key output:
  - `test_0425_slide_app_subtable_install_contract`: `5 passed, 0 failed out of 5`.
  - `test_0302_slide_app_zip_import_contract`: `4 passed, 0 failed out of 4`.
  - `test_0312_slide_import_cache_contract`: `3 passed, 0 failed out of 3`.
  - `test_0361_minimal_submit_import_export_contract`: `4 passed, 0 failed out of 4`.
  - `node --check`: no output.
  - Sub-agent review was completed in the prior implementation slice and
    approved after fixing installer/delete/export table-qualified behavior.
- Result: PASS
- Commit:

### Step 3: Fill-Table Refit And System Fixtures

- Command:
  - `node scripts/validate_builtins_v0.mjs`
  - `node scripts/tests/test_0306_model100_pin_chain_contract.mjs`
  - `node scripts/tests/test_0383_matrix_suite_slide_app_contract.mjs`
  - `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
  - `node scripts/tests/test_0405_todo_slide_app_contract.mjs`
  - `node scripts/tests/test_0432_fixture_submt_connection_contract.mjs`
  - `node scripts/tests/test_0264_debug_crud_unhide_all.mjs`
  - `node scripts/tests/test_0270_workspace_ui_filltable_mount_contract.mjs`
  - `node scripts/tests/test_0155_prompt_filltable_policy.mjs`
  - `node scripts/tests/test_0158_new_label_types.mjs`
  - `node scripts/tests/test_model_in_out.mjs`
  - `node scripts/tests/test_0306_runtime_mailbox_ingress_contract.mjs`
  - `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
  - `node scripts/tests/test_0294_runtime_pin_contract.mjs`
  - `node scripts/tests/test_0248_cross_model_pin_owner_materialization_contract.mjs`
  - `node scripts/tests/test_0306_workspace_system_pin_chain_server_flow.mjs`
  - `node scripts/tests/test_0311_workspace_pin_addressing_server_flow.mjs`
  - JSON structural scan over:
    - `packages/worker-base/system-models`
    - `deploy/sys-v1ns`
    - `scripts/tests/fixtures`
  - `git diff --check -- deploy/sys-v1ns packages/ui-model-demo-frontend/src/editor_page_state_derivers.js packages/ui-model-demo-server/filltable_policy.mjs packages/ui-model-demo-server/server.mjs packages/worker-base/src/runtime.mjs packages/worker-base/system-models scripts/tests`
- Key output:
  - `validate_builtins_v0`: all listed validation groups `PASS`.
  - `test_0306_model100_pin_chain_contract`: `3 passed, 0 failed out of 3`.
  - `test_0383_matrix_suite_slide_app_contract`: `5 passed, 0 failed out of 5`.
  - `test_0399_matrix_chat_app_ux_contract`: `7 passed, 0 failed out of 7`.
  - `test_0405_todo_slide_app_contract`: `3 passed, 0 failed out of 3`.
  - `test_0432_fixture_submt_connection_contract`: `PASS`.
  - Additional fill-table/input regression bundle:
    - `test_0264_debug_crud_unhide_all`: `4 passed, 0 failed out of 4`.
    - `test_0270_workspace_ui_filltable_mount_contract`: `2 passed, 0 failed out of 2`.
    - `test_0155_prompt_filltable_policy`: `PASS`.
    - `test_0158_new_label_types`: `4 passed, 0 failed out of 4`.
    - `test_model_in_out`: `8 passed, 0 failed out of 8`.
    - `test_0306_runtime_mailbox_ingress_contract`: `2 passed, 0 failed out of 2`.
    - `test_0326_ui_event_busin_flow`: `31 passed, 0 failed out of 31`.
    - `test_0294_runtime_pin_contract`: `4 passed, 0 failed out of 4`.
    - `test_0248_cross_model_pin_owner_materialization_contract`: `2 passed, 0 failed out of 2`.
    - `test_0306_workspace_system_pin_chain_server_flow`: `1 passed, 0 failed out of 1`.
    - `test_0311_workspace_pin_addressing_server_flow`: `1 passed, 0 failed out of 1`.
  - JSON structural scan: `fixture structural scan PASS`.
  - Old placement scan: `old placement scan PASS`.
  - `git diff --check`: no output.
  - Sub-agent review after the first Step 3 pass: `CHANGE_REQUESTED`.
    - Finding: `ws_select_app.v1` carried `table_id`, but handler/server still
      selected by naked `model_id` and did not write `ws_app_selected_ref`.
    - Finding: frontend workspace selection treated `model_id=0` as empty even
      when the selected app lived in an app table.
    - Finding: runlog said PASS before the reviewed failure was fixed.
  - Fix after review:
    - Workspace catalog select/delete UI payload now carries `table_id` in
      addition to `model_id`.
    - `0311` deletion assertion now checks `{table_id, model_id}` instead of
      naked `model_id`, because multiple app tables may legitimately share
      `model_id=0`.
    - Workspace selection writes `ws_app_selected_ref` and frontend selection
      reads the table-qualified ref before falling back to the derived scalar.
    - App table root `model_id=0` is now renderable by
      `deriveWorkspaceSelected`.
    - Legacy `/api/slide-apps/:id/export.zip` export path is rejected; the only
      formal export route is query-based with explicit `table_id` and
      `model_id`.
  - Re-verification after fix:
    - `test_0311_workspace_pin_addressing_server_flow`: `1 passed, 0 failed out of 1`.
    - `test_0425_frontend_model_ref_projection_contract`: `11 passed, 0 failed out of 11`.
    - `test_0425_slide_app_subtable_install_contract`: `5 passed, 0 failed out of 5`.
    - `test_0432_fixture_submt_connection_contract`: `PASS`.
    - `test_0302_slide_app_zip_import_contract`: `4 passed, 0 failed out of 4`.
    - `test_0312_slide_import_cache_contract`: `3 passed, 0 failed out of 3`.
    - `test_0361_minimal_submit_import_export_contract`: `4 passed, 0 failed out of 4`.
    - `test_0383_matrix_suite_slide_app_contract`: `5 passed, 0 failed out of 5`.
    - `test_0399_matrix_chat_app_ux_contract`: `7 passed, 0 failed out of 7`.
    - `test_0405_todo_slide_app_contract`: `3 passed, 0 failed out of 3`.
    - `validate_builtins_v0`: all listed validation groups `PASS`.
    - `validate_ui_ast_v0x --case all`: `summary: PASS`.
    - `git diff --check`: no output.
  - Sub-agent review after the second Step 3 pass: `CHANGE_REQUESTED`.
    - Finding: host app registry export URL still generated the legacy
      `/api/slide-apps/:id/export.zip` path while the handler rejected it.
    - Finding: Slide Create wrote only naked `ws_app_selected`, so app table
      root `model_id=0` could not be selected after create.
    - Verification gap: `test_0290_slide_app_filltable_create_server_flow`
      was not in the pass list and failed before the fix.
  - Fix after second review:
    - Host app registry export URL now uses
      `/api/slide-apps/export.zip?table_id=host&model_id=...`.
    - Slide Create and Slide Import success handlers now write
      `ws_app_selected_ref` with `{table_id, model_id}`.
    - `0290` asserts create flow selects the new app by table-qualified ref.
    - `0311` asserts import flow selects the imported app by table-qualified ref.
    - `0425` asserts host export URLs use the explicit query route.
    - Developer guide, visualized doc, and interactive HTML now state the same
      export rule: every formal export path must carry explicit `table_id`,
      including `table_id=host`; the old path is rejected.
  - Re-verification after second fix:
    - `test_0290_slide_app_filltable_create_server_flow`: `1 passed, 0 failed out of 1`.
    - `test_0311_workspace_pin_addressing_server_flow`: `1 passed, 0 failed out of 1`.
    - `test_0425_slide_app_subtable_install_contract`: `5 passed, 0 failed out of 5`.
    - `test_0425_frontend_model_ref_projection_contract`: `11 passed, 0 failed out of 11`.
    - `test_0432_fixture_submt_connection_contract`: `PASS`.
    - `test_0302_slide_app_zip_import_contract`: `4 passed, 0 failed out of 4`.
    - `test_0312_slide_import_cache_contract`: `3 passed, 0 failed out of 3`.
    - `test_0361_minimal_submit_import_export_contract`: `4 passed, 0 failed out of 4`.
    - `test_0383_matrix_suite_slide_app_contract`: `5 passed, 0 failed out of 5`.
    - `test_0399_matrix_chat_app_ux_contract`: `7 passed, 0 failed out of 7`.
    - `test_0405_todo_slide_app_contract`: `3 passed, 0 failed out of 3`.
    - `validate_builtins_v0`: all listed validation groups `PASS`.
    - `validate_ui_ast_v0x --case all`: `summary: PASS`.
    - `docs/user-guide` export-path scan: only prohibition/deprecation
      mentions of the old path remain.
    - `intent_handlers_slide_create/import`, `workspace_catalog_ui`, and
      `intent_handlers_ws` JSON parse: `PASS`.
    - `git diff --check`: no output.
  - Sub-agent review after the third Step 3 pass: `CHANGE_REQUESTED`.
    - Finding: local demo Workspace registry still generated the legacy
      `/api/slide-apps/${modelId}/export.zip` path.
  - Fix after third review:
    - Local demo registry now generates the explicit host query route:
      `/api/slide-apps/export.zip?table_id=host&model_id=...`.
    - Local route test fixture now writes `ws_app_selected_ref` and asserts the
      current workspace shell slot replacement contract instead of the old
      sliding-flow wrapper.
    - Developer docs tests now require the table-qualified export endpoint and
      require old endpoint mentions to be marked rejected/deprecated.
  - Re-verification after third fix:
    - `test_0201_route_local_ast_contract`: `5 passed, 0 failed out of 5`.
    - `test_0361_minimal_submit_import_export_contract`: `4 passed, 0 failed out of 4`.
    - `test_0425_slide_app_subtable_install_contract`: `5 passed, 0 failed out of 5`.
    - Static scan for `/api/slide-apps/${modelId}/export.zip` outside
      `docs/iterations/**`: no matches.
    - `git diff --check`: no output.
  - Sub-agent review after the fourth Step 3 pass: `APPROVED`.
    - Findings: none.
    - Open questions: none.
    - Verification gaps: none.
- Result: PASS
- Commit:

### Step 4: Docs And Developer Examples Alignment

- Command:
  - `node scripts/tests/test_0425_doc_examples_model_ref_contract.mjs`
  - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
  - `rg -n 'legacy host-table|legacy/current key|属于后续实现目标|App instance table 的 \`model\\.subtableconnection\` 边界属于 0431 target / follow-up' docs/user-guide/slide-app-runtime docs/ssot/runtime_semantics_modeltable_driven.md --glob '!docs/iterations/**'`
  - `git diff --check -- docs/user-guide docs/ssot/runtime_semantics_modeltable_driven.md scripts/tests/test_0425_doc_examples_model_ref_contract.mjs docs/iterations/0432-subtable-connection-impl/runlog.md`
- Key output:
  - `test_0425_doc_examples_model_ref_contract`: `6 passed, 0 failed out of 6`.
  - `test_0361_minimal_submit_import_export_contract`: `4 passed, 0 failed out of 4`.
  - Negative wording scan: no matches.
  - `git diff --check`: no output.
  - Documentation changes:
    - `slide_app_runtime_developer_guide.md` now describes App instance table
      install as current behavior, not 0431 follow-up.
    - `minimal_submit_app_provider_*` docs now describe current
      `model.subtableconnection` / `model.subtable` installation behavior and
      table-qualified export route.
    - `slide_app_runtime_flow_visualized.html` now visualizes the current App
      table path instead of calling it future-only.
    - `runtime_semantics_modeltable_driven.md` no longer calls the old
      host-table installer the current egress-binding fact.
    - `test_0425_doc_examples_model_ref_contract.mjs` now guards against
      reintroducing the old host-table/current-target wording in these docs.
  - Sub-agent review after the first Step 4 pass: `CHANGE_REQUESTED`.
    - Finding: `runtime_semantics_modeltable_driven.md` still described
      table-qualified App instance namespace as future-only in one section.
    - Finding: the payload section still called bare model-id metadata a
      current v1 host-table fact.
    - Verification gap: the doc test did not scan for `目标实现后`,
      `后续实现债务`, or `current v1 host-table implementation fact`.
  - Fix after review:
    - Runtime semantics now states App instance traffic uses
      table-qualified `ModelRef` and child-table boundaries as current runtime
      semantics, while limiting principal desktop table wording to the broader
      multi-user isolation target.
    - Payload semantics now says bare `origin_model_id` /
      `reply_target_model_id` is insufficient for App instance traffic and is
      not a valid principal-scoped contract.
    - `test_0425_doc_examples_model_ref_contract` now rejects the reviewed old
      wording.
  - Re-verification after fix:
    - `test_0425_doc_examples_model_ref_contract`: `6 passed, 0 failed out of 6`.
    - `test_0361_minimal_submit_import_export_contract`: `4 passed, 0 failed out of 4`.
    - Expanded negative wording scan: no matches.
    - `git diff --check`: no output.
  - Sub-agent review after the second Step 4 pass: `APPROVED`.
    - Findings: none.
    - Open questions: none.
    - Verification gaps: none.
- Result: PASS
- Commit:

### Step 5: Local Deployment And Browser Verification

- Command:
  - `bash scripts/ops/deploy_local.sh`
  - `DOCKER_BUILDKIT=0 SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs`
  - `node scripts/tests/test_0311_workspace_pin_addressing_server_flow.mjs`
  - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
  - `node scripts/tests/test_0425_doc_examples_model_ref_contract.mjs`
  - `node scripts/tests/test_0432_fixture_submt_connection_contract.mjs`
  - `DY_PW_SESSION=dy-0432 scripts/ops/playwright_session_guard.sh session open http://127.0.0.1:30900/ --headed`
  - `DY_PW_SESSION=dy-0432 scripts/ops/playwright_session_guard.sh session click e85`
  - `DY_PW_SESSION=dy-0432 scripts/ops/playwright_session_guard.sh session click e91`
  - `DY_PW_SESSION=dy-0432 scripts/ops/playwright_session_guard.sh session screenshot --filename output/playwright/0432-subtable-connection-impl/todo-board-loaded.png`
  - `DY_PW_SESSION=dy-0432 scripts/ops/playwright_session_guard.sh cleanup`
  - `DY_PW_SESSION=dy-0432 scripts/ops/playwright_session_guard.sh check-clean`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
  - `kubectl -n dongyu set env deployment/ui-server DY_AUTH=0`
  - `kubectl -n dongyu rollout status deploy/ui-server --timeout=180s`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `DY_PW_SESSION=dy-0432-install scripts/ops/playwright_session_guard.sh session open http://127.0.0.1:30900/ --headed`
  - `DY_PW_SESSION=dy-0432-install scripts/ops/playwright_session_guard.sh session click e73`
  - `DY_PW_SESSION=dy-0432-install scripts/ops/playwright_session_guard.sh session click e261`
  - `DY_PW_SESSION=dy-0432-install scripts/ops/playwright_session_guard.sh session click e325`
  - `DY_PW_SESSION=dy-0432-install scripts/ops/playwright_session_guard.sh session screenshot --filename output/playwright/0432-subtable-connection-impl/workspace-manager-install-open.png --full-page`
  - `DY_PW_SESSION=dy-0432-install scripts/ops/playwright_session_guard.sh cleanup`
  - `DY_PW_SESSION=dy-0432-install scripts/ops/playwright_session_guard.sh check-clean`
  - `kubectl -n dongyu set env deployment/ui-server DY_AUTH=1`
  - `kubectl -n dongyu rollout status deploy/ui-server --timeout=180s`
  - `bash scripts/ops/check_runtime_baseline.sh`
- Key output:
  - First deploy attempt failed before build at remote Matrix bootstrap:
    Python `urllib` HTTPS handshake returned
    `ssl.SSLEOFError: UNEXPECTED_EOF_WHILE_READING` while requesting remote
    Matrix token / room setup.
  - Root-cause boundary: local `deploy/env/local.generated.env` already had a
    valid Matrix room and tokens, so re-running with `SKIP_MATRIX_BOOTSTRAP=1`
    avoided the failing external login/bootstrap boundary.
  - BuildKit attempt stalled in `bun install`; classic builder completed after
    slow npm/Bun dependency fetches.
  - Successful local deploy:
    - `dy-ui-server:v1` built and tagged.
    - `dy-remote-worker:v3` built and tagged.
    - `dy-mbr-worker:v2` built and tagged.
    - `ui-server`, `mbr-worker`, `remote-worker`, and `workspace-manager`
      rollout completed.
  - Baseline gate:
    - all deployments ready: `mosquitto`, `synapse`, `remote-worker`,
      `workspace-manager`, `mbr-worker`, `ui-server`.
    - no terminating pods for active workers.
    - `mbr-worker-secret.MODELTABLE_PATCH_JSON` ready.
    - `ui-server-secret.MODELTABLE_PATCH_JSON` ready.
  - Browser verification:
    - Opened `http://127.0.0.1:30900/` in a real Playwright browser.
    - Desktop rendered in guest read-only mode with built-in apps and slid-in
      apps visible.
    - Opened `E2E 颜色生成器`; it rendered route table, color value, input,
      Generate button, and status labels. It did not remain in loading state.
    - Returned to desktop and opened slid-in `To Do Board` (`Workspace app ·
      model 1087`); it rendered the full kanban board with tabs, columns, task
      cards, and `ready` status. It did not remain on `正在加载滑动 APP...`.
    - The only observed console error was `/auth/me` returning `401`, expected
      for guest read-only mode and not a slide app load failure.
    - Screenshot evidence saved under ignored path:
      `output/playwright/0432-subtable-connection-impl/todo-board-loaded.png`.
    - Playwright session cleanup: `PASS`, no project session or browser process
      remained.
  - Workspace Manager install/open gap closure:
    - Initial focused `0384` re-run exposed an export-boundary regression:
      exporting provider model `100` returned `invalid_target:
      slide_root_must_be_model_table` because model `100` is a host child model
      (`model.submt`) while exported slide-app payloads must be standalone
      temporary `model.table` records.
    - Fixed export normalization so only the exported root-model `model_type`
      record is converted from `model.submt` / `model.subtable` to
      `model.table`. The source runtime state still keeps the child
      declaration unchanged.
    - `test_0384_provider_owned_slide_app_install_flow`: `10 passed, 0 failed
      out of 10`.
    - Guest read-only browser still hides Workspace Manager by design because
      it references an `app:write` restricted model. For the write-path browser
      E2E only, local `ui-server` was temporarily switched to `DY_AUTH=0`.
    - With `DY_AUTH=0`, real browser opened `工作区管理器` (`Workspace app ·
      model 1051`), clicked `最小 Submit 双总线示例` -> `安装`, observed Dialog
      `安装完毕` with new app table ref
      `app:local-dev:submit:2-0-20:1/0`, clicked `打开`, and rendered the newly
      installed slide app as `Workspace app · model 0` with input, `Submit`,
      `Waiting for submit`, and `REMOTE ready`.
    - Snapshot evidence:
      `output/playwright/0432-subtable-connection-impl/workspace-manager-install-open.snapshot.txt`
      and
      `output/playwright/0432-subtable-connection-impl/workspace-manager-install-open-reloaded.snapshot.txt`.
    - Screenshot evidence:
      `output/playwright/0432-subtable-connection-impl/workspace-manager-install-open.png`.
    - Dedicated Playwright session cleanup: `PASS`, no project session or
      browser process remained.
    - Restored local `ui-server` to `DY_AUTH=1`; final baseline returned
      `baseline ready`.
  - Focused re-verification after browser gap closure:
    - `test_0384_provider_owned_slide_app_install_flow`: `10 passed, 0 failed
      out of 10`.
    - `test_0425_frontend_model_ref_projection_contract`: `11 passed, 0 failed
      out of 11`.
    - `test_0405_todo_slide_app_contract`: `3 passed, 0 failed out of 3`.
    - `test_0201_route_local_ast_contract`: `5 passed, 0 failed out of 5`.
    - `test_0290_slide_app_filltable_create_server_flow`: `1 passed, 0 failed
      out of 1`.
    - `test_0311_workspace_pin_addressing_server_flow`: `1 passed, 0 failed
      out of 1`.
    - `test_0361_minimal_submit_import_export_contract`: `4 passed, 0 failed
      out of 4`.
    - `test_0425_doc_examples_model_ref_contract`: all six doc checks `PASS`.
    - `test_0432_fixture_submt_connection_contract`: `PASS`.
    - `git diff --check`: no output.
  - Sub-agent review after Step 5 browser gap closure: `APPROVED`.
    - Findings: none.
    - Open questions: none.
    - Verification gaps: none.
- Result: PASS
- Commit:

### Final Review

- Command:
  - `node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs`
  - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
  - `node scripts/tests/test_0302_slide_app_zip_import_contract.mjs`
  - `node scripts/tests/test_0312_slide_import_cache_contract.mjs`
  - `node scripts/validate_builtins_v0.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `node scripts/tests/test_0306_model100_pin_chain_contract.mjs`
  - `node scripts/tests/test_0383_matrix_suite_slide_app_contract.mjs`
  - `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
  - `node scripts/tests/test_model_in_out.mjs`
  - `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
  - `node scripts/tests/test_0294_runtime_pin_contract.mjs`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `DY_PW_SESSION=dy-0432-install scripts/ops/playwright_session_guard.sh check-clean`
  - `DY_PW_SESSION=dy-0432 scripts/ops/playwright_session_guard.sh check-clean`
  - `git diff --check`
  - Final sub-agent review round 1.
  - `node scripts/tests/test_0182_app_shell_route_sync_contract.mjs`
  - `node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs`
  - `node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `node scripts/tests/test_0311_workspace_pin_addressing_server_flow.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `DOCKER_BUILDKIT=0 SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `DY_PW_SESSION=dy-0432-final scripts/ops/playwright_session_guard.sh session open http://127.0.0.1:30900/ --headed`
  - `DY_PW_SESSION=dy-0432-final scripts/ops/playwright_session_guard.sh session click e111`
  - `DY_PW_SESSION=dy-0432-final scripts/ops/playwright_session_guard.sh session screenshot --filename output/playwright/0432-subtable-connection-impl/final-app-table-root-open-after-shell-ref-fix.png --full-page`
  - `DY_PW_SESSION=dy-0432-final scripts/ops/playwright_session_guard.sh cleanup`
  - `DY_PW_SESSION=dy-0432-final scripts/ops/playwright_session_guard.sh check-clean`
  - `kubectl -n dongyu set env deployment/ui-server DY_AUTH-`
  - `kubectl -n dongyu rollout status deploy/ui-server --timeout=180s`
  - `bash scripts/ops/check_runtime_baseline.sh`
- Key output:
  - `test_0432_subtable_connection_runtime_contract`: `30 passed, 0 failed out of 30`.
  - `test_0425_slide_app_subtable_install_contract`: `5 passed, 0 failed out of 5`.
  - `test_0302_slide_app_zip_import_contract`: `4 passed, 0 failed out of 4`.
  - `test_0312_slide_import_cache_contract`: `3 passed, 0 failed out of 3`.
  - `validate_builtins_v0`: all validation groups `PASS`.
  - `validate_ui_ast_v0x --case all`: `summary: PASS`.
  - `test_0306_model100_pin_chain_contract`: `3 passed, 0 failed out of 3`.
  - `test_0383_matrix_suite_slide_app_contract`: `5 passed, 0 failed out of 5`.
  - `test_0399_matrix_chat_app_ux_contract`: `7 passed, 0 failed out of 7`.
  - `test_model_in_out`: `8 passed, 0 failed out of 8`.
  - `test_0326_ui_event_busin_flow`: `31 passed, 0 failed out of 31`.
  - `test_0294_runtime_pin_contract`: `4 passed, 0 failed out of 4`.
  - `check_runtime_baseline`: `baseline ready`.
  - Playwright session guards: no project browser/session remains for
    `dy-0432-install` or `dy-0432`.
  - `git diff --check`: no output.
  - Final sub-agent review round 1: `CHANGE_REQUESTED`.
    - Finding: `/workspace` route sync still treated
      `ws_app_selected_ref={ table_id, model_id: 0 }` as unresolved because it
      only checked bare `ws_app_selected`.
    - Finding: shell route selection still read/wrote bare `ws_app_selected`
      and could fall back app table root `0` to host model `100`.
    - Finding: remote desktop foreground derived writes did not write
      `ws_app_selected_ref`.
  - Fix after review:
    - `app_shell_route_sync.js` now reads `ws_app_selected_ref` first and only
      treats `host|0` as unresolved; app-table `model_id=0` is valid.
    - `demo_app.js` now resolves and writes table-qualified workspace app refs,
      including `ws_app_selected_ref`, `selected_model_id`, and scalar
      `ws_app_selected` as auxiliary state.
    - `remote_store.js` desktop foreground derived writes now include
      `ws_app_selected_ref`.
    - `test_0182_app_shell_route_sync_contract` now covers app-table root
      `model_id=0`.
    - `test_0425_frontend_model_ref_projection_contract` now asserts shell and
      remote foreground sync write table-qualified workspace refs.
  - Re-verification after final review fix:
    - `test_0182_app_shell_route_sync_contract`: `PASS`.
    - `test_0425_frontend_model_ref_projection_contract`: `12 passed, 0 failed
      out of 12`.
    - `test_0201_route_local_ast_contract`: `5 passed, 0 failed out of 5`.
    - `test_0311_workspace_pin_addressing_server_flow`: `1 passed, 0 failed
      out of 1`.
    - `test_0384_provider_owned_slide_app_install_flow`: `10 passed, 0 failed
      out of 10`.
    - Frontend production build: `vite build` completed successfully.
    - Local redeploy completed successfully and final baseline returned
      `baseline ready`.
    - Browser evidence after shell-ref fix:
      - guest opened slid-in `To Do Board` without loading hang.
      - temporary local write-path check opened app-table root
        `最小 Submit 双总线示例` as `Workspace app · model 0`, with textbox,
        `Submit`, `Waiting for submit`, and `REMOTE ready`.
      - evidence files:
        `output/playwright/0432-subtable-connection-impl/final-todo-loaded-after-shell-ref-fix.png`,
        `output/playwright/0432-subtable-connection-impl/final-app-table-root-open-after-shell-ref-fix.snapshot.txt`,
        and
        `output/playwright/0432-subtable-connection-impl/final-app-table-root-open-after-shell-ref-fix.png`.
    - Dedicated final Playwright session cleanup: `PASS`.
    - Temporary `DY_AUTH=0` was removed from `ui-server`; final baseline after
      rollout returned `baseline ready`.
  - Final sub-agent review round 2 after shell-ref fix: `APPROVED`.
    - Findings: none.
    - Open questions: none.
    - Verification gaps: none.
- Result: PASS
- Commit:

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/ssot/label_type_registry.md` reviewed
- [x] `docs/ssot/principal_scoped_subtable_namespace_v1.md` reviewed
- [x] `docs/user-guide/slide-app-runtime/*.md` reviewed
- [x] `docs/user-guide/slide-app-runtime/*.html` reviewed

### Post-Final SSO Live-Gate Probe

- Trigger: local browser SSO login still reported
  `{"ok":false,"error":"oidc_network_error:tls_certificate"}` after the user
  pointed out the login path had not been fully verified.
- Local fix:
  - `oidcFetch` now only uses an outbound proxy when
    `DY_OIDC_PROXY_URL` or `DY_OUTBOUND_PROXY_URL` is explicitly configured.
    It no longer inherits ambient `HTTPS_PROXY` / `HTTP_PROXY` /
    `ALL_PROXY`.
  - `describeOidcNetworkError` classifies `unexpected eof while reading` as
    `socket_closed`.
- Verification:
  - `node scripts/tests/test_0432_oidc_outbound_fetch_contract.mjs`: PASS.
  - `node scripts/tests/test_0403_deploy_sso_env_contract.mjs`: PASS.
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`: `15 passed, 0 failed out of 15`.
  - `node --check packages/ui-model-demo-server/auth.mjs`: PASS.
  - `git diff --check`: PASS.
  - Local image rebuilt with `docker build -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`.
  - Local `ui-server` rollout completed with
    `kubectl -n dongyu rollout restart deployment/ui-server` and
    `kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`.
  - Runtime probe inside the deployed pod:
    - `resolveOidcFetchProxyUrl(process.env, "https://sso.dongyudigital.com")`
      returned an empty string when no explicit proxy was configured.
    - `describeOidcNetworkError(new Error("SSL routines::unexpected eof while reading")).kind`
      returned `socket_closed`.
- Live remote evidence:
  - DNS for `sso.dongyudigital.com`, `app.dongyudigital.com`, and
    `matrix.dongyudigital.com` resolves to `124.71.43.80`.
  - Direct TCP to `124.71.43.80:22`, `:80`, and `:443` connects.
  - Direct HTTPS to all three public domains fails after about 5 seconds with
    `TLS connect error: unexpected eof while reading`; `openssl s_client`
    receives no peer certificate.
  - Direct HTTP returns an empty reply after about 5 seconds.
  - SSH to `drop@124.71.43.80`, `wwpic@124.71.43.80`, and
    `root@124.71.43.80` connects, sends the local SSH version string, then the
    remote closes before returning an SSH banner.
  - Local deployed `/auth/sso/start?returnTo=%2F` still returns
    `HTTP/1.1 500` with
    `{"ok":false,"error":"oidc_network_error:tls_certificate"}` because the
    server cannot fetch remote OIDC metadata.
  - Real Playwright browser verification opened
    `http://127.0.0.1:30900/auth/sso/start?returnTo=%2F` and saw the same JSON
    error. Screenshot:
    `output/playwright/0432-sso-remote-tls-blocker.png`.
- Sub-agent review:
  - Round 1: `CHANGE_REQUESTED`.
    - Finding: ambient proxy inheritance was too broad.
    - Finding: TLS EOF classification was not explicit enough.
  - Fixes were applied as listed above.
  - Round 2: `CHANGE_REQUESTED`.
    - Finding: Bun can use `HTTP_PROXY` / `HTTPS_PROXY` as global fetch proxy,
      so not setting `proxy` was still not explicit enough.
    - Finding: TLS close wording without the word `socket` could still be
      classified as `tls_certificate`.
  - Fix after round 2:
    - direct OIDC fetch now passes `proxy: ""`.
    - explicit `DY_OIDC_PROXY_URL` / `DY_OUTBOUND_PROXY_URL` still wins and
      passes the configured proxy URL.
    - `TLS connection closed before secure connection was established` and
      `unexpected eof while reading` are classified as `socket_closed`.
    - `test_0432_oidc_outbound_fetch_contract` now covers resolver, fetch init,
      and the actual `oidcFetch` wrapper passing `proxy: ""`.
  - Re-verification after round 2:
    - `test_0432_oidc_outbound_fetch_contract`: PASS.
    - `test_0403_deploy_sso_env_contract`: PASS.
    - `test_0403_oidc_session_gateway`: `15 passed, 0 failed out of 15`.
    - `node --check packages/ui-model-demo-server/auth.mjs`: PASS.
    - `git diff --check`: PASS.
    - Local image rebuilt and `ui-server` rollout completed.
    - Pod probe returned `{"proxy":"","eof":"socket_closed","closed":"socket_closed"}`.
    - Real Playwright browser verification still shows the same SSO network
      failure because the remote issuer is unreachable at protocol level.
      Screenshot:
      `output/playwright/0432-sso-remote-tls-blocker-after-proxy-fix.png`.
  - Round 3: `APPROVED`.
    - Findings: none.
    - Open questions: none.
    - Verification gaps: none.
- Current adjudication:
  - Local SSO implementation and deployment path are verified to the point
    reachable from this machine.
  - Completing a full browser login is blocked by the remote public host /
    ingress at `124.71.43.80`, which accepts TCP but does not return HTTP,
    TLS, or SSH protocol handshakes.
