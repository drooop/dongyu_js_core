---
title: "0384 - Provider-Owned Slide App Install Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0384-provider-owned-slide-app-install
id: 0384-provider-owned-slide-app-install
phase: completed
---

# Iteration 0384-provider-owned-slide-app-install Resolution

## Execution Strategy

Execute in four small stages. Each stage must run its verification commands, update runlog with factual PASS/FAIL evidence, then request `codex-code-review` from a spawned sub-agent. Continue only after review returns `Decision: APPROVED`; if review requests changes, fix and re-review before proceeding.

The implementation is a hard cut: Workspace Manager installable assets become provider endpoint references. UI Server must not install by exporting a local `source_model_id`.

## Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Contract and Tests | Freeze provider-owned install contract and passing doc/static checks | `docs/ssot/*`, `docs/user-guide/*`, `scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs` | `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs` | Passing tests encode docs/contract requirements; runtime assertions are added in later steps | Revert docs/test file |
| 2 | Provider Index | Convert Workspace Manager catalog from local source ids to provider endpoint rows and fail closed before bundle implementation | `packages/worker-base/system-models/workspace_manager_asset_manager_ui.json`, `server.mjs`, 0378 tests | `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`; `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs` | Catalog rows point to R1 bundle endpoints; install cannot local-copy and may only return a visible provider-path-not-ready failure before Step 3 | Revert catalog/projection edits |
| 3 | Provider Bundle Path | Add R1 bundle service and UI Server provider-response installer | `deploy/sys-v1ns/remote-worker/patches/*.json`, `server.mjs`, tests | targeted node tests + syntax checks | Install request uses Model 0 bus, provider response materializes returned bundle, no local export fallback | Revert R1/server changes |
| 4 | Deployment and Browser E2E | Redeploy locally and test Workspace Manager install + installed app run | runlog/assets; no planned code except fixes | `bash scripts/ops/deploy_local.sh`; `bash scripts/ops/check_runtime_baseline.sh`; Playwright browser flow | Real browser proves install from Workspace Manager and app runtime works | Rebuild/redeploy previous branch |

## Step Details

### Step 1 — Contract and Tests

**Goal**
- Make the desired provider-owned install behavior unambiguous before runtime edits.

**Scope**
- Add a deterministic 0384 contract test for docs/contract content. This Step 1 test must pass before implementation starts.
- Update docs that currently describe `source_model_id` local install as the current truth.
- Define bundle request/response shape:
  - request nested payload kind: `slide_app_bundle_request.v1`
  - response nested payload kind: `slide_app_bundle_response.v1`
  - response carries `asset_id`, `bundle_payload` as a ModelTable record array, and optional `bundle_sha256`.
- Define request routing fields:
  - catalog truth stores `provider_worker_id`, `provider_model_id`, `provider_bundle_pin`, and `provider_route_kind`.
  - UI Server deterministically computes the transport `topic` from Model 0 `mqtt_topic_base + provider_worker_id + provider_model_id + provider_bundle_pin`.
  - full topic may be written as a derived projection/status label, but must not become independent catalog truth.
- Define pending request correlation:
  - UI Server writes pending install state including `op_id`, `asset_id`, provider endpoint, computed topic, `route_kind`, and `reply_target`.
  - response materialization requires matching `op_id` or request correlation, `asset_id`, provider endpoint, and `reply_target`.

**Files**
- Create/Update:
  - `scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - `docs/ssot/temporary_modeltable_payload_v1.md`
  - `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/iterations/0384-provider-owned-slide-app-install/runlog.md`
- Must NOT touch:
  - runtime implementation except if required to expose pure helper functions for tests; prefer no runtime code in this step.

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
  - `git diff --check`
- Expected signals:
  - Step 1 tests pass by checking docs/contract content only. Runtime/code behavior tests are added or tightened in Steps 2 and 3 so each stage can end with PASS.

**Acceptance Criteria**
- The contract says Workspace Manager is an index, provider owns bundle payload, UI Server owns materialization.
- The contract says Workspace Manager DEM ModelTable owns catalog/index truth; UI Server only projects/caches it.
- The contract rejects `source_model_id` as install truth.
- Runtime/catalog rejection of existing `source_model_id` rows is not asserted until Step 2, where the catalog shape is actually changed.
- The contract requires stale/mismatched provider responses to be rejected before materialization.
- Sub-agent review approves the docs/test contract.

**Rollback Strategy**
- Remove the 0384 test and revert touched docs.

---

### Step 2 — Provider Index

**Goal**
- Make the Workspace Manager catalog express provider endpoints, not local source models.

**Scope**
- Replace installable asset fields with provider-owned metadata:
  - `asset_id`
  - `provider_worker_id`
  - `provider_model_id`
  - `provider_bundle_pin`
  - `provider_route_kind`
  - `runtime_endpoint_worker_id`
  - `runtime_endpoint_model_id`
  - `runtime_pins`
  - optional derived `provider_bundle_topic` projection/status value computed from current Model 0 topic base
  - optional `bundle_sha256`
- Update server-side canonical row derivation.
- Update UI text so it no longer claims UI Server reads local source models.
- Change install action to fail closed if provider bundle request code is not yet implemented in this step; it must not local-copy from any model id.

**Files**
- Create/Update:
  - `packages/worker-base/system-models/workspace_manager_asset_manager_ui.json`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
  - `scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
- Must NOT touch:
  - Remote worker bundle service implementation.

**Validation (Executable)**
- Commands:
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `git diff --check`
- Expected signals:
  - 0378 tests updated to assert provider index shape.
  - 0384 tests assert no installable row uses `source_model_id`.
  - Install action does not create a model in Step 2; it writes a visible provider path status/failure until Step 3 implements the request/response path.

**Acceptance Criteria**
- `asset_catalog_json` is regenerated from ModelTable catalog rows.
- Forged frontend rows cannot install.
- Installable catalog rows have provider endpoint metadata sufficient to request a bundle.
- No test in Step 2 depends on the old local `source_model_id` materialization behavior.

**Rollback Strategy**
- Revert catalog and projection changes.

---

### Step 3 — Provider Bundle Path

**Goal**
- Make install button request a provider-owned bundle and materialize the provider response.

**Scope**
- Add R1 provider bundle pins and subscriptions.
- Add provider-side functions that return clean ModelTable bundle payloads for the two current assets.
- Change UI Server install action:
  - validate selected canonical row;
  - write visible install status;
  - build `pin_payload.v1` request through Model 0 bus out;
  - do not call `buildSlideAppExportPayload(runtime, row.source_model_id)`.
- Change UI Server response handling:
  - detect `slide_app_bundle_response.v1`;
  - verify response correlation against pending install state: `op_id` or request id, `asset_id`, provider endpoint, and `reply_target`;
  - validate `bundle_payload` with existing slide import validator;
  - materialize returned bundle;
  - update Workspace Manager status and selected model.
- Add tests that load remote-worker patches, execute the provider bundle function, and verify subscription/pin routing.

**Files**
- Create/Update:
  - `packages/ui-model-demo-server/server.mjs`
  - `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json`
  - `deploy/sys-v1ns/remote-worker/patches/10_model100.json`
  - `deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json`
  - `scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
  - `scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
  - possibly `scripts/ops/sync_local_persisted_assets.sh` if new patch files or payload assets are introduced.
- Must NOT touch:
  - MBR route semantics unless tests prove a real routing gap.

**Validation (Executable)**
- Commands:
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `node --check scripts/run_worker_remote_v1.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
  - `node scripts/tests/test_0377_workspace_manager_de_contract.mjs`
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
  - `node scripts/tests/test_0379_explicit_management_route_contract.mjs`
  - `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs` if present, otherwise nearest 0375/0376/0379 targeted route tests.
  - `git diff --check`
- Expected signals:
  - Provider response installs a new app in deterministic tests.
  - Old local copy path is absent from install action.
  - Remote-worker patch validation proves the new provider pin and subscription can return `slide_app_bundle_response.v1`.

**Acceptance Criteria**
- Clicking install no longer materializes directly from local `source_model_id`.
- A valid provider bundle response installs the app.
- Invalid/missing bundle response writes a visible failure and does not create a model.
- Stale, mismatched, or forged-but-well-formed responses do not create a model.
- Sub-agent review approves implementation.

**Rollback Strategy**
- Revert server and R1 patch changes.

---

### Step 4 — Deployment and Browser E2E

**Goal**
- Prove the change in real local deployment and browser interaction.

**Scope**
- Sync persisted assets.
- Rebuild/restart affected local services.
- Test Workspace Manager install in a real browser.
- Test the installed app still runs through the dual-bus path.
- Run final review and update iteration status.

**Files**
- Create/Update:
  - `docs/iterations/0384-provider-owned-slide-app-install/runlog.md`
  - `docs/ITERATIONS.md`
  - optional screenshots under `output/playwright/`
- Must NOT touch:
  - unrelated UI redesign or Matrix Suite work.

**Validation (Executable)**
- Commands:
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `command -v npx >/dev/null 2>&1`
  - `export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"; export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"`
  - `"$PWCLI" open http://127.0.0.1:30900/#/workspace --headed`
  - `"$PWCLI" snapshot`
  - Browser flow: open `工作区管理器`, click provider-owned install for `E2E 颜色生成器`, confirm a new sidebar app appears, open it, click `Generate`, and confirm the rendered color changes.
  - Save screenshots/snapshots under `output/playwright/0384-provider-owned-install/`.
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `git diff --check`
- Expected signals:
  - Browser opens Workspace Manager.
  - Install button creates a new local app only after provider response.
  - Installed `E2E 颜色生成器` changes color after Generate.

**Acceptance Criteria**
- Browser evidence proves the provider-owned install path and installed app runtime path.
- Browser evidence includes provider-unavailable/failure-path observation where feasible; deterministic tests must cover it if browser forcing is impractical.
- Final `codex-code-review` sub-agent review returns `APPROVED`.
- `docs/ITERATIONS.md` marks 0384 completed when all checks pass.

**Rollback Strategy**
- Revert 0384 branch changes and redeploy previous dev/main image/assets.
