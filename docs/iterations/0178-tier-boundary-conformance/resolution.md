---
title: "0178 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0178-tier-boundary-conformance
id: 0178-tier-boundary-conformance
phase: phase1
---

# 0178 — Resolution (HOW)

## Execution Strategy

- 先把最高优先级规则写进 `CLAUDE.md`，避免后续能力设计继续漂移。
- 再在 `runtime_semantics` 与 `WORKFLOW` 中补“模型放置”和“Conformance Review”。
- 最后单独新增一份引导式披露文档，作为测试入口页与索引页。

## Step 1

- Scope:
  - 更新最高优先级规则，明确隐藏 helper 默认放在负数系统模型。
- Files:
  - `CLAUDE.md`
- Verification:
  - `rg -n "negative model_id system models|positive models are the default surface|conformance review" CLAUDE.md`
- Acceptance:
  - CLAUDE 已对 Tier/模型放置边界给出不可下位文档覆盖的硬规则。
- Rollback:
  - 回退 `CLAUDE.md` 本轮改动。

## Step 2

- Scope:
  - 更新 SSOT / workflow，明确 Conformance Review 的必查项。
- Files:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/WORKFLOW.md`
- Verification:
  - `rg -n "platform helper|Conformance Review|数据所有权|数据流向|数据链路" docs/ssot/runtime_semantics_modeltable_driven.md docs/WORKFLOW.md`
- Acceptance:
  - SSOT 和 workflow 都能明确指向“负数系统模型承载隐藏 helper + 测试必须做边界审查”。
- Rollback:
  - 回退对应文档改动。

## Step 3

- Scope:
  - 新增引导式披露测试规范，并登记 iteration 证据。
- Files:
  - `docs/ssot/tier_boundary_and_conformance_testing.md`
  - `docs/ITERATIONS.md`
  - `docs/iterations/0178-tier-boundary-conformance/*`
- Verification:
  - `rg -n "Quick Gate|Guided Disclosure|Tier 1|Tier 2|negative model|positive model" docs/ssot/tier_boundary_and_conformance_testing.md docs/iterations/0178-tier-boundary-conformance docs/ITERATIONS.md`
- Acceptance:
  - 已形成一份可直接被测试过程引用的入口文档，而不是只散落在聊天或 runlog。
- Rollback:
  - 删除新增 SSOT 文档并回退 iteration 登记。

## Notes

- Review Gate:
  - Decision: Approved
  - Basis: 用户明确要求把这套边界与测试要求写入规约，防止后续功能无控制进入基座。
