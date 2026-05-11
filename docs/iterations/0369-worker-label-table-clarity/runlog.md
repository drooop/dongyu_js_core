---
id: 0369
title: worker-label-table-clarity
doc_type: iteration_runlog
status: Completed
updated: 2026-05-11
source: ai
branch: dropx/0369-worker-label-table-clarity
iteration_id: 0369-worker-label-table-clarity
phase: phase4
---

# Iteration 0369 Worker Label Table Clarity Runlog

## Environment

- Date: 2026-05-11
- Branch: `dropx/0369-worker-label-table-clarity`
- Runtime: docs-only; no runtime redeploy required

## Execution Records

### Step 1

- Change: Updated the active Worker label table in SSOT and user guide to match the requested `worker.role` / `worker.id` structure:
  - `worker.role`: `key=sys_worker_role`, values `WSM` community management, `DEM` digital employee management, `V1N` ordinary software worker.
  - `worker.id`: `key=sys_worker_id`, value shape `ws/dam/pic/de/sw`, example `5/10/28/35/13`.
- Result: PASS
- Commit: pending

### Step 2

- Change: Added `worker_label_docs_use_current_table_shape` to the docs contract test.
- Command: `node scripts/tests/test_0364_docs_split_bus_contract.mjs`
- Key output: `6 passed, 0 failed out of 6`
- Command: `git diff --check`
- Key output: no whitespace errors
- Result: PASS
- Commit: pending

## Docs Updated

- [x] `docs/ssot/label_type_registry.md` updated
- [x] `docs/user-guide/modeltable_user_guide.md` updated
- [x] `scripts/tests/test_0364_docs_split_bus_contract.mjs` updated
- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed; no change required
