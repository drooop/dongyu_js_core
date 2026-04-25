---
title: "orchestrator-smoke-doc-content-fill"
iteration: 1221-orchestrator-smoke-doc-content-fill
doc_type: iteration-plan
status: planned
created: 2026-03-21
updated: 2026-04-21
source: ai
iteration_id: 1221-orchestrator-smoke-doc-content-fill
id: 1221-orchestrator-smoke-doc-content-fill
phase: phase1
---

# orchestrator-smoke-doc-content-fill

## WHAT

本 iteration 是 docs-only 收口，不修改任何 `scripts/orchestrator/**` 代码、schema 或测试。
执行阶段的目标是基于当前源码和 SSOT，补完现有 `docs/user-guide/orchestrator_local_smoke.md` 中已经承诺但仍为空的 4 个章节，并同步清理 superseded 的 iteration 状态。

需要在执行阶段完成的文档工作只有两类：

- 补齐 `docs/user-guide/orchestrator_local_smoke.md` 的 4 个空章节：
  - `--monitor` 的终端观察方式与三层监控口径：`stderr` stream / `status.txt` dashboard / `events.jsonl` audit，并引用 `docs/ssot/orchestrator_hard_rules.md` §15，写入实际命令示例。
  - `--resume` 的恢复顺序、crash recovery 边界、`state.json.tmp` / orphaned events / branch guard、人类介入点（`On Hold`、`major_revision_count > 3`），并引用 §2.4 与当前实现。
  - 3 个常见本地 smoke 场景：新 batch → monitor → 手动中断 → resume → 完成；`On Hold` 人工恢复；orphaned event 诊断。
  - `scripts/orchestrator/` 的 9 个运行模块索引表，列出文件名、职责、行数。
- 更新 `docs/ITERATIONS.md`，把 `1219-orchestrator-monitor-resume-smoke-doc` 与 `1220-orchestrator-monitor-resume-smoke-doc` 的 Status 标记为 `Cancelled`，明确被 `1221-orchestrator-smoke-doc-content-fill` 取代。

为保证全文自洽，执行时允许同步修正 `docs/user-guide/orchestrator_local_smoke.md` 开头的适用范围与结构说明，使其与新增章节一致；但这种修正仍属于同一份用户文档的范围内收口，不扩展到其他指南文件。

## WHY

当前 `docs/user-guide/orchestrator_local_smoke.md` 只有前言、恢复真源说明、`--batch-id` 说明和一个“四块内容将展开”的目录，真正面向操作者的 monitor / resume / scenario / module index 内容尚未写出，无法作为独立 smoke runbook 使用。

与此同时，相关行为已经在当前仓库中落地：

- `scripts/orchestrator/orchestrator.mjs` 已提供 `--prompt`、`--prompt-file`、`--resume`、`--monitor`、`--batch-id`、`--auto-confirm`。
- `scripts/orchestrator/monitor.mjs` 已实现 `status.txt` 看板刷新与 `--monitor` 终端轮询。
- `scripts/orchestrator/events.mjs` 与 `scripts/orchestrator/state.mjs` 已实现 orphaned event 检测、`state.json.tmp` 恢复与 authoritative state 规则。
- `docs/ssot/orchestrator_hard_rules.md` 已冻结三层监控、crash idempotency、On Hold、branch/worktree guard 等硬约束。

如果不把这些事实沉淀成单一入口，操作者仍需在用户指南、SSOT 和多个 `scripts/orchestrator/*.mjs` 之间来回拼接信息，既容易误把 `status.txt` / `events.jsonl` 当恢复真源，也无法快速判断何时必须人工介入。

另外，`1219` 与 `1220` 目前仍保留为 `Planned` / `On Hold`，但本次需求已经明确由 `1221` 接管文档内容补全；若不同步标记 superseded 状态，后续读者难以判断哪个 iteration 才是当前权威文档工作包。

## 影响范围

执行阶段计划写入的文件：

- `docs/user-guide/orchestrator_local_smoke.md`
- `docs/ITERATIONS.md`

本计划建立时读取并约束文案边界的依据：

- `CLAUDE.md`
- `docs/WORKFLOW.md`
- `docs/ITERATIONS.md`
- `docs/ssot/orchestrator_hard_rules.md`
- `docs/user-guide/orchestrator_local_smoke.md`
- `scripts/orchestrator/drivers.mjs`
- `scripts/orchestrator/events.mjs`
- `scripts/orchestrator/iteration_register.mjs`
- `scripts/orchestrator/monitor.mjs`
- `scripts/orchestrator/notify.mjs`
- `scripts/orchestrator/orchestrator.mjs`
- `scripts/orchestrator/prompts.mjs`
- `scripts/orchestrator/scheduler.mjs`
- `scripts/orchestrator/state.mjs`
- `scripts/orchestrator/test_orchestrator.mjs`

明确不在本 iteration 范围内：

- 修改任何 `scripts/orchestrator/**` 代码、schema、测试或 CLI 行为。
- 改写 `docs/ssot/orchestrator_hard_rules.md`、`CLAUDE.md`、`docs/WORKFLOW.md`。
- 新增脚本、截图、测试数据、临时文件、额外用户指南或导航页。
- 修改 `1219` / `1220` / `1221` 的既有 `plan.md`、`resolution.md`、`runlog.md` 之外的历史记录正文。

## 事实基础

本计划依赖的当前实现事实如下：

- `docs/user-guide/orchestrator_local_smoke.md` 当前在“文档结构”后停止，4 个目标章节只有目录，没有正文。
- `scripts/orchestrator/monitor.mjs` 的 `runMonitor()` 会轮询 `.orchestrator/runs/<batch_id>/status.txt`，并 tail 最近 5 条事件，启动提示为 `Monitoring batch ... (Ctrl+C to stop)`。
- `scripts/orchestrator/monitor.mjs` 的 `refreshStatus()` 当前会写出 `Batch`、`Total`、`Done / Active / Pending / On Hold`、`Current`、`Phase`、`Elapsed`、`Recent`、`Final Verification`、`State Revision` 等字段。
- `scripts/orchestrator/orchestrator.mjs` 的 `--resume` 路径当前顺序是：`loadState()` 处理 `state.json.tmp` → `detectOrphanedEvents()` / `markOrphaned()` → `reconcileDerivedDocs()` → `checkStateIterationsConsistency()` → `runMainLoop()`。
- `scripts/orchestrator/state.mjs` 的 `checkBranchGuard()` 会检查 `expected_branch`、`git status --porcelain` 和排除项，失败后由主循环转 `On Hold`。
- `scripts/orchestrator/orchestrator.mjs` 在 `REVIEW_PLAN` 与 `REVIEW_EXEC` 两个阶段都使用 `major_revision_count`，达到 3 次就进入 `On Hold`。
- `scripts/orchestrator/` 当前共有 9 个运行模块与 1 个测试文件；本需求中的“9 模块索引表”应理解为排除 `test_orchestrator.mjs` 与 `schemas/` 目录后的运行模块集合。

## 执行假设与治理边界

- A1：虽然 `CLAUDE.md`、`docs/WORKFLOW.md`、`docs/ITERATIONS.md` 当前公开的 Status 枚举未列出 `Cancelled`，但本次用户需求已显式要求把 `1219/1220` 标成 `Cancelled`。本计划据此把 `Cancelled` 视为本 iteration 的执行假设，并要求在 Phase 2 审核时显式检查该假设是否被接受。
- A2：虽然当前用户指南前言写着“只适用于 batch 已存在”，但本次需求要求加入“新 batch → monitor → 手动中断 → resume → 完成”的 smoke 场景。执行阶段允许同步修正文档前言，使场景章节与文档定位一致，但不得扩展成完整的 orchestrator 教程。
- 若 A1 或 A2 在 Phase 2 被判定为不成立，必须回到 Phase 1 调整计划，不能在 Phase 3 靠临时判断绕过。

## 成功标准

- `docs/user-guide/orchestrator_local_smoke.md` 被补齐为一份可单独阅读的本地 smoke runbook，而不是只有目录的半成品。
- `--monitor` 章节明确三层监控口径、终端观察方式、`status.txt` 看板字段、`events.jsonl` 审计用途和 `Ctrl+C` 行为，且命令与当前实现一致。
- `--resume` 章节明确恢复顺序、`state.json.tmp` / orphaned events / branch guard / `On Hold` / `major_revision_count > 3` 的边界，并清楚标出人工干预点。
- 场景章节覆盖需求指定的 3 个本地 smoke 场景，且命令示例是当前 CLI 能直接表达的格式。
- 模块索引章节覆盖 9 个运行模块，表格包含文件名、职责、行数，并与当前源码相符。
- `docs/ITERATIONS.md` 中 `1219` 与 `1220` 的状态按 A1 被改为 `Cancelled`，明确被 `1221` 取代。
- 整个执行阶段只允许文档改动，不引入任何代码文件变更。

## 约束与不变量

- 遵循 `CLAUDE.md` 的 HARD_RULES、WORKFLOW 与 docs-only Phase 1 / Phase 3 边界。
- 本 plan 只定义 WHAT / WHY / 边界 / 成功标准，不记录步骤、不记录执行结果。
- 后续执行必须坚持“文档解释现状，不发明新行为”的原则；任何与现状不符的内容都应回到 Phase 1 修订计划，而不是直接落到用户文档里。
