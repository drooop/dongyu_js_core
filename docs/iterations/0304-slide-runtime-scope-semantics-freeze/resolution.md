---
title: "0304 — slide-runtime-scope-semantics-freeze Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-04-09
source: ai
iteration_id: 0304-slide-runtime-scope-semantics-freeze
id: 0304-slide-runtime-scope-semantics-freeze
phase: phase4
---

# 0304 — slide-runtime-scope-semantics-freeze Resolution

## Execution Strategy

- `0304` 是 docs-only 语义冻结迭代。
- 本轮只做文档与后续 IT 拆分，不写 runtime / server / frontend 代码。
- 执行顺序固定为：
  1. 盘清现有 SSOT 与代码主路径的差异
  2. 冻结 runtime 语义、Tier 归属和现行用户指南口径
  3. 在 iteration 文档中声明后续 IT 落位与边界
  4. 给同事先出一份接口预告，并完成 docs closure

## Step 1

- Scope:
  - 盘清当前 SSOT 与现状的差异
- Files:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/tier_boundary_and_conformance_testing.md`
  - `docs/iterations/0302-slide-app-zip-import-v1/plan.md`
  - `docs/iterations/0303-cloud-worker-sync-and-color-proxy-import/runlog.md`
- Verification:
  - 明确写出：
    - `pin.table.* / pin.single.*` 仍在哪些 SSOT 条目中出现
    - 多重模型归属新语义与现有 SSOT 的冲突点
- Acceptance:
  - `0304` 的 planning 输入不再模糊
- Rollback:
  - 仅回退本轮 planning 文档

## Step 2

- Scope:
  - 冻结 runtime 语义、Tier 归属和现行用户指南口径
- Files:
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/tier_boundary_and_conformance_testing.md`
  - `docs/ssot/ui_to_matrix_event_flow.md`
  - `docs/user-guide/modeltable_user_guide.md`
- Verification:
  - 新语义必须同时落到：
    - 上位架构文档
    - runtime 语义 SSOT
    - label registry
    - 用户指南
  - 必须明确：
    - effective model label 仍唯一
    - scope discoverability 可以多层派生
    - mailbox 之后的事件→引脚解释属于 Tier 1 runtime
    - `pin.table.* / pin.single.*` 已退出当前主路径
- Acceptance:
  - 现行规范口径一致
- Rollback:
  - 回退本轮语义与用户指南文档

## Step 3

- Scope:
  - 声明后续 IT 落位，并拆开高风险项
- Files:
  - `docs/plans/2026-04-09-slide-runtime-followup-it-breakdown.md`
  - `docs/ITERATIONS.md`
- Verification:
  - 后续 IT 必须明确：
    - `0305` 承接需求 2/3
    - `0306` 只负责建新合法路由
    - `0307` 承接需求 4，并先冻结安全策略
    - `0308` 负责拆旧路由
    - `0309` 负责 Matrix 投递说明
- Acceptance:
  - 路线图边界清楚，不再把新路由与旧路由退役混成一个 IT
- Rollback:
  - 回退本轮 breakdown 文档与 iteration 索引变更

## Step 4

- Scope:
  - 输出协作者接口预告，并完成 `0304` 自身 closure
- Files:
  - `docs/user-guide/slide_matrix_delivery_preview_v0.md`
  - `docs/user-guide/README.md`
  - `docs/iterations/0304-slide-runtime-scope-semantics-freeze/plan.md`
  - `docs/iterations/0304-slide-runtime-scope-semantics-freeze/resolution.md`
  - `docs/iterations/0304-slide-runtime-scope-semantics-freeze/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `0304` 的成功标准必须单列：
    - `pin.table.* / pin.single.*` 清理验收点
    - 多重模型归属新语义验收点
  - 必须记录：
    - `0304` 完成后先给同事接口预告
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Acceptance:
  - `0304` 正式收口
- Rollback:
  - 回退 `0304` iteration 文档
