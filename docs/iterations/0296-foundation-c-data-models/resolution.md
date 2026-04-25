---
title: "0296 — foundation-c-data-models Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
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

## Data Model Shared Contract

### 1. Layout Rule

- 三者统一采用同一组基础布局：
  - D0，也就是 `(0,0,0)`，负责：
    - `model_type`
    - 元信息（如 `size_now` / `next_index`）
    - 所有 boundary pins
    - 所有 `func.js`
    - 所有 `pin.connect.label`
  - 数据元素默认放在：
    - `(0,r,0)`，其中 `r >= 1`
  - `c > 0`、`p > 0` 在本 iteration 不进入正式合同
- `Array / Queue / Stack` 的差别不靠不同布局表达，而靠：
  - 不同 pin 名称
  - 不同函数行为

### 2. Pin Naming Rule

#### Data.Array

- mutation pins:
  - `add_data_in`
  - `delete_data_in`
- query pins:
  - `get_data_in`
  - `get_all_data_in`
  - `get_size_in`
- output pins:
  - `get_data_out`
  - `get_all_data_out`
  - `get_size_out`

#### Data.Queue

- mutation pins:
  - `enqueue_data_in`
  - `dequeue_data_in`
- query pins:
  - `peek_data_in`
  - `get_all_data_in`
  - `get_size_in`
- output pins:
  - `dequeue_data_out`
  - `peek_data_out`
  - `get_all_data_out`
  - `get_size_out`

#### Data.Stack

- mutation pins:
  - `push_data_in`
  - `pop_data_in`
- query pins:
  - `peek_data_in`
  - `get_all_data_in`
  - `get_size_in`
- output pins:
  - `pop_data_out`
  - `peek_data_out`
  - `get_all_data_out`
  - `get_size_out`

### 3. Input Payload Rule

- 所有输入 payload 一律使用临时模型表数组，不再使用裸 object / `null`。

#### Single-value mutation payload

适用于：
- `add_data_in`
- `enqueue_data_in`
- `push_data_in`

示例：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "value", "t": "json", "v": { "foo": "bar" } }
]
```

#### Index payload

适用于：
- `delete_data_in`
- `get_data_in`

示例：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "index", "t": "int", "v": 2 }
]
```

#### Zero-arg query payload

适用于：
- `get_all_data_in`
- `get_size_in`
- `peek_data_in`
- `dequeue_data_in`
- `pop_data_in`

示例：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" }
]
```

### 4. Output Payload Rule

#### Single-item result

适用于：
- `get_data_out`
- `peek_data_out`
- `dequeue_data_out`
- `pop_data_out`

示例：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "found", "t": "bool", "v": true },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "value", "t": "json", "v": { "foo": "bar" } }
]
```

`get_data_out` 在需要时可额外带：

```json
{ "k": "index", "t": "int", "v": 2 }
```

#### Collection result

适用于：
- `get_all_data_out`

示例：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "Data.ArrayResult" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "size", "t": "int", "v": 2 },
  { "id": 0, "p": 1, "r": 0, "c": 0, "k": "value", "t": "json", "v": "A" },
  { "id": 0, "p": 2, "r": 0, "c": 0, "k": "value", "t": "json", "v": "B" }
]
```

#### Size result

适用于：
- `get_size_out`

示例：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "size", "t": "int", "v": 2 }
]
```

### 5. Ack Strategy

- 本 iteration 不新增通用 `ack` pin。
- 对纯 mutation：
  - `add`
  - `delete`
  - `enqueue`
  - `push`
  成功语义以 committed state 改变为准。
- 对既修改状态又返回值的操作：
  - `dequeue`
  - `pop`
  通过各自的 output pin 返回结果，不再额外设计独立 ack。

### 6. Canonical Template File Rule

- checked-in 的 canonical template 文件，在 `0296` 中仍允许继续使用 repo authoritative patch wrapper：
  - `version: "mt.v0"`
  - `records: [...]`
- 原因：
  - 这描述的是“仓库中的模板落盘格式”
  - 不是“pin 上传输的数据格式”
- 所以本 iteration 必须显式区分：
  - template file format = authoritative patch
  - runtime payload format = temporary modeltable array

### 7. Existing Array Template Migration Points

- `packages/worker-base/system-models/templates/data_array_v0.json` 当前至少有两处必须迁移：
  1. payload 约定仍停留在旧 object/null 风格，需要改成临时模型表数组
  2. `func.js` 内把 `model_id: 2001` 写死

- Foundation C 的迁移策略冻结为：
  - 顶层 canonical template 仍可保留 example model id `2001` 作为 deterministic test anchor
  - 但 function bodies 不允许继续手写死 `2001`
  - 后续执行必须采用“模板 materialization 时注入 SELF_MODEL_ID”的方式，保证实例化到任意正数模型时可复用

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
    - 无 function-body `model_id=2001` 硬编码
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
