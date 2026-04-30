---
title: "0355 Data Single Array One Tier2 Resolution"
doc_type: iteration_resolution
status: completed
updated: 2026-04-30
source: codex
---

# Iteration 0355-data-single-array-one-tier2 Resolution

## Execution Strategy

Use TDD and make the no-compatibility rule executable. The first test will
describe the desired `Data.Array.One` target and prove the current repository
still fails it. Implementation then adds the smallest Tier 2 template/helper
surface required to pass that test. Existing Queue/Stack/CircularBuffer work is
not rewritten in this iteration, but the Array.One slice must not leave a
working legacy Array target behind.

## Step 1 — Planning And Gate

- Scope: Register this iteration, freeze the no-compatibility plan, and record
  the user approval that allows Phase 3 execution.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0355-data-single-array-one-tier2/plan.md`
  - `docs/iterations/0355-data-single-array-one-tier2/resolution.md`
  - `docs/iterations/0355-data-single-array-one-tier2/runlog.md`
- Verification:
  - `git status --short`
  - manual check that the iteration is registered before implementation
- Acceptance:
  - Plan and resolution explicitly forbid compatibility aliases/fallbacks.
  - Review gate is recorded as Approved based on the user's instruction.
- Rollback:
  - Revert the docs-only planning commit.

## Step 2 — Failing Contract Tests

- Scope: Add deterministic tests for the new target and guard against the old
  Array target.
- Files:
  - `scripts/tests/test_0355_data_single_array_one_tier2.mjs`
- Verification:
  - `node scripts/tests/test_0355_data_single_array_one_tier2.mjs`
- Acceptance:
  - The new test fails before implementation for the expected reason: missing
    `Data.Array.One` target and/or old target still canonical.
- Rollback:
  - Remove the new test file.

## Step 3 — Data.Single / Data.Array.One Template Implementation

- Scope: Add the canonical Tier 2 template and deterministic helper surface
  needed by the tests.
- Files:
  - `packages/worker-base/system-models/templates/data_array_one_v1.json`
  - `packages/worker-base/system-models/templates/data_array_v0.json`
  - helper module if required under `packages/worker-base/src/`
- Verification:
  - `node scripts/tests/test_0355_data_single_array_one_tier2.mjs`
  - `node scripts/tests/test_0347_temporary_modeltable_message_contract.mjs`
- Acceptance:
  - Canonical and remapped ids pass.
  - Old Data.Array / underscore pin target is rejected.
  - No legacy ctx API appears in the new template.
- Rollback:
  - Remove the new template/helper and restore the prior historical template
    state.

## Step 4 — Documentation And Living Docs Review

- Scope: Update user-facing Data.* docs and record which SSOT/user-guide
  documents were reviewed or changed.
- Files:
  - `docs/user-guide/data_models_filltable_guide.md`
  - `docs/ssot/data_model_tier2_implementation_v1.md`
  - `docs/ssot/feishu_data_model_contract_v1.md` if wording needs promotion
  - `docs/iterations/0355-data-single-array-one-tier2/runlog.md`
- Verification:
  - `node scripts/tests/test_0348_feishu_data_model_contract.mjs`
  - `node scripts/tests/test_0349_data_model_tier2_plan.mjs`
- Acceptance:
  - Docs tell developers to use `Data.Array.One`, not `Data.Array`.
  - Docs state no compatibility aliases exist.
- Rollback:
  - Revert documentation changes.

## Step 5 — Final Verification, Review, Merge

- Scope: Run all relevant checks, perform code review, complete runlog, mark
  the iteration completed, merge through `dev`, and push.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0355-data-single-array-one-tier2/runlog.md`
- Verification:
  - `node scripts/tests/test_0355_data_single_array_one_tier2.mjs`
  - `node scripts/tests/test_0347_temporary_modeltable_message_contract.mjs`
  - `node scripts/tests/test_0348_feishu_data_model_contract.mjs`
  - `node scripts/tests/test_0349_data_model_tier2_plan.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `git diff --check`
- Acceptance:
  - All checks PASS.
  - Review findings are resolved or recorded with rationale.
  - `docs/ITERATIONS.md` is Completed and merge commits are recorded.
- Rollback:
  - Revert the iteration merge commit from `dev`.

## Notes

- Generated at: 2026-04-30
