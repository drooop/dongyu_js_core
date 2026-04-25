---
title: "Iteration 0192-conformance-failfast-rules Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0192-conformance-failfast-rules
id: 0192-conformance-failfast-rules
phase: phase1
---

# Iteration 0192-conformance-failfast-rules Plan

## Goal

- 在最高优先级规约中补强“non-conformance fail fast”原则，禁止用兼容路径、降级路径或 fallback 掩盖规约违规。
- 明确区分：
  - 流程/决策层的 fail fast
  - 代码/运行时层的 fail fast

## Background

- 当前 `CLAUDE.md` 已有：
  - `every implementation and verification MUST explicitly check: tier placement, model placement, data ownership, data flow, and data chain`
  - `silent failure (all failures must write to ModelTable)`
- 但仍缺两条更明确的裁决：
  - “实现虽然能跑通，但若绕过规约路径，则必须立即判定为不可接受”
  - “不得用 graceful degradation / legacy fallback 掩盖规约路径失败”
- 这两条的目标不是新增功能，而是提高执行与审查时的 fail-fast 强度，避免：
  - 先绕 Tier 边界跑通、以后再补
  - `try { conformant_path } catch { fallbackToLegacy() }`

## Scope

- In scope:
  - 在 `CLAUDE.md` 的 `HARD_RULES` 中新增流程层 fail-fast 条文
  - 在 `CLAUDE.md` 的 `FORBIDDEN` 中新增运行时层 fail-fast 条文
  - 让两条条文能直接覆盖：
    - tier boundary
    - model placement
    - data flow
    - connection layer / routing path
- Out of scope:
  - 不修改 runtime 代码
  - 不改 `docs/ssot/runtime_semantics_modeltable_driven.md`
  - 不改具体页面或功能实现

## Invariants / Constraints

- 条文必须写在最高优先级的 `CLAUDE.md` 中，不能只写在低优先级文档里。
- 新条文不得与现有 `HARD_RULES` / `FORBIDDEN` 冲突。
- 条文必须是“可执行裁决规则”，而不是宽泛口号。

## Success Criteria

- `HARD_RULES` 中出现明确的“working but non-conformant = unacceptable”流程规则。
- `FORBIDDEN` 中出现明确的“不得以 fallback/降级掩盖规约路径失败”代码规则。
- 文案读起来能直接指导：
  - AI 评审
  - AI 实现
  - 人工 code review

## Risks & Mitigations

- Risk:
  - 文案只强调 fail fast，但没有说清“哪些违规算 non-conformance”。
  - Impact:
    - 审查时仍会留下解释空间。
  - Mitigation:
    - 条文中直接点名 tier boundary、model placement、data flow、connection layer。
- Risk:
  - 把 fallback 一刀切禁掉，误伤迁移期允许的明确切换机制。
  - Impact:
    - 使合法的迁移切换点也被误判。
  - Mitigation:
    - 将禁令限定为“在应当使用规约路径时，用 fallback 掩盖失败”。

## Alternatives

### A. 推荐：在 `HARD_RULES` + `FORBIDDEN` 双点补强

- 优点：
  - 流程层与代码层分别受约束
  - 覆盖最完整
- 缺点：
  - 文案需要更精确，避免重复

### B. 只补 `FORBIDDEN`

- 优点：
  - 改动更少
- 缺点：
  - 缺少流程/决策层约束，无法阻止“先绕后补”的执行习惯

当前推荐：A。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0192-conformance-failfast-rules
- User proposal:
  - `HARD_RULES` 增加流程层 fail fast
  - `FORBIDDEN` 增加 graceful degradation / fallback 禁令
