---
title: "Iteration 0417-user-isolated-ui-state-projection Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-06-18
source: ai
iteration_id: 0417-user-isolated-ui-state-projection
id: 0417-user-isolated-ui-state-projection
phase: phase3
---

# Iteration 0417-user-isolated-ui-state-projection Runlog

## Environment

- Date: 2026-06-11
- Branch: `dropx/dev_0417-user-isolated-ui-state-projection`
- Runtime: Phase 1 planning only; no runtime code changed before review gate.

## Execution Records

### Phase 0 / Phase 1 Planning

- Command: `git switch -c dropx/dev_0417-user-isolated-ui-state-projection`
- Key output: `Switched to a new branch 'dropx/dev_0417-user-isolated-ui-state-projection'`
- Result: PASS
- Commit: pending

- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0417-user-isolated-ui-state-projection --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output: generated `plan.md`, `resolution.md`, `runlog.md`
- Result: PASS
- Commit: pending

### Review Gate Records

Review Gate Record
- Iteration ID: `0417-user-isolated-ui-state-projection`
- Review Date: 2026-06-11
- Review Type: AI-assisted sub-agent
- Review Index: 1
- Decision: Change Requested
- Notes: sub-agent required broader isolation test coverage, submit path proof through Model 0 / pin / bus, and explicit conformance checks per stage.

Review Gate Record
- Iteration ID: `0417-user-isolated-ui-state-projection`
- Review Date: 2026-06-11
- Review Type: AI-assisted sub-agent
- Review Index: 2
- Decision: Change Requested
- Notes: sub-agent found the auxiliary `docs/plans/2026-06-11-user-isolated-ui-state-projection.md` did not mirror second-round stronger test/conformance requirements.

Review Gate Record
- Iteration ID: `0417-user-isolated-ui-state-projection`
- Review Date: 2026-06-11
- Review Type: AI-assisted sub-agent
- Review Index: 3
- Decision: Approved
- Notes: sub-agent approved 0417 plan/resolution/runlog/docs plan; Phase 3 execution may start.

## Step Records

### Step 1 — Contract Tests and Baseline Inventory

- Command: `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
- Key output:
  - Contract reviews found gaps twice, so Step 1 test was strengthened before implementation.
  - `FAIL test_principal_workspace_runtime_isolation` — `server must export createPrincipalRuntimeRegistry`
  - `FAIL test_guest_is_read_only` — `server must export createPrincipalRuntimeRegistry`
  - `FAIL test_default_input_submit_policy_is_local_only` — default Input still dispatched one ModelTable write
  - `FAIL test_submit_reads_visible_local_overlay_and_keeps_bus_path` — Input did not stage overlay before submit
  - `FAIL test_dialog_tabs_and_view_state_are_local_only` — Dialog/Tabs local state still dispatched business writes
  - `FAIL test_pending_lock_blocks_duplicate_submit` — duplicate submit dispatched twice
  - `FAIL test_local_state_does_not_force_large_snapshot_patch` — local-only UI state still dispatched server write
  - `FAIL 7/7`
- Result: PASS as expected-fail baseline for Step 1 TDD contract
- Commit: pending
- Conformance evidence:
  - Tier placement: expected-fail baseline separates renderer-local state, server runtime selection, and ModelTable business truth.
  - Model placement: expected-fail baseline shows per-principal runtime selection is not implemented yet.
  - Data ownership: expected-fail baseline shows user-owned runtime state is not isolated yet.
  - Data flow: expected-fail baseline now requires Input staging -> Submit -> server `submitEnvelope` -> Model 0 `pin.bus.cb.in`, and current code does not satisfy it.
  - Data chain: expected-fail baseline now requires response materialization via `reply_target_principal_key` into the selected user runtime, and current code does not satisfy it.

### Step 1 Review

- Review Index 1: Change Requested
- Findings:
  - response materialization was simulated by direct label write instead of testing `reply_target_*`;
  - submit test stopped at renderer mailbox instead of server Model 0 bus ingress;
  - submit overlay was manually seeded instead of produced by Input;
  - Tabs/local page state and pending release were under-tested;
  - local-state patch test only proved generic small patch, not local-only no-write.
- Fix: strengthened `scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs` accordingly.
- Review Index 2: Change Requested
- Findings:
  - `materialized_result` was still pre-written before response handling;
  - Model 0 bus pin value was not checked for the visible Input payload;
  - response routing only targeted the first/default principal;
  - Dialog/Tabs staged ref/value were not asserted;
  - pending state registration and error/timeout release were under-tested.
- Fix: removed pre-written materialized result, added Alice/Bob response routing, asserted Model 0 bus payload contents, asserted staged refs/values, and expanded pending registration plus success/error/timeout release checks.
- Review Index 3: Change Requested
- Findings:
  - response packet endpoint and reply target were identical, so the test could not prove use of `reply_target_model_id` / `reply_target_pin`;
  - principal key derivation was not asserted, so an email-first implementation could pass.
- Fix: response now uses endpoint topic `U1/0/cb_in` while materializing by `reply_target_model_id=9417` / `reply_target_pin=result`; test also proves same subject with changed email maps to the same runtime and same email with different subject maps to a different runtime.
- Review Index 4: Change Requested
- Findings:
  - response materialization did not prove `reply_target_pin` was honored;
  - Model 0 bus payload did not prove `__mt_payload_kind` was preserved;
  - pending error/timeout release did not assert disabled state was cleared.
- Fix: added wrong `reply_target_pin` rejection, asserted Model 0 payload keeps `__mt_payload_kind=ui_event.v1`, and asserted pending error/timeout both clear `loading` and `disabled`.
- Review Index 5: Change Requested
- Findings:
  - renderer bus event label did not assert `p=0,r=0,c=0`;
  - valid response coverage used only `reply_target_model_id=9417`, so hardcoded model routing could pass.
- Fix: asserted renderer bus event label targets `(0,0,0)` and added a second valid Alice response targeting model `9517` to prove `reply_target_model_id` is honored.
- Review Index 6: Approved
- Notes: sub-agent approved Step 1 contract test and expected-fail baseline.

### Step 2

- Change:
  - Added server-side principal runtime registry and response materialization.
  - Connected real `/snapshot`, `/stream`, `/bus_event`, `/ui_event`, runtime mode, media, and slide-app export paths to the request principal runtime instead of the shared server state.
  - Added renderer-local default Input staging, submit overlay reads, Dialog/Tabs local-state staging, and pending-state locking.
  - Added real `remote_store` support for renderer `fallbackCommitPolicy` and declared pending state APIs.
  - Strengthened response validation so response packets require `response_topic` and response `topic === response_topic`.
- Command: `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
- Key output:
  - `PASS principal_workspace_runtime_isolation`
  - `PASS guest_is_read_only`
  - `PASS default_input_submit_policy_is_local_only`
  - `PASS submit_reads_visible_local_overlay_and_keeps_bus_path`
  - `PASS dialog_tabs_and_view_state_are_local_only`
  - `PASS pending_lock_blocks_duplicate_submit`
  - `PASS local_state_does_not_force_large_snapshot_patch`
  - `PASS real_remote_store_supports_local_overlay_and_pending_host_contract`
  - `PASS start_server_routes_snapshot_and_events_by_principal_runtime`
  - `PASS 9/9`
- Result: PASS
- Command: `node scripts/tests/test_0403_principal_authorization.mjs`
- Key output: `All principal authorization tests passed.`
- Result: PASS
- Command: `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
- Key output: `14 passed, 0 failed out of 14`
- Result: PASS
- Command: `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
- Key output: `provider-owned slide app install flow contract passed (5 assertions)`
- Result: PASS
- Command: `node scripts/tests/test_0396_dual_topic_submit_response_contract.mjs`
- Key output: `PASS test_0396_dual_topic_submit_response_contract`
- Result: PASS
- Command: `node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs`
- Key output: `PASS test_0409_todo_mqtt_egress_docs_contract`
- Result: PASS
- Command: `node scripts/tests/test_0414_snapshot_delta_sse_contract.mjs`
- Key output: `PASS test_0414_snapshot_delta_sse_contract: 7 passed`
- Result: PASS
- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output: `✓ built`
- Result: PASS

### Step 2 Review

- Review Tool: sub-agent with `codex-code-review` (first pass)
- Review Decision: Change Requested
- Finding:
  - `packages/ui-model-demo-server/server.mjs` — response packets without `response_topic`, or whose `response_topic` did not equal the delivered response topic, could still materialize into a principal runtime.
- Fix:
  - Added negative tests for missing `response_topic` and mismatched `response_topic`.
  - Required response payload `response_topic` to be a valid control topic and to equal the actual delivered response topic.
- Follow-up Command: `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
- Key output: `PASS 8/8`
- Result: PASS
- Review Tool: sub-agent with `codex-code-review` (second pass)
- Review Decision: Change Requested
- Findings:
  - Real server endpoints still used shared `state` instead of the principal runtime selected by the request.
  - Real `remote_store` ignored renderer-provided `fallbackCommitPolicy=on_submit`, so default Input overlay could be missed outside the mock host.
  - Real `remote_store` did not expose pending-state APIs, so declared Button pending state did not affect real UI behavior.
- Fix:
  - Added principal runtime selection in `startServer` for snapshot, stream, event writes, runtime mode, media, and slide-app export paths.
  - Added principal-aware control-bus response handling before the legacy/global fallback.
  - Added `fallbackCommitPolicy` handling plus `setPendingState` / `getPendingState` / `resolvePendingState` / `clearPendingState` to `remote_store`.
  - Added 0417 tests using real `remote_store` and real HTTP/OIDC Alice/Bob sessions.
- Follow-up Command: `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
- Key output: `PASS 9/9`
- Result: PASS
- Conformance evidence:
  - Tier placement: renderer-local state is staged in UI host state unless explicitly committed, while formal submit still enters Model 0 bus ingress.
  - Model placement: response packets materialize only through `reply_target_principal_key` plus `reply_target_model_id` into an existing target model.
  - Data ownership: guest access is read-only, and each authenticated/local principal resolves to an isolated mutable runtime entry; HTTP Alice/Bob sessions prove snapshot/event state does not cross principals.
  - Data flow: Input/Dialog/Tabs local UI state does not write business labels per interaction; submit sends one `bus_event_v2` label at Model 0 root.
  - Data chain: response packets must be temporary ModelTable records with `__mt_payload_kind=pin_payload.v1`, `message_role=response`, matching `topic` and `response_topic`, `route_kind=control`, and a valid reply target.
- Commit: pending

## Docs Updated

- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
- [ ] `docs/ssot/ui_to_matrix_event_flow.md` reviewed
- [ ] `docs/ssot/label_type_registry.md` reviewed
