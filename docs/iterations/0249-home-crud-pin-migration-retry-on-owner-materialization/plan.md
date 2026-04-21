---
title: "0249 — home-crud-pin-migration-retry-on-owner-materialization Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0249-home-crud-pin-migration-retry-on-owner-materialization
id: 0249-home-crud-pin-migration-retry-on-owner-materialization
phase: phase1
---

# 0249 — home-crud-pin-migration-retry-on-owner-materialization Plan

## Metadata

- ID: `0249-home-crud-pin-migration-retry-on-owner-materialization`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch: `dropx/dev_0249-home-crud-pin-migration-retry-on-owner-materialization`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0243-home-mailbox-crud-for-filltable`
  - `0246-home-crud-pin-migration-pilot`
  - `0247-cross-model-pin-owner-materialization-contract-freeze`
  - `0248-cross-model-pin-owner-materialization-runtime-and-regression`

## WHAT

0249 在 `0248` 已完成的 runtime baseline 上，重新执行 Home CRUD 的 pin migration，并把当前仍停留在 mailbox-dispatch/direct-write 语义里的 Home 业务链真正切到 `0247`/`0248` 的正式合同：

- Home source model 只负责接收 `home_*` action、做本地校验、组装 typed request、通过 output pin emit request。
- target owner 负责接收 request，并在自己的模型边界内完成最终 materialization；source 不再直接写 `Model -2` 或正数业务模型。
- 本地 Home 页在真实 server/runtime 路径上完成 create/edit/delete 全链路验证，证明 0248 能力已被业务场景消费，而不是只停留在 focused regression。

这里的 “source” 指当前 Home 业务逻辑所在的 `Model -10`；“target owner” 至少覆盖两类真实 owner：

- `Model -2`：Home 编辑态、详情态、状态文本等 UI state owner。
- Home 选中的正数业务模型（现有本地基线以 `workspace_positive_models.json` 暴露的模型为主，例如 `1003`）：业务 label 的最终 owner。

## WHY

`0243` 已经让 Home 页通过 mailbox-dispatch 链路跑通 CRUD，但该方案的业务写入仍依赖 `Model -10` handler 直接写 `Model -2` 与正数模型。

`0246` 已在 Phase 3 证明：当 Home 入口改成 pin 触发后，现有 `handle_home_*` 逻辑会被 `0245` 的 scoped privilege 正确拦下，报出 `direct_access_cross_model_forbidden`。这说明缺口不在 Home UI 本身，也不在 privilege 守卫，而在于：

- source 没有停在 “emit request”；
- target owner 还没有正式接管 `Model -2` / 正数模型的 materialization；
- Home 业务层尚未真正接到 `0248` 刚补齐的 `source output -> pin.connect.model -> target owner input` runtime 能力上。

如果 0249 不完成这次 retry，则 codebase 会继续停留在一种不一致状态：

- runtime 已支持 cross-model pin owner materialization；
- Home 仍使用旧 dispatch/write 心智；
- 本地页面级 CRUD 仍然没有一个基于正式 owner-materialization 合同的业务样板。

## Current Baseline

- `packages/worker-base/system-models/intent_handlers_home.json` 当前仍是 dispatch-era handler patch：
  - `handle_home_*` 直接读取 mailbox，再直接写 `Model -2` 或正数模型。
  - 当前主线文件中看不到 0246 试做过的 Home root `pin.table.in` / `pin.connect.label` 声明。
- `packages/ui-model-demo-server/server.mjs` 当前 `submitEnvelope()` 对 Home action 仍以 `intent_dispatch_table -> run_func` 为主路径。
- `scripts/tests/test_0248_cross_model_pin_owner_materialization_contract.mjs` 已证明 runtime 能力存在，但它只覆盖最小 runtime 合同，不覆盖 Home 业务 patch。
- `packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs` 仍在验证旧 Home CRUD 行为；`validate_home_crud_local.mjs` 仍将 Home action 视为 remote-only。

0249 的目标不是再改 runtime 语义，而是把这些业务侧现状对齐到 0248 baseline。

## Problem Statement

0249 需要解决的不是“Home action 能否被触发”，而是“Home action 的真实写入所有权是否符合当前 SSOT”。

当前非一致点有三层：

- 入口层：Home action 仍主要经 dispatch function 执行，而非正式 Home pin contract。
- source 层：`Model -10` handler 仍承担 cross-model direct write。
- owner 层：`Model -2` 与本地 Home 可见的正数模型还没有一套被 Home 业务显式消费的 owner-side receive/materialize path。

0249 的交付必须把这三层同时打通，否则 create/edit/delete 页面验证即便“看起来能用”，也依然是 non-conformant。

## In Scope

- 为 Home action 新增或重建一份 focused contract test，冻结 0249 的 source/request/owner 迁移口径。
- 将 Home source patch 从 direct write 改为 request-only pin emit。
- 将本地 Home 验证所需的 target owner receive/materialize path 正式落到 `Model -2` 与本地基线正数模型上。
- 让 `server.mjs` 的 Home action 提交路径消费新的 Home pin contract，而不是继续把 `home_*` 当作纯 dispatch action。
- 更新本地页面级验证脚本，证明 create/edit/delete 在真实 server/runtime 闭环中通过。
- 保留并复用 `0245`、`0248` 现有 regression，作为 no-bypass guard。

## Out Of Scope

- 不再修改 `packages/worker-base/src/runtime.mjs` 的通用 owner-materialization 语义；0248 已是本 iteration 的 runtime baseline。
- 不恢复 mailbox fallback、compatibility alias、cross-model direct write 豁免。
- 不把 Home 本地 demo mode 从 remote-only 改成 direct local mutation。
- 不扩展到 Docs、Workspace、Prompt FillTable、Three Scene 等其他业务 action。
- 不新增新的结构性 `label.t`；0249 只能消费现有 pin / func / model label 能力。

## Constraints And Assumptions

- 必须遵循 `CLAUDE.md` 中的 `HARD_RULES`、`WORKFLOW`、`CHANGE_OUTPUT` 与 no-fallback 要求。
- 当前是 Phase 1，本文档只定义 WHAT/WHY，不包含执行记录与实现结果。
- `0248` 的 runtime 回归 (`test_0248_cross_model_pin_owner_materialization_contract.mjs`) 视为 0249 的前置 green baseline。
- Home CRUD 的 authoritative 页面验证以本地 server/runtime 路径为准，即 `createServerState()` 驱动的 `validate_home_crud_server_sse.mjs`。
- `validate_home_crud_local.mjs` 仍应保持 remote-only guard；若 execution 需要改变该脚本结论，必须在 runlog 明确说明为何不再需要此 guard。
- 本 iteration 默认覆盖 Home selector 当前能选到的本地 bootstrap positive models；若执行阶段发现需要支持“任意运行期新建正数模型”才算完成，则必须先在 runlog 升级 scope，再继续实施。

## Codebase Impact Scope

### Home Source Patch

- `packages/worker-base/system-models/intent_handlers_home.json`
  - 当前是 Home action 的唯一业务 handler patch。
  - 0249 需要把这里从 “读取 mailbox 后直接写 target” 改为 “读取 mailbox/state 后 emit typed request”。
  - 若 execution 需要把 owner-side materializer 也放进同一 patch 文件，必须保持 source/target 角色清晰可审计。

### Server Action Submission

- `packages/ui-model-demo-server/server.mjs`
  - `submitEnvelope()` 当前仍以 `intent_dispatch_table` 为主要 Home action 执行面。
  - 0249 需要在这里建立 Home action 到 source pin 的正式提交路径，并禁止悄悄回落到 non-conformant dispatch write path。

### Target Owner Surface

- `packages/worker-base/system-models/intent_handlers_home.json`
- `packages/worker-base/system-models/workspace_positive_models.json`
  - 前者承接 `Model -2` owner-state 的 receive/materialize 可能性。
  - 后者是当前本地 Home 选择器可见的正数模型 bootstrap patch，至少要为本地页面验证实际用到的模型提供 owner-side receive/materialize path。

### Regression And Validation Surface

- `scripts/tests/test_0212_home_crud_contract.mjs`
  - 保留 Home action/UI asset/dispatch inventory 作为历史合同守卫。
- `scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs`
  - 继续证明 source direct write 禁令没有被削弱。
- `scripts/tests/test_0248_cross_model_pin_owner_materialization_contract.mjs`
  - 继续证明 0249 建立在真实 runtime capability 之上。
- `packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`
  - authoritative 页面级 create/edit/delete 验证入口。
- `packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs`
  - local adapter remote-only guard。
- 新增 focused contract test（建议命名：`scripts/tests/test_0249_home_crud_pin_owner_materialization_contract.mjs`）
  - 用于冻结 0249 自己的 source/request/owner 合同，而不污染 `0212` 与 `0248` 的历史测试语义。

## Success Criteria

- Home source model 不再直接 `writeLabel/rmLabel` 到 `Model -2` 或正数业务模型。
- Home action 有正式 root pin contract，且 server 对 `home_*` 的 authoritative 提交通路与该 contract 对齐。
- `Model -2` 与本地 Home 验证覆盖到的正数模型都能通过 owner-side input path 完成 materialization。
- `test_0245_scoped_privilege_runtime_contract.mjs` 继续绿色，证明没有通过“放松 privilege”来伪修复 Home CRUD。
- `test_0248_cross_model_pin_owner_materialization_contract.mjs` 继续绿色，证明 0249 确实消费的是 0248 的能力。
- `validate_home_crud_server_sse.mjs` 在本地真实 server/runtime 路径上完成 create/edit/delete。
- `validate_home_crud_local.mjs` 的 guard 结论与 0249 的交付边界保持一致，并在 runlog 中可解释。

## Risks

- 如果 0249 只是把 `run_func` 换成 pin 触发，但 source handler 仍直接写 target，则只会再次重现 0246 的失败。
- 如果 0249 通过 server 或 helper model 暗中替 target materialize，而不是 target owner 自己接 request，则会违反 0247/0248 冻结的合同。
- 如果只修页面脚本、不修 source/owner 角色分离，`validate_home_crud_server_sse.mjs` 即使变绿也没有交付价值。
- 如果为 Home action 保留 silent dispatch fallback，则一旦 pin route 断裂，系统仍可能“看上去可用”但其实已越过 SSOT。
- 如果 0249 只覆盖 `home_save_label` / `home_delete_label`，而忽略 `home_open_create` / `home_open_edit` / `home_select_row` 对 `Model -2` 的 owner materialization，则 create/edit/delete 页面链路依然不完整。
