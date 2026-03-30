---
title: "0227 — orchestrator-ops-executor-bridge Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-24
source: ai
iteration_id: 0227-orchestrator-ops-executor-bridge
id: 0227-orchestrator-ops-executor-bridge
phase: phase1
---

# 0227 — orchestrator-ops-executor-bridge Resolution

## Execution Strategy

- 先把 `0226` 已冻结的 canonical request/result/log/artifact contract 落成可复用的 bridge helper，固定 task-dir 派生、request/result 校验、`stdout.log` / `stderr.log` / artifact 落盘与重复写保护。
- 再实现显式 external ops executor consumer，把 `mock|local_shell|ssh` 收敛到同一 bridge surface，并把 shell 输出、`exit_code`、failure kind、artifact manifest 稳定写回 canonical `result.json`。
- 随后补齐 claim/release、stale/duplicate/invalid recovery 与 remote safety failure surfacing，确保 `0228` 接主循环前 bridge-local 冲突已被 deterministic regression 锁住。
- 最后同步最小 SSOT / runbook / regression 口径，明确“0227 已有 bridge runtime，但 authoritative ingest 仍待 0228”，为 `0229/0230` 留下可直接复用的执行面。

## Delivery Boundaries

- 本 iteration 允许的改动面：
  - `scripts/orchestrator/` 下新增 bridge / executor / regression 模块
  - 最小 contract-alignment 测试补强
  - bridge/operator 相关的最小文档同步
  - `0227` 自身 `runlog.md` 的事实记录
- 本 iteration 不允许的改动面：
  - `scripts/orchestrator/orchestrator.mjs` 主循环 `ops_task` wiring
  - `state.json` / `events.jsonl` / `status.txt` 的 authoritative ops ingest / monitor surface
  - 真实 local cluster rollout smoke、真实 remote rollout smoke
  - 私自修改 `0226` 已冻结的 request/result schema、failure taxonomy、PASS rule、remote safety 术语
  - `packages/worker-base/**`、`packages/ui-*`、`deploy/sys-v1ns/**` 等 runtime / fill-table 交付

## Planned Deliverables

- Bridge implementation:
  - `scripts/orchestrator/ops_bridge.mjs`
  - `scripts/orchestrator/ops_executor.mjs`
- Deterministic regression:
  - `scripts/orchestrator/test_ops_executor_bridge.mjs`
  - 如 contract alignment 需要，最小更新：
    - `scripts/orchestrator/test_ops_task_contract.mjs`
    - `scripts/orchestrator/test_orchestrator.mjs`
- Bridge-facing docs and evidence:
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `docs/iterations/0227-orchestrator-ops-executor-bridge/runlog.md`

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Build Canonical Ops Bridge Exchange Helpers | 把 `0226` 的 request/result/log/artifact 合同落成可执行 helper，并固定 canonical task-dir 读写与结果归档规则 | `scripts/orchestrator/ops_bridge.mjs`, `scripts/orchestrator/test_ops_executor_bridge.mjs`, `scripts/orchestrator/test_ops_task_contract.mjs` | contract test + exchange helper regression + path grep | 回退 bridge helper 与对应测试 |
| 2 | Implement Explicit Ops Executor Consumer And Dispatch Surface | 提供显式 external executor consumer，并把 `mock|local_shell|ssh` 收敛到统一的 request/result/log/artifact surface | `scripts/orchestrator/ops_executor.mjs`, `scripts/orchestrator/ops_bridge.mjs`, `scripts/orchestrator/test_ops_executor_bridge.mjs` | mock/local/ssh regression + contract test | 回退 executor / dispatch / regression |
| 3 | Harden Claim Release And Recovery Semantics | 在主循环接线前收口 claim/release、duplicate/stale/invalid 冲突与 bridge-local recovery | `scripts/orchestrator/ops_bridge.mjs`, `scripts/orchestrator/ops_executor.mjs`, `scripts/orchestrator/test_ops_executor_bridge.mjs`, `docs/iterations/0227-orchestrator-ops-executor-bridge/runlog.md` | recovery regression + conflict regression + full bridge regression | 回退 recovery 逻辑与回归，清理本地产物 |
| 4 | Sync Downstream Boundary And Operator Readability | 冻结“bridge 已实现、authoritative ingest 仍待 0228”的文档和主回归口径 | `docs/ssot/orchestrator_hard_rules.md`, `docs/user-guide/orchestrator_local_smoke.md`, `scripts/orchestrator/test_orchestrator.mjs`, `scripts/orchestrator/test_ops_executor_bridge.mjs`, `docs/iterations/0227-orchestrator-ops-executor-bridge/runlog.md` | docs/regression alignment + full bridge regression | 回退 docs/test/runlog 同步改动 |

## Step 1 — Build Canonical Ops Bridge Exchange Helpers

- Scope:
  - 新增 bridge helper，负责：
    - 派生 ops task 的 canonical 目录与文件路径
    - 读取并校验 `request.json`
    - 校验 / 读取既有 `result.json`
    - 原子写入 `result.json`
    - 原子写入 `stdout.log` / `stderr.log`
    - materialize `artifacts/` 下的文件并生成 manifest/hash
  - 强制 helper 只在以下路径工作：
    - `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/...`
  - 固定 pass / fail result 的最小写回规则：
    - pass 时 required artifacts 必须真实存在
    - fail 时 `failure_kind` / `exit_code` / log 路径仍需符合 contract
  - 用 deterministic regression 固定 bridge helper 的最小行为，不依赖 orchestrator 主循环。
- Files:
  - `scripts/orchestrator/ops_bridge.mjs`
  - `scripts/orchestrator/test_ops_executor_bridge.mjs`
  - 如 contract baseline 需要补强：
    - `scripts/orchestrator/test_ops_task_contract.mjs`
- Implementation notes:
  - `request.json` / `result.json` 继续是 canonical exchange 文件。
  - helper 不得直接写 `state.json`、`events.jsonl` 或 `status.txt`；这些 ingest 面在 `0228` 再接。
  - `stdout.log` / `stderr.log` / `artifacts/` 必须在写 `result.json` 前落盘完成，并能被后续验证函数重新读取校验。
  - 若发现 `0226` schema 缺字段或 path contract 不足，应停止并回到 planning / SSOT，而不是在 helper 中偷偷扩写合同。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_task_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs --case exchange`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "ops_tasks|request\\.json|result\\.json|stdout\\.log|stderr\\.log|artifacts" scripts/orchestrator/ops_bridge.mjs scripts/orchestrator/test_ops_executor_bridge.mjs`
- Acceptance:
  - bridge helper 可以在不依赖主循环的情况下完成 request 校验、task-dir 派生、result/log/artifact 原子写入与重复写短路。
  - 所有 helper 行为仍严格受 `0226` schema 和路径合同约束，没有引入新的非标准 exchange surface。
- Rollback:
  - 回退 `ops_bridge.mjs` 与相关 regression；若对 `test_ops_task_contract.mjs` 有补强，同步回退。

## Step 2 — Implement Explicit Ops Executor Consumer And Dispatch Surface

- Scope:
  - 新增 external executor consumer 入口，至少支持：
    - 发现一个 pending ops task
    - claim 并执行该 task
    - 调用 `mock|local_shell|ssh` dispatch surface
    - 采集 `stdout` / `stderr` / `exit_code`
    - 生成结构化 result 与 artifact manifest
  - 保证三种模式都经过同一 bridge：
    - `mock`：用于 deterministic 桥接证明
    - `local_shell`：用于安全本地命令回归
    - `ssh`：用于显式 transport boundary；真实远端 rollout proof 留给 `0230`
  - 对以下路径给出显式 failure result，而不是隐式 fallback：
    - executor unavailable
    - ssh transport unavailable
    - target unreachable
    - remote guard blocked
    - forbidden remote op
    - assertion failed
- Files:
  - `scripts/orchestrator/ops_executor.mjs`
  - `scripts/orchestrator/ops_bridge.mjs`
  - `scripts/orchestrator/test_ops_executor_bridge.mjs`
- Implementation notes:
  - consumer 优先支持 deterministic one-shot 模式，保证测试可控；长轮询/daemon 只有在语义完全一致时才考虑追加。
  - `local_shell` 与 `ssh` 必须沿用同一 result envelope，不得为某个模式私自改字段。
  - 若 `ssh` 在 `0227` 仅以 fake transport / injected runner 做回归，也必须显式返回 transport-level failure，而不是沉默降级到 `mock`。
  - remote safety stop rule 由 bridge 忠实 surfacing，不是新的 policy engine：
    - 对命中 frozen forbidden surface 的请求，必须返回 `forbidden_remote_op`
    - 对远端 guard 前置失败的 canonical command family，必须返回 `remote_guard_blocked`
  - `stdout.log` / `stderr.log` 只要子进程已启动，即使失败也必须尽量归档。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs --case mock-executor`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs --case local-shell`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs --case ssh-boundary`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_task_contract.mjs`
- Acceptance:
  - contract-valid request 可以被 external executor consumer 消费，并产出 contract-valid `result.json`、`stdout.log`、`stderr.log` 与 required artifacts。
  - `mock|local_shell|ssh` 作为显式 dispatch surface 存在，未把 shell 能力偷塞进 `drivers.mjs` 或 orchestrator 主循环。
  - remote/transport 不可用路径能 deterministic 地表达在 result 中。
- Rollback:
  - 回退 `ops_executor.mjs`、dispatch 逻辑与相关 regression；如对 `ops_bridge.mjs` 有配套改动，一并回退。

## Step 3 — Harden Claim Release And Recovery Semantics

- Scope:
  - 为以下 bridge-local 冲突补齐 deterministic recovery：
    - 已完成 result 的重复消费短路
    - claim 已存在但过期
    - claim 已存在且仍有效
    - duplicate result / duplicate completion
    - invalid request / invalid result / artifact manifest mismatch
    - 部分 `stdout.log` / `stderr.log` / `artifacts/` 已存在但结果未完成
  - 实现 claim/release helper，并明确其 task-dir 生命周期。
  - 固定 executor 重启后的最小恢复规则，确保 `0227` 只处理 bridge-local idempotency，不越权实现 `0228` 的 orchestrator resume。
- Files:
  - `scripts/orchestrator/ops_bridge.mjs`
  - `scripts/orchestrator/ops_executor.mjs`
  - `scripts/orchestrator/test_ops_executor_bridge.mjs`
  - `docs/iterations/0227-orchestrator-ops-executor-bridge/runlog.md`
- Implementation notes:
  - claim/release helper 只能是 task-dir 内 bridge-local 文件；request/result 仍是 canonical exchange。
  - duplicate/stale/invalid 路径必须复用 `0226` 已冻结的 failure taxonomy，禁止新增临时字符串。
  - bridge-local recovery 只负责 task-dir 与 result-write 幂等，不负责 `state/events/status/runlog` ingest。
  - 如 recovery 证明当前合同缺字段或 failure kind 不足，应停止并升级为 planning 变更，而不是在实现中静默扩写 schema。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs --case claim-recovery`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs --case duplicate-and-stale`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs --case invalid-request`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs`
- Acceptance:
  - executor 重启、重复运行或命中 stale/duplicate/invalid 场景时，bridge 结果 deterministic，且不会伪造第二次成功。
  - `0228` 不需要先补 bridge-local recovery 热修，再接 orchestrator phase / ingest。
- Rollback:
  - 回退 recovery 逻辑与相关 regression；清理本地 `.orchestrator/` 测试产物即可，不把本地产物当成 versioned 交付物。

## Step 4 — Sync Downstream Boundary And Operator Readability

- Scope:
  - 同步 SSOT / runbook / regression 口径，使仓库对外表达清楚区分：
    - `0227` 已实现 external executor bridge、claim/release、stdout/stderr/result/artifact 本地归档
    - `0228` 才会把这些结果 authoritative ingest 到 `state/events/status/runlog`
  - 让主回归和 operator 文档都能引用 bridge 已存在的事实，而不误宣称 ops ingest 已完成。
  - 在 `runlog.md` 中预先明确 Phase 3 需要记录的桥接证据类型与 PASS/FAIL 模板。
- Files:
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `scripts/orchestrator/test_orchestrator.mjs`
  - `scripts/orchestrator/test_ops_executor_bridge.mjs`
  - `docs/iterations/0227-orchestrator-ops-executor-bridge/runlog.md`
- Implementation notes:
  - 文档需要明确：
    - 去哪里找 claim/release 与 local bridge evidence
    - 何时只能判定为“bridge local evidence present”
    - 何时仍必须等待 `0228` authoritative ingest
  - `test_orchestrator.mjs` 的补强只能验证 docs / contract / bridge boundary 对齐，不得偷做 `0228` 主循环 wiring。
  - runlog 只记录真实执行证据，不重写 plan/resolution。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_ops_executor_bridge.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "ops_task|claim|release|stdout\\.log|stderr\\.log|ops_bridge_not_proven|0228" docs/ssot/orchestrator_hard_rules.md docs/user-guide/orchestrator_local_smoke.md scripts/orchestrator/test_orchestrator.mjs`
- Acceptance:
  - 无上下文读者只看 SSOT / runbook / regression，即可理解“bridge 已落地，但 authoritative ingest 仍待 0228”。
  - `0228/0229/0230` 执行者不再需要聊天上下文来判断 0227 的交付边界。
- Rollback:
  - 回退 docs/test/runlog 同步改动；保留 `0227` bridge 实现本身，不做越级回退。

## Final Verification Target For 0227

- repo 中存在独立的 `ops_bridge` helper 与 external executor consumer 实现。
- repo 中存在 deterministic `test_ops_executor_bridge` 回归，覆盖 exchange、mock/local/ssh dispatch、claim/release、duplicate/stale/invalid recovery。
- bridge 生成的 `result.json`、`stdout.log`、`stderr.log`、`artifacts/` 全部落在 `0226` 已冻结的 canonical 路径，且通过 contract baseline。
- 文档与主回归明确说明 `0227` 交付的是 local bridge surface，而不是 authoritative ingest。
- `0228` 完成时不需要重新定义 bridge 协议、claim/release 语义或日志归档规则。

## Rollback Principle

- `0227` 的回退应局限在 bridge / executor / regression / 最小文档同步面：
  - 优先回退最近一个 Step 的 bridge/test/doc 提交；
  - 每次回退后都重新执行 `bun scripts/orchestrator/test_ops_task_contract.mjs` 与 `bun scripts/orchestrator/test_ops_executor_bridge.mjs`；
  - `.orchestrator/` 下的 task dir、`stdout.log` / `stderr.log` 与 `artifacts/` 是本地测试产物，不属于 versioned 交付物，必要时只清理本地痕迹；
  - 若回退证明必须连带修改 `0226` schema / SSOT，视为 planning 问题，而不是继续扩大回退范围。

## Notes

- `0227` 的核心交付不是“真实本地/远端命令已经全部跑通”，而是“外层 executor bridge 已经可运行、可回归、可被 0228/0229/0230 消费”。
- 任何试图在 `0227` 顺手完成 orchestrator ingest、resume、cluster rollout 或远端 smoke 的做法，都属于 scope violation。
