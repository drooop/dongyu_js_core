---
title: "0221 — playwright-mcp-local-smoke Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-23
source: ai
iteration_id: 0221-playwright-mcp-local-smoke
id: 0221-playwright-mcp-local-smoke
phase: phase1
---

# 0221 — playwright-mcp-local-smoke Plan

## Goal

- 在 `0218-0220` 已冻结并接线完成的 `browser_task` 合同之上，用一次真实 Playwright MCP-backed 本地 smoke 证明 browser bridge 不只是 mock / contract baseline，而是能在真实浏览器会话中产出 canonical request/result/artifact，并被 orchestrator authoritative ingest 为 PASS。

## Background

- 截至 2026-03-23，`0218-0220` 已把 browser capability 的绝大部分基础设施落地：
  - `0218-orchestrator-browser-task-contract-freeze` 已冻结：
    - `scripts/orchestrator/schemas/browser_task_request.json`
    - `scripts/orchestrator/schemas/browser_task_result.json`
    - batch-local exchange 路径：
      - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/request.json`
      - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/result.json`
    - local artifact 路径：
      - `output/playwright/<batch_id>/<task_id>/...`
    - browser failure taxonomy、PASS rule、state/events/status/runlog evidence mapping
  - `0219-orchestrator-browser-agent-bridge` 已交付：
    - `scripts/orchestrator/browser_bridge.mjs`
    - `scripts/orchestrator/browser_agent.mjs`
    - `scripts/orchestrator/test_browser_agent_bridge.mjs`
    - deterministic mock executor、duplicate/stale recovery、canonical request/result helpers
  - `0220-orchestrator-browser-phase-and-regression` 已交付：
    - `scripts/orchestrator/orchestrator.mjs` 中的 browser wait / ingest 路径
    - `scripts/orchestrator/state.mjs` 中的 `recordBrowserTaskRequest()` / `ingestBrowserTaskResult()`
    - `scripts/orchestrator/events.mjs` / `monitor.mjs` / `iteration_register.mjs` 中的 browser audit surface
    - `scripts/orchestrator/test_orchestrator.mjs` 中的 browser handshake / ingest / failure / resume regression
- 但当前仓库仍缺少真实 MCP-backed proof：
  - `scripts/orchestrator/browser_agent.mjs` 当前对 `executor.mode === "mcp"` 直接返回 `mcp_unavailable`，不会产出真实 artifact。
  - `scripts/orchestrator/state.mjs` 会把 mock-only pass 明确降级为 `browser_bridge_not_proven`，因此现有 mock regression 无法替代 `0221`。
  - execution prompt、contract test 与 orchestrator regression 已经默认了一条最小 smoke 形态：
    - `task_id = "workspace-smoke"`
    - `start_url = "http://127.0.0.1:30900/"`
    - `executor = { mode: "mcp", executor_id: "playwright-mcp" }`
    - required artifacts 至少包含 `final.png` 与 `report.json`
  - 本地运行入口文档又记录了同一 UI baseline 的常见地址为 `http://localhost:30900`，说明 `0221` 还需要冻结一个唯一 smoke URL，避免 Phase 3 在 `localhost` / `127.0.0.1` 之间漂移。
- 因此 `0221` 的职责不是再发明协议，而是把“真实 MCP executor 如何显式接入现有 contract，并留下 authoritative PASS evidence”一次跑通。

## Problem Statement

- 当前 browser stack 已经能：
  - 生成 canonical `request.json`
  - 等待 `result.json`
  - ingest browser result 进入 `state.json` / `events.jsonl` / `status.txt` / `runlog.md`
  - 把 mock-only pass 判成 `browser_bridge_not_proven`
- 但它还不能回答最关键的问题：
  - 仓库是否真的存在一条可复现的、真实 Playwright MCP-backed browser task 路线？
  - 当 `executor.mode = "mcp"` 时，bridge 究竟是因为“执行器不可用”而失败，还是只是“仓库还没有把显式 handoff 做完”？
  - 下游 `0222-0225` 能否把 browser capability 当作已证明事实，而不是继续在环境波次中一边 rollout 一边补 bridge proof？
- 如果 `0221` 不完成真实 proof，将直接留下以下风险：
  - `0222-local-cluster-rollout-baseline` 和 `0223-local-cluster-browser-evidence` 无法区分环境问题与 bridge 未被证明的问题。
  - `0224-0225` 会把远端环境风险与本地 executor capability 风险混在一起。
  - 现有 `browser_task` PASS rule 会长期停留在“文档上成立、真实执行上未知”的状态。

## Scope

- In scope:
  - 冻结一条窄的本地 smoke 目标，优先复用现有 contract 示例中的 workspace 页面，而不是再扩展业务场景。
  - 明确真实 Playwright MCP executor 的显式 handoff 边界：
    - request 谁生成
    - 谁消费 `request.json`
    - 谁写回 `result.json`
    - 何时判定 `mcp_unavailable`、`artifact_mismatch`、`browser_bridge_not_proven`
  - 用一次真实 browser task 跑通以下证据链：
    - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/request.json`
    - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/result.json`
    - `output/playwright/<batch_id>/<task_id>/...`
    - `state.json.evidence.browser_tasks[]`
    - `events.jsonl`
    - `status.txt`
    - `docs/iterations/0221-playwright-mcp-local-smoke/runlog.md`
  - 补齐本地 smoke 的前置检查、执行命令、证据读取方法和 stop rule，使无上下文读者可以复跑。
  - 只在真实 smoke 暴露缺口时做最小实现补强；不重开 `0218-0220` 的合同讨论。
- Out of scope:
  - 不修改 `0218` 已冻结的 schema、artifact 路径、failure taxonomy 或 PASS rule。
  - 不重写 `0220` 主循环 browser ingest 逻辑，除非真实 smoke 证明存在 bug，且改动必须最小且有回归。
  - 不启动 `0222-0225` 的本地/远端 rollout、cluster 操作或 environment wave。
  - 不以 mock executor、prose 描述、孤立 artifact 或人工浏览器默认路径替代真实 MCP proof。
  - 不把 manual browser clicking 作为默认 DoD；若必须人工补救，只能作为 coverage gap 记录，不能当成 PASS。

## Impact Surface

- 现实 smoke 的主要实现面：
  - `scripts/orchestrator/browser_agent.mjs`
    - 当前 `mcp` 路径直接返回 `mcp_unavailable`，是最可能需要收口的第一现场
  - `scripts/orchestrator/browser_bridge.mjs`
    - 如真实 MCP executor 需要更清晰的 request/result/artifact helper，只允许做最小补强
  - `scripts/orchestrator/test_browser_agent_bridge.mjs`
    - 当前只覆盖 mock / fail-fast / duplicate / stale；缺少真实 MCP-backed 本地 smoke 案例
- 现实 smoke 的前置与 operator 面：
  - `scripts/tests/test_0145_workspace_single_submit.mjs`
    - 可作为 workspace 目标是否可交互的本地前置 sanity check
  - `scripts/ops/README.md`
  - `docs/user-guide/project_address_record.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`
- 预期保持稳定、不应成为默认改动面的文件：
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/monitor.mjs`
  - `scripts/orchestrator/iteration_register.mjs`
  - 这些文件只在真实 smoke 暴露现有 ingest/monitor/runlog bug 时，才允许最小修复。
- runtime evidence 面（非 versioned 交付物，但必须在计划中明确）：
  - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/request.json`
  - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/result.json`
  - `output/playwright/<batch_id>/<task_id>/...`

## Reusable Mechanisms And Missing Pieces

- 已可直接复用：
  - `browser_task` request/result schema 与 canonical path derivation
  - `materializeBrowserTaskRequests()` 生成 request 的上游握手
  - `recordBrowserTaskRequest()` / `ingestBrowserTaskResult()` 的 authoritative ingest
  - browser lifecycle event / status / runlog append helper
  - `scripts/ops/check_runtime_baseline.sh` 与 `scripts/tests/test_0145_workspace_single_submit.mjs` 的本地前置验证能力
- 当前仍缺失、且必须由 `0221` 收口：
  - 一条明确的、真实 Playwright MCP-backed executor handoff
  - 一份可复制的本地 smoke 执行配方，而不是只在 prompt 示例里出现 `workspace-smoke`
  - 一份真实 PASS evidence，证明 `mcp` 路径可以不经过 mock 就落盘 artifact 并被 ingest
  - 对 `localhost:30900` 与 `127.0.0.1:30900` 的实际 smoke 口径裁决

## Assumptions And Validation Boundary

- Assumption:
  - 真实 Playwright MCP capability 来自显式 browser-capable agent/executor，而不是仓库内任意 Bun/Node 进程的隐含能力。
- Consequence:
  - `0221` 应优先复用现有 request/result/artifact contract，把“外部真实 executor 与仓库内 authoritative ingest”接起来；只有当现有 handoff 不足以复跑时，才增加最小 helper。
- How to validate this assumption in Phase 3:
  - 若在不修改 schema 和主循环的前提下，能让一个真实 MCP executor 完成 `request.json -> result.json -> artifacts -> ingest PASS`，则保持 `0221` 改动最小。
  - 若必须新增 helper，helper 也只能服务于显式 handoff，不得把浏览器能力伪装成普通 CLI 或 mock fallback。

## Invariants / Constraints

- 严格遵守 `CLAUDE.md`、`docs/WORKFLOW.md`、`docs/ITERATIONS.md`、`docs/ssot/orchestrator_hard_rules.md`。
- `0221` 是 proof iteration，不是 contract iteration：
  - 不得重命名 `browser_task` 字段
  - 不得修改 failure taxonomy
  - 不得改变 PASS rule
- browser task PASS 的必要条件保持不变：
  1. `result.json` 中 `status = "pass"`
  2. request 中所有 required artifacts 真实存在于 `output/playwright/<batch_id>/<task_id>/...`
  3. orchestrator 已把结果写进 `state.json` / `events.jsonl` / `status.txt` / `runlog.md`
- 只要真实 MCP executor 不可用，就必须显式停在：
  - `mcp_unavailable`
  - 或 `browser_bridge_not_proven`
  - 不允许偷偷降级到 mock 并宣布 PASS。
- 若真实 smoke 发现的是环境未 ready，而不是 bridge bug，也必须把问题定位为环境 blocker，而不是改写 contract。

## Success Criteria

- 存在一条明确、可复制的本地 smoke 路线，能让无上下文读者复现真实 Playwright MCP-backed browser task。
- 至少一个真实 `browser_task` 在本地 workspace smoke 路径上完成 PASS，且 evidence chain 完整对齐：
  - request/result/artifacts 在 canonical 路径落盘
  - orchestrator ingest 后 `state/events/status/runlog` 可读
- `0221` 结束后，下游 `0222-0225` 不需要再讨论“browser bridge 是否真实可用”，只需讨论环境与目标页面本身。
- 若真实 MCP executor 无法获得，`0221` 会以明确 blocker 结论结束，而不是伪完成。

## Risks & Mitigations

- Risk:
  - 真实 MCP capability 在当前执行环境下不可用。
  - Mitigation:
    - 以 `mcp_unavailable` / `browser_bridge_not_proven` 明确收口，不把 mock 或人工点击记成 PASS。
- Risk:
  - 本地 smoke 目标页面本身未 ready，导致把环境问题误判为 bridge 问题。
  - Mitigation:
    - Phase 3 先执行 baseline / workspace sanity check，再发起 browser task。
- Risk:
  - 为了追求 real smoke，反而把 `0221` 扩成 `0220` 返工或 `0222` rollout。
  - Mitigation:
    - 只允许最小 helper 或 bugfix；不允许扩 scope 到 schema、main loop 重构、cluster rollout。
- Risk:
  - `localhost` / `127.0.0.1` URL 口径不一致，导致 artifact 与 runlog 指向不同 origin。
  - Mitigation:
    - 在 `0221` 明确一个唯一 smoke URL，并在 request、命令、runlog、docs 中统一使用。

## Alternatives

### A. 推荐：复用现有 browser_task contract，只补显式 handoff 和一条真实本地 smoke

- 优点：
  - 改动面最小，能直接验证 `0218-0220` 是否真的够用。
  - 下游 `0222-0225` 可以复用同一 evidence/readout 口径。
- 缺点：
  - 必须正面面对真实 MCP capability 是否可获得。

### B. 继续只用 mock executor，然后在 runlog 中补文字说明

- 优点：
  - 最省事。
- 缺点：
  - 直接违反 `state.mjs` 已冻结的 `browser_bridge_not_proven` 语义。
  - 不能证明真实 executor 存在。

### C. 跳过本地 smoke，直接在 `0223` / `0225` 环境波次中顺带验证

- 优点：
  - 表面上更快。
- 缺点：
  - 会把 bridge proof 与环境 rollout 风险混在一起。
  - 一旦失败，难以判断是 executor、orchestrator、环境还是页面本身的问题。

当前推荐：A。

## Inputs

- Created at: 2026-03-23
- Iteration ID: `0221-playwright-mcp-local-smoke`
- Planning mode: `refine`
- Upstream:
  - `0218-orchestrator-browser-task-contract-freeze`
  - `0219-orchestrator-browser-agent-bridge`
  - `0220-orchestrator-browser-phase-and-regression`
- Downstream:
  - `0222-local-cluster-rollout-baseline`
  - `0223-local-cluster-browser-evidence`
  - `0224-remote-rollout-baseline`
  - `0225-remote-browser-evidence`
