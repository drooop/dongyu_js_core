---
title: "Iteration 0457 Feishu Message API v2 + Local DE Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-07-16
source: ai
iteration_id: 0457-feishu-message-api-v2-local-de
id: 0457-feishu-message-api-v2-local-de
phase: phase3
---

# Iteration 0457 Feishu Message API v2 + Local DE Runlog

## Environment

- Date: 2026-07-10
- Branch: `dropx/dev_0457-feishu-message-api-v2-local-de`
- Baseline commit: `e0c48fa`
- Runtime target: local OrbStack Kubernetes, namespace `dongyu`
- Stacked dependency: 0454 → 0455 → 0456 → 0457; none is merged to `dev` in this branch chain.
- Feishu boundary: read-only connection allowed; no Feishu write authorized.

## Phase 0 / Phase 1 Facts

### Intake and Registration

- Commands:
  - `git status --short --branch`
  - `git switch -c dropx/dev_0457-feishu-message-api-v2-local-de`
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0457-feishu-message-api-v2-local-de --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - Registered 0457 in `docs/ITERATIONS.md` before implementation.
- Key output:
  - Baseline worktree was clean at `e0c48fa`.
  - 0457 branch and iteration directory were created successfully.
- Result: PASS
- Commit: `ce32178`

### Read-Only OrbStack Baseline Check

- Commands:
  - `orb status`
  - `docker context show`
  - `kubectl config current-context`
  - `kubectl get deploy,pods,svc,pvc -n dongyu -o wide`
  - `bash scripts/ops/check_runtime_baseline.sh`
- Key output:
  - OrbStack is running; Docker and Kubernetes contexts are both `orbstack`.
  - Mosquitto, Synapse, remote-worker/R1, workspace-manager/WM1, mbr-worker, and ui-server are `1/1 Ready`.
  - Existing checker reported `[check] baseline ready`.
- Result: PASS as current checker behavior; not accepted as 0457 completion evidence.
- Commit: N/A

### Baseline False-Positive Reproduction

- Commands:
  - Read only `matrix.server` values from live `mbr-worker-secret` and `ui-server-secret`.
  - `kubectl -n dongyu logs deploy/mbr-worker --tail=300 | rg 'Matrix|matrix|TLS|fetch failed|adapter'`
  - `kubectl -n dongyu exec deploy/mbr-worker -- node -e "fetch('http://synapse.dongyu.svc.cluster.local:8008/_matrix/client/versions')..."`
- Key output:
  - Both live bootstrap patches use `https://matrix.dongyudigital.com`.
  - MBR logs show the remote Matrix `whoami` fetch fails.
  - The same MBR pod receives HTTP 200 from the local Synapse service.
  - Therefore local Synapse readiness plus remote bootstrap currently passes the checker incorrectly.
- Result: FAIL for the user's clarified all-local acceptance boundary; expected planning finding.
- Commit: N/A

### Actor/Contract Read-Only Findings

- Commands:
  - Inspected current worker identity/role/bus/model patches with `rg` and `jq`.
  - Inspected canonical runtime ingress, Feishu v1 parser, formal v2 validator, and response path.
- Key output:
  - MBR patch: `sys_worker_id=5/10/28/35/14`, `sys_worker_role=DEM`.
  - R1 patch: `sys_worker_id=5/10/28/35/15`, `sys_worker_role=V1N`, `mqtt_worker_id=R1`.
  - WM1 patch: `sys_worker_id=5/10/28/36/16`, `sys_worker_role=DEM`, `mqtt_worker_id=WM1`.
  - All three role patches currently omit worker-root `model.v1n`.
  - MBR currently keeps `mbr_cb_dispatch` on Model 0 and the runner writes Matrix/MQTT inbox labels directly to Model `-10` before direct function execution.
  - R1's MQTT path can write directly to positive model pins when `mqtt_ingress_pin` is absent.
  - Formal v2 validation already exists in canonical `runtime.mjs`; `runtime.js` is a CJS shim.
  - Current Feishu v1 special-case must be replaced by v2 business validation plus explicit legacy rejection.
- Result: PASS as planning evidence; implementation not started.
- Commit: N/A

## Phase 2 Review Gate

- Review round 1:
  - Parser reviewer: `Change Requested`.
  - Runtime/OrbStack reviewer: `Change Requested`.
  - SSOT/authority reviewer: `Change Requested`.
  - Shared blockers: unresolved `model.table`/`model.v1n` authority conflict; Tier 1 retained Feishu business ownership; no precise real actor endpoint/evidence; remote OIDC omitted; duplicated standalone/runtime validator design; premature SSOT/F-01 close; incomplete rollback.
  - Result: plan review count reset to zero; Phase 3 remains blocked.
- Revision:
  - Recorded the user-resolved root-form conflict and promoted it into the planned highest-contract update.
  - Replaced runtime Feishu business dispatch with an R1-owned Model 3200 Tier 2 actor.
  - Removed the standalone v2 parser design; runtime remains generic transport only.
  - Froze the exact Feishu v2 extension schema and endpoint discriminator.
  - Added local auth/no-remote acceptance, actor attestations, test ModelTable driver, deterministic rollback, staged SSOT/commit/review/F-01 close, and exact F-04-F-08 non-regression.
- Review round 2:
  - SSOT/authority reviewer: `Approved`.
  - Parser reviewer: `Change Requested` because the wording could remove generic v2 response materialization and the proposed E2E fixture lived under ignored `test_files/`.
  - Runtime reviewer: `Change Requested` because rollback omitted UI persistence/Synapse PVC state and `ensure` plus explicit deploy could deploy twice.
  - Result: review count reset to zero.
- Revision 2:
  - Explicitly retained generic table-qualified v2 response materialization and added 0450 to the Tier 1 gate.
  - Moved the deterministic E2E app fixture to committed `scripts/fixtures/0457/` and added a clean-checkout fixture guard.
  - Added consistent UI persistence/Synapse database backup and restore plus successful test-app cleanup.
  - Replaced the double-deploy sequence with one explicit `ensure_runtime_baseline.sh --force-rebuild` deployment entry.
- Review round 3:
  - Parser/schema reviewer: `Approved`; no findings, questions, or verification gaps.
  - Runtime/OrbStack reviewer: `Approved`; no findings or questions; implementation/live evidence remains correctly pending Phase 3.
  - SSOT/authority reviewer: `Approved`; no findings, questions, or verification gaps.
  - Consecutive approval count: 3.
- Decision: `Approved`.
- Phase 3 may begin only from the planning commit containing this Gate.

## Phase 3 Execution Records

- Phase 3 started from planning commit `ce32178` after the recorded 3/3 Approved Gate.
- Step 1 is TDD RED only: tests/helpers may change; production code, deployment configuration, actor patches, runtime behavior, and Feishu state remain unchanged until the expected RED results are recorded.

### Step 1 — Initial TDD RED

- Commands:
  - `node --check scripts/lib/ssot_de_actor_test_helpers.mjs`
  - `node --check scripts/tests/test_0457_local_orbstack_de_actor_contract.mjs`
  - `node scripts/tests/test_0457_local_orbstack_de_actor_contract.mjs`
  - `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
  - `node scripts/tests/test_0364_system_refill_contract.mjs`
  - `git diff --check`
- Key output:
  - Syntax checks: PASS.
  - Local baseline contract: expected RED with seven missing contract groups covering OrbStack context, local Synapse/Mosquitto, local auth, TLS, actor declarations, and the single force-rebuild path.
  - DE actor contract: expected RED, `2 passed / 4 failed`; missing worker-root `model.v1n`, MBR bus-boundary violations, R1 direct-positive ingress risk, and missing patch-derived attestations.
  - System refill contract: expected RED, `6 passed / 4 failed`; authority docs and loaded actor roots still disagree, and MBR lacks management ingress.
  - `git diff --check`: PASS.
- Result: expected RED observed; no production file changed.

### Step 1 RED Review Round 1

- Gate: `Change Requested`.
- Findings:
  - Source-token checks could pass without executable checker behavior.
  - Actor helper concatenated patch JSON instead of deriving final state from an applied `ModelTableRuntime`.
  - MBR checks did not prove Matrix → Model 0 management ingress and MQTT → Model 0 control ingress, or prohibit runner bypass to Model `-10`.
  - Attestation checks could pass from comments/dead text instead of actual post-load output.
  - Exact alias/topic-base and the positive Feishu external-read boundary were not locked.
  - The force-rebuild test overfit one shell spelling.
- Decision: keep production implementation blocked; strengthen Step 1 tests and repeat RED review.

### Step 1 — Strengthened Behavior RED

- Changes to test evidence:
  - The local baseline test now executes the real checker against fake `kubectl`, `docker`, and `orb` live-state fixtures instead of accepting source tokens as proof.
  - Local Matrix/MQTT/auth/actor fixtures and an explicit `https://open.feishu.cn` read-only fixture are positive cases; wrong Kubernetes/Docker contexts and remote Matrix/MQTT/OIDC are negative cases.
  - The force-rebuild test executes `ensure_runtime_baseline.sh` in a bounded sandbox and records deploy/check call order and count.
  - The actor helper now applies system and role patches through `ModelTableRuntime`, rejects any failed record, and derives actor facts from final loaded state with source provenance.
  - MBR runner checks use parsed JavaScript structure to require Matrix → Model 0 management ingress and MQTT → Model 0 control ingress while prohibiting direct Model `-10` writes/direct business-function calls.
  - R1 checks require a Model `-10` route-table dispatcher chain and prove malformed MQTT input cannot write an error label into a positive model.
  - Attestation checks require a pure loaded-state builder plus a five-second-bounded runner output probe; comments or dead strings cannot satisfy the contract.
- Commands:
  - `node --check scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
  - `node --check scripts/lib/ssot_de_actor_test_helpers.mjs`
  - `node --check scripts/tests/test_0457_local_orbstack_de_actor_contract.mjs`
  - `node --check scripts/tests/test_0364_system_refill_contract.mjs`
  - `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
  - `node scripts/tests/test_0457_local_orbstack_de_actor_contract.mjs`
  - `node scripts/tests/test_0364_system_refill_contract.mjs`
  - `git diff --check`
- Key output:
  - All syntax checks and `git diff --check`: PASS.
  - Local baseline: expected RED with nine failures. The complete local fixture and Feishu read-only fixture pass; both wrong contexts, remote Matrix/MQTT/OIDC, old local defaults/TLS, and missing force-rebuild behavior fail.
  - Actor contract: expected RED, `1 passed / 9 failed`, all tied to missing target behavior; the malformed R1 request currently writes `mqtt_inbound_error` into Model 100, proving the direct-positive mutation bug.
  - System refill: expected RED, `7 passed / 3 failed`; only the documented/declared/loaded worker-root `model.v1n` contracts remain missing.
- Result: expected strengthened RED observed; production implementation remains unchanged pending review approval.

### Step 1 RED Review Round 2

- Gate: `Change Requested`.
- Blocking findings:
  - R1 tests did not yet prove dispatcher output travels through declared PIN connections to positive models or prohibit cross-model host writes.
  - MBR runner checks did not yet prove adapters pass the inner record array rather than the outer packet, and direct function execution could be disguised.
  - The malformed R1 case checked only one known error key instead of proving every positive-model snapshot stays unchanged.
  - R1 boundary discovery selected the first `pin.in` and over-constrained route-table storage.
- Decision: production implementation remains blocked; close these false-green and false-red paths and repeat review.

### Step 1 — Round 2 Remediation

- MBR AST checks now require Matrix `event.payload` and parsed MQTT `packet.payload` to be the values written to their Model 0 bus inputs; any callback-level direct function execution or Model `-10` mutation fails.
- R1 boundary selection now follows the actual Model 0 ingress route instead of choosing the first `pin.in`.
- R1 dispatcher checks allow either root-direct or internal-cell declared wiring, prohibit cross-model host APIs, and require declared PIN output.
- A behavior probe now loads a fresh real R1 actor for every subscribed/mounted endpoint and requires delivery through the corresponding parent connection Cell into the positive-model input PIN.
- Malformed R1 MQTT input now compares the complete before/after snapshot of every positive model.
- Verification:
  - Actor syntax and helper syntax: PASS.
  - Actor contract: expected RED, `1 passed / 10 failed`; the additional failure is the intentionally missing subscribed-endpoint PIN chain.
  - `git diff --check`: PASS.
- Result: production implementation remains unchanged pending RED review round 3.

### Step 1 RED Review Round 3

- Gate: `Approved`.
- Findings: none.
- Open questions: none.
- Verification gaps: none.
- Decision: Step 1 behavior RED may be committed; production GREEN may begin from that commit.

### Step 2A — Worker Root Authority and Local OrbStack Baseline GREEN

- Implementation:
  - Clarified the highest contract so software-worker host Model 0 roots use `model.v1n`, while ordinary/non-worker ModelTable roots continue to use `model.table`.
  - Changed the local deployment contract to require exact Kubernetes and Docker context `orbstack`, namespace `dongyu`, local Synapse and Mosquitto services, `DY_AUTH=0`, no fake login, no remote OIDC, and no TLS-verification bypass.
  - Kept Feishu HTTPS access outside the remote-service deny checks; local test infrastructure is local, but Feishu remains connectable.
  - Changed `ensure_runtime_baseline.sh --force-rebuild` to execute exactly one image-enabled local deployment followed by the canonical checker.
  - Added executable fake-`kubectl`/`docker`/`orb` behavior coverage and shared local/cloud Secret-writer coverage.
- Initial independent review: `Change Requested`.
  - Local `DY_OIDC_SCOPE=` was expanded to the remote default by `${DY_OIDC_SCOPE:-...}`, causing the generated local Secret to violate its own checker.
  - The `CLAUDE.md` Tier 1 model-form enumeration still omitted `model.v1n`.
- TDD remediation:
  - Added a real `update_k8s_secrets` harness that first reproduced the local non-empty scope failure.
  - Changed the shared writer to preserve an explicitly empty local scope while retaining explicit cloud values and the default only when the variable is unset.
  - Added `model.v1n` to the Tier 1 model-form enumeration.
- Commands:
  - `node scripts/tests/test_0175_local_baseline_matrix_contract.mjs`
  - `node scripts/tests/test_0403_deploy_sso_env_contract.mjs`
  - `node scripts/tests/test_0364_system_refill_contract.mjs`
  - `bash -n scripts/ops/_deploy_common.sh scripts/ops/check_runtime_baseline.sh scripts/ops/deploy_local.sh scripts/ops/ensure_runtime_baseline.sh`
  - `node scripts/ops/validate_obsidian_docs_gate.mjs`
  - `git diff --check`
- Key output:
  - Local baseline behavior contract: PASS.
  - Local empty OIDC values, explicit cloud OIDC values, and unset default semantics: PASS.
  - System refill/root-form contract: `10 passed / 0 failed`.
  - Shell syntax, docs gate, and diff check: PASS.
- Final independent review: `Approved`; no findings, questions, or verification gaps.
- Result: PASS for the versioned baseline contract. Live OrbStack deployment/acceptance remains pending the later rollback-backed E2E stage.

### Step 2B — Real MBR/R1/WM1 Actor and Declared-PIN GREEN

- Implementation:
  - Refilled the versioned MBR, R1, and WM1 role patches with loaded `model.v1n` roots, exact SSOT worker identities/roles, legal split bus pins, and explicit submodel mounts.
  - MBR Matrix and MQTT adapters now write only the Model 0 management/control bus inputs; Model `-10` owns bridge functions and returns through declared parent/child PIN chains.
  - R1 MQTT requests now enter `r1_cb_in`, traverse the mounted Model `-10` route-table dispatcher, and reach every subscribed positive endpoint through its parent connection Cell.
  - Added non-secret actor attestations derived from the applied runtime plus versioned source provenance. MBR bootstrap records cannot replace attested root fields, bus pins, topic identity, or loaded submodel mounts.
  - Migrated affected 0143/0144/0177/0184/0375/0376/0379/0384 contracts to flat numeric, table-qualified `pin_payload.v2` and the real actor route graph.
- Earlier actor review: `Change Requested`.
  - Invalid MBR/R1 adapter input was not consistently written to ModelTable.
  - MBR bootstrap provenance and protected actor-field behavior were incomplete.
  - Remediation added Model 0 visible errors, safe source markers, and pre-attestation bootstrap checks.
- Final actor review round 1: `Change Requested` despite all existing tests passing.
  - Missing `mqtt_ingress_pin` still allowed a legal request to fall through directly to a positive model.
  - Early MQTT packet/topic/config rejection paths wrote trace only, not a ModelTable-visible error.
  - A bootstrap `rm_label` record could delete an already loaded `model.submtconnection` before attestation.
- TDD remediation:
  - Added three failing behavior groups; observed `3 failed / 11 passed` before the fix.
  - Added one Model 0 rejection path for all MQTT failures, removed the request direct-positive fallback, and required every inbound request to have a legal Model 0 ingress. Outbound-only MQTT startup remains valid, and generic table-qualified response materialization remains unchanged.
  - Derived protected mount coordinates from the loaded runtime and rejected both `add_label` and `rm_label` mutation before applying bootstrap data or emitting attestation.
  - Migrated the remaining stale tests that expected direct positive-model delivery or positive-model transport errors.
- Commands:
  - `node scripts/tests/test_0143_e2e.mjs`
  - `node scripts/tests/test_0457_local_orbstack_de_actor_contract.mjs`
  - `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
  - All current tests containing direct `mqttIncoming(...)` calls.
  - MBR/R1/WM1 regression set: 0144, 0177, 0184, 0196, 0197, 0328, 0362, 0364, 0376, 0377, 0379, 0419, 0430, and 0450.
  - Runtime/runner syntax checks, docs gate, and `git diff --check`.
- Key output:
  - 0143 real R1 E2E: `5 passed / 0 failed`.
  - 0457 actor boundary: `14 passed / 0 failed`.
  - 0375 unified transport: `74 passed / 0 failed`.
  - 0384 provider install flow: `10 passed / 0 failed`.
  - 0450 generic response materialization: `4 passed / 0 failed`.
  - All listed actor/runtime regressions, syntax checks, docs gate, and diff check: PASS.
- Final independent review round 2: `Approved`; no findings, questions, or verification gaps.
- Result: PASS for the versioned real-actor/runtime slice. Live OrbStack deployment/acceptance remains pending after F-01 Model 3200 implementation.

### Step 3A — F-01 Model 3200 Actor/Schema TDD RED

- Added `scripts/tests/test_0457_feishu_model3200_actor_contract.mjs` without changing production code.
- The RED locks:
  - committed Model 3200 patch, `model.submt/Flow` root, exact ten request inputs, generic `result` output only, parent mount, subscriptions, dispatcher routes, and result return route;
  - generic v2 `bus`, `route_kind`, equality, timestamp, positive payload-model id, removed `manage`, distinct response topic, segment pins, and legacy metadata rejection;
  - Model 3200-only `is_need_response`, optional enums, management users, business root/type, and documented `sys_msg_type` validation;
  - valid control and management requests returning generic v2 through `result`;
  - ordinary v2 requests without Feishu-only fields and non-3200 `sys_msg_type` packets remaining normal transport;
  - F-04 alias remains absent, F-05 refresh behavior is not tested, and F-08 has only the approved `add_task_return:pin.in` structural slot with no dedicated output.
- Initial result: expected RED, `5 failed / 1 passed`; 0450 remained `4 passed / 0 failed`, and the existing actor contract remained `14 passed / 0 failed`.
- RED review round 1: `Change Requested`.
  - Missing legal control/management positive paths allowed an all-reject implementation to pass.
  - No plain non-Feishu request protected Feishu-only fields from becoming global requirements.
  - Unknown `sys_msg_type`, exact PIN set, and single-variable `manage` rejection were incomplete.
- Remediation result: expected RED, `6 failed / 2 passed`; both plain v2 and non-3200 discriminator guards pass.
- RED review round 2: `Change Requested` because the positive `resource.report` fixture used a scalar resource instead of the preserved `resource:list` contract.
- Remediation: changed the resource fixture to a non-empty string list in the same Cell; RED remained `6 failed / 2 passed`.
- RED review round 3: `Approved`; no findings, questions, or verification gaps.
- Commands:
  - `node --check scripts/tests/test_0457_feishu_model3200_actor_contract.mjs`
  - `node scripts/tests/test_0457_feishu_model3200_actor_contract.mjs`
  - `node scripts/tests/test_0450_feishu_response_materialization.mjs`
  - `node scripts/tests/test_0457_local_orbstack_de_actor_contract.mjs`
  - `git diff --check`
- Result: expected RED recorded and reviewed; actor/schema GREEN may begin from the RED commit.

### Step 3B — F-01 Model 3200 Actor/Schema GREEN

- Added the versioned R1 Model 3200 actor patch at `deploy/sys-v1ns/remote-worker/patches/15_model3200_feishu_message_api.json`.
- The patch declares the approved `model.submt/Flow` root, exact public request/result PIN surface, Model `-10` subscriptions/routes, Model 3200 schema function, visible accepted/rejected result, generic v2 response, and no dedicated `add_task_return` output.
- Tightened the generic formal-v2 runtime contract so `bus`, `route_kind`, timestamp, and positive `payload_model_id` are required and exact; canonical emitters now produce equal control/management fields or fail closed.
- Updated existing exact-v2 fixtures only where required: 0376 isolates invalid `route_kind` with a legal control `bus`, and 0430 includes the required timestamp.
- Initial GREEN result: Model 3200 contract `8 passed / 0 failed`; 0450 response materialization `4 passed / 0 failed`; DE actor contract `14 passed / 0 failed`; broader focused regressions PASS.
- Initial independent GREEN review: `Change Requested`.
  - A present but invalid/blank optional `send_user` or `receive_user` was accepted on the control path.
  - The canonical emitter could accept conflicting `bus` and `route_kind` inputs and emit a packet rejected by its own validator.
  - The valid-response test did not prove every table-qualified reference or loop the actual Model 3200 result through generic materialization.
- Added exact RED cases for both defects and the response-materialization gap; observed the expected `2 failed / 6 passed` before production remediation.
- Remediation:
  - Model 3200 distinguishes absent optional users from present invalid users and rejects invalid values with exact codes.
  - The canonical emitter rejects invalid route/bus values and `bus_route_kind_mismatch` instead of silently normalizing them.
  - Both legal control and management responses assert endpoint/origin/reply-target table references and materialize the real result into the named app ModelTable without host fallback.
- Final verification:
  - Model 3200 actor/schema: `8 passed / 0 failed`.
  - 0450 generic response materialization: `4 passed / 0 failed`.
  - 0457 DE actor: `14 passed / 0 failed`.
  - 0375 unified transport: `74 passed / 0 failed`.
  - 0376 control-first routing: `14 passed / 0 failed`.
  - 0430 CJS/ESM/server contract, 0332 payload contract, 0396 dual-topic contract, 0417 principal projection, JSON/syntax, docs gate, and `git diff --check`: PASS.
- Final independent GREEN re-review: `Approved`; no findings, open questions, or verification gaps.
- No Feishu state was written and no OrbStack deployment was performed in this slice.
- Result: PASS for the Model 3200 actor/schema foundation. Business-family migration and live OrbStack acceptance remain pending.

### Step 3C — F-01 Model 3200 Task Family RED/GREEN

- Replaced the 0444 Tier 1/v1 task-manager test with real R1 actor requests through MQTT, Model 0, Model `-10`, the Model 3200 task PINs, Model 3200-owned state, and the generic `result` response.
- Initial task RED: `5 failed / 0 passed`; schema foundation remained `8 passed / 0 failed`.
- Initial RED review: `Change Requested` because two lifecycle cases failed through `TypeError`, required-field coverage was incomplete, and the F-08 boundary was only indirect.
- Strengthened RED:
  - every lifecycle step asserts transport delivery and task existence before reading state;
  - all persisted task fields and lifecycle timestamps are asserted;
  - all 15 required fields cover both missing and wrong-type cases;
  - non-add field cases seed only Model 3200 test state so they do not depend on the unimplemented add baseline;
  - `add_task` proves `add_task_return` remains untouched and `result` is the only public output.
- Strengthened result: expected RED, `34 failed / 0 passed`, with no `TypeError`; independent RED re-review `Approved` with no findings or gaps.
- GREEN implementation:
  - the schema emits an internal validated context instead of a pre-business success response;
  - `feishu_task_manager` owns add/edit/delete/receive/finish/archive state and visible results entirely inside Model 3200 using V1N label APIs;
  - required field/type validation and unknown-task rejection fail closed without changing task state or `result`;
  - the generic response contract runs after the family handler and carries the actual task `handler_result`.
- Initial GREEN: task `34 passed / 0 failed`; Model 3200 schema `8 passed / 0 failed`; focused actor, transport, routing, response, and legacy 0443-0452 regressions PASS.
- Initial GREEN review: `Change Requested` because an empty `add_task_return` payload received a generic accepted result, which made pending F-08 look implemented.
- Added three exact F-08 RED cases covering empty, complete legacy-field, and wrong-type payloads; observed `3 failed / 34 passed`.
- Remediation: the declared `add_task_return` input now returns Model 3200-visible `task_action_pending:add_task_return` and emits no result or task mutation; no dedicated output/behavior was added.
- Final verification:
  - task family: `37 passed / 0 failed`;
  - Model 3200 schema: `8 passed / 0 failed`;
  - DE actor `14/14`, unified transport `74/74`, control-first routing `14/14`, generic response materialization `4/4`, 0430, and existing 0443-0452 regressions: PASS.
- Final independent GREEN re-review: `Approved`; no findings, questions, or verification gaps.
- No Feishu state was written and no OrbStack deployment was performed in this slice.
- Result: PASS for the Model 3200 task family. Resource/data/UI/response migration and live acceptance remain pending.

### Step 3D — F-01 Model 3200 Resource Family RED/GREEN

- Replaced the 0445 Tier 1/v1 resource test with real R1 requests through local mock MQTT, Model 0, Model `-10`, Model 3200 `resource`, Model 3200-owned catalog/result state, generic `result`, Model 0 return bus, and MQTT publish.
- The reviewed RED locks:
  - the same `op_id` must be visible at Model 0 ingress, Model `-10` dispatcher output, and Model 3200 input;
  - `resource.report` and `resource.result` replace the Model 3200 catalog and return their real handler result;
  - `resource.request` reads the current catalog while `is_need_response=false` leaves Model 3200 `result`, Model 0 return bus, and MQTT publish count unchanged;
  - empty records, empty resource lists, blank types, and wrong resource types reject for both report and result without partial state;
  - valid `type`/`resource` pairs may live in any same payload Cell, including non-root page/row coordinates, and one invalid Cell makes the entire request fail closed.
- Initial strengthened RED: `11 failed / 0 passed`; independent RED review found the MQTT assertion initially had no active client. After starting a complete local mock MQTT runtime and proving the positive publish baseline, RED re-review was `Approved`.
- GREEN implementation:
  - added `feishu_resource_manager` to the Model 3200 function chain after task handling and before the generic response contract;
  - resource catalog and last result now live only on Model 3200 labels through V1N APIs;
  - report/result replace the catalog, request reads it, invalid business records write a visible rejection and emit no response;
  - no resource business hook was added to the runtime kernel.
- Initial GREEN: resource `11/11`, task `37/37`, actor/schema `8/8`; independent review found an incorrect `p=0,r=0,c>0` restriction that rejected legal non-root Cells and could ignore mixed invalid records.
- TDD remediation:
  - added non-root `p=1` and `r=1` positive cases plus a mixed valid/off-axis invalid negative case;
  - observed the expected resource `2 failed / 11 passed` and actor/schema `1 failed / 7 passed` before the fix;
  - changed the manager to group every `type`/`resource` record under the declared `payload_model_id` by its actual Cell coordinates and reject the whole request when any group is invalid.
- Final verification:
  - resource family: `13 passed / 0 failed`;
  - task family: `37 passed / 0 failed`;
  - Model 3200 actor/schema: `8 passed / 0 failed`;
  - DE actor `14/14`, unified transport `74/74`, control-first routing `14/14`, generic response materialization `4/4`, 0430, and existing 0443-0452 regressions: PASS;
  - JSON/syntax, docs gate, and `git diff --check`: PASS.
- Final independent GREEN re-review: `Approved`; no findings, questions, or verification gaps.
- No Feishu state was written and no OrbStack deployment was performed in this slice.
- Result: PASS for the Model 3200 resource family. Data/UI/response migration and live acceptance remain pending.

### Step 3E — F-01 Model 3200 Data Family RED/GREEN

- Replaced the 0446 Tier 1/v1 data test with real R1 requests through local mock MQTT, Model 0, Model `-10`, Model 3200 `data`, Model 3200-owned store/result state, generic `result`, Model 0 return bus, and MQTT publish.
- The reviewed RED locks:
  - the same data `op_id` must traverse Model 0, Model `-10`, and Model 3200;
  - save/load ModelTable use the `modeltable.saved` / `modeltable.loaded` slots with a `Data` payload root;
  - save/load Flow use the `flow.saved` / `flow.loaded` slots with a `Flow` payload root;
  - actual payload records at non-root page/row coordinates are preserved while root metadata is excluded;
  - every action rejects an empty payload and the opposite payload-root type without changing store, `result`, Model 0 return bus, or MQTT publish;
  - load actions use explicit `is_need_response=false` and still update the Model 3200 loaded slot;
  - dynamic non-default payload IDs are read from v2 `payload_model_id`, and store/result/handler output must not retain old `payload_table_id` naming.
- Initial RED: `11 failed / 0 passed`; resource remained `13/13`, task `37/37`, and actor/schema `8/8`.
- Initial RED review: `Change Requested` because every fixture used payload ID `1` and did not forbid old `payload_table_id` output, allowing a hard-coded or v1-named implementation to pass.
- RED remediation:
  - the main save path now uses `payload_model_id=7`, and a rejection path uses `payload_model_id=9`;
  - store, last result, and handler response all require `payload_model_id` and explicitly reject `payload_table_id`.
- Strengthened RED re-review: `Approved`; no findings, questions, or verification gaps.
- GREEN implementation:
  - added `feishu_data_manager` after resource handling and before the generic response contract;
  - the manager dynamically reads the declared payload model, validates Data/Flow against the action, strips only root metadata, and stores the remaining records in the correct Model 3200 saved/loaded slot;
  - valid results use v2 `payload_model_id`; invalid business input writes Model 3200-visible rejection and emits no response;
  - no data business hook was added to the runtime kernel.
- Final verification:
  - data family: `11 passed / 0 failed`;
  - resource `13/13`, task `37/37`, Model 3200 actor/schema `8/8`;
  - DE actor `14/14`, unified transport `74/74`, control-first routing `14/14`, generic response materialization `4/4`, 0430, and existing UI/response 0447-0452 regressions: PASS;
  - JSON/syntax, docs gate, and `git diff --check`: PASS.
- Independent GREEN review: `Approved`; no findings, questions, or verification gaps.
- No Feishu state was written and no OrbStack deployment was performed in this slice.
- Result: PASS for the Model 3200 data family. UI/response migration and live acceptance remain pending.

### Step 3F — F-01 Model 3200 UI Family RED/GREEN

- Replaced the 0447 Tier 1/v1 UI test with real R1 requests through local mock MQTT, Model 0, Model `-10`, Model 3200 `ui`, Model 3200-owned state/result, generic `result`, Model 0 return bus, and MQTT publish.
- The reviewed RED locks:
  - each request's own `op_id` must traverse Model 0, Model `-10`, and Model 3200, including pending and rejected requests;
  - `ui.update_data` replaces current state and appends history, `ui.tmp_data` updates temporary state without changing history, and `ui.form_data` appends submissions;
  - all three implemented actions use distinct non-default `payload_model_id` values in state, last result, and handler response, with no `payload_table_id` compatibility field;
  - empty payload and `Flow` root requests reject for all three implemented actions without changing state, `result`, Model 0 return bus, or MQTT publish;
  - `ui.refresh_data` is explicitly out of the 0457 behavior scope: it must return visible `ui_action_pending:refresh_data` and must not create refresh state, emit `result`, write the Model 0 return bus, publish MQTT, or refresh the frontend projection.
- Initial RED: `10 failed / 0 passed`; data/resource/task remained `11/13/37` passed.
- Initial RED review: `Change Requested` because tmp/form still used payload ID `1`, and refresh/rejection chain evidence could reuse labels left by a prior request.
- RED remediation:
  - update/tmp/form now use payload IDs `11/12/14`, rejection cases use `13/15/16`, and refresh uses `17`;
  - dispatch returns the current request's `op_id`, which every positive, pending, and rejected path compares at all three actor stages;
  - state, last result, and handler response explicitly require v2 naming for every implemented action.
- Strengthened RED re-review: `Approved`; no findings, questions, or verification gaps.
- GREEN implementation:
  - added `feishu_ui_manager` after data handling and before the generic response contract;
  - update/tmp/form state lives only on Model 3200 labels and preserves actual non-root payload records after excluding root metadata;
  - invalid requests and refresh pending write a visible Model 3200 result and stop the function chain before business output;
  - no UI business hook or frontend refresh behavior was added to the runtime kernel.
- Final verification:
  - UI family: `10 passed / 0 failed`;
  - data `11/11`, resource `13/13`, task `37/37`, Model 3200 actor/schema `8/8`;
  - DE actor `14/14`, unified transport `74/74`, control-first routing `14/14`, generic response materialization `4/4`, 0430, and existing response 0448-0452 regressions: PASS;
  - JSON/syntax, docs gate, and `git diff --check`: PASS.
- Independent GREEN review: `Approved`; no findings, questions, or verification gaps.
- No Feishu state was written and no OrbStack deployment was performed in this slice.
- Result: PASS for the Model 3200 UI family within the approved scope. Generic response/publish migration and live acceptance remain pending.

### Step 3G — F-01 Generic Response, Publish, and Two-Runtime Materialization Migration

- Replaced the 0448 response-outbox test with a real SSOT R1 request path through local mock MQTT, Model 0, Model `-10`, Model 3200 family handlers, the generic `result` output, Model 0 `remote_result_bus`, and the response-topic publish.
- The response contract now proves request correlation, complete endpoint/origin/reply-target identity, real task/resource handler output, management `bus`/`route_kind`, reversed management users, response suppression, and the F-08 no-dedicated-output boundary.
- Initial independent review: `Change Requested` because the invalid equal request/response topic case did not also cover `is_need_response=false`; an implementation that skipped address validation when response emission was disabled could have passed.
- Remediation added both `is_need_response=true` and `false` equal-topic cases. Both reject before Model 3200, leave business state/output unchanged, publish nothing, and write a visible Model 0 transport error.
- Replaced the 0449 publish test with two generic paths:
  - running R1 plus active local mock MQTT prepares the real Model 3200 result, writes the exact Model 0 return bus value, and publishes exactly once only to the response topic;
  - running R1 with no MQTT client accepts the same real v2 ingress and prepares the same result/return bus without publishing.
  - The removed edit-mode claim was not preserved because normal ModelTable functions intentionally do not execute in edit mode; preserving it would have required a forbidden Tier 1 business bypass.
- Replaced the 0452 same-runtime loopback with an in-process two-runtime actor regression:
  - a real R1 actor produces and publishes the response;
  - a distinct U1 CJS/ESM consumer receives the exact published packet and materializes it only into the table-qualified app target;
  - the producer never owns that target, the host endpoint pin remains untouched, a missing non-host target rejects without host fallback or auto-creation, and materialized JSON values are deep-cloned from the source packet.
- Final verification:
  - generic response contract: `5 passed / 0 failed`;
  - generic publish contract: `2 passed / 0 failed`;
  - two-runtime materialization: `2 passed / 0 failed`;
  - Model 3200 actor/schema `8/8`, generic response materialization `4/4`, unified transport `74/74`, control-first routing `14/14`, 0396 dual-topic, both 0430 contracts, and DE actor `14/14`: PASS;
  - syntax and scoped `git diff --check`: PASS.
- First independent GREEN review: `Approved`; no findings, questions, or verification gaps.
- Second independent GREEN review: `Change Requested` because the published packet still shared nested handler-result references with the R1 producer. Mutating the externally visible packet could therefore change Model 3200 catalog, last result, result, and Model 0 return-bus state even though the U1 consumer had already deep-cloned its copy.
- TDD remediation:
  - added a producer-state isolation assertion and observed the expected `1 failed / 1 passed` in 0452;
  - moved deep cloning to the generic BUS_OUT externalization boundary and changed response materialization to use the generic clone helper;
  - external packet mutation now leaves producer catalog, last result, result, return bus, and consumer materialized state unchanged.
- Final independent GREEN re-review: `Approved`; no findings, questions, or verification gaps.
- No Feishu state was written and no OrbStack deployment was performed in this slice.
- Result: PASS for the migrated generic response/publish/materialization evidence. Tier 1 v1 hard cut and live OrbStack acceptance remain pending.

### Step 4 — F-01 Tier 1 v2 Hard-Cut TDD RED

- Added `scripts/tests/test_0457_feishu_message_api_v2_hard_cut.mjs` without changing production code.
- The RED locks both CJS and ESM entrypoints against:
  - accepting the complete legacy `0/0.1` Feishu message shape or the same legacy shape with only its payload-kind text changed to v2;
  - retaining resource/data/UI/task manager instance state, legacy parser/dispatch/manager methods, Model 0 Feishu labels, or Feishu business intercepts;
  - retaining or renaming any standalone `scripts/lib/feishu_message_api*.mjs` parser surface.
- Preservation guards require formal numeric v2 to remain accepted, the complete malformed-v2 matrix to remain fail-closed, `sys_msg_type` outside Model 3200 to remain ordinary transport, and table-qualified v2 response materialization plus deep-clone behavior to remain intact.
- Code-state correction versus the earlier handoff: `packages/worker-base/src/runtime.js` is currently an eight-line CJS compatibility shim over canonical `runtime.mjs`, not a second runtime implementation. The RED therefore exercises both entrypoints while the production deletion will occur only in `runtime.mjs`.
- Initial RED: `10 expected failures / 6 preservation passes / 0 preservation failures`.
- Initial RED review: `Change Requested` because checking only deletion of `feishu_message_api_v1.mjs` would allow the same forbidden standalone parser to return under a v2 filename.
- Remediation scans the complete `scripts/lib/feishu_message_api*.mjs` surface and requires it to be empty.
- Strengthened RED: `11 expected failures / 6 preservation passes / 0 preservation failures`; no TypeError, syntax failure, or preservation regression.
- First independent RED re-review: `Approved`; no findings, questions, or verification gaps.
- Second independent RED review: `Change Requested` because the 0457 gate itself did not yet enumerate all Step 4 malformed formal-v2 boundaries even though broader historical tests covered some of them.
- Matrix remediation adds CJS/ESM cases for missing/zero/string `payload_model_id`, nested payload, duplicate metadata, missing endpoint/origin/reply table ids, topic endpoint mismatch, equal request/response topics, and removed `manage` routing, with exact fail-closed reasons.
- Final strengthened RED: `11 expected failures / 8 preservation passes / 0 preservation failures`; no TypeError, syntax failure, or preservation regression.
- Final independent RED re-review: `Approved`; no findings, questions, or verification gaps.
- No Tier 1 code, actor patch, Feishu state, or OrbStack deployment changed in this RED slice.
- Result: reviewed expected RED recorded; Tier 1 hard-cut GREEN may begin.

### Step 5 — F-01 Tier 1 v2 Hard-Cut GREEN

- Removed the Feishu resource/data/UI/task manager instance state, v1 parser/validator, business dispatch, response-outbox special cases, Model 0 business labels/intercepts, and family handlers from canonical `runtime.mjs`.
- Deleted `scripts/lib/feishu_message_api_v1.mjs`; no standalone v2 parser was added. `runtime.js` remains the unchanged CJS shim over `runtime.mjs`.
- Retained the generic formal-v2 validator, generic BUS_OUT externalization, declared bus/pin routing, table-qualified response materialization, and deep cloning at external publish/materialization boundaries.
- Replaced 0442 and 0443 with current-contract evidence:
  - worker-root `model.v1n` and numeric `model.subtableconnection` remain covered;
  - complete old `0/0.1` input and fake-v2 legacy input reject without Tier 1 Feishu state;
  - formal v2 dispatches through the real SSOT R1 actor into Model 3200 for resource/data/UI/task behavior.
- Hard-cut detector TDD chronology:
  - Added a real MQTT outer-packet case and observed the expected `2 failed / 19 passed`; moved the explicit legacy result to the common parser boundary, then reached `21/21`.
  - Added a non-Feishu dotted-id counterexample and observed the expected `2 failed / 21 passed`; required the full old root/version/bus/subtable scaffold, then reached `23/23`.
  - Added high-similarity non-Feishu scaffold cases for missing endpoint, `R1/100`, and `U1/3200`, plus a legacy R1 Model 3200 case without `sys_msg_type`; observed the expected `2 failed / 25 passed`.
  - Final detector requires the old scaffold plus a canonical `R1` Model `3200` endpoint. Direct BUS_IN and real MQTT now report the same explicit legacy reason, unrelated invalid arrays retain generic classification, and the endpoint—not `sys_msg_type`—is the discriminator.
  - Final CJS/ESM hard-cut result: `27 passed / 0 failed`.
- Regression remediation:
  - 0364 still built old nested `pin_payload.v1` fixtures; the first run exposed `7 passed / 2 failed`. Migrated only those fixtures to formal flat v2 with table-qualified endpoint/origin/reply records and legal control/management fields; final result `9/9`.
  - Two stale test descriptions tripped the 0396 historical-topic wording scan while still asserting the correct rejection. Reworded the descriptions without changing behavior; the complete 0396 surface scan now passes.
- Final focused verification:
  - 0442–0452: `6/6`, `5/5`, `37/37`, `13/13`, `11/11`, `10/10`, `5/5`, `2/2`, `4/4`, and `2/2`.
  - Model 3200 actor/schema `8/8`; local DE actor contract `14/14`.
  - Generic transport/response: 0332 `32/32`, 0375 `74/74`, 0376 `14/14`, 0417 `10/10`, both 0430 contracts, and 0396: PASS.
  - Actor/runtime: 0196 `3/3`, 0197 `2/2`, 0328 `4/4`, 0362 `11/11`, 0364 `9/9`, 0379 `3/3`, and 0419: PASS.
  - Runtime/test syntax, docs gate, scoped `git diff --check`, and legacy Tier 1 surface scan: PASS.
- Independent detector precision re-review: `Approved`; no findings or verification gaps.
- Final independent hard-cut slice review: `Approved`; no findings, open questions, or verification gaps for the bounded deterministic slice.
- No Feishu state was written and no OrbStack deployment was performed in this slice.
- Result: PASS for deterministic Tier 1 hard-cut and migrated runtime contracts. Live test app, rollback snapshot, and OrbStack acceptance remain pending.

### Step 6.5 — Execution-discovered Host-Egress Amendment

- Read-only Step 7 feasibility inspection on 2026-07-13 found a concrete difference from the approved resolution:
  - `remote_bus_endpoint_v1.route_kind` is currently app-wide, so every imported public egress pin uses the same bus;
  - the generated host bridge remaps every emitted record to business Model `1`, so `is_need_response`, `send_user`, `receive_user`, `message_server`, and `between` cannot remain v2 envelope-root records;
  - the removed dotted-id Feishu input is rejected on the imported positive output pin before R1, but the current reason is only `pin_payload_not_modeltable`.
- Therefore the original Step 7 statement that only a fixture/verifier was needed is not executable against current code. No live fixture, deployment, or OrbStack mutation was started under that false assumption.
- The approved outcome and ownership remain unchanged. A generic prerequisite was added to `plan.md` and `resolution.md`:
  - optional per-public-pin `egress_routes` with fallback to the existing app default;
  - declared safe `envelope_extension_keys`, lifted only from exact root records;
  - generic `bus_send.v1` safe-extension preservation with reserved/authority/duplicate/placement rejection;
  - reuse of the rejection-only legacy detector at positive-pin validation.
- Production scope is limited to UI Server adapter generation and canonical generic runtime transport. MBR remains transparent and Model 3200 remains the sole Feishu schema/business owner.
- Initial amendment RED evidence:
  - direct CJS/ESM `bus_send.v1` safe-extension preservation and unsafe-shape rejection: `4` intended failures, `0` preservation failures;
  - imported declaration/route/export/bridge contract: `0 passed / 3 intended failures`;
  - positive-pin legacy reason: `2` intended failures while all `27` hard-cut/preservation assertions passed.
- Existing-regression correction discovered before GREEN: `test_0322_imported_host_egress_contract.mjs` currently has one stale host-model assumption and reports `1 passed / 1 failed`, while its real subtable server-flow companion remains `1/1` PASS. This pre-existing failure is not treated as Step 6.5 GREEN evidence.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `4`
  - Decision: `Change Requested`
  - Notes: the legacy RED used a host positive model rather than the real imported App-table Model `0` or deployed R1 MQTT boundary; duplicate Feishu root extensions still pass Model 3200; runtime safe/declared extension and default-route evidence was incomplete.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `5`
  - Decision: `Change Requested`
  - Notes: safe/reserved namespaces, authority keys, limits, declaration transfer, table-qualified live boundary, round-trip/reapply, and revision accounting were not fully frozen.
- Major revision accounting:
  - Phase 2 revision 1 and revision 2 are recorded above.
  - The initial Step 6.5 production prerequisite is major revision 3 because it changes production scope, protocol declaration, and the live verification boundary.
  - Resolving the two Change Requested decisions would require major revision 4. `docs/WORKFLOW.md` permits at most three and requires `On Hold` plus human adjudication before any further GREEN work.
- On Hold corrective proposal (not yet adopted):
  - verify the deployed legacy negative through local MQTT → R1 Model 0, and prove Model 3200 state/output is unchanged; remove the incorrect positive-host-model claim;
  - reject duplicate root Cell/key records as a generic Temporary ModelTable structural rule, so Model 3200 remains the Feishu owner without Tier 1 Feishu-key allowlists;
  - move the shared extension-key rules into one generic module used by UI Server and runtime; use a reserved namespace strategy with exact key/prefix rules, maximum `16` declared keys, and maximum key length `64`;
  - include the declared key list in internal `bus_send.v1`, require every passthrough extension to be declared, and reject reserved, authority, duplicate, non-root, undeclared, and extra-model records;
  - add default-route fallback plus export/import/reapply evidence before GREEN.
- Status: `On Hold`, pending explicit human approval to exceed the major-revision limit. No production GREEN, Feishu write, rollback snapshot, env mutation, or OrbStack deployment was performed after the review.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `User`
  - Review Index: `6`
  - Decision: `Approved`
  - Notes: the user explicitly approved Revision 4 and authorized continuation beyond the normal three-major-revision limit.
- Revision 4 adopted boundaries:
  - legacy deployment evidence moves to local Mosquitto → R1 Model 0 and must prove explicit rejection plus unchanged Model 3200 state/output;
  - duplicate root Cell/key rejection becomes a generic Temporary ModelTable structural rule, not a Feishu-key rule;
  - UI Server and runtime share one generic extension-key rule module with an exact reserved namespace strategy, limit `16`, and key length limit `64`;
  - internal `bus_send.v1` carries the declared-key list and rejects reserved, authority, duplicate, non-root, undeclared, or extra-model records;
  - RED must cover default route fallback and declaration export/import/reapply before GREEN.
- Status: Revision 4 is approved by the deciding human role. Three consecutive independent amendment reviews remain required by Step 6.5 before production GREEN.

### Revision 4 Reviewed RED Baseline

- The approved Revision 4 was translated into deterministic contracts before production edits:
  - `test_0457_imported_host_egress_prerequisite.mjs` now covers per-pin route preservation, exact reserved-key/grammar/count/length rejection, full and partial default resolution, export/import/reapply, untouched normal persistence restart, derived-state recovery restart through `createServerState`, and declared root-extension lifting. Current code reports `0 passed / 6 intended failures`.
  - `test_0430_feishu_operational_ssot_contract.mjs` covers direct CJS/ESM `bus_send.v1` extension preservation and fail-closed unsafe shapes. Current code reports the expected `6` RED assertions: preservation, duplicate rejection, and mixed declared-payload-plus-extra-model rejection per runtime; all previously migrated checks continue before those RED assertions.
  - The initial pre-review draft of `test_0457_feishu_model3200_actor_contract.mjs` covered generic duplicate root Cell/key and non-root Model 0 rejection, then also proposed Model 3200-owned rejection of unexpected Feishu payload models. That draft reported `7 passed / 2 intended failures`; the later review history below records why the second RED was removed.
  - `test_0457_remote_worker_diagnostic_contract.mjs` freezes stable, pure, non-secret live evidence and runner wiring. Current code reports `0 passed / 2 intended failures` because the helper and marker do not exist yet.
- The shared extension rule is frozen before GREEN:
  - grammar `^[a-z][a-z0-9_]*$`, length `1..64`, at most `16` unique keys;
  - the exact reserved-key list and reserved prefixes are recorded in `resolution.md` and must come from one shared module in UI Server and runtime.
- Read-only live-boundary analysis confirmed the exact local public topic as `UIPUT/ws/dam/pic/de/R1/3200/resource` and the removed outer packet shape as exactly `{version:'v1',type:'pin_payload',payload:[...]}`.
- Current deployed observability can prove transport rejection but cannot independently prove the Model 0 error record and unchanged Model 3200 state/output. Step 7 therefore requires a non-secret diagnostic marker with Model 0 error fields and stable Model 3200/result hashes; it adds no actor mutation or read API.
- `node scripts/ops/validate_obsidian_docs_gate.mjs` and `git diff --check` both PASS after the Revision 4 amendment.
- No production GREEN, Feishu write, rollback snapshot, local env mutation, or OrbStack deployment has occurred in this baseline.

### Revision 4 Review Reset and RED Closure

- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `7`
  - Decision: `Change Requested`
  - Notes: safe-extension positives could be satisfied by a Feishu allowlist or shallow copy; partial route fallback, complete reserved namespace evidence, and executable local-Mosquitto verifier evidence were incomplete.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `8`
  - Decision: `Change Requested`
  - Notes: independently confirmed the same four RED gaps. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `9`
  - Decision: `Change Requested`
  - Notes: the local MQTT negative did not yet prove a bounded post-publish silence window or bind all rejection evidence to a fresh probe, and the non-injected default dependency factory for the real local tunnel/MQTT/diagnostic path was not frozen by a contract. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `10`
  - Decision: `Change Requested`
  - Notes: shared-rule coverage could still pass through source-text assertions rather than executable UI Server/runtime integration; malformed declaration shapes, a non-Feishu public pin, and an actual generated two-pin bridge traversing the two bus outputs were not all proved. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `11`
  - Decision: `Change Requested`
  - Notes: moving extra-model rejection into Model 3200 contradicted the approved prerequisite scope, which says Model 3200 does not change, and risked breaking formal-v2 provider bundles using `bundle_record_id_offset` and inline models. The compatibility set also needed to name 0375/0376/0384 together. Consecutive Approved count remains `0`.
- The requested RED closure adds no new production outcome or ownership:
  - a non-Feishu `custom_trace:json` extension and mutation-after-send assertion now require generic declaration handling plus deep-clone isolation;
  - partial overrides now prove `per-pin override → remote endpoint default → control` for both remaining branches;
  - server and direct runtime matrices cover every frozen reserved prefix, while `test_0457_pin_payload_envelope_extension_rules.mjs` freezes the complete ordered exact-key/prefix sets, limits, grammar, validation API, and shared imports. Current code reports `0 passed / 2 intended failures` because the shared module does not yet exist;
  - `test_0457_orbstack_e2e_verifier_contract.mjs` freezes the exact three-key legacy outer packet, dotted-id payload, local public topic, fresh Model 0 rejection, unchanged Model 3200/result hashes, no accepted ingress, a bounded response-silence window, an executable local tunnel/MQTT/diagnostic/trace pipeline with real default-dependency wiring, absence of direct actor mutation, and `finally` cleanup at every failure stage. After Reviews 15-17 it reports `0 passed / 10 intended failures` because the helper, trace serializer, parser, and verifier do not yet exist.
- These are test/evidence clarifications inside the human-approved Revision 4 boundary, not a fifth major revision. Production GREEN remains blocked pending three new consecutive independent `Approved` reviews.
- The corrective work required by Reviews 9-11 is now scoped as follows, but is not yet claimed complete:
  - the MQTT probe contract must bind rejection/trace evidence to the fresh post-publish window, observe the unique response subscription for a bounded silence interval, reject stale evidence, and exercise the real non-injected default dependency factory for the local Mosquitto tunnel, diagnostic read, and trace read;
  - the shared-rule contract must execute the same module through both UI Server import validation and runtime `bus_send.v1`, reject malformed declaration containers/entries, include a non-Feishu public pin, and drive an actual generated two-pin bridge through distinct control and management outputs rather than only inspecting stored declarations or source text;
  - extra-model rejection applies only to internal `bus_send.v1`, whose input is restricted to Model `0` plus its one declared payload model. Generic public `pin_payload.v2` keeps `bundle_record_id_offset` and inline positive-model compatibility, and Model 3200 keeps its existing schema without a prerequisite-driven `unexpected_payload_model` rule;
  - the mandatory compatibility trio is `test_0375_unified_worker_model_topic_contract.mjs`, `test_0376_control_first_mbr_routing_contract.mjs`, and `test_0384_provider_owned_slide_app_install_flow.mjs`.
- The current Model 3200 actor contract therefore reports `7 passed / 1 intended failure`; only the generic Model `0` duplicate/non-root structural RED remains in that file. The removed actor extra-model draft is retained above as review history, not as current scope.
- Consecutive amendment `Approved` count: `0`. No production GREEN, Feishu write, rollback snapshot, local env mutation, or OrbStack deployment is authorized until three new consecutive independent reviews approve the corrected RED set.

### Revision 4 Review 12-14 — Further RED Evidence Corrections

- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `12`
  - Decision: `Change Requested`
  - Notes: the live verifier still lacked an executable real runtime-trace → runner-log → parser → evaluator contract, bounded local-tunnel/marker polling, a post-rejection quiet period, and a mixed valid-payload-plus-extra-model rejection case. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `13`
  - Decision: `Change Requested`
  - Notes: the diagnostic hash contract could accept a constant fake hash, the live rejection was not bound to the unique probe packet, fresh-log polling was not frozen, and exact accepted limits `16` keys / `64` characters were untested. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `14`
  - Decision: `Change Requested`
  - Notes: export/reimport did not exercise the actual startup reapply path; freshness was not bound to `publishedAt`; diagnostic hash schema and the complete local-only infrastructure boundary were not yet executable contracts. Consecutive Approved count remains `0`.
- The next RED correction remains inside approved Revision 4 and adds no production owner or outcome:
  - bind rejection evidence to the exact outer packet, unique marker, response topic, and `publishedAt` through the real runtime trace/log/parser path;
  - use bounded readiness/fresh-marker polling, validate diagnostic hash schema, then observe a conservative quiet period after fresh rejection evidence; all timeout paths must clean up once;
  - require local OrbStack Mosquitto and Synapse/Matrix, reject remote MQTT/Matrix/OIDC endpoints, and keep Feishu HTTPS connectivity allowed;
  - execute the actual server startup reapply path, add known SHA-256 vectors and exact limit acceptance, and reject a mixed declared payload plus extra model without writing bus output.
- The Review 12-14 corrections are now executable RED:
  - diagnostic `0/2`, with the standard SHA-256 `abc` vector, object-order stability, value sensitivity, and array-order sensitivity;
  - shared rules `0/2`, with exact acceptance at `16` keys and `64` characters plus rejection at `17` and `65`;
  - imported host egress `0/5`, including real persisted restart/reapply;
  - direct CJS/ESM runtime has `6` intended failures, including the mixed valid payload Model `1` plus extra Model `2` case with no bus output;
  - OrbStack verifier `0/8`, including the actual R1 runtime rejection → runner marker → parser → evaluator path, exact packet correlation, `publishedAt`, strict diagnostic schema, bounded readiness/evidence polling, post-evidence quiet period, local Matrix/MQTT boundary, Feishu HTTPS allowance, and timeout cleanup.
- `node --check` for all six Revision 4 tests, docs gate, and `git diff --check` PASS after these corrections.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `15`
  - Decision: `Change Requested`
  - Notes: the shared validator result did not yet provably drive both consumers, the runner path did not execute the same log formatter with the real trace delta, local Synapse truth was only an env string, and port-forward timeout cleanup was not asserted. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `16`
  - Decision: `Change Requested`
  - Notes: exact `16`/`64` acceptance was not exercised through both real consumers, runner delta formatting and local deployment truth were still incomplete, and port-forward timeout cleanup could leak. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `17`
  - Decision: `Change Requested`
  - Notes: trace evidence did not yet freeze an exact redacted schema, MQTT connect/subscribe/publish could hang, the local boundary did not execute deployed baseline/Synapse checks or restrict the Feishu host, and restart lacked the normal untouched import→persist→restart path. Consecutive Approved count remains `0`.
- The Review 15-17 RED correction remains inside Revision 4:
  - one shared formatter consumes the actual runtime trace delta in the runner, emits only exact non-secret diagnostic/trace projections, and replaces raw trace logging;
  - MQTT connect/subscribe/publish, port-forward readiness/error/exit, diagnostic polling, and trace polling all have bounded failure plus exact-once cleanup;
  - local truth executes the existing runtime baseline check plus a bounded Synapse service/readiness check, and Feishu allowance is restricted to the approved `https://open.feishu.cn` host;
  - both real shared-validator consumers accept the exact `16`/`64` boundary and use the validator result, and persistence covers both untouched normal restart and derived-state recovery restart.
- The Review 15-17 correction is now executable RED:
  - imported host egress `0/6`; both normal and recovery restart paths use the production SQLite/create-state path;
  - shared rules `0/2`, with consumer source contracts plus real Server/runtime positive and negative matrices proving the shared result drives the boundary;
  - OrbStack verifier `0/10`, including exact redacted log formatting from the real runtime delta, MQTT operation timeouts, port-forward startup cleanup, baseline execution, and an MBR→local-Synapse HTTP schema check;
  - diagnostic `0/2` and migrated observability contract expected RED require the shared formatter, prohibit raw MQTT trace output, and require the remote-worker image to package both `de_actor_attestation.mjs` and `de_runtime_diagnostics.mjs`;
  - Feishu allowance is restricted to HTTPS host `open.feishu.cn`; lookalike and other HTTPS hosts fail closed.
- All seven affected tests pass `node --check`; docs gate and `git diff --check` PASS. No production file, local environment, deployment, rollback snapshot, or Feishu state was changed.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `18`
  - Decision: `Change Requested`
  - Notes: trace polling timeout was not independently exercised. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `19`
  - Decision: `Change Requested`
  - Notes: runner formatter output was not the only executable emission path, log reads lacked a locked timeout, the formatter could ignore its delta, and cleanup failures could interrupt the second resource cleanup. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `20`
  - Decision: `Change Requested`
  - Notes: the default MQTT adapter did not prove MQTT.js connect/SUBACK/publish/end callback semantics, cumulative Kubernetes logs were not parsed with production parsers, and duplicate root `envelope_extension_keys` declarations were untested. Consecutive Approved count remains `0`.
- The Review 18-20 correction remains evidence-only:
  - execute one shared diagnostic/trace emitter with an injected writer as the runner's only evidence output; it consumes only the supplied delta and cannot serialize raw trace state elsewhere;
  - give every log read an explicit timeout, test independent diagnostic and trace polling timeouts, and attempt both resource cleanups exactly once even if either cleanup throws;
  - adapt MQTT.js connect, subscribe, publish, and end callbacks to awaited operations with bounded failures; parse cumulative old/malformed/fresh marker logs using the production parsers;
  - reject duplicate internal root `envelope_extension_keys` declarations without writing a bus output.
- The Review 18-20 correction is now executable RED:
  - the diagnostic contract `0/2` invokes the shared emitter with an injected writer and requires exactly the formatter's two lines; 0184 requires one runner emitter call, no direct formatter/raw serialization, and both helper files in the image;
  - the OrbStack verifier reports `0/12`: it proves delta-only emission, cumulative-log production parsing, MQTT.js connect/SUBACK/publish/end callbacks and failure timeouts, per-read log timeouts, independent diagnostic/trace polling timeouts, and cleanup isolation while preserving the primary error;
  - direct CJS/ESM runtime now has `8` intended failures, adding duplicate internal root declaration rejection per runtime with no bus output;
  - hard-cut `27/27`, all seven RED files pass `node --check`, docs gate, and `git diff --check` PASS.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `21`
  - Decision: `Approved`
  - Notes: no findings. Consecutive Approved count reached `1` on the frozen snapshot.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `22`
  - Decision: `Change Requested`
  - Notes: runner cursor was not behaviorally executed; cleanup errors could override an evaluator failure result; MQTT listeners/timers and outer/inner timeout ordering were incomplete; one log read could outlive the poll bound. Consecutive Approved count reset to `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `23`
  - Decision: `Change Requested`
  - Notes: imported egress evidence bypassed the real root-pin/connection chain, non-Feishu root/non-root extension placement was incomplete, and cumulative trace parsing could drop an earlier accepted-ingress event. Consecutive Approved count remains `0`.
- The Review 21-23 correction remains evidence-only:
  - a shared stateful emitter factory owns the actual MQTT trace cursor, so the runner cannot replace the current delta or emit raw trace elsewhere;
  - evaluator failure results survive cleanup failures, MQTT.js listeners/timers are observable and cleaned, the adapter timeout completes before the outer probe timeout, and each log-read timeout is shorter than the overall evidence poll bound;
  - cumulative trace parsing preserves all fresh correlated event types needed to detect an earlier accepted ingress before a later rejection;
  - imported egress is driven from the actual public root pin through generated connection labels and both buses, including generic `alpha/omega` root-lift plus non-root remap behavior.
- The Review 21-23 correction is now executable RED:
  - imported host egress remains `0/6`, but every positive route now starts with `runtime.addLabel(... pin.out ...)` and `programEngine.tick()`, asserts the generated cell/label connection graph, observes the final control/management bus output, and includes a broken-connection negative; direct bridge/private bus-send invocation was removed;
  - generic `alpha/omega` now proves exact-root `custom_trace` lifting and non-root same-key remap to business payload; resource/data and both restart paths use the same full chain;
  - diagnostic remains `0/2` with executable `createDeRuntimeDiagnosticEmitter({runtime,writeLine})`, owned cursor, incremental/empty delta, writer failure without cursor advance, and successful retry; runner/0184 prohibit any local cursor/list/slice/delta implementation;
  - OrbStack verifier reports `0/15`, adding cleanup-result preservation, timer/listener lifecycle, post-connect MQTT error handling, adapter-before-outer timeout ordering, a per-log timeout below the poll bound, never-resolving read coverage, and accepted-ingress preservation across cumulative trace markers;
  - direct CJS/ESM runtime remains at `8` intended failures; hard-cut `27/27`, syntax, docs gate, and `git diff --check` PASS.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `24`
  - Decision: `Change Requested`
  - Notes: MQTT response listeners were not required to be removed after success, failure, or timeout. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `25`
  - Decision: `Change Requested`
  - Notes: normal/recovery restart lacked a waitable startup boundary and explicit shutdown, so late background warnings/writes or active adapters could escape the test; MQTT listener cleanup was also incomplete. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `26`
  - Decision: `Change Requested`
  - Notes: a post-connect MQTT error during the response-silence window could still be misread as successful silence, and temporary response listeners were not proven removed. Consecutive Approved count remains `0`.
- The Review 24-26 correction remains evidence-only:
  - `createServerState` exposes a waitable readiness boundary and idempotent shutdown used by both restart paths; shutdown drains pending work, disables runtime, closes persistence/adapters, and leaves no late warning, rejection, or snapshot write;
  - the probe owns explicit message/error listener disposers and invokes them once on every outcome; a connection error during the silence window invalidates acceptance and still cleans both resources.
- The Review 24-26 correction is now executable RED:
  - imported host egress remains `0/6`; normal and recovery restart paths require `await state.whenReady()` before observation and idempotent `await state.shutdown()` for final settlement, including pending-action drain, edit/non-running runtime, MQTT/Matrix/persistence closure, no active background work, and a bounded quiet period with no late warning, rejection, or snapshot mutation;
  - the OrbStack verifier remains `0/16`; every MQTT success/failure/timeout/cleanup path owns and disposes its temporary message/error listeners exactly once, and a connection error during the response-silence window fails as `mqtt_connection_lost` rather than `verified`;
  - shared extension rules remain `0/2`, diagnostics remain `0/2`, direct CJS/ESM runtime retains `8` intended failures, Model3200 retains `1` intended generic envelope failure with `7` preservation passes, and 0184 remains expected RED;
  - F-01 hard-cut remains `27/27`; compatibility suites remain `74/74`, `14/14`, `10/10`, `3/3`, and `1/1`; all changed RED files pass syntax checks, docs gate, and `git diff --check` PASS.
- Production GREEN remains blocked until these corrections pass another three consecutive independent reviews.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `27`
  - Decision: `Change Requested`
  - Notes: shutdown could return a fixed summary and clear references without closing active MQTT/Matrix/SQLite resources or waiting for controlled tick/init work; warning capture and the other Server-state tests also did not settle the full lifecycle. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `28`
  - Decision: `Change Requested`
  - Notes: shutdown did not behaviorally prove active adapter/persistence closure or a real in-flight tick drain, and the MQTT response listener could be disposed before the silence window while the test invoked a saved callback directly. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-13`
  - Review Type: `AI-assisted`
  - Review Index: `29`
  - Decision: `Change Requested`
  - Notes: local-only validation had no bounded post-acceptance log check for remote Matrix/MQTT/OIDC access, so runtime traffic outside OrbStack could escape detection; active resource closure was likewise not behaviorally observed. Consecutive Approved count remains `0`.
- The Review 27-29 correction remains evidence-only:
  - inject active observable MQTT, Matrix, persistence, tick, and initialization resources; require shutdown to remain pending until controlled work settles, invoke each real close path exactly once, capture every `ProgramModelEngine` warning, and apply readiness/shutdown to every created Server state;
  - keep the MQTT message listener registered for the full silence window and drive late-response rejection through the actual EventEmitter path;
  - scan bounded post-acceptance deployment logs from the probe start time, reject remote Matrix/MQTT/OIDC destinations, and allow Feishu HTTPS only when the parsed hostname is exactly `open.feishu.cn`.
- The Review 27-29 correction is now executable RED:
  - imported host egress remains exactly `0/6`; every created state awaits readiness and settles through two idempotent shutdown calls before directory cleanup, while active MQTT, Matrix, and SQLite doubles plus controlled tick/init/action work prove real drain and exactly-once close behavior rather than trusting a returned summary or cleared reference;
  - lifecycle warning capture now observes every `ProgramModelEngine` warning, includes a rejecting Matrix action, and proves shutdown remains pending through each staged release with no late warning, unhandled rejection, or snapshot mutation;
  - the OrbStack verifier is exactly `0/17`; a late response is delivered through the real EventEmitter during the full silence window and must fail as `legacy_response_emitted`, with listener/timer disposal proven on every settlement;
  - the main probe performs a bounded post-silence acceptance-window audit, and default dependencies read `mbr-worker`, `remote-worker`, `synapse`, and `mosquitto` logs since `startedAt`, fail closed on read error/timeout or remote/lookalike Matrix/MQTT/OIDC destinations, and allow Feishu only for HTTPS whose parsed hostname is exactly `open.feishu.cn`;
  - full frozen-snapshot verification confirms shared rules `0/2`, imported egress `0/6`, diagnostics `0/2`, verifier `0/17`, direct CJS/ESM runtime `8` intended failures, Model3200 `1` intended failure with `7` preservation passes, and 0184 expected RED; F-01 hard-cut remains `27/27`, compatibility remains `74/74`, `14/14`, `10/10`, `3/3`, and `1/1`, with all RED syntax checks, docs gate, and `git diff --check` PASS.
- Production GREEN remains blocked until these corrections pass another three consecutive independent reviews.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `30`
  - Decision: `Change Requested`
  - Notes: the acceptance audit depended on synthetic network log lines without requiring fresh production evidence, and effective MQTT preflight did not cover the runner's higher-priority `DY_MQTT_HOST`/`DY_MQTT_PORT` values. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `31`
  - Decision: `Change Requested`
  - Notes: shutdown proved MQTT/Matrix close calls but not asynchronous settlement, and post-acceptance network evidence could be absent while the audit still passed. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `32`
  - Decision: `Change Requested`
  - Notes: runner contracts did not prove the diagnostic emitter was invoked, `whenReady()` had no controlled pending/rejection behavior, and asynchronous adapter close settlement plus production network-marker generation remained unproven. Consecutive Approved count remains `0`.
- The Review 30-32 correction remains evidence-only:
  - make `whenReady()` wait for controlled in-flight startup/init work and propagate rejection; make shutdown remain pending until deferred Matrix close and MQTT end callbacks actually settle;
  - freeze a shared non-secret network-boundary evidence producer/parser, require the R1 runner to invoke diagnostic and boundary evidence emission on the executable path, and fail closed when fresh required evidence is absent;
  - validate the effective deployed endpoint configuration using production precedence, including `DY_MQTT_HOST`/`DY_MQTT_PORT`, and bind the post-acceptance audit to fresh evidence plus the deployed configuration rather than synthetic log text alone.
- The Review 30-32 correction is now executable RED:
  - imported host egress remains exactly `0/6`; controlled tick/Matrix-init readiness and rejection prove `whenReady()` settlement, while deferred Matrix close and MQTT end callbacks prove shutdown waits for asynchronous completion before returning and remains exactly-once on a second call;
  - 0184 is now exactly `0/3`: it freezes the shared `DE_NETWORK_BOUNDARY` producer/parser/evaluator API and redacted schema, requires executable `after_start` and interval diagnostic emission plus pre-MQTT `effective_config`/`outbound_attempt` evidence, preserves environment precedence, and requires the new helper in the remote-worker image;
  - the OrbStack verifier is now exactly `0/18`: missing, stale, malformed, or incomplete required evidence fails closed; MBR/R1 require fresh config and attempt markers; Synapse/Mosquitto require bounded post-deploy effective configuration inspection; `DY_MQTT_HOST`/`DY_MQTT_PORT` override lower-priority values and remote/lookalike/missing cases fail;
  - the same shared evidence contract permits only local Matrix/MQTT endpoints or exact HTTPS `open.feishu.cn`, strips userinfo/query/secrets, and binds log/config read failures and timeouts to fail-closed cleanup behavior.
  - full frozen-snapshot verification also preserves shared rules `0/2`, diagnostics `0/2`, direct CJS/ESM runtime `8` intended failures, and Model3200 `1` intended failure with `7` preservation passes; F-01 hard-cut remains `27/27`, compatibility remains `74/74`, `14/14`, `10/10`, `3/3`, and `1/1`, with all RED syntax checks, docs gate, and `git diff --check` PASS.
- Production GREEN remains blocked until these corrections pass another three consecutive independent reviews.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `33`
  - Decision: `Change Requested`
  - Notes: R1 producer used `service=mqtt` while the verifier required `service=remote-worker`; startup-only evidence was older than the later acceptance window, and no MBR producer contract existed. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `34`
  - Decision: `Change Requested`
  - Notes: producer/consumer identity and freshness requirements were mutually unsatisfiable under rollout-then-E2E ordering, while synthetic MBR markers could make unit tests green without a live producer. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `35`
  - Decision: `Change Requested`
  - Notes: the same service-schema conflict remained, and static call-site inspection could be satisfied by unreachable diagnostic/network emission without producing runtime evidence. Consecutive Approved count remains `0`.
- The Review 33-35 correction remains evidence-only:
  - canonical producer identities are the deployed actor names `remote-worker` and `mbr-worker`; protocol describes MQTT/Matrix/HTTP rather than replacing actor identity;
  - each actor emits a redacted `effective_config` heartbeat during the acceptance window, while every observed `outbound_attempt` is evaluated if present; the legacy negative probe does not require an outbound attempt, and the later positive control/management E2E remains responsible for proving real outbound traffic;
  - add an MBR producer contract and execute the actual R1/MBR runner observability path under injected local dependencies, so unreachable or commented call sites cannot satisfy RED;
  - require fresh actor config heartbeats plus inspected Synapse/Mosquitto effective configuration, with producer output flowing unchanged through the shared parser into the verifier audit.
- The Review 33-35 correction is now executable RED:
  - 0184 is exactly `0/4`; it behaviorally executes exported runner-owned R1 and MBR installers with injected shared factory, writer, clock, timer, and cleanup, requiring startup plus interval `effective_config` heartbeats and transport-adjacent `outbound_attempt` emission under canonical `remote-worker`/`mbr-worker` identities;
  - the MBR producer covers both Matrix and MQTT destinations, every heartbeat obtains a new timestamp, `recordOutbound` and idempotent stop are behaviorally observed, and unreachable/static-only call sites cannot satisfy the installer contract;
  - the OrbStack verifier remains exactly `0/18`; required fresh actor evidence is MBR Matrix HTTP plus MQTT config and R1 MQTT config, while Synapse/Mosquitto come from bounded effective-configuration inspection;
  - a stale startup marker plus fresh interval heartbeat passes, stale-only or a missing MBR/R1 transport fails closed, and the legacy probe does not require outbound; every outbound record that does appear is still evaluated and remote/lookalike destinations fail;
  - a final read-only producer→consumer pre-review found the shared identity/schema/freshness requirements aligned; both target RED files pass syntax, docs gate, and `git diff --check`.
  - full frozen-snapshot verification preserves shared rules `0/2`, imported egress `0/6`, diagnostics `0/2`, direct CJS/ESM runtime `8` intended failures, and Model3200 `1` intended failure with `7` preservation passes; F-01 hard-cut remains `27/27`, compatibility remains `74/74`, `14/14`, `10/10`, `3/3`, and `1/1`.
- Production GREEN remains blocked until these corrections pass another three consecutive independent reviews.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `36`
  - Decision: `Change Requested`
  - Notes: MBR installer behavior was executed in isolation, but the static startup-site check was not scoped to the real `main()` body; an uncalled same-depth function could satisfy it. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `37`
  - Decision: `Change Requested`
  - Notes: an independent reviewer confirmed the same MBR startup-path false green: brace depth alone did not prove `main()` installs the observer. Consecutive Approved count remains `0`.
- The Review 36-37 correction remains evidence-only:
  - extract and inspect the actual `main()` body, require one direct installer initializer inside that body before real MQTT/Matrix startup, and require the standard executable entrypoint to invoke that same `main()`;
  - keep the exported runner-owned installer behavioral probe unchanged, so both installer behavior and its real startup ownership must hold.
- The Review 36-37 correction is now executable RED:
  - 0184 remains exactly `0/4`, but MBR now additionally requires an exported callable `main(options = {})` and behaviorally invokes that real entry with an explicit local patch directory plus an injected installer;
  - the injected installer records canonical arguments and throws an identity sentinel before patch continuation or any MQTT/Matrix connection, proving `main()` reaches the real installation point exactly once; network dependencies are test traps and argv/env/exit state are restored in `finally`;
  - the standard top-level executable entrypoint, direct installer ownership/order, exported installer behavior, startup/interval/outbound evidence, and idempotent stop remain independently locked; syntax and `git diff --check` PASS with no network attempt.
- Production GREEN remains blocked until these corrections pass another three consecutive independent reviews.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `38`
  - Decision: `Change Requested`
  - Notes: the real MBR harness exercised only `main(options)` with an injected installer, so a default `main()` branch could skip observability while all assertions stayed green; the MQTT trap also did not prove that the installed package exposed it through the exact `require('mqtt').connect` getter used by the runner. Consecutive Approved count remains `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `39`
  - Decision: `Change Requested`
  - Notes: the producer heartbeat was fixed at ten seconds while the verifier bounded the entire network-boundary stage to five seconds; a correct local deployment could therefore fail before its first fresh interval heartbeat. Consecutive Approved count remains `0`.
- The Review 38-39 correction remains evidence-only:
  - behaviorally execute both the injected `main(options)` seam and the default `main()` path, trap the actual CommonJS MQTT export used by the runner, and require default startup to emit canonical MBR effective-configuration evidence before the trapped outbound call;
  - retain the ten-second heartbeat, poll deployed actor logs for fresh evidence inside a fifteen-second evidence window, and give only the network-boundary stage a separate forty-second outer deadline so one full heartbeat plus the two final actor-log reads, two one-time config reads, and cleanup cannot be cut off by the generic five-second operation timeout;
  - replace fabricated immediately-fresh verifier fixtures with a deterministic stale-first producer timeline whose fresh heartbeat becomes visible only after the injected clock advances by the real interval.
- The Review 38-39 correction is now executable RED:
  - 0184 remains exactly `0/4`; its real MBR harness now proves the installed MQTT package getter resolves to the local trap, runs both injected and default `main()` paths, advances the default clock by ten seconds, and requires the fresh heartbeat timestamps rather than only their schema;
  - synchronous MQTT startup failure must clear exactly the observer timer before propagating, while a normal local fake-MQTT startup with Matrix disabled must keep the timer alive and emit the next fresh heartbeat; all process globals, environment, module exports, and added `SIGINT` listeners are restored without a real network call;
  - the OrbStack verifier remains exactly `0/18`; the generic five-second operation timeout is separate from a forty-second network-audit timeout, the inner actor-log poll is fifteen seconds, and stale-first evidence becomes fresh only at the real ten-second producer interval;
  - stale-only evidence remains pending until its inner deadline, invalid outbound or read failure still fails immediately, Synapse/Mosquitto config is inspected once, and the outer budget covers the final two actor-log reads plus both one-time config reads and cleanup;
  - the frozen matrix remains shared rules `0/2`, imported egress/lifecycle `0/6`, diagnostics `0/2`, direct CJS/ESM runtime `8` intended failures, and Model3200 `1` intended failure with `7` preservation passes; F-01 is `27/27`, compatibility is `74/74`, `14/14`, `10/10`, `3/3`, and `1/1`, local DE actors are `16/16`, and syntax, docs gate, and `git diff --check` PASS.
- Production GREEN remains blocked until this corrected snapshot passes another three consecutive independent reviews.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `40`
  - Decision: `Approved`
  - Notes: no findings or verification gaps on the frozen Review 38-39 correction. Consecutive Approved count became `1`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `41`
  - Decision: `Approved`
  - Notes: independently approved default MBR lifetime/error cleanup, the installed MQTT getter trap, stale-first audit, and the `5s/10s/15s/40s` timeout hierarchy. Consecutive Approved count became `2`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `42`
  - Decision: `Change Requested`
  - Notes: the real default MBR behavior still skipped Matrix, malformed network-boundary markers could be ignored beside valid heartbeat evidence, and lifecycle RED did not invoke two shutdowns concurrently. Consecutive Approved count resets to `0`.
- The Review 42 correction remains evidence-only:
  - run the real default MBR `main()` with both a local fake MQTT client and a trapped local Matrix adapter, require Matrix outbound evidence and effective homeserver arguments, then execute its owned shutdown handler and prove MQTT, Matrix, and observer cleanup exactly once;
  - reject every malformed marker-prefixed network evidence line even when valid required heartbeats are present, including malformed `outbound_attempt` records; non-marker application logs remain ignorable;
  - invoke two `shutdown()` calls concurrently before releasing any controlled tick, Matrix initialization/action, adapter close, or persistence resource, require one shared settlement, and retain exactly-once disposer plus post-shutdown quietness evidence.
- The Review 42 correction is now executable RED:
  - 0184 remains `0/4`; default `main()` now reaches trapped local MQTT and Matrix paths, records both outbound attempts, keeps the heartbeat alive, and executes its owned SIGINT cleanup before a trapped `process.exit`, with MQTT, Matrix, and observer each closed exactly once;
  - both 0184 and the OrbStack verifier now reject any malformed `DE_NETWORK_BOUNDARY` marker with `invalid_network_boundary_evidence`, even beside valid heartbeat evidence, while ordinary non-marker logs and stale well-formed evidence retain their separate ignore/filter behavior;
  - imported egress/lifecycle remains `0/6`; two shutdowns start concurrently before any controlled work is released, remain pending through every lifecycle stage, resolve to the same complete result, and still prove exactly-once resource closure plus completed-call idempotence without constraining Promise object identity;
  - pre-review removed one contradictory legacy malformed-marker assertion and one unnecessary Promise-reference requirement; all three target tests pass syntax, preserve their intended RED counts, and pass docs gate plus `git diff --check` without real network or process exit.
- Production GREEN remains blocked until this corrected snapshot passes another three consecutive independent reviews.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `43`
  - Decision: `Approved`
  - Notes: no findings on the frozen Review 42 correction. Consecutive Approved count became `1`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `44`
  - Decision: `Change Requested`
  - Notes: malformed fresh markers failed closed, but stale malformed markers were not explicit; an implementation could filter by timestamp before structural validation and silently ignore them beside valid heartbeat evidence. Consecutive Approved count resets to `0`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `45`
  - Decision: `Approved`
  - Notes: no additional findings on the same frozen snapshot; this approval cannot carry across the Review 44 correction. Consecutive Approved count for the next corrected snapshot remains `0`.
- The Review 44 correction remains evidence-only:
  - every marker-prefixed record must pass exact structural validation before freshness filtering, so stale malformed JSON/object records cannot disappear silently;
  - add both shared-parser and full deployed-audit evidence where valid fresh heartbeats coexist with a stale malformed `outbound_attempt`, and require `invalid_network_boundary_evidence` with complete timer cleanup.
- The Review 44 correction is now executable RED:
  - 0184 and the shared verifier parser both require stale malformed marker records to raise `invalid_network_boundary_evidence`, while stale well-formed records remain filterable;
  - the full acceptance-window audit combines valid fresh required heartbeats with a stale malformed `outbound_attempt` and must still reject with all timers cleared, proving structural validation precedes freshness filtering end to end;
  - both target tests preserve `0/4` and `0/18`, pass syntax, docs gate, and `git diff --check`, and two independent pre-reviews report no findings.
- Production GREEN remains blocked until this corrected snapshot passes another three consecutive independent reviews.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `46`
  - Decision: `Approved`
  - Notes: no findings or verification gaps on the complete corrected RED/preservation/runlog snapshot. Consecutive Approved count became `1`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `47`
  - Decision: `Approved`
  - Notes: no high/medium gap, contradictory contract, or false-green path found. Consecutive Approved count became `2`.
- Review Gate Record:
  - Iteration ID: `0457-feishu-message-api-v2-local-de`
  - Review Date: `2026-07-14`
  - Review Type: `AI-assisted`
  - Review Index: `48`
  - Decision: `Approved`
  - Notes: Matrix default behavior, fresh/stale malformed evidence, concurrent shutdown, and the `5s/10s/15s/40s` hierarchy were independently approved with no findings. Consecutive Approved count became `3`.
- Production GREEN is authorized for the frozen Revision 4 scope. No Feishu write, remote deployment, or cloud infrastructure mutation is authorized by this gate.

## Docs Review Checklist

- [x] `CLAUDE.md` runtime baseline reviewed/updated
- [x] `docs/architecture_mantanet_and_workers.md` reviewed
- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` updated
- [x] `docs/ssot/label_type_registry.md` reviewed and minimally corrected
- [x] `docs/ssot/tier_boundary_and_conformance_testing.md` updated
- [x] `docs/ssot/temporary_modeltable_payload_v1.md` updated
- [x] `docs/ssot/feishu_model_label_alignment_v1.md` updated
- [x] `docs/ssot/feishu_alignment_decisions_v0.md` updated after local acceptance while retaining closeout-pending state
- [x] `docs/user-guide/modeltable_user_guide.md` updated
- [ ] contract manifest/backlog/summary updated after acceptance

## Revision 4 GREEN Execution And Recovery Evidence

### Classification And Boundary

- Test classification: focused unit/contract first, then mutating local deploy + real local e2e.
- Deployment target: Docker/Kubernetes context `orbstack`, namespace `dongyu`.
- Local services under test: Synapse, Mosquitto, MBR, R1, WM1, UI Server and the imported acceptance App all ran inside the local OrbStack environment; host Node/Bash only orchestrated and observed.
- External boundary: remote Matrix/MQTT/OIDC/SSO remained forbidden during acceptance. Exact Feishu HTTPS may be read-only evidence, but no Feishu write was authorized or performed.

### GREEN Implementation Slices

- Converted the frozen Revision 4 RED contracts to GREEN for generic envelope extensions, imported host egress/lifecycle, actor attestation, remote diagnostics/network-boundary evidence, the deployed verifier, v2 actor/runtime behavior and compatibility preservation.
- Preserved Tier ownership: generic runtime owns v2 transport/materialization; R1 Model 3200 owns Feishu resource/data/UI/task behavior; R1 Model -10 owns declared endpoint dispatch; control is direct UI Server ↔ R1 over local MQTT with MBR no-echo, while management alone crosses MBR.
- Preserved F-05 and F-08 as explicit pending behavior: `ui_action_pending:refresh_data` and `task_action_pending:add_task_return`, with no state/output false success.
- Independent bounded reviews of the focused verifier/persistence fixes reached `Approved` before the live rerun. These were slice-local correction reviews, not the still-required Step 11 implementation review sequence.

### Deterministic Pre-Deploy Snapshot

- Prepared and verified snapshot:
  - `/Users/drop/dongyu/backups/0457-predeploy-20260716T002015`
- Approved restore command used after every failed live attempt:

```bash
bash scripts/ops/rollback_0457_local.sh \
  --backup /Users/drop/dongyu/backups/0457-predeploy-20260716T002015 \
  --apply --confirm ROLLBACK-0457
```

- Each rollback restored the saved data/config/image state and was followed by the previous baseline check. The ignored `deploy/env/local.env` was then reset to the approved local-only values: local Synapse, `SYNAPSE_SERVER_NAME=localhost`, `DY_AUTH=0`, fake login disabled, blank OIDC, and local Mosquitto.
- No failed deployment was counted as acceptance evidence; F-01 remained pending after every rollback.

### Failure / RED Fix / Rollback Ledger

1. Actor attestation initially rejected a valid loaded actor. Added the exact failing attestation case, fixed the false negative, rolled back the failed deploy, and reran focused checks.
2. App installation initially failed because the verifier compared semantically equal JSON objects by key order. Reproduced it, changed the assertion to order-independent deep equality, rolled back, and reran.
3. Management traffic timed out because `WorkerEngine` deleted structural split-bus pins as if they were one-shot dynamic pins. Added the regression, preserved structural pins while retaining one-shot dynamic behavior, rolled back, and reran.
4. The verifier rejected the correct logical management-bus route kind. Added route-kind evidence cases, corrected the assertion, rolled back, and reran.
5. Control responses arrived twice because MBR echoed a response already delivered directly from R1 to UI Server. Added no-echo coverage and froze the topology: control response R1 → UI Server direct; only management response crosses MBR. Rolled back the failed live state and reran.
6. Independent review found that bootstrap-only root transport labels could bypass actor attestation. Restricted the bypass to the exact Model 0 root transport-label allowlist. This review correction was made before another live deploy.
7. Synapse declared an explicit listener but remained loopback-only inside the pod. Added `bind_addresses: ["0.0.0.0"]`, preserved the failed state, rolled back, restarted Synapse and verified rollout:
   - `/Users/drop/dongyu/volume/persist/assets.failed-before-rollback-20260716T031605`
   - `/Users/drop/dongyu/volume/persist/ui-server.failed-before-rollback-20260716T031605`
8. R1 diagnostics treated raw MQTT receipt as accepted actor ingress and waited for a response that could never be valid. Restricted diagnostic inbound evidence to `ingress_pin="r1_cb_in"`, preserved the failed state and rolled back:
   - `/Users/drop/dongyu/volume/persist/assets.failed-before-rollback-20260716T032611`
   - `/Users/drop/dongyu/volume/persist/ui-server.failed-before-rollback-20260716T032611`
9. Mosquitto was made explicitly pod-reachable with `listener 1883 0.0.0.0`; verifier timeout budgets, polling and repeated-evidence diagnostics were corrected and covered before the next live run.
10. The uninstall proof expected `routed_by="pin"`, while the normal owner path correctly reported `routed_by="direct_pin"`. The core control/management/v1-negative checks had passed, but cleanup failed; added the exact assertion, preserved state and rolled back:
    - `/Users/drop/dongyu/volume/persist/assets.failed-before-rollback-20260716T035314`
    - `/Users/drop/dongyu/volume/persist/ui-server.failed-before-rollback-20260716T035314`
11. The persistence residue scanner crashed on a valid legacy database without `table_id` and falsely counted trace/pin payload references as ownership residue. Added real SQLite modern/legacy, numeric-positive, malformed and registry/mount/table-residue cases; limited residue to exact table rows, host `ws_apps_registry`, and `model.subtableconnection`; made malformed ownership state fail closed. Preserved state and rolled back:
    - `/Users/drop/dongyu/volume/persist/assets.failed-before-rollback-20260716T040511`
    - `/Users/drop/dongyu/volume/persist/ui-server.failed-before-rollback-20260716T040511`
12. The old Model 100 verifier read a cropped snapshot, waited for removed `system_ready`, submitted through legacy `/ui_event`, inspected `ui_event_*`, used count-based timeout, and produced non-unique second-only op ids. Full Revision 4 E2E passed, but Model 100 failed with null observations. The full snapshot proved Model 100 existed with `{ready:false,status:"ready",inflight:false,bg:"#FFFFFF"}`; the verifier contract, not the deployed model, was stale. Added a 9-case behavior contract and migrated the script to full snapshots, `/bus_event` + `bus_event_v2`, current `bus_event_*` mailbox, exact correlation, bounded curl, wall-clock deadlines and collision-resistant op ids. Preserved state and rolled back:
    - `/Users/drop/dongyu/volume/persist/assets.failed-before-rollback-20260716T042618`
    - `/Users/drop/dongyu/volume/persist/ui-server.failed-before-rollback-20260716T042618`

### Earlier Fresh Local Acceptance (Superseded)

- Commands:

```bash
test "$(kubectl config current-context)" = "orbstack"
bash scripts/ops/ensure_runtime_baseline.sh --force-rebuild
bash scripts/ops/check_runtime_baseline.sh
node scripts/test_e2e_0457_feishu_message_api_v2_orbstack.mjs
bash scripts/ops/verify_model100_submit_roundtrip.sh --base-url http://127.0.0.1:30900
```

- Synapse and Mosquitto were explicitly restarted after their ConfigMap changes. Loaded config was verified in the running pods:
  - Synapse port `8008`, bind `0.0.0.0`;
  - Mosquitto listener `1883 0.0.0.0`.
- `check_runtime_baseline.sh`: PASS for exact contexts, all six deployments, local service endpoints/config, auth boundary and MBR/R1/WM1 actor declarations.
- Revision 4 E2E result:
  - code: `revision4_live_verified`;
  - acceptance start: `1784148579999`;
  - installed ref: `{table_id:"app:local-dev:0457-revision-4-local-v2-acceptance:2-0-33:1",model_id:0}`;
  - control op `imported_0_1784148604022_8f0ab8fb096978`: accepted `resource.report`;
  - management op `imported_0_1784148608707_bc0a91e3330ac8`: accepted `data.save_modeltable`;
  - legacy v1 negative: published at `1784148617976`, visibly rejected with unchanged Model 3200 state/output;
  - bounded UI Server network-boundary evidence count: `19`;
  - cleanup: normal owner `direct_pin` uninstall succeeded and fixture registry/model/table/persistence residue was absent.
- Model 100 verifier: PASS on the first poll with op `verify_model100_1784148651_7289_28378`; submit returned `ok`, `consumed`, `routed_by=model0_busin`; final state was `bg=#079da6`, `status=processed`, `inflight=false`, `bus_event_error` present and null, and `bus_event_last_op_id` exactly matched the op.
- This candidate later became historical evidence: browser inspection found stale user-visible route/state text, so Step 9 was reopened and the candidate was subsequently replaced and rolled back during the corrections below.

### Browser Truth Correction And Reopened Step 9

- A real Playwright browser inspection found two product-truth defects that non-visual checks had missed:
  - the E2E color app still described control request/response as crossing MBR;
  - `MBR Ready` was bound to the removed `system_ready` label.
- Added `test_0457_model100_ui_route_truth_contract.mjs`: `0/2` RED, then `2/2` GREEN after all three shipped Model 100 UI assets were aligned to direct local MQTT, `MBR no-echo`, and `submit_inflight` projected as `提交中`.
- The fake-login-disabled browser request to `/auth/dev/fake-login/options` returned the contractually expected `404`; it was not counted as a product failure.
- An exploratory non-required historical registry test, `test_0390_focused_app_shell_settings_contract.mjs`, produced `12/15`; its three failures were stale static-registry assumptions outside Revision 4 Required Verification. It was recorded but never included in a green total.
- Intermediate regression snapshot before later timeout/deploy corrections:
  - actor/runtime plus Feishu-focused: `146/146`;
  - transport/compatibility: `186/186`;
  - Revision 4 focused and syntax: `145/145`;
  - combined snapshot: `477/477` (not the final regression result).

### Additional Failure / RED Fix / Rollback Ledger

13. The first post-UI fresh deploy passed baseline but the live E2E failed with `r1_diagnostic_timeout`. The failed state was preserved and the previous baseline restored:
    - `/Users/drop/dongyu/volume/persist/assets.failed-before-rollback-20260716T051926`
    - `/Users/drop/dongyu/volume/persist/ui-server.failed-before-rollback-20260716T051926`
14. Added exact timeout-budget RED assertions (`28/31`), then increased the evidence poll/read/operation/network budgets to `40000/7500/45000/75000ms`; the verifier contract returned to `31/31`.
15. The next fresh deploy passed the R1 diagnostic but reported `acceptance_window_log_read_timeout:deployment/mbr-worker`. The failed state was preserved and the previous baseline restored:
    - `/Users/drop/dongyu/volume/persist/assets.failed-before-rollback-20260716T053432`
    - `/Users/drop/dongyu/volume/persist/ui-server.failed-before-rollback-20260716T053432`
16. Diagnosis proved that rollback had restored old running Synapse/Mosquitto Pods: `deploy_local.sh` applied the new ConfigMaps but did not restart either deployment. Added `test_0457_local_infra_reload_contract.mjs` (`0/1` RED), then guaranteed both restarts after both applies and before any rollout status (`1/1` GREEN). A second deterministic RED reproduced the misleading deadline-tail error (`30/31`); the verifier now preserves a known missing service/config diagnosis when only a deadline-capped final read times out, while a full-budget read timeout remains a raw read failure (`31/31` GREEN).
17. The next fresh deploy restarted both services but Synapse needed more than the old blind 60-second HTTP wait. The Pod eventually returned HTTP `200`, proving delayed readiness rather than invalid config. The failed state was preserved and the previous baseline restored:
    - `/Users/drop/dongyu/volume/persist/assets.failed-before-rollback-20260716T054248`
    - `/Users/drop/dongyu/volume/persist/ui-server.failed-before-rollback-20260716T054248`
18. Added a Synapse Deployment HTTP readiness contract (RED), then configured Kubernetes to probe `/_matrix/client/versions` on port `8008`. `rollout status` now waits for the real Matrix API before user/bootstrap operations; the baseline contract returned to GREEN.

### Latest Fresh Local Acceptance

- `ensure_runtime_baseline.sh --force-rebuild`: PASS. Synapse and Mosquitto were applied, explicitly restarted, and became ready; the four app deployments were rebuilt/restarted; all six deployments were healthy with no terminating app Pods.
- `check_runtime_baseline.sh`: PASS for exact OrbStack contexts, namespace `dongyu`, local Matrix/MQTT endpoints, local auth boundary, and SSOT actor assets for MBR/R1/WM1.
- Revision 4 E2E: PASS with `revision4_live_verified`:
  - acceptance start `1784152088457`;
  - control op `imported_0_1784152111129_30be31d93a70b` accepted through the direct R1 route;
  - management op `imported_0_1784152114921_96e7c24149fb08` accepted through the management route;
  - legacy v1 negative published at `1784152125999` and was rejected without a false response;
  - UI Server boundary evidence count `19`;
  - fixture uninstall/registry/model/table/persistence cleanup PASS.
- Model 100 verifier: PASS with op `verify_model100_1784152160_12176_25716`; final state `bg=#ce57c2`, `status=processed`, `inflight=false`, null mailbox error, and exact op correlation.
- Real Playwright browser acceptance:
  - page showed direct local MQTT plus `MBR no-echo` and `提交中=false` at rest;
  - clicking `Generate Color` changed the projection to `提交中=true`, `loading`, then `false`, `processed`, with color `#18336a`;
  - visual evidence: `docs/iterations/0457-feishu-message-api-v2-local-de/assets/0457-revision4-model100-processed.png` (archived from the Playwright output after visual inspection).
- This latest successful local deployment remains active; no rollback was executed after the latest PASS.

### Final Pre-Commit Regression

- Revision 4 focused: 13 test files, `148/148` assertions PASS; Node syntax `13/13`, Bash syntax `8/8`.
- Actor/runtime plus Feishu focused: `146/146` PASS.
- Generic transport/compatibility: `186/186` PASS.
- Non-overlapping canonical total for the three prescribed slices: `480/480` PASS.
- Expanded Required Verification prefixes (0196, 0197, 0328, 0362, 0364, 0376, 0379, 0419) also passed. The SQLite persistence check was correctly executed with Bun; its initial Node invocation was an invalid runner choice and was not counted as a product failure.
- The expanded check exposed two stale historical documentation assertions and converted them to current v2 truth:
  - 0384 no longer requires nested `bundle_payload`; current docs/tests require same-array `bundle_record_id_offset` and pass `5/5`;
  - 0362 no longer requires a retired separate Model 2000 program; the current R1 Model 3000 Cell-local function contract passes `11/11`.
- Frontend production build and frontend validator suite: PASS.
- Active-doc current-vs-history guard: `5/5` PASS.
- Obsidian docs gate and `git diff --check`: PASS.
- Pre-Step-12 `test_0455_contract_surface_index.mjs` remains intentionally RED: the still-pending manifest points to removed v1/Model 0 Feishu anchors. This is the explicit Step 12 migration surface, not a pre-commit green claim; it must be updated and rerun only after the accepted implementation commit and three Step 11 approvals.

### Accepted Implementation Commit And Step 11 Review Reset

- Initial accepted implementation commit before Step 11 finding corrections: `0d0a8fc feat(runtime): hard-cut Feishu Message API to v2 [0457]`.
- The commit contained exactly 80 Revision 4 paths. Twenty-one pre-existing historical docs-cleanup paths remained unstaged; no `deploy/env/**`, `output/**`, Feishu write, Step 12 manifest/backlog/coverage change, push, PR or merge was included.
- First Step 11 review attempt:
  - deploy/rollback/E2E view: `Approved`, no findings;
  - runtime/transport view: `Change Requested` because both UI Server parsers accepted `payload_model_id=0`, duplicate arbitrary Model 0 extension keys, and non-root Model 0 envelope records;
  - SSOT/docs/compat view: `Change Requested` because `CLAUDE.md` still promoted removed `mbr_route_*`, several active guides still described control through MBR, one guide confused outer v1 packet with inner v2 records, and the Model 100 UI guard used whole-file string presence rather than node/cell binding structure.
- A finding resets the consecutive Step 11 approval count to zero. No approval from this attempt is carried into the next review sequence.

### Review Finding RED/GREEN Corrections

- UI Server parser negatives were added first. RED proved both `parsePinPayloadRecordEnvelope` and `parsePrincipalRuntimePinPayload` accepted `payload_model_id=0`; the same test also covered duplicate arbitrary Model 0 root extensions and non-root Model 0 records. Production now requires every Model 0 envelope record at `(0,0,0)`, unique by key, and requires `payload_model_id > 0`. `test_0430_feishu_operational_ssot_contract.mjs` returned to `37/37` and independent direct parser probes passed `6/6`.
- Active-doc guard expanded from five narrow checks to the highest contract, the bus-flow SSOT, all current slide-provider/developer/overview/config views, interactive/visualized views, and explicit historical classification for the old Matrix-first runbooks. RED/GREEN results:
  - active current-vs-history guard: `5/6` RED → `6/6` GREEN;
  - provider install docs: `4/5` RED → `5/5` GREEN;
  - Model 100 route/binding guard remains `2/2` GREEN but now parses JSON, resolves the exact `model100_submit_inflight` Cell, and proves a deliberately corrupted binding is detected;
  - user-visible Workspace card summary: `1/2` RED → `2/2` GREEN after replacing the stale UI/MBR/Worker control claim with UI Server/local MQTT/R1.
- `CLAUDE.md` now freezes MBR as management-only bridge and explicitly forbids restoring `mbr_route_*`; control remains direct local MQTT with MBR no-echo. Provider docs preserve outer `{version:"v1",type:"pin_payload"}` while defining inner `pin_payload.v2` records.
- The second SSOT/docs review check found two residual sentences in `runtime_semantics_modeltable_driven.md` that still described UI Server control egress and topic truth as MBR-owned. The active-doc contract reproduced the contradiction at `5/6` RED; the SSOT now freezes direct control through the UI Server MQTT adapter and management-only routing through Matrix/Synapse/MBR, and the guard returned to `6/6` GREEN. This was documentation-only after the final live acceptance, so no deployed runtime state changed.

### Corrective Deploy Failure, Rollback, And Pod-Selection Fix

- The first corrective fresh rebuild restarted Synapse/Mosquitto and the new Synapse Pod became Ready, but bootstrap cached the old rollout Pod `synapse-56b5f59d74-bskcf`. That Pod disappeared while `synapse-6c94bdf9cf-hmnp6` was Ready, so the old 60-second HTTP loop failed against a non-existent Pod.
- Failed state was preserved and the previous baseline restored:
  - `/Users/drop/dongyu/volume/persist/assets.failed-before-rollback-20260716T063252`
  - `/Users/drop/dongyu/volume/persist/ui-server.failed-before-rollback-20260716T063252`
- Added the exact RED baseline contract, then introduced `latest_running_pod`: readiness, registration, login and room creation now select the newest Running Synapse Pod by creation timestamp rather than unordered `.items[0]`. `test_0175_local_baseline_matrix_contract.mjs` returned to GREEN.

### Latest Post-Review-Correction Acceptance

- Two later fresh full rebuilds both selected the new Synapse rollout Pod and completed. The final one rebuilt the corrected user-visible asset; all six current Pods are Running/Ready with no deleting or superseded failed Pod left.
- Final baseline: PASS.
- Final Revision 4 E2E: `revision4_live_verified`, acceptance start `1784155370301`:
  - control op `imported_0_1784155393744_44fa0cfd16cde8` accepted on the direct route;
  - management op `imported_0_1784155397916_f3e4ee5875789` accepted on the MBR route;
  - legacy v1 published at `1784155407724` and was visibly rejected;
  - UI Server network-boundary evidence count `19`;
  - fixture cleanup and residue checks PASS.
- Final Model 100 verifier: PASS with op `verify_model100_1784155425_29667_18115`; final `bg=#4abffb`, `status=processed`, `inflight=false`, null mailbox error and exact correlation.
- Final browser acceptance:
  - launcher summary explicitly says UI Server/local MQTT/R1;
  - page route table says local MQTT and `MBR no-echo`;
  - click transitioned `提交中 false → true → false`, `ready → loading → processed`, final color `#c3508f`;
  - the expected fake-login-disabled `404` remains the only console error;
  - archived visual evidence at `docs/iterations/0457-feishu-message-api-v2-local-de/assets/0457-revision4-model100-processed.png` was refreshed from this final run.

### Second Step 11 Review Reset And Corrections

- The Step 11 restart against amended candidate `89027f0` did not reach consecutive approval:
  - deploy/rollback/E2E view: `Approved`, no findings;
  - runtime/transport view: `Change Requested`; both UI Server pin-payload parsers accepted missing/invalid `bus`, missing/invalid `route_kind`, a bus/route mismatch, and missing/invalid `timestamp`, so malformed Matrix return traffic could reach owner materialization;
  - SSOT/docs/compat view: `Change Requested`; the top flow in `ui_to_matrix_event_flow.md`, the minimal-provider manual response, and the Workspace Manager path still described default control through MBR, while the manual response omitted required transport metadata and the active-doc guard did not load the Workspace Manager guide.
- A finding again reset the Step 11 approval count to zero; the deploy approval is not carried forward.
- RED tests were added before production changes:
  - both UI Server parsers rejected none of the new missing/invalid bus/route/timestamp matrix, so `test_0430_feishu_operational_ssot_contract.mjs` failed as expected;
  - a valid Matrix management response materialized, but malformed transport variants also materialized, so `test_0375_unified_worker_model_topic_contract.mjs` failed at `74/75` as expected;
  - the expanded active-doc guard failed at `5/6` on the stale Chinese control flow before reaching the other new assertions.
- GREEN changes:
  - one shared UI Server transport validator now requires `bus=control|management`, `route_kind=control|management`, exact equality, and an integer `timestamp`; both parsers return the same fail-closed codes and expose the validated values;
  - the Matrix behavior guard proves a valid management response still materializes while seven malformed route/timestamp variants do not;
  - the active SSOT flow now shows UI Server MQTT adapter direct control, the provider manual response includes `bus` / `route_kind` / `timestamp`, and the Workspace Manager guide distinguishes control from management and includes the required timestamp.
- Focused GREEN after the correction:
  - parser/operational contract: all `38` cases PASS;
  - unified endpoint/Matrix behavior: `75/75` PASS;
  - active-doc guard: `6/6` PASS;
  - hard cut `27/27`, host egress `10/10`, control-first `17/17`, provider install `10/10`, local actor `17/17`, Model 3200 actor `8/8`, E2E verifier `31/31`, frontend build/test, syntax, docs gate and diff check: PASS.
- Because the parser change affects deployed UI Server behavior, prior live acceptance is not reused as the post-fix acceptance; a fresh local rebuild and complete live/browser rerun remain required before Step 11 restarts again.

### Latest Transport-Guard Fresh Local Acceptance

- A bounded independent review of the transport/parser/docs correction returned `Approved`, with no finding or verification gap.
- `ensure_runtime_baseline.sh --force-rebuild`: PASS. The new UI Server image contains the shared transport validator; Synapse `synapse-655f74d4f9-9crgl`, Mosquitto, UI Server, MBR, R1 and WM1 all reached Running/Ready with zero restart and no terminating app Pod.
- Explicit post-rebuild baseline: PASS for OrbStack context, local Synapse/Mosquitto, local auth boundary, and the MBR/R1/WM1 SSOT actor assets.
- Revision 4 E2E: `revision4_live_verified`, acceptance start `1784157560015`:
  - control op `imported_0_1784157581070_f6be919504f298` accepted on the direct local MQTT route;
  - management op `imported_0_1784157585076_2f321525b745f8` accepted through Matrix/Synapse/MBR;
  - legacy v1 negative published at `1784157594914` and was rejected without a response or Model 3200 mutation;
  - UI Server network-boundary evidence count `20`;
  - fixture uninstall and registry/model/table/persistence residue cleanup PASS.
- Model 100 verifier: PASS with op `verify_model100_1784157613_31706_21540`; final `bg=#b05251`, `status=processed`, `inflight=false`, null error and exact op correlation.
- Real Playwright browser acceptance after that verifier:
  - page showed `Model 0 mt_bus_send / pin.bus.cb.out -> local MQTT` and `response_topic -> local MQTT -> UI Server ... (MBR no-echo)`;
  - click observed `提交中 false → true → false` and `ready → loading → processed`;
  - final color `#952787`;
  - the only failed response was the expected disabled fake-login endpoint `404`;
  - archived screenshot `assets/0457-revision4-model100-processed.png` visually inspected, SHA-256 `7a578f0b56b6bd94f4e73cd347b5f6542e8b51597bc6823388f6ea0883dc0fde`.
- This latest local deployment remains active. No rollback followed the PASS.
- Final post-guard Required Verification rerun:
  - Revision 4 focused: all 13 files, canonical `149/149` assertions PASS (the compact runner reports `122` lines because the rollback file emits one aggregate line for its separately verified `28/28` cases);
  - actor/runtime plus Feishu focused: all 24 files, `146/146` PASS;
  - generic transport/compatibility: all 8 files, `188/188` PASS after adding one 0375 Matrix behavior case and one 0430 parser case;
  - non-overlapping canonical total: `483/483` PASS;
  - Node syntax for all 48 changed `.mjs` files and Bash syntax for all 6 changed `.sh` files: PASS;
  - frontend production build/test, Obsidian docs gate and `git diff --check`: PASS.

### Third Step 11 Review Reset And Corrections

- The Step 11 restart against accepted candidate `75d43f3` did not reach consecutive approval:
  - runtime/transport view: `Change Requested`; `ProgramModelEngine.handleDyBusEvent` accepted a parser-valid `control/control` packet from Matrix and materialized it through the management return path;
  - SSOT/docs/compat view: `Change Requested`; four formal v2 examples in the temporary-payload SSOT omitted `timestamp`, three user-guide examples omitted required transport metadata, and the interactive provider view still said MBR published the endpoint control topic;
  - deploy/rollback view: `Change Requested`; post-deploy `prepare_0457_local_rollback.sh --verify` compared frozen IDs with intentionally mutable active image tags and failed with `snapshot image tag mismatch: dy-ui-server:v1`.
- The finding reset the Step 11 approval count to zero. No approval from that attempt is carried into the next sequence.
- Deterministic RED evidence was added before production changes:
  - the valid Matrix `control/control` negative failed at `74/75` because the owner label was materialized;
  - the active-doc guard failed at `6/7` on the first formal v2 example missing `timestamp`;
  - real read-only snapshot verification reproduced the active-tag mismatch after deployment.
- GREEN corrections:
  - `handleDyBusEvent` now accepts only `management/management`; direct `control/control` remains owned by `handleControlBusPacket` and local MQTT;
  - all selected formal v2 examples now carry `message_role`, equal `bus` / `route_kind`, and integer `timestamp`; the interactive control path names the UI Server MQTT adapter;
  - snapshot verification continues to validate checksums and frozen metadata, requires every recorded ID in `images.json`, compares only stable `pre-0457` aliases with live Docker IDs, and verifies the three active-to-alias frozen mappings.
- Focused GREEN: unified endpoint/Matrix `75/75`, control-first `17/17`, operational parser `38/38`, active docs `7/7`, rollback `29/29`, and real snapshot `--verify` PASS.
- An independent bounded pre-deploy code review returned `Approved`, with no finding or open question.

### Management-Only Fresh Local Acceptance

- The pre-deploy rollback snapshot remained verified at `/Users/drop/dongyu/backups/0457-predeploy-20260716T002015`.
- `ensure_runtime_baseline.sh --force-rebuild`: PASS. Fresh Synapse `synapse-b59884f78-tcj8z`, Mosquitto `mosquitto-55b47c8d64-vjcvm`, UI Server `ui-server-f8c9486c-lq2jr`, MBR `mbr-worker-7b858779df-w9prs`, R1 `remote-worker-596cfbdb45-44gvc`, and WM1 `workspace-manager-79df7894c7-cwwsq` all reached Running/Ready with zero restart. One superseded Error Pod disappeared before acceptance; the explicit baseline then passed with exactly the six current Pods.
- The first two standard E2E attempts after rollout ended at `r1_diagnostic_timeout` and were not counted as acceptance. R1 logs already contained valid periodic diagnostics and the expected rejection marker; an isolated read passed, and a stage-instrumented full run passed without relaxing any timeout or assertion. Two following uninstrumented standard commands then passed consecutively.
- Latest standard Revision 4 E2E: `revision4_live_verified`, acceptance start `1784160740652`:
  - control op `imported_0_1784160758155_fd5f1c936ac9e8` accepted on direct local MQTT;
  - management op `imported_0_1784160762546_31a61ae62187f8` accepted through local Matrix/Synapse/MBR;
  - legacy v1 negative published at `1784160769760` and was rejected;
  - UI Server network-boundary evidence count `18`;
  - fixture uninstall and registry/model/table/persistence cleanup PASS.
- Model 100 verifier: PASS with op `verify_model100_1784160795_69603_22614`; final `bg=#4c069d`, `status=processed`, `inflight=false`, null error, and exact op correlation.
- Real Playwright browser acceptance:
  - the route table showed Model 0 `mt_bus_send / pin.bus.cb.out -> local MQTT`, RemoteWorker R1, response on local MQTT, and `MBR no-echo`;
  - the click snapshot captured `submit_inflight=true` and `loading`, followed by `false` and `processed`; final color `#58f37f`;
  - the only console error was the expected disabled `/auth/dev/fake-login/options` `404`;
  - the visually inspected screenshot was archived at `assets/0457-revision4-model100-processed.png`, SHA-256 `1b898add6f30725904bc75b06b9e2451f031d1ad051918684f6340d2f676a2d7`.

### Post-Correction Required Verification

- Revision 4 focused: all 13 files, canonical `151/151` assertions PASS.
- Actor/runtime plus Feishu: all 24 required files PASS; their reported case totals sum to `177/177`.
- Generic transport and bundle compatibility files all PASS, including unified endpoint/Matrix `75/75`, control-first `17/17`, provider install `5/5`, user isolation `10/10`, operational parser `38/38`, and v2 response targets `2/2`.
- Core parser/runtime checks: Cell Connect `8/8`, BUS_IN/OUT `7/7`, builtins validator PASS, and all UI AST cases PASS.
- Node syntax for all 48 changed `.mjs` files and Bash syntax for all 6 changed `.sh` files: PASS. An initial zsh array-splitting command failed before checking any file and was replaced by the successful line-by-line runners; it is not counted as a product failure.
- Frontend production build/test, Obsidian docs gate, `git diff --check`, real snapshot verification, and explicit post-deploy baseline: PASS.
- The successful local deployment remains active. No rollback, Feishu write, remote deployment, push, PR, or merge followed the PASS.

### Current Closeout Boundary

- Step 9 and the corrected Step 10 implementation/evidence slice are PASS.
- The third-review corrections are ready to be folded into the accepted implementation successor of `75d43f3`; F-01 remains `local_acceptance_passed_closeout_pending` until three new Step 11 approvals and Step 12 state/index closeout.
- Three consecutive implementation reviews, F-01/index closeout, and three consecutive final closeout reviews remain mandatory before `Completed`.

### Fourth Step 11 Review Reset And Incremental Corrections

- The Step 11 restart against accepted candidate `6c5591d` did not reach consecutive approval:
  - runtime/transport view: `Approved`, no findings;
  - SSOT/docs/compat view: `Change Requested`; the highest standard v2 payload list omitted required `bus` and `timestamp`, still described payload `route_kind` as optional, and the active MQTT response guide omitted required transport metadata in its formal JSON/JavaScript examples;
  - deploy/rollback view: `Change Requested`; snapshot verification proved only that each TSV ID appeared somewhere in frozen image metadata, so swapping the Synapse and Mosquitto TSV IDs while recomputing the checksum could still pass.
- Any finding resets the Step 11 approval count to zero. The runtime approval from this attempt is not carried into the next frozen review sequence.
- Deterministic RED/GREEN corrections:
  - the highest SSOT now requires `message_role`, `bus`, equal `route_kind`, and integer `timestamp` for every standard v2 payload; endpoint declaration defaults remain separately scoped and unchanged;
  - the active MQTT response guide now includes `bus` and `timestamp` in both formal JSON and JavaScript examples, and the active-doc guard loads and structurally checks that guide;
  - active docs and parser/operational contracts pass `8/8` and `38/38` respectively;
  - rollback verification now binds each of the five active tags to the exact expected ID in `image-ids.tsv`, `images/images.json` RepoTags, and `snapshot.json`, while still allowing intentionally mutable live active tags and preserving the three app active-to-alias plus live alias checks;
  - the rollback contract explicitly rejects swapped infrastructure TSV IDs, swapped RepoTags, and a mismatched snapshot manifest; the complete suite passes `30/30`, Bash/Node syntax and `git diff --check` pass, and the real predeploy snapshot verifies read-only.
- These corrections change only active documentation, its guard, and the rollback verifier/contract. They do not alter a runtime source, image input, Kubernetes manifest, local persisted actor asset, or browser asset. Therefore the latest successful local runtime/E2E/Model 100/browser evidence remains applicable; no rebuild or duplicate live E2E/browser run is required for this correction slice. A final read-only baseline remains required before closeout.

### Execution-Time Correction

- A process audit of this runlog counted `36` recorded `Change Requested` decisions and `10` recorded `Approved` decisions. The high-risk local-runtime work justified TDD, rollback and real browser evidence, but review findings were discovered in too many narrow rounds and repeatedly triggered whole-snapshot review resets and broad reruns.
- Remaining work uses a risk-matched matrix: freeze one candidate, run the three Step 11 review views in parallel, rerun only the surface touched by any finding, never rebuild for docs/rollback-only changes, then perform one final closeout regression and one three-view final review sequence.

### Fifth Step 11 Review Reset And Batched Corrections

- The Step 11 restart against accepted candidate `23a36d9` again reset to zero after the three views were run against the same frozen snapshot:
  - runtime/transport: `Change Requested`; the MBR runner's Matrix packet validator still accepted parser-valid `control/control` and only relied on the downstream actor to reject it after the management transport boundary;
  - SSOT/docs/compat: `Change Requested`; active docs still mixed required payload metadata, `/bus_event` current business ingress, retired `/ui_event -> Model -1`, ordinary submit, and browser ingress versus target-model management egress;
  - deploy/rollback: `Change Requested`; `rollback_0457_local.sh` did not reuse the prepare verifier's exact five-image semantic binding, and a string `RepoTags` value could satisfy the old jq `index` expression.
- All findings were corrected as one batch before another deploy or Step 11 review:
  - `validateUnifiedMatrixEventPacket` now rejects anything except `management/management` with `matrix_ingress_requires_management_route`, before the listener can write `mbr_mb_in`; valid management remains accepted. Unified endpoint/Matrix moved from `74/75` RED to `75/75` GREEN; control-first and local actor contracts remain `17/17` each.
  - Standard payload docs require explicit equal `bus` / `route_kind`; all browser `bus_event_v2` events enter Model 0 `pin.bus.cb.in`; management is selected only when target-model egress writes `bus=management` and `route_kind=management`; `pin.bus.mb.in` is management transport ingress, not a browser submit entry. The active-doc guard expanded across the highest SSOT and all affected active guides, moving through deterministic RED to `13/13` GREEN; operational parser `38/38`, docs gate and diff check pass.
  - Prepare verification now requires `RepoTags` to be `null` or a string array and only array membership can satisfy exact binding. Rollback dry-run and apply both invoke the same complete semantic verifier before any Docker load, scale or data copy. Corrupted missing metadata, string RepoTags, swapped RepoTags and wrong snapshot mappings are rejected pre-mutation in both modes. The targeted negative is `1/1` and the complete rollback suite is `32/32`.
- Independent bounded predeploy reviews of the corrected runtime/docs and rollback slices both returned `Approved`, with no High/Medium finding or verification gap.
- The frozen rollback snapshot `/Users/drop/dongyu/backups/0457-predeploy-20260716T002015` verified read-only, and the predeploy local OrbStack baseline passed.

### Targeted MBR Rebuild And Live Acceptance

- Only the affected `dy-mbr-worker:v2` image was rebuilt; UI Server, R1, WM1, Synapse and Mosquitto images and Pods were not rebuilt or restarted. The new image ID is `sha256:8df47cd5a32340d7c23827b4ebd54c0c708f86c388bb8ff1fc42de3067e67f44`, and an in-image check confirmed the new Matrix rejection reason.
- `mbr-worker-64bd8b8445-r9zzq` rolled out Running/Ready with zero restart. The first immediate baseline saw only the old MBR Pod still terminating; after that Pod deleted normally, the full baseline passed with exactly six Running/Ready Pods and no terminating app Pod.
- Standard Revision 4 E2E passed with `revision4_live_verified`, acceptance start `1784186597847`:
  - control op `imported_0_1784186614453_6f362197b6f32` accepted on direct local MQTT;
  - management op `imported_0_1784186617361_5bc43430b197a8` accepted through local Matrix/Synapse/MBR;
  - legacy v1 negative published at `1784186625345` and was rejected;
  - UI Server network-boundary evidence count `18`;
  - fixture registry/model/table/persistence cleanup PASS.
- The latest change affects only MBR Matrix ingress validation plus docs/rollback tooling. UI Server, R1, Model 100, frontend and browser assets are byte-unchanged, so the latest successful Model 100 and real-browser evidence remains applicable and was not duplicated. No rollback, Feishu write, remote deployment, push, PR or merge followed this local PASS.

### Sixth Step 11 Review Reset And Batched Corrections

- The Step 11 restart against accepted candidate `0ca8502` ran all three views against the same frozen snapshot and all three returned `Change Requested`; the approval count remains zero:
  - runtime/transport: the MBR Matrix validator accepted a missing or invalid `timestamp`, a duplicate arbitrary Model 0 root key, and Model 0 metadata outside `(0,0,0)`;
  - SSOT/docs/compat: the active UI routing architecture and two active user guides still described retired `/ui_event -> Model -1` or control-through-MBR paths, and the local baseline guide listed only five deployments;
  - deploy/rollback/E2E: rollback loaded images before quiescing workloads, frozen rollback verification still depended on mutable live pre-0457 aliases, and WM1 did not have separately scoped acceptance-window outbound evidence.
- All three finding groups were corrected in one batch before another review:
  - the MBR validator now rejects missing/invalid timestamps, duplicate Model 0 root keys, non-root Model 0 records, and any non-management Matrix ingress before writing `mbr_mb_in`; the complete unified endpoint/Matrix contract passes `75/75`;
  - active docs now consistently define browser `bus_event_v2 -> Model 0 pin.bus.cb.in`, direct control through UI Server/local MQTT/R1 with MBR no-echo, management selection only at target-model egress, and all six local deployments; the expanded active-doc guard passes `14/14`;
  - frozen rollback verification no longer depends on live aliases, while normal snapshot creation/explicit verification still checks them; rollback quiesces all six deployments before Docker load, retag or data mutation; the complete rollback suite passes `33/33`;
  - R1 and WM1 now emit network evidence under their exact `remote-worker` and `workspace-manager` scopes, and every shared-runner MQTT publish records the actual destination; the verifier rejects remote WM1 MQTT evidence.
- Syntax checks for every touched Node/Bash file, Obsidian docs gate and `git diff --check` passed. The frozen snapshot `/Users/drop/dongyu/backups/0457-predeploy-20260716T002015` passed normal read-only verification, the real rollback dry-run passed without mutation, and the explicit local baseline passed.

### Targeted Actor Rebuild, WM1 RED, And Final Live Correction

- Only affected actor images were rebuilt and deployed:
  - `dy-mbr-worker:v2` -> `sha256:f1d8bb6dff831d7a1e7bef9a94a57b4ba59013e67beac9b63dbf05ac51220856`;
  - shared R1/WM1 `dy-remote-worker:v3` -> `sha256:f1670da7332814f977d4793b0ba28ca37d44d5716ae1a1dabe7cb98293f2c559`.
- Only `deployment/mbr-worker`, `deployment/remote-worker`, and `deployment/workspace-manager` were restarted. Current Pods `mbr-worker-5bb99cb66-v6tf7`, `remote-worker-7467fdc7bb-mtcrh`, and `workspace-manager-7db9d97df8-pk7bj` reached Running/Ready with zero restart; their image IDs matched the rebuilt images. Synapse, Mosquitto and UI Server remained unchanged. The complete six-deployment baseline passed.
- The first real E2E after that rollout failed closed with `missing_fresh_network_boundary_evidence:workspace-manager:outbound_attempt`. WM1 had a fresh effective-config heartbeat but no business outbound inside the acceptance window; startup evidence was correctly not reused.
- A deterministic contract for a real WM1 network-audit roundtrip was added first and failed `0/1` because the builder did not exist. The implementation now publishes an exact outer `{version:"v1",type:"pin_payload"}` carrying strict inner `pin_payload.v2` records to `UIPUT/ws/dam/pic/de/WM1/4000/refresh`, with a distinct E2E response topic, only on the default real network-audit path and after the legacy silence window. It does not synthesize evidence or weaken the required evidence set.
- The targeted contract returned to `1/1`; the complete E2E verifier passes `32/32`. WM1 logs then proved the real path in one acceptance window: `control_ingress` -> Model 4000 `model_dispatch` -> `workspace-manager` local MQTT `outbound_attempt` -> `control_response` on `wm_audit_result`.
- Standard Revision 4 E2E passed with `revision4_live_verified`, acceptance start `1784189022884`:
  - control op `imported_0_1784189037309_a187c2d0ef82f` accepted on direct local MQTT;
  - management op `imported_0_1784189046361_c8946a2a0c0ae` accepted through local Matrix/Synapse/MBR;
  - legacy v1 negative published at `1784189059042` and was rejected without a false response;
  - WM1 actual outbound attempt at `1784189070154` targeted only `mosquitto.dongyu.svc.cluster.local:1883`;
  - UI Server network-boundary evidence count `22`;
  - fixture registry/model/table/persistence cleanup PASS.
- Model 100 real submit roundtrip passed with op `verify_model100_1784189112_14030_9506`; final state was `status=processed`, `inflight=false`, null mailbox error, and exact op correlation.
- A bounded independent review then returned `Change Requested` on one Medium false-positive risk: the first WM1 correction required a generic fresh `workspace-manager:outbound_attempt` but did not uniquely bind that attempt to this Model 4000 probe. Another concurrent WM1 publish could therefore have satisfied the audit even if the expected response path were broken. The Step 11 approval count remains zero.
- A second deterministic RED required a marker-qualified unique response topic plus an observed and validated WM1 response; it failed because the response evaluator/roundtrip did not exist. The corrected helper now:
  - subscribes to `UIPUT/ws/dam/pic/de/E2E/1/wm_audit_result_<marker>` before publishing;
  - waits for that exact topic after the legacy response-silence window;
  - requires an exact outer v1 transport wrapper and strict inner `pin_payload.v2` response from `WM1/host/4000/refresh`, addressed to the marker-qualified E2E reply pin, with fresh integer timestamp and `workspace_manager_status=ready`;
  - disposes its dedicated response/error listeners before the general network-boundary audit.
- The targeted correlated-roundtrip test returned to `1/1`; wrong topic, stale timestamp, wrong origin and duplicate Model 0 root records all fail closed. The complete E2E verifier remains `32/32` and syntax/diff checks pass.
- A second standard live E2E, now gated by the uniquely correlated WM1 response, passed with `revision4_live_verified`, acceptance start `1784189460940`:
  - control op `imported_0_1784189477508_6100a5c65c64c` accepted on direct local MQTT;
  - management op `imported_0_1784189480444_f2747990a7ae08` accepted through local Matrix/Synapse/MBR;
  - legacy v1 negative published at `1784189489047` and was rejected without a false legacy response;
  - the marker-qualified WM1 response passed exact transport, origin, target, freshness and business-payload validation before the network audit;
  - UI Server network-boundary evidence count `18` and all fixture residue checks PASS.
- This second correction changes only the acceptance verifier and its tests; deployed actor/UI images are unchanged, so no image rebuild or duplicate Model 100/browser run is required.
- A second bounded review found one further Medium failure-path issue: an MQTT error during the subscribe/publish await could reject the response promise before its later await attached a handler. The deterministic test reproduced both the unhandled rejection and `PromiseRejectionHandledWarning`. The response promise is now marked handled immediately while the original promise is still awaited, preserving the exact MQTT error for the caller. Subscribe- and publish-window tests prove the original error, zero unhandled rejections, and complete listener cleanup; targeted `1/1` and full verifier `32/32` pass.
- The same independent reviewer then returned `Approved`, with no finding, open question or verification gap. This bounded approval validates the incremental WM1 correlation/failure-path slice; it does not count as one of the three required whole-candidate Step 11 approvals.
- A restricted-sandbox attempt could not access OrbStack's local Kubernetes port and stopped before product execution; the approved local-host run immediately passed the same baseline. This infrastructure access denial is not counted as a product failure.
- No rollback, Feishu write, remote deployment, push, PR or merge followed the PASS. The corrected implementation and evidence are ready to be folded into the accepted candidate before the next three-view Step 11 restart.

### Seventh Step 11 Review Reset, Async Publish Acknowledgement, And Local Reverification

- The three-view review of accepted candidate `938b56d` did not reach a consecutive approval: deploy/E2E was `Approved`, while runtime and docs returned `Change Requested`. Per Step 11, the approval count reset to `0`; the isolated deploy approval is not carried forward.
- Runtime review found that MQTT publish was treated as successful when the client merely returned, before its callback confirmed delivery. This could emit false success evidence, remove a dynamic output, and lose the packet after a callback failure.
- Deterministic RED/GREEN corrected the real transport boundary:
  - `publishMqttWithAck` serializes once and settles only from the MQTT callback, preserving callback, synchronous and serialization failures;
  - runtime direct bus output records a ModelTable-visible `split_bus_mqtt_publish_failed` without an unhandled rejection;
  - `WorkerEngineV0` keeps callback-backed output pending, acknowledges only after success, and retains/retries the exact output after failure;
  - MBR and R1/WM1 pin-flow success evidence now occurs only after the acknowledged publish succeeds.
- Focused/full runtime verification passed: unified worker/topic `77/77`, control-first `17/17`, envelope extension `2/2`, imported-host egress `10/10`, remote diagnostic `3/3`, E2E verifier contract `32/32`, positive-flow evidence `6/6`, and observability contract `4/4`. An independent runtime review returned `Approved` with no finding.
- The observability contract initially failed `2/4` after production moved MBR to the shared acknowledgement helper. Its first correction still accepted four invalid mutations: an R1 wrapper not assigned to `rt.mqttClient.publish`, an R1 wrapper dropping the returned acknowledgement, an MBR publisher not passed to `WorkerEngineV0`, and an MBR publisher dropping the `recordControlForward` return. Those mutations produced a deliberate `2/4` RED; the strengthened executable-path checks reject all four and the complete suite is `4/4` GREEN. A separate reviewer then returned `Approved`, confirming that production sources rather than only the positive fixture satisfy the executable-path checks.
- Docs review found three remaining current-surface defects: imported-app ingress wording was ambiguous, two active Matrix/local-address guides still pointed local tests at the remote homeserver, and the Ops PASS criteria listed five rather than six deployments. The first discovery guard also scanned iteration history and selected claims by their own old wording.
- Current docs now state that every browser `bus_event_v2` enters Model 0 `pin.bus.cb.in`; `pin.bus.mb.in` is only management transport ingress after target-model egress via local Matrix/Synapse/MBR. Local Matrix is the OrbStack Synapse service with server name `localhost`; the remote-only Matrix flow is explicitly excluded from local acceptance; the Ops baseline lists all six deployments. The revised guard excludes history/evidence directories and positively requires the three canonical current surfaces. Its deliberate RED was `14/15`, then the complete active-doc suite returned `15/15`; an independent docs review returned `Approved`.
- Only affected actor images were rebuilt:
  - `dy-mbr-worker:v2` -> `sha256:5d4f7480f62d24292f1e1143de5e713386c6e95c095f360ea038bd7db1a98bb0`;
  - shared `dy-remote-worker:v3` for R1/WM1 -> `sha256:05a34f07f38bd8e0f71852cb158190eb82961648ecff55addbea4975421bc7b9`.
- Only `mbr-worker`, `remote-worker`, and `workspace-manager` restarted. New Pods `mbr-worker-67dfcdfcc4-pw9pn`, `remote-worker-7d4c7bdb78-bxtgv`, and `workspace-manager-5dfbfd8bbb-7kkk5` are Running/Ready with zero restart and exact rebuilt image IDs. The first baseline observed only the three superseded Pods still terminating; after their normal deletion, all six local deployments and actor/config checks passed.
- Standard live Revision 4 E2E passed with `revision4_live_verified`, acceptance start `1784191345403`:
  - control op `imported_0_1784191355736_e12c74159fa5d` passed over local MQTT;
  - management op `imported_0_1784191365727_614102431f53e` passed through local Matrix/Synapse/MBR;
  - legacy v1 was published at `1784191376289` and rejected without a false response;
  - the marker-qualified WM1 response and local network audit passed;
  - UI Server evidence count was `18`, and fixture uninstall/persistence cleanup passed.
- Model 100 real submit roundtrip passed with op `verify_model100_1784191409_12123_6916`; final state was `status=processed`, `inflight=false`, null mailbox error, and exact op correlation.
- The documented local Matrix command also executed against OrbStack Synapse: `@drop:localhost` sent a fresh event and `@mbr:localhost` received the same body; result `PASS`. Post-E2E MBR/R1/WM1 logs contained no unhandled rejection, MQTT publish error, fatal or uncaught exception; R1 retained only the expected legacy-v1 rejection diagnostic.
- Frontend/UI assets are unchanged, so no duplicate browser run was required. The work made no Feishu write, remote deployment, rollback, push, PR or merge. The corrected slice must still be folded into a new frozen candidate before the required three whole-candidate Step 11 reviews restart.

### Eighth Step 11 Review Reset And Exact Runtime Runbook Correction

- The three whole-candidate reviews of `bc4557e..5b7a003` returned runtime `Approved`, deploy/E2E `Approved`, and docs `Change Requested`. The finding resets the consecutive Step 11 approval count to `0`; neither approval is carried into the next sequence.
- The docs review found that active `docs/deployment/runtime_baseline_default.md` still described `orbstack` as optional, allowed context override, and listed only five deployments without `workspace-manager`. The recursive active-doc guard discovered this runbook but did not positively validate its baseline claims.
- The guard was strengthened first and produced the expected `14/15` RED. The runbook now requires exact Docker and Kubernetes contexts `orbstack`, namespace `dongyu`, and all six deployments: Mosquitto, Synapse, R1, WM1, MBR, and UI Server. The guard positively requires the runbook, both exact contexts, namespace, and every deployment; wrong/missing namespace mutations must fail.
- The complete active-doc suite returned to `15/15`; Node syntax, Obsidian docs gate and `git diff --check` pass. A separate bounded review returned `Approved` with no remaining finding or verification gap.
- This correction changes only one active runbook and its guard. Runtime, images, Pods, local services and live acceptance inputs are unchanged, so no duplicate rebuild, E2E, Model 100 or browser run is required. No Feishu write, remote deployment, rollback, push, PR or merge occurred.

### Ninth Step 11 Review Reset And Executable Baseline Correction

- The three whole-candidate reviews of `bc4557e..23c4acc` returned runtime `Approved`, docs `Change Requested`, and deploy/E2E `Change Requested`. Either finding resets the consecutive Step 11 approval count to `0`; the runtime approval is not carried into the next sequence.
- The docs review proved that the active-doc guard could still false-green if exact Docker/Kubernetes/fail-closed language became optional or if any of the six deployment lines disappeared. The deploy review found two executable gaps: the runbook used non-forced ensure after code changes, which could retain stale running images, and the checker accepted `readyReplicas=1` without requiring `spec.replicas=1` or the exact UI NodePort.
- The behavior-level baseline test first produced the expected two-case RED: a deployment with `spec.replicas=2` and `readyReplicas=1` passed, and wrong/missing `ui-server-nodeport` values passed. The corrected checker now requires exact desired and ready replica counts for all six deployments and exact `NodePort` mapping `9000:9000 -> 30900`.
- The runbook now requires `ensure_runtime_baseline.sh --force-rebuild` followed by the read-only checker for first deployment or any code, image, manifest, or actor-asset change. Standalone image builds and non-forced checks are explicitly not deployment evidence.
- The active-doc guard now mutation-tests wrong/missing contexts, optional context wording, missing fail-closed, wrong/missing namespace, missing force-rebuild, wrong UI NodePort, and both removal and replica drift for each of the six deployments. Its first edited form had an invalid JavaScript backtick escape and was rejected by `node --check`; after correction, syntax and the complete suite pass `15/15`.
- Focused GREEN: local baseline contract PASS, active-doc contract `15/15`, Bash/Node syntax PASS, Obsidian docs gate PASS, and `git diff --check` PASS. The corrected read-only checker then passed against the real OrbStack cluster: exact contexts, all six deployments at `replicas=1` and `readyReplicas=1`, exact UI NodePort `30900`, local Matrix/MQTT/auth, and MBR/R1/WM1 actor declarations.
- Three bounded correction reviews then returned docs `Approved` and two `Change Requested` findings before freeze: numeric prefix matches could false-green `NodePort 309000` or `replicas=10`; one all-deployments mutation did not prove each deployment was checked; and the UI NodePort check did not yet require TCP or `selector.app=ui-server`.
- New negatives produced deterministic RED for wrong protocol and the NodePort numeric-prefix mutation. The final behavior fixture independently injects `replicas=2` into each of the six named deployments and rejects wrong/missing service type, nodePort, TCP protocol, and selector. The active-doc mutations also reject `309000` and `replicas=10` via explicit numeric boundaries. Both focused suites returned GREEN, and the real OrbStack checker passed again with exact UI selector, TCP NodePort `30900`, all six replica contracts, local transports/auth, and all three actor declarations.
- This correction changes only the baseline checker, its behavior test, the current runbook, and its active-doc guard. It does not change an image input, Kubernetes manifest, deployed Pod, transport implementation, or browser asset, so no rebuild or duplicate E2E/Model 100/browser run is required. No Feishu write, remote deployment, rollback, push, PR or merge occurred.

### Accepted Step 11 Candidate And Step 12 F-01 Contract Closeout

- The corrected implementation was frozen as candidate `3b2a902` over `bc4557e`. All three fresh whole-candidate Step 11 reviews targeted that exact SHA and returned `Approved` with no finding, open question or verification gap:
  - runtime/transport: representative verification `188/188` and current live evidence applicable;
  - SSOT/docs/compat: current/history, formal examples, local infrastructure and decision boundaries approved;
  - deploy/rollback/E2E: rollback `33/33`, E2E verifier `32/32`, real six-deployment OrbStack baseline, frozen snapshot verification, rollback dry-run, correlated WM1 marker evidence and cleanup residue all approved.
- Step 12 began from a real RED: `test_0455_contract_surface_index.mjs` reported seven stale anchors across input version, response outbox, Model 3200 handlers and route metadata. The test expectation was changed first to require F-01 completion and exact Revision 4 routing; the old manifest remained RED.
- F-01 is now closed in the repository decision surfaces:
  - `feishu_contract_backlog.md` moves F-01 from follow-up pending to `completed`;
  - `feishu_alignment_decisions_v0.md` records `aligned/completed` and preserves the explicit no-Feishu-write boundary;
  - `contract_surface_manifest.json` removes F-01 from open findings and routes current input, response, handlers and explicit-routing contracts to R1 Model 3200, current CJS/ESM runtime, Revision 4 tests and E2E evidence;
  - the generated coverage summary reports input version `aligned` with no open finding.
- F-04 remains source-correction pending with no alias and no Feishu write. F-05 and F-08 remain implementation pending with exact Model 3200 fail-closed codes; F-06 and F-07 remain `requires_user_confirmation`. The backlog's stale pre-0457 F-05/F-08 executable-state wording was corrected without changing those decision classes.
- `build_contract_index.mjs` regenerated the coverage/index successfully for all `10` cards, and the complete 0455 contract-index test returned PASS. No runtime, actor patch, image, manifest, Pod, browser asset or Feishu document changed during Step 12.
- All `12` unique verification files declared by the four updated contract cards then executed successfully; their latest reported case totals sum to `159/159`. This includes legacy-v1 removal, Model 3200 schema/handlers, response publication/materialization, Revision 4 E2E verifier, and the unchanged F-05/F-08 fail-closed boundaries.
- The first three-view Step 12 review returned docs `Approved`, evidence `Approved`, and implementation routing `Change Requested`; the two approvals are not carried forward. The finding was that the F-06 route-autofill card still anchored an unrelated legacy-v1 rejection and did not prove that current v2 endpoint/origin/reply metadata cannot be omitted and synthesized.
- The 0455 test expectation was changed first and produced the intended RED against the old route-card anchor. A new cross-CJS/ESM contract then removes each of the `12` required `endpoint_*`, `origin_*`, and `reply_target_*` fields independently, requires exact fail-closed codes, proves validation does not mutate or auto-fill the record array, and proves rejected Model 0 BUS_IN is not stored. The route card now anchors that explicit no-autofill test plus the Model 3200 exact-envelope test. Focused GREEN: 0442 `7/7`, Model 3200 `8/8`, 10-card index generation PASS, and 0455 contract index PASS.
- The next Step 12 review attempt returned implementation routing `Approved` and docs `Change Requested`; the outstanding evidence view was stopped because the finding already reset the sequence. The active-doc guard still required F-01 `local_acceptance_passed_closeout_pending`, so the current/history suite produced a real `14/15` RED against the new `aligned/completed` decision surface.
- The stale guard and its test name now require F-01 closed while continuing to require F-05/F-08 pending codes and the separate Feishu-write authorization boundary. The complete active-doc suite returned to `15/15`; the isolated implementation approval is not carried forward.
- The following Step 12 review attempt returned docs `Approved` and implementation routing `Change Requested`; the evidence view was stopped after the reset. The new F-01 assertion still searched the whole file, so the prose above the table could satisfy it even if the formal F-01 row was deleted or reverted.
- The decision guard now scopes itself to the formal 0456 decision section, requires exactly one F-01/F-05/F-08 table row, and validates each row's exact state. Built-in mutations delete the F-01 row and revert only that row to `local_acceptance_passed_closeout_pending`; both must fail even while the surrounding prose still says completed. The canonical active-doc suite remains `15/15` GREEN, while the earlier docs approval is not carried forward.
- The next fresh three-view Step 12 review targeted this exact eight-file candidate. SSOT/docs, contract evidence, and runtime-routing views all returned `Approved` with no finding, open question, or verification gap. The reviewers independently confirmed the four-card `159/159` set, active-doc `15/15`, 0455 index, generated coverage, docs gate, syntax, and `git diff --check`. These approvals authorize freezing the F-01/index slice; they do not replace the required post-commit whole-candidate final closeout reviews.
- Post-approval freeze gates were rerun after recording the decision: all 12 unique four-card test files passed `159/159`; active-doc passed `15/15`; 0455 index, 10-card generation, three changed-test syntax checks, Obsidian docs gate, and `git diff --check` all passed. The slice still contains only the eight declared Step 12 paths and is ready for its separate commit.
