---
title: "0219 — orchestrator-browser-agent-bridge Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-23
source: ai
iteration_id: 0219-orchestrator-browser-agent-bridge
id: 0219-orchestrator-browser-agent-bridge
phase: phase1
---

# 0219 — orchestrator-browser-agent-bridge Resolution

## Execution Strategy

- 先把 `0218` 的 request/result contract 落成可复用的 bridge helper，固定 batch-local exchange 的读写、校验和重复保护。
- 再实现显式 Browser Agent consumer 与 deterministic mock executor，证明 bridge 在无真实 MCP 的前提下也能稳定生成结构化 result 和 artifact。
- 最后补齐 bridge-local idempotent recovery regression，把 duplicate/stale/restart 风险在主循环接线前收口，为 `0220` 留下可直接复用的桥接层。

## Delivery Boundaries

- 本 iteration 允许的改动面：
  - `scripts/orchestrator/` 下新增 bridge / consumer 模块
  - deterministic bridge regression
  - `0219` 自身 iteration runlog 事实记录
  - 为 contract alignment 所需的最小测试补强
- 本 iteration 不允许的改动面：
  - `scripts/orchestrator/orchestrator.mjs` 主循环 browser phase 接线
  - `state.json` / `events.jsonl` / `status.txt` 的 browser ingest / monitor surface
  - 真实 Playwright MCP smoke
  - 本地/远端环境 rollout、cluster 操作、人工浏览器 DoD
  - 私自修改 `0218` 已冻结的 schema、artifact 目录、failure taxonomy 或 PASS 判定

## Planned Deliverables

- Bridge implementation:
  - `scripts/orchestrator/browser_bridge.mjs`
  - `scripts/orchestrator/browser_agent.mjs`
- Deterministic regression:
  - `scripts/orchestrator/test_browser_agent_bridge.mjs`
  - 如 contract alignment 需要，最小更新：
    - `scripts/orchestrator/test_browser_task_contract.mjs`
- Evidence:
  - `docs/iterations/0219-orchestrator-browser-agent-bridge/runlog.md`

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Build Canonical Bridge Exchange Helpers | 把 `0218` 的 request/result/path 合同落成可执行 helper，并固定 duplicate-safe 文件写入 | `scripts/orchestrator/browser_bridge.mjs`, `scripts/orchestrator/test_browser_agent_bridge.mjs`, `scripts/orchestrator/test_browser_task_contract.mjs` | contract test + exchange helper regression + path grep | 回退 bridge helper 与对应测试 |
| 2 | Implement Browser Agent Consumer And Mock Executor | 提供显式 Browser Agent consumer boundary 和 deterministic mock-evidence path | `scripts/orchestrator/browser_agent.mjs`, `scripts/orchestrator/browser_bridge.mjs`, `scripts/orchestrator/test_browser_agent_bridge.mjs` | mock-executor regression + consumer-boundary regression + contract test | 回退 consumer / mock executor / regression |
| 3 | Harden Idempotent Recovery And Conflict Handling | 在主循环接线前收口 restart / duplicate / stale / invalid 冲突语义 | `scripts/orchestrator/browser_bridge.mjs`, `scripts/orchestrator/browser_agent.mjs`, `scripts/orchestrator/test_browser_agent_bridge.mjs`, `docs/iterations/0219-orchestrator-browser-agent-bridge/runlog.md` | idempotency regression + duplicate/stale regression + full bridge regression | 回退 recovery 逻辑与回归，清理本地产物 |

## Step 1 — Build Canonical Bridge Exchange Helpers

- Scope:
  - 新增 bridge helper，负责：
    - 派生 browser task 的 canonical 目录与文件路径
    - 读取并校验 `request.json`
    - 原子写入 `result.json`
    - 在已有完成 result 时进行 duplicate-safe short-circuit
  - 强制 helper 只在以下两类路径工作：
    - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/...`
    - `output/playwright/<batch_id>/<task_id>/...`
  - 用 deterministic regression 固定 bridge helper 的最小行为，不依赖 orchestrator 主循环。
- Files:
  - `scripts/orchestrator/browser_bridge.mjs`
  - `scripts/orchestrator/test_browser_agent_bridge.mjs`
  - `scripts/orchestrator/test_browser_task_contract.mjs`
- Implementation notes:
  - `request.json` / `result.json` 继续是 canonical exchange 文件。
  - 如需 claim/lease/heartbeat 等 task-dir 内辅助文件，只能作为 bridge-local helper，不能升级为新的合同入口。
  - helper 不得直接写 `state.json`、`events.jsonl` 或 `status.txt`；这些 ingest 面在 `0220` 再接。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_task_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_agent_bridge.mjs --case exchange`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "browser_tasks|request\\.json|result\\.json|output/playwright" scripts/orchestrator/browser_bridge.mjs scripts/orchestrator/test_browser_agent_bridge.mjs`
- Acceptance:
  - bridge helper 可以在不依赖主循环的情况下完成 request 校验、task-dir 派生和原子 result 写入。
  - 所有 helper 行为仍严格受 `0218` schema 和路径合同约束，没有引入新的非标准 exchange surface。
- Rollback:
  - 回退 `browser_bridge.mjs` 与相关 regression；若创建了 bridge-local helper 文件定义，一并回退对应实现和测试断言。

## Step 2 — Implement Browser Agent Consumer And Mock Executor

- Scope:
  - 新增 Browser Agent consumer 入口，至少支持：
    - 发现一个 pending browser task
    - claim 并执行该 task
    - 调用 `mock|mcp` executor surface
    - 写回结构化 result 与 artifact manifest
  - 提供 deterministic mock executor，生成真实落盘的 required artifacts，证明 bridge 在无 MCP 条件下也能满足 `0218` contract。
  - 明确 `mode=mcp` 仍然是显式 adapter surface，而不是“已有 CLI 默认带 MCP”。
- Files:
  - `scripts/orchestrator/browser_agent.mjs`
  - `scripts/orchestrator/browser_bridge.mjs`
  - `scripts/orchestrator/test_browser_agent_bridge.mjs`
  - 如样例需要补强，可最小更新：
    - `scripts/orchestrator/test_browser_task_contract.mjs`
- Implementation notes:
  - consumer 优先支持 deterministic one-shot 模式，保证测试可控；长轮询/daemon 模式只有在语义完全一致时才考虑追加。
  - mock executor 必须写出真实文件到 `output/playwright/<batch_id>/<task_id>/...`，不能只在 result manifest 中声称 artifact 存在。
  - 若 `mode=mcp` 在 `0219` 仅作为 surface 占位，也必须能明确返回 `mcp_unavailable` 或 `executor_unavailable`，而不是沉默降级到 mock。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_agent_bridge.mjs --case mock-executor`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_agent_bridge.mjs --case consumer-boundary`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_task_contract.mjs`
- Acceptance:
  - contract-valid request 可以被 Browser Agent consumer 消费，并产出 contract-valid result + required artifacts。
  - Browser Agent 作为显式 consumer 存在，未把 browser capability 偷塞进 `drivers.mjs` 或其他通用 CLI surface。
  - mock executor 与 `mcp_unavailable` 路径都能 deterministic 地表达在 result 中。
- Rollback:
  - 回退 `browser_agent.mjs`、mock executor 逻辑和相关 regression；若对 contract test 有补强，同步回退。

## Step 3 — Harden Idempotent Recovery And Conflict Handling

- Scope:
  - 为以下 bridge-local 冲突补齐 deterministic regression：
    - consumer 在已有成功 result 上重跑
    - 部分 task-dir 已存在但未完成
    - duplicate result / duplicate consumer completion
    - stale claim / stale helper file
    - invalid request / invalid result / artifact manifest 冲突
  - 固定 Browser Agent 重启后的最小恢复规则，确保 `0219` 只处理 bridge-local idempotency，不越权实现 `0220` 的 orchestrator resume。
  - 在 `runlog.md` 中预先明确本 iteration Phase 3 需要记录的验证命令与 PASS/FAIL 证据类型。
- Files:
  - `scripts/orchestrator/browser_bridge.mjs`
  - `scripts/orchestrator/browser_agent.mjs`
  - `scripts/orchestrator/test_browser_agent_bridge.mjs`
  - `docs/iterations/0219-orchestrator-browser-agent-bridge/runlog.md`
- Implementation notes:
  - duplicate/stale/invalid 路径必须复用 `0218` 已冻结的 failure taxonomy，禁止新增临时字符串。
  - bridge-local recovery 只负责 task-dir 与 result-write 幂等，不负责 `state/events/status/runlog` ingest；后者保留给 `0220`。
  - 若实现证明当前合同缺字段或 failure kind 不足，应停止并升级为 planning 变更，而不是在本步静默扩写 schema。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_agent_bridge.mjs --case idempotent-replay`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_agent_bridge.mjs --case duplicate-and-stale`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_agent_bridge.mjs`
- Acceptance:
  - Browser Agent 重启、重复运行或命中 stale/duplicate 场景时，bridge 结果 deterministic，且不会伪造第二次成功。
  - `0220` 不需要先补 bridge-local recovery 热修，再接 orchestrator phase / ingest。
- Rollback:
  - 回退 recovery 逻辑与相关 regression；清理本地 `.orchestrator/` / `output/playwright/` 测试产物即可，不把本地产物当成 versioned 交付物。

## Final Verification Target For 0219

- repo 中存在独立的 bridge helper 与 Browser Agent consumer 实现。
- repo 中存在 deterministic `test_browser_agent_bridge` 回归，覆盖 exchange、mock executor、consumer boundary 和 idempotent recovery。
- mock path 下的 request/result/artifacts 都落在 `0218` 已批准的路径，且通过 contract baseline。
- `0219` 完成后，`0220` 只需处理 orchestrator phase / ingest / resume，不需要再定义 browser bridge 的本地协议。

## Rollback Principle

- `0219` 的回退应局限在 bridge / consumer / regression 面：
  - 优先回退最近一个 Step 的 bridge/test 提交；
  - 每次回退后都重新执行 `test_browser_task_contract` 与 `test_browser_agent_bridge`；
  - `.orchestrator/` 与 `output/playwright/` 中的本地产物不是 versioned 交付物，必要时只清理本地测试痕迹，不把它们当作 repo 回退目标。

## Notes

- `0219` 的目标是“让 bridge 可运行且可回归”，不是“让 orchestrator 已经完成 browser ingest”。
- 任何试图在 `0219` 顺手加入 browser phase / monitor / state ingest 的做法，都属于 scope violation，应停止并留给 `0220`。
