---
title: "Iteration 0418-visible-snapshot-projection-latency Plan"
doc_type: iteration-plan
status: planned
updated: 2026-06-18
source: ai
iteration_id: 0418-visible-snapshot-projection-latency
id: 0418-visible-snapshot-projection-latency
phase: phase1
---

# Iteration 0418-visible-snapshot-projection-latency Plan

## Goal

Reduce UI model first-screen and post-load latency by changing the client-visible data surface from "all client-allowed models by default" to "bootstrap shell first, visible app models on demand, small patch updates after load".

This iteration builds on:

- 0414 `snapshot_patch` over SSE;
- 0415 frontend Projection Store;
- 0416 post-load patch size control and expensive derived-label gating;
- 0417 per-principal runtime isolation, local Input/Dialog state, and pending locks.

## Scope

In scope:

- Add a client-visible snapshot profile for bootstrap/home shell that includes only the minimum models and labels needed to render the Android-tablet desktop shell and app registry.
- Add an explicit visible-model fetch path for the currently opened slide app and other user-selected models.
- Make SSE `/stream` profile-aware so its initial event and later patches do not immediately reintroduce the old full snapshot path.
- Integrate frontend lazy hydration so opening a slide app loads its model if it was not present in the bootstrap snapshot.
- Preserve existing full snapshot behavior for recovery, diagnostics, and tests that explicitly request a full profile.
- Keep all business writes on the existing Model 0 / pin / bus path.
- Add deterministic tests for:
  - bootstrap snapshot size and model inclusion/exclusion;
  - on-demand visible model loading;
  - no secret/function-code leakage in both bootstrap and visible-model responses;
  - post-load patch behavior remaining small and principal-safe;
  - no outer scroll / inner scroll reachability in browser checks.
- Update runlog with measured local baseline and post-change metrics.

Out of scope:

- Replacing SSE with WebSocket.
- Changing Matrix/MQTT/MBR topic semantics.
- Changing UI model authoring syntax beyond documenting lazy-loading behavior.
- Remote/cloud deployment unless explicitly requested after local verification.
- Offline conflict resolution or collaborative multi-device editing.

## Invariants / Constraints

- `CLAUDE.md` is authoritative.
- The iteration must remain registered in `docs/ITERATIONS.md` before implementation.
- Phase 1 writes only iteration/docs artifacts; production code changes require an approved review gate.
- UI remains a projection of ModelTable, not a truth source.
- UI business events must enter through worker root Model 0 `(0,0,0)` system bus boundary.
- Per-principal runtime isolation from 0417 must not regress.
- Guest/no-login access remains read-only.
- Snapshot profile filtering must never be used to bypass authorization. Capability filtering and secret redaction apply before or together with profile filtering.
- Bootstrap profile must fail closed: if a model is not required for shell/app registry rendering, it is absent until explicitly loaded.
- Visible-model fetch must return only models allowed for the current principal and requested model IDs.
- Visible-model fetch must reject invalid, missing, unauthorized, or capability-disallowed model IDs with an observable error; it must not silently fall back to full snapshot.
- No compatibility fallback that silently expands bootstrap back to full snapshot. Full snapshot is allowed only for explicit `profile=full` or recovery paths with observable reason.
- 0418 execution may proceed only after a preflight proves the current working baseline passes the 0414/0415/0416/0417 targeted tests. `docs/ITERATIONS.md` status drift for prior iterations must be corrected where factual, or recorded as a blocking mismatch before implementation.
- Every implementation stage must check tier placement, model placement, data ownership, data flow, and data chain.
- Each implementation stage must be reviewed by a sub-agent using `codex-code-review`; all blocking findings must be fixed before continuing.

## Current Baseline

Measured on local `http://localhost:30900` before 0418 implementation:

- unauthenticated `/auth/me`: `401 not_authenticated`;
- guest `/snapshot`: about `604870` bytes;
- guest `/stream` first chunk: about `429ms` to first SSE chunk;
- visible snapshot contains about `47` models and `6528` labels;
- largest label in guest snapshot is `home_table_rows_json`, about `44170` bytes.

This means 0416/0417 improved post-load interaction mechanics, but first-screen bootstrap still transfers too much data.

## Design Decisions

### Snapshot profiles

The server exposes client-visible profiles:

- `full`: current filtered snapshot behavior, used for diagnostics and recovery.
- `bootstrap`: desktop shell, route state, app registry, and minimum page models only.
- `visible`: requested model IDs plus minimum shell state required to compose a focused app.

Default frontend startup uses `bootstrap`, not `full`.

The SSE stream uses the same profile model:

- startup connects to `/stream?profile=bootstrap`;
- after one or more app models are loaded, the client either reconnects or refreshes the stream subscription with the loaded `visible_model_id` set;
- the stream initial event and later `snapshot_patch` events are generated against that profile baseline, never against an implicit full snapshot baseline.

### Required bootstrap surface

Bootstrap must include:

- Model 0 minimal public/control labels needed by client routing and runtime status.
- Editor state model `-2` root shell labels needed for route, foreground app, task stack, app view mode, app registry, and page catalog.
- Desktop shell/page model(s) required to render the Android-tablet desktop.
- Workspace shell model(s) only when the current foreground route needs workspace composition.
- No function code, secrets, or hidden Matrix/management models.
- No app model bodies except the current foreground app when explicitly requested.

### Lazy visible model loading

When a user opens a slide app:

1. frontend updates local shell state as it does now;
2. frontend checks whether the app model exists in Projection Store/snapshot;
3. if missing, frontend calls the visible-model fetch path with the model ID;
4. frontend applies the returned snapshot patch/model replacement into Projection Store;
5. frontend records the model ID in the loaded visible-model set and keeps stream subscription profile-aware;
6. UI renders the app content from the loaded model.

### Patch behavior

After bootstrap, SSE still uses `snapshot_patch`.

- Normal business updates should patch only changed labels/cells.
- Bootstrap profile clients must not receive full model bodies unless they are visible or explicitly loaded.
- If recovery requires a full snapshot, the response must mark it as recovery/reset with a reason.

## Success Criteria

- `docs/ITERATIONS.md` contains 0418 with planned/approved/in-progress records during execution.
- A failing-before-implementation test proves the current default snapshot is full/heavy and that bootstrap profile is missing.
- A deterministic test proves `profile=bootstrap` is materially smaller than full and excludes non-visible app model bodies.
- A deterministic test proves `profile=visible&model_id=<id>` returns the requested allowed model while preserving redaction and principal filtering.
- A deterministic test proves invalid, missing, unauthorized, and capability-disallowed visible-model requests fail closed with observable errors.
- A deterministic test proves total startup path (`/snapshot?profile=bootstrap` plus `/stream?profile=bootstrap` initial event) does not include the old full snapshot body.
- A deterministic frontend test proves opening a missing app model triggers on-demand model fetch before rendering app content.
- Existing 0414/0415/0416/0417 contracts remain green.
- Local browser verification proves:
  - desktop loads from bootstrap profile;
  - app list is visible;
  - opening To Do Board lazily loads and renders content;
  - E2E color generator still updates;
  - input remains responsive;
  - no outer horizontal/vertical scroll, and checked inner scroll containers remain reachable.
- Runlog records before/after metrics for:
  - full snapshot bytes;
  - bootstrap snapshot bytes;
  - first app visible-model fetch bytes;
  - representative post-load patch bytes.
- Final sub-agent review is approved after all fixes.

## Review and Execution Policy

- Phase 1 creates/updates docs only.
- After this plan/resolution is written, a sub-agent must review it with `codex-code-review`.
- Phase 3 starts only after review approval.
- Each implementation step uses TDD:
  - write failing test;
  - verify expected failure;
  - implement minimal passing change;
  - run targeted regressions;
  - update runlog;
  - run sub-agent review;
  - fix until approved.
- Final review covers the full 0418 diff and verification evidence.

## Inputs

- Created at: 2026-06-18
- Iteration ID: `0418-visible-snapshot-projection-latency`
- Branch: `dropx/dev_0418-visible-snapshot-projection-latency`
