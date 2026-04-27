---
title: "0347 — Temporary ModelTable Message Contract Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-04-27
source: ai
iteration_id: 0347-temporary-modeltable-message-contract
id: 0347-temporary-modeltable-message-contract
phase: planning
---

# Iteration 0347-temporary-modeltable-message-contract Resolution

## Execution Strategy

- Do a docs-only contract freeze.
- First inspect current Data.* definitions across SSOT, prior iterations, templates, fixtures, and legacy runtime code.
- Then update the smallest SSOT/user-guide surface needed to freeze the message/materialization boundary.
- Finally add a deterministic docs check and run sub-agent code review before completion.

## Step 1 — Data Model Current-State Audit

- Scope:
- Inspect `Data.Array / Data.Queue / Data.Stack` docs, templates, and fixtures.
- Inspect legacy `packages/worker-base/src/data_models.js` only to classify whether it is current truth.
- Files:
- `docs/iterations/0190-data-array-tier2-template/*`
- `docs/iterations/0296-foundation-c-data-models/*`
- `docs/plans/2026-04-06-foundation-c-data-models-*.md`
- `docs/user-guide/data_models_filltable_guide.md`
- `packages/worker-base/system-models/templates/data_*_v0.json`
- `scripts/fixtures/*data*`
- `packages/worker-base/src/data_models.js`
- Verification:
- `rg` inventory for `Data.*`, `临时模型表`, `materialize`, `data model`.
- Acceptance:
- Audit conclusion is recorded in `runlog.md` and in the updated contract docs.
- Rollback:
- Revert docs-only changes for this iteration.

## Step 2 — Freeze Temporary ModelTable Message Contract

- Scope:
- Update SSOT and user docs to state that pin/event transport format is ModelTable-like, but persistence only occurs through explicit materialization.
- Files:
- `docs/ssot/temporary_modeltable_payload_v1.md`
- `docs/ssot/program_model_pin_and_payload_contract_vnext.md`
- `docs/ssot/label_type_registry.md`
- `docs/user-guide/data_models_filltable_guide.md`
- Verification:
- Deterministic docs check for required contract phrases and cross-doc references.
- Acceptance:
- Docs distinguish temporary message, transport envelope, and formal ModelTable materialization.
- Rollback:
- Revert the above docs to previous versions.

## Step 3 — Verification And Review

- Scope:
  - Add a small docs contract test and run sub-agent `codex-code-review`.
- Files:
  - `scripts/tests/test_0347_temporary_modeltable_message_contract.mjs`
  - `docs/iterations/0347-temporary-modeltable-message-contract/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `node scripts/tests/test_0347_temporary_modeltable_message_contract.mjs`
  - `git diff --check`
  - sub-agent review decision must be `APPROVED`.
- Acceptance:
  - All checks pass, runlog records evidence, iteration index is marked `Completed`.
- Rollback:
  - Revert test and iteration docs.

## Notes

- Generated at: 2026-04-27
