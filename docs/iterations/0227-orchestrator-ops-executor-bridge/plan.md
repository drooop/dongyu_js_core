---
title: "0227 — orchestrator-ops-executor-bridge Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-24
source: ai
iteration_id: 0227-orchestrator-ops-executor-bridge
id: 0227-orchestrator-ops-executor-bridge
phase: phase1
---

# 0227 — orchestrator-ops-executor-bridge Plan

## Goal

- 在 `0226-orchestrator-ops-task-contract-freeze` 已冻结的 request/result schema、canonical task dir、`stdout.log` / `stderr.log` / `exit_code` 语义和 failure taxonomy 基础上，落地一套可执行的 Ops Executor Bridge，使外层 executor 能消费 `ops_task` request，并把结构化 result 与本地 shell 证据稳定写回。
- 让 `0228-orchestrator-ops-phase-and-regression` 可以直接接入既有 bridge，而不是在主循环里继续发明 shell 执行协议、claim/release 语义、日志归档规则或冲突恢复逻辑。

## Background

- `0226` 已经完成 `ops_task` 合同冻结，当前仓库已具备以下上游输入：
  - versioned schema：
    - `scripts/orchestrator/schemas/ops_task_request.json`
    - `scripts/orchestrator/schemas/ops_task_result.json`
  - execution handshake 与 canonical request materialization：
    - `scripts/orchestrator/drivers.mjs`
    - `scripts/orchestrator/schemas/exec_output.json`
    - `scripts/orchestrator/test_ops_task_contract.mjs`
  - SSOT / operator docs：
    - `docs/ssot/orchestrator_hard_rules.md`
    - `docs/user-guide/orchestrator_local_smoke.md`
    - `scripts/ops/README.md`
- 这些文件已经把 `ops_task` 的 batch-local exchange 路径写死为：
  - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/request.json`
  - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/result.json`
  - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/stdout.log`
  - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/stderr.log`
  - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/artifacts/`
- 但截至 2026-03-24，仓库里仍没有真正把这份合同变成可运行 bridge 的实现面：
  - 还不存在 `ops_bridge` helper，用于派生路径、校验 request/result、原子写入 result/logs/artifacts、验证 manifest 与重复写保护。
  - 还不存在显式的 external ops executor consumer，用于消费 pending `ops_task`、执行 `mock|local_shell|ssh` boundary，并把 shell 结果写回 canonical 目录。
  - 还不存在对应的 deterministic bridge regression；当前只有 contract test，没有 request/result file exchange、claim/release、stdout/stderr 归档、artifact hash 与 stale/duplicate recovery 的测试面。
- 与之相对，browser 侧已经有可复用先例：
  - `scripts/orchestrator/browser_bridge.mjs`
  - `scripts/orchestrator/browser_agent.mjs`
  - `scripts/orchestrator/test_browser_agent_bridge.mjs`
- 因此 `0227` 的职责不是接入 orchestrator 主循环，也不是跑真实 local/remote smoke，而是先把“合同如何被外层 executor 消费并落盘”这件事稳定下来。

## Problem Statement

- 如果没有可运行的 ops bridge，`0226` 冻结的 schema 只是一组静态合同，`0228` 无法验证主循环究竟在等待什么本地 exchange 行为，`0229/0230` 也无法区分 bridge 缺陷与环境缺陷。
- 如果把 shell 执行能力直接塞回 `drivers.mjs` 或 orchestrator 主循环，会破坏 `0226` 已冻结的 executor boundary：
  - orchestrator 会重新依赖“某个内部 CLI 顺手就能跑 shell”的隐式假设；
  - `executor_unavailable` / `target_unreachable` / `remote_guard_blocked` / `forbidden_remote_op` / `ops_bridge_not_proven` 会失真；
  - `stdout.log` / `stderr.log` / artifact 的 canonical 归档与重复写保护会缺少独立桥接层。
- 如果没有 claim/release 与 bridge-local recovery，后续 `0228` / `0229` / `0230` 会把主循环问题、shell 执行问题、远端环境问题混在一起，难以审计也难以回归。

## Scope

- In scope:
  - 实现 batch-local Ops Executor Bridge，消费 `request.json` 并回写 `result.json`，严格遵守 `0226` 已冻结的 schema 与路径。
  - 实现显式的 external executor consumer boundary，包括：
    - 如何发现 pending request
    - 如何 claim / 执行 / release 一个 task
    - 如何归档 `stdout.log` / `stderr.log`
    - 如何 materialize artifact 并生成 hash/manifest
    - 如何把 `exit_code`、failure kind、executor metadata 写回 result
  - 实现 deterministic regression，覆盖：
    - exchange helper
    - mock executor
    - local shell dispatch
    - ssh boundary / fake transport
    - claim/release
    - duplicate / stale / invalid 冲突
  - 以 `browser_bridge` 为实现模板，但保留 `ops_task` 自己的 failure taxonomy、stdout/stderr 归档和 remote safety stop rule 映射。
- Out of scope:
  - 不把 `ops_task` 接入 `scripts/orchestrator/orchestrator.mjs` 主状态机。
  - 不修改 `state.json` / `events.jsonl` / `status.txt` / `runlog.md` 的 authoritative ingest surface；这些属于 `0228`。
  - 不做真实 local cluster rollout smoke；这些属于 `0229`。
  - 不做真实 remote rollout / readiness smoke；这些属于 `0230`。
  - 不重定义 `0226` 已冻结的 request/result schema、failure taxonomy、PASS rule、remote safety 术语或 canonical 目录。
  - 不修改 `packages/worker-base/**`、`packages/ui-*`、`deploy/sys-v1ns/**` 等 runtime / fill-table 交付面。

## Contract Targets

- `0227` 必须把以下 contract 从“可读文档”变成“可运行 bridge 能力”：
  - request consumption：
    - 只消费 `ops_task_request.v1`
    - 只接受 `task_kind=ops_task`
    - 只在 `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/` 内工作
  - result production：
    - 只写 `ops_task_result.v1`
    - `status` / `failure_kind` / `exit_code` / `stdout_file` / `stderr_file` / artifact manifest 必须与 `0226` schema 一致
    - pass result 只能在 required artifacts 真正落盘并可校验时生成
  - executor boundary：
    - 外层 executor 是显式 consumer，不是 `drivers.mjs` 或 orchestrator 主循环的隐式能力
    - `mode=mock|local_shell|ssh` 必须通过同一 bridge surface 暴露
    - 不允许在 `ssh` 不可用时静默降级到 `mock`
  - claim / release：
    - request/result 仍是 canonical exchange 文件
    - claim/release 只能是 task-dir 内 bridge-local helper，不得升级为新的 authoritative contract
  - bridge-local recovery：
    - 已完成 attempt 不得被第二次成功消费并覆盖
    - stale claim / duplicate result / invalid request 必须有 deterministic 行为

## Impact Surface

- 预期 implementation surface：
  - `scripts/orchestrator/ops_bridge.mjs`
    - path derivation
    - request/result validation
    - stdout/stderr/result/artifact writer
    - claim/release helper
    - duplicate/stale/manifest guard
  - `scripts/orchestrator/ops_executor.mjs`
    - pending task discovery
    - `mock|local_shell|ssh` dispatch boundary
    - shell output capture
    - failure result synthesis
  - `scripts/orchestrator/test_ops_executor_bridge.mjs`
    - deterministic exchange / executor / idempotency regression
  - 最小 contract-alignment 补强（如需要）：
    - `scripts/orchestrator/test_ops_task_contract.mjs`
    - `scripts/orchestrator/test_orchestrator.mjs`
  - bridge/operator 文档同步（如需要）：
    - `docs/ssot/orchestrator_hard_rules.md`
    - `docs/user-guide/orchestrator_local_smoke.md`
- 现有可复用但不应被 0227 重写的实现面：
  - `scripts/orchestrator/drivers.mjs`
  - `scripts/orchestrator/browser_bridge.mjs`
  - `scripts/orchestrator/browser_agent.mjs`
  - `scripts/orchestrator/test_browser_agent_bridge.mjs`
- 明确不属于 `0227` 的 implementation surface：
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/monitor.mjs`
  - `scripts/orchestrator/iteration_register.mjs`

## Reusable Mechanisms And Missing Pieces

- 已有可复用基础：
  - `materializeOpsTaskRequests()` 已能从 execution 输出生成 canonical `request.json`
  - `ops_task` schema / failure taxonomy / PASS rule 已在 `0226` 冻结
  - `browser_bridge` 已证明“bridge helper + explicit consumer + deterministic regression”的实现模式在本仓库可行
  - `scripts/ops/README.md` 已冻结 canonical shell surface，远端 deploy 脚本自身已内建 `remote_preflight_guard.sh`
- `0227` 必须补齐但当前缺失的 pieces：
  - request/result/log/artifact exchange helper
  - external ops executor consumer entrypoint
  - `stdout.log` / `stderr.log` / `exit_code` 的真实落盘与结果汇总
  - claim/release / duplicate / stale recovery
  - bridge-specific deterministic regression

## Invariants / Constraints

- 严格遵守 `CLAUDE.md` 的 HARD_RULES、CAPABILITY_TIERS、WORKFLOW 和 `docs/ssot/orchestrator_hard_rules.md`。
- `0227` 是 bridge iteration，不是主循环 iteration：
  - 允许新增 bridge / executor / regression / 最小文档同步
  - 不允许提前做 `0228` 的 authoritative ingest / resume / On Hold wiring
  - 不允许提前做 `0229/0230` 的真实 rollout smoke
- `ops_task` bridge 是 orchestrator tooling contract，不是 ModelTable runtime capability：
  - 不能借此改 runtime、worker 角色或 fill-table patch
  - 不能通过 system model / UI patch 表达 shell bridge
- `request.json` / `result.json` 仍是 canonical exchange 文件；claim/release/helper 文件只能是 bridge-local 临时辅助。
- `stdout.log` / `stderr.log` / `artifacts/` 只属于 local bridge evidence；没有 `0228` ingest，仍不得宣布 authoritative PASS。
- remote safety 术语和 stop rule 来自 `CLAUDE.md` 与 `0226` SSOT：
  - bridge 必须忠实产出 `remote_guard_blocked` / `forbidden_remote_op` / `target_unreachable`
  - 不得把这些路径降级为 warning、`nonzero_exit` 或静默 fallback
- 验证必须是 deterministic PASS/FAIL；不得用“命令看起来执行了”“stdout 像是正常”替代结构化校验。

## Success Criteria

- deterministic regression 可以创建 contract-valid request，驱动 bridge 完成一次 canonical request consumption，并生成 contract-valid `result.json`、`stdout.log`、`stderr.log` 与 required artifacts。
- 重复运行同一 consumer、命中 stale claim、已有 result 或 invalid request 时，bridge 行为 deterministic，且不会伪造第二次成功。
- `mock|local_shell|ssh` 拥有同一 bridge surface；其中：
  - `mock` 用于稳定证明 bridge 语义
  - `local_shell` 可用于无副作用的安全本地命令回归
  - `ssh` 至少具有显式 transport boundary 和 deterministic failure path，真实远端 rollout proof 留给 `0230`
- `0228` 可以直接复用 `0227` bridge，把精力集中在主循环 ingest / resume / status / On Hold，而不是继续补 shell bridge 本身。

## Risks & Mitigations

- Risk:
  - `0227` scope 漂移到 orchestrator 主循环，提前修改 state / event / monitor 语义。
  - Mitigation:
    - 将 `orchestrator.mjs`、`state.mjs`、`events.mjs`、`monitor.mjs` 明确列为 out of scope；若 bridge 成立必须依赖这些文件，视为 planning gap，而不是直接扩 scope。
- Risk:
  - claim/release 被误当成新合同，后续执行者绕过 request/result。
  - Mitigation:
    - 在计划中明确 request/result 才是 canonical exchange，claim/release 只能是 task-dir 内临时 helper。
- Risk:
  - `ssh`/remote path 在 0227 中被假证明，掩盖真实远端 smoke 风险。
  - Mitigation:
    - 0227 只要求 bridge dispatch boundary 与 deterministic failure path；真实 remote whitelist proof 仍由 `0230` 单独承担。
- Risk:
  - `stdout.log` / `stderr.log` / artifact 被误当成 authoritative 成功证据。
  - Mitigation:
    - 在计划中重复冻结“0227 只交付 local bridge evidence，0228 之后才有 authoritative ingest”。

## Alternatives

### A. 推荐：独立 `ops_bridge` + 独立 `ops_executor` + 独立桥接回归

- 优点：
  - bridge 语义与 orchestrator 主状态机解耦，`0228` / `0229` / `0230` 的责任边界清晰。
  - `mock|local_shell|ssh` 可以复用同一 request/result/log/artifact surface。
  - 可以复用 browser bridge 的现有模式，降低实现漂移。
- 缺点：
  - 需要新增 bridge、executor、test 三个面，而不是把逻辑塞进已有 driver。

### B. 把 shell 执行能力直接塞进 `drivers.mjs`

- 优点：
  - 短期文件数更少。
- 缺点：
  - 重新引入“内部 CLI 隐式具备 shell bridge”的错误假设，破坏 `0226` 明确冻结的 executor boundary，也让 claim/release、stdout/stderr 归档、duplicate/stale recovery 难以独立审计。

### C. 只做 mock bridge，把 `local_shell|ssh` 全留给 0229/0230

- 优点：
  - `0227` 表面实现成本更低。
- 缺点：
  - `0228` 接主循环时仍无法验证真实 shell bridge surface，`0229/0230` 会同时暴露 bridge bug 与环境 bug，定位成本高。

当前推荐：A。

## Inputs

- Created at: 2026-03-24
- Iteration ID: `0227-orchestrator-ops-executor-bridge`
- Planning mode: `refine`
- Upstream:
  - `0226-orchestrator-ops-task-contract-freeze`
- Downstream:
  - `0228-orchestrator-ops-phase-and-regression`
  - `0229-local-ops-bridge-smoke`
  - `0230-remote-ops-bridge-smoke`
