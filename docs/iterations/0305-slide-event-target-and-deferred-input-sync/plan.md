---
title: "0305 — slide-event-target-and-deferred-input-sync Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0305-slide-event-target-and-deferred-input-sync
id: 0305-slide-event-target-and-deferred-input-sync
phase: phase1
---

# 0305 — slide-event-target-and-deferred-input-sync Plan

## Goal

- 把前端事件目标合同升级为“当前模型 + 当前单元格坐标”。
- 恢复正数模型输入控件的延后同步。

## Scope

- In scope:
  - 事件 envelope 中显式携带 `model_id / p / r / c`
  - 正数模型 `Input` 的本地草稿与延后同步
  - requirement 3 的正式落位
- Out of scope:
  - 不建设 `Model 0 -> pin-chain` 新路由
  - 不拆旧快捷路由

## Invariants / Constraints

- UI 仍只写 mailbox，不直接改业务真值。
- 事件类型仍在 action/type 字段，不把 `k` 作为主寻址字段。
- 输入控件不得每次键入都双总线。
- 本 IT 内含两个独立验收点：
  - 事件目标合同升级
  - 正数模型 Input 延后同步
- 若两者实施节奏明显分离，允许后续拆成 `0305a / 0305b`。

## Success Criteria

1. submit / 事件 envelope 目标已不再只有 `meta.model_id`
2. 正数模型输入控件支持延后同步
3. 两个验收点可分别验证，不互相阻塞
4. 现有 `0302/0303` 导入链不回归

## Inputs

- Created at: 2026-04-09
- Iteration ID: `0305-slide-event-target-and-deferred-input-sync`
