---
title: "Foundation C Data Models Design"
doc_type: plan
status: active
updated: 2026-04-06
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
- `Array / Queue / Stack` 的区别主要体现在：
  - 数据排列语义
  - 读写函数行为
  - 查询返回顺序

## Output

`0296` 应给后续执行者一套无需猜测的正式计划：
- 模板放哪
- 测试怎么写
- 文档怎么补
- Gallery 是否需要最小展示入口
