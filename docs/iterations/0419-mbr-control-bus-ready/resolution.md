---
title: "Iteration 0419-mbr-control-bus-ready Resolution"
doc_type: iteration-resolution
status: hotfix
updated: 2026-06-18
source: ai
iteration_id: 0419-mbr-control-bus-ready
id: 0419-mbr-control-bus-ready
phase: hotfix
---

# Iteration 0419-mbr-control-bus-ready Resolution

## Execution Strategy

Use the smallest safe runtime-runner and UI Server activation changes:

1. Split MBR readiness into a control-bus readiness gate and a Matrix management-bus adapter gate.
2. When an authenticated UI principal runtime enters running, also activate the shared UI Server control-bus inbound listener that receives MQTT responses and dispatches them into the correct principal runtime.

Control-bus MQTT routing should become available once MQTT is ready. Matrix management-bus events should still only be subscribed and handled after `createMatrixLiveAdapter` succeeds.

## Step 1 — Regression Contract

Scope:

- Add a deterministic test around `scripts/run_worker_v0.mjs` so the MBR runner cannot regress to waiting for Matrix ready before activating runtime.
- The test must also keep the existing pre-running drop guard in place.

Files:

- `scripts/tests/test_0419_mbr_control_bus_ready_contract.mjs`
- `docs/iterations/0419-mbr-control-bus-ready/runlog.md`

Verification:

```bash
node scripts/tests/test_0419_mbr_control_bus_ready_contract.mjs
```

Acceptance:

- Test fails before the runner change.
- Test passes after the runner change.

Rollback:

- Remove the new test and runlog entries.

## Step 2 — Runner Fix

Scope:

- Modify MBR runner readiness so MQTT control-bus availability activates runtime.
- Leave Matrix adapter initialization and management-bus subscription unchanged apart from no longer blocking MQTT routing.

Files:

- `scripts/run_worker_v0.mjs`
- `docs/iterations/0419-mbr-control-bus-ready/runlog.md`

Verification:

```bash
node scripts/tests/test_0419_mbr_control_bus_ready_contract.mjs
node scripts/tests/test_0179_mbr_runtime_mode_gate.mjs
node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs
```

Note:

- `node scripts/validate_mbr_patch_v0.mjs` is not used as the 0419 gate. It still encodes older MBR output-shape expectations and currently fails against the current control-bus contract. Keep it as a separate validator refresh task rather than claiming it as 0419 evidence.

Acceptance:

- Tests pass.
- No legacy topic or compatibility path is introduced.

Rollback:

- Revert `scripts/run_worker_v0.mjs` and the 0419 test.

## Step 3 — Local Deploy And Browser Verification

Scope:

- Rebuild/redeploy local affected worker image/manifests.
- Rebuild/redeploy local UI Server after fixing shared inbound activation.
- Confirm MBR enters `runtime_mode=running`.
- Verify Workspace Manager install with the real Chrome session on `http://localhost:30900/#/`.

Files:

- `docs/iterations/0419-mbr-control-bus-ready/runlog.md`

Verification:

```bash
kubectl -n dongyu logs deploy/mbr-worker --tail=120 | rg "runtime_mode=running|drop pre-running"
```

Acceptance:

- Browser click on an installable Workspace Manager asset triggers a completed install state, not a stuck `requesting` state.
- Installed app appears in the app surface and can be opened.

Rollback:

- Redeploy previous local image or revert the branch and redeploy.

## Step 4 — Authenticated UI Server Inbound Fix

Scope:

- Keep per-principal UI data isolation unchanged.
- Start the shared UI Server control-bus inbound listener during authenticated `/api/runtime/mode` activation, before the principal runtime starts sending provider-owned install requests.
- Do not alter topic naming, response-topic semantics, or add compatibility paths.

Files:

- `packages/ui-model-demo-server/server.mjs`
- `scripts/tests/test_0419_mbr_control_bus_ready_contract.mjs`
- `docs/iterations/0419-mbr-control-bus-ready/runlog.md`

Verification:

```bash
node scripts/tests/test_0419_mbr_control_bus_ready_contract.mjs
node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs
```

Acceptance:

- Shared UI Server control-bus inbound activation is explicit and guarded against duplicate startup.
- Principal runtime activation still routes snapshots and state by principal.
- Provider-owned install response handling remains strict and still rejects mismatches.

## Step 5 — Principal Runtime Bundle Response Fix

Scope:

- Preserve user-specific runtime isolation for authenticated UI Server sessions.
- Preserve strict `reply_target_principal_key` routing.
- Change principal response dispatch so the registry delegates into the addressed user's `ProgramModelEngine` instead of directly applying nested payload labels.
- Split principal response dispatch result into `matched` and `handled`; a principal-targeted response that is rejected must not fall through into the shared runtime.
- Ensure provider-owned Workspace Manager install responses still run the normal `slide_app_bundle_response.v1` installer.
- Keep generic owner materialization strict: no direct label-write compatibility path for models without `dual_bus_model`.

Files:

- `packages/ui-model-demo-server/server.mjs`
- `scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
- `scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
- `docs/iterations/0419-mbr-control-bus-ready/runlog.md`

Verification:

```bash
node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs
node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs
node scripts/tests/test_0419_mbr_control_bus_ready_contract.mjs
node scripts/tests/test_0403_oidc_session_gateway.mjs
node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs
node scripts/tests/test_0144_remote_worker.mjs
node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs
node scripts/tests/test_0179_mbr_runtime_mode_gate.mjs
```

Acceptance:

- Workspace Manager bundle response addressed to an authenticated principal materializes a new slide app model.
- Rejected principal-targeted responses are not materialized into the shared runtime.
- Install success Dialog labels are written by the UI model path.
- The app registry refreshes so the new app appears without page reload.
- Invalid/mismatched provider bundle responses remain rejected.
- OIDC fresh callback state validation remains healthy.
