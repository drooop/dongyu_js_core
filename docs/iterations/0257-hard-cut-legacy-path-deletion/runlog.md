---
title: "0257 — hard-cut-legacy-path-deletion Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0257-hard-cut-legacy-path-deletion
id: 0257-hard-cut-legacy-path-deletion
phase: phase3
---

# 0257 — hard-cut-legacy-path-deletion Runlog

## Environment

- Date: `2026-03-29`
- Branch: `dev_0254-hard-cut-cellwise-authoring-runtime`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`

## Execution Records

### Step 1 — Remove positive example `page_asset_v0` sources

- Scope:
  - `1004`
  - `1005`
  - `1006`
  - `1007`
- Change:
  - removed authoritative `page_asset_v0` source labels
  - replaced them with `cellwise.ui.v1` root labels and node-level `ui_*` records
- Evidence:
  - `node scripts/tests/test_0257_legacy_path_inventory_contract.mjs`
  - `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`
  - browser screenshots:
    - `output/playwright/0257-hard-cut-legacy-path-deletion/0215-page-asset-cellwise.png`
    - `output/playwright/0257-hard-cut-legacy-path-deletion/0215-parent-mounted-cellwise.png`
    - `output/playwright/0257-hard-cut-legacy-path-deletion/0216-three-scene-cellwise.png`
- Result: PASS

### Step 2 — Add migration/runtime helpers required by hard-cut

- Files:
  - `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`
  - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
  - `packages/ui-model-demo-frontend/src/route_ui_projection.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/gallery_store.js`
  - `scripts/lib/page_asset_to_cellwise.mjs`
- Change:
  - compiler now supports:
    - `ui_props_json`
    - `ui_bind_read_json`
    - `ui_bind_write_json`
    - `ui_bind_json`
  - route page resolver now falls back from legacy `asset_ref.page_asset_v0` to cellwise model source
  - gallery/local demo consumers now accept cellwise model pages as authoritative route source
- Evidence:
  - `node scripts/tests/test_0191a_page_asset_resolver.mjs`
  - `node scripts/tests/test_0191b_gallery_asset_resolution.mjs`
  - `node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
  - `node scripts/tests/test_0254_cellwise_authoring_runtime_contract.mjs`
  - `node scripts/tests/test_0257_page_asset_to_cellwise_migration_contract.mjs`
- Result: PASS

### Step 3 — Remove system-page `page_asset_v0` sources

- Scope:
  - `-21 Prompt`
  - `-22 Home`
  - `-23 Docs`
  - `-24 Static`
  - `-25 Workspace`
  - `-26 editor_test_catalog`
  - `-100 Matrix Debug`
  - `-103 Gallery`
- Change:
  - migrated authoritative route pages from hand-authored `page_asset_v0` source to `cellwise.ui.v1`
  - kept page-catalog `asset_ref.page_asset_v0` only as route metadata / compatibility metadata
- Evidence:
  - `node scripts/tests/test_0212_home_crud_contract.mjs`
  - `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `node scripts/tests/test_0216_threejs_scene_contract.mjs`
  - `node scripts/tests/test_0217_gallery_extension_contract.mjs`
  - `node scripts/tests/test_0235_home_surface_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
- Result: PASS

### Step 4 — Restore local live deploy path

- File:
  - `scripts/ops/deploy_local.sh`
- Change:
  - added local fallback to classic builder when Docker BuildKit hits registry TLS verification failure
- Result:
  - local `bash scripts/ops/deploy_local.sh` succeeds again
  - `bash scripts/ops/check_runtime_baseline.sh` returns PASS
- Result: PASS

### Step 5 — Restore Matrix Debug live snapshot visibility

- File:
  - `packages/ui-model-demo-server/server.mjs`
- Change:
  - `TRACE_MODEL_ID=-100` snapshot projection now keeps root summary plus `p=2` cellwise UI node cells
- Evidence:
  - live `/snapshot`:
    - `ui_authoring_version = cellwise.ui.v1`
    - `ui_root_node_id = matrix_debug_root`
    - `p2_count > 0`
  - `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
- Result: PASS

### Step 6 — Final contract sweep

- Commands:
  - `node scripts/tests/test_0191a_page_asset_resolver.mjs`
  - `node scripts/tests/test_0191b_gallery_asset_resolution.mjs`
  - `node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
  - `node scripts/tests/test_0212_home_crud_contract.mjs`
  - `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `node scripts/tests/test_0216_threejs_scene_contract.mjs`
  - `node scripts/tests/test_0217_gallery_extension_contract.mjs`
  - `node scripts/tests/test_0235_home_surface_contract.mjs`
  - `node scripts/tests/test_0254_cellwise_authoring_runtime_contract.mjs`
  - `node scripts/tests/test_0255_bind_write_pin_only_cutover_contract.mjs`
  - `node scripts/tests/test_0257_legacy_path_inventory_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
- Result:
  - all PASS

### Step 7 — Browser evidence

- Source-mode screenshots:
  - `output/playwright/0257-hard-cut-legacy-path-deletion/system-local/home-local-cellwise.png`
  - `output/playwright/0257-hard-cut-legacy-path-deletion/system-local/prompt-local-cellwise.png`
  - `output/playwright/0257-hard-cut-legacy-path-deletion/system-local/gallery-local-cellwise.png`
  - `output/playwright/0257-hard-cut-legacy-path-deletion/system-local/matrix-debug-local-cellwise.png`
- Live local screenshots:
  - `output/playwright/0257-hard-cut-legacy-path-deletion/system-live/home-live-cellwise.png`
  - `output/playwright/0257-hard-cut-legacy-path-deletion/system-live/prompt-live-cellwise.png`
  - `output/playwright/0257-hard-cut-legacy-path-deletion/system-live/gallery-live-cellwise.png`
  - `output/playwright/0257-hard-cut-legacy-path-deletion/system-live/matrix-debug-live-cellwise.png`
- Result: PASS

## Final Adjudication

- Decision: Completed
- Verdict:
  - authoritative `page_asset_v0` authoring source has been removed from migrated route pages
  - `cellwise.ui.v1` is now the authoritative source for positive example pages and system pages covered by 0257
  - hard-cut closeout validation passed in contract, validator, source-mode browser, and local live browser paths
