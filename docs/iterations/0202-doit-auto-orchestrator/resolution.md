---
title: "Resolution: doit-auto orchestrator v1"
iteration: 0202-doit-auto-orchestrator
doc_type: iteration-resolution
status: planned
created: 2026-03-21
source: ai
updated: 2026-03-21
iteration_id: 0202-doit-auto-orchestrator
id: 0202-doit-auto-orchestrator
phase: phase1
---

# Resolution: doit-auto orchestrator v1

## Step 1 — Schemas + 目录结构

创建 JSON schema 文件和目录骨架。

文件：
- `scripts/orchestrator/schemas/review_verdict.json`
- `scripts/orchestrator/schemas/exec_output.json`
- `scripts/orchestrator/schemas/final_verdict.json`
- `.orchestrator/` 加入 `.gitignore`

验证：schema 文件合法 JSON，可被 `JSON.parse` 加载。

## Step 2 — state.mjs（状态持久化）

实现 state.json 的 CRUD，含：
- `createState(batchId, prompt, goals)` — 初始化
- `loadState(batchId)` — 加载（含 crash recovery）
- `commitState(state)` — 原子写入（write-to-temp + rename）
- `state_revision` 单调递增
- crash idempotency 检查（§2.4）

验证：单元测试 — 模拟崩溃场景验证恢复正确性。

## Step 3 — events.mjs（事件日志）

实现 events.jsonl 的 append + read：
- `emitEvent(state, event)` — 追加事件（含 state_revision）
- `readEvents(batchId, opts)` — 读取（支持 tail）
- 孤立事件检测（revision > state.state_revision）

验证：写入后读取校验 schema_version、event_id、state_revision。

## Step 4 — monitor.mjs（状态看板 + --monitor）

实现三层监控：
- `refreshStatus(state)` — 生成 status.txt
- stderr 实时输出（集成到 emitEvent）
- `--monitor` 子命令（while + sleep + clear）

验证：手动运行 `--monitor` 可看到看板。

## Step 5 — notify.mjs（通知）

实现 macOS notification：
- `notify(event, detail)` — osascript 调用
- try-catch 包裹，失败写 event 不回滚 state（§2.5）
- webhook 预留接口（v1 不实现）

验证：触发一次 macOS notification 确认弹出。

## Step 6 — drivers.mjs（CLI 封装）

实现 Codex 和 Claude Code 的非交互调用：
- `codexExec(prompt, opts)` — `codex exec` 封装
- `claudeReview(prompt, opts)` — `claude -p` 封装
- 输出捕获 → transcript 文件
- session_id 提取（Claude Code JSON 输出）
- allowedTools 白名单（§13）

验证：分别调用一次 codex exec 和 claude -p，确认输出可解析。

## Step 7 — prompts.mjs（prompt 模板）

实现各阶段的 prompt 构建：
- `buildDecomposePrompt(userPrompt)` — decompose
- `buildPlanningPrompt(id, spec)` — Codex planning
- `buildPlanReviewPrompt(id)` — Claude review plan
- `buildRevisionPrompt(id, reviewOutput)` — Codex revise
- `buildExecutionPrompt(id)` — Codex execute
- `buildExecReviewPrompt(id)` — Claude review exec
- `buildFinalVerifyPrompt(goals, iterations)` — final gate

验证：生成 prompt 含必要上下文和 verdict 格式要求。

## Step 8 — scheduler.mjs（任务调度）

实现调度逻辑：
- `pickNext(state)` — 优先级：blocking spawn > primary > queued spawn
- `acceptSpawn(state, spawnSpec)` — spawn intake（§3.1 + §6.3）
- `isBlocked(state, iterationId)` — 阻塞检查

验证：单元测试 — 各调度场景（无 spawn、blocking spawn、scope_expansion）。

## Step 9 — iteration_register.mjs（ITERATIONS.md 读写）

实现：
- `getNextId()` — 从 ITERATIONS.md 解析最大 id
- `registerIteration(id, date, title, branch)` — 追加行
- `updateStatus(id, newStatus)` — 更新状态列
- 幂等性：写入前检查是否已存在

验证：注册后读取 ITERATIONS.md 确认行存在。

## Step 10 — orchestrator.mjs（主循环）

组装所有模块，实现完整状态机：
- Phase -1 Decompose + confirm gate
- Phase 0-4 串行执行
- Auto-Approval Policy（3 次独立 APPROVED）
- major revision 计数 + On Hold
- spawn 处理（derived_dependency / scope_expansion）
- branch/worktree guard（§6.5）
- Final Verification Gate
- 断点恢复
- CLI 参数解析（--prompt, --resume, --monitor, --auto-confirm）

验证：使用 mock driver 模拟完整流程（不调用真实 CLI）。

## Step 11 — 集成测试

用真实 CLI（小 scope 需求）端到端运行一次：
- 确认 decompose → plan → review → exec → review → complete 全链路。
- 确认 state.json 恢复。
- 确认 ITERATIONS.md 更新。
- 确认三层监控输出。

验证：runlog.md 记录全链路 PASS。

## 回滚

所有代码在 `scripts/orchestrator/` 目录。
回滚 = `git revert` 或删除目录。不影响现有 runtime/server/frontend。
