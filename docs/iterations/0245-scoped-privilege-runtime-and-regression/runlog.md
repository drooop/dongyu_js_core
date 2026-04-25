---
title: "0245 — scoped-privilege-runtime-and-regression Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0245-scoped-privilege-runtime-and-regression
id: 0245-scoped-privilege-runtime-and-regression
phase: phase3
---

# 0245 — scoped-privilege-runtime-and-regression Runlog

## Environment

- Date: `2026-03-26`
- Branch: `dropx/dev_0245-scoped-privilege-runtime-and-regression`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`

## Review Gate Record

- Iteration ID: `0245-scoped-privilege-runtime-and-regression`
- Review Date: `2026-03-26`
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户已明确要求 0245 只做 runtime scoped privilege 能力，不混入 mailbox 迁移。

## Execution Records

### Step 1 — Add RED Contract Test

- File:
  - `scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs`
- Command:
  - `node scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs`
- Key output (RED baseline):
  - ordinary cell same-model cross-cell direct write was not rejected
  - matrix scope overflow was not rejected
  - parent -> child direct write via `submt` was not rejected
  - cross-model direct write was not rejected
- Result: PASS

### Step 2 — Implement Scoped Privilege Runtime Checks

- File:
  - `packages/worker-base/src/runtime.mjs`
- Runtime changes:
  - add declared-form inspection helpers
  - add explicit privilege recognition via `scope_privileged=true`
  - add root auto privilege for `model.table` / `model.matrix`
  - add matrix scope bounds support via:
    - `scope_min_p`
    - `scope_max_p`
    - `scope_min_r`
    - `scope_max_r`
    - `scope_min_c`
    - `scope_max_c`
  - wrap `ctx.getLabel / writeLabel / rmLabel` with scope assertions
- Result: PASS

### Step 3 — Run Focused Regression

- Commands:
  - `node scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs`
  - `node scripts/tests/test_cell_connect_parse.mjs`
  - baseline comparison:
    - previous `dev` (`HEAD~1`) `node scripts/tests/test_submodel_connect.mjs`
    - current branch `node scripts/tests/test_submodel_connect.mjs`
    - current branch `node scripts/tests/test_model_in_out.mjs`
- Key output:
  - `test_0245_scoped_privilege_runtime_contract`: `8 passed, 0 failed`
  - `test_cell_connect_parse`: PASS
  - `test_submodel_connect`: historical red already present on `HEAD~1`
    - `test_child_model_out_to_parent`
    - `test_full_round_trip`
  - `test_model_in_out`: historical red still present
    - `test_model_out_notifies_parent`
- Adjudication:
  - 0245 新增 scoped privilege checks did not introduce those old reds
  - 0245 自己的 targeted contract is green
- Result: PASS
