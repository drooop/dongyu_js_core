---
title: "0249 — home-crud-pin-migration-retry-on-owner-materialization Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-03-27
source: ai
iteration_id: 0249-home-crud-pin-migration-retry-on-owner-materialization
id: 0249-home-crud-pin-migration-retry-on-owner-materialization
phase: phase3
---

# 0249 — home-crud-pin-migration-retry-on-owner-materialization Runlog

## Environment

- Date: `2026-03-26`
- Branch: `dropx/dev_0249-home-crud-pin-migration-retry-on-owner-materialization`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`

## Execution Records

- Historical on-hold review record preserved below; completed closeout records follow.

```
Review Gate Record
- Iteration ID: 0249-home-crud-pin-migration-retry-on-owner-materialization
- Review Date: 2026-03-26
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 2
- Decision: On Hold
- Revision Type: N/A
- Notes: process_error: Command failed: cat /Users/drop/codebase/cowork/dongyuapp_elysia_based/.orchestrator/runs/1f79c080-f76c-4fd9-a82e-a4b4a4f87edc/transcripts/0249-home-crud-pin-migration-retry-on-owner-materialization_review_plan_r2_prompt.txt | claude -p  --model opus --output-format json --max-turns 8 --allowedTools "Read,Grep,Glob,Bash"

Review history:

```

## Review Gate Record

- Iteration ID: `0249-home-crud-pin-migration-retry-on-owner-materialization`
- Review Date: `2026-03-27`
- Review Type: User
- Review Index: 3
- Decision: Completed
- Notes:
  - 用户裁决：`0249` 可以收口，`0246` 可以标为 superseded。
  - 本次收尾范围只包含：清理 `test-results/`、提交当前 `0249` 分支、更新 `0246/0249` 台账与 runlog 收尾说明。

## Closeout Records

### Step 1 — Converge Home write authority to pin owner-materialization

- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/intent_dispatch_config.json`
  - `packages/worker-base/system-models/intent_handlers_home.json`
- Facts:
  - `intent_dispatch_table` 中全部 `home_*` 已改为 `handle_home_pin_only_dispatch_blocked`。
  - `handle_home_pin_only_dispatch_blocked` 只写 `ui_event_error`，不再承担实际业务写入。
  - `server.mjs` 中 `HOME_PIN_ACTIONS` authoritative path 负责 source request emit -> pin route -> target owner self-materialization，并返回 `routed_by: 'pin'`。

### Step 2 — Complete owner request origin envelope

- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0249_home_crud_pin_migration_contract.mjs`
- Facts:
  - `set_labels`、`add_label`、`rm_label` owner request 均补齐 `origin = { model_id: -10, cell: { p: 0, r: 0, c: 0 }, action }`。
  - focused regression 显式断言 `home_open_create`、`home_save_label`、`home_delete_label` 生成的 owner request 含完整 `origin`。

### Step 3 — Keep Home table surface audit-friendly

- Files:
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
- Facts:
  - Home 表格行派生层过滤 owner/pin internal labels（如 `home_owner_request`、`home_owner_route`、`func.js`、`pin.*`、`__error_*`），避免内部 materialization 细节污染 CRUD 行列表。

### Step 4 — Stabilize local validator isolation

- Files:
  - `packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`
- Facts:
  - 验证脚本在 setup/cleanup 中清空 `DY_PERSISTED_ASSET_ROOT`，避免历史 persisted asset 干扰 0249 server-SSE 口径。

### Step 5 — Capture browser CRUD evidence pack

- Artifact path:
  - `output/playwright/0249-home-crud-pin-migration-retry-on-owner-materialization/`
- Facts:
  - evidence pack 包含：`01-home-before-create.png`、`02-after-create.png`、`03-after-edit.png`、`04-after-delete.png`、`evidence_summary.md`、`report.json`。
  - `report.json` 记录 create/edit/delete 全部 `result = ok`，且 `routed_by` 全为 `pin`。
  - final snapshot evidence 记录：`hasEvidenceLabel = false`，`ownerRequestHasOrigin = true`，`ownerRequestOrigin.action = home_delete_label`。

### Step 6 — Align final carrier branch with renderer unblock fix

- Branch:
  - `dropx/dev_0249-home-crud-pin-migration-retry-on-owner-materialization`
- Commit:
  - `c263236` (`fix(renderer): unblock home save after repeated add-label interactions`)
- Facts:
  - `0249` 最终可用状态所依赖的 renderer follow-up fix 已正式纳入 `0249` 承载线。
  - 避免了“`0249` ledger 已 completed，但 renderer unblock fix 仅存在于其他分支”的审计不一致。

## Verification

- Commands:
  - `node scripts/tests/test_0249_home_crud_pin_migration_contract.mjs`
  - `node scripts/tests/test_0248_cross_model_pin_owner_materialization_contract.mjs`
  - `node scripts/tests/test_0212_home_crud_contract.mjs`
  - `node scripts/tests/test_0186_renderer_commit_policy_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
- Result:
  - All PASS on `2026-03-27` during final closeout verification.

## Final Adjudication

- `path convergence gap`: closed
- `request contract gap`: closed
- `page evidence gap`: closed
- `0249`: completed
