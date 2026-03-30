---
title: "0248 — cross-model-pin-owner-materialization-runtime-and-regression Plan"
doc_type: iteration-plan
status: completed
updated: 2026-03-26
source: ai
iteration_id: 0248-cross-model-pin-owner-materialization-runtime-and-regression
id: 0248-cross-model-pin-owner-materialization-runtime-and-regression
phase: phase1
---

# 0248 — cross-model-pin-owner-materialization-runtime-and-regression Plan

## Metadata

- ID: `0248-cross-model-pin-owner-materialization-runtime-and-regression`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch: `dropx/dev_0248-cross-model-pin-owner-materialization-runtime-and-regression`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0245-scoped-privilege-runtime-and-regression`
  - `0247-cross-model-pin-owner-materialization-contract-freeze`

## WHAT

0248 只实现 `0247` 已冻结合同所需的最小 runtime 能力，使一条合法的 cross-model owner materialization 链路成立：

- source model 的 handler 产出 typed request
- request 能从 source output pin 进入 `pin.connect.model`
- request 能到达 target owner model 的 input pin
- target owner model 继续在自己的模型边界内执行最终 materialization
- `0245` 已冻结的 cross-model direct write 禁令保持不变

本 iteration 只覆盖 runtime 与 focused regression，不混入 Home CRUD、mailbox fallback、UI response path 或业务 patch 迁移。

## WHY

`0245` 已经把 cross-model direct write 正确判定为违规行为，`0247` 也已经明确系统不应恢复 direct write，而应采用：

```text
source emit typed request
  -> pin.connect.model
  -> target owner input pin
  -> target-owned materialization
```

当前 codebase 已具备三段基础能力，但缺一条完整闭环：

- `ctx.writeLabel()` / `ctx.rmLabel()` 已受 `_assertScopedDirectAccess()` 约束，cross-model direct write 会被拒绝
- `pin.connect.model` 已能注册 route，但当前 runtime 只在 `Model 0 pin.bus.in` 写入时触发 `_routeViaModelConnection()`
- target model 的 `pin.table.in` / `pin.single.in` 已能把 payload 送入目标模型内部的 `pin.connect.cell` / `pin.connect.label`

因此 0248 的问题不是“是否允许跨模型直写”，而是“source output 如何合法进入跨模型 route，并让 target owner 自己 materialize”。

## Problem Statement

如果 0248 不补这段 runtime capability，则系统会停留在以下不完整状态：

- source handler 可以被触发
- source handler 不能 cross-model direct write
- target owner input pin 可以接收来自 `Model 0` 的 model route
- 但 source model 自己发出的 request 还不能稳定进入 `pin.connect.model`

这会使 `0247` 合同只停留在文档层，而无法被 `0249` 或其他业务 patch 消费。

## In Scope

- `packages/worker-base/src/runtime.mjs` 中与 source output、`pin.connect.model`、target model input dispatch 相关的最小语义补齐
- 针对 cross-model owner materialization 的最小 RED -> GREEN regression
- 对 `0245` cross-model direct write 禁令的回归保护
- 对 living docs 的审查与按需更新，范围限定为 PIN routing / model routing / target owner materialization 语义

## Out Of Scope

- `0249` Home CRUD pin migration
- 任何 mailbox 恢复、compatibility fallback 或 direct write 豁免
- 新的 `label.t`、新的跨模型捷径 API、或新的外部入口
- UI response path、status projection patch 的完整业务收口
- 非本能力所必需的 server / frontend 改动

## Constraints And Assumptions

- 必须遵循 `CLAUDE.md` 的 `HARD_RULES`、`CAPABILITY_TIERS`、`WORKFLOW`
- 0248 的 execution 只能在 `Approved` 之后进入 Phase 3；当前 Phase 1 只产出计划文档
- cross-model communication 仍为 `PIN-only`
- 最终 `addLabel` / `rmLabel` 只能由 target owner model 自己执行
- 采用现有 pin payload 传递 typed request envelope，默认不新增新的结构性 `label.t`
- `packages/worker-base/src/runtime.js` 当前只是 CJS shim，语义实现以 `packages/worker-base/src/runtime.mjs` 为准；CJS 调用方通过现有 tests 继续覆盖

## Codebase Impact Scope

### Runtime Core

- `packages/worker-base/src/runtime.mjs`
  - `_executeFuncViaCellConnect()`：source handler 的返回值如何成为可路由的 request payload
  - `_routeViaModelConnection()` / `_parseModelConnectionLabel()`：已有跨模型 route 表
  - `pin.table.out` / `pin.single.out` 分支：当前只通知 parent hosting cell，尚未显式进入 `pin.connect.model`
  - `pin.table.in` / `pin.single.in` 分支：当前已具备 target owner input receive 的基础能力
  - `_assertScopedDirectAccess()`：继续作为 direct write 禁令的守门人

### Regression Surface

- 现有最接近的验证面：
  - `scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs`
  - `scripts/tests/test_model_in_out.mjs`
  - `scripts/tests/test_submodel_connect.mjs`
  - `scripts/validate_builtins_v0.mjs`
  - `scripts/validate_program_model_loader_v0.mjs`
- 0248 需要新增一份 focused runtime contract test，覆盖：
  - source emit typed request
  - `pin.connect.model` route 生效于 source model output
  - target owner input 收到 request
  - target owner same-model materialization 成功
  - cross-model direct write 仍失败

### Living Docs Review

- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/ssot/label_type_registry.md`

预期重点不是新增类型，而是核对现有文档是否已经准确描述 “source model output 进入 `pin.connect.model`” 这一 runtime 语义；若未准确描述，则 execution 时必须补正文档。

## Success Criteria

- source handler 可以通过现有 pin output 产出 typed request，而不是 cross-model direct write
- `pin.connect.model` 可以消费来自 source model output 的 payload，而不仅仅是 `Model 0 pin.bus.in`
- target owner model root input pin 能收到 request，并把 request 继续送入目标模型内部 owner path
- target owner path 能在 same-model scope 内完成 `addLabel` / `rmLabel`
- `test_0245_scoped_privilege_runtime_contract.mjs` 保持绿色，证明 direct write 禁令未被绕过
- focused regression 与 builtins validation 绿色
- living docs review 有明确结论：已更新或确认无需更新

## Risks

- 如果把 0248 实现成 source 直接写 target label，则会直接违反 `0245` 与 `0247`
- 如果为 0248 引入新的跨模型 helper API，而不是复用现有 pin route，会扩大能力面并污染后续业务迁移
- 如果只修测试、不修 runtime route 触发点，`pin.connect.model` 仍会停留在“注册存在但 source output 不可达”的假闭环
- 如果遗漏对 `0245` 的回归验证，后续可能以“功能跑通”为名重新引入 non-conformant bypass
