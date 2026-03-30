---
title: "0232 — local-baseline-surface-gate Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-25
source: ai
iteration_id: 0232-local-baseline-surface-gate
id: 0232-local-baseline-surface-gate
phase: phase1
---

# 0232 — local-baseline-surface-gate Resolution

## Metadata

- ID: `0232-local-baseline-surface-gate`
- Date: `2026-03-25`
- Work branch: `dropx/dev_0232-local-baseline-surface-gate`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`

## Execution Strategy

- 先冻结 0232 要求的 live surface contract 与已知 stale 特征，避免 Phase 3 一边改脚本一边改目标。
- 再把 snapshot-based surface assertions 接入 `scripts/ops/check_runtime_baseline.sh`，使 canonical baseline gate 能直接判定“surface 是否真的 live”。
- 然后让 `scripts/ops/ensure_runtime_baseline.sh` 与 `scripts/ops/README.md` 共同消费这条新 gate，避免 short-circuit 或 repair 完成后仍放行 stale 环境。
- 最后用真实本地命令证明：新 gate 不再允许“deployments ready，但 Home / Workspace 仍旧”的 false green。

## Delivery Boundaries

- 允许修改：
  - `scripts/ops/check_runtime_baseline.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/README.md`
- 只读参考，不计划修改：
  - `scripts/ops/sync_local_persisted_assets.sh`
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/matrix_debug_surface.json`
  - `packages/worker-base/system-models/gallery_catalog_ui.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `docs/iterations/0222-local-cluster-rollout-baseline/runlog.md`
  - `docs/iterations/0223-local-cluster-browser-evidence/runlog.md`
- 不允许扩 scope 到：
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-*` 产品功能实现
  - remote ops / remote rollout 脚本

## Stop Conditions

- Step 1 若发现 `0212/0213/0215/0217` 当前 repo contract 已回归，停止，不进入脚本改动。
- Step 4 若 canonical gate 无法完整访问 kubectl 或 live `/snapshot`，最终只能给出 blocked/unverified，不得输出 ready verdict。
- 任一 snapshot assertion 失败时，`ensure_runtime_baseline.sh` 不得以 warning 方式吞掉失败并继续输出 `READY`。

## Step 1 — Freeze Surface Contract And Stale Signatures

- Scope:
  - 固定 0232 要消费的 authoritative repo contract 与已知 stale 事实。
  - 明确 Home / Matrix debug / Gallery / Workspace registry 的 selector、预期值和 blocker 命名边界。
- Files:
  - `scripts/tests/test_0212_home_crud_contract.mjs`
  - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `scripts/tests/test_0217_gallery_extension_contract.mjs`
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/matrix_debug_surface.json`
  - `packages/worker-base/system-models/gallery_catalog_ui.json`
  - `docs/iterations/0222-local-cluster-rollout-baseline/runlog.md`
  - `docs/iterations/0223-local-cluster-browser-evidence/runlog.md`
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0217_gallery_extension_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "home-datatable|matrix_ui_root|gallery_catalog_root|ws_registry_model_ids" docs/iterations/0222-local-cluster-rollout-baseline/runlog.md docs/iterations/0223-local-cluster-browser-evidence/runlog.md`
- Acceptance:
  - Home 预期 surface 固定为 `Model -22 / 0,1,0 / page_asset_v0 / root_home`。
  - Matrix debug 预期 surface 固定为 `Model -100 / 0,1,0 / page_asset_v0 / matrix_debug_root`。
  - Gallery 预期 surface 固定为 `Model -103 / 0,1,0 / page_asset_v0` 与 `Model -102 / 0,11,0 / gallery_showcase_tab=matrix`。
  - Workspace registry gate 固定为：
    - 必须包含 `100`、`-100`、`-103`、`1003`、`1004`、`1005`、`1007`
    - 不得直接暴露 `1006`、`1008`
  - 若 Step 1 任一 contract test 失败，0232 必须先停下，不能把 repo regress 误报为环境问题。
- Rollback:
  - 本步只读；若误写了 planning 文本或临时记录，直接回退该文档改动，不涉及 runtime/environment rollback。

## Step 2 — Implement Snapshot-Based Surface Checks In `check_runtime_baseline.sh`

- Scope:
  - 在保留现有 deployment / secret checks 的前提下，增加 live `/snapshot` gate。
  - 让脚本显式区分：
    - management-plane blockers
    - snapshot reachability blockers
    - surface mismatch blockers
  - 让脚本只在两类条件全部成立时才返回 `baseline ready`。
- Files:
  - `scripts/ops/check_runtime_baseline.sh`
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/matrix_debug_surface.json`
  - `packages/worker-base/system-models/gallery_catalog_ui.json`
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash -n scripts/ops/check_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "127\\.0\\.0\\.1:30900/snapshot|root_home|matrix_debug_root|gallery_showcase_tab|ws_apps_registry|baseline NOT ready" scripts/ops/check_runtime_baseline.sh`
- Acceptance:
  - `check_runtime_baseline.sh` 仍保留 deployment / secret validation。
  - 脚本新增 snapshot reachability 检查与 surface-specific FAIL 输出。
  - 任何一个 live surface mismatch 都必须让脚本返回非零退出码。
- Rollback:
  - 若新 gate 判断逻辑错误，执行：
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git revert <step2_commit>`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash -n scripts/ops/check_runtime_baseline.sh`

## Step 3 — Make `ensure_runtime_baseline.sh` And Ops README Consume The New Gate

- Scope:
  - 确保 `scripts/ops/ensure_runtime_baseline.sh` 的 short-circuit 与 repair 后 success 都以新 gate 为准。
  - 如果 `deploy_local.sh` 结束后 surface 仍未对齐，`ensure_runtime_baseline.sh` 必须退出失败，而不是继续打印 `READY`。
  - 把 `scripts/ops/README.md` 更新为新的 canonical 语义，避免文档仍描述旧 readiness。
- Files:
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/README.md`
  - `scripts/ops/check_runtime_baseline.sh`
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash -n scripts/ops/ensure_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "check_runtime_baseline\\.sh|baseline already healthy|baseline unhealthy" scripts/ops/ensure_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "live /snapshot|page_asset_v0|ws_apps_registry|surface ready|check_runtime_baseline\\.sh" scripts/ops/README.md`
- Acceptance:
  - `ensure_runtime_baseline.sh` 只能在新 gate PASS 时 short-circuit。
  - `ensure_runtime_baseline.sh` repair 完成后必须重新过新 gate；若 snapshot surface 仍旧，则返回失败。
  - `scripts/ops/README.md` 对 local baseline 的定义、命令和 PASS 判定与脚本行为一致。
- Rollback:
  - 若 `ensure_runtime_baseline.sh` 或 README 更新引入误导或错误控制流，执行：
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git revert <step3_commit>`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash -n scripts/ops/ensure_runtime_baseline.sh`

## Step 4 — Prove The Strengthened Gate On The Live Local Environment

- Scope:
  - 用真实 local ops 路径证明新 gate 已经覆盖 `0222/0223` 暴露的 blind spot。
  - 输出唯一合法终态之一：
    - `Local baseline surface gate ready`
    - `Local baseline surface gate blocked`
- Files:
  - `scripts/ops/check_runtime_baseline.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/README.md`
  - `docs/iterations/0232-local-baseline-surface-gate/runlog.md`
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/ensure_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-22"].cells["0,1,0"].labels.page_asset_v0.v.id == "root_home"'`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0.v.id == "matrix_debug_root"'`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-103"].cells["0,1,0"].labels.page_asset_v0 != null and .snapshot.models["-102"].cells["0,11,0"].labels.gallery_showcase_tab.v == "matrix"'`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '(.snapshot.models["-2"].cells["0,0,0"].labels.ws_apps_registry.v // []) as $apps | ([100,-100,-103,1003,1004,1005,1007] | all(. as $id | ($apps | map(.model_id) | index($id)))) and (($apps | map(.model_id) | index(1006)) | not) and (($apps | map(.model_id) | index(1008)) | not)'`
- Acceptance:
  - 若 pre-repair 环境仍是 stale，新 `check_runtime_baseline.sh` 必须直接 FAIL，并给出可定位 blocker。
  - 若 `ensure_runtime_baseline.sh` 完成 repair，只有在全部 snapshot assertions PASS 后才允许输出 ready。
  - 不再存在“deployments ready，但 `/snapshot` 仍旧”却被 canonical gate 放行的情况。
  - 若 kubectl 或 `/snapshot` 在当前执行环境不可达，最终结论只能是 `Local baseline surface gate blocked`，不得写成 ready。
- Rollback:
  - 若 Step 4 证明新 gate 自身误判，按相反顺序回退 0232 脚本改动并重新恢复 baseline：
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git revert <step3_commit>`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git revert <step2_commit>`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/ensure_runtime_baseline.sh`

## Conformance Notes

- Tier boundary:
  - 0232 不改 Tier 1 interpreter，不新增 label.t，也不改 Tier 2 model definitions；只收紧 ops verification gate。
- Model placement:
  - 0232 只读取并验证 `CLAUDE.md` 已登记的 `Model -22`、`Model -100`、`Model -102`、`Model -103`、`Model -2` surface。
- Data ownership / flow / chain:
  - 0232 不改变任何写入链路；它只要求 live surface 必须反映现有 authoritative assets，而不是让 browser evidence 再去发现 drift。

## Global Rollback Rule

- 若 0232 的脚本改动整体需要撤回，只允许通过 `git revert` 回退对应提交，再重新运行 canonical local ensure/check：
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git revert <step3_commit>`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git revert <step2_commit>`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh`
- 不使用 ad-hoc shell 或手工改 cluster 状态来掩盖 gate 问题。
