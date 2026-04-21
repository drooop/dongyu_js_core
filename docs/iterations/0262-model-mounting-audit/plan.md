---
title: "Iteration 0262-model-mounting-audit Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0262-model-mounting-audit
id: 0262-model-mounting-audit
phase: phase1
---

# Iteration 0262-model-mounting-audit Plan

## 0. Metadata
- ID: 0262-model-mounting-audit
- Date: 2026-03-30
- Owner: Codex + User
- Branch: dev_0262-model-mounting-audit
- Related:
  - `viz-model-mounting.html`
  - `CLAUDE.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `packages/worker-base/system-models/**`
  - `deploy/sys-v1ns/**`

## 1. Goal
把模型挂载可视化从手写事实改成基于真实 repo/runtime 事实生成，并在同一数据源上输出挂载合规审计。

## 2. Background
当前 `viz-model-mounting.html` 把 `models` 与 `mounts` 硬编码在页面里，导致未挂载模型与多重挂载统计并不一定反映当前仓库真实声明。用户要求先修正可视化事实口径，再基于新数据源做审计。

## 3. Invariants (Must Not Change)
- 挂载规约仍以 `CLAUDE.md` 与 `runtime_semantics_modeltable_driven.md` 为准。
- 不修改 runtime、patch 语义或真实挂载声明；本次只改分析与展示工具。
- 可视化必须显式保留 source/context，不再把多 source 混成单一 truth。

## 4. Scope
### 4.1 In Scope
- 新增 repo 事实分析器
- 让 `viz-model-mounting.html` 使用生成数据
- 输出 unmounted / duplicate mount audit
- 补 focused tests

### 4.2 Out of Scope
- 直接修复挂载违规
- 变更 `model.submt` 或 runtime 解释器行为
- 远端环境审计

## 5. Non-goals
- 不顺带清理其它 `viz-*` 文件
- 不把 HTML 做成正式产品功能

## 6. Success Criteria (Definition of Done)
1. `viz-model-mounting.html` 不再依赖手写 `models` / `mounts` 作为权威源。
2. 分析器能输出 declared models、mounts、unmounted、duplicate mounts、source/context。
3. 自动化测试覆盖当前关键 contract：`-101` 不误报、`100`/`1` 的多重挂载能识别。
4. 可视化与审计结论可通过脚本重现。

## 7. Risks & Mitigations
- Risk: 静态 repo scan 与 live runtime 仍有差距。
  - Impact: 部分审计仍可能偏保守。
  - Mitigation: 输出中明确区分 repo-declared facts 与 selected scope/context。
- Risk: 测试过度绑定当前仓库状态。
  - Impact: 后续维护成本升高。
  - Mitigation: 只锁关键 contract，不锁展示细节。

## 8. Open Questions
None.

## 9. Compliance Checklists

### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `CLAUDE.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
- Notes:
  - 合规判断使用显式 `model.submt` / single-parent 规则。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `CLAUDE.md`
- Notes:
  - 本次只做 analysis/viz，不改运行时。
