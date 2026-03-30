---
title: "0243 — home-mailbox-crud-for-filltable Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-03-26
source: ai
iteration_id: 0243-home-mailbox-crud-for-filltable
id: 0243-home-mailbox-crud-for-filltable
phase: phase3
---

# 0243 — home-mailbox-crud-for-filltable Runlog

## Environment

- Date: `2026-03-26`
- Branch: `dropx/dev_0243-home-mailbox-crud-for-filltable`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`

## Review Gate Record

- Iteration ID: `0243-home-mailbox-crud-for-filltable`
- Review Date: `2026-03-26`
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户明确要求按方案 1 实现，且 action 名必须以 `0212` contract 为准。

## Execution Records

### Step 1 — Freeze 0212 Contract As RED

- Commands:
  - `node scripts/tests/test_0212_home_crud_contract.mjs`
- Key output:
  - RED before implementation:
    - `home_asset_must_materialize_action:home_refresh`
    - `intent_dispatch_table_must_register_home_refresh`
- Result: PASS

### Step 2 — Materialize Home CRUD UI

- Files:
  - `packages/worker-base/system-models/home_catalog_ui.json`
- Changes:
  - `Refresh` 改为 `home_refresh`
  - 增加 `+ Add Label`
  - 表格新增 `Actions` 列
  - 每行新增：
    - `home_select_row`
    - `home_open_edit`
    - `home_view_detail`
    - `home_delete_label`
  - 新增：
    - edit dialog
    - detail dialog
- Result: PASS

### Step 3 — Add Mailbox Handlers

- Files:
  - `packages/worker-base/system-models/intent_dispatch_config.json`
  - `packages/worker-base/system-models/intent_handlers_home.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - `scripts/ops/sync_local_persisted_assets.sh`
- Changes:
  - `intent_dispatch_table` 注册全部 `home_*`
  - `intent_handlers_home.json` 定义：
    - `handle_home_refresh`
    - `handle_home_select_row`
    - `handle_home_open_create`
    - `handle_home_open_edit`
    - `handle_home_save_label`
    - `handle_home_delete_label`
    - `handle_home_view_detail`
    - `handle_home_close_detail`
    - `handle_home_close_edit`
  - server state 补齐 `home_* / dt_*` labels seed 与 derived sync
  - local adapter 对 `home_*` 明确返回 `home_remote_only`
  - persisted asset sync 纳入 `intent_handlers_home.json`
- Result: PASS

### Step 4 — Focused Validation

- Commands:
  - `node scripts/tests/test_0212_home_crud_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_home_crud_local.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
- Key output:
  - `test_0212_home_crud_contract`: PASS
  - `validate_home_crud_local`: PASS
  - `validate_home_crud_server_sse`: PASS
    - verified `create -> view -> close_detail -> edit -> select -> delete`
  - frontend build: PASS
  - local deploy: PASS
  - baseline ready: PASS
- Result: PASS

### Step 5 — Browser Evidence

- Browser page:
  - `http://127.0.0.1:30900/`
- Artifacts:
  - `output/playwright/0243-home-mailbox-crud-for-filltable/home-crud-controls.png`
- Key output:
  - Home page now materializes:
    - `+ Add Label`
    - per-row `Select / Edit / Detail / Delete`
  - live `/snapshot` after browser-assisted smoke confirmed:
    - `selected_model_id = "1003"`
    - `home_status_text = "deleted playwright_home_crud on model 1003"`
    - target label was created/updated/deleted through Home CRUD path
- Adjudication:
  - Home page can now directly fill positive-model labels through mailbox-based CRUD
  - positive business writes still do not bypass ownership rules
- Result: PASS
