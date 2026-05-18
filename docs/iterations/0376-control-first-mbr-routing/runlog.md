---
title: "0376 - Control First MBR Routing Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0376-control-first-mbr-routing
id: 0376-control-first-mbr-routing
phase: completed
---

# Iteration 0376-control-first-mbr-routing Runlog

## Environment

- Date: 2026-05-18
- Branch: `dropx/dev_0376-control-first-mbr-routing`
- Runtime: local development workspace; deployment verification pending

## Execution Records

### Intake and Review Gate

- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0376-control-first-mbr-routing --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output: wrote `plan.md`, `resolution.md`, `runlog.md`
- Result: PASS

Review Gate Record
- Iteration ID: 0376-control-first-mbr-routing
- Review Date: 2026-05-18
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: User approved the control-bus-first MBR contract; implementation may proceed after plan/resolution are written.

Review Gate Record
- Iteration ID: 0376-control-first-mbr-routing
- Review Date: 2026-05-18
- Review Type: AI-assisted / sub-agent
- Review Index: 2
- Decision: Change Requested
- Notes: Planning review required exact `topic` / `route_kind` schema, no endpoint fallback wording, explicit control-bus ingress verification, and corrected optional `route_kind` semantics.

Review Gate Record
- Iteration ID: 0376-control-first-mbr-routing
- Review Date: 2026-05-18
- Review Type: AI-assisted / sub-agent
- Review Index: 3
- Decision: Approved
- Notes: Re-review approved the clarified planning contract with no open findings.

### Step 1 — Contract and Iteration Gate

- Command: `rg -n "0376-control-first-mbr-routing" docs/ITERATIONS.md docs/iterations/0376-control-first-mbr-routing/{plan.md,resolution.md}`
- Key output: iteration registered, plan/resolution present, Phase gate approved by user.
- Result: PASS
- Commit:

### Step 2 — Failing Contract Tests

- Command: `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
- Key output: first RED run produced 0 passed, 4 failed. Sub-agent review requested stronger fail-closed/ingress/unsafe-topic/behavioral install coverage. Updated RED run produced 0 passed, 6 failed, covering endpoint fallback, unsafe topic, missing MBR `pin.bus.cb.in`, missing `mbr_cb_dispatch`, and real installer defaulting to management bus.
- Result: PASS (expected RED)
- Commit:

### Step 3/4 — Runtime, UI Server Host Egress, MBR Refill

- Command: `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
- Key output: 5 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0364_slide_import_bus_binding_contract.mjs`
- Key output: 3 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
- Key output: 10 passed, 0 failed
- Result: PASS
- Commit:

Sub-agent Review Record
- Iteration ID: 0376-control-first-mbr-routing
- Review Date: 2026-05-18
- Review Type: AI-assisted / sub-agent
- Review Index: 4
- Decision: Change Requested
- Notes: Review found unsafe `remote_bus_endpoint_v1.to.worker_id` could generate an empty route topic, SSOT/user-guide still described endpoint-derived routing and default management-bus slide app egress, and legacy `ui_event` ingress still wrote `pin.bus.mb.in`.

Fix Record
- Updated `server.mjs` to validate remote worker id before topic generation and default Model 0 bus ingress to `pin.bus.cb.in`.
- Updated `runtime.mjs` so `mt_bus_send` default bus is `pin.bus.cb.out` unless explicit `bus=management` is present.
- Refilled MBR model so control-bus dispatch and MQTT return handling route by payload `topic`; default `route_kind` stays control, explicit management writes `pin.bus.mb.out`.
- Refilled remote-worker provider functions to reject missing/invalid `topic` and preserve `topic` / `route_kind` in responses.
- Updated SSOT and slide-app user-guide/interactive docs to remove old default `pin.bus.mb.*` / Matrix-first wording.

Verification Record
- Command: `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
- Key output: 5 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0364_slide_import_bus_binding_contract.mjs`
- Key output: 3 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
- Key output: 10 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 32 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed
- Result: PASS

Sub-agent Review Record
- Iteration ID: 0376-control-first-mbr-routing
- Review Date: 2026-05-18
- Review Type: AI-assisted / sub-agent
- Review Index: 5
- Decision: Change Requested
- Notes: Review found `scripts/worker_engine_v0.mjs` still accepted unsafe payload topics, `runtime.mjs` only trimmed payload topic instead of validating exact shape, MBR management/control bridge paths still had old parse branches without topic / route_kind validation, `modeltable_user_guide.md` still contained old default-management wording, and `validate_mbr_patch_v0.mjs` still tested endpoint-derived behavior.

Fix Record
- Tightened topic validation in WorkerEngine and runtime to require exact `UIPUT/<ws>/<dam>/<pic>/<de>/<sw>/<worker>/<model>/<pin>` payload topic shape.
- Updated runtime `bus_send.v1` parsing so missing or invalid `topic` fails closed, and optional `route_kind` defaults to control while invalid values are rejected.
- Refilled MBR parse / dispatch branches so both control and management ingress validate `topic` / `route_kind` consistently and route only by payload `topic`.
- Updated remote-worker provider patches to validate the same topic / route_kind contract and preserve those labels in response payloads.
- Updated `modeltable_user_guide.md`, slide-app docs, visualized HTML, and contract tests to the 0376 control-bus-first wording.
- Updated `validate_mbr_patch_v0.mjs` so validation proves payload-topic routing instead of endpoint-derived routing.

Verification Record
- Command: `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
- Key output: 5 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0364_slide_import_bus_binding_contract.mjs`
- Key output: 3 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
- Key output: 10 passed, 0 failed
- Result: PASS
- Command: `node scripts/validate_mbr_patch_v0.mjs`
- Key output: TOTAL: 93 PASS: 93 FAIL: 0
- Result: PASS
- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 32 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0337_slide_flow_docs_contract.mjs && node scripts/tests/test_0350_slide_app_runtime_user_guide_contract.mjs && node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`
- Key output: all three contract suites passed; minimal submit Matrix E2E contract reported 5 passed, 0 failed
- Result: PASS
- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output: build completed; chunk-size warning only
- Result: PASS
- Command: `rg -n '默认属于管理总线|pin\.bus\.mb\.out -> Matrix|Matrix -> MBR|UI/管理类消息使用|从 endpoint metadata|endpoint metadata records 决定|MBR / MQTT adapter 只能从 endpoint|正式业务入口仍通过|pin\.bus\.mb\.in -> pin route|Matrix-first|UI → Matrix → MQTT|topic is derived|derived only from endpoint|默认使用 "management"|current path.*pin\.bus\.mb\.in|当前路径走 `pin\.bus\.mb\.out`|Model 0 pin\.bus\.mb\.in -> pin route|Model 0 pin\.bus\.mb\.out -> Matrix|Local UI -> Matrix -> MBR' docs/ssot docs/user-guide scripts packages deploy`
- Key output: only allowed explicit-management wording and negative "do not derive from endpoint" constraints remained
- Result: PASS

Fix Record
- Addressed Review Index 5 findings: MBR `safeTopic` now rejects topic model segment `0` and leading-zero model ids, matching WorkerEngine/runtime canonical positive integer topic validation.
- Updated remote-worker provider patches and minimal-submit provider guide to the same canonical topic validation.
- Updated `modeltable_user_guide.md` so MBR routing is described as payload `topic` only; `endpoint_*` is documented as remote-worker internal dispatch metadata only.
- Added the required `topic` and `route_kind` records to the user-guide response example.
- Added focused tests for non-canonical topic rejection in `test_0376_control_first_mbr_routing_contract.mjs` and `validate_mbr_patch_v0.mjs`.

Verification Record
- Command: `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
- Key output: 6 passed, 0 failed
- Result: PASS
- Command: `node scripts/validate_mbr_patch_v0.mjs`
- Key output: TOTAL: 102 PASS: 102 FAIL: 0
- Result: PASS
- Command: `node -e "const fs=require('fs'); for (const f of ['deploy/sys-v1ns/mbr/patches/mbr_role_v0.json','deploy/sys-v1ns/remote-worker/patches/10_model100.json','deploy/sys-v1ns/remote-worker/patches/11_model1010.json','deploy/sys-v1ns/remote-worker/patches/12_model1019.json','deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json']) { JSON.parse(fs.readFileSync(f,'utf8')); console.log('PASS '+f); }"`
- Key output: all patched JSON files parsed
- Result: PASS
- Command: `node scripts/tests/test_0364_slide_import_bus_binding_contract.mjs && node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
- Key output: 3 passed / 10 passed
- Result: PASS
- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs && node scripts/tests/test_0322_imported_host_egress_server_flow.mjs && node scripts/tests/test_0326_imported_host_egress_bridge.mjs && node scripts/tests/test_bus_in_out.mjs`
- Key output: 32 passed / 1 passed / 1 passed / 7 passed
- Result: PASS
- Command: `node scripts/tests/test_0337_slide_flow_docs_contract.mjs && node scripts/tests/test_0350_slide_app_runtime_user_guide_contract.mjs && node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`
- Key output: all three contract suites passed; minimal submit Matrix E2E contract reported 5 passed, 0 failed
- Result: PASS
- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output: build completed; chunk-size warning only
- Result: PASS

Sub-agent Review Record
- Iteration ID: 0376-control-first-mbr-routing
- Review Date: 2026-05-18
- Review Type: AI-assisted / sub-agent
- Review Index: 6
- Decision: Change Requested
- Notes: Re-review found a remaining `modeltable_user_guide.md` 6.1 sentence that described endpoint metadata as MBR route selector, remote-worker topic validation still lacked exact trim / safeSegment parity with runtime and MBR, and validation did not cover `mbr_mqtt_to_mgmt` leading-zero topic rejection.

Fix Record
- Updated `modeltable_user_guide.md` 6.1 so MBR topic selection is explicitly payload `topic` only; `endpoint_*` is remote-worker internal dispatch metadata only.
- Updated remote-worker provider patches and minimal-submit provider guide so `validRouteTopic` requires `value.trim() === value`, exact 9 segments, every segment through `safeSegment`, and canonical positive model id.
- Extended `validate_mbr_patch_v0.mjs` to cover `mbr_mqtt_to_mgmt` leading-zero topic rejection.
- Extended `test_0362_mbr_remote_worker_route_contract.mjs` to guard the canonical remote-worker topic validation source contract.
- Extended `test_0376_control_first_mbr_routing_contract.mjs` to reject the remaining endpoint-metadata route wording in the user guide.

Verification Record
- Command: `node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
- Key output: 10 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
- Key output: 6 passed, 0 failed
- Result: PASS
- Command: `node scripts/validate_mbr_patch_v0.mjs`
- Key output: TOTAL: 105 PASS: 105 FAIL: 0
- Result: PASS
- Command: `rg -n 'endpoint metadata 决定目标|records 发布到 remote-worker 的控制总线 topic|endpoint_\*.*决定目标' docs/user-guide/modeltable_user_guide.md`
- Key output: no matches
- Result: PASS
- Command: `rg -n 'parts\.every\(\(part\) => part\.length > 0\)|/\^\\d\+\$/' deploy/sys-v1ns/remote-worker/patches docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`
- Key output: no matches
- Result: PASS
- Command: `rg -n 'value\.trim\(\) === value.*safeSegment\(part\).*\[1-9\]\[0-9\]' deploy/sys-v1ns/remote-worker/patches docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`
- Key output: canonical validation found in remote-worker patches and provider guide
- Result: PASS

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` reviewed
- [x] `docs/ssot/ui_to_matrix_event_flow.md` reviewed
- [x] `docs/ssot/ui_model_pin_routing_architecture.md` reviewed
- [x] `docs/ssot/label_type_registry.md` reviewed
- [x] `docs/user-guide/slide-app-runtime/*.md` and related interactive HTML reviewed

## 2026-05-18 13:20 CST - Local Deployment And Browser Verification Follow-Up

Fix Record
- Added a UI Server control-bus return subscriber so MQTT/control-bus `response` packets can materialize into the local `reply_target` UI model without going through Matrix.
- Kept the return path strict: the MQTT topic must equal the payload `topic`, `route_kind` must be explicitly `control`, duplicate `topic` / `route_kind` records are rejected, and `request` echoes do not materialize.
- Updated local/cloud deployment bootstrap so `ui-server-secret.MODELTABLE_PATCH_JSON` writes `local_ip` / `local_port` for the UI Server, allowing it to subscribe to `UIPUT/ws/dam/pic/de/sw/+/+/+`.
- Added focused 0376 tests for the UI Server control-bus return path and for the deployment bootstrap MQTT labels.

Sub-agent Review Record
- Iteration ID: 0376-control-first-mbr-routing
- Review Date: 2026-05-18
- Review Type: AI-assisted / sub-agent
- Review Index: 7
- Decision: Change Requested
- Notes: Review found that UI Server initially defaulted missing `route_kind` to `control`, did not reject duplicate `topic` / `route_kind` records, and lacked negative tests for strict return handling.

Fix Record
- Removed the missing-`route_kind` fallback in the UI Server control-bus return handler.
- Added `topic` and `route_kind` to the pin-payload duplicate metadata check.
- Added negative tests for missing `route_kind`, duplicate `topic`, duplicate `route_kind`, and request echo packets.

Sub-agent Review Record
- Iteration ID: 0376-control-first-mbr-routing
- Review Date: 2026-05-18
- Review Type: AI-assisted / sub-agent
- Review Index: 8
- Decision: Approved
- Notes: Re-review confirmed the UI Server return path rejects missing `route_kind`, duplicate route records, and request echoes; payload `topic` remains the route truth and no compatibility path was found.

Verification Record
- Command: `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
- Key output: 9 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`
- Key output: 5 passed, 0 failed
- Result: PASS
- Command: `node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
- Key output: 10 passed, 0 failed
- Result: PASS
- Command: `node scripts/validate_mbr_patch_v0.mjs`
- Key output: TOTAL: 105 PASS: 105 FAIL: 0
- Result: PASS
- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output: build completed; chunk-size warning only
- Result: PASS
- Command: `docker build -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`
- Key output: image `dy-ui-server:v1` rebuilt successfully
- Result: PASS
- Command: `SKIP_IMAGE_BUILD=1 bash scripts/ops/deploy_local.sh`
- Key output: ui-server, mbr-worker, remote-worker, ui-side-worker all rolled out; UI Server `http://localhost:30900`
- Result: PASS
- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: baseline ready; all deployments ready; `ui-server-secret` and `mbr-worker-secret` ready
- Result: PASS
- Command: `POST /api/runtime/mode {"mode":"running"} + kubectl logs -n dongyu deploy/ui-server`
- Key output: `Control bus adapter connected, subscription: UIPUT/ws/dam/pic/de/sw/+/+/+`
- Result: PASS

Browser Verification Record
- Tool: Playwright real browser, URL `http://127.0.0.1:30900/#/workspace`
- Flow: Open Workspace, use `E2E 颜色生成器`, fill `0376 color return ok`, click `Generate Color`.
- Result: PASS
- Evidence: Browser snapshot showed color value `#c2d7f2` and status `processed`; `/snapshot` confirmed Model 100 `bg_color=#c2d7f2`, `status=processed`, `submit_inflight=false`.
- Flow: Open `最小 Submit 双总线示例`, fill `0376 minimal submit ok`, click `Submit`.
- Result: PASS
- Evidence: Browser snapshot showed `Submitted: 0376 minimal submit ok` and `REMOTE remote_processed`; `/snapshot` confirmed Model 1050 `display_text=Submitted: 0376 minimal submit ok`, `remote_status=remote_processed`, `submit_inflight=false`.
- Bus Evidence: MBR logs showed request and response on `UIPUT/ws/dam/pic/de/sw/R1/100/submit` and `UIPUT/ws/dam/pic/de/sw/R1/3000/submit1`; remote-worker logs showed inbound request and response publish for both topics.

Final Sub-agent Review Record
- Iteration ID: 0376-control-first-mbr-routing
- Review Date: 2026-05-18
- Review Type: AI-assisted / sub-agent
- Review Index: 9
- Decision: Approved
- Notes: Final review found no findings, no open questions, and no verification gaps. It confirmed the UI Server control-bus return subscriber, deployment bootstrap MQTT labels, strict 0376 tests, local deployment, and browser verification evidence all match the control-first / payload-topic route truth contract without compatibility fallback.
