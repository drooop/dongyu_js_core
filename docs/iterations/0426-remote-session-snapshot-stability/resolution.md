---
title: "Iteration 0426 Remote Session Snapshot Stability Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-06-24
source: ai
iteration_id: 0426-remote-session-snapshot-stability
id: 0426-remote-session-snapshot-stability
phase: completed
---

# Iteration 0426-remote-session-snapshot-stability Resolution

## Execution Strategy

Use a contract-first implementation path. Each runtime change gets a focused
test before implementation, then a sub-agent review before the next stage.

The implementation is split into three stability surfaces:

1. Auth session stability: make server-side session state survive UI Server
   process restarts without exposing tokens to the frontend.
2. Persisted asset readiness: make slide-app asset availability an explicit
   service state instead of an uncaught startup/request exception.
3. Snapshot patch recovery: make table-qualified visible snapshot recovery
   deterministic when the client patch base diverges.

## Step 0 - Registration And Baseline

- Scope: Register iteration, freeze plan, and capture baseline evidence.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0426-remote-session-snapshot-stability/plan.md`
  - `docs/iterations/0426-remote-session-snapshot-stability/resolution.md`
  - `docs/iterations/0426-remote-session-snapshot-stability/runlog.md`
- Verification:
  - `git diff --check`
  - `rg -n "0426-remote-session-snapshot-stability" docs/ITERATIONS.md docs/iterations/0426-remote-session-snapshot-stability`
  - sub-agent plan review
- Acceptance:
  - Iteration is registered as `Planned` before review.
  - Every plan review is recorded in `runlog.md` using the Review Gate Record
    template.
  - After three independent Approved reviews with no outstanding Change
    Requested items, update `docs/ITERATIONS.md` to `Approved`, then to
    `In Progress` immediately before runtime implementation starts.
- Rollback:
  - Revert only the iteration docs and registry row.

## Step 1 - Auth Session Persistence Contract

- Scope: Add tests that describe session behavior across process restart,
  expiry, tamper, missing persisted store, session mutation, and session
  deletion.
- Files:
  - `packages/ui-model-demo-server/auth.mjs`
  - `scripts/tests/test_0426_auth_session_persistence_contract.mjs`
- Verification:
  - New test fails before implementation for restart persistence.
  - New test also covers Matrix SSO attach/update, Matrix disconnect, logout,
    token deletion, secret mismatch, corrupt sealed records, and production
    missing-secret behavior.
  - Existing auth tests still pass:
    `node scripts/tests/test_0403_oidc_session_gateway.mjs`
- Acceptance:
  - The contract is precise enough that implementation cannot pass by keeping
    only in-memory `Map` state.
  - The contract cannot pass by persisting plaintext access/id/Matrix tokens.
- Rollback:
  - Remove the new test and restore the previous auth contract.

## Step 2 - Auth Session Persistence Implementation

- Scope: Implement sealed persisted session records under the configured
  runtime persistence root while keeping the browser cookie as an opaque session
  handle.
- Files:
  - `packages/ui-model-demo-server/auth.mjs`
  - server/runtime config docs if a new environment variable is needed
  - tests from Step 1
- Verification:
  - `node scripts/tests/test_0426_auth_session_persistence_contract.mjs`
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
  - local browser SSO sanity check when credentials/session are available
- Acceptance:
  - A newly issued session remains valid after reloading the auth module/process
    with the same runtime persistence root and secret.
  - Matrix SSO updates and disconnect/logout changes are durable across restart.
  - Persisted session data is not plaintext JSON token material.
  - Expired/tampered/corrupt sessions and records sealed with an old secret are
    rejected.
  - Production mode refuses insecure persistence if the sealing secret is
    missing; test mode may use an explicit test-only secret.
- Rollback:
  - Disable persisted session loading and fall back to in-memory sessions with
    test failure documenting the regression.

## Step 3 - Persisted Asset Readiness

- Scope: Make missing or temporarily unavailable slide-app asset manifests a
  bounded not-ready state and add deploy-time verification.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - relevant asset/runtime helper module
  - deploy/ops scripts used for cloud rollout
  - `scripts/tests/test_0426_persisted_asset_readiness_contract.mjs`
- Verification:
  - New readiness test covers missing manifest/root and healthy manifest.
  - New readiness test covers request paths that can initialize runtime state:
    snapshot/bootstrap, visible snapshot, SSE stream, runtime mode, and bus
    event dispatch.
  - `bash scripts/ops/check_runtime_baseline.sh`
  - Cloud deploy verification explicitly checks the deployed pod can read
    `/app/persisted-assets/manifest.v0.json`, using the project deploy script
    path selected for this repo (`scripts/deploy_cloud_app.sh`,
    `scripts/deploy_cloud_full.sh`, or the currently documented wrapper).
- Acceptance:
  - Missing asset state produces explicit not-ready response/log, not process
    crash.
  - Remote deployment waits for the manifest to be visible from the running pod
    before marking health complete.
- Rollback:
  - Revert readiness wrapper/deploy check while keeping runlog evidence of the
    unsafe gap.

## Step 4 - Snapshot Patch Recovery

- Scope: Harden frontend remote store recovery for
  `snapshot_patch_base_mismatch` with table-qualified visible refs.
- Files:
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - server snapshot/SSE helpers if the visible snapshot endpoint needs a small
    contract adjustment
  - `scripts/tests/test_0426_snapshot_patch_recovery_contract.mjs`
- Verification:
  - New test simulates mismatch and asserts visible-snapshot recovery using
    `visible_model_ref` entries that include both `table_id` and `model_id`.
  - New test asserts the recovery path does not call `profile=full`, a bare
    all-model `/snapshot`, or old `visible_model_id`/bare `model_id` recovery.
  - New test covers principal switch/session refresh so recovery cannot reuse a
    previous principal's `visibleModelRefs`, projection cache, or app table.
  - Existing snapshot tests:
    - `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
    - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
    - `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
- Acceptance:
  - Mismatch path clears stale loading, reloads only the active visible model
    refs for the currently authenticated principal, and resumes patch mode.
  - If active table-qualified refs are unavailable, recovery fails closed with a
    visible reset/retry state instead of widening snapshot scope.
  - No regression to all-model bootstrap for normal app switching.
- Rollback:
  - Revert frontend recovery changes while preserving tests as failing evidence.

## Step 5 - Local Integrated Verification

- Scope: Run deterministic tests and one local browser flow before cloud deploy.
- Files:
  - test evidence in `runlog.md`
- Verification:
  - New 0426 tests all pass.
  - Existing 0403/0414/0423/0425 tests pass.
  - Frontend build passes.
  - Browser: SSO/session state, desktop load, app open, and one app interaction.
- Acceptance:
  - Local indicators show app-ready latency and patch recovery evidence.
- Rollback:
  - Fix failed stage before continuing; do not deploy remote with failing local
    contract checks.

## Step 6 - Remote Deployment And Browser Verification

- Scope: Merge/deploy the validated version to the cloud UI Server stack and
  verify with real browser interaction.
- Files:
  - deployment runlog entries
  - any deploy script improvements from Step 3
- Verification:
  - Git state merged/pushed as requested at closeout.
  - Remote health checks pass.
  - Browser on `https://app.dongyudigital.com`:
    - SSO login reaches desktop;
    - reload after deploy keeps session;
    - Workspace Manager and slide-app open do not stick at loading;
    - To Do Board or another provider-owned app performs one successful action.
- Acceptance:
  - Remote behavior matches success criteria with timing numbers recorded.
- Rollback:
  - Use previous image/tag/source revision if the deployed version fails remote
    browser verification.

## Step 7 - Final Review And Closure

- Scope: Run final sub-agent review over code, docs, tests, and runlog.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0426-remote-session-snapshot-stability/*`
- Verification:
  - Final sub-agent decision is Approved or all blocking findings are fixed and
    re-reviewed.
  - `git status --short` is clean after commits/merges/deploy records.
- Acceptance:
  - Iteration status is updated to `Completed`.
  - User receives concise report with verification results and remaining
    residual risks.
- Rollback:
  - Keep branch unmerged if final review finds unresolved blocking issues.

## Notes

- Generated at: 2026-06-24
