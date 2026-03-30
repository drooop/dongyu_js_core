---
title: "0229 — local-ops-bridge-smoke Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-25
source: ai
iteration_id: 0229-local-ops-bridge-smoke
id: 0229-local-ops-bridge-smoke
phase: phase1
---

# 0229 — local-ops-bridge-smoke Plan

## Metadata

- ID: `0229-local-ops-bridge-smoke`
- Date: `2026-03-25`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0229-local-ops-bridge-smoke`
- Planning mode: `refine`
- Depends on:
  - `0222-local-cluster-rollout-baseline`
  - `0226-orchestrator-ops-task-contract-freeze`
  - `0227-orchestrator-ops-executor-bridge`
  - `0228-orchestrator-ops-phase-and-regression`
- Downstream:
  - `0223-local-cluster-browser-evidence`

## Goal

- 用真实 `executor.mode=local_shell` 的外层 executor 贯通本地管理面 `ops_task` 闭环，证明以下 command family 不再只是 contract / regression，而能在真实本地环境中被 request materialize、outer executor 消费、`result.json`/`stdout.log`/`stderr.log`/artifact 落盘，并 authoritative ingest 到 orchestrator：
  - plain local `kubectl` readonly facts
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `bash scripts/ops/ensure_runtime_baseline.sh`
  - 必要时的 `bash scripts/ops/deploy_local.sh`
- 将“bridge proof”与“环境是否健康”分开裁决：
  - 若 local shell / authoritative ingest 断裂，结论是 `Local ops bridge blocked`
  - 若 bridge 通了但 local cluster 仍无法被 canonical ensure/deploy 收口，结论同样必须是 `blocked`，且 blocker 必须具体
  - 只有当真实本地 shell + authoritative ingest + post-ensure readiness 全部成立时，才允许给出 `Local ops bridge proven`
- 为 `0223-local-cluster-browser-evidence` 提供可消费的 local management-plane 能力，避免 `0223` 再去返修 ops bridge 或 local repair path。

## Background

- `0222-local-cluster-rollout-baseline` 已经定义本地 canonical rollout / readiness 面：
  - `scripts/ops/check_runtime_baseline.sh` 以 `dongyu` namespace 下六个 deployment ready，且 `mbr-worker-secret` / `ui-server-secret` 中 Matrix bootstrap patch 非 placeholder 作为 readiness gate；
  - `scripts/ops/ensure_runtime_baseline.sh` 先跑 `check_runtime_baseline.sh`，若 baseline unhealthy，则自动转入 `deploy_local.sh` repair path；
  - `scripts/ops/deploy_local.sh` 会串联 `deploy/env/local.env`、`sync_local_persisted_assets.sh`、Docker build、`k8s/local/*.yaml` apply、rollout restart 与 verify。
- `0226-0228` 已把 `ops_task` 做到 contract + bridge + authoritative phase：
  - `scripts/orchestrator/ops_bridge.mjs` 固定 `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/request.json|result.json|stdout.log|stderr.log|artifacts/`；
  - `scripts/orchestrator/ops_executor.mjs` 已支持 `mock|local_shell|ssh`，其中 `local_shell` 通过 `spawnSync` 执行真实 shell；
  - `scripts/orchestrator/execution_ops.mjs`、`state.mjs`、`events.mjs`、`monitor.mjs`、`iteration_register.mjs` 已能把 `ops_task` authoritative ingest 到 `state.json` / `events.jsonl` / `status.txt` / `runlog.md`。
- 当前仓库还明确区分“bridge local evidence present”和“authoritative PASS”：
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `scripts/ops/README.md`
  三者都说明：只有 task-dir 文件而没有 `state.json` / `events.jsonl` / `status.txt` / `runlog.md` 的 ops ingest，引导结论只能是 `bridge local evidence present`，不能叫 PASS。
- `scripts/orchestrator/state.mjs` 对 `ops_task` 还有一个额外 guard：
  - 若 `result.status=pass` 但 request `executor.mode === "mock"`，ingest 会转成 `ops_bridge_not_proven`。
  - 因而 `0229` 不能再用 mock regression 充当 smoke 结论，必须真正走 `local_shell`。
- `0223-local-cluster-browser-evidence` 已显式把 `0229` 作为前置，说明 local browser evidence 之前必须先证明 local ops bridge 可用。

## Problem Statement

- 截至当前代码基线，仓库已经有大量 deterministic regression，能够证明：
  - `ops_task` contract 存在；
  - bridge helper 存在；
  - main loop authoritative ingest 存在；
  - `mock` / `local_shell` / failure taxonomy 的单元级行为存在。
- 但这些 regression 仍不能代替 `0229` 所需的 environment-effective 证明：
  - 不能证明外层 executor 在本机当前环境里真的能跑 `kubectl` / `check_runtime_baseline.sh` / `ensure_runtime_baseline.sh`；
  - 不能证明当前本地 kubectl context、Docker daemon、`deploy/env/local.env`、hostPath assets、`k8s/local/*.yaml` 这些真实前置在 smoke 时仍可用；
  - 不能证明 authoritative ingest 在真实 shell 结果上依旧成立，而不是只在测试夹具上成立。
- 若跳过这轮真实 shell smoke，`0223` 的 browser failure 将无法区分：
  - Browser Task / Playwright 本身的问题；
  - local cluster stale / deploy prerequisites 缺失；
  - outer executor 明明没跑通，只有 contract 与 mock 仍是绿的。
- 因此 `0229` 的职责不是再写协议或再补 runtime，而是用现有 contract/runtime 去裁决：“当前 repo + 当前本地环境下，local ops bridge 是否真的可用”。

## Scope

### In Scope

- 使用真实 `local_shell` executor 跑通并留痕以下本地 command family：
  - plain `kubectl` readonly facts
  - canonical local readiness gate：`bash scripts/ops/check_runtime_baseline.sh`
  - canonical local ensure gate：`bash scripts/ops/ensure_runtime_baseline.sh`
  - 必要时的 explicit local repair：`bash scripts/ops/deploy_local.sh`
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
    - `docs/iterations/0229-local-ops-bridge-smoke/runlog.md`
- 对 local management-plane 给出单一最终裁决：
  - `Local ops bridge proven`
  - `Local ops bridge blocked`

### Out of Scope

- 不做 browser evidence；该职责仍留给 `0223-local-cluster-browser-evidence`。
- 不做 remote rollout / remote readiness / remote safety gate 实证；该职责仍留给 `0230-remote-ops-bridge-smoke`。
- 不再修改 `0226-0228` 已冻结的 `ops_task` contract、failure taxonomy、authoritative ingest 术语或 canonical path。
- 不新增本地 deploy helper / smoke helper 脚本；Phase 3 只允许复用现有 exported runtime 和 `scripts/ops/*.sh`。
- 不借 `0229` 顺手改 `packages/worker-base/**`、`packages/ui-*`、`deploy/sys-v1ns/**` 或其他 runtime / fill-table 面。
- 若真实 smoke 揭示 bridge/runtime 缺陷，`0229` 应记录 blocker 并停在证据层，不在同一 smoke iteration 内静默扩成修复迭代。

## Proof Surface

| Surface | Why it matters | Canonical path to prove | Required proof output |
|---|---|---|---|
| Plain local `kubectl` readonly facts | 证明 outer executor 至少能从真实本地 shell 触达当前 kubectl context，而不是只会跑 mock | `kubectl config current-context && kubectl get deploy -n dongyu` | pass result + stdout/stderr + authoritative ingest |
| Canonical local readiness gate | 证明 `check_runtime_baseline.sh` 可被真实调用，且 readiness 口径与 `0222` 一致 | `bash scripts/ops/check_runtime_baseline.sh` | 真实 pass/fail 事实，不得伪造 ready |
| Canonical local ensure gate | 证明 0229 不是手工修环境，而是经现有 `ensure_runtime_baseline.sh` 收口 | `bash scripts/ops/ensure_runtime_baseline.sh` | `baseline already healthy` 或 `auto-invoking deploy_local.sh` 的真实 shell 证据 |
| Explicit local deploy branch | 当 baseline 不健康或 review 明确要求 repair branch 证据时，证明 `deploy_local.sh` 路径本身可被 bridge 执行 | `bash scripts/ops/deploy_local.sh` | mutating task pass + post-deploy readiness |
| Authoritative ingest | 证明结果没有停留在 task dir，而是被 orchestrator 吞回 | `state.json` / `events.jsonl` / `status.txt` / `runlog.md` | `ops_task` 记录、`Ops Status:`、runlog PASS/FAIL |

## Impact Surface

### Primary execution surface

- `scripts/orchestrator/ops_executor.mjs`
- `scripts/orchestrator/ops_bridge.mjs`
- `scripts/orchestrator/execution_ops.mjs`
- `scripts/orchestrator/state.mjs`
- `scripts/orchestrator/events.mjs`
- `scripts/orchestrator/monitor.mjs`
- `scripts/orchestrator/iteration_register.mjs`

### Regression / operator reference surface

- `scripts/orchestrator/test_ops_task_contract.mjs`
- `scripts/orchestrator/test_ops_executor_bridge.mjs`
- `scripts/orchestrator/test_orchestrator.mjs`
- `docs/ssot/orchestrator_hard_rules.md`
- `docs/user-guide/orchestrator_local_smoke.md`
- `scripts/ops/README.md`

### Local management-plane command chain

- `scripts/ops/check_runtime_baseline.sh`
- `scripts/ops/ensure_runtime_baseline.sh`
- `scripts/ops/deploy_local.sh`
- `scripts/ops/sync_local_persisted_assets.sh`
- `scripts/ops/_deploy_common.sh`
- `deploy/env/local.env`
- `k8s/local/namespace.yaml`
- `k8s/local/mosquitto.yaml`
- `k8s/local/synapse.yaml`
- `k8s/local/workers.yaml`
- `k8s/local/ui-side-worker.yaml`
- `k8s/local/ui-server-nodeport.yaml`

### Runtime evidence surface

- `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/request.json`
- `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/result.json`
- `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/stdout.log`
- `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/stderr.log`
- `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/artifacts/report.json`
- `.orchestrator/runs/<batch_id>/state.json`
- `.orchestrator/runs/<batch_id>/events.jsonl`
- `.orchestrator/runs/<batch_id>/status.txt`
- `docs/iterations/0229-local-ops-bridge-smoke/runlog.md`

## Assumptions And Validation Boundary

- Assumption A:
  - 本地 canonical rollout/readiness 入口仍是 `check_runtime_baseline.sh` / `ensure_runtime_baseline.sh` / `deploy_local.sh`，不能在 Phase 3 临时发明新的 deploy flow。
  - Validation:
    - 所有真实 mutating 操作都必须经上述脚本之一触发；任何 ad-hoc `kubectl apply` 都只能作为 blocker facts，不能当 canonical repair。
- Assumption B:
  - 本地 smoke 不需要 LLM 再生成一个新协议；Phase 3 可以直接复用 `scripts/orchestrator/*.mjs` exported helpers 构造 deterministic `ops_task` batch。
  - Validation:
    - 只要 authoritative 输出仍然是 `state.json` / `events.jsonl` / `status.txt` / `runlog.md`，则可接受 inline harness；不允许为了 smoke 新增 repo helper 文件。
- Assumption C:
  - `deploy_local.sh` 是幂等、可重复的 canonical local repair path；若 Step 3 触发该脚本，不需要额外设计临时 rollback。
  - Validation:
    - rollback 只允许继续使用 `ensure_runtime_baseline.sh` / `check_runtime_baseline.sh` 去恢复或裁决，不允许 ad-hoc 手动修 cluster。
- Assumption D:
  - 0229 的成功口径是“canonical local ensure path 已被证明可用”，而不是“任何时候都必须强行再跑一次显式 `deploy_local.sh`”。
  - Validation:
    - 若 `ensure_runtime_baseline.sh` 因 baseline 已健康而 short-circuit，Phase 3 仍然可以给出 proven；只有当 baseline 不健康或 reviewer 明确要求 repair branch 证据时，direct `deploy_local.sh` 才升级为必跑项。

## Invariants / Constraints

- 严格遵守 `CLAUDE.md` 的 `HARD_RULES`、`CAPABILITY_TIERS`、`WORKFLOW`。
- `0229` 是 smoke / evidence iteration，不是 contract / runtime iteration：
  - 不允许在 Phase 3 顺手改 `ops_task` 协议；
  - 不允许把 bridge 缺陷、ops script 缺陷、cluster 环境缺陷混在一起含糊带过；
  - 发现缺陷时必须先定性，再决定是否需要新 fix iteration。
- authoritative PASS 的最低要求必须同时成立：
  - 外层 executor 真实以 `local_shell` 执行；
  - `result.json` 为 `status=pass`、`failure_kind=none`、`exit_code=0`；
  - required artifact 真正落盘；
  - `state.json.evidence.ops_tasks[]` 已记录该 task；
  - `events.jsonl` / `status.txt` / `runlog.md` 已投影或引用该结果。
- 以下情况只能判为 blocker 或 local evidence，不得写 PASS：
  - 只有 task-dir 文件，没有 authoritative ingest；
  - request 使用 `executor.mode=mock`；
  - local `kubectl` 能跑，但 canonical ensure / post-ensure readiness 仍失败；
  - direct `deploy_local.sh` 未跑且当前 baseline 明确不健康。
- Phase 1 只允许生成 `plan.md` 与 `resolution.md`；实现、命令执行、runlog 事实记录都必须等 Gate 后进入 Phase 3。

## Success Criteria

- 无上下文读者只读 `0229` 文档，就能理解：
  - 为什么 `0226-0228` 的 contract/runtime 绿灯仍不能替代 0229；
  - 为什么 `0229` 要同时证明 plain `kubectl`、canonical local ensure，以及 authoritative ingest；
  - 什么时候 direct `deploy_local.sh` 是必跑，什么时候是 conditional branch；
  - 何时应给出 `Local ops bridge proven`，何时必须给出 `blocked`。
- Phase 3 完成时，至少应满足以下可判定结果：
  - 一个真实 readonly local-shell task PASS；
  - 一个真实 ensure local-shell task PASS；
  - post-ensure `check_runtime_baseline.sh` PASS；
  - 所有 PASS 任务都在 `.orchestrator/runs/<batch_id>/...` 与 `runlog.md` 中留有可审计证据；
  - 最终结论显式收敛为：
    - `Local ops bridge proven`
    - 或 `Local ops bridge blocked`
- `0223` 可以直接消费 `0229` 的结论，而不需要再自行判断“当前 local management-plane 是否可信”。

## Risks & Mitigations

- Risk:
  - local kubectl context 指向错误环境，导致“bridge 通过”其实证明的是错误 cluster。
  - Mitigation:
    - readonly smoke 第一项必须先把 `kubectl config current-context` 和 `kubectl get deploy -n dongyu` 经 bridge 留痕。

- Risk:
  - `ensure_runtime_baseline.sh` short-circuit 后，执行者误以为 direct deploy branch 也被证明了。
  - Mitigation:
    - 在最终 verdict 中显式记录 `deploy_local.sh` 是“由 ensure 间接执行”还是“未执行/无需执行”。

- Risk:
  - 只有 `request.json` / `result.json` / `stdout.log` / `stderr.log` / `artifacts/`，却没有 authoritative ingest，导致把 bridge local evidence 误判为 PASS。
  - Mitigation:
    - 将 `state.json` / `status.txt` / `runlog.md` 引用写入 success criteria，并在 resolution 中单独安排验证。

- Risk:
  - smoke 失败后直接在同一 iteration 热修 bridge/runtime，导致 0229 scope 膨胀。
  - Mitigation:
    - 0229 只做 evidence 与裁决；若暴露实现缺陷，记录 blocker 并由后续 iteration 接手。

- Risk:
  - direct deploy 是高成本 mutating 操作，执行者为追求“完整证明”而无条件强跑。
  - Mitigation:
    - 默认先以 `ensure_runtime_baseline.sh` 为 canonical mutating entrypoint；只有基线不健康或 reviewer 明确要求 repair branch 证据时才提升为 direct deploy。

## Alternatives

### A. 推荐：plain `kubectl` + canonical `ensure_runtime_baseline.sh` + post-ensure `check_runtime_baseline.sh`，按需补 direct `deploy_local.sh`

- 优点：
  - 同时证明 outer executor、canonical ensure path 与 authoritative ingest；
  - 不会在 baseline 已健康时无意义重跑 full local deploy；
  - 与 `0222`/`0223` 的职责划分最一致。
- 缺点：
  - 需要在 runlog 中额外注明 direct deploy branch 是否被实际覆盖。

### B. 每次都强制 direct `deploy_local.sh`

- 优点：
  - repair branch 证据最完整。
- 缺点：
  - 成本高、耗时长，也可能在 baseline 已健康时制造额外扰动。

### C. 只跑 regression tests，不做真实 shell

- 优点：
  - 最快。
- 缺点：
  - 不能回答 0229 的核心问题：当前真实本地环境下 local ops bridge 是否可用。

当前推荐：A。

## Inputs

- Created at: `2026-03-25`
- Iteration ID: `0229-local-ops-bridge-smoke`
- Title: `0229 — local-ops-bridge-smoke Plan`
- Description: `0229 — local-ops-bridge-smoke Plan`
