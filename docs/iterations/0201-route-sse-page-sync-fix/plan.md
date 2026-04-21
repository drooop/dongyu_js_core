---
title: "Iteration 0201-route-sse-page-sync-fix Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0201-route-sse-page-sync-fix
id: 0201-route-sse-page-sync-fix
phase: phase1
---

# Iteration 0201-route-sse-page-sync-fix Plan

## Goal

- 修复 remote mode 下 `SSE + hash route + local negative state` 组合导致的页面切换异常：
  - 多页面/多标签场景中，页面切换不应依赖“刚刚点击的那个页面”才能正确收敛
  - route、`ui_page`、`ws_app_selected`、`selected_model_id` 应在各页面上独立收敛

## Background

- `0200` 已完成远端 4 角色部署、远端浏览器验收和远端部署层外挂化验证。
- 用户已明确要求：后续每轮都要做浏览器级验证，因此宿主层 route/SSE 正确性必须先收口，否则后续所有迭代都会持续带噪声。
- 当前相关链路分散在：
  - [demo_app.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/demo_app.js)
  - [app_shell_route_sync.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/app_shell_route_sync.js)
  - [remote_store.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/remote_store.js)
  - [server.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-server/server.mjs)
- 现有合同只覆盖了单页面/单快照的 route sync 逻辑，还没有覆盖“两个活动页面并行订阅同一 SSE 流”的行为。

## Scope

- In scope:
  - 复现并定位 remote mode 下的多页面/多标签 route/SSE 收敛问题
  - 修复 `route -> ui_page -> workspace selection` 在多页面场景中的同步逻辑
  - 补 deterministic contract / integration test，至少覆盖：
    - 两个页面实例并行
    - `home -> workspace`
    - `workspace -> prompt/docs/static` 等跨页切换
    - `workspace` 下 `ws_app_selected` / `selected_model_id` 的一致性
  - 本地浏览器复核至少 1 组双页面切换动作
- Out of scope:
  - 不处理“大 JSON 初始化”与 UI cellwise freeze
  - 不做新的 UI 功能扩展
  - 不调整 Matrix / worker 业务逻辑
  - 不改变 remote deploy 流程

## Invariants / Constraints

- 必须保持 `0200` 已验证通过的远端和本地链路不回退。
- 不允许通过关闭 SSE、轮询替代、或绕过 `ui_page` / `ws_app_selected` 正规链路来“修表面现象”。
- 不允许引入 direct business-state write；仍然只能走既有 `ui_event` / label 更新路径。
- 必须符合 `CLAUDE.md` 新增的 fail-fast 规则：
  - working but non-conformant = 不可接受
  - 不得用 fallback 掩盖 route/SSE 非一致性

## Success Criteria

- deterministic tests 覆盖并通过：
  - 多页面/多标签 route sync contract
  - `workspace` selection consistency contract
  - SSE snapshot 更新后的页面独立收敛 contract
- 本地真实浏览器复核通过：
  - 两个活动页面各自切换时都能正确跳转
  - 不需要“先点另一个页面”才能让当前页面收敛
- 修复后不破坏现有单页面行为：
  - `0182_app_shell_route_sync_contract`
  - `0182_workspace_route_init_contract`
  - `0191c_nav_catalog_resolution`
  - `validate_demo.mjs`

## Risks & Mitigations

- Risk:
  - 问题根因可能不在 route helper，而在 `remote_store` 的 SSE snapshot 应用/暂停逻辑。
  - Mitigation:
    - 先做双页面复现与边界定位，不直接猜修。
- Risk:
  - 修 route 逻辑时破坏 `workspace` 选择同步。
  - Mitigation:
    - 把 `ws_app_selected` / `selected_model_id` 一致性写成独立合同测试。
- Risk:
  - 多页面复现如果只靠手点，容易结论漂移。
  - Mitigation:
    - 用脚本化双页面测试先固定，再辅以浏览器人工复核。

## Alternatives

### A. 推荐：修复当前 route/SSE 收敛逻辑并补双页面合同

- 优点：
  - 直接解决后续所有浏览器验收的底层噪声
  - 不引入新的宿主模式
- 缺点：
  - 需要明确复现双页面状态机

### B. 临时把页面切换改成更激进的本地强制刷新

- 优点：
  - 可能很快看到“表面正常”
- 缺点：
  - 很容易掩盖真正的同步问题
  - 后续会继续在别的页面上复发

当前推荐：A。

## Inputs

- Created at: 2026-03-20
- Iteration ID: 0201-route-sse-page-sync-fix
- Trigger:
  - 用户已明确批准：`0201` 先做
  - 用户已确认其后续顺序为：
    - `0202` freeze
    - `0203` migrate
  - `0200` 已完成，因此可以安全切回宿主正确性修复
