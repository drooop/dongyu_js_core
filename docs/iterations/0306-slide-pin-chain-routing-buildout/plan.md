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

## Scope

- In scope:
  - 新建合法链路
  - 导入时自动建立所需路由
- Out of scope:
  - 不拆旧快捷路由
  - 不修改 Matrix 同事说明文档

## Invariants / Constraints

- 本 IT 只建新，不拆旧。
- 旧路径仍保留为过渡 fallback，直到 `0308`。

## Success Criteria

1. 新链路可独立验证
2. 导入 app 的 submit 可走 `Model 0` 起点
3. 旧路径尚未被删除

## Inputs

- Created at: 2026-04-09
- Iteration ID: `0306-slide-pin-chain-routing-buildout`

