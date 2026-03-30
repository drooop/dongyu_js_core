---
title: "Iteration 0191c-nav-login-prompt-dehardcode Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0191c-nav-login-prompt-dehardcode
id: 0191c-nav-login-prompt-dehardcode
phase: phase1
---

# Iteration 0191c-nav-login-prompt-dehardcode Resolution

## Execution Strategy

- 先把导航入口来源去硬编码，再迁 `Login` 和 `Prompt` 页面资产。
- 复用 `0191a` 的 resolver / schema projection，不扩新的 Tier 1 协议。
- 保留 `Static / Docs / Home` 的 legacy fallback，直到 `0191d`。

## Step 1

- Scope:
  - 审计导航、Login、Prompt 的当前运行时来源
  - 冻结本轮页面资产形态与切换点
- Files:
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/app_shell_route_sync.js`
  - `packages/ui-model-demo-frontend/src/router.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/worker-base/system-models/*.json`
- Verification:
  - `rg -n "Header|ROUTE_HOME|ROUTE_GALLERY|ROUTE_DOCS|ROUTE_STATIC|ROUTE_WORKSPACE|ROUTE_PROMPT" packages/ui-model-demo-frontend/src/demo_app.js packages/ui-model-demo-frontend/src/router.js`
  - `rg -n "login_form|login_username|llm_prompt_text|root_prompt_filltable" packages/ui-model-demo-server/server.mjs packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Acceptance:
  - 已明确导航入口的资产形态
  - 已明确 `Login` 迁移到哪份 patch 资产
  - 已明确 `Prompt` 页面的资产形态
  - 已明确本轮 legacy fallback 仅剩哪些页面
- Rollback:
  - 回退本轮文档改动

### Step 1 Design Output

#### A. 导航入口

- 本轮导航采用最小 `page catalog` 资产路线：
  - 页面入口清单由模型资产提供
  - Tier 1 只负责 route/hash 监听与同步
- 暂不要求 Workspace 左侧整体一并模型化

#### B. Login

- `Login` 页面沿用现有 `schema/data` 形态
- 但 seed 从 `server.mjs` 的硬编码 `addLabel` 迁成 patch 资产

#### C. Prompt

- `Prompt` 页面迁为模型资产
- 首选：
  - `ui_ast_v0` 页面资产
- 理由：
  - 现有页面结构较完整，使用 `ui_ast_v0` 可避免本轮再设计新的 schema 约定

#### D. 本轮后的 fallback 边界

- `Login` 与 `Prompt` 不再允许走 legacy `buildEditorAstV1`
- `Static / Docs / Home` 仍保留 fallback，待 `0191d`

## Step 2

- Scope:
  - 实现导航入口最小模型化
  - 迁移 `Login`
  - 迁移 `Prompt`
- Files:
  - `packages/worker-base/system-models/nav_catalog_ui.json`
  - `packages/worker-base/system-models/login_catalog_ui.json`
  - `packages/worker-base/system-models/prompt_catalog_ui.json`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0191c_nav_catalog_resolution.mjs`
  - `scripts/tests/test_0191c_prompt_asset_resolution.mjs`
  - 必要时 `packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs`
- Verification:
  - `node scripts/tests/test_0191c_nav_catalog_resolution.mjs`
  - `node scripts/tests/test_0191c_prompt_asset_resolution.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs`
- Acceptance:
  - 新增一个同协议页面入口无需修改前端 JS
  - `Login` 与 `Prompt` 已从模型资产提供内容
  - Header/nav 不再写死页面入口按钮列表
- Rollback:
  - 删除本轮新增 patch 资产
  - 恢复 `demo_app.js` / `server.mjs` / resolver 改动
  - 删除本轮新增测试

## Step 3

- Scope:
  - 收口验证与后续承接
  - 为 `0191d` 留下清晰输入
- Files:
  - `docs/iterations/0191c-nav-login-prompt-dehardcode/runlog.md`
  - `docs/ITERATIONS.md`
  - 必要时 `docs/plans/2026-03-19-ui-tier-migration-implementation.md`
- Verification:
  - 人工核对：
    - `0191d` 只剩 `Static / Docs / Home + legacy removal`
    - `Login / Prompt` 已不再属于 `buildEditorAstV1` 覆盖面
- Acceptance:
  - `0191c` 完成后，下一步迁移范围清晰收敛到 `0191d`
- Rollback:
  - 回退本轮文档登记与计划更新

## Notes

- 本轮不处理 Workspace 左侧整体目录模型化；那部分若仍有残留，留待后续单独处理。
