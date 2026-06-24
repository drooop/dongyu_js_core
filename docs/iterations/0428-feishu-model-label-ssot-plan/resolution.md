---
title: "Iteration 0428 Feishu Model Label SSOT Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-06-24
source: ai
iteration_id: 0428-feishu-model-label-ssot-plan
id: 0428-feishu-model-label-ssot-plan
phase: completed
---

# Iteration 0428-feishu-model-label-ssot-plan Resolution

## Execution Strategy

This iteration is Phase1 / docs-only. It freezes the target SSOT and the
follow-up implementation plan, but does not update runtime code, fill-table
patches, deployments, or browser tests.

## Step 1: Source And Current SSOT Review

- Scope:
  - Read the updated Feishu document.
  - Inspect current repo SSOT for model labels, subtable namespace,
    pin connection, and Temporary ModelTable payload.
- Files:
  - Read: `/tmp/feishu_LGsZ_model_doc.md`
  - Read: `docs/ssot/label_type_registry.md`
  - Read: `docs/ssot/runtime_semantics_modeltable_driven.md`
  - Read: `docs/ssot/principal_scoped_subtable_namespace_v1.md`
  - Read: `docs/ssot/temporary_modeltable_payload_v1.md`
- Verification:
  - `rg -n "model.v1n|model.subtableconnection|model.submtconnection|pin.connect.model" /tmp/feishu_LGsZ_model_doc.md docs/ssot`
- Acceptance:
  - Feishu/current-repo differences are explicitly named in the target SSOT.
- Rollback:
  - Remove the 0428 docs and iteration registry row.

## Step 2: Freeze Target Naming SSOT

- Scope:
  - Add one target SSOT document that explains the chosen project naming.
  - Keep the document authoritative for 0428 target alignment only.
  - Avoid silently overriding operational SSOT before implementation.
- Files:
  - Create: `docs/ssot/feishu_model_label_alignment_v1.md`
- Verification:
  - `test -f docs/ssot/feishu_model_label_alignment_v1.md`
  - `rg -n "pin.connect.model|model.v1n|model.subtableconnection|model.submtconnection|nested ModelTable" docs/ssot/feishu_model_label_alignment_v1.md`
- Acceptance:
  - The document says `pin.connect.model` is abandoned.
  - The document says `model.v1n` is not adopted as project `label.t`.
  - The document says `model.subtableconnection` and `model.submtconnection`
    are not adopted as project `label.t`.
  - The document gives a target non-nested Temporary ModelTable message shape.
- Rollback:
  - Delete `docs/ssot/feishu_model_label_alignment_v1.md`.

## Step 3: Freeze Follow-Up Implementation Plan

- Scope:
  - Define the implementation stages that should happen after this docs-only
    iteration is approved.
  - Make the stages small enough for per-stage sub-agent review.
- Files:
  - Modify: `docs/iterations/0428-feishu-model-label-ssot-plan/plan.md`
  - Modify: `docs/iterations/0428-feishu-model-label-ssot-plan/resolution.md`
  - Modify: `docs/iterations/0428-feishu-model-label-ssot-plan/runlog.md`
  - Modify: `docs/ITERATIONS.md`
- Verification:
  - `rg -n "0428-feishu-model-label-ssot-plan" docs/ITERATIONS.md docs/iterations/0428-feishu-model-label-ssot-plan`
- Acceptance:
  - Follow-up work is split into SSOT update, validator/runtime update,
    fill-table refit, app payload update, and browser verification phases.
- Rollback:
  - Restore the previous `docs/ITERATIONS.md` and remove the iteration folder.

## Follow-Up Implementation Phases

These phases are not executed in 0428. They are the next implementation
iteration's proposed structure.

1. SSOT propagation:
   - Update `label_type_registry`, `runtime_semantics`,
     `pin_connection_contract_v2`, `temporary_modeltable_payload_v1`, and
     imported slide App ingress docs to reference the 0428 target.
   - Remove current examples that still present nested ModelTable arrays in
     `payload.v` / `bundle_payload.v` as the target shape.

2. Validation hardening:
   - Add validators/tests that reject `model.v1n`,
     `model.subtableconnection`, `model.submtconnection`, and
     `pin.connect.model` as current project inputs.
   - Add validators/tests that reject nested ModelTable record arrays inside
     `json` labels when the label is acting as formal transport payload.

3. Runtime message shape:
   - Introduce the target `pin_payload.v2` or equivalent non-nested message
     shape.
   - Keep envelope metadata in temporary `id=0`.
   - Put actual business payload in one or more separate temporary model ids in
     the same record array.
   - Ensure materialization reads the table-qualified reply target and payload
     model id from records, not from nested JSON.

4. Fill-table refit:
   - Refill UI Server, MBR, R1 provider bundle handler, and imported slide App
     examples to use the non-nested message shape.
   - Refit minimal Submit, E2E Color Generator, and To Do Board payloads.

5. Verification:
   - Run deterministic validators.
   - Deploy locally.
   - Browser-test install, open, submit/request, response, and UI update for at
     least minimal Submit and E2E Color Generator.
   - Confirm request/response transport is still split by topic and that
     materialization targets the correct `{ table_id, model_id }`.

## Notes

- Generated at: 2026-06-24.
- User explicitly confirmed `pin.connect.model` is abandoned before this
  iteration was opened.
