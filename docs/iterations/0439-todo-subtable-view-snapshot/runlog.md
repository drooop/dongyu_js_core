---
title: "Iteration 0439 To Do Subtable View Snapshot Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-07-06
source: ai
iteration_id: 0439-todo-subtable-view-snapshot
id: 0439-todo-subtable-view-snapshot
phase: phase1
---

# Iteration 0439-todo-subtable-view-snapshot Runlog

## Environment

- Date: 2026-07-06
- Branch: `dropx/dev_0439-todo-subtable-view-snapshot`
- Starting commit: `be5e27e` (`Merge branch 'dropx/dev_0438-app-open-frontend-latency' into dev`)
- Starting state:
  - `E2E 颜色生成器` already has seeded App table coverage from 0434/0435.
  - 0438 browser evidence showed `To Do Board` still opening through host model `1086`.

## Review Gate Records

Review Gate Record
- Iteration ID: 0439-todo-subtable-view-snapshot
- Review Date: 2026-07-06
- Review Type: AI-assisted
- Review Index: 1
- Decision: Approved
- Notes: Workflow review found the iteration registered before code work, Phase 1 docs-only scope preserved, Step 2 starts with RED test, and verification/rollback are explicit.

Review Gate Record
- Iteration ID: 0439-todo-subtable-view-snapshot
- Review Date: 2026-07-06
- Review Type: AI-assisted
- Review Index: 2
- Decision: Approved
- Notes: SSOT review found the plan aligned with `model.subtable` child-side declaration, host-side `model.subtableconnection`, table-qualified ModelRef, and principal-scoped table isolation.

Review Gate Record
- Iteration ID: 0439-todo-subtable-view-snapshot
- Review Date: 2026-07-06
- Review Type: AI-assisted
- Review Index: 3
- Decision: Approved
- Notes: Verification review found deterministic tests, local deploy, browser proof, docs update, and rollback coverage sufficient for a bounded To Do migration slice.

## Execution Records

### Step 1 — Planning Gate

- Command:
  - `git switch -c dropx/dev_0439-todo-subtable-view-snapshot`
  - Manual Phase 1 docs update with `apply_patch`.
- Key output:
  - Created `docs/iterations/0439-todo-subtable-view-snapshot/plan.md`.
  - Created `docs/iterations/0439-todo-subtable-view-snapshot/resolution.md`.
  - Created `docs/iterations/0439-todo-subtable-view-snapshot/runlog.md`.
  - Registered 0439 in `docs/ITERATIONS.md` as `Approved` after three AI-assisted gate reviews.
  - `git diff --check`: PASS.
- Result: PASS
- Commit:
  - `52aa9ad docs(iteration): plan todo subtable migration [0439]`

### Step 2 — RED Contract For To Do App Table Migration

- Command:
  - `node scripts/tests/test_0439_todo_subtable_view_snapshot_contract.mjs`
- Key output:
  - `[FAIL] test_todo_board_is_registered_only_as_principal_app_table: host_model1086_must_not_remain_todo_workspace_app_entry`
  - Failure showed current registry entry: `table_id: "host"`, `model_id: 1086`, `name: "To Do Board"`, `app_origin: "builtin"`.
  - `[FAIL] test_seeded_todo_board_is_principal_scoped: new_principal_must_create_own_todo_board_app_table`
  - `[FAIL] test_visible_snapshot_for_todo_returns_target_app_table_only: todo_board_app_table_entry_required_for_visible_snapshot_test`
  - `[FAIL] test_cross_principal_visible_snapshot_rejects_other_todo_table: drop_test_todo_app_table_required_for_cross_principal_test`
  - `0 passed, 4 failed out of 4`
- Result: RED PASS

### Step 3 — Materialize To Do Board As A Principal-Scoped App Table

- Changed:
  - Added `To Do Board` to seeded App table migration.
  - Removed host `1086` from user-facing Workspace allowlists and static Workspace registry.
  - Kept host `1086` as source template.
  - Updated To Do behavior tests to dispatch through generated App-table ingress.
- Commands:
  - `node scripts/tests/test_0439_todo_subtable_view_snapshot_contract.mjs`
  - `node scripts/tests/test_0405_todo_slide_app_contract.mjs`
  - `node scripts/tests/test_0412_todo_provider_app1_contract.mjs`
  - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
  - `node scripts/tests/test_0434_first_slid_in_app_subtable_contract.mjs`
  - `node scripts/tests/test_0438_app_open_frontend_latency_contract.mjs`
- Key output:
  - `test_0439_todo_subtable_view_snapshot_contract`: `6 passed, 0 failed out of 6`
  - `test_0405_todo_slide_app_contract`: `4 passed, 0 failed out of 4`
  - `test_0412_todo_provider_app1_contract`: PASS
  - `test_0425_slide_app_subtable_install_contract`: `5 passed, 0 failed`
  - `test_0434_first_slid_in_app_subtable_contract`: `5 passed, 0 failed`
  - `test_0438_app_open_frontend_latency_contract`: `6 passed, 0 failed`
- Result: PASS

### Step 4 — Snapshot Granularity And Multi-User Isolation Proof

- Commands:
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
  - `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
  - `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
  - `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
  - `node scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs`
  - `node scripts/tests/test_0425_principal_desktop_state_contract.mjs`
  - `node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs`
- Key output:
  - `test_0418_visible_snapshot_projection_latency_contract`: PASS `8/8`
  - `test_0423_snapshot_granularity_contract`: `13 passed`
  - `test_0425_visible_model_refs_contract`: `7 passed, 0 failed`
  - `test_0435_visible_snapshot_app_slimming_contract`: `2 passed, 0 failed`
  - `test_0436_runtime_snapshot_build_latency_contract`: `6 passed, 0 failed`
  - `test_0437_bootstrap_sse_first_packet_latency_contract`: `4 passed, 0 failed`
  - `test_0425_principal_desktop_state_contract`: `6 passed`
  - `test_0426_snapshot_patch_recovery_contract`: `4 passed, 0 failed`
- Result: PASS

### Step 5 — Documentation, Local Deploy, Browser Verification, Closeout

- Docs:
  - Updated `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md` with subtable authoring checklist, host source migration steps, target-only visible snapshot guidance, and principal isolation rules.
  - Added 0439 doc guard assertions to `test_0439_todo_subtable_view_snapshot_contract.mjs`.
- Commands:
  - `node scripts/tests/test_0350_slide_app_runtime_user_guide_contract.mjs`
  - `node scripts/tests/test_0425_doc_examples_model_ref_contract.mjs`
  - `node scripts/tests/test_0382_workspace_entry_cleanup_contract.mjs`
  - `node scripts/tests/test_0390_focused_app_shell_settings_contract.mjs`
  - `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Key output:
  - `test_0350_slide_app_runtime_user_guide_contract`: ok true
  - `test_0425_doc_examples_model_ref_contract`: ok true
  - `test_0382_workspace_entry_cleanup_contract`: PASS
  - `test_0390_focused_app_shell_settings_contract`: `15 passed, 0 failed out of 15`
  - `test_0289_slide_workspace_generalization_server_flow`: `1 passed, 0 failed out of 1`
  - Frontend build: PASS; Vite emitted the existing large chunk warning.
  - Local deploy: PASS; UI Server available at `http://localhost:30900`, all app pods Running.
- Browser evidence:
  - Fake-login opened `http://localhost:30900/`.
  - Desktop showed `From UI Server To Do Board` under `Slid in from DE`, not under Built-in.
  - Opening `To Do Board` rendered `Workspace app · model 0`.
  - Page state confirmed foreground `{ table_id: "app:drop:to-do-board:2-0-21:2", model_id: 0 }` with `source_de: "UI Server"`.
  - Page snapshot tables included only `app:drop:to-do-board:2-0-21:2`; host `1086` was absent.
  - Clicking first task `开始` changed `task_seed_1` from `todo` to `doing` in that App table `tasks_json`.
- Review:
  - AI-assisted local diff review: no blocking findings.
- Result: PASS

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
- [x] `docs/ssot/principal_scoped_subtable_namespace_v1.md` reviewed
- [x] `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md` updated
