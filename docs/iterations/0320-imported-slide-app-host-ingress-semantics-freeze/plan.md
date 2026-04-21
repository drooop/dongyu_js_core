---
title: "0320 — imported-slide-app-host-ingress-semantics-freeze Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0320-imported-slide-app-host-ingress-semantics-freeze
id: 0320-imported-slide-app-host-ingress-semantics-freeze
phase: phase1
---

# 0320 — imported-slide-app-host-ingress-semantics-freeze Plan

## Goal

- 冻结 imported slide app 的宿主接入语义，明确哪些事件应统一视为宿主正式 ingress、安装时宿主自动补哪些 adapter、以及 imported app 最少要暴露哪些边界 pin。

## Scope

- In scope:
  - 裁决“正式业务 ingress”与“本地 UI 草稿态”的边界
  - 裁决 imported app 安装时宿主自动生成的 adapter / relay / mount wiring 范围
  - 裁决 imported app 最少应声明的边界入口 pin
  - 评估与现有 `0305/0306/0310/0311` 的关系
- Out of scope:
  - 不修改现有 runtime / server / frontend 行为
  - 不改写 `0313` 总览页为“当前已经统一经 Model 0 ingress”
  - 不发明新的远端 room message 协议

## Invariants / Constraints

- 必须把“当前 live code 事实”和“下一阶段候选正式架构”分开写。
- 当前事实仍保持：
  - 前端 pin 直寻址先写目标 cell 的目标 pin
  - 并非所有正式事件都已经统一先进 Model 0
- 本地 UI 草稿、延后同步输入不应被一刀切拉进统一 ingress。
- 只能在 docs-only 范围内冻结候选语义，不能借机改实现。

## Success Criteria

1. 明确列出哪些事件属于宿主正式 ingress，哪些仍留在本地 UI 态。
2. 明确列出 imported app 安装时宿主自动补哪些 adapter / relay / mount wiring。
3. 明确列出 imported app 最少要暴露哪些边界 pin，宿主才知道怎么接。
4. 全文不会把候选架构误写成当前已实现事实。

## Inputs

- Created at: 2026-04-14
- Iteration ID: `0320-imported-slide-app-host-ingress-semantics-freeze`
- Source discussion:
  - 用户认可“正式业务事件统一 ingress、本地 UI 草稿不统一 ingress”的候选方向
  - 用户要求先开 docs-only 迭代冻结宿主接入语义
