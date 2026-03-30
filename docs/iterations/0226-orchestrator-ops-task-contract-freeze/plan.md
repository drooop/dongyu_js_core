---
title: "0226 — orchestrator-ops-task-contract-freeze Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-24
source: ai
iteration_id: 0226-orchestrator-ops-task-contract-freeze
id: 0226-orchestrator-ops-task-contract-freeze
phase: phase1
---

# 0226 — orchestrator-ops-task-contract-freeze Plan

## Goal

- 冻结一套自包含、可审计、可回归的 `ops_task` 合同，使 orchestrator 把外层 shell 执行视为显式协议对象，而不是把 local / remote 运维命令继续藏在 inner Codex/Claude shell 或人工终端里。
- 为 `0227-0230` 提供唯一上游输入：同一组 request/result schema、canonical task 目录、`stdout/stderr/exit_code` 语义、artifact 规则、risk metadata、failure taxonomy，以及 `state.json` / `events.jsonl` / `status.txt` / `runlog.md` 双写审计边界。
- 明确 remote mutating path 的 stop rules：什么可以自动执行、什么必须直接失败、什么必须 `On Hold` 并请求人类裁决；任何实现都不得绕过 `CLAUDE.md REMOTE_OPS_SAFETY`。

## Background

- `0218-0220` 已经为 `browser_task` 冻结并实现了一条完整先例：
  - `scripts/orchestrator/schemas/` 有 versioned schema；
  - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/` 作为 batch-local exchange；
  - `docs/ssot/orchestrator_hard_rules.md` 明确了 failure taxonomy、PASS rule 与审计映射；
  - orchestrator 的 prompt / parse / ingest / state-event-status 已对 `browser_task` 建立显式术语。
- 与之相对，截至 2026-03-24，仓库里仍没有任何 `ops_task` 合同面：
  - `scripts/orchestrator/schemas/exec_output.json` 只有 `browser_tasks`，没有 `ops_tasks`。
  - `scripts/orchestrator/prompts.mjs` 与 `scripts/orchestrator/drivers.mjs` 只定义 browser handshake，没有 outer shell task 的结构化输出规则。
  - `scripts/orchestrator/state.mjs`、`events.mjs`、`monitor.mjs`、`iteration_register.mjs` 只维护 `browser_task` 证据面，没有 `ops_task` 字段与事件口径。
  - `docs/ssot/orchestrator_hard_rules.md` 也没有 `ops_task` 的目录、failure taxonomy、PASS rule 或双写审计合同。
- 但下游迭代已经把 `ops_task` 当成既定能力：
  - `0224-remote-rollout-baseline` 明确要求远端 mutating ops 默认通过 `ops_task bridge + 外层 executor` 执行。
  - `0229-local-ops-bridge-smoke` 与 `0230-remote-ops-bridge-smoke` 都把真实 shell 执行能力视为前置条件。
- 同时，仓库已有一批 canonical ops 入口，明确了 `ops_task` 未来必须覆盖的命令族：
  - local baseline / readiness：`scripts/ops/check_runtime_baseline.sh`、`scripts/ops/ensure_runtime_baseline.sh`
  - local rollout：`scripts/ops/deploy_local.sh`
  - remote safety gate：`scripts/ops/remote_preflight_guard.sh`
  - remote source sync / rollout：`scripts/ops/sync_cloud_source.sh`、`scripts/ops/deploy_cloud_full.sh`、`scripts/ops/deploy_cloud_app.sh`
- 因此 `0226` 的职责不是先写 bridge，而是先把“什么是 ops_task、结果怎样才算 authoritative、哪些 remote path 根本不允许自动执行、哪些日志与 artifact 只是 local-only evidence”一次写死。

## Problem Statement

- 如果直接进入 `0227` / `0228` 而没有 `0226` 合同冻结，几乎必然出现以下漂移：
  - bridge 自行发明 request/result/log 路径，后续 resume 与审计无法稳定消费；
  - local / remote / host_scope / mutating / danger_level 的语义在不同迭代里各自定义，导致同一条 shell 命令在不同上下文下被不同地解释；
  - `stdout.log`、`stderr.log`、`exit_code`、artifact 可能存在于本地磁盘，却没有 authoritative ingest，形成“命令好像跑了，但 orchestrator 没法 deterministic 裁决”的伪成功；
  - remote mutating 命令可能绕过 `CLAUDE.md REMOTE_OPS_SAFETY` 与 `scripts/ops/remote_preflight_guard.sh`，把高风险操作伪装成普通 shell task；
  - `0224` / `0229` / `0230` 无法明确判断 `Local ops bridge proven|blocked`、`Remote ops bridge proven|blocked`。
- 这类漂移不仅会破坏 bridge 和 phase 接线，还会破坏本仓库对“命令、风险、证据、回滚”必须可追溯的治理要求。

## Scope

- In scope:
  - 盘点现有 orchestrator 审计骨架与 `scripts/ops/` canonical command family，明确哪些机制可复用、哪些 `ops_task` pieces 当前完全缺失。
  - 冻结 `ops_task` request/result 的 machine-readable contract。
  - 冻结 canonical task dir 与文件角色，至少覆盖：
    - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/request.json`
    - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/result.json`
    - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/stdout.log`
    - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/stderr.log`
    - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/artifacts/...`
  - 冻结 outer shell execution boundary，至少覆盖：
    - command / shell / cwd
    - target environment
    - host scope
    - mutating flag
    - danger level
    - timeout
    - success assertions
    - required artifacts
  - 冻结 `ops_task` failure taxonomy、PASS rule、remote safety stop rules 与 authoritative / derived / local-only 审计映射。
  - 冻结 downstream 需要共用的 prompt、schema、SSOT、operator-doc 术语。
- Out of scope:
  - 不实现 external executor bridge、claim/release 与实际消费循环。
  - 不把 `ops_task` 接入 orchestrator 主循环、resume、status、On Hold 流程。
  - 不运行真实 local / remote shell smoke。
  - 不改 `scripts/ops/*.sh` 的业务语义，只为合同冻结提供事实锚点。
  - 不修改 `packages/worker-base/**`、`deploy/sys-v1ns/**` 等 ModelTable runtime / fill-table 面。

## Command Classes To Freeze

| Class | Meaning | Current anchors | 0226 must freeze |
|---|---|---|---|
| Local readonly ops | 只读取本地管理面与 readiness 事实 | `scripts/ops/check_runtime_baseline.sh`, `kubectl get ...` | request/result/log/exit_code/audit contract |
| Local mutating ops | 本地部署、补齐 baseline、rollout restart | `scripts/ops/ensure_runtime_baseline.sh`, `scripts/ops/deploy_local.sh` | `mutating=true`、rollback 口径、PASS rule |
| Remote readonly ops | 远端 preflight、source gate、只读检查 | `scripts/ops/remote_preflight_guard.sh`, `kubectl get ...`, source hash checks | remote safety gate 与 target/host boundary |
| Remote mutating whitelist ops | 白名单内远端 source sync、deploy、rollout、logs/readiness | `scripts/ops/sync_cloud_source.sh`, `scripts/ops/deploy_cloud_full.sh`, `scripts/ops/deploy_cloud_app.sh` | `danger_level`、allowed vs forbidden、human decision boundary |

## Contract Targets

- `ops_task` 必须成为显式协议对象，不再接受“请去外层 shell 跑一下命令”的 prose-only 约定。
- request identity 至少要冻结：
  - `batch_id`
  - `iteration_id`
  - `task_id`
  - `attempt`
  - `created_at`
- execution boundary 至少要冻结：
  - shell command 文本与解释器语义
  - working directory
  - environment surface 的声明方式
  - `target_env`
  - `host_scope`
  - `mutating`
  - `danger_level`
  - `timeout_ms`
  - `success_assertions`
  - `required_artifacts`
- result envelope 至少要冻结：
  - `status`
  - `failure_kind`
  - `summary`
  - `exit_code`
  - `started_at`
  - `completed_at`
  - `stdout_file`
  - `stderr_file`
  - artifact manifest
  - executor metadata
- remote safety contract 至少要冻结：
  - remote readonly 与 remote mutating 的区分
  - `scripts/ops/remote_preflight_guard.sh` 的前置关系
  - `CLAUDE.md REMOTE_OPS_SAFETY` 白名单/禁令的从属关系
  - critical-risk operation 进入 `human_decision_required` / `On Hold` 的边界
- PASS rule 至少要冻结：
  - result 声明 `status = pass`
  - `exit_code = 0`
  - success assertions 被明确满足
  - required artifacts 真实存在且与 manifest 一致
  - orchestrator 已把该 task 结果写入自己的 evidence chain；没有 ingest 证据时，最多只能算 local evidence present

## Authoritative / Derived / Local-Only Matrix

| Layer | Role | Current anchor | 0226 freeze result |
|---|---|---|---|
| Authoritative | batch 恢复真源 | `.orchestrator/runs/<batch_id>/state.json` via `scripts/orchestrator/state.mjs` | future `ops_task` ingest 必须最终归入 authoritative state，task dir 文件不得替代 state |
| Derived audit | append-only 事件时间线 | `.orchestrator/runs/<batch_id>/events.jsonl` via `scripts/orchestrator/events.mjs` | future `ops_task` lifecycle 必须有结构化事件，但 event 仍不能反推覆盖 state |
| Derived operator view | 当前批次看板 | `.orchestrator/runs/<batch_id>/status.txt` via `scripts/orchestrator/monitor.mjs` | future `ops_task` summary 只能是 state 投影，不是恢复源 |
| Versioned evidence | repo 内人类可读证据 | `docs/iterations/<id>/runlog.md` | runlog 必须引用 request/result/stdout/stderr/artifact 路径与最终 PASS/FAIL |
| Local runtime exchange | outer shell request/result/log/artifact | 当前不存在 | 0226 必须冻结路径、命名和 local-only 边界，供 0227/0228 实现 |

## Impact Surface

- Orchestrator contract / validation surface：
  - `scripts/orchestrator/schemas/exec_output.json`
  - `scripts/orchestrator/schemas/ops_task_request.json`
  - `scripts/orchestrator/schemas/ops_task_result.json`
  - `scripts/orchestrator/drivers.mjs`
  - `scripts/orchestrator/prompts.mjs`
  - `scripts/orchestrator/test_ops_task_contract.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
- SSOT / operator docs：
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `scripts/ops/README.md`
- Future audit consumers that depend on this freeze but should not be implemented in 0226：
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/monitor.mjs`
  - `scripts/orchestrator/iteration_register.mjs`
  - `scripts/orchestrator/orchestrator.mjs`
- Canonical ops command anchors：
  - `scripts/ops/check_runtime_baseline.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/deploy_local.sh`
  - `scripts/ops/remote_preflight_guard.sh`
  - `scripts/ops/sync_cloud_source.sh`
  - `scripts/ops/deploy_cloud_full.sh`
  - `scripts/ops/deploy_cloud_app.sh`

## Reusable Mechanisms And Missing Pieces

- 已有可复用骨架：
  - browser_task 的 versioned schema 思路；
  - `.orchestrator/runs/<batch_id>/` 的 batch 隔离；
  - `state.json` 作为唯一恢复源；
  - `events.jsonl` append-only event log；
  - `status.txt` 作为 derived monitor；
  - `runlog.md` 作为 versioned human-readable evidence；
  - `test_orchestrator.mjs` 作为 deterministic regression 入口。
- 当前缺失、必须由 `0226` 冻结的 pieces：
  - `ops_task` request/result schema；
  - `ops_tasks/` canonical task dir；
  - `stdout/stderr/exit_code` 的 authoritative/derived/local-only 关系；
  - local / remote / host_scope / danger_level 的统一词汇；
  - ops-specific failure taxonomy；
  - remote safety stop rule 与 `CLAUDE.md` 的映射；
  - `ops_bridge proven|blocked` 的 PASS 判定前提。

## Invariants / Constraints

- 严格遵守 `CLAUDE.md` 的 HARD_RULES、CAPABILITY_TIERS、WORKFLOW。
- `0226` 是 contract-freeze iteration：
  - 允许修改 schema、tests、prompt、SSOT、operator docs、iteration docs；
  - 不允许提前做 0227 的 external executor 实现；
  - 不允许提前做 0228 的 phase / resume / ingest wiring；
  - 不允许提前做 0229 / 0230 的真实命令执行。
- `ops_task` 是 orchestrator tooling contract，不是 ModelTable runtime capability：
  - 不应改 `packages/worker-base/**`；
  - 不应通过 fill-table / system model patch 去表达 orchestrator shell bridge；
  - 也不得借此引入与本 iteration 无关的 Tier 1 runtime 变更。
- authoritative state 仍只能是 `state.json`；task dir 下的 request/result/log/artifact 都只是 local runtime evidence。
- remote safety 是上位规约，不得被 `danger_level`、executor mode 或 bridge 成功与否覆盖。
- 不允许把 inner Codex shell 的即时输出当成最终 authoritative ops result；必须依赖结构化 request/result 与双写审计面。
- 验证必须是 deterministic PASS/FAIL；不得用“命令看起来跑了”“日志大致正常”替代合同校验。

## Success Criteria

- 无上下文读者只读 `0226` 文档即可理解：
  - 为什么现有 orchestrator / ops scripts 还不足以支撑 `ops_task`；
  - `ops_task` 的 request/result/log/artifact 合同要冻结什么；
  - remote safety stop rules 如何从属于 `CLAUDE.md`；
  - 为什么 `0227-0230` 不能再自行定义核心字段与风险语义。
- `0226` 的 execution plan 能清楚列出未来要改的 schema、tests、prompt、SSOT 与 operator-doc 文件。
- resolution 中每个 Step 都有可复制执行的验证命令。
- `0227` / `0228` / `0229` / `0230` 可以把 `0226` 作为唯一上游 contract 输入，而不是继续靠聊天上下文补定义。

## Risks & Mitigations

- Risk:
  - 合同过度绑定当前某个 shell/executor 实现，导致后续 bridge 只能服务单一执行器。
  - Mitigation:
    - 0226 只冻结 request/result/evidence/risk contract，不绑定具体进程管理细节。
- Risk:
  - remote safety 仅写成“建议”，没有变成 stop rule，导致 0230 仍可能误触 forbidden ops。
  - Mitigation:
    - 在 0226 中明确 allowed / forbidden / human-decision-required 三种边界，并要求 tests / docs 一致引用。
- Risk:
  - `stdout.log` / `stderr.log` / artifact 被误当成 authoritative state，形成“有文件就算 PASS”。
  - Mitigation:
    - 明确 task dir 文件只作 local evidence；PASS 还必须有 orchestrator ingest 证据。
- Risk:
  - 0226 scope 膨胀，提前混入 0227/0228 的 bridge 或主循环实现。
  - Mitigation:
    - 把 external executor、resume、On Hold wiring、真实 smoke 全部列为 out of scope。

## Alternatives

### A. 推荐：先冻结 `ops_task` 合同，再由 0227 / 0228 / 0229 / 0230 分层实现

- 优点：
  - 字段、路径、风险语义、PASS rule 一次定清，下游迭代边界稳定。
  - local / remote shell 执行可以共享同一 contract，而不是各自长出临时协议。
- 缺点：
  - 需要先花一次 schema/docs/tests 成本，而不是立刻写 bridge。

### B. 边写 bridge 边补协议

- 优点：
  - 短期推进速度看起来更快。
- 缺点：
  - 极易把局部实现细节写成全局 contract，后续 resume、On Hold、remote safety、artifact 审计都会返工。

当前推荐：A。

## Inputs

- Created at: 2026-03-24
- Iteration ID: `0226-orchestrator-ops-task-contract-freeze`
- Planning mode: `refine`
- Upstream anchors:
  - `0218-orchestrator-browser-task-contract-freeze`
  - `0219-orchestrator-browser-agent-bridge`
  - `0220-orchestrator-browser-phase-and-regression`
  - `0221-playwright-mcp-local-smoke`
- Downstream:
  - `0224-remote-rollout-baseline`
  - `0227-orchestrator-ops-executor-bridge`
  - `0228-orchestrator-ops-phase-and-regression`
  - `0229-local-ops-bridge-smoke`
  - `0230-remote-ops-bridge-smoke`
