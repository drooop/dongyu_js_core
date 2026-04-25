---
title: "0222 — local-cluster-rollout-baseline Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0222-local-cluster-rollout-baseline
id: 0222-local-cluster-rollout-baseline
phase: phase1
---

# 0222 — local-cluster-rollout-baseline Plan

## Metadata

- ID: `0222-local-cluster-rollout-baseline`
- Date: `2026-03-24`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0222-local-cluster-rollout-baseline`
- Planning mode: `refine`
- Depends on:
  - `0210-ui-cellwise-contract-freeze`
  - `0211-ui-bootstrap-and-submodel-migration`
  - `0212-home-crud-proper-tier2`
  - `0213-matrix-debug-ui-surface`
  - `0214-sliding-flow-ui`
  - `0215-ui-model-tier2-examples-v1`
  - `0216-threejs-runtime-and-scene-crud`
  - `0217-gallery-extension-matrix-three`
  - `0221-playwright-mcp-local-smoke`
- Downstream:
  - `0223-local-cluster-browser-evidence`
  - `0224-remote-rollout-baseline`
  - `0225-remote-browser-evidence`

## Goal

- 将当前仓库中由 `0210-0217` 固化的 UI / system-model / local deploy 基线，真实 rollout 到本地集群，并用非浏览器、可审计、可复跑的方式证明：
  - 本地 cluster 已经运行当前 repo 预期的服务面；
  - 入口地址、ready 状态、authoritative assets 与 repo 当前合同一致；
  - `0223` 后续做 Browser Task 取证时，面对的是一个已经准备好的环境，而不是一个可能仍停留在旧镜像、旧 hostPath assets 或旧 secret 的 stale 环境。

## Background

- `0210-0217` 已把当前 UI / Workspace / Gallery / ThreeScene 主线收敛为一套具体的 repo baseline：
  - `0210/0211` 冻结并迁移到 `page_asset_v0 + model.submt + cellwise truth`，移除 root `ui_ast_v0` 作为 authoritative bootstrap。
  - `0212` 把 Home 页固定为正式 Tier 2 CRUD 页面，page asset 落在 `Model -22`。
  - `0213` 把 Matrix debug surface 固定在 `Model -100`，并要求它成为正式、可挂载、可验证的 surface。
  - `0214` 让 `Workspace` route 在 `Model 100` 上叠加 sliding flow shell，依赖 `scene_context` 与 `action_lifecycle` 的过程态。
  - `0215` 把 canonical examples 固定为 `Workspace` 中的正数模型基线：
    - `1003` schema-only example
    - `1004` page-asset example
    - `1005/1006` parent-mounted example
  - `0216` 把 Three.js scene app 固定为 `1007/1008` parent + child 组合。
  - `0217` 把 Gallery 固定为 `Model -102/-103` 的 integration surface，并要求它读取已有 truth，而不是复制一套状态。
- 本地 cluster 的 canonical deploy 路径已经存在：
  - `scripts/ops/deploy_local.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/check_runtime_baseline.sh`
- 这条本地 deploy 路径不是单纯的 Pod restart：
  - `scripts/ops/sync_local_persisted_assets.sh` 会把一组 curated authoritative system-model / role patches 复制到 hostPath `LOCAL_PERSISTED_ASSET_ROOT`。
  - `k8s/local/workers.yaml` 与 `k8s/local/ui-side-worker.yaml` 把 `/Users/drop/dongyu/volume/persist/assets` 挂载到 `ui-server`、`remote-worker`、`mbr-worker`、`ui-side-worker`。
  - `k8s/local/ui-server-nodeport.yaml` 固定对外入口 `NodePort 30900`。
  - 对于 `matrix_debug_surface.json` 这类 formal surface，0222 不能仅凭 repo 文件存在就认定它已经进入 live cluster，必须以 Step 3 的 live `/snapshot` 结果为准。
- `scripts/ops/check_runtime_baseline.sh` 已把本地 canonical readiness 定义为：
  - `mosquitto`
  - `synapse`
  - `remote-worker`
  - `mbr-worker`
  - `ui-server`
  - `ui-side-worker`
  六个 deployment 都 ready，且 `mbr-worker-secret` 与 `ui-server-secret` 内的 Matrix bootstrap patch 不得是 placeholder。
- `0221-playwright-mcp-local-smoke` 已证明 browser bridge 自身可用，但它没有替代环境准备。`0222` 的职责就是在 Browser Task 进入之前，先把本地环境波次与 repo baseline 对齐。

## Problem Statement

- 当前仓库的“代码已经改对”与“本地 cluster 正在跑当前 repo 基线”是两件不同的事情。
- 本地环境至少有两条独立的 drift 面：
  - 镜像 drift：
    - `dy-ui-server:v1`
    - `dy-remote-worker:v3`
    - `dy-mbr-worker:v2`
    - `dy-ui-side-worker:v1`
    这些本地 tag 是固定名字，若不重新 build + rollout，cluster 可能仍在跑旧容器内容。
  - hostPath asset drift：
    - `sync_local_persisted_assets.sh` 复制出的 authoritative assets 位于 repo 外的 hostPath；
    - 即使代码已经更新，若没有重新同步 persisted assets，`ui-server` / workers 仍可能读取旧的 `workspace_catalog_ui.json`、`workspace_positive_models.json`、`matrix_debug_surface.json`、`gallery_catalog_ui.json` 或 role patches。
- 本地路径当前没有 cloud deploy 那种显式 revision/source label gate；因此 0222 不能简单宣称“当前 HEAD 就等于当前 cluster”。
- 若缺少 0222，这些风险会直接污染 `0223`：
  - browser failure 无法区分是页面/bridge 问题，还是 cluster 根本没 rollout 到当前 repo；
  - UI surface 缺口无法区分是代码 regress，还是 hostPath / secret / image stale。

## Scope

### In Scope

- 用现有 canonical 本地 deploy 入口重新对齐本地 cluster：
  - env / context
  - persisted assets
  - worker / ui-server images
  - k8s manifests
  - secrets / Matrix bootstrap
- 以 repo 事实明确 0210-0217 的 local-cluster-visible baseline：
  - Home page asset (`Model -22`)
  - Matrix debug surface (`Model -100`)
  - Gallery state / catalog (`Model -102/-103`)
  - Workspace registry 对 `100`、`1003`、`1004`、`1005`、`1007` 的可见性
  - `1006`、`1008` child model 不得直接暴露在 Workspace registry
  - `Model 100` submit roundtrip 仍可通过 live endpoint 证明
- 形成一份 Phase 3 可执行的、无上下文读者可复跑的本地 rollout checklist 与裁决标准。

### Out of Scope

- 不做 Browser Task / Playwright 取证；那是 `0223` 的职责。
- 不做远端集群 rollout；那是 `0224` 的职责。
- 不新增 deploy 脚本、source-gate 机制、health endpoint 或任何实现代码。
- 不把 in-memory validator 或 local-only mock 结果当成 cluster rollout 的替代证据。

## Baseline Target

- 0222 要为本地环境裁决的不是“页面看起来差不多”，而是以下 baseline 是否全部成立：
  - readiness baseline：
    - 六个 deployment ready
    - Matrix bootstrap secret 合法、非 placeholder
    - `http://127.0.0.1:30900/snapshot` 可访问
  - route / asset baseline：
    - live snapshot 中存在 `Model -22` `page_asset_v0`
    - live snapshot 中存在 `Model -100` `page_asset_v0`
    - live snapshot 中存在 `Model -103` `page_asset_v0`
    - live snapshot 中存在 `Model -102` 的 Gallery showcase state
  - workspace registry baseline：
    - registry 必须包含 `100`、`-100`、`-103`、`1003`、`1004`、`1005`、`1007`
    - registry 不得直接暴露 `1006`、`1008`
  - flow / submit baseline：
    - `Model 100` 单次 submit 仍是一条正式 roundtrip
    - `scene_context` / `action_lifecycle` 等 `0214` 依赖的 live state 前提存在

## Impact Surface

### Authoritative Repo Inputs

- `packages/worker-base/system-models/home_catalog_ui.json`
- `packages/worker-base/system-models/workspace_catalog_ui.json`
- `packages/worker-base/system-models/workspace_positive_models.json`
- `packages/worker-base/system-models/matrix_debug_surface.json`
- `packages/worker-base/system-models/gallery_catalog_ui.json`
- `packages/worker-base/system-models/intent_dispatch_config.json`
- `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
- `deploy/sys-v1ns/remote-worker/patches/*.json`
- `deploy/sys-v1ns/ui-side-worker/patches/*.json`

### Local Rollout Chain

- `deploy/env/local.env`
- `scripts/ops/sync_local_persisted_assets.sh`
- `scripts/ops/deploy_local.sh`
- `scripts/ops/ensure_runtime_baseline.sh`
- `scripts/ops/check_runtime_baseline.sh`
- `k8s/local/namespace.yaml`
- `k8s/local/mosquitto.yaml`
- `k8s/local/synapse.yaml`
- `k8s/local/workers.yaml`
- `k8s/local/ui-side-worker.yaml`
- `k8s/local/ui-server-nodeport.yaml`

### Live Verification Surface

- `http://127.0.0.1:30900/snapshot`
- `http://127.0.0.1:30900/ui_event`
- `http://127.0.0.1:30900/api/runtime/mode`
- `scripts/tests/test_0145_workspace_single_submit.mjs`
- `scripts/ops/verify_model100_submit_roundtrip.sh`

## Assumptions And Validation Boundary

- Assumption A:
  - 当前本地 rollout 仍以 `deploy_local.sh` / `ensure_runtime_baseline.sh` / `check_runtime_baseline.sh` 为唯一 canonical 路径。
  - Validation:
    - Phase 3 只允许使用这些现有入口，不临时发明新的 deploy flow。
- Assumption B:
  - 本地路径当前没有独立的 commit-level source gate；因此“repo 与 cluster 一致”的证明必须由“当前 repo 再部署”加上“live snapshot / roundtrip alignment”共同给出。
  - Validation:
    - Phase 3 必须同时完成 repo-side contract guard、cluster readiness、live snapshot checks、roundtrip checks。
- Assumption C:
  - `0222` 只负责 environment-effective baseline，不负责最终视觉/交互取证。
  - Validation:
    - 视觉与浏览器行为统一留给 `0223`；`0222` 只需要把 non-browser baseline 做到 deterministic PASS/FAIL。

## Invariants / Constraints

- 严格遵守 `CLAUDE.md` 的 `HARD_RULES`、`CAPABILITY_TIERS`、`WORKFLOW`。
- `0222` 的 planning 文档必须自包含，且 Phase 1 只写文档，不写实现代码。
- Phase 3 执行时不得用 in-memory validator 结果替代 live cluster 结果；repo-side validator 只能作为“当前 HEAD 自身合同仍成立”的前置 gate。
- 结论必须是 deterministic PASS/FAIL，不允许“看起来像对了”。
- 若 repo-side contract guard 已失败，必须先停止，不能继续 rollout 并把问题推给环境。
- 若 local cluster 已 ready 但 live snapshot 与 repo baseline 不一致，结论必须是 `Local cluster stale` 或等价 blocker，而不是直接放行给 `0223`。

## Success Criteria

- 存在一套明确、无上下文读者可复跑的 3 段式验证路径：
  - repo-side baseline guard
  - local cluster rollout + readiness
  - live snapshot / roundtrip alignment
- 本地 cluster 通过 canonical readiness gate：
  - `ensure_runtime_baseline.sh`
  - `check_runtime_baseline.sh`
  - `NodePort 30900`
- live snapshot 与 repo-held 0210-0217 baseline 对齐：
  - Home / Matrix debug / Gallery assets 存在
  - Workspace registry 与 parent-child visibility 一致
  - Model 100 roundtrip PASS
- 最终结论必须显式收敛为以下二选一之一：
  - `Local cluster ready for browser evidence`
  - `Local cluster stale`（并附最小 blocker 描述）

## Risks & Mitigations

- Risk:
  - 本地 `kubectl` context 指向错误集群。
  - Mitigation:
    - 先显式记录 `kubectl config current-context`，并把它作为 Step 2 前置事实。

- Risk:
  - persisted assets 仍然是旧内容，导致 repo 静态 tests PASS，但 live cluster 读的是旧 asset。
  - Mitigation:
    - 把 `sync_local_persisted_assets.sh` 与 live `/snapshot` 校验都纳入主线，不允许只看 repo 文件。

- Risk:
  - 镜像 tag 固定，cluster 看起来 running，但实际仍是旧 build。
  - Mitigation:
    - 通过 canonical deploy path 重建并 rollout，然后再做 live snapshot/submit gate。

- Risk:
  - 0222 被误扩成浏览器取证或远端 rollout。
  - Mitigation:
    - 明确把 browser evidence 留给 `0223`，把 remote rollout 留给 `0224`。

## Alternatives

### A. 推荐：repo-side guard + canonical local redeploy + live snapshot/roundtrip 对齐

- 优点：
  - 同时覆盖代码合同、镜像/asset rollout、live environment proof。
  - 失败时容易定位是 repo regress 还是 cluster stale。
- 缺点：
  - 比单纯跑 `kubectl get deploy` 更重。

### B. 只跑 `check_runtime_baseline.sh`，把 deployment ready 当作完成

- 优点：
  - 最快。
- 缺点：
  - 只能证明 deployment 和 secrets ready，不能证明 `0210-0217` 的 Workspace / Gallery / ThreeScene baseline 已对齐当前 repo。

### C. 跳过 0222，直接让 `0223` 做浏览器取证

- 优点：
  - 看似减少一个 iteration。
- 缺点：
  - 把环境 stale、asset drift、browser 行为问题混成一个失败面，定位成本高。

当前推荐：A。

## Inputs

- Created at: `2026-03-24`
- Iteration ID: `0222-local-cluster-rollout-baseline`
- Prompt source:
  - “将 `0210-0217` 当前代码基线实际 rollout 到本地集群，并验证服务版本/入口/ready 状态与仓库一致”
