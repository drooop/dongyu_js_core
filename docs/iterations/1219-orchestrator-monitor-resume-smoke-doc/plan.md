---
title: "orchestrator-monitor-resume-smoke-doc"
iteration: 1219-orchestrator-monitor-resume-smoke-doc
doc_type: iteration-plan
status: planned
created: 2026-03-20
updated: 2026-03-21
source: ai
iteration_id: 1219-orchestrator-monitor-resume-smoke-doc
id: 1219-orchestrator-monitor-resume-smoke-doc
phase: phase1
---

# orchestrator-monitor-resume-smoke-doc

## WHAT

本 iteration 只交付文档，不修改任何代码文件。

目标是在 `docs/user-guide/` 下新增 `orchestrator_local_smoke.md`，作为面向本地操作者的自包含用户指南，覆盖当前仓库中已实现的 orchestrator monitor/resume 使用路径。该文档必须明确以下内容：

- orchestrator 的定位、适用场景与前置条件，前提是 batch 已经存在。
- `--monitor` 子命令用法：启动方式、`--batch-id` 参数、`status.txt` 看板字段解读、`events.jsonl` tail 输出说明、`Ctrl+C` 退出方式。
- `--resume` 子命令用法：启动方式、`--batch-id` 参数、孤立事件检测与恢复流程、`state.json` 与 `docs/ITERATIONS.md` 一致性检查、`On Hold` iteration 经过人工裁决后的恢复步骤。
- 常见场景示例：crash 后恢复、`On Hold` 解除后继续、在另一终端监控正在运行的 batch。
- 三层监控体系的关系说明：stderr 实时流、`status.txt` 看板、`events.jsonl` 审计日志。

该用户指南必须引用 `docs/ssot/orchestrator_hard_rules.md` 的 §2.4（crash idempotency）与 §15（monitoring）作为规约来源，只解释对操作者可执行的后果与操作步骤，不重复整段规约正文。

## WHY

当前仓库已经具备 orchestrator 的 `--monitor` 与 `--resume` 能力，相关行为也已在 SSOT 和实现中落地，但用户文档层缺少一份专门面向本地操作者的 smoke/runbook。没有这份文档时，使用者需要同时阅读 `docs/ssot/orchestrator_hard_rules.md` 与 `scripts/orchestrator/*.mjs` 才能拼出恢复路径，学习成本高，也容易误把衍生产物当成恢复依据。

本 iteration 的价值是把“如何监控一个已存在 batch、如何在 crash 或 `On Hold` 后安全恢复、三层监控各看什么”沉淀成单一入口，并保持与现有实现一致。

## 影响范围

写入目标：

- `docs/user-guide/orchestrator_local_smoke.md`

只读依据：

- `docs/ssot/orchestrator_hard_rules.md`
- `scripts/orchestrator/orchestrator.mjs`
- `scripts/orchestrator/monitor.mjs`
- `scripts/orchestrator/events.mjs`
- `scripts/orchestrator/state.mjs`
- `scripts/orchestrator/scheduler.mjs`
- `scripts/orchestrator/test_orchestrator.mjs`

明确不在本 iteration 范围内：

- orchestrator 代码、测试、schema 或 CLI 行为修改。
- `docs/ssot/orchestrator_hard_rules.md` 规约改写。
- 额外新增运行脚本、截图、测试数据或临时文件。
- `docs/user-guide/README.md` 更新或其他导航整理；本 iteration 只聚焦新增目标文档本身。

## 事实基础

基于当前代码库可确认的实现事实如下，这些事实决定了文档内容边界：

- `scripts/orchestrator/orchestrator.mjs` 已实现 `--monitor [--batch-id <id>]` 与 `--resume [--batch-id <id>]`，未提供 `--batch-id` 时都会回落到最近一个 batch。
- `scripts/orchestrator/monitor.mjs` 已实现三层监控中的 `status.txt` 刷新与终端 monitor 渲染，显示 `Batch`、`Total`、`Done/Active/Pending/On Hold`、`Current`、`Phase`、`Elapsed`、`Recent`、`Final Verification`、`State Revision` 等字段。
- `scripts/orchestrator/events.mjs` 说明 `events.jsonl` 为 append-only 日志，并支持检测 `state_revision` 超前于 `state.json` 的孤立事件。
- `scripts/orchestrator/orchestrator.mjs` 的恢复路径为：检测孤立事件，补齐派生文档，再做 `state.json ↔ docs/ITERATIONS.md` 一致性检查；若仍不一致则阻断并要求人工处理后重新 `--resume`。
- `docs/ssot/orchestrator_hard_rules.md` 明确 `state.json` 是唯一恢复源，`status.txt` 与 `events.jsonl` 是衍生产物；`On Hold` 恢复前需要人工裁决，且禁止自动 checkout/stash/reset。

## 成功标准

- `docs/user-guide/orchestrator_local_smoke.md` 能被不了解上下文的读者单独阅读并执行基础 monitor/resume 操作。
- 文档中的命令行示例、参数名、文件路径、恢复顺序与当前实现保持一致。
- 文档覆盖需求指定的五个内容块，不遗漏 `On Hold` 人工裁决边界和三层监控关系。
- 文档明确区分“权威状态”与“衍生产物”，不把 `status.txt` 或 `events.jsonl` 描述成恢复真源。
- 本 iteration 的执行阶段仍然只允许新增或编辑用户文档，不引入任何代码文件变更。

## 约束与不变量

- 遵循 `CLAUDE.md` 的 HARD_RULES、CAPABILITY_TIERS、WORKFLOW；Phase 1 只写计划文档。
- 本 plan 只定义 WHAT/WHY，不写执行步骤、不记录执行结果。
- 未来执行时必须保持“文档解释实现，不发明新行为”的原则。
- 未来执行时必须把规约引用写到用户文档里，但不复制 SSOT 的大段规则文本。
