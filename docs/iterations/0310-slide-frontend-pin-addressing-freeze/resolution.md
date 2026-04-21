---
title: "0310 — slide-frontend-pin-addressing-freeze Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0310-slide-frontend-pin-addressing-freeze
id: 0310-slide-frontend-pin-addressing-freeze
phase: phase1
---

# 0310 — slide-frontend-pin-addressing-freeze Resolution

## Execution Strategy

1. 先审当前 `0305/0306` 的过渡协议与投影事实。
2. 再冻结正式 envelope 与 projection 口径。
3. 最后输出 `0311` 审计输入与范围修正。

## Step 1

- Scope:
  - 审查当前前端事件协议与投影现状
- Files:
  - `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/test_model_100_ui.json`
- Acceptance:
  - 过渡协议与 pin 直寻址目标的差距被明确记录

## Step 2

- Scope:
  - 冻结新的 envelope 与 projection 口径
- Files:
  - `docs/iterations/0310-slide-frontend-pin-addressing-freeze/plan.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/user-guide/modeltable_user_guide.md`
- Acceptance:
  - `pin` 成为正式目标语义
  - `target = cell / pin = port` 的分离被写成 SSOT 正文条文
  - `writable_pins` 或等价字段的具体 schema 被冻结：
    - 字段名
    - 值类型
    - 是否支持多 pin
    - 是否区分 pin 方向

## Step 3

- Scope:
  - 审计系统动作按钮的 cell 化现状并修正 `0311` 边界
- Files:
  - `docs/iterations/0310-slide-frontend-pin-addressing-freeze/runlog.md`
  - `docs/plans/2026-04-09-slide-runtime-followup-it-breakdown.md`
  - `docs/iterations/0311-slide-page-asset-pinification-buildout/plan.md`
- Acceptance:
  - `0311` 的输入和风险被明确记录
