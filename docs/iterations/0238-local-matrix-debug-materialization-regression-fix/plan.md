---
title: "0238 — local-matrix-debug-materialization-regression-fix Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0238-local-matrix-debug-materialization-regression-fix
id: 0238-local-matrix-debug-materialization-regression-fix
phase: phase1
---

# 0238 — local-matrix-debug-materialization-regression-fix Plan

## Metadata

- ID: `0238-local-matrix-debug-materialization-regression-fix`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0238-local-matrix-debug-materialization-regression-fix`
- Planning mode: `refine`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0233-local-matrix-debug-surface-materialization-fix`
  - `0237-local-browser-surface-regressions-fix`
- Downstream:
  - `0240-local-browser-evidence-rerun-after-0238-0239`

## WHAT

本 iteration 只修一个已经被 `0237` Step 1 再次确认的 local authoritative materialization regression，不处理 Home selector，也不处理 renderer/browser fallback：

- repo-side formal contracts 仍然是绿的：
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
- 但当前 live local `/snapshot` 已再次暴露红灯事实：
  - `Model -100 / 0,1,0 / page_asset_v0 = null`
  - 浏览器打开 Workspace 中的 Matrix Debug 时显示 `Model -100 has no UI schema or AST.`
- 当前代码库又重新把 Matrix Debug authoritative materialization 所需的两个 persisted-asset 输入从 local sync 链中丢掉了：
  - `packages/worker-base/system-models/matrix_debug_surface.json`
  - `packages/worker-base/system-models/intent_handlers_matrix_debug.json`

0238 的目标是恢复 Matrix Debug formal surface 在下列链路中的连续性，不再让上述两个 authoritative 文件掉出 current live local 环境：

- repo authoritative assets
- local persisted-asset sync / manifest
- canonical local deploy / repair
- live `/snapshot` materialization

交付完成后，local authoritative truth 必须重新满足：

- `Model -100 / 0,1,0 / page_asset_v0.v.id == "matrix_debug_root"`
- Matrix Debug 所需 handler 继续能通过 persisted loader 进入 live runtime

## WHY

0238 必须被定义为 persisted-asset / deploy / live snapshot 链的 regression fix，而不是 frontend iteration，原因已经足够明确：

- `0237` Step 1 已经判定 Matrix Debug failure 超出其 server/frontend-only 边界：
  - isolated `createServerState({ dbPath: null })` path 仍是绿的
  - live runtime 却缺失 `Model -100 / 0,1,0 / page_asset_v0`
- 当前 `scripts/ops/sync_local_persisted_assets.sh` 的 `system_negative_full` 列表里，已经再次不包含：
  - `matrix_debug_surface.json`
  - `intent_handlers_matrix_debug.json`
- 当前 `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs` 也已经失去 `0233` 曾补过的 end-to-end regression guard；它现在只覆盖 generic loader ordering，不再覆盖 Matrix Debug externalization/materialization
- `packages/ui-model-demo-server/server.mjs` 在有 persisted asset root 时，会通过 `applyPersistedAssetEntries(... scope="ui-server")` 读取 authoritative persisted assets，因此 live local truth 并不是直接等于 repo 文件本身

这意味着当前问题不是“repo 没有 formal surface”，而是“repo formal surface 没有被 authoritative local materialization 链持续带到 live local runtime”。0238 的价值就是修复这个链路回退，并重新把它冻结成可回归验证的合同。

## Current Problem Statement

当前 codebase 呈现的是一个典型的“repo-green / live-red / guard-regressed”三段式回归：

- repo 侧 formal contract 仍存在：
  - `packages/worker-base/system-models/matrix_debug_surface.json` 继续定义 `Model -100 / 0,1,0 / page_asset_v0`
  - `packages/worker-base/system-models/intent_handlers_matrix_debug.json` 继续定义 Matrix Debug intent handlers
- live local authoritative chain 再次断开：
  - `sync_local_persisted_assets.sh` 不再 externalize 这两个文件
  - current manifest 也无法把它们提供给 `ui-server` scope
  - local `/snapshot` 因而再次缺失 `page_asset_v0`
- regression guard 同时被削弱：
  - 当前 `test_0200b_persisted_asset_loader_contract.mjs` 不再验证 `matrix_debug_root` 与 Matrix Debug handlers 是否能被 persisted loader materialize

因此，0238 不是一条新的探索型 iteration，而是一次明确的 regression restoration：恢复 `0233` 已经证明有效、但当前分支再次丢失的 authoritative sync + guard contract。

## Scope

### In Scope

- 追踪并修复 `matrix_debug_surface.json` 与 `intent_handlers_matrix_debug.json` 在 local persisted-asset sync / manifest 中再次丢失的问题
- 恢复 Matrix Debug 对应的 repo-side regression guard，使 current branch 能再次对该 omission 给出 deterministic red/green
- 通过 canonical local repair 重新验证 live `/snapshot` 上的 `Model -100 / 0,1,0 / page_asset_v0`
- 只在必要时检查 persisted loader / deploy / ui-server load path 是否还存在第二处断点

### Out Of Scope

- Home selector / `model0` 问题
- renderer、route projection 或 browser-only workaround
- remote rollout / remote verification / remote browser evidence
- `packages/worker-base/src/runtime.js` 与 `packages/worker-base/src/runtime.mjs` 的解释器语义改动
- 通过 server-owned fallback surface、手工改 live state、手工改 persisted asset root 来伪造通过

## Impact Surface

### Read-only Investigation Surface

- `packages/worker-base/system-models/matrix_debug_surface.json`
- `packages/worker-base/system-models/intent_handlers_matrix_debug.json`
- `packages/worker-base/src/persisted_asset_loader.mjs`
- `scripts/ops/deploy_local.sh`
- `scripts/ops/ensure_runtime_baseline.sh`
- `scripts/ops/check_runtime_baseline.sh`
- `packages/ui-model-demo-server/server.mjs`
- `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
- `docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md`
- `docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md`

### Expected Minimal Write Surface

- `scripts/ops/sync_local_persisted_assets.sh`
- `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`

### Conditional Write Surface

只有当 Step 1 证明“sync/manifest omission 不是唯一断点”时，才允许扩到：

- `packages/worker-base/src/persisted_asset_loader.mjs`
- `scripts/ops/deploy_local.sh`
- `scripts/ops/ensure_runtime_baseline.sh`
- `packages/ui-model-demo-server/server.mjs`

若执行期需要改到上述文件，必须先在 `runlog.md` 中明确写出为什么 `sync_local_persisted_assets.sh + test_0200b_persisted_asset_loader_contract.mjs` 已不足以解释当前 failure。

## Success Criteria

- `scripts/ops/sync_local_persisted_assets.sh` 再次把以下文件 externalize 到 local persisted asset root，并登记到 `manifest.v0.json` 的 `ui-server` patch entries：
  - `system/ui/matrix_debug_surface.json`
  - `system/ui/intent_handlers_matrix_debug.json`
- `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs` 再次具备 end-to-end regression guard，能直接证明：
  - persisted loader materializes `Model -100 / 0,1,0 / page_asset_v0.v.id == "matrix_debug_root"`
  - persisted loader materializes Matrix Debug refresh handler
- canonical local repair 后，live `/snapshot` 满足：
  - `Model -100 / 0,1,0 / page_asset_v0.v.id == "matrix_debug_root"`
- repo-side Matrix Debug contract 继续保持绿色：
  - `test_0213_matrix_debug_surface_contract`
  - `validate_matrix_debug_server_sse`
- 最终结论仍然是 authoritative-chain fix，而不是 browser fallback：
  - 不允许通过补 `ui_ast_v0`
  - 不允许通过 renderer 特判隐藏 `no UI schema or AST`

## Constraints And Invariants

- 严格遵循 `CLAUDE.md` 的 `HARD_RULES`、`CAPABILITY_TIERS`、`WORKFLOW`
- 当前阶段是 Phase 1，只生成 `plan.md` 与 `resolution.md`
- 0238 只修 local Matrix Debug formal surface 在 authoritative materialization 链中的 regression，不扩成“重做 baseline 全链路”
- 必须优先把断点收敛在：
  - repo asset
  - sync / manifest
  - persisted loader
  - canonical local repair
  - live snapshot
- 若执行期证明问题必须改 runtime 语义、model placement 或 formal page asset contract，本 iteration 必须停止并重新规划
- 验证必须是 deterministic PASS/FAIL；仅有“页面看起来正常”不算完成

## Risks And Mitigations

- Risk:
  - 当前 regression 可能不只是一处 sync omission，可能还叠加了 deploy/load-order 问题。
  - Mitigation:
    - 执行期先用 temp persisted asset root 固定 sync/manifest 事实；只有 omission 被修复仍不能 materialize 时，才允许扩到 loader/deploy/server。

- Risk:
  - 只修 externalize file list，不恢复对应 regression guard，后续仍可能再次回退。
  - Mitigation:
    - 把 `test_0200b_persisted_asset_loader_contract.mjs` 明确纳入最小写入面，而不是把验证完全留给人工 runlog。

- Risk:
  - local K8s context 或 canonical baseline gate 当前不可用，导致 live proof 不能完成。
  - Mitigation:
    - 计划中要求明确区分 `repo-fixed` 与 `live-verified`；如果环境不可达，只能报 `blocked/unverified`，不能冒充已完成。

- Risk:
  - 为了快速消除浏览器报错，错误地在 server/renderer 增加 fallback。
  - Mitigation:
    - 把“禁止 fallback surface / fake AST”写成显式约束，确保修复点仍留在 authoritative materialization 链。

## Alternatives

### A. 推荐：恢复 authoritative persisted-asset sync 与 loader guard

- 优点：
  - 直接命中当前已知 regression 点
  - 与 `0233` 的既有结论一致
  - 能同时修复 live local materialization 与 future regression detection
- 缺点：
  - 仍需在执行期确认是否存在第二处 deploy/load-order 断点

### B. 只在 `ui-server` 或 renderer 中补 fallback surface

- 优点：
  - 表面上更快消除浏览器 warning
- 缺点：
  - 违反 authoritative persisted-asset 设计
  - 无法解释为什么 current sync/manifest 已经回退
  - 容易再次制造 repo truth / persisted truth / live truth 三份来源

### C. 直接进入 fresh browser rerun，让 0240 再次裁决

- 优点：
  - 不需要先改 local sync 合同
- 缺点：
  - 只能重复得到 `no UI schema or AST` 或 `not effective` 结论
  - 不能推进 local environment 回到 authoritative green 状态

当前推荐：A。

## Assumptions And Validation Methods

- Assumption A:
  - local authoritative persisted asset root 仍由 `LOCAL_PERSISTED_ASSET_ROOT` / `DY_PERSISTED_ASSET_ROOT` 驱动。
  - Validation:
    - 以 `scripts/ops/sync_local_persisted_assets.sh`、`scripts/ops/deploy_local.sh`、`packages/worker-base/src/persisted_asset_loader.mjs` 为准。

- Assumption B:
  - local canonical live endpoint 仍是 `http://127.0.0.1:30900`。
  - Validation:
    - 以 `scripts/ops/deploy_local.sh` 输出和 `scripts/ops/check_runtime_baseline.sh` 为准。

- Assumption C:
  - isolated `validate_matrix_debug_server_sse` 之所以继续为绿，是因为它验证的是 repo-side / in-process server state，而不是 current live local persisted-asset environment。
  - Validation:
    - 以 `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs` 的 `createServerState({ dbPath: null })` 调用路径，与 live `/snapshot` 对照为准。

> 本文件只定义 WHAT / WHY / 范围 / 影响面 / 成功标准 / 约束，不记录 Step 编号、执行结果、命令输出或 commit。
