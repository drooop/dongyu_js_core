---
title: "0228 — orchestrator-ops-phase-and-regression Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0228-orchestrator-ops-phase-and-regression
id: 0228-orchestrator-ops-phase-and-regression
phase: phase1
---

# 0228 — orchestrator-ops-phase-and-regression Resolution

## Execution Strategy

- 先为 `ops_task` 建立与 `browser_task` 对等的 authoritative evidence surface，把 bridge-local request/result/stdout/stderr/artifact 引入 `state.json`、`events.jsonl`、`status.txt` 与 `runlog.md`，但不改 `0226/0227` 的 contract。
- 再把 `ops_task` 接入 orchestrator 主循环，使 execution phase 能 materialize request、等待结果、ingest 成功与失败，并把 remote safety / non-pass failure kinds 收口到明确的 continue / `On Hold` 路径。
- 最后用 resume / failure / operator 文档回归把 `0228` 锁死，确保 `0229/0230` 只验证真实 shell 执行能力，而不是继续补 phase 语义。

## Delivery Boundaries

- 本 iteration 允许的改动面：
  - `scripts/orchestrator/` 下与 `ops_task` authoritative ingest、state/event/status projection、主循环接线、runlog helper、主回归相关的文件
  - 为实现 `ops_task` authoritative ingest 所需的最小 SSOT / runbook / ops README 同步
  - `docs/iterations/0228-orchestrator-ops-phase-and-regression/runlog.md` 的事实记录
- 本 iteration 不允许的改动面：
  - 私自修改 `0226` 已冻结的 `ops_task_request.json` / `ops_task_result.json` contract、failure taxonomy、PASS rule、canonical path 或 remote safety 术语
  - 把 `0228` 变成 `0227` bridge/executor 重写
  - 真实 local cluster rollout smoke、真实 remote rollout smoke、远端人工操作证明
  - 修改 `scripts/ops/*.sh` 的业务语义或扩充危险 remote 命令面
  - `packages/worker-base/**`、`packages/ui-*`、`deploy/sys-v1ns/**` 等 runtime / fill-table 交付

## Planned Deliverables

- Authoritative ops audit surface:
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/monitor.mjs`
  - `scripts/orchestrator/iteration_register.mjs`
- Main-loop ops phase wiring:
  - `scripts/orchestrator/orchestrator.mjs`
  - 如接线确有需要，最小补强：
    - `scripts/orchestrator/drivers.mjs`
    - `scripts/orchestrator/ops_bridge.mjs`
- Regression and operator docs:
  - `scripts/orchestrator/test_orchestrator.mjs`
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `scripts/ops/README.md`
  - `docs/iterations/0228-orchestrator-ops-phase-and-regression/runlog.md`

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Establish Authoritative Ops Audit Surface | 为 `ops_task` 增加 state/event/status/runlog 的 authoritative / derived 证据面 | `state.mjs`, `events.mjs`, `monitor.mjs`, `iteration_register.mjs`, `test_orchestrator.mjs` | orchestrator regression + contract/bridge baseline + field grep | 回退 ops state/event/status/runlog helper 改动 |
| 2 | Wire Ops Task Into Main Loop Execution | 在 `EXECUTION` phase 接入 `ops_task` 的 materialize / await / ingest / REVIEW_EXEC 推进与失败收口 | `orchestrator.mjs`, `state.mjs`, `events.mjs`, `iteration_register.mjs`, `test_orchestrator.mjs` | orchestrator regression + bridge baseline + orchestration grep | 回退主循环接线与对应测试 |
| 3 | Harden Resume And On Hold Semantics | 锁定 pending/result/stale/duplicate/failure/remote safety 的 resume 与 stop 行为 | `orchestrator.mjs`, `state.mjs`, `test_orchestrator.mjs`, `docs/ssot/orchestrator_hard_rules.md`, `docs/user-guide/orchestrator_local_smoke.md`, `scripts/ops/README.md` | full orchestrator regression + docs/keyword grep | 回退 resume/On Hold 逻辑与相关文档 |
| 4 | Freeze Operator Readability And Downstream Boundary | 明确 `0228` 已落地的 authoritative ingest 边界，避免 `0229/0230` 继续补 phase 语义 | `docs/ssot/orchestrator_hard_rules.md`, `docs/user-guide/orchestrator_local_smoke.md`, `scripts/ops/README.md`, `scripts/orchestrator/test_orchestrator.mjs`, `docs/iterations/0228-orchestrator-ops-phase-and-regression/runlog.md` | docs/regression alignment + final grep | 回退文档与回归口径同步 |

## Step 1 — Establish Authoritative Ops Audit Surface

- Scope:
  - 在 `state.mjs` 中新增 `ops_task` 对等 evidence surface，至少覆盖：
    - `evidence.ops_tasks[]`
    - `recordOpsTaskRequest()`
    - `getOpsTaskRecord()`
    - `getPendingOpsTaskRecord()`
    - `ingestOpsTaskResult()`
  - 让 `ingestOpsTaskResult()` 通过 `0227` 已有 bridge helper 读取 canonical `request.json` / `result.json` / `stdout.log` / `stderr.log` / `artifacts/`，并按 `0226` failure taxonomy 输出 deterministic status/failure kind。
  - 在 `events.mjs` 中新增 `event_type = ops_task` 的结构化事件，至少携带：
    - `task_id`
    - `attempt`
    - `status`
    - `failure_kind`
    - `request_file`
    - `result_file`
    - `stdout_file`
    - `stderr_file`
    - `exit_code`
  - 在 `monitor.mjs` 中新增 `status.txt` 投影字段，至少覆盖：
    - `Ops Task:`
    - `Ops Attempt:`
    - `Ops Status:`
    - `Ops Failure Kind:`
    - `Ops Exit Code:`
  - 在 `iteration_register.mjs` 中新增 `appendOpsTaskRunlogRecord()`，用于把 request/result/log/artifact 路径与最终 PASS/FAIL 写入 runlog。
- Files:
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/monitor.mjs`
  - `scripts/orchestrator/iteration_register.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
- Implementation notes:
  - authoritative source 仍然只能是 `state.json`；task dir 内的 `request.json` / `result.json` / `stdout.log` / `stderr.log` / `artifacts/` 只作 bridge-local evidence。
  - `ingestOpsTaskResult()` 必须拒绝“只有本地日志/产物但没有可接受 result”的伪成功。
  - `status.txt` 的 `Ops *` 字段必须是 `state.json` 的投影，不能反向驱动恢复逻辑。
  - 如果 `0227` helper 暴露的读/验 API 不足以完成 authoritative ingest，只允许做最小 helper 补强，不能顺手改 contract。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_task_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "ops_tasks|recordOpsTaskRequest|getPendingOpsTaskRecord|ingestOpsTaskResult|event_type: 'ops_task'|Ops Task:|Ops Exit Code:|appendOpsTaskRunlogRecord" scripts/orchestrator/state.mjs scripts/orchestrator/events.mjs scripts/orchestrator/monitor.mjs scripts/orchestrator/iteration_register.mjs`
- Acceptance:
  - repo 内存在与 `browser_task` 对等的 `ops_task` authoritative / derived evidence surface。
  - `state.json` 能记录 `ops_task` 核心字段，`events.jsonl` / `status.txt` / `runlog.md` 能引用这些字段，而不是直接把 task dir 当真源。
  - 没有 ingest 证据时，`ops_task` 只能判定为 bridge-local evidence present，不能判为 PASS。
- Rollback:
  - 回退 `state.mjs`、`events.mjs`、`monitor.mjs`、`iteration_register.mjs` 中与 `ops_task` evidence surface 相关的改动，并重新执行三条基线测试命令。

## Step 2 — Wire Ops Task Into Main Loop Execution

- Scope:
  - 在 `orchestrator.mjs` 的 `EXECUTION` phase 中增加 `ops_task` 主循环路径：
    - 发现 pending `ops_task` 时优先走 ingest / wait 分支；
    - 无 pending 时，消费 execution 输出中的 `ops_tasks[]`；
    - 用 `materializeOpsTaskRequests()` 落盘 canonical `request.json`；
    - 记录 pending ops request 到 `state.json`；
    - 结果未到时返回 `await_ops_result` 一类等待动作；
    - 结果通过 ingest 后进入 `REVIEW_EXEC`；
    - 结果失败时进入明确 stop / `On Hold` 路径。
  - 确保 `appendOpsTaskRunlogRecord()` 在成功与失败两条路径都追加可审计记录。
  - 明确 `ops_task` 与既有 `spawned_iterations` / `browser_task` 的协调顺序，禁止 silent ignore 某一类 external task。
- Files:
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/iteration_register.mjs`
  - 如接线确有需要：
    - `scripts/orchestrator/drivers.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
- Implementation notes:
  - `ops_task` request materialization 只能写 canonical `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/request.json`，不得绕过 request file 直接调用 executor。
  - 主循环必须显式处理以下结果面：
    - `awaiting_result`
    - `pass`
    - `fail`
  - `fail` 时的 failure kind 必须保留 `0226` 术语，不得发明新的 ad-hoc 文字状态。
  - `ops_task` 成功推进 `REVIEW_EXEC` 的前提是 authoritative ingest 已完成，而不是桥接文件存在。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "materializeOpsTaskRequests|recordOpsTaskRequest|ingestOpsTaskResult|emitOpsTask|appendOpsTaskRunlogRecord|await_ops_result|ops_task failed" scripts/orchestrator/orchestrator.mjs`
- Acceptance:
  - orchestrator 在 execution phase 可以 deterministic 地进入 `ops_task` 等待态、ingest 成功态与失败收口态。
  - `ops_task` 结果通过后，iteration 能进入 `REVIEW_EXEC`；失败时不会伪造成功，也不会静默忽略。
  - runlog 中对每次 ops ingest 都有 request/result/log/artifact 引用。
- Rollback:
  - 回退 `orchestrator.mjs` 中 `ops_task` 主循环接线与关联测试；如 `drivers.mjs` 有最小配套改动，一并回退，并重新跑 bridge 与主回归测试。

## Step 3 — Harden Resume And On Hold Semantics

- Scope:
  - 为 `ops_task` 增加与 `browser_task` 对等的 resume/regression 覆盖，至少包括：
    - request 已写出但 result 未到；
    - result 已存在但尚未 ingest；
    - `nonzero_exit`
    - `assertion_failed`
    - `remote_guard_blocked`
    - `forbidden_remote_op`
    - `ops_bridge_not_proven`
    - `stale_result`
    - `duplicate_result`
    - `result_invalid`
    - `artifact_mismatch`
  - 明确哪些 failure 直接导致失败、哪些 failure 需要 `On Hold` 与人工裁决记录。
  - 保证 `--resume` 先信 `state.json`，再回看 task dir；不得直接靠 task dir 的现存文件恢复成功。
- Files:
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `scripts/ops/README.md`
- Implementation notes:
  - `forbidden_remote_op`、critical-risk remote path 与 `remote_guard_blocked` 必须保持 `CLAUDE.md` 上位优先级，不得降级为普通 `nonzero_exit`。
  - resume 逻辑必须区分：
    - task request 已存在但仍待 executor 回写；
    - result 已存在但尚未 ingest；
    - result 已被 ingest，不能重复成功。
  - 如果 regression 暴露出 `0226` contract 不足，应停止并回 planning，而不是在实现中默默扩写 schema。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "ops_task|resume|nonzero_exit|assertion_failed|remote_guard_blocked|forbidden_remote_op|ops_bridge_not_proven|stale_result|duplicate_result|artifact_mismatch|On Hold" scripts/orchestrator/orchestrator.mjs scripts/orchestrator/test_orchestrator.mjs docs/ssot/orchestrator_hard_rules.md docs/user-guide/orchestrator_local_smoke.md scripts/ops/README.md`
- Acceptance:
  - `--resume` 对 pending/result/stale/duplicate/failure 的判定 deterministic，且不会因为残留 task dir 文件而重复成功。
  - remote safety failure 与 critical-risk 路径会进入明确 stop / `On Hold` 行为，并留下文档化证据。
  - operator 不再需要依赖聊天上下文来解释 ops failure kind 应如何影响恢复。
- Rollback:
  - 回退 `orchestrator.mjs` / `state.mjs` 中的 ops resume/On Hold 逻辑与相关文档、测试；保留 `0227` bridge 本身不动。

## Step 4 — Freeze Operator Readability And Downstream Boundary

- Scope:
  - 把 `0228` 已经落地的 authoritative ingest 边界写进 SSOT / runbook / ops README：
    - 哪些 `ops_task` 字段已经进入 `state.json`
    - `events.jsonl` / `status.txt` / `runlog.md` 如何读
    - `bridge local evidence present` 与 authoritative PASS 如何区分
    - `0229/0230` 只负责真实 shell smoke，不再补 phase contract
  - 在 `0228` 的 `runlog.md` 中预留清晰的 Phase 3 事实记录模板，要求记录 request/result/log/artifact 路径与最终 PASS/FAIL。
- Files:
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `scripts/ops/README.md`
  - `scripts/orchestrator/test_orchestrator.mjs`
  - `docs/iterations/0228-orchestrator-ops-phase-and-regression/runlog.md`
- Implementation notes:
  - 文档用词必须从“0228 将来会接线”切换为“当前 runtime 已接线”的完成态表述，但不能越权宣称 `0229/0230` 的真实 shell smoke 已证明。
  - operator 文档必须继续强调 `state.json` 是唯一恢复真源，`status.txt` 只是投影。
  - `runlog.md` 只记录 Phase 3 的真实证据，不回写规划内容。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "ops_task|Ops Task:|Ops Status:|bridge local evidence present|stdout\\.log|stderr\\.log|authoritative|On Hold|0229|0230" docs/ssot/orchestrator_hard_rules.md docs/user-guide/orchestrator_local_smoke.md scripts/ops/README.md scripts/orchestrator/test_orchestrator.mjs`
- Acceptance:
  - 无上下文读者只看 SSOT / runbook / ops README / 主回归，就能理解 `0228` 已交付什么、仍未证明什么。
  - `0229/0230` 执行者无需聊天补充，就能知道自己应消费的 `ops_task` phase 能力边界。
- Rollback:
  - 回退文档与回归口径同步；若代码已稳定，不因文档回退而撤销已验证的 runtime wiring。

## Final Verification Target For 0228

- orchestrator 可以把 `ops_task` 从 execution handshake materialize 到 canonical request，再 ingest 到 authoritative state。
- `state.json`、`events.jsonl`、`status.txt`、`runlog.md` 对 `ops_task` 的字段、术语与判定一致，且都从 `state.json` 派生或引用。
- `--resume` 能 deterministic 地恢复 `ops_task` 等待态与失败态，不会把 task dir 残留文件误判为成功。
- `scripts/orchestrator/test_orchestrator.mjs` 中存在 `ops_task` phase / resume / failure regression，而不仅是 contract/doc 关键词断言。
- `0229` 和 `0230` 可以聚焦真实 local/remote shell smoke，不再补 `ops_task` 主循环基础设施。

## Rollback Principle

- `0228` 的回退优先局限在 ops phase wiring、state/event/status/runlog projection、主回归与最小文档同步面：
  - 先回退最近一个 Step 的代码与测试；
  - 每次回退后重新执行：
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_task_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `.orchestrator/` 下的 task dir、`stdout.log` / `stderr.log` / `artifacts/` 都只作本地测试产物清理，不作 versioned 回退目标。
  - 若回退暴露 `0226` contract 或 `0227` bridge 本身需要调整，视为新的 planning 变更，不在 `0228` 里继续扩回退范围。

## Notes

- `0228` 的核心交付不是“shell 命令已经在本地/远端全部跑通”，而是“orchestrator 已具备处理 `ops_task` 的 authoritative phase 能力”。
- 任何试图在 `0228` 顺手完成真实 local/remote smoke、扩写 contract、重做 bridge、或绕过 remote safety 的做法，都属于 scope violation。
