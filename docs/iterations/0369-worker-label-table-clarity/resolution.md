---
id: 0369
title: worker-label-table-clarity
doc_type: iteration_resolution
status: Completed
updated: 2026-05-11
source: ai
branch: dropx/0369-worker-label-table-clarity
iteration_id: 0369-worker-label-table-clarity
phase: phase1
---

# Iteration 0369 Worker Label Table Clarity Resolution

## Execution Strategy

- Treat this as a docs-only clarification on top of 0368. The runtime and deployed role patches already use `sys_worker_id` / `sys_worker_role`; this iteration makes the public table explicit and locks the wording with a docs contract test.

## Step 1

- Scope: Update active SSOT and user guide Worker label descriptions.
- Files:
  - `docs/ssot/label_type_registry.md`
  - `docs/user-guide/modeltable_user_guide.md`
- Verification: Run the docs contract test and whitespace check.
- Acceptance: Both active docs show `type / 解释 / key / value / 示例` rows for `worker.role` and `worker.id`.
- Rollback: Revert this iteration branch before merge.

## Step 2

- Scope: Add regression coverage and close the iteration record.
- Files:
  - `scripts/tests/test_0364_docs_split_bus_contract.mjs`
  - `docs/ITERATIONS.md`
  - `docs/iterations/0369-worker-label-table-clarity/runlog.md`
- Verification:
  - `node scripts/tests/test_0364_docs_split_bus_contract.mjs`
  - `git diff --check`
- Acceptance: The new `worker_label_docs_use_current_table_shape` check passes.
- Rollback: Revert this iteration branch before merge.

## Notes

- Generated at: 2026-05-11
