---
title: "0241 — local-integration-recovery-for-0240 Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-26
source: ai
iteration_id: 0241-local-integration-recovery-for-0240
id: 0241-local-integration-recovery-for-0240
phase: phase1
---

# 0241 — local-integration-recovery-for-0240 Plan

## Metadata

- ID: `0241-local-integration-recovery-for-0240`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0241-local-integration-recovery-for-0240`
- Planning mode: `refine`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0235-local-home-surface-materialization-fix`
  - `0238-local-matrix-debug-materialization-regression-fix`
  - `0239-local-home-selector-model0-fix`
- Downstream:
  - `0240-local-browser-evidence-rerun-after-0238-0239`

## WHAT

本 iteration 不再继续单点修 surface，而是修主线集成策略错误。

当前仓库已经有三个关键本地修复分别存在于独立分支：

- `0235`：Home surface 去掉 legacy `home-datatable`
- `0238`：Matrix Debug persisted asset externalization / materialization 恢复
- `0239`：Home selector `model0` option / current value 同步链修复

但其中 `0235`、`0238` 没有并回 `dev`，`0239` 也建立在旧 `dev` 上。结果是：

- 后续分支天然丢失已完成修复
- 本地 fresh browser rerun 会重复撞回旧 Home / Matrix Debug
- `0240` 目前没有一条可信、完整的本地基线可测

0241 的目标就是恢复这条主线：

1. 将 `0235` 已完成修复合并回 `dev`
2. 将 `0238` 已完成修复合并回 `dev`
3. 在包含 `0235 + 0238` 的基线上承接 `0239` 当前 selector 修复
4. 为 `0240` 提供完整、统一的本地可测基线

## WHY

当前问题已经不再是单个 surface bug，而是 completed iterations 没有进入主线：

- `0235` 的 commit `6949703` 不在 `dev`
- `0238` 的 commit `44d4565` 不在 `dev`
- `0239` 分支从旧 `dev` 派生，因此天然不包含上述两条修复

这会制造一种假象：

- 看起来像“修一个暴露一个”
- 但真实情况是“之前修过的内容从未进入主线”

因此，继续在当前 `0239` 分支上直接跑 `0240` 没有意义。只有先恢复主线，再承接 `0239`，`0240` 的 browser evidence 才有可信输入。

## Scope

### In Scope

- 确认 `0235`、`0238` 的 authoritative 完成状态与对应提交
- 将 `0235`、`0238` 通过 merge commit 并入 `dev`
- 在整合后的基线上承接 `0239` 当前修复代码
- 验证整合后基线至少满足：
  - Home surface 合同仍绿
  - Matrix Debug materialization 合同仍绿
  - Home selector `model0` focused guards 绿
- 为 `0240` 生成明确前置结论

### Out Of Scope

- 直接执行 `0240` Playwright MCP rerun
- 新增新的 Home / Matrix / Workspace 功能
- remote rollout / remote browser / remote ops
- 改写 `0235` / `0238` / `0239` 的 WHAT/WHY 合同

## Success Criteria

- `dev` 包含 `0235` 与 `0238` 的已完成修复
- 整合后的承接线包含：
  - Home surface fix
  - Matrix Debug materialization fix
  - Home selector `model0` fix
- focused deterministic guards 全绿：
  - `test_0235_home_surface_contract`
  - `test_0200b_persisted_asset_loader_contract`
  - `test_0213_matrix_debug_surface_contract`
  - `validate_matrix_debug_server_sse`
  - `test_0239_home_selector_model0_contract`
  - `validate_home_selector_server_sse`
- `0240` 的前置不再是“分支缺旧修复”，而只剩真实 browser evidence 本身

## Constraints And Invariants

- 严格遵循 `CLAUDE.md`：
  - 允许的 `dev` 写入方式只能是 merge commit
  - 不直接在 `dev` 上做日常线性提交
- 不允许丢弃当前 `0239` 的未提交修复
- 不允许通过手工改 live 环境来绕过主线恢复
- 不允许在本 iteration 内顺手做 `0240`

