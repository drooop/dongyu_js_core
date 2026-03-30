---
title: "0248 — cross-model-pin-owner-materialization-runtime-and-regression Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-03-26
source: ai
iteration_id: 0248-cross-model-pin-owner-materialization-runtime-and-regression
id: 0248-cross-model-pin-owner-materialization-runtime-and-regression
phase: phase1
---

# 0248 — cross-model-pin-owner-materialization-runtime-and-regression Resolution

## Strategy

0248 只做 runtime capability + focused regression，使 `0247` 冻结的 canonical path 在现有 pin 体系内成立：

```text
source func result
  -> source model output pin
  -> pin.connect.model
  -> target model input pin
  -> target owner same-model materialization
```

执行原则：

- 不恢复 cross-model direct write
- 不新增 mailbox fallback
- 不把 0249 的 Home 业务 patch 混进 0248
- 以 `packages/worker-base/src/runtime.mjs` 为唯一语义实现点
- 通过现有 CJS 测试入口验证 `runtime.js` shim 仍然工作

## Expected Files

- `packages/worker-base/src/runtime.mjs`
- `scripts/tests/test_0248_cross_model_owner_materialization_runtime_contract.mjs`
- `scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs`
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/ssot/label_type_registry.md`

说明：

- `packages/worker-base/src/runtime.js` 当前只是 shim；默认不应有语义改动
- `docs/ssot/label_type_registry.md` 仅在 wording 落后于实现时更新；若无需改动，runlog 必须写明 review 结论

## Step 1 — Add RED Focused Contract Test

### Goal

先用一份独立 regression 把 0248 的最小合同写成 RED，避免实现阶段把 capability gap 与业务 patch 混在一起。

### Planned Changes

- 新增 `scripts/tests/test_0248_cross_model_owner_materialization_runtime_contract.mjs`
- 在测试中搭出最小模型图：
  - source model root `pin.table.out` 或 `pin.single.out`
  - `Model 0` 上的 `pin.connect.model`
  - target owner model root `pin.table.in` 或 `pin.single.in`
  - target owner model 内部 `pin.connect.cell` / `pin.connect.label` / `func.js`
- 断言以下事实：
  - source handler 返回 typed request
  - request 目前尚未从 source output 进入 `pin.connect.model`，从而先得到 RED
  - 目标模型只有在 request 到达后才会 materialize
  - source model 对 target label 的 direct write 仍被拒绝

### Files

- `scripts/tests/test_0248_cross_model_owner_materialization_runtime_contract.mjs`

### Verification Commands

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0248_cross_model_owner_materialization_runtime_contract.mjs
```

预期：

- 在 Step 1 完成时，此测试应为 RED，且失败点明确落在 source output 未进入 `pin.connect.model`

### Rollback

- 删除新增的 `scripts/tests/test_0248_cross_model_owner_materialization_runtime_contract.mjs`

## Step 2 — Extend Source Output To `pin.connect.model`

### Goal

补齐 source model output 到 `pin.connect.model` 的 runtime 触发点，使 route 不再只对 `Model 0 pin.bus.in` 生效。

### Planned Changes

- 修改 `packages/worker-base/src/runtime.mjs`
- 让 source model 的 `pin.table.out` / `pin.single.out` 在保留现有 parent-hosting-cell 传播语义的同时，也能进入 `_routeViaModelConnection(model.id, label.k, label.v)`
- 保持 `pin.connect.model` 仍只负责路由，不在路由层做业务 materialization
- 不引入新的 cross-model 直写 helper，不绕过 `_assertScopedDirectAccess()`

### Files

- `packages/worker-base/src/runtime.mjs`

### Verification Commands

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0248_cross_model_owner_materialization_runtime_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_model_in_out.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_submodel_connect.mjs
```

预期：

- 0248 新测试从 “source output 不可达” 变为 “request 已到达 target input”
- 原有 model in/out 与 submodel routing 回归保持绿色

### Rollback

- 回退 `packages/worker-base/src/runtime.mjs` 中新增的 source-output model-route 触发逻辑

## Step 3 — Prove Target-Owned Materialization Without Bypass

### Goal

证明 target owner path 可以在 same-model scope 内完成 materialization，同时 `0245` direct write 禁令不被削弱。

### Planned Changes

- 继续完善 `scripts/tests/test_0248_cross_model_owner_materialization_runtime_contract.mjs`
- 如有必要，对 `packages/worker-base/src/runtime.mjs` 做最小修正，确保 target root input 进入 owner path 后，最终 `addLabel` / `rmLabel` 发生在 target model 自己的函数上下文内
- 保持 source 侧只 emit request，不新增 target mutation 特权
- 不修改 Home、Prompt、UI server 等业务层代码

### Files

- `scripts/tests/test_0248_cross_model_owner_materialization_runtime_contract.mjs`
- `packages/worker-base/src/runtime.mjs`
- `scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs`（仅当需要补强回归断言时）

### Verification Commands

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0248_cross_model_owner_materialization_runtime_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs
```

预期：

- target owner materialization 成功
- source 直写 target 仍报 `direct_access_cross_model_forbidden` 或同等边界错误

### Rollback

- 回退 0248 新增/修改的 regression 断言
- 回退 runtime 中任何可能削弱 `_assertScopedDirectAccess()` 约束的改动

## Step 4 — Living Docs Review And Focused Regression Closure

### Goal

完成 `CLAUDE.md` 要求的 living docs review，并在 focused regression 通过后冻结 0248 的 execution 收口口径。

### Planned Changes

- 审查 `docs/ssot/runtime_semantics_modeltable_driven.md` 是否已准确描述：
  - source model output 可进入 `pin.connect.model`
  - target owner input receive 后由 target 自己 materialize
- 审查 `docs/ssot/label_type_registry.md` 是否需要补 wording，说明本次没有新增 `label.t`
- 运行 builtins / loader 级验证，确保 route 注册与 allowlist 不回退

### Files

- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/ssot/label_type_registry.md`

### Verification Commands

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/validate_builtins_v0.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/validate_program_model_loader_v0.mjs --case connect_allowlist
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "pin\\.connect\\.model|pin\\.table\\.out|pin\\.single\\.out|target-owned materialization" docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/label_type_registry.md
```

预期：

- builtins validation 绿色
- program model loader 的 connect allowlist 绿色
- docs review 有明确结果：已更新或确认无需更新

### Rollback

- 回退本 iteration 新增的 SSOT wording
- 若 docs review 结论为“无需更新”，则确保无多余文档改动进入提交

## Final Verification Set

Phase 3 完成时，最少应保留以下 PASS 证据：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0248_cross_model_owner_materialization_runtime_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_model_in_out.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_submodel_connect.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/validate_builtins_v0.mjs
```

## Overall Rollback Plan

- 删除 0248 新增的 focused regression 文件
- 回退 `packages/worker-base/src/runtime.mjs` 中与 source-output model-route 相关的新增逻辑
- 回退 0248 引入的 SSOT wording 调整
- 保持 `0245` 已交付的 scoped privilege 行为与 `0247` 已冻结的 contract 文档不变

## Non-Goals

- 不在 0248 内恢复 `0246` 的 Home CRUD 迁移
- 不在 0248 内定义 response path 或 UI feedback 收口
- 不在 0248 内新增 server/frontend 业务逻辑
