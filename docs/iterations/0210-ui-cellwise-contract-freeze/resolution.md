---
title: "0210 — ui-cellwise-contract-freeze Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-22
source: ai
iteration_id: 0210-ui-cellwise-contract-freeze
id: 0210-ui-cellwise-contract-freeze
phase: phase1
---

# 0210 — ui-cellwise-contract-freeze Resolution

## Execution Strategy

- 先做 inventory，确认哪些入口仍把 `ui_ast_v0`、共享 root AST、隐式 mount 当成 authoritative bootstrap。
- 再用 deterministic tests 冻结 `allowed / forbidden / legacy-debt`，把 0210 的合同从“口头要求”变成“会失败的检查”。
- 最后把 freeze 结果和 living docs review 收口成 downstream 可直接消费的迁移输入，供 `0211` 执行。

## Freeze Deliverables

- Step 2 产物：
  - `scripts/tests/test_0210_ui_cellwise_contract_inventory.mjs`
  - `scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
- Step 3 产物：
  - `plan.md` 中的 contract matrix、parent/matrix 定义、0211 migration inventory
  - `runtime_semantics_modeltable_driven.md` 中的 UI projection contract freeze
  - `label_type_registry.md` 中的 UI bootstrap boundary
  - `modeltable_user_guide.md` 中的 allowed / forbidden / legacy-debt 表
- Step 4 产物：
  - runlog 的 Step 2/3/4 PASS 证据
  - `docs/ITERATIONS.md` 状态推进到 `Completed`
  - downstream handoff 明确指向 `0211-ui-bootstrap-and-submodel-migration`

## Step 1 — Inventory Current Contract Surface

- Scope:
  - 审计当前 UI asset 注册、前端 resolver、server 派生 AST、system-model 静态页面资产。
  - 产出 violation inventory，至少分出：
    - 页面级大 JSON bootstrap
    - `ui_ast_v0` 直接读取 / fallback
    - 未明示的 mount / hierarchy 假设
    - 仍依赖旧 alias 或 direct mutation 的入口
- Files:
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/gallery_store.js`
  - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
  - `packages/ui-model-demo-frontend/src/route_ui_projection.js`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-server/filltable_policy.mjs`
  - `packages/worker-base/system-models/nav_catalog_ui.json`
  - `packages/worker-base/system-models/*_catalog_ui.json`
  - 现有 0191 / 0201 UI contract tests
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "\"k\": \"ui_ast_v0\"|ui_ast_model|schema_model|legacy_fallback|model\\.submt|submt|submodel_create" packages/ui-model-demo-frontend/src packages/ui-model-demo-server/server.mjs packages/ui-model-demo-server/filltable_policy.mjs packages/worker-base/system-models scripts/tests packages/ui-model-demo-frontend/scripts`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191a_page_asset_resolver.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191b_gallery_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0201_route_local_ast_contract.mjs`
- Acceptance:
  - violation inventory 明确列出“当前事实”和“0210 目标合同”的差距。
  - 后续 Step 不再靠猜测决定哪些入口属于 0211 迁移对象。
- Rollback:
  - 本步只做审计与记录，无行为回滚需求。

## Step 2 — Add Freeze Tests And Conformance Guards

- Scope:
  - 新增 0210 专属 deterministic tests，把合同冻结为 PASS/FAIL 检查。
  - 测试至少覆盖：
    - 整页 `ui_ast_v0` bootstrap 归类为 forbidden/legacy-debt，而不是 approved input surface
    - `parent` / `matrix` 两类挂载的允许条件
    - resolver/store 不得再把共享 mailbox/root AST 视为正式合同
    - 现有页面目录与 mount 口径必须显式可追踪
- Files:
  - `scripts/tests/test_0210_ui_cellwise_contract_inventory.mjs`
  - `scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
  - 必要时补充或收紧：
    - `scripts/tests/test_0191a_page_asset_resolver.mjs`
    - `scripts/tests/test_0191b_gallery_asset_resolution.mjs`
    - `scripts/tests/test_0201_route_local_ast_contract.mjs`
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0210_ui_cellwise_contract_inventory.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191a_page_asset_resolver.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0201_route_local_ast_contract.mjs`
- Acceptance:
  - 0210 合同不再只存在于文字描述，而是有独立测试面约束。
  - `0211` 迁移后可以直接以这些测试作为 GREEN 目标。
- Rollback:
  - 回退本步新增或修改的测试文件。

## Step 3 — Freeze Documentation And Living-Docs Alignment

- Scope:
  - 将 0210 的 allowed / forbidden / legacy-debt 合同写入 iteration 文档，并完成必要的 living docs review。
  - 如果现有 SSOT / user guide 对 `materialized cell`、`model.submt`、`matrix` 挂载的表述不足以支撑 0210 合同，则补齐最小必要文字，不新增与 0211 迁移无关的范围。
- Files:
  - `docs/iterations/0210-ui-cellwise-contract-freeze/plan.md`
  - `docs/iterations/0210-ui-cellwise-contract-freeze/resolution.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/user-guide/modeltable_user_guide.md`
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "ui_ast_v0|materialized Cell|model\\.submt|model\\.matrix|legacy-debt|forbidden" docs/iterations/0210-ui-cellwise-contract-freeze docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/label_type_registry.md docs/user-guide/modeltable_user_guide.md`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
- Acceptance:
  - 无上下文读者只看文档即可理解：
    - 为什么旧 `ui_ast_v0` 页面资产不再是正式合同
    - 什么叫 `parent` 合法挂载
    - 什么叫 `matrix` 合法挂载
    - 0211 要迁哪些入口
- Rollback:
  - 回退本步 docs 变更；若已提升到 SSOT，同步回退对应文字并在 runlog 记录。

## Step 4 — Downstream Handoff And Iteration Evidence

- Scope:
  - 把 inventory、freeze tests、docs review 结果写入 runlog，形成 `0211` 的直接输入。
  - 更新 iteration 状态与 handoff 事实，确保后续执行者不需要重新整理影响面。
- Files:
  - `docs/iterations/0210-ui-cellwise-contract-freeze/runlog.md`
  - `docs/ITERATIONS.md`
  - 如需附证据，可写入 `docs/iterations/0210-ui-cellwise-contract-freeze/assets/`
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0210_ui_cellwise_contract_inventory.mjs && node scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "0210-ui-cellwise-contract-freeze|0211-ui-bootstrap-and-submodel-migration|0212-home-crud-proper-tier2|0215-ui-model-tier2-examples-v1" docs/ITERATIONS.md docs/iterations/0210-ui-cellwise-contract-freeze`
- Acceptance:
  - runlog 中存在可复现的 inventory、命令、PASS/FAIL 结果和 downstream migration list。
  - `0211` 可以直接引用 0210 证据链开工，而不必重新做合同分析。
- Rollback:
  - 回退本步 runlog / index / assets 记录；若状态已推进，同步恢复为上一状态并保留回退原因。

## Notes

- 0210 的目标是 freeze contract，不是提前完成 0211 迁移。
- 若 Step 2 或 Step 3 发现现有运行时语义本身无法表达 `parent` / `matrix` 合法挂载，必须停下并升级为新的设计决策，不得在 0210 内偷偷扩 scope 做 runtime 改造。
