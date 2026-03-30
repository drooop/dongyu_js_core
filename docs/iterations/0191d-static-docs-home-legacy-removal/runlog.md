---
title: "Iteration 0191d-static-docs-home-legacy-removal Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0191d-static-docs-home-legacy-removal
id: 0191d-static-docs-home-legacy-removal
phase: phase3
---

# Iteration 0191d-static-docs-home-legacy-removal Runlog

## Environment

- Date: 2026-03-19
- Branch: `dropx/dev_0191d-static-docs-home-legacy-removal`
- Runtime: local repo + docs vault

Review Gate Record
- Iteration ID: 0191d-static-docs-home-legacy-removal
- Review Date: 2026-03-19
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户已明确确认：`0191d 通过 Gate，可以开始实施`
  - 两条实施提醒有效：
    - Home 的 editor state seed 保留在 server，只迁 AST 来源
    - 删除 `gallery_model.js` 时注意旧测试依赖

## Execution Records

### Step 1

- Command:
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0191d-static-docs-home-legacy-removal --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - `apply_patch` 更新 `0191d` 的 `plan.md` / `resolution.md` / `runlog.md`
- Key output:
  - 已登记 `0191d` 的目标、范围、验收与回滚
  - 已明确收尾顺序为：
    - `Static`
    - `Docs`
    - `Home`
    - legacy 删除
  - 已把 `Model -21` form label 补齐并入本轮范围
- Result: PASS
- Commit: N/A

### Step 2

- Command:
  - `apply_patch` / bulk edit 更新：
    - `packages/worker-base/system-models/nav_catalog_ui.json`
    - `packages/worker-base/system-models/prompt_catalog_ui.json`
    - `packages/worker-base/system-models/home_catalog_ui.json`
    - `packages/worker-base/system-models/docs_catalog_ui.json`
    - `packages/worker-base/system-models/static_catalog_ui.json`
    - `packages/worker-base/system-models/workspace_catalog_ui.json`
    - `packages/worker-base/system-models/editor_test_catalog_ui.json`
    - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
    - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
    - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
    - `packages/ui-model-demo-server/server.mjs`
    - `CLAUDE.md`
    - `scripts/tests/test_0191d_*`
  - `node scripts/tests/test_0191d_home_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_docs_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_static_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
- Key output:
  - `Static / Docs / Home / Workspace / Test` 已具备模型资产入口
  - `Model -21` 已补显式 `model.single` form label
  - 本地 resolver 已不再依赖 legacyBuilder
  - 验证结果：
    - `test_0191d_home_asset_resolution.mjs`: PASS
    - `test_0191d_docs_asset_resolution.mjs`: PASS
    - `test_0191d_static_asset_resolution.mjs`: PASS
    - `test_0191d_test_workspace_asset_resolution.mjs`: PASS
    - `validate_demo.mjs`: PASS
- Result: PASS
- Commit: `0cb6033`

### Step 3

- Command:
  - `apply_patch` / bulk edit 更新：
    - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
    - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
    - `packages/ui-model-demo-server/server.mjs`
    - `scripts/reset_workspace_db_v0.mjs`
    - `scripts/tests/test_0177_gallery_wave_c_contract.mjs`
    - `scripts/tests/test_0186_real_binding_opt_in_contract.mjs`
  - `apply_patch` 删除：
    - `packages/ui-model-demo-frontend/src/gallery_model.js`
  - `node scripts/tests/test_0191a_page_asset_resolver.mjs`
  - `node scripts/tests/test_0191c_prompt_asset_resolution.mjs`
  - `node scripts/tests/test_0191c_login_patch_schema.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_gallery_events.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_editor_server_static.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `rg -n "buildEditorAstV0|buildEditorAstV1|buildGalleryAst|legacyBuilder" packages/ui-model-demo-frontend/src packages/ui-model-demo-server/server.mjs scripts -g '*.js' -g '*.mjs'`
- Key output:
  - `buildEditorAstV0/V1` 已从运行时代码中删除
  - `buildGalleryAst` 已删除，相关测试改为读取模型资产
  - server 已不再生成整页 AST，也不再向 resolver 传 `legacyBuilder`
  - `validate_gallery_ast.mjs`: PASS
  - `validate_gallery_events.mjs`: PASS
  - `validate_editor_server_static.mjs`: PASS
  - `test_0177_gallery_wave_c_contract.mjs`: PASS
  - `test_0186_real_binding_opt_in_contract.mjs`: PASS
  - `validate_editor.mjs` 仍为既有基线失败：
    - `editor_submodel_create: model 2 not created`
  - `rg` 结果确认已无：
    - `buildEditorAstV0`
    - `buildEditorAstV1`
    - `buildGalleryAst`
    - `legacyBuilder`
- Result: PASS
- Commit: `0cb6033`

### Step 4

- Command:
  - `git switch dev`
  - `git merge --no-ff dropx/dev_0191d-static-docs-home-legacy-removal -m "merge: complete 0191d static docs home legacy removal"`
  - `git push origin dev`
- Key output:
  - implementation commit: `0cb6033`
  - merge commit: `c169a06`
  - `origin/dev` 已包含：
    - `Static / Docs / Home` 资产化
    - `Model -21` form label
    - legacy AST 生成链删除
  - 无关本地改动 `AGENTS.md` 未纳入 merge 内容
- Result: PASS
- Commit: `c169a06`

## Docs Updated

- [x] `docs/plans/2026-03-19-ui-tier-migration-implementation.md` reviewed
- [x] `docs/iterations/0191a-ui-protocol-freeze/*` reviewed
- [x] `docs/iterations/0191b-gallery-modelization/*` reviewed
- [x] `docs/iterations/0191c-nav-login-prompt-dehardcode/*` reviewed
- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/ssot/tier_boundary_and_conformance_testing.md` reviewed
