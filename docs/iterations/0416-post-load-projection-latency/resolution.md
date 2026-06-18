---
title: "Iteration 0416 — Post-Load Projection Latency Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-06-18
source: ai
iteration_id: 0416-post-load-projection-latency
id: 0416-post-load-projection-latency
phase: phase1
---

# Iteration 0416 — Post-Load Projection Latency Resolution

## Execution Strategy

Use TDD for every behavior change. Each stage ends with sub-agent review using `codex-code-review`; implementation continues only after review is approved or all findings are fixed.

## Stage 1 — Contract Tests And Metrics Baseline

Scope:
- Add deterministic tests for post-load patch size and expensive derived label exclusion.
- Add deterministic tests for positive app-index updates.
- Record current measured baseline in runlog.

Files:
- Modify or create: `scripts/tests/test_0416_post_load_projection_latency_contract.mjs`
- Modify: `docs/iterations/0416-post-load-projection-latency/runlog.md`

Verification:
- `node scripts/tests/test_0416_post_load_projection_latency_contract.mjs`

Acceptance:
- New test fails before implementation for the correct reason.
- Failure proves ordinary event patches currently include or can include expensive derived labels, or that required patch stats are missing.
- Test assertions must cover ordinary post-load events using `snapshot_patch`, patch byte size `<= 32 KB`, patch op count / byte stats, expensive-label exclusion, and no silent full-snapshot fallback outside the allowed cases.

Rollback:
- Remove the new test and runlog entries.

Review:
- Spawn sub-agent with `codex-code-review` against the test and baseline scope.

## Stage 2 — Patch Stats Observability

Scope:
- Expose patch byte size and op count in `snapshot_patch` messages.
- Keep the frontend patch application semantics unchanged.

Files:
- Modify: `packages/ui-model-demo-server/server.mjs`
- Test: `scripts/tests/test_0416_post_load_projection_latency_contract.mjs`
- Possibly extend: `scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`

Verification:
- `node scripts/tests/test_0416_post_load_projection_latency_contract.mjs`
- `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`

Acceptance:
- Patch stats are present on patch messages.
- Ordinary post-load patch stats include byte size, operation count, and fallback reason when a full snapshot is used.
- The 0416 contract test asserts ordinary business patches stay `<= 32 KB`; stats are not only informational.
- Existing patch apply behavior remains green.

Rollback:
- Revert patch stats addition.

Review:
- Spawn sub-agent with `codex-code-review`.

## Stage 3 — Gate Expensive Derived Refreshes

Scope:
- Split global `updateDerived()` into always-needed derived work and scoped expensive derived work.
- Prevent ordinary business events from refreshing `home_table_rows_json`, `editor_model_options_json`, and non-index `ws_apps_registry`.
- Preserve page/index events that legitimately need these labels.
- Audit and gate all current refresh entrypoints, including server bus responses, direct pin / function callbacks, external snapshot callbacks, manual page/index updates, patch application side effects, and local demo mode.
- Use explicit event scopes rather than implicit compatibility fallbacks:
  - `business`: no expensive global projection refresh.
  - `home_or_editor`: refresh Home / ModelTable editor derived labels.
  - `app_index`: refresh `ws_apps_registry`.
  - `full`: initial/bootstrap/manual refresh only.

Files:
- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Test: `scripts/tests/test_0416_post_load_projection_latency_contract.mjs`

Verification:
- `node scripts/tests/test_0416_post_load_projection_latency_contract.mjs`
- `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
- `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- `node scripts/tests/test_0415_reactive_projection_store_contract.mjs`

Acceptance:
- Ordinary RemoteWorker / bus response patches exclude expensive labels.
- App index mutation patches still refresh minimal `ws_apps_registry`.
- Local demo mode and server mode remain behavior-aligned for equivalent derived labels.
- Every `updateDerived()` / `refreshWorkspaceStateCatalog()` / `syncDerivedPageState()` caller is either scope-gated or documented as bootstrap/manual refresh.

Rollback:
- Revert scoped update changes and tests.

Review:
- Spawn sub-agent with `codex-code-review`.

## Stage 4 — UI Projection Compatibility

Scope:
- Ensure Home / ModelTable / desktop launcher still display required lists.
- If needed, update UI projection reads to explicitly request or trigger scoped derived refresh without making projection a truth source.

Files:
- Modify as needed:
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-model-demo-frontend/src/route_ui_projection.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Test: existing contracts plus targeted 0416 test.

Verification:
- `node scripts/tests/test_0416_post_load_projection_latency_contract.mjs`
- `node scripts/tests/test_0239_home_selector_model0_contract.mjs`
- `node scripts/tests/test_0212_home_crud_contract.mjs`
- `node scripts/tests/test_0249_home_crud_pin_contract.mjs`
- `node scripts/tests/test_0249_home_crud_pin_migration_contract.mjs`
- `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
- `node scripts/tests/test_0390_focused_app_shell_settings_contract.mjs`

Acceptance:
- Home selector/list and launcher registry remain visible.
- Home create/edit/delete/filter/selection flows still refresh the required projection labels when the Home / ModelTable editor surface is the active scope.
- Any local projection read is principal-filtered and read-only.
- Known historical failures in unrelated 0390 assertions may be recorded separately if unchanged.

Rollback:
- Revert compatibility adjustments.

Review:
- Spawn sub-agent with `codex-code-review`.

## Stage 5 — Full Regression, Deploy, Browser Verification

Scope:
- Run representative script regression.
- Deploy to local stack.
- Browser-test loaded interactions.
- Complete runlog and iteration status.

Commands:
- `node scripts/tests/test_0416_post_load_projection_latency_contract.mjs`
- `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
- `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- `node scripts/tests/test_0415_reactive_projection_store_contract.mjs`
- `node scripts/validate_ui_ast_v0x.mjs --case all`
- `node scripts/validate_builtins_v0.mjs`
- `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- `node scripts/tests/test_0405_todo_submit_overlay_contract.mjs`
- `node scripts/tests/test_0408_todo_board_import_payload_contract.mjs`
- `npm -C packages/ui-model-demo-frontend run build`
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`

Browser verification:
- Desktop loads at `http://localhost:30900/#/`.
- To Do Board opens.
- E2E color generator changes color.
- ModelTable/Home lists display.
- Continuous input is locally responsive.
- No outer page scroll.

Acceptance:
- All targeted 0416 checks pass.
- Local deployed stack is ready.
- Browser evidence confirms behavior.
- Final sub-agent review is approved after all fixes.

Rollback:
- Revert 0416 files and redeploy previous local state.
