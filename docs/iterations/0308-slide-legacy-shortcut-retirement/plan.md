---
title: "0308 — slide-legacy-shortcut-retirement Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-10
source: ai
iteration_id: 0308-slide-legacy-shortcut-retirement
id: 0308-slide-legacy-shortcut-retirement
phase: phase3
---

# 0308 — slide-legacy-shortcut-retirement Plan

## Goal

- 在 `0311/0307` 新链路稳定后，退役 slide 主线在 `ui-server` 里剩余的 action-based 快捷事件路由。

## Scope

- In scope:
  - 删除 slide 主线已经被 `0306/0311` 完全替代的旧路径：
    - `RUNTIME_PIN_SYSTEM_ACTION_SPECS`
    - `_buildUiEventIngressPort`
    - `ensureRuntimePinSystemActionBuildout`
    - slide/action → ingress 映射与 `routed_by=runtime_pin`
  - 用静态 request pin + `pin.connect.label` 取代运行时动态 buildout
  - 对已退役的 slide legacy action，显式返回 `legacy_action_protocol_retired`
  - 回归验证：
    - slide 主线路径继续 PASS
    - 非 slide legacy action 继续可用
    - mailbox / snapshot / transport 继续可用
- Out of scope:
  - 不新建 page asset pin
  - 不处理尚未 pin 化的非 slide action
  - 不改 mailbox / snapshot / SSE / upload transport 等基础设施职责
  - 不推进 `hostApi -> pin.out` 的进一步收窄；该项只做盘点，不在本 IT 内完成

## Invariants / Constraints

- 只有在 `0311/0307` 已证明新链路稳定后，才允许执行。
- 必须区分三类路径并分别记录：
  1. 已被 pin-chain 替代，属于删除目标
  2. 非 slide 动作仍在使用，暂时保留
  3. 纯基础设施职责，必须保留

## Success Criteria

1. slide 主线的 action-based ingress 映射被显式移除
2. `Model 100 submit` 与 `slide_app_import/create + ws_select/ws_delete/ws_app_add` 的 legacy action envelope 被显式拒绝
3. 非 slide legacy action 至少保留一个事实样本继续可用
4. 静态 request pin wiring 足够支撑现有 slide 主线回归
5. 本地部署和页面事实验证通过

## Inputs

- Created at: 2026-04-10
- Iteration ID: `0308-slide-legacy-shortcut-retirement`
