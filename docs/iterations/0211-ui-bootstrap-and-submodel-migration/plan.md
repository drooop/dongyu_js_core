---
title: "0211 — ui-bootstrap-and-submodel-migration Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0211-ui-bootstrap-and-submodel-migration
id: 0211-ui-bootstrap-and-submodel-migration
phase: phase1
---

# 0211 — ui-bootstrap-and-submodel-migration Plan

## 0. Metadata

- ID: `0211-ui-bootstrap-and-submodel-migration`
- Date: `2026-03-22`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0211-ui-bootstrap-and-submodel-migration`
- Planning mode: `refine`
- Depends on:
  - `0210-ui-cellwise-contract-freeze`
- Downstream:
  - `0212-home-crud-proper-tier2`
  - `0215-ui-model-tier2-examples-v1`

## 1. Goal

把当前仍依赖 root `ui_ast_v0`、`ws_selected_ast`、共享派生 AST、以及直接 `createModel`/隐式挂载的 UI bootstrap 与 submodel 路径，迁移到 0210 冻结的 cellwise + explicit mount 合同，使后续 UI iteration 只面向显式页面目录、materialized Cell label、以及通过 `model.submt` 进入层级的 child model 开发。

## 2. Background

`0210-ui-cellwise-contract-freeze` 已把 UI contract 冻结为以下规则：

- UI authoritative input 只能来自 materialized Cell label、显式页面目录、以及通过 `model.submt` 显式挂载进入层级的 child model。
- `parent` 与 `matrix` 两类挂载都要求显式 hosting cell；不得用共享 AST blob 或“大 JSON 根格初始化”代替挂载语义。
- `ui_ast_v0`、`ws_selected_ast`、共享 mailbox/root AST 只能视为 legacy-debt，不得继续充当新的 truth source。

当前代码库仍存在多处历史路径：

- 页面目录 `ui_page_catalog_json` 仍把多个页面注册为 `asset_type: "ui_ast_model"`，并指向在 `(0,0,0)` 保存整页 `ui_ast_v0` 的 system-model patch。
- `page_asset_resolver.js`、`demo_modeltable.js`、`gallery_store.js`、`remote_store.js`、`editor_page_state_derivers.js` 仍直接读取根格 `ui_ast_v0`。
- `local_bus_adapter.js` 仍把派生 `uiAst` 写回 mailbox model 的 `ui_ast_v0`，`server.mjs` 仍派生并写入 `ws_selected_ast`。
- `demo_modeltable.js`、`gallery_store.js`、`server.mjs` 仍存在直接 `createModel(...)` 的 UI bootstrap 入口，与 0210 要求的显式挂载语义不一致。
- `test_0210_ui_cellwise_contract_inventory.mjs` 当前仍以“legacy surface 仍存在”为 PASS 条件；如果不先改造测试口径，0211 执行后会被旧 inventory 断言卡住。

因此 0211 的职责不是新增功能，而是把“已经被 0210 判定为 legacy-debt / forbidden 的路径”真正迁走，消除后续 iteration 的兼容负担。

## 3. Problem Statement

当前 UI 页面虽然能渲染，但 truth source 与挂载语义仍混杂三类互相冲突的模式：

- 以整页 `ui_ast_v0` 根格 JSON 当 bootstrap
- 以共享派生 AST（如 `ws_selected_ast`、mailbox root `ui_ast_v0`）当页面输入面
- 以局部直接 `createModel(...)` 建立 UI/submodel，而不是经显式 `model.submt` 进入层级

这种状态的风险不是“代码不工作”，而是“工作但不合规”：

- page asset、workspace selected app、remote snapshot fallback 仍会继续放大 legacy AST 路径
- submodel/child model 的真实挂载边界继续模糊
- `0212`、`0215` 这类后续业务 iteration 会被迫同时兼容新合同与旧 bootstrap

## 4. Invariants (Must Not Change)

- 不改变 `CLAUDE.md` 已冻结的硬规则：plan-before-execute、Phase 1 文档-only、non-conformance fail fast、deterministic PASS/FAIL。
- 不改变 `0210` 的合同定义；0211 只能迁移实现，不得重写允许/禁止边界。
- 不新增 UI direct bus side effect，不新增 direct model mutation 通路，不把 `submodel_create` 重新升格成合法产品路径。
- 不修改 `packages/worker-base/src/runtime.js` / `packages/worker-base/src/runtime.mjs` 的运行时语义；若迁移暴露出需要改 runtime semantics，必须停下并另开 iteration。
- 不把 shared AST / fallback 伪装成“临时合规方案”；如果某条路径仍依赖 legacy AST 才能跑通，结论只能是未完成迁移。

## 5. Scope

### 5.1 In Scope

- 将当前页面 bootstrap 从 root `ui_ast_v0` / `asset_type: "ui_ast_model"` 的 authoritative 输入，迁到 0210 允许的 page asset / cellwise / mounted-model 输入面。
- 清理 workspace selected-app 路径中对 `ws_selected_ast` 和共享派生 AST 的依赖。
- 把本地 demo、gallery、server bootstrap 中仍直接 `createModel(...)` 的 UI/submodel 入口，迁到显式挂载语义或至少迁到不再依赖隐式 mount 的形态。
- 重构 `0210` 相关 inventory / contract tests，使其能在迁移后继续作为 guard，而不是永久要求 legacy surface 保留。
- 更新页面解析、workspace 投影、server 派生状态、以及对应 tests/validation scripts，使 `0212`/`0215` 可以在不兼容旧路径的前提下继续推进。

### 5.2 Out of Scope

- 不新增 Home CRUD、Prompt 新能力、Gallery 新页面、Three.js、Matrix debug surface。
- 不做 runtime 基座语义变更，不新增 label.t，不变更 `model.submt` / `model.matrix` 的规范文本。
- 不做 remote deploy、cluster 操作、或任何 `CLAUDE.md` 禁止的远端改动。
- 不把 login / Matrix / worker Tier 2 的更大范围 bootstrap 重构并入本 iteration，除非它们已经直接阻塞 0211 目标文件中的迁移链路。

## 6. Non-goals

- 不追求“一次性删光仓库里所有 AST JSON”。
- 不把 0211 变成新的 contract-freeze iteration。
- 不为了兼容旧测试而保留长期 fallback。
- 不把当前 blocked 的 `submodel_create` surface 改回可用。

## 7. Impact Surface

### 7.1 System-model Page Assets

- `packages/worker-base/system-models/nav_catalog_ui.json`
- `packages/worker-base/system-models/home_catalog_ui.json`
- `packages/worker-base/system-models/docs_catalog_ui.json`
- `packages/worker-base/system-models/static_catalog_ui.json`
- `packages/worker-base/system-models/workspace_catalog_ui.json`
- `packages/worker-base/system-models/prompt_catalog_ui.json`
- `packages/worker-base/system-models/editor_test_catalog_ui.json`
- `packages/worker-base/system-models/gallery_catalog_ui.json`
- 相关 workspace child-model assets（如 `workspace_demo_apps.json`、`workspace_positive_models.json`），若它们仍承载 implicit mount 假设

### 7.2 Frontend Bootstrap / Projection / Resolver

- `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- `packages/ui-model-demo-frontend/src/gallery_store.js`
- `packages/ui-model-demo-frontend/src/remote_store.js`
- `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
- `packages/ui-model-demo-frontend/src/local_bus_adapter.js`

### 7.3 Server-side Derived Projection / UI Bootstrap

- `packages/ui-model-demo-server/server.mjs`

### 7.4 Validation Surface

- `scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
- `scripts/tests/test_0210_ui_cellwise_contract_inventory.mjs`
- `scripts/tests/test_0191a_page_asset_resolver.mjs`
- `scripts/tests/test_0191b_gallery_asset_resolution.mjs`
- `scripts/tests/test_0191d_home_asset_resolution.mjs`
- `scripts/tests/test_0191d_docs_asset_resolution.mjs`
- `scripts/tests/test_0191d_static_asset_resolution.mjs`
- `scripts/tests/test_0201_route_local_ast_contract.mjs`
- `scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs`

## 8. Success Criteria (Definition of Done)

- 页面解析与 bootstrap 主路径不再把 root `ui_ast_v0` 当 authoritative input；legacy AST 只允许作为迁移期间的局部数据承载，不能再是 page truth source。
- workspace selected-app 渲染不再依赖 `ws_selected_ast` 或 mailbox/shared root AST 这类共享派生 truth source。
- 本 iteration 涉及的 child-model / submodel 入口满足 0210 的显式挂载边界；不会新增 direct mutation 或 implicit mount 补丁。
- `0210` inventory / contract tests 被重构成可持续 guard，迁移后仍能稳定给出 PASS/FAIL，而不是继续要求 legacy surface 永久存在。
- resolution 中的每个 Step 都有明确文件边界、可复制的验证命令、验收口径和回滚方案。
- `0212`、`0215` 无需再围绕 `ui_ast_model`、`ws_selected_ast`、或共享 AST fallback 设计新能力。

## 9. Risks & Mitigations

- Risk:
  - `0210` 的 inventory 测试仍编码“legacy surface 必须存在”，导致 0211 做完后回归测试反而失败。
  - Impact:
    - 迁移无法闭环，测试体系自相矛盾。
  - Mitigation:
    - 在 execution 的第一个 Step 先重构 inventory / migration guard，把历史快照测试与后续 contract guard 分开。

- Risk:
  - 页面资产、workspace 投影、server derived state 三个层面同时改动，容易出现局部迁移完成但全链路仍有 fallback。
  - Impact:
    - 本地 demo 通过，remote/SSE 或 workspace 仍偷偷走旧路径。
  - Mitigation:
    - 把验证分为 page asset regression、workspace/submodel regression、server/SSE smoke 三类，分别设独立命令。

- Risk:
  - 直接 `createModel(...)` 的 bootstrap 入口分散在 frontend/store/server，多处零散清理容易遗漏。
  - Impact:
    - child-model 仍可通过隐式方式进入层级，合同被局部绕过。
  - Mitigation:
    - 在 plan 和 resolution 中显式列出 bootstrap 命中文件，并把 `model.submt` / mounted-child 路径作为验收项，而不是只看页面是否显示。

- Risk:
  - 迁移过程中为追求兼容性而保留长期 fallback。
  - Impact:
    - 0211 名义完成，但技术债没有真正下降。
  - Mitigation:
    - 把“不得新增 fallback / 不得保留 shared AST truth source”写成 acceptance criteria 与 rollback 边界。

## 10. Open Questions

None.

执行假设：

- Phase 3 将继续沿用 `docs/ITERATIONS.md` 当前登记的分支名；若执行前需要规范化分支名，必须先更新 ledger，再开始实现。
- 若迁移暴露出 `runtime semantics` 或 `label registry` 本身仍不够表达需求，则 0211 应停在实现前并要求新 iteration，而不是在本 iteration 内改写 SSOT。

## 11. Compliance Checklists

### 11.1 SSOT Alignment Checklist

- SSOT references:
  - `CLAUDE.md`
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/user-guide/modeltable_user_guide.md`
- Notes:
  - 必须遵守 `CLAUDE.md` 的 HARD_RULES / WORKFLOW：0211 当前只产出文档；后续 Phase 3 也必须用 deterministic PASS/FAIL 验证。
  - `docs/architecture_mantanet_and_workers.md` 与 `runtime_semantics_modeltable_driven.md` 都要求 UI 只是 projection，child model 通过 `model.submt` 显式进入层级。
  - `docs/ssot/runtime_semantics_modeltable_driven.md` `1.4` / `1.5` 明确：包括 bootstrap children 在内，非 0 模型都必须显式挂载；`ui_ast_v0` / `ws_selected_ast` 只能视为 legacy-debt。
  - `docs/ssot/label_type_registry.md` `2.1` 明确：新的 UI bootstrap boundary 不能建立在 shared AST 或新的隐式 label.t 上。
  - `docs/user-guide/modeltable_user_guide.md` `2.2` 已把 Allowed / Forbidden / Legacy-Debt 三分类写为用户可见口径；0211 只能让实现向该表对齐，不能反向修改它来迁就实现。

### 11.2 Charter Compliance Checklist

- Charter references:
  - `docs/charters/dongyu_app_next_runtime.md`
- Notes:
  - Charter `2` / `4` 要求 UI 不拥有执行权，只能读 ModelTable 并把交互归一化成写 Cell；0211 不能通过 shared AST 或 direct mutation 恢复 UI truth-source/authority。
  - Charter `5` 要求本地 UI 与 remote sliding UI 不得隐式混用；0211 必须同时覆盖 local store、remote store、server/SSE 三条路径。
  - Charter `8` 要求 iteration 在 Phase 1 明确 SSOT/Charter 对齐与 non-goals；本计划已把 runtime semantics 变更、remote ops、功能扩张排除在外。

> 禁止在本文件写 Step 编号、执行命令、commit 记录与验证输出。
