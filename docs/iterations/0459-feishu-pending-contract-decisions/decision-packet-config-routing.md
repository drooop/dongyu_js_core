---
title: "Iteration 0459 Config And Routing Decision Packet"
doc_type: change-proposal
status: on_hold
updated: 2026-07-19
source: ai
iteration_id: 0459-feishu-pending-contract-decisions
id: 0459-feishu-pending-contract-decisions-config-routing-packet
packet_id: 0459-PKT-CR-r14288-r5951-v1
packet_version: 1
decision_status: frozen_on_hold
---

# Iteration 0459 Config And Routing Decision Packet

> Authority notice: this packet is a proposal, not repository SSOT, an adopted decision, implementation authorization, or Feishu-write authorization. Until an exact user choice is recorded, current repository contracts and fail-closed behavior remain authoritative.

> Freeze notice (2026-07-19): no decision in this packet was adopted. Before resuming, recheck both protected Feishu sources read-only; if either changed, replace this packet with a new version based on a focused diff.

## Packet Baseline

- Packet ID: `0459-PKT-CR-r14288-r5951-v1`.
- Model/config UpstreamConsensus baseline: `feishu-model2` revision `14288`, SHA-256 `218e77f7a62961b940ad6c983cc43056eeeacc1fa2cabd7cb5d0d87464d0d252`.
- Message/routing UpstreamConsensus baseline: `feishu-message-api` revision `5951`, SHA-256 `7b3576ab5ce70956859957b1271a0e7116e06f94b6664053fc2518788c39b52c`.
- Focused refresh evidence: `source-recheck-report.md`.
- Decision order: F-07 -> F-06. F-07 freezes configuration truth before F-06 may select a configured endpoint.
- Current repository truth remains authoritative until Step 4 records the exact user choice and Step 5 applies only that choice to repository decision views.

## Decision Protocol

- Each decision card is independent. A missing card is unanswered, not deferred.
- A valid answer uses the exact syntax printed on that card, for example `DEC-0459-F07@v1 = F07-O1`.
- `批准全部`, `按推荐项执行`, `同意 packet`, a bare option number, or similar bulk wording is not a valid decision.
- `DEFER` is an explicit option. It preserves current repository behavior and keeps the finding at `requires_user_confirmation`.
- If the user proposes a hybrid or changes an option's wording, the card becomes `Change Requested`; a new packet version must describe the new complete option before it can be selected.
- Exact syntax is necessary but not sufficient: the choice must also satisfy the dependency-compatibility rules below. An incompatible reply is recorded only as a rejected attempt, not as a product decision; no approximate mapping is allowed, and a new packet version must present the remaining valid choices.
- Decisions are first recorded in `runlog.md`. A later correction supersedes the earlier record; historical evidence is not deleted.

Dependency compatibility:

- `F06-O1` and `F06-O3` require F-07 to be `F07-O1`, `F07-O2`, or `F07-O3`; `F07-DEFER` cannot support new local/global selection or general auto-fill.
- `F06-O2` is compatible with `F07-DEFER` only under current explicit local-only behavior; explicit global routing remains unavailable until F-07 is later decided.
- `F06-DEFER` is compatible with any F-07 choice and activates no new route behavior.

## DEC-0459-F07@v1 — Configuration Truth And Transport Endpoints

### Question

Should aggregate `config.control` / `config.manage` become runtime truth, compile into current split labels, or remain explanatory only?

### Evidence And Current Truth

- Model2 revision `14288` shows aggregate `config.control` with MQTT `local_ip`, `global_ip`, `local_port`, and `global_port`, and aggregate `config.manage` with Matrix `server`, `user`, `password`, `token`, and `connect_user`.
- The same source spells the control key correctly as `sys_control_config` in its table but misspells it as `sys_contol_config` in examples. The aggregate field is `global_port`; it is not the label type spelling.
- Current executable bootstrap reads split labels on Model 0: `mqtt.local.ip`, `mqtt.local.port`, `mqtt.global.ip`, `mqtt.global.port`, `matrix.server`, `matrix.user`, `matrix.passwd`, `matrix.token`, and `matrix.contuser`. Current SSOT freezes `mqtt.local.*`; it has not yet frozen global selection/priority even though the reader currently contains a `local || global` fallback.
- Current management bus pins are legal only on a DEM Model 0. An aggregate example at a general V1N root cannot by itself widen that role boundary.

### F07-O1 — Trusted Aggregate Import Compiles To Split Truth (Recommended)

- Canonical shape: `sys_control_config:config.control` and `sys_manage_config:config.manage` exist only as trusted bootstrap/import input. The control value has exactly one `mqtt` object; each IP/port field is a one-element nonempty string array, with ports canonical decimal `1..65535`. The management value has exactly one `matrix` object with nonempty `server`, `user`, and `connect_user`, plus at least one injected credential (`password` or `token`). Compile to the current split labels; only the split labels enter executable ModelTable state.
- Canonical spelling and mapping: accept only `sys_control_config`, never `sys_contol_config`; accept aggregate `global_port` and compile it to `global_port:mqtt.global.port`, never `mqtt.global_port`. Map `password` to `matrix_passwd:matrix.passwd` and `connect_user` to one-element `matrix_contuser:matrix.contuser`. No typo aliases.
- Precedence and selection: aggregate and split input supplied together is a conflict and is rejected; neither wins. Local and global are named endpoints, not fallback precedence. F-07 does not choose a route. F-06 must select one explicitly; if its selected endpoint is missing, fail closed instead of falling back to the other endpoint. Until F-06 implementation, current local behavior remains and global is not automatically enabled.
- Migration: first add a pure deterministic compiler and negative tests, then compare compiled split output against existing bootstrap assets. Remove the implicit `local || global` runtime fallback only in the follow-on implementation after explicit selection exists. Do not persist aggregate labels and do not dual-read.
- Tier and owner: a trusted Tier 2 bootstrap/installer validates and compiles aggregate input. Split labels on worker Model 0 are executable configuration facts. Generic Tier 1 runtime and adapters do not interpret aggregate business objects. `config.manage` may compile only for a management-capable DEM root under the current role contract.
- Secret boundary and failure/default: Matrix password/token come only from trusted Secret/environment injection and must not appear in tracked patches, exports, ordinary ModelTable snapshots, or client projection. Unknown fields, duplicate sources, bad port/IP/string shape, role mismatch, plaintext Secret material, missing selected endpoint, or spelling typo rejects compilation atomically with a stable visible error.
- Dependencies: F-06 may consume only explicitly selected, compiled endpoints. A separate implementation iteration must define Secret injection, compiler location, and removal of fallback behavior.
- Verification: pure conversion fixtures; byte-stable output; conflict/typo/unknown-field/port boundary tests; Secret non-leak checks; DEM versus non-DEM role negatives; explicit local/global endpoint selection tests; full local OrbStack MQTT and Matrix E2E using SSOT-conformant MBR/DEM/R1 roles.
- Tradeoff: preserves one executable configuration truth and accepts the source as an authoring view, but adds a trusted compiler and intentionally refuses convenient typo compatibility.

### F07-O2 — Aggregate Labels Are Runtime Truth

- Canonical shape: Model 0 directly stores and executes `sys_control_config:config.control` and, only on a management-capable DEM, `sys_manage_config:config.manage`. MQTT fields use the same strict object/array/port shape as F07-O1. Matrix `server`, `user`, and `connect_user` are nonempty strings; `password` and `token` are each either `null` or exactly `{ "secret_ref": "<provider>/<name>" }`, with exactly one non-null reference and nonempty slash-separated provider/name. Plaintext credential strings are invalid. Only correct `sys_control_config` and aggregate `global_port` spellings are valid. Current split labels are removed after migration.
- Precedence and selection: there is no split source after cutover. Local/global remain named endpoints and a caller must select one explicitly; missing selected endpoint fails closed with no fallback.
- Migration: hard cut every bootstrap asset, reader, validator, Secret injection path, fixture, and local role deployment from split labels to aggregate labels. No dual-read or typo aliases after cutover.
- Tier and owner: Tier 1 validates aggregate label shape and role placement; adapters read non-secret aggregate runtime truth. A trusted bootstrap Secret resolver, configured outside ordinary ModelTable input, is the only actor allowed to resolve `secret_ref` into adapter process memory; management configuration remains restricted to DEM Model 0.
- Secret boundary and failure/default: ModelTable, exports, logs, and client projection retain at most the reference object and redact its value by default; resolved credentials never write back. Invalid reference syntax, unknown provider/name, unresolved/revoked Secret, plaintext credential, role mismatch, or missing selected endpoint rejects startup/connection atomically without trying another credential or endpoint.
- Dependencies: all aggregate readers and the exact Secret resolver/redaction boundary must migrate together before F-06 may rely on aggregate truth.
- Verification: CJS/ESM and adapter aggregate tests; split-label rejection; Secret redaction/projection tests; local/global selection negatives; clean local OrbStack rebuild of MQTT/Matrix/MBR/DEM/R1.
- Tradeoff: most directly adopts the current source shape, but changes runtime truth and expands the sensitive aggregate parsing/projection surface.

### F07-O3 — Aggregate Labels Are Explanatory Only

- Canonical shape: repository input and runtime accept only the current split labels. `config.control` / `config.manage`, `sys_control_config`, and `sys_contol_config` are never registered or compiled. The only split global port spelling is `mqtt.global.port`; `mqtt.global_port` is rejected.
- Precedence and selection: no aggregate/split conflict can occur. Local/global selection still requires a separate F-06 decision; current SSOT local behavior remains until then, and missing selected endpoint must not later fall back silently.
- Migration: none for current assets. Documentation records aggregate source examples as explanatory and maintains separate trusted Secret injection for split Matrix values.
- Tier and owner: existing Model 0 split configuration and role rules remain authoritative; adapters continue to read split labels.
- Secret boundary and failure/default: current Secret controls remain. Any aggregate or typo input fails as unsupported; invalid/missing split values follow current startup/config errors.
- Dependencies: F-06 can reference only split endpoints. No aggregate importer may be added without a new decision.
- Verification: negative aggregate/typo tests; current split bootstrap tests; explicit proof that global selection is not inferred; local OrbStack current-path E2E.
- Tradeoff: smallest change and lowest dual-truth risk, but source aggregate examples can never be used directly as project input.

### F07-DEFER — Keep The Finding Open

- Canonical shape: current split labels remain executable. Aggregate labels, typo aliases, global priority, and new selection behavior are not adopted.
- Migration: none.
- Tier and owner: unchanged current owners and role restrictions.
- Failure and default: current local path remains; no new auto-fallback contract. The watcher continues to stop on F-07.
- Dependencies: F-06 cannot safely enable local/global auto-selection and must be deferred or restricted to current explicit configuration.
- Verification: F-07 remains `requires_user_confirmation / high`; backlog and coverage continue to expose the unresolved aggregate/split conflict.
- Tradeoff: avoids premature config/Secret changes but blocks a stable route-selection contract.

Recommendation: choose `F07-O1`. It makes aggregate text usable as a controlled input while preserving split labels as the single executable truth and rejects both known spelling mistakes.

Valid reply: `DEC-0459-F07@v1 = F07-O1`, `DEC-0459-F07@v1 = F07-O2`, `DEC-0459-F07@v1 = F07-O3`, or `DEC-0459-F07@v1 = F07-DEFER`.

## DEC-0459-F06@v1 — Sender Auto-Fill And Route Permission

### Question

Where, if anywhere, may omitted route fields be resolved, what facts are authoritative, and which actors may validate or modify the route?

### Evidence And Current Truth

- Message API revision `5951` says a software-worker Base may fill omitted control/management routing data, while direct MQTT/Matrix senders must provide it. It describes local/global and DEM/MBR lookup defaults plus permission checks, but the document's detailed envelope remains its older v1 presentation.
- The repository has already hard-cut the public business payload to complete `pin_payload.v2`. At Model 0/bus boundaries, it requires explicit `bus`, `route_kind`, `topic`, `response_topic`, endpoint/origin/reply-target identity, request/time metadata, and payload model identity. Generic runtime validates but does not query a route directory or infer omitted fields.
- Existing imported-app host egress already demonstrates a safe limited pattern: trusted host facts and declared wiring produce a complete v2 packet before the public bus boundary.
- MBR currently does not own per-app forwarding truth and may not derive a topic from endpoint metadata; current packet `topic` is transport truth.
- Current implementation does not yet provide the general route-permission directory or DEM/MBR permission contract described by F-06. Complete-field validation is implemented; generic route authorization is not and must not be described as existing behavior.

### Shared Identity And Permission Contract For Any Non-DEFER Choice

- Installed route/permission fact: a trusted installer may write one or more `route_binding_<binding_id>:json` labels on the sender host Model 0 root. Each value is exactly `{version:"route_binding.v1",binding_revision:positive int,active:bool,valid_until_ms:int|null,source:{table_id:str,model_id:int,pin:str},route_kind:"control"|"management",between:"DEM_V1N"|"WSM_DEM",message_server:"local"|"global",endpoint:{worker_id:str,table_id:str,model_id:int,pin:str},response_pin:str,required_capability:str,principal_binding_id:str,management:null|{send_user:nonempty str,receive_user:nonempty str}}`. `management` is required and non-null only for management routes. For one outbound direction the installer copies `send_user` exactly from the sender's F-07 Matrix `user` and `receive_user` exactly from its unique Matrix `connect_user`; they are real users, not references. Reverse traffic requires a separate reverse-direction binding generated from that sender's own F-07 facts—no bridge swaps or infers users at runtime. The label contains no credential. Only the trusted installer/host owner may add, replace, revoke, or remove it through the authorized ModelTable write path.
- Binding derivation and selector owner: the installer may create a binding only after the declared public route intent, actual `pin.connect.*` path, installed host binding, F-07 endpoint existence, role policy, and capability scope agree. `message_server` in this binding is the sole local/global selector for resolution/validation; neither topology names nor missing config create a default. The installer/host owner owns the selector, not the calling model, DEM, MBR, or payload.
- Enforcement projections: the trusted installer publishes a read-only `route_binding_projection.v1` to every boundary that must enforce the route (host, MQTT broker adapter, Matrix adapter/homeserver policy, actual DEM/MBR bridge, and target). Each projection is exactly `{version:"route_binding_projection.v1",binding_id:str,binding_revision:positive int,canonical_sha256:str,enforcement_scope:"host"|"mqtt"|"matrix"|"dem"|"mbr"|"target",binding:<exact route_binding.v1 value>}`. A revision becomes active only after all required boundaries acknowledge the same hash/revision; until atomic cutover, the prior active revision remains. Revocation is a higher revision with `active=false`. A boundary accepts only its locally installed, active, unexpired projection and fails closed on missing, stale, future, hash-mismatched, or multiply active revisions; it never reads the sender's table over the request path or edits a projection.
- Authenticated transport principal: every host session, MQTT client, or Matrix sender must map server-side to exactly one `transport_principal_binding.v1` record: `{binding_id:str,transport:"host_session"|"mqtt"|"matrix",authenticated_subject:str,worker_id:str,role:str,table_ids:[str],topic_prefixes:[str],capabilities:[str],expires_at_ms:int|null}`. This registry is trusted server/broker/homeserver configuration owned by the installer/security owner, not packet data or an ordinary business model. MQTT identity comes from the authenticated broker client/certificate/credential; Matrix identity comes from the authenticated access-token MXID and allowed room; an asserted client id, MXID, worker id, or ModelRef inside the payload is never proof.
- Authorization granularity: default deny over principal binding + one active projected binding revision + source table/model/public pin + route kind + `between` + selected message server + endpoint worker/table/model/public pin + topic prefix + reply table/model/pin + exact management users when present. Base/host validates source and materialization permission; a bridge validates only the scope it actually transports; the target validates its own public role-legal endpoint. Expired, missing, ambiguous, stale, or mismatched binding/projection rejects with no publish or mutation.
- Current topology unless an option explicitly replaces it: Feishu control request/response stays direct `UI Server <-> local MQTT <-> R1`; DEM is not on that path and therefore performs no imaginary transit check. Management alone uses Matrix/Synapse and MBR bridging. DEM validates only a separately installed route that actually terminates at or transits DEM. F06-O1 and F06-O2 preserve this topology; F06-O3 explicitly replaces part of it.

### F06-O1 — Trusted Sender-Side Resolution Before Model 0 (Recommended)

- Canonical omission boundary: omission is allowed only on an internal authoring/action request inside a trusted software-worker Base/host. Before the request crosses sender Model 0 or any MQTT/Matrix/bus boundary, the Base must produce a complete canonical `pin_payload.v2` record array. Direct MQTT/Matrix input and all transit packets must already be complete.
- Route-directory truth: no manually maintained MBR global per-app directory becomes authority. Resolution requires exactly one shared-contract `route_binding.v1` whose source matches the action and whose installer derivation still matches current model declaration, actual `pin.connect.*` path, F-07 config, host binding, principal capability, and worker/role policy. A generated read-only index/cache is allowed but is invalid when any source fact or binding revision disagrees.
- Resolution output: source table/model/public out pin plus the authenticated principal and selected binding resolve exactly one `bus/route_kind`, endpoint worker/table/model/pin, reply-target worker/table/model/pin, `topic`, `response_topic`, `message_server`, `between`, and, for management, `send_user`/`receive_user`. The Base also supplies `__mt_payload_kind="pin_payload.v2"`, request/op ids, `message_role`, `timestamp`, `payload_model_id`, and the required Feishu `is_need_response:bool`. Origin and reply identity come only from the authenticated host session/transport principal, current table-qualified ModelRef, and actual return pin.
- Precedence and defaults: caller-supplied route metadata is a constraint, not authority; it must exactly match the resolved route or the request is rejected. `bus === route_kind`. `message_server` comes from the resolved route and an F-07 configured endpoint; do not hard-code `DEM_V1N -> local` or `WSM_DEM -> global`. Missing or ambiguous local/global selection, endpoint, user, or binding has no fallback.
- Permission and mutation: apply the shared default-deny permission contract. The sender Base validates caller/source/public pin and binding, then materializes the complete packet. On the current direct control path, the authenticated UI Server/broker boundary and R1 target validate; DEM is not transit. MBR validates management user/scope and current complete topic only on the management path. An actual DEM route validates only its installed scope. After sender materialization, every bridge may reject or forward only—it may not fill, rewrite, or retarget packet fields.
- Migration: first freeze F-07 config, create the exact principal, `route_binding.v1`, and per-boundary projection registries through the trusted installer, and add deterministic local binding queries. Add a shadow resolver that compares generated envelopes with existing explicit valid envelopes without sending. Enable sender-side generation only after all enforcement boundaries acknowledge one revision and equivalence/negative authorization tests pass. Do not change the current control/management topology, add runtime fallback, or persist inferred values into source models; retain only the complete outgoing temporary packet and bounded audit evidence.
- Tier and owner: Tier 1 generic runtime validates complete v2, ModelRef, topic, and bus invariants. Trusted installer/security owner owns both binding registries. Tier 2 Base/host owns resolution and outbound permission. DEM owns only installed DEM-route authorization; MBR owns management bridge authorization but not the application endpoint directory. R1 Model 3200 remains Feishu business owner, not generic route owner.
- Failure and default: missing/stale/multiple binding, explicit mismatch, spoofed principal/identity, unauthorized scope, illegal role, missing selected F-07 endpoint, or incomplete direct input fails closed before any publish, leaves source payload/route/state unchanged, and writes a stable visible error. No actor tries the other endpoint or rewrites the destination.
- Dependencies: F-07 configuration truth and explicit endpoint selection are prerequisites. Implementation must preserve the public complete-v2 hard cut and remain a separate follow-on iteration.
- Verification: trusted omission -> exact complete v2 including `is_need_response`; direct/public omission -> rejection; MQTT/Matrix subject-binding spoof/expiry/scope negatives; explicit/resolved mismatch -> rejection; stale/ambiguous/unauthorized selector/binding -> rejection with no mutation; direct-control topology and MBR/actual-DEM forward-only assertions; topic truth tests; local OrbStack positive and privilege-negative E2E across real MQTT, Matrix, MBR, DEM, R1, and V1N roles conforming to SSOT.
- Tradeoff: gains Base convenience without weakening the public boundary or giving MBR a second route truth, but resolution depends on high-quality installer/wiring facts and strict server-side identity.

### F06-O2 — Explicit-Only Everywhere

- Canonical omission boundary: no actor accepts omitted route data. Every producer, including a software-worker Base, must construct the complete canonical `pin_payload.v2` before invoking Model 0. Direct MQTT/Matrix and all transit inputs are likewise complete.
- Route-directory truth: no generic resolver or auto-fill index is introduced. The shared `route_binding.v1` is used only as an installed permission/selector constraint: producers explicitly construct every field, and validators compare the packet with their same-revision local projection without copying fields from it.
- Precedence and defaults: there are no local/global, endpoint, user, topic, origin, or reply-target defaults. Every required field, including `is_need_response`, is explicit and must exactly match the shared route/principal permission facts. With F07-DEFER, only current explicit local routes can have a valid binding; global is rejected.
- Permission and mutation: apply the shared default-deny granularity and authenticated transport-principal contract. Base/host, broker/homeserver boundary, any actual bridge, and target validate their owned scope; none fills or rewrites. Current direct control and MBR-only management topology remains unchanged, and topic remains transport truth.
- Migration: keep current complete-v2 producers, create the shared principal/route permission registries, add validators at the real boundaries, and convert any future incomplete authoring surface to require all fields. This is new permission implementation, not existing behavior, but it adds no route resolver.
- Tier and owner: producers own packet construction; trusted installer/security owner owns permission registries; Tier 1 validates complete v2; Tier 2 host/actual bridge/target validators own their scoped authorization only.
- Failure and default: any missing, conflicting, stale, or unauthorized field rejects without mutation or publish. No fallback.
- Dependencies: F-07 still defines which explicit endpoint configs are legal, but no automated selection is required.
- Verification: complete-field matrix, every-field deletion negatives, principal spoof/expiry/capability tests, full binding-granularity mismatch tests, direct-control topology and forward-only actual-bridge tests, and local OrbStack explicit-route E2E.
- Tradeoff: simplest and strongest boundary, but rejects the Message API's Base-assisted authoring convenience and duplicates route construction across producers.

### F06-O3 — Transit Auto-Fill By DEM/MBR

- Canonical omission boundary: Base and direct MQTT/Matrix may send `pin_payload.partial.v1` only to an authenticated DEM/MBR resolver ingress, never to an ordinary target. Its required root records are `__mt_payload_kind`, request/op ids, `message_role="request"`, `timestamp`, source table/model/public pin, `payload_model_id`, and `is_need_response:bool`. It may omit only `bus/route_kind`, `message_server`, `between`, `topic/response_topic`, endpoint/origin/reply-target fields, and management users; any present field is a constraint. DEM/MBR produces complete `pin_payload.v2` before the target-facing hop.
- Route-directory truth: DEM owns control entries and MBR owns management/cross-community entries, each using the exact shared `route_binding.v1` shape plus the fully generated topic/response-topic template and same-revision enforcement projections. Entries are installed by the trusted installer; runtime actors cannot invent them. At install time a `DEM_V1N` entry receives selector `local` and a `WSM_DEM` entry receives selector `global`; the stored selector—not topology inference at message time—is authority.
- Precedence and defaults: explicit partial fields are accepted only when they exactly match the authenticated principal and directory entry. Omitted management users are copied only from that direction's stored real `management.send_user` / `management.receive_user`; reverse traffic uses its separate reverse binding. Missing/expired/ambiguous entry, unavailable selected endpoint, or multiple resolver ingresses rejects; no other endpoint is tried.
- Permission and mutation: the shared transport-principal and default-deny permission contract applies at resolver ingress. DEM/MBR may fill only the enumerated omitted fields from one authorized entry, revalidate complete v2, and retain bounded before/after audit evidence. Target validates the final public endpoint.
- Migration: this option deliberately replaces the current complete-v2 public boundary and current direct control topology. Control requests become `sender -> authenticated DEM resolver -> MQTT -> R1` instead of direct `UI Server -> local MQTT -> R1`; responses reverse the installed route. Management remains Matrix/MBR based but gains resolver mutation. Introduce resolver ingress bindings, partial schema, directory consistency/expiry, and audit before any producer is allowed to send partial packets; full packets remain valid only when they match directory truth.
- Tier and owner: Tier 1 must distinguish partial from complete packet states; DEM and MBR Tier 2 actors become routing-policy owners and packet mutators.
- Failure and default: unauthenticated transport, directory missing/stale/multiple, explicit conflict, unauthorized target/user, unavailable selected endpoint, or illegal partial field rejects without publish or mutation. Partial packets must never reach an ordinary runtime/target.
- Dependencies: requires F-07 endpoint truth, authoritative DEM/MBR directory models, consistency/expiry rules, permission administration, audit retention, and a deliberate revision of current v2 boundary SSOT.
- Verification: authenticated partial-to-complete state-machine tests; direct-to-target partial rejection; principal spoof/expiry tests; directory expiry/split-brain/selector tests; mutation audit; explicit conflict and privilege negatives; changed control-topology and bridge replay tests; and full local OrbStack multi-role E2E.
- Tradeoff: closest to the source's literal transit description, but creates multiple route truths, allows packet mutation in transit, and directly conflicts with the current complete-v2/forward-only boundary.

### F06-DEFER — Keep The Finding Open

- Canonical omission boundary: current complete `pin_payload.v2` remains mandatory at public/Model 0 boundaries; no new general auto-fill contract is adopted.
- Route-directory truth: none beyond current explicit declarations and narrow installed-host behavior already covered by existing SSOT.
- Migration: none.
- Tier and owner: unchanged current runtime, host, DEM, MBR, and R1 boundaries.
- Failure and default: omitted public fields continue to fail closed; no new local/global or permission inference. The watcher continues to stop on F-06.
- Dependencies: general route convenience remains blocked; any narrow existing imported-app behavior must not be generalized by inference.
- Verification: F-06 remains `requires_user_confirmation / high`; complete-v2 field deletion tests and MBR forward-only tests continue to pass.
- Tradeoff: preserves safety while postponing the routing product decision.

Recommendation: choose `F06-O1`. It extends the already-safe sender-host pattern while keeping every public/transit packet complete and making DEM/MBR validators rather than route authors.

Valid reply: `DEC-0459-F06@v1 = F06-O1`, `DEC-0459-F06@v1 = F06-O2`, `DEC-0459-F06@v1 = F06-O3`, or `DEC-0459-F06@v1 = F06-DEFER`.

## Packet Stop Condition

This packet stops at the User Decision Gate. It does not authorize changes to `docs/ssot/**`, product code, tests outside decision-package validation, deployment, local services, or Feishu.
