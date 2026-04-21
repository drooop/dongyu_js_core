---
title: "doit-auto orchestrator v1"
iteration: 0202-doit-auto-orchestrator
doc_type: iteration-plan
status: planned
created: 2026-03-21
source: ai
updated: 2026-04-21
iteration_id: 0202-doit-auto-orchestrator
id: 0202-doit-auto-orchestrator
phase: phase1
---

# doit-auto orchestrator v1

## WHAT

实现 orchestrator 编排器：接收自然语言需求，自动分解为 iteration 列表，
通过 Codex CLI (doit) 和 Claude Code CLI (ultrawork) 串行执行完整 Phase 0-4 工作流，
含动态 spawn、需求追踪矩阵、Final Verification Gate。

## WHY

当前工作流需要人工在 Claude Code 和 Codex 之间反复拷贝上下文，导致效率瓶颈和流程中断。
orchestrator 将 doit-auto 角色自动化，消除人工信使环节。

## 规约

行为约束详见 `docs/ssot/orchestrator_hard_rules.md`（status: active）。
本 plan 不重复规约内容，实现必须严格遵守该文件。

## 成功标准

1. `bun scripts/orchestrator/orchestrator.mjs --prompt "..." ` 可端到端运行。
2. decompose → confirm → Phase 0-4 串行执行 → Final Verification 全链路通过。
3. 状态持久化 + 断点恢复：kill 后重启可从 state.json 恢复。
4. 三层监控可用（stderr 实时流、status.txt 看板、events.jsonl 日志）。
5. Auto-Approval Policy 3 次独立 APPROVED 逻辑正确。
6. major revision 3 次上限 + On Hold 逻辑正确。
7. spawn（derived_dependency / scope_expansion）分类和处理逻辑正确。
8. branch/worktree guard 检查正确。

## 范围

见 `docs/ssot/orchestrator_hard_rules.md` §16 实施范围。

## 不变量

- orchestrator = doit-auto 角色，不评审、不实现。
- state.json = 唯一恢复源。
- 单 active iteration，串行执行。
- 通知 best-effort，不影响状态推进。
