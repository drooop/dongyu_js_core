---
title: "0219 — orchestrator-browser-agent-bridge Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0219-orchestrator-browser-agent-bridge
id: 0219-orchestrator-browser-agent-bridge
phase: phase1
---

# 0219 — orchestrator-browser-agent-bridge Plan

## Goal

- 在 `0218-orchestrator-browser-task-contract-freeze` 已冻结的 request/result schema、artifact 路径和 failure taxonomy 基础上，落地一套可执行的 Browser Agent Bridge，使 browser-capable executor 能通过 batch-local 文件交换消费 `browser_task`，并回写结构化 result 与本地 evidence。
- 让 `0220-orchestrator-browser-phase-and-regression` 可以直接接入既有 bridge，而不是在主状态机里继续发明浏览器执行协议、consumer boundary 或恢复语义。

## Background

- `0218` 已冻结以下合同面：
  - request/result schema：
    - `scripts/orchestrator/schemas/browser_task_request.json`
    - `scripts/orchestrator/schemas/browser_task_result.json`
  - batch-local exchange 路径：
    - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/request.json`
    - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/result.json`
  - local evidence 路径：
    - `output/playwright/<batch_id>/<task_id>/...`
  - browser failure taxonomy、PASS 判定和 `state/events/status/runlog` evidence mapping。
- 但截至 2026-03-23，仓库里仍然缺少真正把这份合同变成可运行 bridge 的实现面：
  - `scripts/orchestrator/state.mjs` 只提供 batch 目录和 `state.json` / `transcripts/` 等通用路径语义，没有 browser task exchange helper。
  - `scripts/orchestrator/drivers.mjs` 只封装 `codex exec` 和 `claude -p`，不能代表 browser-capable executor，也不能假装天然拥有 Playwright MCP。
  - `scripts/orchestrator/monitor.mjs` 和 `scripts/orchestrator/orchestrator.mjs` 还没有 browser phase / ingest wiring；这些属于 `0220`。
  - 当前 deterministic test 只有 `scripts/orchestrator/test_browser_task_contract.mjs`，它验证 contract 本身，但不验证真实的 request/result file exchange、consumer boundary、mock executor 或 restart idempotency。
- 因此 `0219` 的职责不是接入主循环，而是先把“合同如何被消费”这件事稳定下来：request 谁写、consumer 谁拿、result 谁回、重复消费如何拒绝、mock 证据如何 deterministic 地生成。

## Problem Statement

- 如果没有可执行的 bridge，`0218` 冻结的 schema 只是静态合同，`0220` 无法验证主循环在等待的到底是哪个本地 exchange 行为，`0221` 也无法把真实 MCP proof 与 bridge bug 区分开。
- 如果把 browser capability 偷塞进 `drivers.mjs` 或某个普通 CLI child process，会直接破坏 `0218` 明确冻结的 executor boundary：
  - orchestrator 将重新依赖“子进程也许有 MCP”这种隐含假设；
  - `mcp_unavailable` / `browser_bridge_not_proven` 会失真；
  - 后续恢复与 stop rule 无法基于结构化 bridge 结果做 deterministic 判断。
- 如果没有 mock executor 和 bridge-local recovery，后续 `0220` / `0221` 只能一边调 orchestrator 一边调 browser executor，问题定位会混在一起，难以审计。

## Scope

- In scope:
  - 实现 batch-local Browser Agent Bridge，消费 `request.json` 并回写 `result.json`，严格遵守 `0218` 已冻结的 schema 与路径。
  - 实现显式的 Browser Agent consumer boundary，包括：
    - 如何发现 pending request
    - 如何 claim / 执行 / 完成一个 task
    - 如何把 executor metadata 和 artifact manifest 写回 result
  - 实现 deterministic mock executor，用于在无真实 MCP 的前提下证明 bridge exchange、artifact 落盘和 failure path。
  - 实现 bridge-local idempotent recovery，至少覆盖：
    - 已完成 result 的重复消费短路
    - request/result 非法或冲突时的 fail-fast
    - consumer 重启后的 task-dir 恢复与重复写保护
  - 增加 deterministic regression，覆盖 exchange、consumer boundary、mock executor 和 idempotency。
- Out of scope:
  - 不把 browser task 接入 `scripts/orchestrator/orchestrator.mjs` 主状态机。
  - 不改 `state.json` / `events.jsonl` / `status.txt` 的 browser ingest / browser summary surface；这些属于 `0220`。
  - 不跑真实 Playwright MCP smoke；真实 bridge proof 属于 `0221`。
  - 不做本地/远端环境 rollout、cluster 操作或人工浏览器验证。
  - 不重新定义 `0218` 已冻结的 request/result schema、artifact 目录或 failure taxonomy；若发现合同不足，应停止并回到规划层，而不是在实现中私自扩写。

## Contract Targets

- `0219` 必须把以下 contract 从“可读文档”变成“可运行本地能力”：
  - request consumption：
    - 只消费 `browser_task_request.v1`
    - 只接受 `task_kind=browser_task`
    - 只在 `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/` 内工作
  - result production：
    - 只写 `browser_task_result.v1`
    - `status` / `failure_kind` / artifact manifest 必须与 `0218` schema 一致
    - artifact 必须真实落在 `output/playwright/<batch_id>/<task_id>/...`
  - executor boundary：
    - Browser Agent 是显式 consumer，不是现有 `codex exec` / `claude -p` 的隐式能力
    - `mode=mock|mcp` 都必须通过同一 bridge surface 暴露
  - idempotent recovery：
    - request/result 仍是 canonical exchange 文件
    - 如需 claim/lease/heartbeat 等 bridge-local helper 文件，只能作为 task-dir 内的临时执行辅助，不得抢占 request/result 的 canonical 地位
    - 已完成 attempt 不得被第二次成功消费并覆盖

## Impact Surface

- 预期 implementation surface：
  - `scripts/orchestrator/browser_bridge.mjs`
    - bridge-local path derivation
    - request/result validation
    - claim / result write / duplicate guard helper
  - `scripts/orchestrator/browser_agent.mjs`
    - Browser Agent consumer entrypoint
    - mock / mcp executor boundary
  - `scripts/orchestrator/test_browser_agent_bridge.mjs`
    - deterministic exchange / consumer / idempotency regression
  - `scripts/orchestrator/test_browser_task_contract.mjs`
    - 如有必要，仅做 contract-alignment 断言增强
- 明确不属于 `0219` 的 implementation surface：
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/monitor.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/drivers.mjs`
- 若执行中发现必须改这些主循环或审计文件才能让 bridge 成立，结论应是“`0218` / `0219` 合同边界不足，需要回到 planning”，而不是直接扩 scope。

## Reusable Mechanisms And Missing Pieces

- 已有可复用基础：
  - `scripts/orchestrator/state.mjs` 的 batch 目录约定与原子写理念
  - `0218` 冻结的 request/result schema 与 failure taxonomy
  - `scripts/orchestrator/test_browser_task_contract.mjs` 的 contract baseline
  - `docs/ssot/orchestrator_hard_rules.md` 与 `docs/user-guide/orchestrator_local_smoke.md` 已定义的 evidence boundary
- `0219` 必须补齐但当前缺失的 pieces：
  - request/result file exchange helper
  - Browser Agent consumer entrypoint
  - mock executor 和 deterministic artifact writer
  - bridge-local duplicate/stale/idempotent recovery regression

## Invariants / Constraints

- 严格遵守 `CLAUDE.md`、`docs/WORKFLOW.md`、`docs/ITERATIONS.md`、`docs/ssot/orchestrator_hard_rules.md` 和 `0218` 已冻结的 browser_task contract。
- Browser Agent 必须是显式 capability boundary；禁止把“浏览器能力”偷塞回 `drivers.mjs` 或任何普通 child CLI 假设。
- `0219` 只能交付 local bridge surface，不能提前宣布 orchestrator 已 ingest browser result。
- mock executor 必须生成真实落盘 artifact，而不是只返回 prose 或内存对象；否则无法证明 bridge 符合 `0218` 的 artifact contract。
- request/result 之外新增的任何 bridge-local helper 文件都只能是临时执行辅助，不能升级为新的 authoritative contract。
- 若 bridge 需要新增 schema 字段、改 failure taxonomy 或改变 PASS 判定，必须停下来回到 planning / SSOT，而不是在 `0219` 中边写边改合同。

## Success Criteria

- deterministic regression 可以创建 contract-valid request，驱动 Browser Agent consumer 完成一次 mock 执行，并得到 contract-valid `result.json` 与 required artifacts。
- 重复运行同一 consumer 或在已有成功 result 的 task 上重启 consumer，不会重复完成、覆盖或伪造第二次成功。
- bridge 对 invalid request、duplicate result、stale/冲突执行的处理有 deterministic 结果，并复用 `0218` 的既有 failure taxonomy。
- `0220` 可以直接复用 `0219` bridge，把精力集中在 orchestrator phase / ingest / resume，而不是继续补 bridge 本身。

## Risks & Mitigations

- Risk:
  - `0219` scope 漂移到 orchestrator 主循环，提前修改 phase / state / monitor 语义。
  - Mitigation:
    - 将 `orchestrator.mjs`、`monitor.mjs`、`events.mjs` 明确列为 out of scope；一旦必须改动，立即升级为 planning 问题。
- Risk:
  - claim/lease 实现被误当成新合同，后续执行者绕过 request/result 直接依赖临时文件。
  - Mitigation:
    - 在计划中明确 request/result 才是 canonical exchange，临时文件只能是 bridge-local helper。
- Risk:
  - mock executor 过于宽松，掩盖真实 MCP 场景下的 bridge 缺陷。
  - Mitigation:
    - `0219` 只把 mock 作为 bridge 语义证明；真实 MCP proof 仍由 `0221` 单独承担，不允许以 mock 替代。

## Alternatives

### A. 推荐：独立 bridge module + 独立 Browser Agent consumer

- 优点：
  - bridge 语义与 orchestrator 主状态机解耦，`0220` / `0221` 责任清晰。
  - mock executor、真实 MCP executor 可以复用同一 request/result surface。
- 缺点：
  - 需要新增 bridge/consumer/test 三个面，而不是简单把逻辑塞进现有 driver。

### B. 把 browser capability 直接塞进 `drivers.mjs`

- 优点：
  - 短期文件数更少。
- 缺点：
  - 重新引入“child CLI 隐含有 MCP”的错误假设，破坏 `0218` executor boundary，也让 `mcp_unavailable` 难以审计。

### C. 不做 mock executor，等待 `0221` 直接证明真实 MCP

- 优点：
  - 表面上减少中间层。
- 缺点：
  - 0220/0221 会把 bridge 问题、主循环问题和真实 MCP 问题混在一起，定位成本高，且不满足 wave 对 `0219` deterministic mock-evidence 的要求。

当前推荐：A。

## Inputs

- Created at: 2026-03-23
- Iteration ID: `0219-orchestrator-browser-agent-bridge`
- Planning mode: `refine`
- Upstream:
  - `0218-orchestrator-browser-task-contract-freeze`
- Downstream:
  - `0220-orchestrator-browser-phase-and-regression`
  - `0221-playwright-mcp-local-smoke`
