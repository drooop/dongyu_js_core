---
title: "Iteration 0457 Feishu Message API v2 + Local DE Plan"
doc_type: iteration-plan
status: approved
updated: 2026-07-13
source: ai
iteration_id: 0457-feishu-message-api-v2-local-de
id: 0457-feishu-message-api-v2-local-de
phase: phase2
---

# Iteration 0457 Feishu Message API v2 + Local DE Plan

## Goal

Implement F-01 as a hard cut to formal `pin_payload.v2`, move Feishu resource/data/UI/task behavior from Tier 1 runtime special cases into a real R1 ModelTable actor, and prove the complete control/management paths with SSOT-conformant MBR/R1/WM1 actors plus local Matrix/MQTT services deployed in OrbStack.

## Approved Inputs and Source Baseline

- User decision recorded by 0456: the whole Feishu Message API input envelope moves to `pin_payload.v2`.
- User clarification for 0457: the test system and its MQTT/Matrix management/control infrastructure run locally in OrbStack; Feishu remains an allowed external connection rather than a prohibited dependency.
- User instruction for actors: MBR, R1, and related test roles must be rebuilt from current SSOT and fill-table definitions, not represented only by names or mocks.
- Upstream source: `feishu-message-api`, authority class `UpstreamConsensus`, URL recorded in `docs/ssot/feishu_source_watch_manifest.json`.
- Accepted 0454 source snapshot: SHA-256 `7b3576ab5ce70956859957b1271a0e7116e06f94b6664053fc2518788c39b52c`, 715 lines, 32857 bytes. 0457 uses this accepted evidence plus the 0456 adoption decision; it does not repeat source adoption or treat an optional read as a new baseline.

## Authority Conflict and User Resolution

- Conflict type: semantic.
- Conflict files:
  - `CLAUDE.md` currently says worker Model 0 `(0,0,0)` must carry `model.table`.
  - `docs/ssot/runtime_semantics_modeltable_driven.md`, `docs/ssot/label_type_registry.md`, and `docs/ssot/feishu_model_label_alignment_v1.md` say a software worker host-table Model 0 root uses `model.v1n`; ordinary table roots use `model.table`.
- Deciding role: User.
- Decision evidence:
  - `docs/ssot/feishu_model_label_alignment_v1.md` records the user's 2026-07-08 confirmation to implement worker-root `model.v1n`.
  - The user's current 0457 instruction requires real roles to be rebuilt from the current SSOT and fill-table method.
- Resolution for 0457:
  - Promote that decision into `CLAUDE.md` and `docs/architecture_mantanet_and_workers.md` before actor implementation.
  - A software worker host table Model 0 root uses `model.v1n`.
  - A non-worker/ordinary ModelTable root uses `model.table`.
  - Identity remains separate in `sys_worker_id:worker.id` and `sys_worker_role:worker.role`.
  - A contract test prevents the authority layers and role patches from diverging again.

## Current Facts / Differences

- Baseline commit is `e0c48fa`; 0457 is stacked after the unmerged 0454/0455/0456 chain.
- Docker and Kubernetes contexts are `orbstack`; the `dongyu` namespace currently has ready Mosquitto, Synapse, MBR, R1, WM1, and UI Server deployments.
- The current checker reports PASS while both MBR and UI Server bootstrap records point to remote `https://matrix.dongyudigital.com`; MBR fails to connect. Local Synapse returns HTTP 200 from the MBR pod. The current baseline is a false positive under the new all-local boundary.
- `deploy/env/local.env.example` also defaults to remote Matrix and remote OIDC.
- Current role patches have stable ids/roles but omit worker-root `model.v1n`.
- MBR keeps a business dispatch function on Model 0 and its runner writes directly to Model `-10` inbox labels before direct function execution.
- R1 can deliver MQTT packets directly to positive model pins when `mqtt_ingress_pin` is absent.
- Feishu resource/data/UI/task state and response logic currently live in `runtime.mjs` and write Model 0. This violates the project's Tier 2 and ownership rules even if parser tests pass.

### Execution-discovered Step 7 prerequisite (2026-07-13)

- The existing imported-app host egress adapter is not sufficient for the approved live acceptance:
  - every declared egress pin inherits one app-level `remote_bus_endpoint_v1.route_kind`, so one imported app cannot exercise both the control and management paths;
  - every emitted app record is remapped to business payload Model `1`, so required v2 envelope extensions such as `is_need_response` cannot reach envelope Model `0`;
- Step 7 therefore has a production prerequisite. It remains generic and fill-table-driven:
  - `dual_bus_model` may declare a validated `egress_routes` override per listed public output pin while `remote_bus_endpoint_v1.route_kind` remains the backward-compatible default;
  - `dual_bus_model` may declare `envelope_extension_keys`; the generated host adapter passes the declaration into internal `bus_send.v1`, lifts only exact declared root records, and keeps all other records in the business payload;
  - one shared generic rule module defines the extension-key grammar (`^[a-z][a-z0-9_]*$`), exact reserved keys/prefixes, a maximum of `16` declared keys, and a maximum key length of `64`; both UI Server import and runtime transport must use it;
  - generic Temporary ModelTable validation rejects duplicate root Cell/key records, so external formal v2 duplicates fail before any actor without naming Feishu fields;
  - generic internal `bus_send.v1` preserves only safe, declared, unique root extensions and rejects reserved, authority, legacy-routing, non-root, undeclared, duplicate, or records outside Model `0` and its one declared payload model;
  - generic formal `pin_payload.v2` keeps its existing bundle compatibility, including `bundle_record_id_offset` and inline positive model ids. The prerequisite adds only Model `0` duplicate/non-root structural rejection to that public validator.
- The legacy negative is a separate deployed public-boundary probe: the verifier publishes the exact removed outer packet to local Mosquitto and requires R1 Model 0 to expose `legacy_feishu_message_api_v1_removed` while Model 3200 state/output remains unchanged. It is not claimed as an imported App-table Model `0` positive-pin rejection.
- This amendment changes only the generic UI Server adapter, generic runtime transport, and their shared rule module. Model 3200 remains the sole validator/owner of Feishu extension types, required fields, and business behavior, but its current accepted payload schema is not narrowed or extended for this prerequisite; no new `unexpected_payload_model` behavior is added. MBR bridges only management requests/responses between Matrix and the control plane; it never echoes a control response.
- Step 7 may extend the existing R1 diagnostic log with non-secret, read-only evidence for Model 0 `mqtt_inbound_error`, a stable Model 3200 snapshot hash, and a stable Model 3200 `result` hash. This observability must not add a mutation/read API or alter actor state.

## Target Ownership and Data Chain

### Runtime / Tier 1

- Owns generic `pin_payload.v2` record, topic, endpoint, correlation, payload-model, and table-qualified reply validation.
- Explicitly rejects the old Feishu string-id `0/0.1` shape before it can fall through as generic Temporary ModelTable data.
- Does not identify Feishu by a global `sys_msg_type` marker.
- Does not own Feishu resource/data/UI/task state, business dispatch, Feishu-specific response construction/outbox state, or a standalone Feishu v2 parser.
- Retains generic formal v2 response materialization at the receiving host so table-qualified `reply_target_*` records can be applied by the target actor's own host boundary; Model 3200 never writes another actor directly.
- `runtime.js` remains the CJS shim over canonical `runtime.mjs`.

### R1 / Tier 2 Business Actor

- New patch: `deploy/sys-v1ns/remote-worker/patches/15_model3200_feishu_message_api.json`.
- Owner: R1 (`sys_worker_role=V1N`, `mqtt_worker_id=R1`).
- Model: positive child Model `3200`, root `model.submt`, registered type `Flow`.
- Public request pins: `resource`, `data`, `ui`, `add_task`, `add_task_return`, `edit_task`, `delete_task`, `receive_task`, `finish_task`, `archive_task`.
- Public response pin: `result`. F-08 remains pending: this iteration does not emit a dedicated `add_task_return` PIN message.
- Model 3200 owns Feishu catalog/data/UI/task state and observable handler results through its own labels.
- Model `-10` owns R1 endpoint dispatch configuration/function and routes Model 0 control ingress to Model 3200 parent connection pins. Positive models never receive MQTT directly.

### MBR / Tier 2 Bridge Actor

- MBR is a `DEM` software worker.
- Matrix input lands on Model 0 `pin.bus.mb.in`; MQTT/control input lands on Model 0 `pin.bus.cb.in`.
- Model 0 uses only bus pins, structural declarations, and `pin.connect.cell`; no business `func.js` remains there.
- Model `-10` owns bridge validation/routing functions and writes its own declared output pins via `V1N.addLabel` / `V1N.removeLabel` semantics.
- Parent connection pins return output to Model 0 `pin.bus.cb.out` / `pin.bus.mb.out`.
- Control request/response traffic runs directly between UI Server and R1 on local MQTT. MBR must reject/non-bridge control responses so the UI receives each response exactly once.
- Management requests run UI Server `mb.out` → MBR → R1 `cb.in`; management responses run R1 `cb.out` → MBR → UI Server `mb.in`, exactly once.

### WM1 and Test Driver

- WM1 remains a real `DEM` actor with worker-root `model.v1n`, legal split bus pins, and its existing Workspace Manager ModelTable capability. It is actor-conformance evidence, not the owner of Feishu business state.
- The E2E driver is a test-only ModelTable app installed into the live OrbStack UI Server through the existing import/Model 0 ingress path. Host-side Node/Bash only orchestrates and observes; it does not impersonate R1/MBR/WM1 or write their internal state.

## Formal Feishu v2 Input Schema

All records use the exact `{id,p,r,c,k,t,v}` shape with integer coordinates.

Envelope metadata is at numeric `id=0,p=0,r=0,c=0`:

- Required formal fields:
  - `__mt_payload_kind:str="pin_payload.v2"`
  - nonblank `__mt_request_id` or `op_id`; canonical emitters write both with the same value
  - `message_role:str="request"`
  - `bus:str="control"|"management"`
  - `route_kind:str="control"|"management"`, equal to `bus`
  - `topic`, `response_topic`
  - complete `endpoint_*`, `origin_*`, and `reply_target_*`, including `table_id`
  - `payload_model_id:int>0`
  - `timestamp:int`
- Feishu extension fields:
  - `is_need_response:bool` is required.
  - `message_server` is optional; when present it is `local|global`.
  - `between` is optional; when present it is `WSM_DEM|DEM_V1N`.
  - `send_user` and `receive_user` are required nonblank strings for `management`; optional for `control`.
- `response_topic` remains required and distinct from request `topic` even when `is_need_response=false`; the flag suppresses response emission, not transport address validation.
- Old `route_kind="manage"`, full-topic pin values, `response_pin`, dotted ids, child-table link records, nested `payload.v`, and omitted-table fallbacks are rejected.

The business payload uses `id=payload_model_id` in the same array:

- Its root includes `model_type:model.table` with a registered business type such as `Data` or `Flow`.
- Its root includes a documented `sys_msg_type`.
- The transport endpoint must be R1 Model 3200 and one of the actor's public pins. This endpoint is the Feishu API discriminator; a normal v2 packet at another endpoint never triggers Feishu behavior even if its payload contains a `sys_msg_type` label.

## Scope

In scope:

- Resolve and test the worker-root `model.v1n` authority conflict.
- Repair OrbStack baseline truth, local Matrix/MQTT bootstrap, and local authentication (`DY_AUTH=0` for acceptance; no remote OIDC/fake identity dependency).
- Rebuild MBR, R1, and WM1 role patches and runner boundaries through ModelTable/fill-table.
- Remove Feishu business state/dispatch/special response-outbox cases from Tier 1 and implement them in R1 Model 3200 while preserving generic v2 response materialization.
- Hard-cut the old v1 input; no v1 parser alias or compatibility conversion.
- Migrate 0442-0452 behavior tests to real actor-patch fixtures and add actor/boundary tests.
- Add non-secret runtime actor attestations derived from loaded ModelTable state/provenance so deployed identity, role, root form, models, and bus pins can be checked without a test-only mutation API.
- Rebuild all affected images/assets, deploy locally, and prove real v2 control and management request/response plus deployed v1 rejection.
- Add the generic host-egress prerequisite above with TDD and independent review before building the live fixture/verifier.
- Update SSOT/contract/backlog only after deployment acceptance and reviews satisfy the staged closeout gates.
- Allow an explicitly reported read-only Feishu source check; never write Feishu.

Out of scope:

- F-04 source edit: it stays `decision_recorded_source_correction_pending`; no alias and no Feishu write.
- F-05 `ui.refresh_data` write behavior.
- F-06 route autofill and permission directory.
- F-07 aggregate config/global-MQTT mapping.
- F-08 dedicated real `add_task_return` PIN behavior.
- Any Model 3200 schema or behavior change made only to satisfy the generic host-egress prerequisite.
- The independent outer wrapper `{version:"v1",type:"pin_payload"}` and unrelated historical `*.v1` names/files.
- Cloud/remote deployment, merge to `dev`, push, or PR creation.

## Invariants / Constraints

- ModelTable is actor/routing/state truth; strings and mocks are not actor evidence.
- Model 0 never owns user business logic or Feishu business state.
- External input follows Model 0 bus pin → `pin.connect.cell` → parent connection Cell → child root pin/function; response follows the reverse chain.
- All model behavior changes use `add_label` / `rm_label` semantics. UI is projection-only.
- Management pins are valid only for `DEM`; R1 as `V1N` has control pins only.
- Unit tests are required for TDD but do not complete the iteration. The SUT, services, actors, and test ModelTable app run in OrbStack; host runners only orchestrate/observe, consistent with 0175/0199 precedent.
- Except for an explicitly separated Feishu read, the acceptance window must make no remote Matrix, MQTT, OIDC, or SSO request.
- No standalone Feishu v2 parser duplicates the runtime validator; actor behavior is tested by loading/executing the actual patch.
- No current SSOT/backlog/manifest claim changes to aligned/completed until the prescribed acceptance/review gate.
- Every review records tier placement, model placement, data ownership, data flow, and data chain.
- Phase 3 requires three consecutive independent `Approved` plan reviews; any requested change resets the count.

## Success Criteria

- Highest contracts, runtime SSOT, label registry, and MBR/R1/WM1 patches agree on worker-root `model.v1n` versus ordinary `model.table`.
- Generic CJS/ESM runtime accepts formal v2, rejects legacy `0/0.1`, contains no Feishu resource/data/UI/task manager state or dispatch special case, and still materializes valid table-qualified v2 responses at the target host.
- R1 Model 3200 accepts the exact v2 schema at its public pins, owns all Feishu state, returns generic v2 results through `result`, suppresses output for `is_need_response=false`, and does not implement F-08.
- A normal v2 payload containing `sys_msg_type` at any non-3200 endpoint remains normal transport.
- Existing resource/data/UI/task state transitions are preserved in Model 3200; table-qualified reply targets survive response/materialization.
- Actor attestations and contract tests prove exact ids, roles, root forms, legal pins, model hierarchy, function placement, asset provenance, and no direct positive-model ingress.
- `check_runtime_baseline.sh` fails on non-`orbstack`, remote Matrix/MQTT/OIDC, wrong Synapse server name, placeholder/missing local credentials, missing deployments, or incomplete actor declarations.
- A fresh full rebuild/rollout uses local Synapse and Mosquitto, `DY_AUTH=0`, and no insecure TLS override; live Matrix/MQTT adapters connect.
- The live test ModelTable app sends one control request and one management request to R1 Model 3200; both produce observable v2 responses through the correct actor/bus chain. A deployed v1 request is visibly rejected.
- Acceptance evidence includes bounded logs showing no remote Matrix/OIDC/MQTT request during the test window.
- Active/current docs move to v2 without rewriting 0442/0448 history; F-04/F-05/F-06/F-07/F-08 states remain exact.
- F-01 becomes aligned/completed only after implementation commit, deployment PASS, full regression PASS, three implementation reviews, final state gates, and three final closeout reviews.
- No Feishu write occurs.

## Risks / Mitigations

- Legacy string-id payload falls through generic validation: keep a rejection-only detector before generic normalization and test CJS/ESM/live paths.
- Business migration changes behavior: migrate one family at a time with RED/GREEN tests against the actual Model 3200 patch.
- Model 3200 becomes a monolith: keep family functions/state labels separate inside one owning model; do not add runtime business hooks.
- R1 ingress remediation breaks existing endpoints: use a table-driven Model `-10` whitelist/dispatcher and run all existing provider plus live Model 100/3000 regressions.
- Local baseline still uses remote auth/identity: force `DY_AUTH=0`, local Synapse server name `localhost`, local generated credentials, and bounded no-remote log assertions.
- Deployment rollback loses prior assets/secrets/images or mutable service data: create and verify pre-0457 image tags, ignored-env/generated-env backups, role assets, UI Server persistence, a consistent Synapse SQLite/PVC snapshot, and Kubernetes secret/deployment snapshots before sync/rebuild; the E2E also uninstalls its test app on success.
- Host-egress prerequisite becomes a Feishu-specific runtime shortcut: keep route/extension handling declaration-driven and generic, reject reserved fields twice (adapter and runtime), and keep all Feishu type/required-field checks in Model 3200.

## Alternatives Considered

- Recommended: migrate Feishu business behavior to R1 Model 3200 and repair the local actor/bus truth in the same gated iteration. It is broad but is the only option that satisfies the explicit real-actor requirement.
- Parser/runtime-only migration: rejected because it retains Tier 1 business ownership and proves the wrong path.
- Treat any payload `sys_msg_type` as Feishu: rejected because the field is not a globally reserved discriminator.
- Add a dedicated runtime/standalone parser pair: rejected because it duplicates transport validation and preserves a runtime business seam.
- Keep v1 compatibility: rejected by the approved hard cut.
- Containerize host test executables: not required by current 0175/0199 precedent; it does not improve proof that the SUT/services/actors themselves run in OrbStack.

## Inputs

- Created at: 2026-07-10
- Iteration ID: 0457-feishu-message-api-v2-local-de
- Branch: `dropx/dev_0457-feishu-message-api-v2-local-de`
- Baseline: `e0c48fa`
