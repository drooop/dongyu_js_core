---
title: "0354 Iteration Index Reconciliation Plan"
doc_type: iteration_plan
status: planned
updated: 2026-04-30
source: codex
---

# 0354 Iteration Index Reconciliation Plan

## Goal

Reconcile stale iteration index states after integrating 0352/0353, and fix the data-model user guide wording exposed by the mainline verification run.

## Background

After 0353 was completed and deployed, the iteration index still had several historical rows with non-final status even though their branches are already ancestors of `dev`. During `main` promotion verification, the 0347 data-model contract test also showed that `docs/user-guide/data_models_filltable_guide.md` no longer carried two exact current-truth phrases required by the temporary ModelTable message contract.

## Scope

In scope:
- Mark ancestor-merged historical iterations as `Completed` in `docs/ITERATIONS.md`.
- Backfill concise completion evidence into the affected iteration runlogs/resolutions.
- Fix the 0347 data-model user guide wording so it explicitly says the message-local `id` is not a formal `model_id` and persistence requires formal materialization.
- Re-run the data-model contract and recent slide-app documentation contract checks.

Out of scope:
- Reopening Matrix userline or Slide UI historical implementation work.
- Changing runtime semantics, UI renderer behavior, or deploy scripts.
- Resolving `On Hold` remote-ops iterations.

## Affected Iterations

- `0267-home-save-draft-sync`
- `0285-matrix-userline-phase3`
- `0286-matrix-userline-phase4`
- `0287-slide-ui-mainline-split`
- `0288-slide-ui-phaseA-topology-freeze`
- `0327-docs-realign-to-0323-rw-spec`

## Success Criteria

- `docs/ITERATIONS.md` has no stale non-final status for branches already merged into `dev`, except intentional `On Hold` rows.
- Affected runlogs/resolutions are not left in `active` / `planned` frontmatter when the index says `Completed`.
- `node scripts/tests/test_0347_temporary_modeltable_message_contract.mjs` passes.
- Recent 0351/0352/0353 documentation checks still pass.
- `git diff --check` passes.
