---
title: "Iteration 0439 To Do Subtable View Snapshot Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-07-06
source: ai
iteration_id: 0439-todo-subtable-view-snapshot
id: 0439-todo-subtable-view-snapshot
phase: phase1
---

# Iteration 0439-todo-subtable-view-snapshot Resolution

## Execution Strategy

Use the existing 0434 seeded App-table machinery as the implementation path. First prove the current `To Do Board` host-model presentation is still the active user-facing entry. Then generalize the seeded migration list so `To Do Board` is materialized into a principal-scoped App table, update host-model registry contracts, keep existing To Do behavior tests meaningful against the App table, and finally verify snapshot isolation plus local browser behavior.

## Step 1 — Planning Gate

- Scope:
  - Register 0439.
  - Freeze `plan.md`, `resolution.md`, and `runlog.md`.
  - Record review gate result before any runtime code change.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0439-todo-subtable-view-snapshot/plan.md`
  - `docs/iterations/0439-todo-subtable-view-snapshot/resolution.md`
  - `docs/iterations/0439-todo-subtable-view-snapshot/runlog.md`
- Verification:
  - `git diff --check`
  - AI-assisted review of plan and resolution against `CLAUDE.md`, `docs/WORKFLOW.md`, and `docs/ssot/principal_scoped_subtable_namespace_v1.md`.
- Acceptance:
  - Iteration is registered as `Planned`.
  - Review gate records Approved before Step 2.
- Rollback:
  - Remove the 0439 row and iteration directory.

## Step 2 — RED Contract For To Do App Table Migration

- Scope:
  - Add a failing-first deterministic test for the desired `To Do Board` App table presentation and principal isolation.
  - No production code changes in this step.
- Files:
  - `scripts/tests/test_0439_todo_subtable_view_snapshot_contract.mjs`
  - `docs/iterations/0439-todo-subtable-view-snapshot/runlog.md`
- Verification:
  - `node scripts/tests/test_0439_todo_subtable_view_snapshot_contract.mjs`
- Acceptance:
  - The test fails for the expected reason: `To Do Board` is still exposed as `host|1086` or no seeded To Do App table exists.
- Rollback:
  - Remove the new test file and Step 2 runlog entry.

## Step 3 — Materialize To Do Board As A Principal-Scoped App Table

- Scope:
  - Generalize seeded slid-in App migrations to include `To Do Board`.
  - Remove `1086` from user-facing host Workspace allowlists.
  - Update To Do contract tests so behavior coverage points at the migrated App table root instead of host `1086`.
  - Preserve R1 provider-owned To Do bundle tests.
- Expected files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `scripts/tests/test_0439_todo_subtable_view_snapshot_contract.mjs`
  - `scripts/tests/test_0405_todo_slide_app_contract.mjs`
  - Potentially existing Workspace/route tests that encode `host|1086`.
- Verification:
  - `node scripts/tests/test_0439_todo_subtable_view_snapshot_contract.mjs`
  - `node scripts/tests/test_0405_todo_slide_app_contract.mjs`
  - `node scripts/tests/test_0412_todo_provider_app1_contract.mjs`
  - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
  - `node scripts/tests/test_0434_first_slid_in_app_subtable_contract.mjs`
  - `node scripts/tests/test_0438_app_open_frontend_latency_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
- Acceptance:
  - `To Do Board` App table exists per principal and is the only user-facing To Do entry.
  - Host `1086` remains available as a source template but not as a Workspace entry.
  - Existing To Do actions still update `tasks_json` through the allowed ingress path.
  - No host-table fallback or cross-principal shared App table is introduced.
- Rollback:
  - Revert Step 3 code/test changes and rerun existing To Do + subtable tests.

## Step 4 — Snapshot Granularity And Multi-User Isolation Proof

- Scope:
  - Add/update deterministic assertions that `profile=visible` for the migrated To Do App returns only the target App table/model body for the current principal.
  - Assert another principal cannot see or request the first principal's To Do App table body.
- Expected files:
  - `scripts/tests/test_0439_todo_subtable_view_snapshot_contract.mjs`
  - Existing snapshot tests if shared helpers need updated expectations.
- Verification:
  - `node scripts/tests/test_0439_todo_subtable_view_snapshot_contract.mjs`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
  - `node scripts/tests/test_0425_visible_model_refs_contract.mjs`
  - `node scripts/tests/test_0435_visible_snapshot_app_slimming_contract.mjs`
  - `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
  - `node scripts/tests/test_0437_bootstrap_sse_first_packet_latency_contract.mjs`
- Acceptance:
  - Snapshot body proves target-only App table loading for current App/current view.
  - Cross-principal To Do App table request is absent/rejected from the visible snapshot projection.
- Rollback:
  - Revert Step 4 test/helper changes and restore previous snapshot contracts.

## Step 5 — Documentation, Local Deploy, Browser Verification, Closeout

- Scope:
  - Update developer guide with subtable slide App authoring/migration requirements.
  - Redeploy local stack and verify real browser open/interaction for migrated `To Do Board`.
  - Record final evidence and complete iteration.
- Expected files:
  - `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md`
  - `docs/iterations/0439-todo-subtable-view-snapshot/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `git diff --check`
  - Full deterministic regression bundle from Steps 3 and 4.
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - Browser: fake-login local session opens `To Do Board`, confirms table-qualified App table root, and performs one To Do action.
  - Final code review or documented AI-assisted review with no blocking findings.
- Acceptance:
  - All deterministic checks pass.
  - Local browser evidence proves the migrated To Do App opens and mutates its own App table state.
  - `docs/ITERATIONS.md` marks 0439 Completed only after verification passes.
- Rollback:
  - Revert the 0439 branch before merging; if already merged, revert the merge commit from `dev`.

## Notes

- Generated at: 2026-07-06
- Phase 1 remains docs-only.
