---
title: "0230 — remote-ops-bridge-smoke Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0230-remote-ops-bridge-smoke
id: 0230-remote-ops-bridge-smoke
phase: phase1
---

# 0230 — remote-ops-bridge-smoke Plan

## Metadata

- ID: `0230-remote-ops-bridge-smoke`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0230-remote-ops-bridge-smoke`
- Planning mode: `refine`
- Depends on:
  - `0226-orchestrator-ops-task-contract-freeze`
  - `0227-orchestrator-ops-executor-bridge`
  - `0228-orchestrator-ops-phase-and-regression`
- Precedent to mirror:
  - `0229-local-ops-bridge-smoke`
- Downstream:
  - `0224-remote-rollout-baseline`
  - `0225-remote-browser-evidence`

## Goal

- 用真实 outer executor 贯通 remote management-plane 的最小可审计闭环，证明以下 command family 不再只是 contract / regression，而能在当前 repo 与当前 cloud host 上被 request materialize、consumer 执行、`result.json` / `stdout.log` / `stderr.log` / artifact 落盘，并 authoritative ingest 到 orchestrator：
  - remote readonly / rke2 guard：
    - `sudo -n bash /home/wwpic/dongyuapp/scripts/ops/remote_preflight_guard.sh`
    - `kubectl get deploy -n dongyu`
  - remote source sync：
    - `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host dongyudigital.com --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision <rev>`
  - remote whitelist rollout / readiness：
    - `sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_app.sh --target ui-server --revision <rev>`
    - `kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`
- 将“bridge proof”与“environment effective”分层裁决：
  - 若 outer executor、SSH transport、remote guard、source sync 或 authoritative ingest 任一断裂，结论必须是 `Remote ops bridge blocked`。
  - 若 bridge 已经贯通，但 canonical whitelist rollout / readiness / source gate 仍失败，结论同样必须是 `blocked`，且 blocker 必须具体到命令族与 failure kind。
  - 只有当 readonly facts、source sync、whitelist rollout、post-rollout readiness 与 authoritative ingest 全部成立时，才允许给出 `Remote ops bridge proven`。
- 为 `0224-remote-rollout-baseline` 提供可信 remote execution surface，使 `0224` 可以专注于完整 remote baseline rollout / readiness / source gate，不再返修 `ops_task` bridge 或 SSH execution boundary。

## Background

- `0226-0228` 已把 `ops_task` 做到 contract + bridge + authoritative phase：
  - `scripts/orchestrator/ops_bridge.mjs` 固定 `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/request.json|result.json|stdout.log|stderr.log|artifacts/`。
  - `scripts/orchestrator/ops_executor.mjs` 已定义 `executor.mode = mock|local_shell|ssh` 的 bridge 语义，以及 `remote_guard_blocked` / `forbidden_remote_op` / `human_decision_required` 等 failure taxonomy。
  - `scripts/orchestrator/execution_ops.mjs`、`state.mjs`、`events.mjs`、`monitor.mjs`、`iteration_register.mjs` 已能把 `ops_task` authoritative ingest 到 `state.json` / `events.jsonl` / `status.txt` / `runlog.md`。
- `0229-local-ops-bridge-smoke` 已证明本地 `local_shell` 路径能够跑通 plain `kubectl` 与 canonical local ensure / readiness，但该结果不能替代 remote smoke：
  - `0229` 不能证明 `executor.mode=ssh` 在真实 cloud target 上可用。
  - `0229` 不能证明 `sudo -n`、remote root guard、remote repo path、`deploy_cloud_app.sh` / `deploy_cloud_full.sh` 以及远端 source gate 在当前环境中仍然有效。
- 当前仓库已经为 remote ops 定义了明确边界：
  - `CLAUDE.md REMOTE_OPS_SAFETY` 禁止直接碰 `k3s` / `rke2` / `containerd` / `docker` / `sshd` / networking / `/etc/rancher/` / firewall / CNI / network interface。
  - `scripts/ops/remote_preflight_guard.sh` 固定 remote guard 口径：目标必须是 `rke2`，`k3s` 不能 active，`ctr` 必须能连到有效 socket。
  - `scripts/ops/sync_cloud_source.sh` 固定 cloud source sync 口径：canonical login user = `drop`，remote repo path = `/home/wwpic/dongyuapp`，repo owner = `wwpic`。
  - `scripts/ops/deploy_cloud_app.sh` 与 `scripts/ops/deploy_cloud_full.sh` 固定 remote whitelist rollout 与 source hash gate。
- `0224-remote-rollout-baseline` 已显式依赖 `0230`，说明 remote rollout baseline 之前，必须先证明 remote ops bridge 可用。

## Problem Statement

- 截至当前代码基线，repo 已有 deterministic regression，可以证明：
  - `ops_task` schema、canonical exchange path、authoritative ingest 与 remote safety taxonomy 存在；
  - `ssh` 边界、`remote_guard_blocked`、`forbidden_remote_op`、`human_decision_required` 等测试夹具可在单元 / 集成级跑通。
- 但这些 regression 不能替代 `0230` 所需的 environment-effective 证明：
  - 不能证明当前执行机器真的能通过 SSH 触达 `dongyudigital.com`。
  - 不能证明远端当前仍保有 `/home/wwpic/dongyuapp`、`deploy/env/cloud.env`、`sudo -n` 权限与 `rke2` containerd socket。
  - 不能证明 `sync_cloud_source.sh`、`deploy_cloud_app.sh` 的真实 shell 输出，仍能被 authoritative ingest 正确吸收，而不是只在 mock / fixture 上为绿。
  - 不能证明 remote rollout 的 source hash gate 与 post-rollout readiness 在当前 revision 上仍可被 bridge 消费。
- 如果跳过 `0230`，`0224` 的失败将无法分辨：
  - 是 remote bridge / SSH transport 本身坏了；
  - 是 remote guard / root 权限 / source sync 路径失效了；
  - 还是 whitelist rollout / readiness 真正失败。
- 因此 `0230` 的职责不是修改协议或修 runtime，而是基于现有 contract / runtime / runbook，对“当前 repo + 当前远端环境下，remote ops bridge 是否真的可用”做出单一裁决。

## Scope

### In Scope

- 使用真实 `ops_task` 证明以下 remote command families 可被 authoritative 执行：
  - `executor.mode=ssh` 的 remote readonly / guard path。
  - `executor.mode=local_shell` 的 `sync_cloud_source.sh` path，用于把当前 revision 推送到 canonical remote repo。
  - `executor.mode=ssh` 的 remote whitelist app deploy path。
  - `executor.mode=ssh` 的 post-rollout readiness path。
- 为每个 smoke task 同时产出两层证据：
  - bridge-local exchange：
    - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/request.json`
    - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/result.json`
    - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/stdout.log`
    - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/stderr.log`
    - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/artifacts/report.json`
  - authoritative ingest：
    - `.orchestrator/runs/<batch_id>/state.json`
    - `.orchestrator/runs/<batch_id>/events.jsonl`
    - `.orchestrator/runs/<batch_id>/status.txt`
    - `docs/iterations/0230-remote-ops-bridge-smoke/runlog.md`
- 给 remote management-plane 形成单一最终裁决：
  - `Remote ops bridge proven`
  - `Remote ops bridge blocked`

### Out Of Scope

- 不做 remote browser evidence；该职责仍留给 `0225-remote-browser-evidence`。
- 不把 `0230` 扩成完整 remote baseline rollout；该职责仍留给 `0224-remote-rollout-baseline`。
- 不修改 `0226-0228` 已冻结的 `ops_task` contract、failure taxonomy、canonical path 或 authoritative ingest 语义。
- 不修改 `scripts/ops/*.sh` 的业务语义，不新增 repo helper 文件，不新增新的 remote deploy flow。
- 不默认执行 `kubectl delete namespace`、`helm uninstall`、cluster-wide destructive 操作，也不通过任何方式触碰 `CLAUDE.md REMOTE_OPS_SAFETY` 的 forbidden surface。
- 不默认把 smoke 升级成 full-stack deploy。默认 mutating proof 只要求 `deploy_cloud_app.sh --target ui-server --revision <rev>`；只有当 app-target 结果无法证明 shared rollout path，或 review 明确要求 full-stack proof 时，才允许升级为 `deploy_cloud_full.sh --rebuild`。
- 若真实 smoke 揭示 bridge/runtime/remote prereq 缺陷，`0230` 负责记录 blocker 与 failure kind，不在同一 smoke iteration 内静默扩 scope 直接修代码。

## Proof Surface

| Surface | Why it matters | Canonical path to prove | Required proof output |
|---|---|---|---|
| Remote readonly + rke2 guard | 证明 `executor.mode=ssh` 可以真实触达 cloud host，且目标仍是 `rke2` 而非误入 `k3s` / 错 socket / 无 root | `sudo -n bash /home/wwpic/dongyuapp/scripts/ops/remote_preflight_guard.sh && kubectl get deploy -n dongyu` | pass result + stdout/stderr + authoritative ingest |
| Remote source sync | 证明当前 local revision 能通过 canonical login user / remote repo path 被推送到远端仓库，而不是只会执行本地 fixture | `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host dongyudigital.com --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision <rev>` | pass result + `.deploy-source-revision` 对齐 + authoritative ingest |
| Remote whitelist app deploy | 证明 remote mutating whitelist path 可以经 bridge 真实执行，并通过内建 remote guard 与 source hash gate | `sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_app.sh --target ui-server --revision <rev>` | pass result + deploy stdout/stderr + authoritative ingest |
| Post-rollout readiness | 证明 rollout 不是只“命令返回 0”，而是当前 deployment ready | `kubectl -n dongyu rollout status deployment/ui-server --timeout=180s && kubectl get deploy -n dongyu ui-server` | pass result + deployment readiness stdout + authoritative ingest |
| Authoritative ingest | 证明结果没有停留在 task dir，而被 orchestrator 吞回 | `state.json` / `events.jsonl` / `status.txt` / `runlog.md` | `ops_task` 记录、`Ops Status:`、runlog PASS/FAIL |

## Impact Surface

### Primary Execution Surface

- `scripts/orchestrator/ops_executor.mjs`
- `scripts/orchestrator/ops_bridge.mjs`
- `scripts/orchestrator/execution_ops.mjs`
- `scripts/orchestrator/state.mjs`
- `scripts/orchestrator/events.mjs`
- `scripts/orchestrator/monitor.mjs`
- `scripts/orchestrator/iteration_register.mjs`

### Regression / Operator Reference Surface

- `scripts/orchestrator/test_ops_task_contract.mjs`
- `scripts/orchestrator/test_ops_executor_bridge.mjs`
- `scripts/orchestrator/test_orchestrator.mjs`
- `docs/ssot/orchestrator_hard_rules.md`
- `scripts/ops/README.md`
- `CLAUDE.md`

### Remote Management-Plane Command Chain

- `scripts/ops/remote_preflight_guard.sh`
- `scripts/ops/sync_cloud_source.sh`
- `scripts/ops/deploy_cloud_app.sh`
- `scripts/ops/deploy_cloud_full.sh`
- `scripts/ops/_deploy_common.sh`
- `deploy/env/cloud.env`
- `k8s/Dockerfile.ui-server`
- `k8s/cloud/workers.yaml`
- `k8s/cloud/ui-side-worker.yaml`
- `k8s/cloud/synapse.yaml`
- `k8s/cloud/mbr-update.yaml`

### Runtime Evidence Surface

- `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/request.json`
- `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/result.json`
- `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/stdout.log`
- `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/stderr.log`
- `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/artifacts/report.json`
- `.orchestrator/runs/<batch_id>/state.json`
- `.orchestrator/runs/<batch_id>/events.jsonl`
- `.orchestrator/runs/<batch_id>/status.txt`
- `docs/iterations/0230-remote-ops-bridge-smoke/runlog.md`

## Assumptions And Validation Boundary

- Assumption A:
  - canonical cloud target 仍是 `drop@dongyudigital.com`，remote repo 仍是 `/home/wwpic/dongyuapp`，repo owner 仍是 `wwpic`。
  - Validation:
    - Step 1 与 Step 3 必须分别验证 SSH reachability 与 `.deploy-source-revision` / remote repo path。

- Assumption B:
  - `ops_executor.mjs` CLI 自身并不会替 Phase 3 自动提供真实 SSH runner；因此 `0230` 必须像 `0229` 一样，通过 inline harness 复用 exported modules，而不是新增 repo helper 文件。
  - Validation:
    - Phase 3 只能使用 `consumeOneOpsTask({ sshRunner, remoteGuardRunner })` 一类现有导出；若需要新增持久化 helper，说明 planning 边界错误，应返回 Phase 1。

- Assumption C:
  - 默认 mutating smoke 只需证明 single-target whitelist deploy path 即可，推荐目标为 `ui-server`，因为它在较小 blast radius 下同时覆盖 source hash gate 与 rollout status。
  - Validation:
    - 若 `deploy_cloud_app.sh --target ui-server` 能完整通过 remote guard、source gate 与 post-rollout readiness，则可给出 `Remote ops bridge proven`；只有当 reviewer 明确要求 full-stack proof，或 app-target 结果无法判断 shared rollout path 时，才升级为 `deploy_cloud_full.sh --rebuild`。

- Assumption D:
  - `0230` 的成功口径是“remote ops bridge + canonical whitelist path 可用”，不是“远端业务环境已完成 browser-level effective 验收”。
  - Validation:
    - 最终结论只能是 `Remote ops bridge proven|blocked`；不得越权写成 `environment effective`。

- Assumption E:
  - 任何 remote mutating `ops_task` 都必须先经过 `remote_preflight_guard.sh`，并保留 `remote_guard_blocked` / `forbidden_remote_op` / `human_decision_required` 的原始 failure taxonomy。
  - Validation:
    - Phase 3 任何 mutating task 的 request / result / runlog 都必须显式体现 remote guard 及 failure kind；一旦出现 forbidden 或 critical-risk 命令，必须 stop / On Hold。

## Invariants / Constraints

- 严格遵守 `CLAUDE.md` 的 `HARD_RULES`、`CAPABILITY_TIERS`、`WORKFLOW`、`REMOTE_OPS_SAFETY`。
- `0230` 是 smoke / evidence iteration，不是 contract / runtime iteration：
  - 不允许在 Phase 3 顺手改 `ops_task` 协议。
  - 不允许把 bridge 缺陷、SSH transport 缺陷、remote prereq 缺陷、rollout 失败混在一起含糊带过。
  - 发现缺陷时必须先定性，再决定是否需要新 fix iteration。
- authoritative PASS 的最低要求必须同时成立：
  - 真实执行使用 `executor.mode=ssh` 或 `executor.mode=local_shell`，且命令族与 resolution 约定一致；
  - `result.json` 为 `status=pass`、`failure_kind=none`、`exit_code=0`；
  - required artifact 真正落盘；
  - `state.json.evidence.ops_tasks[]` 已记录该 task；
  - `events.jsonl` / `status.txt` / `runlog.md` 已投影或引用该结果。
- 以下情况只能判为 blocker 或 local evidence，不得写 PASS：
  - 只有 task-dir 文件，没有 authoritative ingest；
  - request 使用 `executor.mode=mock`；
  - source sync 成功，但 whitelist deploy 或 post-rollout readiness 失败；
  - mutating remote task 没有通过 remote guard；
  - 命令命中 `forbidden_remote_op` 或 `human_decision_required`。
- Phase 1 只允许生成 `plan.md` 与 `resolution.md`；实现、命令执行、runlog 事实记录都必须等 Gate 通过后进入 Phase 3。

## Success Criteria

- 无上下文读者只读 `0230` 文档，就能理解：
  - 为什么 `0226-0228` 的 contract / regression 不能替代 0230；
  - 为什么 0230 必须同时证明 readonly guard、source sync、whitelist rollout 与 post-rollout readiness；
  - 为什么默认 mutating smoke 选择 `deploy_cloud_app.sh --target ui-server --revision <rev>`，以及何时才升级为 full-stack deploy；
  - 何时应给出 `Remote ops bridge proven`，何时必须给出 `blocked`。
- Phase 3 完成时，至少应满足以下可判定结果：
  - 一个真实 remote readonly / rke2 guard task PASS；
  - 一个真实 remote source sync task PASS；
  - 一个真实 remote whitelist app deploy task PASS；
  - 一个真实 post-rollout readiness task PASS；
  - 所有 PASS 任务都在 `.orchestrator/runs/<batch_id>/...` 与 `runlog.md` 中留有可审计证据；
  - 最终结论显式收敛为：
    - `Remote ops bridge proven`
    - 或 `Remote ops bridge blocked`
- `0224` 可以直接消费 `0230` 的结论，而不需要自行判断“当前 remote management-plane 是否可信”。

## Risks & Mitigations

- Risk:
  - SSH target 指向错误主机，导致“bridge 通过”证明的不是 canonical remote host。
  - Mitigation:
    - Step 1 先做 raw SSH prerequisite；Step 2 的 readonly task 必须包含 `remote_preflight_guard.sh` 与 `kubectl get deploy -n dongyu`。

- Risk:
  - 远端 `sudo -n` 不可用，导致 rollout 失败看起来像普通 `nonzero_exit`。
  - Mitigation:
    - Step 2 直接经 bridge 跑 `sudo -n bash /home/wwpic/dongyuapp/scripts/ops/remote_preflight_guard.sh`；若失败，必须以具体 failure 终止，不继续进入 mutating rollout。

- Risk:
  - source sync 成功，但 remote deploy 实际仍使用旧 revision。
  - Mitigation:
    - Step 3 必须验证 `.deploy-source-revision` 与 local revision 一致；Step 4 必须通过 `deploy_cloud_app.sh` 的 source hash gate。

- Risk:
  - 只看到 `request.json` / `result.json` / `stdout.log` / `stderr.log` / `artifacts/`，却没有 authoritative ingest，于是误判 PASS。
  - Mitigation:
    - 结论必须同时检查 `state.json` / `events.jsonl` / `status.txt` / `runlog.md`；缺任何一层都只能叫 `bridge local evidence present`。

- Risk:
  - app-target deploy 通过，但 shared stack 仍有隐性问题，导致 `0224` 假设过度。
  - Mitigation:
    - 文档明确 `0230` 只证明 remote ops bridge 与最小 whitelist rollout path；`0224` 仍需做完整 remote baseline rollout / readiness。

## Alternatives

### A. 推荐：以 `deploy_cloud_app.sh --target ui-server --revision <rev>` 作为默认 mutating smoke

- 优点：
  - 覆盖 remote guard、remote build、`ctr import`、rollout、source hash gate 与 post-rollout readiness。
  - blast radius 小于 full-stack deploy，更适合 smoke proof。
- 缺点：
  - 只证明单目标 app deploy path，不等于完整 remote baseline rollout。

### B. 直接用 `deploy_cloud_full.sh --rebuild` 作为唯一 mutating smoke

- 优点：
  - 一次性覆盖全部 cloud deployment surface。
- 缺点：
  - blast radius 更大，调试成本更高，不适合作为默认 smoke 路径。

### C. 只做 remote readonly / guard，不做真实 mutating rollout

- 优点：
  - 风险最小。
- 缺点：
  - 只能证明 SSH reachability 与 guard，本质上不能证明 remote whitelist rollout path 可被 bridge 消费，不满足 `0230` 目标。

当前推荐：A。

## Inputs

- Created at: `2026-03-26`
- Iteration ID: `0230-remote-ops-bridge-smoke`
- Depends on:
  - `0226-orchestrator-ops-task-contract-freeze`
  - `0227-orchestrator-ops-executor-bridge`
  - `0228-orchestrator-ops-phase-and-regression`
- Precedent to mirror:
  - `0229-local-ops-bridge-smoke`
