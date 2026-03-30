---
title: "0210 — ui-cellwise-contract-freeze Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-22
source: ai
iteration_id: 0210-ui-cellwise-contract-freeze
id: 0210-ui-cellwise-contract-freeze
phase: phase1
---

# 0210 — ui-cellwise-contract-freeze Plan

## Goal

- 冻结一套可执行、可审计的 UI contract，明确 UI 必须以 `cellwise label + materialized model` 为真值表达，禁止把整页 UI 作为单个大 JSON blob 初始化到根 Cell，再由前端或 server 把该 blob 当作 authoritative bootstrap。
- 明确 `parent` 与 `matrix` 两类合法挂载口径，使后续 `0211` 可以按统一合同迁移现有 bootstrap / submodel 路径，而不是继续在历史约定和临时 fallback 上叠补丁。

## Background

- `0201-route-sse-page-sync-fix` 已完成，route/SSE 噪声已收口；下一轮 UI 主线必须先冻结 contract，再做迁移和功能填充。
- 当前代码库仍混用多套 UI 输入面：
  - [remote_store.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/remote_store.js)、[demo_modeltable.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/demo_modeltable.js)、[gallery_store.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/gallery_store.js)、[editor_page_state_derivers.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/editor_page_state_derivers.js)、[page_asset_resolver.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/page_asset_resolver.js) 仍直接读取或 fallback 到 `ui_ast_v0`。
  - [local_bus_adapter.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/local_bus_adapter.js) 与 [server.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-server/server.mjs) 仍会把派生 AST 回写到 mailbox/root cell，形成“投影再次变成输入面”的历史债务。
  - [nav_catalog_ui.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/nav_catalog_ui.json) 仍以 `asset_type: "ui_ast_model"` 注册页面资产，而多个 `*_catalog_ui.json` 仍在 `(0,0,0)` 写入整页 `ui_ast_v0` JSON。
  - 现有测试如 [test_0191a_page_asset_resolver.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0191a_page_asset_resolver.mjs)、[test_0191b_gallery_asset_resolution.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0191b_gallery_asset_resolution.mjs)、[test_0201_route_local_ast_contract.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0201_route_local_ast_contract.mjs) 固化了这些历史路径。
- 仓库最高优先级规约已明确：
  - UI 只是 ModelTable projection，不是真值源。
  - 每个 materialized Cell 必须有唯一有效模型标签。
  - 除 Model 0 外，模型必须通过 `model.submt` 显式挂载进入层级。
  - 不得用 fallback 掩盖 non-conformant path。
- 因此 0210 的职责不是做迁移，而是先把“什么是允许合同、什么是历史债务、0211 要迁什么”一次写死。

## Problem Statement

- 目前 UI bootstrap 同时存在三类相互冲突的表达：
  - 页面级大 JSON AST 直灌根 Cell。
  - 基于 `ui_page_catalog_json` 的模型资产解析。
  - 基于 schema cell 的按格投影。
- 这些表达之间还夹杂 implicit fallback，使“当前能跑”并不等于“当前合规”。
- 如果不先冻结合同，`0211` 会在迁移时继续一边修、一边猜授权边界，结果是：
  - page asset 入口继续漂移
  - parent / matrix mount 口径继续模糊
  - 后续 `0212`、`0215`、`0217` 需要反复兼容旧路径

## Scope

- In scope:
  - 盘点并归类现有 UI bootstrap / projection / materialization 路径的事实影响面。
  - 明确 `allowed / forbidden / legacy-debt` 三类合同边界。
  - 冻结 `parent` 与 `matrix` 两类合法挂载的定义、输入前提和拒绝条件。
  - 冻结“大 JSON 初始化”的判定标准：
    - 整页 UI 以单个 `json` label 写入 `(0,0,0)` 并被当作 authoritative bootstrap 消费。
  - 为 `0211` 生成可执行迁移输入：
    - 受影响入口
    - 受影响系统模型资产
    - 受影响测试与验证脚本
- Out of scope:
  - 不在 0210 内批量迁移现有页面或 submodel 挂载。
  - 不新增 UI 功能，不做视觉改版。
  - 不改 deploy、remote ops、runtime 基座语义。
  - 不把历史 fallback 升格为正式合同。

## Contract Targets

- UI authoritative data 必须来自 ModelTable cell/label/mounted model 本身；UI AST 仅可作为 projection 或 legacy debt，不得再被定义为业务真值。
- 页面入口必须由显式页面目录和显式模型资产声明驱动；不得依赖“如果 resolver 没命中，就去共享 root 里找一个 `ui_ast_v0`”这类隐式回退。
- 合法挂载只保留两类：
  - `parent`：child model 通过父模型 hosting cell 上的 `model.submt` 显式进入父层级。
  - `matrix`：child model 在 `model.matrix` 作用域内以显式挂载和明确相对/绝对映射进入矩阵层级。
- 不合法模式至少包括：
  - 整页 `ui_ast_v0` 作为默认 bootstrap。
  - 未经 `model.submt` / effective model label 约束的隐式挂载。
  - 通过 direct mutation、共享 mailbox AST、或 undocumented fallback 让 UI“看起来可用”。
- 0210 的合同产物必须能直接服务：
  - `0211-ui-bootstrap-and-submodel-migration`
  - `0212-home-crud-proper-tier2`
  - `0215-ui-model-tier2-examples-v1`

## Contract Classification Matrix

| Classification | Contract | Required shape | Current examples | Downstream action |
|---|---|---|---|---|
| Allowed | UI authoritative input 只能来自 materialized Cell label、显式页面目录、以及已挂载 child model 的真实 Cell/label | 页面目录必须显式；child model 必须通过 `model.submt` 进入层级；UI projection 只能读取真实 Cell/label 或 mounted child model | `ui_page_catalog_json` 页面目录；schema-driven projection；显式 `model.submt` hosting cell | 保持；作为 `0211/0212/0215` 的正式输入面 |
| Forbidden | 任何把 projection 重新升格为真值的路径；任何绕过 `model.submt` / effective model label 的隐式挂载 | 不允许整页 blob 作为 authoritative bootstrap；不允许 direct mutation / shared AST truth-source；不允许 undocumented fallback | 把整页 `ui_ast_v0` 根格 JSON 当作正式 bootstrap；把 mailbox/shared root AST 当真值；跳过 `model.submt` 的隐式 mount | 在 0210 明确拒绝；若仍存在实现，必须视为 non-conformant |
| Legacy-Debt | 当前仓库仍存在、但只允许作为迁移对象记录的旧路径 | 可以被 inventory / tests / docs 提及，但不得被写成新合同 | `asset_type: "ui_ast_model"` 页面资产；`ws_selected_ast`；`-1:(0,0,0)` 派生 `ui_ast_v0`；store/resolver 对 root AST 的直接消费 | 在 `0211` 中迁移或删除，不得新增同类入口 |

## Parent / Matrix Mount Definitions

- `parent` 合法挂载：
  - child model 只能通过父模型某个 hosting cell 上的 `model.submt` 进入层级。
  - child model 自身根格必须保留显式 form label（`model.single` / `model.table` / `model.matrix`）。
  - projection 读取的是 child model 的真实 Cell/label，不是父模型共享的 AST blob。
- `matrix` 合法挂载：
  - matrix 根必须先显式声明 `model.matrix`。
  - matrix 内的 child model 同样只能通过显式 `model.submt` hosting cell 进入矩阵层级。
  - 任何 matrix asset / resolver 都必须给出相对坐标到绝对坐标的映射前提；不允许靠“选中模型根格里正好有一个大 JSON”隐式推断。

## 0211 Migration Inventory

- 页面级大 JSON bootstrap：
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `packages/worker-base/system-models/docs_catalog_ui.json`
  - `packages/worker-base/system-models/static_catalog_ui.json`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/prompt_catalog_ui.json`
  - `packages/worker-base/system-models/editor_test_catalog_ui.json`
  - `packages/worker-base/system-models/gallery_catalog_ui.json`
- resolver/store 直接消费 legacy AST：
  - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-model-demo-frontend/src/gallery_store.js`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
- 共享派生 AST / workspace 特例：
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
- 历史术语与被拒绝的 mutation surface：
  - `submt` / `submodel_create`
  - `direct_model_mutation_disabled`

## Impact Surface

- Frontend projection / fallback:
  - [remote_store.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/remote_store.js)
  - [demo_modeltable.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/demo_modeltable.js)
  - [gallery_store.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/gallery_store.js)
  - [page_asset_resolver.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/page_asset_resolver.js)
  - [route_ui_projection.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/route_ui_projection.js)
  - [editor_page_state_derivers.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/editor_page_state_derivers.js)
- Server / derived snapshot surface:
  - [server.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-server/server.mjs)
  - [filltable_policy.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-server/filltable_policy.mjs)
- System-model UI assets:
  - [nav_catalog_ui.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/nav_catalog_ui.json)
  - [home_catalog_ui.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/home_catalog_ui.json)
  - [prompt_catalog_ui.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/prompt_catalog_ui.json)
  - [docs_catalog_ui.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/docs_catalog_ui.json)
  - [static_catalog_ui.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/static_catalog_ui.json)
  - [workspace_catalog_ui.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/workspace_catalog_ui.json)
  - [editor_test_catalog_ui.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/editor_test_catalog_ui.json)
  - [gallery_catalog_ui.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/gallery_catalog_ui.json)
- Existing validation surface:
  - [test_0191a_page_asset_resolver.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0191a_page_asset_resolver.mjs)
  - [test_0191b_gallery_asset_resolution.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0191b_gallery_asset_resolution.mjs)
  - [test_0191d_home_asset_resolution.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0191d_home_asset_resolution.mjs)
  - [test_0191d_docs_asset_resolution.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0191d_docs_asset_resolution.mjs)
  - [test_0191d_static_asset_resolution.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0191d_static_asset_resolution.mjs)
  - [test_0191d_test_workspace_asset_resolution.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0191d_test_workspace_asset_resolution.mjs)
  - [test_0201_route_local_ast_contract.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0201_route_local_ast_contract.mjs)
  - [validate_demo.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/scripts/validate_demo.mjs)
  - [validate_editor_server_sse.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs)

## Invariants / Constraints

- 严格遵守 `CLAUDE.md`：
  - Phase 1 只允许文档工作，不写实现代码。
  - 不得把 non-conformant path 通过 fallback 伪装成“可接受合同”。
  - 结论必须基于仓库事实，不靠口头猜测。
- 0210 是 freeze iteration，不是 migration iteration：
  - 本轮要回答“什么被允许”，而不是“怎么一次性迁完所有页面”。
- `0201` 的 route/SSE 正确性是前置锚点；0210 不得回退该约束。
- 若发现 `submt` 等旧别名仍出现在局部实现或测试中，必须把它归类为历史债务，而不是把旧别名重新提升为新合同。

## Success Criteria

- 文档中明确给出自包含的 `allowed / forbidden / legacy-debt` 合同表，读者无需额外上下文即可理解。
- 明确列出当前受影响的入口、页面资产、测试面和后续迁移对象。
- resolution 中为每个 Step 提供可复制执行的验证命令，且都是 deterministic PASS/FAIL 口径。
- 0211 可以直接以 0210 的 freeze 文本和 inventory 为输入开展迁移，不必重开一轮合同讨论。

## Risks & Mitigations

- Risk:
  - 把当前代码“还能跑”的历史行为误写成正式合同。
  - Mitigation:
    - 明确区分 `allowed`、`forbidden`、`legacy-debt`，不以现状即规范。
- Risk:
  - 0210 scope 膨胀，提前混入 0211 迁移实现。
  - Mitigation:
    - 只冻结边界和验证口径，不做页面迁移。
- Risk:
  - UI contract 与现有 SSOT/用户指南口径不一致。
  - Mitigation:
    - 把 living docs review 纳入 resolution 的显式步骤与命令。

## Alternatives

### A. 推荐：先冻结合同，再迁移现有 bootstrap / submodel 路径

- 优点：
  - 下游迭代边界稳定，测试和 docs 可以直接复用。
- 缺点：
  - 需要先完成一轮“只写合同、不做功能”的 planning / freeze。

### B. 一边迁移，一边在代码里临时推断合同

- 优点：
  - 表面推进更快。
- 缺点：
  - 容易把旧 fallback 和临时补丁固化成长期输入面，后续返工成本更高。

当前推荐：A。

## Inputs

- Created at: 2026-03-22
- Iteration ID: `0210-ui-cellwise-contract-freeze`
- Planning mode: `refine`
- Anchor:
  - `0201-route-sse-page-sync-fix` 已 Completed
- Downstream:
  - `0211-ui-bootstrap-and-submodel-migration`
  - `0212-home-crud-proper-tier2`
  - `0215-ui-model-tier2-examples-v1`
