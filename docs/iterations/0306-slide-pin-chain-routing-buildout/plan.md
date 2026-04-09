---
title: "0306 — slide-pin-chain-routing-buildout Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-09
source: ai
iteration_id: 0306-slide-pin-chain-routing-buildout
id: 0306-slide-pin-chain-routing-buildout
phase: phase1
---

# 0306 — slide-pin-chain-routing-buildout Plan

## Goal

- 只建设新的合法 pin-chain 路由：
  - 前端事件进入 `Model 0`
  - 经引脚与父子传递
  - 到达目标单元格程序模型 `IN`
- 同时把“mailbox -> pin ingress / routing”的正式归属下沉到 Tier 1 runtime。

## Scope

- In scope:
  - 新建合法链路
  - mailbox 之后的 ingress 由 runtime 解释
  - 导入时自动建立所需 `pin.connect.model` 路由
- Out of scope:
  - 不拆旧快捷路由
  - 不修改 Matrix 同事说明文档

## Invariants / Constraints

- 本 IT 只建新，不拆旧。
- 旧路径仍保留为过渡 fallback，直到 `0308`。
- 默认用内置 `Model 100` 做主验收，不依赖导入 app。

## Success Criteria

1. 新链路可独立验证
2. `Model 100` 的 submit 可走 `Model 0` 起点并到达目标程序模型 `IN`
3. 导入时自动加路由的能力已具备，但导入 app 的执行型验证留到后续 IT
4. 旧路径尚未被删除

## Inputs

- Created at: 2026-04-09
- Iteration ID: `0306-slide-pin-chain-routing-buildout`
