---
title: "Iteration 0424 Principal-Scoped Subtable SSOT Plan"
doc_type: iteration-plan
status: completed
updated: 2026-06-23
source: ai
iteration_id: 0424-principal-subtable-ssot
id: 0424-principal-subtable-ssot
phase: completed
---

# Iteration 0424-principal-subtable-ssot Plan

## Goal

Freeze the SSOT contract for principal-scoped subtable namespaces:

- negative system models remain shared host capabilities;
- each SSO principal has isolated user desktop state;
- each installed slide App instance owns an isolated positive model namespace;
- all durable model references that cross a boundary become table-qualified.

## Why

The current positive `model_id` space is global inside the UI Server runtime. That makes imported slide Apps, user desktop state, foreground app state, snapshot visibility, and reply targets easy to mix when:

- multiple SSO users access `https://app.dongyudigital.com/` at the same time;
- the same user installs the same slide App more than once;
- different users install the same provider-owned slide App;
- app-local `model_id = 0` or `model_id = 1` needs to mean different things in different installed app instances.

The target contract must separate identity, table namespace, and model id before runtime implementation starts.

## Scope

In scope:

- a new SSOT document that defines `table_id`, `ModelRef`, `PrincipalRef`, host table, user desktop table, and installed App table;
- clear distinction between existing `model.submt` and new subtable mounting semantics;
- alignment of the higher-priority architecture SSOT where it previously described only global bare `model_id` and omitted `model.subtable`;
- SSOT cross references in runtime semantics, label registry, PIN connection contract, imported slide app ingress/egress, and temporary payload docs;
- explicit snapshot/SSE, import/export, payload/topic, and SSO data-isolation consequences;
- sub-agent review and fixes before reporting.

Out of scope:

- runtime implementation;
- persistence schema migration;
- browser verification;
- remote deployment;
- backfilling existing installed app data;
- compatibility aliases for old unqualified app-local positive model references.

## Invariants

- `model.submt` keeps its current meaning: a hosting Cell mounts one child model.
- `model.subtable` is a new semantic label type for mounting a child model table namespace; it is not an alias of `model.submt`.
- `pin.connect.cell` remains intra-table only.
- `pin.connect.model` remains removed and must not be restored.
- Cross-table routing can only cross through a host-owned boundary: host table Cell -> subtable root -> subtable-internal pins -> subtable root -> host table Cell.
- Negative system models are host/system capabilities. A subtable cannot directly mutate host negative models; it can only use host-exposed pins/capabilities.
- Positive and zero model ids are table-local after this contract. Durable identity is `ModelRef = { table_id, model_id }`.
- User-visible mutable shell state must be scoped to a current SSO principal.
- Temporary ModelTable payload remains non-materialized until an approved receiver explicitly materializes it.

## Success Criteria

- New SSOT states the target model clearly enough to guide implementation without relying on chat context.
- Existing SSOT docs do not contain a current-rule conflict with the new contract.
- Docs clearly say which terms are current implemented behavior and which terms are target contract for follow-up implementation.
- Review verifies there is no accidental restoration of legacy `pin.connect.model`, no overloading of `model.submt`, and no soft-only user isolation by label filtering.
- Runlog records the review and any fixes.

## Review Policy

This iteration requires sub-agent review using `codex-code-review`.

Review must check:

- terminology consistency;
- no conflict between runtime semantics, label registry, PIN contract, import contract, and temporary payload docs;
- whether implementation follow-up boundaries are explicit enough;
- whether user data isolation is hard namespace isolation, not just best-effort filtering.
