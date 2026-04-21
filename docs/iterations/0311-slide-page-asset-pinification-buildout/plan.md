---
title: "0311 — slide-page-asset-pinification-buildout Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0311-slide-page-asset-pinification-buildout
id: 0311-slide-page-asset-pinification-buildout
phase: phase1
---

# 0311 — slide-page-asset-pinification-buildout Plan

## Goal

- 把内置页面和系统动作按钮改成“按钮 = cell pin 投影”。

## Scope

- In scope:
  - 为已审计出的按钮 cell 补 `pin.in / pin.connect.label / func.js / pin.connect.cell`
  - 让前端投影节点显式带出 `writable_pins`
  - 让 renderer / server / local adapter 支持 pin 直寻址 envelope
  - 为 `ws_app_add` 补一个最小可用的 UI cell
- Out of scope:
  - 不开放执行型导入
  - 不清理旧 action 兼容层
  - 不退役 `0306` 的过渡 ingress 路由

## Status

- 本计划依赖 `0310` 先冻结：
  - 前端 pin 直寻址 envelope
  - projection 如何下发 pin 名
  - 系统动作按钮的 cell 化审计结果

## Audit Input From 0310

- 已有独立 cell，可直接进入 pin 化：
  - `Model 100 submit`
  - `slide_app_import`
  - `slide_app_create`
  - `ws_select_app`
  - `ws_app_delete`
- 动作别名复用已有按钮：
  - `ws_app_select` 复用 `ws_select_app`
- 当前未发现现成按钮 cell，需要先补 page_asset / cell：
  - `ws_app_add`

## Success Criteria

1. 以上 6 类动作都可通过 pin 直寻址触发，不再要求 `action` 才能成立。
2. 对应节点投影中能看到符合 `0310` 冻结结构的 `writable_pins`。
3. local / remote 两条前端入口都能消费 pin 直寻址 envelope。
4. `0306` 现有 action 兼容层仍可暂留，但不影响新路径工作。
