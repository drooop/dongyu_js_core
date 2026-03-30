---
title: "0215 — ui-model-tier2-examples-v1 Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-23
source: ai
iteration_id: 0215-ui-model-tier2-examples-v1
id: 0215-ui-model-tier2-examples-v1
phase: phase1
---

# 0215 — ui-model-tier2-examples-v1 Plan

## Metadata

- ID: `0215-ui-model-tier2-examples-v1`
- Date: `2026-03-23`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0215-ui-model-tier2-examples-v1`
- Planning mode: `refine`
- Depends on:
  - `0210-ui-cellwise-contract-freeze`
  - `0211-ui-bootstrap-and-submodel-migration`
  - `0212-home-crud-proper-tier2`
  - `0214-sliding-flow-ui`
- Downstream:
  - `0216-threejs-runtime-and-scene-crud`
  - `0217-gallery-extension-matrix-three`

## Goal

- 产出一组可执行、可审计、可复用的 UI Model Tier 2 canonical examples，明确以下三件事的推荐搭建方式：
  - parent model / child model 的显式挂载与 ownership
  - UI read/write data path 的 authoritative 链路
  - 已有 UI components 在 `schema` / `page_asset_v0` 两类输入面中的正确使用方式
- 让后续 `0216` / `0217` 直接复用这组 examples 的模型组织与验证口径，而不是各自重新发明 mount、page asset、dispatch 或 component 组合。

## Background

- `0210-ui-cellwise-contract-freeze` 已冻结 UI 主合同：
  - UI authoritative input 只能来自真实 materialized cell / label / mounted model
  - 不允许 shared AST / root `ui_ast_v0` / 大 JSON bootstrap 重新升格为真值
  - child model 必须通过 `model.submt` 显式挂载进入层级
- `0211-ui-bootstrap-and-submodel-migration` 已把主线 UI 收敛到：
  - `page_asset_v0` 或 schema projection
  - `Workspace` 通过 `model.submt` 挂载 selected app
  - `route_ui_projection.js` 与 `deriveWorkspaceSelected(...)` 优先读 selected model 的真实资产，而不是 shared AST
- `0212-home-crud-proper-tier2` 已证明一条正式 Tier 2 写路径：
  - UI 组件只发 action
  - authoritative mutation 必须通过 `intent_dispatch_table` + handler patch 或既有正式链路完成
  - local path 不能偷偷复制第二份业务逻辑来伪装 remote capability
- `0214-sliding-flow-ui` 已证明 `Workspace` 可以在不改变 truth source 的前提下，对 selected app 做 route-level 组合与投影增强。
- 当前仓库里虽然已经存在多组“看起来像样例”的资产，但它们没有被整理成 canonical contract：
  - `workspace_positive_models.json` 已承载 `Model 1`、`Model 2`、`Model 100`、`Model 1001`、`Model 1002` 和 `ws_apps_registry`
  - `gallery_catalog_ui.json` 有 component / include / fragment materialization demo，但它仍是 Gallery 能力面，不是 Tier 2 business example contract
  - `docs/user-guide/ui_components_v2.md` 说明了单个组件怎么用，但没有回答“这些组件应该挂在哪个模型、由谁持有数据、跨模型写入如何走正式链路”
- 代码库还存在一个必须显式识别的事实：
  - `packages/worker-base/system-models/workspace_demo_apps.json` 仍保留历史样例内容
  - 但当前 `demo_modeltable.js` 与 `server.mjs` 的 authoritative positive seed 使用的是 `workspace_positive_models.json`
  - 对 `workspace_demo_apps.json` 的 `rg` 检索只命中该文件自身，说明它现在不是实际加载入口

## Problem Statement

- 当前缺的不是“再多一个 demo 页面”，而是一套可以回答下面问题的正式 examples contract：
  - 什么时候应该用同模型 schema projection，什么时候必须升级为 `page_asset_v0`
  - parent model 如何显式挂载 child model，并让 projection 读取真实 mounted model，而不是复制一个共享 AST
  - 哪些 UI-only 选择态可以放在 `Model -2`，哪些业务真值必须留在正数模型，哪些跨模型 mutation 必须走 `Model -10` dispatch/handler
  - 已有 `StatCard`、`StatusBadge`、`Terminal`、`Icon`、`Tabs`、`Include` 等组件如何在真实 Tier 2 场景中使用，而不是只在 Gallery 里作为孤立展示
- 如果 0215 继续沿用“零散 demo + 人工口头约定”，后续 `0216` / `0217` 很容易重新出现这些问题：
  - 新示例资产落到错误的 seed 文件或错误的 model placement
  - parent / child 关系被 page wrapper 或 shared state 伪装，而不是显式 `model.submt`
  - data path 在 local/remote 间分叉，形成第二份业务逻辑
  - component 用法停留在 props 展示，缺少真实 ownership / routing 示例

## Assumptions

- 假设 A:
  - 0215 的 examples 首次曝光面仍然是 `Workspace`，不是 `Gallery`
  - 验证方法：
    - `0217` 已被定义为 Gallery 集成 iteration
    - 当前 `Workspace` 已具备 selected-app route、mount registry 与 local/server validator
- 假设 B:
  - authoritative positive seed 文件继续使用 `packages/worker-base/system-models/workspace_positive_models.json`
  - 验证方法：
    - `rg -n "workspace_positive_models\\.json" packages/ui-model-demo-frontend/src/demo_modeltable.js packages/ui-model-demo-server/server.mjs`
    - `rg -n "workspace_demo_apps" packages/ui-model-demo-frontend/src packages/ui-model-demo-server/server.mjs`
- 假设 C:
  - 0215 不新增 renderer primitive；examples 只能使用当前仓库已支持、且已在 `docs/user-guide/ui_components_v2.md` 或现有系统资产中出现过的组件组合
  - 验证方法：
    - 复跑 `npm -C packages/ui-model-demo-frontend run test`
    - 对 examples 使用 AST/schema validator，而不是新增 runtime/renderer 语义

## Scope

### In Scope

- 定义并落地一组最小但完整的 canonical examples suite，至少覆盖三类模式：
  - `schema-only leaf example`
    - 同模型 cellwise/schema projection
    - 用来说明“简单表单或状态面”如何保持最小搭建
  - `page_asset composition example`
    - 以 `page_asset_v0` 组合多个现有组件
    - 用来说明什么时候应该从 schema 升级到显式 AST asset
  - `parent-mounted data-path example`
    - parent model 显式挂载 child model
    - 用来说明 parent/child ownership、跨模型读写边界与正式 mutation 链路
- 让 examples 在 `Workspace` 侧可被发现、可被挂载、可被 local/server 两条链路解析。
- 为 examples 定义明确的 model placement、ID block、registry 入口和验证口径。
- 如果 examples 需要新的 Tier 2 handler patch，则允许新增：
  - `intent_dispatch_table` entry
  - 新的 `intent_handlers_*.json`
  - 与之对应的 local explicit-unsupported 或 shared-dispatch boundary
- 增加 deterministic contract tests 与 local/server validators。
- 如 component 用法的对外口径确实发生变化，可更新 `docs/user-guide/ui_components_v2.md`。

### Out of Scope

- 不新增 `packages/worker-base/src/runtime.js` / `runtime.mjs` 解释器语义。
- 不新增 `packages/ui-renderer/src/renderer.js` / `renderer.mjs` primitive 或协议字段。
- 不把 0215 直接扩成 Gallery 集成、Three.js runtime、scene CRUD 或展示编排。
- 不恢复 `submodel_create`、direct model mutation、shared AST truth source。
- 不把 `workspace_demo_apps.json` 重新升格为 authoritative seed 文件，除非另开独立 cleanup / migration iteration。

## Example Suite Contract

### Example A — Schema-Only Leaf Example

- 目标：
  - 说明最小叶子 UI 模型在当前合同下如何组织
- 推荐形态：
  - 正数 model
  - 根格显式 `model.table`
  - 业务真值在 `p=0`
  - `p=1` schema projection 负责最小 UI
- 必须回答的问题：
  - 哪些组件可以只靠 schema / `__bind` 即可完成
  - 哪些 UI-only 状态允许留在 `Model -2`

### Example B — Page Asset Composition Example

- 目标：
  - 说明在需要更复杂布局、组合组件、摘要卡片或 include 片段时，如何使用 `page_asset_v0`
- 推荐形态：
  - 正数 model 本身持有 `page_asset_v0`
  - page asset 读取真实业务标签，不复制 shared AST
  - 只使用当前已支持组件，例如：
    - `Card`
    - `Container`
    - `Text`
    - `Button`
    - `Tabs`
    - `StatusBadge`
    - `StatCard`
    - `Terminal`
    - `Include`
- 必须回答的问题：
  - 什么情况下应从 schema 升级到 `page_asset_v0`
  - 组件组合时数据依然归谁所有

### Example C — Parent-Mounted Data-Path Example

- 目标：
  - 说明 parent model / child model 在新合同下的正式组织方式
- 推荐形态：
  - parent model 通过 `model.submt` 显式挂载 child model
  - parent 页面只读取真实 mounted child labels / assets
  - 若存在跨模型 mutation，必须走正式 data path，而不是 direct mutation
- 必须回答的问题：
  - parent 负责什么，child 负责什么
  - 哪些 action 只是 UI projection，哪些 action 必须进入 `Model -10` handler
  - local path 是否支持 shared dispatch，若不支持，怎样显式返回 `unsupported` 而不是复制一套业务逻辑

## Conformance Targets

### Data Ownership

- 正数 example models 拥有业务真值和页面资产。
- `Model -25` 只负责 `Workspace` page asset 与 mount inventory，不持有业务真值。
- `Model -2` 只允许持有 UI projection / selection / tab / validator 辅助状态，不持有 examples 的业务真值。
- `Model -10` 只允许持有 handler / dispatch 逻辑；它不应变成 examples 的业务数据仓库。
- `workspace_demo_apps.json` 若继续存在，只能视为历史残留，不得作为 0215 新增 examples 的 authoritative source。

### Allowed Data Flow

- Allowed:
  - `Workspace` 通过 mounted model 选择 examples
  - selected model 通过 `page_asset_v0` 或 schema projection 渲染自身 UI
  - UI-only selection/tab/focus 写入 `Model -2`
  - 跨模型或有副作用的业务写入通过 `ui_event -> intent_dispatch_table -> handler patch -> authoritative model`
- Forbidden:
  - `Workspace` 或 parent model 直接复制 child AST 当成真值
  - UI 组件直写非 `Model -2` 的任意业务标签来绕过正式 action contract
  - 为了 local 演示复制第二份 business logic
  - 把 examples 塞回 root `ui_ast_v0`、`ws_selected_ast`、或 `workspace_demo_apps.json`

### Placement Rules

- 0215 examples 属于 Tier 2：
  - 业务模型默认进入正数 `model_id`
  - 若需要系统 helper，仅限负数系统模型的 handler/function labels
- 新 example model ids 应使用当前 `Workspace` 已有固定示例之后的连续正数区间，避免与 `1`、`2`、`100`、`1001`、`1002` 冲突。
- parent/child 示例必须通过显式 `model.submt` 挂载进入 `Workspace` 层级；不能依赖 runtime startup `createModel(...)` 形成隐式 mount。

### Renderer / Runtime Boundary

- 0215 不允许以“examples 不够好看/不够方便”为由修改 runtime/renderer。
- 如果某个 example 只有通过新增 primitive、扩 schema 协议或改解释器语义才能成立，该 example 不属于 0215，应拆到新 iteration。

## Impact Surface

### Authoritative Example Assets

- `packages/worker-base/system-models/workspace_positive_models.json`
  - 当前 authoritative positive seed
  - 0215 应优先在这里定义 canonical examples
- `packages/worker-base/system-models/workspace_catalog_ui.json`
  - 当前 authoritative `Workspace` page asset 与 mount inventory
  - 0215 需要在这里显式挂载新的 example models

### Workspace Projection And Bootstrap

- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - local mode seed/bootstrap
- `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - selected model / mounted registry / example metadata 派生
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
  - `Workspace` route 对 selected app 的最终投影
- `packages/ui-model-demo-frontend/src/model_ids.js`
  - 若 examples 需要固定 model-id 常量，应集中登记，避免魔法数字散落

### Dispatch / Handler Boundary

- `packages/worker-base/system-models/intent_dispatch_config.json`
  - 若 examples 引入正式 action contract，需要在这里登记 action -> handler 映射
- 新增 `packages/worker-base/system-models/intent_handlers_ui_examples.json`
  - 作为 0215 的推荐 handler patch 落点
- `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - 若 local path 需要显式 unsupported 或 shared-dispatch stub，需要在此明示

### Validation

- Existing anchors to preserve:
  - `scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `scripts/tests/test_0212_home_crud_contract.mjs`
  - `scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
- New validation targets:
  - `scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`

### Explicit Non-Authoritative / Legacy Surface

- `packages/worker-base/system-models/workspace_demo_apps.json`
  - 当前仅命中自身，不是实际 seed 入口
  - 0215 不应继续把新 examples 写到这里

## Success Criteria

- 文档与实现共同给出一组最小 canonical examples，使无上下文读者能明确区分：
  - schema-only leaf
  - `page_asset_v0` composition
  - parent-mounted data path
- 所有 examples 都满足 `0210/0211` 的 explicit mount + authoritative asset 规则。
- 至少一条 example 写路径通过正式 Tier 2 contract 完成，不依赖 generic direct mutation。
- local 与 server path 的边界明确：
  - 能共享的共享
  - 不能共享的显式 `unsupported`
  - 不复制第二份 business logic
- downstream `0216` / `0217` 可以直接把 0215 当作 model organization 参考面，而不是再审计一轮 mount / component / data path 规则。

## Risks & Mitigations

- Risk:
  - 把 examples 做成“另一个 Gallery”，只有视觉展示，没有 authoritative data path。
  - Mitigation:
    - success criteria 必须包含 parent mount 与正式 write path，不接受纯组件拼图。

- Risk:
  - 继续向 `workspace_demo_apps.json` 填内容，形成双 seed。
  - Mitigation:
    - 在 contract test 中显式断言 authoritative seed 为 `workspace_positive_models.json`。

- Risk:
  - 为了 local 演示复刻 remote handler 逻辑。
  - Mitigation:
    - 复用 `0212` 的口径：shared dispatch 或 explicit unsupported；不接受 silent fallback。

- Risk:
  - examples 需求膨胀，变成新的 UI framework / renderer 扩展。
  - Mitigation:
    - 只使用当前已支持组件和协议；超出部分立即拆分。

## Alternatives

### A. 推荐：以 `Workspace` 为首个 authoritative example surface，examples 放在 `workspace_positive_models.json`

- 优点：
  - 复用现有 route / mount / validator 主线
  - 与 `0216` / `0217` 的依赖链最直接
  - 不需要重新定义新的 seed / route / loader
- 缺点：
  - 需要在同一套 workspace registry 中维护 example inventory

### B. 直接把 0215 做成 Gallery 扩展

- 优点：
  - 组件展示更直观
- 缺点：
  - 容易把 business example 与展示层混在一起
  - 与 `0217` 范围重叠

### C. 只写组件文档，不落地 executable examples

- 优点：
  - Phase 1 容易写
- 缺点：
  - 无法回答 parent/data path 问题
  - 下游实现仍会回到口头约定

当前推荐：A。

## Inputs

- Created at: `2026-03-23`
- Iteration ID: `0215-ui-model-tier2-examples-v1`
- Planning mode: `refine`
- Key repo facts used for this plan:
  - `Workspace` 的 authoritative mount/selection 已在 `0211` / `0214` 成形
  - `workspace_positive_models.json` 当前是实际 positive seed
  - `workspace_demo_apps.json` 当前未被运行链路消费
  - `ui_components_v2.md` 只有组件说明，还没有 canonical Tier 2 组织样例
