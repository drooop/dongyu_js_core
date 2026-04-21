---
title: "0249 — home-crud-pin-migration-retry-on-owner-materialization Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0249-home-crud-pin-migration-retry-on-owner-materialization
id: 0249-home-crud-pin-migration-retry-on-owner-materialization
phase: phase1
---

# 0249 — home-crud-pin-migration-retry-on-owner-materialization Resolution

## Strategy

0249 只做 Home 业务层对 `0248` owner-materialization runtime 的正式接入，不再重复修改 runtime 通用语义。

执行原则：

- 以 `0248` 为 runtime baseline；若 `test_0248_cross_model_pin_owner_materialization_contract.mjs` 先不绿，则 0249 不得继续。
- Home source 只 emit request，不 direct write target。
- target owner 自己 receive request 并 same-model materialize。
- `home_*` 一旦建立正式 pin path，server 不得 silently 回落到旧 dispatch-write 路径。
- 页面验证必须跑真实 `createServerState()`/SSE 闭环，不能用“改 snapshot”“手工写 label”替代。

## Expected Files

- `scripts/tests/test_0249_home_crud_pin_owner_materialization_contract.mjs`
- `packages/worker-base/system-models/intent_handlers_home.json`
- `packages/ui-model-demo-server/server.mjs`
- `packages/worker-base/system-models/workspace_positive_models.json`
- `packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs`

说明：

- `scripts/tests/test_0212_home_crud_contract.mjs`
- `scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs`
- `scripts/tests/test_0248_cross_model_pin_owner_materialization_contract.mjs`

这些现有测试默认作为回归守卫，优先保持不改；若执行中必须调整，runlog 必须先说明“为什么历史合同不足以表达 0249 的新边界”。

## Step 1 — Freeze 0249 RED Contract On Clean 0248 Baseline

### Goal

先用一份独立 focused contract test 把 0249 需要迁移的 source/request/owner 边界冻结出来，避免再次把 runtime、server、业务 patch 混成一个模糊问题。

### Planned Changes

- 新增 `scripts/tests/test_0249_home_crud_pin_owner_materialization_contract.mjs`
- 该测试至少要锁定以下 RED 事实：
  - `intent_handlers_home.json` 中 `handle_home_*` 仍存在 direct write `Model -2` / positive model 的代码形态。
  - 当前主线尚未保留 0246 试做过的 Home root `pin.table.in` / `pin.connect.label` contract。
  - `server.mjs` 当前 `submitEnvelope()` 仍以 dispatch table/running function 为 Home action 主路径。
  - `validate_home_crud_server_sse.mjs` 当前覆盖的是旧行为口径，需要在后续 Step 重写为 owner-materialization 口径。
- 该测试还要保留一组正向 guard，证明：
  - `test_0248_cross_model_pin_owner_materialization_contract.mjs` 已经为 0249 提供 green baseline。
  - `test_0212_home_crud_contract.mjs` 仍是 Home asset/action inventory 的历史合同，而不是 0249 source/owner 合同的替代品。

### Files

- `scripts/tests/test_0249_home_crud_pin_owner_materialization_contract.mjs`

### Verification Commands

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0248_cross_model_pin_owner_materialization_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0249_home_crud_pin_owner_materialization_contract.mjs
```

预期：

- 0248 baseline 先 PASS。
- 0249 新测试在 Step 1 结束时应为 RED，且失败点明确落在 “Home 仍未完成 source/request/owner 迁移”。

### Rollback

- 删除新增的 `scripts/tests/test_0249_home_crud_pin_owner_materialization_contract.mjs`

## Step 2 — Rebuild Home Source Pin Contract And Remove Direct Writes

### Goal

让 Home source (`Model -10`) 真正退回到 `0247` 规定的 source 职责：接 action、做最小校验、emit typed request；不再负责最终写表或写 UI owner state。

### Planned Changes

- 修改 `packages/worker-base/system-models/intent_handlers_home.json`
- 为 `home_refresh`、`home_select_row`、`home_open_create`、`home_open_edit`、`home_save_label`、`home_delete_label`、`home_view_detail`、`home_close_detail`、`home_close_edit` 建立正式 Home root input contract：
  - root `pin.table.in` label 声明
  - root `pin.connect.label`，把 `(self, home_*)` 接到对应 `handle_home_*:in`
- 把当前 `handle_home_*` 中直接 `ctx.writeLabel()` / `ctx.rmLabel()` 到 `Model -2` 或 positive model 的逻辑改为 typed request emission，request 语义至少覆盖 `0247` 冻结字段：
  - `op`
  - `target_model_id`
  - `target_cell`
  - `label`
  - `origin`
  - `request_id`
  - `ts`
- 对 `home_open_create` / `home_open_edit` / `home_select_row` / `home_view_detail` / `home_close_*` 这类 UI-state action，同样要走 request emission；不能因为 target 是 `Model -2` 就继续保留 source direct write。
- 修改 `packages/ui-model-demo-server/server.mjs`
  - 对 `home_*` 建立 authoritative pin submit path。
  - Home pin path 建立后，不得在 pin route 失败时静默回落到旧 `intent_dispatch_table -> run_func` 路径。
  - 如需保留 dispatch table 仅作 action inventory/LLM intent registry，必须保证其不再承担 Home CRUD 的 authoritative write path。

### Files

- `packages/worker-base/system-models/intent_handlers_home.json`
- `packages/ui-model-demo-server/server.mjs`
- `scripts/tests/test_0249_home_crud_pin_owner_materialization_contract.mjs`

### Verification Commands

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0249_home_crud_pin_owner_materialization_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs
```

预期：

- 0249 focused contract 测试从 “source 仍 direct write / 没有 Home pin contract” 变为 “source contract 已建立，且 server authoritative path 已切到 Home pin”。
- `0212` 历史合同继续绿色，证明 Home UI action inventory 没被迁移工作误删。

### Rollback

- 回退 `intent_handlers_home.json` 中新增的 Home root pin 声明、wiring 与 request-emitter 改造
- 回退 `server.mjs` 中 Home action 的 authoritative pin submit path

## Step 3 — Add Target-Owner Receive/Materialize Paths For `Model -2` And Bootstrap Positive Models

### Goal

把 0248 的 runtime 能力真正落到 Home 业务 owner 上，使 `Model -2` 与本地 Home 验证覆盖到的正数模型都能自己接 request 并 same-model materialize。

### Planned Changes

- 修改 `packages/worker-base/system-models/intent_handlers_home.json`
  - 为 `Model -2` 增加 owner-side receive/materialize patch，覆盖：
    - `selected_model_id`
    - `draft_*`
    - `dt_edit_*`
    - `dt_detail_*`
    - `home_form_mode`
    - `home_status_text`
  - target-side 必须自己校验 request shape，并把失败 deterministic surface 到可审计位置；不得要求 source 代写 owner error/status。
- 修改 `packages/worker-base/system-models/workspace_positive_models.json`
  - 为本地 Home selector 可见、且页面验证会真实触达的 bootstrap positive models 增加 owner-side input/wiring/materializer。
  - 至少覆盖 `validate_home_crud_server_sse.mjs` 当前使用的 `model_id=1003` create/edit/delete 场景。
  - 对 remove path 必须通过 owner-side `rmLabel` materialize，而不是恢复 source direct remove。
- 若 Step 2/3 需要在 `server.mjs` 写入更明确的 request envelope 或 target root input key，必须保持：
  - source emit 的 payload 与 0247 request envelope 兼容；
  - target receive 后由 owner function 自己执行最终 `addLabel/rmLabel`；
  - `0245` direct-access guard 不被削弱。

### Files

- `packages/worker-base/system-models/intent_handlers_home.json`
- `packages/worker-base/system-models/workspace_positive_models.json`
- `packages/ui-model-demo-server/server.mjs`
- `scripts/tests/test_0249_home_crud_pin_owner_materialization_contract.mjs`

### Verification Commands

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0249_home_crud_pin_owner_materialization_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0248_cross_model_pin_owner_materialization_contract.mjs
```

预期：

- 0249 focused contract 测试变绿，证明 Home 已有 source-only emit + target-owner materialize 的正式链路。
- 0245 回归继续绿色，证明这次迁移没有通过放宽 privilege 作弊。
- 0248 回归继续绿色，证明 Home 业务层消费的仍是 canonical runtime path。

### Rollback

- 回退 `intent_handlers_home.json` 中 `Model -2` owner-side receive/materialize 逻辑
- 回退 `workspace_positive_models.json` 中新增的 owner-side input/wiring/materializer
- 回退 `server.mjs` 中任何为 Step 3 引入的 request-envelope/root-input 适配

## Step 4 — Prove Real Local Home CRUD And Preserve Local-Only Guards

### Goal

在真实本地 server/runtime 闭环中证明 Home 页面 create/edit/delete 通过，同时保留 local adapter 不可直接越层写业务模型的 guard。

### Planned Changes

- 修改 `packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`
  - 不再只验证旧 dispatch 结果，而是显式验证：
    - `home_open_create` 能通过 owner-side state materialization 打开编辑态
    - `home_save_label` create/edit 通过 owner-side positive-model materialization 生效
    - `home_delete_label` 通过 owner-side remove materialization 生效
    - 整个过程中没有 `direct_access_cross_model_forbidden`、`direct_model_mutation_disabled` 等回退式错误
- 审查 `packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs`
  - 默认预期保持 “Home local mode 仍 remote-only” 的 guard。
  - 若 execution 发现此 guard 必须调整，必须在 runlog 先写明：为什么这不会重新引入 local direct mutation。
- 如 Step 2/3 变更影响现有 Home surface 入口，补充必要断言，确保 `root_home` 页面与 CRUD controls 仍按 `0212/0235` 合同 materialize。

### Files

- `packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs`
- `scripts/tests/test_0249_home_crud_pin_owner_materialization_contract.mjs`（如需补齐页面级 contract 断言）

### Verification Commands

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0235_home_surface_contract.mjs
```

预期：

- server/SSE 验证真实完成 create/edit/delete。
- local adapter guard 仍保持可解释结论。
- Home surface 没因 pin migration 丢失 `root_home` 或 CRUD 控件。

### Rollback

- 回退 `validate_home_crud_server_sse.mjs` 中新增的 owner-materialization 断言
- 若 `validate_home_crud_local.mjs` 被调整，回退到当前 remote-only guard 版本
- 回退本 step 为 Home surface 稳定性补加的断言

## Final Verification Set

Phase 3 完成时，最少应保留以下 PASS 证据：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0235_home_surface_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0248_cross_model_pin_owner_materialization_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0249_home_crud_pin_owner_materialization_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs
```

## Overall Rollback Plan

- 删除 `scripts/tests/test_0249_home_crud_pin_owner_materialization_contract.mjs`
- 回退 `intent_handlers_home.json` 中所有 Home source pin contract 与 owner-side materializer 改动
- 回退 `server.mjs` 中 Home authoritative pin submit path 与 request-envelope 适配
- 回退 `workspace_positive_models.json` 中为本地 Home CRUD 添加的 owner-side input/wiring/materializer
- 回退 `validate_home_crud_server_sse.mjs` / `validate_home_crud_local.mjs` 的 0249 验证口径改动
- 回退后必须至少重新跑：
  - `node scripts/tests/test_0212_home_crud_contract.mjs`
  - `node scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs`
  - `node scripts/tests/test_0248_cross_model_pin_owner_materialization_contract.mjs`

## Non-Goals

- 不在 0249 重新打开 runtime capability 设计讨论；0247/0248 已冻结并实现最小通路
- 不把 Home local demo mode 变成 direct local CRUD
- 不在 0249 处理 formal response path、跨页面通用 owner framework、或任意新建 positive model 的泛化支持
