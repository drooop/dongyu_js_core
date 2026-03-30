---
title: "0214 — sliding-flow-ui Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-03-22
source: ai
iteration_id: 0214-sliding-flow-ui
id: 0214-sliding-flow-ui
phase: phase3
---

# 0214 — sliding-flow-ui Runlog

## Environment

- Date: 2026-03-22
- Branch: `dropx/dev_0214-sliding-flow-ui`
- Runtime: local repo + browser smoke

## Execution Records

### Step 1

- Command:
  - RED baseline:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
  - GREEN:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_app_shell_route_sync_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs`
- Key output:
  - RED baseline 首次失败：
    - `SyntaxError: ... model_ids.js does not provide an export named 'ACTION_LIFECYCLE_MODEL_ID'`
  - Step 1 实现收口：
    - `packages/ui-model-demo-frontend/src/model_ids.js` 显式导出：
      - `ACTION_LIFECYCLE_MODEL_ID = -1`
      - `SCENE_CONTEXT_MODEL_ID = -12`
      - `WORKSPACE_CATALOG_MODEL_ID = -25`
      - `FLOW_SHELL_ANCHOR_MODEL_ID = 100`
      - `FLOW_SHELL_TAB_LABEL = flow_tab_selected`
      - `FLOW_SHELL_INPUT_MODEL_IDS / FLOW_SHELL_FORBIDDEN_WRITE_MODEL_IDS`
    - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js` 新增：
      - `isFlowCapableWorkspaceApp()`，Step 1 冻结 `Model 100` 为当前唯一 executable flow anchor
      - `deriveSlidingFlowShellState()`，统一读取 `selected app + Model -12 scene_context + Model -1 action_lifecycle + 0213 matrix debug projection`
    - `packages/ui-model-demo-frontend/src/demo_modeltable.js` 本地模式新增 bootstrap：
      - 加载 `workspace_positive_models.json`
      - 加载 `cognition_scene_model.json`
      - 加载 `cognition_lifecycle_model.json`
      - 在 `Model -2` 初始化 `flow_tab_selected=process`
    - `packages/ui-model-demo-server/server.mjs` 对齐 server path 的 `Model -2 flow_tab_selected=process` 默认值
    - 新增 `scripts/tests/test_0214_sliding_flow_ui_contract.mjs`，冻结：
      - flow shell 输入模型集合
      - forbidden direct-write boundary（`Model 0 / -12 / -100`）
      - local/server 一致的 UI-only seed
      - `Model 100` anchor + 0213 debug projection 复用
  - GREEN 结果：
    - `test_0182_app_shell_route_sync_contract`: `PASS`
    - `test_0213_matrix_debug_surface_contract`: `4 passed, 0 failed`
    - `test_0214_sliding_flow_ui_contract`: `4 passed, 0 failed`
    - Tier 1 file diff gate: `PASS`（无改动）
- Result: PASS
- Commit: `da02133`

### Step 2

- Command:
  - RED baseline:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0201_route_local_ast_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_sliding_flow_local.mjs`
  - GREEN:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0201_route_local_ast_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_sliding_flow_local.mjs`
- Key output:
  - RED baseline 首轮失败：
    - `test_workspace_route_prefers_local_path_over_shared_ui_page: workspace route must wrap Model 100 in sliding flow shell`
    - `test_workspace_route_wraps_model100_in_sliding_flow_shell_without_forbidden_writes: workspace route must wrap Model 100 in sliding flow shell`
    - `validate_sliding_flow_local: FAIL / sliding_flow_root_missing`
  - Step 2 实现收口：
    - `packages/ui-model-demo-frontend/src/route_ui_projection.js` 新增 constrained flow shell 组合层：
      - 仅在 `/workspace` + selected `Model 100` + flow-capable 条件下包裹 shell
      - `Matrix Debug` (`Model -100`) 继续走 0213 standalone surface，不进入 shell
      - shell 只使用现有组件：`Card` / `StatusBadge` / `Tabs` / `Table` / `ProgressBar` / `Text`
      - `Tabs` 唯一 write target 为 `Model -2 / flow_tab_selected`
    - 新增 `packages/ui-model-demo-frontend/scripts/validate_sliding_flow_local.mjs`
    - `scripts/tests/test_0201_route_local_ast_contract.mjs` 补强：
      - `/workspace` + `Model 100` 必须出现 `sliding_flow_root/process_table/debug_table/schema_root_100`
    - `scripts/tests/test_0214_sliding_flow_ui_contract.mjs` 补强：
      - flow shell 节点禁止 direct-write `Model 0 / -12 / -100`
      - `Matrix Debug` workspace route 继续保持 unwrapped
  - GREEN 结果：
    - `test_0191d_test_workspace_asset_resolution`: `2 passed, 0 failed`
    - `test_0201_route_local_ast_contract`: `4 passed, 0 failed`
    - `test_0214_sliding_flow_ui_contract`: `6 passed, 0 failed`
    - `validate_sliding_flow_local`: `PASS`
- Result: PASS
- Commit: `e81211f`

### Step 3

- Command:
  - 初次验证：
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0177_runtime_mode_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_workspace_route_init_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_sliding_flow_server_sse.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
  - 修复后整组重跑同上八条命令
- Key output:
  - Step 3 新增 server-side 证据：
    - `packages/ui-model-demo-frontend/scripts/validate_sliding_flow_server_sse.mjs`
    - `scripts/tests/test_0214_sliding_flow_ui_contract.mjs` 新增 server snapshot + debug safe ops case
  - 首轮失败：
    - `test_0182_workspace_route_init_contract` 在当前环境下稳定报错：
      - `server exited early with code=1`
      - `Failed to start server. Is port <39xxx> in use?`
  - Root cause：
    - 失败发生在测试基础设施层，而不是 0214 路由行为层
    - 旧版 `test_0182_workspace_route_init_contract.mjs` 依赖 `bun` 监听随机端口；当前环境下监听端口不稳定，与 0213/0214 已改用的 in-process validator 方式不一致
  - 修复：
    - 将 `test_0182_workspace_route_init_contract.mjs` 改为 `createServerState()` in-process contract
    - 保留原合同语义：
      - startup `ws_apps_registry` 非空
      - 进入 `workspace` 后 `selected_model_id == ws_app_selected`
      - 切换到 alternative app 后同步仍成立
  - GREEN 结果：
    - `test_0177_runtime_mode_contract`: `2 passed, 0 failed`
    - `test_0182_workspace_route_init_contract`: `PASS`
    - `test_0182_model100_submit_chain_contract`: `PASS`
    - `test_0213_matrix_debug_surface_contract`: `4 passed, 0 failed`
    - `test_0214_sliding_flow_ui_contract`: `7 passed, 0 failed`
    - `validate_matrix_debug_server_sse`: `PASS`
    - `validate_sliding_flow_server_sse`: `PASS`
    - `npm -C packages/ui-model-demo-frontend run build`: `✓ built in 2.30s`
- Result: PASS
- Commit: `ed05a1d`

### Step 4

- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_app_shell_route_sync_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_workspace_route_init_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_sliding_flow_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_sliding_flow_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run test`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "0214-sliding-flow-ui" docs/ITERATIONS.md docs/iterations/0214-sliding-flow-ui/runlog.md`
- Key output:
  - 全量回归 GREEN：
    - `test_0182_app_shell_route_sync_contract`: `PASS`
    - `test_0182_workspace_route_init_contract`: `PASS`
    - `test_0191d_test_workspace_asset_resolution`: `2 passed, 0 failed`
    - `test_0201_route_local_ast_contract`: `4 passed, 0 failed`
    - `test_0213_matrix_debug_surface_contract`: `4 passed, 0 failed`
    - `test_0214_sliding_flow_ui_contract`: `7 passed, 0 failed`
    - `test_0182_model100_submit_chain_contract`: `PASS`
    - `validate_sliding_flow_local`: `PASS`
    - `validate_sliding_flow_server_sse`: `PASS`
    - `npm -C packages/ui-model-demo-frontend run test`: `validate_editor.mjs` 全量 `PASS`
    - `npm -C packages/ui-model-demo-frontend run build`: `✓ built in 2.34s`
  - 回归期间发现并修复：
    - `validate_editor.mjs` 旧假设 `Model 2` 不存在、`Model 1 title` 为空；0214 local bootstrap 现已合法加载 `workspace_positive_models.json`
    - 修复为：
      - `submodel_create` 使用当前不存在的 next model id 作为 reject target
      - business direct mutation case 改为校验业务值未被改写/清空，而不是假设 label 缺失
  - Living docs assessment：
    - `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed: no update required
    - `docs/ssot/ui_to_matrix_event_flow.md` reviewed: no update required
    - `docs/user-guide/modeltable_user_guide.md` reviewed: no update required
    - 理由：0214 只新增 frontend/server-side projection、validator、in-process test harness；未改变 runtime semantics、mailbox contract、label.t registry、pin routing 或 reserved model ids
  - Ledger closeout：
    - `docs/ITERATIONS.md`: `0214-sliding-flow-ui` 状态改为 `Completed`
    - `rg` 命中 `docs/ITERATIONS.md` 与本 runlog 中的 `0214-sliding-flow-ui`
- Result: PASS
- Commit: `9f1c2f5`

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] `0213` debug surface outputs reviewed

```
Review Gate Record
- Iteration ID: 0214-sliding-flow-ui
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查已完成，结论已输出。等待你确认是否接受 APPROVED verdict。
```

```
Review Gate Record
- Iteration ID: 0214-sliding-flow-ui
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 2
- Decision: APPROVED
- Revision Type: minor
- Notes: plan/resolution 五维合规全部 pass，4 Step 验证命令完整可执行，scope 合理受控，推荐放行。
```

```
Review Gate Record
- Iteration ID: 0214-sliding-flow-ui
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 3
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查已完成，结论是 **APPROVED**。由于这是一个评审任务而非实现规划任务，不需要写 plan file 或退出 plan mode — 审查结果已在上方完整输出。
```

```
Review Gate Record
- Iteration ID: 0214-sliding-flow-ui
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: This is a review task, not an implementation planning task — no plan file is needed and ExitPlanMode is not appropriate here. The review verdict has already been output above.
```

```
Review Gate Record
- Iteration ID: 0214-sliding-flow-ui
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 2
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查完毕。0214-sliding-flow-ui 四步交付完整，全部验证通过，推荐 APPROVED 放行。
```

```
Review Gate Record
- Iteration ID: 0214-sliding-flow-ui
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 3
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查完毕。0214-sliding-flow-ui 四步交付完整、验证全绿、五维合规全 pass，verdict = **APPROVED**。
```
