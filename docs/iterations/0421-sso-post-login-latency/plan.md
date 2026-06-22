---
title: "Iteration 0421 SSO Post Login Latency Plan"
doc_type: iteration-plan
status: completed
updated: 2026-06-23
source: ai
iteration_id: 0421-sso-post-login-latency
id: 0421-sso-post-login-latency
phase: completed
---

# Iteration 0421-sso-post-login-latency Plan

## Goal

Fix the SSO post-login delay where the browser returns to `/#/` but stays on `确认登录中 / 页面暂不可用` for tens of seconds before the tablet desktop appears.

## Problem Evidence

- Real Chrome after SSO callback showed:
  - `/snapshot?profile=bootstrap`: about `83426ms`
  - `/auth/me`: about `83586ms`
  - body during wait: `确认登录中 / 页面暂不可用`
- The same local service after warm-up showed:
  - `/auth/me`: about `6ms`
  - `/snapshot?profile=bootstrap`: about `0.57s`
- Isolated Bun cold measurement showed:
  - `createServerState`: about `1.6s`
  - bootstrap snapshot profile build: about `3ms`
- Therefore this iteration must not assume a single cause. It must add metrics that distinguish request queueing, principal runtime creation, SQLite/patch loading, snapshot build, and Matrix/runtime side activity.

## Scope

- In scope:
  - Keep `/auth/me` lightweight and independent from user runtime/snapshot initialization.
  - Make authenticated snapshot cold-start state explicit instead of leaving the page on generic `页面暂不可用`.
  - Preserve authenticated vs unauthenticated semantics: login failure must remain a failure, not a loading state.
  - Preserve per-principal runtime isolation.
  - Add timing evidence for the slow path and final browser-visible improvement.
  - Add deterministic tests for success, initializing, failure, and cross-principal isolation.
- Out of scope:
  - Replacing OIDC provider behavior.
  - Changing Matrix room/message semantics.
  - Changing ModelTable truth ownership or business-event bus routing.
  - Removing SSE or full snapshot recovery.

## Invariants / Constraints

- `/auth/me` only reports authentication/session state and must not create or wait for a principal runtime.
- A failed, missing, or stale session must never enter authenticated workspace `initializing`.
  Depending on the existing route policy it may return a guest/read-only snapshot or a clear auth failure, but it must not be treated as an authenticated principal.
- If an authenticated user's runtime is not ready, `/snapshot` may report a typed initialization state, but that state is not a ModelTable truth snapshot and must be visibly distinct.
- Runtime initialization coalescing must be keyed by authenticated principal/runtime key. No global shared promise may serve multiple principals.
- Runtime initialization must still build the user's runtime from ModelTable/system patches and persistence. No UI shortcut may become truth.
- If initialization fails, the failure must be surfaced as an initialization failure state and recorded in metrics/logs; the frontend must not spin forever.
- All formal UI business writes still go through the existing `/bus_event` / Model 0 path.

## Success Criteria

- Deterministic tests prove:
  - `/auth/me` does not create or wait for principal runtime initialization.
  - unauthenticated `/snapshot` remains guest/read-only or auth failure according to existing route policy, and never becomes authenticated `workspace_initializing`.
  - expired, invalid, or otherwise stale sessions remain guest/read-only or auth failure according to existing route policy, and never become `workspace_initializing`.
  - authenticated `/snapshot` can return explicit `workspace_initializing` quickly while that principal runtime is being prepared.
  - runtime initialization failure is visible and does not become infinite loading.
  - two principals do not share runtime initialization promises or snapshots.
- Real browser SSO post-login measurement records:
  - `/auth/me` timing;
  - first `/snapshot` response timing and status/body kind;
  - desktop-visible timing;
  - whether the final state is authenticated, initializing, failed, or desktop-ready.
- Target:
  - `/auth/me` stays below `500ms` in the normal post-login path.
  - first initialization response stays below `1000ms` when runtime is still cold.
  - no generic `页面暂不可用` is shown for a known authenticated initialization state.
  - warm desktop load remains comparable to 0420 or better.

## Metrics Required

Record at least these timing buckets in `runlog.md`:

- browser navigation start to first visible auth/session state;
- browser navigation start to desktop visible;
- `/auth/me` total response time;
- `/snapshot?profile=bootstrap` total response time;
- snapshot response kind: `snapshot`, `workspace_initializing`, `workspace_initialization_failed`, or auth failure;
- server timing for principal runtime ensure: queued/waited, create state, snapshot build;
- event-loop lag or request-dispatch delay if measurable.

## Review Requirements

- Each implementation stage must be reviewed by a sub-agent using `codex-code-review`.
- A stage cannot proceed until review findings are fixed or proven not applicable.
- Final review must explicitly check:
  - authentication failures are not hidden;
  - runtime isolation is still per principal;
  - snapshot truth semantics are not diluted;
  - metrics prove before/after change.
