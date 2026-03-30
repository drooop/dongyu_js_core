---
title: "UI Iteration Wave Post-0201"
doc_type: roadmap
status: planned
updated: 2026-03-22
source: ai
---

# UI Iteration Wave Post-0201

## Purpose

在 `0201-route-sse-page-sync-fix` 已完成且宿主层 route/SSE 噪声已收口后，重新规划 UI 主线迭代，给 orchestrator 一组可连续执行的业务 iteration 骨架。

这份文档是批量执行入口说明，不替代各 iteration 自己的 `plan.md` / `resolution.md` / `runlog.md`。

## Why Re-number

原草图里的 `0202` 到 `0205` 已被 orchestrator v1 / v1.1 占用，因此本轮业务路线统一顺延到 `0210` 之后，避免：

- 与现有 ledger 冲突
- 与既有 branch 命名冲突
- orchestrator `--iteration` 路由误判

## Anchor

- `0201-route-sse-page-sync-fix`
  - Status: Completed
  - Role: 宿主正确性锚点
  - Meaning: 后续所有浏览器级验收都建立在 `0201` 已消除 SSE 多页面切换噪声的前提上

## Execution Order

### Phase B — Contract Freeze + Migration

1. `0210-ui-cellwise-contract-freeze`
2. `0211-ui-bootstrap-and-submodel-migration`

### Phase C — Functional Fill + Debug Surface

3. `0212-home-crud-proper-tier2`
4. `0213-matrix-debug-ui-surface`
5. `0214-sliding-flow-ui`

### Phase D — Examples + 3D + Gallery

6. `0215-ui-model-tier2-examples-v1`
7. `0216-threejs-runtime-and-scene-crud`
8. `0217-gallery-extension-matrix-three`

## Dependency Notes

- `0210` 是后续 UI 主线的 freeze 合同；`0211` 起必须遵守它。
- `0211` 是把历史不合规 bootstrap / submodel 迁移到新合同；`0212` 到 `0217` 均默认以其结果为前提。
- `0213` 为 `0214` 提供 debug / ops surface。
- `0215` 与 `0216` 共同构成 `0217` 的 examples + runtime 基座。

## Batch Guidance For Orchestrator

- 这些 iteration 当前都处于 `Planned`，应由 orchestrator 走 `draft_iteration -> PLANNING` 路径启动。
- 不建议一次性把 `0210` 到 `0217` 并行全开；建议按 phase 顺序串行推进，每次只让一个 iteration 进入 active execution。
- 每个 iteration 的 `REVIEW_PLAN` 通过后，再继续 `EXECUTION`；不要跨 iteration 预执行。
