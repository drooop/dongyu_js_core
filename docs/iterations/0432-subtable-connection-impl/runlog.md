---
title: "Iteration 0432 Subtable Connection Implementation Runlog"
doc_type: iteration-runlog
status: planned
updated: 2026-07-02
source: ai
iteration_id: 0432-subtable-connection-impl
id: 0432-subtable-connection-impl
phase: planning
---

# Iteration 0432-subtable-connection-impl Runlog

## Environment

- Date: 2026-07-02
- Branch: `dropx/dev_0432-subtable-connection-impl`
- Runtime: implementation stage for 0431 SSOT correction.
- Base commit: `4f1a0c7 docs(ssot): align subtable connection labels [0431]`
- Governing docs:
  - `CLAUDE.md`
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/principal_scoped_subtable_namespace_v1.md`

## Review Gate Record

- Iteration ID: `0432-subtable-connection-impl`
- Review Date: 2026-07-02
- Review Type: AI-assisted sub-agent
- Review Index: 1
- Decision: Change Requested
- Notes:
  - Required explicit connection Cell restrictions and single-parent semantics.
  - Required deterministic post-edit stale-label scans.
  - Required Workspace Manager browser install/open path unless blocked.
  - Required exact placeholder-search command.

- Iteration ID: `0432-subtable-connection-impl`
- Review Date: 2026-07-02
- Review Type: AI-assisted sub-agent
- Review Index: 2
- Decision: Change Requested
- Notes:
  - `model.subtableconnection` value shape was too loose and mentioned alias
    metadata.
  - Fix required strict `table_id` / `root_model_id` / `mount_kind` plus
    optional `owner_principal_id`.

- Iteration ID: `0432-subtable-connection-impl`
- Review Date: 2026-07-02
- Review Type: AI-assisted sub-agent
- Review Index: 3
- Decision: Approved
- Notes:
  - Findings: none.
  - Open questions: none.
  - Verification gaps: none.

## Execution Records

### Step 0: Plan Gate

- Command:
  - `git diff --check -- docs/ITERATIONS.md docs/iterations/0432-subtable-connection-impl`
  - `rg -n --glob '!runlog.md' "\\[(TO)DO\\]|Descri[b]e the iteration objective|Explai[n] implementation approach|PLACEHOLD[E]R|pendin[g]|alias metadata" docs/iterations/0432-subtable-connection-impl docs/ITERATIONS.md`
  - Sub-agent `codex-code-review` plan review, three rounds.
- Key output:
  - `git diff --check`: no output.
  - Placeholder/alias search: no matches.
  - Review 1: Change Requested.
  - Review 2: Change Requested.
  - Review 3: Approved.
- Result: PASS
- Commit:

### Step 1: Runtime Label Semantics

- Command:
  - RED: `node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs`
  - GREEN:
    - `node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs`
    - `node scripts/tests/test_0425_runtime_table_namespace_contract.mjs`
    - `node scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`
    - `node scripts/tests/test_submodel_register.mjs`
    - `node scripts/tests/test_submodel_connect.mjs`
    - `node scripts/tests/test_0357_pin_connection_hard_cut.mjs`
  - `rg -n "resolvedType === 'submt'|model\\.subtableconnection'\\s*\\|\\||model\\.submtconnection'\\s*\\|\\||subtable_requires_host_table|submodel_host_cell|subtable_host_cell|_normalizeSubtableDescriptor|parentChildMap\\.get\\(model\\.id\\)|parentChildMap\\.set\\(childModelId|parentChildMap\\.delete\\(childModelId" packages/worker-base/src/runtime.mjs scripts/tests/test_0432_subtable_connection_runtime_contract.mjs scripts/tests/test_0425_runtime_table_namespace_contract.mjs scripts/tests/test_submodel_register.mjs scripts/tests/test_submodel_connect.mjs scripts/tests/test_0357_pin_connection_hard_cut.mjs scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`
  - `git diff --check -- packages/worker-base/src/runtime.mjs scripts/tests/test_0432_subtable_connection_runtime_contract.mjs scripts/tests/test_0425_runtime_table_namespace_contract.mjs scripts/tests/test_0430_feishu_operational_ssot_contract.mjs scripts/tests/test_submodel_register.mjs scripts/tests/test_submodel_connect.mjs scripts/tests/test_0357_pin_connection_hard_cut.mjs`
- Key output:
  - RED output: `0 passed, 16 failed out of 16`.
  - GREEN output:
    - `test_0432_subtable_connection_runtime_contract`: `16 passed, 0 failed out of 16`.
    - `test_0425_runtime_table_namespace_contract`: `14 passed, 0 failed out of 14`.
    - `test_0430_feishu_operational_ssot_contract`: `PASSED`.
    - `test_submodel_register`: `4 passed, 0 failed out of 4`.
    - `test_submodel_connect`: `3 passed, 0 failed out of 3`.
    - `test_0357_pin_connection_hard_cut`: all listed checks `PASS`.
  - Residual old-runtime-semantics search: no matches.
  - `git diff --check`: no output.
  - Sub-agent review 1: `CHANGE_REQUESTED`.
    - Finding: replacing a connection label left the old `parentChildMap` /
      `subtableMounts` index alive.
    - Finding: same-cell `model.submtconnection` metadata/target updates could
      be marked applied while runtime maps stayed stale.
  - Added failing replacement coverage:
    - `testSubmtConnectionReplacementCleansOldIndex`
    - `testSubtableConnectionReplacementCleansOldIndex`
    - `testSubtableConnectionMetadataUpdateIsSynchronized`
  - RED for replacement coverage: `18 passed, 4 failed out of 22`.
  - Fix: added index cleanup helpers and clear previous index before registering
    replacement connection labels.
  - GREEN after fix:
    - `test_0432_subtable_connection_runtime_contract`: `22 passed, 0 failed out of 22`.
    - `test_0425_runtime_table_namespace_contract`: `14 passed, 0 failed out of 14`.
    - `test_0430_feishu_operational_ssot_contract`: `PASSED`.
    - `test_submodel_register`: `4 passed, 0 failed out of 4`.
    - `test_submodel_connect`: `3 passed, 0 failed out of 3`.
    - `test_0357_pin_connection_hard_cut`: all listed checks `PASS`.
  - Sub-agent review 2: `CHANGE_REQUESTED`.
    - Finding: same key cross-type replacement between
      `model.submtconnection` and `model.subtableconnection` could be applied
      and leave stale maps.
    - Finding: duplicate `model.subtableconnection` records could index the
      same `table_id` from multiple Cells.
  - Added failing coverage:
    - `testConnectionIndexCannotChangeTypeInPlace`
    - `testSubtableConnectionRejectsDuplicateTableId`
  - RED for second-review coverage: `22 passed, 4 failed out of 26`.
  - Fix: reject in-place cross-type connection index replacement and reject a
    second parent Cell indexing the same child table id.
  - Additional stale-test cleanup:
    - Updated `test_0142_integration` fixture and assertions from parent-side
      `model.submt` to parent-side `model.submtconnection`.
    - Updated `test_0177_submt_mapping_contract` to verify connection Cell
      rules plus child-side `model.submt` declaration.
  - GREEN after second fix:
    - `node --check packages/worker-base/src/runtime.mjs`: no output.
    - `test_0432_subtable_connection_runtime_contract`: `26 passed, 0 failed out of 26`.
    - `test_0425_runtime_table_namespace_contract`: `14 passed, 0 failed out of 14`.
    - `test_0430_feishu_operational_ssot_contract`: `PASSED`.
    - `test_0142_integration`: `3 passed, 0 failed out of 3`.
    - `test_0177_submt_mapping_contract`: `PASS`.
    - `test_submodel_register`: `4 passed, 0 failed out of 4`.
    - `test_submodel_connect`: `3 passed, 0 failed out of 3`.
    - `test_0357_pin_connection_hard_cut`: all listed checks `PASS`.
  - Residual stale-runtime/test search:
    - `rg -n "\"t\": \"submt\"|t:\s*'submt'|t:\s*\"submt\"|parentChildMap\.has\([0-9]|parentChildMap\.get\([0-9]|submodel_host_cell_forbidden_label|subtable_requires_host_table|submodel_host_cell|subtable_host_cell|_normalizeSubtableDescriptor|model\.subtableconnection'\s*\|\||model\.submtconnection'\s*\|\||resolvedType === 'submt'|parentChildMap\.get\(model\.id\)|parentChildMap\.set\(childModelId|parentChildMap\.delete\(childModelId" packages/worker-base/src scripts/tests`
    - Output: no matches.
  - `git diff --check`: no output.
  - Sub-agent review 3: `CHANGE_REQUESTED`.
    - Finding: same-key overwrite of a relationship label by a non-connection
      label could apply while leaving stale runtime indexes alive.
    - Finding: same-key overwrite of a relationship label by a boundary pin
      could apply while leaving stale runtime indexes alive.
  - Added failing coverage:
    - `testConnectionIndexCannotBeOverwrittenByNonConnectionLabel`
    - `testConnectionIndexCannotBeOverwrittenByBoundaryPin`
  - RED for third-review coverage: `26 passed, 4 failed out of 30`.
  - Fix: if the previous same-key label was a connection index, the new label
    must be the same connection-index type; otherwise the write is rejected with
    `connection_cell_index_type_change_forbidden`.
  - GREEN after third fix:
    - `node --check packages/worker-base/src/runtime.mjs`: no output.
    - `test_0432_subtable_connection_runtime_contract`: `30 passed, 0 failed out of 30`.
    - `test_0425_runtime_table_namespace_contract`: `14 passed, 0 failed out of 14`.
    - `test_0430_feishu_operational_ssot_contract`: `PASSED`.
    - `test_0142_integration`: `3 passed, 0 failed out of 3`.
    - `test_0177_submt_mapping_contract`: `PASS`.
    - `test_submodel_register`: `4 passed, 0 failed out of 4`.
    - `test_submodel_connect`: `3 passed, 0 failed out of 3`.
    - `test_0357_pin_connection_hard_cut`: all listed checks `PASS`.
  - Residual stale-runtime/test search after third fix: no matches.
  - `git diff --check`: no output.
  - Sub-agent review 4: `APPROVED`.
    - Findings: none.
    - Open questions: none.
    - Verification gaps: none.
- Result: PASS
- Commit:

### Step 2: Slide App Import And Lifecycle

- Command:
- Key output:
- Result: pending
- Commit:

### Step 3: Fill-Table Refit And System Fixtures

- Command:
- Key output:
- Result: pending
- Commit:

### Step 4: Docs And Developer Examples Alignment

- Command:
- Key output:
- Result: pending
- Commit:

### Step 5: Local Deployment And Browser Verification

- Command:
- Key output:
- Result: pending
- Commit:

### Final Review

- Command:
- Key output:
- Result: pending
- Commit:

## Docs Updated

- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/ssot/label_type_registry.md` reviewed
- [ ] `docs/ssot/principal_scoped_subtable_namespace_v1.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
