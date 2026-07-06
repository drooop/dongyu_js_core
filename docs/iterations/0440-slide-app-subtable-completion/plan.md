---
title: "Iteration 0440 Slide App Subtable Completion Plan"
doc_type: iteration-plan
status: planned
updated: 2026-07-06
source: ai
iteration_id: 0440-slide-app-subtable-completion
id: 0440-slide-app-subtable-completion
phase: phase1
---

# Iteration 0440-slide-app-subtable-completion Plan

## Goal

Complete the four-part slide App subtable rollout requested on 2026-07-06:

1. migrate the remaining user-facing slide Apps, prioritizing high-use built-ins and RemoteWorker-provided Apps, from host positive-model presentation to principal-scoped App table presentation;
2. keep visible snapshot payloads scoped to the current App and the model closure required by that App's current view;
3. prove that two users visiting the same UI Server see only their own App tables and visible data;
4. update developer documentation so an external software worker can author and provide subtable-based slide Apps without reverse-engineering the current code.

0439 completed only the `To Do Board` slice. This iteration supersedes the narrower interpretation by treating all remaining user-facing slide Apps as the acceptance target.

## Scope

- In scope:
  - Treat these host positive models as source templates, not user-facing Workspace entries after migration:
    - `100` `E2E 颜色生成器`
    - `1007` `Three Scene`
    - `1011` `Static`
    - `1030` `滑动 APP 导入`
    - `1036` `Mgmt Bus Console`
    - `1050` `最小 Submit 双总线示例`
    - `1051` `工作区管理器`
    - `1080` `Matrix Suite`
    - `1081` `Settings`
    - `1082` `ModelTable`
    - `1083` `Matrix Chat`
    - `1086` `To Do Board`
  - Keep `Gallery` (`-103`) and `Docs` (`-23`) as non-slide system entries; they are not App table migration targets in this iteration.
  - Keep hidden/non-user-facing slide authoring models such as `1034` and `1037` as source assets unless they are already part of the visible Workspace entry list; they must not become newly visible just because this iteration generalized seeding.
  - Seed one App table per principal for every in-scope source template.
  - Preserve the source template host models for export/test fixtures and internal host logic, while removing them from user-facing Workspace allowlists.
  - Preserve provider-owned RemoteWorker install behavior; R1 bundles must still materialize as App tables through Workspace Manager.
  - Carry enough source metadata through the registry so frontend affordances that used to recognize `Matrix Chat`, `Settings`, or other source host ids can still recognize migrated App table instances.
  - Expand `profile=visible` for an App table root to include only the requested App table's reachable same-table model closure, not unrelated host positive models or other App tables.
  - Prove A/B principal isolation for the migrated App set: different table ids, separate host-side `model.subtableconnection` ownership, and 403 on cross-principal visible snapshot reads.
  - Update the slide App runtime developer guide with a practical subtable authoring checklist for built-in authors and external software workers.
- Out of scope:
  - Remote cloud deployment.
  - Replacing Matrix/OIDC behavior or credentials.
  - Redesigning the App UI.
  - Making hidden authoring/docs source models newly user-visible.
  - Adding shared/collaborative App table permissions between principals.
  - Deleting host source templates.

## Invariants / Constraints

- `model.subtable` is written on the child App table root.
- `model.subtableconnection` is written on the host/parent side.
- `pin.connect.model` remains forbidden.
- Durable cross-table references use table-qualified `ModelRef`.
- Host positive source templates may exist, but user-facing Workspace cards for in-scope slide Apps must point at `{ table_id: "app:...", model_id: 0 }`.
- Per-principal mutable App state is isolated by table namespace first, then by snapshot permission checks.
- UI remains a projection of ModelTable.
- Business events enter through the worker root Model 0 bus boundary or the generated host ingress boundary; no direct UI truth write may be introduced.
- Snapshot slimming must fail closed: if a table is not visible to the current principal, visible/bootstrap requests return denial instead of filtering silently.

## Success Criteria

- A RED contract proves the current 0439 baseline still leaves host positive source models exposed for at least one remaining in-scope App.
- After implementation:
  - Each in-scope source host model has exactly one user-facing App table root per principal.
  - The user-facing Workspace registry contains no in-scope host positive `model_id` entries.
  - Every migrated App table root has `model.subtable`, `slide_capable`, source metadata, `slid_in_source_host_model_id`, and a host-side `model.subtableconnection` with the correct owner principal.
  - `profile=visible` for a migrated App returns that App table's needed same-table model closure and no unrelated host positive model or other App table.
  - A/B principal tests show separate table ids for the same migrated Apps and reject cross-principal visible snapshot access with 403.
  - RemoteWorker provider-owned installation tests still pass, including R1 color/minimal submit/To Do provider bundle contracts.
  - Frontend registry/projection tests recognize migrated App table entries without relying on host `model_id` identity.
  - Browser verification opens representative migrated Apps from the local deployed UI: at minimum `Settings`, `ModelTable`, `Matrix Chat`, `工作区管理器`, `最小 Submit 双总线示例`, and `To Do Board`.
  - Developer docs include a concise external-worker recipe covering required labels, source metadata, host ingress/egress, provider-owned bundle response, principal-scoped App table materialization, snapshot expectations, and validation commands.

## Known Starting Evidence

- 0439 migrated only `To Do Board`.
- Direct export probing on 2026-07-06 showed most remaining built-ins can export once missing `from_user`, `to_user`, `source_de`, or summary metadata is normalized.
- `1050` already exports with `host_ingress_v1`.
- `1030` has `workspace.importer` surface and blank `from_user`/`to_user`; it needs normalized metadata before export.
- `1034` and `1037` are slide-capable but not in the current user-facing Workspace entry allowlist; they are not part of this iteration's visible migration target.

## Verification Summary

- Deterministic tests:
  - New 0440 contract test for full migrated App inventory, visible snapshot closure, and A/B isolation.
  - Existing 0439 To Do, 0436 snapshot, 0425 subtable/principal, 0412 R1 To Do provider, 0384 provider-owned install, and 0405 To Do behavior tests.
  - Frontend projection tests for table-qualified App identity and Matrix Chat foreground recognition after migration.
- Build:
  - `npm -C packages/ui-model-demo-frontend run build`
- Local runtime/browser:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - Browser fake-login opens representative migrated Apps and confirms their foreground ref is an App table root.

## Inputs

- Created at: 2026-07-06
- Iteration ID: 0440-slide-app-subtable-completion
- Branch: `dropx/dev_0440-slide-app-subtable-completion`
