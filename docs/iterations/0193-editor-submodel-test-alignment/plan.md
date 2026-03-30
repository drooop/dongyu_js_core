---
title: "Iteration 0193-editor-submodel-test-alignment Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0193-editor-submodel-test-alignment
id: 0193-editor-submodel-test-alignment
phase: phase1
---

# Iteration 0193-editor-submodel-test-alignment Plan

## Goal

- 使 [validate_editor.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/scripts/validate_editor.mjs) 与当前规约和运行时边界一致：
  - 不再要求任何 direct mutation action 在业务模型上成功
  - editor test page 不再展示或鼓励已被规约禁止的 direct mutation 路径

## Background

- 当前基线失败为：
  - `FAIL: editor_submodel_create: model 2 not created`
- 但现状已经明确表明，这不是功能缺口，而是测试过时：
  - [local_bus_adapter.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/local_bus_adapter.js) 明确拒绝 `submodel_create`
  - [server.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-server/server.mjs) 同样拒绝 `submodel_create`
  - [test_0177_direct_model_mutation_disabled_contract.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs) 已将该拒绝固化为正式合同
- 进一步实施前审计后确认，过时假设并不只存在于 `submodel_create`：
  - `label_add`
  - `label_update`
  - `label_remove`
  - `cell_clear`
  - `submodel_create`
  都仍在 editor harness 中被当作“对业务模型的成功路径”使用。
- 因此，本轮目标是让整个 editor test/script 与 editor test asset 对齐当前规约，而不是恢复任何 legacy 直写行为。

## Scope

- In scope:
  - 调整 `validate_editor.mjs` 中所有 direct mutation 成功断言
    - `submodel_create`
    - `label_add`
    - `label_update`
    - `label_remove`
    - `cell_clear`
  - 更新 `editor_test_catalog_ui.json`，移除或替换所有会直写业务模型的测试控件
  - 为上述调整补最小、可重复的验证
- Out of scope:
  - 不修改 runtime / server / local adapter 的 direct mutation 边界
  - 不恢复任何 `submodel_create` 直写能力
  - 不恢复任何 direct mutation 成功路径
  - 不扩展新的 model creation / business mutation 合规路径

## Invariants / Constraints

- 必须遵守 repo root 的 `CLAUDE` 规约文件中的 `fill-table-first`、Tier 边界与 `fail fast on non-conformance`。
- 不得用 fallback 或兼容逻辑保留被规约禁止的路径。
- 本轮实现必须不改：
  - [local_bus_adapter.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/local_bus_adapter.js)
  - [server.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-server/server.mjs)
  - [runtime.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/src/runtime.js)
  - [runtime.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/src/runtime.mjs)

## Success Criteria

- [validate_editor.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/scripts/validate_editor.mjs) 全 PASS。
- `validate_editor.mjs` 不再把任何 direct mutation action 视为业务模型成功路径。
- [editor_test_catalog_ui.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/editor_test_catalog_ui.json) 不再通过控件暴露违规的 business-model direct mutation 路径。
- 保留下来的 editor 测试只覆盖：
  - mailbox / envelope shape
  - editor state 本地更新
  - direct mutation 拒绝
  - 非 direct-mutation 的仍然有效的 UI 行为
- 本轮 git diff 中不包含 runtime/server direct mutation 边界逻辑改动。

## Risks & Mitigations

- Risk:
  - 只改脚本、不改 test page，导致 UI 资产仍在鼓励违规路径。
  - Mitigation:
    - 本轮同时修改测试脚本和 test asset。
- Risk:
  - 为了让测试转绿而错误放松 adapter/server 边界。
  - Mitigation:
    - 明确将 runtime/server/local adapter 排除在 scope 外，并在验证中检查无相关 diff。
- Risk:
  - 把仍有价值的 editor 基础校验一起删掉。
  - Mitigation:
    - 仅清理依赖 direct mutation 成功的用例，保留 editor state / mailbox / shape / boundary 测试。

## Alternatives

### A. 推荐：修整个 editor harness，使其对齐当前规约

- 优点：
  - 与 0177 / 0191 / 0192 后的边界一致
  - 不引入新的 runtime 行为
  - 一次性消除 `validate_editor.mjs` 中所有同类过时假设
- 缺点：
  - 需要重写 editor test 中一段 legacy harness 逻辑

### B. 只修 `submodel_create` 一个点

- 优点：
  - 表面上改动点更少
- 缺点：
  - 无法让 `validate_editor.mjs` 全绿
  - 其余 direct mutation 成功假设仍然会继续失败
  - 会导致 iteration 目标与验收标准不闭合

### C. 恢复 direct mutation 让旧测试继续通过

- 优点：
  - 表面上改动点更少
- 缺点：
  - 直接违反当前 direct mutation 边界合同
  - 会和 0177 正式合同冲突
  - 属于明确不可接受方案

当前推荐：A。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0193-editor-submodel-test-alignment
- Trigger:
  - 用户确认 `validate_editor.mjs` 的失败来自过时测试，不是真实功能缺口
  - 实施前审计进一步确认：整个 harness 都仍在假设 direct mutation 成功路径可用
  - 验收目标明确为：`validate_editor.mjs` 全 PASS，且不引入任何 runtime 变更
