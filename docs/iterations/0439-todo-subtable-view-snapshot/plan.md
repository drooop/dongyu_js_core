---
title: "Iteration 0439 To Do Subtable View Snapshot Plan"
doc_type: iteration-plan
status: planned
updated: 2026-07-06
source: ai
iteration_id: 0439-todo-subtable-view-snapshot
id: 0439-todo-subtable-view-snapshot
phase: phase1
---

# Iteration 0439-todo-subtable-view-snapshot Plan

## Goal

Migrate the high-use `To Do Board` slide App from host-table model `1086` presentation to a principal-scoped App table presentation, while preserving current App-open snapshot slimming, proving A/B user isolation for the migrated App, and updating the developer guide for subtable-based slide Apps.

## Scope

- In scope:
  - Treat `To Do Board` (`host|1086`) as the next migration target after `E2E 颜色生成器`.
  - Seed one `To Do Board` App table per current principal from the existing validated host model payload.
  - Present `To Do Board` in Workspace/Desktop as `{ table_id: "app:<principal>:...", model_id: 0 }`, not as `host|1086`.
  - Keep the original host model `1086` as the source template and test fixture while removing it from user-facing Workspace presentation.
  - Preserve `To Do Board` behavior: board/focus views, create/edit/move/filter actions, and route through Model 0 bus ingress.
  - Ensure `profile=visible` requests for the migrated App return only the requested App table/model body, not unrelated host positive models or other App tables.
  - Prove two different principals receive different seeded `To Do Board` App tables and cannot see each other's App instance table through snapshot projection.
  - Update developer documentation so external software workers can author or migrate slide Apps as App tables with `model.subtable` and host-side `model.subtableconnection`.
- Out of scope:
  - Migrating all remaining built-in slide Apps.
  - Changing remote-worker provider bundle protocol beyond keeping existing R1 To Do provider tests green.
  - Adding collaborative/shared App permissions.
  - Remote cloud deployment.
  - Rewriting To Do UI design or task semantics.

## Invariants / Constraints

- `model.subtable` remains the child App table root declaration.
- `model.subtableconnection` remains the host/parent-side relationship index.
- `pin.connect.model` remains forbidden.
- Durable cross-table App references must use table-qualified `ModelRef`.
- Host positive model `1086` may remain a source template, but must not remain the user-facing Workspace entry after migration.
- Per-principal App state must be isolated by table namespace first, then filtered by snapshot permissions.
- Frontend lazy-load snapshot requests must remain target-only for App open.
- UI remains projection of ModelTable; no direct UI truth write may be introduced.

## Success Criteria

- A RED test proves current behavior still exposes `To Do Board` as host `1086` or lacks a principal-scoped App table entry.
- After implementation:
  - `To Do Board` appears exactly once for a principal as a non-host App table root `{ table_id, model_id: 0 }`.
  - `host|1086` is absent from user-facing Workspace registry.
  - The App table root declares `model.subtable`, keeps `slide_capable`, and preserves To Do UI/action labels.
  - The host connection cell has exactly one `model.subtableconnection` for the App table with `root_model_id: 0`, `mount_kind: "slide_app"`, and the correct `owner_principal_id`.
  - A second principal gets a separate `To Do Board` App table and sees only its own table in `bootstrap`/`visible` snapshots.
  - `profile=visible` for the migrated To Do App returns only that App table/model body.
  - Existing To Do behavior tests, provider-owned R1 To Do bundle tests, subtable install tests, visible snapshot tests, and app-open frontend tests pass.
  - Local deployed UI can open the migrated `To Do Board` and perform at least one task interaction.
  - Developer docs describe the subtable authoring/migration path and current-view snapshot expectation.

## Risks

- The host `1086` tests currently encode host-model mount and allowlist assumptions; those tests must be updated without losing To Do behavior coverage.
- The existing seeded-subtable logic is color-generator-specific; generalizing it must not duplicate existing App tables or cross-link owners.
- Snapshot filtering can hide a table correctly while mutable state still leaks if the same App table is reused; the principal-scoped test must check table identity and visibility.
- Browser-visible behavior may depend on local runtime persistence; verification must redeploy local UI before browser claims.

## Verification Summary

- Deterministic tests:
  - New `0439` To Do subtable contract test.
  - Existing To Do, provider, subtable, snapshot, and app-open contract tests.
- Build:
  - Frontend build if frontend model ids/projection tests change.
- Local runtime:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Browser:
  - Fake-login local session opens `To Do Board`, observes App table `model 0`, and performs one task change.

## Inputs

- Created at: 2026-07-06
- Iteration ID: 0439-todo-subtable-view-snapshot
- Branch: `dropx/dev_0439-todo-subtable-view-snapshot`
