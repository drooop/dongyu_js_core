---
id: 0364
title: ui-egress-bus-init-impl
doc_type: iteration_runlog
status: Completed
updated: 2026-05-10
source: ai
branch: dev_0364-ui-egress-bus-init-impl
iteration_id: 0364-ui-egress-bus-init-impl
phase: phase3
---

# Runlog

## Environment

- Date: 2026-05-10
- Branch: `dev_0364-ui-egress-bus-init-impl`
- Base note: branch includes latest local completed docs/planning branches `0365`, `0366`, and `0367` on top of `dev`, so implementation uses the newest local project rules.

## Execution Records

### Step 1 - Iteration Setup

- Action: Created iteration scaffold, filled plan/resolution/runlog, and prepared iteration index registration.
- Verification: `git diff --check` PASS.
- Review: sub-agent `codex-code-review` APPROVED with no findings, no open questions, no verification gaps.
- Result: PASS.

### Step 2 - Runtime Contract

- RED: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs` failed before runtime changes with 5/5 failures for removed old bus pins, split placement, DEM role validation, inbound type preservation, and `mt_bus_send` output type.
- Change: Runtime now rejects `pin.bus.in` / `pin.bus.out`, accepts `pin.bus.cb.*` only on Model 0 root, accepts `pin.bus.mb.*` only on DEM Model 0 root, stores split bus family in port registries, preserves inbound split type, and emits split bus output from `mt_bus_send`.
- Test updates: Runtime-facing tests were hard-cut from old bus pins to `pin.bus.cb.*` or `pin.bus.mb.*`; old bus pin rejection is covered by the new 0364 test.
- Verification:
  - `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs` PASS.
  - `node scripts/tests/test_bus_in_out.mjs` PASS.
  - `node scripts/tests/test_0322_runtime_bus_out_cleanup.mjs` PASS.
  - `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs` PASS.
  - `node scripts/tests/test_0177_runtime_mode_contract.mjs` PASS.
  - `node scripts/tests/test_0142_integration.mjs` PASS.
  - `node scripts/tests/test_0158_new_label_types.mjs` PASS.
  - `node scripts/tests/test_0306_runtime_mailbox_ingress_contract.mjs` PASS.
  - `node scripts/tests/test_0357_pin_connection_hard_cut.mjs` PASS.
  - `node scripts/tests/test_cell_connect_parse.mjs` PASS.
  - `node scripts/validate_builtins_v0.mjs` PASS.
- Review: sub-agent `codex-code-review` APPROVED with no findings, no open questions, no verification gaps.
- Result: PASS.

### Step 3 - Installer / Importer / UI Server

- RED: `node scripts/tests/test_0364_slide_import_bus_binding_contract.mjs` failed before server changes because UI Server did not seed `is_DEM`, provider-owned `ui.egress.binding.v1` was accepted, and generated host adapters still used old unsplit bus pins.
- Change: UI Server now seeds DEM role, provider ZIP validation rejects split bus pins and `ui.egress.binding.v1`, installer generates `pin.bus.mb.in` / `pin.bus.mb.out`, generated bridge requests explicit `bus=management`, and installer writes host-owned `ui.egress.binding.v1`.
- Change: Program engine Matrix bridge now scans split bus out labels, and direct Model 0 event paths use `pin.bus.mb.in`.
- Change: Filltable policy and management bus projection were updated to split-bus types.
- Verification:
  - `node scripts/tests/test_0364_slide_import_bus_binding_contract.mjs` PASS.
  - `node scripts/tests/test_0326_imported_host_egress_bridge.mjs` PASS.
  - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs` PASS.
  - `node scripts/tests/test_0362_slide_app_self_described_route_contract.mjs` PASS.
  - `node scripts/tests/test_0326_ui_event_busin_flow.mjs` PASS.
  - `node scripts/tests/test_0155_prompt_filltable_policy.mjs` PASS.
  - `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs` PASS.
  - `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs` PASS.
  - `node scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs` PASS.
  - `node scripts/tests/test_0306_submit_fallback_server_flow.mjs` PASS.
- Review: sub-agent `codex-code-review` APPROVED with no findings, no open questions, no verification gaps.
- Result: PASS.

### Step 4 - System Fill-Table And Existing UI Models

- RED: `node scripts/tests/test_0364_system_refill_contract.mjs` failed before refill because worker identity/role labels were missing and active UI models still referenced removed `pin.bus.in` / `pin.bus.out`.
- Change: Kept the shared system seed free of worker identity/role, added explicit `v1n_id` / `is_DEM` to the MBR, remote-worker, and UI-side worker role patches, and made UI Server seed its own `v1n_id` / `is_DEM` at boot.
- Review fix: First Step 4 review found that writing `v1n_id` in the shared system seed locked later role patches; fixed by moving identity entirely to role patches and adding an actual-load-order assertion.
- Review fix: Second Step 4 review found UI Server identity was not explicitly covered; fixed by seeding UI Server `v1n_id` and adding actual boot assertions.
- Change: Updated active UI/prompt models to teach `pin.bus.cb.*` / `pin.bus.mb.*`, and updated workspace UI docs/projections from old unsplit bus text to management-bus text.
- Verification:
  - `node scripts/tests/test_0364_system_refill_contract.mjs` PASS.
  - `node scripts/tests/test_0364_slide_import_bus_binding_contract.mjs` PASS.
  - `node scripts/tests/test_0326_imported_host_egress_bridge.mjs` PASS.
  - `node scripts/tests/test_0170_bun_and_filltable_prompt_contract.mjs` PASS.
  - `node scripts/tests/test_0298_pin_cleanup_contract.mjs` PASS.
  - `node scripts/tests/test_0362_slide_app_self_described_route_contract.mjs` PASS.
  - `node scripts/validate_ui_ast_v0x.mjs --case all` PASS.
  - JSON parse smoke over touched system/deploy/test payload files PASS.
- Review: sub-agent `codex-code-review` first requested fixes for shared `v1n_id` lock and missing UI Server identity coverage; after both fixes, re-review APPROVED with no findings, no open questions, no verification gaps.
- Result: PASS.

### Step 5 - Minimal Submit And Docs

- RED: Updated docs contract tests to require split bus wording; `node scripts/tests/test_0364_docs_split_bus_contract.mjs`, `node scripts/tests/test_0350_slide_app_runtime_user_guide_contract.mjs`, and `node scripts/tests/test_0337_slide_flow_docs_contract.mjs` failed on old `pin.bus.in` / `pin.bus.out` wording.
- Change: Updated slide runtime developer guide, visualized HTML, minimal Submit docs, current user guides, runtime SSOT, label registry, temporary payload SSOT, imported slide ingress SSOT, UI-to-Matrix SSOT, PIN contract, and worker architecture docs to the 0364 split-bus contract.
- Change: Added a dedicated docs split-bus contract test and kept the minimal Submit ZIP fixture as a single `app_payload.json` ModelTable record array with provider-owned UI, `remote_bus_endpoint_v1`, `dual_bus_model`, and no host-owned bus/binding labels.
- Review fix: First Step 5 review found two provider-facing import docs only banned management bus pins; fixed both docs to also ban control bus pins and `ui.egress.binding.v1`, and extended `test_0364_docs_split_bus_contract.mjs` to cover this.
- Verification:
  - `node scripts/tests/test_0364_docs_split_bus_contract.mjs` PASS.
  - `node scripts/tests/test_0350_slide_app_runtime_user_guide_contract.mjs` PASS.
  - `node scripts/tests/test_0337_slide_flow_docs_contract.mjs` PASS.
  - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs` PASS.
  - `node scripts/tests/test_0362_slide_app_self_described_route_contract.mjs` PASS.
  - `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs` PASS.
  - `node scripts/tests/test_0352_slide_app_provider_visualized_docs_contract.mjs` PASS.
  - `node scripts/tests/test_0353_slide_app_runtime_docs_publish_contract.mjs` PASS.
  - `node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs` PASS.
  - `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs` PASS.
  - `rg -n "0364 前|current window|current migration surface|pin\.bus\.in|pin\.bus\.out" docs/ssot docs/user-guide docs/architecture_mantanet_and_workers.md -g '!node_modules'` returned no matches.
  - JSON/ZIP smoke confirmed `test_files/minimal_submit_dual_bus.zip` contains the same 61-record payload as `test_files/minimal_submit_dual_bus_app_payload.json`.
- Review: sub-agent `codex-code-review` first requested fixes for incomplete provider-facing forbidden lists; after the fix, re-review APPROVED with no findings, no open questions, no verification gaps.
- Result: PASS.

### Step 6 - Local Deploy And Browser E2E

- Action: Rebuilt frontend and redeployed the local stack through the local deployment entrypoint.
- Verification:
  - `npm -C packages/ui-model-demo-frontend run build` PASS.
  - `npm -C packages/ui-model-demo-frontend run test` PASS.
  - `bash scripts/ops/deploy_local.sh` PASS; local service available at `http://localhost:30900`.
  - `bash scripts/ops/check_runtime_baseline.sh` PASS; `mosquitto`, `synapse`, `remote-worker`, `mbr-worker`, `ui-server`, and `ui-side-worker` all ready.
- Browser verification at `http://127.0.0.1:30900/#/workspace`:
  - E2E color generator: opened from Workspace, entered `0364 browser color check`, clicked `Generate Color`, observed color changed from `#FFFFFF` to `#7938a1` and status `processed`.
  - Mgmt Bus Console: opened from Workspace, sent `0364 mgmt browser 1778419809853` to `@mbr:localhost`, observed transcript entries `[sent sent]` and `[received received] ack from @mbr:localhost`, and the event timeline outbound count increased.
  - Minimal Submit built-in app: opened model `1050`, entered `0364 seeded minimal 1778419936456`, clicked `Submit`, observed `Submitted: 0364 seeded minimal 1778419936456` and `remote_status=remote_processed`.
  - Slide app import flow: opened `滑动 APP 导入`, uploaded `test_files/minimal_submit_dual_bus.zip`, observed new model `1054`, confirmed generated bridge includes `bus=management`, `route`, and `pin.bus.mb.out`, then submitted `0364 imported zip 1778420004125` and observed `Submitted: 0364 imported zip 1778420004125` with `remote_status=remote_processed`.
- Cleanup: Local browser state contained old imported test copies `1051`-`1053` created before the new installer contract; the failing copy had a historical bridge without `bus`/`route`. Deleted those stale local copies through the Workspace UI, then confirmed live snapshot has no `pin.bus.in`, `pin.bus.out`, or `pin.connect.model`, and all remaining imported bridges include `bus` and `route`.
- Review: sub-agent `codex-code-review` APPROVED with no findings, no open questions, no verification gaps.
- Result: PASS.

### Step 7 - Final Closure

- Action: Ran consolidated final verification across runtime, importer, system refill, docs, frontend, and local deployment readiness.
- Verification:
  - Runtime suite PASS: `test_0364_bus_pin_split_runtime_contract`, `test_bus_in_out`, `test_0322_runtime_bus_out_cleanup`, `test_0332_modeltable_pin_payload_contract`, `test_0177_runtime_mode_contract`, `test_0142_integration`, `test_0158_new_label_types`, `test_0306_runtime_mailbox_ingress_contract`, `test_0357_pin_connection_hard_cut`, `test_cell_connect_parse`, and `validate_builtins_v0`.
  - Importer / console / event suite PASS: `test_0364_slide_import_bus_binding_contract`, `test_0326_imported_host_egress_bridge`, `test_0361_minimal_submit_import_export_contract`, `test_0362_slide_app_self_described_route_contract`, `test_0326_ui_event_busin_flow`, `test_0155_prompt_filltable_policy`, `test_0336_mgmt_bus_console_contract`, `test_0339_mgmt_bus_console_live_projection_contract`, `test_0341_mgmt_bus_console_event_projection_contract`, and `test_0306_submit_fallback_server_flow`.
  - System refill suite PASS: `test_0364_system_refill_contract`, `test_0170_bun_and_filltable_prompt_contract`, `test_0298_pin_cleanup_contract`, and `validate_ui_ast_v0x --case all`.
  - Docs / minimal Submit suite PASS: `test_0364_docs_split_bus_contract`, `test_0350_slide_app_runtime_user_guide_contract`, `test_0337_slide_flow_docs_contract`, `test_0351_slide_app_minimal_provider_guide_contract`, `test_0352_slide_app_provider_visualized_docs_contract`, `test_0353_slide_app_runtime_docs_publish_contract`, `test_0359_minimal_submit_matrix_e2e_contract`, and `test_0360_minimal_submit_dual_bus_docs_contract`.
  - Frontend PASS: `npm -C packages/ui-model-demo-frontend run build` and `npm -C packages/ui-model-demo-frontend run test`.
  - Hygiene PASS: `git diff --check`.
  - Local readiness PASS: `bash scripts/ops/check_runtime_baseline.sh`.
- Review fix: Final closure review found stale top-level guidance and frontend local/demo bus writes still referencing the removed unsplit bus pins. Fixed `CLAUDE.md`, `local_bus_adapter.js`, `gallery_store.js`, `demo_modeltable.js`, and the visual draft files, then expanded `test_0298_pin_cleanup_contract.mjs` to scan those surfaces.
- Review-fix verification:
  - `node scripts/tests/test_0298_pin_cleanup_contract.mjs` PASS.
  - `node scripts/tests/test_0326_ui_event_busin_flow.mjs` PASS.
  - `node scripts/tests/test_0306_submit_fallback_server_flow.mjs` PASS.
  - `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs` PASS.
  - `node scripts/tests/test_0364_system_refill_contract.mjs` PASS.
  - `node scripts/tests/test_0364_docs_split_bus_contract.mjs` PASS.
  - `npm -C packages/ui-model-demo-frontend run build` PASS.
  - `npm -C packages/ui-model-demo-frontend run test` PASS.
  - `rg -n "pin\\.bus\\.in|pin\\.bus\\.out" CLAUDE.md packages/ui-model-demo-frontend/src deploy/sys-v1ns packages/worker-base/system-models test_files docs/user-guide docs/ssot -g '!node_modules'` returned no matches.
  - `git diff --check` PASS.
- Review fix 2: Re-review found that local/demo front-end runtimes wrote `pin.bus.mb.in` but did not seed `is_DEM=true`, so valid management-bus events would still be rejected. Fixed `createDemoStore()` and standalone/local `createGalleryStore()` to seed Model 0 DEM role, and added positive local-adapter/store assertions.
- Review-fix-2 verification:
  - `node scripts/tests/test_0326_ui_event_busin_flow.mjs` PASS.
  - `npm -C packages/ui-model-demo-frontend run test` PASS.
  - `git diff --check` PASS.
- Review: sub-agent `codex-code-review` first requested fixes for stale top-level/frontend bus surfaces and local/demo DEM seeding; after both fixes, re-review APPROVED with no findings, no open questions, no verification gaps.
- Status: Updated 0364 artifacts and iteration index to `Completed`.
- Result: PASS.

## Review Gates

- Step 1: APPROVED.
- Step 2: APPROVED.
- Step 3: APPROVED.
- Step 4: APPROVED after requested fixes.
- Step 5: APPROVED after requested fix.
- Step 6: APPROVED.
- Step 7: APPROVED after requested fixes.

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/ssot/label_type_registry.md` reviewed
- [x] `docs/user-guide/slide-app-runtime/` reviewed
