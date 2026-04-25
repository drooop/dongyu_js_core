---
title: "Iteration 0181-color-generator-local-egress-example Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0181-color-generator-local-egress-example
id: 0181-color-generator-local-egress-example
phase: phase1
---

# Iteration 0181-color-generator-local-egress-example Plan

## Goal

将“颜色生成器本地优先、只有 `submit` 经现有 pin 链上送至 Model 0 才允许外发”的设计，固化为正式规约样例，避免后续把 UI 的任意事件都默认送入双总线。

## Scope

- In scope:
  - 在 SSOT 中明确“动作是否外发仅由现有 pin 接线是否最终到达 Model 0 `pin.bus.out` 决定”
  - 用颜色生成器作为唯一示例，给出分层 relay 结构与动作分类
  - 在 conformance 测试规范中补充“本地动作不得外发、submit 必须唯一外发”的验证口径
- Out of scope:
  - 不修改 runtime / server / frontend / system-models 代码
  - 不修改远端或本地部署状态
  - 不实现新的 pin 类型、label.t 或额外 runtime 解释语义

## Invariants / Constraints

- 沿用现有 `pin.table.out` / `pin.single.out` / `pin.bus.out` / `pin.connect.label` / `cell_connection` / `submt` 语义，不新增类型。
- “是否外发”的 authority 必须落在接线路径本身，不能落在新的辅助字段或特判。
- UI 默认本地处理；只有显式接到 Model 0 `pin.bus.out` 的动作才允许离开本地 runtime。
- 颜色生成器示例必须体现：
  - 输入框只改本地 draft
  - `submit` 本地先处理，再上送到 Model 0
  - 中间父模型仅做 relay，不承担额外权限特判

## Success Criteria

- `docs/ssot/runtime_semantics_modeltable_driven.md` 明确记录：
  - 默认本地处理
  - 仅现有 out pin 链接到 Model 0 才允许外发
  - 颜色生成器分层 relay 示例
- `docs/user-guide/modeltable_user_guide.md` 提供面向填表者的颜色生成器样例口径。
- `docs/ssot/tier_boundary_and_conformance_testing.md` 增加对应 conformance gate。
- `0181` plan / resolution / runlog 完整，且 docs audit PASS。

## Inputs

- Created at: 2026-03-08
- Iteration ID: 0181-color-generator-local-egress-example
- Approval: user approved in-session on 2026-03-08
