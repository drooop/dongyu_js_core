---
title: "Iteration 0193-editor-submodel-test-alignment Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0193-editor-submodel-test-alignment
id: 0193-editor-submodel-test-alignment
phase: phase1
---

# Iteration 0193-editor-submodel-test-alignment Resolution

## Execution Strategy

- 先固化“当前失败来自过时测试假设，而不是 runtime 缺口”的证据。
- 然后把 editor harness 中所有 direct mutation 成功假设一起收敛掉：
  - script 改成验证 `direct_model_mutation_disabled` 或移除过时成功断言
  - asset 不再通过控件暴露 business-model direct mutation
- 不改 runtime / server / adapter 逻辑。

## Step 1

- Scope:
  - 审计 `validate_editor.mjs`、`editor_test_catalog_ui.json`、`local_bus_adapter.js`、`server.mjs`、`test_0177_direct_model_mutation_disabled_contract.mjs`
  - 明确以下 action 在当前架构中都属于被禁止的 business-model direct mutation：
    - `submodel_create`
    - `label_add`
    - `label_update`
    - `label_remove`
    - `cell_clear`
- Files:
  - `packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `packages/worker-base/system-models/editor_test_catalog_ui.json`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
- Verification:
  - `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `rg -n "submodel_create|direct_model_mutation_disabled" packages/ui-model-demo-frontend/scripts packages/ui-model-demo-frontend/src packages/ui-model-demo-server scripts/tests packages/worker-base/system-models/editor_test_catalog_ui.json`
- Acceptance:
  - 有明确证据表明：当前失败来自测试期望与规约冲突
  - 已明确这是整个 legacy direct-mutation harness 过时，不只是 `submodel_create`
  - 不再把该问题描述为 runtime/server 功能缺口
- Rollback:
  - 仅回退本轮文档结论，不改代码

## Step 2

- Scope:
  - 调整 `validate_editor.mjs` 中所有依赖 direct mutation 成功的断言与 PASS 列表
  - 更新 `editor_test_catalog_ui.json` 中所有直写业务模型的测试控件
  - 保留 editor state / mailbox / boundary 相关测试
- Files:
  - `packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `packages/worker-base/system-models/editor_test_catalog_ui.json`
- Verification:
  - `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
  - `git diff -- packages/ui-model-demo-frontend/src/local_bus_adapter.js packages/ui-model-demo-server/server.mjs packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs`
- Acceptance:
  - `validate_editor.mjs` 全 PASS
  - editor test/script 不再要求任何 business-model direct mutation 成功
  - runtime/server direct mutation 边界未被修改
- Rollback:
  - 回退：
    - `packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
    - `packages/worker-base/system-models/editor_test_catalog_ui.json`

## Step 3

- Scope:
  - 收口 runlog、ITERATIONS 和完成状态
- Files:
  - `docs/iterations/0193-editor-submodel-test-alignment/runlog`
  - `docs/ITERATIONS`
- Verification:
  - runlog 记录实施证据、commit hash、merge hash
  - `docs/ITERATIONS` 状态与 runlog 保持一致
- Acceptance:
  - iteration 台账完整
- Rollback:
  - 回退 docs vault 中本轮新增记录
