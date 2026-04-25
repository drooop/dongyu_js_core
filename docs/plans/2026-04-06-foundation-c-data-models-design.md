---
title: "Foundation C Data Models Design"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Foundation C Data Models Design

## Goal

在 `0292` 与 `0294` 之后，正式把“数据模型先行”落到可执行路线里。

## Current State

- `0292` 已冻结新 pin/payload 合同。
- `0294` 已把主路径切到新合同。
- `0190` 已有 `Data.Array` 首版模板，但需要在新合同下重新校准。

## Options

### A. 只迁 `Data.Array`

- 最稳，但过于保守。

### B. 迁 `Data.Array`，并补 `Data.Queue / Data.Stack`

- 最适合当前阶段。
- 可以一次形成第一批“数据模型族”。

### C. 先做 shared helper 再做多个模型

- 不推荐。
- 容易回到系统 helper / 隐式依赖路线。

## Recommendation

推荐 **B**：
- 先把 `Data.Array` 迁到新合同；
- 再以同样合同落 `Queue / Stack`；
- 不扩到 `Flow`、`LinkedList`、`CircularBuffer`。

## Design Notes

- 三者统一使用：
  - `pin.in / pin.out`
  - 临时模型表 payload
  - 正数模型中的自包含模板
- 三者统一布局：
  - D0 `(0,0,0)` 放 `model_type`、metadata、pins、functions、routes
  - 数据元素默认放在 `(0,r,0)`，其中 `r >= 1`
- 三者的区别主要体现在：
  - pin naming
  - mutation / query 行为
  - 返回顺序

## Shared Contract

### Pin Naming

- `Data.Array`
  - `add_data_in`
  - `delete_data_in`
  - `get_data_in`
  - `get_all_data_in`
  - `get_size_in`
  - `get_data_out`
  - `get_all_data_out`
  - `get_size_out`
- `Data.Queue`
  - `enqueue_data_in`
  - `dequeue_data_in`
  - `peek_data_in`
  - `get_all_data_in`
  - `get_size_in`
  - `dequeue_data_out`
  - `peek_data_out`
  - `get_all_data_out`
  - `get_size_out`
- `Data.Stack`
  - `push_data_in`
  - `pop_data_in`
  - `peek_data_in`
  - `get_all_data_in`
  - `get_size_in`
  - `pop_data_out`
  - `peek_data_out`
  - `get_all_data_out`
  - `get_size_out`

### Payload

- 输入输出都统一用临时模型表数组。
- 0 参数操作也不使用 `null`，而使用最小 `Data.Single` 数组。

### Ack

- 不引入通用 ack pin。
- 纯 mutation 成功以 committed state 为准。
- `dequeue / pop` 通过各自 output pin 返回值。

### Existing Array Migration Points

- `0190` 的 `Data.Array` 旧模板必须显式处理两件事：
  - checked-in 模板文件仍是 authoritative patch wrapper，这一层与运行时 payload 不是一回事
  - `func.js` 中 `model_id: 2001` 的硬编码必须改成可 materialize 的 `SELF_MODEL_ID` 注入策略

## Output

`0296` 应给后续执行者一套无需猜测的正式计划：
- 模板放哪
- 测试怎么写
- 文档怎么补
- Gallery 是否需要最小展示入口
