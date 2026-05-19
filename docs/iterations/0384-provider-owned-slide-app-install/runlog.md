---
title: "0384 - Provider-Owned Slide App Install Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0384-provider-owned-slide-app-install
id: 0384-provider-owned-slide-app-install
phase: completed
---

# Iteration 0384-provider-owned-slide-app-install Runlog

## Environment

- Date: 2026-05-19
- Branch: `dropx/dev_0384-provider-owned-slide-app-install`
- Runtime: local Orbstack/Kubernetes deployment verified; browser E2E completed against `http://127.0.0.1:30900/#/workspace`
- Notes: 0384 begins from `dev` after 0383 completion; worktree was clean at branch creation.

## Review Gate Records

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Copernicus (`019e3fbd-0ddf-7f43-aaa0-74109b21efaa`)
- Review Index: 1
- Decision: Change Requested
- Notes: Required explicit Workspace Manager DEM catalog truth owner, pending response correlation, and SSOT checklist coverage for `pin_connection_contract_v2.md` and `tier_boundary_and_conformance_testing.md`.

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Laplace (`019e3fbd-0e2c-7be2-bde3-bc5659da192e`)
- Review Index: 2
- Decision: Change Requested
- Notes: Required topic/route_kind contract, Step 1 PASS gate clarity, Step 2 fail-closed expectation, Step 3 provider patch/function validation, and reproducible local/browser commands.

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Epicurus (`019e3fc3-f2a3-7392-b6ed-c094bb5b5e7e`)
- Review Index: 3
- Decision: Approved
- Notes: Total plan re-review approved after catalog owner, response correlation, SSOT checklist, and per-step review gates were added.

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Plato (`019e3fc3-f2e7-7611-91df-d8673d72ea6c`)
- Review Index: 4
- Decision: Change Requested
- Notes: Independent implementation plan still lacked provider_route_kind/computed topic/pending correlation, Step 2 fail-closed checks, Step 3 R1 provider validation, and concrete Playwright commands.

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Feynman (`019e3fc6-a095-7c23-a0d5-e2370c5f124f`)
- Review Index: 5
- Decision: Approved
- Notes: Implementation plan re-review approved after the standalone plan was synchronized with `resolution.md`.

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Beauvoir (`019e3fca-3135-7aa3-aa38-9603dc77d03c`)
- Review Index: 6
- Decision: Change Requested
- Notes: Required removing Step 1 PASS/FAIL ambiguity and aligning Task 4 final checks with `resolution.md`.

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Russell (`019e3fcc-dd2d-7c50-98cc-ff0b762f5176`)
- Review Index: 7
- Decision: Approved
- Notes: Final Phase Gate approved; Step 1 is now a passing docs/contract gate, runtime/catalog rejection moved to Step 2, and Task 4 checks align with `resolution.md`.

## Execution Records

### Step 1 — Contract and Tests

- Start time: 2026-05-19
- End time: 2026-05-19
- Branch: `dropx/dev_0384-provider-owned-slide-app-install`
- Commits:
- Commands executed:
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
  - `git diff --check`
- Key outputs:
  - `4 passed, 0 failed out of 4`
  - `git diff --check` produced no output
- Result: PASS

#### Step 1 Review

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Zeno (`019e3fd1-a302-7f60-950a-ab22bbcf852a`)
- Review Index: Step 1.1
- Decision: Change Requested
- Notes: Required separating 0384 target contract from live current truth, adding computed topic / route_kind to response correlation, and strengthening tests.

### Step 1 Review Fix

- Command: updated provider-owned install docs and 0384 contract test.
- Key output: 0384 target contract is now explicitly marked as target behavior until implementation completes; response correlation fields now include computed topic and route_kind.
- Verification:
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs` -> `4 passed, 0 failed out of 4`
  - `git diff --check` -> no output
- Result: PASS

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Jason (`019e3fd4-3c46-7b61-a17d-67aeaff67e44`)
- Review Index: Step 1.2
- Decision: Approved
- Notes: Step 1 contract review approved. Runtime/catalog enforcement remains correctly deferred to later steps.

### Step 2 — Provider Index

- Start time: 2026-05-19
- End time: 2026-05-19
- Branch: `dropx/dev_0384-provider-owned-slide-app-install`
- Commits:
- Commands executed:
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `git diff --check`
- Key outputs:
  - `4 passed, 0 failed out of 4`
  - `5 passed, 0 failed out of 5`
  - `summary: PASS`
  - `git diff --check` produced no output
- Result: PASS

#### Step 2 Review

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Hypatia (`019e3fdb-0bc3-73b0-8d0e-45b9b3a5045d`)
- Review Index: Step 2.1
- Decision: Approved
- Notes: Provider index no longer exposes `source_model_id`; install path fails closed in Step 2 with no model/registry materialization; forged rows are rejected.

### Step 3 — Provider Bundle Path

- Start time: 2026-05-19
- End time: 2026-05-19
- Branch: `dropx/dev_0384-provider-owned-slide-app-install`
- Commits:
- Commands executed:
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `node --check scripts/run_worker_remote_v1.mjs`
  - `bash -n scripts/ops/sync_local_persisted_assets.sh`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
  - `node scripts/tests/test_0377_workspace_manager_de_contract.mjs`
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
  - `node scripts/tests/test_0379_explicit_management_route_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `git diff --check`
- Key outputs:
  - `5 passed, 0 failed out of 5`
  - `3 passed, 0 failed out of 3`
  - `4 passed, 0 failed out of 4`
  - `9 passed, 0 failed out of 9`
  - `9 passed, 0 failed out of 9`
  - `3 passed, 0 failed out of 3`
  - `summary: PASS`
  - `git diff --check` produced no output
- Notes:
  - UI Server install now sends `workspace_asset_bundle_request_bus` through Model 0 and records pending install state.
  - R1 provider model 3100 subscribes `UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request` and returns `slide_app_bundle_response.v1`.
  - Valid provider response materializes a new local app; mismatched response does not create a model.
  - Optional legacy 0375 route suite was sampled and reported `65 passed, 9 failed out of 74`; failures are in older runtime topic expectations and this step did not modify runtime core. Current blocking route suites are 0376 and 0379.
- Result: PASS

#### Step 3 Review

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Goodall (`019e3fe6-2450-71e3-895d-bd9aa376c4d6`)
- Review Index: Step 3.1
- Decision: Change Requested
- Notes: R1 provider used `r1-minimal-submit-dual-bus` while Workspace Manager catalog used `r1-minimal-submit`, so installing the minimal Submit asset would fail. Reviewer also requested broader response-correlation coverage.

### Step 3 Review Fix

- Command: aligned R1 provider asset mapping and strengthened flow tests.
- Key output:
  - Provider mapping now accepts `r1-minimal-submit`.
  - `test_0384_provider_owned_slide_app_install_flow.mjs` covers both `r1-color-generator` and `r1-minimal-submit`.
  - Response mismatch tests now cover `asset_id`, `op_id`, `topic`, `route_kind`, `endpoint`, and `reply_target`.
  - Transport legacy metadata scanning now treats `bundle_payload` as the formal ModelTable app bundle payload; install-time validation remains responsible for validating bundle records.
- Verification:
  - `node --check packages/worker-base/src/runtime.mjs` -> PASS
  - `node --check packages/ui-model-demo-server/server.mjs` -> PASS
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs` -> `5 passed, 0 failed out of 5`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs` -> `3 passed, 0 failed out of 3`
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs` -> `4 passed, 0 failed out of 4`
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs` -> `9 passed, 0 failed out of 9`
  - `node scripts/tests/test_0379_explicit_management_route_contract.mjs` -> `3 passed, 0 failed out of 3`
  - `node scripts/validate_ui_ast_v0x.mjs --case all` -> `summary: PASS`
  - `git diff --check` -> no output

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Poincare (`019e3fec-8cdc-7553-831f-d60722796ae6`)
- Review Index: Step 3.2
- Decision: Change Requested
- Notes: The first `bundle_payload` exception was too broad and could allow ordinary nested payloads or top-level `bundle_payload` records to bypass legacy metadata rejection.

### Step 3 Review Fix 2

- Command: scoped `bundle_payload` legacy-metadata exception to `slide_app_bundle_response.v1` only.
- Key output:
  - Runtime and server now only allow `bundle_payload` to contain app-bundle ModelTable records inside `slide_app_bundle_response.v1`.
  - Top-level `bundle_payload` and non-slide-app nested `bundle_payload` records with legacy metadata remain rejected.
  - Added `bundle_payload_exception_is_scoped_to_slide_app_response` negative coverage.
- Verification:
  - `node --check packages/worker-base/src/runtime.mjs` -> PASS
  - `node --check packages/ui-model-demo-server/server.mjs` -> PASS
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs` -> `5 passed, 0 failed out of 5`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs` -> `4 passed, 0 failed out of 4`
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs` -> `4 passed, 0 failed out of 4`
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs` -> `9 passed, 0 failed out of 9`
  - `node scripts/tests/test_0379_explicit_management_route_contract.mjs` -> `3 passed, 0 failed out of 3`
  - `node scripts/validate_ui_ast_v0x.mjs --case all` -> `summary: PASS`
  - `git diff --check` -> no output

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Sartre (`019e3fef-a2a8-7600-b794-88922a5c6fb1`)
- Review Index: Step 3.3
- Decision: Approved
- Notes: Step 3 final review approved. Reviewer confirmed no local `source_model_id` install fallback, scoped `bundle_payload` exception, and both provider-owned assets install in simulated checks.

### Step 4 — Deployment and Browser E2E

- Start time: 2026-05-19
- End time: 2026-05-19
- Branch: `dropx/dev_0384-provider-owned-slide-app-install`
- Commits:
- Commands executed:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - local MBR overlay image rebuild from existing `dy-mbr-worker:v2` after Docker Hub `node:22-slim` TLS fetch timeout
  - `SKIP_IMAGE_BUILD=1 SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `command -v npx >/dev/null 2>&1`
  - `"$PWCLI" open http://127.0.0.1:30900/#/workspace --headed`
  - `"$PWCLI" snapshot`
  - browser flow: open `工作区管理器`, click provider-owned install for `E2E 颜色生成器`, open installed app, click `Generate Color`
  - browser flow: open `工作区管理器`, click provider-owned install for `最小 Submit 双总线示例`, open installed app, type `provider install e2e`, click `Submit`
  - `"$PWCLI" screenshot --filename output/playwright/0384-provider-owned-install/final-minimal-submit.png --full-page`
  - `node --check packages/worker-base/src/runtime.mjs`
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `bash -n scripts/ops/sync_local_persisted_assets.sh`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
  - `node scripts/tests/test_0377_workspace_manager_de_contract.mjs`
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
  - `node scripts/tests/test_0379_explicit_management_route_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `git diff --check`
- Key outputs:
  - First deploy attempt reached image build but failed while pulling base image with Docker Hub TLS timeout; no runtime conformance failure.
  - MBR image overlay rebuild succeeded by copying changed worker-base/runtime files onto the existing local image.
  - Second deploy with `SKIP_IMAGE_BUILD=1` completed and rolled out `ui-server`, `mbr-worker`, `remote-worker`, and `workspace-manager`.
  - `check_runtime_baseline.sh`: all six deployments ready; no terminating worker pods; `baseline ready`.
  - Browser installed provider-owned `E2E 颜色生成器` as model `1081`; `Generate Color` changed visible color from `#FFFFFF` to `#0151ed`; status changed to `processed`.
  - Browser installed provider-owned `最小 Submit 双总线示例` as model `1082`; after typing `provider install e2e` and clicking `Submit`, the visible label changed to `Submitted: provider install e2e`; remote status changed to `remote_processed`.
  - Screenshot artifact: `output/playwright/0384-provider-owned-install/final-minimal-submit.png`.
  - Contract tests: `5 passed, 0 failed out of 5`.
  - Provider flow tests: `4 passed, 0 failed out of 4`.
  - Workspace Asset Manager tests: `4 passed, 0 failed out of 4`.
  - Workspace Manager DE tests: `9 passed, 0 failed out of 9`.
  - Control-first MBR routing tests: `9 passed, 0 failed out of 9`.
  - Explicit management route tests: `3 passed, 0 failed out of 3`.
  - UI AST validation: `summary: PASS`.
  - Frontend production build: `✓ built`.
  - `git diff --check` produced no output.
- Conformance:
  - Tier placement: provider-owned bundle truth lives in R1 provider model 3100; UI Server only materializes after validated response.
  - Model placement: bus pins stay on Model 0; installed apps receive host-owned mount/ingress/egress adapter labels.
  - Data ownership: Workspace Manager owns the asset index; provider owns bundle payload; UI Server owns local installed instance identity.
  - Data flow: browser click -> Workspace Manager install action -> UI Server Model 0 `pin.bus.cb.out` -> MBR/control route -> R1 `bundle_request` -> provider response -> UI Server installer -> Workspace mount.
  - Data chain: request/response payloads remain Temporary ModelTable record arrays; no `source_model_id` local-copy fallback.
- Result: PASS

#### Step 4 Review

```text
Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Linnaeus (`019e3ffb-95d4-7802-86c5-9c9789c87efd`)
- Review Index: Step 4.1
- Decision: Change Requested
- Notes: Required updating the Environment runtime status and docs updated checklist to match completed local deployment/browser E2E and documentation changes.
```

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Popper (`019e3ffe-dbfd-7e50-ab56-cacf7ea70dab`)
- Review Index: Step 4.2
- Decision: Approved
- Notes: Step 4 closure re-review approved after audit consistency fixes.

Review Gate Record
- Iteration ID: 0384-provider-owned-slide-app-install
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Reviewer: Singer (`019e4000-ee80-7e71-9440-8d1af4ad5333`)
- Review Index: Final
- Decision: Approved
- Notes: Whole-iteration review approved. No findings, open questions, or verification gaps.

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed; no direct edit required because 0384 does not change core runtime bus semantics.
- [x] `docs/ssot/pin_connection_contract_v2.md` reviewed; no direct edit required because 0384 uses existing `pin.connect.label` / `pin.connect.cell` semantics and does not add a connection type.
- [x] `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` reviewed and updated for 0384 current provider-owned install contract.
- [x] `docs/ssot/temporary_modeltable_payload_v1.md` reviewed and updated for `slide_app_bundle_request.v1` / `slide_app_bundle_response.v1`.
- [x] `docs/ssot/label_type_registry.md` reviewed; no direct edit required because 0384 uses existing durable label types and JSON payload labels.
- [x] `docs/ssot/tier_boundary_and_conformance_testing.md` reviewed; conformance evidence recorded in Step 4.
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed and updated for 0384 current contract.
- [x] `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md` reviewed and updated for Workspace Manager provider-owned installation.
