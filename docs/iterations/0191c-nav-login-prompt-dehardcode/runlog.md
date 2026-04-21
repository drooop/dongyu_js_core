---
title: "Iteration 0191c-nav-login-prompt-dehardcode Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0191c-nav-login-prompt-dehardcode
id: 0191c-nav-login-prompt-dehardcode
phase: phase3
---

# Iteration 0191c-nav-login-prompt-dehardcode Runlog

## Environment

- Date: 2026-03-19
- Branch: `dropx/dev_0191c-nav-login-prompt-dehardcode`
- Runtime: local repo + docs vault

Review Gate Record
- Iteration ID: 0191c-nav-login-prompt-dehardcode
- Review Date: 2026-03-19
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户已明确给出审查结论：`plan.md 和 resolution.md 审查通过。Gate 结论：Approved`
  - 导航、Login、Prompt 的依赖顺序已确认：先导航，再页面资产迁移

## Execution Records

### Step 1

- Command:
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0191c-nav-login-prompt-dehardcode --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - `apply_patch` 更新 `0191c` 的 `plan.md` / `resolution.md` / `runlog.md`
- Key output:
  - 已登记 `0191c` 的目标、范围、验收与回滚
  - 已明确本轮负责：
    - 导航去硬编码
    - `Login`
    - `Prompt`
  - 已明确 `Static / Docs / Home` 留给 `0191d`
- Result: PASS
- Commit: N/A

### Step 2

- Command:
  - `apply_patch` 新增：
    - `packages/worker-base/system-models/nav_catalog_ui.json`
    - `packages/worker-base/system-models/login_catalog_ui.json`
    - `packages/worker-base/system-models/prompt_catalog_ui.json`
    - `scripts/tests/test_0191c_nav_catalog_resolution.mjs`
    - `scripts/tests/test_0191c_prompt_asset_resolution.mjs`
    - `scripts/tests/test_0191c_login_patch_schema.mjs`
  - `apply_patch` 更新：
    - `CLAUDE.md`
    - `packages/ui-model-demo-frontend/src/model_ids.js`
    - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
    - `packages/ui-model-demo-frontend/src/app_shell_route_sync.js`
    - `packages/ui-model-demo-frontend/src/demo_app.js`
    - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
    - `packages/ui-model-demo-server/server.mjs`
  - `node scripts/tests/test_0191c_nav_catalog_resolution.mjs`
  - `node scripts/tests/test_0191c_prompt_asset_resolution.mjs`
  - `node scripts/tests/test_0191c_login_patch_schema.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
  - `PORT=8792 ... bun packages/ui-model-demo-server/server.mjs`
  - `curl http://127.0.0.1:8792/auth/login-model`
- Key output:
  - Header/nav 入口已改为读取 `ui_page_catalog_json`
  - `Prompt` 页面已由 `-21` 的 `ui_ast_v0` 资产提供内容
  - `Login` seed 已从 `server.mjs` 硬编码 `addLabel` 迁为 `login_catalog_ui.json`
  - 已为 `-21` 在 `CLAUDE.md` 的 registry 中登记
  - 验证结果：
    - `test_0191c_nav_catalog_resolution.mjs`: `2 passed, 0 failed`
    - `test_0191c_prompt_asset_resolution.mjs`: `1 passed, 0 failed`
    - `test_0191c_login_patch_schema.mjs`: `1 passed, 0 failed`
    - `validate_demo.mjs`: PASS
    - `/auth/login-model` smoke: PASS
- Result: PASS
- Commit: `4409bd9`

### Step 3

- Command:
  - `git switch dev`
  - `git merge --no-ff dropx/dev_0191c-nav-login-prompt-dehardcode -m "merge: complete 0191c nav login prompt dehardcode"`
  - `git push origin dev`
- Key output:
  - implementation commit: `4409bd9`
  - merge commit: `9c6ca6c`
  - `origin/dev` 已包含：
    - 导航 catalog 驱动
    - Login patch 化
    - Prompt 资产化
  - 无关本地改动 `AGENTS.md` 未纳入 merge 内容
- Result: PASS
- Commit: `9c6ca6c`

## Docs Updated

- [x] `docs/plans/2026-03-19-ui-tier-migration-implementation.md` reviewed
- [x] `docs/iterations/0191a-ui-protocol-freeze/*` reviewed
- [x] `docs/iterations/0191b-gallery-modelization/*` reviewed
- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/ssot/tier_boundary_and_conformance_testing.md` reviewed
