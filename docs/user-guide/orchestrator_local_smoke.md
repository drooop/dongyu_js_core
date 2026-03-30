---
title: "Orchestrator Local Smoke Runbook"
doc_type: user-guide
status: active
updated: 2026-03-25
source: ai
---

# Orchestrator Local Smoke Runbook

## 适用范围

本地 orchestrator smoke/runbook 只面向本地操作者，目标是覆盖最小可复现的本地批处理路径。
默认读者是已经知道 iteration/workflow 基础约束的操作者；本文不覆盖需求分解、plan/review 生成，也不把终端看板当成权威状态。
除已有 batch 的 `--monitor` / `--resume` 外，本文也覆盖 `--accept-final-verification` 的 operator 路径，以及一个最小的新 batch smoke 场景：新 batch 启动后转入 monitor、手动中断主执行、再用 `--resume` 恢复并完成。

## 权威来源

- `docs/ssot/orchestrator_hard_rules.md` §2.4：恢复顺序、`state.json.tmp`、orphaned event 与 crash idempotency。
- `docs/ssot/orchestrator_hard_rules.md` §15：三层监控与 `--monitor` 子命令。
- `CLAUDE.md` 与 `docs/WORKFLOW.md`：Phase 约束与 docs-only 执行边界。

若本文与以上文件或当前 `scripts/orchestrator/` 实现不一致，以源码与高优先级规约为准。

## 恢复边界与状态真源

- 唯一恢复真源是 `.orchestrator/runs/<batch_id>/state.json`。
- `.orchestrator/runs/<batch_id>/status.txt` 只用于观察当前汇总看板。
- `.orchestrator/runs/<batch_id>/events.jsonl` 只用于事件审计，不可反推覆盖 `state.json`。
- `status.txt` 的目标路径模式固定为 `.orchestrator/runs/<batch_id>/status.txt`。

恢复与观察要分开理解：

- `state.json` 决定 resume 从哪里继续。
- `status.txt` 和 `events.jsonl` 只是衍生产物，允许在 crash 后被重建或补齐。
- `state.json.batch_summary` 是 `0205` 起的 authoritative terminal summary；当 completed event 与 status 看板不一致时，先看这里，而不是先猜 message。

## 目标 batch 的选择

- `--batch-id <id>` 是可选参数。
- 未传 `--batch-id` 时，当前实现会自动选取最近一个 batch 作为默认目标。
- 这里的“最近”是当前实现事实，不是新增治理约定；实际行为以 `findLatestBatch()` 为准。

## 文档结构

后续章节按四块展开：

1. `--monitor` 的终端观察方式与三层监控口径。
2. `--resume` 的恢复顺序、crash recovery 与人工干预边界。
3. `--accept-final-verification` 的正式入口、验证与禁用动作。
4. 常见本地 smoke 场景示例。
5. `scripts/orchestrator/` 模块索引。

其中第 1-4 节都服务于同一个本地 smoke/runbook 范围：操作者围绕现有 CLI 参数观察 batch、处理中断、恢复执行或执行 manual accept，而不是把本文扩展成完整 orchestrator 使用手册。

## `--monitor`

当前 CLI 支持两种 monitor 调用方式：

```bash
bun scripts/orchestrator/orchestrator.mjs --monitor
bun scripts/orchestrator/orchestrator.mjs --monitor --batch-id <id>
```

- 未传 `--batch-id` 时，`main()` 会调用 `findLatestBatch()`，监控最近一个 batch。
- 传入 `--batch-id <id>` 时，只观察指定 batch，不改写 batch 内容。

`docs/ssot/orchestrator_hard_rules.md` §15 与当前实现都把 monitor 拆成三层：

1. `stderr`：实时 CLI 进度流。`emitEvent()` 在写入 `events.jsonl` 后立即把事件摘要打印到 `stderr`，适合盯当前执行过程。
2. `.orchestrator/runs/<batch_id>/status.txt`：汇总看板。`refreshStatus()` 每次把当前批次状态重新渲染到这个文件。
3. `.orchestrator/runs/<batch_id>/events.jsonl`：事件审计日志。这里保留 append-only 事件与 `state_revision`，用于追查时间线，不可反推覆盖 `state.json`。

`runMonitor()` 的终端行为是固定的：

- 每 2 秒轮询一次 `.orchestrator/runs/<batch_id>/status.txt`。
- 每轮先清屏，再输出最新 `status.txt` 内容。
- 若事件文件里有新记录，会在终端追加 `-- Latest Events --` 区块，展示最近 5 条事件。
- `Ctrl+C` 只结束观察进程；`runMonitor()` 本身不推进状态机，也不会把 batch 标记为失败、暂停或完成。

`refreshStatus()` 当前输出的关键字段包括：

- `Batch:`：当前 batch 短 ID。
- `Done:`：已完成 iteration 计数，同时和 `Active:`、`Pending:`、`On Hold:` 一起构成汇总计数。
- `Batch Lifecycle:` / `Batch Outcome:`：从 `state.json.batch_summary` 投影出来的 batch 终态摘要。
- `Phase:`：当前 active iteration 的 phase、review round 和 major revision 计数；若 batch 已完成，则显示 `terminal`。
- `State Revision:`：`state.json` 最近一次提交后的 revision。
- recent event labels：completion 类事件会显示结构化标签，例如 `[batch:passed] Batch complete`、`[iteration:completed] Completed`。

这些字段适合看板观察，但都不是恢复真源；恢复顺序仍以 `state.json` 为准，`status.txt` 只是把当前内存态投影成便于值守的文本快照。

### 如何判定 batch 已真实完成

优先级固定如下：

1. 看 `.orchestrator/runs/<batch_id>/state.json` 里的 `batch_summary`
2. 再看 `.orchestrator/runs/<batch_id>/status.txt`
3. 最后用 `.orchestrator/runs/<batch_id>/events.jsonl` 对时间线做审计

操作上至少确认三件事：

- `batch_summary.lifecycle = completed`
- `batch_summary.terminal_outcome = passed | failed`
- `status.txt` 中 `Batch Lifecycle:` / `Batch Outcome:` 与 `Final Verification:` 一致

如果你只看到 `events.jsonl` 里的 completed event，却没有在 `state.json.batch_summary` 和 `status.txt` 里看到对应终态，优先按“state 未提交或 status 未刷新”处理，而不是先假定 batch 已完成。

### completed event 与 status 看板不一致时怎么查

推荐顺序：

1. 先打开 `.orchestrator/runs/<batch_id>/state.json`，检查 `batch_summary` 是否已经进入 `completed`
2. 再看 `.orchestrator/runs/<batch_id>/status.txt` 是否已显示 `Batch Lifecycle:` / `Batch Outcome:`
3. 最后检查 `.orchestrator/runs/<batch_id>/events.jsonl` 尾部的 structured label，例如 `[batch:passed]`

判读原则：

- 如果 `events.jsonl` 已有 `[batch:passed] Batch complete`，但 `state.json.batch_summary.lifecycle` 还不是 `completed`，优先按 orphaned / pre-commit 窗口处理
- 如果 `state.json.batch_summary.lifecycle = completed`，但 `status.txt` 还没刷新出 `Batch Lifecycle:` / `Batch Outcome:`，优先重跑 `--resume` 或等待下一次 `refreshStatus()`
- 不要把 `message = "Batch complete"` 当成唯一真值；从 `0205` 起，scope/outcome 以 structured payload 和 `batch_summary` 为准

## `--resume`

当前 CLI 支持两种 resume 调用方式：

```bash
bun scripts/orchestrator/orchestrator.mjs --resume
bun scripts/orchestrator/orchestrator.mjs --resume --batch-id <id>
```

- 未传 `--batch-id` 时，`main()` 会调用 `findLatestBatch()`，恢复最近一个 batch。
- 传入 `--batch-id <id>` 时，只恢复指定 batch。

结合 `docs/ssot/orchestrator_hard_rules.md` §2.4 与当前 `main()` 实现，resume 的固定顺序是：

1. `loadState()` 先读取 `.orchestrator/runs/<batch_id>/state.json`，并检查 `state.json.tmp`。
2. 如果 `state.json.tmp` 存在、JSON 合法且 schema/revision 可接受，当前实现会直接 `rename` 回 `state.json`，完成一次被中断的提交；非法 tmp 会被丢弃。
3. `detectOrphanedEvents()` 检查 `events.jsonl` 中 `state_revision > state.json.state_revision` 的事件；若存在，`markOrphaned()` 会补写告警事件，同时 `stderr` 输出 `[recovery] Found N orphaned events, marked and continuing`。
4. `reconcileDerivedDocs()` 用 `state.json` 反向补齐衍生产物：缺失的 `docs/ITERATIONS.md` 条目、iteration skeleton、runlog review record。
5. `checkStateIterationsConsistency()` 再检查 `state.json` 与 `docs/ITERATIONS.md` 是否一致；若仍不一致，resume 直接停止并打印 `Human decision required. Fix ITERATIONS.md or state.json, then --resume again.`。
6. 只有以上检查通过，才会重新进入 `runMainLoop()`。

其中第 5 步从 `0204` 起还有两个新增事实：
- 这些不一致会被写入当前 iteration 的 `state.json.evidence.failures[]`，failure kind = `state_doc_inconsistency`。
- 默认动作是 `human_decision_required`，不是静默忽略，也不是自动回写某一边。

这意味着 crash recovery 的优先级始终是：

- 先信 `state.json`，再修复 `status.txt` / `events.jsonl` / runlog 这类衍生产物。
- `status.txt` 允许丢失或过期；恢复后会重新生成。
- orphaned event 只是审计痕迹，不是恢复真源。

### 人工干预边界

`--resume` 不是“自动修好一切”。以下情况按当前实现都需要人先处理：

- `checkBranchGuard()` 失败：进入 `EXECUTION` 前会校验 `expected_branch`、`git status --porcelain` 和排除项。失败即 `On Hold`。orchestrator 不会自动 `checkout`、`stash`、`reset`。
- `major_revision_count >= 3`：无论发生在 `REVIEW_PLAN` 还是 `REVIEW_EXEC`，都会直接 `On Hold`。
- `revision_type = ambiguous`：当前实现立刻停止，并要求人类裁决，不会代替你决定是否计入 major revision。
- `state.json` 与 `docs/ITERATIONS.md` 在 reconcile 之后仍不一致：resume 会直接 block，不会猜测该信哪一边。
- batch 只剩 `on_hold` / `blocked_by_spawn`，没有任何 `pending` iteration：`runMainLoop()` 会打印 `Human decision required. Resolve On Hold iterations, then --resume.` 并退出。

### Failure / Action 术语

本地操作者至少需要识别以下 failure kind：

- `parse_failure`：review 输出无法解析；默认会先 `retry`，达到 `cli_failure_threshold` 后进入 `on_hold`。
- `max_turns` / `timeout` / `process_error`：review CLI 失败家族；默认也遵循“阈值前重试，阈值到达后 `on_hold`”。
- `state_doc_inconsistency`：`state.json` 与 `docs/ITERATIONS.md` 在 reconcile 后仍不一致；默认动作是 `human_decision_required`。
- `oscillation`：`APPROVED -> NEEDS_CHANGES -> APPROVED` 或反向模式；默认动作是 `human_decision_required`。
- `ambiguous_revision`：reviewer 无法判 major/minor；默认动作是 `human_decision_required`。
- `major_revision_limit`：major 次数超限；默认动作是 `on_hold`。

动作术语不要混用：

- `retry`：保持当前 phase，再跑下一轮。
- `warn_and_continue`：写 warning 到 state evidence，但主循环继续；这是 policy override 行为，不是默认路径。
- `human_decision_required`：必须先做人类裁决，然后再决定是否 `--resume`。
- `on_hold`：iteration 已正式停机，必须先修正原因，再恢复。

按当前 `runMainLoop()` 行为，`blocked_by_spawn` 可以在阻塞 iteration 完成后自动回到 `pending`，但 `on_hold` 不会自动恢复。因此人工恢复不只是“修好 worktree”这么简单，还包括先把导致 `On Hold` 的事实修正到可继续状态，再重新运行 `--resume`。

## `--accept-final-verification`

当前 CLI 的正式 manual accept 入口是：

```bash
bun scripts/orchestrator/orchestrator.mjs --accept-final-verification --batch-id <id> --reason "<why human accepts>"
```

硬规则：

- `--resume is not a manual accept path`。
- `do not edit state.json by hand`。
- manual accept 只允许在 batch 已进入 terminal lifecycle，且 `state.json.batch_summary.terminal_outcome = failed` 时使用。
- 该入口会追加 append-only `override evidence`，不会重写原始 failed terminal event。
- terminal consumer 必须继续先信 `batch_summary`；若 top-level `final_verification` 与 `batch_summary.final_verification` 漂移，应先用这个入口修复，而不是继续 wave / resume。

operator 执行后至少检查三类文件：

```bash
cat ".orchestrator/runs/$BATCH_ID/state.json"
cat ".orchestrator/runs/$BATCH_ID/status.txt"
tail -n 20 ".orchestrator/runs/$BATCH_ID/events.jsonl"
```

验收口径：

- `state.json.final_verification = passed`
- `state.json.batch_summary.final_verification = passed`
- `state.json.batch_summary.terminal_outcome = passed`
- `status.txt` 同时显示 `Batch Outcome: passed` 与 `Final Verification: passed`
- `events.jsonl` 新增 `override evidence`，至少含：
  - `override_kind = manual_final_verification_accept`
  - `previous_terminal_outcome = failed`
  - `new_terminal_outcome = passed`
  - `reason`

## 常见本地 smoke 场景

下面 3 个场景都只使用当前 CLI 已存在的参数，不引入额外子命令。

### 场景 1：新 batch → monitor → 手动中断 → resume → 完成

终端 A：启动一个最小本地 smoke batch。

```bash
bun scripts/orchestrator/orchestrator.mjs \
  --prompt "创建一个 docs-only iteration，用于本地 smoke 验证，不修改运行时代码。" \
  --auto-confirm
```

终端 B：拿到最新 batch 并开始 monitor。

```bash
BATCH_ID=$(ls -1t .orchestrator/runs | head -n 1)
bun scripts/orchestrator/orchestrator.mjs --monitor --batch-id "$BATCH_ID"
```

操作顺序：

1. 让终端 A 先跑到 planning / review / execution 中任一非瞬时阶段。
2. 在终端 A 按 `Ctrl+C`，模拟主执行被中断。
3. 保留终端 B 继续观察；如果只想停止观察，在终端 B 按 `Ctrl+C`，不会改 batch 状态。
4. 在终端 C 恢复：

```bash
bun scripts/orchestrator/orchestrator.mjs --resume --batch-id "$BATCH_ID"
```

5. 用下面两个文件确认恢复后的状态：

```bash
cat ".orchestrator/runs/$BATCH_ID/status.txt"
tail -n 20 ".orchestrator/runs/$BATCH_ID/events.jsonl"
```

预期现象：

- 若中断发生在 `events.jsonl` append 之后、`state.json` commit 之前，resume 时会先报告 orphaned event，再继续主循环。
- 若中断只打断了 monitor，本体 batch 不受影响。
- 完成后 `status.txt` 中 `Final Verification:` 应不再是 `pending`，并且应出现 `Batch Lifecycle: completed`、`Batch Outcome: passed|failed`。
- `events.jsonl` / `--monitor` recent events 对 batch 终态会显示结构化标签，例如 `[batch:passed] Batch complete`。

### 场景 2：`On Hold` 后的人工作业与恢复

先定位为什么进入 `On Hold`：

```bash
BATCH_ID=<batch-id>
ITERATION_ID=<iteration-id>

cat ".orchestrator/runs/$BATCH_ID/status.txt"
tail -n 40 ".orchestrator/runs/$BATCH_ID/events.jsonl"
rg -n -- "On Hold|Human decision required|major_revision_count|ambiguous|Branch guard" "docs/iterations/$ITERATION_ID/runlog.md"
rg -n -- "state_doc_inconsistency|oscillation|human_decision_required|warn_and_continue" ".orchestrator/runs/$BATCH_ID/state.json"
rg -n -- "$ITERATION_ID" docs/ITERATIONS.md
git branch --show-current
git status --short
```

人工恢复顺序建议按边界分流：

1. 分支 / worktree 问题：先手动切回 `expected_branch`，清理与当前 iteration 无关的脏变更。
2. `major_revision_count > 3`、`revision_type = ambiguous`、`state_doc_inconsistency`、`oscillation`：先做人类裁决，决定是修改文档/状态，还是终止该 batch。
3. 只有当 `state.json`、`docs/ITERATIONS.md`、当前分支和 worktree 都回到可继续状态后，再重新执行：

```bash
bun scripts/orchestrator/orchestrator.mjs --resume --batch-id "$BATCH_ID"
```

当前实现不会替你做这些动作：

- 不会自动 `checkout` 到正确分支。
- 不会自动 `stash` 或 `reset` 未提交改动。
- 不会自动把 `on_hold` iteration 改回 `pending`。

因此这里的“人工恢复”边界非常明确：先裁决，再恢复，再 `--resume`。

### 场景 3：orphaned event 诊断

典型现象：`status.txt` 里的 `State Revision:` 还停在旧值，但 `events.jsonl` 尾部已经出现更高 `state_revision` 的事件。

```bash
BATCH_ID=<batch-id>

cat ".orchestrator/runs/$BATCH_ID/status.txt"
tail -n 10 ".orchestrator/runs/$BATCH_ID/events.jsonl"
```

诊断和恢复方式：

1. 先从 `status.txt` 读出当前 `State Revision:`。
2. 再看 `events.jsonl` 尾部是否已经出现更高 `state_revision` 的 event；如果出现，这通常意味着 crash 发生在“event append 完成、state commit 尚未完成”的窗口。
3. 运行：

```bash
bun scripts/orchestrator/orchestrator.mjs --resume --batch-id "$BATCH_ID"
```

4. 观察两个信号：
   - `stderr` 是否打印 `[recovery] Found N orphaned events, marked and continuing`。
   - `events.jsonl` 尾部是否新增 `Orphaned event detected: ...` 这类告警事件。

如果 resume 之后仍然出现 state/doc inconsistency，而不是 orphaned event 自动恢复，说明问题已经超出 §2.4 的幂等恢复范围，需要按上一节的人工作业边界处理。

## browser_task operator 读法（0220 wiring 生效）

`browser_task` 在 0218 冻结 contract、在 0220 接入 orchestrator 主循环。
因此当前读法是：先区分 batch-local exchange、local evidence、authoritative ingest，再决定 PASS / FAIL。

### 0221 唯一 local smoke 合同

`0221-playwright-mcp-local-smoke` 只允许一个最小本地 smoke 目标，不得在执行期临时扩 scope：

- `task_id = workspace-smoke`
- `start_url = http://127.0.0.1:30900/`
- `executor = { mode: "mcp", executor_id: "playwright-mcp" }`
- required artifacts 只允许：
  - `final.png`
  - `report.json`
- 最小 success assertions 只允许：
  - workspace shell 在 `http://127.0.0.1:30900/` 成功渲染
  - `final.png` 与 `report.json` 落在 canonical `output/playwright/<batch_id>/workspace-smoke/`

handoff 边界也固定如下：

- `scripts/orchestrator/browser_agent.mjs` 是 generic bridge consumer，不会把 `mode=mcp` 隐式降级成 mock PASS
- 没有真实 Playwright MCP executor 消费 canonical request/result exchange 时，必须停在 `mcp_unavailable`
- `0221` 要证明的是显式 real-MCP handoff 可用，而不是“页面能打开”或“手工补一个 artifact”

operator 最小命令面也固定如下：

```bash
bun scripts/orchestrator/playwright_mcp_local_smoke.mjs prepare --batch-id <batch_id> --base-url http://127.0.0.1:30900/
bun scripts/orchestrator/playwright_mcp_local_smoke.mjs finalize-pass --batch-id <batch_id>
bun scripts/orchestrator/playwright_mcp_local_smoke.mjs finalize-fail --batch-id <batch_id> --failure-kind mcp_unavailable --summary "<reason>"
bun scripts/orchestrator/playwright_mcp_local_smoke.mjs ingest --batch-id <batch_id>
```

使用规则：

- 先 `prepare`，只允许它写 canonical `request.json` 与 pending browser_task state
- 真实 Playwright MCP executor 产出 `final.png` / `report.json` 后才能 `finalize-pass`
- 若 MCP executor 不可用，必须 `finalize-fail` 为 `mcp_unavailable`
- 只有 `ingest` 之后，结果才进入 authoritative `state/events/status/runlog`

### 去哪里找 request/result

每个 browser task 的 batch-local exchange 固定放在：

```text
.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/request.json
.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/result.json
```

判读原则：

- `request.json` / `result.json` 是 request/result file，不是 authoritative state。
- 这些文件可以帮助你定位 task_id、attempt、status、failure_kind，但**不能**替代 `state.json` 的 ingest 结果。
- 如果 `request.json` 和 `result.json` 都存在，但 `state.json` / `events.jsonl` / `runlog.md` 没有引用它们，仍然不能算 PASS。

### 去哪里找 browser evidence

operator-facing evidence 固定看：

```text
output/playwright/<batch_id>/<task_id>/
```

这里至少允许出现：

- `screenshot`
- `json`
- `trace`
- `console`

判读原则：

- `output/playwright/` 只代表 local evidence 已落盘。
- 截图或 JSON 存在，不等于 orchestrator 已 ingest。
- 若 artifact 路径、类型、producer、hash 与 result manifest 不一致，判定为 `artifact_mismatch`。
- 若 required artifact 缺失，判定为 `artifact_missing`。

### 何时判定 PASS / FAIL

browser task 只有在以下三件事同时满足时才算 PASS：

1. `result.json` 中 `status = pass`
2. request 中所有 required artifacts 都真实存在于 `output/playwright/<batch_id>/<task_id>/...`
3. orchestrator 已把该 task/result 写进自己的 evidence chain：至少能在 `state.json`、`events.jsonl`、`runlog.md` 中找到对应引用

否则不要写 PASS，最多只能写：

- `local evidence present`
- `bridge output present but not ingested`
- 或具体 failure kind

### 三个必须会读的 failure kind

- `artifact_mismatch`
  - 文件存在，但路径、类型、producer 或 hash 与 result manifest 不一致
- `browser_bridge_not_proven`
  - 只有 prose、mock 结果或孤立 artifact，没有真实 bridge / ingest 证明；0221 若拿不到真实 MCP-backed 执行，必须用它收口
- `mcp_unavailable` / `MCP unavailable`
  - 需要真实 Playwright MCP 时，executor 侧没有 MCP capability；这是 stop rule，不是 warning

### 如何结合 state / events / status / runlog 读

推荐顺序：

1. `state.json`
   - 看是否已有 browser task ingest 引用
2. `events.jsonl`
   - 看是否已有 browser lifecycle event，且 payload 带 `task_id` / `attempt` / `failure_kind`
3. `status.txt`
   - 当前 `refreshStatus()` 会投影：
     - `Browser Task:`
     - `Browser Attempt:`
     - `Browser Status:`
     - `Browser Failure Kind:`
   - 这些字段来自 `state.json.evidence.browser_tasks[]`，只用于观察，不得反向驱动 resume
4. `runlog.md`
   - 最终人类可读证据必须包含 request/result 路径、artifact 路径和 PASS/FAIL / failure kind

若只有 `output/playwright/...`，没有 `state.json` / `events.jsonl` / `runlog.md` 对应引用，应判为“artifact only”，而不是 PASS。

### 0220 生效后的 operator 结论

- request materialization 后，orchestrator 会先把 task 写入 `state.json.evidence.browser_tasks[]`，状态为 `pending`
- 如果 `result.json` 还没到，ingest 会停在 `awaiting_result`；这是 browser wait point，不是 PASS，也不是失败
- result ingest 成功后，orchestrator 会写 `event_type = browser_task` 到 `events.jsonl`，并刷新 `status.txt`
- 若 result 是 mock-only pass，orchestrator 会把它降级为 `browser_bridge_not_proven`，不会继续判 PASS
- 若 required artifact 缺失或 hash/type 不匹配，orchestrator 会写 `artifact_missing` / `artifact_mismatch`，并走失败路径

## ops_task operator 读法（0227 bridge live；0228 当前已生效）

`ops_task` 在 0226 冻结 contract，0227 已把 external executor bridge 落成 `ops_bridge.mjs + ops_executor.mjs`，0228 runtime 已接线到 orchestrator 主循环。
因此当前 operator 读法必须先区分三层：

- 0227 当前已生效：external executor bridge + claim/release + local request-result-stdout-stderr-artifacts archive
- 0228 当前已生效：authoritative `state/events/status/runlog` ingest projection
- 0229/0230 只负责真实 shell smoke，不再补 phase contract
- 真实 shell smoke 仍尚未证明；0228 只交付 phase/runtime 语义，不宣称 local/remote shell smoke 已完成

这意味着即使你已经看到 `request.json` / `result.json` / `stdout.log` / `stderr.log` / `artifacts/`，仍然要继续确认 0228 authoritative ingest 是否已经把它们写进 `state.json` / `events.jsonl` / `status.txt` / `runlog.md`。

### 去哪里找 canonical task dir

每个 ops task 的 canonical 目录固定为：

```text
.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/
```

至少包含：

```text
.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/request.json
.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/result.json
.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/claim.json      # claimed 时短暂存在
.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/stdout.log
.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/stderr.log
.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/artifacts/
```

读法规则：

- `request.json`：看 `command` / `shell` / `cwd` / `target_env` / `host_scope` / `mutating` / `danger_level` / `success_assertions`
- `result.json`：看 `status` / `failure_kind` / `summary` / `exit_code`
- `claim.json`：只表示 0227 bridge-local lease/claim 生命周期；若 claim 过期，recovery 会清理它并以 `stale_result` 记录恢复语义
- `stdout.log` / `stderr.log`：只表示 executor 的本地 shell 输出，不是 authoritative state
- `artifacts/`：只表示 contract 要求的本地 evidence 已落盘，不等于 PASS

### 当前阶段如何判读 PASS / FAIL

ops task 只有在以下条件同时满足时才算 PASS：

1. `result.json` 中 `status = pass`
2. `exit_code = 0`
3. request 中所有 `required_artifacts` 都真实存在于 canonical `artifacts/` 目录
4. 0228 当前已生效：orchestrator 已把该 task/result/stdout/stderr/artifact 写入自己的 evidence chain：`state.json` / `events.jsonl` / `status.txt` / `runlog.md`

如果 0228 ingest 还没把它写进 authoritative surface，最多只能写：

- `bridge local evidence present`
- `contract materialized`
- `local stdout/stderr present`
- `result file present but not ingested`
- `claim active`（如果你正好看到 `claim.json`）

不要把这些中间状态写成 PASS。

### 三个必须会读的 failure kind

- `nonzero_exit`
  - command 确实执行了，但 shell exit code 不是 0
- `remote_guard_blocked`
  - remote safety guard 没过；典型信号是 `remote_preflight_guard.sh` 失败、rke2 判定失败、socket 不可达、或 root/权限不足
- `ops_bridge_not_proven`
  - 只有 mock 结果、prose 说明、或孤立日志文件，没有真实 external executor bridge 证明

同时还要识别两个 stop rule：

- `forbidden_remote_op`
  - request 命中了 `CLAUDE.md` 的 absolute prohibitions，必须立即停止
- `human_decision_required` / `On Hold`
  - `kubectl delete namespace`
  - `helm uninstall`
  - 任何影响其他 namespace 或 cluster-wide resources 的动作

### 如何结合 state / events / status / runlog 读

当前阶段统一按 0228 runtime 已接线的顺序读：

1. `state.json`
   - 先看 `state.json.evidence.ops_tasks[]`
   - `pending` 表示 request 已 materialize，但 result 还未 authoritative ingest
2. `events.jsonl`
   - 再看 `event_type = ops_task`
   - payload 至少应包含 `task_id` / `attempt` / `status` / `failure_kind` / `request_file` / `result_file` / `stdout_file` / `stderr_file` / `exit_code`
3. `status.txt`
   - 看当前投影：
     - `Ops Task:`
     - `Ops Attempt:`
     - `Ops Status:`
     - `Ops Failure Kind:`
     - `Ops Exit Code:`
4. `runlog.md`
   - 最终人类可读证据必须包含 request/result/stdout/stderr/artifact 路径、PASS/FAIL、failure kind、exit_code

0228 当前已生效的最低投影字段已经冻结：

- `status.txt`
  - `Ops Task:`
  - `Ops Attempt:`
  - `Ops Status:`
  - `Ops Failure Kind:`
  - `Ops Exit Code:`
- `runlog.md`
  - request/result/stdout/stderr/artifact 路径
  - PASS / FAIL
  - failure kind
  - exit_code

若只有 `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/...`，没有 `state.json` / `events.jsonl` / `status.txt` / `runlog.md` 的 ops 引用，应判定为“bridge local evidence present”或“contract only”，而不是 PASS。

### 0228 当前已生效后的 operator 结论

- request materialization 后，orchestrator 会先把 task 写入 `state.json.evidence.ops_tasks[]`，状态为 `pending`
- 如果 `result.json` 还没到，ingest 会停在 `await_ops_result`；这是 ops wait point，不是 PASS，也不是失败
- result ingest 成功后，orchestrator 会写 `event_type = ops_task` 到 `events.jsonl`，刷新 `status.txt`，并把 iteration 推进到 `REVIEW_EXEC`
- 如果 `result.json` 命中 `remote_guard_blocked` 或 `forbidden_remote_op`，iteration 会进入显式 `On Hold` stop path
- 如果 request 在 preflight 就命中 `kubectl delete namespace` / `helm uninstall`，orchestrator 会在 materialize 前给出 `human_decision_required` / `On Hold`
- `--resume` 必须先信 `state.json.evidence.ops_tasks[]`；只有 task dir 残留文件、没有 authoritative pending record 时，不能恢复成 PASS

## `scripts/orchestrator/` 模块索引

下表只覆盖当前 9 个运行模块，排除 `test_orchestrator.mjs` 和 `schemas/`：

| 文件 | 当前行数 | 职责 |
|------|---------:|------|
| `drivers.mjs` | 336 | 封装 `codex exec` / `claude -p` 调用、transcript 落盘与 verdict 解析入口。 |
| `events.mjs` | 181 | 维护 `events.jsonl` append-only 日志、`stderr` 实时流和 orphaned event 检测。 |
| `iteration_register.mjs` | 192 | 读写 `docs/ITERATIONS.md`，创建 iteration skeleton，并向 runlog 追加 review gate record。 |
| `monitor.mjs` | 108 | 生成 `status.txt` 看板，并实现 `--monitor` 的轮询终端视图。 |
| `notify.mjs` | 98 | 发送 best-effort 通知，并把通知失败降级为事件而非回滚状态。 |
| `orchestrator.mjs` | 1418 | CLI 入口、主状态机、resume/recovery、phase 切换、exec/review/final verification，以及 escalation decision 消费。 |
| `prompts.mjs` | 432 | 生成 decompose/planning/review/execution/fix/final verification 的提示模板，并显式注入 failure matrix / oscillation boundary。 |
| `scheduler.mjs` | 206 | 维护串行调度、spawn 插队、`blocked_by_spawn` 恢复和 `On Hold` 衍生文档同步。 |
| `state.mjs` | 359 | 维护 `state.json` 的 create/load/commit、branch guard、failure/escalation/oscillation evidence 和 batch 发现逻辑。 |

行数基于当前工作区执行的 `wc -l` 结果；如果后续源码变化，表中数字也应重新计算，不要沿用旧值。
