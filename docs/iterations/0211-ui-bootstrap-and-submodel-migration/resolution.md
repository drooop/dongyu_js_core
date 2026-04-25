---
title: "0211 — ui-bootstrap-and-submodel-migration Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0211-ui-bootstrap-and-submodel-migration
id: 0211-ui-bootstrap-and-submodel-migration
phase: phase1
---

# 0211 — ui-bootstrap-and-submodel-migration Resolution

## 0. Execution Rules

- Work branch: `dropx/dev_0211-ui-bootstrap-and-submodel-migration`
- Working directory for all commands: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Required local tools on PATH: `node`, `npm`, `bun`, `rg`
- Steps must be executed in order.
- No step skipping; no bundling multiple conceptual migrations into one undocumented change.
- Every Step must end with executable validation and explicit PASS/FAIL evidence in `runlog.md`.
- Do not modify `packages/worker-base/src/runtime.js` or `packages/worker-base/src/runtime.mjs` inside this iteration. If migration appears to require runtime-semantics changes, stop and open a new iteration.
- Do not preserve new fallback paths based on root `ui_ast_v0`, `ws_selected_ast`, mailbox/shared AST, or implicit child-model mount behavior.
- Any real execution evidence belongs in `runlog.md`, not in this file.

## 1. Migration Objective

0211 的实现顺序固定为：

1. 先把 0210 的 freeze/inventory 测试重构成“可迁移、可持续”的 guard
2. 再迁移页面 bootstrap 与 page asset resolver
3. 然后迁移 workspace / shared AST / submodel mount 路径
4. 最后做全量回归、living-docs assessment、runlog/ledger 收口

这样可以避免“旧 inventory 测试要求 legacy surface 保留”与“0211 必须删除 legacy surface”之间的自相矛盾。

## 2. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Rebase Inventory Into Migration Guards | 把 0210 freeze 时点的 inventory 测试改造成 0211 可执行的 baseline/guard | `scripts/tests/test_0210_ui_cellwise_contract_inventory.mjs`, `scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`, `docs/iterations/0211-ui-bootstrap-and-submodel-migration/runlog.md` | `node scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`; `node scripts/tests/test_0210_ui_cellwise_contract_inventory.mjs`; `rg -n "ui_ast_v0|ws_selected_ast|runtime\\.createModel\\(|submodel_create" packages/ui-model-demo-frontend/src packages/ui-model-demo-server/server.mjs packages/worker-base/system-models` | legacy surface 全部被命名并绑定到测试/执行步骤；0210 inventory 不再永久要求 legacy surface 留存 | 回退测试与 runlog 变更 |
| 2 | Migrate Page Bootstrap Sources | 迁移非 workspace 页面从 root `ui_ast_v0`/`ui_ast_model` authoritative bootstrap 到显式 page asset / cellwise 输入面 | `packages/worker-base/system-models/nav_catalog_ui.json`, `packages/worker-base/system-models/home_catalog_ui.json`, `packages/worker-base/system-models/docs_catalog_ui.json`, `packages/worker-base/system-models/static_catalog_ui.json`, `packages/worker-base/system-models/prompt_catalog_ui.json`, `packages/worker-base/system-models/editor_test_catalog_ui.json`, `packages/worker-base/system-models/gallery_catalog_ui.json`, `packages/ui-model-demo-frontend/src/page_asset_resolver.js`, `packages/ui-model-demo-frontend/src/route_ui_projection.js`, `packages/ui-model-demo-frontend/src/demo_modeltable.js`, `packages/ui-model-demo-frontend/src/gallery_store.js`, `packages/ui-model-demo-frontend/src/remote_store.js`, related `scripts/tests/test_0191*.mjs` | `node scripts/tests/test_0191a_page_asset_resolver.mjs`; `node scripts/tests/test_0191b_gallery_asset_resolution.mjs`; `node scripts/tests/test_0191d_home_asset_resolution.mjs`; `node scripts/tests/test_0191d_docs_asset_resolution.mjs`; `node scripts/tests/test_0191d_static_asset_resolution.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`; `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs` | 非 workspace 页面不再依赖 root `ui_ast_v0` 作为 truth source；resolver/catalog/store 对同一 asset contract 达成一致；runtime 文件保持未改动 | 回退 page asset、resolver、store、tests 改动 |
| 3 | Migrate Workspace And Mount Semantics | 清理 `ws_selected_ast` / shared AST truth-source，并把 workspace child-model projection 与 bootstrap surface 对齐到显式挂载语义 | `packages/worker-base/system-models/workspace_catalog_ui.json`, `packages/worker-base/system-models/workspace_demo_apps.json`, `packages/worker-base/system-models/workspace_positive_models.json`, `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`, `packages/ui-model-demo-frontend/src/demo_modeltable.js`, `packages/ui-model-demo-frontend/src/gallery_store.js`, `packages/ui-model-demo-frontend/src/local_bus_adapter.js`, `packages/ui-model-demo-frontend/src/remote_store.js`, `packages/ui-model-demo-server/server.mjs`, `packages/ui-model-demo-frontend/scripts/validate_editor.mjs`, `packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs`, `scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`, `scripts/tests/test_0201_route_local_ast_contract.mjs`, `scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs` | `node scripts/tests/test_0201_route_local_ast_contract.mjs`; `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`; `node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs`; `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs` | workspace selected app 不再依赖 `ws_selected_ast`；local/remote/server 三条链路不再把 shared AST 当 truth source；不新增 direct mutation/implicit mount | 回退 workspace assets、frontend/server bootstrap、tests 改动 |
| 4 | Full Regression And Ledger Closeout | 做 targeted regression、living-docs assessment、runlog/ITERATIONS 收口 | `docs/iterations/0211-ui-bootstrap-and-submodel-migration/runlog.md`, `docs/ITERATIONS.md`, 如有必要再更新 `docs/user-guide/modeltable_user_guide.md`, `docs/ssot/runtime_semantics_modeltable_driven.md`, `docs/ssot/label_type_registry.md` | `node scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`; `node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`; `npm -C packages/ui-model-demo-frontend run test`; `npm -C packages/ui-model-demo-frontend run build`; `rg -n "0211-ui-bootstrap-and-submodel-migration" docs/ITERATIONS.md docs/iterations/0211-ui-bootstrap-and-submodel-migration/runlog.md` | 全部 targeted validations PASS；runlog 记录命令/输出/commit；ledger 状态与 branch facts 一致；docs assessment 有明确结论 | 回退 iteration 文档、ledger 记录，以及 0211 代码改动 |

## 3. Step Details

### Step 1 — Rebase Inventory Into Migration Guards

**Goal**

- 把 0210 freeze 阶段用来“证明 legacy surface 当前存在”的 inventory 口径，改造成 0211 执行仍可持续使用的 baseline + guard。
- 为每条迁移目标建立明确的测试锚点，防止后续实现完成后被旧断言误判失败。

**Scope**

- 审计并重构以下事实：
  - 哪些测试只是在 0210 记录 migration inventory
  - 哪些测试将继续作为 0211 之后的 contract guard
  - 哪些 legacy surface 必须在 runlog 中先记录 baseline，再在后续 Step 中删除
- 为 0211 新增或改造专用 contract test，覆盖至少三类结果：
  - 页面 bootstrap 不再依赖 root `ui_ast_v0`
  - workspace 不再依赖 `ws_selected_ast`
  - child-model / submodel projection 不再依赖 implicit mount 或 shared AST truth source

**Files**

- Create/Update:
  - `scripts/tests/test_0210_ui_cellwise_contract_inventory.mjs`
  - `scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
  - `docs/iterations/0211-ui-bootstrap-and-submodel-migration/runlog.md`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0210_ui_cellwise_contract_inventory.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "ui_ast_v0|ws_selected_ast|runtime\\.createModel\\(|submodel_create" packages/ui-model-demo-frontend/src packages/ui-model-demo-server/server.mjs packages/worker-base/system-models`
- Expected signals:
  - `0210` freeze 文档测试仍 PASS
  - inventory test 已能表达“迁移前基线 / 迁移后 guard”，而不是只要求 legacy surface 永远存在
  - runlog 中已有 baseline 命中列表，可映射到后续 Step

**Acceptance Criteria**

- 0211 的每个主要迁移目标都有明确测试锚点或 baseline 证据。
- `test_0210_ui_cellwise_contract_inventory.mjs` 不再阻止 0211 删除 legacy surface。
- 本 Step 结束时尚未引入行为迁移，仅完成 guard 重构与事实落盘。

**Rollback Strategy**

- 回退本 Step 改动的测试文件与 runlog 记录。
- 恢复到 0210 planning 完成时的 inventory 表达，但不保留半成品 guard。

---

### Step 2 — Migrate Page Bootstrap Sources

**Goal**

- 将 home/docs/static/prompt/test/gallery 等非 workspace 页面从 root `ui_ast_v0` / `asset_type: "ui_ast_model"` authoritative bootstrap 迁出，使页面解析只依赖显式 page asset 或 cellwise/schema-driven 输入。

**Scope**

- 调整页面目录与对应 system-model assets，使“页面入口声明”和“页面真实输入面”一致。
- 清理 local demo、gallery store、remote store、route projection 中对 root `ui_ast_v0` 的直接消费。
- 同步更新与 page asset resolution 相关的 legacy tests，使其验证新合同而不是旧 AST shape。

**Files**

- Create/Update:
  - `packages/worker-base/system-models/nav_catalog_ui.json`
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `packages/worker-base/system-models/docs_catalog_ui.json`
  - `packages/worker-base/system-models/static_catalog_ui.json`
  - `packages/worker-base/system-models/prompt_catalog_ui.json`
  - `packages/worker-base/system-models/editor_test_catalog_ui.json`
  - `packages/worker-base/system-models/gallery_catalog_ui.json`
  - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
  - `packages/ui-model-demo-frontend/src/route_ui_projection.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/gallery_store.js`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `scripts/tests/test_0191a_page_asset_resolver.mjs`
  - `scripts/tests/test_0191b_gallery_asset_resolution.mjs`
  - `scripts/tests/test_0191d_home_asset_resolution.mjs`
  - `scripts/tests/test_0191d_docs_asset_resolution.mjs`
  - `scripts/tests/test_0191d_static_asset_resolution.mjs`
  - `scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - remote deploy / k8s / ops scripts

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191a_page_asset_resolver.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191b_gallery_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_home_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_docs_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_static_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs`
- Expected signals:
  - 页面解析相关测试全部 PASS
  - demo smoke 仍 PASS
  - runtime 文件无改动

**Acceptance Criteria**

- 非 workspace 页面不再把 root `ui_ast_v0` 视为 authoritative bootstrap。
- 页面目录、asset resolver、store fallback 的输入口径一致，且与 0210 合同一致。
- legacy `ui_ast_model` 只保留在明确标注的迁移债务范围内，不再是主路径 truth source。

**Rollback Strategy**

- 回退 page asset JSON、resolver/store、以及对应 tests 的改动。
- 恢复到执行前的页面解析链路，但同时删除本 Step 引入的不完整中间态。

---

### Step 3 — Migrate Workspace And Mount Semantics

**Goal**

- 移除 workspace / server / local adapter 中以共享派生 AST 作为 truth source 的路径，并把 child-model / submodel 相关的 UI bootstrap 对齐到显式挂载语义。

**Scope**

- 迁移 `workspace_catalog_ui.json` 中对 `ws_selected_ast` 的依赖。
- 调整 `deriveWorkspaceSelected(...)`、local demo/bootstrap、remote snapshot fallback、server derived state 同步方式，使 selected app 渲染读取真实 mounted model / cellwise projection，而不是共享 AST blob。
- 收口仍直接 `createModel(...)` 的 UI/bootstrap 入口，使其不再承担 implicit mount 语义。
- 保持 `direct_model_mutation_disabled` 的禁止边界；不把 `submodel_create` 重新做成业务主路径。

**Files**

- Create/Update:
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/workspace_demo_apps.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/gallery_store.js`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs`
  - `scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
  - `scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs`
- Expected signals:
  - route/workspace tests PASS
  - editor local + server SSE smoke PASS
  - direct mutation disabled contract 继续 PASS
  - runtime 文件无改动

**Acceptance Criteria**

- `ws_selected_ast` 不再是 workspace 的 authoritative input。
- local store、remote store、server/SSE 三条链路都不再依赖 shared AST truth source。
- child-model / submodel 相关页面投影满足显式挂载口径，且没有通过 direct mutation 恢复旧路径。

**Rollback Strategy**

- 回退 workspace system-model assets、frontend/server 投影、以及相关 tests/script 改动。
- 恢复到执行前状态，删除所有只完成一半的 mounted-model / workspace 迁移中间态。

---

### Step 4 — Full Regression And Ledger Closeout

**Goal**

- 在 targeted migration 完成后做统一回归、living-docs assessment、以及 iteration 事实归档，确保 0211 的结果可直接作为后续 iteration 前提。

**Scope**

- 运行 0210/0211 contract tests、frontend build/test、关键 smoke 脚本。
- 评估本次迁移是否改变了用户可见 contract wording；只有真的变更 public contract 时才更新 living docs。
- 在 `runlog.md` 记录命令、关键输出、commit hash、PASS/FAIL；在 `docs/ITERATIONS.md` 更新 iteration 状态与 branch/commit 事实。

**Files**

- Create/Update:
  - `docs/iterations/0211-ui-bootstrap-and-submodel-migration/runlog.md`
  - `docs/ITERATIONS.md`
  - 如 public contract wording 发生变化，再更新：
    - `docs/user-guide/modeltable_user_guide.md`
    - `docs/ssot/runtime_semantics_modeltable_driven.md`
    - `docs/ssot/label_type_registry.md`
- Must NOT touch:
  - `docs/iterations/0211-ui-bootstrap-and-submodel-migration/plan.md`
  - `docs/iterations/0211-ui-bootstrap-and-submodel-migration/resolution.md`
    除非 review gate 明确要求改计划

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run test`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "0211-ui-bootstrap-and-submodel-migration" docs/ITERATIONS.md docs/iterations/0211-ui-bootstrap-and-submodel-migration/runlog.md`
- Expected signals:
  - 所有 targeted validations PASS
  - runlog 已记录真实命令、关键输出、commit/merge 事实
  - `docs/ITERATIONS.md` 与 runlog 一致

**Acceptance Criteria**

- 0211 的代码、测试、smoke、build 都给出 deterministic PASS。
- 0211 的文档评估结论明确：要么列出已更新的 living docs，要么明确写明“no docs change required”及理由。
- ledger、runlog、分支事实自洽，可直接作为 `0212`/`0215` 的前置依据。

**Rollback Strategy**

- 回退 0211 相关代码、tests、docs 改动。
- 恢复 `runlog.md` 与 `docs/ITERATIONS.md` 到执行前状态，并在新 runlog 记录回滚事实。

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
