---
title: "Iteration 0430 Feishu Operational SSOT Implementation Runlog"
doc_type: iteration-runlog
status: in-progress
updated: 2026-07-01
source: ai
iteration_id: 0430-feishu-operational-ssot-impl
id: 0430-feishu-operational-ssot-impl
phase: execution
---

# Iteration 0430-feishu-operational-ssot-impl Runlog

## Environment

- Date: 2026-07-01
- Branch: `dropx/dev_0430-feishu-operational-ssot-impl`
- Runtime: implementation iteration; no runtime/deploy/browser execution before
  Stage 0 review gate approval
- Base context:
  - `f07de69 docs(iterations): plan feishu operational ssot 0429`
  - `efbe412 docs(ssot): include feishu source review in 0428`
  - `8d9535a docs(ssot): freeze 0428 feishu model label plan`

## Review Gate Record

- Iteration ID: `0430-feishu-operational-ssot-impl`
- Review Date: 2026-07-01
- Review Type: User approval plus AI-assisted sub-agent
- Review Index: 1
- Decision: Approved
- Notes:
  - User said "ok,继续" after 0429 planning-only iteration was completed.
  - Sub-agent planning review approved Stage 0 plan before Stage 1
    implementation.

## Execution Records

### Stage 0.1: Create Implementation Branch And Scaffold

- Command:
  - `git switch -c dropx/dev_0430-feishu-operational-ssot-impl`
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0430-feishu-operational-ssot-impl --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output:
  - `Switched to a new branch 'dropx/dev_0430-feishu-operational-ssot-impl'`
  - `written .../docs/iterations/0430-feishu-operational-ssot-impl/plan.md`
  - `written .../docs/iterations/0430-feishu-operational-ssot-impl/resolution.md`
  - `written .../docs/iterations/0430-feishu-operational-ssot-impl/runlog.md`
- Result: PASS
- Commit: pending

### Stage 1.2: Sub-Agent Review And Fixes

- Command:
  - Spawned sub-agent with `codex-code-review` skill.
  - Edited docs with `apply_patch`.
- Key output:
  - Initial review decision: CHANGE_REQUESTED.
  - Finding: runlog checklist still marked Stage 1 docs as pending after Stage
    1 draft updates.
  - Fix: updated the checklist below to mark completed Stage 1 docs as done.
  - Additional local fix before re-review: completed example envelopes in
    `temporary_modeltable_payload_v1.md` and `modeltable_user_guide.md` so
    examples include required `topic`, `response_topic`, `route_kind`, and
    `endpoint_table_id` records where applicable.
- Follow-up review:
  - Decision: CHANGE_REQUESTED.
  - Finding: provider-owned bundle request/response examples still omitted
    required transport metadata records.
  - Fix: completed bundle request/response examples with `topic`,
    `response_topic`, `route_kind`, endpoint, origin, and reply target records.
- Final re-review:
  - Decision: APPROVED.
  - Findings: none.
  - Open questions: none.
  - Verification gaps: none.
- Result: PASS
- Commit: pending

### Stage 0.2: Write Implementation Plan

- Command:
  - Edited docs with `apply_patch`.
- Key output:
  - `plan.md` defines 0430 as the implementation of the 0429 blueprint.
  - `resolution.md` defines Stage 0 through Stage 7 with required sub-agent
    review after each implementation stage.
  - No runtime, fill-table, deployment, or browser work has run yet.
- Result: PASS
- Commit: pending

### Stage 0.3: Local Planning Checks

- Command:
  - `git diff --check -- docs/ITERATIONS.md docs/iterations/0430-feishu-operational-ssot-impl`
  - `rg -n --glob '!runlog.md' "\\[TODO\\]|Describe the iteration objective|Explain implementation approach|PLACEHOLDER|pending" docs/iterations/0430-feishu-operational-ssot-impl docs/ITERATIONS.md`
  - `node scripts/ops/obsidian_docs_migrate.mjs --root docs --phase all`
- Key output:
  - `git diff --check` returned no whitespace errors.
  - Placeholder search returned no matches.
  - Obsidian docs migration dry-run completed with `frontmatterAdded: 0`.
- Result: PASS
- Commit: pending

### Stage 0.4: Sub-Agent Planning Review

- Command:
  - Spawned sub-agent with `codex-code-review` skill.
- Key output:
  - Decision: APPROVED.
  - Findings: none.
  - Open questions: none.
  - Verification gaps: none.
- Result: PASS
- Commit: pending

### Stage 1.1: Operational SSOT Propagation Draft

- Command:
  - Edited docs with `apply_patch`.
  - `rg -n "pin_payload\\.v1|payload\\.v|bundle_payload\\.v|bundle_payload|model\\.v1n|model\\.subtableconnection|model\\.submtconnection|pin\\.connect\\.model" docs/ssot docs/user-guide/modeltable_user_guide.md`
  - `git diff --check -- docs/ssot docs/user-guide docs/iterations/0430-feishu-operational-ssot-impl`
  - `node scripts/ops/obsidian_docs_migrate.mjs --root docs --phase all`
- Key output:
  - `git diff --check` returned no whitespace errors.
  - Obsidian docs migration dry-run completed with `frontmatterAdded: 0`.
  - Operational examples in current docs now use `pin_payload.v2` and
    `payload_model_id`.
  - Remaining keyword hits are historical/negative statements, source-document
    references, or explicit rejection wording.
- Files changed:
  - `docs/ssot/temporary_modeltable_payload_v1.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/pin_connection_contract_v2.md`
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - `docs/ssot/ui_to_matrix_event_flow.md`
  - `docs/ssot/feishu_model_label_alignment_v1.md`
  - `docs/user-guide/modeltable_user_guide.md`
- Result: PASS
- Commit: pending

### Stage 2.1: Validation Contract Red Tests

- Command:
  - Created `scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`
    with TDD RED assertions only.
  - `node scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`
  - `node scripts/tests/test_bus_in_out.mjs`
  - `if [ -f scripts/tests/test_program_model_loader_v0.mjs ]; then node scripts/tests/test_program_model_loader_v0.mjs; else echo 'MISSING scripts/tests/test_program_model_loader_v0.mjs'; fi`
  - `node scripts/validate_program_model_loader_v0.mjs --case connect_allowlist`
  - `git add -N scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`
  - `git diff --check -- scripts/tests/test_0430_feishu_operational_ssot_contract.mjs docs/iterations/0430-feishu-operational-ssot-impl/runlog.md`
- Key output:
  - New test failed as expected before implementation:
    - `removed_model_v1n must be rejected`
    - `pin_payload.v2 record array must be accepted as Model 0 bus out value`
    - current rejection reason for v2 nested / missing table id is still
      `invalid_payload_kind`
    - current runtime rejects flat stale `pin_payload.v1` through the wrong
      legacy nested-payload reason (`bus_in_invalid_nested_payload`) instead of
      explicit `bus_out_legacy_pin_payload_kind_removed`
  - `node scripts/tests/test_bus_in_out.mjs` passed: `7 passed, 0 failed out
    of 7`
  - Planned `scripts/tests/test_program_model_loader_v0.mjs` is not present in
    this repo.
  - Nearest existing validator `node scripts/validate_program_model_loader_v0.mjs --case connect_allowlist`
    failed on current baseline with `connect: missing pin.connect.label route`;
    this failure is recorded for visibility but is not caused by the new test
    file.
  - `git diff --check` returned no whitespace errors after intent-to-add made
    the new test file visible to the diff checker.
  - After sub-agent review, the management bus accepted-shape case was fixed to
    declare `sys_worker_role=DEM` and use `bus=management` /
    `route_kind=management` for `pin.bus.mb.out`; the RED test still fails for
    the intended unimplemented v2 runtime reasons.
  - After follow-up review, missing `origin_table_id` and missing
    `reply_target_table_id` assertions were split into separate test functions
    so Stage 3 GREEN evidence can isolate both failure paths.
  - After final review returned `CHANGE_REQUESTED`, the stale
    `pin_payload.v1` assertion was changed to cover flat `pin_payload.v1`
    without depending on nested `payload.v`; nested formal payload removal stays
    covered by the separate `pin_payload.v2` nested-payload test.
- Final sub-agent re-review:
  - Decision: APPROVED.
  - Findings: none.
  - Open questions: none.
  - Verification gaps to carry into Stage 3:
    - Stage 2 test imports CJS runtime only; Stage 3 closeout must add or run an
      ESM-equivalent check for `packages/worker-base/src/runtime.mjs`.
    - Planned `scripts/tests/test_program_model_loader_v0.mjs` is absent and
      fallback validator currently fails on baseline; Stage 3 must record a
      clean substitute verifier or explicitly retire the missing command in the
      iteration evidence.
- Coverage:
  - Rejected label types: `model.v1n`, `model.subtableconnection`,
    `model.submtconnection`, `pin.connect.model`.
  - Target accepted shape: `pin_payload.v2` Temporary ModelTable record array
    with `payload_model_id` for both `pin.bus.cb.out` and `pin.bus.mb.out`.
  - Removed nested formal shape: `payload.v` containing ModelTable records.
  - App instance table qualification: missing `origin_table_id` and missing
    `reply_target_table_id` as separate RED cases.
  - Removed stale formal transport: flat `pin_payload.v1`.
- Result: RED as intended; final sub-agent review approved before runtime
  changes.
- Commit: pending

### Stage 3.1: Runtime And Server Hard-Cut

- Command:
  - `node scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`
  - `node --check packages/worker-base/src/runtime.mjs`
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `node scripts/tests/test_cell_connect_parse.mjs`
  - `node scripts/tests/test_bus_in_out.mjs`
  - `node scripts/validate_builtins_v0.mjs`
  - `node scripts/validate_program_model_loader_v0.mjs --case connect_allowlist`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `git diff --check -- packages/worker-base/src/runtime.mjs packages/ui-model-demo-server/server.mjs scripts/tests/test_0430_feishu_operational_ssot_contract.mjs scripts/validate_builtins_v0.mjs scripts/validate_program_model_loader_v0.mjs`
- Key output:
  - 0430 contract now passes for CJS and ESM runtime:
    - removed Feishu labels are rejected:
      `model.v1n`, `model.subtableconnection`,
      `model.submtconnection`, `pin.connect.model`.
    - `pin_payload.v2` record-array values are accepted for
      `pin.bus.cb.out` and DEM-only `pin.bus.mb.out`.
    - stale `pin_payload.v1`, nested `payload.v`, missing
      `origin_table_id`, and missing `reply_target_table_id` fail closed.
    - `mt_bus_send` now accepts non-nested `bus_send.v1` input with
      `payload_model_id` and emits `pin_payload.v2` without `payload.v`.
    - server `parsePinPayloadRecordEnvelope` and
      `parsePrincipalRuntimePinPayload` accept the v2 non-nested shape and
      reject removed v1/nested shapes.
  - Syntax checks returned no output.
  - `test_cell_connect_parse`: `8 passed, 0 failed out of 8`.
  - `test_bus_in_out`: `7 passed, 0 failed out of 7`.
  - `validate_builtins_v0`: all listed validation cases passed, including
    removed `pin.connect.model`.
  - `validate_program_model_loader_v0 --case connect_allowlist`: PASS.
  - `validate_ui_ast_v0x --case all`: `summary: PASS`.
  - `git diff --check` returned no whitespace errors.
- Sub-agent review:
  - Initial decision: CHANGE_REQUESTED.
  - Findings:
    - server receive handlers still consumed `parsedEnvelope.nestedPayload`;
      accepted v2 packets would not materialize owner labels or install provider
      bundles.
    - Workspace Manager provider bundle request builder still emitted
      `pin_payload.v1` with nested `payload.v`.
    - Mgmt Bus Console request builder still emitted `pin_payload.v1` with
      nested `payload.v`.
    - server direct bus-payload validation still treated `pin_payload.v2` as
      malformed.
    - positive-model pins only validated `pin_payload.v1`, not malformed v2.
  - Fixes:
    - `parsePinPayloadRecordEnvelope` / `parsePrincipalRuntimePinPayload`
      consumers now use `payloadRecords`.
    - Workspace Manager bundle request builder now emits `pin_payload.v2` plus
      `payload_model_id` and business records in `id=1`.
    - Mgmt Bus Console builder now emits `pin_payload.v2` plus
      `payload_model_id` and business records in `id=1`.
    - server direct bus payload validation accepts only valid
      `pin_payload.v2` and rejects stale v1 / nested payloads.
    - positive-model `pin.in` / `pin.out` family validates malformed v2 with
      the same explicit codes.
  - Added contract coverage:
    - Workspace Manager bundle request builder emits v2 non-nested records.
    - Mgmt Bus Console builder emits v2 non-nested records.
    - direct bus payload validation accepts v2 and rejects v1/nested.
    - positive-model pin rejects malformed v2 missing `payload_model_id`.
  - Follow-up verification:
    - `node scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`:
      PASS, including all CJS/ESM runtime and server builder/parser cases.
    - Syntax, cell connect, bus in/out, builtins, program loader, UI AST, and
      `git diff --check` commands above still PASS after fixes.
  - Second review decision: CHANGE_REQUESTED.
  - Finding:
    - generated imported slide-app host egress bridge still wrote
      `mt_bus_send_in` as nested `payload.v`, so installed slide app button
      egress would be rejected by the new runtime.
  - Fix:
    - `materializeImportedHostEgressAdapter` now generates bridge code that
      maps app-provided payload records into payload model `id=1`, writes
      `payload_model_id=1`, expands `...payloadRecords`, and does not write
      `payload`.
    - 0430 contract now executes the generated bridge function, checks its
      `mt_bus_send_in` value is non-nested, and proves runtime `mt_bus_send`
      turns it into `pin_payload.v2`.
  - Second follow-up verification:
    - `node scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`:
      PASS, including generated imported host egress bridge coverage.
    - Syntax, cell connect, bus in/out, builtins, program loader, UI AST, and
      `git diff --check` commands above still PASS after the bridge fix.
  - Final Stage 3 re-review:
    - Decision: APPROVED.
    - Findings: none.
    - Open questions: none.
    - Verification gaps: none.
- Files changed:
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`
  - `scripts/validate_builtins_v0.mjs`
  - `scripts/validate_program_model_loader_v0.mjs`
- Carry-forward to Stage 4:
  - Project-owned fill-table assets and server business builders still contain
    active `pin_payload.v1` / nested `payload.v` construction paths. These are
    not compatibility fallbacks; they must be rewritten in the Tier2 refit
    stage before local deployment/browser E2E.
  - After review fixes, active runtime/server builders in Stage 3 scope no
    longer emit `pin_payload.v1`; remaining v1 hits are explicit rejection
    paths, historical tests, docs, and project-owned fill-table assets to refit.
- Result: PASS; sub-agent review approved.

### Stage 4.1: Active Fill-Table Patch Refit

- Command:
  - `node scripts/validate_mbr_patch_v0.mjs`
  - `node scripts/validate_model100_records_e2e_v0.mjs`
  - `node scripts/tests/test_0328_remote_worker_v1n_runtime_contract.mjs`
  - `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
  - `node scripts/tests/test_0377_workspace_manager_de_contract.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
  - `node scripts/tests/test_0412_todo_provider_app1_contract.mjs`
  - `node scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`
  - `node --input-type=module <func.js compile check for active sys-v1ns patches>`
  - `rg -n "pin_payload\\.v1|model\\.v1n|model\\.subtableconnection|model\\.submtconnection|pin\\.connect\\.model|\\\"payload\\\"\\s*:\\s*\\{|\\\"payload\\\"\\s*:\\s*\\[" deploy/sys-v1ns packages/worker-base/system-models || true`
  - `git diff --check -- deploy/sys-v1ns packages/worker-base/system-models scripts/tests scripts/validate_mbr_patch_v0.mjs scripts/validate_model100_records_e2e_v0.mjs scripts/lib docs/iterations/0430-feishu-operational-ssot-impl`
- Key output:
  - MBR patch validator: `TOTAL: 108  PASS: 108  FAIL: 0`.
  - Model 100 E2E validator: `PASS: model100 temporary-modeltable E2E (MBR -> mqttIncoming -> D0 function)`.
  - Remote worker runtime contract: `3 passed, 0 failed out of 3`.
  - Workspace Manager DEM contract: `9 passed, 0 failed out of 9`.
  - Provider-owned install flow: `8 passed, 0 failed out of 8`.
  - Todo provider app1 contract: all five listed checks passed.
  - 0430 operational SSOT contract: `0430 FEISHU OPERATIONAL SSOT CONTRACT PASSED`.
  - Function syntax check: `PASS: 12 func.js labels compile across active sys-v1ns patches`.
  - Removed-shape scan returned no active hits in `deploy/sys-v1ns` or
    `packages/worker-base/system-models`.
  - `git diff --check` returned no whitespace errors.
- Files changed:
  - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
  - `deploy/sys-v1ns/remote-worker/patches/10_model100.json`
  - `deploy/sys-v1ns/remote-worker/patches/11_model1010.json`
  - `deploy/sys-v1ns/remote-worker/patches/12_model1019.json`
  - `deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json`
  - `deploy/sys-v1ns/remote-worker/patches/14_model3100_slide_app_bundle_provider.json`
  - `deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json`
  - `scripts/lib/pin_payload_v2_test_helpers.mjs`
  - `scripts/tests/test_0328_remote_worker_v1n_runtime_contract.mjs`
  - `scripts/tests/test_0377_workspace_manager_de_contract.mjs`
  - `scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
  - `scripts/tests/test_0412_todo_provider_app1_contract.mjs`
  - `scripts/validate_mbr_patch_v0.mjs`
  - `scripts/validate_model100_records_e2e_v0.mjs`
- Notes:
  - Active MBR, RemoteWorker R1, Workspace Manager, provider bundle service,
    and Todo provider tests now use `pin_payload.v2` as a non-nested Temporary
    ModelTable record array with `payload_model_id`.
  - `origin_table_id`, `reply_target_table_id`, and `payload_model_id` are
    required by the refitted request/response packets.
  - The provider-owned minimal Submit bundle no longer uses the old local
    `ui_bind_json.write.pin = click_event` path; its button emits
    `bus_event_v2` through the host-generated bus ingress key.
- First Stage 4 review:
  - Decision: CHANGE_REQUESTED.
  - Findings:
    - active parsers still allowed missing table-qualified references to fall
      back to `host`;
    - provider bundle response still used nested `bundle_payload` JSON.
- Fixes after review:
  - Runtime/server parsers now require explicit `endpoint_table_id`,
    `origin_table_id`, and `reply_target_table_id`; missing table refs reject
    at the boundary instead of falling back to `host`.
  - Runtime/server legacy metadata scans no longer special-case nested
    slide-app `bundle_payload`.
  - Provider bundle response now returns `bundle_record_id_offset` in the
    business payload and appends the actual bundle records to the same
    Temporary ModelTable array with offset ids.
  - Server installer decodes provider bundle records from the same response
    record array using `bundle_record_id_offset`.
  - Direct bus-pin validation and MQTT endpoint rejection now write visible
    ModelTable errors (`bus_in_error` / `bus_out_error` /
    `mqtt_inbound_error`) through normal `addLabel` semantics so invalid
    packets are rejected without silent failure.
- Second Stage 4 review:
  - Decision: CHANGE_REQUESTED.
  - Finding:
    - `scripts/run_worker_v0.mjs` still validated worker bootstrap Matrix/MQTT
      packets as removed `pin_payload.v1` with nested `payload`.
- Fix after second review:
  - `run_worker_v0` now validates bootstrap packets as `pin_payload.v2`
    record arrays with `payload_model_id`, explicit `endpoint_table_id`,
    `origin_table_id`, and `reply_target_table_id`; it rejects v1 and nested
    `payload`.
  - `test_0375_unified_worker_model_topic_contract.mjs` now covers runner
    bootstrap acceptance/rejection on strict v2, missing table refs, and
    provider bundle offset records.
  - `test_0396_dual_topic_submit_response_contract.mjs` now uses v2 endpoint
    packets and flat `bus_send.v1` payload records.

### Stage 4.2: Active Patch Refit Review Fix Verification

- Command:
  - `node scripts/validate_mbr_patch_v0.mjs`
  - `node scripts/validate_model100_records_e2e_v0.mjs`
  - `node scripts/tests/test_0328_remote_worker_v1n_runtime_contract.mjs`
  - `node scripts/tests/test_0377_workspace_manager_de_contract.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
  - `node scripts/tests/test_0396_dual_topic_submit_response_contract.mjs`
  - `node scripts/tests/test_0412_todo_provider_app1_contract.mjs`
  - `node scripts/tests/test_0430_feishu_operational_ssot_contract.mjs`
  - `node --input-type=module <func.js compile check for active sys-v1ns patches>`
  - `rg -n "pin_payload\\.v1|model\\.v1n|model\\.subtableconnection|model\\.submtconnection|pin\\.connect\\.model|\\\"payload\\\"\\s*:\\s*\\{|\\\"payload\\\"\\s*:\\s*\\[" deploy/sys-v1ns packages/worker-base/system-models || true`
  - `rg -n "\\\"k\\\"\\s*:\\s*\\\"bundle_payload\\\"|mt\\('bundle_payload'|mt\\(\\\"bundle_payload\\\"|payloadJson\\([^\\n]*'bundle_payload'" deploy/sys-v1ns packages/worker-base/src packages/ui-model-demo-server/server.mjs scripts/run_worker_v0.mjs || true`
  - `git diff --check`
- Key output:
  - MBR patch validator: `TOTAL: 126  PASS: 126  FAIL: 0`.
  - Model 100 E2E validator: `PASS: model100 temporary-modeltable E2E (MBR -> mqttIncoming -> D0 function)`.
  - Remote worker runtime contract: `4 passed, 0 failed out of 4`.
  - Workspace Manager DEM contract: `10 passed, 0 failed out of 10`.
  - Provider-owned install flow: `9 passed, 0 failed out of 9`.
  - Unified worker/model topic contract: `74 passed, 0 failed out of 74`.
  - Dual-topic submit/response contract: `PASS test_0396_dual_topic_submit_response_contract`.
  - Todo provider app1 contract: all five listed checks passed.
  - 0430 operational SSOT contract: `0430 FEISHU OPERATIONAL SSOT CONTRACT PASSED`.
  - Function syntax check: `PASS func.js compile 12`.
  - Removed-shape scans returned no active hits.
  - `git diff --check` returned no whitespace errors.
- Final Stage 4 re-review:
  - Decision: APPROVED.
  - Findings: none.
  - Open questions: none.
  - Verification gaps: none.
- Result: PASS; sub-agent review approved.

## Docs Updated / Assessed

- [x] `docs/ssot/feishu_model_label_alignment_v1.md` used as source
- [x] `docs/iterations/0429-feishu-model-label-operational-ssot/resolution.md`
  used as source blueprint
- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` updated in Stage 1
- [x] `docs/ssot/label_type_registry.md` updated in Stage 1
- [x] `docs/ssot/pin_connection_contract_v2.md` updated in Stage 1
- [x] `docs/ssot/temporary_modeltable_payload_v1.md` updated in Stage 1
- [x] `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` updated
  in Stage 1
- [x] `docs/ssot/ui_to_matrix_event_flow.md` updated in Stage 1
- [x] `docs/user-guide/modeltable_user_guide.md` assessed/updated in Stage 1
