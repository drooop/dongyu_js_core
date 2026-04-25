---
title: "0212 — home-crud-proper-tier2 Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0212-home-crud-proper-tier2
id: 0212-home-crud-proper-tier2
phase: phase1
---

# 0212 — home-crud-proper-tier2 Resolution

## 0. Execution Rules

- Work branch: `dropx/dev_0212-home-crud-proper-tier2`
- Working directory for all commands: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Required local tools on PATH: `node`, `npm`, `rg`
- Steps must be executed in order.
- Every Step must end with executable validation commands and explicit PASS/FAIL evidence in `runlog.md`.
- `0212` is a Tier 2 iteration:
  - prefer JSON patch / system-model / handler changes
  - keep host-code changes minimal and only for loading / parity / explicit unsupported contract
- Do NOT modify these Tier 1 files inside this iteration:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
- Do NOT relax or remove `direct_model_mutation_disabled` for generic business-model writes.
- Remote/server-backed path is the authoritative execution surface for Home CRUD.
- Local path may only do one of the following:
  - reuse the same Home action contract
  - remain projection-only with deterministic, explicit unsupported behavior
- Local path MUST NOT grow a second copy of Home CRUD business logic.
- Because `0212` explicitly places Home/Editor UI state in `Model -2`, execution MUST first register `Model -2` in `CLAUDE.md` `MODEL_ID_REGISTRY` before any implementation or validation that depends on that placement.
- Any real execution evidence belongs in `runlog.md`, not in this file.

## 1. Implementation Objective

0212 的实施目标固定为：

1. 先在 `CLAUDE.md` 的 `MODEL_ID_REGISTRY` 中登记 `Model -2`
2. 再把 Home CRUD contract、action names、validation guard 固定下来
3. 然后把缺失的 Home CRUD UI/state surface materialize 到 `home_catalog_ui.json`
4. 再用 `Model -10` 的 Tier 2 handler patch 接住真正的 CRUD 写入/删除逻辑
5. 最后做 targeted regression、docs assessment、runlog/ledger 收口

禁止跳过前 2 步直接写页面或 handler，否则很容易把“未登记 model id”与“旧 datatable host hardcode”一起继续包装成新合同。

## 2. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Register Model -2 In MODEL_ID_REGISTRY | 先消除 `Model -2` 未登记 blocker，固定 editor/home state 模型语义 | `CLAUDE.md` | `rg -n "MODEL_ID_REGISTRY|Model -2" CLAUDE.md` | `Model -2` 已在最高优先级文档登记，且用途与 0212 placement 一致 | 回退 `CLAUDE.md` |
| 2 | Freeze Home CRUD Contract Guards | 固定 Home action contract、local/remote 边界与 guard tests | `scripts/tests/test_0191d_home_asset_resolution.mjs`, `scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`, `scripts/tests/test_0212_home_crud_contract.mjs` | `node scripts/tests/test_0191d_home_asset_resolution.mjs`; `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`; `node scripts/tests/test_0212_home_crud_contract.mjs`; `rg -n "home_(refresh|select_row|open_create|open_edit|save_label|delete_label|view_detail)|direct_model_mutation_disabled|page_asset_v0" packages/worker-base/system-models packages/ui-model-demo-frontend/src packages/ui-model-demo-server/server.mjs` | Home CRUD 的 action set、guard、negative/positive ownership 与 local/remote 假设被明确编码到 tests/contract 中；此时还不引入最终行为实现 | 回退 contract test 与 inventory 更新 |
| 3 | Materialize Home CRUD UI And State | 在 `home_catalog_ui.json` 中补齐 create/edit/detail/delete surface，并补足派生/seed state | `packages/worker-base/system-models/home_catalog_ui.json`, `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`, `packages/ui-model-demo-frontend/src/demo_modeltable.js`, `packages/ui-model-demo-frontend/src/remote_store.js`, `packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs` | `node scripts/tests/test_0191d_home_asset_resolution.mjs`; `node scripts/tests/test_0194_ui_snapshot_utils_dedup.mjs`; `node scripts/tests/test_0212_home_crud_contract.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs`; `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs` | Home asset 在新合同下具备 CRUD surface；所有 UI state 仍落在已登记的 `Model -2` / `Model -22`；Tier 1 文件保持未改动 | 回退 Home asset、deriver、store seed、local validator 改动 |
| 4 | Add Tier 2 Home Handlers And Align Execution Path | 把真正 CRUD 行为下沉到 `Model -10` handler patch，并为 local path 设定不复制业务逻辑的明确合同 | `packages/worker-base/system-models/intent_dispatch_config.json`, `packages/worker-base/system-models/intent_handlers_home.json`, `packages/ui-model-demo-frontend/src/local_bus_adapter.js`, `packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`, `scripts/tests/test_0212_home_crud_contract.mjs` | `node scripts/tests/test_0212_home_crud_contract.mjs`; `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`; `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs` | Remote path 通过 `intent_dispatch_table` + `func.js` 完成 Home CRUD；generic direct mutation 继续被拒绝；local path 不是第二份 CRUD 业务实现 | 回退 Home handler patch、dispatch config、adapter/source-backed validator 改动 |
| 5 | Regression And Ledger Closeout | 跑 targeted regression、记录 docs assessment、收口 runlog/ITERATIONS | `docs/iterations/0212-home-crud-proper-tier2/runlog.md`, `docs/ITERATIONS.md`, 必要时 `docs/user-guide/modeltable_user_guide.md` | `node scripts/tests/test_0191d_home_asset_resolution.mjs`; `node scripts/tests/test_0194_ui_snapshot_utils_dedup.mjs`; `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`; `node scripts/tests/test_0212_home_crud_contract.mjs`; `npm -C packages/ui-model-demo-frontend run test`; `npm -C packages/ui-model-demo-frontend run build`; `node packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`; `rg -n "0212-home-crud-proper-tier2|Model -2" CLAUDE.md docs/ITERATIONS.md docs/iterations/0212-home-crud-proper-tier2/runlog.md` | Targeted validations PASS；runlog 有命令/关键输出/commit；docs assessment 与 ledger 状态一致 | 回退 0212 文档与代码改动，恢复执行前状态 |

## 3. Step Details

### Step 1 — Register Model -2 In MODEL_ID_REGISTRY

**Goal**

- 先消除当前 review 指出的 blocker：`Model -2` 已被 0212 用作 Home/Editor UI state 模型，但它尚未出现在最高优先级文档 `CLAUDE.md` 的 `MODEL_ID_REGISTRY` 中。

**Scope**

- 更新 `CLAUDE.md` 的 `MODEL_ID_REGISTRY`：
  - 增加 `Model -2`
  - 用途固定为 editor/home UI state projection model
  - 语义必须与 0212 文档中的 placement 一致，且不得与已登记的 `-1/-3/-10/-21..-26` 冲突

**Files**

- Create/Update:
  - `CLAUDE.md`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "MODEL_ID_REGISTRY|Model -2" CLAUDE.md`
- Expected signals:
  - `Model -2` 在 `MODEL_ID_REGISTRY` 中有正式条目
  - 条目语义明确指向 editor/home UI state projection model

**Acceptance Criteria**

- 0212 后续所有对 `Model -2` 的引用都建立在已登记 model id 之上，不再违反 `CLAUDE.md` 的硬约束。

**Rollback Strategy**

- 仅回退 `CLAUDE.md` 中的 `Model -2` 登记改动。

---

### Step 2 — Freeze Home CRUD Contract Guards

**Goal**

- 先把 `0212` 要交付的 Home CRUD contract 固定下来，避免后续把旧 `datatable_*` 行为、shared AST 时代遗留假设、或 local/remote 临时差异偷偷带进实现。

**Scope**

- 把以下内容编码成 contract test / source inventory：
  - Home 正式 action set：
    - `home_refresh`
    - `home_select_row`
    - `home_open_create`
    - `home_open_edit`
    - `home_save_label`
    - `home_delete_label`
    - `home_view_detail`
    - `home_close_detail`
    - `home_close_edit`
  - Home page asset 仍必须来自 `page_asset_v0`
  - generic direct mutation 仍继续失败
  - Home CRUD hidden helper 默认应落在 `Model -10`
  - Home/Editor UI state 使用已登记的 `Model -2`
  - local path 不允许新增第二份业务 CRUD 逻辑

**Files**

- Create/Update:
  - `scripts/tests/test_0191d_home_asset_resolution.mjs`
  - `scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
  - `scripts/tests/test_0212_home_crud_contract.mjs`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_home_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "home_(refresh|select_row|open_create|open_edit|save_label|delete_label|view_detail)|direct_model_mutation_disabled|page_asset_v0" packages/worker-base/system-models packages/ui-model-demo-frontend/src packages/ui-model-demo-server/server.mjs`
- Expected signals:
  - Home asset 仍为 explicit model-label asset
  - generic mutation rejection 仍存在
  - `Model -2` 已被视为上一步完成的前置条件，而非未登记的暗含假设
  - `0212` contract test 对 action names、placement、guard、local/remote contract 有明确断言

**Acceptance Criteria**

- 从这一步开始，Home CRUD 的 contract 不再依赖聊天上下文解释。
- `0212` 后续实现必须满足 Step 2 的 tests，而不是在实现后反向修改合同。
- 本 Step 结束时可以允许测试为 RED，但 RED 必须是“缺口已被精确命名”的 RED。

**Rollback Strategy**

- 回退新增/修改的 contract tests。
- 恢复到执行前的 inventory 状态，不保留半成品断言。

---

### Step 3 — Materialize Home CRUD UI And State

**Goal**

- 在不触碰 runtime / renderer 语义的前提下，把 Home 当前缺失的 CRUD surface 补到新的 page asset 里，让 Home 真正变成可操作 UI，而不是只读 datatable。

**Scope**

- 更新 `home_catalog_ui.json`，至少补齐：
  - row action column
  - create / edit dialog
  - detail drawer or dialog
  - status / error text
  - delete confirm surface（可为明确的 confirm action，而不是 silent remove）
- 更新 `editor_page_state_derivers.js`，补足 Home CRUD 所需的派生字段或 row metadata。
- 更新 `demo_modeltable.js` / `remote_store.js` 的 state seed 与读取逻辑，使新 asset 不依赖隐式默认值。
- 所有新增 Home/Editor UI state 都必须继续落在已登记的 `Model -2`，不得因为 registry 问题临时漂移到其他模型号。
- 新增 `validate_home_crud_local.mjs`，验证 local path 至少满足：
  - Home asset render contract 正确
  - 按钮/对话框 bind 正确
  - 不会因为 asset 改造而重新引入 legacy AST 或 Tier 1 依赖

**Files**

- Create/Update:
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs`
  - `scripts/tests/test_0212_home_crud_contract.mjs`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_home_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0194_ui_snapshot_utils_dedup.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs`
- Expected signals:
  - Home asset 继续使用 explicit `page_asset_v0`
  - CRUD surface 已 materialize
  - local validator 可证明 UI contract 已到位
  - Tier 1 files 无改动

**Acceptance Criteria**

- Home 不再只是过滤+表格，而是具备可见、可触发、可回写状态的 CRUD surface。
- 所有新 UI state 仍归已登记的 `Model -2` / `Model -22`，没有把业务真值挪到 UI state。
- local validator 至少能证明：
  - page asset shape 正确
  - bind targets/action names 正确
  - 没有引入新的 legacy AST 依赖

**Rollback Strategy**

- 回退 Home asset、state deriver、store state seed 与 local validator 改动。
- 清理所有只完成一半的 dialog/status/action surface。

---

### Step 4 — Add Tier 2 Home Handlers And Align Execution Path

**Goal**

- 把真正的 Home CRUD 业务行为落到 `Model -10` 的 Tier 2 handler patch，而不是继续散落在 host 分支里；同时给 local path 一个明确、可测试、但不复制业务逻辑的合同。

**Scope**

- 在 `intent_dispatch_config.json` 注册 Home action -> handler mapping。
- 新建 `intent_handlers_home.json`，至少覆盖：
  - refresh
  - select row / load draft
  - open create / open edit
  - save label
  - delete label
  - view detail
  - close detail / close edit / clear transient state
- handler 内必须显式检查：
  - target model 合法
  - target model 不为 `0`
  - selected positive model 是否存在
  - target k / t / v 是否满足允许写入规则
  - 错误必须回写 `ui_event_error` 或等价结构化状态
- local path 只允许两种方案之一：
  - 复用同一 dispatch contract
  - 明确返回 deterministic unsupported / projection-only contract
- 不允许：
  - 继续把最终业务行为保留在 `server.mjs` / `local_bus_adapter.js` 的 page-specific CRUD hardcode 中
  - 重新放开 generic `label_add/update/remove/cell_clear` 对业务模型的直写

**Files**

- Create/Update:
  - `packages/worker-base/system-models/intent_dispatch_config.json`
  - `packages/worker-base/system-models/intent_handlers_home.json`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - `packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`
  - `scripts/tests/test_0212_home_crud_contract.mjs`
- Optional only if strictly required by loading/contract alignment:
  - `packages/ui-model-demo-server/server.mjs`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs`
- Expected signals:
  - Home actions 已进入 `intent_dispatch_table`
  - `intent_handlers_home.json` 存在且定义完整
  - remote source-backed validator 能证明 server path 会通过已有 dispatch 机制接住 Home actions
  - generic mutation rejection 仍 PASS
  - Tier 1 files 无改动

**Acceptance Criteria**

- Remote/server-backed path 通过 `Model -10` handler patch 完成 Home CRUD 主链路。
- Home/Editor UI state 与 page asset/model handler 的 placement 继续保持：
  - `Model -2` = editor/home UI state projection model（已登记）
  - `Model -22` = Home page asset model
  - `Model -10` = hidden handler / dispatch
- Home CRUD 不再依赖旧 `datatable_remove_label` 作为唯一 delete 实现。
- local path 的行为被明确为：
  - shared dispatch contract
  - 或 explicit unsupported
  两者必须二选一并记录到 runlog。
- 任何情况下，local path 都没有新增第二份业务 CRUD 实现。

**Rollback Strategy**

- 回退 Home handler patch、dispatch config、adapter/source-backed validator 改动。
- 删除所有只实现了一半的 action mapping 与 unsupported contract。

---

### Step 5 — Regression And Ledger Closeout

**Goal**

- 用 targeted regression 证明 0212 的结果既能跑通，又没有破坏边界；同时把 docs assessment、runlog 和 ledger 收口完整。

**Scope**

- 跑 Home asset / Home CRUD / direct mutation gate / frontend build/test 的 targeted validations。
- 在 `runlog.md` 记录：
  - 命令
  - 关键输出
  - PASS/FAIL
  - local/remote contract 最终选择
  - runtime / renderer 未改动的事实
- 评估是否需要更新 living docs：
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  预期仅在 public contract wording 发生变化时才更新。
- 在 `runlog.md` 中明确记录：
  - `Model -2` registry blocker 已通过 Step 1 消除
  - 0212 后续 placement 检查建立在该登记之上
- 更新 `docs/ITERATIONS.md` 的状态与 branch/commit 事实。

**Files**

- Create/Update:
  - `docs/iterations/0212-home-crud-proper-tier2/runlog.md`
  - `docs/ITERATIONS.md`
  - 必要时：
    - `docs/user-guide/modeltable_user_guide.md`
    - `docs/ssot/runtime_semantics_modeltable_driven.md`
    - `docs/ssot/label_type_registry.md`
- Must NOT touch:
  - `docs/iterations/0212-home-crud-proper-tier2/plan.md`
  - `docs/iterations/0212-home-crud-proper-tier2/resolution.md`
    除非 review gate 明确要求回到 Phase 1 修改合同

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_home_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0194_ui_snapshot_utils_dedup.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run test`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "0212-home-crud-proper-tier2" docs/ITERATIONS.md docs/iterations/0212-home-crud-proper-tier2/runlog.md`
- Expected signals:
  - targeted tests / validators PASS
  - build/test PASS
  - runlog / ITERATIONS facts 已收口

**Acceptance Criteria**

- 0212 的 Home CRUD 结果在 repo 内有 deterministic PASS/FAIL 证据。
- runlog 明确记录：
  - `Model -2` registry 对齐检查
  - Tier 1 / Tier 2 边界检查
  - negative / positive placement 检查
  - ownership / flow / chain 检查
  - local/remote contract 最终裁决
- downstream `0213` / `0215` 可以直接引用 0212 作为前置能力，而不必重新审计 Home CRUD 边界。

**Rollback Strategy**

- 回退 0212 代码与文档改动。
- `docs/ITERATIONS.md`、`runlog.md` 恢复到执行前状态。

## 4. Final Acceptance Notes

- `0212` 的完成标准不是“Home 看起来有按钮”，而是：
  - `Model -2` 已先被正式登记
  - CRUD 主路径存在
  - direct mutation 保护仍在
  - hidden helper 落点正确
  - 没有把 business logic 偷塞回 Tier 1
- 若执行发现 local full parity 只能通过抽取共享 program-engine 才能达成，而该抽取明显超出 Home 范围，则必须：
  - 在 runlog 中明确记录
  - 保持 remote authoritative 成功口径
  - 将共享 engine 抽取上升为独立后续 iteration，而不是在 0212 内静默扩 scope
