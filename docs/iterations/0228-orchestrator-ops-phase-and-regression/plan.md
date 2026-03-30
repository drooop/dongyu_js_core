---
title: "0228 — orchestrator-ops-phase-and-regression Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-24
source: ai
iteration_id: 0228-orchestrator-ops-phase-and-regression
id: 0228-orchestrator-ops-phase-and-regression
phase: phase1
---

# 0228 — orchestrator-ops-phase-and-regression Plan

## Goal

- 将 `0227` 已落地的 `ops_task` bridge-local exchange 接入 orchestrator 主循环，使 `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/request.json|result.json|stdout.log|stderr.log|artifacts/` 不再只是本地交换文件，而能被 authoritative 地写入 `state.json`、`events.jsonl`、`status.txt` 与 iteration `runlog.md`。
- 让 local/remote shell 运维任务在 orchestrator 内具备与 `browser_task` 同等级的 phase 能力：request materialization、等待结果、ingest、resume、失败收口、`On Hold` 与 operator 可见状态投影。
- 为 `0229-local-ops-bridge-smoke` 与 `0230-remote-ops-bridge-smoke` 提供稳定的 phase 基座，使下游只需验证真实 shell 路径是否可用，而不再临时返修 orchestrator 的主循环和证据链。

## Background

- `0226-orchestrator-ops-task-contract-freeze` 已冻结 `ops_task` 的 machine-readable contract、canonical task-dir 布局、failure taxonomy、PASS rule 与 remote safety stop rules。
- `0227-orchestrator-ops-executor-bridge` 已实现 `scripts/orchestrator/ops_bridge.mjs` 与 `scripts/orchestrator/ops_executor.mjs`，能够产出 canonical `request.json`、`result.json`、`claim.json`、`stdout.log`、`stderr.log` 与 `artifacts/`。
- 当前代码库已经具备 `ops_task` 的 execution handshake 上游：
  - `scripts/orchestrator/schemas/exec_output.json` 已定义 `ops_tasks[]`。
  - `scripts/orchestrator/prompts.mjs` 已要求 execution 输出 machine-readable `ops_task`。
  - `scripts/orchestrator/drivers.mjs` 已提供 `materializeOpsTaskRequests()` 并落盘 canonical `request.json`。
- 但截至 2026-03-24，authoritative orchestrator surface 仍只覆盖 `browser_task`，未覆盖 `ops_task`：
  - `scripts/orchestrator/state.mjs` 只有 `evidence.browser_tasks[]`、`recordBrowserTaskRequest()`、`ingestBrowserTaskResult()`，没有 `ops_task` 对等记录面。
  - `scripts/orchestrator/events.mjs` 只有 `event_type = browser_task` 的结构化事件，没有 `ops_task` 事件。
  - `scripts/orchestrator/monitor.mjs` 只有 `Browser Task:` / `Browser Status:` 等看板字段，没有 `ops_task` 投影。
  - `scripts/orchestrator/iteration_register.mjs` 只有 `appendBrowserTaskRunlogRecord()`，没有 `ops_task` runlog 追加 helper。
  - `scripts/orchestrator/orchestrator.mjs` 在 `EXECUTION` phase 只会等待/ingest `browser_task`，不会等待/ingest `ops_task`。
- 因此 `0228` 的真实职责不是再做一层 bridge，而是把 `0226/0227` 的 local bridge evidence 升格为 orchestrator 可恢复、可裁决、可审计的 phase 能力。

## Problem Statement

- 没有 `0228`，`.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/` 下的文件只能证明 bridge 曾运行过，不能证明 iteration 已真正通过 orchestrator 的 PASS 规则。
- `--resume` 目前无法区分以下 `ops_task` 场景：
  - request 已 materialize 但 result 尚未返回；
  - result 已存在但还没 ingest；
  - result/stderr/artifact 已存在但 failure kind 要求 `On Hold`；
  - stale/duplicate/invalid result 应被拒绝而不是重复成功。
- operator 目前无法只看 `state.json` / `status.txt` / `runlog.md` 就判断当前 ops phase 的状态；必须人工翻 task dir，破坏了“`state.json` 是唯一恢复真源”的规约。
- `0226` 已冻结的关键 failure kinds 还没有进入 orchestrator 主循环的 continue / stop 判定：
  - `nonzero_exit`
  - `assertion_failed`
  - `remote_guard_blocked`
  - `forbidden_remote_op`
  - `ops_bridge_not_proven`
  - `stale_result`
  - `duplicate_result`
- 如果直接把真实 local/remote smoke 留给 `0229/0230` 去补 phase 行为，下游迭代就会被迫同时承担“证明 shell bridge 可用”和“发明 orchestrator phase 语义”两类职责，破坏 `0226 -> 0227 -> 0228 -> 0229/0230` 的分层。

## Scope

- In scope:
  - 为 `ops_task` 增加 authoritative state record、structured event、status projection 与 runlog projection。
  - 在 orchestrator 主循环中接入 `ops_task` 的 request materialization、等待、ingest、成功推进与失败收口。
  - 将 `ops_task` 的 resume 语义、`On Hold` 边界、bridge-local evidence vs authoritative evidence 边界用 deterministic regression 锁定。
  - 同步最小 SSOT / runbook / ops README，使 operator 能明确区分 `0227` bridge local evidence 与 `0228` authoritative ingest。
- Out of scope:
  - 不新增 `ops_task` schema 字段，不重写 `0226` 的 contract。
  - 不重写 `0227` 的 bridge / executor / claim-release 语义。
  - 不运行真实 local cluster rollout / remote rollout smoke；这些分别留给 `0229` 与 `0230`。
  - 不修改 `scripts/ops/*.sh` 的业务语义，只把它们作为 canonical command family 事实锚点。
  - 不涉及 `packages/worker-base/**`、`packages/ui-*`、`deploy/sys-v1ns/**` 等 ModelTable runtime / fill-table 交付。

## Impact Surface

### Primary runtime surface

- `scripts/orchestrator/orchestrator.mjs`
- `scripts/orchestrator/state.mjs`
- `scripts/orchestrator/events.mjs`
- `scripts/orchestrator/monitor.mjs`
- `scripts/orchestrator/iteration_register.mjs`

### Reused contract / bridge inputs

- `scripts/orchestrator/drivers.mjs`
- `scripts/orchestrator/ops_bridge.mjs`
- `scripts/orchestrator/ops_executor.mjs`
- `scripts/orchestrator/schemas/ops_task_request.json`
- `scripts/orchestrator/schemas/ops_task_result.json`

### Regression and operator evidence

- `scripts/orchestrator/test_orchestrator.mjs`
- `scripts/orchestrator/test_ops_task_contract.mjs`
- `scripts/orchestrator/test_ops_executor_bridge.mjs`
- `docs/ssot/orchestrator_hard_rules.md`
- `docs/user-guide/orchestrator_local_smoke.md`
- `scripts/ops/README.md`
- `docs/iterations/0228-orchestrator-ops-phase-and-regression/runlog.md`

## Reusable Mechanisms And Missing Pieces

### Reusable mechanisms already present

- `0220` 已为 `browser_task` 建立一套可复用先例：
  - `state.json` 中的 `evidence.browser_tasks[]`
  - `event_type = browser_task`
  - `status.txt` 的 browser 投影字段
  - `appendBrowserTaskRunlogRecord()`
  - 主循环中的 `pending -> awaiting_result -> ingest -> REVIEW_EXEC` 路径
- `0227` 已为 `ops_task` 建好 bridge-local 入口：
  - canonical task dir
  - contract-valid `request.json` / `result.json`
  - `stdout.log` / `stderr.log`
  - artifact manifest 与本地归档
- `drivers.mjs` 已能把 execution 输出 materialize 成 canonical `ops_task request.json`。

### 0228 仍缺失、必须补齐的 pieces

- authoritative `evidence.ops_tasks[]` 数据面；
- `recordOpsTaskRequest()`、`getPendingOpsTaskRecord()`、`ingestOpsTaskResult()` 等 state helper；
- `event_type = ops_task` 的结构化事件；
- `status.txt` 中的 `Ops Task:` / `Ops Status:` / `Ops Failure Kind:` / `Ops Exit Code:` 等投影；
- `appendOpsTaskRunlogRecord()` 一类的 runlog 证据追加 helper；
- 主循环里的 `ops_task` 等待/ingest/推进/失败分支；
- resume 下对 pending/result/stale/duplicate/failure 的 deterministic 收口；
- operator 文档中对 `bridge local evidence present` 与 authoritative PASS 的明确区分。

## Invariants / Constraints

- 严格遵守 `CLAUDE.md` 的 `HARD_RULES`、`WORKFLOW`、`REMOTE_OPS_SAFETY` 与“`state.json` 是唯一恢复真源”的规约。
- `0228` 只能消费 `0226` 已冻结的 contract 与 `0227` 已存在的 bridge live boundary，不得私自改字段、改 failure taxonomy、改 PASS rule、改 canonical path。
- `request.json` / `result.json` / `stdout.log` / `stderr.log` / `artifacts/` 仍然只是 bridge-local exchange；只有在 orchestrator ingest 后，才可进入 authoritative evidence chain。
- remote safety 是上位规约：
  - forbidden remote op 不能被降级成 `nonzero_exit`；
  - critical-risk remote action 不能被包装成自动成功；
  - `remote_preflight_guard.sh` 前置失败不能继续尝试 mutating op。
- `0228` 必须复用 `0220` 的 browser phase 设计方法，但不能把 `browser_task` 的 artifact path / MCP 假设直接硬拷到 `ops_task`。
- 验证必须保持 deterministic PASS/FAIL；“目录里看起来有日志”“桥接脚本似乎跑过”都不构成 PASS。
- 当前 Phase 1 只允许生成 `plan.md` 与 `resolution.md`；本 iteration 的实现、测试与 runlog 记录必须等到 Gate 通过后再进入 Phase 3。

## Success Criteria

- orchestrator 可以把 `ops_task` 视为显式 phase 对象，而不是只把它当作 execution 产物中的一段 JSON。
- `state.json` 能 authoritative 地记录 `ops_task` 的至少以下字段：
  - `task_id`
  - `attempt`
  - `status`
  - `failure_kind`
  - `request_file`
  - `result_file`
  - `stdout_file`
  - `stderr_file`
  - `exit_code`
  - `artifact_paths`
  - `ingested_at`
- `events.jsonl`、`status.txt`、`runlog.md` 都是从 `state.json` 投影或引用 `ops_task` 证据，而不是反向充当恢复真源。
- `--resume` 对以下路径有稳定、可回归的判定：
  - request 已写出但 result 未到；
  - result 已到但尚未 ingest；
  - `nonzero_exit` / `assertion_failed`；
  - `remote_guard_blocked` / `forbidden_remote_op`；
  - `ops_bridge_not_proven`；
  - `stale_result` / `duplicate_result` / `result_invalid` / `artifact_mismatch`。
- `0229` 和 `0230` 可以把真实 shell smoke 聚焦在“命令族是否可用”，不再返修 orchestrator 的 phase / resume / evidence chain。

## Risks And Mitigations

- Risk:
  - 把 `0228` 做成 `0227` bridge 重写，导致主循环接线和 bridge-local contract 一起漂移。
  - Mitigation:
    - 明确把 `0227` 视为既有输入；`0228` 只补 authoritative ingest 与 phase wiring。
- Risk:
  - 把 task dir 中的 `stdout.log` / `stderr.log` / `artifacts/` 误判为 PASS。
  - Mitigation:
    - 强制 PASS 必须经过 orchestrator ingest，并在 `state.json` / `events.jsonl` / `runlog.md` 中留下引用。
- Risk:
  - remote safety stop rules 在主循环里被降级成普通失败，导致危险操作没有进入 `On Hold`。
  - Mitigation:
    - 继续以 `CLAUDE.md` 和 `docs/ssot/orchestrator_hard_rules.md` 为上位规约，把 forbidden / guard blocked / critical-risk path 明确锁进 regression。
- Risk:
  - `browser_task` 与 `ops_task` phase 行为分叉过大，后续维护成本上升。
  - Mitigation:
    - 复用 `0220` 的 authoritative ingest pattern，但保留 `ops_task` 独有字段和 remote safety 语义。
- Risk:
  - 下游 smoke 迭代继续补 contract 或补 phase，造成职责交叉。
  - Mitigation:
    - 在 `0228` 文档中明确 `0229/0230` 只负责真实执行 proof，不再定义核心 phase 语义。

## Alternatives

### A. 推荐：按 `0220` 的 browser phase 先例，为 `ops_task` 补齐同等级 authoritative ingest / resume / status/runlog surface

- 优点：
  - 最大化复用现有 orchestrator 模式，最容易保持恢复语义一致。
  - `0227` 的 bridge local evidence 与 `0228` 的 authoritative ingest 分层清晰。
- 缺点：
  - 需要同时触达 `state/events/monitor/orchestrator/iteration_register/test/docs` 多个面。

### B. 只在 monitor 或 runlog 上补 `ops_task` 可见性，不做 authoritative ingest

- 优点：
  - 表面改动较小，看板很快能看到任务名与状态。
- 缺点：
  - 仍然不能支撑 `--resume`、PASS rule、失败收口；本质上只是把 local evidence 包装得更好看。

### C. 把 ops phase 留到 `0229/0230` 一并做

- 优点：
  - 当前 iteration 看似可以更快结束。
- 缺点：
  - 会把“phase wiring”与“真实 local/remote smoke”混成一轮，破坏 contract layering，也让问题定位变得困难。

当前推荐：A。

## Inputs

- Created at: 2026-03-24
- Iteration ID: `0228-orchestrator-ops-phase-and-regression`
- Depends on:
  - `0226-orchestrator-ops-task-contract-freeze`
  - `0227-orchestrator-ops-executor-bridge`
- Precedent to mirror:
  - `0220-orchestrator-browser-phase-and-regression`
- Downstream consumers:
  - `0229-local-ops-bridge-smoke`
  - `0230-remote-ops-bridge-smoke`
