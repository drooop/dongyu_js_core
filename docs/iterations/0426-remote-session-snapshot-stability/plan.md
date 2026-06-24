---
title: "Iteration 0426 Remote Session Snapshot Stability Plan"
doc_type: iteration-plan
status: completed
updated: 2026-06-24
source: ai
iteration_id: 0426-remote-session-snapshot-stability
id: 0426-remote-session-snapshot-stability
phase: completed
---

# Iteration 0426-remote-session-snapshot-stability Plan

Status: Completed

## Goal

Fix the stability gaps exposed by the 0425 remote rollout so a user who has
completed SSO can keep using the deployed app across UI Server restarts, app
asset readiness windows, and snapshot patch stream mismatches.

The target user-visible result is simple: after a cloud deployment or pod
restart, the browser should either remain logged in and reach the desktop/app
normally, or show a bounded recoverable loading/error state. It must not silently
lose the session, leave an app stuck at "正在加载滑动 APP...", or crash the
server because a persisted asset file is temporarily unavailable.

## Scope

- In scope:
  - Persist or seal SSO session state so `dy_session` survives UI Server process
    restarts and cloud rollout pod replacement.
  - Add a readiness/error boundary for persisted slide-app assets so missing
    manifests or asset roots return an explicit recoverable state instead of an
    uncaught exception.
  - Harden snapshot patch recovery for table-qualified `visibleModelRefs`: when
    the client receives a patch whose base does not match local state, it must
    fetch the correct visible snapshot and resume patch mode without requiring a
    full page relogin.
  - Record latency and payload indicators before/after the fix, especially:
    `/auth/me`, bootstrap snapshot, visible app load, first app ready, and patch
    recovery path.
  - Verify the final build with automated checks and real browser interaction
    against the remote deployment.
- Out of scope:
  - Changing the principal-scoped subtable semantics frozen in 0424/0425.
  - Reworking Matrix Chat, To Do Board features, or UI visual design.
  - Implementing a new global snapshot architecture beyond the recovery and
    stability fixes needed here.
  - Changing the external SSO provider or creating new ZITADEL users.

## Invariants / Constraints

- `CLAUDE.md` remains the execution authority.
- No runtime code change starts before this plan is reviewed and approved.
- ModelTable remains the source of truth; UI state is only projection or local
  pending state unless explicitly materialized.
- The 0424 table namespace contract remains intact:
  - negative model ids are shared host/system capability references;
  - positive model ids are scoped by `table_id`;
  - cross-table flow must pass through host boundaries, not revive
    `pin.connect.model`.
- Snapshot/SSE must keep using table-qualified refs for foreground app state.
- Authentication fixes must not write secrets to the repo and must not expose
  access tokens in frontend-visible payloads.
- Persisted auth records must be sealed with a configured server-side secret.
  Production must fail closed when the required secret is absent; secret
  rotation or corrupt sealed records must reject old sessions instead of
  accepting unsafe plaintext fallback.
- Failure handling must be explicit: bounded 401/403/503 or visible recovery
  state is acceptable; silent crash/restart loops are not.
- Remote deployment must not use forbidden host operations from `CLAUDE.md`
  (`systemctl`, CNI/firewall mutation, etc.).

## Success Criteria

- SSO session persistence:
  - A session created before UI Server process restart remains valid after
    restart, subject to normal expiry.
  - Session mutations are persisted, including Matrix SSO token attach/update,
    Matrix disconnect, logout, and session deletion.
  - Corrupt, expired, or tampered persisted sessions are rejected cleanly.
  - Persisted records are not plaintext token material, and production mode does
    not silently enable insecure persistence when the sealing secret is missing.
  - `/auth/me` after restart returns the same principal without forcing relogin.
- Persisted asset readiness:
  - Missing `persisted-assets/manifest.v0.json` or missing asset root does not
    crash UI Server.
  - Runtime entrypoints that can trigger model/app initialization, including
    snapshot, SSE stream, runtime mode, and bus event paths, return an explicit
    not-ready response or close with a bounded not-ready event that the frontend
    can render and retry.
  - Deployment verification checks that the remote pod can see the asset
    manifest before declaring rollout complete.
- Snapshot patch recovery:
  - A forced `snapshot_patch_base_mismatch` recovers by fetching the current
    visible snapshot for the active principal and table-qualified
    `visibleModelRefs`.
  - Recovery must not request `profile=full`, a bare all-model `/snapshot`, or
    any previous user's visible refs. If table-qualified visible refs are not
    available, the client must fail closed with a visible reset/retry state.
  - The app leaves "正在加载滑动 APP..." and reaches ready state after recovery.
- User/browser verification:
  - Remote SSO login as the test user reaches the desktop.
  - Open Workspace Manager, install/open a provider-owned slide app, open
    To Do Board, and run one interactive action without stale loading.
  - Reload the browser after remote rollout/restart and confirm the session is
    still recognized.
- Evidence:
  - Runlog records command outputs, browser checkpoints, timing numbers, and
    sub-agent review decisions.

## Inputs

- Created at: 2026-06-24
- Iteration ID: 0426-remote-session-snapshot-stability
- Branch: `dropx/dev_0426-remote-session-snapshot-stability`
- Upstream baseline: `dev` at 0425 completion
- Related iterations:
  - `0414-snapshot-delta-sse`
  - `0418-visible-snapshot-projection-latency`
  - `0421-sso-post-login-latency`
  - `0423-snapshot-granularity-impl`
  - `0424-principal-subtable-ssot`
  - `0425-principal-subtable-impl`
