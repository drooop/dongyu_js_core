---
title: "orchestrator execution remediation"
iteration: 1220-orchestrator-monitor-resume-smoke-doc
doc_type: iteration-plan
status: planned
created: 2026-03-20
updated: 2026-03-21
source: ai
iteration_id: 1220-orchestrator-monitor-resume-smoke-doc
id: 1220-orchestrator-monitor-resume-smoke-doc
phase: phase1
---

# orchestrator execution remediation

## WHAT

本 iteration 改为一次针对 `scripts/orchestrator/` 的定向代码修复，目标是收敛 Claude Code 审查指出的两个 blocking issues：

- `drivers.mjs` 在解析 LLM JSON 输出时必须使用现有 `schemas/*.json` 做结构校验，不能只靠“能 `JSON.parse`”就继续推进状态机。
- `orchestrator.mjs` 中过长的 `runIteration()` 必须拆成按 phase 分工的 handler，降低维护成本，并保持当前状态机行为不回归。

交付范围只包含 orchestrator 自身代码、最小必要测试和本 iteration 证据文档：

- `scripts/orchestrator/drivers.mjs`
- `scripts/orchestrator/orchestrator.mjs`
- `scripts/orchestrator/test_orchestrator.mjs`
- `docs/iterations/1220-orchestrator-monitor-resume-smoke-doc/runlog.md`

## WHY

当前实现有两个直接风险：

- review / execution / final verification 的 JSON 解析没有 schema 校验。只要 LLM 输出字段缺失、类型漂移或嵌套结构错位，状态机就可能把坏数据当成真值继续推进，最终在后续字段访问处静默失败或崩溃。
- `runIteration()` 把多个 phase 压在一个超长 switch-case 中，调试时很难定位 phase 内部的状态变更顺序，也难以在不破坏主循环的前提下安全修改单个 phase。

这次修复的目标不是重设计 orchestrator，而是在不扩散 scope 的前提下提升其稳健性和可维护性。

## 成功标准

- `parseVerdict()`、`parseExecOutput()`、`parseFinalVerdict()` 对命中的 JSON 片段执行 schema 校验；结构不合法时必须返回 `ok: false` 或继续寻找其他候选 JSON，不得把非法对象直接放行。
- review verdict 的 prose fallback 仍然可用，但 fallback 构造出的对象也必须通过同一套 schema 校验后才可返回。
- `runIteration()` 被拆成独立 phase handler，主循环长度明显收敛；phase 分支职责清晰，状态推进顺序与现有约束一致。
- orchestrator 相关验证命令通过，且新增测试能覆盖 schema 校验的成功/失败路径。
- `runlog.md` 记录本次修复、验证命令、PASS/FAIL 与提交事实。

## 范围边界

本 iteration 只修复上述 blocking issues 与在实现过程中直接暴露出的同路径执行缺口，不做以下扩展：

- 不修改 `packages/**`、`deploy/**`、`k8s/**`。
- 不引入 orchestrator 之外的新 CLI 工作流。
- 不重写 scheduler/state/event/register 的整体架构。
- 不顺手处理审查 suggestions 中其余非阻塞项，除非它们是本次改动的直接依赖。

## 不变量

- `state.json` 仍是唯一 authoritative recovery source。
- 评审/执行/final verification 的外部协议仍以 `scripts/orchestrator/schemas/*.json` 为合同来源。
- Phase handler 拆分只做结构重构和必要 bugfix，不改变 Phase 0-4 的职责边界。
- 验证必须给出确定性的 PASS/FAIL 命令，不使用“看起来正常”式结论。
