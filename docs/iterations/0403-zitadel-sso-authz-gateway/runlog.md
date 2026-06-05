---
title: "Iteration 0403 Run Log"
doc_type: iteration-runlog
status: active
updated: 2026-06-03
source: ai
iteration_id: 0403-zitadel-sso-authz-gateway
id: 0403-zitadel-sso-authz-gateway
phase: phase3
---

# Iteration 0403 Run Log

Template status: current.

规则：只记事实（FACTS）。不要写计划、不要写愿景。每个 Step 只有 PASS 才算完成。

## Environment
- OS: macOS local workspace
- Node/Python versions: pending Phase 3 execution
- Key env flags: not read in Phase 1
- Notes:
  - Current workspace already has unrelated 0402-era dirty changes. 0403 implementation must isolate its branch/worktree before code changes.
  - 2026-06-03: created isolated worktree `/Users/drop/codebase/cowork/dongyuapp_elysia_based__0403` on branch `dropx/dev_0403-zitadel-sso-authz-gateway` for 0403 implementation.
  - Phase 1 public checks on 2026-06-02:
    - `https://sso.dongyudigital.com/.well-known/openid-configuration` returned issuer `https://sso.dongyudigital.com`, authorize `/oauth/v2/authorize`, token `/oauth/v2/token`, userinfo `/oidc/v1/userinfo`, logout `/oidc/v1/end_session`.
    - `https://matrix.dongyudigital.com/_matrix/client/v3/login` returned `m.login.password`, `m.login.sso`, and `m.login.token`.
  - Official docs consulted:
    - ZITADEL OIDC Authorization Code + PKCE.
    - ZITADEL user creation.
    - ZITADEL API access and roles retrieval.
    - ZITADEL RP-initiated logout.
    - Matrix Client-Server API login and SSO/token flow: https://spec.matrix.org/latest/client-server-api/
    - Matrix SSO client login older guide, supplemental: https://matrix.org/docs/older/client-sso-guide/

### Review Gate Records (FACTS)
```text
Review Gate Record
- Iteration ID:
- Review Date:
- Review Type: User / AI-assisted / sub-agent
- Reviewer:
- Review Index: 1/2/3...
- Decision: Approved / Change Requested / On Hold
- Notes:
```

```text
Review Gate Record
- Iteration ID: 0403-zitadel-sso-authz-gateway
- Review Date: 2026-06-02T11:57:59+08:00
- Review Type: sub-agent
- Reviewer: Kuhn (019e8676-3e1e-7243-a971-175cc4ec7bcc)
- Review Index: 1
- Decision: Change Requested
- Notes: Required Matrix SSO callback pending-state, replay rejection, current Matrix spec as primary reference, and missing/forged/no-capability failure tests.
```

```text
Review Gate Record
- Iteration ID: 0403-zitadel-sso-authz-gateway
- Review Date: 2026-06-02T11:59:29+08:00
- Review Type: sub-agent
- Reviewer: Kuhn (019e8676-3e1e-7243-a971-175cc4ec7bcc)
- Review Index: 2
- Decision: Approved
- Notes: No findings after Matrix current spec, one-time pending state, replay rejection, and callback failure tests were added.
```

```text
Review Gate Record
- Iteration ID: 0403-zitadel-sso-authz-gateway
- Review Date: 2026-06-02T22:18:34+08:00
- Review Type: sub-agent
- Reviewer: Kuhn (019e8676-3e1e-7243-a971-175cc4ec7bcc)
- Review Index: Step 1 failure review
- Decision: Approved
- Notes: Approved the Step 1 FAIL/blocker record; no password or secret leaked; next step requires refreshed ZITADEL Console or another explicit authorized management path.
```

```text
Review Gate Record
- Iteration ID: 0403-zitadel-sso-authz-gateway
- Review Date: 2026-06-03T17:04:15+08:00
- Review Type: sub-agent
- Reviewer: Linnaeus (019e8c85-7f40-7a42-9593-f9694fe3f123)
- Review Index: Step 1 account strategy change
- Decision: Approved
- Notes: Approved reusing existing ZITADEL account drop.yang@dongyudigital.com as SSO validation subject; no required changes before Step 2.
```

```text
Review Gate Record
- Iteration ID: 0403-zitadel-sso-authz-gateway
- Review Date: 2026-06-03T17:17:02+08:00
- Review Type: sub-agent
- Reviewer: Linnaeus (019e8c85-7f40-7a42-9593-f9694fe3f123)
- Review Index: Step 2 implementation review 1
- Decision: Change Requested
- Notes: Required OIDC correlation cookie binding, stricter Dongyu-scoped role-to-capability mapping, and userinfo subject/safe-claim validation before Step 3.
```

```text
Review Gate Record
- Iteration ID: 0403-zitadel-sso-authz-gateway
- Review Date: 2026-06-03T17:19:09+08:00
- Review Type: sub-agent
- Reviewer: Linnaeus (019e8c85-7f40-7a42-9593-f9694fe3f123)
- Review Index: Step 2 implementation review 2
- Decision: Approved
- Notes: Approved Step 2 after correlation cookie, Dongyu-scoped role mapping, userinfo subject validation, token-failure tests, and no-token-leak checks were added.
```

```text
Review Gate Record
- Iteration ID: 0403-zitadel-sso-authz-gateway
- Review Date: 2026-06-03T17:28:00+08:00
- Review Type: sub-agent
- Reviewer: Linnaeus (019e8c85-7f40-7a42-9593-f9694fe3f123)
- Review Index: Step 3 implementation review 1
- Decision: Change Requested
- Notes: Required stronger low-permission snapshot filtering for Matrix/Userline/debug/system/management models, capability-aware filtering for authenticated viewer snapshots, and a capability gate for DELETE /auth/homeservers.
```

```text
Review Gate Record
- Iteration ID: 0403-zitadel-sso-authz-gateway
- Review Date: 2026-06-03T17:35:00+08:00
- Review Type: sub-agent
- Reviewer: Linnaeus (019e8c85-7f40-7a42-9593-f9694fe3f123)
- Review Index: Step 3 implementation review 2
- Decision: Change Requested
- Notes: Required filtering residual restricted model-id references from Model 0 routes/catalog JSON and rechecking SSE stream permissions after logout/session changes.
```

```text
Review Gate Record
- Iteration ID: 0403-zitadel-sso-authz-gateway
- Review Date: 2026-06-03T17:42:54+08:00
- Review Type: sub-agent
- Reviewer: Linnaeus (019e8c85-7f40-7a42-9593-f9694fe3f123)
- Review Index: Step 3 implementation review 3
- Decision: Approved
- Notes: Approved Step 3 after restricted model-id reference filtering, SSE recheck-on-broadcast behavior, guest/viewer snapshot tests, and homeserver delete capability gate.
```

```text
Review Gate Record
- Iteration ID: 0403-zitadel-sso-authz-gateway
- Review Date: 2026-06-03T17:59:00+08:00
- Review Type: sub-agent
- Reviewer: Linnaeus (019e8c85-7f40-7a42-9593-f9694fe3f123)
- Review Index: Step 4 implementation review 1
- Decision: Change Requested
- Notes: Required filtering API endpoints out of SSO returnTo and immediately refreshing guest snapshot after logout.
```

```text
Review Gate Record
- Iteration ID: 0403-zitadel-sso-authz-gateway
- Review Date: 2026-06-03T18:05:42+08:00
- Review Type: sub-agent
- Reviewer: Linnaeus (019e8c85-7f40-7a42-9593-f9694fe3f123)
- Review Index: Step 4 implementation review 2
- Decision: Approved
- Notes: Approved Step 4 after returnTo filtering, logout guest snapshot refresh, auth UX contracts, build, and browser checks.
```

```text
Review Gate Record
- Iteration ID: 0403-zitadel-sso-authz-gateway
- Review Date: 2026-06-05T12:18:00+08:00
- Review Type: sub-agent
- Reviewer: Ohm (019e95fe-50ae-70f2-ad54-80853b9ee358)
- Review Index: Local OIDC state false callback plan review
- Decision: Change Requested
- Notes: Required cookie-less OIDC callback fallback to be limited to loopback/local dev, require explicit state secret for non-loopback, and cover replay/tamper/expiry paths.
```

```text
Review Gate Record
- Iteration ID: 0403-zitadel-sso-authz-gateway
- Review Date: 2026-06-05T12:25:00+08:00
- Review Type: sub-agent
- Reviewer: Ohm (019e95fe-50ae-70f2-ad54-80853b9ee358)
- Review Index: Local OIDC state false callback implementation review
- Decision: Approved
- Notes: Approved OIDC state implementation after loopback-only fallback, non-loopback cookie binding, explicit secret requirement, and focused OIDC tests passed.
```

---

## Step 1 — ZITADEL provisioning and account
- Start time: 2026-06-02T22:05:00+08:00
- End time: 2026-06-02T22:16:45+08:00
- Branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Commits:
  - pending
- Commands executed:
  - `curl -fsS https://sso.dongyudigital.com/.well-known/openid-configuration | jq '{issuer, authorization_endpoint, token_endpoint, userinfo_endpoint, end_session_endpoint}'`
  - `curl -fsS https://matrix.dongyudigital.com/_matrix/client/v3/login | jq '.flows'`
  - `curl -sS -o /tmp/zitadel_api_probe.txt -w '%{http_code}\n' https://sso.dongyudigital.com/v2/users/new`
  - Chrome Console via Codex Chrome Extension: listed existing logged-in ZITADEL Console tabs and attempted to open/navigate user-management pages.
- Key outputs (snippets):
  - ZITADEL public OIDC metadata returned issuer `https://sso.dongyudigital.com` and expected authorize/token/userinfo/logout endpoints.
  - Matrix public login flows included `m.login.password`, `m.login.sso`, and `m.login.token`.
  - Unauthenticated direct API probe returned `401`, so account creation cannot be done outside the logged-in browser/session context.
  - Chrome showed existing logged-in ZITADEL Console tabs, but Console page navigation/screenshot/evaluate calls repeatedly timed out after entering `/ui/console/users` or opening new same-origin Console tabs.
  - Requested account fields received: email `nwpuyyc@163.com`, username `drop`, display name `drop`, high privilege target. Password value was intentionally not recorded.
- Result: FAIL
- If FAIL:
  - Cause: Browser automation could not reach a stable ZITADEL Console user-management form, and direct API access without a browser/session token is unauthorized.
  - Fix commits:
    - pending
  - Re-run commands:
    - pending after user refreshes/reopens ZITADEL Console or provides another approved admin access path.
  - Final result: pending

### Step 1 retry after Console reopen
- Start time: `2026-06-02T22:28:00+08:00`
- End time: `2026-06-02T22:41:25+08:00`
- Branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Commands / actions executed:
  - Chrome Extension re-check: ZITADEL tab could be claimed and URL/title could be read, but ZITADEL visible DOM and screenshot still timed out; blank-tab screenshot succeeded.
  - Computer Use fallback: inspected the reopened ZITADEL Console page through the visible browser UI.
  - Console route checks: attempted `/ui/console/users` and `/ui/console/org`.
  - Account selector check: observed an existing login identity with username/login name `drop`.
  - Local config scan: checked for ZITADEL management credential keys; none were found. Secret values were not printed.
- Key outputs (snippets):
  - Active Console identity was `Kevin Yang` / `dropofsino@gmail.com`, limited to self profile view.
  - `/ui/console/users` and `/ui/console/org` redirected back to `/ui/console/users/me?id=general`.
  - Console bundle indicates `/users` requires user-management permission and `/org` requires org-management permission.
  - Existing `drop` identity password login with the user-requested final password failed once; no further retry was attempted.
  - 1Password save/update prompt was closed; no password-manager saved credential was used.
- Result: FAIL / blocker
- If FAIL:
  - Cause: current Console identity does not expose user/org management capability; requested username `drop` already appears to exist but is not usable with the requested final password; no authorized ZITADEL management API credential path is present in the project config.
  - Sub-agent review:
    - Agent: Kuhn (`019e8676-3e1e-7243-a971-175cc4ec7bcc`)
    - Decision: Approved
    - Notes: agreed this Step 1 state is a blocker; do not continue with browser token/cookie extraction, 1Password saved passwords, guessed API credentials, or further password retries. Next path must be a user/org management Console session or an explicit authorized management API path.
  - Re-run commands:
    - pending after user provides a Console session with user/org management permissions or a secure authorized ZITADEL management API path.
  - Final result: pending

### Step 1 retry with alternate account
- Start time: `2026-06-03T16:04:00+08:00`
- End time: `2026-06-03T16:07:41+08:00`
- Branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Commands / actions executed:
  - Chrome Extension re-check: current Chrome ZITADEL login page was visible in open tab metadata, but form fill/click/screenshot/CUA input did not complete reliably.
  - Independent browser: opened `https://sso.dongyudigital.com/ui/console/` and completed login-name/password steps using the user-provided alternate account. Password value was intentionally not recorded.
  - Closed the independent browser once it reached second-factor verification.
- Key outputs (snippets):
  - Login name resolved to existing ZITADEL user `drop` / `yuanchen yang`.
  - Password verification passed and advanced to `验证双因素` / U2F device verification.
  - Second-factor verification could not be completed by automation; it requires the user's local security key / passkey action.
  - No target account was created and no role assignment was changed.
- Result: FAIL / pending user action
- If FAIL:
  - Cause: alternate account credentials pass first-factor authentication but ZITADEL requires U2F / passkey second-factor verification. This must be completed by the user in a usable browser session before management permissions can be checked.
  - Sub-agent review:
    - Agent: Linnaeus (`019e8c85-7f40-7a42-9593-f9694fe3f123`)
    - Decision: Approved
    - Notes: agreed not to bypass 2FA, not to inspect cookies/localStorage, and not to use password-manager saved credentials. Next path is user-completed 2FA in Chrome, or an explicit authorized Management API / service account path with secrets passed outside chat/logs.
  - Re-run commands:
    - pending after user completes 2FA and leaves ZITADEL Console open on a management-capable session.
  - Final result: pending

### Step 1 retry after user-completed 2FA
- Start time: `2026-06-03T16:23:33+08:00`
- End time: `2026-06-03T16:29:08+08:00`
- Branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Commands / actions executed:
  - Chrome Extension open-tab check after user reported successful login.
  - Attempted to read the logged-in Console profile page and navigate to `/ui/console/users`.
  - Attempted to inspect Users page body text, screenshot, console logs, and minimal page evaluation.
  - Downloaded public Console runtime/users module assets to identify Users routes without accessing browser session storage.
- Key outputs (snippets):
  - Chrome tab metadata showed ZITADEL Console open.
  - Navigating to `/ui/console/users` timed out, but the tab URL remained `https://sso.dongyudigital.com/ui/console/users`.
  - Unlike the previous low-permission session, it did not immediately redirect back to `/users/me`; this suggests the current session may have a user-management entry, but UI content could not be verified.
  - Console page automation timed out for body text, screenshot, dev logs, and evaluate; direct Chrome new-tab navigation also failed.
  - Public Console route analysis showed the Users module routes include `create`, `create-machine`, `me`, `me/password`, `:id`, and `:id/password`.
- Result: FAIL / pending user action
- If FAIL:
  - Cause: management-capable session may now be present, but Chrome Extension control over the ZITADEL Console page is not stable enough to read or operate the Users UI.
  - Sub-agent review:
    - Agent: Linnaeus (`019e8c85-7f40-7a42-9593-f9694fe3f123`)
    - Decision: Approved
    - Notes: agreed not to inspect cookies/localStorage/session storage and not to use AppleScript or shell to control Chrome. Safe next paths are user manually opening `https://sso.dongyudigital.com/ui/console/users/create`, user manually completing the account creation if automation remains unavailable, or a secure Management API / service account path.
  - Re-run commands:
    - pending after user opens the Create User form in Chrome or provides a secure authorized Management API path.
  - Final result: pending

### Step 1 API route probe after user asked to avoid browser create page
- Start time: `2026-06-03T16:35:00+08:00`
- End time: `2026-06-03T16:47:00+08:00`
- Branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Commands / actions executed:
  - Consulted current official ZITADEL docs for User API v2, API access, OIDC Authorization Code + PKCE, current-user permissions, and administrator role API.
  - Read public Console config at `https://sso.dongyudigital.com/ui/console/assets/environment.json`.
  - Probed unauthenticated `POST https://sso.dongyudigital.com/v2/users/human`.
  - Checked local `.env` variable names for ZITADEL service account / PAT style credentials without printing values.
  - Sub-agent review for the API route.
  - Tried standard OIDC Authorization Code + PKCE using the public Console client and user browser session without reading cookies/localStorage/session storage.
  - Tried OAuth Device Flow using the public Console client without printing device code or token values to runlog.
- Key outputs (snippets):
  - Official docs confirm User API v2 can create users and requires `user.write`; API access requires a bearer token with the ZITADEL audience scope for ZITADEL APIs.
  - Console public config returned issuer/API `https://sso.dongyudigital.com` and client id present in public Console config.
  - Direct unauthenticated user-create API returned `401` / `auth header missing`.
  - Local `.env` did not contain ZITADEL service account, PAT, OIDC client secret, or management-token variable names.
  - Console public client uses fixed login scope `openid profile email`; it does not include the ZITADEL API audience scope in the Console bundle.
  - Authorization Code + PKCE probe did not reach a usable callback through Chrome automation.
  - Device Flow endpoint exists, but the public Console client returned `unauthorized_client` for device-token polling.
  - Sub-agent review:
    - Agent: Linnaeus (`019e8c85-7f40-7a42-9593-f9694fe3f123`)
    - Decision: Approved
    - Notes: approved read-only API permission probing with strict token handling; required action-time confirmation before any account creation, password, administrator, or role-assignment write operation.
- Result: FAIL / blocker
- If FAIL:
  - Cause: no service account/PAT credential is available locally; public Console OIDC client is not a reliable management API automation entry; browser-page token extraction remains disallowed.
  - Re-run commands:
    - pending after a secure service account/PAT is provided, or after a management-capable Console/API path is explicitly prepared.
  - Final result: pending

### Step 1 requirement change: reuse existing ZITADEL account
- Start time: `2026-06-03T16:59:28+08:00`
- End time: `2026-06-03T16:59:28+08:00`
- Branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Commands / actions executed:
  - User directed the implementation to use existing ZITADEL account `drop.yang@dongyudigital.com`.
  - Updated 0403 plan/resolution in isolated 0403 worktree.
- Key outputs (snippets):
  - The previously requested new account `nwpuyyc@163.com` is no longer a Step 1 blocker unless the user reopens account creation.
  - The existing account will be used as the real SSO validation subject.
  - No ZITADEL account creation, password update, or role assignment was executed in this record.
- Result: PASS

---

## Step 2 — OIDC session gateway
- Start time: `2026-06-03T17:04:15+08:00`
- End time: `2026-06-03T17:10:52+08:00`
- Branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Commits:
  - pending
- Commands executed:
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs` (RED: failed before implementation because auth server did not yet expose OIDC SSO test-mode/start/callback behavior)
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node scripts/tests/test_0312_slide_upload_auth_contract.mjs`
  - `node scripts/tests/test_0283_matrix_userline_login_contract.mjs`
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs` (RED after review: failed on missing correlation cookie and over-broad unrelated admin capability)
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node scripts/tests/test_0312_slide_upload_auth_contract.mjs`
  - `node scripts/tests/test_0283_matrix_userline_login_contract.mjs`
  - `node --check packages/ui-model-demo-server/auth.mjs && node --check packages/ui-model-demo-server/server.mjs`
- Key outputs (snippets):
  - `test_0403_oidc_session_gateway`: `4 passed, 0 failed out of 4`
  - `test_0312_slide_upload_auth_contract`: `2 passed, 0 failed out of 2`
  - `test_0283_matrix_userline_login_contract`: `2 passed, 0 failed out of 2`
  - New OIDC behavior covers PKCE start redirect, invalid state rejection, valid callback session creation, `/auth/me` ZITADEL principal shape, role extraction, and capability mapping.
  - Review fix coverage includes missing correlation cookie rejection, replay rejection, bad nonce/audience/expired/signature rejection, userinfo subject mismatch rejection, and unrelated `billing.admin` not receiving Dongyu write/Matrix/management capability.
  - `startServer({ port: 0, dbPath: null, skipFrontendBuild: true })` now supports focused auth tests without requiring SQLite or frontend build.
- Result: PASS

---

## Step 3 — Principal-aware authorization
- Start time: `2026-06-03T17:19:09+08:00`
- End time: `2026-06-03T17:42:54+08:00`
- Branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Commits:
  - pending
- Commands executed:
  - `node scripts/tests/test_0403_principal_authorization.mjs` (RED: failed before implementation because guest `/snapshot` returned 401 and viewer could POST `/bus_event`)
  - `node scripts/tests/test_0403_principal_authorization.mjs`
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node scripts/tests/test_0312_slide_upload_auth_contract.mjs`
  - `node scripts/tests/test_0283_matrix_userline_login_contract.mjs`
  - `node --check packages/ui-model-demo-server/auth.mjs && node --check packages/ui-model-demo-server/server.mjs`
  - `node scripts/tests/test_0403_principal_authorization.mjs` (RED after review 1: failed because guest/viewer snapshots still exposed Matrix Userline model 1016)
  - `node scripts/tests/test_0403_principal_authorization.mjs`
  - `node scripts/tests/test_0403_principal_authorization.mjs` (RED after review 2: failed because serialized snapshot still contained restricted model-id references and old SSE stream kept admin view after logout)
  - `node scripts/tests/test_0403_principal_authorization.mjs`
  - direct guest `/snapshot` restricted-id/keyword scan
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node scripts/tests/test_0312_slide_upload_auth_contract.mjs`
  - `node scripts/tests/test_0283_matrix_userline_login_contract.mjs`
  - `node --check packages/ui-model-demo-server/server.mjs`
- Key outputs (snippets):
  - `test_0403_principal_authorization`: `4 passed, 0 failed out of 4`
  - direct restricted snapshot scan: `PASS restricted snapshot scan`
  - `test_0403_oidc_session_gateway`: `4 passed, 0 failed out of 4`
  - `test_0312_slide_upload_auth_contract`: `2 passed, 0 failed out of 2`
  - `test_0283_matrix_userline_login_contract`: `2 passed, 0 failed out of 2`
  - Guest `/snapshot` returns filtered public snapshot and hides Matrix Suite, Matrix Chat, Matrix Userline, Matrix Debug, system function model, management bus console, and restricted model-id references.
  - Guest write attempts return `401 login_required` with `returnTo`.
  - Authenticated `dongyu.viewer` receives filtered snapshot and `403 permission_denied` for app write, runtime mode, Matrix media actions, and homeserver delete.
  - Authenticated `dongyu.admin` passes the app write gate.
  - Existing SSE streams re-resolve session permission on broadcast; after logout, the old stream receives guest-filtered snapshots.
- Result: PASS

---

## Step 4 — Frontend auth UX
- Start time: `2026-06-03T17:42:54+08:00`
- End time: `2026-06-03T18:05:42+08:00`
- Branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Commits:
  - pending
- Commands executed:
  - `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs` (RED: failed before implementation because remote auth store, SSO UI controls, and auth failure UX were missing)
  - `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `node --check packages/ui-model-demo-frontend/src/main.js && node --check packages/ui-model-demo-frontend/src/auth_store.js && node --check packages/ui-model-demo-frontend/src/remote_store.js && node --check packages/ui-model-demo-frontend/src/demo_app.js`
  - Browser check at `http://127.0.0.1:9017/#/` with `DY_AUTH=1`
  - `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs` (RED after review 1: failed because API returnTo filtering and logout guest snapshot refresh were not yet implemented)
  - `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `node scripts/tests/test_0403_principal_authorization.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - Browser re-check at `http://127.0.0.1:9017/#/`
- Key outputs (snippets):
  - `test_0403_frontend_auth_ux_contract`: `4 passed, 0 failed out of 4`
  - Frontend `validate_editor`: PASS
  - Frontend build: PASS with only the existing Vite chunk-size warning.
  - `test_0403_principal_authorization`: `4 passed, 0 failed out of 4`
  - Remote mode now creates `authStore`, checks `/auth/me`, passes auth state into `remoteStore` and `AppShell`.
  - Guest header shows `访客只读` and `登录`; logged-in header has an account dropdown with identity, roles, capabilities, Matrix status, and logout.
  - Permission failures from write/media/runtime endpoints are converted into `需要登录` or `权限不足` UI state.
  - API endpoints are rejected as SSO return targets; returnTo falls back to the current page route.
  - Logout immediately refreshes the frontend snapshot to the guest-filtered server view.
  - Browser desktop/mobile checks showed the guest header and app content render without overlap and without automatic permission panel.
  - Login button redirected to ZITADEL authorize; dummy local client returned expected `Errors.App.NotFound`.
- Result: PASS

---

## Step 5 — Matrix SSO capability bridge
- Start time: 2026-06-03 18:04 CST
- End time: 2026-06-03 18:17 CST
- Branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Commits:
  - pending
- Commands executed:
  - `node scripts/tests/test_0403_matrix_sso_bridge.mjs` (RED before implementation: endpoints missing / callback still guarded)
  - `node --check packages/ui-model-demo-server/auth.mjs`
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `node scripts/tests/test_0403_matrix_sso_bridge.mjs`
  - `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs` (RED before UI connect controls, then PASS)
  - `node --check packages/ui-model-demo-frontend/src/auth_store.js`
  - `node --check packages/ui-model-demo-frontend/src/demo_app.js`
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node scripts/tests/test_0403_principal_authorization.mjs`
  - `curl -fsS https://matrix.dongyudigital.com/_matrix/client/v3/login | jq -r '.flows[].type'`
- Key outputs (snippets):
  - Added Matrix SSO start/callback/status/disconnect endpoints.
  - Matrix SSO start requires `matrix:connect`, checks homeserver login flows, then redirects to Matrix `/login/sso/redirect`.
  - Callback consumes a one-time pending state, exchanges `loginToken` with `m.login.token`, stores Matrix identity/token server-side in the Dongyu session, and redirects back to the original page.
  - Unknown, replayed, expired, and deleted-session states are rejected before any Matrix token is stored.
  - `/auth/me` and `/auth/matrix/status` expose `matrixConnected`, `homeserverUrl`, and `matrixUserId`, but never expose the Matrix access token.
  - Frontend account dropdown now exposes Matrix connect/disconnect controls for users with Matrix capability.
  - `test_0403_matrix_sso_bridge`: `6 passed, 0 failed out of 6`
  - `test_0403_frontend_auth_ux_contract`: `4 passed, 0 failed out of 4`
  - OIDC and principal authorization regressions remained PASS.
  - Remote Matrix login flows: `m.login.password`, `m.login.sso`, `m.login.token`.
- Review 1:
  - Reviewer: Linnaeus
  - Decision: CHANGE_REQUESTED
  - Required fixes:
    - Clear per-request Matrix session so Matrix Chat cannot reuse another session's token.
    - Let management bus channel discovery use the current session Matrix identity.
    - Restrict Matrix SSO `homeserverUrl` to configured/allowlisted origins instead of arbitrary query URLs.
- Review 1 fixes completed: 2026-06-03 18:26 CST
  - Added review regression coverage for unapproved homeserver rejection, cross-session Matrix token non-reuse, and management bus explicit session identity.
  - Matrix SSO homeserver start now allows only configured/allowlisted origins.
  - `submitEnvelope(..., { matrixSession })` now overwrites or clears the ProgramEngine Matrix session on every authenticated write request.
  - Management bus refresh now accepts an explicit Matrix session and ProgramEngine passes the current request session to the refresh hook.
  - Updated the 0393 management bus joined-room test to assert required fields while allowing the current richer room projection.
  - Verification after fixes:
    - `test_0403_matrix_sso_bridge`: `9 passed, 0 failed out of 9`
    - `test_0393_mgmt_bus_console_drop_channels`: PASS all 6 results
    - `test_0401_matrix_chat_membership_contract`: PASS all listed cases
    - `test_0403_oidc_session_gateway`: `4 passed, 0 failed`
    - `test_0403_principal_authorization`: `4 passed, 0 failed`
    - `test_0403_frontend_auth_ux_contract`: `4 passed, 0 failed`
    - `npm -C packages/ui-model-demo-frontend run test`: PASS
    - `npm -C packages/ui-model-demo-frontend run build`: PASS with existing chunk-size warning
- Review 2:
  - Reviewer: Linnaeus
  - Decision: CHANGE_REQUESTED
  - Required fixes:
    - Concurrent `/bus_event` requests must not overwrite the Matrix session used by another Matrix Chat/management bus action.
    - With `DY_AUTH` enabled, management bus startup/user-visible projection must not use runtime/env Matrix token without an explicit Dongyu session Matrix identity.
- Review 2 fixes completed: 2026-06-03 18:33 CST
  - Added review regression coverage for concurrent Matrix Chat actions keeping each request's Matrix token and for AUTH-enabled management bus refresh refusing runtime token fallback without explicit session.
  - Serialized `submitEnvelope` Matrix session critical section and tracked pending Matrix host actions so session cleanup happens after Matrix Chat/Suite/management bus async actions finish.
  - Management bus runtime/env fallback is now disabled when auth is enabled; explicit session refresh remains available and the no-auth path keeps runtime fallback.
  - Updated 0393 management bus refresh test to pass an explicit Matrix session under auth-enabled behavior.
  - Verification after fixes:
    - `test_0403_matrix_sso_bridge`: `11 passed, 0 failed out of 11`
    - `test_0393_mgmt_bus_console_drop_channels`: PASS all 6 results
    - `test_0401_matrix_chat_membership_contract`: PASS all listed cases
    - `test_0403_oidc_session_gateway`: `4 passed, 0 failed`
    - `test_0403_principal_authorization`: `4 passed, 0 failed`
    - `test_0403_frontend_auth_ux_contract`: `4 passed, 0 failed`
    - `npm -C packages/ui-model-demo-frontend run test`: PASS
    - `npm -C packages/ui-model-demo-frontend run build`: PASS with existing chunk-size warning
- Review 3:
  - Reviewer: Linnaeus
  - Decision: APPROVED
  - Findings: none
  - Verification gaps: none
- Result: PASS

---

## Step 6 — End-to-end verification and docs
- Start time: 2026-06-03 18:34 CST
- End time: 2026-06-03 18:42 CST
- Branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Commits:
  - pending
- Commands executed:
  - `rg -n "DY_OIDC|OIDC_CLIENT|ZITADEL|sso\\.dongyudigital|client_id|clientId" . -S`
  - `curl -fsS https://sso.dongyudigital.com/.well-known/openid-configuration | jq -r '.issuer, .authorization_endpoint, .token_endpoint, .jwks_uri'`
  - `curl -fsS https://matrix.dongyudigital.com/_matrix/client/v3/login | jq -r '.flows[].type'`
  - `node --check packages/ui-model-demo-server/auth.mjs`
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `node --check packages/ui-model-demo-frontend/src/auth_store.js`
  - `node --check packages/ui-model-demo-frontend/src/demo_app.js`
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node scripts/tests/test_0403_principal_authorization.mjs`
  - `node scripts/tests/test_0403_matrix_sso_bridge.mjs`
  - `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`
  - `node scripts/tests/test_0393_mgmt_bus_console_drop_channels.mjs`
  - `node scripts/tests/test_0401_matrix_chat_membership_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - Local server smoke: `PORT=9018 DY_AUTH=1 DY_OIDC_ISSUER=https://sso.dongyudigital.com DY_OIDC_CLIENT_ID=dummy-dongyu-client MATRIX_HOMESERVER_URL=https://matrix.dongyudigital.com bun packages/ui-model-demo-server/server.mjs`
  - Playwright CLI smoke against `http://127.0.0.1:9018/#/`
- Key outputs (snippets):
  - No real Dongyu App OIDC client id/secret was found in repo config; local real ZITADEL callback cannot be completed with `dummy-dongyu-client`.
  - ZITADEL public metadata is reachable and reports issuer `https://sso.dongyudigital.com` and authorize/token/JWKS endpoints.
  - Matrix public login flows still include `m.login.sso` and `m.login.token`.
  - `test_0403_oidc_session_gateway`: `4 passed, 0 failed`
  - `test_0403_principal_authorization`: `4 passed, 0 failed` including guest public page catalog preservation.
  - `test_0403_matrix_sso_bridge`: `11 passed, 0 failed`
  - `test_0403_frontend_auth_ux_contract`: `4 passed, 0 failed`
  - `test_0393_mgmt_bus_console_drop_channels`: PASS all 6 results
  - `test_0401_matrix_chat_membership_contract`: PASS all listed cases
  - Frontend test/build: PASS; build keeps existing Vite chunk-size warning.
  - Browser desktop smoke: guest header shows `访客只读` and `登录`; public Desktop content renders with built-in/slid-in app cards; no automatic permission panel.
  - Login button redirects to `https://sso.dongyudigital.com/oauth/v2/authorize?...`; dummy client returns expected `Errors.App.NotFound`.
  - Browser mobile smoke at 390x844: guest/login text visible and no horizontal overflow.
  - Final review by Linnaeus: APPROVED, with no code findings and the same external OIDC client configuration boundary noted.
  - Local server was stopped after smoke.
- Result: PASS

## Step 7 — dev-test ZITADEL API provisioning attempt
- Start time: 2026-06-04 19:23 CST
- End time: 2026-06-04 19:34 CST
- Branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Remote scope:
  - Organization: `375910751979700454`
  - Project: `375910753992966374` (`dev-test`)
  - Service account client id: `service-account-dev-app`
- Secret handling:
  - User explicitly authorized using the provided service account credential for API probing.
  - Secret value and access token were not printed in runlog, console summaries, or final reporting.
- Commands executed:
  - `node --check packages/ui-model-demo-server/auth.mjs`
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node --check scripts/ops/zitadel_devtest_probe.mjs`
  - `node scripts/ops/zitadel_devtest_probe.mjs` with secret provided via process env
  - `node --check scripts/ops/zitadel_devtest_configure.mjs`
  - `node scripts/ops/zitadel_devtest_configure.mjs` with secret provided via process env
  - `node --check scripts/ops/zitadel_devtest_permissions_probe.mjs`
  - `node scripts/ops/zitadel_devtest_permissions_probe.mjs` with secret provided via process env
- Key outputs:
  - Token exchange succeeded and returned a short-lived bearer token.
  - `GetProject` succeeded and returned `dev-test`.
  - `ListApplications` succeeded and returned no applications.
  - `ListProjectRoles` succeeded and returned no roles.
  - `UpdateProject` failed with `403 permission_denied`.
  - The configure script stopped immediately after the failed write; no application or role creation was attempted.
  - Follow-up read probe confirmed project still has no applications and no project roles.
  - Permission probe returned 17 permissions including `project.read`, `project.role.read`, `user.read`, and `user.grant.write`.
  - Missing permissions for this provisioning path include `project.write`, `project.app.write`, and `project.role.write`.
- Code/test changes made during this step:
  - `auth.mjs` now accepts ZITADEL project-specific role claims such as `urn:zitadel:iam:org:project:<projectId>:roles`.
  - OIDC gateway test now covers the project-specific role claim form recommended by current ZITADEL docs.
  - Added safe ops probes/config scripts under `scripts/ops/`; these scripts require credentials through process env and avoid printing token or client secret.
- Result: BLOCKED by service account permission scope; no remote write was completed.

---

## Step 8 — MAS upstream identity binding for existing `drop`
- Start time: 2026-06-04 17:20 CST
- End time: 2026-06-04 17:45 CST
- Branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Remote scope:
  - SSH host: `dy-cloud-drop`
  - Kubernetes namespace: `ess`
  - Helm release: `matrix`
  - MAS pod: `matrix-matrix-authentication-service-85cc858d5b-ml9s2`
  - MAS DB pod: `matrix-postgres-synapse-mas-1`
- Secret handling:
  - No password, token, client secret, DB URI, or full MAS config was written to this runlog.
  - One accidental terminal probe displayed part of a Kubernetes secret value in tool output; it was not copied into docs or user-facing reporting, and subsequent probes only emitted keys or redacted summaries.
- Review checkpoints:
  - Remote read-only SSH/kubectl probe plan reviewed by Kuhn.
  - Privileged docker/nsenter read proposal rejected unless separately approved; not used.
  - Single-row MAS DB association update reviewed and approved by Kuhn.
- Commands executed:
  - `ssh dy-cloud` / `ssh dy-cloud-drop` read-only host, process, DNS, Kubernetes, Helm, pod, service, ConfigMap, and Secret-key probes.
  - `kubectl exec ... mas-cli manage --help`
  - `kubectl exec ... psql -U postgres -d mas` with read-only SQL checks.
  - `kubectl exec ... psql -U postgres -d mas` with a guarded single-row `UPDATE`.
  - Browser verification against `http://127.0.0.1:9018/#/` using the real local OIDC client id.
- Key outputs:
  - Active Matrix/MAS deployment is `matrix` in namespace `ess`; older `matrix` namespace Postgres pods are crash-looping and were not used.
  - MAS policy config has `admin_clients: []` and `admin_users: []`, so the public MAS Admin API has no configured admin client path available for this operation.
  - MAS CLI `register-user` supports upstream provider mappings, but source review confirmed it creates a new user first; it is not safe for binding an existing `drop` user.
  - MAS upstream provider for `https://sso.dongyudigital.com` exists and is enabled.
  - MAS user `drop` exists exactly once and is not locked.
  - The ZITADEL subject `360226023557562598` already had an `upstream_oauth_links` row, but its `user_id` was `NULL`.
  - Guarded update associated that existing link with MAS user `drop`; SQL returned `UPDATE 1`.
  - Post-update DB verification returned the link joined to username `drop`.
  - Browser verification reached ZITADEL login and password success, then stopped at required U2F / Passkey verification. User action is required to complete the browser SSO loop.
- Result: PASS for remote MAS binding and DB verification; browser end-to-end verification is blocked only by interactive U2F / Passkey completion.

---

## Step 9 — Local OIDC callback state recovery fix
- Start time: 2026-06-05 12:10 CST
- End time: 2026-06-05 12:29 CST
- Branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Trigger:
  - Real browser login with `drop.yang@dongyudigital.com` returned `{"ok":false,"error":"invalid_oidc_state"}` at `http://127.0.0.1:9018/auth/sso/callback`.
  - The callback URL contained `code` and `state`, so ZITADEL had completed credential verification; failure was local callback state validation.
- Secret handling:
  - No callback `code`, access token, id token, Matrix token, password, or secret was written to this runlog.
- Code/test changes made during this step:
  - `auth.mjs` now seals OIDC pending state into the authorization URL `state` while keeping the `dy_oidc_state` cookie.
  - Callback accepts a missing/mismatched OIDC state cookie only when both request host and redirect URI host are loopback.
  - Non-loopback callbacks still require cookie binding, and non-loopback OIDC start requires an explicit state/session/auth/cookie secret.
  - OIDC state tests now cover loopback no-cookie success, replay rejection, tampered state rejection, expired state rejection, non-loopback no-cookie rejection, existing cookie/restart behavior, and non-loopback secret requirement.
- Commands executed:
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node --check packages/ui-model-demo-server/auth.mjs scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node scripts/tests/test_0403_matrix_sso_bridge.mjs`
  - `node scripts/tests/test_0403_principal_authorization.mjs`
  - `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`
  - `node scripts/tests/test_0403_remote_store_bus_event_v2_snapshot_fallback.mjs`
  - `node scripts/tests/test_0402_matrix_chat_action_visibility_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - Restarted local server on port `9018` with real local OIDC client id `375920990745592038`.
  - `curl -sS -D - -o /tmp/dongyu-sso-start-body.txt 'http://127.0.0.1:9018/auth/sso/start?returnTo=%2F%23%2F' | sed -n '1,20p'`
  - Local live callback probe using a fresh `/auth/sso/start` state, no OIDC state cookie, and an intentionally invalid authorization code.
- Key outputs:
  - Focused OIDC test: `9 passed, 0 failed`.
  - Matrix SSO bridge: `11 passed, 0 failed`.
  - Principal authorization: `5 passed, 0 failed`.
  - Frontend auth UX contract: `6 passed, 0 failed`.
  - Remote-store fallback: `3 passed, 0 failed`.
  - Matrix Chat visibility contract: PASS for all listed cases.
  - Frontend build: PASS with existing Vite chunk-size warning.
  - Local server now listens on `http://127.0.0.1:9018`.
  - `/auth/sso/start` returns `302`, sets `dy_oidc_state`, and sends a sealed `state` to `https://sso.dongyudigital.com/oauth/v2/authorize`.
  - Local live callback probe returned `401 {"ok":false,"error":"invalid_request"}` instead of `400 invalid_oidc_state`, proving loopback callback state recovery passed and the remaining rejection was the intentionally invalid code.
- Result: PASS for local OIDC callback state recovery; user must start a fresh login from `/auth/sso/start` because old callback URLs are one-time and already invalid.

---

## Step 10 — Local and cloud deploy SSO env wiring
- Start time: 2026-06-05 15:35 CST
- End time: 2026-06-05 21:24 CST
- Branch: `main` working tree before integration commit
- Trigger:
  - Local `30900` deployment initially served the new code but `k8s/local/workers.yaml` still hardcoded `DY_AUTH=0`.
  - Remote `k8s/cloud/workers.yaml` had the same hardcoded setting, so a cloud deploy would not reliably enable ZITADEL SSO.
- Secret handling:
  - No Matrix token, ZITADEL token, OIDC authorization code, client secret, password, or generated state secret was written to this runlog.
  - `deploy/env/local.env` and generated env files remain ignored.
- Code/test changes made during this step:
  - `_deploy_common.sh` now writes `DY_AUTH`, `DY_OIDC_*`, session/auth secret keys, and `MATRIX_HOMESERVER_URL` into `ui-server-secret`.
  - `k8s/local/workers.yaml` and `k8s/cloud/workers.yaml` now read those values from `ui-server-secret`.
  - The manifests explicitly clear previous literal env values with `value: null` so `kubectl apply` can migrate a live deployment from `value` to `valueFrom`.
  - `deploy/env/local.env.example` and `deploy/env/cloud.env.example` document the required OIDC keys; `DY_OIDC_SCOPE` is quoted because it contains spaces.
  - `scripts/tests/test_0403_deploy_sso_env_contract.mjs` guards the deploy secret and manifest contract.
- Review loop:
  - Initial review by Dalton: CHANGE_REQUESTED.
  - Required fixes: avoid hand-written YAML quoting for secrets, avoid persistent secret temp files, avoid public fixed remote state/session secret placeholders, strengthen deploy contract tests.
  - Fixes applied: `_deploy_common.sh` now generates Secret manifests through Python `json.dumps` and pipes them to `kubectl apply -f -`; secret temp YAML files were removed; remote state/session secrets are documented as required env indirections; deploy contract tests now verify secret name, `value: null`, JSON manifest generation, and placeholder policy.
  - Second review by Dalton: CHANGE_REQUESTED.
  - Required fixes: protect `deploy_cloud_app.sh --target ui-server` from applying a manifest that requires missing secret keys, and avoid unconditional `${...:?}` placeholders in `cloud.env.example`.
  - Fixes applied: `deploy_cloud_app.sh` now verifies `ui-server-secret` has all keys required by `k8s/cloud/workers.yaml` before apply; `cloud.env.example` uses empty state/session secret placeholders with an explicit non-loopback `DY_AUTH=1` warning.
  - Third review by Dalton: CHANGE_REQUESTED.
  - Required fixes: avoid a stdin conflict in the secret-key verifier, and run the verifier before any cloud workers manifest apply, not only when target is `ui-server`.
  - Fixes applied: `deploy_cloud_app.sh` now reads the Secret JSON before passing it to Python through an environment variable, and verifies `ui-server-secret` for all targets because the script applies the full cloud workers manifest.
  - Fourth review by Pauli: CHANGE_REQUESTED.
  - Required fixes: avoid persisting plaintext secret values in the `kubectl.kubernetes.io/last-applied-configuration` annotation.
  - Fixes applied: `_deploy_common.sh` now replaces or creates Kubernetes Secrets through `kubectl create secret generic --from-literal ... --dry-run=client -o yaml | kubectl replace -f -` for existing secrets and plain `kubectl create secret generic` for new secrets, avoiding `kubectl apply` and `stringData`.
  - Fifth review by Pauli: APPROVED.
  - Findings: none.
  - Verification gaps: none.
- Commands executed:
  - `node scripts/tests/test_0403_deploy_sso_env_contract.mjs`
  - `node --check scripts/tests/test_0403_deploy_sso_env_contract.mjs`
  - `bash -n scripts/ops/_deploy_common.sh scripts/ops/deploy_local.sh scripts/ops/deploy_cloud_full.sh scripts/ops/deploy_cloud_app.sh`
  - `kubectl apply --dry-run=client -f k8s/local/workers.yaml`
  - `kubectl apply --dry-run=client -f k8s/cloud/workers.yaml`
  - `git diff --check`
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node scripts/tests/test_0403_principal_authorization.mjs`
  - `node scripts/tests/test_0403_matrix_sso_bridge.mjs`
  - `SKIP_IMAGE_BUILD=1 SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - Local verifier script against `http://localhost:30900/auth/sso/start`, `kubectl -n dongyu get secret ... -o json`, and `kubectl -n dongyu get pods -o json`
  - `kubectl -n dongyu delete pod remote-worker-7bb488848d-c9pcq --ignore-not-found=true`
  - `curl -sS -i --max-time 10 'http://localhost:30900/auth/sso/start?returnTo=%2F%23%2F'`
- Key outputs:
  - Deploy SSO env contract: PASS.
  - Shell syntax and local/cloud manifest dry-run checks: PASS.
  - Git whitespace check: PASS.
  - OIDC session gateway: `9 passed, 0 failed`.
  - Principal authorization: `5 passed, 0 failed`.
  - Matrix SSO bridge: `11 passed, 0 failed`.
  - Local deploy script completed successfully without rebuilding images.
  - Local verifier: PASS for `302` redirect, local OIDC client id `375920990745592038`, no secret `last-applied-configuration` annotation, and all local pods Running.
  - Local `ui-server` deployment now reads OIDC/auth env from `ui-server-secret`.
  - `http://localhost:30900/auth/sso/start` returned `302` to `https://sso.dongyudigital.com/oauth/v2/authorize` with client id `375920990745592038`, redirect URI `http://localhost:30900/auth/sso/callback`, and ZITADEL roles scope.
- Result: PASS for repeatable local deploy SSO wiring; ready for integration commit and cloud deploy using remote OIDC client `376055905181040870` with redirect URI `https://app.dongyudigital.com/auth/sso/callback`.
