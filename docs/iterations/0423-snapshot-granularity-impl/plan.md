---
title: "Iteration 0423 Snapshot Granularity Implementation Plan"
doc_type: iteration-plan
status: approved
updated: 2026-06-23
source: ai
iteration_id: 0423-snapshot-granularity-impl
id: 0423-snapshot-granularity-impl
phase: execution
---

# Iteration 0423-snapshot-granularity-impl Plan

## Goal

Implement and locally verify the approved snapshot granularity design:

- make first-screen `bootstrap` snapshot smaller and stricter;
- keep app/model bodies out of first paint;
- lazy-load app/model bodies with `visible` profile;
- keep post-load updates incremental through profile-scoped `snapshot_patch`;
- measure local OrbStack latency and payload metrics.

## Source Design

The detailed design is maintained in:

- `docs/plans/2026-06-23-snapshot-granularity-design.md`

The design review gate passed by sub-agent with `Decision: APPROVED`.

## Scope

In scope:

- Local-only implementation and verification.
- Snapshot profile size instrumentation.
- Strict `bootstrap` allowlist and compact app index.
- App/model body lazy loading through `visible` profile.
- Frontend projection-cache usage where it directly reduces render/update scope.
- Profile-scoped patch/recovery hardening.
- Local OrbStack deployment and real browser measurement.
- Iteration runlog evidence and metrics.

Out of scope:

- Remote deployment.
- SSO/OIDC behavior changes.
- Matrix/MQTT routing changes.
- Replacing SSE.
- JS bundle splitting, except for recording it as a metric.
- New query/subscription protocol.

## Invariants / Constraints

- ModelTable remains the truth source.
- UI remains projection only.
- Startup, app opening, SSE recovery, patch mismatch recovery, and oversize fallback must not request `profile=full`.
- `full` is explicit human-triggered diagnostics only.
- Patch recovery must preserve the exact profile key, including the sorted `visible_model_id` set.
- Guest/read-only/authenticated permissions must stay fail-closed.
- Local transient UI state may be browser-local only when it is not formal shell/workspace/business state.
- Workspace Manager install/remove updates compact app index without placing app bodies into `bootstrap`.

## Success Criteria

- Deterministic tests prove startup does not request bare `/snapshot` or `profile=full`.
- Deterministic tests prove `bootstrap` excludes positive app model bodies and known heavy labels.
- Deterministic tests prove first open of an app fetches `visible&model_id=<id>`.
- Deterministic tests prove patch mismatch recovery keeps the same visible model id set.
- Deterministic tests prove Workspace Manager install/remove updates compact app index and keeps app bodies lazy.
- Deterministic tests prove guest/read-only/authenticated permission matrix for `bootstrap`, `app_index`, `visible`, `full`, install, remove, and open actions.
- Local browser measurement records:
  - desktop shell visible time;
  - app list visible time;
  - bootstrap bytes and duration;
  - first app visible snapshot bytes and duration;
  - representative post-load patch bytes;
  - whether any `full` request occurred;
  - outer scroll state.
- Local bootstrap snapshot target:
  - `<= 90KB`, or
  - `<= 60%` of the pre-change local baseline with a contributor report for every remaining contributor above `10KB`.

## Review Policy

Each implementation phase must end with:

- deterministic verification;
- runlog evidence;
- sub-agent review using `codex-code-review`;
- fixes for every `CHANGE_REQUESTED` finding before moving to the next phase.

After all phases complete, run one overall sub-agent review and fix all findings before final reporting.
