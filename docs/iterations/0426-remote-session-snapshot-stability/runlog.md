---
title: "Iteration 0426 Remote Session Snapshot Stability Runlog"
doc_type: iteration-runlog
status: in_progress
updated: 2026-06-24
source: ai
iteration_id: 0426-remote-session-snapshot-stability
id: 0426-remote-session-snapshot-stability
---

# Iteration 0426-remote-session-snapshot-stability Runlog

## Environment

- Date: 2026-06-24
- Branch: `dropx/dev_0426-remote-session-snapshot-stability`
- Runtime: UI Server + Vue frontend + ModelTable runtime, continuing from 0425

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 1
- Decision: Change Requested
- Notes: Governance review requested explicit Review Gate records, Approved/In
  Progress status transition before Phase 3, removal of blank future runlog
  templates, and recording of self-check evidence.

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 2
- Decision: Change Requested
- Notes: Auth/asset review requested tests for session mutation/delete/logout,
  secret boundaries, corrupt sealed records, production missing-secret behavior,
  and asset readiness coverage beyond snapshot.

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 3
- Decision: Change Requested
- Notes: Snapshot/subtable review requested hard prohibition on full snapshot
  fallback, required table-qualified visible refs, and principal isolation tests
  for mismatch recovery.

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 4
- Decision: Change Requested
- Notes: Governance re-review confirmed the prior findings were addressed in
  the plan text, but correctly kept Phase 3 closed because the new Approved
  review records had not yet been written to this runlog and
  `docs/ITERATIONS.md` was still `Planned`.

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 5
- Decision: Approved
- Notes: Auth/asset reviewer found no remaining findings. The revised plan now
  covers session mutation/delete/logout persistence, sealed session secret
  boundaries, corrupt/rotated-secret rejection, production missing-secret
  behavior, asset readiness across runtime entrypoints, and pod-side manifest
  verification.

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 6
- Decision: Approved
- Notes: Snapshot/principal reviewer found no remaining findings. The revised
  plan blocks `profile=full`, bare all-model `/snapshot`, old
  `visible_model_id`/bare `model_id` recovery, and cross-principal cache/ref
  reuse.

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 7
- Decision: Approved
- Notes: Governance reviewer found no remaining findings. With Review Indexes
  5, 6, and 7 all Approved, Auto-Approval is satisfied and the iteration may
  enter Phase 3 after recording the status transition.

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 8
- Decision: Change Requested
- Notes: Step 1/2 auth implementation reviewer found the code path broadly
  correct, but requested explicit expiry and missing persisted store coverage
  promised by `resolution.md`; reviewer also requested duplicate Step 2 evidence
  cleanup if present.

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 9
- Decision: Change Requested
- Notes: Step 1/2 auth re-review found the auth code and tests aligned, but
  requested runlog consistency because the top Review Gate record and execution
  record disagreed about the index 9 decision.

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 10
- Decision: Approved
- Notes: Step 1/2 auth final re-review found no remaining findings. Reviewer
  confirmed index 9 consistency, seven-case RED/green evidence, sealed session
  persistence, mutation/delete/logout coverage, corrupt/rotated/expired/missing
  store rejection, and existing OIDC regression evidence.

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 11
- Decision: Change Requested
- Notes: Step 3 persisted asset readiness review requested explicit configured
  missing-root coverage, visible snapshot coverage, and recording of Step 3
  review facts before moving on.

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 12
- Decision: Approved
- Notes: Step 3 persisted asset readiness re-review found no remaining findings.
  Reviewer confirmed configured missing-root coverage, visible snapshot
  coverage, bounded not-ready responses, healthy manifest behavior, pod-side
  manifest checks, and Step 3 review evidence.

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 13
- Decision: Change Requested
- Notes: Step 4/5 review requested dynamic persisted asset recovery after a
  manifest appears, frontend JSON/SSE not-ready retry handling, local browser
  evidence before cloud deploy, and noted that deploy secret handling needed to
  cover newly required non-empty session/auth secrets.

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 14
- Decision: Change Requested
- Notes: Local integrated stage review found `deploy_cloud_app.sh` incorrectly
  ran the persisted asset manifest gate for every target even though only
  `ui-server` mounts persisted assets.

Review Gate Record
- Iteration ID: 0426-remote-session-snapshot-stability
- Review Date: 2026-06-24
- Review Type: AI-assisted
- Review Index: 15
- Decision: Approved
- Notes: Targeted re-review confirmed the prior deploy blocker is fixed:
  `deploy_cloud_app.sh` gates the manifest check to `TARGET=ui-server`, the
  regression test passes, and there are no remaining verification gaps before
  remote deployment.

## Baseline Context

- 0425 completed principal-scoped subtables, table-qualified visible model refs,
  and user desktop isolation.
- Remote deployment after 0425 exposed three stability concerns:
  - UI Server session state was process-local, so cloud pod restart could force
    a user who had already completed SSO back into an uncertain login state.
  - A missing `/app/persisted-assets/manifest.v0.json` during rollout could
    surface as an uncaught request failure instead of a bounded not-ready state.
  - Frontend `snapshot_patch_base_mismatch` warnings could appear after deploy
    or restore; the browser recovered in some cases, but the recovery path needs
    deterministic tests and evidence.

## Execution Records

### Step 0 - Registration And Baseline

- Command: `git switch -c dropx/dev_0426-remote-session-snapshot-stability`
- Key output: branch created from `dev`
- Result: PASS
- Commit: pending

- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0426-remote-session-snapshot-stability --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output: created `plan.md`, `resolution.md`, and `runlog.md`
- Result: PASS
- Commit: pending

- Command: `apply_patch`
- Key output: registered 0426 in `docs/ITERATIONS.md` and replaced scaffold
  TODOs with the implementation plan
- Result: PASS
- Commit: pending

- Command: `git diff --check`
- Key output: no whitespace errors
- Result: PASS
- Commit: pending

- Command: `rg -n "0426-remote-session-snapshot-stability|snapshot_patch_base_mismatch|persisted asset|SSO session" docs/ITERATIONS.md docs/iterations/0426-remote-session-snapshot-stability`
- Key output: 0426 registry row and plan references found
- Result: PASS
- Commit: pending

- Command: sub-agent plan review, indexes 1-3
- Key output: three independent reviews returned Change Requested
- Result: PASS
- Commit: pending

- Command: `apply_patch`
- Key output: addressed plan review findings by tightening review gate,
  session mutation/secret tests, asset readiness endpoints, and snapshot
  recovery principal/table-qualified constraints
- Result: PASS
- Commit: pending

- Command: `git add -N docs/iterations/0426-remote-session-snapshot-stability/plan.md docs/iterations/0426-remote-session-snapshot-stability/resolution.md docs/iterations/0426-remote-session-snapshot-stability/runlog.md && git diff --check && git diff --stat`
- Key output: no whitespace errors; diff covers `docs/ITERATIONS.md` and all
  three new 0426 iteration docs
- Result: PASS
- Commit: pending

- Command: `codex exec` read-only plan re-review, indexes 4-6
- Key output: governance reviewer returned Change Requested due missing newly
  recorded approvals/status transition; auth/asset and snapshot reviewers both
  returned Approved with no findings.
- Result: PASS
- Commit: pending

- Command: `codex exec` read-only governance re-review, index 7
- Key output: Approved with no findings; reviewer confirmed latest reviews
  5/6/7 satisfy Auto-Approval after this record is appended.
- Result: PASS
- Commit: pending

- Command: `apply_patch`
- Key output: updated 0426 status from `Planned` through the approved gate to
  `In Progress` in `docs/ITERATIONS.md` and `plan.md`.
- Result: PASS
- Commit: pending

### Step 1 - Auth Session Persistence Contract

- Command: `node scripts/tests/test_0426_auth_session_persistence_contract.mjs`
- Key output: 0 passed, 5 failed. Failures confirm the intended RED baseline:
  missing `auth/sessions.v1.json`, session loss after module reload, no durable
  Matrix mutation/logout state, and production missing session secret not
  rejected.
- Result: PASS (expected RED)
- Commit: pending

- Command: `codex exec` read-only Step 1 contract review
- Key output: Change Requested. Reviewer confirmed the RED signal was not a
  harness bug, but requested explicit Matrix SSO update coverage, persisted
  `id_token` non-plaintext coverage, and runlog/test-count alignment.
- Result: PASS
- Commit: pending

- Command: `apply_patch`
- Key output: tightened the auth persistence contract test by adding second
  Matrix SSO attach/update durability coverage, persisted OIDC `id_token`
  non-plaintext assertion, and aligned the runlog RED count to the then-current
  five-case test file.
- Result: PASS
- Commit: pending

### Step 2 - Auth Session Persistence Implementation

- Command: `apply_patch`
- Key output: completed sealed persisted auth session records in
  `packages/ui-model-demo-server/auth.mjs`; persistence is enabled by
  `DY_AUTH_SESSION_STORE_FILE`, `DY_AUTH_SESSION_STORE_DIR`, or
  `DY_PERSIST_ROOT`; persisted records are keyed by HMAC of the opaque cookie
  token and sealed with AES-GCM using an explicit server-side session secret.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0426_auth_session_persistence_contract.mjs`
- Key output: 7 passed, 0 failed; covered OIDC session reload, Matrix SSO
  attach/update/disconnect durability, logout deletion, secret rotation/corrupt
  record rejection, expired persisted session cleanup, missing persisted store
  fail-closed behavior, OIDC/Matrix token non-plaintext storage, and
  production missing-secret rejection.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0403_oidc_session_gateway.mjs`
- Key output: 15 passed, 0 failed; existing OIDC login/logout, state replay,
  cookie, and role/capability contracts still pass.
- Result: PASS
- Commit: pending

- Command: `codex exec` read-only auth Step 1/2 review, index 8
- Key output: Change Requested; reviewer requested explicit expiry/missing
  store coverage and duplicate Step 2 evidence cleanup if present.
- Result: PASS
- Commit: pending

- Command: `apply_patch`
- Key output: added expiry cleanup and missing persisted store fail-closed tests
  to `scripts/tests/test_0426_auth_session_persistence_contract.mjs`; current
  runlog had no remaining duplicate Step 2 block after prior cleanup.
- Result: PASS
- Commit: pending

- Command: `tmpdir=$(mktemp -d /tmp/dy-0426-red-baseline.XXXXXX) ... git show dev:packages/ui-model-demo-server/auth.mjs ... node "$tmpdir/scripts/tests/test_0426_auth_session_persistence_contract.mjs"`
- Key output: 0 passed, 7 failed out of 7 against the pre-0426 `dev` auth
  implementation. Failures covered missing sealed store, session loss after
  reload, Matrix mutation loss, logout/delete store absence, expired/missing
  store handling, and production missing-secret not rejected.
- Result: PASS (expected RED)
- Commit: pending

- Command: `node scripts/tests/test_0426_auth_session_persistence_contract.mjs`
- Key output: 7 passed, 0 failed; current suite covers OIDC session reload,
  Matrix SSO attach/update/disconnect durability, logout deletion, secret
  rotation/corrupt record rejection, expired record cleanup, missing store
  fail-closed behavior, OIDC/Matrix token non-plaintext storage, and production
  missing-secret rejection.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0403_oidc_session_gateway.mjs`
- Key output: 15 passed, 0 failed.
- Result: PASS
- Commit: pending

- Command: `codex exec` read-only auth Step 1/2 re-review, index 9
- Key output: Change Requested; reviewer found auth code aligned but requested
  runlog consistency because the test suite had expanded to seven cases while
  earlier Step 1 text still described a five-case current file.
- Result: PASS
- Commit: pending

- Command: `apply_patch`
- Key output: recorded the seven-case baseline RED run against `dev` auth and
  clarified that the earlier five-case RED was the initial contract before the
  review-requested expansion.
- Result: PASS
- Commit: pending

- Command: `apply_patch`
- Key output: corrected the top Review Gate Record for index 9 from Approved to
  Change Requested so it matches the execution record and leaves the next
  review index for the final approval.
- Result: PASS
- Commit: pending

- Command: `codex exec` read-only auth Step 1/2 final re-review, index 10
- Key output: Approved with no findings. Verification gap: sub-agent could not
  independently rerun localhost-listening tests in its read-only sandbox, but
  confirmed code and runlog evidence are aligned.
- Result: PASS
- Commit: pending

### Step 3 - Persisted Asset Readiness

- Command: `node scripts/tests/test_0426_persisted_asset_readiness_contract.mjs`
- Key output: 1 passed, 2 failed. RED baseline: missing asset manifest still
  returned `/snapshot` 202 instead of `persisted_asset_not_ready`, and deploy
  scripts did not yet verify `/app/persisted-assets/manifest.v0.json` from a
  running pod.
- Result: PASS (expected RED)
- Commit: pending

- Command: `apply_patch`
- Key output: added persisted asset not-ready gating for runtime entrypoints:
  `/snapshot`, `/stream`, `/bus_event`, `/ui_event`, and
  `/api/runtime/mode`; added pod-side manifest checks to
  `scripts/ops/deploy_cloud_app.sh` and
  `scripts/ops/deploy_cloud_full.sh`.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0426_persisted_asset_readiness_contract.mjs`
- Key output: 3 passed, 0 failed. Covered missing manifest not-ready responses
  for snapshot, SSE stream, runtime mode, and bus event; valid manifest path;
  and cloud deploy scripts checking `manifest.v0.json` from pod context.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0426_auth_session_persistence_contract.mjs`
- Key output: 7 passed, 0 failed.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0403_oidc_session_gateway.mjs`
- Key output: 15 passed, 0 failed.
- Result: PASS
- Commit: pending

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS
- Commit: pending

- Command: `codex exec` read-only Step 3 persisted asset readiness review,
  index 11
- Key output: Change Requested; reviewer requested configured missing asset
  root coverage, visible snapshot readiness coverage, and explicit Step 3
  review evidence in this runlog.
- Result: PASS
- Commit: pending

- Command: `apply_patch`
- Key output: extended
  `scripts/tests/test_0426_persisted_asset_readiness_contract.mjs` with
  `profile=visible` snapshot coverage and a configured-but-missing asset root
  case.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0426_persisted_asset_readiness_contract.mjs`
- Key output: 4 passed, 0 failed. Added coverage for visible snapshot and
  configured missing asset root while preserving manifest-missing, healthy
  manifest, and deploy script checks.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0426_auth_session_persistence_contract.mjs`
- Key output: 7 passed, 0 failed.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0403_oidc_session_gateway.mjs`
- Key output: 15 passed, 0 failed.
- Result: PASS
- Commit: pending

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS
- Commit: pending

- Command: `codex exec` read-only Step 3 persisted asset readiness re-review,
  index 12
- Key output: Approved with no findings. Verification gap: sub-agent could not
  rerun temp-dir tests in its read-only sandbox or execute remote deploy
  scripts, but confirmed code and runlog evidence.
- Result: PASS
- Commit: pending

### Step 4 - Snapshot Patch Recovery

- Command: `node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs`
- Key output: 2 passed, 0 failed; covered table-qualified
  `visible_model_ref` recovery without `profile=full`/bare snapshot fallback
  and principal-switch cache/ref clearing.
- Result: PASS
- Commit: pending

- Command: `apply_patch`
- Key output: suppressed expected `snapshot_patch_base_mismatch` warning output
  while preserving recovery; unexpected patch parse/apply failures still warn.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs`
- Key output: 2 passed, 0 failed; no mismatch warning/error noise printed.
- Result: PASS
- Commit: pending

- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output: Vite build succeeded in 3.02s; existing large chunk warning remains.
- Result: PASS
- Commit: pending

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS
- Commit: pending

### Step 5 - Local Integrated Verification

- Command: `node scripts/tests/test_0426_auth_session_persistence_contract.mjs`
- Key output: 7 passed, 0 failed.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0426_persisted_asset_readiness_contract.mjs`
- Key output: 4 passed, 0 failed.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0403_oidc_session_gateway.mjs`
- Key output: 15 passed, 0 failed.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- Key output: 7 passed.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
- Key output: 13 passed.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
- Key output: 7 passed, 0 failed.
- Result: PASS
- Commit: pending

- Command: `npm -C packages/ui-model-demo-frontend run test`
- Key output: editor validation suite passed.
- Result: PASS
- Commit: pending

- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: local Orbstack deployments for mosquitto, synapse,
  remote-worker, workspace-manager, mbr-worker, and ui-server are ready.
- Result: PASS
- Commit: pending

- Command: `bash -n scripts/ops/deploy_cloud_app.sh && bash -n scripts/ops/deploy_cloud_full.sh`
- Key output: no shell syntax errors.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0426_persisted_asset_readiness_contract.mjs && node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs`
- Key output: expected RED after adding missing review coverage:
  server stayed not-ready after manifest appeared; frontend did not set visible
  `persisted_asset_not_ready` state or retry for JSON/SSE not-ready payloads.
- Result: PASS (expected RED)
- Commit: pending

- Command: `apply_patch`
- Key output: fixed server dynamic asset readiness by capturing
  `persistedAssetRoot` at startup and rebuilding root state when manifest
  appears; fixed frontend JSON/SSE `persisted_asset_not_ready` status and retry
  handling; added deployment secret generation/preservation and empty-secret
  guard for `DY_SESSION_SECRET` / `DY_AUTH_SECRET`.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0426_persisted_asset_readiness_contract.mjs`
- Key output: 5 passed, 0 failed; added dynamic recovery coverage for
  "manifest appears after startup".
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs`
- Key output: 4 passed, 0 failed; added frontend JSON and SSE not-ready visible
  status + retry coverage.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0403_deploy_sso_env_contract.mjs`
- Key output: PASS; deploy secret contract now rejects empty runtime auth
  secret values and asserts generated/resolved secret handling.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0426_auth_session_persistence_contract.mjs`
- Key output: 7 passed, 0 failed.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0403_oidc_session_gateway.mjs`
- Key output: 15 passed, 0 failed.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- Key output: 7 passed.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
- Key output: 13 passed.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
- Key output: 7 passed, 0 failed.
- Result: PASS
- Commit: pending

- Command: `npm -C packages/ui-model-demo-frontend run test`
- Key output: editor validation suite passed.
- Result: PASS
- Commit: pending

- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output: Vite build succeeded in 2.89s; existing large chunk warning
  remains.
- Result: PASS
- Commit: pending

- Command: `bash -n scripts/ops/_deploy_common.sh && bash -n scripts/ops/deploy_cloud_app.sh && bash -n scripts/ops/deploy_cloud_full.sh && git diff --check`
- Key output: no shell syntax or whitespace errors.
- Result: PASS
- Commit: pending

- Command: `bash scripts/ops/deploy_local.sh`
- Key output:
  - Built and loaded `dy-ui-server:v1`, `dy-remote-worker:v3`,
    `dy-mbr-worker:v2`.
  - Rolled out `ui-server`, `mbr-worker`, `remote-worker`, and
    `workspace-manager`.
  - Local deployment uses remote Matrix homeserver
    `https://matrix.dongyudigital.com`.
  - Created/verified Matrix DM room
    `!bbaEfnBSjFJRHExXik:synapse.dongyudigital.com`.
- Result: PASS
- Commit: pending

- Command: `kubectl -n dy-app get deploy ui-server mbr-worker remote-worker workspace-manager`
- Key output: all four deployments reported available replicas after local
  rollout.
- Result: PASS
- Commit: pending

- Command: `kubectl -n dy-app get secret ui-server-secret -o jsonpath=... | base64 -d | wc -c`
- Key output: decoded `DY_SESSION_SECRET` length `64`; decoded
  `DY_AUTH_SECRET` length `64`.
- Result: PASS
- Commit: pending

- Command: `curl -sS -o /tmp/0426-snapshot.json -w '%{http_code} %{size_download}\n' 'http://127.0.0.1:30900/snapshot?profile=bootstrap&initial_projection=1'`
- Key output: HTTP 200 before browser login; bootstrap endpoint served normally.
- Result: PASS
- Commit: pending

- Command: Playwright browser flow on `http://127.0.0.1:30900`
- Key output:
  - SSO login as test principal `drop-test` reached desktop.
  - Navigation after callback reached loaded app shell in about `393ms`.
  - Opened built-in `To Do Board`; app rendered board content and did not stay
    on `正在加载滑动 APP...`.
  - Opened `E2E 颜色生成器`, entered `0426 local browser`, clicked
    `Generate Color`; visible color changed from `#FFFFFF` to `#f6fe56` and
    status became `processed`.
  - Browser reload returned to `E2E 颜色生成器`, kept authenticated user
    `drop-test`, retained visible color `#f6fe56`, and navigation load was
    about `91ms`.
  - `/auth/me` after reload returned HTTP 200 with roles
    `dongyu.admin`, `dongyu.matrix`, `dongyu.slide`, `dongyu.viewer`.
  - `/snapshot?profile=bootstrap&initial_projection=1` after reload returned
    HTTP 200 with response length `30457` bytes.
- Result: PASS
- Commit: pending

- Command: final targeted sub-agent review after adding dynamic asset recovery,
  frontend not-ready retry, deploy secret guard, and local browser evidence.
- Key output: `Decision: Approved with nits`; nit requested an explicit empty
  `DY_AUTH_SECRET` deploy test.
- Result: PASS after follow-up patch and
  `node scripts/tests/test_0403_deploy_sso_env_contract.mjs`.
- Commit: pending

- Command: local integrated stage sub-agent review before remote deploy.
- Key output: `Decision: CHANGE_REQUESTED`; reviewer found
  `deploy_cloud_app.sh` ran the persisted asset manifest gate for every
  target, while only `ui-server` mounts persisted assets.
- Result: FAIL before fix
- Commit: pending

- Command: `apply_patch`
- Key output: changed `deploy_cloud_app.sh` so the persisted asset manifest gate
  runs only for `TARGET=ui-server`; other targets print an explicit skip
  message. Added a regression assertion to
  `test_0426_persisted_asset_readiness_contract.mjs`.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0426_persisted_asset_readiness_contract.mjs`
- Key output: 5 passed, 0 failed out of 5.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0403_deploy_sso_env_contract.mjs`
- Key output: PASS.
- Result: PASS
- Commit: pending

- Command: `bash -n scripts/ops/_deploy_common.sh && bash -n scripts/ops/deploy_cloud_app.sh && bash -n scripts/ops/deploy_cloud_full.sh && git diff --check`
- Key output: no shell syntax or whitespace errors.
- Result: PASS
- Commit: pending

## Docs Updated

- [x] `docs/ITERATIONS.md`
- [x] `docs/iterations/0426-remote-session-snapshot-stability/plan.md`
- [x] `docs/iterations/0426-remote-session-snapshot-stability/resolution.md`
- [x] `docs/iterations/0426-remote-session-snapshot-stability/runlog.md`
