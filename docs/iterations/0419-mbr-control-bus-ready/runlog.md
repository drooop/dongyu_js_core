---
title: "Iteration 0419-mbr-control-bus-ready Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-06-18
source: ai
iteration_id: 0419-mbr-control-bus-ready
id: 0419-mbr-control-bus-ready
phase: hotfix
---

# Iteration 0419-mbr-control-bus-ready Runlog

## Environment

- Date: 2026-06-18
- Branch: `dropx/dev_0419-mbr-control-bus-ready`
- Runtime: local `dongyu` namespace, `http://localhost:30900/#/`

## Execution Records

### Root Cause Investigation

- Command: `kubectl -n dongyu logs deploy/mbr-worker --since=70m | rg -n "runtime_mode|READY|mgmt READY|matrix adapter|mqtt READY|failed|drop pre-running"`
- Key output:
  - `[worker] runtime_mode=edit`
  - `[worker] mqtt READY subscribed=UIPUT/ws/dam/pic/de/+/+/+`
  - `[worker] matrix adapter init failed: Error: sync_timeout`
  - `[worker] drop pre-running mqtt topic=UIPUT/ws/dam/pic/de/R1/3100/bundle_request ...`
  - `[worker] drop pre-running mqtt topic=UIPUT/ws/dam/pic/de/U1/1051/result ...`
- Result: PASS, root cause confirmed at MBR readiness gating.

### MBR Runner Contract And Fix

- Command: `node scripts/tests/test_0419_mbr_control_bus_ready_contract.mjs`
- Pre-fix result: FAIL, MBR readiness still depended on `matrixReady`.
- Change:
  - Removed Matrix adapter readiness from MBR runtime activation gate.
  - Kept MQTT readiness as the control-bus gate.
  - Kept Matrix management-bus pre-running drop behavior.
- Post-fix command: `node scripts/tests/test_0419_mbr_control_bus_ready_contract.mjs`
- Result: PASS.

### MBR Local Deploy

- Command: `docker build -f k8s/Dockerfile.mbr-worker -t dy-mbr-worker:v2 .`
- Command: `kubectl -n dongyu rollout restart deployment/mbr-worker && kubectl -n dongyu rollout status deployment/mbr-worker --timeout=180s`
- Result: PASS.
- Evidence from new MBR pod:
  - `[worker] mqtt READY subscribed=UIPUT/ws/dam/pic/de/+/+/+`
  - `[worker] runtime_mode=running`
  - Matrix adapter can still fail independently without blocking MQTT routing.

### Browser Click Evidence After MBR Fix

- Chrome target: `http://localhost:30900/#/`
- Action: Workspace Manager → click install on `E2E 颜色生成器`.
- MBR evidence:
  - `recv mqtt topic=UIPUT/ws/dam/pic/de/R1/3100/bundle_request`
  - `recv mqtt topic=UIPUT/ws/dam/pic/de/U1/1051/result`
- RemoteWorker evidence:
  - Received provider bundle request.
  - Published response to `UIPUT/ws/dam/pic/de/U1/1051/result`.
- UI evidence:
  - UI still stayed at requesting state.
- Result: FAIL, second root cause found at UI Server inbound response handling.

### UI Server Shared Control-Bus Inbound Root Cause

- Command: `kubectl -n dongyu logs deploy/ui-server --since=80m | rg -n "Control bus adapter connected|Control bus subscribe failed|Control bus adapter error|ProgramModelEngine"`
- Key output:
  - Matrix adapter logs appeared.
  - No `Control bus adapter connected` log appeared.
- Code review:
  - Authenticated `/api/runtime/mode` only activated the current principal runtime.
  - MQTT response dispatch is wrapped on the shared `state.programEngine`, which was not activated and therefore did not subscribe.
- Result: PASS, root cause confirmed: per-principal runtime could send requests, but the shared MQTT inbound listener was never started.

### UI Server Contract And Fix

- Pre-fix command: `node scripts/tests/test_0419_mbr_control_bus_ready_contract.mjs`
- Pre-fix result: FAIL on missing shared control-bus inbound activation.
- Change:
  - Added `ensureSharedControlBusInboundReady()` in `packages/ui-model-demo-server/server.mjs`.
  - `/api/runtime/mode` now starts the shared inbound listener before activating the principal runtime.
  - Duplicate startup is guarded by `sharedControlBusInboundReadyPromise`.
- Post-fix commands:
  - `node scripts/tests/test_0419_mbr_control_bus_ready_contract.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
  - `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
  - `node scripts/tests/test_0179_mbr_runtime_mode_gate.mjs`
- Result: PASS.

### UI Server Local Deploy

- Command: `docker build -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`
- Result: PASS.
- Command: `kubectl -n dongyu rollout restart deployment/ui-server && kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`
- Result: PASS.
- Pod evidence:
  - `Image ID: docker://sha256:6b49e4853521f3f19a59584bcf43008a696ab7328f50a45e5fb112511e6b4004`
  - `ui-model-demo-server listening on http://0.0.0.0:9000`

### Browser Verification Status

- Chrome target: `http://localhost:30900/#/`
- Current state after ui-server restart:
  - Page loads.
  - User session is unauthenticated and displays `访客只读`.
  - Clicking login reaches `https://sso.dongyudigital.com/...` login-name page.
- Result: BLOCKED for authenticated click verification until the user completes SSO login in Chrome.

### SSO Callback Recheck

- Symptom: Chrome showed `{"ok":false,"error":"invalid_oidc_state"}` on an `/auth/sso/callback?...` URL.
- Controlled check:
  - Fresh command: `curl -sS -D /tmp/dy_sso_start_headers.txt -o /tmp/dy_sso_start_body.txt 'http://localhost:30900/auth/sso/start?returnTo=%2F%23%2F'`
  - Result: `302`, `dy_oidc_state=...; HttpOnly; SameSite=Lax; Path=/auth/sso/callback; Max-Age=300`
  - Callback probe with the same fresh state and a fake code returned `401 {"ok":false,"error":"invalid_request"}`.
- Interpretation:
  - Fresh state now passes local OIDC state validation.
  - The observed `invalid_oidc_state` page is consistent with a stale or already-expired callback URL, not with current fresh `/auth/sso/start` state validation.
- Code guard:
  - `dy_session` is `SameSite=Lax`, matching top-level OIDC return behavior.
- Verification:
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs` → PASS.

### Principal Runtime Provider Bundle Response Root Cause

- Symptom: Workspace Manager install request reached R1 and the response reached `UIPUT/ws/dam/pic/de/U1/1051/result`, but the UI stayed in the requesting state.
- Root cause:
  - `reply_target_principal_key` correctly identified the logged-in user's runtime.
  - However, `createPrincipalRuntimeRegistry().handleControlBusPacket()` handled the response itself by writing nested payload labels directly into the target model.
  - For `slide_app_bundle_response.v1`, this bypassed the Workspace Manager bundle installer, so no app was materialized and no success Dialog opened.
- Fix:
  - Principal registry now only routes the packet to the addressed user's own `ProgramModelEngine.handleControlBusPacket()`.
  - The user runtime's normal handler performs strict bundle validation, materialization, app registry refresh, and Dialog label updates.
  - No compatibility direct-write path was kept.
- Sub-agent review finding:
  - The first fix still returned only a boolean to the shared listener wrapper.
  - A principal-targeted response rejected by the user runtime could therefore fall through into the shared runtime.
- Follow-up fix:
  - Principal registry now returns `matched` and `handled` separately.
  - If a packet is matched as a principal-targeted response, rejection stops there and never falls back to the shared runtime.
  - Any packet that contains a `reply_target_principal_key` record is claimed as principal-targeted, even when that record is malformed and the packet is rejected.
- Regression:
  - Added `principal_registry_delegates_bundle_response_to_user_runtime_installer` in `scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`.
  - Added `principal_response_rejection_does_not_fallback_to_shared_runtime` in `scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`, covering both missing runtime and malformed principal marker cases.
  - Updated `scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs` fixtures to use current strict response-topic shape and real object packet payloads.
- Verification:
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs` → `7 passed, 0 failed out of 7`
  - `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs` → `PASS 10/10`
  - `node scripts/tests/test_0419_mbr_control_bus_ready_contract.mjs` → PASS
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs` → `15 passed, 0 failed out of 15`
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs` → `14 passed, 0 failed out of 14`
  - `node scripts/tests/test_0144_remote_worker.mjs` → `7 passed, 0 failed out of 7`
  - `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs` → `74 passed, 0 failed out of 74`
  - `node scripts/tests/test_0179_mbr_runtime_mode_gate.mjs` → PASS

### Legacy MBR Validator Status

- Command: `node scripts/validate_mbr_patch_v0.mjs`
- Result: FAIL, `68 PASS / 37 FAIL`.
- Interpretation:
  - This validator still encodes older MBR packet/output expectations.
  - It is not used as the 0419 release gate.
  - The current 0419 gate is the explicit control-bus readiness/routing contract plus the bus/runtime behavior tests listed above.

### Final Local Deploy And SSO Browser Verification

- Commands:
  - `npm -C packages/ui-model-demo-frontend run build`
  - `docker build -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`
  - `docker build -f k8s/Dockerfile.mbr-worker -t dy-mbr-worker:v2 .`
  - `docker build -f k8s/Dockerfile.remote-worker -t dy-remote-worker:v3 .`
  - `LOCAL_PERSISTED_ASSET_ROOT=/Users/drop/dongyu/volume/persist/assets bash scripts/ops/sync_local_persisted_assets.sh`
  - `kubectl -n dongyu rollout restart deployment/ui-server deployment/remote-worker deployment/mbr-worker`
- Result: PASS.
- New pod evidence:
  - `ui-server-85b487489b-7kqrc` running, listening on `0.0.0.0:9000`.
  - `mbr-worker-78f9cd854b-s54n9` running, `mqtt READY`, `runtime_mode=running`, `READY`.
  - `remote-worker-7d65d89594-lmjth` running, subscribed to `UIPUT/ws/dam/pic/de/R1/{100,1010,1019,3000,3100}/...`.
- Fresh SSO state check:
  - `/auth/sso/start?returnTo=%2F%23%2F` returns `302` to `sso.dongyudigital.com`.
  - `dy_oidc_state` cookie is set with `SameSite=Lax`.
  - Callback probe using that same fresh state and a fake code returns `401 invalid_request`, proving local state validation passed and the request reached upstream token exchange.
- Browser check:
  - Playwright opened `http://localhost:30900/#/`: page title `UI Model Demo`, desktop rendered normally.
  - Clicking `登录` navigated to `https://sso.dongyudigital.com/ui/v2/login/loginname?...`, title `欢迎回来！`.
  - Screenshot: `output/playwright/0419-sso-login-entry-after-fix.png`.
- Authenticated Chrome click check:
  - Attempted to claim the user's already logged-in Chrome tab.
  - Chrome extension health checks passed for Chrome running, extension installed/enabled, and native host manifest.
  - Extension communication still returned `Browser is not available`, so authenticated manual-tab install click could not be safely automated in this run.

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed: no semantic change required; this is runner readiness behavior for existing control-bus routing.
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed: no user-facing authoring change required.
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed: no governance change required.
