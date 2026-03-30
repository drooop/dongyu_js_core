---
title: "0158 — Runtime 新 label.t 支持 + 兼容层"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0158-runtime-new-label-types
id: 0158-runtime-new-label-types
phase: phase1
---

# 0158 — Runtime 新 label.t 支持 + 兼容层

## 0. Goal

在 `runtime.mjs` 中实现新 PIN 体系 label.t 解释，同时保留旧 label.t 兼容期行为，保证现有链路不回归。

## 1. Scope

- In scope:
  - `_applyBuiltins` 增加 alias map：旧类型映射到新类型统一分发。
  - 新增/适配：`pin.in/out`、`pin.model.in/out`、`pin.bus.in/out`、`pin.log.*`、`pin.connect.label/cell/model`、`func.js`、`func.python`、`submt`。
  - 函数值兼容：支持 `v` 为 string（兼容）与 `{code, modelName}`（新格式）。
  - 连接值兼容：旧 `CELL_CONNECT` map 格式 + 新数组 `{from,to}` 格式并存。
  - 增加 0158 专项测试（新 label + 函数值兼容 + model connect 路由）。
- Out of scope:
  - system-models/deploy JSON 全量迁移（0160）。
  - server/worker 层适配（0161）。
  - 兼容层清理（0163）。

## 2. Constraints

- 仅改 runtime 与测试，不改业务逻辑。
- pin.model.* 不处理 `model_id=0`，`model_id=0` 只允许 pin.bus.* 外部出入口。
- 必须保持旧测试通过，且新增测试覆盖新语义。

## 3. Success Criteria

- 旧 label.t 测试全绿（兼容生效）。
- 新 label.t 覆盖测试全绿。
- `func.js` 结构化 `value` 可执行。
- `pin.connect.model` 跨模型路由可验证。
