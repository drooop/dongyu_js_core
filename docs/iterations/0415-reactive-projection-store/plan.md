---
title: "Iteration 0415 — Reactive Projection Store Plan"
doc_type: iteration-plan
status: planned
updated: 2026-06-18
source: ai
iteration_id: 0415-reactive-projection-store
id: 0415-reactive-projection-store
phase: phase1
---

# Iteration 0415 — Reactive Projection Store Plan

## Metadata

- ID: `0415-reactive-projection-store`
- Date: 2026-06-10
- Branch: `dropx/dev_0415-reactive-projection-store`
- Status: Approved for local prototype by user request
- Depends on:
  - `0412-app1-todo-latency-debug`
  - `0414-snapshot-delta-sse`

## Goal

Build a local, tested prototype of a Vue-like reactive projection layer for ModelTable UI rendering. Normal label changes should update label-level reactive atoms first, while full snapshot remains the recovery and bootstrap layer.

## Problem

0414 reduced transport size for small updates by introducing `snapshot_patch`, but the frontend still treats `snapshot.models` as the dominant state object. That means UI invalidation can remain wider than the actual label change, and future scoped projection work would still need a more granular frontend store.

## Invariants

- ModelTable remains the only business truth.
- UI remains projection only.
- Full `/snapshot` remains mandatory for bootstrap, reconnect, auth/capability reset, and patch recovery.
- `snapshot_patch` cannot bypass principal/capability filtering.
- No compatibility alias or legacy data path is added.
- Existing `store.snapshot` API must continue to work during the prototype, so current screens do not break.

## Scope

In scope:

- Add a frontend `ProjectionStore` that maps `model_id/p/r/c/k` to reactive label atoms.
- Hydrate the projection store from full snapshots.
- Apply 0414 `snapshot_patch` ops to the projection store.
- Let renderer effective label reads use the projection store when available.
- Add deterministic tests proving label-level atom identity is stable across unrelated changes and only relevant label values update.
- Deploy locally and verify the existing UI still loads.

Out of scope:

- Server-side scoped subscription protocol.
- Removing full snapshot.
- Rewriting Matrix Chat, Workspace shell, or Docs to scoped queries.
- Changing ModelTable fill-table syntax.

## Success Criteria

- Deterministic tests prove:
  - full snapshot hydrates label atoms;
  - `replace_label` updates the same label atom without recreating unrelated atoms;
  - `delete_label`, `replace_cell`, `delete_cell`, `replace_model`, `delete_model`, and `replace_v1n_config` update projection state correctly;
  - renderer reads effective label values from Projection Store while overlay semantics still win;
  - existing 0414 patch contract remains green.
- Local deployment succeeds.
- Real browser opens `http://localhost:30900/#/` and existing shell renders without outer scroll regression.
- At least one representative existing app path is exercised in browser after deploy.

## Risk

- Renderer may accidentally subscribe too broadly if it still reads full `snapshot.models`.
- Projection Store can diverge from snapshot if patch and full snapshot paths are not applied together.
- Deep reactive atoms can increase memory usage if scope unload is not added later.

## Decision

Proceed with a conservative local prototype: keep full snapshot as source-of-recovery, add label-level projection atoms as the normal read path for renderer-bound labels, and validate with tests before local deploy.
