---
title: "0289 — slide-ui-phaseB-workspace-generalization Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-06
source: ai
iteration_id: 0289-slide-ui-phaseB-workspace-generalization
id: 0289-slide-ui-phaseB-workspace-generalization
phase: phase1
---

# 0289 — slide-ui-phaseB-workspace-generalization Resolution

## Execution Strategy

- 本 iteration 仍是 docs-only 计划冻结，不做代码实现。
- 目标是把 `Slide UI Phase B` 的 Workspace 主线通用化拆到可执行粒度。
- 实施顺序固定为：
  1. 冻结 slide-capable app 准入条件
  2. 冻结 metadata 最小集
  3. 冻结 registry / mount / selection / lifecycle 边界
  4. 冻结从单点锚点到多 app 主线的过渡方案
  5. 写清与 Phase C 的切分理由

## Step 1

- Scope:
  - 写清 slide-capable app 的正式准入条件
- Files:
  - `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/plan.md`
  - `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/resolution.md`
- Verification:
  - 文档中必须明确：
    - 什么 app 进入 Slide UI 主线
    - 什么 app 不进入 Slide UI 主线
- Acceptance:
  - 准入条件清晰
- Rollback:
  - 回退本 iteration 文档

## Step 2

- Scope:
  - 冻结 Workspace slide app metadata 最小集
- Files:
  - `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/plan.md`
  - `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/resolution.md`
- Verification:
  - 文档中必须明确：
    - metadata 字段集合
    - 每个字段的作用
- Acceptance:
  - metadata 口径清晰
- Rollback:
  - 回退本 iteration 文档

## Step 3

- Scope:
  - 冻结 registry / mount / selection / lifecycle 的统一边界
- Files:
  - `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/plan.md`
  - `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/resolution.md`
- Verification:
  - 文档中必须明确：
    - registry discover
    - mount / unmount
    - current selection
    - lifecycle summary projection
- Acceptance:
  - 主线通用化边界清晰
- Rollback:
  - 回退本 iteration 文档

## Step 4

- Scope:
  - 写清从单点 `Model 100` 到多 slide-capable app 主线的过渡方案
- Files:
  - `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/plan.md`
  - `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/resolution.md`
- Verification:
  - 文档中必须明确：
    - 当前锚点如何保留
    - 通用主线如何逐步扩展
- Acceptance:
  - 过渡路径清晰
- Rollback:
  - 回退本 iteration 文档

## Step 5

- Scope:
  - 写清为什么在 Phase B 后才能进入 Phase C
- Files:
  - `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/plan.md`
  - `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/runlog.md`
- Verification:
  - 文档中必须显式写出：
    - 为什么不能先开放用户创建
    - 为什么系统主线要先稳定
- Acceptance:
  - 与 Phase C 的切分理由清晰
- Rollback:
  - 回退本 iteration 文档
