---
title: "Iteration 0425 Principal-Scoped Subtable Implementation Plan"
doc_type: iteration-plan
status: completed
updated: 2026-06-24
source: ai
iteration_id: 0425-principal-subtable-impl
id: 0425-principal-subtable-impl
phase: completed
---

# Iteration 0425-principal-subtable-impl Plan

## Goal

Implement the first runtime slice of the 0424 SSOT: table-qualified model references, `visibleModelRefs`, principal-scoped desktop state, and child ModelTable boundaries for installed slide App instances.

## Done Criteria

- `ModelRef = { table_id, model_id }` is accepted and normalized at snapshot/profile, SSE, frontend visible subscription, projection-cache, renderer read, and payload/reply-target boundaries.
- Existing host-table behavior is represented as explicit `table_id: "host"` inside the runtime boundary, not as a new compatibility alias.
- Runtime model storage keys, parent/child maps, table mount maps, and PIN route graph keys are table-qualified where App/User tables can appear; old global positive `model_id` lookup cannot be used for App instance or user desktop tables.
- `pin.connect.cell` remains intra-table only; cross-table traffic is represented only through host-owned `model.subtable` hosting Cells and child table root boundary pins.
- Persistence keys touched by new user desktop/App instance table writes include `table_id`; 0425 does not migrate every historical record, but all new or modified 0425 durable user/App table records must avoid global positive `model_id` collision.
- `visibleModelRefs` can request model bodies by table and model id; unauthorized table refs are rejected or filtered before diffing; bare `visible_model_id` is not used by new 0425 paths.
- Snapshot patches and local projection cache keys can distinguish `{table_id:"app:A", model_id:1}` from `{table_id:"app:B", model_id:1}`.
- Principal/capability changes reset the matching snapshot/SSE baseline so a previous principal's projection cannot be reused.
- SSO principal data separation is represented at the desktop state boundary: user-visible mutable shell state is scoped by principal and does not share foreground/task-stack state across users.
- Temporary ModelTable payloads and reply targets carry table-qualified `origin_table_id` / `reply_target_table_id` metadata on App instance traffic.
- Imported slide App installation creates a child table boundary and materializes package-local records into an App instance table; package-local ids are not globally remapped in the new path.
- Same provider App installed twice, or installed by two principals, must produce different App instance tables and non-shared mutable App-local state.
- Living docs that own PIN routing, model type registry, runtime semantics, temporary payloads, and developer usage are reviewed/updated or explicitly recorded as unchanged with reason in `runlog.md`.
- Developer/user-facing examples touched by installed slide App `model_id`, `origin_model_id`, `reply_target_model_id`, `visible_model_id`, or `get_current_model_id` are updated to table-qualified wording, or explicitly recorded as follow-up debt if outside 0425 scope.
- Each implementation stage has a sub-agent `codex-code-review` result recorded in `runlog.md`; all `CHANGE_REQUESTED` items are fixed before the next stage.
- Final verification includes deterministic tests, local stack restart/redeploy evidence, snapshot/SSE payload evidence, and local browser validation with two principals.

## Non-Goals

- Remote deployment.
- Data migration for existing production installed App instances.
- Full persistence schema split for every historical runtime table record.
- Reintroducing `pin.connect.model` or a `model.submt` compatibility alias.
- Allowing child tables to directly mutate host negative models.
- Implementing collaborative/shared App state between principals.

## Implementation Scope Summary

The detailed execution source is `resolution.md`; this `plan.md` only records WHAT/WHY and acceptance boundaries.

The implementation covers:

- table-qualified reference normalization and current-table context;
- runtime and persistence table namespaces for new user desktop and App instance table writes;
- backend snapshot/profile/SSE filtering by authorized `visibleModelRefs`;
- frontend projection, renderer, and local cache keys that distinguish table-qualified labels;
- table-qualified payload origin/reply target metadata for App instance traffic;
- principal-scoped desktop state;
- slide App instance install/export semantics that preserve package-local ids inside the App instance table;
- living-doc and developer example cleanup where bare installed `model_id` would otherwise be taught.

## Review Policy

Every stage must call a sub-agent with `codex-code-review`. The review must check:

- conformance with `CLAUDE.md`;
- no direct UI business writes bypassing Model 0 / pin / mt_* paths;
- no legacy `pin.connect.model`;
- no `model.submt` / `model.subtable` aliasing;
- no soft-only user isolation;
- tests prove the new table-qualified path, not just old bare `model_id` behavior.
