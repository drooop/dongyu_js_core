---
title: "0247 — cross-model-pin-owner-materialization-contract-freeze Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0247-cross-model-pin-owner-materialization-contract-freeze
id: 0247-cross-model-pin-owner-materialization-contract-freeze
phase: phase1
---

# 0247 — cross-model-pin-owner-materialization-contract-freeze Plan

## Metadata

- ID: `0247-cross-model-pin-owner-materialization-contract-freeze`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch: `dropx/dev_0247-cross-model-pin-owner-materialization-contract-freeze`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0245-scoped-privilege-runtime-and-regression`
  - `0246-home-crud-pin-migration-pilot`

## WHAT

0247 只冻结一个新 contract：

- 当 handler 运行在 `Model -10` 或其他中间模型上，且 `0245` 已禁止其 cross-model direct write 时，
- 如何通过 `func:out -> pin.connect.model -> target model pin.model.in / pin.table.in / pin.single.in`
- 把“写入请求”发给目标模型
- 再由目标模型**自己**完成 owner materialization

## WHY

`0246` 已经证明：

- Home pin path 可以到达 `Model -10`
- 但旧 handler 仍试图直接跨模型写 `Model -2` / positive model
- `0245` 正确把这条路拦下来了

所以缺的已经不是 scoped privilege，而是：

- 一条正式的 cross-model pin-mediated owner materialization contract

## Success Criteria

- 解释清楚：
  - 写入请求长什么样
  - 谁负责发出
  - 谁负责接收
  - 谁负责最终 `addLabel/rmLabel`
- 明确：
  - `Model -10` 不再直接 cross-model write
  - 目标模型必须自己 materialize
- 明确下游 implementation 需要改哪些 runtime / patch / tests
- 给出 Home CRUD 场景下的自洽推导
- 形成一份独立设计稿，供后续 `0248+` implementation 消费

## Contract Decisions

### 1. Core Rule

- cross-model direct write 不存在
- 存在的是：
  - cross-model write request
  - target-owned materialization

### 2. Canonical Route

唯一推荐 route：

1. source func/handler 组装 typed request
2. 从 `func:out` 发出
3. 通过 `pin.connect.model` 路由到 target owner pin input
4. target model 自己执行 `addLabel/rmLabel`

### 3. Source Responsibilities

source model 只负责：

- validate input
- build request envelope
- emit request

source model 不负责：

- 直接写 target labels
- 直接删除 target labels

### 4. Target Responsibilities

target model 必须：

- 接收 request
- 校验 owner scope
- 执行最终 materialization
- 记录 deterministic failure

### 5. Hard Boundary

- cross `model_id`: `PIN-only`
- cross `model.submt`: `PIN-only`
- scoped privilege 不得作为 cross-model bypass

## Artifacts

- Design draft:
  - `docs/plans/2026-03-26-cross-model-pin-owner-materialization-design.md`
- Iteration contract:
  - `docs/iterations/0247-cross-model-pin-owner-materialization-contract-freeze/plan.md`
  - `docs/iterations/0247-cross-model-pin-owner-materialization-contract-freeze/resolution.md`
  - `docs/iterations/0247-cross-model-pin-owner-materialization-contract-freeze/runlog.md`
