---
title: "0237 — local-browser-surface-regressions-fix Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0237-local-browser-surface-regressions-fix
id: 0237-local-browser-surface-regressions-fix
phase: phase1
---

# 0237 — local-browser-surface-regressions-fix Plan

## Metadata

- ID: `0237-local-browser-surface-regressions-fix`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0237-local-browser-surface-regressions-fix`
- Planning mode: `refine`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0213-matrix-debug-ui-surface`
  - `0212-home-crud-proper-tier2`
  - `0236-local-home-browser-evidence-rerun`
- Downstream:
  - a fresh local browser evidence rerun after both regressions are repaired

## WHAT

本 iteration 只修当前本地 browser 侧剩余的两处 UI surface regression，不扩展功能，不重做 baseline，不改 runtime 语义：

- Regression A:
  - `/workspace` 中选到 Matrix Debug 后，browser 不是渲染 `matrix_debug_root`，而是显示 `Model -100 has no UI schema or AST.`
- Regression B:
  - Home 路由 `/` 的 `Model` 筛选下拉没有把 `model0` 呈现为正式 option / selected state。
  - 最新人工 fresh evidence 报告过错误当前值为 `-2 (editor_state)`。
  - 2026-03-26 当前 live `/snapshot` 也已经直接暴露出同类漂移：`ui_page = home` 时，`selected_model_id = -2`，同时 `editor_model_options_json` 里没有 `value == 0` 的选项。

0237 的目标不是“让截图暂时变绿”，而是把这两个 browser-visible regression 收敛为一条可解释、可验证、可复现的本地 surface 修复链。

## WHY

当前 0237 现有草稿还只是 scaffold，不足以指导 Phase 3：

- `resolution.md` 仍保留 `<new-...>` / `<focused-browser-surface-rerun>` 占位符
- 还引用了仓库中不存在的 `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`
- 因此现有 HOW 既不自包含，也不可执行

同时，repo 与 live local environment 的事实已经出现了明确分叉，这正是 0237 必须解决的核心：

- 2026-03-26 repo-side contract / isolated server-state 仍然是绿的：
  - `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `node scripts/tests/test_0212_home_crud_contract.mjs`
- 但 2026-03-26 live local endpoint `http://127.0.0.1:30900/snapshot` 暴露的是红灯事实：
  - `Model -100 / 0,1,0 / page_asset_v0 = null`
  - `ui_page = "home"`
  - `ws_app_selected = -100`
  - `selected_model_id = -2`
  - `editor_model_options_json` 不包含 `value == 0`
- 2026-03-25 的 `0236` browser evidence 已经从浏览器侧确认：
  - Matrix Debug 页面显示 `Model -100 has no UI schema or AST.`
  - local environment 仍不能裁决为 `effective`

这说明当前剩余问题不再是“需求未知”，而是一个更具体的 local browser surface mismatch：

- repo authoritative contract / isolated validator 认为 Matrix Debug surface 与 Home selector contract 都成立
- live local browser input surface 却没有拿到同样的结果

0237 的价值就是把这条差异收口在最小 surface 链路内，而不是继续用新的 rerun 重复同样的 not effective 结论。

## Scope

### In Scope

- Matrix Debug 的 local surface 链路定位与修复，范围限定在：
  - live state
  - server client snapshot
  - workspace selected-model projection
  - browser/renderer select + AST consumption
- Home `Model` selector 的 option inventory、current value、selected state 一致性修复
- 为上述两处 regression 补 focused deterministic guards
- 保持 `0213` 的 Matrix Debug formal contract 与 `0212` 的 Home CRUD contract 不回退
- 保持 `0235` 修好的 `root_home` surface 不回退

### Out Of Scope

- remote rollout / remote browser / remote evidence
- broad local baseline or deploy rework
- Tier 1 runtime semantics / label semantics change
- 新业务功能、UI redesign、额外页面能力扩展
- 通过 fallback AST 或硬编码 UI 文案掩盖真实数据链问题

## Impact Surface

### Read-only Investigation Surface

- `packages/worker-base/system-models/matrix_debug_surface.json`
- `packages/worker-base/system-models/home_catalog_ui.json`
- `packages/ui-model-demo-server/server.mjs`
- `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- `packages/ui-renderer/src/renderer.mjs`
- `packages/ui-renderer/src/renderer.js`
- `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
- `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
- `scripts/tests/test_0212_home_crud_contract.mjs`
- `docs/iterations/0236-local-home-browser-evidence-rerun/runlog.md`
- `output/playwright/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/local-home-rerun/report.json`

### Expected Minimal Write Surface

- `packages/ui-model-demo-server/server.mjs`
- `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
- `packages/ui-renderer/src/renderer.mjs`
- `packages/ui-renderer/src/renderer.js`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
  - only if Step 1 proves the Matrix Debug failure survives after server/state correction
- new focused guards:
  - `scripts/tests/test_0237_local_browser_surface_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_local_browser_surface_server_sse.mjs`

Expected write surface deliberately excludes deploy scripts and runtime interpreters. If 0237 cannot be explained within server/frontend snapshot-projection-consumption scope, that must become a separate follow-up instead of a silent scope expansion.

## Success Criteria

- live local snapshot no longer exposes `Model -100 / 0,1,0 / page_asset_v0 = null`
- `/workspace` resolution for the selected Matrix Debug app produces the formal Matrix Debug surface, not the `no UI schema or AST` warning
- Home `Model` selector inventory contains `model0`
- Home current selected value no longer drifts to an unrelated negative model while `ui_page = home`
- repo-side contracts remain green:
  - `test_0213_matrix_debug_surface_contract`
  - `validate_matrix_debug_server_sse`
  - `test_0212_home_crud_contract`
- the fix remains explanatory:
  - final state must explain why repo-local validators were green while live browser input surface was red

## Constraints And Invariants

- 遵循 `CLAUDE.md` 的 `HARD_RULES`、`WORKFLOW`、`fill-table-first` 与 fail-fast 规则
- Phase 1 只写文档，不写实现代码
- `ModelTable` 仍是 truth source；UI 只能修 projection / consumption / selected-state derivation，不能伪造 truth
- 不允许把 Matrix Debug 问题“修”成 fallback warning hide / fake AST
- 若 renderer 被修改，`renderer.mjs` 与 `renderer.js` 必须保持行为对齐
- 若 Step 1 证明问题只能通过 persisted-asset/deploy path 才能解释，0237 必须停止并显式拆 follow-up，不得在本 iteration 内偷扩到 baseline/deploy 工程

## Risks And Mitigations

- Risk:
  - repo contract green，但 live local snapshot 仍然红，根因可能不在同一文件
  - Mitigation:
    - 先冻结“repo green / live red”对照事实，再决定最小写入面

- Risk:
  - 为修 `model0` option，引入新的 selected value 类型漂移，导致 Select 在 browser 中仍显示 raw value
  - Mitigation:
    - 同时检查 option inventory 与 Select 的 current value normalization，不只看 options 列表

- Risk:
  - 修 Matrix Debug 时回退 `0213` formal contract 或破坏 Home surface
  - Mitigation:
    - 以 `test_0213_matrix_debug_surface_contract`、`validate_matrix_debug_server_sse`、`test_0212_home_crud_contract` 作为必须保绿的回归面

## Alternatives

### A. 推荐：收口 server/client snapshot + selected-state projection 的最小链路

- 优点：
  - 直接命中当前 repo-green/live-red 的交叉点
  - 可以同时解释 Matrix Debug 与 Home selector 两个 surface regression
- 缺点：
  - 需要把 live snapshot 与 renderer/select value 行为一起看，而不是只改单一文件

### B. 只补 browser fallback 文案或 AST 占位

- 优点：
  - 短期可让页面不再出现 warning
- 缺点：
  - 违反 fail-fast 与“UI is projection”约束，不能解释 `page_asset_v0 = null` 与 selector drift

### C. 直接重跑 baseline / deploy / browser evidence

- 优点：
  - 操作成本低
- 缺点：
  - 不能收敛当前 contract gap，只会重复得到新的 surface 症状
