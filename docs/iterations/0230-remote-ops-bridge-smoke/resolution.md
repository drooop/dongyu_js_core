---
title: "0230 — remote-ops-bridge-smoke Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0230-remote-ops-bridge-smoke
id: 0230-remote-ops-bridge-smoke
phase: phase1
---

# 0230 — remote-ops-bridge-smoke Resolution

## Execution Strategy

- 先冻结 repo-side contract/runtime 与 remote prerequisite，确保本轮 smoke 运行的确是当前已冻结的 `ops_task` contract、canonical remote target 与 whitelist deploy path，而不是一个前置已失效的环境。
- 再通过最小 inline harness 复用现有 exported orchestrator modules，证明 `executor.mode=ssh` 的 remote readonly / rke2 guard path 可以被真实 materialize、outer executor 消费，并 authoritative ingest 到 `state.json` / `events.jsonl` / `status.txt` / `runlog.md`。
- 随后执行 remote mutating whitelist path：
  - 先证明 `sync_cloud_source.sh` 可以把当前 revision 同步到 canonical remote repo。
  - 再证明 `deploy_cloud_app.sh --target ui-server --revision <rev>` 可以在 remote guard、source gate 与 rollout 下完整通过。
  - 最后以 post-rollout `kubectl rollout status` / `kubectl get deploy` 收口 readiness。
- 最终把所有 smoke batch 收敛为单一结论：
  - `Remote ops bridge proven`
  - 或 `Remote ops bridge blocked`
  并把 batch / task / blocker 记录进 `0230` 的 runlog，供 `0224` / `0225` 直接消费。

## Delivery Boundaries

- 本 iteration 允许的改动面：
  - `.orchestrator/runs/<batch_id>/...` 下的 runtime evidence
  - `docs/iterations/0230-remote-ops-bridge-smoke/runlog.md` 的 Phase 3 事实记录
  - `docs/ITERATIONS.md` 在 `On Hold` / `Completed` 等状态同步上的派生更新
- 本 iteration 不允许的改动面：
  - `0226-0228` 的 contract / bridge / authoritative ingest 实现
  - `scripts/ops/*.sh` 的业务语义
  - `packages/worker-base/**`、`packages/ui-*`、`deploy/sys-v1ns/**` 等 runtime / fill-table 面
  - 为 smoke 新增 repo helper 文件；若需要 deterministic harness，只允许使用 inline command 调用现有 exported functions
  - 默认 full-stack deploy；除非 Step 4 明确触发升级条件，否则不把 `deploy_cloud_full.sh --rebuild` 当作必跑项
- 失败处理原则：
  - 若真实 smoke 暴露 bridge/runtime/SSH/remote guard 缺陷，`0230` 负责定性与留痕，不在本 iteration 内扩 scope 直接修代码
  - 若失败纯属 remote prerequisite、remote source sync、remote deploy 或 remote readiness 失效，也必须以 blocker 形式显式记录，不得把失败伪装成 ready

## Planned Deliverables

- Real remote readonly evidence:
  - `executor.mode=ssh` + `remote_preflight_guard.sh`
  - `kubectl get deploy -n dongyu`
- Real remote source-sync evidence:
  - `sync_cloud_source.sh` 真实执行
  - remote `.deploy-source-revision` 对齐
- Real remote whitelist rollout evidence:
  - `deploy_cloud_app.sh --target ui-server --revision <rev>`
  - post-rollout `kubectl rollout status` / `kubectl get deploy`
- Authoritative ingest evidence:
  - `.orchestrator/runs/<batch_id>/state.json`
  - `.orchestrator/runs/<batch_id>/events.jsonl`
  - `.orchestrator/runs/<batch_id>/status.txt`
  - `docs/iterations/0230-remote-ops-bridge-smoke/runlog.md`
- Final verdict:
  - `Remote ops bridge proven`
  - or `Remote ops bridge blocked`

## Shared Harness

Phase 3 不引入新的 repo helper 文件。以下 bash functions 是允许的最小 deterministic harness：它们只复用现有 exported modules，负责 materialize request、调用 outer executor、再做 authoritative ingest。

先在同一个 shell 里加载下面这组函数：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based

export ITERATION_ID="0230-remote-ops-bridge-smoke"
export RUNLOG_PATH="/Users/drop/codebase/cowork/dongyuapp_elysia_based/docs/iterations/0230-remote-ops-bridge-smoke/runlog.md"
export REMOTE_SSH_USER="${REMOTE_SSH_USER:-drop}"
export REMOTE_SSH_HOST="${REMOTE_SSH_HOST:-dongyudigital.com}"
export REMOTE_REPO="${REMOTE_REPO:-/home/wwpic/dongyuapp}"
export REMOTE_REPO_OWNER="${REMOTE_REPO_OWNER:-wwpic}"
export REMOTE_SOURCE_REV="${REMOTE_SOURCE_REV:-$(git -C /Users/drop/codebase/cowork/dongyuapp_elysia_based rev-parse --short HEAD)}"

materialize_ops_task() {
  node --input-type=module <<'NODE'
import { createState, addIteration, transition, commitState } from './scripts/orchestrator/state.mjs'
import { emitTransition } from './scripts/orchestrator/events.mjs'
import { refreshStatus } from './scripts/orchestrator/monitor.mjs'
import { handleExecutionOpsTaskCycle } from './scripts/orchestrator/execution_ops.mjs'

const batchId = process.env.BATCH_ID
const iterationId = process.env.ITERATION_ID
const summary = process.env.TASK_SUMMARY || process.env.TASK_COMMAND
const executorMode = process.env.TASK_EXECUTOR_MODE || 'ssh'

const state = createState(batchId, `0230 smoke ${process.env.TASK_ID}`, ['prove remote ops bridge'])
addIteration(state, {
  id: iterationId,
  type: 'primary',
  title: '0230 remote ops bridge smoke',
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
      target_env: process.env.TASK_TARGET_ENV || 'remote',
      host_scope: process.env.TASK_HOST_SCOPE || 'remote_cluster',
      mutating: process.env.TASK_MUTATING === 'true',
      danger_level: process.env.TASK_DANGER || 'medium',
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
        mode: executorMode,
        executor_id: executorMode === 'ssh' ? 'ssh-ops-executor' : 'local-ops-executor',
      },
      timeout_ms: Number(process.env.TASK_TIMEOUT_MS || '600000'),
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

consume_ops_task() {
  node --input-type=module <<'NODE'
import { spawnSync } from 'node:child_process'
import { consumeOneOpsTask } from './scripts/orchestrator/ops_executor.mjs'

function normalizeOutput(value) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function sshArgsFor(command) {
  const target = `${process.env.REMOTE_SSH_USER}@${process.env.REMOTE_SSH_HOST}`
  return ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', target, 'bash', '-lc', command]
}

function runSshCommand(command, timeoutMs) {
  const child = spawnSync('ssh', sshArgsFor(command), {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  })

  if (child.error) {
    return {
      ok: false,
      failure_kind: child.error.code === 'ETIMEDOUT' ? 'timeout' : 'target_unreachable',
      summary: child.error.code === 'ETIMEDOUT' ? 'ssh command timed out' : 'ssh transport failed',
      stdout: normalizeOutput(child.stdout),
      stderr: normalizeOutput(child.stderr || child.error.message),
      exit_code: null,
    }
  }

  return {
    exit_code: child.status ?? 0,
    stdout: normalizeOutput(child.stdout),
    stderr: normalizeOutput(child.stderr),
    summary: 'ssh command finished.',
  }
}

function runRemoteGuard() {
  const guardPath = `${process.env.REMOTE_REPO}/scripts/ops/remote_preflight_guard.sh`
  const target = `${process.env.REMOTE_SSH_USER}@${process.env.REMOTE_SSH_HOST}`
  const child = spawnSync('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=20',
    target,
    'sudo',
    '-n',
    'bash',
    guardPath,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
  })

  if (child.error) {
    return {
      ok: false,
      stdout: normalizeOutput(child.stdout),
      stderr: normalizeOutput(child.stderr || child.error.message),
    }
  }

  return {
    ok: (child.status ?? 1) === 0,
    stdout: normalizeOutput(child.stdout),
    stderr: normalizeOutput(child.stderr),
  }
}

const outcome = consumeOneOpsTask({
  batchId: process.env.BATCH_ID,
  taskId: process.env.TASK_ID,
  consumerId: process.env.CONSUMER_ID || 'remote-ops-smoke',
  rootDir: process.cwd(),
  sshRunner: ({ request }) => runSshCommand(request.command, request.timeout_ms),
  remoteGuardRunner: () => runRemoteGuard(),
})

console.log(JSON.stringify(outcome, null, 2))
if (outcome.status === 'bridge_conflict') process.exit(1)
if (outcome.status === 'claimed_elsewhere') process.exit(2)
NODE
}

ingest_ops_task() {
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
- `TASK_EXECUTOR_MODE=ssh` 用于远端主机上的命令；`TASK_EXECUTOR_MODE=local_shell` 仅用于本机发起但会影响远端的 `sync_cloud_source.sh`。
- 所有 remote mutating task 都必须使用：
  - `TASK_TARGET_ENV=remote`
  - `TASK_MUTATING=true`
  这样 `consume_ops_task` 才会先跑 remote guard。
- 所有 Step 的 verification commands 都假定上面的四个函数已经在当前 shell 中加载完成。

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Freeze Preconditions And Repo Guard | 确认当前 repo contract/runtime 绿灯且 remote prerequisite 存在，再进入真实 remote shell smoke | `scripts/orchestrator/test_{ops_task_contract,ops_executor_bridge,orchestrator}.mjs`, `scripts/ops/{remote_preflight_guard,sync_cloud_source,deploy_cloud_app,deploy_cloud_full}.sh`, `deploy/env/cloud.env` | deterministic regression + local/remote prerequisite commands | 不回退代码；只停止进入真实 smoke |
| 2 | Prove Remote Readonly And RKE2 Guard | 证明 `executor.mode=ssh` 可以真实执行 remote readonly / guard，并 authoritative ingest | `scripts/orchestrator/{ops_executor,execution_ops,state,events,monitor,iteration_register}.mjs`, `scripts/ops/remote_preflight_guard.sh`, runtime `.orchestrator/runs/<batch_id>/...`, `docs/iterations/0230-remote-ops-bridge-smoke/runlog.md` | Shared Harness + state/status/runlog checks + stdout grep | 删除该 smoke batch 的 `.orchestrator/runs/<batch_id>` 本地产物 |
| 3 | Prove Remote Source Sync Path | 证明 canonical remote source sync 可以经 outer executor 把当前 revision 推送到 canonical remote repo | `scripts/ops/sync_cloud_source.sh`, `deploy/env/cloud.env`, remote `.deploy-source-revision`, orchestrator runtime artifacts, runlog | Shared Harness + remote revision check | 用同一脚本把已知 good revision 重新 sync 到 remote repo |
| 4 | Prove Whitelist App Rollout And Post-Rollout Readiness | 证明 default remote mutating whitelist path 与 post-rollout readiness 可用；必要时才升级到 full-stack deploy | `scripts/ops/{deploy_cloud_app,deploy_cloud_full,_deploy_common}.sh`, `k8s/Dockerfile.ui-server`, `k8s/cloud/*.yaml`, orchestrator runtime artifacts, runlog | Shared Harness + deploy/readiness greps + authoritative ingest | 以已知 good revision 重新执行 `sync_cloud_source.sh` + `deploy_cloud_app.sh`；如必须回整栈，仅允许 `deploy_cloud_full.sh --rebuild` |
| 5 | Consolidate Final Verdict For `0224` / `0225` | 将各 smoke batch 收敛为单一 `proven|blocked` 结论，并把可消费事实写进 runlog / iteration status | `docs/iterations/0230-remote-ops-bridge-smoke/runlog.md`, `docs/ITERATIONS.md` | verdict grep + iteration status grep | 若结论写错，只追加更正记录；若状态错，同步修正索引，不改写证据 |

## Step 1 — Freeze Preconditions And Repo Guard

- Scope:
  - 在真实 remote shell smoke 之前确认：
    - `ops_task` contract / bridge / orchestrator regression 当前仍然通过；
    - 执行机具备 remote smoke 的最低前置：`ssh`、本地 git revision、remote SSH reachability；
    - canonical remote repo 与 remote env 文件至少存在。
  - 本步不执行真实 `ops_task` smoke；只做 Phase 3 入口前置 guard。
- Files:
  - `scripts/orchestrator/test_ops_task_contract.mjs`
  - `scripts/orchestrator/test_ops_executor_bridge.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
  - `scripts/ops/remote_preflight_guard.sh`
  - `scripts/ops/sync_cloud_source.sh`
  - `scripts/ops/deploy_cloud_app.sh`
  - `scripts/ops/deploy_cloud_full.sh`
  - `deploy/env/cloud.env`
- Execution:
  - 先验证 repo-side regression：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
    bun scripts/orchestrator/test_ops_task_contract.mjs
    bun scripts/orchestrator/test_ops_executor_bridge.mjs --case ssh-boundary
    bun scripts/orchestrator/test_orchestrator.mjs
    ```
  - 再验证 remote prerequisite：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
    command -v ssh
    git rev-parse --short HEAD
    test -f deploy/env/cloud.env
    ssh -o BatchMode=yes -o ConnectTimeout=20 drop@dongyudigital.com "echo remote-ssh-ok"
    ssh -o BatchMode=yes -o ConnectTimeout=20 drop@dongyudigital.com "test -d /home/wwpic/dongyuapp && test -f /home/wwpic/dongyuapp/deploy/env/cloud.env"
    ```
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_task_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs --case ssh-boundary`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && command -v ssh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git rev-parse --short HEAD`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && test -f deploy/env/cloud.env`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && ssh -o BatchMode=yes -o ConnectTimeout=20 drop@dongyudigital.com "echo remote-ssh-ok"`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && ssh -o BatchMode=yes -o ConnectTimeout=20 drop@dongyudigital.com "test -d /home/wwpic/dongyuapp && test -f /home/wwpic/dongyuapp/deploy/env/cloud.env"`
- Acceptance:
  - repo-side `ops_task` contract/runtime 绿灯仍成立；
  - 执行机能通过 SSH 触达 canonical remote host；
  - remote repo path 与 remote `deploy/env/cloud.env` 存在；
  - 任何一项 prerequisite 失败都必须停止，不进入 Step 2。
- Rollback:
  - 本步不做 remote mutation，无需 remote rollback；若任一 prerequisite 失败，只记录 blocker 并停止进入真实 smoke。

## Step 2 — Prove Remote Readonly And RKE2 Guard

- Scope:
  - 用真实 `executor.mode=ssh` 证明 remote readonly / guard path 可穿过 outer executor，并 authoritative ingest 到 orchestrator。
  - 本步必须同时证明：
    - remote `sudo -n` 可用；
    - `remote_preflight_guard.sh` PASS；
    - `kubectl get deploy -n dongyu` 可以从真实 remote cluster 返回事实。
- Files:
  - `scripts/orchestrator/ops_executor.mjs`
  - `scripts/orchestrator/execution_ops.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/monitor.mjs`
  - `scripts/orchestrator/iteration_register.mjs`
  - `scripts/ops/remote_preflight_guard.sh`
  - runtime `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/...`
  - `docs/iterations/0230-remote-ops-bridge-smoke/runlog.md`
- Execution:
  - materialize / consume / ingest remote readonly task：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based

    export READONLY_BATCH_ID="0230-remote-readonly-$(date +%Y%m%d%H%M%S)"
    export BATCH_ID="$READONLY_BATCH_ID"
    export TASK_ID="remote-rke2-readonly"
    export TASK_SUMMARY="Prove remote readonly facts and rke2 guard"
    export TASK_EXECUTOR_MODE="ssh"
    export TASK_TARGET_ENV="remote"
    export TASK_HOST_SCOPE="remote_cluster"
    export TASK_MUTATING="false"
    export TASK_DANGER="medium"
    export TASK_TIMEOUT_MS="180000"
    export TASK_COMMAND="sudo -n bash $REMOTE_REPO/scripts/ops/remote_preflight_guard.sh && kubectl get deploy -n dongyu"

    materialize_ops_task
    consume_ops_task
    ingest_ops_task
    verify_ops_task_authoritative_pass
    ```
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID="$READONLY_BATCH_ID" TASK_ID="remote-rke2-readonly" && verify_ops_task_authoritative_pass`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "REMOTE_RKE2_GATE: PASS|\\+rke2|ui-server|mbr-worker|remote-worker|ui-side-worker" ".orchestrator/runs/$READONLY_BATCH_ID/ops_tasks/remote-rke2-readonly/stdout.log"`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "\"task_id\": \"remote-rke2-readonly\"|\"status\": \"pass\"" ".orchestrator/runs/$READONLY_BATCH_ID/state.json" ".orchestrator/runs/$READONLY_BATCH_ID/events.jsonl"`
- Acceptance:
  - `executor.mode=ssh` 已被真实证明，而不是 mock / fixture；
  - remote guard、remote readonly facts 与 authoritative ingest 三者同时成立；
  - 若本步失败，最终结论必须偏向 `Remote ops bridge blocked`，不得继续执行 mutating rollout。
- Rollback:
  - 删除本地 `.orchestrator/runs/$READONLY_BATCH_ID` 产物即可；本步不做 remote mutation，无需 remote rollback。

## Step 3 — Prove Remote Source Sync Path

- Scope:
  - 用真实 outer executor 证明 canonical `sync_cloud_source.sh` 可以把当前 local revision 推送到 canonical remote repo。
  - 本步是 remote mutating path 的前置；后续 whitelist deploy 必须消费同一 `REMOTE_SOURCE_REV`。
- Files:
  - `scripts/ops/sync_cloud_source.sh`
  - `deploy/env/cloud.env`
  - remote `/home/wwpic/dongyuapp/.deploy-source-revision`
  - runtime `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/...`
  - `docs/iterations/0230-remote-ops-bridge-smoke/runlog.md`
- Execution:
  - 先通过 outer executor 执行 source sync：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based

    export SYNC_BATCH_ID="0230-remote-sync-$(date +%Y%m%d%H%M%S)"
    export BATCH_ID="$SYNC_BATCH_ID"
    export TASK_ID="remote-source-sync"
    export TASK_SUMMARY="Sync current revision to canonical remote repo"
    export TASK_EXECUTOR_MODE="local_shell"
    export TASK_TARGET_ENV="remote"
    export TASK_HOST_SCOPE="remote_host"
    export TASK_MUTATING="true"
    export TASK_DANGER="medium"
    export TASK_TIMEOUT_MS="600000"
    export TASK_COMMAND="bash scripts/ops/sync_cloud_source.sh --ssh-user $REMOTE_SSH_USER --ssh-host $REMOTE_SSH_HOST --remote-repo $REMOTE_REPO --remote-repo-owner $REMOTE_REPO_OWNER --revision $REMOTE_SOURCE_REV"

    materialize_ops_task
    consume_ops_task
    ingest_ops_task
    verify_ops_task_authoritative_pass
    ```
  - 再验证 remote repo 实际 revision：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
    ssh -o BatchMode=yes -o ConnectTimeout=20 "$REMOTE_SSH_USER@$REMOTE_SSH_HOST" \
      "sudo -n -u $REMOTE_REPO_OWNER cat $REMOTE_REPO/.deploy-source-revision"
    ```
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID="$SYNC_BATCH_ID" TASK_ID="remote-source-sync" && verify_ops_task_authoritative_pass`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "=== Cloud Source Sync ===|TARGET=$REMOTE_SSH_USER@$REMOTE_SSH_HOST|REMOTE_REPO=$REMOTE_REPO|REVISION=$REMOTE_SOURCE_REV" ".orchestrator/runs/$SYNC_BATCH_ID/ops_tasks/remote-source-sync/stdout.log"`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && test "$(ssh -o BatchMode=yes -o ConnectTimeout=20 "$REMOTE_SSH_USER@$REMOTE_SSH_HOST" "sudo -n -u $REMOTE_REPO_OWNER cat $REMOTE_REPO/.deploy-source-revision")" = "$REMOTE_SOURCE_REV"`
- Acceptance:
  - 当前 local revision 已同步到 canonical remote repo；
  - source sync 结果已完成 authoritative ingest，而不是只存在本地 shell 输出；
  - 后续 Step 4 只能使用同一 `REMOTE_SOURCE_REV`。
- Rollback:
  - 若 source sync 需要回退，只允许使用同一脚本把已知 good revision 重新 sync 到 remote repo：
    - `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host dongyudigital.com --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision <known-good-rev>`
  - 不允许直接登录远端做 ad-hoc `git reset --hard` 作为 canonical rollback。

## Step 4 — Prove Whitelist App Rollout And Post-Rollout Readiness

- Scope:
  - 默认 mutating smoke 采用 single-target whitelist app deploy：
    - `deploy_cloud_app.sh --target ui-server --revision $REMOTE_SOURCE_REV`
  - 该路径必须同时证明：
    - remote guard 未阻塞；
    - remote build / import / rollout restart 实际执行；
    - source hash gate 通过；
    - post-rollout readiness 为 PASS。
  - 只有在以下两类条件下，才允许升级为 full-stack deploy fallback：
    - `ui-server` app-target 结果无法判断 shared rollout path；
    - reviewer 明确要求 full-stack deploy 证据。
- Files:
  - `scripts/ops/deploy_cloud_app.sh`
  - `scripts/ops/deploy_cloud_full.sh`
  - `scripts/ops/_deploy_common.sh`
  - `k8s/Dockerfile.ui-server`
  - `k8s/cloud/workers.yaml`
  - `k8s/cloud/ui-side-worker.yaml`
  - `k8s/cloud/synapse.yaml`
  - `k8s/cloud/mbr-update.yaml`
  - runtime `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/...`
  - `docs/iterations/0230-remote-ops-bridge-smoke/runlog.md`
- Execution:
  - 先跑 default app-target deploy：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based

    export DEPLOY_BATCH_ID="0230-remote-deploy-$(date +%Y%m%d%H%M%S)"
    export BATCH_ID="$DEPLOY_BATCH_ID"
    export TASK_ID="remote-deploy-ui-server"
    export TASK_SUMMARY="Prove whitelist remote app deploy path for ui-server"
    export TASK_EXECUTOR_MODE="ssh"
    export TASK_TARGET_ENV="remote"
    export TASK_HOST_SCOPE="remote_cluster"
    export TASK_MUTATING="true"
    export TASK_DANGER="high"
    export TASK_TIMEOUT_MS="1800000"
    export TASK_COMMAND="cd $REMOTE_REPO && sudo -n bash $REMOTE_REPO/scripts/ops/deploy_cloud_app.sh --target ui-server --revision $REMOTE_SOURCE_REV"

    materialize_ops_task
    consume_ops_task
    ingest_ops_task
    verify_ops_task_authoritative_pass
    ```
  - 再跑 post-rollout readiness：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based

    export POSTCHECK_BATCH_ID="0230-remote-postcheck-$(date +%Y%m%d%H%M%S)"
    export BATCH_ID="$POSTCHECK_BATCH_ID"
    export TASK_ID="remote-ui-server-postcheck"
    export TASK_SUMMARY="Verify remote ui-server rollout and readiness"
    export TASK_EXECUTOR_MODE="ssh"
    export TASK_TARGET_ENV="remote"
    export TASK_HOST_SCOPE="remote_cluster"
    export TASK_MUTATING="false"
    export TASK_DANGER="medium"
    export TASK_TIMEOUT_MS="240000"
    export TASK_COMMAND="kubectl -n dongyu rollout status deployment/ui-server --timeout=180s && kubectl get deploy -n dongyu ui-server"

    materialize_ops_task
    consume_ops_task
    ingest_ops_task
    verify_ops_task_authoritative_pass
    ```
  - 仅在满足升级条件时，允许替换 deploy task 为 full-stack fallback：
    ```bash
    cd /Users/drop/codebase/cowork/dongyuapp_elysia_based

    export FULL_DEPLOY_BATCH_ID="0230-remote-full-deploy-$(date +%Y%m%d%H%M%S)"
    export BATCH_ID="$FULL_DEPLOY_BATCH_ID"
    export TASK_ID="remote-deploy-full-stack"
    export TASK_SUMMARY="Fallback full-stack remote deploy proof"
    export TASK_EXECUTOR_MODE="ssh"
    export TASK_TARGET_ENV="remote"
    export TASK_HOST_SCOPE="remote_cluster"
    export TASK_MUTATING="true"
    export TASK_DANGER="high"
    export TASK_TIMEOUT_MS="2400000"
    export TASK_COMMAND="cd $REMOTE_REPO && sudo -n bash $REMOTE_REPO/scripts/ops/deploy_cloud_full.sh --rebuild"

    materialize_ops_task
    consume_ops_task
    ingest_ops_task
    verify_ops_task_authoritative_pass
    ```
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID="$DEPLOY_BATCH_ID" TASK_ID="remote-deploy-ui-server" && verify_ops_task_authoritative_pass`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "REMOTE_RKE2_GATE: PASS|SOURCE_REV=$REMOTE_SOURCE_REV|=== Cloud App Deploy ===|DEPLOYMENT=ui-server|=== Cloud app deploy complete ===" ".orchestrator/runs/$DEPLOY_BATCH_ID/ops_tasks/remote-deploy-ui-server/stdout.log"`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID="$POSTCHECK_BATCH_ID" TASK_ID="remote-ui-server-postcheck" && verify_ops_task_authoritative_pass`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "successfully rolled out|ui-server" ".orchestrator/runs/$POSTCHECK_BATCH_ID/ops_tasks/remote-ui-server-postcheck/stdout.log"`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && ssh -o BatchMode=yes -o ConnectTimeout=20 "$REMOTE_SSH_USER@$REMOTE_SSH_HOST" "kubectl -n dongyu get deploy ui-server"`
  - 若启用 full-stack fallback，再追加：
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID="$FULL_DEPLOY_BATCH_ID" TASK_ID="remote-deploy-full-stack" && verify_ops_task_authoritative_pass`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "=== Cloud Deploy \\(full stack\\) ===|REMOTE_RKE2_GATE: PASS|=== Cloud deploy complete ===" ".orchestrator/runs/$FULL_DEPLOY_BATCH_ID/ops_tasks/remote-deploy-full-stack/stdout.log"`
- Acceptance:
  - default app-target whitelist path 已被真实证明，而不是只做 readonly 或 mock；
  - remote source gate、remote build / import、rollout 与 post-rollout readiness 同时通过；
  - 若本步失败，必须给出具体 blocker，不得把 remote guard / deploy / readiness 失败笼统写成“环境不稳定”。
- Rollback:
  - app-target rollback 首选“已知 good revision + canonical path”：
    - `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host dongyudigital.com --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision <known-good-rev>`
    - `ssh drop@dongyudigital.com "cd /home/wwpic/dongyuapp && sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_app.sh --target ui-server --revision <known-good-rev>"`
  - 若 app-target 不能恢复且必须回整栈，只允许在白名单内执行：
    - `ssh drop@dongyudigital.com "cd /home/wwpic/dongyuapp && sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh --rebuild"`
  - 严禁任何 `kubectl delete namespace`、`helm uninstall`、`systemctl restart rke2`、`systemctl restart k3s`、`/etc/rancher/` 改动或网络 / firewall / CNI 变更。

## Step 5 — Consolidate Final Verdict For `0224` / `0225`

- Scope:
  - 将 Step 2-4 的 smoke 结果收敛为单一结论，并把可审计事实写入 `runlog.md`：
    - `Remote ops bridge proven`
    - 或 `Remote ops bridge blocked`
  - 若 iteration 进入终态，补同步 `docs/ITERATIONS.md` 的状态。
- Files:
  - `docs/iterations/0230-remote-ops-bridge-smoke/runlog.md`
  - `docs/ITERATIONS.md`
- Execution:
  - 在 runlog 中记录：
    - 每个 task 的 `BATCH_ID` / `TASK_ID`
    - request/result/stdout/stderr/artifact 路径
    - 关键 stdout 事实
    - authoritative state/status/runlog PASS 或 blocker
    - 最终 verdict
  - 若全部 PASS：
    - verdict = `Remote ops bridge proven`
  - 若任一 prerequisite / readonly / source sync / deploy / readiness 失败：
    - verdict = `Remote ops bridge blocked`
    - blocker 必须带 task id、failure kind 与最小复现命令
  - 若 iteration 已进入 `Completed` 或 `On Hold`，同步更新 `docs/ITERATIONS.md`。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "Remote ops bridge proven|Remote ops bridge blocked" docs/iterations/0230-remote-ops-bridge-smoke/runlog.md`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "remote-rke2-readonly|remote-source-sync|remote-deploy-ui-server|remote-ui-server-postcheck|remote-deploy-full-stack" docs/iterations/0230-remote-ops-bridge-smoke/runlog.md`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "0230-remote-ops-bridge-smoke.*(In Progress|Completed|On Hold)" docs/ITERATIONS.md`
- Acceptance:
  - downstream 只读 `runlog.md` 与 `docs/ITERATIONS.md` 就能知道：
    - 0230 已经证明了什么；
    - 仍然没有证明什么；
    - 下一步 `0224` / `0225` 应消费哪个 verdict。
  - 结论不能依赖聊天上下文或人工回忆。
- Rollback:
  - 若 runlog verdict 文字写错，只追加更正记录，不改写历史证据。
  - 若 `docs/ITERATIONS.md` 状态同步错误，只修正索引状态，不删除已有 runlog 事实。

## Final Verification Target For 0230

- 一个真实 remote readonly / rke2 guard `ops_task` 已通过 `executor.mode=ssh` + authoritative ingest 被证明。
- 一个真实 remote source sync `ops_task` 已通过 `executor.mode=local_shell` + authoritative ingest 被证明，且 remote `.deploy-source-revision` 与 `REMOTE_SOURCE_REV` 一致。
- 一个真实 remote whitelist app deploy `ops_task` 已通过 `executor.mode=ssh` + remote guard + source hash gate + authoritative ingest 被证明。
- 一个真实 post-rollout readiness `ops_task` 已通过 `executor.mode=ssh` + authoritative ingest 被证明。
- 所有 PASS task 都在 `.orchestrator/runs/<batch_id>/...` 与 `runlog.md` 中留下可审计证据。
- 最终结论只允许是：
  - `Remote ops bridge proven`
  - 或 `Remote ops bridge blocked`

## Rollback Principle

- `0230` 的 rollback 优先局限在 revision-based remote restore 与本地 evidence 清理：
  - 先清理最近一个 smoke batch 的 `.orchestrator/runs/<batch_id>` 本地产物；
  - 若 remote repo revision 需要回退，只能通过 `sync_cloud_source.sh --revision <known-good-rev>`；
  - 若 remote app rollout 需要回退，只能通过 `deploy_cloud_app.sh --target ui-server --revision <known-good-rev>`；
  - 只有当 app-target 无法恢复且 reviewer 明确同意时，才允许使用 `deploy_cloud_full.sh --rebuild` 回整栈；
  - 严禁使用任何 forbidden / critical-risk remote 操作作为“省事 rollback”。

## Notes

- `0230` 的核心交付不是“远端业务环境已 browser-level 验收”，而是“remote ops bridge 已能真实消费 canonical whitelist path，并给 `0224` 提供可信 remote execution 面”。
- `0230` 不负责修复 remote rollout 中暴露的新缺陷；一旦发现 bridge / prereq / deploy / readiness 缺口，只负责给出 deterministic blocker 与证据。
