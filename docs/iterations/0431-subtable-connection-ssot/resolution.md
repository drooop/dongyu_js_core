---
title: "Iteration 0431 Subtable Connection SSOT Correction Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-07-01
source: ai
iteration_id: 0431-subtable-connection-ssot
id: 0431-subtable-connection-ssot
phase: complete
---

# Iteration 0431-subtable-connection-ssot Resolution

## Execution Strategy

Run a docs-only correction. First freeze the plan and review it. Then update
the SSOT and developer docs to reflect the corrected four-label placement
model. Do not touch runtime or fill-table assets in this iteration. Any future
implementation work must open a separate iteration after this SSOT is approved.

## Stage 0: Branch, Scaffold, And Planning Review

- Scope:
  - Create `dropx/dev_0431-subtable-connection-ssot`.
  - Scaffold iteration docs.
  - Register 0431 in `docs/ITERATIONS.md`.
  - Record the user correction and plan review.
- Files:
  - Modify: `docs/ITERATIONS.md`
  - Modify: `docs/iterations/0431-subtable-connection-ssot/plan.md`
  - Modify: `docs/iterations/0431-subtable-connection-ssot/resolution.md`
  - Modify: `docs/iterations/0431-subtable-connection-ssot/runlog.md`
- Verification:
  - `git diff --check -- docs/ITERATIONS.md docs/iterations/0431-subtable-connection-ssot`
  - `rg -n --glob '!runlog.md' "\\[(TO)DO\\]|Descri[b]e the iteration objective|Explai[n] implementation approach|PLACEHOLD[E]R|pendin[g]" docs/iterations/0431-subtable-connection-ssot docs/ITERATIONS.md`
- Acceptance:
  - 0431 is registered.
  - Plan and resolution are self-contained.
  - Sub-agent planning review is `APPROVED`.
- Rollback:
  - Remove the 0431 registry row and iteration directory.

## Stage 1: Correct Model Boundary SSOT

- Scope:
  - Rewrite the Feishu alignment decision for `model.subtableconnection` and
    `model.submtconnection`.
  - Update the label registry so child-side declaration labels and parent-side
    index labels are distinct.
  - Update runtime semantics and pin connection docs where they describe
    boundary traversal or connection placement.
- Files:
  - Modify: `CLAUDE.md`
  - Modify: `docs/architecture_mantanet_and_workers.md`
  - Modify: `docs/ssot/feishu_model_label_alignment_v1.md`
  - Modify: `docs/ssot/label_type_registry.md`
  - Modify: `docs/ssot/runtime_semantics_modeltable_driven.md`
  - Modify: `docs/ssot/pin_connection_contract_v2.md`
  - Assess: `docs/ssot/principal_scoped_subtable_namespace_v1.md`
  - Assess: `docs/ssot/temporary_modeltable_payload_v1.md`
- Verification:
  - `rg -n "subtableconnection|submtconnection|not an accepted|rejected|stale label|does not adopt" CLAUDE.md docs/ssot`
  - `rg -n "model\\.subtable|model\\.subtableconnection|model\\.submt|model\\.submtconnection|pin\\.connect\\.model" CLAUDE.md docs/ssot`
  - `git diff --check -- CLAUDE.md docs/ssot`
- Acceptance:
  - `model.subtableconnection` and `model.submtconnection` are accepted labels
    with parent-side index semantics.
  - `model.subtable` and `model.submt` are child-side declarations, not
    parent-side indexes.
  - `connection` labels are not described as pin wiring and do not restore
    `pin.connect.model`.
  - Any remaining rejection wording is explicitly historical and points to
    this iteration as superseding it.
- Review:
  - Run sub-agent review for the SSOT diff.
- Rollback:
  - Revert Stage 1 SSOT edits.

## Stage 2: Correct Developer-Facing Guidance

- Scope:
  - Update slide App runtime docs and model table user guide text impacted by
    the corrected placement rules.
  - Record implementation follow-up requirements without doing implementation.
- Files:
  - Modify: `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`
  - Modify: `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md`
  - Modify: `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html`
  - Modify or assess: `docs/user-guide/modeltable_user_guide.md`
  - Modify: `docs/iterations/0431-subtable-connection-ssot/runlog.md`
- Verification:
  - `rg -n "host.*model\\.subtable|hosting Cell.*model\\.subtable|model\\.subtableconnection|model\\.submtconnection|pin\\.connect\\.model" docs/user-guide docs/ssot`
  - `node scripts/ops/obsidian_docs_migrate.mjs --root docs --phase all`
  - `git diff --check -- docs/user-guide docs/ssot docs/iterations/0431-subtable-connection-ssot`
- Acceptance:
  - Developer docs explain the corrected install model:
    child App table root declares `model.subtable`; host records
    `model.subtableconnection`.
  - Developer docs mark runtime changes as follow-up work, not already
    implemented behavior.
  - No user-facing doc tells developers to use `pin.connect.model`.
- Review:
  - Run sub-agent review for developer docs and consistency.
- Rollback:
  - Revert Stage 2 docs edits.

## Stage 3: Completion

- Scope:
  - Record PASS/FAIL evidence.
  - Update iteration status.
  - Run final sub-agent review.
- Files:
  - Modify: `docs/ITERATIONS.md`
  - Modify: `docs/iterations/0431-subtable-connection-ssot/runlog.md`
- Verification:
  - `git diff --check`
  - `git status --short`
  - Final targeted `rg` checks from Stages 1-2.
- Acceptance:
  - All docs-only stages are recorded in runlog.
  - Final sub-agent review is `APPROVED`.
  - Runtime implementation follow-up is clearly separated from this iteration.
- Rollback:
  - Restore 0431 status and leave branch unmerged.

## Notes

- This iteration intentionally supersedes part of the 0428/0430 interpretation.
- A later implementation iteration must update runtime/server/tests/installers
  to enforce the corrected placement; this iteration only freezes the SSOT.
