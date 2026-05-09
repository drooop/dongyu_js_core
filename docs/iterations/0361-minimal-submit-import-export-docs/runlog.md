---
title: "0361 Minimal Submit Import Export Docs Runlog"
doc_type: iteration_runlog
status: completed
updated: 2026-05-07
source: ai
iteration: 0361-minimal-submit-import-export-docs
---

# Iteration 0361-minimal-submit-import-export-docs Runlog

## Environment

- Date: 2026-05-07
- Branch: `dev_0361-minimal-submit-import-export-docs`
- Runtime: local `http://127.0.0.1:30900`
- Review Gate Record
- Iteration ID: 0361-minimal-submit-import-export-docs
- Review Date: 2026-05-07
- Review Type: User-directed execution
- Review Index: 1
- Decision: Approved
- Notes: User requested saving the minimal Submit dual-bus JSON, performing real browser zip upload/install/runtime verification, and documenting how future developers generate/export installable zip packages.

## Execution Records

### Step 1

- Command: create 0361 scaffold and register `docs/ITERATIONS.md`.
- Key output: branch `dev_0361-minimal-submit-import-export-docs`; iteration row added as In Progress.
- Result: PASS
- Commit: pending

### Step 2

- Command: save `test_files/minimal_submit_dual_bus_app_payload.json`; generate `test_files/minimal_submit_dual_bus.zip` with one `app_payload.json`.
- Key output: `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs` validates payload shape, no legacy API/labels, zip shape, import, export, and re-import.
- Result: PASS
- Commit: pending

### Step 3

- Command: add `GET /api/slide-apps/<modelId>/export.zip`, Workspace `export_url` / `export_label`, and compact `Zip` action.
- Key output: exported zip for imported Model 1053 returned `200 application/zip`, one `app_payload.json`, 65 records, `ui_text_ref_model_id=0`, and no generated host labels.
- Result: PASS
- Commit: pending

### Step 4

- Command: update provider guide, visualized markdown, and interactive HTML with direct records authoring plus Workspace/API zip export path.
- Key output:
  - `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs` -> 4 passed.
  - `node scripts/tests/test_0352_slide_app_provider_visualized_docs_contract.mjs` -> 5 passed.
  - `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs` -> 3 passed.
- Result: PASS
- Commit: pending

### Step 5

- Command: rebuild `dy-ui-server:v1`, sync persisted docs/assets, restart local `ui-server`, and run baseline.
- Key output: `bash scripts/ops/check_runtime_baseline.sh` -> baseline ready.
- Result: PASS
- Commit: pending

### Step 6

- Command: Playwright real browser at `http://127.0.0.1:30900/?v=0361d#/workspace`.
- Key output:
  - Opened `滑动 APP 导入`.
  - Uploaded `/Users/drop/codebase/cowork/dongyuapp_elysia_based/test_files/minimal_submit_dual_bus.zip`.
  - Clicked `导入 Slide App`.
  - New imported app Model 1053 appeared with `/api/slide-apps/1053/export.zip`.
  - Filled `zip remap browser 0361`, clicked `Submit`.
  - Browser displayed `REMOTE sending`.
  - Snapshot confirmed Model 1053 `remote_status=sending`, `last_submit_payload` contains `text=zip remap browser 0361`, and Model 0 has `imported_submit_1053_bus` `pin.bus.out`.
- Result: PASS
- Commit: pending

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed; no SSOT semantic change required for packaging/export.
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed; detailed developer instructions are under `docs/user-guide/slide-app-runtime/`.
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed; no governance change required.
