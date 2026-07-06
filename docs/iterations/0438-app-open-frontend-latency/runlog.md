---
title: "Iteration 0438 App Open Frontend Latency Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-07-05
source: ai
iteration_id: 0438-app-open-frontend-latency
id: 0438-app-open-frontend-latency
phase: completed
---

# Iteration 0438-app-open-frontend-latency Runlog

## Environment

- Date: 2026-07-04
- Branch: `dropx/dev_0438-app-open-frontend-latency`
- Runtime: local Orbstack target for later implementation verification
- Starting point:
  - 0437 plain bootstrap: `143.3ms`, `28639` bytes.
  - 0437 bootstrap + App ref: `104.4ms`, `43570` bytes.
  - 0437 SSE first `snapshot`: `101.4ms`, `43458` bytes read.

## Execution Records

### Step 1

- Command:
  - `git switch -c dropx/dev_0438-app-open-frontend-latency`
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0438-app-open-frontend-latency --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output:
  - Created `docs/iterations/0438-app-open-frontend-latency/plan.md`.
  - Created `docs/iterations/0438-app-open-frontend-latency/resolution.md`.
  - Created `docs/iterations/0438-app-open-frontend-latency/runlog.md`.
- Result: In Progress
- Commit:

### Step 2

- Command:
  - `node scripts/tests/test_0438_app_open_frontend_latency_contract.mjs`
- Key output:
  - RED before implementation:
    - `[FAIL] test_visible_model_lazy_load_emits_frontend_timing_events: remote store must expose a timing-event reset helper`
    - `0 passed, 1 failed out of 1`
  - GREEN after initial implementation:
    - `[PASS] test_visible_model_lazy_load_emits_frontend_timing_events`
    - `1 passed, 0 failed out of 1`
  - GREEN after scoped foreground App open instrumentation:
    - `[PASS] test_visible_model_lazy_load_emits_frontend_timing_events`
    - `[PASS] test_foreground_app_open_scope_marks_visible_load_events`
    - `[PASS] test_visible_model_load_end_keeps_scope_after_content_visible_end`
    - `[PASS] test_non_visible_snapshot_during_open_stays_unscoped`
    - `[PASS] test_overlapping_app_opens_keep_snapshot_scope_from_request_start`
    - `5 passed, 0 failed out of 5`
- Implementation evidence:
  - Added frontend timing events exposed by `createRemoteStore()`:
    - `getFrontendTimingEvents()`
    - `clearFrontendTimingEvents()`
    - `beginForegroundAppOpenTiming()`
    - `recordForegroundAppContentVisible()`
    - `endForegroundAppOpenTiming()`
  - Added ordered events for:
    - `foreground_app_open_start`
    - `visible_model_load_start`
    - `snapshot_fetch_start`
    - `snapshot_fetch_response`
    - `snapshot_json_parsed`
    - `snapshot_apply_start`
    - `snapshot_apply_end`
    - `foreground_app_content_visible`
    - `foreground_app_open_end`
    - `visible_model_load_end`
  - Fixed test-response compatibility after regression found that some existing fake responses implement `json()` but not `text()`.
  - Scoped foreground App open events by `open_id`, `app_name`, and table-qualified `model_ref`.
  - Scoped visible model loading so `visible_model_load_end` keeps its `open_id` even if render completion is recorded before the fetch promise resolves.
  - Added `context`, `profile`, and `source` to snapshot apply timing so foreground App opens can be separated from background SSE / patch applies.
  - Restricted foreground scope attribution so non-visible snapshot work during an App open remains unscoped and does not pollute the App-open timing bucket.
  - Captured foreground scope at visible snapshot request start so overlapping App opens keep response/parse/apply timing attached to the App that started that request.
- Regression command:
  - `node scripts/tests/test_0438_app_open_frontend_latency_contract.mjs && node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs && node scripts/tests/test_0425_visible_model_refs_contract.mjs && node scripts/tests/test_0425_principal_desktop_state_contract.mjs && node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs && node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs && npm -C packages/ui-model-demo-frontend run build`
- Regression key output:
  - `test_0438_app_open_frontend_latency_contract.mjs`: `5 passed, 0 failed out of 5`
  - `test_0425_frontend_model_ref_projection_contract.mjs`: `12 passed, 0 failed out of 12`
  - `test_0425_visible_model_refs_contract.mjs`: `7 passed, 0 failed out of 7`
  - `test_0425_principal_desktop_state_contract.mjs`: `6 passed`
  - `test_0425_slide_app_subtable_install_contract.mjs`: `5 passed, 0 failed out of 5`
  - `test_0426_snapshot_patch_recovery_contract.mjs`: `4 passed, 0 failed out of 4`
  - Frontend build: `✓ built in 2.87s`
- Local deploy command:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Local deploy key output:
  - `ui-server-844bcdd4c4-flj5f`: `1/1 Running`
  - `mbr-worker-5b47844d4-hq76g`: `1/1 Running`
  - `remote-worker-6f4d46fd96-6qrc8`: `1/1 Running`
  - `workspace-manager-f8998bd-dmxc2`: `1/1 Running`
  - `mosquitto-8458ff74dd-pwp95`: `1/1 Running`
  - `synapse-6f67c89557-x26dn`: `1/1 Running`
- Browser evidence:
  - Session: Playwright CLI `0438-app-open-baseline`
  - URL: `http://localhost:30900/auth/dev/fake-login?user=drop&returnTo=%2F`
  - Baseline metrics saved to `output/playwright/0438-app-open-frontend-latency/baseline-metrics.json`.
  - Screenshot saved to `output/playwright/0438-app-open-frontend-latency/baseline-after-todo.png`.
  - Color functional screenshot saved to `output/playwright/0438-app-open-frontend-latency/e2e-color-after-generate.png`.
  - Color functional result saved to `output/playwright/0438-app-open-frontend-latency/color-functional-check.json`.
  - Final scoped baseline metrics saved to `output/playwright/0438-app-open-frontend-latency/final-scoped-baseline-metrics.json`.
  - Final scoped screenshot saved to `output/playwright/0438-app-open-frontend-latency/final-scoped-baseline-after-todo.png`.
  - Final color functional result saved to `output/playwright/0438-app-open-frontend-latency/final-color-functional-check.json`.
  - Final color functional screenshot saved to `output/playwright/0438-app-open-frontend-latency/final-e2e-color-after-generate.png`.
- Browser baseline metrics:
  - `E2E 颜色生成器`:
    - `loading_visible_ms`: `null`
    - `click_to_content_ms`: `1533.3`
    - `visible_model_duration_ms`: `0.1`
    - `already_loaded`: `true`
    - `snapshot_fetch_duration_ms`: `null`
    - `snapshot_apply_ms`: `0.3`
    - note: this was a warm foreground switch; the App table was already in the client snapshot.
  - `To Do Board`:
    - `loading_visible_ms`: `17.9`
    - `click_to_content_ms`: `479.2`
    - `visible_model_duration_ms`: `457.8`
    - `snapshot_fetch_duration_ms`: `406.3`
    - `snapshot_parse_ms`: `1.1`
    - `snapshot_byte_length`: `39401`
    - `snapshot_apply_ms`: `33.3`
    - `snapshot_status`: `200`
    - `has_model`: `true`
    - observed request included stale/warm E2E visible ref plus target To Do model: `visible_model_ref=app:drop:e2e:2-0-20:1|0` and `model_id=1086`.
  - `E2E 颜色生成器` functional check:
    - before: `#cab42f`
    - after: `#c5e598`
    - changed: `true`
- Browser final scoped baseline metrics:
  - `E2E 颜色生成器` warm foreground switch:
    - `loading_visible_ms`: `50.7`
    - `click_to_content_ms`: `48.9`
    - `visible_model_duration_ms`: `56.2`
    - `snapshot_fetch_duration_ms`: `34.3`
    - `snapshot_parse_ms`: `0.4`
    - `snapshot_byte_length`: `15285`
    - `snapshot_apply_ms`: `11.9`
    - scoped event path: `foreground_app_open_start -> visible_model_load_start -> snapshot_fetch_start -> snapshot_fetch_response -> snapshot_json_parsed -> snapshot_apply_start -> snapshot_apply_end -> foreground_app_content_visible -> foreground_app_open_end -> visible_model_load_end`
  - `To Do Board` cold foreground open:
    - `loading_visible_ms`: `24.8`
    - `click_to_content_ms`: `126.1`
    - `visible_model_duration_ms`: `133.9`
    - `snapshot_fetch_duration_ms`: `91.6`
    - `snapshot_parse_ms`: `1`
    - `snapshot_byte_length`: `39400`
    - `snapshot_apply_ms`: `29.3`
    - `snapshot_status`: `200`
    - `has_model`: `true`
    - observed request still included stale/warm E2E visible ref plus target To Do model: `visible_model_ref={"table_id":"app:drop:e2e:2-0-20:1","model_id":0}` and `model_id=1086`.
    - background `snapshot_patch` events during the open stayed unscoped after the attribution fix.
  - `E2E 颜色生成器` final functional check:
    - before: `#593e68`
    - after: `#646b8a`
    - changed: `true`
    - status text contained `processed`: `true`
- Browser cleanup:
  - Playwright session `0438-app-open-final-baseline` closed.
  - `playwright_cli.sh list`: `(no browsers)`.
- Result: PASS
- Commit:
  - `26a7ef2 feat(frontend): instrument app open latency [0438]`

### Step 3

- Goal:
  - Reduce foreground App-open visible snapshot request size by requesting only the target App/model for the lazy-load fetch.
  - Preserve the full visible App subscription after load so SSE still covers all visible App refs.
- TDD command:
  - `node scripts/tests/test_0438_app_open_frontend_latency_contract.mjs`
- Key output:
  - RED before implementation:
    - `[FAIL] test_foreground_lazy_load_requests_target_only_but_keeps_visible_subscription_refs: second App open must not refetch an already visible stale/warm App table`
    - `5 passed, 1 failed out of 6`
  - GREEN after implementation:
    - `[PASS] test_foreground_lazy_load_requests_target_only_but_keeps_visible_subscription_refs`
    - `6 passed, 0 failed out of 6`
- Implementation evidence:
  - `ensureVisibleModelLoaded()` now fetches the visible snapshot with `modelIds: [targetRef]`.
  - `rememberVisibleModelRef(targetRef)` and `connectEventSource()` still keep the full visible subscription after load.
  - Updated the legacy 0418 frontend visible lazy-load contract to the same target-only request semantics while retaining out-of-order response and full visible stream subscription coverage.
  - The deterministic test verifies:
    - The second App-open snapshot request contains the target App ref.
    - The request does not contain the previously visible App ref.
    - The expected SSE stream URL still includes both visible App refs.
- Regression command:
  - `node scripts/tests/test_0438_app_open_frontend_latency_contract.mjs && node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs && node scripts/tests/test_0425_visible_model_refs_contract.mjs && node scripts/tests/test_0425_principal_desktop_state_contract.mjs && node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs && node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs && npm -C packages/ui-model-demo-frontend run build`
- Regression key output:
  - `test_0438_app_open_frontend_latency_contract.mjs`: `6 passed, 0 failed out of 6`
  - `test_0425_frontend_model_ref_projection_contract.mjs`: `12 passed, 0 failed out of 12`
  - `test_0425_visible_model_refs_contract.mjs`: `7 passed, 0 failed out of 7`
  - `test_0425_principal_desktop_state_contract.mjs`: `6 passed`
  - `test_0425_slide_app_subtable_install_contract.mjs`: `5 passed, 0 failed out of 5`
  - `test_0426_snapshot_patch_recovery_contract.mjs`: `4 passed, 0 failed out of 4`
  - Frontend build: `✓ built in 2.90s`
- Extended regression command after sub-agent review finding:
  - `node scripts/tests/test_0438_app_open_frontend_latency_contract.mjs && node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs && node scripts/tests/test_0423_snapshot_granularity_contract.mjs && node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs && node scripts/tests/test_0425_visible_model_refs_contract.mjs && node scripts/tests/test_0425_principal_desktop_state_contract.mjs && node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs && node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs && node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs && node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs && node scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs && npm -C packages/ui-model-demo-frontend run build`
- Extended regression key output:
  - `test_0438_app_open_frontend_latency_contract.mjs`: `6 passed, 0 failed out of 6`
  - `test_0418_visible_snapshot_projection_latency_contract.mjs`: `PASS 8/8`
  - `test_0423_snapshot_granularity_contract.mjs`: `13 passed`
  - `test_0425_frontend_model_ref_projection_contract.mjs`: `12 passed, 0 failed out of 12`
  - `test_0425_visible_model_refs_contract.mjs`: `7 passed, 0 failed out of 7`
  - `test_0425_principal_desktop_state_contract.mjs`: `6 passed`
  - `test_0425_slide_app_subtable_install_contract.mjs`: `5 passed, 0 failed out of 5`
  - `test_0426_snapshot_patch_recovery_contract.mjs`: `4 passed, 0 failed out of 4`
  - `test_0435_visible_snapshot_app_slimming_contract.mjs`: `2 passed, 0 failed`
  - `test_0436_runtime_snapshot_build_latency_contract.mjs`: `6 passed, 0 failed`
  - `test_0437_bootstrap_sse_first_packet_latency_contract.mjs`: `4 passed, 0 failed`
  - Frontend build: `✓ built in 2.92s`
- Local deploy command:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Local deploy key output:
  - `ui-server-7768bc48c9-klw8z`: `1/1 Running`
  - `mbr-worker-6fcb84fcb9-n26q4`: `1/1 Running`
  - `remote-worker-6566f6cbf7-zzqdq`: `1/1 Running`
  - `workspace-manager-854f949554-h5dcz`: `1/1 Running`
  - `mosquitto-8458ff74dd-pwp95`: `1/1 Running`
  - `synapse-6f67c89557-x26dn`: `1/1 Running`
- Browser evidence:
  - Session: Playwright CLI `0438-app-open-post-change` and `0438-app-open-post-change-rerun`
  - URL: `http://localhost:30900/auth/dev/fake-login?user=drop&returnTo=%2F`
  - Post-change App-open metrics saved to `output/playwright/0438-app-open-frontend-latency/post-change-metrics.json`.
  - Post-change screenshot saved to `output/playwright/0438-app-open-frontend-latency/post-change-after-todo.png`.
  - Rerun metrics saved to `output/playwright/0438-app-open-frontend-latency/post-change-rerun-metrics.json`.
  - Direct snapshot comparison saved to `output/playwright/0438-app-open-frontend-latency/post-change-direct-snapshot-compare.json`.
  - Color functional result saved to `output/playwright/0438-app-open-frontend-latency/post-change-color-functional-check.json`.
  - Color functional screenshot saved to `output/playwright/0438-app-open-frontend-latency/post-change-e2e-color-after-generate.png`.
- Browser post-change metrics:
  - `E2E 颜色生成器` cold visible fetch:
    - request URL: `/snapshot?profile=visible&initial_projection=1&visible_model_ref={"table_id":"app:drop:e2e:2-0-20:1","model_id":0}`
    - `open_duration_ms`: `51.3`
    - `visible_model_duration_ms`: `58.6`
    - `snapshot_fetch_duration_ms`: `36.2`
    - `snapshot_parse_ms`: `0.3`
    - `snapshot_byte_length`: `15285`
    - `snapshot_apply_ms`: `12.2`
  - `To Do Board` cold visible fetch:
    - request URL: `/snapshot?profile=visible&initial_projection=1&model_id=1086`
    - `click_to_content_ms`: `784.6`
    - `visible_model_duration_ms`: `793.8`
    - `snapshot_fetch_duration_ms`: `737`
    - `snapshot_parse_ms`: `0.8`
    - `snapshot_byte_length`: `24469`
    - `snapshot_apply_ms`: `41.2`
    - note: this single App-open run was slower than the preceding Step 2 browser run, but the request was correctly target-only and payload was smaller.
  - Direct snapshot comparison in the same authenticated browser context:
    - target-only `/snapshot?profile=visible&initial_projection=1&model_id=1086`: average `12.3ms`, `24469` bytes, runs `[17.5, 11.8, 10.1, 9.6]`.
    - old combined `/snapshot?profile=visible&initial_projection=1&visible_model_ref={"table_id":"app:drop:e2e:2-0-20:1","model_id":0}&model_id=1086`: average `32.7ms`, `39401` bytes, runs `[21.5, 29.1, 14.9, 65.3]`.
    - payload reduction: `39401 -> 24469` bytes, about `38%` smaller for this scenario.
  - `E2E 颜色生成器` post-change functional check:
    - before: `#84ffa1`
    - after: `#28bb82`
    - changed: `true`
    - status text contained `processed`: `true`
- Browser cleanup:
  - Playwright session `0438-app-open-post-change-rerun` closed.
  - `playwright_cli.sh list`: `(no browsers)`.
- Result: PASS
- Commit:
  - `9a47491 perf(frontend): request target app snapshot only [0438]`

### Step 4

- Goal:
  - Close iteration 0438 with final deterministic regression, build, local deployment/browser evidence already captured, and final review.
- Docs update:
  - `docs/ITERATIONS.md`: marked `0438-app-open-frontend-latency` as `Completed`.
  - `docs/iterations/0438-app-open-frontend-latency/resolution.md`: marked `status: completed`, `phase: completed`.
  - `docs/iterations/0438-app-open-frontend-latency/runlog.md`: marked `status: completed`, `phase: completed`.
- Final regression command:
  - `git diff --check && node scripts/tests/test_0438_app_open_frontend_latency_contract.mjs && node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs && node scripts/tests/test_0423_snapshot_granularity_contract.mjs && node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs && node scripts/tests/test_0425_visible_model_refs_contract.mjs && node scripts/tests/test_0425_principal_desktop_state_contract.mjs && node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs && node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs && node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs && node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs && node scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs && npm -C packages/ui-model-demo-frontend run build`
- Final regression key output:
  - `test_0438_app_open_frontend_latency_contract.mjs`: `6 passed, 0 failed out of 6`
  - `test_0418_visible_snapshot_projection_latency_contract.mjs`: `PASS 8/8`
  - `test_0423_snapshot_granularity_contract.mjs`: `13 passed`
  - `test_0425_frontend_model_ref_projection_contract.mjs`: `12 passed, 0 failed out of 12`
  - `test_0425_visible_model_refs_contract.mjs`: `7 passed, 0 failed out of 7`
  - `test_0425_principal_desktop_state_contract.mjs`: `6 passed`
  - `test_0425_slide_app_subtable_install_contract.mjs`: `5 passed, 0 failed out of 5`
  - `test_0426_snapshot_patch_recovery_contract.mjs`: `4 passed, 0 failed out of 4`
  - `test_0435_visible_snapshot_app_slimming_contract.mjs`: `2 passed, 0 failed`
  - `test_0436_runtime_snapshot_build_latency_contract.mjs`: `6 passed, 0 failed`
  - `test_0437_bootstrap_sse_first_packet_latency_contract.mjs`: `4 passed, 0 failed`
  - Frontend build: `✓ built in 2.64s`
- Result: PASS
- Commit:

## Docs Updated

- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed

## Review Gate

Review Gate Record
- Iteration ID: 0438-app-open-frontend-latency
- Review Date: 2026-07-04
- Review Type: AI-assisted / sub-agent
- Review Index: 1
- Decision: Change Requested
- Scope: Phase 1 plan and resolution.
- Notes: Step 3 did not explicitly require post-optimization browser timing capture before sub-agent review, so it could pass without proving user-visible App open latency changed.
- Fixes:
  - Added Step 3 verification requiring local deployment when needed, real browser timing capture for the same Step 2 scenarios, and baseline-vs-post-change values in `runlog.md` before sub-agent review starts.
  - Tightened Step 3 acceptance so improvement or external bottleneck proof must be backed by concrete browser timing evidence.

Review Gate Record
- Iteration ID: 0438-app-open-frontend-latency
- Review Date: 2026-07-04
- Review Type: AI-assisted / sub-agent
- Review Index: 2
- Decision: Change Requested
- Scope: Phase 1 plan and resolution after Step 3 verification fix.
- Notes: Step 3 regression list did not explicitly include user isolation / App table isolation checks.
- Fixes:
  - Added `test_0425_principal_desktop_state_contract.mjs`.
  - Added `test_0425_slide_app_subtable_install_contract.mjs`.

Review Gate Record
- Iteration ID: 0438-app-open-frontend-latency
- Review Date: 2026-07-04
- Review Type: AI-assisted / sub-agent
- Review Index: 3
- Decision: Approved
- Scope: Phase 1 plan and resolution after isolation regression checks were added.
- Notes: Sub-agent approved the Phase 1 plan and resolution with no findings or verification gaps.

Review Gate Record
- Iteration ID: 0438-app-open-frontend-latency
- Review Date: 2026-07-05
- Review Type: AI-assisted / sub-agent
- Review Index: 4
- Decision: Change Requested
- Scope: Step 2 timing baseline instrumentation before scoped foreground-open fixes.
- Notes:
  - Snapshot apply events were emitted for every snapshot without enough App-open context.
  - The E2E warm-open metric was not split into projection/render/loading timing.
- Fixes:
  - Added scoped foreground App open timing with `open_id`, `app_name`, and table-qualified `model_ref`.
  - Added `context`, `profile`, and `source` to snapshot timing events.
  - Added tests for scoped foreground opens and for preserving the visible-load `open_id` when content render finishes before the load promise resolves.
  - Reran local deployment and Playwright browser timing after the fix.

Review Gate Record
- Iteration ID: 0438-app-open-frontend-latency
- Review Date: 2026-07-05
- Review Type: AI-assisted / sub-agent
- Review Index: 5
- Decision: Change Requested
- Scope: Step 2 timing baseline instrumentation after first scoped fix.
- Notes:
  - Overlapping foreground App opens could still misattribute late snapshot response/parse/apply events to the newer active App instead of the App that started the request.
- Fixes:
  - Captured the foreground App scope at visible snapshot request start.
  - Passed the captured scope through response, JSON parse, and snapshot apply timing events.
  - Added deterministic overlap coverage with two pending visible snapshot requests resolving out of order.
  - Reran deterministic regression, local deployment, browser latency capture, color functional check, and Playwright cleanup.

Review Gate Record
- Iteration ID: 0438-app-open-frontend-latency
- Review Date: 2026-07-05
- Review Type: AI-assisted / sub-agent
- Review Index: 6
- Decision: Approved
- Scope: Step 2 final timing baseline instrumentation after overlapping-open fix.
- Notes: Sub-agent approved the latest diff with no findings, open questions, or verification gaps.

Review Gate Record
- Iteration ID: 0438-app-open-frontend-latency
- Review Date: 2026-07-05
- Review Type: AI-assisted / sub-agent
- Review Index: 7
- Decision: Change Requested
- Scope: Step 3 target-only foreground visible snapshot optimization.
- Notes:
  - `test_0418_visible_snapshot_projection_latency_contract.mjs` still encoded the older combined visible request expectation and failed under the new target-only contract.
- Fixes:
  - Updated the 0418 frontend lazy-load contract to target-only requests.
  - Preserved out-of-order visible response coverage and full visible model SSE subscription assertions.
  - Reran 0438, 0418, 0423, 0425, 0426, 0435, 0436, 0437, and frontend build.

Review Gate Record
- Iteration ID: 0438-app-open-frontend-latency
- Review Date: 2026-07-05
- Review Type: AI-assisted / sub-agent
- Review Index: 8
- Decision: Approved
- Scope: Step 3 target-only foreground visible snapshot optimization after 0418 contract update.
- Notes: Sub-agent approved the latest Step 3 diff with no findings, open questions, or verification gaps.

Review Gate Record
- Iteration ID: 0438-app-open-frontend-latency
- Review Date: 2026-07-05
- Review Type: AI-assisted / sub-agent
- Review Index: 9
- Decision: Approved
- Scope: Final 0438 completion state, tests, docs, browser evidence, and target-only optimization.
- Notes: Sub-agent approved the final iteration state with no findings, open questions, or verification gaps.
