---
title: "0234 — local-browser-evidence-effective-rerun Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0234-local-browser-evidence-effective-rerun
id: 0234-local-browser-evidence-effective-rerun
phase: phase1
---

# 0234 — local-browser-evidence-effective-rerun Plan

## Metadata

- ID: `0234-local-browser-evidence-effective-rerun`
- Date: `2026-03-25`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0234-local-browser-evidence-effective-rerun`
- Planning mode: `refine`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0221-playwright-mcp-local-smoke`
  - `0223-local-cluster-browser-evidence`
  - `0232-local-baseline-surface-gate`
  - `0233-local-matrix-debug-surface-materialization-fix`

## WHAT

本 iteration 的目标不是再修一次 local baseline，也不是继续扩展 Matrix debug 功能，而是基于 `0233` 之后的当前仓库状态，重新执行一次本地环境级别的真实浏览器取证，给出新的 local environment 裁决。

0234 要消费并联合验证两类证据：

- canonical local baseline gate 与 live `/snapshot`
- 真实 Playwright MCP browser evidence

0234 要回答的唯一问题是：

- 在 `0233` 已修复 repo-side persisted asset omission 之后，本地环境是否已经从 `0223` 的 `Local environment not effective` 转为 `Local environment effective`？

如果答案仍是否定，0234 必须说明新的 `not effective` 证据来自哪里；如果当前执行环境无法完成 canonical repair 或无法获得真实 Playwright MCP executor，则 0234 必须显式停在 `blocked/unverified`，不得伪造 `effective` 或复用 `0223` 的旧截图冒充复验。

## WHY

当前仓库事实已经明确表明，0234 必须作为一次“重新裁决”，而不是简单沿用 0223 的旧结论：

- `0223-local-cluster-browser-evidence` 的最终结论是：
  - `Local environment not effective`
  - 其依据是当时 live `/snapshot` 与真实浏览器都仍暴露旧 surface：
    - Home 是旧 `home-datatable`
    - Workspace 仍是旧 registry / 旧 asset tree
    - Matrix debug formal page asset 尚未 materialize
- `0232-local-baseline-surface-gate` 已把 canonical local gate 收紧到 live surface 级别，不再允许只靠 deployment/secret ready 就宣称 baseline ready
- `0233-local-matrix-debug-surface-materialization-fix` 已在 repo-side 修复并锁定以下事实：
  - `scripts/ops/sync_local_persisted_assets.sh` 之前遗漏了 `matrix_debug_surface.json`
  - 现在 persisted-assets sync 与 loader contract tests 已恢复绿色
  - 但 `0233` 的 Step 3/4 仍记录：
    - 当前执行环境无法通过 `ensure_runtime_baseline.sh` 证明 canonical local repair 已成功 materialize 到 live environment
    - 因而 `0233` 的 live 环境结论仍是 `blocked/unverified`

因此，0234 的必要性在于：

- `0223` 的 `not effective` 结论对“修复前环境”是有效的，但对“0233 修复后环境”不再足够新
- `0233` 已修好 repo-side authoritative chain，却没有拿到新的 environment-level green evidence
- downstream 决策不能停在“代码看起来修好了”；必须有 fresh browser evidence + live snapshot 共同裁决

## 当前问题陈述

0234 面对的是一个已收敛但未完成闭环的问题：

- repo authoritative inputs 已经指向新的目标状态：
  - `Model -22 / 0,1,0 / page_asset_v0 = root_home`
  - `Model -100 / 0,1,0 / page_asset_v0 = matrix_debug_root`
  - `Model -103 / 0,1,0 / page_asset_v0` 存在
  - `Model -102 / 0,11,0 / gallery_showcase_tab = matrix`
  - `Model -2 / ws_apps_registry` 包含 `100`、`-100`、`-103`、`1003`、`1004`、`1005`、`1007`，且不暴露 `1006`、`1008`
- 但 `0233` 还没有证明当前 local environment 已真实 materialize 到这些值
- 只要 canonical local gate 仍未 PASS，或者 fresh browser evidence 仍能看到旧 `home-datatable` / 旧 workspace registry / 缺失的 Matrix debug surface，就不能宣称 local environment effective

0234 的任务就是把“repo 已修复”与“环境已生效”之间的最后证据缺口补齐。

## Scope

### In Scope

- 复核 `0223` 与 `0233` 的事实，固定 0234 的复验前提与 artifact contract
- 通过 canonical local repair 路径重获可裁决的本地环境：
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/check_runtime_baseline.sh`
  - `http://127.0.0.1:30900/snapshot`
- 使用真实 Playwright MCP 执行一次 fresh local browser evidence rerun
- 产出单次、可追溯的 evidence pack：
  - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/request.json`
  - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/result.json`
  - `output/playwright/<batch_id>/<task_id>/home.png`
  - `output/playwright/<batch_id>/<task_id>/workspace.png`
  - `output/playwright/<batch_id>/<task_id>/matrix-debug.png`
  - `output/playwright/<batch_id>/<task_id>/prompt.png`
  - `output/playwright/<batch_id>/<task_id>/report.json`
  - 可选：`console.json`、`trace.zip`
- 给出新的本地环境结论：
  - `Local environment effective`
  - 或 `Local environment not effective`
  - 若前置条件无法达成，则明确记录 `blocked/unverified`

### Out Of Scope

- 不在 0234 内继续修改 runtime、renderer、server、system-model patch 或 ops 脚本
- 不重新规划 `0232`/`0233`；0234 只消费其合同与执行证据
- 不做 remote browser evidence；远端仍属于 `0225`
- 不允许使用人工浏览器截图替代真实 Playwright MCP evidence
- 不允许在 browser rerun 过程中顺手修新发现的缺陷；若发现新的 repo-side 缺口，必须停止并新开 fix iteration

## Evidence Contract

0234 冻结一份单任务 evidence pack，避免 Phase 3 再临时发明文件命名或裁决口径：

- Batch ID:
  - `0234-local-browser-evidence-effective-rerun`
- Browser task ID:
  - `local-effective-rerun`
- Canonical exchange path:
  - `.orchestrator/runs/0234-local-browser-evidence-effective-rerun/browser_tasks/local-effective-rerun/request.json`
  - `.orchestrator/runs/0234-local-browser-evidence-effective-rerun/browser_tasks/local-effective-rerun/result.json`
- Canonical artifact dir:
  - `output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/`

`report.json` 必须至少沉淀以下字段，确保 Step 4 可以用 shell 命令直接校验：

- `home.surface_marker`
- `home.legacy_home_datatable_detected`
- `workspace.observed_registry_model_ids`
- `workspace.legacy_registry_detected`
- `matrix_debug.surface_marker`
- `matrix_debug.visible`
- `prompt.reachable`
- `verdict_candidate`
- `console_errors`

其中：

- `home.surface_marker` 预期为 `root_home`
- `matrix_debug.surface_marker` 预期为 `matrix_debug_root`
- `workspace.observed_registry_model_ids` 必须足以判断新旧 registry 是否对齐
- `verdict_candidate` 只能是：
  - `effective`
  - `not_effective`

## Impact Surface

### Read-only authoritative inputs

- `scripts/ops/check_runtime_baseline.sh`
- `scripts/ops/ensure_runtime_baseline.sh`
- `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`
- `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
- `scripts/orchestrator/browser_bridge.mjs`
- `scripts/orchestrator/browser_agent.mjs`
- `packages/ui-model-demo-server/server.mjs`
- `docs/iterations/0223-local-cluster-browser-evidence/runlog.md`
- `docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md`

### 预期 Phase 3 写入面

- `docs/iterations/0234-local-browser-evidence-effective-rerun/runlog.md`
- `.orchestrator/runs/0234-local-browser-evidence-effective-rerun/browser_tasks/local-effective-rerun/request.json`
- `.orchestrator/runs/0234-local-browser-evidence-effective-rerun/browser_tasks/local-effective-rerun/result.json`
- `output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/*`

### 明确不计划写入的源码面

- `packages/worker-base/**`
- `packages/ui-renderer/**`
- `packages/ui-model-demo-server/**`
- `scripts/ops/*.sh`
- `scripts/tests/*.mjs`
- `scripts/orchestrator/*.mjs`

若执行期证明必须修改这些源码文件，0234 应停止并返回新的 fix iteration 需求，而不是在本 iteration 内扩 scope。

## Success Criteria

- `0234` 重新消费了 `0232` gate 与 `0233` 修复后的当前仓库基线，而不是复用 `0223` 的旧裁决
- canonical local baseline gate 已被重新执行，并给出可复现的 PASS/FAIL 事实
- fresh Playwright MCP evidence 已落在 canonical `.orchestrator` / `output/playwright` 路径
- `report.json`、`result.json`、screenshots 足以支持无上下文读者复核结论
- 若 preconditions 满足，0234 必须输出明确的：
  - `Local environment effective`
  - 或 `Local environment not effective`
- 若 preconditions 不满足，0234 必须明确记录 blocker，且终态只能是 `blocked/unverified`

## Constraints And Invariants

- 严格遵循 `CLAUDE.md` 的 `HARD_RULES`、`CAPABILITY_TIERS`、`WORKFLOW`
- 当前阶段是 Phase 1，只能生成 `plan.md` 与 `resolution.md`
- 0234 是 verification-only iteration，不是 repair iteration
- local effective 的结论必须由两类证据共同支持：
  - `check_runtime_baseline.sh` + live `/snapshot`
  - real Playwright MCP browser evidence
- 任一关键前提缺失时，不得把部分绿色信号包装成 `effective`
- 不得把 `0223` 的旧截图、旧 runlog、旧 snapshot 当作 fresh rerun evidence
- 不得使用 mock browser executor、人工点击、prose-only “看起来对了”替代真实 evidence chain

## Assumptions And Validation Methods

- Assumption A:
  - canonical local endpoint 仍是 `http://127.0.0.1:30900`
  - Validation:
    - 以 `scripts/ops/check_runtime_baseline.sh` 的 `LOCAL_BASE_URL` 默认值为准

- Assumption B:
  - `0233` 的 repo-side persisted asset 修复已经是当前仓库事实
  - Validation:
    - 以 `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs` 和 `0233` runlog 为准

- Assumption C:
  - 真实 Playwright MCP executor 对执行者可用
  - Validation:
    - 以 `request.json.executor.mode == "mcp"`、`request.json.executor.executor_id == "playwright-mcp"`，且 `result.json.failure_kind != "mcp_unavailable"` 为准

- Assumption D:
  - `report.json` 可以作为 browser-side结构化摘要
  - Validation:
    - Step 1 冻结字段；Step 3 只接受满足字段合同的 evidence pack

## Risks And Mitigations

- Risk:
  - canonical local gate 仍旧不可达，导致根本没有可裁决环境
  - Mitigation:
    - 0234 把 gate 作为 browser rerun 之前的硬前提；前提不成立时只输出 `blocked/unverified`

- Risk:
  - 真实 browser task 成功产出截图，但 report/paths 不可追溯，最后仍无法审计
  - Mitigation:
    - 0234 冻结单 batch、单 task、固定 artifact 名称和 `report.json` 最小字段集合

- Risk:
  - 执行者为了拿到绿色结论，绕过 browser_task contract 改用人工截图或 mock executor
  - Mitigation:
    - 明确要求 request/result 文件与 `playwright-mcp` executor 标识；缺任一项都不算 fresh rerun

- Risk:
  - 执行期发现新的 repo-side 缺口，0234 被膨胀成修复 iteration
  - Mitigation:
    - 提前冻结“源码写入面为空”；若必须改源文件，0234 立即停止并要求新开 fix iteration

## Alternatives

### A. 推荐：先通过 canonical local gate，再做一次 fresh Playwright MCP rerun

- 优点：
  - 证据链完整，能区分环境未就绪与页面仍旧
  - 不会重复 `0223` 的 stale verdict
- 缺点：
  - 依赖当前执行环境能触达本地 cluster 与真实 browser executor

### B. 直接重跑浏览器，不先过 `0232` gate

- 优点：
  - 看起来更快
- 缺点：
  - 若环境仍未 canonical repair，会再次得到不干净的混合结论
  - 无法区分问题在 baseline gate 还是在 browser layer

### C. 在 0234 内边跑浏览器边修缺陷

- 优点：
  - 可能一次会话里就把 blocker 修掉
- 缺点：
  - 破坏 0234 的 verification-only 边界
  - 会混淆“复验结论”和“修复行为”

当前推荐：A。
