---
title: "Foundation C Data Models Implementation Plan"
doc_type: plan
status: active
updated: 2026-04-06
source: ai
---

# Foundation C Data Models Implementation Plan

## Goal

在新 pin/payload 合同下，交付第一批正式数据模型族：`Data.Array / Data.Queue / Data.Stack`。

## Implementation Order

1. 先迁 `Data.Array`
2. 再补 `Data.Queue`
3. 再补 `Data.Stack`
4. 最后补文档与展示面

## Shared Contract To Freeze Before Code

- root/data cell layout
- `Array / Queue / Stack` pin naming table
- temporary modeltable payload examples
- output payload examples
- mutation ack policy
- `Data.Array` 旧模板的两类迁移点：
  - authoritative patch wrapper 与 runtime payload 的区分
  - function-body `model_id=2001` 硬编码移除

## Key Files

- `packages/worker-base/system-models/templates/data_array_v0.json`
- `packages/worker-base/system-models/templates/data_queue_v0.json`
- `packages/worker-base/system-models/templates/data_stack_v0.json`
- `scripts/tests/test_0190_data_array_contract.mjs`
- `scripts/tests/test_0296_data_queue_contract.mjs`
- `scripts/tests/test_0296_data_stack_contract.mjs`
- `scripts/fixtures/0190_data_array_cases.json`
- `scripts/fixtures/0296_data_model_cases.json`
- `docs/user-guide/data_models_filltable_guide.md`

## Verification Expectations

- deterministic contract tests first
- no runtime rewrite unless a true interpreter bug blocks Tier2 behavior
- if a Gallery showcase is added, browser verification is required

## Explicit Boundaries

- No Flow model
- No cleanup iteration work mixed in
- No Matrix / Slide UI / Three.js implementation
