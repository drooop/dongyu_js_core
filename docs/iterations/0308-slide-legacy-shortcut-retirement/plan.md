---
title: "0308 — slide-legacy-shortcut-retirement Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-09
source: ai
iteration_id: 0308-slide-legacy-shortcut-retirement
id: 0308-slide-legacy-shortcut-retirement
phase: phase1
---

# 0308 — slide-legacy-shortcut-retirement Plan

## Goal

- 在 `0306/0307` 新链路稳定后，退役 `ui-server` 里现有的快捷事件路由。

## Scope

- In scope:
  - 旧 mailbox / `dual_bus_model` 快捷触发路径清理
  - 回归验证全部改走合法 pin-chain
- Out of scope:
  - 不建设新链路

## Invariants / Constraints

- 只有在 `0306/0307` 已证明新链路稳定后，才允许执行。

## Success Criteria

1. 旧快捷路由被显式移除
2. 回归仍全部通过

## Inputs

- Created at: 2026-04-09
- Iteration ID: `0308-slide-legacy-shortcut-retirement`

