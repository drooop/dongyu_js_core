---
title: "Temporary ModelTable Payload v1"
doc_type: ssot
status: active
updated: 2026-04-06
source: ai
---

# Temporary ModelTable Payload v1

## Purpose

本文档把外部 Feishu 文档中的“临时模型表”数据定义搬入 repo，作为后续基础迁移与实现的仓内权威版本。

来源：
- `https://bob3y2gxxp.feishu.cn/wiki/SgPHwHGrwi5xT5kEIGQccBkcn7c`

说明：
- 外部 Feishu 文档是来源。
- 自本文件落盘后，repo 版本作为后续实现与迁移的执行权威。
- 本文件只定义 payload 本身，不定义接收方应执行的业务动作。

## 1. Core Shape

临时模型表 payload 是一个 JSON 数组。  
数组中的每一项都是一条“临时模型表记录”，基础字段如下：

```json
{
  "id": 0,
  "p": 0,
  "r": 0,
  "c": 0,
  "k": "model_type",
  "t": "model.single",
  "v": "Data.Single"
}
```

字段含义：

- `id`
  - 临时模型 id
  - 作用域只在当前 payload 内
  - 不是仓库运行时中的正式 `model_id`
- `p`
  - page / plane 索引
- `r`
  - row
- `c`
  - column
- `k`
  - label key
- `t`
  - label type
- `v`
  - label value

## 2. Key Constraint

payload 只表达“临时模型表数据”。  
payload 内不再承载 `action` 字段来表达“增删改查动作”。

也就是说：

- payload = 数据
- 动作语义 = 由接收它的程序模型 / pin 名称决定

## 3. Imported Feishu Evidence

Feishu 原文中已经给出多组示例，且这些示例都符合上述形态：

- `Array.add_data:in`
- `Array.delete_data:in`
- `Queue.add_data:in`
- `Stack.add_data:in`
- `FlowTicket.new_ticket:in`
- `FlowTicket.find_by_id:in`

这些示例有两个关键信号：

1. 输入数据本体是记录数组，而不是 envelope 对象  
2. 动作由 pin 名称表达，例如：
   - `add_data:in`
   - `delete_data:in`
   - `find_by_id:in`

## 4. Canonical Examples

### 4.1 Single Record Model Payload

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "参数1", "t": "str", "v": "hello" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "参数2", "t": "int", "v": 123 }
]
```

### 4.2 Table-Like Payload

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "Data" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "ticket_id", "t": "str", "v": "" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "column", "t": "int", "v": 0 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "ticket_step", "t": "int", "v": 5 },
  { "id": 0, "p": 0, "r": 0, "c": 1, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 1, "k": "参数1", "t": "str", "v": "hello" },
  { "id": 0, "p": 0, "r": 0, "c": 1, "k": "参数2", "t": "int", "v": 123 }
]
```

说明：
- 当前 imported source 中仍有少数示例值缺失、字段未加引号等不完整文本。
- repo 权威版本以“字段结构”与“动作不在 payload 中”这两个核心约束为准。

## 5. Explicit Non-Goals

本文件当前不定义：

- 记录数组如何 materialize 到正式运行时模型
- `id` 与正式 `model_id` 的映射算法
- 程序模型收到 payload 后如何执行 add/update/delete
- `MBR` / MQTT / Matrix 如何编码该 payload

这些内容由：
- [[docs/ssot/program_model_pin_and_payload_contract_vnext]]
- 以及 `foundation B` 迁移实现迭代  
继续定义。
