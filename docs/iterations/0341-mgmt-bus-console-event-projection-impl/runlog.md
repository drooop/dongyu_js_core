---
title: "0341 — Mgmt Bus Console Event Projection Implementation Run Log"
doc_type: iteration-runlog
status: completed
updated: 2026-04-26
source: ai
iteration_id: 0341-mgmt-bus-console-event-projection-impl
id: 0341-mgmt-bus-console-event-projection-impl
phase: phase3
---

# 0341 — Mgmt Bus Console Event Projection Implementation Run Log

规则：只记事实（FACTS）。不要写愿景。

## Environment

- Date: `2026-04-26`
- Branch: `dev_0341-mgmt-bus-console-event-projection-impl`
- Runtime: local macOS, repo `/Users/drop/codebase/cowork/dongyuapp_elysia_based`

## Review Gate Record
- Iteration ID: `0341-mgmt-bus-console-event-projection-impl`
- Review Date: `2026-04-26`
- Review Type: User
- Review Index: `1`
- Decision: Approved
- Notes: User explicitly approved opening `0341-mgmt-bus-console-event-projection-impl` after `0340` planning completed and was reviewed.

## Execution Records

### Step 0 — Registration

- Command: `git pull --ff-only origin dev`
- Result: PASS
- Command: `git switch -c dev_0341-mgmt-bus-console-event-projection-impl`
- Result: PASS
- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0341-mgmt-bus-console-event-projection-impl --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output: generated `plan.md`, `resolution.md`, `runlog.md`.
- Result: PASS
- Commit: pending

### Step 1 — Planning To Approved Execution

- Files changed:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0341-mgmt-bus-console-event-projection-impl/plan.md`
  - `docs/iterations/0341-mgmt-bus-console-event-projection-impl/resolution.md`
  - `docs/iterations/0341-mgmt-bus-console-event-projection-impl/runlog.md`
- Key facts:
  - `0341` implements the approved `0340` event projection contract.
  - Plan and resolution status are `approved`.
  - Implementation requires TDD and stage sub-agent code review.
- Result: PASS
- Commit: pending

### Step 2 — Red Event Projection Contract Test

- Files changed:
  - `scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
- Command: `node scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
- Key output: failed at `event timeline table missing`.
- Result: PASS, expected red test
- Commit: pending

### Step 3 — Event Projection And UI Binding

- Files changed:
  - `packages/ui-model-demo-server/mgmt_bus_console_projection.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
- Key facts:
  - Source-owned Model `-2` projection labels now include event rows, event inspector rows/text, and composer action rows.
  - Model `1036` now binds event timeline, inspector table, and composer action table to Model `-2`.
  - Model `1036` owns only local selection/action labels such as `selected_event_id`, not event truth rows.
  - `mgmt_bus_selected_event_input` writes local `selected_event_id` through `label_update`, not `bus_event_v2`.
- Commands:
  - `node -e "JSON.parse(require('fs').readFileSync('packages/worker-base/system-models/workspace_positive_models.json','utf8')); console.log('json ok')"`
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `node scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
  - `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
  - `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
- Results:
  - JSON parse: PASS
  - Server syntax check: PASS
  - 0341 event projection contract: PASS, 5/5
  - 0339 live projection contract: PASS, 5/5
  - 0336 management console contract: PASS, 7/7
  - UI AST validator: PASS
- Commit: pending

### Step 4 — Stage Review Fix

- Reviewer: sub-agent `019dc8e0-8a30-7473-bb9a-a91b64a54e09`
- Review decision: CHANGE_REQUESTED
- Finding addressed:
  - Server now reads Model `1036` root `selected_event_id` and passes it into `deriveMgmtBusConsoleProjection`.
  - Projection deriver now shows the selected event in inspector rows/text.
  - Invalid `selected_event_id` now renders explicit `event not found: <id>` state instead of falling back to another event.
  - Server and remote store now whitelist only Model `1036` root local UI keys for local label updates; this does not allow arbitrary positive-model writes.
- Files changed:
  - `packages/ui-model-demo-server/mgmt_bus_console_projection.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
- Commands:
  - `node scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
  - `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
  - `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
  - `node scripts/tests/test_bus_in_out.mjs`
  - `node scripts/validate_builtins_v0.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `node --check packages/ui-model-demo-server/server.mjs`
- Results:
  - 0341 event projection contract: PASS, 7/7
  - 0339 live projection contract: PASS, 5/5
  - 0336 management console contract: PASS, 7/7
  - Bus in/out: PASS, 7/7
  - Builtins validator: PASS
  - UI AST validator: PASS
  - Frontend test: PASS
  - Frontend build: PASS, with existing Vite chunk size warning only
  - Server syntax check: PASS
- Re-review: pending
- Commit: pending

### Step 5 — Stage Re-Review Fix

- Reviewer: sub-agent `019dc8e6-58b4-7752-bbff-bf59d398fa7f`
- Review decision: CHANGE_REQUESTED
- Findings addressed:
  - `mgmt_bus_selected_event_input` now uses `commit_policy: "immediate"` so normal typing commits selection immediately instead of staging an overlay until a later flush.
  - Server Model `1036` local-state exception is now limited to `label_update` on a root whitelist of local UI keys.
  - `label_add`, `label_remove`, and `datatable_remove_label` against Model `1036` `selected_event_id` are covered by negative tests and rejected as `direct_model_mutation_disabled`.
- Commands:
  - `node scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `node -e "JSON.parse(require('fs').readFileSync('packages/worker-base/system-models/workspace_positive_models.json','utf8')); console.log('json ok')"`
  - `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
  - `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `node scripts/tests/test_bus_in_out.mjs`
  - `node scripts/validate_builtins_v0.mjs`
- Results:
  - 0341 event projection contract: PASS, 7/7
  - Server syntax check: PASS
  - JSON parse: PASS
  - 0339 live projection contract: PASS, 5/5
  - 0336 management console contract: PASS, 7/7
  - Frontend test: PASS
  - UI AST validator: PASS
  - Frontend build: PASS, with existing Vite chunk size warning only
  - Bus in/out: PASS, 7/7
  - Builtins validator: PASS
- Re-review: pending
- Commit: pending

### Step 6 — Browser-Found Local Selection Path Fix

- Trigger:
  - Playwright browser test showed `selected_event_id` changed the inspector, but the frontend synchronized the local label update through `/bus_event`.
  - This violated the 0340/0341 boundary that local selection must not call `/bus_event`.
- Files changed:
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
- Key facts:
  - Remote local UI-state draft flush now posts local label updates to `/ui_event`.
  - Formal `bus_event_v2` actions still post to `/bus_event`.
  - The 0341 contract test now verifies remote-store local `selected_event_id` sync calls `/ui_event` and not `/bus_event`.
- Commands:
  - `node scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
  - `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
- Results:
  - 0341 event projection contract: PASS, 8/8
  - Frontend test: PASS
  - Server syntax check: PASS
  - 0339 live projection contract: PASS, 5/5
  - 0336 management console contract: PASS, 7/7
  - Frontend build: PASS, with existing Vite chunk size warning only
- Commit: pending

### Step 7 — Local Deploy And Browser Verification

- Commands:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `bash scripts/ops/deploy_local.sh`
  - `SKIP_IMAGE_BUILD=1 bash scripts/ops/deploy_local.sh`
  - `docker build --no-cache -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`
  - `kubectl -n dongyu rollout restart deployment/ui-server`
  - `kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`
  - `bash scripts/ops/check_runtime_baseline.sh`
- Results:
  - Pre-deploy baseline: PASS
  - Full deploy attempt: FAIL during unrelated `dy-mbr-worker:v2` build due Docker Hub `node:22-slim` TLS handshake timeout.
  - Fallback deploy with `SKIP_IMAGE_BUILD=1`: PASS; manifests applied and all workloads restarted.
  - Targeted `dy-ui-server:v1` rebuild after remote-store fix: PASS
  - Targeted `ui-server` rollout restart: PASS
  - Post-restart baseline: initially failed while old `ui-server` pod was terminating, then PASS after termination completed.
- Deploy facts:
  - Current `ui-server` image: `dy-ui-server:v1`.
  - Current deployed Matrix room from generated env: `!OiabgfYplPPGTrgjOp:localhost`.
  - All app pods after deploy baseline: ready, no terminating pods.
- Source projection API evidence:
  - `curl`/Node fetch of `http://127.0.0.1:30900/snapshot` shows Model `-2` labels:
    - `mgmt_bus_console_event_rows_json`: includes `runtime-readiness`, `model0-route-status`, `matrix-trace-summary`.
    - `mgmt_bus_console_event_inspector_json`: populated from selected event.
    - `mgmt_bus_console_event_inspector_text`: populated from selected event.
    - `mgmt_bus_console_composer_actions_json`: includes `refresh`, `send`, `inspect`.
    - `mgmt_bus_console_route_status`: `live`.
- Playwright browser evidence:
  - Tool: `/Users/drop/.codex/skills/playwright/scripts/playwright_cli.sh`
  - Opened URL: `http://127.0.0.1:30900/?v=<timestamp>#/workspace`
  - Opened `Mgmt Bus Console`.
  - Observed `Event Timeline` table with event rows.
  - Observed `ROUTE live`.
  - Observed composer actions `mgmt_bus_console.refresh.v1`, `mgmt_bus_console.send.v1`, and `mgmt_bus_console.inspect.v1`.
  - Filled `Selected event id` with `matrix-trace-summary`.
  - Inspector updated to `event_id=matrix-trace-summary`.
  - Request log for selection: one `POST /ui_event`, zero `POST /bus_event`.
  - Clicked `Refresh`, filled composer with `playwright 0341 event projection`, clicked `Send`.
  - Request log for formal actions: two `POST /bus_event`, zero `POST /ui_event`.
  - Browser resource entries for `/_matrix/client`: `0`.
  - Browser console errors after final run: `0`.
  - Screenshot captured at ignored artifact `.playwright-cli/page-2026-04-26T08-48-33-842Z.png`.
- Server-side route evidence after browser clicks:
  - Model `1036` `selected_event_id`: `matrix-trace-summary`.
  - Model `-2` `mgmt_bus_console_event_inspector_text`: includes `event_id=matrix-trace-summary`.
  - Model `0` `mgmt_bus_console_refresh`: temporary ModelTable record array with kind `mgmt_bus_console.refresh.v1`.
  - Model `-10` `mgmt_bus_console_refresh_intent`: same refresh record array.
  - Model `0` `mgmt_bus_console_send`: temporary ModelTable record array with kind `mgmt_bus_console.send.v1` and draft `playwright 0341 event projection`.
  - Model `-10` `mgmt_bus_console_intent`: same send record array.
- Commit: pending

### Step 8 — Final Review And Pre-Commit Verification

- Reviewer: sub-agent `019dc8fa-e735-7840-963e-6ce5152d0e79`
- Review decision: APPROVED
- Review findings: none
- Commands:
  - `node scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
  - `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
  - `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
  - `node scripts/tests/test_bus_in_out.mjs`
  - `node scripts/validate_builtins_v0.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `git diff --check`
- Results:
  - 0341 event projection contract: PASS, 8/8
  - 0339 live projection contract: PASS, 5/5
  - 0336 management console contract: PASS, 7/7
  - Bus in/out: PASS, 7/7
  - Builtins validator: PASS
  - UI AST validator: PASS
  - Frontend test: PASS
  - Frontend build: PASS, with existing Vite chunk size warning only
  - Runtime baseline: PASS
  - Diff whitespace check: PASS
- Iteration index:
  - `docs/ITERATIONS.md` status updated to `Completed`.
- Commit: pending

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed: 0341 does not change pin semantics or Model 0 ingress contract.
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed: 0341 uses existing UI component labels; no authoring contract change.
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed: no governance semantic change.
