---
title: "Iteration 0433 Dev Fake Login Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-07-03
source: ai
iteration_id: 0433-dev-fake-login
id: 0433-dev-fake-login
phase: completed
---

# Iteration 0433-dev-fake-login Resolution

## Execution Strategy

Use TDD. First add a failing contract test for default-off fake login and
enabled two-user isolation. Then implement the smallest server/frontend changes
that pass the test. Finally redeploy the local UI Server with fake login enabled
and verify the flow in real browser contexts.

## Step 0: Plan Gate

- Scope: freeze this small temporary-login plan.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0433-dev-fake-login/plan.md`
  - `docs/iterations/0433-dev-fake-login/resolution.md`
  - `docs/iterations/0433-dev-fake-login/runlog.md`
- Verification:
  - `git diff --check -- docs/ITERATIONS.md docs/iterations/0433-dev-fake-login`
  - placeholder/stale-plan scan returns no matches.
  - three independent AI-assisted reviews are Approved.
- Acceptance: Review Gate is Approved.
- Rollback: remove 0433 iteration docs and registry row.

## Step 1: Auth Contract Test

- Scope: encode the fake-login contract before implementation.
- Files:
  - `scripts/tests/test_0433_dev_fake_login_contract.mjs`
- Verification:
  - Run the new test and capture the expected RED failure.
- Acceptance:
  - Test fails because the fake-login route/config does not exist yet, not
    because of syntax or setup errors.
- Rollback: remove the new test.

## Step 2: Server Fake Login

- Scope: add default-off server support for dev fake login.
- Files:
  - `packages/ui-model-demo-server/auth.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0433_dev_fake_login_contract.mjs`
- Verification:
  - `node scripts/tests/test_0433_dev_fake_login_contract.mjs`
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node scripts/tests/test_0421_sso_post_login_latency_contract.mjs`
  - `node --check packages/ui-model-demo-server/auth.mjs`
  - `node --check packages/ui-model-demo-server/server.mjs`
- Acceptance:
  - Default-off route does not create sessions.
  - Enabled route creates normal session cookies for distinct fake users.
  - Existing OIDC session behavior is unchanged.
- Rollback: revert server/auth/test changes from this step.

## Step 3: Frontend Login Affordance

- Scope: show temporary fake-login buttons only when enabled by server config.
- Files:
  - `packages/ui-model-demo-frontend/src/auth_store.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - frontend tests if an existing contract covers login affordances.
- Verification:
  - targeted frontend/login contract test if available.
  - `npm -C packages/ui-model-demo-frontend run build`
- Acceptance:
  - Button is hidden when disabled.
  - Button is visible and clearly marked temporary when enabled.
  - Clicking fake user login navigates through the server route and enters the
    normal authenticated state.
- Rollback: revert frontend changes from this step.

## Step 4: Local Deployment And Browser Verification

- Scope: redeploy local UI Server with fake login enabled and verify real
  browser behavior.
- Files:
  - `deploy/env/local.env.example`
  - `k8s/local/workers.yaml`
  - deployment helper files only if needed to pass the flag through.
  - `docs/iterations/0433-dev-fake-login/runlog.md`
- Verification:
  - local deploy/restart through repo-approved scripts.
  - real browser/Playwright context A logs in as fake user A and reaches
    desktop.
  - real browser/Playwright context B logs in as fake user B and reaches
    desktop.
  - `/auth/me` in both contexts proves distinct users.
  - browser/session cleanup check passes.
- Acceptance:
  - Local testing can proceed without remote OIDC.
  - Formal restore path is documented: set the fake-login flag to off/unset and
    redeploy.
- Rollback: unset fake-login flag and redeploy UI Server.

## Final Review And Completion

- Run `git diff --check`.
- Re-run targeted auth/frontend checks.
- Record PASS/FAIL evidence and final status in `runlog.md`.
