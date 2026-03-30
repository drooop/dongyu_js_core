---
title: "0213 — matrix-debug-ui-surface Runlog"
doc_type: iteration-runlog
status: planned
updated: 2026-03-22
source: ai
iteration_id: 0213-matrix-debug-ui-surface
id: 0213-matrix-debug-ui-surface
phase: phase3
---

# 0213 — matrix-debug-ui-surface Runlog

## Environment

- Date: 2026-03-22
- Branch: `dropx/dev_0213-matrix-debug-ui-surface`
- Runtime: local repo + browser smoke

## Execution Records

### Step 1

- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "MODEL_ID_REGISTRY|Model -100|TRACE_MODEL_ID" CLAUDE.md packages/ui-model-demo-server/server.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0177_runtime_mode_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - 修复后整组重跑同上四条命令
- Key output:
  - `CLAUDE.md` `MODEL_ID_REGISTRY` 新增 `Model -100`，用途冻结为 `Matrix debug / bus trace model`
  - `packages/ui-model-demo-server/server.mjs` 明确声明：
    - `TRACE_MODEL_ID = -100`
    - `trace buffer / trace_append / minimal host glue may stay here`
    - `server_ui_ast_v0_is_legacy_debt_only`
  - 新增 `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`，冻结三类 guard：
    - `Model -100` 已登记
    - server `ui_ast_v0` 只允许作为待迁移债务存在
    - 0213 继续依赖 `runtime_mode` 与 `model100` submit-chain / no-direct-sendMatrix 合同
  - 首轮失败：
    - `test_matrix_debug_contract_depends_on_existing_guards: 0213 contract must continue to depend on the model100 no-direct-sendMatrix guard`
  - 修复：
    - 将 0213 contract test 从错误的运行时正则匹配改为检查 `test_0182` 中的字面量 no-direct-sendMatrix 合同
  - 重跑 GREEN：
    - `test_0177_runtime_mode_contract`: `2 passed, 0 failed`
    - `test_0182_model100_submit_chain_contract`: `PASS`
    - `test_0213_matrix_debug_surface_contract`: `3 passed, 0 failed`
- Result: PASS
- Commit: `5c322c2`

### Step 2

- Command:
  - 初次验证：
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_local.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs`
  - 基线修复后整组重跑同上五条命令
- Key output:
  - 新增 `packages/worker-base/system-models/matrix_debug_surface.json`：
    - 将 `Model -100` materialize 为 model-defined page asset
    - 在同一模型上声明 `app_name/source_worker/page_asset_v0/trace_* defaults`
  - `packages/worker-base/system-models/workspace_catalog_ui.json` 新增 `model.submt -> -100`
  - `packages/ui-model-demo-server/server.mjs` 删除 trace model `ui_ast_v0` 写入，正式 surface 改由 `matrix_debug_surface.json` 提供
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js` 本地模式加载 `matrix_debug_surface.json`，并补 `ws_apps_registry/ws_app_selected/ws_app_next_id` 派生
  - 新增 `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_local.mjs`
  - 首轮失败：
    - `ERR_MODULE_NOT_FOUND ... home_catalog_ui.json`
    - `test_non_workspace_page_catalogs_stop_using_root_ui_ast_bootstrap: ENOENT ... home_catalog_ui.json`
  - 修复：
    - 发现 `packages/worker-base/system-models/home_catalog_ui.json` 在当前 worktree 缺失，但 0191d/0211/demo bootstrap 仍显式依赖
    - 按 Git 历史 `7157d44` 精确恢复 `home_catalog_ui.json`（`page_asset_v0` 版本），仅补回既有基线，不引入新 Home 合同
  - 重跑 GREEN：
    - `test_0191d_test_workspace_asset_resolution`: `2 passed, 0 failed`
    - `test_0211_ui_bootstrap_and_submodel_migration`: `3 passed, 0 failed`
    - `test_0213_matrix_debug_surface_contract`: `3 passed, 0 failed`
    - `validate_matrix_debug_local`: `PASS`
    - Tier 1 file diff gate: `PASS`（无改动）
- Result: PASS
- Commit: `66baa2f`

### Step 3

- Command:
  - 初次验证：
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0177_runtime_mode_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0177_client_snapshot_secret_filter_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs`
  - 修复后串行重跑同上命令
- Key output:
  - 新增 `packages/worker-base/system-models/intent_handlers_matrix_debug.json`，并在 `intent_dispatch_config.json` 注册：
    - `matrix_debug_refresh`
    - `matrix_debug_clear_trace`
    - `matrix_debug_summarize`
  - `matrix_debug_surface.json` 升级为 Step 3 surface：
    - `subject select` 仅写 `-2/matrix_debug_subject_selected`
    - safe ops 按 action name 走 mailbox + dispatch
    - surface 不再 direct-write `Model -100`
  - `editor_page_state_derivers.js` 新增 `deriveMatrixDebugView()`，统一派生：
    - `matrix_debug_subjects_json`
    - `matrix_debug_readiness_text`
    - `matrix_debug_subject_summary_text`
    - `matrix_debug_trace_summary_text`
  - `server.mjs` 补最小宿主能力：
    - `buildClientSnapshot()` 对 `Model -100` 同时暴露 `(0,0,0)` 与 `(0,1,0)`
    - `ProgramModelEngine.hostApi` 新增 `matrixDebugRefresh/ClearTrace/Summarize`
    - 通过 `programEngine._matrixDebug*` 闭包连接 runtime/trace host glue
    - dispatch-table action 在 run loop 未激活时显式返回 `runtime_not_running`，允许 remote store 走现有自动激活逻辑
  - `local_bus_adapter.js` 为 `matrix_debug_*` 动作和 `matrix_debug_*` UI state 开最小例外，保证 local contract 不分叉
  - 新增 `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - 首轮失败与修复：
    - `test_0177_client_snapshot_secret_filter_contract` 暴露真实泄露：`deriveHomeTableRows()` 把 `matrix_token/matrix_passwd` 投影进 `home_table_rows_json`
      - 修复：在 `editor_page_state_derivers.js` 过滤 `matrix_token/matrix_passwd` 与对应 label.t
    - 原始 server-backed validator 依赖监听端口，在当前沙箱不稳定
      - 修复：`server.mjs` 仅在 main 入口监听端口，`test_0177...` 与 `validate_matrix_debug_server_sse.mjs` 改为 `createServerState()` in-process 验证
    - `label_update -> -2/matrix_debug_subject_selected` 被 `local_bus_adapter` 误判为 `forbidden_k`
      - 修复：允许 `matrix_debug_*` 作为明确的 UI projection key
    - `matrix_debug_refresh` 路由成功但 handler 不执行写回
      - 修复：hostApi 改走 `programEngine._matrixDebug*` 闭包；validator 显式激活 `running`
  - 最终 GREEN：
    - `test_0177_runtime_mode_contract`: `2 passed, 0 failed`
    - `test_0177_client_snapshot_secret_filter_contract`: `PASS`
    - `test_0182_model100_submit_chain_contract`: `PASS`
    - `test_0213_matrix_debug_surface_contract`: `4 passed, 0 failed`
    - `validate_matrix_debug_server_sse`: `PASS`
    - `npm -C packages/ui-model-demo-frontend run build`: `built in 2.39s`
    - Tier 1 file diff gate: `PASS`（无改动）
- Result: PASS
- Commit: `d3f4439`

### Step 4

- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0177_runtime_mode_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0177_client_snapshot_secret_filter_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run test`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "0213-matrix-debug-ui-surface|Model -100" CLAUDE.md docs/ITERATIONS.md docs/iterations/0213-matrix-debug-ui-surface/runlog.md`
- Key output:
  - 统一回归 GREEN：
    - `test_0177_runtime_mode_contract`: `2 passed, 0 failed`
    - `test_0177_client_snapshot_secret_filter_contract`: `PASS`
    - `test_0182_model100_submit_chain_contract`: `PASS`
    - `test_0191d_test_workspace_asset_resolution`: `2 passed, 0 failed`
    - `test_0211_ui_bootstrap_and_submodel_migration`: `3 passed, 0 failed`
    - `test_0213_matrix_debug_surface_contract`: `4 passed, 0 failed`
    - `validate_matrix_debug_local`: `PASS`
    - `validate_matrix_debug_server_sse`: `PASS`
    - `npm -C packages/ui-model-demo-frontend run test`: editor validator 全量 `PASS`
    - `npm -C packages/ui-model-demo-frontend run build`: `built in 2.40s`
  - docs assessment：
    - `docs/ssot/ui_to_matrix_event_flow.md`：已更新 0213 Matrix debug safe ops canonical path，明确 mailbox -> intent_dispatch -> hostApi -> `-2/-100`
    - `docs/user-guide/modeltable_user_guide.md`：已补 `Model -100` 的 reserved model 说明
    - `docs/user-guide/ui_components_v2.md`：已审阅，组件口径无新增/变更，无需更新
  - ledger 收口：
    - `docs/ITERATIONS.md`：`0213-matrix-debug-ui-surface` 状态改为 `Completed`
    - `rg` 命中 `CLAUDE.md`、`docs/ITERATIONS.md`、`runlog.md` 中的 `Model -100` / `0213-matrix-debug-ui-surface`
- Result: PASS
- Commit: `8519a29`

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] Matrix 相关 contract docs reviewed

```
Review Gate Record
- Iteration ID: 0213-matrix-debug-ui-surface
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: PLANNING
- Review Index: 0
- Decision: On Hold
- Revision Type: N/A
- Notes: Planning CLI failure

Review history:

```

```
Review Gate Record
- Iteration ID: 0213-matrix-debug-ui-surface
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查已完成，verdict 为 **APPROVED**，无阻塞问题。等待你确认后即可进入执行阶段。
```

```
Review Gate Record
- Iteration ID: 0213-matrix-debug-ui-surface
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 2
- Decision: APPROVED
- Revision Type: minor
- Notes: plan/resolution 结构完整、tier/model/flow 约束全覆盖、4 步验证链可执行，3 条 minor suggestions 不阻塞执行。
```

```
Review Gate Record
- Iteration ID: 0213-matrix-debug-ui-surface
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 3
- Decision: APPROVED
- Revision Type: minor
- Notes: plan/resolution 结构完整、scope 合理、五维合规均 pass，仅 Step 4 living docs 清单有一处 minor 遗漏。
```

```
Review Gate Record
- Iteration ID: 0213-matrix-debug-ui-surface
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: EXECUTION
- Review Index: 0
- Decision: On Hold
- Revision Type: N/A
- Notes: Execution CLI failure

Review history:
  - Round 1 (REVIEW_PLAN): APPROVED [n/a]
  - Round 2 (REVIEW_PLAN): APPROVED [minor]
  - Round 3 (REVIEW_PLAN): APPROVED [minor]
```
