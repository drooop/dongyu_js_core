---
title: "Iteration 0421 SSO Post Login Latency Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-06-23
source: ai
iteration_id: 0421-sso-post-login-latency
id: 0421-sso-post-login-latency
phase: completed
---

# Iteration 0421-sso-post-login-latency Runlog

## Environment

- Date: 2026-06-23
- Branch: `dropx/dev_0421-sso-post-login-latency`
- Runtime: local `dongyu` namespace through `http://localhost:30900/#/`

Review Gate Record
- Iteration ID: `0421-sso-post-login-latency`
- Review Date: 2026-06-23
- Review Type: User
- Review Index: 0
- Decision: Approved to diagnose and continue the latency fix
- Notes: User reported SSO two-step login returns to the desktop shell but spends about 1 minute on `确认登录中 / 页面暂不可用`.

Review Gate Record
- Iteration ID: `0421-sso-post-login-latency`
- Review Date: 2026-06-23
- Review Type: AI-assisted sub-agent
- Review Index: 1
- Decision: Change Requested
- Notes: Plan review required explicit separation of auth failure vs initialization, principal-scoped initialization coalescing, visible failure states, finer timing buckets, and cross-principal/failure-path tests.

Review Gate Record
- Iteration ID: `0421-sso-post-login-latency`
- Review Date: 2026-06-23
- Review Type: AI-assisted main-agent revision
- Review Index: 2
- Decision: Change Requested handled; pending independent review approval
- Notes: Plan and resolution now require typed initialization/failure states, per-principal runtime isolation, stale/invalid session failure checks, and concrete before/after metrics. Execution remains blocked until plan review approves.

Review Gate Record
- Iteration ID: `0421-sso-post-login-latency`
- Review Date: 2026-06-23
- Review Type: AI-assisted sub-agent
- Review Index: 3
- Decision: Change Requested
- Notes: Plan review requested status rollback from In Progress to Planned until approval, explicit expired/invalid session test coverage, and workflow-consistent review gate placement.

Review Gate Record
- Iteration ID: `0421-sso-post-login-latency`
- Review Date: 2026-06-23
- Review Type: AI-assisted sub-agent
- Review Index: 4
- Decision: Approved
- Notes: Revised planning documents passed review with no findings. User had already approved continuing through reviewed stages.

Review Gate Record
- Iteration ID: `0421-sso-post-login-latency`
- Review Date: 2026-06-23
- Review Type: Main-agent factual correction
- Review Index: 5
- Decision: Scope clarification
- Notes: Existing product supports guest/read-only snapshots. The 0421 auth-failure invariant is clarified to mean stale/missing sessions must not enter authenticated workspace initialization; routes may still return guest/read-only snapshot where that is current policy.

## Phase 1 Planning

- Status: Approved for execution after sub-agent review.

## Baseline Measurements Before Implementation

- Real Chrome page after SSO return:
  - URL: `http://localhost:30900/#/`
  - visible state during wait: `确认登录中 / 页面暂不可用`
  - eventually entered tablet desktop.
- Chrome performance entries from the same tab:
  - `/snapshot?profile=bootstrap`: about `83426ms`, about `159068B` decoded body
  - `/auth/me`: about `83586ms`, about `418B` decoded body
  - `/api/runtime/mode`: about `4030ms`
  - second `/snapshot?profile=bootstrap`: about `2413ms`, about `159071B` decoded body
- Warm local curl after the delay:
  - `/auth/me`: `401` in about `0.006s` without browser session cookie
  - `/snapshot?profile=bootstrap`: `200` in about `0.57s`, about `155595B`
- Isolated Bun cold measurement using a temporary DB:
  - `createServerState`: about `1623ms`
  - `clientSnap`: about `29ms`
  - `buildClientSnapshotForPrincipal`: about `140ms`
  - `buildClientSnapshotProfile-bootstrap`: about `3ms`
- Local UI Server logs also show repeated remote Matrix `/sync` long-poll activity around `30s` and occasional `110s` aborts; 0421 must measure whether this competes with first desktop readiness rather than assuming it is causal.

## Execution Records

### Step 1 — RED Contract Tests And Metrics Harness

- Command: `node scripts/tests/test_0421_sso_post_login_latency_contract.mjs`
- Key output:
  - RED before implementation:
    - `FAIL auth_me_does_not_force_principal_runtime_before_snapshot`: first authenticated snapshot returned `200` instead of typed `202 workspace_initializing`.
    - `FAIL principal_runtime_initialization_is_not_shared_between_users`: second user's first snapshot reused synchronous ready path instead of proving cold initialization isolation.
    - `FAIL registry_surfaces_principal_runtime_initialization_failure`: registry did not expose async initialization status APIs.
  - GREEN after implementation:
    - `PASS auth_me_does_not_force_principal_runtime_before_snapshot`
    - `PASS bad_session_never_enters_authenticated_workspace_initializing`
    - `PASS auth_me_stays_fast_while_runtime_initialization_is_scheduled`
    - `PASS expired_session_never_enters_authenticated_workspace_initializing`
    - `PASS snapshot_surfaces_initialization_failure_end_to_end`
    - `PASS test_runtime_hooks_are_disabled_by_default`
    - `PASS principal_runtime_initialization_is_not_shared_between_users`
    - `PASS registry_surfaces_principal_runtime_initialization_failure`
    - `PASS frontend_distinguishes_workspace_initializing_from_page_unavailable`
    - `PASS frontend_retries_then_stops_on_workspace_initialization_failure`
    - `PASS test_0421_sso_post_login_latency_contract: 10 passed`
- Result: PASS — tests now cover lightweight `/auth/me`, authenticated cold snapshot `202`, invalid/expired session not entering authenticated initialization, per-principal isolation, endpoint failure state, frontend retry/failure state, no SSE connection on failed initialization, and test-only runtime initialization hooks being disabled by default.

Review Gate Record
- Iteration ID: `0421-sso-post-login-latency`
- Review Date: 2026-06-23
- Review Type: AI-assisted sub-agent
- Review Index: 6
- Decision: Change Requested
- Notes: Review requested proof that `/auth/me` stays fast while runtime initialization is scheduled, endpoint-level initialization failure tests, expired/stale session coverage, frontend retry-to-failure coverage, and runlog update.

### Step 2 / Step 3 — Runtime Initialization Contract And Frontend State

- Command:
  - `node scripts/tests/test_0421_sso_post_login_latency_contract.mjs`
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
  - `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
  - `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - `PASS test_0421_sso_post_login_latency_contract: 10 passed`
  - `15 passed, 0 failed out of 15`
  - `PASS 10/10`
  - `PASS test_0420_ui_local_state_latency_contract: 12 passed`
  - `6 passed, 0 failed out of 6`
  - `PASS 7/7`
  - `vite build ... built`
- Result: PASS — new initialization contract did not regress OIDC, user-isolated runtime routing, 0420 local UI latency behavior, frontend auth UX, or 0418 full/visible snapshot behavior.

Review Gate Record
- Iteration ID: `0421-sso-post-login-latency`
- Review Date: 2026-06-23
- Review Type: AI-assisted sub-agent
- Review Index: 7
- Decision: Approved
- Notes: Review confirmed the `DY_TEST_PRINCIPAL_RUNTIME_INIT_*` hooks are gated by `enableTestPrincipalRuntimeInitHooks`, `/auth/me` does not create/wait for principal runtime, bootstrap `202/503` behavior is scoped to `profile=bootstrap`, frontend does not connect SSE while initializing, and auth failure remains distinct.

Review Gate Record
- Iteration ID: `0421-sso-post-login-latency`
- Review Date: 2026-06-23
- Review Type: AI-assisted sub-agent
- Review Index: 8
- Decision: Change Requested
- Notes: Review found that `/api/runtime/mode` could remain stuck after receiving `202 workspace_initializing`. The frontend now retries the runtime-mode activation after the first ready snapshot.

Review Gate Record
- Iteration ID: `0421-sso-post-login-latency`
- Review Date: 2026-06-23
- Review Type: AI-assisted sub-agent
- Review Index: 9
- Decision: Approved
- Notes: Runtime-mode retry fix passed review with no remaining findings.

Review Gate Record
- Iteration ID: `0421-sso-post-login-latency`
- Review Date: 2026-06-23
- Review Type: AI-assisted sub-agent
- Review Index: 10
- Decision: Change Requested
- Notes: Review found that the read-only initializing projection must not be repeated on retries, and business-event routes must not create writable runtime instances while the authenticated workspace is still initializing.

Review Gate Record
- Iteration ID: `0421-sso-post-login-latency`
- Review Date: 2026-06-23
- Review Type: AI-assisted sub-agent
- Review Index: 11
- Decision: Approved
- Notes: First-only initial projection and cold `bus_event`/`ui_event` blocking passed review with no remaining findings.

### Step 3.5 — Read-only Initial Desktop Projection

- Problem found by real Chrome test:
  - The typed `workspace_initializing` state made the loading state correct, but the desktop still waited about `76s` on a cold authenticated runtime.
  - The visible delay was therefore not only an auth callback issue; the first full authenticated runtime/snapshot path still blocked the desktop.
- Change:
  - `GET /snapshot?profile=bootstrap&initial_projection=1` can return a read-only desktop projection quickly while the authenticated principal runtime initializes in the background.
  - The projection is explicitly marked as not truth: `truth_snapshot: false`, `snapshot_projection: "read_only_initializing"`.
  - The frontend requests that projection only on the first cold bootstrap. Later retries use normal bootstrap and do not repeatedly download the same large projection.
  - `/bus_event` and `/ui_event` return typed `202 workspace_initializing` while the principal runtime is cold, instead of creating a writable runtime or executing business events too early.
- Verification:
  - `node scripts/tests/test_0421_sso_post_login_latency_contract.mjs`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
- Result:
  - PASS — tests cover read-only projection semantics, first-only initial projection, blocked cold business events, and the existing visible snapshot behavior.

### Step 4 — Local Deploy And Real Browser SSO Measurement

- Commands:
  - `npm -C packages/ui-model-demo-frontend run build`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - Real Chrome navigation through `http://localhost:30900/auth/sso/start?returnTo=%2F`
- Deployment result:
  - UI Server pod: `ui-server-7994b5b6b5-cgxjl`, ready `1/1`
  - `curl http://localhost:30900/`: `status=200`, `total=0.006796s`
  - Note: after a rollout restart, the NodePort can take about `25-28s` to accept the first root request. That is deployment startup readiness, not the SSO page-internal delay being fixed here.
- Browser result after final implementation:

| Metric | Before 0421 | After typed init only | Final after initial projection |
|---|---:|---:|---:|
| Return to local app URL | not separately available | `826ms` | `797ms` |
| First initializing UI | `确认登录中 / 页面暂不可用` | `826ms`, typed loading | `797ms`, `正在确认登录` |
| Desktop visible | about `80s` observed, `/snapshot?profile=bootstrap` about `83426ms` | about `76010ms` | `1599ms` |
| Fully ready, no initializing text | about `80s+` | about `76010ms+` | `1722ms` |
| Generic `页面暂不可用` during SSO return | yes | no after follow-up text fix | no |
| Outer page scroll overflow | not checked in baseline | no | no: `scrollH=862/clientH=862`, `scrollW=1512/clientW=1512` |
| Inner scroll overflow on desktop | not checked in baseline | no | no matching inner scrollers |

- Final browser state:
  - URL: `http://localhost:30900/`
  - User visible: `yuanchen yang`
  - Desktop visible: `Dongyu Tablet`
  - `页面暂不可用`: not seen
  - `确认登录中`: cleared by `1722ms`

### Final Regression Commands

Final run after documentation update:

- `node scripts/tests/test_0421_sso_post_login_latency_contract.mjs`: PASS, `13 passed`
- `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`: PASS, `12 passed`
- `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`: PASS, `7/7`
- `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`: PASS, `10/10`
- `node scripts/tests/test_0403_oidc_session_gateway.mjs`: PASS, `15 passed, 0 failed`
- `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`: PASS, `6 passed, 0 failed`
- `node scripts/tests/test_0403_principal_authorization.mjs`: PASS, `6 passed, 0 failed`
- `npm -C packages/ui-model-demo-frontend run build`: PASS, Vite built `dist/assets/index-Dk9_8B-F.js`
- `bash scripts/ops/check_runtime_baseline.sh`: PASS, baseline ready
