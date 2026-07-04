---
title: "Iteration 0436 Runtime Snapshot Build Latency Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-07-04
source: ai
iteration_id: 0436-runtime-snapshot-build-latency
id: 0436-runtime-snapshot-build-latency
phase: completed
---

# Iteration 0436-runtime-snapshot-build-latency Runlog

## Environment

- Date: 2026-07-04
- Branch: `dropx/dev_0436-runtime-snapshot-build-latency`
- Runtime: local Orbstack target for final verification

## Execution Records

### Step 1

- Command:
  - `git switch -c dropx/dev_0436-runtime-snapshot-build-latency`
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0436-runtime-snapshot-build-latency --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output:
  - Created iteration docs at `docs/iterations/0436-runtime-snapshot-build-latency/`.
  - Registered 0436 in `docs/ITERATIONS.md`.
- Baseline carried from 0435:
  - Explicit App-table visible snapshot: about `762.9ms / 717.5ms / 717.1ms`, `15285` bytes.
  - `/bus_event` server total: about `596.648ms`.
  - E2E color button: about `3740.7ms`.
- Result: In Progress
- Commit: pending

### Step 2

- Command:
- `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
- Key output:
- Initial failing-first output before implementation:
  - `server must expose buildScopedVisibleClientSnapshotForRuntime for direct visible snapshot construction`
- After implementation:
  - `PASS test_scoped_visible_builder_does_not_call_full_runtime_snapshot_for_app_table`
  - `PASS test_scoped_visible_builder_rejects_cross_principal_app_table`
  - `PASS test_scoped_visible_builder_keeps_host_and_app_model_id_collision_separate`
  - `3 passed, 0 failed`
- Result: PASS
- Commit:

### Step 3

- Command:
  - `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
  - `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
  - `node scripts/tests/test_0425_principal_desktop_state_contract.mjs`
  - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
  - `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
  - `node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - `test_0435_visible_snapshot_app_slimming_contract.mjs`: `2 passed, 0 failed`
  - `test_0436_runtime_snapshot_build_latency_contract.mjs`: after review-requested HTTP route coverage and restricted host-id collision coverage, `5 passed, 0 failed`
  - `test_0425_visible_model_refs_contract.mjs`: `7 passed, 0 failed out of 7`
  - `test_0425_principal_desktop_state_contract.mjs`: `6 passed`
  - `test_0425_slide_app_subtable_install_contract.mjs`: `5 passed, 0 failed out of 5`
  - `test_0418_visible_snapshot_projection_latency_contract.mjs`: `PASS 8/8`
  - `test_0423_snapshot_granularity_contract.mjs`: `13 passed`
  - `test_0414_snapshot_delta_sse_contract.mjs`: `7 passed`
  - `test_0426_snapshot_patch_recovery_contract.mjs`: `4 passed, 0 failed out of 4`
  - Frontend build: `✓ built in 3.01s`
- Result: PASS
- Commit: pending

### Step 3 Review

- Review Type: AI-assisted / sub-agent
- Review Index: 1
- Decision: Change Requested
- Notes:
  - Add HTTP-level regression proving ready `/snapshot?profile=visible&visible_model_ref=...` itself uses the scoped path.
  - Either add finer timing fields or narrow the Step 2 timing acceptance wording.
- Fixes:
  - Added `test_ready_http_visible_route_uses_scoped_builder_not_full_snapshot`.
  - Narrowed Step 2 acceptance to existing response timing plus browser metrics; deeper per-substage timing is out of this implementation unless later needed.
- Re-verification:
  - `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`: `4 passed, 0 failed`
  - `node scripts/tests/test_0425_visible_model_refs_contract.mjs`: `7 passed, 0 failed out of 7`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`: `PASS 8/8`
  - `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`: `7 passed`
  - `node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs`: `4 passed, 0 failed out of 4`

### Step 3 Review 2

- Review Type: AI-assisted / sub-agent
- Review Index: 2
- Decision: Change Requested
- Notes:
  - Scoped builder applied host model-id capability restrictions to App table-local model ids.
  - Missing regression for App table-local `model_id=1050`, which is restricted only in the host table.
- Fixes:
  - `buildClientRuntimeModelForPrincipal` now applies `requiredCapabilityForClientModel(...)` only when the runtime model is in the host table.
  - Added `test_scoped_visible_builder_allows_app_local_restricted_host_model_id`.
- Re-verification:
  - `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`: `5 passed, 0 failed`
  - `node scripts/tests/test_0425_visible_model_refs_contract.mjs`: `7 passed, 0 failed out of 7`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`: `PASS 8/8`
  - `node scripts/tests/test_0425_principal_desktop_state_contract.mjs`: `6 passed`

### Step 4

- Command:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/playwright_session_guard.sh cleanup`
  - `bash scripts/ops/playwright_session_guard.sh session open 'http://localhost:30900/auth/dev/fake-login?user=drop&returnTo=/' --headed`
  - Browser fetch loop for `/snapshot?profile=bootstrap&initial_projection=1`
  - Browser fetch loop for `/snapshot?profile=visible&visible_model_ref={"table_id":"app:drop:e2e:2-0-20:1","model_id":0}`
  - Browser `EventSource('/stream?profile=bootstrap&visible_model_ref=...')` with `snapshot` event listener
  - Browser E2E color generator click on `Generate Color`
- Key output:
  - Local deploy pods ready:
    - `ui-server-7f7ddc64f4-s5dfh`
    - `mbr-worker-69f4568476-4wsf7`
    - `remote-worker-6765bcb464-kglfp`
    - `workspace-manager-8f7cc6b64-wqspx`
    - `mosquitto-6fc4d99b5b-h6v64`
    - `synapse-7b96968976-rr8nh`
  - Auth note:
    - `DY_DEV_FAKE_LOGIN=1` is active in the local stack.
    - Correct local test entrypoint is `GET /auth/dev/fake-login?user=drop&returnTo=/`.
    - A previous failed probe used the obsolete `POST /auth/dev-fake-login` path and was not a deployment failure.
  - Logged-in bootstrap snapshot:
    - `832.7ms`, `724.4ms`, `779.3ms`, `792.5ms`
    - bytes: `29102`
    - host models: `0`, `-102`, `-29`, `-28`, `-2`, `-1`
  - Logged-in explicit visible App-table snapshot:
    - `108.6ms`, `33.1ms`, `8.3ms`, `59.7ms`, `14.2ms`, `11.5ms`
    - bytes: `15285`
    - table: `app:drop:e2e:2-0-20:1`
    - model: `0`
  - Visible snapshot target comparison:
    - Baseline from 0435: about `717-763ms`.
    - Current hot path: `8-60ms` after first warm request.
    - Target met: yes, greater than 50% improvement for explicit visible snapshot build/fetch.
  - SSE bootstrap + visible ref:
    - First `snapshot` event received in `730.2ms`.
    - event bytes: `43421`
    - host bootstrap models: `0`, `-102`, `-29`, `-28`, `-2`, `-1`
    - requested App table included: `app:drop:e2e:2-0-20:1`
  - E2E color generator:
    - Opened `E2E 颜色生成器`.
    - Clicked `Generate Color`.
    - Color changed from `#d08c29` to `#e33f9f`.
    - Browser-observed end-to-end latency: `3629.4ms`.
- Result:
  - Explicit ready visible snapshot build/fetch latency improved substantially.
  - Bootstrap and SSE first snapshot remain around `724-833ms` / `730ms`; this is the next likely optimization area, separate from the ready visible scoped builder.
  - E2E color generator remains functional, but the full business round trip remains about `3.6s`, so its dominant cost is outside the optimized visible snapshot response path.
- Commit: pending

### Step 4 Final Review

- Review Type: AI-assisted / sub-agent
- Review Index: 4
- Decision: Change Requested
- Notes:
  - App-table explicit `visible_model_ref` avoided full snapshot construction, but host-table explicit `visible_model_ref={"table_id":"host",...}` still delegated to `validateVisibleModelId(...)`, which used `visibleModelRefsForClient(...)` and called `runtime.snapshot()`.
  - Missing deterministic coverage for the host-table visible-ref route.
- Fixes:
  - Added `test_ready_http_host_visible_ref_uses_scoped_builder_not_full_snapshot`.
  - Replaced host-table visible-ref validation with direct runtime/model label checks:
    - required capability is still enforced;
    - model existence is still checked by `runtime.getModel(...)`;
    - polluted `ws_apps_registry` is not treated as truth;
    - host visibility is limited to built-in workspace Apps, allowed workspace entries with App signals, or installed slide Apps with App signals.
- Re-verification:
  - `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`: `6 passed, 0 failed`
  - `node scripts/tests/test_0425_visible_model_refs_contract.mjs`: `7 passed, 0 failed out of 7`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`: `PASS 8/8`

### Step 4 Final Review 2

- Review Type: AI-assisted / sub-agent
- Review Index: 5
- Decision: Approved
- Notes:
  - Sub-agent re-reviewed the host-table visible-ref direct validation fix, new HTTP regression test, runlog metrics, and verification set.
  - No findings, no open questions, no verification gaps.

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed for scope impact; no SSOT semantics change required.
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed for scope impact; no user-facing fill-table behavior change required.
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed for scope impact; no governance change required.

## Review Gate

Review Gate Record
- Iteration ID: 0436-runtime-snapshot-build-latency
- Review Date: 2026-07-04
- Review Type: AI-assisted / sub-agent
- Review Index: 1
- Decision: Change Requested
- Notes: Sub-agent required explicit principal/subtable ownership verification and SSE/patch recovery verification before approval.

Review Gate Record
- Iteration ID: 0436-runtime-snapshot-build-latency
- Review Date: 2026-07-04
- Review Type: AI-assisted / sub-agent
- Review Index: 2
- Decision: Approved
- Notes: Sub-agent approved the revised plan/resolution. Phase 3 may start.
