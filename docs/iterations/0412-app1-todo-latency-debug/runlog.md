---
title: "Iteration 0412 app1 ToDo Latency Debug Run Log"
doc_type: iteration_runlog
status: in_progress
updated: 2026-06-10
source: ai
---

# Iteration 0412-app1-todo-latency-debug Runlog

## Environment

- Date: 2026-06-10
- Branch: `dropx/dev_0412-app1-todo-latency-debug`
- Runtime: local repo + remote dy-cloud rke2 cluster

Review Gate Record
- Iteration ID: 0412-app1-todo-latency-debug
- Review Date: 2026-06-10
- Review Type: User
- Review Index: 1/1
- Decision: Approved
- Notes: User approved the plan with "可以，开始".

## Execution Records

### Step 1 — Intake, Branch, And Remote Read-Only Baseline

- Command:
  - `git switch -c dropx/dev_0412-app1-todo-latency-debug`
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0412-app1-todo-latency-debug --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - `ssh dy-cloud "kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu get deploy,svc,ingress,pods -o wide"`
  - `curl -fsSI https://app.dongyudigital.com/ | sed -n '1,20p'`
  - `curl -k -sSI https://app1.dongyudigital.com/ | sed -n '1,30p' || true`
  - `git status --short --branch`
- Key output:
  - `Switched to a new branch 'dropx/dev_0412-app1-todo-latency-debug'`
  - scaffold wrote `plan.md`, `resolution.md`, `runlog.md`
  - remote deployments Ready: `ui-server`, `mbr-worker`, `remote-worker`, `workspace-manager`, `mosquitto`, `synapse`, `www-static`
  - remote Ingress hosts before work: `app.dongyudigital.com`, `www.dongyudigital.com`
  - `https://app.dongyudigital.com/` returned `HTTP/2 401`, confirming existing app endpoint is reachable behind auth.
  - `https://app1.dongyudigital.com/` returned `HTTP/2 404`, confirming DNS/TLS reach nginx but no app1 route is installed yet.
  - pre-existing unrelated dirty files remain: `docs/dongyu-app-zitadel-matrix-auth-visualized.html`, `CLAUDE_副本.md`
- Result: PASS
- Commit: this commit

### Step 2 — Contract Tests For ToDo Provider Asset And ui-server-1

- Command:
  - `node scripts/tests/test_0412_todo_provider_app1_contract.mjs`
- Key output:
  - RED failed as expected: `R1 provider must store To Do app 1 bundle as json`
- Result: PASS (expected RED)
- Commit:

### Step 3 — Add ToDo Provider Asset And Isolated ui-server-1 Manifest

- Command:
  - `node scripts/tests/test_0412_todo_provider_app1_contract.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
  - `node scripts/tests/test_0408_todo_board_import_payload_contract.mjs`
  - `node scripts/tests/test_0405_todo_slide_app_contract.mjs`
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
  - `kubectl apply --dry-run=client -f k8s/cloud/workers.yaml`
  - `git diff --check`
- Key output:
  - `PASS test_0412_todo_provider_app1_contract`
  - provider-owned install flow: `5 passed, 0 failed out of 5`
  - ToDo import payload: `PASS test_0408_todo_board_import_payload_contract`
  - ToDo slide app contract: `3 passed, 0 failed out of 3`
  - Workspace asset manager contract: `4 passed, 0 failed out of 4`
  - dry-run created `deployment.apps/ui-server-1`, `service/ui-server-1`, `ingress.networking.k8s.io/ui-server-1`
  - `git diff --check` passed
- Result: PASS
- Commit: this commit

### Step 4 — Add Lightweight Timing Evidence

- Command:
  - browser / API timing against `https://app1.dongyudigital.com/`
  - runtime trace inspection on imported app submit path
- Key output:
  - Imported app button actions on app1 consistently took about 3-4s before the browser reflected the next state.
  - R1/MQTT request-response path for imported app `1088` returned in about 2.6-3.3s based on trace timestamps.
  - The long wait after clicking "保存任务" was not an MQTT no-response timeout; R1 returned, but the response did not contain ToDo state updates.
- Result: PASS
- Commit:

### Step 5 — Remote Deploy To app1

- Command:
  - `kubectl` rollout/status checks for isolated `ui-server-1`
  - `curl`/browser checks against `https://app1.dongyudigital.com/`
- Key output:
  - `https://app1.dongyudigital.com/` served the isolated UI after SSO configuration.
  - User completed SSO login; browser session showed `yuanchen yang`.
  - Existing `https://app.dongyudigital.com/` was not changed during this validation.
- Result: PASS
- Commit:

### Step 6 — Browser Install And ToDo Create Latency Run

- Command:
  - Upload `/Users/drop/Downloads/app_payload(1).zip` through the slide import upload flow.
  - Trigger `slide_import_media_uri_update` and `slide_import_click` on app1.
  - Use Playwright against `https://app1.dongyudigital.com/#/`.
- Key output:
  - ZIP contains one `app_payload.json` with 295 records.
  - Imported app name: `To Do Board`.
  - Imported app id: `1088`.
  - Workspace page displayed `To Do Board · model 1088`.
  - Initial imported app did not open the create dialog because `todo_request_wiring` resolved `handle_todo_event:in` as a same-cell pin instead of the same-cell function input.
  - Applied a model-1088-only app-level repair for testing by removing explicit `handle_todo_event:in/out/logout` pin labels and rebuilding the wiring. This avoided restarting `ui-server-1`.
  - After repair, browser click on `新增任务` opened the dialog.
  - Browser click on `取消` closed the dialog; task count stayed unchanged.
  - Browser click on `保存任务` kept the dialog open and did not add a task. Current page snapshot still shows four columns with one item each and the filled dialog still visible.
  - Console had 6 existing errors: one `/auth/me` 401 before logged-in state settled, one SSE error, two 1Password icon 404s, and an SSO login 500 / React #419 from the earlier login page. No new app-specific JavaScript exception appeared for the ToDo submit action.
- Result: FAIL (submit did not materialize a new ToDo task)
- Commit:

### Step 7 — Analyze, Report, And Close

- Command:
  - `node scripts/tests/test_0413_func_endpoint_port_priority_contract.mjs`
  - `node scripts/tests/test_0321_imported_host_ingress_server_flow.mjs`
  - `node scripts/tests/test_0408_todo_board_import_payload_contract.mjs`
  - `node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs`
  - `git diff --check -- packages/worker-base/src/runtime.mjs scripts/tests/test_0413_func_endpoint_port_priority_contract.mjs`
  - `git status --short`
- Key output:
  - Added `scripts/tests/test_0413_func_endpoint_port_priority_contract.mjs` to reproduce the explicit-pin/function-input collision.
  - Fixed `packages/worker-base/src/runtime.mjs` so a same-cell `{funcName}:in/out/logout` endpoint wins when a matching function exists, even if a user payload also declares a pin label with that key.
  - Fixed same-cell wiring rebuild when a `func.js` / `func.python` label is added after wiring has already been parsed.
  - Added `docs/user-guide/slide-app-runtime/function_port_collision_repair_guide.md` with before/after examples, source ZIP repair steps, installed-instance repair steps, runtime maintainer notes, and verification commands.
  - Linked the repair guide from `docs/user-guide/README.md`, `docs/user-guide/slide-app-runtime/README.md`, `docs/user-guide/modeltable_user_guide.md`, and `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md`.
  - All targeted tests passed.
  - Remaining submit failure is upstream of the ToDo business state update: R1 responds with generic `remote_processed` / `display_text`, but does not return `tasks_json` or `create_dialog_open=false`; the imported app also has no local response handler that converts the generic R1 response into a new task.
  - Working tree contains unrelated pre-existing changes in `docs/dongyu-app-zitadel-matrix-auth-visualized.html` and `package.json`; do not include them in this iteration result.
- Result: PASS (root cause isolated; user-visible submit flow still failing)
- Commit:

### Step 8 — Local Trace Contract And OIDC Config Guard

- Command:
  - `node scripts/tests/test_0412_local_latency_trace_contract.mjs` (RED before implementation)
  - `node scripts/tests/test_0412_local_latency_trace_contract.mjs` (GREEN after implementation)
  - `node scripts/tests/test_0405_todo_submit_overlay_contract.mjs`
  - `node scripts/tests/test_0407_current_model_ref_contract.mjs`
  - `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
  - `node scripts/tests/test_0413_func_endpoint_port_priority_contract.mjs`
- Key output:
  - Initial RED: `5 failed, 0 passed`; missing local SSO client-id guard, missing client dispatch timing, missing response timing.
  - After Step 8 implementation, before the Step 10 fallback optimization assertions: `PASS test_0412_local_latency_trace_contract: 7 passed`.
  - The new test covers:
    - local env example points to remote SSO with `DY_OIDC_CLIENT_ID=375920990745592038`;
    - frontend `buildBusEventV2` adds client dispatch timing;
    - renderer CJS and ESM direct `bus_event_v2` binding adds client dispatch timing;
    - remote store augments `/bus_event` responses with client post/response/roundtrip timing;
    - server `submitEnvelope` returns server receive/start/complete/duration timing;
    - authenticated `POST /bus_event` HTTP route returns timing for the same `op_id` after mock ZITADEL login, `app:write` capability check, and runtime-mode activation.
  - Sub-agent `codex-code-review` result: `CHANGE_REQUESTED`; it correctly flagged that the first Step 8 version did not test the real HTTP route and did not persist ESM renderer coverage.
  - Fix after review: added mock OIDC authenticated route test and ESM renderer test.
  - Existing targeted regressions stayed green:
    - `PASS test_0405_todo_submit_overlay_contract`
    - `PASS test_0407_current_model_ref_contract: 6 passed`
    - `PASS test_0326_ui_event_busin_flow: 31 passed`
    - `PASS test_0413_func_endpoint_port_priority_contract: 1 passed`
- Result: PASS
- Commit:

### Step 9 — Local Runtime And Browser Trace Verification

- Command:
  - `python3` redirect probe for ZITADEL authorize URL with `127.0.0.1` and `localhost` callback candidates.
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `kubectl -n dongyu get deploy ui-server mbr-worker remote-worker workspace-manager -o wide`
  - `kubectl -n dongyu get secret ui-server-secret -o jsonpath='{.data.DY_AUTH}' | base64 --decode`
  - `kubectl -n dongyu get secret ui-server-secret -o jsonpath='{.data.DY_OIDC_CLIENT_ID}' | base64 --decode`
  - `kubectl -n dongyu get secret ui-server-secret -o jsonpath='{.data.DY_OIDC_REDIRECT_URI}' | base64 --decode`
  - `python3` no-redirect request to `http://localhost:30900/auth/sso/start?returnTo=%2F%23%2F`
  - `curl -sS -o /tmp/0412-local-snapshot.json -w 'status=%{http_code} time=%{time_total}\n' http://localhost:30900/snapshot`
  - Playwright browser: open `http://localhost:30900/#/`, click `登录`, inspect final page.
- Key output:
  - ZITADEL rejected `http://127.0.0.1:30900/auth/sso/callback` with `invalid_request` / missing redirect URI in client configuration.
  - ZITADEL accepted `http://localhost:30900/auth/sso/callback` and returned its login UI, so local config was corrected to `localhost`.
  - Local deploy rebuilt `dy-ui-server:v1`, `dy-remote-worker:v3`, `dy-mbr-worker:v2` and rolled out `ui-server`, `mbr-worker`, `remote-worker`, and `workspace-manager`.
  - Deployment readiness after rollout:
    - `ui-server 1/1`
    - `mbr-worker 1/1`
    - `remote-worker 1/1`
    - `workspace-manager 1/1`
  - `ui-server-secret` after deploy:
    - `DY_AUTH=1`
    - `DY_OIDC_CLIENT_ID=375920990745592038`
    - `DY_OIDC_REDIRECT_URI=http://localhost:30900/auth/sso/callback`
  - `/auth/sso/start` returned `302` to `https://sso.dongyudigital.com/oauth/v2/authorize` with `client_id=375920990745592038` and `redirect_uri=http%3A%2F%2Flocalhost%3A30900%2Fauth%2Fsso%2Fcallback`.
  - `/snapshot` returned `status=200 time=0.398094`, with 47 visible client models for the unauthenticated/public snapshot.
  - Playwright opened `http://localhost:30900/#/`; UI showed `访客只读` and `登录`, with `/snapshot` 200 and `/auth/me` 401 as expected for an unauthenticated browser.
  - Playwright clicked `登录`; browser landed on remote ZITADEL page `欢迎回来！`, not the prior `invalid_request` JSON error.
  - ZITADEL login page viewport check at `1440x1000`: no outer horizontal or vertical overflow (`docScrollWidth=1440`, `docScrollHeight=1000`).
  - Browser page was closed after verification to avoid leftover Playwright windows.
  - Authenticated `/bus_event` timing remains covered by the mock-ZITADEL route-level test from Step 8 because this Playwright session had no logged-in remote ZITADEL account session. The test preserves the real server auth/capability gate and HTTP route while avoiding real credentials in the repo.
- Result: PASS
- Commit:

### Step 10 — Local Optimization From Timing Evidence

- Optimization point recorded:
  - The shared client path `remote_store.postEnvelope()` still performed a synchronous full `/snapshot` fallback after every successful `bus_event_v2` response when the response omitted `snapshot`.
  - The server-side `/bus_event` route already calls `broadcastSnapshot()` before returning the small JSON response, so the immediate extra `/snapshot` is usually duplicate work.
  - On localhost this extra fetch is modest, but on remote it adds公网/Ingress/TLS/server serialization成本 to every write operation and can delay the browser-visible completion path.
- Change:
  - Successful `bus_event_v2` responses no longer synchronously fetch `/snapshot`.
  - The fallback is now delayed and coalesced for 300ms; it is cancelled only when an SSE/applySnapshot carries `bus_event_last_op_id` matching the current bus event.
  - Stale or unrelated SSE snapshots no longer cancel the fallback, preserving recovery when the matching SSE update is lost or delayed.
  - Error responses still fetch `/snapshot` immediately, preserving diagnostic recovery behavior.
  - This does not change the business path: UI events still go through `/bus_event` → Model 0 / pin bus; no direct label writes were added.
  - SSE review: keep SSE for now. Local measurement shows the protocol is not the issue; the full snapshot payload is about 576KB. SSE still avoids an extra HTTP request/handshake compared with immediate GET fallback. The better future direction is delta/patch SSE with `snapshot_seq`/`op_id`, not polling or per-write full GET.
- Command:
  - `node scripts/tests/test_0412_local_latency_trace_contract.mjs` (RED after adding the optimization assertion)
  - `node scripts/tests/test_0412_local_latency_trace_contract.mjs` (GREEN after implementing deferred fallback)
  - `node scripts/tests/test_0412_local_latency_trace_contract.mjs` (RED after adding stale-SSE counterexample)
  - `node scripts/tests/test_0412_local_latency_trace_contract.mjs` (GREEN after requiring `bus_event_last_op_id` match)
  - `node scripts/tests/test_0403_deploy_sso_env_contract.mjs`
  - `node scripts/tests/test_0329_bus_event_last_op_id_snapshot_contract.mjs`
  - `node scripts/tests/test_0405_todo_submit_overlay_contract.mjs`
  - `node scripts/tests/test_0407_current_model_ref_contract.mjs`
  - `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
  - `node scripts/tests/test_0413_func_endpoint_port_priority_contract.mjs`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `kubectl -n dongyu get deploy ui-server mbr-worker remote-worker workspace-manager -o jsonpath='{range .items[*]}{.metadata.name} {.status.readyReplicas}/{.spec.replicas}{"\n"}{end}'`
  - `curl -sS -o /tmp/0412-local-snapshot-opt.json -w 'status=%{http_code} time=%{time_total}\n' http://localhost:30900/snapshot`
  - `curl -sS -o /tmp/0412-local-snapshot-final2.json -w 'snapshot_status=%{http_code} time=%{time_total} size=%{size_download}\n' http://localhost:30900/snapshot`
  - `curl -sS -N --max-time 5 http://localhost:30900/stream > /tmp/0412-sse.out || true`
  - Playwright browser: open `http://localhost:30900/#/`, inspect loaded JS and viewport.
- Key output:
  - RED failure before implementation: `successful bus_event_v2 response must not synchronously fetch full snapshot; SSE/deferred fallback should carry the update`.
  - RED stale-SSE counterexample before tightening cancellation: `stale or unrelated SSE snapshot must not cancel the deferred full snapshot fallback`.
  - GREEN after implementation: `PASS test_0412_local_latency_trace_contract: 9 passed`.
  - Targeted regression tests stayed green:
    - `test_0403_deploy_sso_env_contract: PASS`
    - `PASS test_0329_bus_event_last_op_id_snapshot_contract`
    - `PASS test_0405_todo_submit_overlay_contract`
    - `PASS test_0407_current_model_ref_contract: 6 passed`
    - `PASS test_0326_ui_event_busin_flow: 31 passed`
    - `PASS test_0413_func_endpoint_port_priority_contract: 1 passed`
  - Local deployment completed after optimization; final frontend asset: `assets/index-DH1g4saA.js`.
  - Deployment readiness after rollout:
    - `ui-server 1/1`
    - `mbr-worker 1/1`
    - `remote-worker 1/1`
    - `workspace-manager 1/1`
  - Post-deploy `/snapshot`: `snapshot_status=200 time=0.194869 size=576496`.
  - SSE first snapshot frame size from `/stream`: `576520` bytes. This is essentially the same full snapshot payload as `/snapshot`, but delivered over the already-open SSE stream.
  - Post-deploy SSO start still returns `302` with `client_id=375920990745592038` and `redirect_uri=http%3A%2F%2Flocalhost%3A30900%2Fauth%2Fsso%2Fcallback`.
  - Playwright loaded `http://localhost:30900/#/` with `scriptSrc=http://localhost:30900/assets/index-DH1g4saA.js`.
  - Browser viewport check at `1440x1000`: no outer horizontal or vertical overflow (`docScrollWidth=1440`, `docScrollHeight=1000`).
  - Browser network after load: `/snapshot` 200 and `/auth/me` 401, expected for unauthenticated local browser.
  - Browser page was closed after verification.
- Result: PASS
- Commit:

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed; existing section 5.2b already states `{funcName}:in/out/logout` are function-owned endpoints.
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed; no doc change needed for this implementation correction.
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
