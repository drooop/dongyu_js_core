---
title: "Iteration 0191a-ui-protocol-freeze Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0191a-ui-protocol-freeze
id: 0191a-ui-protocol-freeze
phase: phase3
---

# Iteration 0191a-ui-protocol-freeze Runlog

## Environment

- Date: 2026-03-19
- Branch: `dropx/dev_0191-ui-tier-boundary-audit`
- Runtime: local repo + docs vault

Review Gate Record
- Iteration ID: 0191a-ui-protocol-freeze
- Review Date: 2026-03-19
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户已明确给出审查结论：`plan.md + resolution.md — 通过`
  - 4 阶段迁移路线与 `0191a / 0191b / 0191c / 0191d` 实施单元均获确认
  - 3 条 minor 备注不阻塞 Gate，其中分支一致性与 Step 2 范围约束已在本轮吸收

## Execution Records

### Step 1

- Command:
  - `rg -n "buildEditorAstV1|buildAstFromSchema|buildGalleryAst|GalleryRemoteRoot|readAppShellRouteSyncState|ui_page|ws_apps_registry" packages/ui-model-demo-frontend packages/ui-model-demo-server`
  - `rg -n "Tier 1|Tier 2|host|ctx|projection|UI is projection" CLAUDE.md docs/ssot/tier_boundary_and_conformance_testing.md docs/ssot/host_ctx_api.md docs/ssot/runtime_semantics_modeltable_driven.md`
- Key output:
  - 已确认最小 Tier 1 边界
  - 已确认 `buildEditorAstV1` / `buildGalleryAst` / Header/nav / server 页面 AST 生成属于 Tier 2 泄漏
  - 已确认 `buildAstFromSchema()` 可暂视为通用 projection 解释层，但需冻结协议并抽离
- Result: PASS
- Commit: N/A

### Step 2

- Command:
  - `apply_patch` 新增：
    - `packages/ui-model-demo-frontend/src/ui_schema_projection.js`
    - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
    - `scripts/tests/test_0191a_ui_schema_projection.mjs`
    - `scripts/tests/test_0191a_page_asset_resolver.mjs`
  - `apply_patch` 更新：
    - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
    - `packages/ui-model-demo-server/server.mjs`
  - `node scripts/tests/test_0191a_ui_schema_projection.mjs`
  - `node scripts/tests/test_0191a_page_asset_resolver.mjs`
  - `node scripts/tests/test_0190_data_array_template_patch.mjs`
  - `node scripts/tests/test_0190_data_array_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs`
- Key output:
  - 已将 `buildAstFromSchema()` 抽离到独立模块：
    - `packages/ui-model-demo-frontend/src/ui_schema_projection.js`
  - 已新增 page asset resolver：
    - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
  - 已在本地 store 与 server 的 `updateDerived()` 入口接入“模型资产优先、legacy fallback 次之”
  - 新增测试结果：
    - `test_0191a_ui_schema_projection.mjs`: `2 passed, 0 failed`
    - `test_0191a_page_asset_resolver.mjs`: `3 passed, 0 failed`
  - 回归结果：
    - `test_0190_data_array_template_patch.mjs`: `2 passed, 0 failed`
    - `test_0190_data_array_contract.mjs`: `8 passed, 0 failed`
    - `validate_demo.mjs`: PASS
  - 基线已存在失败（非本轮引入）：
    - `validate_editor.mjs`: `FAIL: editor_submodel_create: model 2 not created`
    - `validate_gallery_ast.mjs`: `FAIL: wave_c_submodel_create_missing`
  - 已用 `19a6388` 基线 worktree 复验，上述两项失败在基线同样存在
- Result: PASS
- Commit: N/A

### Step 3

- Command:
  - `apply_patch` 更新 `0191a` 的 runlog / ITERATIONS
  - `git add` 本轮代码与测试文件
  - `git commit`
- Key output:
  - 已确认 `0191b/0191c/0191d` 可直接引用本轮冻结的协议与 resolver 入口
  - 已确认 `0191a` 本轮未迁具体页面内容，仅完成协议抽离与入口冻结
- Result: PASS
- Commit: `f21e4c4`

### Step 4

- Command:
  - `git switch dev`
  - `git merge --no-ff dropx/dev_0191-ui-tier-boundary-audit -m "merge: complete 0191a ui protocol freeze"`
  - `git push origin dev`
- Key output:
  - implementation commit: `f21e4c4`
  - merge commit: `84f6b91`
  - `origin/dev` 已包含 `0191a` 的协议抽离与 resolver 入口
  - 无关本地改动 `AGENTS.md` 未纳入 merge 内容
- Result: PASS
- Commit: `84f6b91`

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/ssot/tier_boundary_and_conformance_testing.md` reviewed
- [x] `docs/ssot/host_ctx_api.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed (no change in Phase1)
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
- [x] `docs/plans/2026-03-19-ui-tier-migration-implementation.md` created
