---
title: "0252 — home-legacy-handler-cleanup Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0252-home-legacy-handler-cleanup
id: 0252-home-legacy-handler-cleanup
phase: phase3
---

# 0252 — home-legacy-handler-cleanup Runlog

## Environment

- Date: `2026-03-27`
- Branch: `dev_0252-home-legacy-handler-cleanup`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`

## Registration Record

- Iteration ID: `0252-home-legacy-handler-cleanup`
- Registration Date: `2026-03-27`
- Source: User review follow-up on `0249`
- Decision: Planned
- Notes:
  - 目标是清理 `intent_handlers_home.json` 中已不再权威的 Home legacy direct-write handlers。
  - 执行前仍需按 workflow 进入相应 review gate。

## Execution Records

### Step 1 — Add RED cleanup contract test

- File:
  - `scripts/tests/test_0252_home_legacy_handler_cleanup_contract.mjs`
- Command:
  - `node scripts/tests/test_0252_home_legacy_handler_cleanup_contract.mjs`
- RED output:
  - `legacy_handler_must_be_removed:handle_home_refresh`
- Adjudication:
  - legacy `handle_home_*` direct-write blocks were still present in `intent_handlers_home.json`
- Result: PASS

### Step 2 — Remove legacy Home direct-write handlers

- File:
  - `packages/worker-base/system-models/intent_handlers_home.json`
- Changes:
  - delete legacy `handle_home_refresh`
  - delete legacy `handle_home_select_row`
  - delete legacy `handle_home_open_create`
  - delete legacy `handle_home_open_edit`
  - delete legacy `handle_home_save_label`
  - delete legacy `handle_home_delete_label`
  - delete legacy `handle_home_view_detail`
  - delete legacy `handle_home_close_detail`
  - delete legacy `handle_home_close_edit`
- Kept:
  - `home_*` root `pin.table.in`
  - `home_pin_wiring`
  - `handle_home_emit_owner_requests`
  - `handle_home_pin_only_dispatch_blocked`
- Result: PASS

### Step 3 — Run cleanup + Home pin regressions

- Commands:
  - `node scripts/tests/test_0252_home_legacy_handler_cleanup_contract.mjs`
  - `node scripts/tests/test_0249_home_crud_pin_migration_contract.mjs`
  - `node scripts/tests/test_0212_home_crud_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`
- Result:
  - all PASS

## Final Adjudication

- Decision: Completed
- Verdict:
  - Home legacy direct-write handlers removed
  - pin-only authoritative path preserved
