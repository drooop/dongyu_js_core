---
title: "0205 — orchestrator v1.1 Phase 3：完成态收口 + observability 清理"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0205-orchestrator-observability-cleanup
id: 0205-orchestrator-observability-cleanup
phase: phase1
---

# 0205 — orchestrator v1.1 Phase 3：完成态收口 + observability 清理

## WHAT

本 iteration 要在 `0203-three-state-routing-review-policy` 与 `0204-escalation-rules-engine` 已冻结的入口/评审 contract 之上，把 orchestrator 的“完成态”定义成一份单一、可持久化、可恢复、可观测、可回归验证的终态合同。

目标不是新增调度能力，而是把当前散落在主循环、monitor、事件日志和操作者认知中的收尾语义收口为同一套规则，至少覆盖以下方面：

- iteration 完成态收口。
  - `REVIEW_EXEC -> COMPLETE` 之后，iteration 的最终状态必须只有一份 authoritative 解释，不能再依赖“phase 已到 `COMPLETE`，但 `status` / 看板 / 事件仍要人工推断”的组合语义。
- batch 完成态收口。
  - `Final Verification` 结束到 `Batch complete` 写出之间，batch 的终态必须对 `state.json`、`status.txt`、`events.jsonl` 使用同一份语义，而不是各自产生半步领先或半步滞后的观察结果。
- observability surface 清理。
  - `status.txt`、`--monitor`、`events.jsonl` 都必须明确表达“当前是运行中、已完成、还是已完成但验证失败”的状态，不允许操作者通过猜测最近几条 message 文本来判断。
- terminal regression coverage。
  - 当前 orchestrator regression 已覆盖 route、policy、failure matrix、resume 和基础 monitor 文本，但尚未把“iteration completed + final verification + batch complete”作为单独、deterministic 的回归面冻结下来；`0205` 需要把这段终态链路补成稳定测试资产。

## WHY

基于 2026-03-22 仓库现状，orchestrator 主链路已经能跑通，但完成态与可观测性仍处于“能工作、但合同不够清晰”的阶段：

- `scripts/orchestrator/orchestrator.mjs` 已经会在 `COMPLETE` phase 内把 iteration 标记为 `status='completed'`，并在主循环结束后执行 `Final Verification`。
- 但 batch 级收尾当前仍分散在多处写入点：
  - `runFinalVerification()` 内先写 final verification event，再 `commitState(state)`。
  - `runMainLoop()` 退出后再次 `commitState(state)`、`refreshStatus(state)`。
  - 然后调用 `notifyBatchComplete(state)`。
  - 最后才追加 `emitEvent(state, { event_type: 'completed', message: 'Batch complete' })`。
- `scripts/orchestrator/monitor.mjs` 的 `refreshStatus()` 目前仍是轻量投影：
  - 只根据当前 iteration 计数与 recent events 渲染；
  - 没有显式 batch 终态摘要；
  - `Phase:` 行仍写死 `major ... /3`，没有消费 iteration 自身的 `review_policy`。
- `scripts/orchestrator/test_orchestrator.mjs` 当前 `bun scripts/orchestrator/test_orchestrator.mjs` 基线已全部通过，但 monitor 相关断言仍只检查“包含 iteration id / phase / title”，没有覆盖 retrospective 里暴露过的终态收口问题。
- `scripts/orchestrator/RETROSPECTIVE_2026-03-21.md` 已明确记录过真实 batch 的终态不一致样本：
  - `events.jsonl` 已写出 `Batch complete`
  - `final_verification = passed`
  - 但 `state.json` / `status.txt` 仍可能落在 `iteration.status=active`、`phase=COMPLETE`、`Done: 0 / Active: 1` 这类中间态解释

这意味着 orchestrator 现在的主要缺口已经不是 route 或 escalation，而是：

- 完成态到底由哪些 authoritative 字段定义；
- `status.txt` 和 `events.jsonl` 应该如何从同一份状态派生；
- monitor 是否能在不读聊天上下文、不读 transcript 的前提下，把 batch 是否真正结束表达清楚；
- 现有 regression 为什么没有把这个缺口抓出来，以及 `0205` 应如何补上。

## 当前事实与影响范围

基于仓库代码、现有 SSOT、runbook 与本地回归基线，`0205` 的直接实现面限定在 orchestrator tooling 与其文档，不涉及产品 runtime、frontend、server、deploy 或 k8s。

直接影响文件：

- `scripts/orchestrator/orchestrator.mjs`
  - iteration `COMPLETE` 收尾
  - final verification 与 batch-level completion write order
  - batch completed event 的写出位置与触发时机
- `scripts/orchestrator/monitor.mjs`
  - `status.txt` 的终态摘要
  - `--monitor` 对 terminal batch 的显示口径
  - `Phase:` 行对 review limit 的展示逻辑
- `scripts/orchestrator/events.mjs`
  - iteration completed / batch completed 的事件表达
  - completed 事件在审计层的稳定 schema 与 helper 边界
- `scripts/orchestrator/state.mjs`
  - 若当前顶层字段不足以单义表达 batch 终态，需要在 authoritative state 中补齐完成态 contract
- `scripts/orchestrator/notify.mjs`
  - batch complete 通知若需要依赖新的终态摘要，必须与 state / event contract 一致
- `scripts/orchestrator/test_orchestrator.mjs`
  - 需要新增 terminal closure regression，而不只保留基础 monitor smoke
- `docs/ssot/orchestrator_hard_rules.md`
  - 需要把 completion cleanup / monitor-events observable contract 从“0205 边界说明”提升为可执行规约
- `docs/user-guide/orchestrator_local_smoke.md`
  - 需要让操作者在无上下文前提下理解：
    - 何时 batch 已真实完成
    - `status.txt` / `events.jsonl` / `state.json` 各自负责什么
    - 若看到 completed event 与看板不一致，应按何种口径判断

明确不在本 iteration 范围内的文件面：

- `scripts/orchestrator/entry_route.mjs`
- `scripts/orchestrator/review_policy.mjs`
- `scripts/orchestrator/escalation_engine.mjs`
- `scripts/orchestrator/drivers.mjs`
- `scripts/orchestrator/scheduler.mjs`
- `packages/**`
- `deploy/**`
- `k8s/**`
- 任何业务 iteration 内容或产品层 runtime 语义

这意味着 `0205` 是 orchestrator Phase 3 observability / completion contract 收口，不允许借机扩张到 tri-state routing、failure matrix、人工裁决 UI、部署链路，或产品逻辑。

## 范围

### In Scope

- 明确 iteration 完成态与 batch 完成态的 authoritative contract
- 收口 final verification、batch complete event、status refresh、notify 之间的 write order
- 清理 `status.txt` / `--monitor` 的 terminal summary 表达
- 清理 completed 相关事件的 schema / payload / message 边界，使 batch completed 与 iteration completed 可稳定区分
- 为 terminal closure 增补 deterministic regression tests
- 同步 orchestrator SSOT 与 operator runbook

### Out Of Scope

- 不修改 `0203` 的 tri-state route contract
- 不修改 `0204` 的 failure matrix / oscillation / escalation rules engine
- 不新增人工裁决交互面
- 不修改产品 runtime、frontend、server、deploy、k8s
- 不把 0205 扩展成 dashboard、webhook、并行调度或新 CLI 子命令开发

## 成功标准

- iteration 到达完成态后，`state.json` 中存在单义、可恢复的终态解释；操作者不需要通过 `phase=COMPLETE` 与 `status=active/completed` 的组合自行猜测。
- batch 结束后，`state.json`、`status.txt`、`events.jsonl` 对“是否真正完成”给出一致结论。
- `Batch complete` 不再与 `Done: 0 / Active: 1`、`Current: [id] ...` 这类运行中看板同时长期并存。
- `status.txt` 的 terminal summary 不再依赖硬编码 review limit，也不再只呈现“当前 active iteration”视角。
- completed 事件的 schema 与 message 边界稳定，消费方无需依赖自由文本区分 batch completion 与 iteration completion。
- `scripts/orchestrator/test_orchestrator.mjs` 对 terminal closure 有 deterministic coverage，至少覆盖：
  - iteration completed
  - final verification passed/failed
  - batch complete write-out
  - monitor/status terminal rendering
- `docs/ssot/orchestrator_hard_rules.md` 与 `docs/user-guide/orchestrator_local_smoke.md` 使用与代码、测试一致的终态术语。

## 约束与不变量

- `state.json` 仍然是唯一恢复真源；`status.txt` 与 `events.jsonl` 仍然只能是衍生产物。
- 若 `0205` 调整 completion write order，必须同步维护或更新 `docs/ssot/orchestrator_hard_rules.md` §2.4 的 crash idempotency 规则；不允许代码与 SSOT 各说各话。
- 观测性清理只能澄清终态 contract，不得改变 `0203` / `0204` 已冻结的 route 与 escalation 语义。
- 不允许通过“少写事件”或“隐藏 status 字段”来掩盖终态不一致；问题必须被收口，而不是被遮蔽。
- 终态 contract 必须能在 `--resume` 与 crash recovery 路径下自洽，不能只对一次性顺滑运行成立。

## 假设与验证方法

- A1：当前 `state.json` 的顶层字段不足以让无上下文读者稳定判断 batch 是否已完成，因此 `0205` 允许在 authoritative state 中补充显式终态摘要或等价 contract。
  - 验证方法：Phase 3 review 必须检查 `state.json`、`status.txt`、`events.jsonl` 是否都可只靠仓库内文档解释其终态含义。
- A2：现有 142 项 orchestrator regression 虽然全部通过，但不足以覆盖真实终态收口缺口。
  - 验证方法：Phase 3 必须新增 terminal closure regression；仅靠当前 monitor smoke 不足以视为完成。
- A3：`0205` 的完成态清理只面向 orchestrator 自身，不触发产品 runtime 合同变更。
  - 验证方法：Phase 3 review 必须确认改动面仍严格限定在 `scripts/orchestrator/**` 与对应文档。

> 本文件只定义 WHAT / WHY / 边界 / 成功标准，不记录 Step 编号、执行命令、PASS/FAIL、commit 或运行输出。
