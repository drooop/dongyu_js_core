---
title: "0246 — home-crud-pin-migration-pilot Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0246-home-crud-pin-migration-pilot
id: 0246-home-crud-pin-migration-pilot
phase: phase3
---

# 0246 — home-crud-pin-migration-pilot Runlog

## Environment

- Date: `2026-03-26`
- Branch: `dropx/dev_0246-home-crud-pin-migration-pilot`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`

## Review Gate Record

- Iteration ID: `0246-home-crud-pin-migration-pilot`
- Review Date: `2026-03-26`
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户已确认 0246 要在 0245 验证通过后，才开始做 Home mailbox -> pin 样板迁移。

## Execution Records

### Step 1 — Freeze Home PIN Contract As RED

- File:
  - `scripts/tests/test_0246_home_crud_pin_contract.mjs`
- RED baseline:
  - `home_handler_patch_must_declare_root_pin:home_refresh`
  - server path still used mailbox-dispatch handlers only
- Result: PASS

### Step 2 — Add Home Root PIN Contract

- Files:
  - `packages/worker-base/system-models/intent_handlers_home.json`
  - `packages/ui-model-demo-server/server.mjs`
- Changes:
  - declare root `pin.table.in` for all `home_*`
  - add `pin.connect.label` wiring from `(self, home_*)` to `(func, handle_home_*:in)`
  - make `submitEnvelope()` prefer Home pin path over dispatch-table path
- Result: PARTIAL

### Step 3 — Verify Pin Path

- Commands:
  - `node scripts/tests/test_0246_home_crud_pin_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`
  - ad-hoc runtime debug against `createServerState()`
- Key output:
  - static contract now green:
    - root `pin.table.in` declarations exist
    - pin wiring exists
  - server does write `-10 (0,0,0) home_open_create/home_save_label` as `pin.table.in`
  - but runtime error label shows:
    - `__error_handle_home_open_create.error = "direct_access_cross_model_forbidden"`
- Adjudication:
  - `0245` 的 scoped privilege 规则正在正确生效
  - 但这也暴露出 `0246` 的真实 capability gap：
    - Home handlers 当前运行在 `Model -10`
    - 它们需要跨模型写 `Model -2` 和正数业务模型
    - 在 `0245` 规则下，这种 cross-model direct write 被正确禁止
  - 因此当前 mailbox -> pin pilot 不能仅靠“把旧 handler 触发方式改成 pin”完成
- Result: ON HOLD

## Blocker

- Type: capability gap
- Detail:
  - Need a new contract for cross-model pin-mediated owner materialization or equivalent boundary-safe write path.
- Current evidence:
  - pin path reaches `Model -10` root input label
  - handler execution under runtime func ctx fails on cross-model direct write

## Closeout Adjudication

- Date: `2026-03-27`
- Decision: Superseded
- Superseded by: `0249-home-crud-pin-migration-retry-on-owner-materialization`
- Notes:
  - `0246` 正确暴露了 `0245` scoped privilege 下的真实边界：Home handler 在 `Model -10` 中不能继续承担 cross-model direct write。
  - 后续由 `0247` 冻结 cross-model pin owner-materialization contract，`0248` 落 runtime 通路，`0249` 完成 Home 业务迁移、request `origin` 补齐与页面级 CRUD 证据闭环。
  - 本次收口未恢复 `0246` 试验 stash；authoritative 结果以 `0249` 为准。
