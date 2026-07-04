---
title: "Iteration 0433 Dev Fake Login Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-07-03
source: ai
iteration_id: 0433-dev-fake-login
id: 0433-dev-fake-login
phase: completed
---

# Iteration 0433-dev-fake-login Runlog

## Environment

- Date: 2026-07-03
- Branch: `dropx/dev_0433-dev-fake-login`
- Runtime: temporary local testing path for non-Matrix UI while remote OIDC is
  unreachable.
- Governing docs:
  - `CLAUDE.md`
  - `docs/WORKFLOW.md`
  - `docs/ssot/principal_scoped_subtable_namespace_v1.md`

## Review Gate Record

- Iteration ID: `0433-dev-fake-login`
- Review Date: 2026-07-03
- Review Type: AI-assisted / security boundary
- Review Index: 1
- Decision: Approved
- Notes:
  - The plan keeps fake login default-off and explicitly guarded.
  - The plan avoids `DY_AUTH=0`, so per-user session isolation remains testable.

- Iteration ID: `0433-dev-fake-login`
- Review Date: 2026-07-03
- Review Type: AI-assisted / product testing
- Review Index: 2
- Decision: Approved
- Notes:
  - The plan gives testers a browser-visible way to bypass only the broken OIDC
    issuer, not app authorization.
  - The plan requires real-browser evidence for two fake users.

- Iteration ID: `0433-dev-fake-login`
- Review Date: 2026-07-03
- Review Type: AI-assisted / rollback
- Review Index: 3
- Decision: Approved
- Notes:
  - The plan has one restore switch: disable the temporary fake-login flag and
    redeploy.
  - Formal OIDC tests remain in the verification set.

## Execution Records

### Step 0: Plan Gate

- Command:
  - `git diff --check -- docs/ITERATIONS.md docs/iterations/0433-dev-fake-login`
  - `rg -n --glob '!runlog.md' "\\[(TO)DO\\]|Descri[b]e the iteration objective|Explai[n] implementation approach|PLACEHOLD[E]R|pendin[g]" docs/iterations/0433-dev-fake-login docs/ITERATIONS.md`
- Key output:
  - `git diff --check`: no output.
  - Placeholder scan: no matches.
  - Three independent AI-assisted plan reviews: Approved.
- Result: PASS

### Step 1: Auth Contract Test

- Command:
  - `node scripts/tests/test_0433_dev_fake_login_contract.mjs`
- Key output:
  - RED: `0 passed, 5 failed out of 5`.
  - Failures show `/auth/dev/fake-login/options` and
    `/auth/dev/fake-login` are not implemented/public yet, and frontend has no
    fake-login affordance.
- Result: PASS

### Step 2: Server Fake Login

- Command:
  - `node scripts/tests/test_0433_dev_fake_login_contract.mjs`
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - `node scripts/tests/test_0421_sso_post_login_latency_contract.mjs`
  - `node --check packages/ui-model-demo-server/auth.mjs`
  - `node --check packages/ui-model-demo-server/server.mjs`
- Key output:
  - RED before implementation: `0 passed, 5 failed out of 5`.
  - After server implementation: server fake-login cases passed; frontend
    affordance case still failed as expected.
  - Final 0433 contract after frontend step: `5 passed, 0 failed out of 5`.
  - OIDC session gateway: `15 passed, 0 failed out of 15`.
  - SSO post-login latency contract: `13 passed`.
  - Syntax checks: no output.
- Result: PASS

### Step 3: Frontend Login Affordance

- Command:
  - `node scripts/tests/test_0433_dev_fake_login_contract.mjs`
  - `node scripts/tests/test_0403_frontend_auth_ux_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `node scripts/tests/test_0403_deploy_sso_env_contract.mjs`
  - `git diff --check -- packages/ui-model-demo-server/auth.mjs packages/ui-model-demo-server/server.mjs packages/ui-model-demo-frontend/src/auth_store.js packages/ui-model-demo-frontend/src/demo_app.js scripts/tests/test_0433_dev_fake_login_contract.mjs scripts/tests/test_0403_deploy_sso_env_contract.mjs deploy/env/local.env.example deploy/env/cloud.env.example k8s/local/workers.yaml k8s/cloud/workers.yaml scripts/ops/_deploy_common.sh scripts/ops/deploy_cloud_app.sh docs/ITERATIONS.md docs/iterations/0433-dev-fake-login`
- Key output:
  - 0433 contract: `5 passed, 0 failed out of 5`.
  - Frontend auth UX contract: `6 passed, 0 failed out of 6`.
  - Frontend production build: `vite build` completed successfully.
  - Deploy SSO env contract: PASS after adding `DY_DEV_FAKE_LOGIN` to
    ui-server secret/manifest guard coverage.
  - `git diff --check`: no output.
- Result: PASS

### Step 4: Local Deployment And Browser Verification

- Command:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `kubectl -n dongyu exec deploy/ui-server -- printenv DY_DEV_FAKE_LOGIN DY_AUTH`
  - `DOCKER_BUILDKIT=0 SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `DY_PW_SESSION=dy-0433-drop scripts/ops/playwright_session_guard.sh cleanup`
  - `DY_PW_SESSION=dy-0433-swk scripts/ops/playwright_session_guard.sh cleanup`
  - `DY_PW_SESSION=dy-0433-drop scripts/ops/playwright_session_guard.sh session open http://127.0.0.1:30900/ --headed`
  - `DY_PW_SESSION=dy-0433-drop scripts/ops/playwright_session_guard.sh session snapshot`
  - `DY_PW_SESSION=dy-0433-drop scripts/ops/playwright_session_guard.sh session click e17`
  - `DY_PW_SESSION=dy-0433-drop scripts/ops/playwright_session_guard.sh session eval "async () => await (await fetch('/auth/me', { credentials: 'same-origin' })).json()"`
  - `DY_PW_SESSION=dy-0433-swk scripts/ops/playwright_session_guard.sh session open http://127.0.0.1:30900/ --headed`
  - `DY_PW_SESSION=dy-0433-swk scripts/ops/playwright_session_guard.sh session click e19`
  - `DY_PW_SESSION=dy-0433-swk scripts/ops/playwright_session_guard.sh session eval "async () => await (await fetch('/auth/me', { credentials: 'same-origin' })).json()"`
  - `DY_PW_SESSION=dy-0433-drop scripts/ops/playwright_session_guard.sh session click f1e90`
  - screenshot commands under `output/playwright/0433-dev-fake-login/`
  - console checks and cleanup for both sessions.
- Key output:
  - Baseline before/after deploy: `baseline ready`.
  - Pod env: `DY_DEV_FAKE_LOGIN=1`, `DY_AUTH=1`.
  - Local deploy completed successfully; UI Server available at
    `http://localhost:30900`.
  - First browser session showed `临时测试登录` with `Fake Drop`, `Fake SWK`,
    and `Fake Drop Test` buttons while preserving the formal `登录` button.
  - Fake Drop `/auth/me`:
    - `provider: dev-fake`
    - `userId: dev-fake:drop`
    - `username: drop`
    - `matrixConnected: false`
  - Second isolated browser session started as visitor, then Fake SWK
    `/auth/me` returned:
    - `provider: dev-fake`
    - `userId: dev-fake:swk`
    - `username: swk`
    - `matrixConnected: false`
  - Drop session remained `dev-fake:drop` after SWK login in the second
    context.
  - Non-Matrix UI path check: Drop session opened built-in `To Do Board`.
  - Browser console checks for both sessions: `Errors: 0, Warnings: 0`.
  - Playwright cleanup:
    - `PASS: no project Playwright session or project Playwright-managed browser process remains for dy-0433-drop`
    - `PASS: no project Playwright session or project Playwright-managed browser process remains for dy-0433-swk`
  - Evidence screenshots:
    - `output/playwright/0433-dev-fake-login/drop-fake-login-desktop.png`
    - `output/playwright/0433-dev-fake-login/swk-fake-login-desktop.png`
    - `output/playwright/0433-dev-fake-login/drop-todo-open.png`
- Result: PASS

## Disable / Restore Notes

- Fake login must be disabled by default.
- Restore formal-only login by unsetting or setting the temporary fake-login
  flag to a false value, then redeploying UI Server.
- The local test machine currently has `deploy/env/local.env` set to
  `DY_DEV_FAKE_LOGIN=1` to support this temporary verification.

## Final Review

- Review Date: 2026-07-03
- Review Type: AI-assisted / final self-review
- Decision: Approved
- Findings: none.
- Open questions: none.
- Verification gaps: none.
- Notes:
  - Temporary route is hidden and disabled by default.
  - Enabled fake login uses ordinary session cookies and existing
    per-principal runtime isolation instead of `DY_AUTH=0`.
  - Fake users do not claim Matrix connection.
  - Cloud defaults remain disabled.
