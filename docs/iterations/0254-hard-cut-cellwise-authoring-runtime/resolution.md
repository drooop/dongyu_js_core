---
title: "0254 — hard-cut-cellwise-authoring-runtime Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0254-hard-cut-cellwise-authoring-runtime
id: 0254-hard-cut-cellwise-authoring-runtime
phase: phase1
---

# 0254 — hard-cut-cellwise-authoring-runtime Resolution

## Strategy

0254 只做 authoring runtime/compiler，不做业务页面迁移。

## Steps

| Step | Name | Goal |
|---|---|---|
| 1 | Add RED compiler contracts | 冻结组件/挂载/排版的最小 RED 面 |
| 2 | Implement compiler/runtime | 让 cellwise authoring 生成唯一 render target |
| 3 | Run focused regression | 保证编译输出稳定、可渲染 |

## Pilot Choice

- `Model 1003`

## Output

- `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`
- `scripts/tests/test_0254_cellwise_authoring_runtime_contract.mjs`
- `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
- `packages/worker-base/system-models/workspace_positive_models.json`
- `packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
