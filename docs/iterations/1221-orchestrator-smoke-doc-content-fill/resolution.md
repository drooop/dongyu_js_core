---
title: "Resolution: orchestrator-smoke-doc-content-fill"
iteration: 1221-orchestrator-smoke-doc-content-fill
doc_type: iteration-resolution
status: planned
created: 2026-03-21
updated: 2026-03-21
source: ai
iteration_id: 1221-orchestrator-smoke-doc-content-fill
id: 1221-orchestrator-smoke-doc-content-fill
phase: phase1
---

# Resolution: orchestrator-smoke-doc-content-fill

## 目标

在后续 Phase 3 执行时，只做文档收口，不修改任何 orchestrator 代码：

- 补齐 `docs/user-guide/orchestrator_local_smoke.md` 的 4 个空章节。
- 视需要同步修正文档前言与结构说明，使其与新增的“新 batch smoke 场景”一致。
- 把 `docs/ITERATIONS.md` 中 `1219` 与 `1220` 的 Status 改为 `Cancelled`，标识为被 `1221` 取代。

## 文件清单

计划写入：

- `docs/user-guide/orchestrator_local_smoke.md`
- `docs/ITERATIONS.md`

执行时必须作为只读依据审计的文件：

- `CLAUDE.md`
- `docs/WORKFLOW.md`
- `docs/ITERATIONS.md`
- `docs/ssot/orchestrator_hard_rules.md`
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

明确不修改：

- `scripts/orchestrator/**`
- `docs/ssot/orchestrator_hard_rules.md`
- `CLAUDE.md`
- `docs/WORKFLOW.md`
- 任何 `packages/**`、`deploy/**`、`k8s/**`

## 执行前提

- 工作目录固定为 `/Users/drop/codebase/cowork/dongyuapp_elysia_based`。
- 执行分支应为 `dropx/dev_1221-orchestrator-smoke-doc-content-fill`，或用户明确批准的等效工作分支。
- 当前实现仍保留 `--prompt`、`--prompt-file`、`--resume`、`--monitor`、`--batch-id`、`--auto-confirm`，且 `docs/user-guide/orchestrator_local_smoke.md` 仍是“有前言、无 4 个正文章节”的状态；若源码或目标文档已显著变化，必须先回到 Phase 1 更新本 resolution。
- 模块索引表中的“9 模块”定义为：`scripts/orchestrator/` 顶层 9 个运行模块，排除 `test_orchestrator.mjs` 与 `schemas/` 目录。
- 执行假设 A1：允许把 `1219` / `1220` 的 Status 写成 `Cancelled`，即便当前治理文档的枚举未显式列出该值；若 Gate 审核拒绝此假设，则不得在 Phase 3 擅自改写状态值。
- 执行假设 A2：允许为满足“新 batch → monitor → 手动中断 → resume → 完成”场景而修正文档前言，但文档仍然只做本地 smoke/runbook，不扩展成全量 orchestrator 使用手册。

## Step 1 — 对齐前言并补齐 `--monitor` 章节

目标：先解决当前用户指南的范围冲突，再把 `--monitor` 与三层监控写成操作者可直接套用的章节。

执行方式：

- 调整 `docs/user-guide/orchestrator_local_smoke.md` 的“适用范围”与“文档结构”段落，使其既保留“本地 smoke/runbook”定位，又允许加入一个最小的新 batch 场景。
- 新增 `--monitor` 章节，写入当前 CLI 的实际命令示例：
  - `bun scripts/orchestrator/orchestrator.mjs --monitor`
  - `bun scripts/orchestrator/orchestrator.mjs --monitor --batch-id <id>`
- 依据 `docs/ssot/orchestrator_hard_rules.md` §15 与当前实现，说明三层监控分工：
  - `stderr`：实时 CLI 进度流。
  - `.orchestrator/runs/<batch_id>/status.txt`：状态看板。
  - `.orchestrator/runs/<batch_id>/events.jsonl`：事件审计日志。
- 解释 `runMonitor()` 当前的终端行为：轮询 `status.txt`、显示 `-- Latest Events --`、`Ctrl+C` 只退出观察不改 batch 状态。
- 解释 `refreshStatus()` 当前输出的关键字段，不把任何看板字段写成恢复真源。

涉及文件：

- `docs/user-guide/orchestrator_local_smoke.md`

验证命令：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "新 batch|--monitor|stderr|status\\.txt|events\\.jsonl|Ctrl\\+C|Batch:|Done:|Phase:|State Revision" docs/user-guide/orchestrator_local_smoke.md
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "--monitor|runMonitor|refreshStatus|Latest Events|Ctrl\\+C|stderr|status\\.txt|events\\.jsonl" scripts/orchestrator/orchestrator.mjs scripts/orchestrator/monitor.mjs scripts/orchestrator/events.mjs docs/ssot/orchestrator_hard_rules.md
```

Step 回滚：

- 还原 `docs/user-guide/orchestrator_local_smoke.md` 中与“适用范围”“文档结构”“--monitor”相关的新增内容，回到执行前版本。

## Step 2 — 补齐 `--resume` 章节与 crash recovery / 人工干预边界

目标：把恢复顺序、crash idempotency、branch/worktree guard 和人工介入点写清楚，不让读者把 `--resume` 误解为“自动修复一切”。

执行方式：

- 新增 `--resume` 章节，写入当前 CLI 的实际命令示例：
  - `bun scripts/orchestrator/orchestrator.mjs --resume`
  - `bun scripts/orchestrator/orchestrator.mjs --resume --batch-id <id>`
- 根据 `loadState()`、`detectOrphanedEvents()`、`markOrphaned()`、`reconcileDerivedDocs()`、`checkStateIterationsConsistency()` 的当前实现，按顺序写明 resume 流程：
  - `state.json.tmp` 检查与 rename 恢复。
  - orphaned event 检测与标记。
  - `state.json` 为真源，派生文档补齐。
  - `state.json` 与 `docs/ITERATIONS.md` 一致性检查。
  - 通过检查后才重新进入主循环。
- 说明 `branch guard`、`On Hold`、`major_revision_count > 3`、`state/doc inconsistency`、batch stall 等人工干预点。
- 明确写出禁止项：orchestrator 不会自动 `checkout`、`stash`、`reset`；需要人类先裁决并恢复分支/worktree 状态。
- 在章节内引用 `docs/ssot/orchestrator_hard_rules.md` §2.4，并在需要时点明 branch/worktree guard 来自当前实现和同文档 §6.5。

涉及文件：

- `docs/user-guide/orchestrator_local_smoke.md`

验证命令：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "--resume|state\\.json\\.tmp|orphaned|branch guard|On Hold|major_revision_count|Human decision required|ITERATIONS\\.md" docs/user-guide/orchestrator_local_smoke.md
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "state\\.json\\.tmp|detectOrphanedEvents|markOrphaned|reconcileDerivedDocs|checkStateIterationsConsistency|checkBranchGuard|major_revision_count|Human decision required|On Hold" scripts/orchestrator/orchestrator.mjs scripts/orchestrator/state.mjs scripts/orchestrator/events.mjs docs/ssot/orchestrator_hard_rules.md
```

Step 回滚：

- 还原 `docs/user-guide/orchestrator_local_smoke.md` 中与 `--resume`、恢复顺序、人工干预边界相关的新增内容。

## Step 3 — 补齐 smoke 场景示例与 9 模块索引表

目标：把用户真正会走的本地 smoke 路径写成可照抄的示例，并把 `scripts/orchestrator/` 当前运行模块结构压缩成一张表。

执行方式：

- 新增“常见本地 smoke 场景”章节，至少覆盖以下 3 个场景：
  - 新 batch → monitor → 手动中断主执行 → `--resume` → 完成。
  - `On Hold` 后的人工作业：先看 `status.txt` / `events.jsonl` / `runlog` / `docs/ITERATIONS.md`，再处理 worktree/分支/审批问题，然后重新 `--resume`。
  - orphaned event 诊断：如何从 `events.jsonl` 与 `state_revision` 关系判断现象，并用 `--resume` 触发恢复。
- 章节中的命令示例必须使用当前 CLI 参数表达，不能引入仓库里不存在的新子命令。
- 新增“模块索引”章节，表格列出 9 个运行模块的：
  - 文件名。
  - 单句职责。
  - 当前行数。
- 行数以执行时的 `wc -l` 结果为准；若代码在执行前已变化，必须先更新计划或重新计算，不得沿用旧数字。

涉及文件：

- `docs/user-guide/orchestrator_local_smoke.md`

验证命令：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "新 batch|手动中断|--resume|On Hold|orphaned event|drivers\\.mjs|events\\.mjs|iteration_register\\.mjs|monitor\\.mjs|notify\\.mjs|orchestrator\\.mjs|prompts\\.mjs|scheduler\\.mjs|state\\.mjs" docs/user-guide/orchestrator_local_smoke.md
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && wc -l scripts/orchestrator/drivers.mjs scripts/orchestrator/events.mjs scripts/orchestrator/iteration_register.mjs scripts/orchestrator/monitor.mjs scripts/orchestrator/notify.mjs scripts/orchestrator/orchestrator.mjs scripts/orchestrator/prompts.mjs scripts/orchestrator/scheduler.mjs scripts/orchestrator/state.mjs
```

Step 回滚：

- 还原 `docs/user-guide/orchestrator_local_smoke.md` 中与场景示例、模块索引表相关的新增内容。

## Step 4 — 更新 superseded iteration 状态并做整体验收

目标：完成文档收口后的索引同步和最终验收，确保这次执行只改变计划中的文档文件。

执行方式：

- 在 `docs/ITERATIONS.md` 中把以下两行的 Status 改为 `Cancelled`：
  - `1219-orchestrator-monitor-resume-smoke-doc`
  - `1220-orchestrator-monitor-resume-smoke-doc`
- 不修改 `1221` 行的 ID、Branch、Entry；只保留其作为当前计划入口。
- 复核 `docs/user-guide/orchestrator_local_smoke.md` 是否已把 §15 / §2.4 的影响讲清楚，而不是复制整段 SSOT 正文。
- 运行现有 `scripts/orchestrator/test_orchestrator.mjs`，作为 monitor / recovery / On Hold 行为仍然存在的基线证据。
- 检查执行差异，确认 Phase 3 只改动 `docs/user-guide/orchestrator_local_smoke.md`、`docs/ITERATIONS.md` 与本 iteration 的 `runlog.md`。
- 若 Gate 或执行现场否决假设 A1，则停止提交 `docs/ITERATIONS.md` 的 `Cancelled` 变更，并回到 Phase 1 调整计划。

涉及文件：

- `docs/ITERATIONS.md`
- `docs/user-guide/orchestrator_local_smoke.md`

验证命令：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "1219-orchestrator-monitor-resume-smoke-doc|1220-orchestrator-monitor-resume-smoke-doc|1221-orchestrator-smoke-doc-content-fill" docs/ITERATIONS.md
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --name-only -- docs/user-guide/orchestrator_local_smoke.md docs/ITERATIONS.md docs/iterations/1221-orchestrator-smoke-doc-content-fill/runlog.md
```

Step 回滚：

- 还原 `docs/ITERATIONS.md` 中 `1219` / `1220` 的状态行。
- 还原 `docs/user-guide/orchestrator_local_smoke.md` 到执行前版本。
- 若已写入本 iteration 的 `runlog.md`，按事实记录追加一次 rollback 说明，不重写历史记录。

## 总体验收

完成条件：

- `docs/user-guide/orchestrator_local_smoke.md` 的 4 个空章节全部补齐，且前言与新增场景不再互相矛盾。
- monitor / resume / scenario / module index 4 个主题都能从当前源码与 `docs/ssot/orchestrator_hard_rules.md` 中找到依据。
- `docs/ITERATIONS.md` 中 `1219` 与 `1220` 的 superseded 状态按 A1 处理完成，或在 Gate 驳回时明确中止并回到 Phase 1。
- 验证命令全部有明确 PASS/FAIL 口径。
- 执行差异不扩散到代码文件。

## 总体回滚方案

若 Phase 3 执行后需要整体撤回本 iteration，执行以下回滚：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git restore --source=HEAD -- docs/user-guide/orchestrator_local_smoke.md docs/ITERATIONS.md
```

若只需撤回本次新增章节而保留其他无关文档修改，则按各 Step 的回滚方案定点恢复，并在 `runlog.md` 追加事实记录。
