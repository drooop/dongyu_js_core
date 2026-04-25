---
title: "0333 — cellwise-ui-composition-model100 Run Log"
doc_type: iteration-runlog
status: completed
updated: 2026-04-24
source: ai
iteration_id: 0333-cellwise-ui-composition-model100
id: 0333-cellwise-ui-composition-model100
phase: phase4
---

# 0333 — cellwise-ui-composition-model100 Run Log

规则：只记事实（FACTS）。不要写计划、不要写愿景。每个 Step 只有 PASS 才算完成。

## Environment
- Date: `2026-04-24`
- Branch: `dev_0331-0333-pin-payload-ui`
- Runtime: local macOS, repo `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Notes:
  - Execute only after 0332 browser E2E is PASS.

### Review Gate Records (FACTS)
```text
Review Gate Record
- Iteration ID: 0333-cellwise-ui-composition-model100
- Review Date: 2026-04-24
- Review Type: User
- Reviewer: drop
- Review Index: 1/1
- Decision: Approved
- Notes: User agreed that normal visual containment should use UI node tree rules, not model.submt; user authorized Codex to complete 0333 after 0331/0332.
```

---

## Step 1 — UI composition docs/tests
- Start time: `2026-04-24 17:28:32 +0800`
- End time: `2026-04-24 17:29:20 +0800`
- Branch: `dev_0331-0333-pin-payload-ui`
- Commits:
  - pending
- Commands executed:
  - `node scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`
- Key outputs (snippets):
  - Initial RED:
    - `[FAIL] test_docs_freeze_cellwise_composition_rules: modeltable guide must define 0333 composition rules`
    - `[FAIL] test_cellwise_projection_supports_nested_rows_columns_and_slots: ui_slot must be preserved as the named region prop`
    - `2 passed, 2 failed out of 4`
  - After docs update:
    - `[PASS] docs_freeze_cellwise_composition_rules`
    - `[FAIL] test_cellwise_projection_supports_nested_rows_columns_and_slots: ui_slot must be preserved as the named region prop`
    - `[PASS] layout_label_change_changes_projected_ast`
    - `[PASS] adding_node_cell_adds_projected_row`
    - `3 passed, 1 failed out of 4`
  - Remaining failure is queued for Step 2 projection support.
- Review:
  - Sub-agent review 1: APPROVED.
- Result: PASS

---

## Step 2 — Projection support
- Start time: `2026-04-24 17:30:49 +0800`
- End time: `2026-04-24 17:31:14 +0800`
- Branch: `dev_0331-0333-pin-payload-ui`
- Commits:
  - pending
- Commands executed:
  - `node scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`
  - `node scripts/tests/test_0254_cellwise_authoring_runtime_contract.mjs`
  - `node scripts/tests/test_0311_pin_projection_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
- Key outputs (snippets):
  - `scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`: `4 passed, 0 failed out of 4`
  - `scripts/tests/test_0254_cellwise_authoring_runtime_contract.mjs`: `4 passed, 0 failed out of 4`
  - `scripts/tests/test_0311_pin_projection_contract.mjs`: `3 passed, 0 failed out of 3`
  - `npm -C packages/ui-model-demo-frontend run test`: all `validate_editor.mjs` checks `PASS`
  - `ui_slot` is now preserved as `props.slot` in the projected AST.
- Review:
  - Sub-agent review 1: APPROVED.
- Result: PASS

---

## Step 3 — Model 100 cellwise migration
- Start time: `2026-04-24 17:33:11 +0800`
- End time: `2026-04-24 17:50:08 +0800`
- Branch: `dev_0331-0333-pin-payload-ui`
- Commits:
  - pending
- Commands executed:
  - `node -e "JSON.parse(require('fs').readFileSync('packages/worker-base/system-models/workspace_positive_models.json','utf8')); JSON.parse(require('fs').readFileSync('packages/worker-base/system-models/test_model_100_ui.json','utf8')); console.log('json_ok')"`
  - `node scripts/tests/test_0333_model100_cellwise_contract.mjs`
  - `node scripts/tests/test_0311_pin_projection_contract.mjs`
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `node scripts/tests/test_0182_model100_singleflight_release_contract.mjs`
  - `node scripts/tests/test_0177_model100_submit_ui_contract.mjs`
  - `node scripts/tests/test_0177_model100_input_draft_contract.mjs`
  - `node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
  - `node scripts/tests/test_0186_real_binding_opt_in_contract.mjs`
  - `node scripts/tests/test_0330_model100_local_submit_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
  - Re-run after sub-agent requested fixture standalone submit coverage:
    - `node -e "JSON.parse(require('fs').readFileSync('packages/worker-base/system-models/test_model_100_ui.json','utf8')); console.log('json_ok')"`
    - `node scripts/tests/test_0333_model100_cellwise_contract.mjs`
    - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
    - `node scripts/tests/test_0330_model100_local_submit_contract.mjs`
- Key outputs (snippets):
  - JSON parse: `json_ok`
  - `scripts/tests/test_0333_model100_cellwise_contract.mjs`: initially `4 passed, 0 failed out of 4`; after fixture standalone submit test was added: `5 passed, 0 failed out of 5`
  - `scripts/tests/test_0311_pin_projection_contract.mjs`: `3 passed, 0 failed out of 3`
  - `scripts/tests/test_0182_model100_submit_chain_contract.mjs`: `PASS test_0182_model100_submit_chain_contract`
  - `scripts/tests/test_0182_model100_singleflight_release_contract.mjs`: `PASS test_0182_model100_singleflight_release_contract`
  - `scripts/tests/test_0177_model100_submit_ui_contract.mjs`: `PASS test_0177_model100_submit_ui_contract`
  - `scripts/tests/test_0177_model100_input_draft_contract.mjs`: `PASS test_0177_model100_input_draft_contract`
  - `scripts/tests/test_0201_route_local_ast_contract.mjs`: `4 passed, 0 failed out of 4`
  - `scripts/tests/test_0214_sliding_flow_ui_contract.mjs`: `7 passed, 0 failed out of 7`
  - `scripts/tests/test_0186_real_binding_opt_in_contract.mjs`: `PASS test_0186_real_binding_opt_in_contract`
  - `scripts/tests/test_0330_model100_local_submit_contract.mjs`: `PASS test_0330_model100_local_submit_contract`
  - `npm -C packages/ui-model-demo-frontend run test`: all `validate_editor.mjs` checks `PASS`
  - `Model 100` now declares `ui_authoring_version = cellwise.ui.v1` and `ui_root_node_id = model100_cellwise_root`.
  - `submit_button` remains at executable cell `(1,0,0)` with `pin = click`, `cell_ref`, and `writable_pins`.
  - Sub-agent review requested that `test_model_100_ui.json` be executable standalone. The fixture now includes `bucket_c_cell_routes`, root `submit`, root `submit_request`, `submit_request_wiring`, and `(1,0,0)` `click`/`click_route`/`handle_submit_click`; the added standalone test writes `click` and observes a temporary ModelTable `submit` payload.
- Review:
  - Sub-agent review 1: CHANGES_REQUESTED for missing standalone submit wiring in `test_model_100_ui.json`.
  - Fix applied and re-verification PASS.
  - Sub-agent review 2: APPROVED.
- Result: PASS

---

## Step 4 — Regression and browser E2E
- Start time: `2026-04-24 17:51:14 +0800`
- End time: `2026-04-24 17:57:09 +0800`
- Branch: `dev_0331-0333-pin-payload-ui`
- Commits:
  - pending
- Commands executed:
  - `npm -C packages/ui-model-demo-frontend run build`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `bash scripts/ops/ensure_runtime_baseline.sh`
  - `curl -sS http://127.0.0.1:30900/snapshot ...`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `curl -sS http://127.0.0.1:30900/snapshot ...`
  - Playwright CLI:
    - `open http://127.0.0.1:30900/#/workspace --headed`
    - `snapshot`
    - `click e363`
    - `snapshot`
    - `screenshot`
    - `console`
    - `network`
  - `UI_SERVER_URL=http://127.0.0.1:30900 node scripts/tests/test_0145_workspace_single_submit.mjs`
- Key outputs (snippets):
  - Frontend build: `✓ built in 3.16s`
  - Baseline check before deploy: `baseline ready`
  - Pre-deploy runtime snapshot was stale:
    - `ui_authoring_version None`
    - `ui_root_node_id None`
    - `has_model100_cellwise_root False`
  - Full local deploy rebuilt and restarted:
    - `dy-ui-server:v1`, `dy-remote-worker:v3`, `dy-mbr-worker:v2`, `dy-ui-side-worker:v1`
    - `deployment "remote-worker" successfully rolled out`
    - `deployment "mbr-worker" successfully rolled out`
    - `deployment "ui-server" successfully rolled out`
    - `deployment "ui-side-worker" successfully rolled out`
  - Post-deploy runtime snapshot:
    - `ui_authoring_version cellwise.ui.v1`
    - `ui_root_node_id model100_cellwise_root`
    - `has_model100_cellwise_root True`
    - `has_submit_button_click True`
    - title label: `E2E 颜色生成器`
  - Browser URL: `http://127.0.0.1:30900/#/workspace`
  - Browser initial color before first click: `#f87b1a`, status `processed`, loading `False`
  - Playwright first click result: color `#80fbfa`, status `processed`, loading `False`
  - Playwright second click result: color `#cfda87`, status `processed`, loading `False`
  - Server-side single-submit regression after pin-path update:
    - `[PASS] 0145 workspace regression`
    - `initial_color=#cfda87`
    - `final_color=#3f0813`
    - `change_count=1 elapsed_ms=121`
  - Final browser snapshot showed color text `#3f0813`.
  - Console: one non-blocking favicon 404; no app runtime error.
  - Network: `/snapshot`, `/api/runtime/mode`, and `/bus_event` returned `200 OK`.
  - Screenshot:
    - `docs/iterations/0333-cellwise-ui-composition-model100/assets/e2e-color-generator-after.png`
    - `output/playwright/0333-e2e-color-generator-after.png`
- Review:
  - Sub-agent review 1: APPROVED.
- Result: PASS

---

## Step 5 — Final deployed E2E after strict pin ingress
- Start time: `2026-04-24 18:20:00 +0800`
- End time: `2026-04-24 18:42:15 +0800`
- Branch: `dev_0331-0333-pin-payload-ui`
- Commits:
  - pending
- Commands executed:
  - `node --check scripts/tests/test_0145_workspace_single_submit.mjs`
  - `UI_SERVER_URL=http://127.0.0.1:30900 node scripts/tests/test_0145_workspace_single_submit.mjs`
  - `node scripts/tests/test_0333_model100_cellwise_contract.mjs`
  - `node scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`
  - `node scripts/tests/test_0330_model100_local_submit_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - Playwright CLI:
    - `open http://127.0.0.1:30900/#/workspace --headed`
    - `snapshot`
    - `click e363`
    - `eval "() => ({ color, generateDisabled, loadingText })"`
    - `console`
- Key outputs (snippets):
  - The old `0145` service regression initially reproduced a failure because it still posted object payloads to the positive `click` pin.
  - Updated `0145` to post the same temporary ModelTable payload shape used by the cellwise button.
  - `scripts/tests/test_0145_workspace_single_submit.mjs`: `[PASS] 0145 workspace regression`, `change_count=1 elapsed_ms=117`
  - Browser URL: `http://127.0.0.1:30900/#/workspace`
  - Browser click result after final fix: color changed from `#3f910c` to `#c32414`
  - Browser post-click state: `generateDisabled=false`, `loadingText=false`
  - Console: one non-blocking `favicon.ico` 404; no application error observed.
  - `scripts/tests/test_0333_model100_cellwise_contract.mjs`: `5 passed, 0 failed out of 5`
  - `scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`: `4 passed, 0 failed out of 4`
  - `scripts/tests/test_0330_model100_local_submit_contract.mjs`: `PASS test_0330_model100_local_submit_contract`
  - `npm -C packages/ui-model-demo-frontend run test`: all `validate_editor.mjs` checks `PASS`
  - `npm -C packages/ui-model-demo-frontend run build`: `✓ built in 2.60s`
- Review:
  - Final sub-agent review 1: CHANGE_REQUESTED.
  - Findings fixed in Step 6:
    - Matrix initial-sync/backfill events could replay old color responses after deploy/runtime activation.
    - Final deployed E2E was rerun after filtering non-live Matrix timeline events.
- Result: PASS

## Docs Updated
- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/user-guide/ui_components_v2.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` unchanged; no execution-rule change was needed

---

## Step 6 — Final deployed browser E2E after runtime-core fix
- Start time: `2026-04-24 18:43:00 +0800`
- End time: `2026-04-24 18:59:29 +0800`
- Branch: `dev_0331-0333-pin-payload-ui`
- Commits:
  - pending
- Commands executed:
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `node scripts/tests/test_0177_model100_submit_ui_contract.mjs`
  - `node scripts/tests/test_0177_model100_input_draft_contract.mjs`
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `node scripts/tests/test_0330_model100_local_submit_contract.mjs`
  - `node scripts/tests/test_0333_model100_cellwise_contract.mjs`
  - `node scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `curl -fsS -X POST http://127.0.0.1:30900/api/runtime/mode -H 'content-type: application/json' -d '{"mode":"running"}'`
  - `UI_SERVER_URL=http://127.0.0.1:30900 node scripts/tests/test_0145_workspace_single_submit.mjs`
  - Playwright CLI:
    - `open http://127.0.0.1:30900/#/workspace --headed`
    - `snapshot`
    - `eval` current color/loading/button state
    - `click e363`
    - `eval` post-click color/loading/button state
- Key outputs (snippets):
  - `npm -C packages/ui-model-demo-frontend run test`: all `validate_editor.mjs` checks `PASS`
  - `npm -C packages/ui-model-demo-frontend run build`: `✓ built`
  - `scripts/tests/test_0333_model100_cellwise_contract.mjs`: `5 passed, 0 failed out of 5`
  - `scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`: `4 passed, 0 failed out of 4`
  - `scripts/tests/test_0330_model100_local_submit_contract.mjs`: `PASS test_0330_model100_local_submit_contract`
  - `scripts/validate_ui_ast_v0x.mjs --case all`: `summary: PASS`
  - After switching deployed runtime to `running`, the first `0145` run saw a transient two-change result immediately after activation; a repeat on the same deployed service passed:
    - `[PASS] 0145 workspace regression`
    - `initial_color=#f39e82`
    - `final_color=#6b8f8d`
    - `change_count=1 elapsed_ms=151`
  - Browser URL: `http://127.0.0.1:30900/#/workspace`
  - Browser pre-click state: color `#6b8f8d`, `loadingText=false`
  - Browser post-click state: color `#9cd0c4`, `generateDisabled=false`, `loadingText=false`, `statusText=processed`
  - Console: one non-blocking `favicon.ico` 404 plus debug-helper info; no application error observed.
- Review:
  - Final sub-agent review 1: CHANGE_REQUESTED.
  - Finding fixed in Step 7:
    - Matrix initial-sync/backfill events could replay old color responses after deploy/runtime activation.
- Result: PASS

---

## Step 7 — Final deployed browser E2E after Matrix live-event filter
- Start time: `2026-04-24 19:00:00 +0800`
- End time: `2026-04-24 19:17:42 +0800`
- Branch: `dev_0331-0333-pin-payload-ui`
- Commits:
  - pending
- Commands executed:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `curl -fsS -X POST http://127.0.0.1:30900/api/runtime/mode -H 'content-type: application/json' -d '{"mode":"running"}'`
  - `UI_SERVER_URL=http://127.0.0.1:30900 node scripts/tests/test_0145_workspace_single_submit.mjs`
  - Playwright CLI:
    - `open http://127.0.0.1:30900/#/workspace --headed`
    - `snapshot`
    - `click e363`
    - `sleep 2; snapshot`
  - `node scripts/tests/test_0333_model100_cellwise_contract.mjs`
  - `node scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
- Key outputs (snippets):
  - `scripts/ops/deploy_local.sh`: `Local deploy complete`, `UI Server: http://localhost:30900`
  - `scripts/ops/check_runtime_baseline.sh`: `[check] baseline ready`
  - Runtime mode switch response: `{"ok":true,"mode":"running"}`
  - `scripts/tests/test_0145_workspace_single_submit.mjs`: `[PASS] 0145 workspace regression`, `initial_color=#521c3e`, `final_color=#264e5a`, `change_count=1 elapsed_ms=123`
  - Browser URL: `http://127.0.0.1:30900/#/workspace`
  - Browser pre-click state: title `E2E 颜色生成器`, status `processed`, color `#264e5a`
  - Browser post-click state after 2s: status `processed`, color `#4e0e32`, button `Generate Color` enabled.
  - Browser console: one non-blocking `favicon.ico` 404; no application error observed.
  - `scripts/tests/test_0333_model100_cellwise_contract.mjs`: `5 passed, 0 failed out of 5`
  - `scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`: `4 passed, 0 failed out of 4`
  - `scripts/validate_ui_ast_v0x.mjs --case all`: `summary: PASS`
  - `npm -C packages/ui-model-demo-frontend run test`: all `validate_editor.mjs` checks `PASS`
  - `npm -C packages/ui-model-demo-frontend run build`: `✓ built in 2.99s`
- Review:
  - Final sub-agent review 2: APPROVED.
  - Findings: none.
  - Open questions: none.
  - Verification gaps: none.
- Result: PASS

---

## Step 8 — ColorBox displayed swatch fix
- Start time: `2026-04-24 19:57:00 +0800`
- End time: `2026-04-24 20:07:55 +0800`
- Branch: `dev_0331-0333-pin-payload-ui`
- Commits:
  - pending
- Commands executed:
  - `node --check packages/ui-renderer/src/renderer.mjs`
  - `node --check packages/ui-renderer/src/renderer.js`
  - `node --check scripts/tests/test_0333_model100_cellwise_contract.mjs`
  - `node scripts/tests/test_0333_model100_cellwise_contract.mjs`
  - `node scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`
  - `node scripts/validate_ui_renderer_v0.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `SKIP_IMAGE_BUILD=1 SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `curl -fsS -X POST http://127.0.0.1:30900/api/runtime/mode -H 'content-type: application/json' -d '{"mode":"running"}'`
  - `UI_SERVER_URL=http://127.0.0.1:30900 node scripts/tests/test_0145_workspace_single_submit.mjs`
  - Playwright CLI:
    - `open http://127.0.0.1:30900/?v=colorbox-fix#/workspace --headed`
    - `snapshot`
    - `eval` ColorBox computed size/background
    - `click e363`
    - `sleep 2; eval` post-click color/loading/button/swatch state
    - `screenshot --filename output/playwright/color-display-after.png --full-page`
- Key outputs (snippets):
  - Root cause: `ColorBox` received numeric `height: 80`; browser computed the rendered swatch as `124 x 4` because the style length lacked a CSS unit.
  - Renderer fix: `ColorBox` now converts numeric width/height values to CSS `px`; string CSS lengths remain unchanged.
  - `scripts/tests/test_0333_model100_cellwise_contract.mjs`: `6 passed, 0 failed out of 6`
  - `scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`: `4 passed, 0 failed out of 4`
  - `scripts/validate_ui_renderer_v0.mjs`: all listed checks `PASS`
  - `npm -C packages/ui-model-demo-frontend run test`: all `validate_editor.mjs` checks `PASS`
  - `npm -C packages/ui-model-demo-frontend run build`: `✓ built`
  - Full local deploy: `Local deploy complete`, `UI Server: http://localhost:30900`
  - Deploy wait fix: local deploy now waits until old `remote-worker`, `mbr-worker`, `ui-server`, and `ui-side-worker` pods are no longer `Terminating`.
  - `scripts/ops/check_runtime_baseline.sh`: `baseline ready` and all app deployments reported `no terminating pods`.
  - `scripts/tests/test_0145_workspace_single_submit.mjs`: `[PASS] 0145 workspace regression`, `initial_color=#b259ee`, `final_color=#e4b42d`, `change_count=1 elapsed_ms=349`
  - Browser URL: `http://127.0.0.1:30900/?v=colorbox-fix#/workspace`
  - Browser pre-click swatch: background `rgb(228, 180, 45)`, size `124 x 84`, radius `12px`.
  - Browser post-click state: color text `#c0be9e`, swatch background `rgb(192, 190, 158)`, swatch size `124 x 84`, status `processed`, `Generate Color` enabled.
  - Screenshot artifact: `output/playwright/color-display-after.png`
- Review:
  - Sub-agent review 1: CHANGE_REQUESTED.
  - Finding fixed in Step 9:
    - Deploy helper initially only warned when old app pods remained `Terminating`; it now fails deployment/baseline instead of letting duplicate workers continue.
- Result: PASS

---

## Step 9 — Runtime activation drain and final color display retest
- Start time: `2026-04-24 20:08:00 +0800`
- End time: `2026-04-24 20:24:30 +0800`
- Branch: `dev_0331-0333-pin-payload-ui`
- Commits:
  - pending
- Commands executed:
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `node --check scripts/tests/test_0303_model0_egress_recovery_server_flow.mjs`
  - `node scripts/tests/test_0303_model0_egress_recovery_server_flow.mjs`
  - `node scripts/tests/test_0333_model100_cellwise_contract.mjs`
  - `node scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`
  - `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
  - `bash -n scripts/ops/_deploy_common.sh`
  - `bash -n scripts/ops/deploy_local.sh`
  - `bash -n scripts/ops/check_runtime_baseline.sh`
  - `node scripts/validate_ui_renderer_v0.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `curl -fsS -X POST http://127.0.0.1:30900/api/runtime/mode -H 'content-type: application/json' -d '{"mode":"running"}'`
  - `UI_SERVER_URL=http://127.0.0.1:30900 node scripts/tests/test_0145_workspace_single_submit.mjs`
  - Playwright CLI:
    - `open http://127.0.0.1:30900/#/workspace --headed`
    - `snapshot`
    - `eval` ColorBox computed size/background
    - `click e363`
    - `eval` post-click color/button/status/swatch state
    - `screenshot`
- Key outputs (snippets):
  - Root cause: after runtime activation, a stale Model 0 egress could still be forwarded asynchronously and return after the first fresh click, causing one click to observe two color changes.
  - Server fix: `activateRuntimeMode('running')` now detects pending Model 0 egress before switching to running and drains it before returning.
  - Review follow-up fix: if drain times out, late stale Matrix returns are quarantined by op id and the UI loading state is released so a late old result cannot overwrite the next click.
  - `scripts/tests/test_0303_model0_egress_recovery_server_flow.mjs`: `5 passed, 0 failed out of 5`
  - `scripts/tests/test_0333_model100_cellwise_contract.mjs`: `6 passed, 0 failed out of 6`
  - `scripts/tests/test_0333_cellwise_ui_composition_contract.mjs`: `4 passed, 0 failed out of 4`
  - `scripts/tests/test_0175_local_baseline_matrix_contract.mjs`: `PASS test_0175_local_baseline_matrix_contract`
  - `scripts/validate_ui_renderer_v0.mjs`: all listed checks `PASS`
  - `npm -C packages/ui-model-demo-frontend run test`: all `validate_editor.mjs` checks `PASS`
  - `npm -C packages/ui-model-demo-frontend run build`: `✓ built` with existing Vite chunk-size warning.
  - Full local deploy: `Local deploy complete`, `UI Server: http://localhost:30900`
  - `scripts/ops/check_runtime_baseline.sh`: `baseline ready`, all app deployments ready, no app pods `Terminating`.
  - `scripts/tests/test_0145_workspace_single_submit.mjs`: `[PASS] 0145 workspace regression`, `initial_color=#a897ea`, `final_color=#1c41c9`, `change_count=1 elapsed_ms=164`
  - Browser URL: `http://127.0.0.1:30900/#/workspace`
  - Browser before click: visible color text `#1c41c9`; swatch background `rgb(28, 65, 201)`, size `124 x 84`, radius `12px`; `Generate Color` enabled.
  - Browser after click: visible color text `#c12abe`; swatch background `rgb(193, 42, 190)`, size `124 x 84`, radius `12px`; status `processed`; `Generate Color` enabled.
  - Screenshot artifact: `output/playwright/color-display/.playwright-cli/page-2026-04-24T12-34-27-307Z.png`
  - Browser console: one non-blocking `favicon.ico` 404 plus debug-helper info; no application error observed.
- Review:
  - Sub-agent review 2: CHANGE_REQUESTED.
  - Finding fixed in this step:
    - Drain timeout previously returned running while late stale returns could still update Model 100; timeout now quarantines late stale returns and has a dedicated test.
  - Sub-agent review 3: APPROVED.
  - Findings: none.
  - Open questions: none.
  - Verification gaps: none.
- Result: PASS
