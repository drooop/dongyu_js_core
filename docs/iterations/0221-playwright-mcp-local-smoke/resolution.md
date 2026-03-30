---
title: "0221 — playwright-mcp-local-smoke Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-23
source: ai
iteration_id: 0221-playwright-mcp-local-smoke
id: 0221-playwright-mcp-local-smoke
phase: phase1
---

# 0221 — playwright-mcp-local-smoke Resolution

## Execution Strategy

- 先冻结唯一的本地 smoke URL、最小断言集和真实 MCP executor handoff，确保 `0221` 证明的是“真实 bridge 可用”，不是“页面大概能打开”。
- 再在不改 schema 的前提下，补齐最小的 real-MCP consumer/helper 或 operator handoff，使一个真实 browser task 能产出 canonical `result.json` 与 `output/playwright/...` artifact。
- 最后用现有 orchestrator ingest 链把 request/result/artifact 升级为 authoritative PASS evidence；若 executor 不可用或 artifact 不合规，则显式收口为 blocker，不做假通过。

## Delivery Boundaries

- 本 iteration 允许的改动面：
  - `scripts/orchestrator/` 下与 real MCP handoff 直接相关的最小 bridge/consumer/helper 代码
  - 本地 smoke 前置脚本、operator docs、wave prompt 和 `0221` 自身 runlog
  - 仅在真实 smoke 暴露缺口时，对 orchestrator ingest / status / runlog 进行最小 bugfix
- 本 iteration 不允许的改动面：
  - `0218` 已冻结的 schema、failure taxonomy、PASS rule 或 canonical path
  - 把 `0221` 扩成新的 browser phase 设计或环境 rollout iteration
  - 用 mock executor、prose 描述、孤立 artifact 或人工默认点击替代真实 MCP proof
  - 启动 `0222-0225` 的本地/远端环境波次

## Planned Deliverables

- Real MCP handoff surface:
  - `scripts/orchestrator/browser_agent.mjs`
  - 如现有 CLI 不足以表达显式 handoff，则新增一个最小 helper：
    - `scripts/orchestrator/playwright_mcp_local_smoke.mjs`
  - 如 helper 需要共享 contract 校验，仅最小更新：
    - `scripts/orchestrator/browser_bridge.mjs`
    - `scripts/orchestrator/test_browser_agent_bridge.mjs`
- Local smoke preflight / operator docs:
  - `scripts/tests/test_0145_workspace_single_submit.mjs`
  - `scripts/ops/README.md`
  - `docs/user-guide/project_address_record.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`
- Evidence and minimal regression:
  - `docs/iterations/0221-playwright-mcp-local-smoke/runlog.md`
  - 如真实 smoke 暴露 ingest bug，最小更新：
    - `scripts/orchestrator/orchestrator.mjs`
    - `scripts/orchestrator/state.mjs`
    - `scripts/orchestrator/events.mjs`
    - `scripts/orchestrator/monitor.mjs`
    - `scripts/orchestrator/iteration_register.mjs`
    - `scripts/orchestrator/test_orchestrator.mjs`

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Freeze Real-MCP Smoke Contract | 固定唯一 smoke URL、最小断言、artifact 集和显式 handoff 方式，防止 `0221` 漂移成泛浏览器验证 | `scripts/orchestrator/browser_agent.mjs`, `docs/user-guide/orchestrator_local_smoke.md`, `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`, `docs/user-guide/project_address_record.md`, `scripts/orchestrator/test_browser_agent_bridge.mjs`, `scripts/orchestrator/test_browser_task_contract.mjs` | contract/regression + docs/path grep | 回退 handoff 说明和 contract-aligned 测试改动 |
| 2 | Execute One Narrow Local MCP Smoke | 在本地 ready target 上完成一次真实 `browser_task`，生成 canonical request/result/artifact，不允许 mock fallback | `scripts/orchestrator/browser_agent.mjs`, `scripts/orchestrator/playwright_mcp_local_smoke.mjs`, `scripts/tests/test_0145_workspace_single_submit.mjs`, `scripts/ops/README.md`, runtime evidence paths | baseline check + workspace sanity + real MCP smoke command | 回退 helper / docs，清理本地 runtime artifacts |
| 3 | Prove Authoritative Ingest And Record Evidence | 把真实 smoke 结果写入 `state/events/status/runlog`，并在失败时保持明确 blocker 语义 | `docs/iterations/0221-playwright-mcp-local-smoke/runlog.md`, `scripts/orchestrator/orchestrator.mjs`, `scripts/orchestrator/state.mjs`, `scripts/orchestrator/events.mjs`, `scripts/orchestrator/monitor.mjs`, `scripts/orchestrator/iteration_register.mjs`, `scripts/orchestrator/test_orchestrator.mjs` | orchestrator regression + evidence file checks + runlog/state inspection | 回退最小 ingest bugfix；本地产物只清理不纳入 versioned rollback |

## Step 1 — Freeze Real-MCP Smoke Contract

- Scope:
  - 明确 `0221` 的唯一 smoke 目标，优先沿用当前 contract 示例中的 workspace 页面，而不是在 Phase 3 临时发明新的业务路径。
  - 在 `localhost:30900` 与 `127.0.0.1:30900` 之间裁决一个唯一 URL，并要求 request、命令、runlog、docs 全部一致。
  - 明确真实 MCP executor 的 handoff 方式：
    - 是通过扩展现有 `browser_agent.mjs`
    - 还是通过一个显式的最小 helper 脚本消费 `request.json` / 写回 `result.json`
  - 保持以下 contract 不变：
    - `browser_task_request.v1`
    - `browser_task_result.v1`
    - `.orchestrator/.../request.json`
    - `.orchestrator/.../result.json`
    - `output/playwright/<batch_id>/<task_id>/...`
    - `mcp_unavailable` / `browser_bridge_not_proven` / `artifact_missing` / `artifact_mismatch`
- Files:
  - `scripts/orchestrator/browser_agent.mjs`
  - `scripts/orchestrator/test_browser_agent_bridge.mjs`
  - `scripts/orchestrator/test_browser_task_contract.mjs`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`
  - `docs/user-guide/project_address_record.md`
- Implementation notes:
  - 如果现有 `browser_agent.mjs` 足以承载显式 handoff，就不要新增 helper 文件。
  - 如果必须新增 helper，也只能围绕现有 request/result 路径，不得跳过 `request.json` 直接把 artifact 塞回 ingest。
  - 本步结束时，应让无上下文读者知道：
    - 具体访问哪个 URL
    - 最小需要断言什么
    - 真实 executor 不可用时会怎么失败
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_task_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_agent_bridge.mjs --case consumer-boundary`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "127\\.0\\.0\\.1:30900|localhost:30900|playwright-mcp|mcp_unavailable|browser_bridge_not_proven|browser_task" scripts/orchestrator/browser_agent.mjs docs/user-guide/orchestrator_local_smoke.md docs/user-guide/orchestrator_wave_0218_0221_prompt.txt docs/user-guide/project_address_record.md`
- Acceptance:
  - `0221` 的 smoke 目标、URL、artifact 集和 handoff 方式被唯一化，不再依赖聊天上下文补充说明。
  - 合同层没有新增字段、临时路径或隐式 fallback。
  - 真正的剩余工作只剩“执行 smoke 并写 evidence”，而不是继续讨论 contract。
- Rollback:
  - 回退 Step 1 中对 `browser_agent` / docs / contract-aligned test 的改动。
  - 若创建了不再需要的 helper 入口说明，一并回退；不触碰 `0218-0220` 已成立的 schema 和 ingest 实现。

## Step 2 — Execute One Narrow Local MCP Smoke

- Scope:
  - 先确认本地 baseline 与 workspace smoke 目标 ready，再发起真实 browser task。
  - 使用真实 Playwright MCP-backed executor 完成一次最小 smoke，至少覆盖：
    - 打开约定 URL
    - 完成最小验证动作
    - 生成 `final.png`
    - 生成 `report.json`
  - request/result/artifact 必须全部落在 canonical 路径：
    - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/request.json`
    - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/result.json`
    - `output/playwright/<batch_id>/<task_id>/...`
  - 如果真实 MCP executor 不可用，本步必须直接以 `mcp_unavailable` / `browser_bridge_not_proven` 停止，不允许切到 mock。
- Files:
  - `scripts/orchestrator/browser_agent.mjs`
  - 如 Step 1 判定需要 helper：
    - `scripts/orchestrator/playwright_mcp_local_smoke.mjs`
  - `scripts/tests/test_0145_workspace_single_submit.mjs`
  - `scripts/ops/README.md`
  - runtime evidence:
    - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/request.json`
    - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/result.json`
    - `output/playwright/<batch_id>/<task_id>/final.png`
    - `output/playwright/<batch_id>/<task_id>/report.json`
    - 如可得，`trace.zip` / `console.json`
- Implementation notes:
  - 推荐先跑现有 workspace sanity check，再发起浏览器 smoke，避免把页面未 ready 误判为 executor 缺陷。
  - helper 的职责只能是准备 request、触发显式 handoff、校验结果存在；不得重新实现 schema 或绕开 orchestrator evidence chain。
  - 如真实 executor 需要环境变量、输出目录或固定 task_id，必须写进 docs，不允许只存在于一次性 shell history。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && UI_SERVER_URL=http://127.0.0.1:30900 node scripts/tests/test_0145_workspace_single_submit.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && PLAYWRIGHT_MCP_SMOKE=1 BROWSER_TASK_BASE_URL=http://127.0.0.1:30900 bun scripts/orchestrator/test_browser_agent_bridge.mjs --case mcp-local-smoke`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && test -f ".orchestrator/runs/$BATCH_ID/browser_tasks/workspace-smoke/request.json" && test -f ".orchestrator/runs/$BATCH_ID/browser_tasks/workspace-smoke/result.json" && test -f "output/playwright/$BATCH_ID/workspace-smoke/final.png" && test -f "output/playwright/$BATCH_ID/workspace-smoke/report.json"`
- Acceptance:
  - 本地 workspace 目标 ready，且真实 browser task 能产出 contract-valid result 与 required artifacts。
  - 没有发生 mock fallback、artifact-only PASS 或 prose-only PASS。
  - 失败时能明确归类为环境 blocker、`mcp_unavailable` 或 artifact contract 问题。
- Rollback:
  - 回退 Step 2 中新增的 helper / docs 改动。
  - 清理 `.orchestrator/runs/<batch_id>/browser_tasks/...` 与 `output/playwright/<batch_id>/...` 本地 smoke 痕迹。
  - 不对 `0218-0220` 的 contract/ingest 做越级回退。

## Step 3 — Prove Authoritative Ingest And Record Evidence

- Scope:
  - 让 Step 2 生成的真实 result 进入现有 authoritative audit chain：
    - `state.json.evidence.browser_tasks[]`
    - `events.jsonl`
    - `status.txt`
    - `docs/iterations/0221-playwright-mcp-local-smoke/runlog.md`
  - 只在真实 smoke 暴露缺陷时，对 ingest / status / runlog append 做最小 bugfix，并补回归。
  - 在 `runlog.md` 中记录：
    - base URL
    - request/result 路径
    - artifact 路径
    - PASS/FAIL
    - 若失败，明确 blocker kind 与停止原因
- Files:
  - `docs/iterations/0221-playwright-mcp-local-smoke/runlog.md`
  - 如确有必要：
    - `scripts/orchestrator/orchestrator.mjs`
    - `scripts/orchestrator/state.mjs`
    - `scripts/orchestrator/events.mjs`
    - `scripts/orchestrator/monitor.mjs`
    - `scripts/orchestrator/iteration_register.mjs`
    - `scripts/orchestrator/test_orchestrator.mjs`
- Implementation notes:
  - 优先假设 `0220` ingest 已经足够；只有真实 smoke 暴露 bug，才允许动这些文件。
  - 任一 bugfix 都必须直接对准真实 smoke 暴露的问题，且伴随 regression；禁止“顺手整理”无关逻辑。
  - 若最终结果不是 PASS，也必须把 evidence chain 写完整，证明为什么是 blocker，而不是“没来得及验证”。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node -e "const fs=require('fs'); const state=JSON.parse(fs.readFileSync('.orchestrator/runs/' + process.env.BATCH_ID + '/state.json','utf8')); const iter=state.iterations.find(x=>x.id==='0221-playwright-mcp-local-smoke'); const task=iter && iter.evidence && iter.evidence.browser_tasks && iter.evidence.browser_tasks[iter.evidence.browser_tasks.length-1]; if (!task) throw new Error('browser_task_missing'); if (task.status !== 'pass') throw new Error('browser_task_not_pass:' + task.failure_kind); console.log(task.request_file); console.log(task.result_file);" `
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "Browser Task Result|Request File:|Result File:|Result: PASS|Failure Kind:" docs/iterations/0221-playwright-mcp-local-smoke/runlog.md`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "\"event_type\":\"browser_task\"|Browser Task:|Browser Failure Kind:" ".orchestrator/runs/$BATCH_ID/events.jsonl" ".orchestrator/runs/$BATCH_ID/status.txt"`
- Acceptance:
  - 真实 MCP smoke 的 PASS 不是停留在 local artifact，而是被 authoritative ingest 为正式 evidence。
  - `runlog.md` 足以让无上下文读者理解这次 smoke 做了什么、看哪里、为什么判 PASS/FAIL。
  - 若真实 smoke 失败，failure kind、evidence path、stop reason 也已完整沉淀，足以阻断下游 wave。
- Rollback:
  - 回退 Step 3 中最小 ingest bugfix 与对应 regression。
  - 保留 `0218-0220` 已成立 contract，不把失败 smoke 的 runtime evidence 当作 versioned 回退对象。
  - 本地 `.orchestrator/` / `output/playwright/` 痕迹只做环境清理，不写成“代码回退”。

## Final Verification Target For 0221

- 至少一个真实 `workspace-smoke` browser task 使用 Playwright MCP-backed executor 完成 PASS。
- required artifacts 至少包含：
  - `final.png`
  - `report.json`
- PASS evidence 同时存在于：
  - canonical request/result 文件
  - `output/playwright/<batch_id>/<task_id>/...`
  - `state.json.evidence.browser_tasks[]`
  - `events.jsonl`
  - `status.txt`
  - `docs/iterations/0221-playwright-mcp-local-smoke/runlog.md`
- 若无法获得真实 MCP-backed executor，则 iteration 明确停在 `mcp_unavailable` 或 `browser_bridge_not_proven`，而不是 Completed。

## Rollback Principle

- `0221` 的回退优先局限在 real-MCP handoff 与 smoke evidence 面：
  - 先回退最近一个 Step 的 helper / doc / regression 改动；
  - 每次回退后重新跑 contract/regression 命令，确认没有破坏 `0218-0220` 基线；
  - `.orchestrator/` 与 `output/playwright/` 的本地产物只清理，不参与 git 级回退；
  - 若回退需要触碰 schema、PASS rule 或 browser ingest 合同，说明问题已越界，必须回到 planning 而不是继续执行。

## Notes

- `0221` 的本质不是“再写一个 Playwright 脚本”，而是“让真实 MCP-backed executor 在现有 contract 上留下 authoritative proof”。
- 若 Step 1 证明无需新增 helper，也允许 `0221` 主要交付 docs/runlog/evidence；但真实 PASS 证据本身不可省略。
