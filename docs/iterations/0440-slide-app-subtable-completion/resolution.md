---
title: "Iteration 0440 Slide App Subtable Completion Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-07-06
source: ai
iteration_id: 0440-slide-app-subtable-completion
id: 0440-slide-app-subtable-completion
phase: phase6
---

# Iteration 0440-slide-app-subtable-completion Resolution

## Execution Strategy

Use one generalized migration path instead of per-App hand patches:

1. add RED coverage that names the remaining user-facing source host models and proves the current registry still exposes host positive Apps;
2. generalize seeded App table materialization so every in-scope source host model gets a principal-owned App table root with source metadata;
3. remove migrated source host models from user-facing Workspace allowlists while preserving them as source templates;
4. expand visible snapshots to the requested App table's reachable same-table model closure;
5. carry source host identity through the Workspace registry/foreground state where frontend behavior still needs it;
6. update developer docs and run local deployed browser verification.

## Step 1 — Inventory And RED Contract

- Scope:
  - Add a 0440 test that enumerates the in-scope source host models and asserts the target post-migration shape.
  - The initial test must fail on the current baseline for at least one remaining host-positive Workspace entry.
- Files:
  - `scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs`
  - `docs/iterations/0440-slide-app-subtable-completion/runlog.md`
- Verification:
  - `node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs`
- Acceptance:
  - Test fails before implementation for the expected reason.
  - Failure text identifies a remaining host positive source model, not an unrelated setup problem.
- Rollback:
  - Delete the new test file and remove the runlog Step 1 record.

## Step 2 — Generalize Seeded App Table Migration

- Scope:
  - Extend the seeded migration registry to all in-scope source host models.
  - Normalize missing root metadata during source export without mutating source templates.
  - Preserve existing R1/provider-owned installation behavior.
  - Store `slid_in_source_host_model_id` and source metadata on each migrated App table root.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs`
  - Existing affected tests as needed.
- Verification:
  - `node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs`
  - `node scripts/tests/test_0439_todo_subtable_view_snapshot_contract.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
  - `node scripts/tests/test_0412_todo_provider_app1_contract.mjs`
- Acceptance:
  - Every in-scope App appears as `{ table_id: "app:...", model_id: 0 }` for a principal.
  - No in-scope host positive source model appears in the user-facing Workspace registry.
  - Existing provider-owned installs still materialize as App tables.
- Rollback:
  - Revert the seeded migration registry and metadata normalizer changes.

## Step 3 — Snapshot Closure And Permission Isolation

- Scope:
  - Expand visible snapshot construction so a requested App table root includes only its reachable same-table model closure.
  - Keep bootstrap/visible access checks principal-scoped.
  - Add A/B tests that prove same-service concurrent users get different App table ids and cannot fetch each other's App table.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs`
  - Existing snapshot/principal tests as needed.
- Verification:
  - `node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs`
  - `node scripts/tests/test_0436_runtime_snapshot_build_latency_contract.mjs`
  - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
  - `node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs`
- Acceptance:
  - Visible snapshots include current App table data needed by the App view.
  - Visible snapshots do not include unrelated host positive Apps or another principal's App tables.
  - Cross-principal visible snapshot requests fail with 403.
- Rollback:
  - Revert visible snapshot expansion to single requested ref and keep the RED test as evidence.

## Step 4 — Frontend Projection And App Identity

- Scope:
  - Pass source host identity through Workspace registry entries and foreground App state for migrated App table entries.
  - Update frontend logic that currently relies on fixed host model ids, such as Matrix Chat foreground recognition.
  - Keep table-qualified launch/delete/export refs.
- Files:
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `packages/ui-model-demo-frontend/src/route_ui_projection.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - Existing frontend tests as needed.
- Verification:
  - `node scripts/tests/test_0440_slide_app_subtable_completion_contract.mjs`
  - `node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs`
  - `node scripts/tests/test_0383_matrix_suite_slide_app_contract.mjs`
  - `node scripts/tests/test_0405_todo_slide_app_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
- Acceptance:
  - Frontend opens migrated App table entries using table-qualified refs.
  - Source-template host ids are not required for user-facing cards.
  - Matrix Chat-specific UI affordances still target migrated Matrix Chat.
- Rollback:
  - Revert frontend source identity propagation and allowlist changes.

## Step 5 — Developer Documentation

- Scope:
  - Update the slide App runtime developer guide with a concrete subtable authoring and provider-owned bundle recipe.
  - Mention the migration boundary between source host templates, App table roots, `model.subtable`, `model.subtableconnection`, and visible snapshot loading.
- Files:
  - `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md`
  - `docs/iterations/0440-slide-app-subtable-completion/runlog.md`
- Verification:
  - Documentation contract checks if existing docs tests cover this guide.
  - Manual grep for required phrases and no obsolete host-positive advice in the edited section.
- Acceptance:
  - External software workers can see required labels, response shape, validation commands, and permission/snapshot expectations in one section.
- Rollback:
  - Revert the guide changes.

## Step 6 — Local Deploy And Browser Verification

- Scope:
  - Run the focused test suite and frontend build.
  - Redeploy local UI Server.
  - Use browser fake-login to open representative migrated Apps and confirm App table foreground refs.
  - Complete iteration status and merge to `dev` only after verification.
- Files:
  - `docs/iterations/0440-slide-app-subtable-completion/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - Focused deterministic commands from Steps 2-5.
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - Browser verification against local deployed UI.
- Acceptance:
  - Tests/build/deploy/browser checks pass.
  - Runlog contains PASS evidence and commit hashes.
  - `docs/ITERATIONS.md` is updated to `Completed`.
- Rollback:
  - Revert the iteration branch before merge, or revert the merge commit from `dev` if already merged.

## Notes

- Completed at: 2026-07-06
- Completion evidence: `docs/iterations/0440-slide-app-subtable-completion/runlog.md`
