---
title: "0304 — slide-runtime-scope-semantics-freeze Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-09
source: ai
iteration_id: 0304-slide-runtime-scope-semantics-freeze
id: 0304-slide-runtime-scope-semantics-freeze
phase: phase1
---

# 0304 — slide-runtime-scope-semantics-freeze Resolution

## Execution Strategy

- `0304` 是 docs-only 语义冻结迭代。
- 本轮只做文档与后续 IT 拆分，不写 runtime / server / frontend 代码。
- 执行顺序固定为：
  1. 盘清现有 SSOT 与代码主路径的差异
  2. 在 iteration 文档中声明后续 IT 落位与边界
  3. 冻结 `0304` 的语义计划与验收口径

## Step 1

- Scope:
  - 盘清当前 SSOT 与现状的差异
- Files:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
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

## Step 3

- Scope:
  - 完成 `0304` 自身 plan / resolution / runlog
- Files:
  - `docs/iterations/0304-slide-runtime-scope-semantics-freeze/plan.md`
  - `docs/iterations/0304-slide-runtime-scope-semantics-freeze/resolution.md`
  - `docs/iterations/0304-slide-runtime-scope-semantics-freeze/runlog.md`
- Verification:
  - `0304` 的成功标准必须单列：
    - `pin.table.* / pin.single.*` 清理验收点
    - 多重模型归属新语义验收点
  - 必须记录：
    - `0304` 完成后先给同事接口预告
- Acceptance:
  - `0304` 进入可审查状态
- Rollback:
  - 回退 `0304` iteration 文档
