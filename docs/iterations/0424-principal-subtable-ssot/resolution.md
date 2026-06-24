---
title: "Iteration 0424 Principal-Scoped Subtable SSOT Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-06-23
source: ai
iteration_id: 0424-principal-subtable-ssot
id: 0424-principal-subtable-ssot
phase: completed
---

# Iteration 0424-principal-subtable-ssot Resolution

## Execution Strategy

This is a docs-only SSOT iteration. Do not change runtime behavior in this iteration.

Work in small stages:

1. create the iteration and SSOT skeleton;
2. freeze the principal/table/model reference contract;
3. add narrow cross references to existing SSOT docs;
4. run consistency checks and sub-agent review;
5. fix all review findings before reporting.

## Phase 1: Iteration Registration And Conflict Map

Scope:

- Register `0424-principal-subtable-ssot`.
- Create `plan.md`, `resolution.md`, and `runlog.md`.
- Identify current SSOT files that need either direct updates or explicit cross references.

Files:

- `docs/ITERATIONS.md`
- `docs/iterations/0424-principal-subtable-ssot/plan.md`
- `docs/iterations/0424-principal-subtable-ssot/resolution.md`
- `docs/iterations/0424-principal-subtable-ssot/runlog.md`

Verification:

- `rg -n "0424-principal-subtable-ssot|model\\.subtable|table_id|ModelRef|PrincipalRef" docs/ITERATIONS.md docs/iterations/0424-principal-subtable-ssot docs/ssot`

Acceptance:

- Iteration exists and is registered.
- Plan does not contain implementation code.
- Resolution names every SSOT file that may need updating.

## Phase 2: New Namespace SSOT

Scope:

- Add a new SSOT document for principal-scoped subtable namespaces.
- Define canonical terms and reference shapes.
- Define host table, user desktop table, and app instance subtable.
- Define how negative system models are shared and how positive model ids become table-local.
- Define mount, PIN, snapshot, payload, import/export, and SSO isolation consequences.

Files:

- `docs/ssot/principal_scoped_subtable_namespace_v1.md`
- `docs/iterations/0424-principal-subtable-ssot/runlog.md`

Verification:

- `rg -n "pin\\.connect\\.model|model\\.submt.*alias|soft filter|best effort" docs/ssot/principal_scoped_subtable_namespace_v1.md`
- Manual check that every required section exists.

Acceptance:

- The document is self-contained.
- It explicitly says `model.subtable` is not `model.submt`.
- It requires table-qualified durable references.
- It distinguishes implemented current behavior from target follow-up behavior.

## Phase 3: Existing SSOT Cross-References

Scope:

- Update existing SSOT docs with minimal, non-duplicative references to the new authority.
- Register `model.subtable` in label registry as target label type.
- Add table-qualified notes to snapshot and payload sections.
- Add cross-table PIN boundary notes to PIN contract and imported slide app contract.
- Align the higher-priority architecture SSOT so it acknowledges table-qualified `ModelRef` and `model.subtable` target semantics.

Files:

- `docs/architecture_mantanet_and_workers.md`
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/ssot/label_type_registry.md`
- `docs/ssot/pin_connection_contract_v2.md`
- `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
- `docs/ssot/temporary_modeltable_payload_v1.md`
- `docs/iterations/0424-principal-subtable-ssot/runlog.md`

Verification:

- `rg -n "principal_scoped_subtable_namespace_v1|model\\.subtable|table-qualified|table_id|ModelRef|PrincipalRef" docs/architecture_mantanet_and_workers.md docs/ssot`
- `rg -n "pin\\.connect\\.model.*current|model\\.subtable.*alias|model\\.submt.*subtable" docs/ssot`

Acceptance:

- Existing docs point to the new SSOT instead of restating divergent rules.
- No doc describes `pin.connect.model` as current input.
- No doc describes `model.subtable` as `model.submt` alias.

## Phase 4: Review And Fix

Scope:

- Run deterministic text checks.
- Dispatch sub-agent review with `codex-code-review`.
- Fix every `CHANGE_REQUESTED` finding.
- Record final review decision in runlog.

Files:

- All changed docs in this iteration.

Verification:

- `git diff -- docs/ITERATIONS.md docs/iterations/0424-principal-subtable-ssot docs/ssot`
- `rg -n "model\\.subtable|table_id|ModelRef|PrincipalRef|pin\\.connect\\.model" docs/ITERATIONS.md docs/iterations/0424-principal-subtable-ssot docs/ssot`

Acceptance:

- Sub-agent review returns `Decision: APPROVED`.
- Runlog records commands and review outcome.

## Rollback

Revert only this iteration's docs:

- `docs/iterations/0424-principal-subtable-ssot/`
- `docs/ssot/principal_scoped_subtable_namespace_v1.md`
- 0424 row in `docs/ITERATIONS.md`
- short cross-reference edits in existing SSOT docs
