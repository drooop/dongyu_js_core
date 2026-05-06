---
title: "0358 Model 100 Bus Event V2 Submit Hotfix Runlog"
doc_type: iteration_runlog
status: completed
updated: 2026-05-06
source: ai
iteration: 0358-model100-bus-event-v2-submit-hotfix
---

# Iteration 0358-model100-bus-event-v2-submit-hotfix Runlog

## Environment

- Date: 2026-05-06
- Branch: `dev_0358-model100-bus-event-v2-submit-hotfix`
- Runtime: local Kubernetes namespace `dongyu`, URL `http://127.0.0.1:30900/#/workspace`
- Hotfix reason: real browser reproduced `Generate Color` click with unchanged color; logs showed direct positive-model pin path wrote `submit_request` but did not reach the active Model 0 bus route.
- Review Gate Record
- Iteration ID: 0358-model100-bus-event-v2-submit-hotfix
- Review Date: 2026-05-06
- Review Type: AI-assisted hotfix triage
- Review Index: 1
- Decision: Approved
- Notes: Scope restricted to Model 100 bus-event-v2 submit ingress and local browser verification.

## Execution Records

### Step 1

- Command: `node scripts/tests/test_0177_model100_submit_ui_contract.mjs`
- Key output: `PASS model100 submit UI contract`
- Result: Model 100 submit button contract is `bus_event_v2` with `bus_in_key=bus_event_submit_100_0_0_0`, and no direct positive-model `pin` remains on the submit button.
- Commit: included in final iteration commit.

- Command: `node scripts/tests/test_0333_model100_cellwise_contract.mjs`
- Key output: `PASS 6/6`
- Result: Model 100 cellwise projection exposes the submit action as a Model 0 bus-in route, and the route points to Model 0 `model100_submit_out`.
- Commit: included in final iteration commit.

- Command: `node scripts/tests/test_0326_positive_model_bus_event_contract.mjs`
- Key output: `PASS 2/2`
- Result: Positive-model browser events remain constrained to Model 0 `bus_event_v2`.
- Commit: included in final iteration commit.

- Command: `node scripts/tests/test_0357_pin_connection_hard_cut.mjs`
- Key output: `PASS`
- Result: No legacy `pin.connect.model`, prefix endpoint, or `pin.log.*` contract surface was reintroduced.
- Commit: included in final iteration commit.

- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output: production build completed.
- Result: Frontend projection changes compile.
- Commit: included in final iteration commit.

### Step 2

- Command: `docker build --no-cache -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`
- Key output: image build completed.
- Result: Local deployment image contains the new UI/server/model-table contract.
- Commit: included in final iteration commit.

- Command: `SKIP_IMAGE_BUILD=1 SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Key output: local rollout completed.
- Result: Local URL `http://127.0.0.1:30900/#/workspace` serves the rebuilt runtime.
- Commit: included in final iteration commit.

- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: `baseline ready`
- Result: Local Kubernetes namespace `dongyu` has ready `mosquitto`, `synapse`, `remote-worker`, `mbr-worker`, `ui-server`, and `ui-side-worker`.
- Commit: included in final iteration commit.

- Command: `/snapshot` conformance check.
- Key output: `pinConnectModel=0`, `oldPinConnectLabelValues=0`, `oldPinConnectCellValues=0`, `pinLogLabels=0`.
- Result: Deployed snapshot is on the new pin connection contract and Model 100 submit route is `bus_event_submit_100_0_0_0 -> model100_submit_out`.
- Commit: included in final iteration commit.

- Command: Playwright browser test on `http://127.0.0.1:30900/#/workspace`.
- Key output: `Generate Color` changed visible color from `#ed37c9` to `#e07d8b`.
- Result: Real browser confirms UI event enters Model 0, reaches worker through Matrix/MBR/MQTT, and result materializes back into the Workspace UI.
- Commit: included in final iteration commit.

- Command: Playwright browser test on `/p/slide-app-runtime-minimal-submit-provider/minimal_submit_app_provider_interactive.html`.
- Key output: `Waiting for submit` changed to `Submitted: codex static html submit`.
- Result: Published interactive HTML guide behaves as documented.
- Commit: included in final iteration commit.

- Command: Playwright browser test on Workspace `滑动 APP 创建` / `滑动 APP 导入`.
- Key output: Created `Codex Slide Verify 0506`, opened it from the asset tree, and opened the import page.
- Result: Workspace slide-app creation, mounting, display, and import page rendering are operational.
- Commit: included in final iteration commit.

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed for Model 0 bus-in route authority
- [x] `docs/user-guide/slide-app-runtime/` behavior verified through the published HTML guide
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` not changed; iteration evidence recorded here
