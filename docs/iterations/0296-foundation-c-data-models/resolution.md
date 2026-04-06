---
title: "0296 — foundation-c-data-models Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-06
source: ai
iteration_id: 0296-foundation-c-data-models
id: 0296-foundation-c-data-models
phase: phase1
---

# 0296 — foundation-c-data-models Resolution

## Execution Strategy

- 先迁 `0190 Data.Array`，把它彻底拉到 `0292/0294` 新合同下。
- 再在同一模式下补 `Data.Queue` 和 `Data.Stack`。
- 全程以正数模型内的自包含模板为主，不额外发明负数系统 helper。
- 本 iteration 的验收重点是：
  - 模板正确
  - 函数/pin 正确
  - payload 正确
  - deterministic tests 正确
  - 最小用户文档正确

## Step 1

- Scope:
  - 审计并迁移 `Data.Array` 旧模板
  - 冻结 `Array / Queue / Stack` 共用 contract
- Files:
  - `packages/worker-base/system-models/templates/data_array_v0.json`
  - `scripts/tests/test_0190_data_array_template_patch.mjs`
  - `scripts/tests/test_0190_data_array_contract.mjs`
  - `scripts/fixtures/0190_data_array_cases.json`
  - `docs/ssot/temporary_modeltable_payload_v1.md`
  - 必要时 `docs/ssot/runtime_semantics_modeltable_driven.md`
- Verification:
  - 旧 `Data.Array` 模板必须明确迁到：
    - `pin.in / pin.out`
    - 临时模型表 payload
  - 必须有红灯测试先证明旧模板口径不够
- Acceptance:
  - `Data.Array` 在新合同下成为 canonical baseline
- Rollback:
  - 回退 `Data.Array` 模板与相关测试

## Step 2

- Scope:
  - 补 `Data.Queue` 与 `Data.Stack` canonical templates
  - 为三者建立并行 contract tests
- Files:
  - `packages/worker-base/system-models/templates/data_queue_v0.json`
  - `packages/worker-base/system-models/templates/data_stack_v0.json`
  - `scripts/tests/test_0296_data_queue_contract.mjs`
  - `scripts/tests/test_0296_data_stack_contract.mjs`
  - `scripts/fixtures/0296_data_model_cases.json`
- Verification:
  - Queue 必须体现 FIFO
  - Stack 必须体现 LIFO
  - 不能只复制 `Array` 文本而没有行为区分
- Acceptance:
  - `Array / Queue / Stack` 三者的最小差异已通过 contract tests 固定
- Rollback:
  - 回退 `Queue / Stack` 模板与测试

## Step 3

- Scope:
  - 文档与展示面收口
  - 评估是否需要最小 Gallery 展示入口
- Files:
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/user-guide/data_models_filltable_guide.md`
  - 按需更新 `docs/ITERATIONS.md`
  - 如需要展示，则最小变更 `Gallery` 相关 authoritative patches
- Verification:
  - 文档必须说明：
    - 怎么创建 `Array / Queue / Stack`
    - pin 名称分别是什么
    - 输入输出 payload 长什么样
  - 若引入 Gallery 展示，必须可由浏览器实际打开
- Acceptance:
  - 数据模型能力不仅存在于测试里，也有用户可读入口
- Rollback:
  - 回退展示/文档改动

## Explicit Non-Goals

- 不做 Flow 模型
- 不做 `Data.LinkedList`
- 不做 `Data.CircularBuffer` 新模板
- 不借机清理 `pin.table.*` 历史残留
- 不进入 Matrix / Slide UI / Three.js 业务实现

## Notes

- `基础 C` 完成后，下一步再开一个小的 cleanup iteration：
  - 清 `runtime.mjs` compat handler
  - 清 `intent_handlers_home.json`
  - 清 `home_catalog_ui.json`
  - 清 `10_ui_side_worker_demo.json`
  - 清 `llm_cognition_config.json`
  - 更新 `CLAUDE.md` 的 `PIN_SYSTEM`
