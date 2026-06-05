---
title: "Iteration 0403 Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-06-03
source: ai
iteration_id: 0403-zitadel-sso-authz-gateway
id: 0403-zitadel-sso-authz-gateway
phase: phase1
---

# Iteration 0403 Resolution

## 0. Execution Rules
- Work branch: `dropx/dev_0403-zitadel-sso-authz-gateway`
- Steps must be executed in order.
- No step skipping; no bundling multiple steps into one commit.
- Each step must have executable validation.
- After each step, spawn a sub-agent review focused on that step's diff, tests, UX, and conformance.
- If sub-agent review returns Change Requested, fix and rerun the same review until Approved before moving on.
- Any real execution evidence must go to `runlog.md`.
- Secrets must never be printed into logs or committed.

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | ZITADEL provisioning and account | Verify OIDC app and existing human account | ZITADEL Console/API only, runlog | Public OIDC metadata check; SSO login proof | Existing account works for SSO; redirect URLs known; no secret in repo | Disable role assignment if changed |
| 2 | OIDC session gateway | ZITADEL login/callback/logout/me and session model | `packages/ui-model-demo-server/auth.mjs`, `server.mjs`, package deps if needed | Unit/mock OIDC test; `/auth/me` guest/login contract checks | Dongyu session created from validated ZITADEL identity | Revert auth files and deps |
| 3 | Principal-aware authorization | Guest read-only filtering and server-side write/capability gates | `server.mjs`, auth helpers, tests | Snapshot/filter tests; unauthorized write tests | Guest reads only public data; writes/Matrix/management denied | Revert guard/filter changes |
| 4 | Frontend auth UX | Remote auth store, account dropdown, login/logout/permission views | `main.js`, `demo_app.js`, auth UI files, optional renderer registry | Frontend tests/build; browser guest/login/logout smoke | Clear polished UI states; return URL preserved | Revert frontend auth UI changes |
| 5 | Matrix SSO capability bridge | Matrix connect flow after Dongyu SSO | `auth.mjs`, `server.mjs`, Matrix helpers, tests | Matrix login flow mock; real Matrix SSO smoke | Matrix token stored only in Dongyu session; Matrix Chat can use user token | Disable Matrix connect endpoints and revert helpers |
| 6 | End-to-end verification and docs | Full local/remote verification, user-guide updates | tests, runlog, user-guide if needed | Build/test/browser/real SSO commands | All criteria PASS; sub-agent final review Approved | Revert docs/test additions or mark On Hold |

## 2. Step Details

### Step 1 — ZITADEL provisioning and account
**Goal**
- Use the existing ZITADEL account `drop.yang@dongyudigital.com` as the SSO verification subject and verify the Dongyu App OIDC configuration needed by implementation.

**Scope**
- Confirm issuer, authorization endpoint, token endpoint, userinfo endpoint, and logout endpoint.
- Configure redirect URIs for local and remote Dongyu App callback.
- Configure post logout redirect URIs.
- Do not create the previously requested `nwpuyyc@163.com` account in this iteration unless the user explicitly reopens that requirement.
- Verify the existing account can complete ZITADEL login and capture only non-sensitive identity/claim facts.
- If role/capability claims are missing, record the exact missing role/capability and stop before any ZITADEL write operation.

**Files**
- Create/Update:
  - `docs/iterations/0403-zitadel-sso-authz-gateway/runlog.md`
- Must NOT touch:
  - Application code.
  - Repo secrets or `.env` values.
  - Remote cluster runtime/network/system service files.

**Validation (Executable)**
- Commands:
  - `curl -fsS https://sso.dongyudigital.com/.well-known/openid-configuration`
  - `curl -fsS https://matrix.dongyudigital.com/_matrix/client/v3/login`
- Browser/Console checks:
  - Confirm Dongyu App OIDC application exists.
  - Confirm the existing account can complete SSO login.
- Expected signals:
  - OIDC metadata includes issuer, authorize, token, userinfo, end_session endpoints.
  - Matrix login flows include `m.login.sso` and `m.login.token`.
  - Existing account identity and claim shape are visible to Dongyu App without exposing secrets.

**Acceptance Criteria**
- ZITADEL app/client information needed by server env is known.
- Existing account can be used as the real SSO test account.
- Sub-agent review Approved.

**Rollback Strategy**
- Disable any role assignment made during this step. If no ZITADEL write operation occurred, no remote rollback is required.

---

### Step 2 — OIDC session gateway
**Goal**
- Replace the app login source with ZITADEL OIDC while preserving a Dongyu-owned `dy_session`.

**Scope**
- Add env-driven OIDC config.
- Add authorization request with state, nonce, PKCE, and return URL.
- Add callback token exchange and ID token validation.
- Fetch userinfo and normalize `{sub, preferred_username, name, email, roles}`.
- Extend session storage with identity, roles, capabilities, id token hint, and optional Matrix token fields.
- Keep legacy Matrix password login unavailable from normal UI unless explicitly enabled for debugging.

**Files**
- Create/Update:
  - `packages/ui-model-demo-server/auth.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `package.json` / lockfile only if a small OIDC/JWT verification library is required.
  - focused tests under `scripts/tests/`
- Must NOT touch:
  - Runtime semantic SSOT unless a real contract change is discovered.
  - Matrix Chat business UI.

**Validation (Executable)**
- Commands:
  - `node scripts/tests/<new_oidc_auth_test>.mjs`
  - `node scripts/tests/<new_auth_me_contract_test>.mjs`
- Expected signals:
  - Bad callback state is rejected.
  - Missing/invalid token is rejected.
  - Valid mock OIDC callback creates session.
  - `/auth/me` returns guest 401 and authenticated principal shape.

**Acceptance Criteria**
- Server can start with OIDC env present.
- `dy_session` is created only after a validated ZITADEL callback.
- Sub-agent review Approved.

**Rollback Strategy**
- Revert auth gateway files and any dependency additions.

---

### Step 3 — Principal-aware authorization
**Goal**
- Enforce visitor read-only and capability gates on the server, independent of frontend behavior.

**Scope**
- Add a principal resolver that returns guest or authenticated principal.
- Add capability mapping from ZITADEL roles to Dongyu capabilities.
- Add filtered snapshot/stream for guests.
- Reject guest writes to `/bus_event`, `/ui_event`, runtime mode changes, media upload, slide export, Workspace install/create/delete, Matrix and management bus actions.
- Return consistent `401 login_required` and `403 permission_denied` payloads with return URL hints.

**Files**
- Create/Update:
  - `packages/ui-model-demo-server/auth.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - focused tests under `scripts/tests/`
- Must NOT touch:
  - Positive business model code unless needed to expose non-sensitive public metadata.

**Validation (Executable)**
- Commands:
  - `node scripts/tests/<new_guest_readonly_authz_test>.mjs`
  - `node scripts/tests/<new_capability_guard_test>.mjs`
- Expected signals:
  - Guest can fetch public snapshot.
  - Guest cannot POST write endpoints.
  - Authenticated user without Matrix capability cannot call Matrix/management actions.
  - Authenticated user with capability is allowed through the guard.

**Acceptance Criteria**
- Permission is enforced server-side.
- No restricted Matrix/Workspace state appears in guest snapshot.
- Sub-agent review Approved.

**Rollback Strategy**
- Revert authz/filter changes.

---

### Step 4 — Frontend auth UX
**Goal**
- Make login/logout and permission states obvious, attractive, and usable in remote mode.

**Scope**
- Instantiate `authStore` in remote mode.
- Add account dropdown in the top-right shell with Login, Logout, identity, roles/capabilities, and Matrix connect status.
- Add SSO login page or route that preserves `returnTo`.
- Add permission denied and login-required views.
- Show read-only visitor affordance without tutorial text.
- Extend UI model renderer only if existing components cannot express required dropdown/menu/empty/error states cleanly.

**Files**
- Create/Update:
  - `packages/ui-model-demo-frontend/src/main.js`
  - `packages/ui-model-demo-frontend/src/auth_store.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - Optional auth UI component files.
  - Optional `packages/ui-renderer/src/component_registry_v1.json`, `renderer.mjs`, `renderer.js` only if a UI model extension is necessary.
- Must NOT touch:
  - Unrelated Matrix Chat layout changes from 0402.

**Validation (Executable)**
- Commands:
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
- Browser checks:
  - Guest home/public pages render.
  - Login button redirects to SSO start.
  - Permission denied page renders without overlap at desktop and mobile widths.
  - Logout returns to visitor state.
- Expected signals:
  - No visible overflow/overlap in auth shell.
  - Header dropdown controls are keyboard/mouse usable.

**Acceptance Criteria**
- Remote frontend reflects auth state from `/auth/me`.
- Visitor and permission-denied paths are visually clear and not code-like.
- Sub-agent review Approved.

**Rollback Strategy**
- Revert frontend UI changes and optional renderer extension.

---

### Step 5 — Matrix SSO capability bridge
**Goal**
- Let an authenticated Dongyu user connect Matrix without password, using Matrix SSO and the browser's existing ZITADEL login.

**Scope**
- Add Matrix SSO start endpoint that creates a short-lived one-time pending state bound to current `dy_session`, requested homeserver, return URL, and Matrix capability, then redirects to Matrix `/login/sso/redirect`.
- Add Matrix SSO callback endpoint that receives `loginToken` and validates/consumes the pending state before token exchange.
- Exchange `loginToken` using Matrix `m.login.token` for Matrix access token.
- Store Matrix `{userId, homeserverUrl, accessToken, deviceId}` inside Dongyu session.
- Add `/auth/matrix/status` and disconnect behavior.
- Ensure Matrix Chat/media/management bus uses session Matrix identity when available.
- Reject missing state, unknown state, expired state, replayed state, unauthenticated callback, and missing Matrix capability before any Matrix token is stored.

**Files**
- Create/Update:
  - `packages/ui-model-demo-server/auth.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/auth_store.js`
  - auth UI files from Step 4 if needed.
  - focused tests under `scripts/tests/`
- Must NOT touch:
  - MAS/ZITADEL/Synapse deployment.

**Validation (Executable)**
- Commands:
  - `node scripts/tests/<new_matrix_sso_bridge_test>.mjs`
  - `curl -fsS https://matrix.dongyudigital.com/_matrix/client/v3/login`
- Browser checks:
  - Authenticated Dongyu user clicks Matrix connect.
  - Matrix SSO returns to Dongyu callback.
  - `/auth/me` or `/auth/matrix/status` shows Matrix connected.
  - Matrix Chat refresh/send or management bus allowed action works with session token.
- Expected signals:
  - Mock tests reject forged callback, missing state, expired state, replayed state, and no-capability user.
  - Matrix token is never exposed to frontend or logs.
  - Missing Matrix capability returns permission denied.

**Acceptance Criteria**
- Dongyu App login and Matrix capability connection are separate but smooth.
- Matrix Chat/management bus can use the logged-in user's Matrix identity.
- Sub-agent review Approved.

**Rollback Strategy**
- Disable Matrix SSO endpoints and revert session token storage changes.

---

### Step 6 — End-to-end verification and docs
**Goal**
- Prove the full SSO/authz UX works and leave a durable handoff.

**Scope**
- Run deterministic tests and build.
- Start local stack and run browser smoke for guest, login redirect, callback, logout, permission denied, Matrix connect.
- Run real SSO against `sso.dongyudigital.com` using the created account.
- Update user-facing docs only where the behavior changed.
- Run final sub-agent review over full diff and evidence.

**Files**
- Create/Update:
  - `docs/iterations/0403-zitadel-sso-authz-gateway/runlog.md`
  - `docs/user-guide/*` if auth behavior needs a user-facing guide.
  - `docs/ITERATIONS.md` status on completion.
- Must NOT touch:
  - Unrelated historical iteration evidence.

**Validation (Executable)**
- Commands:
  - `node scripts/tests/<new_oidc_auth_test>.mjs`
  - `node scripts/tests/<new_guest_readonly_authz_test>.mjs`
  - `node scripts/tests/<new_matrix_sso_bridge_test>.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - local server start command recorded in runlog.
- Browser checks:
  - Desktop and mobile auth UX screenshots.
  - Real SSO login/logout.
  - Guest write denial and authenticated allowed action.
  - Matrix connect and one Matrix-backed action.
- Expected signals:
  - All command checks PASS.
  - Browser checks show no blank/overlap/broken states.
  - Final sub-agent review Approved.

**Acceptance Criteria**
- Definition of Done in `plan.md` is fully satisfied.
- `docs/ITERATIONS.md` can be moved to Completed.

**Rollback Strategy**
- Revert 0403 commits or keep iteration On Hold if real SSO cannot be completed due to external account/app configuration.

> 禁止在本文件记录 PASS/FAIL、命令输出、commit hash。
