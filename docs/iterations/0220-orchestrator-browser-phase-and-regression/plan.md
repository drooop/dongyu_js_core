---
title: "0220 — orchestrator-browser-phase-and-regression Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0220-orchestrator-browser-phase-and-regression
id: 0220-orchestrator-browser-phase-and-regression
phase: phase1
---

# 0220 — orchestrator-browser-phase-and-regression Plan

## Goal

- 将 `0218` 已冻结、`0219` 已落地的 `browser_task` bridge 真正接入 orchestrator 主循环，使浏览器验证从“batch-local exchange + local evidence”升级为 orchestrator 可恢复、可审计、可回归的一等执行能力。
- 让 `0221-playwright-mcp-local-smoke` 只负责证明真实 Playwright MCP executor 可用，而不是继续补 browser request/result protocol、主循环等待逻辑、resume 恢复逻辑或 audit wiring。

## Background

- 上游事实已经明确：
  - `0218-orchestrator-browser-task-contract-freeze` 已冻结 `browser_task` 的 request/result schema、artifact 路径、failure taxonomy，以及 `state.json` / `events.jsonl` / `status.txt` / `runlog.md` 的目标证据映射。
  - `0219-orchestrator-browser-agent-bridge` 已交付：
    - `scripts/orchestrator/browser_bridge.mjs`
    - `scripts/orchestrator/browser_agent.mjs`
    - `scripts/orchestrator/test_browser_agent_bridge.mjs`
    - deterministic mock executor、duplicate/stale recovery、canonical request/result file exchange
- 但截至本计划生成时，主循环侧仍然缺少 browser wiring：
  - `scripts/orchestrator/orchestrator.mjs` 没有 `browser_task` 或 browser subphase 逻辑，只会消费通用 `exec_output` 的 `steps_completed` / `spawned_iterations`。
  - `scripts/orchestrator/schemas/exec_output.json` 还没有 browser request 入口字段。
  - `scripts/orchestrator/prompts.mjs` 的 execution prompt 没有定义 Codex 何时、以什么结构声明 browser task 需求。
  - `scripts/orchestrator/state.mjs` 当前 evidence bucket 只有 `review_records`、`validation_commands`、`failures`、`escalations`、`oscillations`、`final_commit`、`branch`，尚无 browser ingest 落点。
  - `scripts/orchestrator/monitor.mjs` 的 `status.txt` 仍只有 batch/phase/recent/final verification 汇总，没有 `Browser Task:`、`Browser Attempt:`、`Browser Status:`、`Browser Failure Kind:`。
  - `scripts/orchestrator/test_orchestrator.mjs` 目前只验证 SSOT/runbook/wave prompt 是否提到 browser contract，并未覆盖实际 browser phase、resume、timeout、stale result、orphan event 或 ingest 路径。
- `docs/ssot/orchestrator_hard_rules.md` 已明确 0220 的职责边界：
  - request/result exchange file 只是 local-only bridge surface，不是 authoritative state；
  - browser task PASS 需要 result=pass、required artifacts 存在，并且 orchestrator 已完成 ingest；
  - 0220 负责 orchestrator ingest / state-event-status wiring，0221 才做真实 MCP smoke。

## Problem Statement

- 当前仓库已经有 browser contract（0218）和 browser bridge（0219），但 orchestrator 自身仍然“看不见” browser task：
  - 无法从 execution 输出中显式收到 browser request；
  - 无法把 `request.json` / `result.json` / `output/playwright/...` 升级为 authoritative audit evidence；
  - 无法在 `--resume` 时判断 browser task 是 pending、已完成、stale、orphaned 还是 timeout；
  - 无法通过主回归测试证明 browser failure taxonomy 已真正影响 orchestrator 的 phase/hold/continue 决策。
- 这会导致 bridge 只能作为孤立本地能力存在，无法满足 `0218` 冻结的 PASS 判定，也无法为 `0221` 提供稳定的主循环底座。

## Scope

- In scope:
  - 定义 execution 输出到 `browser_task` request 的显式握手，使 Codex execution 阶段能结构化声明 browser validation 需求，而不是用 prose 暗示“请打开浏览器看看”。
  - 将 browser task 接入 orchestrator 主循环，至少覆盖：
    - request materialization
    - browser subphase / wait point
    - result ingest
    - pass/fail / on_hold / continue 决策
  - 在 authoritative / derived audit surface 中落地 browser evidence：
    - `state.json`
    - `events.jsonl`
    - `status.txt`
    - `runlog.md`
  - 补齐 browser-specific deterministic regression，至少覆盖：
    - happy path
    - `--resume` 恢复
    - orphan event
    - stale result / duplicate result
    - timeout / `mcp_unavailable` / `browser_bridge_not_proven` 等失败分支
  - 对齐 SSOT / runbook / wave prompt，使 operator 能依据同一术语读取 browser task 状态。
- Out of scope:
  - 不重新定义 `0218` 已冻结的 `browser_task_request.json` / `browser_task_result.json` schema。
  - 不重写 `0219` 的 Browser Agent Bridge 协议边界；除主循环接线所需的最小 helper 补强外，不把 0220 漂移成 bridge 重构。
  - 不做真实 Playwright MCP smoke；那是 `0221-playwright-mcp-local-smoke` 的职责。
  - 不做 `0222-0225` 的本地/远端 rollout、集群操作或环境波次验证。
  - 不把 local artifact-only evidence 当成 PASS。

## Contract Targets

- `0220` 必须把以下合同从“文档要求”变成“主循环事实”：
  - execution handshake：
    - Codex execution 输出中必须有显式 browser request 入口；
    - orchestrator 根据该结构写出 canonical `request.json`，而不是靠正则/prose 猜测。
  - browser subphase：
    - browser task 必须成为主循环中的显式等待点；
    - phase/subphase 必须可恢复、可判定、可写入事件。
  - authoritative ingest：
    - `state.json` 至少记录 `task_id`、`attempt`、`status`、`failure_kind`、`request_file`、`result_file`、`artifact_paths`、`ingested_at`；
    - browser result 文件本身不得替代 `state.json` 成为恢复真源。
  - audit projection：
    - `events.jsonl` 中存在 browser lifecycle 结构化事件；
    - `status.txt` 中存在 browser 状态投影；
    - `runlog.md` 中记录 request/result/artifact 路径和最终 PASS/FAIL。
  - recovery semantics：
    - `--resume` 必须能识别 pending request、已有 valid result、stale/duplicate 冲突、timeout 与 orphaned event；
    - 恢复后不会重复制造第二次成功或吞掉 bridge 冲突。

## Impact Surface

- 预计会直接影响的主循环/协议文件：
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/prompts.mjs`
  - `scripts/orchestrator/drivers.mjs`
  - `scripts/orchestrator/schemas/exec_output.json`
- 预计会直接影响的 authoritative / derived audit 文件：
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/monitor.mjs`
- 预计会直接影响的 bridge 复用面：
  - `scripts/orchestrator/browser_bridge.mjs`
  - `scripts/orchestrator/browser_agent.mjs`
  - 前提是只做 orchestrator ingest/resume 所需的最小对接，不重开 0219 的合同。
- 预计会直接影响的 regression / docs 面：
  - `scripts/orchestrator/test_orchestrator.mjs`
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`

## Reusable Mechanisms And Missing Pieces

- 已可直接复用：
  - `0218` 冻结的 request/result schema、failure taxonomy、audit mapping；
  - `0219` 的 `browser_bridge.mjs` / `browser_agent.mjs` / `test_browser_agent_bridge.mjs`；
  - 现有 orchestrator 的 atomic state commit、append-only events、status refresh、resume/orphan detection 基础骨架。
- `0220` 当前必须补齐但仓库里仍缺失：
  - execution 输出到 browser request 的结构化入口；
  - 主循环中显式的 browser phase/subphase；
  - result/artifact 到 authoritative state 的 ingest 逻辑；
  - browser-specific status 投影；
  - 主回归里针对 browser 生命周期的 deterministic coverage。

## Invariants / Constraints

- 严格遵守 `CLAUDE.md`、`docs/WORKFLOW.md`、`docs/ITERATIONS.md`、`docs/ssot/orchestrator_hard_rules.md` 以及 `0218`/`0219` 已冻结边界。
- `state.json` 仍是唯一恢复真源；`request.json`、`result.json`、`output/playwright/...` 都只能在 ingest 前作为 local exchange/evidence 存在。
- browser task PASS 的必要条件不变：
  - `result.status = pass`
  - required artifacts 实际存在
  - orchestrator 已把结果写进自己的 evidence chain
- browser capability 必须继续通过显式 bridge surface 建模；禁止把浏览器能力重新偷塞进 `drivers.mjs` 的通用 CLI 假设。
- `0220` 可以继续使用 mock / contract-driven verification，但不得把 mock proof 冒充为 `0221` 的 real MCP proof。
- 如果实现发现必须修改 `0218` 已冻结的 schema 字段名、failure taxonomy 或 PASS 规则，必须停止并回到 planning/SSOT，而不是在实现中私自扩写。
- 现有 planning/review/execution/final verification 语义不能被 browser subphase 破坏；browser task 失败必须进入既有 escalation / on_hold 决策体系。

## Success Criteria

- execution 阶段可以产生结构化 browser request，orchestrator 能据此写出 canonical `request.json` 并驱动/等待 Browser Agent Bridge。
- browser result 一旦生成，orchestrator 能将其 deterministic 地写入：
  - `state.json`
  - `events.jsonl`
  - `status.txt`
  - `runlog.md`
- `--resume` 在以下场景下都有稳定行为：
  - request 已写出但 result 未到达
  - result 已存在但未 ingest
  - stale/duplicate/orphan/timeout 冲突
  - `mcp_unavailable` 或 `browser_bridge_not_proven`
- `scripts/orchestrator/test_orchestrator.mjs` 中存在 browser-specific regression，而不仅是“文档提到 browser_task”。
- `0221` 可以在不返修主循环的前提下，直接把真实 Playwright MCP 证明叠加到同一 browser task 路线上。

## Risks & Mitigations

- Risk:
  - 为了接入 browser task 而临时修改 `0218` schema 或 `0219` bridge contract，导致上游冻结边界失效。
  - Mitigation:
    - 把 0218/0219 视为上游合同；若字段/语义不足，停止并回到 planning，而不是在 0220 中“顺手补”。
- Risk:
  - 将 local artifact 或 existing result 误当 authoritative source，破坏 resume 一致性。
  - Mitigation:
    - 所有 resume/monitor/on_hold 决策以 `state.json` 为准；request/result/artifact 只能作为 ingest 输入。
- Risk:
  - browser phase 侵入现有 review/execution 流程，造成 phase 语义漂移或回归。
  - Mitigation:
    - 让 browser 成为显式 subphase/wait point，并通过 deterministic regression 固定进入、退出、失败、恢复路径。
- Risk:
  - 0220 scope 漂移到真实 MCP、环境部署或人工浏览器验证。
  - Mitigation:
    - 明确把 real MCP proof 保留给 0221，把环境波次保留给 0222-0225。

## Alternatives

### A. 推荐：扩 `exec_output` 握手 + 主循环显式 browser subphase + authoritative ingest

- 优点：
  - request 来源、等待点、恢复点和审计点都可结构化表达；
  - 与 0218/0219 的 contract/bridge 对齐，0221 只需替换真实 executor proof。
- 缺点：
  - 需要同时触及 prompt/schema/parser/state/event/monitor/test 多个面。

### B. 新增一个独立 top-level browser phase，脱离 EXECUTION 流程单独跑

- 优点：
  - 语义上看起来更独立。
- 缺点：
  - 会大幅冲击既有 phase 设计、resume 逻辑和 review 边界，改动面更大，不利于在 0220 收敛。

### C. 继续让 bridge 自行落盘 result/artifact，orchestrator 只在 runlog 里写说明

- 优点：
  - 短期实现最省事。
- 缺点：
  - 直接违反 `0218` 对 authoritative ingest/PASS rule 的要求，无法支持 resume、status 和 deterministic regression。

当前推荐：A。

## Inputs

- Created at: 2026-03-23
- Iteration ID: `0220-orchestrator-browser-phase-and-regression`
- Planning mode: `refine`
- Upstream:
  - `0218-orchestrator-browser-task-contract-freeze`
  - `0219-orchestrator-browser-agent-bridge`
- Downstream:
  - `0221-playwright-mcp-local-smoke`
  - `0222-local-cluster-rollout-baseline`
  - `0223-local-cluster-browser-evidence`
  - `0224-remote-rollout-baseline`
  - `0225-remote-browser-evidence`
