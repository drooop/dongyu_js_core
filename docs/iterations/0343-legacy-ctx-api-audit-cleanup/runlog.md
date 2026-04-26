---
title: "0343 — Legacy Ctx API Audit Cleanup Run Log"
doc_type: iteration-runlog
status: completed
updated: 2026-04-27
source: ai
iteration_id: 0343-legacy-ctx-api-audit-cleanup
id: 0343-legacy-ctx-api-audit-cleanup
phase: implementation
---

# Iteration 0343-legacy-ctx-api-audit-cleanup Runlog

## Environment

- Date: 2026-04-26
- Branch: `dev_0343-legacy-ctx-api-audit-cleanup`
- Runtime: local repository audit; deploy/restart required only if active server/runtime code changes affect local app behavior.

## Execution Records

### Step 1

- Command: `rg -n "ctx\\.(writeLabel|getLabel|rmLabel)\\b|\\b(writeLabel|getLabel|rmLabel)\\s*[:=]\\s*(async\\s*)?\\(" packages deploy scripts -g '!node_modules' -g '!scripts/tests/**' -g '!**/*.legacy*'`
- Key output: active hits identified in deploy role patches, WorkerEngineV0, server ProgramModelEngine compatibility ctx, Model 100 fixtures, and intent validation harnesses; historical docs and `.legacy` files were kept out of active scope.
- Result: PASS after classification; active production surfaces required code changes.
- Commit: pending

### Step 2

- Command: active code/model/deploy cleanup
- Key output:
  - Removed `ctx.getLabel/writeLabel/rmLabel` from WorkerEngineV0 and server ProgramModelEngine compatibility surfaces.
  - Migrated MBR and UI-side worker role functions to `ctx.hostApi` / `V1N.table` paths.
  - Migrated Model 100 active functions and related validation harnesses off legacy ctx methods.
  - Fixed adjacent pin payload compatibility shapes in `run_worker_remote_v0.mjs`, `intent_handlers_home.json`, and workspace prepare handlers so non-empty `pin.in/out` values are temporary ModelTable arrays.
  - Tightened temporary ModelTable payload validation: records must include `v` and must not carry legacy top-level `op` / `model_id`.
  - Removed `directEventV0` MQTT ingress acceptance in `mt_v0` mode; legacy event envelopes are now rejected with a trace reason.
  - Replaced owner request `request/op/model_id` payload wrappers with `write_labels` / `remove_labels` payload labels.
  - After sub-agent review, closed the remaining server external direct-pin gap: direct pin submits into negative/system models now reject non-ModelTable object values while runtime-internal system control values remain unchanged.
- Result: PASS; no active production scan hits remain.
- Commit: pending

### Step 3

- Command: `node scripts/tests/test_0343_no_active_legacy_ctx_api.mjs`
- Key output: `[PASS] no_active_legacy_ctx_api scanned=177`
- Result: PASS; new guard covers active legacy ctx API reintroduction and obvious object-valued pin writes.
- Commit: pending

### Step 4

- Commands:
  - `node scripts/validate_mbr_patch_v0.mjs`
  - `node scripts/validate_intent_dispatch_pin_v0.mjs`
  - `node scripts/validate_intent_dispatch_mgmt_v0.mjs`
  - `node scripts/tests/test_0143_e2e.mjs`
  - `node scripts/tests/test_0144_remote_worker.mjs`
  - `node scripts/tests/test_0161_worker_engine_funcjs.mjs`
  - `node scripts/tests/test_0198_ui_side_worker_patch_first_contract.mjs`
  - `node scripts/tests/test_0245_scoped_privilege_runtime_contract.mjs`
  - `node scripts/tests/test_0248_cross_model_pin_owner_materialization_contract.mjs`
  - `node scripts/tests/test_0249_home_crud_pin_contract.mjs`
  - `node scripts/tests/test_0249_home_crud_pin_migration_contract.mjs`
  - `node scripts/tests/test_0266_scoped_patch_runtime_contract.mjs`
  - `node scripts/tests/test_0270_workspace_ui_filltable_remote_mode_contract.mjs`
  - `node scripts/tests/test_0283_matrix_userline_phase1_contract.mjs`
  - `node scripts/tests/test_0290_slide_app_filltable_create_contract.mjs`
  - `node scripts/tests/test_0302_slide_app_zip_import_contract.mjs`
  - `node scripts/tests/test_0325_v1n_api_shape.mjs`
  - `node scripts/tests/test_0325c_generator_rewrite.mjs`
  - `node scripts/tests/test_0328_remote_worker_v1n_runtime_contract.mjs`
  - `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
  - `node scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
  - `node scripts/tests/test_0343_no_active_legacy_ctx_api.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `git diff --check`
  - `SKIP_IMAGE_BUILD=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
- Key output:
  - All listed deterministic tests and validators passed.
  - `test_0332_modeltable_pin_payload_contract.mjs` passed 29/29, including rejection of legacy `op/model_id` temporary records, missing `v`, and legacy event v0 MQTT envelopes.
  - `test_0249_home_crud_pin_contract.mjs` now covers negative/system direct pin object rejection and ModelTable-array acceptance through `createServerState().submitEnvelope()`.
  - Frontend build completed.
  - Local deploy completed at `http://localhost:30900`.
  - Runtime baseline reported all required deployments ready and no terminating app pods.
- Result: PASS; local deployment is refreshed.
- Commit: pending

### Review Records

- First sub-agent review: CHANGE_REQUESTED.
  - Finding: server external direct pin submit could still write object payloads into negative/system model `pin.in`.
  - Fix: tightened `normalizeDirectPinValue` for `target.model_id < 0` and strengthened server-side temporary payload validation to reject missing `v`, `op`, and `model_id`.
  - Re-verification: `test_0249_home_crud_pin_contract.mjs`, `test_0249_home_crud_pin_migration_contract.mjs`, `test_0270_workspace_ui_filltable_remote_mode_contract.mjs`, `test_0332_modeltable_pin_payload_contract.mjs`, `test_0342_mgmt_bus_console_real_messaging_contract.mjs`, `test_0343_no_active_legacy_ctx_api.mjs`, frontend build, `git diff --check`, local deploy, and baseline all passed.

## Docs Updated

- [x] `docs/ITERATIONS.md` updated to record 0343 status.
- [x] `docs/iterations/0343-legacy-ctx-api-audit-cleanup/runlog.md` updated with audit and verification evidence.
