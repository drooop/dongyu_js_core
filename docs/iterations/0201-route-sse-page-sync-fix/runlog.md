---
title: "Iteration 0201-route-sse-page-sync-fix Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0201-route-sse-page-sync-fix
id: 0201-route-sse-page-sync-fix
phase: phase3
---

# Iteration 0201-route-sse-page-sync-fix Runlog

## Environment

- Date: 2026-03-20
- Branch: `dropx/dev_0201-route-sse-page-sync-fix`
- Runtime: local repo + docs vault

## Execution Records

### Step 1

- Command:
  - `git switch -c dropx/dev_0201-route-sse-page-sync-fix`
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0201-route-sse-page-sync-fix --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - `rg -n "SSE|stream|EventSource|app_shell_route_sync|ws_app_selected|selected_model_id" packages/ui-model-demo-frontend/src packages/ui-model-demo-server/server.mjs scripts/tests -g '*.js' -g '*.mjs'`
  - 审阅：
    - `packages/ui-model-demo-frontend/src/demo_app.js`
    - `packages/ui-model-demo-frontend/src/app_shell_route_sync.js`
    - `packages/ui-model-demo-frontend/src/remote_store.js`
    - `scripts/tests/test_0182_app_shell_route_sync_contract.mjs`
    - `scripts/tests/test_0182_workspace_route_init_contract.mjs`
    - `scripts/tests/test_0191c_nav_catalog_resolution.mjs`
- Key output:
  - 已确认 `0201` 相关分支与脚手架已创建
  - 已确认当前问题边界集中在：
    - route hash listener
    - `ui_page` event dispatch
    - `workspace` selection sync
    - SSE snapshot 应用与暂停恢复
  - 已确认现有合同主要覆盖单页面逻辑，尚未覆盖双页面/多标签并发切换
- Result: PASS
- Commit: N/A

### Step 2

- Command:
  - failing tests first:
    - `node scripts/tests/test_0182_app_shell_route_sync_contract.mjs`
    - `node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - implementation:
    - route-local AST projection helper
    - app shell route normalization helper
    - local/remote store route path reactive state
  - regression:
    - `node scripts/tests/test_0182_app_shell_route_sync_contract.mjs`
    - `node scripts/tests/test_0201_route_local_ast_contract.mjs`
    - `node scripts/tests/test_0191c_nav_catalog_resolution.mjs`
    - `node scripts/tests/test_0182_workspace_route_init_contract.mjs`
    - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
    - `node --check packages/ui-model-demo-frontend/src/demo_app.js`
    - `node --check packages/ui-model-demo-frontend/src/app_shell_route_sync.js`
    - `node --check packages/ui-model-demo-frontend/src/route_ui_projection.js`
    - `node --check packages/ui-model-demo-frontend/src/remote_store.js`
    - `node --check packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Key output:
  - 已确认根因有两层：
    - `routeSyncState` 使用共享 `snapshot ui_page / selected_model_id` 作为 blocking 条件，导致多标签页相互干扰
    - `demo_app.normalizeIfUnknown()` 在 page catalog 尚未 bootstrap 前会把深链直接改回首页
  - 修复后：
    - route sync 仅对 `workspace` 的 `ws_app_selected` 是否存在做最小 gating
    - 非 `workspace` 页面不再被共享 `ui_page` 拖入 pending
    - `local/remote store` 都改为按当前标签页 route 本地投影 UI AST
    - route path 建模为 reactive state，Vue 可在 route 切换时立即重算页面 AST
    - 深链在 catalog 未到达前不再被强制重写到 `/`
- Result: PASS
- Commit: pending_local

### Step 3

- Command:
  - 启动本地 remote-mode 复核环境：
    - `PORT=39090 HOST=127.0.0.1 CORS_ORIGIN=http://127.0.0.1:5173 DY_AUTH=0 bun packages/ui-model-demo-server/server.mjs`
    - `npm -C packages/ui-model-demo-frontend run dev`
  - 浏览器复核：
    - 打开 `http://127.0.0.1:5173/?mode=remote&server=http://127.0.0.1:39090#/workspace`
    - 新开第二页：`http://127.0.0.1:5173/?mode=remote&server=http://127.0.0.1:39090#/prompt`
    - 交叉切换：
      - tab0 保持 `workspace`
      - tab1 保持 `prompt`
      - 再把 tab0 切到 `home`
      - tab1 仍保持 `prompt`
- Key output:
  - `#/workspace` 深链不再在启动时被打回 `#/`
  - 第二页直接打开 `#/prompt` 时，第一页仍保持 `workspace`
  - 第一页切回 `home` 后，第二页仍保持 `prompt`
  - 不再出现“必须由实际点击的那个页面才能正确跳转”的耦合
- Result: PASS
- Commit: N/A

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] `docs/iterations/0201-route-sse-page-sync-fix/plan.md` updated
- [x] `docs/iterations/0201-route-sse-page-sync-fix/resolution.md` updated
- [x] browser evidence copied to repo:
  - [0201-tab-home-stable.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/0201-tab-home-stable.png)
  - [0201-tab-prompt-stable.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/0201-tab-prompt-stable.png)
