---
title: "Iteration 0435 Visible Snapshot App Slimming Plan"
doc_type: iteration-plan
status: completed
updated: 2026-07-03
source: ai
iteration_id: 0435-visible-snapshot-app-slimming
id: 0435-visible-snapshot-app-slimming
phase: completed
---

# Iteration 0435-visible-snapshot-app-slimming Plan

## Goal

Reduce localhost App-open and post-load refresh latency by making explicit `profile=visible` snapshot requests app/model-scoped. When the frontend asks for one visible App table model, the server should return only that requested visible model/table plus sanitized config metadata, not the host bootstrap shell models that are already cached in the browser.

## Scope

- In scope:
- Tighten `buildClientSnapshotProfile(..., { profile: "visible" })` so explicit visible snapshot responses are target-only.
- Preserve `profile=bootstrap` behavior, including `profile=bootstrap&visible_model_id` and `profile=bootstrap&visible_model_ref` stream subscriptions that intentionally combine shell bootstrap with visible models.
- Preserve principal filtering, table access checks, secret filtering, and table-qualified refs.
- Update deterministic snapshot profile tests to prove the new boundary.
- Verify frontend lazy-load merge still keeps the existing desktop shell while adding the visible App table model.
- Record local browser metrics for:
  - bootstrap snapshot duration/bytes;
  - E2E visible snapshot duration/bytes;
  - E2E `Generate Color` end-to-end latency and `/bus_event` latency.
- Out of scope:
- Migrating additional `Slid in from DE` apps to subtable.
- Migrating Built-in apps to subtable.
- Reworking SSE patch protocol beyond what is needed to preserve the current bootstrap stream.
- Fixing Matrix/OIDC TLS initialization failures.
- Remote deployment.

## Invariants / Constraints

- UI remains a projection of ModelTable; no UI truth source is introduced.
- Business events still enter through the worker root Model 0 bus boundary.
- `model.subtable` / `model.subtableconnection` placement from 0431/0432 remains unchanged.
- `pin.connect.model` remains forbidden.
- `profile=full` remains diagnostic only and must not be requested by normal startup/App-open paths.
- Visible App table access remains principal-scoped; a user cannot fetch another principal's App table by guessing `table_id`.
- No compatibility fallback may silently restore broad visible snapshots for the optimized path.

## Success Criteria

- A failing-first deterministic test proves the current behavior: `profile=visible&visible_model_ref=<app-table-model0>` still includes host bootstrap models such as `-28` / `-2`.
- After implementation:
  - `profile=visible` returns the requested host model or App table model only, plus sanitized `v1nConfig`.
  - `profile=visible` does not include unrelated host bootstrap models.
  - `profile=bootstrap` still includes the shell models required for first paint.
  - `profile=bootstrap&visible_model_ref=<app-table-model0>` still includes shell bootstrap plus the requested App model for SSE initial snapshots.
  - Existing invalid/unauthorized visible target checks still fail closed.
  - Frontend visible lazy-load with `mergeWithCurrentModels` keeps already loaded shell models and adds the App table model.
- Local deployed browser verification shows the E2E App still opens and `Generate Color` changes color.
- Runlog records before/after metrics. Target improvement is directional for this iteration: E2E visible snapshot bytes should drop below the current ~44KB baseline; duration should be lower or, if still high, runlog must identify remaining non-size bottlenecks.
- Sub-agent code review approves each implementation stage or all actionable findings are fixed and re-reviewed.

## Inputs

- Created at: 2026-07-03
- Iteration ID: 0435-visible-snapshot-app-slimming
- Branch: `dropx/dev_0435-visible-snapshot-app-slimming`
- Baseline measured before this iteration:
  - HTTP root: ~2.5ms.
  - `bootstrap` snapshot: ~705-787ms, ~29KB.
  - E2E App table visible snapshot: ~718-782ms, ~44KB.
  - E2E `Generate Color`: ~3.54-3.74s end-to-end, `/bus_event` ~1.51-1.74s.
