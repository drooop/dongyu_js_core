---
title: "Iteration 0421 SSO Post Login Latency Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-06-23
source: ai
iteration_id: 0421-sso-post-login-latency
id: 0421-sso-post-login-latency
phase: completed
---

# Iteration 0421-sso-post-login-latency Resolution

## Execution Strategy

Use TDD and small reviewed stages. First add documentation and tests that pin the intended failure/initialization semantics. Then make `/auth/me` independent from principal runtime creation, add principal-scoped initialization state and metrics, update frontend loading/failure states, and verify the SSO return path in a real browser.

## Step 1 — RED Contract Tests And Metrics Harness

- Scope:
  - Add tests for auth/session and principal runtime initialization semantics.
  - Add a lightweight timing helper or debug surface suitable for tests.
  - Record the current real Chrome baseline in `runlog.md`.
- Files:
  - Create: `scripts/tests/test_0421_sso_post_login_latency_contract.mjs`
  - Modify: `packages/ui-model-demo-server/server.mjs`
  - Modify: `docs/iterations/0421-sso-post-login-latency/runlog.md`
- Verification:
  - `node scripts/tests/test_0421_sso_post_login_latency_contract.mjs`
  - Expected before implementation: fails because the required exports/helpers or explicit initializing contract do not exist yet.
- Acceptance:
  - Tests fail for the intended missing behavior, not syntax or fixture errors.
- Rollback:
  - Remove the new test and runlog additions.

## Step 2 — Principal-Scoped Runtime Ensure And Nonblocking Auth

- Scope:
  - Ensure `/auth/me` reads only session state.
  - Add principal-scoped runtime initialization state with coalesced promise per principal key.
  - Avoid global runtime promise sharing across principals.
  - Surface initialization failure distinctly.
- Files:
  - Modify: `packages/ui-model-demo-server/server.mjs`
  - Modify: `scripts/tests/test_0421_sso_post_login_latency_contract.mjs`
  - Modify: `docs/iterations/0421-sso-post-login-latency/runlog.md`
- Verification:
  - `node scripts/tests/test_0421_sso_post_login_latency_contract.mjs`
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
- Acceptance:
  - `/auth/me` does not initialize runtime.
  - Expired or invalid sessions never enter authenticated workspace initialization; they remain guest/read-only or explicit auth failure according to existing route policy.
  - Authenticated runtime initialization is isolated by principal key.
  - Failure state is typed and testable.
- Rollback:
  - Revert server runtime-registry changes and the 0421 tests.

## Step 3 — Snapshot Initializing Contract And Frontend State

- Scope:
  - Teach `/snapshot` to return explicit authenticated initialization/failure states quickly when needed.
  - Teach frontend remote store/app shell to show `正在准备工作区` or an explicit failure instead of generic `页面暂不可用`.
  - Keep unauthenticated and permission-denied cases distinct.
  - If the authenticated workspace is cold, allow the first bootstrap request to return a read-only initial desktop projection while the writable principal runtime initializes in the background.
  - Keep that projection explicitly non-authoritative; normal writable state still comes from the ready runtime snapshot.
  - Block `bus_event` and `ui_event` with typed `workspace_initializing` while the principal runtime is cold, so UI events cannot accidentally create or mutate the workspace before initialization completes.
- Files:
  - Modify: `packages/ui-model-demo-server/server.mjs`
  - Modify: `packages/ui-model-demo-frontend/src/remote_store.js`
  - Modify: `packages/ui-model-demo-frontend/src/demo_app.js`
  - Modify: `scripts/tests/test_0421_sso_post_login_latency_contract.mjs`
  - Modify: `scripts/tests/test_0403_frontend_auth_ux_contract.mjs`
  - Modify: `docs/iterations/0421-sso-post-login-latency/runlog.md`
- Verification:
  - `node scripts/tests/test_0421_sso_post_login_latency_contract.mjs`
  - `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
- Acceptance:
  - Authenticated initializing state is visible and specific.
  - Auth failure, including stale/expired sessions, remains distinct from authenticated workspace initialization.
  - Cold SSO return can display the tablet desktop quickly from a read-only projection instead of waiting for full principal runtime initialization.
  - The frontend requests the read-only projection only on the first cold bootstrap, then retries normal bootstrap until the true snapshot is ready.
  - Business events stay blocked until the authenticated runtime is ready.
  - Existing frontend auth UX tests pass.
- Rollback:
  - Revert snapshot contract and frontend state changes.

## Step 4 — Local Deploy And Real Browser SSO Measurement

- Scope:
  - Rebuild/redeploy local UI Server.
  - Use the real browser SSO return path or the closest authenticated browser path available.
  - Record before/after metrics and final state.
- Files:
  - Modify: `docs/iterations/0421-sso-post-login-latency/runlog.md`
- Verification:
  - `npm -C packages/ui-model-demo-frontend run build`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - Real Chrome measurement for SSO post-login / desktop visible / scroll overflow.
- Acceptance:
  - `/auth/me` below target in post-login path.
  - First snapshot/initialization response below target when runtime is cold.
  - Desktop eventually appears or a typed failure is shown.
  - No outer/inner scroll regression on the tested desktop.
- Rollback:
  - Redeploy previous image/build if needed.

## Step 5 — Final Review And Completion

- Scope:
  - Run regression tests.
  - Run sub-agent final code review.
  - Update `docs/ITERATIONS.md` with factual status.
  - Record living-doc assessment.
- Files:
  - Modify: `docs/iterations/0421-sso-post-login-latency/runlog.md`
  - Modify: `docs/ITERATIONS.md`
- Verification:
  - `node scripts/tests/test_0421_sso_post_login_latency_contract.mjs`
  - `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
  - `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`
- Acceptance:
  - Final review returns Approved or all findings are fixed and re-reviewed.
  - Runlog contains before/after latency table.
  - No SSOT/user-guide changes are needed, or required changes are explicitly completed.
- Rollback:
  - Revert 0421 commits and restore the previous deployed build.

## Notes

- Each step must use `codex-code-review` in a sub-agent after implementation.
- Do not convert auth failures into loading states.
- Do not share initialization promises across principals.
