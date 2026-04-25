---
title: "Resolution: orchestrator-monitor-resume-smoke-doc"
iteration: 1219-orchestrator-monitor-resume-smoke-doc
doc_type: iteration-resolution
status: planned
created: 2026-03-20
updated: 2026-04-21
source: ai
iteration_id: 1219-orchestrator-monitor-resume-smoke-doc
id: 1219-orchestrator-monitor-resume-smoke-doc
phase: phase1
---

# Resolution: orchestrator-monitor-resume-smoke-doc

## 目标

在后续 Phase 3 执行时，仅新增 `docs/user-guide/orchestrator_local_smoke.md`，把本地 orchestrator 的 monitor/resume/smoke 操作路径整理为用户指南；不修改任何代码文件。

## 文件清单

计划写入：

- `docs/user-guide/orchestrator_local_smoke.md`

执行时必须作为只读依据审计的文件：

- `docs/ssot/orchestrator_hard_rules.md`
- `scripts/orchestrator/orchestrator.mjs`
- `scripts/orchestrator/monitor.mjs`
- `scripts/orchestrator/events.mjs`
- `scripts/orchestrator/state.mjs`
- `scripts/orchestrator/scheduler.mjs`
- `scripts/orchestrator/test_orchestrator.mjs`

明确不修改：

- `scripts/orchestrator/**`
- `docs/ssot/orchestrator_hard_rules.md`
- `docs/user-guide/README.md`
- 任何 `packages/**`、`scripts/tests/**`、`docs/ITERATIONS.md`

## 执行前提

- 已处于 `dropx/dev_1219-orchestrator-monitor-resume-smoke-doc` 分支或用户指定的等效工作分支。
- 仓库根目录为 `/Users/drop/codebase/cowork/dongyuapp_elysia_based`。
- orchestrator 现有实现仍保留 `--monitor`、`--resume`、`.orchestrator/runs/<batch_id>/state.json`、`status.txt`、`events.jsonl` 这些接口与产物；若实现已变化，必须先回到 Phase 1 更新本 resolution。

## Step 1 — 建立文档骨架与规约锚点

目标：创建 `docs/user-guide/orchestrator_local_smoke.md` 的标题、读者范围、前置条件和规约来源说明，先锁定“batch 已存在”“`state.json` 是唯一恢复源”“引用 §2.4 与 §15 但不重复规约正文”这三个边界。

执行方式：

- 在文档开头说明该文档面向本地操作者，适用于已存在 batch 的 monitor/resume/smoke 操作。
- 写明规约来源为 `docs/ssot/orchestrator_hard_rules.md` 的 §2.4 与 §15。
- 写明 `--batch-id` 可选；未提供时默认落到最近一个 batch，这是当前实现事实，不是新增约定。

涉及文件：

- `docs/user-guide/orchestrator_local_smoke.md`

验证命令：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "前置条件|batch|state\\.json|§2\\.4|§15|--batch-id" docs/user-guide/orchestrator_local_smoke.md
```

Step 回滚：

- 删除或还原 `docs/user-guide/orchestrator_local_smoke.md`，回到未创建状态。

## Step 2 — 写完 monitor 用法与三层监控说明

目标：补齐 `--monitor` 子命令的操作说明，并把三层监控体系之间的关系讲清楚，覆盖 status 看板字段与事件 tail 输出，不引入任何新行为。

执行方式：

- 写入 `bun scripts/orchestrator/orchestrator.mjs --monitor [--batch-id <id>]` 的启动示例。
- 解释 monitor 渲染的 `status.txt` 字段，包括 `Batch`、`Total`、`Done/Active/Pending/On Hold`、`Current`、`Phase`、`Elapsed`、`Recent`、`Final Verification`、`State Revision`。
- 解释 monitor 视图中的 `-- Latest Events --` 只是在终端 tail 最近事件，不是恢复真源。
- 写明 `Ctrl+C` 只负责退出 monitor 观察，不会修改 batch 状态。
- 用用户视角解释三层监控关系：stderr 看实时推进，`status.txt` 看汇总看板，`events.jsonl` 看完整审计轨迹。

涉及文件：

- `docs/user-guide/orchestrator_local_smoke.md`

验证命令：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "--monitor|status\\.txt|events\\.jsonl|Ctrl\\+C|stderr|Batch|Total|Done/Active/Pending/On Hold|Current|Phase|Elapsed|Recent|Final Verification|State Revision" docs/user-guide/orchestrator_local_smoke.md
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "--monitor|runMonitor|refreshStatus|Latest Events|status\\.txt|events\\.jsonl" scripts/orchestrator/orchestrator.mjs scripts/orchestrator/monitor.mjs
```

Step 回滚：

- 还原 `docs/user-guide/orchestrator_local_smoke.md` 中与 monitor/三层监控相关的新增段落。

## Step 3 — 写完 resume 用法、恢复流程与常见场景

目标：补齐 `--resume` 操作路径，明确 crash、孤立事件、派生文档补齐、一致性检查、`On Hold` 人工裁决与恢复步骤，并加入用户可直接套用的常见场景示例。

执行方式：

- 写入 `bun scripts/orchestrator/orchestrator.mjs --resume [--batch-id <id>]` 的启动示例。
- 解释恢复顺序：先检测并标记孤立事件，再补齐缺失的派生文档，再执行 `state.json` 与 `docs/ITERATIONS.md` 一致性检查，最后才回到主循环。
- 写明阻断条件：如果一致性检查仍失败，或 iteration 仍处于 `On Hold` / `blocked_by_spawn` 且需要人工决策，则本次 `--resume` 会停止并提示用户处理后再次运行。
- 写明 `On Hold` 恢复前必须有人类先处理分支/worktree/索引状态，orchestrator 不会自动 checkout、stash 或 reset。
- 加入三个常见场景：crash 后恢复、`On Hold` 解除后继续、在另一终端监控正在运行的 batch。

涉及文件：

- `docs/user-guide/orchestrator_local_smoke.md`

验证命令：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "--resume|孤立事件|state\\.json|ITERATIONS\\.md|On Hold|blocked_by_spawn|crash|另一终端|恢复" docs/user-guide/orchestrator_local_smoke.md
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "detectOrphanedEvents|markOrphaned|checkStateIterationsConsistency|Human decision required|Resolve On Hold iterations|Branch guard failed|--resume" scripts/orchestrator/orchestrator.mjs scripts/orchestrator/events.mjs scripts/orchestrator/state.mjs
```

Step 回滚：

- 还原 `docs/user-guide/orchestrator_local_smoke.md` 中与 resume/恢复场景相关的新增段落。

## Step 4 — 合规复核与只改文档收口

目标：在提交前确认用户指南与 SSOT/实现一致，且本 iteration 没有扩散到代码或其他文档。

执行方式：

- 通读 `docs/user-guide/orchestrator_local_smoke.md`，确认其描述的是当前实现，不是提案式内容。
- 检查文档是否明确把 `docs/ssot/orchestrator_hard_rules.md` §2.4 与 §15 作为规约来源，而没有复制整段规范正文。
- 运行现有 orchestrator state machine 测试，作为 monitor/recovery 相关行为仍然存在的基线证据。
- 检查变更范围，确保执行阶段只新增/编辑目标用户文档。

涉及文件：

- `docs/user-guide/orchestrator_local_smoke.md`

验证命令：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "orchestrator_hard_rules|§2\\.4|§15" docs/user-guide/orchestrator_local_smoke.md
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --name-only -- docs/user-guide/orchestrator_local_smoke.md
```

Step 回滚：

- 删除 `docs/user-guide/orchestrator_local_smoke.md`，或将其恢复到执行前版本；不对任何代码文件执行回滚，因为本 iteration 不允许改代码。

## 总体验收

完成条件：

- 新用户指南存在且自包含。
- 文档内容完整覆盖需求列出的五个主题。
- monitor/resume 命令、参数、恢复顺序、三层监控说明均可在当前代码与 SSOT 中找到对应依据。
- 执行差异只包含目标用户文档。

## 总体回滚方案

若 Phase 3 执行后需要撤回本 iteration，执行以下回滚即可：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rm -f docs/user-guide/orchestrator_local_smoke.md
```

如果目标文件已存在旧版本而本 iteration 只是改写，则改用：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git restore --source=HEAD -- docs/user-guide/orchestrator_local_smoke.md
```
