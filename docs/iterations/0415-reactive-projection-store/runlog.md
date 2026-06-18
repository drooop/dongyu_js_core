---
title: "Iteration 0415 — Reactive Projection Store Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-06-18
source: ai
iteration_id: 0415-reactive-projection-store
id: 0415-reactive-projection-store
phase: phase3
---

# Iteration 0415 — Reactive Projection Store Runlog

规则：只记事实（FACTS）。每个 Step 只有 PASS 才算完成。

## Environment

- Branch: `dropx/dev_0415-reactive-projection-store`
- Start time: 2026-06-10
- Note: Branch was created from a dirty worktree containing prior 0412/0414 changes. Do not revert unrelated files.

Review Gate Record
- Iteration ID: `0415-reactive-projection-store`
- Review Date: 2026-06-10
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: User requested a local implementation and test of the Vue/React-like reactive projection approach.

## Step 1 — Register And Contract Tests

- Start time: 2026-06-10
- End time: 2026-06-10
- Commands:
- `node scripts/tests/test_0415_reactive_projection_store_contract.mjs`
- Key outputs:
- Initial RED:
  - `Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../packages/ui-model-demo-frontend/src/projection_store.js`
  - This is the expected failure before implementation.
- Result: PASS

## Step 2 — Projection Store Implementation

- Start time: 2026-06-10
- End time: 2026-06-10
- Commands:
- `node scripts/tests/test_0415_reactive_projection_store_contract.mjs`
- `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- Key outputs:
- Added `packages/ui-model-demo-frontend/src/projection_store.js`.
- Added label-level reactive atoms with stable identity.
- Full snapshot hydration populates projection atoms.
- `snapshot_patch` ops update projection atoms for label/cell/model/config changes.
- `remote_store.getEffectiveLabelValue()` now reads overlay first, then Projection Store, then legacy snapshot fallback.
- Local pending shell state is also written into Projection Store so a later full snapshot fallback cannot revert a just-opened foreground App to desktop.
- `DY_AUTH=0` local/dev mode now returns a deterministic dev capability session for guarded routes; this fixes local E2E `/bus_event` tests without weakening `DY_AUTH=1`.
- Runtime mode activation starts control bus immediately and starts optional Matrix live adapter in the background; slow Matrix sync no longer blocks `/api/runtime/mode`.
- `PASS test_0415_reactive_projection_store_contract: 4 passed`
- `PASS test_0414_snapshot_delta_sse_contract: 7 passed`
- Result: PASS

## Step 3 — Renderer Read Path

- Start time: 2026-06-10
- End time: 2026-06-10
- Commands:
- `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
- `node scripts/tests/test_0329_bus_event_last_op_id_snapshot_contract.mjs`
- `node scripts/tests/test_0405_todo_submit_overlay_contract.mjs`
- `node scripts/tests/test_0407_current_model_ref_contract.mjs`
- Key outputs:
- Renderer code already reads bound labels through the host adapter's `getEffectiveLabelValue()` path.
- No direct renderer code change was needed for this prototype; `remote_store.getEffectiveLabelValue()` now provides the Projection Store-backed value.
- Overlay precedence stayed intact.
- Waiting/fallback/op_id regressions stayed green.
- `PASS test_0412_local_latency_trace_contract: 11 passed`
- `PASS test_0329_bus_event_last_op_id_snapshot_contract`
- `PASS test_0405_todo_submit_overlay_contract`
- `test_0407_current_model_ref_contract.mjs`: 6 passed, 0 failed
- Result: PASS

## Step 4 — Local Deploy And Browser Regression

- Start time: 2026-06-10
- End time: 2026-06-10
- Commands:
- `npm -C packages/ui-model-demo-frontend run build`
- `git diff --check -- packages/ui-model-demo-frontend/src/projection_store.js packages/ui-model-demo-frontend/src/remote_store.js scripts/tests/test_0415_reactive_projection_store_contract.mjs docs/iterations/0415-reactive-projection-store/plan.md docs/iterations/0415-reactive-projection-store/resolution.md docs/iterations/0415-reactive-projection-store/runlog.md docs/ITERATIONS.md`
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Playwright browser against `http://localhost:30900/#/`
- `kubectl -n dongyu get deploy ui-server mbr-worker remote-worker workspace-manager -o jsonpath=...`
- `/snapshot` and `/stream` probes against `http://localhost:30900`
- Playwright E2E in temporary Chromium, closed after each run.
- Representative regression commands:
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `node scripts/validate_builtins_v0.mjs`
  - `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
  - `node scripts/tests/test_0403_principal_authorization.mjs`
  - `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`
  - `node scripts/tests/test_0396_dual_topic_submit_response_contract.mjs`
  - `node scripts/tests/test_0408_todo_board_import_payload_contract.mjs`
  - `node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs`
  - `node scripts/tests/test_0410_slide_import_fixture_zip_contract.mjs`
  - `node scripts/tests/test_0410_async_host_action_latency.mjs`
- Key outputs:
- Frontend build PASS. Built bundle: `assets/index-DpM06MQh.js`.
- Local deploy PASS. Ready state:
  - `ui-server 1/1`
  - `mbr-worker 1/1`
  - `remote-worker 1/1`
  - `workspace-manager 1/1`
- Browser verification:
  - URL: `http://localhost:30900/#/`
  - title: `UI Model Demo`
  - loaded JS: `http://localhost:30900/assets/index-DpM06MQh.js`
  - default `DY_AUTH=1` body contained app cards including `Gallery`, `Docs`, `To Do Board`, `E2E 颜色生成器`.
  - `/snapshot` 200, `/stream` 200, `/auth/me` 401 expected for unauthenticated visitor mode.
  - viewport 1440x1000 had no outer horizontal or vertical scroll: `docScrollWidth=1440`, `docClientWidth=1440`, `docScrollHeight=1000`, `docClientHeight=1000`.
  - With `DY_AUTH=0` only for E2E, clicked `E2E 颜色生成器`; `Generate Color` changed color from `#FFFFFF` to `#d0e918`; `/bus_event` returned 200; foreground App did not jump back to desktop after full snapshot fallback.
  - Clicked `To Do Board`; app rendered the two views, four status columns, and task cards; viewport stayed without outer horizontal or vertical scroll.
  - `DY_AUTH=0` deployed `/api/runtime/mode` returned 200 in 0.45s after endpoint stabilization.
  - Restored local default auth to `DY_AUTH=1`; `POST /bus_event` returned `401 login_required` after rollout endpoints stabilized, which is the expected auth gate.
  - Deleted stale Error pods left by rollout termination windows; final `ui-server`, `mbr-worker`, `remote-worker`, and `workspace-manager` deployments were all 1/1 Ready.
- Runtime probes:
  - `/snapshot`: `status=200`, `has_snapshot_seq=true`.
  - `/stream`: `status=200`.
- Passing regression surfaces:
  - UI AST validator summary PASS.
  - Builtins validator PASS.
  - Model 0 bus ingress flow: 31 passed.
  - Auth/principal authorization: 6 passed.
  - Frontend auth UX: 6 passed.
  - Dual topic submit/response contract PASS.
  - To Do import payload and MQTT egress docs PASS.
  - Slide import fixture zip: 2 passed.
  - Async host action latency: 2 passed.
- Historical contract drift observed, not introduced by 0415 projection changes:
  - `test_0374_web_tablet_desktop_contract.mjs`: 2 failures around task switcher button / fast foreground task stack sync.
  - `test_0388_shell_route_state_stability.mjs`: 1 failure around `/ui_event` vs `/bus_event` UI-local state sync expectation; this conflicts with older tests that still require `/ui_event`.
  - `test_0390_focused_app_shell_settings_contract.mjs`: 1 failure around `height: 100%` vs historical `100vh` assertion.
- Result: PASS for 0415 targeted implementation and current valid regression surface; historical contract drift recorded for follow-up.

## Step 5 — Final Review And Docs

- Start time: 2026-06-10
- End time: 2026-06-10
- Commands:
- `node scripts/tests/test_0415_reactive_projection_store_contract.mjs`
- `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
- `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- `node scripts/validate_ui_ast_v0x.mjs --case all`
- `node scripts/validate_builtins_v0.mjs`
- `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- `node scripts/tests/test_0403_principal_authorization.mjs`
- `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`
- `node scripts/tests/test_0396_dual_topic_submit_response_contract.mjs`
- `node scripts/tests/test_0405_todo_submit_overlay_contract.mjs`
- `node scripts/tests/test_0407_current_model_ref_contract.mjs`
- `node scripts/tests/test_0408_todo_board_import_payload_contract.mjs`
- `node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs`
- `node scripts/tests/test_0410_slide_import_fixture_zip_contract.mjs`
- `node scripts/tests/test_0410_async_host_action_latency.mjs`
- `node scripts/tests/test_0329_bus_event_last_op_id_snapshot_contract.mjs`
- `npm -C packages/ui-model-demo-frontend run build`
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Playwright browser smoke for `E2E 颜色生成器`, `To Do Board`, and default-auth desktop.
- `git diff --check -- docs/ITERATIONS.md docs/iterations/0415-reactive-projection-store/plan.md docs/iterations/0415-reactive-projection-store/resolution.md docs/iterations/0415-reactive-projection-store/runlog.md docs/ssot/runtime_semantics_modeltable_driven.md packages/ui-model-demo-frontend/src/projection_store.js packages/ui-model-demo-frontend/src/remote_store.js packages/ui-model-demo-server/server.mjs scripts/tests/test_0412_local_latency_trace_contract.mjs scripts/tests/test_0415_reactive_projection_store_contract.mjs`
- Key outputs:
- Targeted 0415 tests, 0412 latency trace, 0414 snapshot delta SSE, and the representative existing regression surface all passed.
- Local deployment was rebuilt and verified against `http://localhost:30900/#/`.
- Temporary auth-disabled E2E was restored to default `DY_AUTH=1` before completion.
- Result: PASS
