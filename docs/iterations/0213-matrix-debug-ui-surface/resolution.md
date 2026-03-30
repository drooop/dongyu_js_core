---
title: "0213 — matrix-debug-ui-surface Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-22
source: ai
iteration_id: 0213-matrix-debug-ui-surface
id: 0213-matrix-debug-ui-surface
phase: phase1
---

# 0213 — matrix-debug-ui-surface Resolution

## 0. Execution Rules

- Work branch: `dropx/dev_0213-matrix-debug-ui-surface`
- Working directory for all commands: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Required local tools on PATH: `node`, `npm`, `rg`
- Steps must be executed in order.
- Every Step must end with executable validation commands and explicit PASS/FAIL evidence in `runlog.md`.
- `0213` 面向 Tier 1 调试对象，但默认交付路径仍必须优先保持为 Tier 2/system-model/UI surface：
  - page asset
  - negative-model state
  - intent/handler config
  - minimal host glue only
- 默认禁止修改以下 Tier 1 文件；若执行中发现必须改动这些文件才能成立，必须停止并把问题升级为新的设计/规划决策：
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
- 不得恢复或新增以下路径：
  - server 内嵌 `ui_ast_v0` 作为正式 page surface
  - UI 直接 `sendMatrix`
  - direct business truth mutation 伪装成“debug 操作”
  - client snapshot 泄露 Matrix token / password / raw secret
- `Model 100` 的既有 submit chain、runtime_mode gate、local-first egress authority 必须继续成立。
- Any real execution evidence belongs in `runlog.md`, not in this file.

## 1. Implementation Objective

0213 的实施顺序固定为：

1. 先把当前 de facto 的 `Bus Trace / TRACE_MODEL_ID=-100` 债务转成正式合同问题：
   - model id 怎么登记
   - 哪些历史行为可保留
   - 哪些 `ui_ast_v0` / hardcoded surface 必须删除
2. 再把 Matrix debug surface materialize 成新合同下的 model-defined page asset，并接到 Workspace 合法挂载路径
3. 然后补齐 subject/trace/readiness 的可观察状态与最小安全操作，同时保证不绕开现有 Matrix 主链路
4. 最后做 targeted regression、docs assessment、runlog/ledger 收口

禁止直接跳到“给页面加按钮/样式”。若不先收口 Step 1，后续实现极易再次把 `-100` 原型或 server hardcode 包装成正式交付。

## 2. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Freeze Matrix Debug Contract And Register IDs | 裁决 `-100` 与相关 companion ids 的正式地位，建立 0213 contract guard | `CLAUDE.md`, `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`, `packages/ui-model-demo-server/server.mjs` | `rg -n "MODEL_ID_REGISTRY|Model -100|TRACE_MODEL_ID" CLAUDE.md packages/ui-model-demo-server/server.mjs`; `node scripts/tests/test_0177_runtime_mode_contract.mjs`; `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`; `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs` | 0213 使用的 Matrix debug model ids 有正式登记；guard 明确禁止保留 server `ui_ast_v0` 原型作为正式 surface | 回退 `CLAUDE.md` 与 0213 contract test 改动 |
| 2 | Materialize Matrix Debug Surface And Workspace Mount | 把 debug 面迁成 `page_asset_v0 + model.submt` 主线，不再依赖 server 内嵌 AST | `packages/worker-base/system-models/matrix_debug_surface.json`, `packages/worker-base/system-models/workspace_catalog_ui.json`, `packages/ui-model-demo-server/server.mjs`, `packages/ui-model-demo-frontend/src/model_ids.js`, `packages/ui-model-demo-frontend/src/demo_modeltable.js` | `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`; `node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`; `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_local.mjs`; `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs` | Workspace 可选择并渲染 Matrix debug surface；page definition 不再由 server 直接写 `ui_ast_v0` | 回退 system-model patch、workspace mount、demo bootstrap、server surface 改动 |
| 3 | Add Subject State, Safe Ops, And Server-backed Alignment | 补齐主体状态、trace/readiness、最小安全操作和 server-backed 路径对齐 | `packages/worker-base/system-models/intent_dispatch_config.json`, `packages/worker-base/system-models/intent_handlers_matrix_debug.json`, `packages/ui-model-demo-server/server.mjs`, `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`, `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`, `scripts/tests/test_0213_matrix_debug_surface_contract.mjs` | `node scripts/tests/test_0177_runtime_mode_contract.mjs`; `node scripts/tests/test_0177_client_snapshot_secret_filter_contract.mjs`; `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`; `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`; `npm -C packages/ui-model-demo-frontend run build`; `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs` | debug surface 可观察 subject/trace/readiness，并提供最小安全操作；不会新增 direct UI→Matrix 或 secret leak | 回退 handler、derived state、server-backed validator 与 server glue 改动 |
| 4 | Regression, Docs Assessment, And Ledger Closeout | 跑统一回归，评估并更新 living docs，收口 runlog/ITERATIONS | `docs/iterations/0213-matrix-debug-ui-surface/runlog.md`, `docs/ITERATIONS.md`, 如有必要 `docs/ssot/ui_to_matrix_event_flow.md`, `docs/user-guide/modeltable_user_guide.md`, `docs/user-guide/ui_components_v2.md` | `node scripts/tests/test_0177_runtime_mode_contract.mjs`; `node scripts/tests/test_0177_client_snapshot_secret_filter_contract.mjs`; `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`; `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`; `node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`; `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_local.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`; `npm -C packages/ui-model-demo-frontend run test`; `npm -C packages/ui-model-demo-frontend run build`; `rg -n "0213-matrix-debug-ui-surface|Model -100" CLAUDE.md docs/ITERATIONS.md docs/iterations/0213-matrix-debug-ui-surface/runlog.md` | Targeted validations PASS；docs assessment 有明确结论；runlog/ledger 与 branch facts 一致 | 回退 0213 文档与代码改动，恢复执行前状态 |

## 3. Step Details

### Step 1 — Freeze Matrix Debug Contract And Register IDs

**Goal**

- 把当前 `TRACE_MODEL_ID=-100` 的“代码事实但未登记”状态转成正式合同：
  - `-100` 是否继续作为 Matrix debug / bus trace 的正式模型号
  - 是否需要 companion ids
  - 哪些当前行为属于保留的 host glue，哪些必须在 0213 中被替换

**Scope**

- 更新 `CLAUDE.md` `MODEL_ID_REGISTRY`：
  - 至少裁决 `Model -100`
  - 若 0213 引入新的 companion model ids，也必须在本步一起登记
- 新增/改造 `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`，使其至少断言：
  - 0213 使用的 model ids 已登记
  - Matrix debug surface 不得再把 server `ui_ast_v0` 视为正式输入面
  - debug surface 仍然必须建立在现有 runtime_mode / submit chain / no-direct-sendMatrix 合同之上
- 明确 `server.mjs` 中现有 Bus Trace 原型的裁决：
  - `trace buffer` / `trace_append` / minimal host glue 可以保留
  - `ui_ast_v0` 页面定义不能继续作为正式 contract

**Files**

- Create/Update:
  - `CLAUDE.md`
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `packages/ui-model-demo-server/server.mjs`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "MODEL_ID_REGISTRY|Model -100|TRACE_MODEL_ID" CLAUDE.md packages/ui-model-demo-server/server.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0177_runtime_mode_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
- Expected signals:
  - `Model -100`（以及任何新增 companion ids）在 `MODEL_ID_REGISTRY` 中有正式条目
  - `test_0213_matrix_debug_surface_contract.mjs` 明确把 server `ui_ast_v0` 视为必须消除的 debt
  - runtime_mode / model100 chain 仍然 PASS

**Acceptance Criteria**

- 0213 的 model placement 不再依赖聊天上下文或硬编码常识。
- 从本步开始，后续执行必须满足 0213 contract guard，而不是在实现后反向修改合同。

**Rollback Strategy**

- 回退 `CLAUDE.md` 的 model-id 登记改动。
- 回退 `scripts/tests/test_0213_matrix_debug_surface_contract.mjs` 与相关 inventory/guard 改动。

---

### Step 2 — Materialize Matrix Debug Surface And Workspace Mount

**Goal**

- 把 Matrix debug / Bus Trace surface 从 server 内嵌原型迁成新合同下的 model-defined page asset，并让它通过 Workspace 显式挂载成为可复用 surface。

**Scope**

- 新建 negative system-model patch（文件名可为 `matrix_debug_surface.json`），至少包括：
  - debug model root labels
  - `app_name` / `source_worker`
  - `page_asset_v0`
  - surface 所需的默认 debug state / visible labels
- 更新 `workspace_catalog_ui.json`，把 debug model 通过 `model.submt` 合法挂载进 Workspace，而不是依赖历史隐式入口。
- 调整 `server.mjs`：
  - 继续保留必要的 trace data/bootstrap glue
  - 但不再把 UI page definition 直接塞进 `ui_ast_v0`
- 更新 local demo bootstrap：
  - `model_ids.js` 补充共享 id 常量
  - `demo_modeltable.js` 在本地模式下也能载入同一 surface contract

**Files**

- Create/Update:
  - `packages/worker-base/system-models/matrix_debug_surface.json`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_local.mjs`
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs`
- Expected signals:
  - Workspace asset resolution 仍 PASS
  - Matrix debug surface 可通过合法 mount 被选中/渲染
  - debug page definition 来自 `page_asset_v0`，而不是 server `ui_ast_v0`
  - Tier 1 files 无改动

**Acceptance Criteria**

- Matrix debug surface 已成为 Workspace 主线中的正式可选应用，而不是 server 内嵌原型。
- local demo 与 server-backed path 至少共享同一 page asset / model id contract。

**Rollback Strategy**

- 回退 negative patch、workspace mount、server surface、demo bootstrap 与 local validator 改动。
- 删除所有只完成一半的 debug page / mount 中间态。

---

### Step 3 — Add Subject State, Safe Ops, And Server-backed Alignment

**Goal**

- 在不改 runtime semantics 的前提下，为 Matrix debug surface 补齐“主体状态 + trace/readiness + 最小安全操作”的完整 contract，并与 server-backed 路径对齐。

**Scope**

- 在 `intent_dispatch_config.json` 注册显式的 Matrix debug action contract（动作名可在 execution 期微调，但必须保持单一权威表）：
  - subject select / refresh
  - clear trace
  - 其他最小安全操作
- 新建 `intent_handlers_matrix_debug.json`，只允许处理：
  - debug state / selection
  - clear / refresh / summarize
  - 不允许直接替代 `Model 100` 的 submit chain
- 若需要主体列表、摘要文本、最近事件列表等派生数据，统一通过 `editor_page_state_derivers.js` 与 server sync 路径生成。
- `server.mjs` 只允许补最小宿主能力：
  - 连接现有 trace buffer / runtime_mode / Matrix adapter observable state
  - 对齐 server-backed validator 所需的受限 host 行为
  - 不允许新增 direct UI→Matrix side effect path
- 增加 server-backed validator，验证 remote/SSE 路径下：
  - surface 能读取主体状态与 trace 状态
  - safe ops 生效
  - secret 不泄露
  - model100 chain 不回退

**Files**

- Create/Update:
  - `packages/worker-base/system-models/intent_dispatch_config.json`
  - `packages/worker-base/system-models/intent_handlers_matrix_debug.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0177_runtime_mode_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0177_client_snapshot_secret_filter_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs`
- Expected signals:
  - runtime_mode gate / secret filter / model100 chain 继续 PASS
  - server-backed validator 证明 Matrix debug surface 的主体状态与 safe ops 可用
  - build PASS
  - Tier 1 files 无改动

**Acceptance Criteria**

- Matrix debug surface 能稳定观察：
  - 当前 subject
  - readiness/status
  - 最近 trace / bridge 摘要
- Matrix debug surface 具备最小安全操作，但不会变成 UI 直接控总线的旁路。
- server-backed 路径与 local contract 不分叉。

**Rollback Strategy**

- 回退 intent config、handler patch、server glue、derived state、server-backed validator 改动。
- 删除所有只完成半套的 debug action / subject registry / summary labels。

---

### Step 4 — Regression, Docs Assessment, And Ledger Closeout

**Goal**

- 在 0213 功能完成后做统一回归、living-docs assessment 与 iteration 事实归档，使 0214 能把 0213 当成稳定前提。

**Scope**

- 运行 0213 所需的 targeted regressions：
  - runtime_mode
  - secret filter
  - model100 chain
  - workspace asset resolution
  - 0211 migration guard
  - 0213 local/server validators
- 评估并按需更新 living docs：
  - `docs/ssot/ui_to_matrix_event_flow.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/user-guide/ui_components_v2.md`
- 在 `runlog.md` 记录命令、关键输出、commit、PASS/FAIL；在 `docs/ITERATIONS.md` 收口状态与 branch/commit facts。

**Files**

- Create/Update:
  - `docs/iterations/0213-matrix-debug-ui-surface/runlog.md`
  - `docs/ITERATIONS.md`
  - 如 public contract wording 有变化，再更新：
    - `docs/ssot/ui_to_matrix_event_flow.md`
    - `docs/user-guide/modeltable_user_guide.md`
    - `docs/user-guide/ui_components_v2.md`
- Must NOT touch:
  - `docs/iterations/0213-matrix-debug-ui-surface/plan.md`
  - `docs/iterations/0213-matrix-debug-ui-surface/resolution.md`
    除非 review gate 明确要求改计划

**Validation (Executable)**

- Commands:
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
- Expected signals:
  - 所有 targeted validations PASS
  - runlog 中有命令、关键输出、commit、PASS/FAIL
  - docs assessment 结论明确，不留在聊天上下文

**Acceptance Criteria**

- 0213 在功能、合规、文档和 ledger 四个面都可审计。
- `0214` 可以把 0213 当作现成 debug/ops infrastructure，而不是继续修复其基础合同。

**Rollback Strategy**

- 回退 0213 代码与文档改动。
- 恢复 `docs/ITERATIONS.md` 与 `runlog.md` 的执行前状态。
