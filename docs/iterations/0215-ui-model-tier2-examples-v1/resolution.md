---
title: "0215 — ui-model-tier2-examples-v1 Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-23
source: ai
iteration_id: 0215-ui-model-tier2-examples-v1
id: 0215-ui-model-tier2-examples-v1
phase: phase1
---

# 0215 — ui-model-tier2-examples-v1 Resolution

## Execution Rules

- Work branch: `dropx/dev_0215-ui-model-tier2-examples-v1`
- Working directory for all commands: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Required local tools on PATH: `node`, `npm`, `rg`
- Steps must be executed in order.
- Every Step must end with explicit PASS/FAIL evidence in `runlog.md`.
- 0215 is a Tier 2 example iteration:
  - default write surface = JSON patch / system-model assets / validators / docs
  - runtime / renderer core is out of scope
- Do not use `workspace_demo_apps.json` as an execution target unless a separate cleanup decision explicitly promotes it; current authoritative positive seed is `workspace_positive_models.json`.
- Do not modify:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
  If an example requires touching these files, stop and open a new iteration.
- Do not restore:
  - root `ui_ast_v0`
  - `ws_selected_ast`
  - direct generic business mutation from UI
  - implicit child-model mount
- Local path may use shared dispatch if it already exists; otherwise it must fail explicitly with deterministic `unsupported`, not with silent fallback and not with duplicated business logic.

## Implementation Objective

0215 的执行顺序固定为：

1. 先把 example taxonomy、authoritative seed 和 legacy debt 写进 contract guard
2. 再落 canonical example assets 与 `Workspace` 显式挂载
3. 然后为需要的示例补正式 data path，并明确 local/server 边界
4. 最后做回归、docs assessment 和 ledger 收口

这样可以避免“examples 看起来能渲染”但实际没有 authoritative data path，或错误写入非 authoritative seed 文件。

## Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Freeze Example Guards And Authority | 固定 0215 的 example taxonomy、authoritative seed 与 legacy debt guard | `scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`, `docs/iterations/0215-ui-model-tier2-examples-v1/runlog.md` | `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`; `node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`; `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`; `rg -n "workspace_positive_models\\.json|workspace_demo_apps\\.json" packages/ui-model-demo-frontend/src/demo_modeltable.js packages/ui-model-demo-server/server.mjs packages/worker-base/system-models` | 0215 的 authoritative seed、example classes、legacy debt 边界被测试编码；`workspace_demo_apps.json` 不再被误当成正式入口 | 回退 contract test 与 runlog 基线 |
| 2 | Materialize Canonical Example Assets And Mounts | 在 authoritative patches 中加入 examples，并通过 `model.submt` 暴露到 `Workspace` | `packages/worker-base/system-models/workspace_positive_models.json`, `packages/worker-base/system-models/workspace_catalog_ui.json`, `packages/ui-model-demo-frontend/src/model_ids.js`, `packages/ui-model-demo-frontend/src/demo_modeltable.js`, `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js` | `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`; `node scripts/tests/test_0201_route_local_ast_contract.mjs`; `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`; `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs` | examples 进入 `Workspace` registry；mount 通过 `model.submt` 显式声明；selected examples 可由 `page_asset_v0` 或 schema projection 正常解析 | 回退 positive seed、workspace mount、frontend constants/derivers 改动 |
| 3 | Wire Formal Data Path For Example Actions | 为需要写路径的 examples 增加正式 action/handler，并明确 local/server 行为差异 | `packages/worker-base/system-models/intent_dispatch_config.json`, `packages/worker-base/system-models/intent_handlers_ui_examples.json`, `packages/ui-model-demo-frontend/src/local_bus_adapter.js`, `packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`, `packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`, `scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs` | `node scripts/tests/test_0212_home_crud_contract.mjs`; `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`; `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs` | 至少一条 example write path 经正式 action contract 完成；local path 没有复制第二份业务逻辑；无 direct mutation 回潮 | 回退 dispatch table、handler patch、local/server validator 与相关 contract test 改动 |
| 4 | Regression, Docs Assessment, And Ledger Closeout | 跑统一回归，评估用户指南/ledger 是否需要更新，收口 runlog/ITERATIONS | `docs/iterations/0215-ui-model-tier2-examples-v1/runlog.md`, `docs/ITERATIONS.md`, 必要时 `docs/user-guide/ui_components_v2.md`, `docs/user-guide/modeltable_user_guide.md` | `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`; `node scripts/tests/test_0201_route_local_ast_contract.mjs`; `node scripts/tests/test_0212_home_crud_contract.mjs`; `node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`; `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`; `npm -C packages/ui-model-demo-frontend run test`; `npm -C packages/ui-model-demo-frontend run build`; `node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`; `rg -n "0215-ui-model-tier2-examples-v1|ui-model-tier2-examples|workspace_positive_models|ui_components_v2" docs/ITERATIONS.md docs/iterations/0215-ui-model-tier2-examples-v1/runlog.md docs/user-guide/ui_components_v2.md` | targeted validations PASS；docs assessment 有明确结论；ledger 与 branch facts 一致 | 回退 0215 代码/文档改动及 ledger 记录 |

## Step Details

### Step 1 — Freeze Example Guards And Authority

**Goal**

- 将 0215 的执行前提编码成可持续 contract guard，而不是靠 runlog 备注或口头约定。
- 明确 0215 只能扩 authoritative surfaces，不能继续向历史残留文件追加 examples。

**Scope**

- 在测试中固定以下事实：
  - authoritative positive seed 是 `workspace_positive_models.json`
  - `workspace_demo_apps.json` 当前不是运行链路的一部分
  - example suite 至少包含三类模式：
    - schema-only leaf
    - `page_asset_v0` composition
    - parent-mounted data path
  - examples 必须维持：
    - 正数模型 placement
    - `Workspace` 显式挂载
    - 无 shared AST truth source
- 为 example model ID block、registry 命名和 handler 命名准备 guard。

**Files**

- Create/Update:
  - `scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `docs/iterations/0215-ui-model-tier2-examples-v1/runlog.md`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "workspace_positive_models\\.json|workspace_demo_apps\\.json" packages/ui-model-demo-frontend/src/demo_modeltable.js packages/ui-model-demo-server/server.mjs packages/worker-base/system-models`
- Expected signals:
  - existing workspace/flow-shell guards continue to PASS
  - new 0215 contract test encodes authoritative seed and example classes
  - `rg` 结果显示 `workspace_positive_models.json` 被运行链路消费，而 `workspace_demo_apps.json` 没有对应运行链路引用

**Acceptance Criteria**

- 0215 的 authoritative seed、legacy debt、example taxonomy 已被自动化测试编码。
- 后续执行不会因为误判 seed 文件或例子类型而走错实现面。
- 本 Step 结束时尚未引入 example 行为实现，仅建立 guard 与 baseline。

**Rollback Strategy**

- 回退新建/更新的 contract test 与 runlog 基线记录。
- 恢复到执行前状态，不保留半成品 guard。

---

### Step 2 — Materialize Canonical Example Assets And Mounts

**Goal**

- 在 authoritative patches 中真正放入 examples，并把它们作为 `Workspace` 可选、可挂载、可解析的正式资产。

**Scope**

- 在 `workspace_positive_models.json` 中加入 0215 canonical examples：
  - 至少一组 schema-only leaf example
  - 至少一组 `page_asset_v0` composition example
  - 至少一组 parent-mounted example 所需的 parent / child models
- 在 `workspace_catalog_ui.json` 中为新 examples 增加显式 `model.submt` 挂载记录。
- 如有必要，在 `model_ids.js` 中集中登记固定 example model ids，避免 magic numbers。
- 允许最小范围调整：
  - `demo_modeltable.js`
  - `editor_page_state_derivers.js`
  以保证 local seed、registry 派生、selected title/metadata 与 examples 一致。
- 明确禁止继续往 `workspace_demo_apps.json` 填新内容。

**Files**

- Create/Update:
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
- Must NOT touch:
  - `packages/worker-base/system-models/workspace_demo_apps.json`
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs`
- Expected signals:
  - `Workspace` 仍能正常解析 selected model
  - 新 examples 出现在 registry/mount 中
  - local validator 能找到并渲染 example surfaces
  - runtime/renderer 核心文件保持未改动

**Acceptance Criteria**

- examples 只进入 authoritative files：
  - `workspace_positive_models.json`
  - `workspace_catalog_ui.json`
- parent/child 示例通过 `model.submt` 显式挂载，而不是隐式创建。
- selected example 能通过真实 `page_asset_v0` 或 schema projection 渲染，不依赖 shared AST。

**Rollback Strategy**

- 回退 positive seed、workspace mount、constants、derivers、local validator 与 contract test 改动。
- 恢复执行前的 `Workspace` example inventory，不保留不完整的 mount/registry 中间态。

---

### Step 3 — Wire Formal Data Path For Example Actions

**Goal**

- 为 examples 中真正需要 mutation 的场景提供正式 write path，避免把 examples 退化成只读展示。

**Scope**

- 为 0215 新 examples 增加最小但正式的 action contract：
  - 在 `intent_dispatch_table` 中登记 action
  - 在新的 handler patch 中实现 mutation / projection / result 写回
- handler 只能执行 Tier 2 逻辑：
  - authoritative writes 落在正数 example models 或明确允许的 UI projection labels
  - 不将业务真值挪到 `Model -10`
- local path 只允许两种结果：
  - 已有 shared dispatch，可直接复用
  - 明确 `unsupported`，并由 validator 验证
- 禁止：
  - generic `label_add` / `label_update` 直接改业务真值
  - 在 local adapter 复制一份和 remote handler 等价的业务逻辑

**Files**

- Create/Update:
  - `packages/worker-base/system-models/intent_dispatch_config.json`
  - `packages/worker-base/system-models/intent_handlers_ui_examples.json`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - `packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`
  - `scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs`
- Expected signals:
  - 0212 Home CRUD guard 继续 PASS，证明 0215 没有破坏既有 Tier 2 contract 思路
  - 0215 contract test 能验证 action -> handler -> authoritative model 的链路
  - local validator 对 unsupported/shared-dispatch 边界有明确结果
  - server validator 能验证正式 write path

**Acceptance Criteria**

- 至少一条 example write path 通过正式 action contract 工作。
- local path 没有复制 remote handler 业务逻辑。
- 没有 direct mutation、implicit mount 或 shared AST 回潮。

**Rollback Strategy**

- 回退 dispatch table、handler patch、local adapter、validators、contract test 改动。
- 删除所有未完成或不一致的 example action definitions。

---

### Step 4 — Regression, Docs Assessment, And Ledger Closeout

**Goal**

- 在 canonical examples 落地后，做统一回归并把公共口径、执行证据、ledger 状态收口到位。

**Scope**

- 运行 workspace、route、Tier 2 data path、frontend build/test、local/server validators。
- 评估 component 使用说明是否因 0215 改变了公共口径：
  - 如果只是新增 example asset，不改 public wording，则不更新 `ui_components_v2.md`
  - 如果 example 明确冻结了“schema vs page_asset_v0 何时使用”的公开口径，则补更新
- 在 `runlog.md` 中记录：
  - 命令
  - 关键输出
  - commit hash
  - PASS/FAIL
- 在 `docs/ITERATIONS.md` 中更新状态与分支事实。

**Files**

- Create/Update:
  - `docs/iterations/0215-ui-model-tier2-examples-v1/runlog.md`
  - `docs/ITERATIONS.md`
  - 必要时：
    - `docs/user-guide/ui_components_v2.md`
    - `docs/user-guide/modeltable_user_guide.md`
- Must NOT touch:
  - `docs/iterations/0215-ui-model-tier2-examples-v1/plan.md`
  - `docs/iterations/0215-ui-model-tier2-examples-v1/resolution.md`
    除非 review gate 明确要求修订计划

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run test`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "0215-ui-model-tier2-examples-v1|ui-model-tier2-examples|workspace_positive_models|ui_components_v2" docs/ITERATIONS.md docs/iterations/0215-ui-model-tier2-examples-v1/runlog.md docs/user-guide/ui_components_v2.md`
- Expected signals:
  - targeted validations 全部 PASS
  - docs assessment 有明确结论
  - runlog 与 ledger 中的状态、命令、branch facts 一致

**Acceptance Criteria**

- 所有 targeted validations PASS。
- 0215 的 runlog 具备可审计执行证据。
- docs/ledger 与实际交付状态一致。
- downstream `0216` / `0217` 可直接把 0215 outputs 当成前置参考面。

**Rollback Strategy**

- 回退 0215 的代码、tests、validators、docs 与 ledger 改动。
- 恢复执行前状态，并在 runlog 中明确记录 rollback 原因与范围。

## Conformance Checklist

- Tier boundary:
  - 0215 只做 Tier 2 assets / handlers / validators，不改 Tier 1 runtime/renderer。
- Model placement:
  - 业务 examples 在正数 models
  - helper/dispatch 在负数系统模型
  - `Workspace` mount 在 `Model -25`
- Data ownership:
  - business truth 不落到 `Model -2` / `Model -10`
  - UI projection state 不伪装成 business truth
- Data flow:
  - cross-model writes 走正式 action contract
  - local path 不复制第二份业务逻辑
- Data chain:
  - no direct mutation bypass
  - no shared AST truth source
  - no implicit child-model mount
