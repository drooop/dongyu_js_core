---
title: "Iteration 0431 Subtable Connection SSOT Correction Plan"
doc_type: iteration-plan
status: completed
updated: 2026-07-01
source: ai
iteration_id: 0431-subtable-connection-ssot
id: 0431-subtable-connection-ssot
phase: complete
---

# Iteration 0431-subtable-connection-ssot Plan

## Goal

Correct the project SSOT for child ModelTable / child model relationship
labels: `model.subtable` and `model.submt` are child-side declarations, while
`model.subtableconnection` and `model.submtconnection` are parent-side index
labels that maintain the parent/child or main/secondary relationship.

## Scope

- In scope:
  - Update `CLAUDE.md` because it is the highest repo-local execution
    constraint and currently contains the old placement semantics.
  - Update `docs/architecture_mantanet_and_workers.md` because it is the
    high-priority architecture SSOT and must not keep the old placement
    semantics.
  - Reassess and correct the 0428/0430 project interpretation that rejected
    `model.subtableconnection` and `model.submtconnection`.
  - Update SSOT docs so `connection` labels are parent-side relationship
    indexes, not pin wiring replacements.
  - Preserve `pin.connect.cell` as the same-table pin wiring mechanism.
  - Preserve `pin.connect.model` as abandoned unless a later explicit
    iteration reopens it.
  - Update developer-facing docs impacted by the corrected model placement
    rules.
  - Record the superseding decision and review evidence in this iteration.
  - Run sub-agent `codex-code-review` after the plan and after the SSOT doc
    correction; fix findings before closing the iteration.
- Out of scope:
  - Runtime/server implementation changes.
  - Fill-table refits for UI Server / MBR / RemoteWorker.
  - Browser deployment or E2E verification.
  - Changing Feishu source documents.
  - Adding compatibility parsing. Future implementation should hard-cut to the
    corrected SSOT rather than accept both old and new placements.

## Invariants / Constraints

- `CLAUDE.md` remains the highest repo-local execution constraint.
- This is a docs-only SSOT correction iteration.
- No runtime, server, fill-table, deployment, or test implementation files may
  be changed in this iteration.
- Current corrected semantic target:
  - Child ModelTable root Model 0 `(0,0,0)` declares `model.subtable`.
  - Parent/main table declares `model.subtableconnection` as the index to that
    child table.
  - Child model declares `model.submt`.
  - Parent/main or secondary model declares `model.submtconnection` as the index
    to that child model.
  - `pin.connect.cell` still handles pin wiring inside one ModelTable.
  - Cross-table interactions still pass through explicit boundary pins and do
    not restore `pin.connect.model`.
- 0428/0430 statements that say `model.subtableconnection` and
  `model.submtconnection` are rejected as project input are superseded by this
  iteration once completed.
- The corrected SSOT must distinguish:
  - identity/form declaration on the child side;
  - relationship/index declaration on the parent side;
  - pin/event wiring through pins.

## Success Criteria

- SSOT docs no longer describe `model.subtableconnection` and
  `model.submtconnection` as stale or rejected project labels.
- `CLAUDE.md` no longer describes `model.submt` / `model.subtable` as
  parent-side hosting Cell labels.
- `docs/architecture_mantanet_and_workers.md` no longer describes
  `model.submt` / `model.subtable` as parent-side hosting Cell labels.
- SSOT docs clearly define where each of the four labels is written:
  `model.subtable`, `model.subtableconnection`, `model.submt`,
  `model.submtconnection`.
- SSOT docs clearly state that `connection` labels are relationship indexes,
  not replacements for `pin.connect.cell`.
- User-facing docs no longer tell App authors or runtime implementers that the
  host should write `model.subtable` on the hosting Cell as the parent-side
  index.
- The iteration records which 0428/0430 decisions are superseded and why.
- Plan and final SSOT diff receive sub-agent review approval.
- `git diff --check` and targeted stale-wording searches pass.

## Inputs

- Created at: 2026-07-01
- Iteration ID: `0431-subtable-connection-ssot`
- Branch: `dropx/dev_0431-subtable-connection-ssot`
- User correction:
  - `model.subtable` is written on the child ModelTable Model 0 `(0,0,0)`.
  - `model.subtableconnection` is written on the main/parent table as an index
    to the child table.
  - `model.submt` is written inside the child model.
  - `model.submtconnection` is written in the main/parent or secondary model as
    an index to the child model.
- Superseded project interpretation:
  - `docs/ssot/feishu_model_label_alignment_v1.md`
  - `docs/iterations/0428-feishu-model-label-ssot-plan/`
  - `docs/iterations/0430-feishu-operational-ssot-impl/`
