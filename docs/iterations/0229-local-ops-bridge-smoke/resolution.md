---
title: "0229 — local-ops-bridge-smoke Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0229-local-ops-bridge-smoke
id: 0229-local-ops-bridge-smoke
phase: phase1
---

# 0229 — local-ops-bridge-smoke Resolution

## Execution Strategy

- 先做 repo-side 和 local prerequisite guard，确认本轮 smoke 运行的是当前已冻结的 `ops_task` contract/runtime，而不是一个前置就已失效的环境。
- 再用真实 `executor.mode=local_shell` 证明 plain local `kubectl` readonly facts 可以穿过 outer executor，并 authoritative ingest 到 `state.json` / `events.jsonl` / `status.txt` / `runlog.md`。
- 随后执行 canonical local ensure path：
  - 必跑 `bash scripts/ops/ensure_runtime_baseline.sh`
  - 必跑 post-ensure `bash scripts/ops/check_runtime_baseline.sh`
  - 仅在 baseline 不健康或 review 明确要求 repair branch 证据时，升级为 direct `bash scripts/ops/deploy_local.sh`
- 最后将所有 smoke batch 收敛为单一结论：
  - `Local ops bridge proven`
  - 或 `Local ops bridge blocked`
  并把 batch / task / blocker 记录进 `0229` 的 runlog。

## Delivery Boundaries

- 本 iteration 允许的改动面：
  - `.orchestrator/runs/<batch_id>/...` 下的 runtime evidence
  - `docs/iterations/0229-local-ops-bridge-smoke/runlog.md` 的 Phase 3 事实记录
  - `docs/ITERATIONS.md` 在 `On Hold` / `Completed` 等状态同步上的派生更新
- 本 iteration 不允许的改动面：
  - `0226-0228` 的 contract / bridge / authoritative ingest 实现
  - `scripts/ops/*.sh` 的业务语义
  - `packages/worker-base/**`、`packages/ui-*`、`deploy/sys-v1ns/**` 等 runtime / fill-table 面
  - 为 smoke 新增 repo helper 文件；若需要 deterministic harness，只允许使用 inline command 调用现有 exported functions
- 失败处理原则：
  - 若真实 smoke 暴露 bridge/runtime 缺陷，`0229` 负责定性与留痕，不在本 iteration 内扩 scope 直接修代码
  - 若失败纯属 local prerequisite / local cluster stale，也必须以 blocker 形式显式记录，不得把失败伪装成 ready

## Planned Deliverables

- Real local readonly evidence:
  - plain `kubectl` facts through `ops_task local_shell`
- Real local canonical readiness / repair evidence:
  - `ensure_runtime_baseline.sh`
  - post-ensure `check_runtime_baseline.sh`
  - conditional `deploy_local.sh`
- Authoritative ingest evidence:
  - `.orchestrator/runs/<batch_id>/state.json`
  - `.orchestrator/runs/<batch_id>/events.jsonl`
  - `.orchestrator/runs/<batch_id>/status.txt`
  - `docs/iterations/0229-local-ops-bridge-smoke/runlog.md`
- Final verdict:
  - `Local ops bridge proven`
  - or `Local ops bridge blocked`

## Shared Harness

Phase 3 不引入新的 repo helper 文件。以下 bash functions 是允许的最小 deterministic harness：它们只复用现有 exported modules，负责 materialize request、调用外层 executor、再做 authoritative ingest。

先在同一个 shell 里加载下面这组函数：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based

export ITERATION_ID="0229-local-ops-bridge-smoke"
export RUNLOG_PATH="/Users/drop/codebase/cowork/dongyuapp_elysia_based/docs/iterations/0229-local-ops-bridge-smoke/runlog.md"

materialize_local_ops_task() {
  node --input-type=module <<'NODE'
import { createState, addIteration, transition, commitState } from './scripts/orchestrator/state.mjs'
import { emitTransition } from './scripts/orchestrator/events.mjs'
import { refreshStatus } from './scripts/orchestrator/monitor.mjs'
import { handleExecutionOpsTaskCycle } from './scripts/orchestrator/execution_ops.mjs'

const batchId = process.env.BATCH_ID
const iterationId = process.env.ITERATION_ID
const summary = process.env.TASK_SUMMARY || process.env.TASK_COMMAND

const state = createState(batchId, `0229 smoke ${process.env.TASK_ID}`, ['prove local ops bridge'])
addIteration(state, {
  id: iterationId,
  type: 'primary',
  title: '0229 local ops bridge smoke',
  requirement: summary,
})

state.current_iteration = iterationId
const iter = state.iterations[0]
iter.status = 'active'
const previousPhase = iter.phase
transition(state, iterationId, 'EXECUTION', `EXECUTION:${process.env.TASK_ID}:materialized`)
emitTransition(state, iterationId, previousPhase, 'EXECUTION')

const outcome = handleExecutionOpsTaskCycle({
  state,
  iterationId,
  execOutput: {
    ops_tasks: [{
      task_kind: 'ops_task',
      task_id: process.env.TASK_ID,
      summary,
      command: process.env.TASK_COMMAND,
      shell: 'bash',
      cwd: '.',
      target_env: 'local',
      host_scope: 'local_cluster',
      mutating: process.env.TASK_MUTATING === 'true',
      danger_level: process.env.TASK_DANGER || 'low',
      success_assertions: [
        'command exits with code 0',
        'required artifacts are produced',
      ],
      required_artifacts: [{
        artifact_kind: 'json',
        file_name: 'report.json',
        required: true,
        media_type: 'application/json',
      }],
      executor: {
        mode: 'local_shell',
        executor_id: 'local-ops-executor',
      },
      timeout_ms: Number(process.env.TASK_TIMEOUT_MS || '45000'),
    }],
  },
  runlogPath: process.env.RUNLOG_PATH,
})

if (!outcome.handled || outcome.action !== 'await_ops_result') {
  throw new Error(`unexpected materialize outcome: ${JSON.stringify(outcome)}`)
}

commitState(state)
refreshStatus(state)
NODE
}

consume_local_ops_task() {
  bun scripts/orchestrator/ops_executor.mjs \
    --batch-id "$BATCH_ID" \
    --task-id "$TASK_ID" \
    --consumer-id "local-ops-smoke"
}

ingest_local_ops_task() {
  node --input-type=module <<'NODE'
import { loadState, commitState } from './scripts/orchestrator/state.mjs'
import { refreshStatus } from './scripts/orchestrator/monitor.mjs'
import { handleExecutionOpsTaskCycle, classifyOpsTaskFailureAction } from './scripts/orchestrator/execution_ops.mjs'
import { setOnHold, syncOnHoldDocs } from './scripts/orchestrator/scheduler.mjs'

const batchId = process.env.BATCH_ID
const iterationId = process.env.ITERATION_ID
const state = loadState(batchId)
if (!state) {
  throw new Error(`state not found for ${batchId}`)
}

const outcome = handleExecutionOpsTaskCycle({
  state,
  iterationId,
  runlogPath: process.env.RUNLOG_PATH,
})

if (!outcome.handled) {
  throw new Error('ops task was not handled during ingest')
}

if (outcome.action === 'await_ops_result') {
  throw new Error('result.json is not ready; outer executor did not produce a consumable result')
}

if (outcome.action === 'ops_task_failed') {
  const stop = classifyOpsTaskFailureAction({
    failure_kind: outcome.failure_kind,
    request: outcome.request,
  })
  setOnHold(state, iterationId, stop.reason)
  commitState(state)
  syncOnHoldDocs(state, iterationId, stop.reason)
  refreshStatus(state)
  process.stderr.write(JSON.stringify({
    action: outcome.action,
    failure_kind: outcome.failure_kind,
    reason: stop.reason,
  }, null, 2) + '\n')
  process.exit(2)
}

commitState(state)
refreshStatus(state)
NODE
}

verify_ops_task_authoritative_pass() {
  test -f ".orchestrator/runs/$BATCH_ID/ops_tasks/$TASK_ID/request.json"
  test -f ".orchestrator/runs/$BATCH_ID/ops_tasks/$TASK_ID/result.json"
  test -f ".orchestrator/runs/$BATCH_ID/ops_tasks/$TASK_ID/stdout.log"
  test -f ".orchestrator/runs/$BATCH_ID/ops_tasks/$TASK_ID/stderr.log"
  test -f ".orchestrator/runs/$BATCH_ID/ops_tasks/$TASK_ID/artifacts/report.json"

  node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs'

const batchId = process.env.BATCH_ID
const taskId = process.env.TASK_ID
const iterationId = process.env.ITERATION_ID
const state = JSON.parse(readFileSync(`.orchestrator/runs/${batchId}/state.json`, 'utf8'))
const iter = state.iterations.find(entry => entry.id === iterationId)
if (!iter) throw new Error('iteration missing from state.json')
const task = (iter.evidence?.ops_tasks || []).find(entry => entry.task_id === taskId)
if (!task) throw new Error('ops task missing from authoritative state')
if (task.status !== 'pass') throw new Error(`ops task status=${task.status}`)
if (task.failure_kind !== 'none') throw new Error(`ops task failure_kind=${task.failure_kind}`)
if (task.exit_code !== 0) throw new Error(`ops task exit_code=${task.exit_code}`)
console.log(`PASS ${taskId}`)
NODE

  rg -n -- "Ops Task: $TASK_ID|Ops Status: pass|Ops Failure Kind: none|Ops Exit Code: 0" \
    ".orchestrator/runs/$BATCH_ID/status.txt"

  rg -n -- "### Ops Task Result|Task ID: $TASK_ID|Status: pass|Failure Kind: none|Result: PASS" \
    "$RUNLOG_PATH"
}
```

Shared Harness 使用约束：

- 每次真实重跑都必须使用全新的 `BATCH_ID` 与 `TASK_ID`。
  - 原因：`ops_executor.mjs` 对已有 `result.json` 会返回 `existing_result` / `duplicate_result`，这是正确行为，不代表再次执行了 shell。
- 若想强制重跑同一 smoke task，只能二选一：
  - 重新生成新的 `BATCH_ID`
  - 或先删除旧的 `.orchestrator/runs/$BATCH_ID`
- 所有 Step 的 verification commands 都假定上面的四个函数已经在当前 shell 中加载完成。

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Freeze Preconditions And Repo Guard | 确认当前 repo contract/runtime 绿灯且 local prerequisite 存在，再进入真实 shell smoke | `scripts/orchestrator/test_{ops_task_contract,ops_executor_bridge,orchestrator}.mjs`, `scripts/ops/{check_runtime_baseline,ensure_runtime_baseline,deploy_local}.sh`, `deploy/env/local.env` | deterministic regression + local prerequisite commands | 不回退代码；只停止进入真实 smoke |
| 2 | Prove Plain Local `kubectl` Readonly Path | 证明 outer executor 可以在真实本地 shell 中执行 plain `kubectl` 并 authoritative ingest | `scripts/orchestrator/{ops_executor,execution_ops,state,events,monitor,iteration_register}.mjs`, runtime `.orchestrator/runs/<batch_id>/...`, `docs/iterations/0229-local-ops-bridge-smoke/runlog.md` | Shared Harness + state/status/runlog checks | 删除该 smoke batch 的 `.orchestrator/runs/<batch_id>` 本地产物 |
| 3 | Prove Canonical Ensure And Post-Ensure Readiness | 证明 canonical local ensure path 可用，并以 post-ensure readiness 给出环境有效性结论；必要时补 direct `deploy_local.sh` | `scripts/ops/{ensure_runtime_baseline,check_runtime_baseline,deploy_local,sync_local_persisted_assets,_deploy_common}.sh`, `deploy/env/local.env`, `k8s/local/*.yaml`, orchestrator runtime artifacts, runlog | ensure pass + post-check pass + conditional deploy proof | 用 canonical `ensure_runtime_baseline.sh` / `check_runtime_baseline.sh` 恢复或裁决，不做 ad-hoc rollback |
| 4 | Consolidate Final Verdict For `0223` | 将各 smoke batch 收敛为单一 `proven|blocked` 结论，并把可消费事实写进 runlog | `docs/iterations/0229-local-ops-bridge-smoke/runlog.md` | verdict grep | 若结论写错，只追加更正记录，不改写历史 |

## Step 1 — Freeze Preconditions And Repo Guard

- Scope:
  - 在真实 shell smoke 之前确认：
    - `ops_task` contract/regression 当前仍然通过；
    - 本机具备 local smoke 的最低前置：`kubectl`、`docker`、`deploy/env/local.env`；
    - 当前 kubectl context 至少可解析。
  - 本步不执行真实 `ops_task` shell smoke；只做 Phase 3 入口前置 guard。
- Files:
  - `scripts/orchestrator/test_ops_task_contract.mjs`
  - `scripts/orchestrator/test_ops_executor_bridge.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
  - `scripts/ops/check_runtime_baseline.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/deploy_local.sh`
  - `deploy/env/local.env`
- Execution:
  - 先验证 repo-side regression：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
    bun scripts/orchestrator/test_ops_task_contract.mjs
    bun scripts/orchestrator/test_ops_executor_bridge.mjs --case local-shell
    bun scripts/orchestrator/test_orchestrator.mjs
    ```
  - 再验证 local prerequisite：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
    command -v kubectl
    command -v docker
    test -f deploy/env/local.env
    kubectl config current-context
    ```
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_task_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs --case local-shell`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && command -v kubectl && command -v docker && test -f deploy/env/local.env && kubectl config current-context`
- Acceptance:
  - regression 全绿，说明当前 smoke 不是建立在已知红灯的 contract/runtime 上；
  - local prerequisite 齐全，说明后续 failure 可以被更准确地归因到 bridge 或 local cluster，而不是“命令根本不存在”。
- Rollback:
  - 本步不产生 versioned 变更，也不应生成 `.orchestrator/runs/0229-*` 产物；
  - 若 prerequisite 缺失，直接停止并把缺失项作为 blocker 记入 `runlog.md`，不做 ad-hoc 环境修复。

## Step 2 — Prove Plain Local `kubectl` Readonly Path

- Scope:
  - 通过 outer executor 真实执行 plain local `kubectl`，证明：
    - `local_shell` 的 outer executor 能触达本机当前 kubectl context；
    - `ops_task` 结果能 authoritative ingest 回 orchestrator；
    - `0229` 的真实 shell smoke 不是从 `check_runtime_baseline.sh` 这类复合脚本开始，而是先证明 plain local management-plane facts 可达。
- Files:
  - `scripts/orchestrator/ops_executor.mjs`
  - `scripts/orchestrator/execution_ops.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/monitor.mjs`
  - `scripts/orchestrator/iteration_register.mjs`
  - runtime `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/...`
  - `docs/iterations/0229-local-ops-bridge-smoke/runlog.md`
- Execution:
  - 使用 fresh batch 跑 plain local `kubectl` smoke：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based

    export BATCH_ID="0229-local-kubectl-$(date +%Y%m%d%H%M%S)"
    export TASK_ID="local-kubectl-facts"
    export TASK_SUMMARY="Collect local kubectl context and deployment facts through external executor"
    export TASK_COMMAND="kubectl config current-context && kubectl get deploy -n dongyu"
    export TASK_MUTATING="false"
    export TASK_DANGER="low"
    export TASK_TIMEOUT_MS="45000"

    materialize_local_ops_task
    consume_local_ops_task
    ingest_local_ops_task
    verify_ops_task_authoritative_pass

    export READONLY_BATCH_ID="$BATCH_ID"
    ```
  - 额外核查 stdout 是否真的包含 kubectl facts：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
    rg -n -- "dongyu|NAME|ui-server|mbr-worker|remote-worker" \
      ".orchestrator/runs/$READONLY_BATCH_ID/ops_tasks/local-kubectl-facts/stdout.log"
    ```
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID="$READONLY_BATCH_ID" TASK_ID="local-kubectl-facts" && verify_ops_task_authoritative_pass`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "dongyu|NAME|ui-server|mbr-worker|remote-worker" ".orchestrator/runs/$READONLY_BATCH_ID/ops_tasks/local-kubectl-facts/stdout.log"`
- Acceptance:
  - plain local `kubectl` 任务在 `local_shell` 下 PASS；
  - `state.json` / `status.txt` / `runlog.md` 都能 authoritative 引用该任务；
  - 本轮 smoke 至少已证明“outer executor 能接住真实本地 kubectl”。
- Rollback:
  - 若需要重跑，只删除本地 smoke 产物：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
    rm -rf ".orchestrator/runs/$READONLY_BATCH_ID"
    ```
  - 不做任何 repo 代码回退。

## Step 3 — Prove Canonical Ensure And Post-Ensure Readiness

- Scope:
  - 通过真实 `local_shell` 执行 canonical local ensure path，并将结果 authoritative ingest。
  - 用 post-ensure `check_runtime_baseline.sh` 再次验证 readiness。
  - 仅在 baseline 不健康或 review 明确要求 repair branch 证据时，升级到 direct `deploy_local.sh`。
- Files:
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/check_runtime_baseline.sh`
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
  - runtime `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/...`
  - `docs/iterations/0229-local-ops-bridge-smoke/runlog.md`
- Execution:
  - 先执行 canonical ensure：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based

    export BATCH_ID="0229-local-ensure-$(date +%Y%m%d%H%M%S)"
    export TASK_ID="local-ensure-baseline"
    export TASK_SUMMARY="Run canonical local ensure path through external executor"
    export TASK_COMMAND="bash scripts/ops/ensure_runtime_baseline.sh"
    export TASK_MUTATING="true"
    export TASK_DANGER="medium"
    export TASK_TIMEOUT_MS="1800000"

    materialize_local_ops_task
    consume_local_ops_task
    ingest_local_ops_task
    verify_ops_task_authoritative_pass

    export ENSURE_BATCH_ID="$BATCH_ID"
    ```
  - 读取 ensure 的真实 branch：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
    rg -n -- "baseline already healthy|auto-invoking deploy_local.sh|=== Local Deploy \\(full stack\\) ===" \
      ".orchestrator/runs/$ENSURE_BATCH_ID/ops_tasks/local-ensure-baseline/stdout.log" \
      ".orchestrator/runs/$ENSURE_BATCH_ID/ops_tasks/local-ensure-baseline/stderr.log"
    ```
  - 再做 post-ensure readiness check：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based

    export BATCH_ID="0229-local-postcheck-$(date +%Y%m%d%H%M%S)"
    export TASK_ID="local-post-ensure-baseline"
    export TASK_SUMMARY="Re-run canonical baseline gate after local ensure"
    export TASK_COMMAND="bash scripts/ops/check_runtime_baseline.sh"
    export TASK_MUTATING="false"
    export TASK_DANGER="low"
    export TASK_TIMEOUT_MS="120000"

    materialize_local_ops_task
    consume_local_ops_task
    ingest_local_ops_task
    verify_ops_task_authoritative_pass

    export POSTCHECK_BATCH_ID="$BATCH_ID"
    ```
  - 只有在以下任一条件成立时，才补 direct `deploy_local.sh`：
    - ensure 日志显示 baseline 需要 repair，但没有看到 `deploy_local.sh` 证据；
    - review 明确要求单独证明 direct deploy branch；
    - local cluster 在 ensure 后仍未通过 post-check，需要把 direct deploy 单独拿出来定位。
  - direct deploy 的 conditional branch：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based

    export BATCH_ID="0229-local-deploy-$(date +%Y%m%d%H%M%S)"
    export TASK_ID="local-deploy-full"
    export TASK_SUMMARY="Run explicit local deploy repair path through external executor"
    export TASK_COMMAND="bash scripts/ops/deploy_local.sh"
    export TASK_MUTATING="true"
    export TASK_DANGER="high"
    export TASK_TIMEOUT_MS="3600000"

    materialize_local_ops_task
    consume_local_ops_task
    ingest_local_ops_task
    verify_ops_task_authoritative_pass

    export DEPLOY_BATCH_ID="$BATCH_ID"
    ```
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID="$ENSURE_BATCH_ID" TASK_ID="local-ensure-baseline" && verify_ops_task_authoritative_pass`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "baseline already healthy|auto-invoking deploy_local.sh|=== Local Deploy \\(full stack\\) ===" ".orchestrator/runs/$ENSURE_BATCH_ID/ops_tasks/local-ensure-baseline/stdout.log" ".orchestrator/runs/$ENSURE_BATCH_ID/ops_tasks/local-ensure-baseline/stderr.log"`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID="$POSTCHECK_BATCH_ID" TASK_ID="local-post-ensure-baseline" && verify_ops_task_authoritative_pass`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "\\[check\\] baseline ready|\\[baseline\\] READY" ".orchestrator/runs/$POSTCHECK_BATCH_ID/ops_tasks/local-post-ensure-baseline/stdout.log"`
  - conditional deploy proof:
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
    if [ -n "${DEPLOY_BATCH_ID:-}" ]; then
      export BATCH_ID="$DEPLOY_BATCH_ID"
      export TASK_ID="local-deploy-full"
      verify_ops_task_authoritative_pass
      rg -n -- "=== Local Deploy \\(full stack\\) ===|=== Step 8: Apply manifests ===|=== Step 10: Wait for rollout ===|=== Local deploy complete ===" \
        ".orchestrator/runs/$DEPLOY_BATCH_ID/ops_tasks/local-deploy-full/stdout.log"
    fi
    ```
- Acceptance:
  - `local-ensure-baseline` PASS，说明 canonical ensure entrypoint 可经 bridge 执行；
  - `local-post-ensure-baseline` PASS，说明最终 readiness 被当前 repo 的 canonical local path 收口；
  - 若 direct deploy branch 被触发或被单独要求，其结果也必须 PASS；
  - 若 ensure / deploy / post-check 任一失败，结论必须转为 `Local ops bridge blocked`，并把 failing task、batch、failure kind 和 blocker 原样写入 runlog。
- Rollback:
  - canonical local rollback 只允许继续使用本仓库现有入口：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
    bash scripts/ops/ensure_runtime_baseline.sh
    bash scripts/ops/check_runtime_baseline.sh
    ```
  - 若 direct deploy 分支是为了定位而单独执行的，回退仍然是再次用 canonical ensure/check 判定是否恢复；不允许 ad-hoc `kubectl delete`、手动改 secret、手动改 hostPath 等临时回滚。

## Step 4 — Consolidate Final Verdict For `0223`

- Scope:
  - 将 Step 2/3 产生的多个 smoke batch 收敛成单一结论，并写入 `0229` runlog。
  - 让 `0223-local-cluster-browser-evidence` 只需读取 `0229` runlog，就能判断 local management-plane 是否已可消费。
- Files:
  - `docs/iterations/0229-local-ops-bridge-smoke/runlog.md`
- Execution:
  - proven 路径追加如下总结：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
    cat <<EOF >> "$RUNLOG_PATH"

    ## 0229 Verdict
    - Verdict: Local ops bridge proven
    - Plain kubectl batch: ${READONLY_BATCH_ID}
    - Ensure batch: ${ENSURE_BATCH_ID}
    - Post-ensure baseline batch: ${POSTCHECK_BATCH_ID}
    - Direct deploy batch: ${DEPLOY_BATCH_ID:-not-executed}
    - Notes: direct deploy is optional unless ensure needed repair or review explicitly required direct deploy proof.
    EOF
    ```
  - blocked 路径追加如下总结：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
    cat <<EOF >> "$RUNLOG_PATH"

    ## 0229 Verdict
    - Verdict: Local ops bridge blocked
    - Plain kubectl batch: ${READONLY_BATCH_ID:-not-executed}
    - Ensure batch: ${ENSURE_BATCH_ID:-not-executed}
    - Post-ensure baseline batch: ${POSTCHECK_BATCH_ID:-not-executed}
    - Direct deploy batch: ${DEPLOY_BATCH_ID:-not-executed}
    - Blocker: replace-this-line-with-the-first-authoritative-failure-kind-and-command
    EOF
    ```
- Verification:
  - proven 路径：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
    rg -n -- "## 0229 Verdict|Local ops bridge proven|Plain kubectl batch: ${READONLY_BATCH_ID}|Ensure batch: ${ENSURE_BATCH_ID}|Post-ensure baseline batch: ${POSTCHECK_BATCH_ID}" \
      "$RUNLOG_PATH"
    ```
  - blocked 路径：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
    rg -n -- "## 0229 Verdict|Local ops bridge blocked|Blocker:" "$RUNLOG_PATH"
    ```
- Acceptance:
  - `runlog.md` 末尾存在单一、可直接被 `0223` 消费的结论；
  - proven / blocked 不得同时存在于同一轮最终结论。
- Rollback:
  - 若 verdict 文案写错，只允许在 `runlog.md` 追加纠正记录，不重写历史 `Ops Task Result` 记录。

## Final Verification Target For 0229

- 一个 plain local `kubectl` `ops_task` 已通过真实 `local_shell` + authoritative ingest 被证明。
- canonical local ensure path 已通过真实 `local_shell` + authoritative ingest 被证明。
- post-ensure `check_runtime_baseline.sh` 已通过真实 `local_shell` + authoritative ingest 被证明。
- 若 review 需要 repair branch 证据，则 direct `deploy_local.sh` 也已通过真实 `local_shell` + authoritative ingest 被证明。
- `runlog.md` 明确给出：
  - `Local ops bridge proven`
  - 或 `Local ops bridge blocked`
- `0223-local-cluster-browser-evidence` 无需再自行判断 local ops bridge 是否可用。

## Rollback Principle

- `0229` 预期不产生 repo 代码修改；Phase 3 的主要本地产物是 `.orchestrator/runs/<batch_id>/...` 与 `runlog.md` 事实记录。
- 本地 smoke 产物需要清理时，只清理对应 batch 目录，不触碰其他 batch：
  ```bash
  cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
  rm -rf ".orchestrator/runs/$READONLY_BATCH_ID"
  rm -rf ".orchestrator/runs/$ENSURE_BATCH_ID"
  rm -rf ".orchestrator/runs/$POSTCHECK_BATCH_ID"
  if [ -n "${DEPLOY_BATCH_ID:-}" ]; then
    rm -rf ".orchestrator/runs/$DEPLOY_BATCH_ID"
  fi
  ```
- local cluster rollback 只允许回到 canonical local path：
  - `bash scripts/ops/ensure_runtime_baseline.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
- 若 smoke 暴露 bridge/runtime 缺陷：
  - 记录 authoritative failure 和 blocker；
  - 结束 `0229`；
  - 通过新 iteration 处理修复，而不是在 `0229` 内扩 scope。

## Notes

- Generated at: `2026-03-25`
- `0229` 的核心不是“本地环境一定已经是健康的”，而是“当前 repo 能否通过现有 canonical local ops path 把环境收口，并把结果 authoritative 写回 orchestrator”。
- `0229` 证明的是 local management-plane；最终浏览器效果与用户态页面证据仍由 `0223` 承担。
