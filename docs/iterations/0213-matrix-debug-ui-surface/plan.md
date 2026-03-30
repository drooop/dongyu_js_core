---
title: "0213 — matrix-debug-ui-surface Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-22
source: ai
iteration_id: 0213-matrix-debug-ui-surface
id: 0213-matrix-debug-ui-surface
phase: phase1
---

# 0213 — matrix-debug-ui-surface Plan

## 0. Metadata

- ID: `0213-matrix-debug-ui-surface`
- Date: `2026-03-22`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0213-matrix-debug-ui-surface`
- Planning mode: `refine`
- Depends on:
  - `0210-ui-cellwise-contract-freeze`
  - `0211-ui-bootstrap-and-submodel-migration`
  - `0212-home-crud-proper-tier2`
- Downstream:
  - `0214-sliding-flow-ui`
  - `0217-gallery-extension-matrix-three`

## 1. Goal

- 把当前分散、半历史化的 Matrix / bridge 调试能力收敛成一套**可复用、可挂载、可验证**的 debug / ops UI surface，使 Matrix 通讯主体不再只剩零散状态字段或 server 内嵌原型，而是拥有一套遵守 `0210/0211` 新合同的统一调试面。
- 该 surface 必须满足两件事：
  - 让人能在 UI 中观察 Matrix 链路关键状态与最近活动；
  - 让 `0214-sliding-flow-ui` 直接复用同一批 debug 状态、操作口径和验证锚点，而不是再起一套并行调试面。

## 2. Background

- `0210-ui-cellwise-contract-freeze` 已冻结 UI 主合同：
  - UI authoritative input 必须来自真实 cell / label / mounted model。
  - 禁止把 `ui_ast_v0`、共享 AST、隐式 fallback 继续当正式输入面。
  - hidden helper / routing / observer 默认应放在负数系统模型。
- `0211-ui-bootstrap-and-submodel-migration` 已把主线 UI 从 root `ui_ast_v0` / shared AST 迁到 `page_asset_v0 + mounted model` 路径。
- `0212-home-crud-proper-tier2` 已补齐一个新的可执行 Tier 2 页面样板，但它明确把 Matrix debug surface 留给后续 iteration。
- 当前仓库已经存在一个 **Bus Trace / Matrix debug 原型**，但它仍停在历史债务状态：
  - [server.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-server/server.mjs) 内直接创建 `TRACE_MODEL_ID = -100`。
  - 原型页面 AST 仍由 server 直接写入 `ui_ast_v0`，不符合 `0210/0211` 冻结后的新输入面。
  - 该原型依赖 `registerFunction` / `initDataModel` / runtime bootstrap 直接搭建，不是当前 system-model patch + `page_asset_v0` 的正式合同。
  - `CLAUDE.md` 的 `MODEL_ID_REGISTRY` 尚未为 `-100` 给出正式登记。
- 同时，当前真正承载 Matrix 往返链路的业务主体，仍主要表现为 `Model 100` 的双总线链路示例：
  - [workspace_positive_models.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/workspace_positive_models.json) 为 `Model 100` 声明了 `dual_bus_model`、`system_ready`、`submit_inflight`、`status` 等关键状态。
  - [test_0182_model100_submit_chain_contract.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0182_model100_submit_chain_contract.mjs) 已明确要求 submit 不能直接 `sendMatrix()`，而必须沿现有本地链路上送到 `Model 0`。
- 因此 0213 的职责不是发明一套新总线，也不是重写 runtime，而是把**现有 Matrix 调试原型 + 现有双总线主体状态**正规化成一个可复用 debug surface。

## 3. Problem Statement

- 当前 Matrix 调试能力存在四个明确问题：
  - **原型不合规**：
    - 现有 Bus Trace 页面是 `server.mjs` 里的硬编码 `ui_ast_v0`，与 `0210/0211` 冻结合同冲突。
  - **入口不稳定**：
    - Workspace / page asset 主线已经切到 `page_asset_v0 + mounted model`，但 Matrix debug surface 还没有成为这条主线的一部分。
  - **状态碎片化**：
    - `Model 100`、Matrix adapter、trace buffer、runtime mode、桥接返回事件分散在不同位置，没有一张统一的调试面把“当前主体状态 + 最近链路事件 + 可执行操作”整合起来。
  - **下游缺锚点**：
    - `0214` 需要一个现成的 debug / ops surface 来承载 sliding flow 的过程态观察；如果 `0213` 不先收口，`0214` 很容易再造一套不一致的调试状态。

## 4. Scope

### 4.1 In Scope

- 把现有 `Bus Trace` / Matrix debug 原型正规化为**新合同下的 UI surface**：
  - 使用已登记的 model id；
  - 使用 `page_asset_v0` / mounted model / explicit route；
  - 不再依赖 server 内嵌 `ui_ast_v0` 页面定义。
- 为 Matrix 通讯主体补齐一套统一的 debug/ops 观察面，至少覆盖：
  - 当前主体选择或标识
  - runtime / bridge readiness
  - 关键状态字段（如 `system_ready`、`submit_inflight`、`status`）
  - 最近 trace / bridge event 文本或等价可读摘要
  - 最小安全操作（例如 trace 开关、clear、refresh、subject 切换）
- 明确 host glue 与 Tier 2 合同的边界：
  - 哪些仍属于 server/adapter 提供的最小宿主观测能力；
  - 哪些必须下沉为 system-model page asset / handler / state。
- 增加 deterministic contract / conformance validation，覆盖：
  - model placement
  - workspace mount
  - no-`ui_ast_v0` regression
  - no direct UI→Matrix bypass
  - no secret leakage in client snapshot

### 4.2 Out of Scope

- 不新增 `runtime.js` / `runtime.mjs` 的解释器语义。
- 不新增 renderer 组件类型或新的 `$ref` / bind 规则。
- 不做新的 Matrix credential 配置页，不做 remote deploy / k8s / cloud 操作。
- 不实现 sliding-flow UI；`0214` 才负责过程态编排。
- 不把 UI 调试面变成原始 Matrix 消息注入器或通用总线控制台。
- 不恢复 `ui_ast_v0`、shared AST、或 direct UI→Matrix 旁路来“快速做出可视化”。

## 5. Conformance Targets

### 5.1 Tier Boundary

- 0213 面向的是 **Tier 1 调试对象**（runtime / Matrix / bridge / host glue 可观测性），但交付形态应优先保持为 **Tier 2/system-model/UI surface**：
  - page asset
  - negative-model state
  - handler / intent config
  - minimal host glue only where current runtime already exposes data
- 如果执行中发现必须修改以下文件才能成立，当前 iteration 必须停下并升级为新的设计问题，而不是直接越 Tier：
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`

### 5.2 Model Placement

- `Model -1` 仍然只负责 UI event mailbox。
- `Model -10` 仍然只负责 hidden infrastructure logic / intent handlers。
- `Model 0` 仍然是 Matrix / bus egress 的唯一系统边界。
- 0213 必须把当前 de facto 的 `TRACE_MODEL_ID=-100` 处理成正式合同：
  - 要么把 `Model -100` 正式登记为 Matrix debug / bus trace system-visible surface；
  - 要么显式退役 `-100` 并改用新的已登记负数模型；
  - 两者只能选其一，不能继续“代码里直接用、文档里不登记”。
- 若引入 companion model（例如 asset / state / mailbox 分拆），也必须先进入 `CLAUDE.md` `MODEL_ID_REGISTRY`，且只能使用 `-100..-199` 的系统可见 UI 区间。

### 5.3 Data Ownership / Flow / Chain

- Ownership：
  - 业务主体（如 `Model 100`）仍拥有业务真值和业务状态。
  - Matrix debug surface 只拥有 debug / trace / selection / display state，不拥有业务真值。
  - host glue 只负责暴露已有可观测信息与受限控制点，不可把业务逻辑偷回 server hardcode。
- Allowed flow：
  1. UI 读取主体状态、trace 状态和 debug model 状态；
  2. UI 写 mailbox 或显式允许的 debug state；
  3. handler / host glue 根据受限 contract 执行 clear / refresh / selection / status sync；
  4. Matrix/bridge 主链路仍按 `UI -> mailbox -> model/handler -> Model 0 egress -> sendMatrix` 运行。
- Forbidden：
  - UI 直接发送 Matrix 消息
  - UI 直接写 `Model 0` 或业务主体真值来“制造调试操作”
  - 通过 debug surface 恢复 legacy `mailbox -> direct sendMatrix` 旁路
  - 在 client snapshot 中暴露 `matrix_token`、`matrix_passwd` 等 secret

## 6. Impact Surface

### 6.1 Governance / Registry

- `CLAUDE.md`
  - 正式登记 `0213` 采用的 Matrix debug model id（至少需要裁决当前 `-100` 的地位）

### 6.2 System-model Assets / Intent

- `packages/worker-base/system-models/workspace_catalog_ui.json`
  - 若 debug surface 需要作为 Workspace 可选应用出现，必须通过显式 `model.submt` 合法挂载
- `packages/worker-base/system-models/intent_dispatch_config.json`
- `packages/worker-base/system-models/intent_handlers_matrix_debug.json`（new）
- `packages/worker-base/system-models/matrix_debug_surface.json`（new，名称可在 execution 期微调，但必须保持单一权威入口）

### 6.3 Host Bootstrap / Trace Runtime Glue

- `packages/ui-model-demo-server/server.mjs`
  - 当前 `TRACE_MODEL_ID=-100`
  - 当前 `ui_ast_v0` Bus Trace 原型
  - 当前 trace buffer / `trace_append` / clear handler / Matrix adapter observable path

### 6.4 Frontend Shared Projection / Local Demo

- `packages/ui-model-demo-frontend/src/model_ids.js`
- `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`（仅当 workspace/debug 路由投影需要调整时）

### 6.5 Validation Surface

- Existing regression anchors:
  - `scripts/tests/test_0177_runtime_mode_contract.mjs`
  - `scripts/tests/test_0177_client_snapshot_secret_filter_contract.mjs`
  - `scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
- New validation targets:
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_local.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`

## 7. Success Criteria

- Matrix debug surface 在新合同下可被无上下文读者理解和使用：
  - 有明确 model placement
  - 有明确 page asset / workspace mount
  - 有明确 subject state / trace state / safe ops 口径
- 当前 server 内嵌的 Bus Trace `ui_ast_v0` 不再是正式 UI 输入面。
- `Model 100` 的既有 submit chain 合同继续成立：
  - debug surface 可以观察它；
  - 但不会绕过它。
- 客户端快照仍不泄露 Matrix secret，debug surface 不把敏感 bootstrap label 暴露为 UI bind。
- `0214` 可以直接复用 0213 的 debug state / action / validation 锚点，而不需要重新定义调试入口。

## 8. Risks & Mitigations

- Risk:
  - 现有 Bus Trace 原型“已经能看”而被误当作正式合同直接沿用。
  - Mitigation:
    - 明确区分“保留的 trace data/runtime glue”和“必须移除的 `ui_ast_v0` / hardcoded page surface”。

- Risk:
  - 为了补操作入口，重新引入 direct UI→Matrix 或 direct business mutation。
  - Mitigation:
    - 以 `test_0182_model100_submit_chain_contract.mjs` 与 runtime-mode/secret-filter tests 作为 guard。

- Risk:
  - 0213 scope 膨胀成完整 flow builder 或通用总线控制台。
  - Mitigation:
    - 把本轮交付收敛为“观察 + 最小安全操作 + reusable debug surface”，流程编排留给 `0214`。

- Risk:
  - local demo 与 server-backed path 再次分裂。
  - Mitigation:
    - 共用 `editor_page_state_derivers.js` / contract tests；local path 只允许复用同一 surface contract，不允许另做一套业务逻辑。

## 9. Alternatives

### A. 推荐：正规化现有 `Bus Trace` / `Model 100` 事实，收敛为新合同下的 Matrix debug surface

- 优点：
  - 复用已有 trace/runtime glue 与现有双总线样例，投入最小且最贴近仓库事实。
  - 直接给 `0214` 提供统一 debug 锚点。
- 缺点：
  - 需要先处理 `-100` / `ui_ast_v0` / workspace mount 这些历史债务。

### B. 另起一个全新的正数业务模型页面做“debug demo”

- 优点：
  - 初看上去实现更独立。
- 缺点：
  - 会绕开当前已经存在的 Bus Trace / Model 100 事实，造成重复建设与两套调试口径。

### C. 保留 server 内嵌 Bus Trace AST，只做样式或按钮增强

- 优点：
  - 改动看似最少。
- 缺点：
  - 与 `0210/0211` 新合同冲突，继续保留 `ui_ast_v0` / hardcoded surface，交付价值为零。

当前推荐：A。

## 10. Inputs

- Created at: `2026-03-22`
- Iteration ID: `0213-matrix-debug-ui-surface`
- Planning mode: `refine`
- Upstream anchor:
  - `0212-home-crud-proper-tier2` 已把 UI 主线推进到 proper Tier 2 样板
- Downstream anchor:
  - `0214-sliding-flow-ui` 将直接复用本 iteration 产出的 debug / ops surface
