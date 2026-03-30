---
title: "Iteration 0192-conformance-failfast-rules Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0192-conformance-failfast-rules
id: 0192-conformance-failfast-rules
phase: phase1
---

# Iteration 0192-conformance-failfast-rules Resolution

## Execution Strategy

- 只改最高优先级规约 `CLAUDE.md`，不改运行时代码。
- 通过最小文本补丁，把“流程 fail fast”和“运行时 fallback 禁令”分别放到 `HARD_RULES` 与 `FORBIDDEN`。

## Step 1

- Scope:
  - 审计 `CLAUDE.md` 当前与该提议直接相关的条款位置
  - 冻结新增条文的正式候选措辞
- Files:
  - `CLAUDE.md`
  - `docs/iterations/0192-conformance-failfast-rules/plan.md`
  - `docs/iterations/0192-conformance-failfast-rules/resolution.md`
- Verification:
  - `rg -n "HARD_RULES|FORBIDDEN|silent failure|tier placement|data flow|data chain" CLAUDE.md`
- Acceptance:
  - 已确定新条文插入位置
  - 已确定 2 条最终文案
- Rollback:
  - 回退文档改动

### Step 1 Design Output

#### A. `HARD_RULES` 新增条文

建议插在：

- `every implementation and verification MUST explicitly check: ...`
  之后

候选文案：

- `fail fast on non-conformance: if an implementation bypasses a required spec path`
  ` (tier boundary, model placement, data flow, connection layer) and still "works",`
  ` it is NOT acceptable. stop immediately and report the violation.`
  ` a working but non-conformant implementation has zero delivery value.`

意图：

- 约束流程/决策层
- 禁止“先绕规约跑通，后续再补”

#### B. `FORBIDDEN` 新增条文

建议插在：

- `silent failure (all failures must write to ModelTable)`
  之后

候选文案：

- `graceful degradation that bypasses a required spec path`
  ` (for example falling back to legacy code when the conformant path should be used,`
  ` or swallowing a tier-boundary violation to keep the UI functional).`
  ` if the conformant path fails, the failure must be visible, not hidden behind a fallback.`

意图：

- 约束代码/运行时层
- 禁止 `catch { fallbackToLegacy() }` 掩盖规约路径失败

#### C. 迁移期例外边界

本轮明确：

- 合法的迁移切换点，必须在 iteration 合同中被显式声明
- 未被合同声明的 fallback，不得以“graceful degradation”名义保留

## Step 2

- Scope:
  - 将条文落到 `CLAUDE.md`
  - 做最小文本验证与收口
- Files:
  - `CLAUDE.md`
  - `docs/iterations/0192-conformance-failfast-rules/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `rg -n "fail fast on non-conformance|graceful degradation that bypasses" CLAUDE.md`
  - 人工检查：
    - 两条文案分别位于 `HARD_RULES` / `FORBIDDEN`
    - 与现有 `silent failure` / conformance 检查条款不冲突
- Acceptance:
  - `CLAUDE.md` 已包含两条正式条文
  - `runlog.md` 与 `ITERATIONS.md` 已记录
- Rollback:
  - 回退 `CLAUDE.md`
  - 回退本轮迭代台账
