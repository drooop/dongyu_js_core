---
title: "Iteration 0191b-gallery-modelization Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0191b-gallery-modelization
id: 0191b-gallery-modelization
phase: phase1
---

# Iteration 0191b-gallery-modelization Resolution

## Execution Strategy

- 先迁 Gallery 页面来源，再接入 Workspace 目录；不在本轮同时做导航系统整体去硬编码。
- 首选 `ui_ast` 模型资产路线，避免在本轮扩展组件解释器语义。
- 顺带吸收 `0191a` 审查中的低成本建议，但不让它们喧宾夺主。

## Step 1

- Scope:
  - 审计当前 Gallery 运行时依赖链
  - 确定 Gallery 的资产形态、模型放置与 Workspace 接入方式
  - 明确 `buildGalleryAst()` / `GalleryRemoteRoot` 的替换目标
- Files:
  - `packages/ui-model-demo-frontend/src/gallery_model.js`
  - `packages/ui-model-demo-frontend/src/gallery_store.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - 可能新增 `packages/worker-base/system-models/gallery_*.json`
- Verification:
  - `rg -n "buildGalleryAst|GalleryRemoteRoot|gallery_state|ui_ast_v0" packages/ui-model-demo-frontend packages/ui-model-demo-server`
  - `rg -n "ws_apps_registry|workspace_positive_models|app_name" packages/ui-model-demo-frontend packages/ui-model-demo-server packages/worker-base/system-models`
- Acceptance:
  - 已明确 Gallery 最终由哪一种模型资产承载
  - 已明确 Gallery 如何出现在 Workspace 目录中
  - 已明确 `#/gallery` 路由在迁移后仍如何工作
  - 已明确本轮不扩新的组件协议
- Rollback:
  - 回退本轮文档改动

### Step 1 Design Output

#### A. 资产形态

本轮 Gallery 采用：

- `ui_ast_v0` 模型资产

不采用：

- 新组件引用协议
- 新 fragment/include 协议扩展

理由：

- 现有 `ui_ast_v0` 足以承载 Gallery 页面内容
- `0191b` 的目标是去硬编码，不是引入新的 Tier 1 语义

#### B. 模型放置

Gallery 页面本体建议放在：

- 负数可见系统 UI 模型

约束：

- 必须具备显式 `app_name`
- 必须能被 Workspace 目录发现
- 不得伪装成正数业务模型

#### C. 双入口要求

迁移后需同时满足：

- `#/gallery` 仍可打开 Gallery
- Workspace 可从目录进入 Gallery

#### D. 低成本顺带事项

本轮允许顺带处理：

- `getSnapshotModel` 去重为共享 snapshot helper
- `resolvePageAsset()` 增补 `source: "none"` 测试

## Step 2

- Scope:
  - 实现 Gallery 资产化
  - 让 Gallery route 与 Workspace 都走模型资产来源
  - 切断 `buildGalleryAst()` / `GalleryRemoteRoot` 运行时链路
- Files:
  - `packages/worker-base/system-models/gallery_catalog_ui.json`
  - `packages/ui-model-demo-frontend/src/gallery_store.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
  - `packages/ui-model-demo-frontend/src/snapshot_utils.js`
  - `scripts/tests/test_0191b_gallery_asset_resolution.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs`
- Verification:
  - `node scripts/tests/test_0191b_gallery_asset_resolution.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
  - `rg -n "buildGalleryAst|GalleryRemoteRoot" packages/ui-model-demo-frontend packages/ui-model-demo-server`
- Acceptance:
  - Gallery 运行时来源已切到模型资产
  - `buildGalleryAst()` 不再被运行时调用
  - Workspace 中可进入 Gallery
  - `resolvePageAsset()` 已补 `source: "none"` 测试
  - 若进行了 snapshot helper 去重，行为与现有逻辑一致
- Rollback:
  - 删除 Gallery 资产 patch
  - 恢复 `gallery_store.js` / `demo_app.js`
  - 删除本轮新增测试

## Step 3

- Scope:
  - 收口验证与后续承接
  - 为 `0191c` 提供清晰输入
- Files:
  - `docs/iterations/0191b-gallery-modelization/runlog.md`
  - `docs/ITERATIONS.md`
  - 必要时 `docs/plans/2026-03-19-ui-tier-migration-implementation.md`
- Verification:
  - 人工核对：
    - `0191c` 是否只需处理导航 / Login / Prompt
    - `0191d` 是否可以继续处理 Static / Docs / Home
- Acceptance:
  - Gallery 已成为正式 Tier 2 资产入口
  - 后续迭代不需要再回头讨论 Gallery 来源问题
- Rollback:
  - 回退本轮文档与登记改动

## Notes

- 本轮不处理 Header 顶部导航整体去硬编码；那属于 `0191c` 范围。
