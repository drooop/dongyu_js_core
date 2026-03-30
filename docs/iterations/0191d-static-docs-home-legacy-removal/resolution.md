---
title: "Iteration 0191d-static-docs-home-legacy-removal Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0191d-static-docs-home-legacy-removal
id: 0191d-static-docs-home-legacy-removal
phase: phase1
---

# Iteration 0191d-static-docs-home-legacy-removal Resolution

## Execution Strategy

- 先审计 `Static / Docs / Home` 的剩余依赖链，再按 `Static → Docs → Home` 顺序迁移。
- 所有页面迁完后，再单独删除 `buildEditorAstV0/V1`、`buildGalleryAst` 与 server 侧 legacy AST 生成。
- 将 `Model -21` 的显式 model form label 作为本轮顺带收口项。

## Step 1

- Scope:
  - 审计 `Static / Docs / Home` 当前依赖链
  - 冻结 3 个页面的资产形态与宿主边界
  - 明确 legacy 删除前的最后 fallback 边界
- Files:
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/*.json`
  - `docs/iterations/0191d-static-docs-home-legacy-removal/plan.md`
  - `docs/iterations/0191d-static-docs-home-legacy-removal/resolution.md`
- Verification:
  - `rg -n "root_static|root_docs|root_home|buildEditorAstV0|buildEditorAstV1|buildGalleryAst" packages/ui-model-demo-frontend/src/demo_modeltable.js packages/ui-model-demo-frontend/src/gallery_model.js packages/ui-model-demo-server/server.mjs`
  - `rg -n "docs_|static_|dt_filter_|selected_model_id|draft_|cellab_" packages/ui-model-demo-server/server.mjs packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Acceptance:
  - 已明确 `Static / Docs / Home` 的资产形态
  - 已明确各自与 hostApi / editor state 的边界
  - 已明确 legacy 删除的最后时点
- Rollback:
  - 回退本轮文档改动

### Step 1 Design Output

#### A. Static

- 迁为页面资产
- 保留 hostApi / static intent handlers 作为宿主能力
- 页面本体不再由 `buildEditorAstV1` 生成

#### B. Docs

- 迁为页面资产
- 保留 docs tree/search/open 的 hostApi / intent handler
- 页面本体不再由 `buildEditorAstV1` 生成

#### C. Home

- 迁为页面资产
- `selected_model_id`、`dt_filter_*`、`draft_*`、`dt_edit_*`、`cellab_*` 等 editor runtime state 继续保留在 server 初始化
- 只迁页面 AST 来源，不迁这些 runtime state seed

#### D. Legacy 边界

- `Static / Docs / Home` 迁完后，不再允许任何页面走 `buildEditorAstV1`
- `buildEditorAstV0/V1` 与 `buildGalleryAst` 在 Step 3 删除

## Step 2

- Scope:
  - 实施 `Static → Docs → Home` 迁移
  - 补 `Model -21` 显式 form label
- Files:
  - `packages/worker-base/system-models/static_catalog_ui.json`
  - `packages/worker-base/system-models/docs_catalog_ui.json`
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `packages/worker-base/system-models/prompt_catalog_ui.json`
  - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0191d_static_asset_resolution.mjs`
  - `scripts/tests/test_0191d_docs_asset_resolution.mjs`
  - `scripts/tests/test_0191d_home_asset_resolution.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_editor_server_static.mjs`
- Verification:
  - `node scripts/tests/test_0191d_static_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_docs_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_home_asset_resolution.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_editor_server_static.mjs`
- Acceptance:
  - `Static / Docs / Home` 均从模型资产提供内容
  - `Model -21` 已显式声明 model form label
- Rollback:
  - 删除本轮新增 patch 资产
  - 恢复 resolver / server / demo_modeltable 改动

## Step 3

- Scope:
  - 删除 legacy AST 生成链
- Files:
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/gallery_model.js`
  - `packages/ui-model-demo-server/server.mjs`
  - 必要时相关测试
- Verification:
  - `rg -n "buildEditorAstV0|buildEditorAstV1|buildGalleryAst" packages/ui-model-demo-frontend/src/demo_modeltable.js packages/ui-model-demo-frontend/src/gallery_model.js packages/ui-model-demo-server/server.mjs`
  - 预期：无运行时引用
- Acceptance:
  - `buildEditorAstV0/V1` 已删除
  - `buildGalleryAst` 已删除或完全脱离运行时链
  - server 不再生成整页 AST
- Rollback:
  - 恢复 legacy 代码

## Step 4

- Scope:
  - 收口验证与最终归档
- Files:
  - `docs/iterations/0191d-static-docs-home-legacy-removal/runlog.md`
  - `docs/ITERATIONS.md`
  - 必要时 `docs/plans/2026-03-19-ui-tier-migration-implementation.md`
- Verification:
  - 功能回归：
    - `validate_demo.mjs`
    - 必要的 server smoke
  - Conformance 回归：
    - legacy AST 生成链无残留
    - fallback 不再对已迁页面生效
- Acceptance:
  - `0191d` 完成后，UI 主线迁移收口
- Rollback:
  - 回退本轮文档与登记改动
