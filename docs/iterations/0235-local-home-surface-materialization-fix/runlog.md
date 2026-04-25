---
title: "0235 — local-home-surface-materialization-fix Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0235-local-home-surface-materialization-fix
id: 0235-local-home-surface-materialization-fix
phase: phase3
---

# 0235 — local-home-surface-materialization-fix Runlog

## Environment

- Date: 2026-03-26
- Branch: `dropx/dev_0235-local-home-surface-materialization-fix`
- Runtime: local Home surface repair

## Execution Records

### Step 1 — Freeze Home Drift Contract

- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && jq -r '.home.surface_marker, .home.legacy_home_datatable_detected' output/playwright/20ad18d0-3e52-4c48-9935-0464f8b4fbc2/local-effective-rerun/report.json`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "txt_home_target|home-datatable|card_home_datatable|TableColumn" packages/worker-base/system-models/home_catalog_ui.json`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && python3 - <<'PY'\nimport json, urllib.request\nobj=json.load(urllib.request.urlopen('http://127.0.0.1:30900/snapshot', timeout=10))\nprint(obj['snapshot']['models']['-22']['cells']['0,1,0']['labels']['page_asset_v0']['v']['id'])\nPY`
- Key output:
  - browser report:
    - `home.surface_marker = home-datatable`
    - `home.legacy_home_datatable_detected = true`
  - repo authoritative asset:
    - `txt_home_target`
    - `text: target: home-datatable`
    - `card_home_datatable`
    - multiple `TableColumn`
  - local baseline gate:
    - outer shell `check_runtime_baseline.sh` = PASS
    - live snapshot root id = `root_home`
- Adjudication:
  - Home drift 并非单纯 route misroute；`root_home` authoritative asset 本体仍暴露 legacy datatable chrome。
- Result: PASS

### Step 2 — Localize Authoritative Asset vs Projection Mismatch

- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_home_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "home_open_create|home_open_edit|home_save_label|home_delete_label|home_view_detail|home_close_detail|home_close_edit|datatable_refresh" packages scripts -g '*.json' -g '*.js' -g '*.mjs'`
- Key output:
  - `test_0191d_home_asset_resolution`: PASS
  - `test_0212_home_crud_contract`: PASS, but only enforces action-set contract and keeps `datatable_refresh` shell
  - `validate_demo.mjs`: existing demo-level AST resolution still green
  - repo search shows:
    - only `datatable_refresh` is materialized in runtime/UI code
    - `home_open_create` 等 actions only appear in contract tests, not live materialized surface
- Adjudication:
  - 当前最小可修缺口是 Home asset chrome/marker drift，而不是先去扩张成完整 CRUD implementation。
- Result: PASS

### Step 3 — Fix Minimal Home Surface Chain

- Command:
  - RED:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0235_home_surface_contract.mjs`
  - GREEN:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0235_home_surface_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_home_asset_resolution.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_surface_local.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - RED:
    - `home_surface_must_not_expose_legacy_home_datatable_marker`
  - change:
    - `txt_home_target -> txt_home_surface`
    - `target: home-datatable -> surface: root_home`
    - `card_home_datatable -> card_home_catalog`
    - `DataTable -> Home Catalog`
    - new focused test:
      - `scripts/tests/test_0235_home_surface_contract.mjs`
    - new focused validator:
      - `packages/ui-model-demo-frontend/scripts/validate_home_surface_local.mjs`
  - GREEN:
    - `test_0235_home_surface_contract`: PASS
    - `test_0191d_home_asset_resolution`: PASS
    - `test_0212_home_crud_contract`: PASS
    - `validate_home_surface_local`: PASS
    - frontend build: PASS
- Result: PASS
- Commit: `6949703` (`fix(home): remove legacy datatable chrome from root_home`)

### Step 4 — Re-verify Local Home Surface

- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/deploy_local.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_home_surface_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && python3 - <<'PY'\nimport json, urllib.request\nobj=json.load(urllib.request.urlopen('http://127.0.0.1:30900/snapshot', timeout=10))\nlabels=obj['snapshot']['models']['-22']['cells']['0,1,0']['labels']['page_asset_v0']['v']\nprint(labels['id'])\nprint(labels['children'][0]['children'][0]['id'])\nprint(labels['children'][0]['children'][0]['props']['text'])\nprint(labels['children'][0]['children'][1]['id'])\nprint(labels['children'][0]['children'][1]['props']['title'])\nPY`
  - focused browser spot-check at `http://127.0.0.1:30900/#/`
- Key output:
  - `deploy_local.sh`: full stack local deploy complete
  - `check_runtime_baseline.sh`: PASS
  - `validate_home_surface_local`: PASS
  - live snapshot:
    - `root_home`
    - `txt_home_surface`
    - `surface: root_home`
    - `card_home_catalog`
    - `Home Catalog`
  - fresh browser spot-check:
    - page now shows `surface: root_home`
    - page title chrome now shows `Home Catalog`
    - no `home-datatable` or `DataTable` chrome remains
  - screenshot:
    - [home-focused.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/0235-local-home-surface-materialization-fix/home-focused.png)
- Final verdict: `Home surface aligned`

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] `docs/iterations/0234-local-browser-evidence-effective-rerun/runlog.md` reviewed

```
Review Gate Record
- Iteration ID: 0235-local-home-surface-materialization-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: Manual planning completion and review-plan acceptance after planning stall. 0235 plan/resolution are now self-contained and correctly reframed around authoritative root_home asset still carrying legacy home-datatable marker/readonly table shape, with asset-first repair and concrete validator names.
```

```
Review Gate Record
- Iteration ID: 0235-local-home-surface-materialization-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: Manual REVIEW_EXEC acceptance after outer-shell focused repair. Home authoritative asset no longer exposes home-datatable/DataTable chrome, focused contract tests pass, local deploy completed, local baseline gate is green, live snapshot shows surface: root_home, and fresh browser spot-check shows Home Catalog without legacy chrome.
```
