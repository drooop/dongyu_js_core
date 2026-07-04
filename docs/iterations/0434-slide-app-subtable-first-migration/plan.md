---
title: "Iteration 0434 Slide App Subtable First Migration Plan"
doc_type: iteration-plan
status: planned
updated: 2026-07-03
source: ai
iteration_id: 0434-slide-app-subtable-first-migration
id: 0434-slide-app-subtable-first-migration
phase: phase1
---

# Iteration 0434-slide-app-subtable-first-migration Plan

## Goal

Move the first current `Slid in from DE` workspace app, `E2E 颜色生成器`, from host-table positive model presentation to an installed App table presentation, proving the current subtable mechanism can carry existing slid-in apps one app at a time.

## Scope

- In scope:
  - Select `E2E 颜色生成器` (`host|100`) as the first migration target.
  - Ensure the desktop `Slid in from DE` section presents the migrated app as `{ table_id, model_id: 0 }` from a child App table, not as host model `100`.
  - Ensure the child App table root carries `model.subtable`, `slide_capable`, app metadata, and the imported app labels needed to render and open the app.
  - Ensure the host table carries exactly one parent-side `model.subtableconnection` for the migrated app table, with strict value shape `{ table_id, root_model_id: 0, mount_kind, owner_principal_id? }`.
  - Remove `host|100` from the user-facing workspace app allowlist/registry contracts so the old host-table presentation cannot keep passing as a valid app.
  - Update old tests that explicitly expected `host|100` as a workspace app entry to expect the new table-qualified App table entry.
  - Preserve the source/provider model used by RemoteWorker R1; this iteration migrates UI Server presentation/mounting, not R1's provider implementation.
  - Add deterministic tests that fail if `E2E 颜色生成器` remains registered as a host-table slid-in workspace app.
- Out of scope:
  - Migrating other `Slid in from DE` apps.
  - Migrating Built-in apps.
  - Changing bus topic semantics, provider bundle protocol, or `pin.connect.*` rules.
  - Remote deployment.

## Invariants / Constraints

- `model.subtable` is a child ModelTable root declaration and is written on the child App table Model 0 `(0,0,0)`.
- `model.subtableconnection` is a parent-side host index and is written in the host table; it is not a pin wiring label.
- `pin.connect.model` remains forbidden.
- Cross-table linkage must go through the host-side subtable connection boundary; `pin.connect.cell` remains same-table only.
- UI remains projection of ModelTable. The desktop registry must be derived from ModelTable labels and table-qualified refs.
- No compatibility fallback should preserve host-table registration for the migrated `E2E 颜色生成器`.
- Existing dirty worktree content must not be reverted.

## Success Criteria

- A failing-first test proves that the current registry still exposes `E2E 颜色生成器` as `host|100`.
- After implementation, the same test proves:
  - `E2E 颜色生成器` appears in `ws_apps_registry` as a non-host `table_id` with `model_id: 0`.
  - `host|100` is no longer present as a workspace app entry.
  - The child table root has `model.subtable`.
  - The host table has one matching `model.subtableconnection` whose value includes `root_model_id: 0`, `mount_kind: "slide_app"`, and a safe non-empty `table_id`.
  - The connection Cell carries only the `model.subtableconnection` label plus allowed boundary pins; it does not carry app business labels.
- Existing host-table tests that previously expected `host|100` are updated so they reject host-table workspace registration and accept only the table-qualified app entry for `E2E 颜色生成器`.
- Existing subtable install/runtime tests still pass.
- Frontend build passes if frontend projection or shared model IDs are changed.
- Local deployed UI opens and shows the migrated app from the desktop without hanging on "正在加载滑动 APP...".
- Browser/snapshot evidence proves the selected `E2E 颜色生成器` ref is non-host `{ table_id, model_id: 0 }`, not merely that some child table exists.
- A sub-agent code review approves the implementation slice or all actionable findings are fixed and re-reviewed.

## Inputs

- Created at: 2026-07-03
- Iteration ID: 0434-slide-app-subtable-first-migration
- Branch: `dropx/dev_0434-slide-app-subtable-first-migration`
