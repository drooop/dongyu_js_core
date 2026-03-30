---
title: "Resolution: orchestrator execution remediation"
iteration: 1220-orchestrator-monitor-resume-smoke-doc
doc_type: iteration-resolution
status: planned
created: 2026-03-20
updated: 2026-03-21
source: ai
iteration_id: 1220-orchestrator-monitor-resume-smoke-doc
id: 1220-orchestrator-monitor-resume-smoke-doc
phase: phase1
---

# Resolution: orchestrator execution remediation

## 执行目标

修复 Claude Code 审查指出的两个 blocking issues：

1. 在 `scripts/orchestrator/drivers.mjs` 中把 review / exec / final verification JSON 解析升级为“提取 + schema 校验”。
2. 在 `scripts/orchestrator/orchestrator.mjs` 中拆分 `runIteration()`，把 phase 逻辑下沉为独立 handler，同时保持当前状态机约束与行为。

并补齐最小必要测试与执行证据：

- `scripts/orchestrator/test_orchestrator.mjs`
- `docs/iterations/1220-orchestrator-monitor-resume-smoke-doc/runlog.md`

## 文件清单

计划修改：

- `scripts/orchestrator/drivers.mjs`
- `scripts/orchestrator/orchestrator.mjs`
- `scripts/orchestrator/test_orchestrator.mjs`
- `docs/iterations/1220-orchestrator-monitor-resume-smoke-doc/runlog.md`

只读依据：

- `CLAUDE.md`
- `docs/WORKFLOW.md`
- `docs/ITERATIONS.md`
- `docs/ssot/orchestrator_hard_rules.md`
- `scripts/orchestrator/schemas/review_verdict.json`
- `scripts/orchestrator/schemas/exec_output.json`
- `scripts/orchestrator/schemas/final_verdict.json`
- `scripts/orchestrator/state.mjs`
- `scripts/orchestrator/events.mjs`
- `scripts/orchestrator/scheduler.mjs`
- `scripts/orchestrator/prompts.mjs`

## Step 1 — 先补 parser 失败用例

目标：在实现前先把 schema 校验缺口具象化为 failing tests，锁定 review / exec / final verification 三类输出的最小合法结构。

执行方式：

- 在 `scripts/orchestrator/test_orchestrator.mjs` 中扩展 parser 测试。
- 增加 review verdict 非法输入用例：例如缺少 `blocking_issues`、`summary` 或子项字段类型错误时必须判定失败。
- 增加 exec output 非法输入用例：例如 `steps_completed[].step` 不是整数、`status` 不在枚举内时必须判定失败。
- 增加 final verdict 非法输入用例：例如 `goal_results[]` 缺少 `evidence` 或 `status` 非法时必须判定失败。
- 保留现有 prose fallback 成功用例，确保 schema 校验不会把合法 fallback 一起打坏。

验证命令：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

预期：

- 在 parser 尚未实现 schema 校验前，新增断言至少有一部分失败。
- 失败原因聚焦在 parser 放过了 schema 不合法输出，而不是测试自身语法错误。

回滚：

- 恢复 `scripts/orchestrator/test_orchestrator.mjs` 到执行前版本。

## Step 2 — 在 drivers.mjs 落地 schema 校验

目标：把三个 parse 函数统一升级为“尝试提取 JSON -> 校验 schema -> 成功返回结构化对象，否则继续尝试或失败返回”。

执行方式：

- 读取 `scripts/orchestrator/schemas/*.json` 作为合同来源，不新造第二套字段清单。
- 在 `drivers.mjs` 中实现最小可维护的 schema 校验 helper，覆盖当前 schema 使用到的 `type`、`required`、`properties`、`items`、`enum`。
- `parseVerdict()`：
  - 对命中的 JSON 片段先校验 review verdict schema。
  - prose fallback 仅在构造出的对象也通过 schema 时才返回成功。
- `parseExecOutput()`：
  - 命中的 JSON 片段不合法时返回失败，不把坏结构继续交给后续代码。
  - 保留“无 JSON 时退化成原始 summary”逻辑，但 fallback 生成的对象也必须满足 exec schema。
- `parseFinalVerdict()`：
  - 只接受满足 final verdict schema 的对象。

验证命令：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "review_verdict|exec_output|final_verdict|validate" scripts/orchestrator/drivers.mjs
```

回滚：

- 恢复 `scripts/orchestrator/drivers.mjs` 到执行前版本。

## Step 3 — 拆分 runIteration phase handler

目标：把 `runIteration()` 从超长 switch-case 收敛为主循环 + phase handler 组合，降低单函数复杂度，并顺手修复拆分过程中直接暴露的完成态处理缺口。

执行方式：

- 将 phase 逻辑拆成独立函数，至少覆盖：
  - `handleIntakePhase`
  - `handlePlanningPhase`
  - `handleReviewPlanPhase`
  - `handleExecutionPhase`
  - `handleReviewExecPhase`
  - `handleCompletePhase`
- `runIteration()` 只保留：
  - 取 iteration
  - 根据当前 phase 分发到 handler
  - 统一处理 `refreshStatus()` 与 stop/continue 信号
- 保持现有写入顺序约束：event -> state commit -> derived docs / notify。
- 若拆分时发现当前完成态无法被执行，允许在同一路径内修复，但不得扩展到无关架构改造。

验证命令：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "async function runIteration|handleIntakePhase|handlePlanningPhase|handleReviewPlanPhase|handleExecutionPhase|handleReviewExecPhase|handleCompletePhase" scripts/orchestrator/orchestrator.mjs
```

回滚：

- 恢复 `scripts/orchestrator/orchestrator.mjs` 到执行前版本。

## Step 4 — 回归验证与证据落盘

目标：在提交前完成 deterministic 回归，并把真实命令与结果写入 runlog。

执行方式：

- 运行 orchestrator 测试。
- 视结果补跑必要的 targeted 命令或 diff 检查，确认改动只落在预期文件。
- 在 `runlog.md` 记录：
  - 本次 review finding 输入
  - 关键修改点
  - 实际执行命令
  - PASS/FAIL
  - commit hash
  - conformance 评估（本路径为 orchestrator 开发工具代码，tier/model/data 项记 `n/a`）

验证命令：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --name-only -- scripts/orchestrator docs/iterations/1220-orchestrator-monitor-resume-smoke-doc
```

回滚：

- 对本次提交使用 `git revert <commit>`。

## 总体验收

- parser 对 schema 不合法的 JSON 不再放行。
- state machine 代码结构完成 phase handler 拆分。
- orchestrator 相关验证命令通过。
- `runlog.md` 记录本次修复证据并包含最终提交信息。
