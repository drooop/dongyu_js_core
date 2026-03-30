---
title: "0232 — local-baseline-surface-gate Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-25
source: ai
iteration_id: 0232-local-baseline-surface-gate
id: 0232-local-baseline-surface-gate
phase: phase1
---

# 0232 — local-baseline-surface-gate Plan

## Metadata

- ID: `0232-local-baseline-surface-gate`
- Date: `2026-03-25`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0232-local-baseline-surface-gate`
- Planning mode: `refine`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0212-home-crud-proper-tier2`
  - `0213-matrix-debug-ui-surface`
  - `0215-ui-model-tier2-examples-v1`
  - `0217-gallery-extension-matrix-three`
  - `0222-local-cluster-rollout-baseline`
  - `0223-local-cluster-browser-evidence`
  - `0229-local-ops-bridge-smoke`

## Goal

- 将本地 canonical baseline gate 从“deployment/secret readiness”收紧为“live surface ready”。
- 只有当以下两组条件同时成立时，`scripts/ops/check_runtime_baseline.sh` 才允许输出 `baseline ready`：
  - `dongyu` namespace 六个 deployment ready，且 Matrix bootstrap secrets 非 placeholder；
  - live `http://127.0.0.1:30900/snapshot` 暴露的 Home / Matrix debug / Gallery / Workspace registry 与当前 repo baseline 对齐。
- 消除 `0222` 与 `0223` 已证实的 false green：管理面 ready，但 live UI 仍停留在旧 baseline。

## Background

- 当前 `scripts/ops/check_runtime_baseline.sh` 只校验：
  - `mosquitto`
  - `synapse`
  - `remote-worker`
  - `mbr-worker`
  - `ui-server`
  - `ui-side-worker`
  六个 deployment 的 ready 状态；
  - `mbr-worker-secret` 与 `ui-server-secret` 中 `MODELTABLE_PATCH_JSON` 的 Matrix bootstrap 不为空且不为 placeholder。
- 当前 `scripts/ops/ensure_runtime_baseline.sh` 以 `check_runtime_baseline.sh` 为唯一 gate：
  - gate PASS 时直接 short-circuit；
  - gate FAIL 时触发 `deploy_local.sh` repair path。
- `scripts/ops/sync_local_persisted_assets.sh` 会把 repo authoritative assets 同步到本地 hostPath：
  - `home_catalog_ui.json`
  - `workspace_catalog_ui.json`
  - `workspace_positive_models.json`
  - `matrix_debug_surface.json`
  - `gallery_catalog_ui.json`
  这些文件才是本地 cluster live surface 的上游真源之一。
- `packages/ui-model-demo-server/server.mjs` 已对外提供 `/snapshot`，并且现有合同测试明确把 `Model -100` 的 `0,1,0.page_asset_v0` 视为 formal surface 暴露位点，因此本 iteration 不需要新增 browser-only gate 或人工点击步骤。
- `0222` runlog 已经证明旧 gate 存在盲点：
  - live `Model -22` 只有 `ui_ast_v0` root，没有 `0,1,0.page_asset_v0`
  - live `Model -100` 仍是旧 `bus_trace / trace_root`
  - live `Model -103/-102` 仍是旧 Gallery catalog/state
  - live `ws_apps_registry` 缺少 `1003/1004/1005/1007`
- `0223` 的 Playwright 证据进一步证明：
  - Home 仍是旧 `home-datatable`
  - Workspace 仍是旧 asset tree / old registry
  - Prompt 虽然可访问，但不能推翻 Home / Workspace 仍旧的事实

## Problem Statement

- 当前 local baseline gate 只能证明“服务活着”，不能证明“当前 repo baseline 已 materialize 到 live environment”。
- 这会让后续环境裁决出现误导：
  - `0222` 可以给出 readiness green；
  - `0223` 再给出 browser stale verdict；
  - 执行者无法从 canonical gate 直接知道问题在 live surface，而不是在 browser bridge。
- 如果 0232 不修正这层 gate，`ensure_runtime_baseline.sh` 仍可能把“ready 但 UI 仍旧”的环境放行给后续 iteration。

## Scope

### In Scope

- 收紧 `scripts/ops/check_runtime_baseline.sh` 的 PASS 定义：
  - 保留 deployment / secret checks；
  - 增加 live `/snapshot` surface assertions。
- 收紧 `scripts/ops/ensure_runtime_baseline.sh` 的“已健康”与“修复后成功”判定，使其以新 gate 为准，而不是只看旧 readiness。
- 在 `scripts/ops/README.md` 明确更新 canonical local baseline 口径，让无上下文执行者知道 `baseline ready` 现在意味着：
  - 管理面 ready；
  - live surface 与 repo baseline 对齐。
- 固定 0232 的 authoritative live assertions，覆盖以下 surface：
  - `Model -22` Home page asset
  - `Model -100` Matrix debug page asset
  - `Model -103/-102` Gallery catalog + showcase state
  - `Model -2` `ws_apps_registry`

### Out of Scope

- 不做 remote baseline gate。
- 不做 browser evidence 或 Playwright 脚本；那仍是 `0223/0225` 一类 iteration 的职责。
- 不修改 `packages/worker-base/src/runtime.js` / `runtime.mjs` 等 Tier 1 interpreter 逻辑。
- 不修改 `packages/worker-base/system-models/*.json` 的业务/产品语义；0232 只消费既有 authoritative model definitions。
- 不引入新的本地 deploy 流程；仍以 `check_runtime_baseline.sh` / `ensure_runtime_baseline.sh` / `deploy_local.sh` 为唯一 canonical path。

## Baseline Contract To Enforce

- 管理面 contract：
  - `dongyu` namespace 六个 deployment 都 ready；
  - `mbr-worker-secret.MODELTABLE_PATCH_JSON` ready；
  - `ui-server-secret.MODELTABLE_PATCH_JSON` ready；
  - `http://127.0.0.1:30900/snapshot` 可访问。
- Surface contract：
  - `Model -22` 在 `0,1,0` 暴露 `page_asset_v0`，且 `v.id == "root_home"`；
  - `Model -100` 在 `0,1,0` 暴露 `page_asset_v0`，且 `v.id == "matrix_debug_root"`；
  - `Model -103` 在 `0,1,0` 暴露 `page_asset_v0`；
  - `Model -102` 在 `0,11,0` 暴露 `gallery_showcase_tab`，且 `v == "matrix"`；
  - `Model -2` 的 `ws_apps_registry` 至少包含：
    - `100`
    - `-100`
    - `-103`
    - `1003`
    - `1004`
    - `1005`
    - `1007`
  - `ws_apps_registry` 不得直接暴露 child-only examples：
    - `1006`
    - `1008`
- 0232 的裁决目标不是“页面看起来差不多”，而是“canonical local gate 已能对以上 surface 给出 deterministic PASS/FAIL”。

## Impact Surface

### Primary change targets

- `scripts/ops/check_runtime_baseline.sh`
- `scripts/ops/ensure_runtime_baseline.sh`
- `scripts/ops/README.md`

### Authoritative repo inputs

- `scripts/ops/sync_local_persisted_assets.sh`
- `packages/worker-base/system-models/home_catalog_ui.json`
- `packages/worker-base/system-models/workspace_catalog_ui.json`
- `packages/worker-base/system-models/workspace_positive_models.json`
- `packages/worker-base/system-models/matrix_debug_surface.json`
- `packages/worker-base/system-models/gallery_catalog_ui.json`
- `packages/ui-model-demo-server/server.mjs`

### Verification surface

- `scripts/tests/test_0212_home_crud_contract.mjs`
- `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
- `scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
- `scripts/tests/test_0217_gallery_extension_contract.mjs`
- `http://127.0.0.1:30900/snapshot`
- `docs/iterations/0222-local-cluster-rollout-baseline/runlog.md`
- `docs/iterations/0223-local-cluster-browser-evidence/runlog.md`

## Assumptions And Validation Boundary

- Assumption A:
  - `http://127.0.0.1:30900` 仍是本地 canonical live endpoint。
  - Validation:
    - 继续以 `k8s/local/ui-server-nodeport.yaml` 与当前 ops README 作为入口事实。
- Assumption B:
  - `/snapshot` 仍是 local environment 的 authoritative surface proof。
  - Validation:
    - 只要 `server.mjs` 的 `/snapshot` 暴露方式未被重构，0232 直接以 snapshot 断言裁决 live surface。
- Assumption C:
  - 0232 只需要收紧 gate，不需要新增 runtime label type、system model id 或业务 logic。
  - Validation:
    - Phase 3 应只改 ops scripts / ops docs；若发现必须修改 Tier 1 interpreter 或 Tier 2 model semantics，必须停下并新开 fix iteration。

## Invariants / Constraints

- 严格遵守 `CLAUDE.md` 的 `HARD_RULES`、`CAPABILITY_TIERS`、`WORKFLOW`。
- 0232 是 local ops gate iteration，不是 runtime / business iteration：
  - 不跨 Tier 1 / Tier 2 边界新增能力；
  - 不迁移 model placement；
  - 不改 data ownership / routing contract。
- `Model -22`、`Model -100`、`Model -102`、`Model -103`、`Model -2` 的使用方式必须遵守 `CLAUDE.md` 已登记的 system capability placement。
- Phase 1 严禁实现代码；本阶段只允许生成 `plan.md` 与 `resolution.md`。
- Phase 3 的最终结论必须 deterministic PASS/FAIL：
  - 任何 snapshot assertion 失败时，不能输出 `baseline ready`；
  - 任何管理面不可达或 gate 未完整执行时，不能把结果包装成绿色 ready。

## Success Criteria

- `check_runtime_baseline.sh` 的 canonical PASS 条件已被明确改写为“management-plane + live surface”双门槛。
- `ensure_runtime_baseline.sh` 的 short-circuit 与 post-repair success 都以新 gate 为准。
- `scripts/ops/README.md` 对本地 baseline 的解释与脚本行为一致，不再把旧 readiness 误写成最终 ready。
- 在 `0222/0223` 已知 stale 特征下，新 gate 会报出可定位的 blocker，而不是继续输出 ready。
- 在 repo baseline 真正 materialize 到本地环境后，新 gate 能 deterministic PASS。

## Risks And Mitigations

- Risk:
  - gate 只检查脚本文本，不检查 live surface，仍然会保留 false green。
  - Mitigation:
    - 0232 明确要求最终 gate 以 `/snapshot` 断言为准，而不是只做 `rg` 或 doc 对齐。

- Risk:
  - registry gate 写得过窄，未来新增合法 app 时容易误伤。
  - Mitigation:
    - 0232 只要求核心必备 models 存在，并继续禁止 `1006/1008` 这种 child-only models 直接暴露；不把整个 registry 强行钉死成唯一精确集合。

- Risk:
  - 执行壳对本地 kubectl 或 localhost socket 的访问受限，导致 Phase 3 无法完整验证。
  - Mitigation:
    - 若 canonical gate 无法完整执行，只能输出 blocked/unverified，不得冒充 ready verdict。

## Alternatives

### A. 推荐：在现有 `check_runtime_baseline.sh` / `ensure_runtime_baseline.sh` 上直接收紧 gate

- 优点：
  - 不引入新的运维入口；
  - `0229` 与未来 `ops_task` 继续消费同一条 canonical shell surface。
- 缺点：
  - 需要把脚本输出和 README 口径一起维护好。

### B. 另起一个独立 `verify_local_surface.sh`

- 优点：
  - 可以把 surface checks 与 readiness checks 分开。
- 缺点：
  - 会制造两个 competing gates，执行者仍可能只跑旧 `check_runtime_baseline.sh`，不符合“canonical entry”要求。

### C. 继续依赖 `0223` 的 browser evidence 作为最终裁决

- 优点：
  - 能看见真实页面。
- 缺点：
  - 太晚；browser iteration 不应负责替 local canonical gate 补环境盲点。
