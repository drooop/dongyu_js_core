---
title: "Data Models Fill-Table Guide"
doc_type: user-guide
status: active
updated: 2026-04-06
source: ai
---

# Data Models Fill-Table Guide

本文档说明在当前新合同下，如何通过填表使用第一批正式数据模型：

- `Data.Array`
- `Data.Queue`
- `Data.Stack`

前提：
- 本地 pin 统一使用 `pin.in / pin.out`
- 数据通过 pin 传递时，值必须是“临时模型表数组”
- 动作语义由 pin 名称承担，不放进 payload 数据里

## 1. 三者共同结构

三类数据模型都采用相同的基本布局：

- D0，也就是 `(0,0,0)`：
  - `model_type`
  - `size_now`
  - `next_index`
  - 所有输入/输出 pin
  - 所有 `func.js`
  - 所有 `pin.connect.label`
- 数据行：
  - 默认放在 `(0,r,0)`，其中 `r >= 1`

这意味着：
- 页面/列布局不是重点
- 数据模型的差别主要来自 pin 名称和函数行为

## 2. Data.Array

### 输入 pin

- `add_data_in`
- `delete_data_in`
- `get_data_in`
- `get_all_data_in`
- `get_size_in`

### 输出 pin

- `get_data_out`
- `get_all_data_out`
- `get_size_out`

### 输入 payload 示例

新增一项：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "value", "t": "json", "v": "A" }
]
```

删除第 2 项：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "index", "t": "int", "v": 2 }
]
```

读取全部：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" }
]
```

### 输出 payload 示例

`get_data_out`：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "found", "t": "bool", "v": true },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "value", "t": "json", "v": "B" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "index", "t": "int", "v": 2 }
]
```

`get_all_data_out`：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "Data.ArrayResult" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "size", "t": "int", "v": 2 },
  { "id": 0, "p": 1, "r": 0, "c": 0, "k": "value", "t": "json", "v": "A" },
  { "id": 0, "p": 2, "r": 0, "c": 0, "k": "value", "t": "json", "v": "B" }
]
```

## 3. Data.Queue

### 输入 pin

- `enqueue_data_in`
- `dequeue_data_in`
- `peek_data_in`
- `get_all_data_in`
- `get_size_in`

### 输出 pin

- `dequeue_data_out`
- `peek_data_out`
- `get_all_data_out`
- `get_size_out`

### 语义

- `enqueue`：追加到尾部
- `dequeue`：从头部取出并删除
- `peek`：只看头部，不删除
- 顺序必须符合 FIFO

### `dequeue_data_out` 示例

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "found", "t": "bool", "v": true },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "value", "t": "json", "v": "A" }
]
```

## 4. Data.Stack

### 输入 pin

- `push_data_in`
- `pop_data_in`
- `peek_data_in`
- `get_all_data_in`
- `get_size_in`

### 输出 pin

- `pop_data_out`
- `peek_data_out`
- `get_all_data_out`
- `get_size_out`

### 语义

- `push`：压栈到尾部
- `pop`：从尾部取出并删除
- `peek`：只看栈顶，不删除
- 顺序必须符合 LIFO

### `pop_data_out` 示例

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "found", "t": "bool", "v": true },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "value", "t": "json", "v": "B" }
]
```

## 5. ack 策略

这三类数据模型当前不引入独立的通用 `ack` pin。

- 纯 mutation：
  - `add`
  - `delete`
  - `enqueue`
  - `push`
  成功与否主要看 committed state 是否变化
- 同时需要返回值的操作：
  - `dequeue`
  - `pop`
  直接通过对应 output pin 回传结果

## 6. 当前不做的事

本轮没有把这些能力一起做进去：

- `Flow` 模型
- `Data.LinkedList`
- `Data.CircularBuffer`
- 数据模型的 Gallery 可视化页面

原因很简单：
- 这轮先把新合同下的 canonical data templates 做稳
- UI 展示面可以放到后续单独迭代
