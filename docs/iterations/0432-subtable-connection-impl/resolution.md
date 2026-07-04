---
title: "Iteration 0432 Subtable Connection Implementation Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-07-02
source: ai
iteration_id: 0432-subtable-connection-impl
id: 0432-subtable-connection-impl
phase: completed
---

# Iteration 0432-subtable-connection-impl Resolution

## Execution Strategy

Use TDD and small review gates. Each stage starts by updating or adding a
contract test that encodes 0431 semantics, confirms the current implementation
fails, then updates runtime/fill-table/server code minimally until the stage
passes. After each stage, run targeted checks, write evidence to `runlog.md`,
and request sub-agent `codex-code-review`. Do not continue while the review has
unresolved `CHANGE_REQUESTED` findings.

## Step 0: Plan Gate

- Scope: freeze this implementation plan and get review approval.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0432-subtable-connection-impl/plan.md`
  - `docs/iterations/0432-subtable-connection-impl/resolution.md`
  - `docs/iterations/0432-subtable-connection-impl/runlog.md`
- Verification:
  - `git diff --check -- docs/ITERATIONS.md docs/iterations/0432-subtable-connection-impl`
  - `rg -n --glob '!runlog.md' "\\[(TO)DO\\]|Descri[b]e the iteration objective|Explai[n] implementation approach|PLACEHOLD[E]R|pendin[g]" docs/iterations/0432-subtable-connection-impl docs/ITERATIONS.md`
    must return no matches.
  - sub-agent plan review with `codex-code-review`.
- Acceptance: review decision is Approved.
- Rollback: revert only 0432 iteration docs and registry line.

## Step 1: Runtime Label Semantics

- Scope: implement the four-label placement and registration rules in runtime.
- Files:
  - `packages/worker-base/src/runtime.mjs`
  - `packages/worker-base/src/runtime.js` if it exists and diverges from ESM.
  - `scripts/tests/test_0425_runtime_table_namespace_contract.mjs`
  - `scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`
  - New focused runtime contract test if the existing files become too broad.
- Verification:
  - First run updated/new tests and capture expected FAIL.
  - Implement runtime changes.
  - Run:
    - `node scripts/tests/test_0425_runtime_table_namespace_contract.mjs`
    - `node scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`
    - `node scripts/tests/test_submodel_register.mjs`
    - `node scripts/tests/test_submodel_connect.mjs`
    - `node scripts/tests/test_0357_pin_connection_hard_cut.mjs`
- Acceptance:
  - `model.subtableconnection` populates subtable mount/index maps.
  - `model.submtconnection` populates parent-child model maps.
  - child-side declarations do not create parent-side indexes by themselves.
  - connection Cells carrying `model.subtableconnection` or
    `model.submtconnection` accept only the relationship label plus boundary
    pins; unrelated labels on those Cells are rejected.
  - `model.subtableconnection` value shape is validated deterministically per
    `docs/ssot/label_type_registry.md`: required `table_id`,
    `root_model_id`, and `mount_kind`; optional `owner_principal_id` only.
  - `model.submtconnection` value shape is validated deterministically
    (child model id or explicit child descriptor), and a child model cannot be
    indexed by multiple parent Cells.
  - old placements fail with explicit reasons.
- Rollback: revert runtime and tests changed in this stage.

## Step 2: Slide App Import And Lifecycle

- Scope: update installation, export, delete, and workspace registry code so
  app tables use parent-side `model.subtableconnection` and child-root
  `model.subtable`.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
  - related slide import/cache/server-flow tests discovered by failing targeted
    runs.
- Verification:
  - First run updated slide install test and capture expected FAIL.
  - Implement server changes.
  - Run:
    - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
    - `node scripts/tests/test_0302_slide_app_zip_import_contract.mjs`
    - `node scripts/tests/test_0312_slide_import_cache_contract.mjs`
    - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
- Acceptance:
  - imported app payload keeps package-local positive ids.
  - host table has one `model.subtableconnection` index per app table.
  - child app table root has `model.subtable`.
  - delete removes the parent index and app table state without old fallback.
- Rollback: revert server and tests changed in this stage.

## Step 3: Fill-Table Refit And System Fixtures

- Scope: refit built-in/system patches and runtime bootstrap fixtures from old
  parent-side `model.submt` usage to parent-side `model.submtconnection` plus
  child root declarations.
- Files:
  - `deploy/sys-v1ns/**/*.json`
  - `packages/worker-base/system-models/**/*.json`
  - `scripts/tests/fixtures/**/*.json`
  - tests that validate built-in hierarchy and workspace app entries.
- Verification:
  - Run a search that lists old parent-side `model.submt` candidates before
    edits.
  - Update fixtures/patches.
  - After edits, run deterministic stale-label scans over
    `deploy/sys-v1ns/**`, `packages/worker-base/system-models/**`,
    `scripts/tests/fixtures/**`, current docs, and examples. PASS requires no
    current-use parent-side `model.submt`, no host-side `model.subtable`, and no
    connection-label rejection wording outside historical iteration evidence.
  - Run:
    - `node scripts/validate_builtins_v0.mjs`
    - `node scripts/tests/test_0306_model100_pin_chain_contract.mjs`
    - `node scripts/tests/test_0383_matrix_suite_slide_app_contract.mjs`
    - `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
    - `node scripts/tests/test_0405_todo_slide_app_contract.mjs`
- Acceptance:
  - system bootstraps still expose expected apps.
  - old `model.submt` parent indexes are gone from current system fill-table
    patches unless the label is clearly child-root declaration.
- Rollback: revert JSON patches and fixture tests changed in this stage.

## Step 4: Docs And Developer Examples Alignment

- Scope: update developer examples and docs that mention actual generated
  installation labels or complete JSON patches.
- Files:
  - `docs/user-guide/**`
  - `docs/ssot/**` only if implementation exposes a detail not already frozen
    by 0431.
  - `test_files/**` or example payload files if current examples live there.
- Verification:
  - `git diff --check -- docs test_files`
  - `rg` searches for stale current-use phrases:
    - host-side `model.subtable`
    - parent-side `model.submt`
    - `model.subtableconnection` rejected
    - `model.submtconnection` rejected
  - run docs contract tests touched by the stage.
- Acceptance: developer docs and examples match the implemented installed
  labels and contain no “兼容旧写法” path.
- Rollback: revert docs/examples changed in this stage.

## Step 5: Local Deployment And Browser Verification

- Scope: prove the implementation works in the local deployed UI path.
- Files:
  - no source edits expected except fixes found during verification.
  - `docs/iterations/0432-subtable-connection-impl/runlog.md`
  - `docs/iterations/0432-subtable-connection-impl/assets/` if screenshots or
    metrics are captured.
- Verification:
  - Run baseline checks:
    - `bash scripts/ops/check_runtime_baseline.sh`
    - restart/redeploy local stack with the repo-approved script if baseline is
      stale.
  - Use real browser/Playwright to open `http://127.0.0.1:30900/`.
  - Verify Workspace/Desktop opens.
  - Verify one installed Slide App opens and is not stuck on “正在加载滑动 APP”.
  - Verify Workspace Manager install path materializes an app using the new
    parent/child labels. If local provider services are unavailable, record the
    blocking condition and run the closest deterministic substitute before
    marking the stage as not fully complete.
- Acceptance: local browser verification is PASS and evidence is in runlog.
- Rollback: revert implementation commits or restore previous local runtime
  baseline.

## Final Review And Completion

- Run final targeted test bundle plus `git diff --check`.
- Request final sub-agent review over the full 0432 diff.
- Address all `CHANGE_REQUESTED` findings.
- Update `docs/ITERATIONS.md` status to `Completed` only after all stage checks
  and final review pass.

## Notes

- Generated at: 2026-07-02.
- This plan intentionally treats old parent-side `model.submt` / host-side
  `model.subtable` behavior as invalid instead of preserving compatibility.
