---
title: "Iteration 0201-route-sse-page-sync-fix Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0201-route-sse-page-sync-fix
id: 0201-route-sse-page-sync-fix
phase: phase1
---

# Iteration 0201-route-sse-page-sync-fix Resolution

## Execution Strategy

- 先做双页面复现，确认问题是在：
  - `demo_app` route event dispatch
  - `app_shell_route_sync` 状态判定
  - `remote_store` 的 SSE snapshot 暂停/恢复
  - 或 server 端 negative state 覆写
- 再用 contract tests 把根因锁死。
- 最后做最小修复，并用真实浏览器做双页面复核。

## Step 1

- Scope:
  - 审计并复现 `SSE + route + workspace selection` 问题
  - 设计双页面复现 harness
- Files:
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/app_shell_route_sync.js`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-model-demo-server/server.mjs`
  - 现有 route/workspace 合同测试
- Verification:
  - `node scripts/tests/test_0182_app_shell_route_sync_contract.mjs`
  - `node scripts/tests/test_0182_workspace_route_init_contract.mjs`
  - `node scripts/tests/test_0191c_nav_catalog_resolution.mjs`
  - 如需复现 harness，先让新测试 RED
- Acceptance:
  - 能明确指出问题发生在哪一层
  - 不以“猜测修复”进入 Step 2
- Rollback:
  - 无代码变更，仅保留复现记录

## Step 2

- Scope:
  - 先写 failing tests
  - 再做最小修复
- Files:
  - 新的 `0201` contract / integration tests
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/app_shell_route_sync.js`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - 仅当确有必要时触碰 `packages/ui-model-demo-server/server.mjs`
- Verification:
  - 新 `0201` tests：先 RED，再 GREEN
  - `node scripts/tests/test_0182_app_shell_route_sync_contract.mjs`
  - `node scripts/tests/test_0182_workspace_route_init_contract.mjs`
  - `node scripts/tests/test_0191c_nav_catalog_resolution.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
- Acceptance:
  - 多页面/多标签切换问题消失
  - 现有 route/workspace contracts 不回退
- Rollback:
  - 回退本轮前端/宿主层最小改动

## Step 3

- Scope:
  - 本地真实浏览器双页面复核
  - 收口 runlog / `docs/ITERATIONS`
- Files:
  - `docs/iterations/0201-route-sse-page-sync-fix/runlog.md`
  - `docs/ITERATIONS.md`
  - `output/playwright/`（如有截图）
- Verification:
  - 两个页面实例同时打开
  - 各自执行：
    - `home -> workspace`
    - `workspace -> prompt/docs/static`
  - 验证：
    - 页面独立收敛
    - `workspace` 选中态一致
    - 不需要跨页面额外点击
- Acceptance:
  - 浏览器级复核 PASS
  - 证据链进入 runlog
- Rollback:
  - 回退 docs vault 记录

## Notes

- Generated at: 2026-03-20
- 0201 只做宿主正确性，不越界到 `0202/0203` 的 UI 规约冻结与迁移
