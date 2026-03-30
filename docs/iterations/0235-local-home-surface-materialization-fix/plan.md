---
title: "0235 — local-home-surface-materialization-fix Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-26
source: ai
iteration_id: 0235-local-home-surface-materialization-fix
id: 0235-local-home-surface-materialization-fix
phase: phase1
---

# 0235 — local-home-surface-materialization-fix Plan

## Metadata

- ID: `0235-local-home-surface-materialization-fix`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0235-local-home-surface-materialization-fix`
- Planning mode: `refine`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0232-local-baseline-surface-gate`
  - `0233-local-matrix-debug-surface-materialization-fix`
  - `0234-local-browser-evidence-effective-rerun`
- Downstream:
  - `0236-local-home-browser-evidence-rerun`

## WHAT

本 iteration 只修一个已经被 `0234` fresh browser evidence 收敛出来、并且已经由 repo 文件进一步定位到 authoritative asset 内容本身的问题：

- local canonical gate 与 live `/snapshot` 已经绿
- Workspace / Matrix Debug / Prompt 已是当前 surface
- 但 Home 路由浏览器仍渲染 legacy `home-datatable`

0235 的目标是把 Home 从“snapshot 看起来对，但 browser 仍旧”收敛为单一、可解释的链路修复。当前最强信号表明，不只是 route resolution 可能有问题，`Model -22` 的 `root_home` asset 本体也仍保留了 `target: home-datatable`、`card_home_datatable` 与只读表格结构。修复后，local Home surface 必须与 `root_home` 的目标语义对齐，而不是继续把 legacy DataTable 当成 authoritative surface 暴露给浏览器。

## WHY

`0234` 已经把当前 local environment 的状态讲得很清楚：

- canonical local gate PASS
- live `/snapshot` 中：
  - `home_asset = root_home`
  - `matrix_asset = matrix_debug_root`
  - Gallery / workspace registry 已对齐
- 但 fresh browser MCP rerun 仍看到：
  - Home `target: home-datatable`
  - Workspace / Matrix Debug / Prompt 为当前 surface

这说明当前剩余问题已经不再是：

- local deploy / readiness
- persisted asset 缺失
- Matrix Debug materialization
- browser bridge / MCP executor

而是一个更窄但更具体的 local Home authoritative asset / projection chain 缺口。最新定位已经说明，问题不再能简单表述为“route 落错”，因为当前 repo 中的 [home_catalog_ui.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/home_catalog_ui.json) 自己就包含：

- `txt_home_target -> "target: home-datatable"`
- `card_home_datatable`
- 只读 `TableColumn` 结构

与此同时，`0212-home-crud-proper-tier2` 的合同明确要求 Home page asset 应具备 proper CRUD surface，而不是停留在只读 DataTable。因此 0235 的真正任务是把 “authoritative Home asset 仍带 legacy datatable shape/marker” 与 “browser 仍呈现 home-datatable” 这两个事实统一修正。若不先修它，继续重跑 local browser evidence 只会重复得到 `Local environment not effective`。

## Scope

### In Scope

- 追 Home 从 authoritative asset 内容到 browser rendering 的 local chain
- 定位并修复：
  - `packages/worker-base/system-models/home_catalog_ui.json` 中仍暴露 legacy `home-datatable` marker / readonly table shape 的部分
  - 若 asset 本体修正后仍不生效，再继续检查：
    - route resolution
    - page asset selection
    - local store / server snapshot consumption
    - renderer / projection chain
  中与 Home surface 仍落到 legacy `home-datatable` 相关的最小缺口
- 保持 `0232` / `0233` 已经修好的 gate 与 Matrix Debug surface 不回退
- 为 `0236` 提供一个可重新取证的 local environment

### Out Of Scope

- 不继续推进任何 remote iteration
- 不修改 remote rollout / remote browser evidence
- 不扩展 Matrix Debug 功能
- 不把问题扩大成“重做整个 Workspace/Home 架构”

## Impact Surface

### Read-only investigation surface

- `packages/worker-base/system-models/home_catalog_ui.json`
- `packages/ui-model-demo-frontend/src/main.js`
- `packages/ui-model-demo-frontend/src/demo_app.js`
- `packages/ui-model-demo-frontend/src/remote_store.js`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- `packages/ui-model-demo-server/server.mjs`
- `packages/ui-renderer/src/renderer.mjs`
- `scripts/tests/test_0191d_home_asset_resolution.mjs`
- `scripts/tests/test_0212_home_crud_contract.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
- `docs/iterations/0234-local-browser-evidence-effective-rerun/runlog.md`

### Expected minimal write surface

- `packages/worker-base/system-models/home_catalog_ui.json`
- local Home route / projection related code under:
  - `packages/ui-model-demo-frontend/**`
  - `packages/ui-model-demo-server/**`
  - `packages/ui-renderer/**`
  only if investigation proves the issue is not solved at the authoritative asset layer
- related deterministic tests / validators
- `docs/iterations/0235-local-home-surface-materialization-fix/runlog.md`

## Success Criteria

- authoritative `root_home` asset no longer encodes legacy `home-datatable` marker / readonly-only table shape as its primary surface contract
- fresh local browser no longer shows `target: home-datatable` on `/#/`
- Home route aligns with the repaired `root_home` surface
- `0232` gate remains green
- Workspace / Matrix Debug / Prompt do not regress
- the fix is narrow and explanatory, not a fallback hack

## Constraints And Invariants

- 遵循 `CLAUDE.md` 的 `HARD_RULES`、`CAPABILITY_TIERS`、`WORKFLOW`
- Home fix 必须保持 “ModelTable is truth, UI is projection”
- 优先修 authoritative asset；只有 asset 修正后仍不能解释 drift，才允许扩到 projection/runtime consumer
- 不得通过手工改 live environment / ad-hoc patch / fake browser evidence 伪造 PASS
- 若发现问题根因超出 Home route/materialization 最小范围，必须停下并显式收窄或新开 follow-up

## Risks And Mitigations

- Risk:
  - snapshot 与 browser 继续矛盾，根因不在单一路径
  - Mitigation:
    - 先固定 fresh browser + snapshot 对照，再做最小链路修复

- Risk:
  - 修 Home 时把 Workspace / Matrix Debug 再打回旧 surface
  - Mitigation:
    - 保持 `0232` gate 与 `0234` evidence 作为回归面

- Risk:
  - 为了快过关，直接对 Home 做硬编码 fallback
  - Mitigation:
    - 要求最终解释必须能说明为何 browser 之前落到 legacy target，而不是只让截图变绿

## Alternatives

### A. 推荐：优先修 authoritative Home asset，再按需补 projection 链

- 优点：
  - 直接命中当前最强证据点：`root_home` asset 自身仍带 legacy marker/shape
  - 不会一上来就把问题误判成 route/runtime
- 缺点：
  - 仍需验证 asset 修正后是否已经足够，还是还要补 projection 链

### B. 直接重跑浏览器，不修代码

- 优点：
  - 成本低
- 缺点：
  - 只会重复 `0234` 的 not effective 结论

### C. 重新做 local baseline/deploy

- 优点：
  - 可能碰巧把问题刷掉
- 缺点：
  - `0232` 已经证明 baseline gate 是绿的，这条路径信息增益很低
