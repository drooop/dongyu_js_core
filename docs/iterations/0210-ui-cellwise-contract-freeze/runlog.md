---
title: "0210 — ui-cellwise-contract-freeze Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-03-22
source: ai
iteration_id: 0210-ui-cellwise-contract-freeze
id: 0210-ui-cellwise-contract-freeze
phase: phase3
---

# 0210 — ui-cellwise-contract-freeze Runlog

## Environment

- Date: 2026-03-22
- Branch: `dropx/dev_0210-ui-cellwise-contract-freeze`
- Runtime: local repo

## Execution Records

### Step 1

- Command:
  - `rg -n "\"k\": \"ui_ast_v0\"|ui_ast_model|schema_model|legacy_fallback|model\\.submt|submt|submodel_create" packages/ui-model-demo-frontend/src packages/ui-model-demo-server/server.mjs packages/ui-model-demo-server/filltable_policy.mjs packages/worker-base/system-models scripts/tests packages/ui-model-demo-frontend/scripts`
  - 审阅：
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
    - `packages/worker-base/system-models/home_catalog_ui.json`
    - `packages/worker-base/system-models/docs_catalog_ui.json`
    - `packages/worker-base/system-models/static_catalog_ui.json`
    - `packages/worker-base/system-models/workspace_catalog_ui.json`
    - `packages/worker-base/system-models/prompt_catalog_ui.json`
    - `packages/worker-base/system-models/editor_test_catalog_ui.json`
    - `packages/worker-base/system-models/gallery_catalog_ui.json`
    - `scripts/tests/test_0191a_page_asset_resolver.mjs`
    - `scripts/tests/test_0191b_gallery_asset_resolution.mjs`
    - `scripts/tests/test_0201_route_local_ast_contract.mjs`
  - 基线验证：
    - `node scripts/tests/test_0191a_page_asset_resolver.mjs`
    - `node scripts/tests/test_0191b_gallery_asset_resolution.mjs`
    - `node scripts/tests/test_0201_route_local_ast_contract.mjs`
- Key output:
  - page catalog 事实：
    - `nav_catalog_ui.json` 已提供显式 `ui_page_catalog_json`，每个页面都带 `asset_type` / `model_id` / `legacy_fallback: false`，因此“页面目录”本身是显式、可追踪入口。
  - 页面级大 JSON bootstrap inventory：
    - `home/docs/static/workspace/prompt/editor_test/gallery` 系统模型仍在 `(0,0,0)` 写入整页 `ui_ast_v0` JSON；这些模型资产当前可运行，但属于 0211 迁移面，不得在 0210 内被重新升格为正式合同。
  - `ui_ast_v0` 直接读取 / fallback inventory：
    - `page_asset_resolver.js` 仍允许 `asset_type: "ui_ast_model"` 直接读取目标模型根格 `ui_ast_v0`。
    - `demo_modeltable.js`、`remote_store.js`、`gallery_store.js`、`editor_page_state_derivers.js` 仍直接从 page model / selected model / mailbox root 读取 `ui_ast_v0`。
  - 未明示 mount / hierarchy 假设 inventory：
    - `workspace_catalog_ui.json` 通过 `Include -> ws_selected_ast` 挂载“选中应用”的 UI；`server.mjs` 与 `editor_page_state_derivers.js` 会先派生 `ws_selected_title/ws_selected_ast`，再由 workspace 页面消费，当前并未落在 `parent` / `matrix` 显式挂载合同上。
  - 旧 alias / direct mutation inventory：
    - `filltable_policy.mjs`、`server.mjs`、多个历史测试仍使用 `submt` 与 `submodel_create` 术语；`local_bus_adapter.js` 虽然拒绝 direct model mutation，但该 rejected surface 仍存在，必须在 0210 中归类为 legacy-debt / forbidden，而不是 approved path。
  - projection 重新变成输入面的现状：
    - `local_bus_adapter.updateUiDerived()` 会把派生 `ui_ast_v0` 回写到 mailbox model `-1` 根格；`server.mjs` 的 `updateDerived()` 也会把过滤后快照投影的 page AST 写回 `-1:(0,0,0)`，说明共享 root AST 仍是当前消费面的一部分。
  - 基线验证结果：
    - `test_0191a_page_asset_resolver`: `4 passed, 0 failed`
    - `test_0191b_gallery_asset_resolution`: `3 passed, 0 failed`
    - `test_0201_route_local_ast_contract`: `4 passed, 0 failed`
  - Step 1 结论：
    - 0211 的明确迁移对象已固定为：
      - 页面级 `ui_ast_v0` 系统模型资产
      - resolver/store 对 `ui_ast_model` 与 mailbox root AST 的直接消费
      - workspace 的 `ws_selected_ast` 派生挂载路径
      - `submt` / `submodel_create` 历史术语与 rejected mutation 入口
- Result: PASS
- Commit: `N/A`

### Step 2

- Command:
  - `apply_patch` 新增：
    - `scripts/tests/test_0210_ui_cellwise_contract_inventory.mjs`
    - `scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
  - `node scripts/tests/test_0210_ui_cellwise_contract_inventory.mjs`
  - `node scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
  - `node scripts/tests/test_0191a_page_asset_resolver.mjs`
  - `node scripts/tests/test_0191b_gallery_asset_resolution.mjs`
  - `node scripts/tests/test_0201_route_local_ast_contract.mjs`
- Key output:
  - 已新增 0210 专属测试面：
    - inventory test 锁定当前显式 page catalog、root `ui_ast_v0` 页面资产、legacy consumer 与 rejected mutation surface
    - freeze test 锁定 0210 需要补齐的合同章节与 living-docs 落点
  - 首次 RED 结果：
    - `test_0210_ui_cellwise_contract_inventory`: `4 passed, 0 failed`
    - `test_0210_ui_cellwise_contract_freeze`: `0 passed, 5 failed`
    - failure 原因全部指向缺失的 freeze 章节：
      - `plan_missing_contract_classification_matrix`
      - `resolution_missing_freeze_deliverables`
      - `runtime_semantics_missing_ui_projection_contract`
      - `label_registry_missing_ui_bootstrap_boundary`
      - `user_guide_missing_ui_cellwise_contract_section`
  - 现有基线验证保持通过：
    - `test_0191a_page_asset_resolver`: `4 passed, 0 failed`
    - `test_0191b_gallery_asset_resolution`: `3 passed, 0 failed`
    - `test_0201_route_local_ast_contract`: `4 passed, 0 failed`
- Result: PASS
- Commit: `N/A`

### Step 3

- Command:
  - `apply_patch` 更新：
    - `docs/iterations/0210-ui-cellwise-contract-freeze/plan.md`
    - `docs/iterations/0210-ui-cellwise-contract-freeze/resolution.md`
    - `docs/ssot/runtime_semantics_modeltable_driven.md`
    - `docs/ssot/label_type_registry.md`
    - `docs/user-guide/modeltable_user_guide.md`
  - `node scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
  - `rg -n "ui_ast_v0|materialized Cell|model\\.submt|model\\.matrix|legacy-debt|forbidden" docs/iterations/0210-ui-cellwise-contract-freeze docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/label_type_registry.md docs/user-guide/modeltable_user_guide.md`
- Key output:
  - 已在 `plan.md` 补齐：
    - `Contract Classification Matrix`
    - `Parent / Matrix Mount Definitions`
    - `0211 Migration Inventory`
  - 已在 `resolution.md` 补齐：
    - `Freeze Deliverables`
  - 已在 living docs 补齐最小裁决句：
    - `runtime_semantics_modeltable_driven.md`：冻结 UI projection contract，明确 parent/matrix 均必须走显式 `model.submt`，并禁止把整页 `ui_ast_v0` 页面 JSON 当 authoritative bootstrap
    - `label_type_registry.md`：明确 `ui_ast_v0` / `ws_selected_ast` / shared mailbox root AST 不是新的 label.t 合同
    - `modeltable_user_guide.md`：新增 allowed / forbidden / legacy-debt 表和 parent/matrix 使用口径
  - GREEN 结果：
    - `test_0210_ui_cellwise_contract_freeze`: `5 passed, 0 failed`
  - `rg` 已命中：
    - `legacy-debt`
    - `model.submt`
    - `matrix 挂载`
    - `ui_ast_v0`
    - `ws_selected_ast`
- Result: PASS
- Commit: `N/A`

### Step 4

- Command:
  - `apply_patch` 更新：
    - `docs/iterations/0210-ui-cellwise-contract-freeze/runlog.md`
    - `docs/ITERATIONS.md`
  - `node scripts/tests/test_0210_ui_cellwise_contract_inventory.mjs`
  - `node scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
  - `rg -n "0210-ui-cellwise-contract-freeze|0211-ui-bootstrap-and-submodel-migration|0212-home-crud-proper-tier2|0215-ui-model-tier2-examples-v1" docs/ITERATIONS.md docs/iterations/0210-ui-cellwise-contract-freeze`
  - `git add scripts/tests/test_0210_ui_cellwise_contract_inventory.mjs scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
  - `git commit -m "test: add 0210 ui contract freeze checks"`
- Key output:
  - Step 4 final verification target：
    - `test_0210_ui_cellwise_contract_inventory` 必须保持 `4 passed, 0 failed`
    - `test_0210_ui_cellwise_contract_freeze` 必须保持 `5 passed, 0 failed`
    - `docs/ITERATIONS.md` 必须把 `0210-ui-cellwise-contract-freeze` 标记为 `Completed`
    - downstream 入口必须继续可见：
      - `0211-ui-bootstrap-and-submodel-migration`
      - `0212-home-crud-proper-tier2`
      - `0215-ui-model-tier2-examples-v1`
  - `docs/` 在当前主仓库中是指向外部 Obsidian vault 的 symlink；其下 `plan/resolution/runlog/ITERATIONS/SSOT/user-guide` 已完成文件系统更新，但不会出现在本仓库 `git status` 中。
  - 因此本仓库 commit 只包含 0210 新测试文件；文档事实以外部 vault 文件内容为准。
  - final git commit:
    - `20b9c59fda389e4f69c70cf25abbb03d459eba91`
- Result: PASS
- Commit: `20b9c59fda389e4f69c70cf25abbb03d459eba91`

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed + updated
- [x] `docs/ssot/label_type_registry.md` reviewed + updated
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed + updated

```
Review Gate Record
- Iteration ID: 0210-ui-cellwise-contract-freeze
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: # Review: 0210-ui-cellwise-contract-freeze
```

```
Review Gate Record
- Iteration ID: 0210-ui-cellwise-contract-freeze
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 2
- Decision: APPROVED
- Revision Type: minor
- Notes: plan/resolution 结构完整、scope 合理、合同目标与 CLAUDE.md MODEL_FORMS/ARCH_INVARIANTS 一致，verification 命令可执行，无阻塞问题。
```

```
Review Gate Record
- Iteration ID: 0210-ui-cellwise-contract-freeze
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 3
- Decision: APPROVED
- Revision Type: minor
- Notes: plan 和 resolution 结构完整、scope 合理、freeze-only 定位正确，合同三分法（allowed/forbidden/legacy-debt）与 CLAUDE.md 约束一致，每个 Step 有可执行验证命令和回滚方案，可进入 phase2 审批。
```

```
Review Gate Record
- Iteration ID: 0210-ui-cellwise-contract-freeze
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 1
- Decision: NEEDS_CHANGES
- Revision Type: major
- Notes: Review verdict 已输出。核心结论：**4 个 Step 中仅 Step 1 有部分执行记录，Step 2/3/4 完全未执行，iteration 核心交付物缺失。**
```

```
Review Gate Record
- Iteration ID: 0210-ui-cellwise-contract-freeze
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 2
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查已完成。Verdict JSON 已在上方输出，0210 iteration APPROVED，无阻塞问题。
```

```
Review Gate Record
- Iteration ID: 0210-ui-cellwise-contract-freeze
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 3
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查完成。0210 iteration APPROVED，无需进一步修改。
```

```
Review Gate Record
- Iteration ID: 0210-ui-cellwise-contract-freeze
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 4
- Decision: APPROVED
- Revision Type: N/A
- Notes: # 0210 Review — Completed
```
