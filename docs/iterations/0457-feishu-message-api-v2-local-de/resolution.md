---
title: "Iteration 0457 Feishu Message API v2 + Local DE Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-07-13
source: ai
iteration_id: 0457-feishu-message-api-v2-local-de
id: 0457-feishu-message-api-v2-local-de
phase: phase2
---

# Iteration 0457 Feishu Message API v2 + Local DE Resolution

## Execution Strategy

Use RED/GREEN slices. Resolve the authority conflict first, then repair local baseline/actor boundaries, then migrate Feishu business ownership family by family into the actual R1 Model 3200 patch. Deploy the working tree only after deterministic tests pass. Current SSOT and F-01 state change only after live acceptance; contract close occurs in a later reviewed commit.

## Step 1 - Freeze RED Authority, Baseline, and Actor Contracts

- Create `scripts/lib/ssot_de_actor_test_helpers.mjs` to load actual system/role patches and derive non-secret actor identity, role, alias, topic base, root form, model mounts, and bus pins.
- Create `scripts/tests/test_0457_local_orbstack_de_actor_contract.mjs`.
- Extend `scripts/tests/test_0175_local_baseline_matrix_contract.mjs` and `scripts/tests/test_0364_system_refill_contract.mjs`.
- RED cases:
  - highest/current docs disagree on `model.table` versus worker-root `model.v1n`;
  - MBR/R1/WM1 lack `model.v1n`;
  - MBR business function remains on Model 0/direct Model `-10` inbox execution;
  - R1 lacks Model 0 control ingress and can write positive model pins from MQTT;
  - remote Matrix/OIDC local defaults and baseline false positive;
  - missing local Synapse `server_name=localhost` and actor attestation.
- Verify:
  - `node scripts/tests/test_0457_local_orbstack_de_actor_contract.mjs`
  - `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
  - `node scripts/tests/test_0364_system_refill_contract.mjs`
- Acceptance: every failure is the intended missing behavior, not a fixture/syntax error.
- Rollback: remove only new RED tests/helper.

## Step 2 - Resolve Worker-Root Authority and Local Baseline

- Modify exact authority/docs surfaces:
  - `CLAUDE.md`: worker host Model 0 uses `model.v1n`; ordinary ModelTable root uses `model.table`; local baseline is OrbStack/`dongyu`.
  - `docs/architecture_mantanet_and_workers.md`: add `model.v1n` to Model Forms and worker-root meaning.
  - `docs/ssot/runtime_semantics_modeltable_driven.md`: review only at this step; current Feishu input wording remains unchanged until live acceptance.
  - `docs/ssot/label_type_registry.md`: verify existing `model.v1n` wording; change only if the higher-layer resolution requires clarification.
  - `docs/ssot/tier_boundary_and_conformance_testing.md`: add/no-change decision for actor proof rules.
  - `docs/user-guide/modeltable_user_guide.md`: add/no-change decision for worker root/local baseline.
  - `scripts/ops/README.md`: update local baseline commands if it still permits remote test services.
- Modify local deployment surfaces:
  - `deploy/env/local.env.example`: local Synapse URL, `SYNAPSE_SERVER_NAME=localhost`, locally supplied credentials, `DY_AUTH=0`, no remote OIDC default.
  - `k8s/local/workers.yaml`: remove `NODE_TLS_REJECT_UNAUTHORIZED=0` from local UI/MBR.
  - `scripts/ops/check_runtime_baseline.sh`: exact `orbstack`, local Matrix/MQTT/auth bootstrap, local credentials, deployments, role-patch/root-form checks.
  - `scripts/ops/ensure_runtime_baseline.sh`: fail rather than silently select another context; add one explicit `--force-rebuild` path that invokes `deploy_local.sh` exactly once with image build enabled, then runs the checker.
- Re-run Step 1 baseline/authority tests to GREEN plus shell syntax checks.
- Acceptance: docs and executable local baseline agree; no behavior implementation has started.
- Rollback: revert this authority/local-baseline slice before any deployment.

## Step 3 - RED/GREEN MBR, R1, and WM1 Fill-Table Actors

- Tests first:
  - extend `scripts/tests/test_0196_mbr_triggerless_contract.mjs`;
  - extend `scripts/tests/test_0197_remote_worker_tier2_contract.mjs`;
  - extend `scripts/tests/test_0328_remote_worker_v1n_runtime_contract.mjs`;
  - extend `scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`;
  - extend `scripts/tests/test_0376_control_first_mbr_routing_contract.mjs` and `test_0379_explicit_management_route_contract.mjs`.
- Actor changes:
  - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`: add `model.v1n`, Model 0 management/control pins and parent connection pins; move bridge functions/wiring to Model `-10`; remove direct cross-model hostApi mutation paths.
  - `scripts/run_worker_v0.mjs`: adapters validate outer packets and write only Model 0 bus pins; no direct Model `-10` inbox or direct function invocation for message flow.
  - `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json`: add `model.v1n`, control ingress, Model `-10` endpoint route table/dispatcher, legal control output.
  - `deploy/sys-v1ns/remote-worker/patches/10_model100.json` through `14_model3100_slide_app_bundle_provider.json`: declare parent connection Cell boundary pins matching child root pins.
  - `scripts/run_worker_remote_v1.mjs`: use declared Model 0 ingress; remove direct positive-model delivery configuration if still needed after generic runtime changes.
  - `deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json`: add worker-root `model.v1n`; preserve existing WM1 Model 4000 chain.
  - Add non-secret actor-attestation logging derived after actual patch load in both worker runners.
- Actor side effects use declared pins and `V1N.addLabel`/`removeLabel`; no Model 0 business function.
- Freeze split-bus no-echo behavior: control request/response traffic is direct UI Server ↔ local MQTT ↔ R1 and MBR must not bridge it; management request is UI Server `mb.out` → MBR → R1 `cb.in`, while management response is R1 `cb.out` → MBR → UI Server `mb.in`, exactly once.
- Verify all named tests plus `node scripts/tests/test_0419_mbr_control_bus_ready_contract.mjs` and syntax checks.
- Acceptance: tier/model placement, owners, forward/response flow, and no-skip chain are explicit and GREEN.
- Rollback: revert runner/role patches together; no pods changed yet.

## Step 4 - Add F-01 Transport Hard-Cut RED Tests

- Create `scripts/tests/test_0457_feishu_message_api_v2_hard_cut.mjs`.
- Required CJS+ESM cases:
  - formal generic v2 accepted;
  - complete old Feishu `0/0.1` v1 rejected with explicit legacy reason;
  - old shape with only kind changed to v2 rejected;
  - missing/zero/string payload model, nested payload, duplicate metadata, missing table ids, topic mismatch, equal request/response topics, and `manage` rejected;
  - ordinary v2 with `sys_msg_type` at a non-3200 endpoint remains ordinary transport.
- Expected RED: legacy Feishu still receives the current special treatment and runtime still contains business dispatch/state.
- Acceptance: RED failures are exact.
- Rollback: remove new RED test.

## Step 5 - Make Tier 1 Generic and Remove the v1 Parser Surface

- Modify `packages/worker-base/src/runtime.mjs`:
  - retain one generic formal v2 validator;
  - add rejection-only detection for old Feishu string/dotted ids;
  - remove Feishu manager state, parser/dispatch, and Feishu-specific response-outbox special cases from Model 0;
  - retain generic `_materializePinPayloadResponse`-class behavior for valid formal v2 responses and table-qualified reply targets;
  - deliver valid v2 only through declared bus/pin chains.
- Review `packages/worker-base/src/runtime.js`; keep it as an unchanged CJS shim unless exports require adjustment.
- Delete `scripts/lib/feishu_message_api_v1.mjs`; create no standalone v2 parser.
- Re-run Step 4 to GREEN and generic transport/materialization regressions:
  - `test_0430_feishu_operational_ssot_contract.mjs`
  - `test_0332_modeltable_pin_payload_contract.mjs`
  - `test_0396_dual_topic_submit_response_contract.mjs`
  - `test_0375_unified_worker_model_topic_contract.mjs`
  - `test_0417_user_isolated_ui_state_projection_contract.mjs`
  - `test_0450_feishu_response_materialization.mjs` as generic v2 host materialization coverage
- Acceptance: runtime owns transport only and no test expects Model 0 Feishu business labels.
- Rollback: restore runtime/parser as one slice.

## Step 6 - RED/GREEN the R1 Model 3200 Feishu Actor by Family

- Create actual patch `deploy/sys-v1ns/remote-worker/patches/15_model3200_feishu_message_api.json`.
- Add Model 3200 mount, public pins, dispatcher functions, family-specific functions/state labels, response `result` pin, and R1 subscription/route entries.
- Use the exact schema in `plan.md`; endpoint Model 3200/public pin is the discriminator.
- Migrate tests to load the real actor patch, derive actor metadata, write through R1 Model 0 ingress, and observe Model 3200/result pins:
  - `test_0442_feishu_current_contract_alignment.mjs`
  - `test_0443_feishu_message_api_business_dispatch.mjs`
  - `test_0444_feishu_task_manager_processor.mjs`
  - `test_0445_feishu_resource_api_processor.mjs`
  - `test_0446_feishu_data_api_processor.mjs`
  - `test_0447_feishu_ui_api_processor.mjs`
  - `test_0448_feishu_message_api_response_outbox.mjs`
  - `test_0449_feishu_response_outbox_publish.mjs`
  - `test_0450_feishu_response_materialization.mjs`
  - `test_0452_feishu_response_e2e_smoke.mjs` (rename its claim to in-process actor regression, not deployment E2E).
- RED/GREEN order: envelope/dispatch → task → resource → data → UI → generic response/suppression → table-qualified response materialization.
- Explicit unchanged tests:
  - `is_need_response=false` still validates `response_topic` but emits no result;
  - `add_task` generic `result` is not a dedicated `add_task_return` message;
  - F-05 refresh remains pending behavior;
  - F-04/F-06/F-07 paths are untouched.
- Acceptance: all focused behavior is owned by Model 3200 and the former 51 behaviors plus new cases pass.
- Rollback: revert Model 3200 and migrated tests together.

## Step 6.5 - RED/GREEN the Generic Host-Egress Prerequisite

Code-state amendment recorded 2026-07-13: the approved Step 7 cannot run through the current imported-app adapter because all public egress pins share one route and the bridge remaps every record to business Model `1`. This is an execution-discovered prerequisite, not a change in Feishu ownership. Revision 4 was explicitly approved by the user after the workflow revision limit placed the iteration On Hold.

- Add RED contracts before production edits for:
  - one imported app with two declared public output pins, one routed through `pin.bus.cb.out` and the other through `pin.bus.mb.out`, exercised from the imported root pin through the generated `pin.connect.cell` / `pin.connect.label` chain rather than by directly invoking bridge code;
  - exact safe envelope extensions surviving into final `pin_payload.v2` Model `0`, while business records remain under the declared positive payload model;
  - default route compatibility, export/import/reapply round-trip, and fail-closed duplicate, unknown-pin, invalid-route, reserved-key, authority, legacy-route, non-root, and undeclared extension attempts, plus extra-model rejection only at the internal `bus_send.v1` materialization boundary;
  - generic formal v2 rejection of duplicate Model `0` Cell/key records, including duplicate Feishu extensions, without a Tier 1 Feishu-key list;
  - a verifier contract for exact removed dotted-id outer input through local Mosquitto → deployed R1 Model 0, with explicit rejection and unchanged Model 3200 state/output.
- Extend only generic declarations/boundaries:
  - `dual_bus_model.egress_routes` is an optional array of `{pin_name,route_kind}` overrides. Every pin must already appear exactly once in `egress_pins` and be a root `pin.out`; route kind is `control|management`. Resolution order is per-pin override, `remote_bus_endpoint_v1.route_kind`, then `control`.
  - `dual_bus_model.envelope_extension_keys` is an optional unique list of at most `16` keys. Each key is `1..64` characters and matches `^[a-z][a-z0-9_]*$`. The generated adapter lifts every matching exact `(id=0,p=0,r=0,c=0)` record, sends the declared-key list as internal `bus_send.v1` metadata, and remaps all other records, including non-root records with a declared key, to payload Model `1`; the same behavior is required for non-Feishu public pins.
  - shared generic rule module `packages/worker-base/src/pin_payload_envelope_extensions.mjs` is the only definition of safe keys. Reserved exact keys are `__mt_payload_kind`, `__mt_request_id`, `op_id`, `request_id`, `correlation_id`, `message_role`, `bus`, `bus_out_key`, `route_kind`, `topic`, `response_topic`, `timestamp`, `payload`, `payload_model_id`, `bundle_record_id_offset`, `worker_id`, `model_id`, `table_id`, `pin`, `principal_ref`, `principal_id`, `authority`, `identity`, `source_model_id`, `route`, `reply_to`, `route.reply_to`, `response_pin`, `return_topic`, `returnTopic`, `result_topic`, and the internal `envelope_extension_keys`. Reserved prefixes are `__mt_`, `endpoint_`, `origin_`, `reply_target_`, `principal_`, `owner_`, `payload_`, `response_`, `return_`, `route_`, `source_`, `model_`, and `sys_`.
  - generic `bus_send.v1` recognizes the internal declared-key list but never emits it externally. It accepts only declared safe root extensions, rejects duplicate root Cell/key records, non-root Model `0` metadata, records outside Model `0` or the declared positive payload model, and deep-clones extensions into generated `pin_payload.v2`.
  - generic formal `pin_payload.v2` validation rejects any duplicate Model `0` Cell/key record and any Model `0` non-root record. It otherwise preserves the existing `bundle_record_id_offset` and inline positive-model bundle semantics; Feishu type/required-field validation remains exclusively in Model 3200.
  - the deployed legacy negative uses the existing R1 bus/MQTT rejection-only detector; no positive App-table Model `0` claim, v1 parser, conversion, or compatibility is added.
- Production files are limited to `packages/ui-model-demo-server/server.mjs`, canonical `packages/worker-base/src/runtime.mjs`, and the shared generic rule module above; `runtime.js` remains the CJS shim. MBR and Model 3200 do not change for this prerequisite, and no new Model 3200 `unexpected_payload_model` rule is introduced.
- Preserve every existing imported-app default route/export/import behavior and generic transport regression.
- The Server state used by persistence/reapply tests exposes waitable startup readiness and idempotent shutdown; shutdown drains pending work, leaves runtime non-running, closes persistence and active adapters, and permits no late snapshot mutation or background warning.
- Obtain three consecutive independent `Approved` reviews of this amendment before GREEN implementation. Any requested change resets the count.
- Acceptance: reviewed RED is specific, GREEN passes focused and generic regressions, no Feishu-special parser/state appears in Tier 1, the live fixture can use one app for both buses, and the separate local MQTT probe proves deployed legacy rejection.
- Rollback: revert the three generic production files and their focused tests together. Step 8 also captures the pre-deploy UI image/persistence before any live rollout.

## Step 7 - Build the Live Test ModelTable App and OrbStack Verifier

- Create committed deterministic fixture `scripts/fixtures/0457/feishu_message_api_v2_orbstack_app_payload.json` as a test-only imported ModelTable app.
- It exposes control and management actions, emits exact v2 requests to R1 Model 3200 through its host-owned Model 0 egress, and receives table-qualified responses through the existing materialization chain.
- Create `scripts/test_e2e_0457_feishu_message_api_v2_orbstack.mjs`.
- The verifier:
  - requires Kubernetes context `orbstack`, passes the existing local runtime-baseline check, and confirms a ready local Synapse service plus local Mosquitto; it rejects remote MQTT/Matrix/OIDC/SSO endpoints while allowing only the approved `https://open.feishu.cn` Feishu host;
  - installs/uses the test app through existing host ingress, never direct actor mutation;
  - records both the acceptance start timestamp and the actual legacy publish timestamp;
  - checks actor attestations from MBR/R1/WM1 logs;
  - runs one control and one management request/response;
  - publishes a uniquely marked legacy v1 negative packet through local Mosquitto to the deployed R1 public control boundary, then proves R1 rejection and unchanged Model 3200 state/output;
  - reads that proof through the executable runtime rejection trace → shared stateful redacted emitter factory with an injected writer and an owned MQTT-trace cursor → verifier parser path and from a non-secret R1 diagnostic marker containing Model 0 `mqtt_inbound_error` fields plus stable SHA-256 values for the full Model 3200 snapshot and its root `result`; the runner has no local cursor/delta implementation or raw/direct trace serialization and must not add an API or write actor state;
  - binds the trace and error to the exact packet, marker, response topic, and publish timestamp; uses bounded tunnel-readiness and fresh-marker polling; then observes a conservative response-silence interval after fresh rejection evidence;
  - validates diagnostic schema and checks cumulative bounded logs/results for all fresh correlated event types with the production parsers, preserving an earlier accepted-ingress event even when a later rejection exists; every log read timeout is shorter than the overall poll bound;
  - awaits MQTT.js connect/SUBACK/publish/end callbacks, removes temporary listeners/timers on every settlement, keeps a managed post-connect error path, and ensures the adapter timeout completes before the outer probe timeout; the probe owns and disposes its response/error listeners on every outcome, and an MQTT error during the silence window invalidates acceptance; port-forward readiness/error/exit plus every MQTT/evidence stage have explicit timeouts;
  - attempts MQTT and tunnel cleanup exactly once each even when either cleanup itself fails, without hiding the primary acceptance failure;
  - fails on remote Matrix/MQTT/OIDC URLs in the acceptance window.
- Add a clean-checkout fixture guard: the verifier must resolve the committed fixture without ignored `test_files/` state or generated local snapshots.
- Package the shared diagnostic/trace helper in `k8s/Dockerfile.remote-worker`; migrate the existing remote-worker observability contract away from raw MQTT payload logging to the redacted marker contract.
- Unit-contract the verifier before deployment; do not claim E2E yet.
- Rollback: remove test fixture/verifier and revert the reviewed Step 6.5 generic prerequisite if the complete path is abandoned; no direct actor mutation API is added.

## Step 8 - Prepare and Verify Deterministic Local Rollback

- Before sync/build/deploy, create a timestamped backup outside the repo containing:
  - ignored `deploy/env/local.env` and `local.generated.env`;
  - `/Users/drop/dongyu/volume/persist/assets/` copied with metadata;
  - `/Users/drop/dongyu/volume/persist/ui-server/` copied from a quiesced UI Server or through a SQLite-consistent backup, including the database that receives imported apps;
  - a consistent Synapse database backup made with Python/SQLite backup semantics inside the Synapse pod, plus the PVC files required to restore that database; do not raw-copy a live SQLite file;
  - live `ui-server-secret`, `mbr-worker-secret`, affected deployments, and ConfigMaps as local operational snapshots;
  - current git SHA and image ids.
- Tag current images as:
  - `dy-ui-server:pre-0457-e0c48fa`
  - `dy-remote-worker:pre-0457-e0c48fa`
  - `dy-mbr-worker:pre-0457-e0c48fa`
- Verify backup files/databases are non-empty and readable, image tags resolve, and ignored env files remain untracked/un-staged.
- Rollback command contract: quiesce affected UI/Synapse pods, restore env/generated env, role assets, UI persistence and Synapse database/PVC state, restore saved secrets/manifests, retag pre-0457 images to active tags, restart affected local deployments, then run the old baseline check.
- Success cleanup contract: uninstall the imported 0457 test app through the normal host owner path and verify no app registry/model/table residue; do not restore the pre-test database on a successful run.
- Acceptance: rollback inputs and commands are factual before deployment; no rollback is executed unless deployment fails.

## Step 9 - Full OrbStack Rebuild and Live Acceptance

- Update only the ignored local env with local Synapse URL, `SYNAPSE_SERVER_NAME=localhost`, locally generated credentials, `DY_AUTH=0`, blank remote OIDC fields; do not commit it.
- Mandatory order:
  1. `test "$(kubectl config current-context)" = "orbstack"`
  2. `bash scripts/ops/ensure_runtime_baseline.sh --force-rebuild` (the only deployment entry; it performs one full `deploy_local.sh` build/sync/rollout and then checks)
  3. `bash scripts/ops/check_runtime_baseline.sh`
  4. `node scripts/test_e2e_0457_feishu_message_api_v2_orbstack.mjs`
  5. `bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900`
- The local deploy entry must apply both Synapse/Mosquitto manifests, restart both deployments before any rollout status check, and use the Synapse Matrix HTTP readiness probe so bootstrap cannot begin on a Kubernetes-only false ready.
- Inspect live deployments/logs and bounded no-remote assertions.
- Optional Feishu read: if the approved credential mechanism is available, run a read-only focused source check to a temporary output; label it external read evidence. Never substitute fixture output or write Feishu.
- On any failure: execute the Step 8 rollback, keep F-01 pending, fix via a new RED test, and repeat.
- On success: run the Step 8 test-app cleanup and verify persisted UI state contains no 0457 app residue.
- Acceptance: real local actors/services/buses pass with no remote dependency except optional Feishu read.

## Step 10 - Update Active SSOT and Create an Accepted Implementation Commit

- Only after Step 9 PASS, update exact current surfaces:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`: v2 public input, v1 fail-closed, Model 3200 owner/chain; preserve historical evidence.
  - `docs/ssot/feishu_model_label_alignment_v1.md`: add 0457 supersession; keep 0442/0448 history.
  - `docs/ssot/temporary_modeltable_payload_v1.md`: accepted/canonical schema matrix and Feishu extension section; retain filename.
  - `docs/ssot/feishu_alignment_decisions_v0.md`: implementation accepted locally but F-01 contract state not closed yet.
  - `docs/ssot/label_type_registry.md`, `docs/ssot/tier_boundary_and_conformance_testing.md`, `docs/user-guide/modeltable_user_guide.md`, `scripts/ops/README.md`: record exact update/no-change decisions.
- Add an executable current-vs-history guard rather than a broad `rg` that treats preserved history as failure.
- Run focused/full regressions, docs gate, syntax, `git diff --check`.
- Commit accepted implementation/SSOT evidence while F-01 remains pending final review.

## Step 11 - Three Consecutive Implementation Reviews

- Spawn three independent reviews of the accepted implementation commit and live evidence.
- Each review checks parser/transport, actor Tier/model/owner/flow/chain, local deployment evidence, no remote dependency, F-04-F-08 non-regression, and rollback.
- Any finding resets the count; fix with RED/GREEN, redeploy if affected, update the accepted commit, and restart reviews.
- Acceptance: three consecutive `Approved` results.

## Step 12 - Close F-01, Rebuild Contract Index, and Final Review

- After Step 11:
  - move F-01 to Completed in `docs/ssot/feishu_contract_backlog.md`;
  - set `feishu_message_api.input_version` aligned and remove only F-01 in `docs/ssot/contract_surface_manifest.json`;
  - route Model 3200 actor patch, runtime hard-cut test, actor conformance, and OrbStack E2E;
  - preserve F-04/F-05/F-06/F-07/F-08 exact states;
  - update `scripts/tests/test_0455_contract_surface_index.mjs`;
  - run `node scripts/ops/build_contract_index.mjs` to regenerate `contract_coverage_summary.md`.
- Run contract/docs/diff gates, then obtain three consecutive independent final closeout `Approved` reviews of the state change and complete diff. Any finding reopens F-01 pending until fixed.
- Update `runlog.md` and `docs/ITERATIONS.md` to Completed only after final approvals; create the closeout commit.
- No merge/push/PR.

## Required Verification Set

- Focused actor/F-01 tests from Steps 1-7.
- Revision 4 boundary contracts: `test_0457_pin_payload_envelope_extension_rules.mjs`, `test_0457_imported_host_egress_prerequisite.mjs`, `test_0457_remote_worker_diagnostic_contract.mjs`, and `test_0457_orbstack_e2e_verifier_contract.mjs`.
- Bundle compatibility required together: `test_0375_unified_worker_model_topic_contract.mjs`, `test_0376_control_first_mbr_routing_contract.mjs`, and `test_0384_provider_owned_slide_app_install_flow.mjs`.
- Generic transport: 0332, 0375, 0396, 0417, 0430.
- Actor/runtime: 0196, 0197, 0328, 0362, 0364, 0376, 0379, 0419.
- All 0442-0452 focused Feishu behavior files.
- `node scripts/tests/test_0455_contract_surface_index.mjs`.
- `node scripts/ops/validate_obsidian_docs_gate.mjs`.
- `git diff --check` and clean status appropriate to each commit boundary.
- Fresh OrbStack deploy, baseline, v2 control/management E2E, v1 rejection, Model100 control regression.

## Rollback

- Before deployment: revert logical code/docs slices.
- After deployment: use the verified Step 8 env/assets/secret/manifest/image backups, restart pods, and re-run the previous baseline.
- Never restore or preserve v1 compatibility code as a partial fix.
- If rollback is required, F-01 remains pending and the iteration cannot be Completed.
