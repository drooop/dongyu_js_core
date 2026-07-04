---
title: "Iteration 0434 Slide App Subtable First Migration Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-07-03
source: ai
iteration_id: 0434-slide-app-subtable-first-migration
id: 0434-slide-app-subtable-first-migration
phase: phase3
---

# Iteration 0434-slide-app-subtable-first-migration Resolution

## Execution Strategy

Use the existing 0432 App table machinery instead of inventing another path. The target app is `E2E 颜色生成器`. First add a contract test that expects this app to be materialized as a child App table and not as `host|100` in the desktop registry. Then implement the smallest server/runtime bootstrap change that creates a child App table from the existing host model labels, writes the host-side `model.subtableconnection`, and filters the host model out of workspace app presentation. Finally deploy locally and verify in a real browser.

## Step 1 — Register plan and prove the current failure

- Scope: Planning docs and RED contract test only.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0434-slide-app-subtable-first-migration/plan.md`
  - `docs/iterations/0434-slide-app-subtable-first-migration/resolution.md`
  - `docs/iterations/0434-slide-app-subtable-first-migration/runlog.md`
  - `scripts/tests/test_0434_first_slid_in_app_subtable_contract.mjs`
- Verification:
  - `node scripts/tests/test_0434_first_slid_in_app_subtable_contract.mjs`
- Acceptance:
  - The new test fails for the expected reason: `E2E 颜色生成器` is still exposed as a host-table workspace app or no child App table exists for it.
- Rollback:
  - Remove the 0434 iteration docs entry and the new test file.

## Step 2 — Materialize the first slid-in app as an App table

- Scope: Convert only `E2E 颜色生成器` desktop/app registry presentation to a child App table.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js` if local-mode parity requires it
  - `scripts/tests/test_0434_first_slid_in_app_subtable_contract.mjs`
  - Existing tests that currently encode `host|100` as a valid workspace app entry, including:
    - `scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs`
    - `scripts/tests/test_0382_workspace_entry_cleanup_contract.mjs`
- Verification:
  - `node scripts/tests/test_0434_first_slid_in_app_subtable_contract.mjs`
  - `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs`
  - `node scripts/tests/test_0382_workspace_entry_cleanup_contract.mjs`
  - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
  - `node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build` if frontend files are changed
- Acceptance:
  - `E2E 颜色生成器` is visible as a child table root `{ table_id, model_id: 0 }`.
  - `host|100` is not visible as a workspace app entry.
  - Shared workspace allowlists do not require `100` as a first-class workspace entry.
  - The host `model.subtableconnection` value points to the migrated app table with `root_model_id: 0` and `mount_kind: "slide_app"`.
  - The connection Cell remains a relationship boundary only, not a business-label holder.
  - Duplicate subtable mount/index rules remain enforced.
- Rollback:
  - Revert the Step 2 code/test changes and rerun the existing 0425/0432 tests.

## Step 3 — Local deployment and browser verification

- Scope: Restart/redeploy the local stack and verify the desktop/app open path.
- Files:
  - `docs/iterations/0434-slide-app-subtable-first-migration/runlog.md`
- Verification:
  - Local HTTP root returns 200.
  - Fake login works when enabled for local testing.
  - Real browser opens desktop and then the migrated `E2E 颜色生成器`.
  - Snapshot evidence shows `E2E 颜色生成器` specifically selected/opened as non-host `{ table_id, model_id: 0 }`.
- Acceptance:
  - The migrated app opens without the foreground loader getting stuck.
  - No direct UI truth write or legacy model connection path is introduced.
- Rollback:
  - Restore previous local runtime database/deploy inputs if local migration state blocks UI testing.

## Notes

- Generated at: 2026-07-03
