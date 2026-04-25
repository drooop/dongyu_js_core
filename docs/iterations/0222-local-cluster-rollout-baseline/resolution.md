---
title: "0222 — local-cluster-rollout-baseline Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0222-local-cluster-rollout-baseline
id: 0222-local-cluster-rollout-baseline
phase: phase1
---

# 0222 — local-cluster-rollout-baseline Resolution

## Metadata

- ID: `0222-local-cluster-rollout-baseline`
- Date: `2026-03-24`
- Work branch: `dropx/dev_0222-local-cluster-rollout-baseline`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`

## Execution Strategy

- 先证明当前 repo 自身的 `0210-0217` baseline 仍然成立，再动本地 cluster。
- 再通过 canonical 本地 deploy 入口把 persisted assets、镜像、secret、manifests 全部对齐到当前 repo。
- 最后只用 live cluster endpoint 与现有 roundtrip 脚本做 environment-effective 裁决，避免用 in-memory validator 误代替真实 rollout 结果。

## Step 1 — Freeze Repo-side Baseline And Rollout Checklist

- Scope:
  - 在触碰本地 cluster 之前，先确认 `0210-0217` 当前 repo baseline 仍然是自洽的。
  - 同时冻结 0222 执行时的 authoritative rollout 面，避免 Phase 3 临时扩 scope。
- Files:
  - `scripts/ops/deploy_local.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/check_runtime_baseline.sh`
  - `scripts/ops/sync_local_persisted_assets.sh`
  - `k8s/local/workers.yaml`
  - `k8s/local/ui-side-worker.yaml`
  - `k8s/local/ui-server-nodeport.yaml`
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/matrix_debug_surface.json`
  - `packages/worker-base/system-models/gallery_catalog_ui.json`
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `docs/iterations/0222-local-cluster-rollout-baseline/runlog.md`
- Verification:
  - Static contract guard:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0216_threejs_scene_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0217_gallery_extension_contract.mjs`
  - Repo-side server-backed validator guard:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_sliding_flow_server_sse.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_three_scene_server_sse.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_server_sse.mjs`
  - Rollout surface inventory:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "workspace_catalog_ui|workspace_positive_models|gallery_catalog_ui|/Users/drop/dongyu/volume/persist/assets|nodePort: 30900" scripts/ops/sync_local_persisted_assets.sh k8s/local/workers.yaml k8s/local/ui-side-worker.yaml k8s/local/ui-server-nodeport.yaml`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "matrix_debug_surface\\.json|formal UI surface is model-defined via matrix_debug_surface\\.json" packages/ui-model-demo-server/server.mjs packages/worker-base/system-models/matrix_debug_surface.json`
- Acceptance:
  - 所有 repo-side contract / validator 命令 PASS。
  - 0222 的 authoritative rollout 面已明确为：
    - canonical local ops scripts
    - hostPath persisted assets
    - `k8s/local/*` manifests
    - live `30900` endpoint
    - `matrix_debug_surface.json` 等 formal surface 的实际 materialization 必须留待 Step 3 用 live `/snapshot` 证明，不能仅凭 repo 文件存在直接放行
  - 若本步失败，必须停止，不能把 repo regress 误报为 cluster 问题。
- Rollback:
  - 本步只读，无 cluster 回滚需求。

## Step 2 — Re-apply Current Repo Baseline To Local Cluster

- Scope:
  - 用现有 canonical 本地 deploy 入口，把当前 repo 对应的 images、persisted assets、secret bootstrap、service entrypoint 重新对齐到本地集群。
  - 输出 readiness 事实，而不是只假设之前已经部署过。
- Files:
  - `deploy/env/local.env`
  - `scripts/ops/deploy_local.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/check_runtime_baseline.sh`
  - `k8s/local/namespace.yaml`
  - `k8s/local/mosquitto.yaml`
  - `k8s/local/synapse.yaml`
  - `k8s/local/workers.yaml`
  - `k8s/local/ui-side-worker.yaml`
  - `k8s/local/ui-server-nodeport.yaml`
  - `docs/iterations/0222-local-cluster-rollout-baseline/runlog.md`
- Verification:
  - Context / preflight:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && kubectl config current-context`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && test -f deploy/env/local.env`
  - Canonical rollout:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/ensure_runtime_baseline.sh`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh`
  - Cluster readiness facts:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && kubectl -n dongyu get deploy`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && kubectl -n dongyu get pods -o wide`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && kubectl -n dongyu get svc ui-server ui-server-nodeport`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot >/dev/null`
- Acceptance:
  - `check_runtime_baseline.sh` PASS，且输出的六个 deployment 全部 ready。
  - `ui-server-nodeport` 仍暴露 `30900`，`/snapshot` 可访问。
  - Matrix bootstrap secret 已由 canonical gate 证明非 placeholder。
  - 若 readiness 未通过，结论必须是环境未 ready，不得进入 Step 3。
- Sandbox-bounded execution note:
  - 若当前执行壳对 `kubectl` / Docker daemon /本机 Kubernetes API 的 canonical 管理面访问被 sandbox 拦截，但 `http://127.0.0.1:30900/snapshot` 仍可单请求访问，则允许继续执行 Step 3 的 live stale adjudication。
  - 在该模式下：
    - Step 2 结果仍记为 `FAIL` 或 `UNVERIFIED`
    - Step 3 只允许收敛到 `Local cluster stale`
    - 没有 Step 2 canonical PASS，不得输出 `Local cluster ready for browser evidence`
- Rollback:
  - 若当前 repo rollout 自身损坏环境，但尚不确定是不是 repo regress，先用当前 repo 再跑一次 canonical恢复：
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/deploy_local.sh`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh`
  - 若确认是当前 repo baseline 引入回归，则在单独 worktree 切回已知良好 revision 并执行同一条恢复路径：
    - `git worktree add /tmp/0222-local-rollback <known-good-rev>`
    - `cd /tmp/0222-local-rollback && bash scripts/ops/deploy_local.sh`
    - `cd /tmp/0222-local-rollback && bash scripts/ops/check_runtime_baseline.sh`

## Step 3 — Prove Live Cluster Surface Matches 0210-0217 Baseline

- Scope:
  - 只使用 live `30900` endpoint 与现有 roundtrip 脚本，证明本地集群暴露的是当前 repo 预期的 Home / Workspace / Matrix debug / Gallery / ThreeScene baseline。
  - 为 `0223` 输出明确 handoff verdict：环境已可做 browser evidence，或仍 stale。
- Files:
  - `scripts/tests/test_0145_workspace_single_submit.mjs`
  - `scripts/ops/verify_model100_submit_roundtrip.sh`
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/matrix_debug_surface.json`
  - `packages/worker-base/system-models/gallery_catalog_ui.json`
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `docs/iterations/0222-local-cluster-rollout-baseline/runlog.md`
- Verification:
  - Live asset presence from `/snapshot`:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-22"].cells["0,1,0"].labels.page_asset_v0.v.id == "root_home"'`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0.v.id == "matrix_debug_root"'`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-103"].cells["0,1,0"].labels.page_asset_v0 != null and .snapshot.models["-102"].cells["0,11,0"].labels.gallery_showcase_tab.v == "matrix"'`
  - Live registry / visibility / flow prerequisites:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '(.snapshot.models["-2"].cells["0,0,0"].labels.ws_apps_registry.v // []) as $apps | ([100,-100,-103,1003,1004,1005,1007] | all(. as $id | ($apps | map(.model_id) | index($id)))) and (($apps | map(.model_id) | index(1006)) | not) and (($apps | map(.model_id) | index(1008)) | not)'`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-12"].cells["0,0,0"].labels.scene_context != null and .snapshot.models["-1"].cells["0,0,1"].labels.action_lifecycle != null'`
  - Live roundtrip guard:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && UI_SERVER_URL=http://127.0.0.1:30900 node scripts/tests/test_0145_workspace_single_submit.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`
- Acceptance:
  - live snapshot 已暴露 `0212` Home、`0213` Matrix debug、`0217` Gallery 资产。
  - Workspace registry 与 `0215/0216/0217` 的可见性合同一致：
    - `100`、`-100`、`-103`、`1003`、`1004`、`1005`、`1007` 可见；
    - `1006`、`1008` 不直接可见。
  - `scene_context` / `action_lifecycle` live state 前提存在，说明 `0214` 的非浏览器环境依赖已具备。
  - `Model 100` 的 live submit chain PASS。
  - runlog 最终必须显式写出且只能二选一：
    - `Local cluster ready for browser evidence`
    - `Local cluster stale`
- Rollback:
  - 若本步中的 live roundtrip 让本地状态进入不可接受的临时态，使用 canonical 本地重置路径恢复干净 baseline：
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/deploy_local.sh`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh`

## Notes

- Step 1 的 in-process validators 只是 repo-side guard；它们不能替代 Step 3 的 live cluster 证据。
- `0222` 完成后，`0223` 才允许把失败定位收敛到浏览器层或 UI surface 本身；在此之前，环境 stale 不能被跳过。
