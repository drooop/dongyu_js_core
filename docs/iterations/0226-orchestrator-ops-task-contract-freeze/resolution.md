---
title: "0226 — orchestrator-ops-task-contract-freeze Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0226-orchestrator-ops-task-contract-freeze
id: 0226-orchestrator-ops-task-contract-freeze
phase: phase1
---

# 0226 — orchestrator-ops-task-contract-freeze Resolution

## Execution Strategy

- 先做 inventory，确认当前 orchestrator 已有哪些可复用的 audit / schema / prompt 骨架，以及 `scripts/ops/` 中哪些命令族必须被 `ops_task` 覆盖。
- 再把 `ops_task` request/result、canonical task dir、`stdout/stderr/exit_code`、artifact manifest 与 `exec_output` handshake 冻结为 machine-readable contract。
- 随后把 failure taxonomy、remote safety stop rules 与 state/event/status/runlog 双写语义提升到 SSOT，并用 deterministic tests 锁住。
- 最后同步 operator docs 与 prompt 术语，让 `0227-0230` 从同一份合同出发，而不是继续靠聊天上下文或人工约定补定义。

## Delivery Boundaries

- 本 iteration 允许的改动面：
  - versioned schema
  - deterministic tests
  - prompt / parse contract
  - SSOT / operator docs
  - `0226` 自身 iteration 文档与 Phase 3 runlog
- 本 iteration 不允许的改动面：
  - external executor / bridge runtime
  - claim / release / idempotent consumer 实现
  - orchestrator 主循环 `ops_task` wiring、resume、On Hold 集成
  - 真实 local / remote shell smoke
  - `packages/worker-base/**`、`deploy/sys-v1ns/**` 这类 runtime 或 fill-table 交付

## Planned Deliverables

- Versioned schema:
  - `scripts/orchestrator/schemas/ops_task_request.json`
  - `scripts/orchestrator/schemas/ops_task_result.json`
  - `scripts/orchestrator/schemas/exec_output.json`
- Deterministic tests:
  - `scripts/orchestrator/test_ops_task_contract.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
- Prompt / parse alignment:
  - `scripts/orchestrator/prompts.mjs`
  - `scripts/orchestrator/drivers.mjs`
- SSOT / operator-doc alignment:
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `scripts/ops/README.md`
- Evidence:
  - `docs/iterations/0226-orchestrator-ops-task-contract-freeze/runlog.md`

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Inventory Current Audit Surface And Ops Anchors | 固定现有 orchestrator 审计骨架、browser 先例与 `scripts/ops/` canonical command family 的事实边界 | `scripts/orchestrator/{schemas/exec_output,drivers,prompts,state,events,monitor,iteration_register}.mjs`, `docs/ssot/orchestrator_hard_rules.md`, `docs/user-guide/orchestrator_local_smoke.md`, `scripts/ops/README.md`, `scripts/ops/{check_runtime_baseline,ensure_runtime_baseline,deploy_local,remote_preflight_guard,sync_cloud_source,deploy_cloud_full,deploy_cloud_app}.sh`, `docs/iterations/0226-orchestrator-ops-task-contract-freeze/runlog.md` | orchestrator regression + inventory grep | 本步主要是事实盘点；若仅补充 runlog 记录，回退对应记录 |
| 2 | Freeze Request Result Log Artifact And Exec Output Contracts | 让 `ops_task` request/result/task-dir/log/artifact/exec-output 变成 machine-readable contract | `scripts/orchestrator/schemas/{ops_task_request,ops_task_result,exec_output}.json`, `scripts/orchestrator/test_ops_task_contract.mjs`, `scripts/orchestrator/{prompts,drivers}.mjs`, `scripts/orchestrator/test_orchestrator.mjs` | schema parse + contract test + prompt/parse regression | 回退新增 schema/test 及 prompt/driver 改动 |
| 3 | Freeze Failure Taxonomy, Remote Safety Stop Rules, And Audit Mapping | 定义 `ops_task` 的 failure kinds、PASS rule、remote safety boundary 与 state/event/status/runlog 映射 | `docs/ssot/orchestrator_hard_rules.md`, `scripts/orchestrator/test_ops_task_contract.mjs`, `scripts/orchestrator/test_orchestrator.mjs`, 必要时补充 `scripts/orchestrator/schemas/{ops_task_request,ops_task_result}.json` 注释 | contract test + orchestrator regression + SSOT grep | 回退 SSOT/test/schema 改动 |
| 4 | Sync Operator Docs And Downstream Terminology | 让 ops command KB、local smoke runbook 与 prompt/SSOT 使用同一套 `ops_task` 术语和路径 | `scripts/ops/README.md`, `docs/user-guide/orchestrator_local_smoke.md`, `scripts/orchestrator/prompts.mjs`, `scripts/orchestrator/test_orchestrator.mjs`, `docs/iterations/0226-orchestrator-ops-task-contract-freeze/runlog.md` | regression + doc grep + runlog grep | 回退 runbook / KB / prompt / runlog 改动 |

## Step 1 — Inventory Current Audit Surface And Ops Anchors

- Scope:
  - 审计当前 orchestrator 对以下能力的既有事实：
    - authoritative state
    - append-only events
    - derived status dashboard
    - prompt / parse / schema contract
    - browser_task 先例中的 exchange / evidence / PASS rule
  - 盘点 `scripts/ops/` 中真正需要被 `ops_task` 覆盖的命令族：
    - local readonly baseline / readiness
    - local mutating deploy / ensure
    - remote readonly preflight / source gate
    - remote mutating whitelist rollout
  - 明确当前仓库完全缺失的 `ops_task` pieces：
    - request/result schema
    - canonical task dir
    - `stdout/stderr/exit_code` contract
    - remote safety stop rules
    - ops-specific failure taxonomy
    - authoritative / derived / local-only evidence mapping
  - 将 inventory 结果写入 `runlog.md`，作为后续 schema / SSOT freeze 的事实输入。
- Files:
  - `scripts/orchestrator/schemas/exec_output.json`
  - `scripts/orchestrator/drivers.mjs`
  - `scripts/orchestrator/prompts.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/monitor.mjs`
  - `scripts/orchestrator/iteration_register.mjs`
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `scripts/ops/README.md`
  - `scripts/ops/check_runtime_baseline.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/deploy_local.sh`
  - `scripts/ops/remote_preflight_guard.sh`
  - `scripts/ops/sync_cloud_source.sh`
  - `scripts/ops/deploy_cloud_full.sh`
  - `scripts/ops/deploy_cloud_app.sh`
  - `docs/iterations/0226-orchestrator-ops-task-contract-freeze/runlog.md`
- Implementation notes:
  - inventory 至少要回答四件事：
    - 哪些现有 orchestrator 机制可以直接复用为 `ops_task` 审计骨架；
    - 哪些 `scripts/ops/` 命令族是 0229/0230 的 canonical shell surface；
    - 哪些 remote 风险边界必须从 `CLAUDE.md` 直接继承，而不能交给 bridge 自行解释；
    - 当前仓库中哪些 `ops_task` 语义完全不存在。
  - 本步不新增 bridge 或 state wiring；若发现必须改 runtime 才能表达，直接标记为 `0227` / `0228` 范围。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "browser_task|ops_task|exec_output|remote_preflight_guard|check_runtime_baseline|ensure_runtime_baseline|deploy_local|deploy_cloud_full|deploy_cloud_app|sync_cloud_source" scripts/orchestrator docs/ssot/orchestrator_hard_rules.md docs/user-guide/orchestrator_local_smoke.md scripts/ops/README.md scripts/ops`
- Acceptance:
  - inventory 清楚区分：
    - 可复用的现有审计骨架；
    - `0226` 必须冻结、但当前完全不存在的 `ops_task` contract；
    - 明确属于 `0227` / `0228` / `0229` / `0230` 的后续实现项。
  - 后续 Step 不再需要重新讨论“有没有现成的 authoritative state 骨架”“哪些 shell 命令是 canonical ops surface”。
- Rollback:
  - 若本步只新增 runlog inventory 记录，回退对应记录即可；本步不应引入 bridge 或 phase 行为变更。

## Step 2 — Freeze Request Result Log Artifact And Exec Output Contracts

- Scope:
  - 新增 machine-readable schema，冻结 `ops_task` request/result 的最小必需字段。
  - 冻结 canonical task dir 与文件角色，至少覆盖：
    - `request.json`
    - `result.json`
    - `stdout.log`
    - `stderr.log`
    - `artifacts/...`
  - 扩展 `exec_output.json` 与 execution prompt，使 `ops_task` 像 `browser_task` 一样通过结构化 JSON 输出，而不是靠 prose。
  - 增加专属 contract test，验证 schema、必需字段、路径模式和最小正反样例。
- Files:
  - `scripts/orchestrator/schemas/ops_task_request.json`
  - `scripts/orchestrator/schemas/ops_task_result.json`
  - `scripts/orchestrator/schemas/exec_output.json`
  - `scripts/orchestrator/test_ops_task_contract.mjs`
  - `scripts/orchestrator/prompts.mjs`
  - `scripts/orchestrator/drivers.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
- Implementation notes:
  - request contract 至少要冻结：
    - identity：`batch_id` / `iteration_id` / `task_id` / `attempt` / `created_at`
    - execution boundary：command / shell / cwd / target_env / host_scope / mutating / danger_level / timeout_ms
    - validation boundary：success assertions / required artifacts
  - result contract 至少要冻结：
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
  - `exec_output.json` 与 prompt 只负责“如何声明 `ops_tasks`”，不负责 bridge 消费循环；本步不得偷做 external executor runtime。
  - `stdout.log` / `stderr.log` / artifact 必须使用 repo-relative canonical path，不得散落到 repo root 或未声明路径。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node -e "const fs=require('fs'); ['scripts/orchestrator/schemas/ops_task_request.json','scripts/orchestrator/schemas/ops_task_result.json','scripts/orchestrator/schemas/exec_output.json'].forEach(p=>JSON.parse(fs.readFileSync(p,'utf8'))); console.log('ops_task schemas parse PASS')"`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_task_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "ops_task|target_env|host_scope|mutating|danger_level|stdout_file|stderr_file|exit_code|required_artifacts|success_assertions" scripts/orchestrator/schemas/ops_task_request.json scripts/orchestrator/schemas/ops_task_result.json scripts/orchestrator/schemas/exec_output.json scripts/orchestrator/test_ops_task_contract.mjs scripts/orchestrator/prompts.mjs scripts/orchestrator/drivers.mjs`
- Acceptance:
  - `ops_task` 已从 prose 需求变成 schema + tests + prompt/parse contract。
  - `0227` 可以按 canonical path 和字段集合实现 bridge，而不是重新发明 request/result/log 结构。
  - `0228` 不需要再讨论 exec output 中 `ops_task` 应该如何声明。
- Rollback:
  - 回退本步新增的 schema/test 文件与 prompt/driver 改动；若同步修改了 `test_orchestrator.mjs`，一并回退。

## Step 3 — Freeze Failure Taxonomy, Remote Safety Stop Rules, And Audit Mapping

- Scope:
  - 将 `ops_task` 的 failure kinds、PASS rule 与 remote safety stop rules 提升到 SSOT。
  - 明确 remote safety 的三类边界：
    - allowed
    - forbidden
    - human-decision-required
  - 冻结 `ops_task` 与现有审计面的映射：
    - `state.json` 最终必须记录哪些字段
    - `events.jsonl` 至少要投影哪些结构化字段
    - `status.txt` 至少暴露哪些 ops summary
    - `runlog.md` 应如何引用 request/result/stdout/stderr/artifact
  - 用 deterministic tests 保护上述合同，避免下游实现改名或绕开 authoritative state。
- Files:
  - `docs/ssot/orchestrator_hard_rules.md`
  - `scripts/orchestrator/test_ops_task_contract.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
  - 如需补充 schema 注释，可更新：
    - `scripts/orchestrator/schemas/ops_task_request.json`
    - `scripts/orchestrator/schemas/ops_task_result.json`
- Implementation notes:
  - failure taxonomy 至少需要覆盖：
    - `request_invalid`
    - `executor_unavailable`
    - `target_unreachable`
    - `timeout`
    - `cancelled`
    - `result_invalid`
    - `nonzero_exit`
    - `assertion_failed`
    - `artifact_missing`
    - `artifact_mismatch`
    - `remote_guard_blocked`
    - `forbidden_remote_op`
    - `stale_result`
    - `duplicate_result`
    - `ingest_failed`
    - `ops_bridge_not_proven`
  - critical-risk remote 操作的“需要人类确认”是调度 stop rule，不是桥接层擅自成功/失败的自由裁量；文档必须明确其进入 `human_decision_required` / `On Hold` 的边界。
  - PASS 的必要条件至少包括：
    - `result.status = pass`
    - `exit_code = 0`
    - success assertions 明确满足
    - required artifacts 存在且与 manifest 一致
    - orchestrator evidence chain 已引用该 task；没有 ingest 证据时不得算 PASS
  - 若本步发现现有 `state.json` / `events.jsonl` / `status.txt` 模型还没有 `ops_task` 字段，也只能冻结字段名和语义，不得提前做 0228 wiring。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_task_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "ops_task|request_invalid|executor_unavailable|target_unreachable|nonzero_exit|assertion_failed|artifact_missing|artifact_mismatch|remote_guard_blocked|forbidden_remote_op|ops_bridge_not_proven|state\\.json|events\\.jsonl|status\\.txt|runlog\\.md" docs/ssot/orchestrator_hard_rules.md scripts/orchestrator/test_ops_task_contract.mjs scripts/orchestrator/test_orchestrator.mjs`
- Acceptance:
  - `ops_task` failure taxonomy、PASS rule 与 audit mapping 已被 SSOT 和 regression 锁定。
  - `0227` / `0228` / `0229` / `0230` 不再需要自行命名 failure kind、状态字段或 remote safety stop rule。
- Rollback:
  - 回退本步对 SSOT、schema 注释、contract test、orchestrator regression 的改动。

## Step 4 — Sync Operator Docs And Downstream Terminology

- Scope:
  - 让 ops command knowledge base、local smoke runbook、execution prompt 与 SSOT 使用完全一致的 `ops_task` 术语、路径和 stop rules。
  - 在 `runlog.md` 留下 Phase 3 的事实证据：
    - 执行命令
    - PASS / FAIL
    - 最终冻结的 schema / docs / prompt 文件
  - 只同步 `0226` 直接相关的 operator-facing 文档，不改写 `0227-0230` 自身 plan/resolution。
- Files:
  - `scripts/ops/README.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `scripts/orchestrator/prompts.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
  - `docs/iterations/0226-orchestrator-ops-task-contract-freeze/runlog.md`
- Implementation notes:
  - `scripts/ops/README.md` 需要新增或修正 `ops_task` 读法：
    - 哪些命令族可以被 `ops_task` 请求引用；
    - remote safety gate 在何时必须先过；
    - 哪些 remote path 是 forbidden / critical-risk。
  - `orchestrator_local_smoke.md` 需要新增 `ops_task` operator 读法：
    - 去哪里找 canonical task dir；
    - 如何读取 `stdout.log` / `stderr.log` / `result.json`；
    - 何时应判定 `nonzero_exit` / `remote_guard_blocked` / `ops_bridge_not_proven`。
  - runlog 只记录真实执行，不重写 plan/resolution。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_task_contract.mjs && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "ops_task|target_env|host_scope|danger_level|stdout\\.log|stderr\\.log|remote_preflight_guard|forbidden_remote_op|ops_bridge_not_proven" scripts/ops/README.md docs/user-guide/orchestrator_local_smoke.md docs/ssot/orchestrator_hard_rules.md scripts/orchestrator/prompts.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "ops_task|schema|failure taxonomy|PASS|FAIL" docs/iterations/0226-orchestrator-ops-task-contract-freeze/runlog.md`
- Acceptance:
  - operator docs、prompt、SSOT、tests 对 `ops_task` 使用同一套词汇和路径。
  - `0227-0230` 的执行者只需读 0226 + SSOT / runbook，即可理解后续 bridge / phase / smoke 应满足什么。
- Rollback:
  - 回退本步对 KB、runbook、prompt、test、runlog 的改动；若 runlog 已追加错误事实，按事实追加更正记录，不改写历史。

## Final Verification Target For 0226

- `0226` 完成时，至少应满足以下可判定结果：
  - repo 中存在 versioned 的 `ops_task` request/result schema。
  - repo 中存在 deterministic 的 `ops_task` contract tests，且通过。
  - `exec_output.json`、prompt 与 parse contract 明确接受 machine-readable `ops_tasks`。
  - SSOT 与 operator docs 明确说明 canonical task dir、remote safety stop rules，以及 authoritative / derived / local-only 的审计边界。
  - `0227-0230` 不再需要重新定义字段、日志路径、PASS rule 或 remote safety 术语。

## Rollback Principle

- `0226` 的回退以 versioned docs / schema / test / prompt 改动为主：
  - 优先回退最近一个 Step 的合同与文档提交；
  - 每次回退后必须重新执行本 iteration 已定义的 contract / regression tests；
  - `.orchestrator/` 下的运行期 task dir 与本地日志/artifact 不属于 versioned 交付物，必要时只作为本地证据清理，不构成 repo 回退目标。

## Notes

- `0226` 的核心价值是冻结合同，而不是证明 local / remote ops bridge 已真实可跑。
- 如果执行中发现合同设计必须依赖 bridge runtime 或 phase wiring 先落地，应该把问题升级给 `0227` / `0228`，而不是在 `0226` 里跨 scope 直接实现。
