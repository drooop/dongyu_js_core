---
title: "0306 — slide-pin-chain-routing-buildout Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0306-slide-pin-chain-routing-buildout
id: 0306-slide-pin-chain-routing-buildout
phase: phase1
---

# 0306 — slide-pin-chain-routing-buildout Plan

## Goal

- 建成 slide 主线当前第一批合法 pin-chain 路由：
  - 前端事件进入 `Model 0`
  - 经引脚与父子传递
  - 到达目标单元格程序模型 `IN`
- 当前首批迁移动作：
  - `Model 100 submit`
  - `slide_app_import`
  - `slide_app_create`
  - `ws_app_add`
  - `ws_app_delete`
  - `ws_select_app` / `ws_app_select`
- 同时把“mailbox -> pin ingress / routing”的正式归属下沉到 Tier 1 runtime。

## Scope

- In scope:
  - 新建合法链路
  - mailbox 之后的 ingress 由 runtime 解释
  - 导入时自动建立所需 `pin.connect.model` 路由
  - 用内置 `Model 100` 与 slide/workspace 负数系统动作双线验证
- Out of scope:
  - 不修改 Matrix 同事说明文档
  - 不放开导入 app 的 `func.js`
  - 不清理非 slide 主线的其余 legacy shortcut

## Invariants / Constraints

- 对已迁移的 slide/workspace 动作，缺 ingress route 必须直接报错。
- 未迁移的其它动作仍可能保留旧 shortcut，留给后续收口。
- 默认用内置 `Model 100` + workspace 系统动作做主验收，不依赖导入 app `func.js`。

## Success Criteria

1. 新链路可独立验证
2. `Model 100` 的 submit 可走 `Model 0` 起点并到达目标程序模型 `IN`
3. `slide_app_import/create + ws_app_*` 也能经 `Model 0` 进入 `-10` handler pin.in
4. 对已迁移动作，缺 route 时不再 fallback 到 direct `run_func` / direct `ui_event`
5. 非 slide 主线的 legacy shortcut 仍可暂留，且不影响本 IT 验收

## Inputs

- Created at: 2026-04-09
- Iteration ID: `0306-slide-pin-chain-routing-buildout`
