---
title: "0214 — sliding-flow-ui Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-23
source: ai
iteration_id: 0214-sliding-flow-ui
id: 0214-sliding-flow-ui
phase: phase1
---

# 0214 — sliding-flow-ui Resolution

## 0. Execution Rules

- Work branch: `dropx/dev_0214-sliding-flow-ui`
- Working directory for all commands: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Required local tools on PATH: `node`, `npm`, `bun`, `rg`
- Steps must be executed in order.
- Every Step must end with executable validation commands and explicit PASS/FAIL evidence in `runlog.md`.
- 0214 的推荐实现边界是 frontend projection + validator：
  - 允许的主要改动点：`route_ui_projection.js`、`editor_page_state_derivers.js`、`demo_modeltable.js`、`server.mjs`、validators/tests
  - 默认禁止改动 runtime / renderer Tier 1 文件
- 当前 iteration 必须复用下列现有 truth-source，而不是复制或替代：
  - selected positive model business state
  - `Model -12` `scene_context`
  - `Model -1` `action_lifecycle`
  - `Model -100` / `matrix_debug_*`
- 若 flow shell 需要新增状态，只能是 `Model -2` 下的 UI-only focus/selection/projection labels。
- 不得新增或恢复以下路径：
  - direct-write `Model -12` `scene_context`
  - direct-write `Model -100` debug truth
  - direct-write `Model 0` / business truth 以伪装“流程切换”
  - shared AST / server-owned AST 作为正式输入面
  - runtime / renderer 语义扩张来迁就 0214
- `Model 100` 是本 iteration 的 executable flow anchor：
  - flow shell 至少要在 `Model 100` 上可验证；
  - `Model 1001/1002` 若复用同一 shell，只能在不伪造 submit/result 的前提下进入。
- Any real execution evidence belongs in `runlog.md`, not in this file.

## 1. Implementation Objective

0214 的实施顺序固定为：

1. 先冻结“什么叫 flow-capable app、flow shell 读哪些状态、哪些交互只是 UI-level 切换”；
2. 再把 selected app 与 flow shell 在 `Workspace` route 上合成，不改动非 Workspace 路由；
3. 然后做 local/server 对齐，证明 shell 在两条路径上都成立，且不破坏 `Model 100` submit/debug 合同；
4. 最后跑回归、评估 living docs，并把证据沉淀到 `runlog.md` / `ITERATIONS.md`。

禁止一上来直接在 server 或 page asset 里硬编码“大而全流程页”。0214 的目标是把既有业务面、过程态、debug 面组合成一个受约束的 shell，而不是再造新的 truth-source。

## 2. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Freeze Sliding Flow Contract And Projection Inputs | 明确 flow-capable 判定、shell 输入源、UI-only state 边界，并用 contract test 固化 | `packages/ui-model-demo-frontend/src/model_ids.js`, `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`, `packages/ui-model-demo-frontend/src/demo_modeltable.js`, `packages/ui-model-demo-server/server.mjs`, `scripts/tests/test_0214_sliding_flow_ui_contract.mjs` | `node scripts/tests/test_0182_app_shell_route_sync_contract.mjs`; `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`; `node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`; `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs` | flow shell 的数据来源、适用范围、UI-only state 边界有 contract guard；无 Tier 1 改动 | 回退新常量、deriver、state seed、contract test |
| 2 | Compose Workspace Sliding Flow Shell | 在 Workspace route 上把 selected app 包进 flow shell，保留非 Workspace 路由与 standalone debug 行为 | `packages/ui-model-demo-frontend/src/route_ui_projection.js`, `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`, `packages/ui-model-demo-frontend/src/ui_schema_projection.js`, `packages/ui-model-demo-frontend/scripts/validate_sliding_flow_local.mjs`, `scripts/tests/test_0201_route_local_ast_contract.mjs`, `scripts/tests/test_0214_sliding_flow_ui_contract.mjs` | `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`; `node scripts/tests/test_0201_route_local_ast_contract.mjs`; `node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_sliding_flow_local.mjs` | `/workspace` 可在 `Model 100` 上渲染 flow shell + selected app；其他 route 不倒退 | 回退 route projection、schema wrapper、local validator 与相关 contract test 改动 |
| 3 | Align Server/SSE Path And Preserve Submit/Debug Contracts | 保持 server snapshot / SSE 与 local flow shell 一致，并证明 `Model 100` submit/debug 链路未被 flow shell 破坏 | `packages/ui-model-demo-server/server.mjs`, `packages/ui-model-demo-frontend/scripts/validate_sliding_flow_server_sse.mjs`, `scripts/tests/test_0214_sliding_flow_ui_contract.mjs` | `node scripts/tests/test_0177_runtime_mode_contract.mjs`; `node scripts/tests/test_0182_workspace_route_init_contract.mjs`; `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`; `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`; `node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_sliding_flow_server_sse.mjs`; `npm -C packages/ui-model-demo-frontend run build` | server/SSE 路径下 flow shell 可用；不新增 direct write / direct send / route drift；`Model 100` 仍是 canonical flow anchor | 回退 server parity state、server-backed validator 与 contract test 改动 |
| 4 | Regression, Docs Assessment, And Ledger Closeout | 跑完整回归，评估是否需要更新 living docs，并收口 runlog/index | `docs/iterations/0214-sliding-flow-ui/runlog.md`, `docs/ITERATIONS.md`, 如有必要 `docs/ssot/runtime_semantics_modeltable_driven.md`, `docs/ssot/ui_to_matrix_event_flow.md`, `docs/user-guide/modeltable_user_guide.md` | `node scripts/tests/test_0182_app_shell_route_sync_contract.mjs`; `node scripts/tests/test_0182_workspace_route_init_contract.mjs`; `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`; `node scripts/tests/test_0201_route_local_ast_contract.mjs`; `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`; `node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`; `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_sliding_flow_local.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_sliding_flow_server_sse.mjs`; `npm -C packages/ui-model-demo-frontend run test`; `npm -C packages/ui-model-demo-frontend run build`; `rg -n "0214-sliding-flow-ui" docs/ITERATIONS.md docs/iterations/0214-sliding-flow-ui/runlog.md` | 回归全部 PASS；docs assessment 有明确结论；runlog/index 与最终事实一致 | 回退 0214 代码与文档改动，恢复到执行前状态 |

## 3. Step Details

### Step 1 — Freeze Sliding Flow Contract And Projection Inputs

**Goal**

- 把 0214 的输入源与边界写成可执行 contract：
  - 哪些 app 可进入 flow shell；
  - flow shell 读哪些模型；
  - 哪些 state 允许放在 `Model -2`；
  - 哪些 direct write 必须被禁止。

**Scope**

- 在 `model_ids.js` 中显式暴露 flow shell 需要复用的模型常量，避免实现时散落魔法数字。
- 在 `editor_page_state_derivers.js` 中新增或补充：
  - flow-capable app 判定；
  - 基于 selected model、`scene_context`、`action_lifecycle`、`matrix_debug_*` 的 flow projection helper；
  - 明确 projection 只是读 truth-source，不写系统真值。
- 若 flow shell 需要最小 UI-only state（例如当前查看阶段/页签），只在：
  - `demo_modeltable.js`
  - `server.mjs`
  中初始化 `Model -2` 标签，保持 local / server 初始态一致。
- 新增 `scripts/tests/test_0214_sliding_flow_ui_contract.mjs`，至少断言：
  - flow shell 不 direct-write `Model -12` / `Model -100` / `Model 0`
  - `Model 100` 被视为 executable flow anchor
  - `0213` debug surface 仍是被复用的现有 contract，而不是被重写
  - runtime / renderer Tier 1 文件未被拖入实现

**Files**

- Create/Update:
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/worker-base/system-models/matrix_debug_surface.json`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_app_shell_route_sync_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs`
- Expected signals:
  - `0214` contract test能明确指出 flow shell 的输入模型与禁止写路径
  - `0213` contract 继续 PASS，说明 flow shell 没有破坏 debug surface 基线
  - Tier 1 files 无改动

**Acceptance Criteria**

- 0214 的数据边界和适用范围已由 test 固化，不再依赖聊天解释。
- 执行团队可以基于 Step 1 直接实现 shell，而不会把 `Model -2` 误当过程真值模型。

**Rollback Strategy**

- 回退 `model_ids.js` 新常量。
- 回退 deriver / state seed 改动。
- 删除 `test_0214_sliding_flow_ui_contract.mjs`。

---

### Step 2 — Compose Workspace Sliding Flow Shell

**Goal**

- 在 `Workspace` route 上，把当前 selected app 包进一层 flow shell：
  - 左侧 app tree 维持现状；
  - 右侧 selected slot 不再只是裸 app AST，而是“flow shell + selected app”的组合。

**Scope**

- 更新 `route_ui_projection.js`：
  - 只在 `Workspace` route 尝试包裹 flow shell；
  - 非 Workspace route 和 standalone Matrix debug app 必须保持当前行为。
- flow shell 必须基于现有组件组合：
  - `Card`
  - `StatusBadge`
  - `Tabs`
  - `Table`
  - `ProgressBar`
  - `Text`
- 若 selected app 需要轻量包装（例如把 schema AST 放入 shell 指定区域），可最小调整 `ui_schema_projection.js`，但不得扩协议字段集合。
- 新增 local validator，至少验证：
  - `Model 100` 在 `/workspace` 下能显示 flow shell；
  - selected app 本体仍存在；
  - flow shell 内至少能看到 process/debug 摘要节点；
  - 非 flow route 不回退成 workspace placeholder 或 shared page 错配。

**Files**

- Create/Update:
  - `packages/ui-model-demo-frontend/src/route_ui_projection.js`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-model-demo-frontend/src/ui_schema_projection.js`
  - `packages/ui-model-demo-frontend/scripts/validate_sliding_flow_local.mjs`
  - `scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
- Must NOT touch:
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/matrix_debug_surface.json`
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_sliding_flow_local.mjs`
- Expected signals:
  - workspace asset resolution 继续 PASS
  - local route projection 能渲染 flow shell + selected app
  - `validate_sliding_flow_local.mjs` 能明确命中 flow shell 的关键节点

**Acceptance Criteria**

- `Workspace` route 中 `Model 100` 不再只是裸 schema 表单，而是带有 flow shell 的可组合视图。
- 其他 route 不受影响；没有重新出现 shared AST / placeholder regression。

**Rollback Strategy**

- 回退 route projection 与 schema wrapper 改动。
- 删除 local validator 与相关 contract test 改动。

---

### Step 3 — Align Server/SSE Path And Preserve Submit/Debug Contracts

**Goal**

- 证明 0214 不是“只在 local demo 好看”的壳，而是在 server/SSE path 下也成立，并且不破坏 `Model 100` 的现有 submit/debug 合同。

**Scope**

- `server.mjs` 只允许做两类工作：
  - 与 local path 对齐 `Model -2` flow UI 初始化/默认值；
  - 确保 snapshot/SSE 路径能暴露 Step 1/2 需要的 projection 输入。
- 新增 `validate_sliding_flow_server_sse.mjs`，至少覆盖：
  - 切到 `/workspace`
  - 选中 `Model 100`
  - 读取 flow shell 相关 AST / snapshot state
  - 执行已有 debug safe ops（复用 `0213`）后，flow shell 仍保持一致
- 继续以现有 tests 保护：
  - runtime mode gate
  - `Model 100` submit chain
  - `0213` Matrix debug surface

**Files**

- Create/Update:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_sliding_flow_server_sse.mjs`
  - `scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/worker-base/system-models/intent_dispatch_config.json`
  - `packages/worker-base/system-models/intent_handlers_matrix_debug.json`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0177_runtime_mode_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_workspace_route_init_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_sliding_flow_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
- Expected signals:
  - server-backed validator 能看到与 local path 一致的 flow shell
  - `Model 100` submit chain 继续 PASS
  - `0213` debug safe ops 继续 PASS
  - build PASS

**Acceptance Criteria**

- local 与 server/SSE 两条路径都能稳定渲染 `Model 100` flow shell。
- flow shell 不引入任何 direct send / direct system-model mutation / route drift。

**Rollback Strategy**

- 回退 `server.mjs` 中的 flow parity 改动。
- 删除 server-backed validator。
- 回退相关 contract test 增补。

---

### Step 4 — Regression, Docs Assessment, And Ledger Closeout

**Goal**

- 在完成实现后，以 deterministic 方式收口 0214：
  - 回归通过；
  - living docs 评估完成；
  - `runlog.md` / `ITERATIONS.md` 与事实一致。

**Scope**

- 跑完 0214 相关 regression 组合，而不是只跑新增 validator。
- 评估以下文档是否需要更新：
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/ui_to_matrix_event_flow.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/ITERATIONS.md`
  - `docs/iterations/0214-sliding-flow-ui/runlog.md`
- 只有当 0214 实际改变了 contract 口径时才更新 SSOT；若无需改动，也必须在 `runlog.md` 记录“reviewed / no change needed”。

**Files**

- Create/Update:
  - `docs/iterations/0214-sliding-flow-ui/runlog.md`
  - `docs/ITERATIONS.md`
  - 如需要：`docs/ssot/runtime_semantics_modeltable_driven.md`
  - 如需要：`docs/ssot/ui_to_matrix_event_flow.md`
  - 如需要：`docs/user-guide/modeltable_user_guide.md`

**Validation (Executable)**

- Commands:
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
- Expected signals:
  - regression commands 全部 PASS
  - `runlog.md` 已记录真实命令与结果
  - `ITERATIONS.md` 状态与最终事实一致
  - docs assessment 有明确结论（updated 或 reviewed/no change）

**Acceptance Criteria**

- 0214 的 local/server flow shell、route sync、submit/debug 合同全部有 PASS 证据。
- 文档与 ledger 收口完整，没有“代码改了但 runlog/index 没落盘”的情况。

**Rollback Strategy**

- 回退 0214 的代码与文档改动到执行前状态。
- 若仅文档判断错误，则回退文档改动并保留已验证代码提交。

## 4. Rollback Principles

- 回滚优先级：
  1. 先回退 flow shell 组合逻辑与新增 UI-only state；
  2. 再回退 validators / contract tests；
  3. 最后回退 runlog / docs 更新。
- 若回滚后仍需保留 0213 debug surface 基线，必须重新运行：
  - `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
- 若任何回滚需要触及 runtime / renderer Tier 1 文件，说明执行期已越界，必须停止并升级为新的规划问题。
