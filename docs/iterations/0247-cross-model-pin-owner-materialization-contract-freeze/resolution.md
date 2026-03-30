---
title: "0247 — cross-model-pin-owner-materialization-contract-freeze Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-03-26
source: ai
iteration_id: 0247-cross-model-pin-owner-materialization-contract-freeze
id: 0247-cross-model-pin-owner-materialization-contract-freeze
phase: phase1
---

# 0247 — cross-model-pin-owner-materialization-contract-freeze Resolution

## Strategy

0247 只做 contract freeze，不进入 runtime / Home 代码实现。

本 iteration 的执行原则：

1. 先把 `0246` 暴露的问题重写成单一 capability gap
2. 明确 source/route/target 各自职责
3. 冻结 owner materialization 的 canonical path
4. 把 future implementation surface 列清，不在本 iteration 内混入 runtime patch

## Steps

| Step | Name | Goal | Output |
|---|---|---|---|
| 1 | Freeze problem statement | 把 0246 暴露的 capability gap 写成单一问题定义 | `plan.md` 问题定义一致 |
| 2 | Freeze owner materialization contract | 明确 request shape / source / target / ownership | 独立设计稿 + resolution 规则节 |
| 3 | Freeze routing contract | 明确 `func:out -> pin.connect.model -> target pin.in` 的边界 | canonical route 冻结 |
| 4 | Define downstream implementation surface | 列出后续实现应改的 runtime/patch/tests | implementation checklist |

## Frozen Contract

### A. Problem Definition

`0246` 的 blocker 不是 pin route 不通，而是：

- source handler 已被正确触发
- 但旧 handler 仍试图 cross-model direct write
- `0245` 会正确拒绝这种行为

因此系统缺的是：

- cross-model pin-mediated owner materialization

### B. Canonical Path

冻结为：

```text
source func:out
  -> pin.connect.model
  -> target pin.model.in / pin.table.in / pin.single.in
  -> target-owned materialization
  -> addLabel / rmLabel on target model
```

### C. Request Envelope Semantics

最小语义字段：

- `op`
  - `add_label`
  - `rm_label`
- `target_model_id`
- `target_cell`
  - `{ p, r, c }`
- `label`
  - add path: `{ k, t, v }`
  - rm path: `{ k }`
- `origin`
  - source `model_id`
  - source cell
  - optional source action
- `request_id`
- `ts`

0247 冻结语义，不冻结最终 label key 名或最终 envelope label placement。

### D. Source Contract

source model 允许：

- local validation
- request emission
- same-model local status/state maintenance

source model 不允许：

- direct write target labels
- direct rm target labels
- 以 scoped privilege 绕过 cross-model boundary

### E. Target Contract

target model 必须：

- 提供正式 input pin
- 校验 request shape
- 校验 owner scope
- 自己执行最终 materialization
- 将失败 deterministically surface 到 target-side status/error 面

### F. Failure Contract

至少需要这些 failure kinds：

- `invalid_request_shape`
- `target_owner_missing`
- `target_scope_rejected`
- `unsupported_op`
- `target_materialization_failed`

### G. Home CRUD Sanity Check

Home CRUD 写正数模型时：

- Home/source model 不能直接写 positive model
- 也不能直接写 `Model -2`
- 正确链路应是：
  - Home 发 request
  - target owner model 自己 materialize
  - 如需 UI feedback，再走单独 formal response path

## Downstream Implementation Surface

### Runtime

- source `func:out` envelope typing / transport
- `pin.connect.model` route consumption
- target pin input receive path
- owner materialization helper / contract hooks

### Patch Surface

- source handler patch
- target owner receive/materialize patch
- target status/error projection patch

### Regression Surface

- source direct write forbidden remains green
- source can emit typed request
- request reaches target owner input pin
- target owner performs `addLabel / rmLabel`
- target deterministic failure surfaces remain auditable

## Non-Goals

- 不在 0247 直接实现 runtime API
- 不在 0247 继续推进 0246 experimental patch
- 不在 0247 冻结所有 response-path 细节
