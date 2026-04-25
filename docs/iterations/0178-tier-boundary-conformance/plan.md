---
title: "0178 — Plan (WHAT/WHY)"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0178-tier-boundary-conformance
id: 0178-tier-boundary-conformance
phase: phase1
---

# 0178 — Plan (WHAT/WHY)

## Goal

- 把“隐藏平台辅助能力默认放在负数系统模型”“正数模型尽量保持用户业务表面干净”写入正式规约。
- 把 Tier 1 / Tier 2、模型放置、数据所有权、数据流向、数据链路检查，落成可索引的引导式测试规范。

## Scope

- In scope:
  - 更新 `CLAUDE.md` 的硬规则与 Tier 边界。
  - 更新 `runtime_semantics` / `WORKFLOW`，明确负数/正数模型放置与 Conformance Review。
  - 新增一份引导式披露文档，作为测试与审查的统一索引入口。
- Out of scope:
  - 不修改运行时代码。
  - 不改变现有产品行为，只补规范与测试口径。

## Invariants / Constraints

- Tier 1 / Tier 2 边界必须继续严格分离。
- 正数模型默认服务于用户业务；隐藏 platform helper 不应直接侵入用户打开的正数模型。
- 测试文档必须既能快速检查，又能自然索引到更详细的 SSOT。

## Success Criteria

- 仓库规约中明确写出：
  - 隐藏 helper 默认放在负数系统模型
  - Tier 边界审查项
  - 数据所有权 / 数据流向 / 数据链路的测试要求
- 测试规范具备引导式披露结构，测试时能顺着索引进入相关规范。

## Inputs

- Created at: 2026-03-08
- Iteration ID: 0178-tier-boundary-conformance
- User intent:
  - “最终用户打开的是干净的正数模型”
  - “平台辅助工作尽量都放在负数 ID 模型里”
