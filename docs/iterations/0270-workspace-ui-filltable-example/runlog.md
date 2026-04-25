---
title: "Iteration 0270-workspace-ui-filltable-example Run Log"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0270-workspace-ui-filltable-example
id: 0270-workspace-ui-filltable-example
phase: phase3
---

# Iteration 0270-workspace-ui-filltable-example Run Log

## Environment
- OS: macOS
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Branch: `dev_0270-workspace-ui-filltable-example`

### Review Gate Records (FACTS)
```text
Review Gate Record
- Iteration ID: 0270-workspace-ui-filltable-example
- Review Date: 2026-03-31
- Review Type: User
- Reviewer: user
- Review Index: 1
- Decision: Approved
- Notes: user approved the final design: Workspace sibling entry, scheme B layout, single example that can switch from remote dual-bus mode to local program-model mode via fill-table edits, with deletion/rebuild guide.
```

## Implementation Facts

- Added preloaded Workspace app host `Model 1009` and child truth `Model 1010`.
- Added authoritative Workspace registry entry and `Model 0 -> 1009 -> 1010` mount chain.
- Added remote path:
  - `Model 1010` dual-bus submit
  - `Model 0 ws_filltable_submit_out`
  - `MBR mbr_route_1010`
  - `remote-worker 11_model1010.json`
- Added local path:
  - `Model 1010 (1,0,0) processor_routes`
  - `dispatch_local`
  - helper-cell owner materialization
- Added label-driven UI parameters:
  - `layout_direction`
  - `input_font_size`
  - `button_variant`
  - `button_color`
- Added Home debug behavior:
  - `home_save_label` can create a missing positive model when the first saved label is root `model_type`
- Added/updated user guide:
  - `docs/user-guide/workspace_ui_filltable_example.md`
  - `docs/user-guide/README.md`

## Script Verification (FACTS)

Executed and PASS:

- `node scripts/tests/test_0270_workspace_ui_filltable_example_contract.mjs`
- `node scripts/tests/test_0270_workspace_ui_filltable_mount_contract.mjs`
- `node scripts/tests/test_0270_workspace_ui_filltable_remote_mode_contract.mjs`
- `node scripts/tests/test_0270_workspace_ui_filltable_local_mode_contract.mjs`
- `node scripts/tests/test_0270_workspace_ui_filltable_props_contract.mjs`
- `node scripts/tests/test_0270_workspace_ui_filltable_doc_contract.mjs`
- `node scripts/tests/test_0269_model100_live_submit_registration_contract.mjs`
- `node scripts/tests/test_0249_home_crud_pin_migration_contract.mjs`
- `node scripts/tests/test_0144_remote_worker.mjs`
- `node scripts/tests/test_0144_mbr_compat.mjs`
- `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
- `node scripts/tests/test_0216_threejs_scene_contract.mjs`

## Deploy / Live Verification (FACTS)

Local deploy / restart evidence:

- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- `docker build -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 . && kubectl -n dongyu rollout restart deployment/ui-server && kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`
- `SKIP_IMAGE_BUILD=1 SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- `bash scripts/ops/check_runtime_baseline.sh` -> `baseline ready`

Required live checks:

1. Home CRUD
   - live `home_save_label` route returned `{"result":"ok","routed_by":"pin"}` for:
     - `processor_routes` switch to local
     - `layout_direction = row-reverse`
     - `button_color = #DC2626`
   - focused contract `test_0249_home_crud_pin_migration_contract.mjs` also PASS
2. Gallery slider
   - Workspace -> Gallery page opened successfully
   - slider surface rendered with current value `42`
3. Workspace mount chain
   - `/snapshot` showed `ws_apps_registry` contains `1009`
   - `/snapshot` showed `Model 0 (2,0,8)` holds `model.submt -> 1009` and `ws_filltable_submit_bridge`
   - sidebar no longer exposes `1010` as a separate app after `deriveWorkspaceRegistry` fix
4. Color generator
   - browser click changed displayed color from `#5fe739` to `#8c47bd`
   - `/snapshot` confirmed `bg_color="#8c47bd"`, `status="processed"`, `submit_inflight=false`
   - `mbr-worker` logs showed `/100/event` publish and `/100/patch_out` receive
   - `remote-worker` logs showed `/100/event` inbound and `/100/patch_out` publish
5. remote-worker + MBR compliance
   - `mbr-worker` logs showed `1010/event` publish and `1010/patch_out` receive in remote mode
   - `remote-worker` logs showed `1010/event` inbound and `1010/patch_out` publish in remote mode
   - local mode verification used `--since=30s` logs and observed no new `1010/event` / `1010/patch_out`

New example live checks:

- Remote mode:
  - browser opened `0270 Fill-Table Workspace UI`
  - input `Gamma1 Remote`
  - click `Confirm`
  - page result changed to `#3b80f2`
  - `/snapshot` confirmed:
    - `generated_color_text="#3b80f2"`
    - `result_status="remote_processed"`
    - `submit_route_mode="remote"`
- Local mode:
  - switched via Home save path by replacing `Model 1010 (1,0,0) processor_routes`
  - page result changed to `#601666`
  - `/snapshot` confirmed:
    - `generated_color_text="#601666"`
    - `result_status="local_processed"`
    - `submit_route_mode="local"`
  - `mbr-worker --since=30s` contained no new `1010/event|1010/patch_out`
- Parameterized UI:
  - `button_color="#DC2626"` rendered as `rgb(220, 38, 38)` in browser
  - browser DOM inspection found a wrapper containing `Input + Confirm` with `flexDirection="row-reverse"`

## Notes

- Browser snapshots do not always surface flex order directly; final layout confirmation used DOM style inspection on the live page.
- The documented rebuild path uses the Home debug save route to create a missing positive model by first saving root `model_type`.
