---
title: "0233 — local-matrix-debug-surface-materialization-fix Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-25
source: ai
iteration_id: 0233-local-matrix-debug-surface-materialization-fix
id: 0233-local-matrix-debug-surface-materialization-fix
phase: phase1
---

# 0233 — local-matrix-debug-surface-materialization-fix Plan

## Metadata

- ID: `0233-local-matrix-debug-surface-materialization-fix`
- Date: `2026-03-25`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0233-local-matrix-debug-surface-materialization-fix`
- Planning mode: `refine`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0213-matrix-debug-ui-surface`
  - `0222-local-cluster-rollout-baseline`
  - `0232-local-baseline-surface-gate`
- Downstream:
  - `0234-local-browser-evidence-effective-rerun`

## WHAT

本 iteration 要修复本地 canonical repair 路径中的一个明确链路缺口：仓库已经把 `Model -100` 的正式 Matrix debug surface 冻结为 `page_asset_v0 = matrix_debug_root`，但本地 canonical repair 后，live `http://127.0.0.1:30900/snapshot` 仍没有把该 surface materialize 到 `Model -100 / 0,1,0`。

目标不是重做 local baseline gate，也不是重做 Matrix debug UI 合同，而是把以下链条真正打通并验证：

- repo authoritative asset:
  - `packages/worker-base/system-models/matrix_debug_surface.json`
- local persisted asset sync:
  - `scripts/ops/sync_local_persisted_assets.sh`
- canonical local repair:
  - `scripts/ops/deploy_local.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
- live materialization and proof:
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/ops/check_runtime_baseline.sh`
  - `http://127.0.0.1:30900/snapshot`

交付完成后，`0232` 收紧后的 canonical gate 应不再卡在 `matrix_debug_page_asset=missing`，从而为 `0234` 的本地 Playwright MCP 复验提供真实有效环境。

## WHY

仓库内已经存在足够明确的事实，表明 0233 的问题范围应收敛到 local persisted-assets materialization 链，而不是 runtime 语义或 browser 证据层：

- `0213-matrix-debug-ui-surface` 已冻结 `Model -100` 合同：
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs` 明确要求 `matrix_debug_surface.json` 在 `Model -100 / 0,1,0` 定义 `page_asset_v0`
  - `CLAUDE.md` 已把 `Model -100` 正式登记为 `Matrix debug / bus trace model`
- `packages/ui-model-demo-server/server.mjs` 在检测到 persisted asset root 时，会优先通过 `applyPersistedAssetEntries(...)` 加载 authoritative persisted assets；本地环境不是直接用 repo 文件跑，而是通过 persisted asset manifest materialize
- `scripts/ops/deploy_local.sh` 的 canonical repair 会调用 `scripts/ops/sync_local_persisted_assets.sh` 生成本地 persisted asset root
- 当前 `scripts/ops/sync_local_persisted_assets.sh` 会同步 `home_catalog_ui.json`、`gallery_catalog_ui.json`、`workspace_catalog_ui.json` 等 system UI patch，但 `system_negative_full` 列表中没有 `matrix_debug_surface.json`
- `0222-local-cluster-rollout-baseline` 的 runlog 已记录 live `Model -100` 仍是旧 `bus_trace` / `trace_root`
- `0232-local-baseline-surface-gate` 的 runlog 已记录 canonical repair 之后其余 surface 已对齐，唯一剩余 blocker 是 `matrix_debug_page_asset=missing`

因此，0233 的最强当前假设不是“runtime 不支持 page asset”，而是“`matrix_debug_surface.json` 没有进入 local persisted asset manifest，或进入后在 deploy/load-order 中被遗漏或覆盖”。0233 必须把这个假设验证成事实，或在执行期明确证明它不成立并停下重新收敛范围。

## 当前问题陈述

当前本地环境的 drift 已收敛为一个单点故障：

- repo 中的 `matrix_debug_surface.json` 已经定义了 `Model -100 / 0,1,0 / page_asset_v0.v.id == "matrix_debug_root"`
- local canonical repair 后，live `/snapshot` 仍然没有该 label
- 由于 `server.mjs` 仍会在 `Model -100 / 0,0,0` 创建 trace buffer 和 debug state，即使 page asset 缺失，系统仍会表现为“可运行但 surface 仍旧”，这正是 `0222` 与 `0232` 已观察到的状态
- 如果 0233 不修复这条 materialization 链，`0234` 重新跑浏览器取证时仍只会再次证明“local environment not effective”

## Scope

### In Scope

- 追踪并修复 `matrix_debug_surface.json` 从 repo 到 live `/snapshot` 的 local materialization 链
- 优先验证 persisted asset sync / manifest omission 是否为根因
- 如 omission 不是唯一根因，继续在最小范围内检查：
  - `deploy_local.sh` repair 路径
  - persisted asset loader 读取条件
  - ui-server load order / overwrite
- 保持 `0213` 合同不变，只修本地 authoritative materialization
- 保持 `0232` gate 逻辑不扩 scope，只让其恢复为真实 PASS

### Out Of Scope

- 不修改 `packages/worker-base/src/runtime.js`
- 不修改 `packages/worker-base/src/runtime.mjs`
- 不修改 renderer 组件协议、page asset 语义或 `matrix_debug_root` 设计
- 不修改 remote rollout、remote verification 或任何远端集群资源
- 不修改 `0234` 的 Playwright MCP 取证逻辑
- 不用 ad-hoc in-memory patch、手工改 sqlite、手工改 live cluster state 来伪造通过

## Impact Surface

### 预期最小写入面

- `scripts/ops/sync_local_persisted_assets.sh`
- `scripts/tests/test_0200b_local_externalization_contract.mjs`
- `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
- `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
- `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`

### 只读定位面

- `packages/worker-base/system-models/matrix_debug_surface.json`
- `packages/worker-base/src/persisted_asset_loader.mjs`
- `scripts/ops/deploy_local.sh`
- `scripts/ops/ensure_runtime_baseline.sh`
- `scripts/ops/check_runtime_baseline.sh`
- `packages/ui-model-demo-server/server.mjs`
- `docs/iterations/0222-local-cluster-rollout-baseline/runlog.md`
- `docs/iterations/0232-local-baseline-surface-gate/runlog.md`

### 仅在执行期定位证实需要时才允许扩到的写入面

- `packages/worker-base/src/persisted_asset_loader.mjs`
- `packages/ui-model-demo-server/server.mjs`
- `scripts/ops/deploy_local.sh`
- `scripts/ops/ensure_runtime_baseline.sh`

如果执行期证明必须修改 Tier 1 runtime 语义或 page asset 合同本身，0233 应停止并返回新的规划裁决，而不是在本 iteration 内继续扩张。

## Success Criteria

- canonical local repair 完成后，`http://127.0.0.1:30900/snapshot` 满足：
  - `Model -100 / 0,1,0 / page_asset_v0.v.id == "matrix_debug_root"`
- `scripts/ops/check_runtime_baseline.sh` 不再报 `matrix_debug_page_asset=missing`
- `scripts/ops/check_runtime_baseline.sh` 继续保持对 Home / Gallery / `ws_apps_registry` 的检查为 PASS，不出现回退
- local persisted asset manifest 对 `ui-server` scope 可见 `matrix_debug_surface.json`
- 0233 的最终修复仍遵守 `0213` 对 `Model -100` 的 placement 和 `0232` 对 canonical gate 的判定口径

## Constraints And Invariants

- 严格遵循 `CLAUDE.md` 的 `HARD_RULES`、`CAPABILITY_TIERS`、`WORKFLOW`
- 当前阶段是 Phase 1，只生成 `plan.md` 与 `resolution.md`，不写实现代码
- 0233 只修 local matrix debug surface materialization，不得膨胀成“重做 local baseline 全链路”
- 必须以 canonical local repair 路径验证：
  - `scripts/ops/sync_local_persisted_assets.sh`
  - `scripts/ops/deploy_local.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/check_runtime_baseline.sh`
- 不能以“server fallback 直接从 repo 读 patch”替代 persisted asset SSOT，除非执行期证明当前 persisted-asset 设计本身与仓库合同冲突
- 所有验证必须是 deterministic PASS/FAIL；“页面看起来对了”不算完成

## Risks And Mitigations

- Risk:
  - `matrix_debug_surface.json` omission 不是唯一问题，修完 sync 脚本后仍可能被 deploy/load-order 覆盖。
  - Mitigation:
    - 执行期先冻结 repo contract、temp asset root 结果和 live snapshot 事实；若 sync 后 asset 已存在，才允许扩到 loader 或 ui-server。

- Risk:
  - 为了快过 gate，直接在 `server.mjs` 中补一条 fallback surface，绕过 persisted asset manifest。
  - Mitigation:
    - 把 persisted-assets SSOT 写成显式约束；若只能靠 fallback 成立，则必须在计划中标记为设计冲突，不得伪装成正常修复。

- Risk:
  - 修复 matrix debug surface 时误伤 `0232` 既有 Home / Gallery / registry gate。
  - Mitigation:
    - 以 `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs` 和 live `/snapshot` assertions 作为回归面。

- Risk:
  - 本地 shell/cluster 不可达，导致执行期无法完成 canonical proof。
  - Mitigation:
    - 若 `kubectl`、Docker 或 `30900/snapshot` 不可达，最终只能报告 blocked/unverified，不得输出虚假的 ready verdict。

## Alternatives

### A. 推荐：修正 persisted asset sync/manifest，并继续使用现有 canonical repair 路径

- 优点：
  - 最贴近当前仓库的 authoritative asset 设计
  - 不需要重写 runtime、renderer 或 browser 取证
  - 能直接让 `0232` gate 与 `0234` downstream 获益
- 缺点：
  - 需要先验证 omission 是否真的是主因

### B. 在 `server.mjs` 增加 repo-side fallback，把缺失的 page asset 直接补回 `Model -100`

- 优点：
  - 表面上可能更快看到 live `matrix_debug_root`
- 缺点：
  - 会绕过 persisted asset root 和 canonical local repair 的 SSOT 设计
  - 容易再次制造“repo truth / persisted truth / live truth”三份来源

### C. 放弃修 local materialization，直接继续 0234 重跑浏览器证据

- 优点：
  - 不需要先改 ops/materialization 链
- 缺点：
  - 只能再次证明已有 blocker，无法推进 local environment 到 effective
  - 与 `0232` 的收紧 gate 结论冲突

当前推荐：A。

## Assumptions And Validation Methods

- Assumption A:
  - 本地 canonical live endpoint 仍是 `http://127.0.0.1:30900`
  - Validation:
    - 以 `scripts/ops/check_runtime_baseline.sh` 默认 `LOCAL_BASE_URL` 和 `k8s/local/ui-server-nodeport.yaml` 为准

- Assumption B:
  - 本地 persisted asset root 仍由 `DY_PERSISTED_ASSET_ROOT` / `LOCAL_PERSISTED_ASSET_ROOT` 驱动，且 `deploy_local.sh` 会在 rollout 前执行 `sync_local_persisted_assets.sh`
  - Validation:
    - 以 `scripts/ops/deploy_local.sh`、`scripts/ops/sync_local_persisted_assets.sh` 和 local k8s manifests 为准

- Assumption C:
  - `matrix_debug_surface.json` 当前 omission 是最强候选根因，但不是既定事实
  - Validation:
    - 执行期必须用 temp persisted asset root、manifest 检查和 live snapshot 事实把这一点验证为真，或显式否定并收敛到下一层缺口

> 本文件只定义 WHAT / WHY / 范围 / 影响面 / 成功标准 / 约束，不记录 Step 编号、执行结果、命令输出或 commit。
