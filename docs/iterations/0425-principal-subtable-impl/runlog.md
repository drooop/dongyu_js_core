---
title: "Iteration 0425 Principal-Scoped Subtable Implementation Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-06-24
source: ai
iteration_id: 0425-principal-subtable-impl
id: 0425-principal-subtable-impl
---

# Iteration 0425-principal-subtable-impl Runlog

## Environment

- Branch: `dropx/dev_0425-principal-subtable-impl`
- Scope: runtime/frontend implementation for the 0424 SSOT target.
- Pre-existing dirty worktree note: branch was created from `dropx/dev_0424-principal-subtable-ssot` with existing uncommitted 0423/0424 docs and runtime files present. This runlog records only 0425 implementation actions from this point onward.

## Stage 0: Registration And Baseline

Status: COMPLETED

Commands:

```bash
git status --short --branch
git log --oneline -8 --decorate
rg -n "0424-principal-subtable-ssot|0425|principal.*subtable|subtable" docs/ITERATIONS.md docs/iterations docs/ssot packages scripts | head -n 200
rg -n "model_id|visibleModel|snapshot|table_id|submt|parentChild|selected_model|foreground|task_stack|DY_AUTH|principal|session" packages/ui-model-demo-server packages/ui-model-demo-frontend packages/ui-renderer packages/worker-base scripts/tests | head -n 240
```

Observed:

- 0424 SSOT is completed but still uncommitted in the current dirty worktree.
- 0423 snapshot granularity code and tests are present in the dirty worktree before 0425 starts.
- Existing server/frontend snapshot path already has `bootstrap` / `visible` profiles and bare `visibleModelIds`.
- 0425 must extend that path to table-qualified refs without restoring legacy connection semantics.

Sub-agent review 1:

```text
Decision: CHANGE_REQUESTED

Findings:
- [medium] docs/iterations/0425-principal-subtable-impl/plan.md:46 — `plan.md` 仍保留 11 项 Stage Plan，和 `CLAUDE.md` 对 `plan.md` “WHAT/WHY、不写步骤”的边界冲突；执行步骤应只保留在 `resolution.md`，否则后续容易双源漂移。
- [medium] docs/iterations/0425-principal-subtable-impl/resolution.md:212 — Stage 8 标题覆盖 install/export，但验收只定义 install/materialization，没有定义 table-qualified export 的正确结果；0424 SSOT 要求 import/export 都保留 package-local id 语义。
- [low] docs/iterations/0425-principal-subtable-impl/resolution.md:272 — Final verification 只有 frontend build，没有跑现有 frontend test；0425 会改 `remote_store`、projection/cache、renderer 和 URL 构造，build-only 覆盖不足。

Open questions:
- Stage 8 是否有意把 export 排除在 0425 外？如果是，需要写入 Non-Goal 或 follow-up debt。

Verification gaps:
- 缺 table-qualified export 的确定性检查，或明确记录 export 不在 0425 范围内。
- 缺 `npm -C packages/ui-model-demo-frontend run test`，或说明 0425 定向脚本为何可替代它。
- 缺单一执行源声明：`resolution.md` 是唯一 stage execution source，`plan.md` 不应保留步骤清单。
```

Fixes applied:

- Replaced `plan.md` stage list with an implementation scope summary and made `resolution.md` the single execution source.
- Expanded Stage 8 to cover install/export and added package-local export acceptance requirements.
- Added `npm -C packages/ui-model-demo-frontend run test` to final verification.

Sub-agent review 2:

```text
Decision: APPROVED

Findings: none

Open questions: none

Verification gaps: none
```

Result: PASS. Stage 0 can proceed to implementation.

## Stage 1: ModelRef Utilities And Current Table Context

Status: REVIEW

Pre-existing partial implementation note:

- `packages/ui-model-demo-frontend/src/model_ref.js` and `scripts/tests/test_0425_model_ref_contract.mjs` already existed in the dirty worktree when Stage 1 started after the interrupted run.
- Stage 1 treated them as the current implementation slice and verified them instead of recreating duplicate files.

Commands:

```bash
node scripts/tests/test_0425_model_ref_contract.mjs
rg -n "HOST_TABLE_ID|normalizeModelRef|normalizeLabelRef|currentModelRefForNode|getModel\\(|getLabelValue\\(|resolveRefForNode|table_id" packages/ui-renderer/src/renderer.mjs packages/ui-renderer/src/renderer.js packages/ui-model-demo-frontend/src/snapshot_utils.js packages/ui-model-demo-frontend/src/model_ref.js
```

Observed:

```json
{
  "ok": true,
  "results": [
    { "key": "model_ref_normalization", "status": "PASS" },
    { "key": "snapshot_label_reads_are_table_qualified", "status": "PASS" },
    { "key": "renderer_local_label_uses_current_table_context", "status": "PASS" },
    { "key": "renderer_rejects_invalid_current_table_context", "status": "PASS" }
  ]
}
```

Result: PASS, pending sub-agent review.

Sub-agent review 3:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] packages/ui-renderer/src/renderer.mjs:81, packages/ui-renderer/src/renderer.js:81 — `currentModelRefForNode` 会把缺少 `table_id` 的 `cell_ref` 通过 `defaultTableId: "host"` 归一化成 host ModelRef。这样 local `$label` 在当前上下文并不显式时仍会读取 host/global 同号模型。

Open questions:
- none

Verification gaps:
- `scripts/tests/test_0425_model_ref_contract.mjs` 缺少 renderer 负例：`cell_ref` 只有 `model_id`、没有 `table_id` 时，local `$label` 不得回退读取 host/global 同号模型。
```

RED:

```bash
node scripts/tests/test_0425_model_ref_contract.mjs
```

Observed failure:

```text
AssertionError [ERR_ASSERTION]: cjs: local $label must require explicit current table context and must not read host/global from bare cell_ref
'host title' !== ''
```

Fixes applied:

- Added the missing renderer negative test for bare `cell_ref`.
- Changed `currentModelRefForNode` and `currentCellRefForNode` in both ESM/CJS renderers to require explicit `table_id` for current context.
- Migrated `test_0407_current_model_ref_contract.mjs` host-table fixtures to explicit `table_id: "host"` cell refs instead of relying on bare host fallback.

GREEN:

```bash
node scripts/tests/test_0425_model_ref_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
```

Observed:

- `test_0425_model_ref_contract.mjs`: PASS.
- `test_0407_current_model_ref_contract.mjs`: 8 passed, 0 failed.

Result: PASS, pending sub-agent re-review.

Sub-agent plan review 1:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] resolution.md:79 — Stage 2 accepted/echoed `visible_model_ref` shape but did not require unauthorized principal/capability filtering before diffing or baseline reset on principal/capability changes.
- [high] plan.md:25 — Slide App install acceptance only required a child table boundary descriptor "for later full materialization", which could pass with host-table soft boundaries instead of App instance table materialization.
- [medium] plan.md:20 — table-qualified scope omitted payload/reply target metadata such as `origin_table_id` and `reply_target_table_id`.
- [medium] resolution.md:60 — renderer omitted-`table_id` rule did not say it is valid only under an explicit current table context and must not fall back to host/global model id.

Verification gaps:
- unauthorized `visibleModelRefs` / SSE subscription negative cases.
- two-browser/two-principal local validation.
- concrete local restart/redeploy and health evidence.
- snapshot/SSE payload evidence for table-qualified visible refs and patches.
```

Fixes applied:

- Updated `plan.md` done criteria to include authorized `visibleModelRefs`, principal/capability baseline reset, payload/reply table metadata, App instance table materialization, and same-provider multi-install/multi-principal isolation.
- Updated `docs/ITERATIONS.md` 0425 step count from `6` to `9` to match the expanded phase plan.
- Updated `resolution.md` Stage 1 to clarify omitted `table_id` is valid only under explicit current table context and cannot fall back to host/global ids.
- Updated `resolution.md` Stage 2 to require unauthorized `ModelRef` rejection/filtering before diffing, same-profile reset on principal/capability change, and negative tests.
- Added Stage 3 for frontend projection/renderer table-qualified cache behavior.
- Added Stage 4 for table-qualified payload/reply target metadata.
- Strengthened principal desktop state and slide App instance table materialization acceptance.
- Strengthened final local verification with local restart/redeploy command, two-principal browser validation, and snapshot/SSE payload evidence.

Sub-agent plan review 2:

```text
Decision: CHANGE_REQUESTED

Findings:
- [medium] resolution.md:193 — final verification listed `check_runtime_baseline.sh` before `ensure_runtime_baseline.sh`; `CLAUDE.md` requires ensure then check before local e2e/deploy-style validation.
- [medium] resolution.md:181 — final verification did not require the runlog to declare test classification before running local/browser validation.

Verification gaps:
- Previous review items are covered.
- Remaining gap is final verification protocol: baseline command order and classification recording.
```

Fixes applied:

- Reordered the then-current final verification stage to run `bash scripts/ops/ensure_runtime_baseline.sh` before `bash scripts/ops/check_runtime_baseline.sh`.
- Added final verification acceptance requiring runlog test classification before final verification: unit/contract, local stack deploy/health, browser e2e, and snapshot/SSE evidence capture.

Sub-agent plan review 3:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] docs/iterations/0425-principal-subtable-impl/plan.md:18 — Done Criteria still omit several mandatory 0424 SSOT implementation surfaces: runtime storage keys, parent/table mount maps, PIN route graph keys, persistence primary keys, and cleanup of docs/examples that still show bare installed `model_id`.
- [medium] docs/iterations/0425-principal-subtable-impl/resolution.md:14 — `resolution.md` has strategy, stages, files, and verification, but no rollback plan.

Verification gaps:
- Previous 7 review items are covered in the updated docs.
- Code implementation was not reviewed, per request.
- Re-review after adding the missing SSOT surfaces and rollback plan before entering implementation.
```

Fixes applied:

- Updated `plan.md` done criteria to require table-qualified runtime storage keys, parent/table mount maps, PIN route graph keys, persistence keys for new 0425 user/App writes, and developer example cleanup.
- Updated `docs/ITERATIONS.md` 0425 step count from `9` to `11` to match the expanded stage plan.
- Added `resolution.md` rollback plan with stage rollback boundaries and forbidden rollback shortcuts.
- Added Stage 2 for runtime table namespace, `model.subtable` mount maps, and PIN route graph tests.
- Added Stage 3 for persistence keys for new user/App table records.
- Added Stage 9 for developer example and guide cleanup.
- Updated final verification to include runtime namespace, persistence key, and doc example contract tests.

Sub-agent plan review 4:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] docs/iterations/0425-principal-subtable-impl/resolution.md:237 — Stage 9 only covers user-guide/example cleanup, but 0425 will change PIN routing, `model.subtable` / model type registry behavior, and payload/reply metadata. `CLAUDE.md` requires living-docs review for these surfaces, including `runtime_semantics_modeltable_driven.md`, `label_type_registry.md`, `modeltable_user_guide.md`, and `dam-worker-guide.md`; the 0424 SSOT also says runtime semantics, label registry, PIN contract, and temporary payload contract remain owning docs.

Verification gaps:
- Add a Stage 9 or final verification item that explicitly reviews/updates the mandatory living docs and records any unchanged file with reason in `runlog.md`.
- Code implementation was not reviewed, per request.
```

Fixes applied:

- Updated `plan.md` done criteria to require living docs review/update or explicit unchanged reasons in `runlog.md`.
- Expanded Stage 9 into living docs and developer example cleanup.
- Added mandatory review scope for `runtime_semantics_modeltable_driven.md`, `label_type_registry.md`, `pin_connection_contract_v2.md`, `temporary_modeltable_payload_v1.md`, `modeltable_user_guide.md`, and `dam-worker-guide.md`.
- Added Stage 9 verification searches for 0424 namespace references, `model.subtable`, `visibleModelRefs`, table-qualified payload metadata, and deprecated/cross-table pin terms.

Additional pre-review hardening:

- A fifth sub-agent review attempt was interrupted before a final `Decision` because it spawned a nested review agent and stalled. Its partial output identified a concrete verification risk: `ensure_runtime_baseline.sh` exits early when the old local stack is already healthy, so it cannot prove this branch was redeployed.
- Updated Stage 10 final verification to run `bash scripts/ops/deploy_local.sh` explicitly before `ensure_runtime_baseline.sh` and `check_runtime_baseline.sh`.
- Added Stage 10 acceptance that `ensure_runtime_baseline.sh` is not sufficient as the only deploy evidence.

Sub-agent plan review 5:

```text
Decision: APPROVED

Findings:
- none

Open questions:
- none

Verification gaps:
- none for the reviewed planning/registration docs. Code implementation and runtime behavior were intentionally not reviewed in this pass.
```

Outcome:

- Stage 0 planning, registration, rollback, and verification plan review is approved.
- Proceeding to Stage 1: ModelRef utilities and current table context.

## Stage 1: ModelRef Utilities And Current Table Context

Status: IN PROGRESS

TDD red:

```bash
node scripts/tests/test_0425_model_ref_contract.mjs
```

Observed:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../packages/ui-model-demo-frontend/src/model_ref.js'
```

Changes:

- Added `packages/ui-model-demo-frontend/src/model_ref.js` with `HOST_TABLE_ID`, `normalizeModelRef`, `modelRefKey`, `normalizeLabelRef`, and `labelRefKey`.
- Updated `packages/ui-model-demo-frontend/src/snapshot_utils.js` to read explicit `snapshot.tables[table_id].models[model_id]` and host refs.
- Updated `packages/ui-renderer/src/renderer.mjs` and `packages/ui-renderer/src/renderer.js` so local label refs inherit the current component `ModelRef` table context instead of resolving through a bare global `model_id`.
- Updated the existing 0407 current-model-ref test expectation so host-context targets are explicit `{ table_id: "host", model_id }`.

Verification:

```bash
node scripts/tests/test_0425_model_ref_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
node -e "import('./packages/ui-renderer/src/renderer.mjs').then((m)=>{ if (typeof m.createRenderer !== 'function') throw new Error('missing createRenderer'); console.log('renderer.mjs import PASS'); })"
git diff --check -- packages/ui-model-demo-frontend/src/model_ref.js packages/ui-model-demo-frontend/src/snapshot_utils.js packages/ui-renderer/src/renderer.mjs packages/ui-renderer/src/renderer.js scripts/tests/test_0425_model_ref_contract.mjs scripts/tests/test_0407_current_model_ref_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_model_ref_contract.mjs: PASS
test_0407_current_model_ref_contract.mjs: 8 passed, 0 failed out of 8
renderer.mjs import PASS
git diff --check: PASS
```

## Stage 9: Living Docs And Developer Example Cleanup

Status: REVIEW

Scope:

- Reviewed and updated the living docs that own the 0425 table-qualified App instance contract:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/temporary_modeltable_payload_v1.md`
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - `docs/ssot/ui_to_matrix_event_flow.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/handover/dam-worker-guide.md`
- Updated user-facing slide app runtime examples:
  - `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html`
  - `docs/user-guide/slide-app-runtime/mqtt_response_to_ui_materialization.md`
  - `docs/user-guide/slide-app-runtime/todo_save_mqtt_event_example.md`
  - `docs/user-guide/slide-app-runtime/workspace_manager_interaction_guide.md`
- Added `scripts/tests/test_0425_doc_examples_model_ref_contract.mjs` to prevent stale examples from reintroducing bare installed `model_id` wording.

Changes:

- Developer docs now say slide App install allocates an App instance `table_id`; package-local `model_id` values are preserved inside that table.
- Workspace mounting docs now say host Model 0 writes `model.subtable`, not a new App `model.submt` child model.
- Opening an installed App is documented as `visible_model_ref={table_id,model_id}`.
- Request / response examples now distinguish:
  - transport `endpoint_*`, which must remain host-table and match the MQTT topic;
  - table-qualified `origin_*` / `reply_target_*`, which identify the App instance for materialization.
- Export docs now use `/api/slide-apps/export.zip?table_id=<encoded-table-id>&model_id=0` for installed App instance tables; the legacy `/api/slide-apps/<modelId>/export.zip` route is documented only for host-table Apps.

Verification:

```bash
node scripts/tests/test_0425_doc_examples_model_ref_contract.mjs
rg -n '本地安装模型 id|安装后的本地模型 id|分配本地模型 id|分配本地 installed model id|正式正数模型|model\.submt.*APP|reply_target_worker_id / reply_target_model_id / reply_target_pin|UIPUT/ws/dam/pic/de/U1/2000/result|只按 `reply_target_model_id`|endpoint_\*` 必须等于 request 中的 `reply_target_\*|endpoint_\*.*与 `reply_target_\*` 一致' docs/user-guide docs/ssot docs/handover/dam-worker-guide.md
git diff --check docs/user-guide/modeltable_user_guide.md docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html docs/user-guide/slide-app-runtime/mqtt_response_to_ui_materialization.md docs/user-guide/slide-app-runtime/todo_save_mqtt_event_example.md docs/user-guide/slide-app-runtime/workspace_manager_interaction_guide.md docs/handover/dam-worker-guide.md docs/ssot/temporary_modeltable_payload_v1.md docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/label_type_registry.md docs/ssot/imported_slide_app_host_ingress_semantics_v1.md docs/ssot/ui_to_matrix_event_flow.md scripts/tests/test_0425_doc_examples_model_ref_contract.mjs
node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs
node scripts/tests/test_0425_table_qualified_payload_reply_contract.mjs
node scripts/tests/test_0425_visible_model_refs_contract.mjs
node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs
```

Observed:

```text
test_0425_doc_examples_model_ref_contract.mjs: 4 passed, 0 failed
stale wording rg: no matches
git diff --check: PASS
test_0425_slide_app_subtable_install_contract.mjs: 5 passed, 0 failed
test_0425_table_qualified_payload_reply_contract.mjs: 9 passed, 0 failed
test_0425_visible_model_refs_contract.mjs: 7 passed, 0 failed
test_0384_provider_owned_slide_app_install_flow.mjs: 8 passed, 0 failed
```

## Stage 8: Slide App Instance Table Materialization, Boundary, And Export

Status: IN PROGRESS

TDD target:

```bash
node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs
```

Changes:

- Added `scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`.
- Changed slide App ZIP/package installation so package-local non-negative `model_id` values are preserved inside a newly allocated App instance table.
- Added host-owned `model.subtable` mount records on host Model 0; host table stores the boundary descriptor, not the App-local mutable truth.
- Updated Workspace Manager install-complete labels and launch payloads to use `{ table_id, model_id }`.
- Updated workspace registry derivation so installed App tables appear as table-qualified workspace Apps and do not collide with host models using the same local id.
- Updated export so installed App instances export package-local ids and omit concrete host `table_id`, principal-only labels, and install-time state.
- Updated desktop delete to remove App instance tables by `table_id + model_id` without falling back to host; deletion also clears App-table route caches and the host `model.subtable` mount cell.
- Updated existing provider-owned install flow tests from global positive id expectations to table-qualified App instance expectations.

Verification:

```bash
node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs
node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs
node scripts/tests/test_0405_todo_slide_app_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
node scripts/tests/test_0425_visible_model_refs_contract.mjs
node scripts/tests/test_0425_principal_desktop_state_contract.mjs
node scripts/tests/test_0403_principal_authorization.mjs
git diff --check packages/ui-model-demo-server/server.mjs scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs scripts/tests/test_0425_slide_app_subtable_install_contract.mjs scripts/tests/test_0425_visible_model_refs_contract.mjs packages/ui-model-demo-frontend/src/desktop_app_state.js packages/ui-model-demo-frontend/src/demo_app.js
```

Observed:

```text
test_0425_slide_app_subtable_install_contract.mjs: 3 passed, 0 failed out of 3
test_0384_provider_owned_slide_app_install_flow.mjs: 7 passed, 0 failed out of 7
test_0405_todo_slide_app_contract.mjs: 3 passed, 0 failed out of 3
test_0407_current_model_ref_contract.mjs: 8 passed, 0 failed out of 8
test_0425_visible_model_refs_contract.mjs: 7 passed, 0 failed out of 7
test_0425_principal_desktop_state_contract.mjs: 6 passed
test_0403_principal_authorization.mjs: 6 passed, 0 failed out of 6
git diff --check: PASS
```

Sub-agent Stage 8 review 1:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] packages/ui-model-demo-server/server.mjs:3352 — resolveNextWorkspaceMountCell() only considers existing model.submt labels, so repeated model.subtable installs reuse the same host cell. The second install overwrites the first host-owned model.subtable boundary, leaving only the latest App table discoverable from host Model 0; principal-filtered snapshots then hide the first installed App table even though its table still exists.

Open questions:
- none

Verification gaps:
- Add a duplicate-install test that asserts host Model 0 keeps one model.subtable boundary per installed App table and that buildClientSnapshotForPrincipal() returns both duplicate App tables.
```

Fixes applied:

- Updated workspace mount-cell allocation to treat both `model.submt` and `model.subtable` labels as occupied host mount cells.
- Extended duplicate install coverage to assert one host `model.subtable` boundary per duplicate App table.
- Extended duplicate install coverage to assert principal-filtered snapshots keep both duplicate App tables.

Re-verification:

```bash
node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs
node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs
node scripts/tests/test_0425_visible_model_refs_contract.mjs
git diff --check packages/ui-model-demo-server/server.mjs scripts/tests/test_0425_slide_app_subtable_install_contract.mjs scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_slide_app_subtable_install_contract.mjs: 3 passed, 0 failed out of 3
test_0384_provider_owned_slide_app_install_flow.mjs: 7 passed, 0 failed out of 7
test_0425_visible_model_refs_contract.mjs: 7 passed, 0 failed out of 7
git diff --check: PASS
```

Sub-agent Stage 8 review 2:

```text
Decision: CHANGE_REQUESTED

Findings:
- [medium] packages/ui-model-demo-server/server.mjs:13172 — The public export route still accepts only /api/slide-apps/<numeric model_id>/export.zip and calls buildSlideAppExportZip() with a bare host model id. Installed App instances now live at { table_id, model_id }, and the registry also suppresses export_url for non-host App tables, so the Stage 8 “export installed App instance with package-local ids” contract is only reachable through the internal helper test, not through the actual server/registry export path. This leaves a host/global positive-model-id export path as the visible provider package export surface.

Open questions:
- none

Verification gaps:
- Add a route/registry-level export test for an installed App table, not only a direct buildSlideAppExportPayload(runtime, { table_id, model_id }) helper test.
- Add a direct two-principal same-provider install test proving two different principals get separate owner App tables for the same provider App.
```

Fixes applied:

- Added table-qualified export URLs for non-host App table registry entries: `/api/slide-apps/export.zip?table_id=...&model_id=...`.
- Kept the legacy host export URL for host-table slide Apps.
- Refactored the server export route through `handleSlideAppExportRequest()` so the actual route and tests share parsing/output logic.
- Added route/registry-level export coverage proving an installed App table zip downloads with package-local ids and without leaking the concrete `table_id`.
- Added two-principal same-provider install coverage proving two authenticated principals get distinct owner App tables for the same provider App.

Re-verification:

```bash
node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs
node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs
node scripts/tests/test_0425_visible_model_refs_contract.mjs
node scripts/tests/test_0405_todo_slide_app_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
node scripts/tests/test_0425_principal_desktop_state_contract.mjs
node scripts/tests/test_0403_principal_authorization.mjs
git diff --check packages/ui-model-demo-server/server.mjs scripts/tests/test_0425_slide_app_subtable_install_contract.mjs scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_slide_app_subtable_install_contract.mjs: 4 passed, 0 failed out of 4
test_0384_provider_owned_slide_app_install_flow.mjs: 8 passed, 0 failed out of 8
test_0425_visible_model_refs_contract.mjs: 7 passed, 0 failed out of 7
test_0405_todo_slide_app_contract.mjs: 3 passed, 0 failed out of 3
test_0407_current_model_ref_contract.mjs: 8 passed, 0 failed out of 8
test_0425_principal_desktop_state_contract.mjs: 6 passed
test_0403_principal_authorization.mjs: 6 passed, 0 failed out of 6
git diff --check: PASS
```

Sub-agent Stage 8 review 3:

```text
Decision: CHANGE_REQUESTED

Findings:
- [medium] packages/ui-model-demo-server/server.mjs:2988 — The new /api/slide-apps/export.zip query route still treats a missing table_id as "host", so /api/slide-apps/export.zip?model_id=100 remains a bare positive model_id export path. The preserved legacy host URL is acceptable, but the new table-qualified route should require explicit table_id; otherwise it reintroduces host/global fallback semantics in the Stage 8 export surface.

Open questions:
- none

Verification gaps:
- Add a negative test proving /api/slide-apps/export.zip?model_id=<id> without table_id is rejected, while the legacy /api/slide-apps/<id>/export.zip host path still works.
```

Fixes applied:

- Changed `/api/slide-apps/export.zip` query route parsing so `table_id` is required explicitly.
- Kept `/api/slide-apps/<id>/export.zip` as the only host bare-id compatibility surface.
- Added negative coverage for missing `table_id` on the query export route.
- Added positive coverage that the legacy host export URL still returns a zip.

Re-verification:

```bash
node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs
node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs
node scripts/tests/test_0425_visible_model_refs_contract.mjs
git diff --check packages/ui-model-demo-server/server.mjs scripts/tests/test_0425_slide_app_subtable_install_contract.mjs scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_slide_app_subtable_install_contract.mjs: 5 passed, 0 failed out of 5
test_0384_provider_owned_slide_app_install_flow.mjs: 8 passed, 0 failed out of 8
test_0425_visible_model_refs_contract.mjs: 7 passed, 0 failed out of 7
git diff --check: PASS
```

Sub-agent Stage 8 review 4:

```text
Decision: APPROVED

Findings:
- none

Open questions:
- none

Verification gaps:
- none
```

## Stage 7: Principal-Scoped Desktop State

Status: IN PROGRESS

TDD target:

```bash
node scripts/tests/test_0425_principal_desktop_state_contract.mjs
```

Changes:

- Added `scripts/tests/test_0425_principal_desktop_state_contract.mjs`.
- Updated desktop App state helpers so workspace task identity uses `table_id + model_id`, not the display `id` alone.
- Exported shared desktop App ref/key helpers and used them in the App shell close-task path.
- Updated server desktop foreground/task sanitization to validate workspace Apps by table-qualified ref and `runtime.getModel({ table_id, model_id })`.
- Updated the existing user-isolated UI state test helper to expect explicit `table_id: "host"` refs.

Verification:

```bash
node scripts/tests/test_0425_principal_desktop_state_contract.mjs
node scripts/tests/test_0403_principal_authorization.mjs
node scripts/tests/test_0374_web_tablet_desktop_contract.mjs
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs
git diff --check -- packages/ui-model-demo-frontend/src/desktop_app_state.js packages/ui-model-demo-frontend/src/demo_app.js packages/ui-model-demo-server/server.mjs scripts/tests/test_0374_web_tablet_desktop_contract.mjs scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs scripts/tests/test_0425_principal_desktop_state_contract.mjs
```

Observed:

```text
test_0425_principal_desktop_state_contract.mjs: 4 passed
test_0403_principal_authorization.mjs: 6 passed, 0 failed out of 6
test_0374_web_tablet_desktop_contract.mjs: 15 passed, 0 failed out of 15
test_0417_user_isolated_ui_state_projection_contract.mjs: PASS 10/10
test_0425_frontend_model_ref_projection_contract.mjs: 10 passed, 0 failed out of 10
git diff --check: PASS
```

Notes:

- The first `test_0417_user_isolated_ui_state_projection_contract.mjs` rerun failed because the test expected local state refs without `table_id`; implementation was already emitting explicit host refs. The test fixture was updated to assert the 0425 explicit-host rule.

Sub-agent Stage 7 review 1:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] packages/ui-model-demo-server/server.mjs:9719 — isValidDesktopAppForCurrentCatalog built valid entries with bare model ids, but the shared validator now expects table-qualified desktopAppRefKey strings.
- [high] packages/ui-model-demo-server/server.mjs:12522 — visibleModelRefsForClient converted every positive registry entry to host, ignoring entry.table_id and reintroducing host/global positive model_id fallback.
- [medium] packages/ui-model-demo-server/server.mjs:11549 — desktop delete target normalization dropped table_id, so same local model_id in App tables could not be addressed independently.

Open questions:
- none

Verification gaps:
- Missing server-side foreground update test for non-host App tables.
- Missing visible registry host-collision test.
- Missing delete test proving table-qualified target is not treated as host.
```

Fixes applied:

- Updated current-catalog validation to build table-qualified valid refs from registry entries.
- Updated `deriveWorkspaceRegistryFromSnapshot` so `snapshot.tables` can contribute workspace App entries and same local `model_id` across host/App tables is keyed by `table_id|model_id`.
- Updated `visibleModelRefsForClient` so registry entries preserve their table id and validate table access before becoming visible refs.
- Updated desktop delete target parsing to keep `table_id`; host delete remains the only implemented delete path, while App-table delete is explicitly rejected instead of falling back to host.
- Added Stage 7 tests for app-table foreground updates and app-table delete rejection without host fallback.
- Added visible-registry collision coverage to `test_0425_visible_model_refs_contract.mjs`.

Re-verification:

```bash
node scripts/tests/test_0425_principal_desktop_state_contract.mjs
node scripts/tests/test_0425_visible_model_refs_contract.mjs
node scripts/tests/test_0374_web_tablet_desktop_contract.mjs
node scripts/tests/test_0403_principal_authorization.mjs
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs
git diff --check -- packages/ui-model-demo-frontend/src/desktop_app_state.js packages/ui-model-demo-frontend/src/demo_app.js packages/ui-model-demo-server/server.mjs scripts/tests/test_0374_web_tablet_desktop_contract.mjs scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs scripts/tests/test_0425_principal_desktop_state_contract.mjs scripts/tests/test_0425_visible_model_refs_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_principal_desktop_state_contract.mjs: 6 passed
test_0425_visible_model_refs_contract.mjs: 7 passed, 0 failed out of 7
test_0374_web_tablet_desktop_contract.mjs: 15 passed, 0 failed out of 15
test_0403_principal_authorization.mjs: 6 passed, 0 failed out of 6
test_0417_user_isolated_ui_state_projection_contract.mjs: PASS 10/10
test_0425_frontend_model_ref_projection_contract.mjs: 10 passed, 0 failed out of 10
git diff --check: PASS
```

Sub-agent Stage 7 review 2:

```text
Decision: APPROVED

Findings:
- none

Open questions:
- none

Verification gaps:
- none
```

## Stage 6: Payload And Reply Target Metadata

Implementation:

- Added table-qualified pin payload metadata parsing for `endpoint_table_id`, `origin_table_id`, and `reply_target_table_id`.
- Kept host-table traffic normalized to explicit `table_id: "host"` at the parser/runtime boundary.
- Kept existing MQTT topic shape unchanged: endpoint topics still require positive model ids.
- Decoupled non-host App table writeback targets from the transport `response_topic`; host-table reply targets remain strict and must match the response topic endpoint.
- Rejected client-authored authority labels `principal_id`, `table_id`, and `owner_principal_id` in outer `pin_payload.v1` records.
- Updated runtime `mt_bus_send` output to emit explicit table metadata.
- Updated server-generated management/bundle/imported-egress payloads to emit explicit host table metadata.
- Updated response materialization so non-host App table targets write to `{ table_id, model_id }`, while host targets keep the existing owner-materializer path.
- Added `scripts/tests/test_0425_table_qualified_payload_reply_contract.mjs`.

Verification:

```bash
node scripts/tests/test_0425_table_qualified_payload_reply_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs
node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs
node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs
git diff --check -- packages/ui-model-demo-server/server.mjs packages/worker-base/src/runtime.mjs scripts/tests/test_0425_table_qualified_payload_reply_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_table_qualified_payload_reply_contract.mjs: 9 passed, 0 failed out of 9
test_0407_current_model_ref_contract.mjs: 8 passed, 0 failed out of 8
test_0375_unified_worker_model_topic_contract.mjs: 74 passed, 0 failed out of 74
test_0364_bus_pin_split_runtime_contract.mjs: 9 passed, 0 failed out of 9
test_0362_mbr_remote_worker_route_contract.mjs: 10 passed, 0 failed out of 10
git diff --check: PASS
```

Sub-agent Stage 6 review 2:

```text
Decision: APPROVED

Findings:
- none

Open questions:
- none

Verification gaps:
- none
```

Sub-agent Stage 6 review 1:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] packages/ui-model-demo-server/server.mjs:2588 and packages/worker-base/src/runtime.mjs:1231 — endpoint table metadata could be spoofed as a non-host App table while still matching the MQTT topic by worker/model/pin.

Open questions:
- none

Verification gaps:
- Missing negative tests proving endpoint_table_id !== "host" is rejected for MQTT transport endpoints.
```

Fixes applied:

- Rejected non-host `endpoint_table_id` in the server parser; transport endpoints represented by MQTT topics are always host-table endpoints.
- Rejected non-host `endpoint_table_id` in runtime payload parsing; only `origin_*` and `reply_target_*` may carry non-host App table metadata.
- Added server/runtime negative tests for spoofed non-host transport endpoint tables.

Re-verification:

```bash
node scripts/tests/test_0425_table_qualified_payload_reply_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs
node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs
node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs
git diff --check -- packages/ui-model-demo-server/server.mjs packages/worker-base/src/runtime.mjs scripts/tests/test_0425_table_qualified_payload_reply_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_table_qualified_payload_reply_contract.mjs: 9 passed, 0 failed out of 9
test_0407_current_model_ref_contract.mjs: 8 passed, 0 failed out of 8
test_0375_unified_worker_model_topic_contract.mjs: 74 passed, 0 failed out of 74
test_0364_bus_pin_split_runtime_contract.mjs: 9 passed, 0 failed out of 9
test_0362_mbr_remote_worker_route_contract.mjs: 10 passed, 0 failed out of 10
git diff --check: PASS
```

## Stage 4: Snapshot/Profile/SSE Uses `visibleModelRefs`

Status: REVIEW

TDD red:

```bash
node scripts/tests/test_0425_visible_model_refs_contract.mjs
```

Observed:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../scripts/tests/test_0425_visible_model_refs_contract.mjs'
```

Changes:

- Added `scripts/tests/test_0425_visible_model_refs_contract.mjs`.
- Updated server snapshot/profile helpers to accept `visible_model_ref` and `model_ref` query records with `{ table_id, model_id }`.
- Added table-aware profile filtering and stats so `visible` snapshots can include App instance table models without host `model_id` collision.
- Added `visible_model_refs` response metadata for profile snapshot, initial projection, SSE reset/noop/patch metadata, and patch messages.
- Updated snapshot patch generation to include `table_id` only for non-host table operations; host-only patches keep the existing host snapshot shape.
- Updated frontend remote store URL construction to send `visible_model_ref` for non-host refs while retaining existing host `model_id` / `visible_model_id` query behavior.
- Updated frontend patch apply and snapshot merge logic to support `snapshot.tables[table_id].models[model_id]`.
- Added `owner_principal_id` capture on `model.subtable` mount descriptors for principal-aware table visibility checks.

Regression found and fixed:

- `test_0414_snapshot_delta_sse_contract.mjs` initially failed because host-only patch ops gained `table_id: "host"` and client patch apply added an empty `tables` object. This polluted the pre-existing host-only snapshot contract.
- Fixed by omitting `table_id` from host default-table patch ops and creating `tables` on the client only when a non-host patch actually needs it.

Verification:

```bash
node scripts/tests/test_0425_visible_model_refs_contract.mjs
node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs
node scripts/tests/test_0423_snapshot_granularity_contract.mjs
node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
node scripts/tests/test_0425_runtime_table_namespace_contract.mjs
git diff --check -- packages/ui-model-demo-server/server.mjs packages/ui-model-demo-frontend/src/remote_store.js packages/worker-base/src/runtime.mjs scripts/tests/test_0425_visible_model_refs_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_visible_model_refs_contract.mjs: 5 passed, 0 failed out of 5
test_0414_snapshot_delta_sse_contract.mjs: 7 passed
test_0423_snapshot_granularity_contract.mjs: 13 passed
test_0418_visible_snapshot_projection_latency_contract.mjs: 8/8 PASS
test_0425_runtime_table_namespace_contract.mjs: 14 passed, 0 failed out of 14
git diff --check: PASS
```

Sub-agent Stage 4 review 1:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] packages/ui-model-demo-server/server.mjs:5221 — `buildClientSnapshotForPrincipal()` drops `snapshot.tables` entirely and returns only host `models`. The real `/snapshot` and `/stream` path calls this before `buildClientSnapshotProfile()`, so an accepted non-host `visible_model_ref` can pass validation but still produce no App table content in the actual server response.
- [high] packages/ui-model-demo-server/server.mjs:12465 — SSE baseline reset only compares `principalKey`, while `principalKey` is identity-only and does not include capabilities. If the same user's capability set changes, the code can emit a normal patch/noop instead of a same-profile reset.

Open questions:
- none

Verification gaps:
- Missing server-level test for `/snapshot?profile=visible&visible_model_ref={...}` proving the real HTTP path returns `snapshot.tables[table_id].models[model_id]`.
- Missing SSE test proving a capability-set change for the same principal emits a reset, not a normal patch/noop.
```

Fixes applied:

- Updated `buildClientSnapshot()` and `buildClientSnapshotForPrincipal()` to retain non-host `tables` while applying the same client-safe label filtering.
- Updated SSE baseline keys to use `identity + sorted capabilities` via `clientSnapshotCacheKey()` instead of identity-only `entry.principalKey`.
- Extended `test_0425_visible_model_refs_contract.mjs` from 3 to 5 tests, including a real Bun HTTP `/snapshot?profile=visible&visible_model_ref=...` probe and a capability-aware baseline regression check.

Re-verification:

```bash
node scripts/tests/test_0425_visible_model_refs_contract.mjs
node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs
node scripts/tests/test_0423_snapshot_granularity_contract.mjs
node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
node scripts/tests/test_0425_runtime_table_namespace_contract.mjs
git diff --check -- packages/ui-model-demo-server/server.mjs packages/ui-model-demo-frontend/src/remote_store.js packages/worker-base/src/runtime.mjs scripts/tests/test_0425_visible_model_refs_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_visible_model_refs_contract.mjs: 5 passed, 0 failed out of 5
test_0414_snapshot_delta_sse_contract.mjs: 7 passed
test_0423_snapshot_granularity_contract.mjs: 13 passed
test_0418_visible_snapshot_projection_latency_contract.mjs: 8/8 PASS
test_0425_runtime_table_namespace_contract.mjs: 14 passed, 0 failed out of 14
git diff --check: PASS
```

Result: PASS, pending sub-agent re-review.

Sub-agent Stage 4 review 2:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] packages/ui-model-demo-server/server.mjs:5268 — non-host App table models are filtered with `requiredCapabilityForClientModel(id)` using only the table-local numeric `model_id`. This reintroduces host/global id semantics inside App tables: an App-local model `1050` is dropped for a user without `app:write` because host model `1050` is restricted.
- [high] packages/ui-model-demo-server/server.mjs:5264 — `buildClientSnapshotForPrincipal()` copies all non-host `snapshot.tables` without checking table ownership/access. `visible_model_ref` validation checks `principalCanAccessTable()`, but `profile=full` can still include App tables the current principal should not see before diffing.

Open questions:
- none

Verification gaps:
- Missing test proving App table-local `model_id` collisions with restricted host model IDs do not affect App table visibility.
- Missing server/profile test proving inaccessible non-host tables are removed before profile/diff output, including `profile=full`.
```

Fixes applied:

- Added snapshot-level subtable mount owner detection from host `model.subtable` labels.
- Updated `buildClientSnapshotForPrincipal()` to remove non-host App tables not mounted for the current principal before any profile/diff output.
- Removed host `requiredCapabilityForClientModel(id)` filtering from App table-local model ids so App-local `1050` does not inherit host model `1050` capability rules.
- Tightened runtime `principalCanAccessTable()` so non-host tables without a mount are not visible through `visibleModelRefsForClient()`.
- Added tests for App-local restricted-host-id collision and owner mismatch filtering.

Re-verification:

```bash
node scripts/tests/test_0425_visible_model_refs_contract.mjs
node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs
node scripts/tests/test_0423_snapshot_granularity_contract.mjs
node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs
node scripts/tests/test_0425_runtime_table_namespace_contract.mjs
git diff --check -- packages/ui-model-demo-server/server.mjs packages/ui-model-demo-frontend/src/remote_store.js packages/worker-base/src/runtime.mjs scripts/tests/test_0425_visible_model_refs_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_visible_model_refs_contract.mjs: 6 passed, 0 failed out of 6
test_0414_snapshot_delta_sse_contract.mjs: 7 passed
test_0423_snapshot_granularity_contract.mjs: 13 passed
test_0418_visible_snapshot_projection_latency_contract.mjs: 8/8 PASS
test_0425_runtime_table_namespace_contract.mjs: 14 passed, 0 failed out of 14
git diff --check: PASS
```

Result: PASS, pending sub-agent re-review.

Sub-agent Stage 4 review 3:

```text
Decision: APPROVED

Findings:
- none

Open questions:
- none

Verification gaps:
- none
```

Outcome:

- Stage 4 passed after real HTTP visible-model-ref coverage, owner mismatch filtering, App-local id collision coverage, and existing snapshot/SSE regressions.

## Stage 5: Frontend Projection And Renderer Table-Qualified Keys

Status: REVIEW

TDD red:

```bash
node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs
```

Observed:

```text
Error: Cannot find module '.../scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs'
```

Changes:

- Added `scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs`.
- Updated `packages/ui-model-demo-frontend/src/projection_store.js` so label atom keys include `table_id`, `model_id`, `p`, `r`, `c`, and `k`.
- Updated projection hydration and patch application to read both host `snapshot.models` and non-host `snapshot.tables[table_id].models`.
- Updated `packages/ui-model-demo-frontend/src/remote_store.js` overlay/local-state keys and local patch writes so they preserve `table_id`.
- Updated `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js` so App table UI projections emit explicit `cell_ref.table_id` and preserve authored `*_ref_table_id` label refs.

Verification:

```bash
node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs
node scripts/tests/test_0415_reactive_projection_store_contract.mjs
node scripts/tests/test_0425_model_ref_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
git diff --check -- packages/ui-model-demo-frontend/src/projection_store.js packages/ui-model-demo-frontend/src/remote_store.js packages/ui-model-demo-frontend/src/ui_cellwise_projection.js scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_frontend_model_ref_projection_contract.mjs: 3 passed, 0 failed out of 3
test_0415_reactive_projection_store_contract.mjs: 6 passed
test_0425_model_ref_contract.mjs: PASS
test_0407_current_model_ref_contract.mjs: 8 passed, 0 failed out of 8
git diff --check: PASS
```

Result: PASS, pending sub-agent review.

Sub-agent Stage 5 review 1:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] packages/ui-model-demo-frontend/src/desktop_focused_app_content.js:8 — focused App rendering still calls `buildAstFromCellwiseModel(snapshot, app.model_id)` with a bare host-only id. A slide App instance in a non-host table cannot be rendered by `{table_id, model_id}`, and two App tables with the same local `model_id` will collide or miss content.
- [high] packages/ui-model-demo-frontend/src/demo_app.js:126 — foreground lazy loading still calls `ensureVisibleModelLoaded(app.model_id)` as a bare host id, so visible model loading is not table-qualified.
- [high] packages/ui-renderer/src/renderer.mjs:1342 and packages/ui-model-demo-frontend/src/remote_store.js:389 — overlay/local state rejects `model_id === 0` regardless of `table_id`. App subtables commonly have root `model_id: 0`, so input/dialog state bound to an App root cannot stay browser-local under `on_submit`/`on_blur`; it falls back to durable dispatch instead.

Open questions:
- none

Verification gaps:
- Missing test for two non-host App tables with the same `model_id` being rendered through the foreground/route path without reading host `snapshot.models`.
- Missing test proving browser-local input/dialog overlay works for `{ table_id: "app:*", model_id: 0 }` and does not materialize until explicit commit/sync.
```

Fixes applied:

- Updated `desktop_focused_app_content.js` to pass `{ table_id, model_id }` to cellwise projection when the foreground App carries `table_id`.
- Updated `demo_app.js` foreground visible-model lazy load to pass a table-qualified ModelRef into `ensureVisibleModelLoaded()` / `hasSnapshotModel()`.
- Updated `desktop_app_state.js` and desktop launch payload generation to preserve `table_id` in foreground/task-stack state.
- Updated renderer CJS/ESM and remote store overlay checks so host Model 0 / editor remain blocked, while App-table root `model_id: 0` can stay browser-local under non-immediate commit policy.
- Extended Stage 5 contract tests from 3 to 6 cases for focused App table rendering, foreground visible load ModelRef, and App root overlay.

Re-verification:

```bash
node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs
node scripts/tests/test_0415_reactive_projection_store_contract.mjs
node scripts/tests/test_0390_focused_app_shell_settings_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
node scripts/tests/test_0425_model_ref_contract.mjs
git diff --check -- packages/ui-model-demo-frontend/src/projection_store.js packages/ui-model-demo-frontend/src/remote_store.js packages/ui-model-demo-frontend/src/ui_cellwise_projection.js packages/ui-model-demo-frontend/src/desktop_focused_app_content.js packages/ui-model-demo-frontend/src/demo_app.js packages/ui-model-demo-frontend/src/desktop_app_state.js packages/ui-model-demo-frontend/src/route_ui_projection.js packages/ui-renderer/src/renderer.mjs packages/ui-renderer/src/renderer.js scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_frontend_model_ref_projection_contract.mjs: 6 passed, 0 failed out of 6
test_0415_reactive_projection_store_contract.mjs: 6 passed
test_0390_focused_app_shell_settings_contract.mjs: 15 passed
test_0407_current_model_ref_contract.mjs: 8 passed, 0 failed out of 8
test_0425_model_ref_contract.mjs: PASS
git diff --check: PASS
```

Result: PASS, pending sub-agent re-review.

Sub-agent Stage 5 review 2:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] packages/ui-model-demo-frontend/src/route_ui_projection.js:116 — route projection deduplicates workspace apps by bare `model_id` before reading `entry.table_id`, so two App instance tables with the same local `model_id` collapse into one entry.
- [high] packages/ui-model-demo-frontend/src/demo_app.js:521 — `ForegroundPlayer` still checks `snapshot.models[String(app.model_id)]` and calls `mainStore.hasSnapshotModel(app.model_id)` as a bare host ref.
- [medium] packages/ui-model-demo-frontend/src/desktop_app_state.js:15 — desktop app availability is keyed only by `model_id`, so foreground/task-stack filtering can accept or reject the wrong App when multiple tables contain the same local `model_id`.

Open questions:
- none

Verification gaps:
- Missing route projection test with two registry entries `{ table_id: "app:a", model_id: 1 }` and `{ table_id: "app:b", model_id: 1 }`, asserting both appear and launch distinctly.
- Missing foreground loading test that calls the actual foreground loading path with only `snapshot.tables["app:x"].models["1"]` present and no host `snapshot.models["1"]`.
```

Fixes applied:

- Updated desktop registry normalization to dedupe by `table_id + model_id`, while preserving old host card ids for host apps.
- Updated desktop foreground/task-stack availability to compare table-qualified App refs instead of bare `model_id`.
- Added `foreground_app_load_state.js` so foreground loading state uses the same table-qualified model ref path and remains directly testable without Vite aliases.
- Updated AppCard delete/contextmenu fallback payloads to preserve `table_id` for non-host App tables.
- Extended Stage 5 contract tests from 6 to 9 cases for duplicate local model ids across App tables, table-qualified desktop availability filtering, and foreground loading state with only an App-table model present.

Re-verification:

```bash
node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs
node scripts/tests/test_0374_web_tablet_desktop_contract.mjs
node scripts/tests/test_0390_focused_app_shell_settings_contract.mjs
node scripts/tests/test_0415_reactive_projection_store_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
node scripts/tests/test_0425_model_ref_contract.mjs
git diff --check -- packages/ui-model-demo-frontend/src/projection_store.js packages/ui-model-demo-frontend/src/remote_store.js packages/ui-model-demo-frontend/src/ui_cellwise_projection.js packages/ui-model-demo-frontend/src/desktop_focused_app_content.js packages/ui-model-demo-frontend/src/demo_app.js packages/ui-model-demo-frontend/src/desktop_app_state.js packages/ui-model-demo-frontend/src/route_ui_projection.js packages/ui-model-demo-frontend/src/foreground_app_load_state.js packages/ui-renderer/src/renderer.mjs packages/ui-renderer/src/renderer.js scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_frontend_model_ref_projection_contract.mjs: 9 passed, 0 failed out of 9
test_0374_web_tablet_desktop_contract.mjs: 15 passed, 0 failed out of 15
test_0390_focused_app_shell_settings_contract.mjs: 15 passed, 0 failed out of 15
test_0415_reactive_projection_store_contract.mjs: 6 passed
test_0407_current_model_ref_contract.mjs: 8 passed, 0 failed out of 8
test_0425_model_ref_contract.mjs: PASS
git diff --check: PASS
```

Result: PASS, pending sub-agent re-review.

Sub-agent Stage 5 review 3:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] packages/ui-model-demo-frontend/src/route_ui_projection.js:134 — `normalizeDesktopWorkspaceApps()` still skips `model_id === 0` for every table. Under 0425 SSOT, `{ table_id: "app:*", model_id: 0 }` is a valid App table root model, so App-root slide apps cannot appear in desktop route projection even though host Model 0 should remain special.

Open questions:
- none

Verification gaps:
- Missing test with `ws_apps_registry` entries like `{ table_id: "app:a", model_id: 0 }`, asserting non-host App root models are projected while host `model_id: 0` remains excluded.
```

Fixes applied:

- Updated desktop registry normalization to skip `model_id: 0` only for the host table.
- Added a Stage 5 contract test proving `app:*` table root `model_id: 0` is shown while host Model 0 remains hidden.

Re-verification:

```bash
node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs
node scripts/tests/test_0374_web_tablet_desktop_contract.mjs
git diff --check -- packages/ui-model-demo-frontend/src/route_ui_projection.js scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_frontend_model_ref_projection_contract.mjs: 10 passed, 0 failed out of 10
test_0374_web_tablet_desktop_contract.mjs: 15 passed, 0 failed out of 15
git diff --check: PASS
```

Result: PASS, pending sub-agent re-review.

Sub-agent Stage 5 review 4:

```text
Decision: APPROVED

Findings:
- none

Open questions:
- none

Verification gaps:
- none
```

Result: Stage 5 APPROVED.

Sub-agent Stage 1 review 3:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] packages/ui-renderer/src/renderer.mjs:110 and packages/ui-renderer/src/renderer.js:110 — `currentModelRefForNode()` still normalizes the current vnode `cell_ref` with `defaultTableId: "host"`, so a bare `cell_ref: { model_id: 1087, ... }` is accepted as a host current context. That violates the Stage 1 acceptance that omitted `table_id` may only resolve when the current ModelRef table context is already explicit, and it can make installed-App bare cell refs silently read/write host data.

Open questions:
- none

Verification gaps:
- Add a renderer negative test where the vnode `cell_ref` itself is bare (`{model_id,p,r,c}`) and the binding uses local `$label`/omitted model_id; expected output must be empty/rejected, not host fallback.
```

Fixes applied:

- Added a renderer negative test proving a bare current vnode `cell_ref` cannot provide local `$label` table context.
- Updated `renderer.mjs` and `renderer.js` so `currentModelRefForNode` and `currentCellRefForNode` require explicit current table context instead of defaulting to host.
- Migrated existing 0407 host-owned renderer fixtures to explicit `table_id: "host"` so host behavior remains intentional and testable.

Re-verification:

```bash
node scripts/tests/test_0425_model_ref_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
```

Observed:

```text
test_0425_model_ref_contract.mjs: PASS
test_0407_current_model_ref_contract.mjs: 8 passed, 0 failed out of 8
```

Sub-agent Stage 1 review 4:

```text
Decision: APPROVED

Findings:
- none

Open questions:
- none

Verification gaps:
- none
```

## Stage 2: Runtime Table Namespace, Mounts, And PIN Route Graph

Status: IN PROGRESS

TDD red:

```bash
node scripts/tests/test_0425_runtime_table_namespace_contract.mjs
```

Observed:

```text
0 passed, 10 failed out of 10
```

Failure summary:

- App-table `model_id` collided with host-table `model_id`.
- App tables could create negative host/system model ids.
- Runtime had no `model.subtable` mount map.
- `pin.connect.cell` route keys were bare `model_id` keys.
- Endpoints carrying `table_id` were rejected only as generic bad endpoints instead of explicit cross-table endpoint violations.

Changes:

- Added host-table constant and table-qualified model storage in `packages/worker-base/src/runtime.mjs`.
- Kept bare numeric `getModel(id)` as explicit host-table boundary behavior; app/user tables require table-qualified refs.
- Added `model.subtable` mount records via `subtableMounts` and `subtableMountsByHostCell`, creating child table root models without using `parentChildMap`.
- Updated root-boundary pin registrations, cell-connect graph keys, and `pin.connect.cell` route keys to include `table_id`.
- Rejected `pin.connect.cell` endpoints that attempt to carry cross-table information.
- Updated snapshot output to include non-host `tables[table_id].models`.
- Migrated `test_cell_connect_parse.mjs` to assert explicit host-table route keys.

Verification:

```bash
node scripts/tests/test_0425_runtime_table_namespace_contract.mjs
node scripts/tests/test_cell_connect_parse.mjs
node scripts/tests/test_bus_in_out.mjs
node -e "import('./packages/worker-base/src/runtime.mjs').then((m)=>{ const rt = new m.ModelTableRuntime(); if (!rt.getModel({table_id:'host',model_id:0})) throw new Error('missing host root'); console.log('runtime.mjs import PASS'); })"
git diff --check -- packages/worker-base/src/runtime.mjs scripts/tests/test_0425_runtime_table_namespace_contract.mjs scripts/tests/test_cell_connect_parse.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_runtime_table_namespace_contract.mjs: 10 passed, 0 failed out of 10
test_cell_connect_parse.mjs: 8 passed, 0 failed out of 8
test_bus_in_out.mjs: 7 passed, 0 failed out of 7
runtime.mjs import PASS
git diff --check: PASS
```

Sub-agent Stage 2 review 1:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] packages/worker-base/src/runtime.mjs:763 — `_registerRootBoundaryOutput` first checks bare `parentChildMap` by `model.id`. If an App subtable root `model_id` collides with a host `model.submt` child id, App root output can be routed through the old child-model path.
- [high] packages/worker-base/src/runtime.mjs:898 — `model.subtable` validates only descriptor shape and can be declared inside a non-host App table, violating the host hosting Cell boundary.

Open questions:
- none

Verification gaps:
- Need a collision test for host `model.submt` child id versus App `model.subtable.root_model_id`.
- Need a negative test proving non-host table `model.subtable` declarations are rejected.
```

Fixes applied:

- Added collision coverage to `test_0425_runtime_table_namespace_contract.mjs`: an App subtable root output now must return to the subtable hosting Cell even when the same numeric id exists in host `parentChildMap`.
- Added a non-host `model.subtable` negative test.
- Updated `_registerRootBoundaryOutput` so non-host model output resolves via `subtableMounts` first and never uses host `parentChildMap`.
- Added placement validation rejecting `model.subtable` outside the host table.

Re-verification:

```bash
node scripts/tests/test_0425_runtime_table_namespace_contract.mjs
node scripts/tests/test_cell_connect_parse.mjs
node scripts/tests/test_bus_in_out.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
```

Observed:

```text
test_0425_runtime_table_namespace_contract.mjs: 14 passed, 0 failed out of 14
test_cell_connect_parse.mjs: 8 passed, 0 failed out of 8
test_bus_in_out.mjs: 7 passed, 0 failed out of 7
test_0407_current_model_ref_contract.mjs: 8 passed, 0 failed out of 8
```

Sub-agent Stage 2 review 2:

```text
Decision: APPROVED

Findings:
- none

Open questions:
- none

Verification gaps:
- none
```

## Stage 3: Persistence Keys For New User/App Tables

Status: IN PROGRESS

TDD red:

```bash
node scripts/tests/test_0425_persistence_table_key_contract.mjs
```

Observed:

```text
0 passed, 3 failed out of 3
```

Failure summary:

- SQLite `mt_data` schema had no `table_id` column.
- Same `model_id` in two App tables would collide at the persistence key.
- Existing DB schema had no migration to explicit host table rows.

Changes:

- Updated `packages/worker-base/src/modeltable_persistence_sqlite.js` so `mt_data` primary key includes `table_id`.
- Added schema migration that rewrites legacy rows as explicit `table_id = "host"`.
- Updated `ensureModel`, `onLabelAdded`, and `onLabelRemoved` to use `model.table_id || "host"`.
- Updated `packages/worker-base/src/program_model_loader.js` to replay table-qualified records and keep legacy DBs as host table rows.
- Updated direct server-side imported-model cleanup deletes to qualify `table_id = "host"`.
- Added `scripts/tests/test_0425_persistence_table_key_contract.mjs`.

Verification:

```bash
node scripts/tests/test_0425_persistence_table_key_contract.mjs
node scripts/tests/test_0425_runtime_table_namespace_contract.mjs
node scripts/tests/test_0423_snapshot_granularity_contract.mjs
git diff --check -- packages/worker-base/src/modeltable_persistence_sqlite.js packages/worker-base/src/program_model_loader.js packages/ui-model-demo-server/server.mjs scripts/tests/test_0425_persistence_table_key_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_persistence_table_key_contract.mjs: 5 passed, 0 failed out of 5
test_0425_runtime_table_namespace_contract.mjs: 14 passed, 0 failed out of 14
test_0423_snapshot_granularity_contract.mjs: 13 passed
git diff --check: PASS
```

Sub-agent Stage 3 review 1:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] packages/ui-model-demo-server/server.mjs:9291 — server startup replay still filtered bootstrap-generated keys by bare `modelId === 0`, so an App instance table root `model_id: 0` could lose labels such as `matrix_server` during DB replay.

Open questions:
- none

Verification gaps:
- Need server-style replay coverage proving App table root labels are not filtered by host Model 0 bootstrap cleanup rules.
```

Fixes applied:

- Added `test_server_replay_filters_bootstrap_keys_only_on_host_table` to the Stage 3 persistence contract.
- Updated server DB replay filtering to drop bootstrap-generated keys only when `table_id === "host"` and `model_id === 0`.

Re-verification:

```bash
node scripts/tests/test_0425_persistence_table_key_contract.mjs
node scripts/tests/test_0423_snapshot_granularity_contract.mjs
git diff --check -- packages/worker-base/src/modeltable_persistence_sqlite.js packages/worker-base/src/program_model_loader.js packages/ui-model-demo-server/server.mjs scripts/tests/test_0425_persistence_table_key_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_persistence_table_key_contract.mjs: 6 passed, 0 failed out of 6
test_0423_snapshot_granularity_contract.mjs: 13 passed
git diff --check: PASS
```

Sub-agent Stage 3 review 2:

```text
Decision: APPROVED

Findings:
- none

Open questions:
- none

Verification gaps:
- none
```

Sub-agent Stage 1 review 2:

```text
Decision: CHANGE_REQUESTED

Findings
- [high] packages/ui-model-demo-frontend/src/model_ref.js:102, packages/ui-renderer/src/renderer.mjs:90, packages/ui-renderer/src/renderer.js:90 — 显式跨表 ref 里 `model_id` 为空白或非法时，仍会借用 current App 的 `model_id`。我实测 `table_id:"host", model_id:"   "` 会解析成 `{table_id:"host", model_id:1087}`，renderer CJS/ESM 都会读出 `host title`。这仍有 host/global fallback 风险；跨表时 `model_id` 必须是那张表自己的有效 id，不能从 current ModelRef 借。

Open questions
- none

Verification gaps
- 新增负例没有覆盖 renderer 中“显式跨表 `table_id` + 省略/非法 `model_id`”路径；当前只覆盖了 helper 的省略场景，以及 renderer 的空白 current table 场景。
```

Fixes applied:

- Extended `test_0425_model_ref_contract.mjs` so helper rejects explicit invalid `model_id`.
- Extended `test_0425_model_ref_contract.mjs` so renderer CJS and ESM reject invalid explicit cross-table `model_id` instead of borrowing current App model id.
- Updated `model_ref.js`, `renderer.mjs`, and `renderer.js` so an explicit but invalid `model_id` throws `model_id_required`.

Re-verification:

```bash
node scripts/tests/test_0425_model_ref_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
node -e "import('./packages/ui-renderer/src/renderer.mjs').then((m)=>{ if (typeof m.createRenderer !== 'function') throw new Error('missing createRenderer'); console.log('renderer.mjs import PASS'); })"
git diff --check -- packages/ui-model-demo-frontend/src/model_ref.js packages/ui-model-demo-frontend/src/snapshot_utils.js packages/ui-renderer/src/renderer.mjs packages/ui-renderer/src/renderer.js scripts/tests/test_0425_model_ref_contract.mjs scripts/tests/test_0407_current_model_ref_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_model_ref_contract.mjs: PASS
test_0407_current_model_ref_contract.mjs: 8 passed, 0 failed out of 8
renderer.mjs import PASS
git diff --check: PASS
```

Sub-agent Stage 1 review 1:

```text
Decision: CHANGE_REQUESTED

Findings
- [high] packages/ui-model-demo-frontend/src/model_ref.js:61 — 显式但无效的 `table_id` 会被当成“没写”，然后回落到 current table 或 `host`。同样逻辑也在 packages/ui-renderer/src/renderer.mjs:62 和 packages/ui-renderer/src/renderer.js:62。实测 renderer 中 `cell_ref.table_id: "   "` 会把 App 读数导向 `host`，这违反 Stage 1 “App context 不能 host/global fallback”的要求。
- [medium] packages/ui-model-demo-frontend/src/model_ref.js:96 — `normalizeLabelRef` 允许 `table_id` 指到另一张表但省略 `model_id`，然后借用 current App 的 `model_id`。renderer 的 CJS/ESM 同样如此：packages/ui-renderer/src/renderer.mjs:84、packages/ui-renderer/src/renderer.js:84。跨表时 `model_id` 是 table-local 的，不能从当前 App ModelRef 里隐式借用，否则可能读到同号 host model。

Open questions
- none

Verification gaps
- 还缺关键负例：空白/非法 `table_id` 必须拒绝；App current context 下不能由空白 `table_id` 回落到 host；显式跨表 `table_id` 时省略 `model_id` 必须拒绝或要求完整 ModelRef。
```

Fixes applied:

- Added Stage 1 negative tests for explicit blank `table_id`, explicit cross-table label refs without `model_id`, and renderer invalid current table context.
- Updated `model_ref.js` so explicit invalid `table_id` throws instead of defaulting.
- Updated `model_ref.js` so an explicit cross-table `table_id` cannot borrow current table-local `model_id`.
- Applied the same strict invalid-table and cross-table rules to `renderer.mjs` and `renderer.js`.
- Made renderer current-cell fallback return no implicit target for invalid current table context rather than generating a host fallback.

Re-verification:

```bash
node scripts/tests/test_0425_model_ref_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
node -e "import('./packages/ui-renderer/src/renderer.mjs').then((m)=>{ if (typeof m.createRenderer !== 'function') throw new Error('missing createRenderer'); console.log('renderer.mjs import PASS'); })"
git diff --check -- packages/ui-model-demo-frontend/src/model_ref.js packages/ui-model-demo-frontend/src/snapshot_utils.js packages/ui-renderer/src/renderer.mjs packages/ui-renderer/src/renderer.js scripts/tests/test_0425_model_ref_contract.mjs scripts/tests/test_0407_current_model_ref_contract.mjs docs/iterations/0425-principal-subtable-impl/runlog.md
```

Observed:

```text
test_0425_model_ref_contract.mjs: PASS
test_0407_current_model_ref_contract.mjs: 8 passed, 0 failed out of 8
renderer.mjs import PASS
git diff --check: PASS
```

Stage 9 sub-agent review 1:

```text
Decision: CHANGE_REQUESTED

Findings:
- [high] docs/user-guide/slide-app-runtime/mqtt_response_to_ui_materialization.md:97 still coupled endpoint_* and reply_target_* as the same target.
- [medium] docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html:192 repeated endpoint_* must match reply_target_*.
- [medium] docs/ssot/runtime_semantics_modeltable_driven.md:1134 still documented bare visible_model_id subscriptions.
- [medium] docs/ssot/ui_to_matrix_event_flow.md:83 still documented bare visible_model_id subscriptions.

Verification gaps:
- Add doc-contract assertions rejecting endpoint/reply-target coupling phrases.
- Add doc-contract assertions rejecting bare visible_model_id as the opened slide App subscription mechanism.
```

Fixes applied:

- Updated MQTT materialization guide and minimal submit interactive guide so `endpoint_*` is the host transport endpoint and `reply_target_*` is the final App table materialization target.
- Updated runtime and Matrix event-flow SSOT docs to require table-qualified `visibleModelRefs` for opened slide App subscriptions.
- Updated the minimal submit remote-worker code example so it parses the host transport endpoint from `response_topic` instead of deriving response endpoint from `reply_target_*`.
- Extended `test_0425_doc_examples_model_ref_contract.mjs` to reject stale endpoint/reply coupling phrases and bare `visible_model_id` subscription language.

Re-verification:

```bash
node scripts/tests/test_0425_doc_examples_model_ref_contract.mjs
rg -n 'endpoint_\* 与 `reply_target_\*` 描述同一个本地目标|endpoint_\*</code> 必须与 <code>reply_target_\*</code> 一致|endpoint_\* 必须与 reply_target_\* 一致|客户端用 `visible_model_id` 明确订阅|订阅 `visible_model_id=A`|UIPUT/ws/dam/pic/de/U1/2000/result|reply_target_worker_id / reply_target_model_id / reply_target_pin' docs/ssot docs/user-guide docs/handover
git diff --check -- docs/user-guide/slide-app-runtime/mqtt_response_to_ui_materialization.md docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/ui_to_matrix_event_flow.md docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md scripts/tests/test_0425_doc_examples_model_ref_contract.mjs
node scripts/tests/test_0425_table_qualified_payload_reply_contract.mjs
node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs
node scripts/tests/test_0425_visible_model_refs_contract.mjs
node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs
```

Observed:

```text
test_0425_doc_examples_model_ref_contract.mjs: 5 passed, 0 failed
stale wording rg: no matches
git diff --check: PASS
test_0425_table_qualified_payload_reply_contract.mjs: 9 passed, 0 failed out of 9
test_0425_slide_app_subtable_install_contract.mjs: 5 passed, 0 failed out of 5
test_0425_visible_model_refs_contract.mjs: 7 passed, 0 failed out of 7
test_0384_provider_owned_slide_app_install_flow.mjs: 8 passed, 0 failed out of 8
```

Sub-agent Stage 9 review 2:

```text
Decision: APPROVED

Findings:
- none

Open questions:
- none

Verification gaps:
- none
```

## Stage 10: Final Local Verification

Classification before final verification:

- Unit/contract: frontend build/test and 0425 contract scripts.
- Local stack deploy/health: explicit `deploy_local.sh`, then `ensure_runtime_baseline.sh` and `check_runtime_baseline.sh`.
- Browser e2e: local deployed UI at `http://127.0.0.1:30900/` / `http://localhost:30900/`.
- Snapshot/SSE evidence: browser resource requests and contract tests for `visible_model_ref` / `visible_model_refs`.

Local deploy/restart:

```bash
bash scripts/ops/deploy_local.sh
bash scripts/ops/check_runtime_baseline.sh
```

Observed:

```text
deploy_local.sh: completed, rebuilt dy-ui-server:v1, dy-remote-worker:v3, dy-mbr-worker:v2, restarted ui-server/mbr-worker/remote-worker/workspace-manager.
Pods: mosquitto, synapse, remote-worker, workspace-manager, mbr-worker, ui-server all READY 1/1.
UI Server: http://localhost:30900
Matrix homeserver: https://matrix.dongyudigital.com
Matrix room: !cwjjmtSerwVUiDgxdQ:synapse.dongyudigital.com
check_runtime_baseline.sh: baseline ready.
```

Deterministic verification:

```bash
npm -C packages/ui-model-demo-frontend run build
npm -C packages/ui-model-demo-frontend run test
node scripts/tests/test_0425_model_ref_contract.mjs
node scripts/tests/test_0425_runtime_table_namespace_contract.mjs
node scripts/tests/test_0425_persistence_table_key_contract.mjs
node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs
node scripts/tests/test_0425_principal_desktop_state_contract.mjs
node scripts/tests/test_0403_principal_authorization.mjs
node scripts/tests/test_0425_visible_model_refs_contract.mjs
node scripts/tests/test_0425_table_qualified_payload_reply_contract.mjs
node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs
node scripts/tests/test_0425_doc_examples_model_ref_contract.mjs
bash scripts/ops/ensure_runtime_baseline.sh
```

Observed:

```text
frontend build: PASS
frontend test: PASS
test_0425_model_ref_contract.mjs: PASS
test_0425_runtime_table_namespace_contract.mjs: 14 passed, 0 failed
test_0425_persistence_table_key_contract.mjs: 6 passed, 0 failed
test_0425_frontend_model_ref_projection_contract.mjs: 10 passed, 0 failed
test_0425_principal_desktop_state_contract.mjs: 6 passed
test_0403_principal_authorization.mjs: 6 passed, 0 failed
test_0425_visible_model_refs_contract.mjs: 7 passed, 0 failed
test_0425_table_qualified_payload_reply_contract.mjs: 9 passed, 0 failed
test_0425_slide_app_subtable_install_contract.mjs: 5 passed, 0 failed
test_0425_doc_examples_model_ref_contract.mjs: 5 passed, 0 failed
ensure_runtime_baseline.sh: baseline already healthy — nothing to do
```

Browser evidence:

```text
Playwright fixed sessions:
- dy-0425-drop: Matrix direct-login as @drop:synapse.dongyudigital.com.
- dy-0425-drop-read: Matrix direct-login read probe as @drop:synapse.dongyudigital.com.
- dy-0425-mbr-read: Matrix direct-login read probe as @mbr:synapse.dongyudigital.com.

drop read probe:
- desktop loaded: true
- readonly badge: false
- permission denied: false
- visible apps included Gallery, Docs, To Do Board, E2E 颜色生成器, Matrix Chat
- request evidence: /snapshot?profile=bootstrap&initial_projection=1

mbr read probe:
- desktop loaded: true
- readonly badge: false
- permission denied: false
- visible apps included Gallery, Docs, To Do Board, E2E 颜色生成器, Matrix Chat
- request evidence: /snapshot?profile=bootstrap&initial_projection=1

drop opened old persisted host-table To Do Board model 1087:
- desktop loaded: true
- To Do Board buttons found: 2
- stillLoading: false
- hasTodoContent: true
- request evidence included /snapshot?profile=visible&initial_projection=1&model_id=1087 and /stream?profile=bootstrap&visible_model_id=1087
```

Initial browser blocker and follow-up result:

The deployed local stack has `DY_AUTH=1`. Matrix direct-login sessions can read
desktop and Matrix content, but `loginWithMatrix` grants only read-level
capabilities, so it cannot validate write-path ZIP import.

Attempting to import `test_files/todo_board_app.zip` through the real
`滑动 APP 导入` UI as `@drop:synapse.dongyudigital.com` produced the expected
permission panel: `权限不足 / 当前账号不能使用该操作：编辑`.

After `deploy_local.sh` restarted `ui-server`, the existing Chrome SSO session
became invalid because local sessions are in-memory. Clicking the real SSO login
button reached ZITADEL and required user login / 2FA. No test-only auth bypass or
compatibility grant was added.

Follow-up Chrome check after the user completed SSO in an existing remote tab:

- `https://app.dongyudigital.com/#/` was SSO logged in as `yuanchen yang` and rendered `To Do Board · model 1087`.
- That remote App tab proved the remote-domain SSO session was live, but it did not establish a local `http://localhost:30900` session.
- Opening a fresh local Chrome tab at `http://localhost:30900/#/` still rendered `访客只读`.
- Clicking the local `登录` button navigated to a new ZITADEL login request; it did not auto-complete from the remote-domain App session.
- The local write-path browser check therefore remained blocked until the user completed local SSO / 2FA in the local tab.

Follow-up Chrome check after the user manually completed local SSO:

- `http://localhost:30900/#/` was SSO logged in as `yuanchen yang` and no longer rendered `访客只读`.
- The local desktop listed built-in Apps plus slid-in Apps, including `E2E 颜色生成器`, `最小 Submit 双总线示例`, `工作区管理器`, and existing/imported `To Do Board` entries.
- In the real Chrome UI, `滑动 APP 导入` accepted `/Users/drop/codebase/cowork/dongyuapp_elysia_based/test_files/todo_board_app.zip`.
- After clicking `导入 Slide App`, the file field reset without a visible success modal, but the desktop gained an additional `From source unknown · To Do Board` card. This confirms install materialization, but also records a UX gap: the install completion modal/toast did not appear during this run.
- Opening the newly visible `To Do Board` showed a short `正在加载滑动 APP...` state, then rendered the full board. It did not remain stuck.
- The opened board rendered columns and cards, and a status action updated the visible status to `moved to doing`.
- Chrome extension Playwright reads became unstable on this heavy App page and timed out twice; the final browser evidence was captured through the system window/accessibility tree instead of the Chrome extension DOM API.

Additional follow-up after the user manually completed the local SSO flow again:

- The active Chrome tab URL/title was `http://localhost:30900/#/` / `UI Model Demo`.
- Screenshot: `/tmp/dy_manual_login_retry_chrome.png`.
- The page is logged in as `yuanchen yang`.
- The focused App renders `To Do Board`, `Workspace app · model 0`, status `ready`, and no `访客只读` badge.
- The board is not stuck on `正在加载滑动 APP...`; it renders the Kanban columns `还未开始`, `正在进行`, `已完成`, `已归档`.
- Visible cards include `验证 UI 模型文档`, `实现看板视图`, `浏览器实测新增任务`, and `归档旧草稿`.
- This is the child-subtable App instance, because the UI shows local app `model 0` while the host boundary below points to a table-qualified `model.subtable` mount.

Principal runtime / subtable evidence from the deployed local ui-server persistence:

```bash
DB=/Users/drop/dongyu/volume/persist/ui-server/runtime/default/yhl.principal-d4964316debfc047.db
sqlite3 "$DB" "select table_id, mt_id, count(*) labels from mt_data group by table_id, mt_id order by table_id, mt_id;"
sqlite3 "$DB" "select table_id, mt_id, p,r,c,k,t, substr(v,1,160) from mt_data where table_id!='host' order by table_id, mt_id, p,r,c,k limit 80;"
sqlite3 "$DB" "select mt_id,p,r,c,k,t, substr(v,1,500) from mt_data where table_id='host' and (v like '%app:360226023557562598%' or v like '%to-do-board:2-0-21%') order by mt_id,p,r,c,k limit 80;"
```

Observed:

```text
Current SSO principal database:
- /Users/drop/dongyu/volume/persist/ui-server/runtime/default/yhl.principal-d4964316debfc047.db

Subtable label counts:
- app:360226023557562598:to-do-board:2-0-21:1 | model 0 | 284 labels
- host | model 1087 | 294 labels

Subtable root labels:
- app_name = "To Do Board"
- model_type = "UI.TodoBoardZip"
- tasks_json exists in table app:360226023557562598:to-do-board:2-0-21:1 / model 0
- ui_authoring_version = "cellwise.ui.v1"
- ui_root_node_id = "todo_root"
- todo_status = "ready"
- todo_request pin and todo_request_wiring are present in the subtable root model

Host boundary labels:
- host model 0 cell (2,0,21) has model_type=model.subtable with v.table_id="app:360226023557562598:to-do-board:2-0-21:1", v.root_model_id=0, v.owner_principal_id="360226023557562598"
- host model -2 ws_apps_registry contains table_id="app:360226023557562598:to-do-board:2-0-21:1", model_id=0, name="To Do Board"
```

Interpretation:

- The real browser page and deployed runtime persistence agree that the local SSO principal has a rendered To Do Board.
- The installed App instance is represented as a child ModelTable with its own `table_id`, and its root model is local `model_id=0`.
- The host keeps the App visible through a `model.subtable` hosting cell and `ws_apps_registry` with table-qualified app reference.
- This verifies the table namespace behavior for the logged-in local principal. It does not yet replace the separate two-principal browser isolation check required by the 0425 plan.

Known browser tooling limitation:

- Opening a direct visible snapshot URL in a temporary Chrome tab was blocked by Chrome as `net::ERR_BLOCKED_BY_CLIENT`.
- Reading `performance.getEntriesByType('resource')` from the heavy local App page through the Chrome extension timed out and reset the extension session.
- Therefore the browser-side evidence for this pass uses the real visible Chrome window plus deployed principal DB inspection, not Chrome-extension DOM/performance extraction.

Targeted re-verification after this follow-up:

```bash
node scripts/tests/test_0425_visible_model_refs_contract.mjs
node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs
node scripts/tests/test_0425_principal_desktop_state_contract.mjs
node scripts/tests/test_0425_persistence_table_key_contract.mjs
git diff --check -- docs/iterations/0425-principal-subtable-impl/runlog.md
bash scripts/ops/check_runtime_baseline.sh
```

Observed:

```text
test_0425_visible_model_refs_contract.mjs: 7 passed, 0 failed
test_0425_slide_app_subtable_install_contract.mjs: 5 passed, 0 failed
test_0425_principal_desktop_state_contract.mjs: 6 passed
test_0425_persistence_table_key_contract.mjs: 6 passed, 0 failed
git diff --check: PASS
check_runtime_baseline.sh: baseline ready; mosquitto, synapse, remote-worker, workspace-manager, mbr-worker, ui-server all READY.
```

Cleanup:

```bash
for s in dy-0425-drop dy-0425-drop-read dy-0425-mbr-read; do DY_PW_SESSION="$s" scripts/ops/playwright_session_guard.sh check-clean; done
```

Observed:

```text
PASS: no project Playwright session or project Playwright-managed browser process remains for dy-0425-drop
PASS: no project Playwright session or project Playwright-managed browser process remains for dy-0425-drop-read
PASS: no project Playwright session or project Playwright-managed browser process remains for dy-0425-mbr-read
Chrome tab kept as handoff on the SSO login page.
```

## Stage 10 Follow-up: Two-Principal SSO Isolation

Status: COMPLETED

Purpose:

- Close the remaining 0425 final verification gap: prove two browser sessions can be logged in as different SSO principals and do not share mutable slide App instance state.
- User A uses the existing Chrome SSO session.
- User B uses a separate Playwright browser session and a newly created ZITADEL test user.

Sub-agent cleanup:

```bash
multi_agent_v1.close_agent 019ef720-ccda-79a1-874d-f19223100903
multi_agent_v1.close_agent 019ef72f-d601-79a1-b624-16feae0db41d
```

Observed:

```text
Both known old agent ids returned agent_not_found, so there were no still-open known sub-agents to stop.
No new sub-agent was spawned for this verification pass.
```

User A browser evidence:

```text
Browser: existing Chrome tab
URL: http://localhost:30900/#/
Visible account: yuanchen yang
Guest badge: absent
Status: ready
Screenshot: output/playwright/0425-sso-user-a-home.png
```

Visible User A App state:

```text
Built-in Apps include Gallery, Docs, Three Scene, Static, 滑动 APP 导入, Mgmt Bus Console, Matrix Suite, Settings, ModelTable, Matrix Chat, To Do Board.
Slid-in Apps include:
- From source unknown / To Do Board
- From RemoteWorker R1 / E2E 颜色生成器
- From RemoteWorker R1 / 最小 Submit 双总线示例
- From Workspace-Manager-DE / 工作区管理器
- From source unknown / To Do Board
```

User B browser evidence:

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" -s=dy-0425-sso-user-b snapshot
"$PWCLI" -s=dy-0425-sso-user-b run-code "async (page) => { await page.screenshot({ path: 'output/playwright/0425-sso-user-b-home.png', fullPage: false }); const me = await page.evaluate(async () => await fetch('/auth/me', { credentials: 'include' }).then(r => r.json())); return { screenshot: 'output/playwright/0425-sso-user-b-home.png', me }; }"
"$PWCLI" -s=dy-0425-sso-user-b run-code "async (page) => { await page.screenshot({ path: 'output/playwright/0425-sso-user-b-home-full.png', fullPage: true }); return 'output/playwright/0425-sso-user-b-home-full.png'; }"
```

Observed:

```json
{
  "ok": true,
  "provider": "zitadel",
  "userId": "zitadel:378779425816183014",
  "subject": "378779425816183014",
  "email": "nwpuyyc@163.com",
  "username": "drop-test",
  "displayName": "1st test",
  "roles": ["dongyu.admin", "dongyu.matrix", "dongyu.slide", "dongyu.viewer"],
  "capabilities": [
    "app:read",
    "app:write",
    "management_bus:use",
    "matrix:connect",
    "slide_app:use",
    "workspace:read",
    "workspace:write"
  ],
  "matrixConnected": false
}
```

Visible User B App state:

```text
Browser: isolated Playwright session dy-0425-sso-user-b
URL: http://localhost:30900/#/
Visible account: 1st test
Guest badge: absent
Status: ready
Screenshot: output/playwright/0425-sso-user-b-home.png
Full-page screenshot: output/playwright/0425-sso-user-b-home-full.png

Built-in Apps include Gallery, Docs, Three Scene, Static, 滑动 APP 导入, Mgmt Bus Console, Matrix Suite, Settings, ModelTable, Matrix Chat, To Do Board.
Slid-in Apps include:
- From RemoteWorker R1 / E2E 颜色生成器
- From RemoteWorker R1 / 最小 Submit 双总线示例
- From Workspace-Manager-DE / 工作区管理器

User B does not show User A's source-unknown To Do Board child-subtable cards.
```

Principal persistence evidence:

```bash
node -e "const crypto=require('crypto'); for (const s of ['subject:360226023557562598','subject:378779425816183014']) console.log(s+' '+crypto.createHash('sha256').update(s).digest('hex').slice(0,16))"
sqlite3 /Users/drop/dongyu/volume/persist/ui-server/runtime/default/yhl.principal-d4964316debfc047.db "select k, t, v from mt_data where table_id='host' and mt_id=0 and p=0 and r=0 and c=0 and k='principal_runtime_key';"
sqlite3 /Users/drop/dongyu/volume/persist/ui-server/runtime/default/yhl.principal-5bd636a9799deea5.db "select k, t, v from mt_data where table_id='host' and mt_id=0 and p=0 and r=0 and c=0 and k='principal_runtime_key';"
sqlite3 /Users/drop/dongyu/volume/persist/ui-server/runtime/default/yhl.principal-d4964316debfc047.db "select table_id, mt_id, count(*) from mt_data group by table_id, mt_id order by table_id, mt_id;"
sqlite3 /Users/drop/dongyu/volume/persist/ui-server/runtime/default/yhl.principal-5bd636a9799deea5.db "select table_id, mt_id, count(*) from mt_data group by table_id, mt_id order by table_id, mt_id;"
sqlite3 /Users/drop/dongyu/volume/persist/ui-server/runtime/default/yhl.principal-5bd636a9799deea5.db "select count(*) from mt_data where table_id like 'app:360226023557562598:%'; select count(*) from mt_data where table_id like 'app:378779425816183014:%';"
sqlite3 /Users/drop/dongyu/volume/persist/ui-server/runtime/default/yhl.principal-d4964316debfc047.db "select count(*) from mt_data where table_id like 'app:360226023557562598:%'; select count(*) from mt_data where table_id like 'app:378779425816183014:%';"
```

Observed:

```text
subject:360226023557562598 -> d4964316debfc047
subject:378779425816183014 -> 5bd636a9799deea5

User A DB:
- principal_runtime_key = "subject:360226023557562598"
- app:360226023557562598:to-do-board:2-0-21:1 | model 0 | 284 labels
- User A DB has 284 records under app:360226023557562598:*
- User A DB has 0 records under app:378779425816183014:*

User B DB:
- principal_runtime_key = "subject:378779425816183014"
- host|-100|1
- host|-2|8
- host|-1|2
- host|0|2
- User B DB has 0 records under app:360226023557562598:*
- User B DB has 0 records under app:378779425816183014:* because no App instance was installed for User B in this verification pass.
```

Interpretation:

- Two independent browser sessions are logged in as two different SSO users at the same local UI Server origin.
- Server-side `/auth/me` for User B resolves to the new ZITADEL subject and expected role/capability set.
- User B can see shared built-in/catalog Apps but does not inherit User A's mutable installed To Do Board child-subtable instances.
- Runtime persistence uses separate principal databases for User A and User B.
- User A's child ModelTable instance exists only in User A's principal database.
- User B's database does not contain User A's App table, so the visible UI difference is backed by durable state separation, not only a frontend filter.

Targeted verification after two-principal evidence capture:

```bash
node scripts/tests/test_0425_principal_desktop_state_contract.mjs
node scripts/tests/test_0425_visible_model_refs_contract.mjs
node scripts/tests/test_0425_persistence_table_key_contract.mjs
node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs
git diff --check -- docs/iterations/0425-principal-subtable-impl/runlog.md
bash scripts/ops/check_runtime_baseline.sh
```

Observed:

```text
test_0425_principal_desktop_state_contract.mjs: 6 passed
test_0425_visible_model_refs_contract.mjs: 7 passed, 0 failed
test_0425_persistence_table_key_contract.mjs: 6 passed, 0 failed
test_0425_slide_app_subtable_install_contract.mjs: 5 passed, 0 failed
git diff --check: PASS
check_runtime_baseline.sh: baseline ready
```

Sub-agent review:

```text
Decision: APPROVED

Findings: none

Open questions:
- none

Verification gaps:
- none
```

Cleanup:

```bash
"$PWCLI" -s=dy-0425-sso-user-b close
"$PWCLI" list
scripts/ops/playwright_session_guard.sh check-clean
multi_agent_v1.close_agent 019ef761-e027-7321-9047-d446cab246df
```

Observed:

```text
Browser 'dy-0425-sso-user-b' closed.
playwright-cli list: (no browsers).
PASS: no project Playwright session or project Playwright-managed browser process remains for dy-0400.
Review agent closed after APPROVED result.
```

## Stage 11: Closure

Status: COMPLETED

Purpose:

- Close iteration 0425 after all implementation stages, browser evidence, two-principal SSO isolation, and final review are complete.
- Preserve the historical runlog as a flight recorder: earlier `REVIEW` / `IN PROGRESS` labels in stage sections are intermediate states, superseded by the later `APPROVED`, targeted verification, and this closure record.

Final verification batch:

```bash
npm -C packages/ui-model-demo-frontend run build
npm -C packages/ui-model-demo-frontend run test
node scripts/tests/test_0425_model_ref_contract.mjs
node scripts/tests/test_0425_runtime_table_namespace_contract.mjs
node scripts/tests/test_0425_persistence_table_key_contract.mjs
node scripts/tests/test_0425_visible_model_refs_contract.mjs
node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs
node scripts/tests/test_0425_table_qualified_payload_reply_contract.mjs
node scripts/tests/test_0425_principal_desktop_state_contract.mjs
node scripts/tests/test_0403_principal_authorization.mjs
node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs
node scripts/tests/test_0405_todo_slide_app_contract.mjs
node scripts/tests/test_0407_current_model_ref_contract.mjs
node scripts/tests/test_0425_doc_examples_model_ref_contract.mjs
bash scripts/ops/check_runtime_baseline.sh
```

Observed:

```text
frontend build: PASS
frontend test: PASS
test_0425_model_ref_contract.mjs: PASS
test_0425_runtime_table_namespace_contract.mjs: 14 passed, 0 failed
test_0425_persistence_table_key_contract.mjs: 6 passed, 0 failed
test_0425_visible_model_refs_contract.mjs: 7 passed, 0 failed
test_0425_frontend_model_ref_projection_contract.mjs: 10 passed, 0 failed
test_0425_table_qualified_payload_reply_contract.mjs: 9 passed, 0 failed
test_0425_principal_desktop_state_contract.mjs: 6 passed
test_0403_principal_authorization.mjs: 6 passed, 0 failed
test_0425_slide_app_subtable_install_contract.mjs: 5 passed, 0 failed
test_0405_todo_slide_app_contract.mjs: 3 passed, 0 failed
test_0407_current_model_ref_contract.mjs: 8 passed, 0 failed
test_0425_doc_examples_model_ref_contract.mjs: PASS
check_runtime_baseline.sh: baseline ready; mosquitto, synapse, remote-worker, workspace-manager, mbr-worker, ui-server all READY.
```

Local deploy note:

```text
The explicit `bash scripts/ops/deploy_local.sh` run for this branch is recorded in Stage 10.
This closure pass changed only iteration documentation and did not modify runtime code after that browser validation, so the final pass reran contract checks and local health instead of rebuilding the local stack again.
```

Browser evidence summary:

```text
Single-principal local SSO and child-subtable App rendering: PASS.
Two-principal / two-browser SSO isolation: PASS.
Chrome User A: yuanchen yang, source-unknown To Do Board child-subtable Apps visible.
Playwright User B: 1st test / drop-test, shared catalog visible, User A child-subtable Apps absent.
Persistence: User A and User B resolved to different principal DB files; User B DB contains no User A app:* table records.
Screenshots:
- output/playwright/0425-sso-user-a-home.png
- output/playwright/0425-sso-user-b-home.png
- output/playwright/0425-sso-user-b-home-full.png
```

Iteration index update:

```text
docs/ITERATIONS.md status updated from In Progress to Completed for 0425-principal-subtable-impl.
```

Final sub-agent review:

```text
Decision: APPROVED

Findings: none

Open questions:
- none

Verification gaps:
- none
```

Final cleanup:

```bash
rg -n "status: in_progress|phase: planning|In Progress" docs/iterations/0425-principal-subtable-impl docs/ITERATIONS.md | head -40
"$PWCLI" list
scripts/ops/playwright_session_guard.sh check-clean
multi_agent_v1.close_agent 019ef771-1e42-7ac0-8875-87684d58608f
```

Observed:

```text
Secret scan for the user-provided test password was executed after final review and returned no matches. The exact secret pattern is intentionally omitted from this runlog.
No 0425 in-progress/planning status remains.
playwright-cli list: (no browsers).
PASS: no project Playwright session or project Playwright-managed browser process remains for dy-0400.
Final review agent closed after APPROVED result.
```

Final narrow re-review after secret-scan record cleanup:

```text
Decision: APPROVED

Findings: none

Open questions:
- none

Verification gaps:
- none
```
