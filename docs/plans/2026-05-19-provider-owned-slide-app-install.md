---
title: "Provider-Owned Slide App Install Implementation Plan"
doc_type: implementation-plan
status: completed
updated: 2026-05-20
project: dongyuapp
source: ai
---

# Provider-Owned Slide App Install Implementation Plan

> **For Codex:** Execute through iteration `0384-provider-owned-slide-app-install`. Each stage requires a spawned `codex-code-review` sub-agent review before continuing.

**Goal:** Workspace Manager acts as an index, while RemoteWorker `R1` provides the actual slide-app ModelTable bundle at install time.

**Architecture:** The install button resolves a canonical catalog row, sends a `slide_app_bundle_request.v1` nested payload through UI Server Model 0, and waits for a provider `slide_app_bundle_response.v1`. UI Server validates the returned ModelTable bundle and then performs the existing explicit materialization/mount step.

**Tech Stack:** ModelTable records, UI Server `server.mjs`, worker-base runtime, RemoteWorker fill-table patches, deterministic Node tests, Playwright browser verification.

---

## Task 1: Contract and Guard Tests

**Files:**
- Create: `scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
- Modify: `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
- Modify: `docs/ssot/temporary_modeltable_payload_v1.md`
- Modify: `docs/user-guide/modeltable_user_guide.md`
- Modify: `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md`

**Checks:**
- `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
- `git diff --check`

**Expected:** The test encodes the new docs/contract rules and must pass before implementation starts. It documents that `source_model_id` is not valid install truth, but runtime/catalog rejection of current `source_model_id` rows is asserted in Task 2 after the catalog shape is changed. The contract must also assert:
- installable catalog truth stores `provider_worker_id`, `provider_model_id`, `provider_bundle_pin`, and `provider_route_kind`.
- UI Server computes the request `topic` from Model 0 `mqtt_topic_base + provider_worker_id + provider_model_id + provider_bundle_pin`; a full topic label may only be a derived projection/status value.
- pending install state includes `op_id`, `asset_id`, provider endpoint, computed topic, `route_kind`, and `reply_target`.
- provider bundle response must match the pending install state before materialization.

**Rollback:** Revert the 0384 test and docs edited in this task.

## Task 2: Catalog Becomes Provider Index

**Files:**
- Modify: `packages/worker-base/system-models/workspace_manager_asset_manager_ui.json`
- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
- Modify: `scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`

**Checks:**
- `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
- `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
- `node scripts/validate_ui_ast_v0x.mjs --case all`

**Expected:** Catalog rows expose provider bundle endpoints and no longer claim local source-model installation. Before the Step 3 provider bundle path exists, install must fail closed:
- no new local model is created.
- `asset_install_status` records a visible provider-path-not-ready failure.
- no code path exports or imports a local `source_model_id`.
- forged frontend rows still fail before any provider request.

**Rollback:** Revert Workspace Manager catalog/projection edits and restore the previous 0378 test shape.

## Task 3: Provider Bundle Request and Install Response

**Files:**
- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json`
- Modify or create R1 provider bundle patch files under `deploy/sys-v1ns/remote-worker/patches/`
- Modify: relevant tests.

**Checks:**
- `node --check packages/ui-model-demo-server/server.mjs`
- `node --check scripts/run_worker_remote_v1.mjs`
- `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
- `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
- `node scripts/tests/test_0377_workspace_manager_de_contract.mjs`
- `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
- `node scripts/tests/test_0379_explicit_management_route_contract.mjs`
- the 0384 test must load remote-worker patches, verify the provider bundle subscription route, execute the provider bundle function, and assert returned payload kind `slide_app_bundle_response.v1`.

**Expected:** Install requests are bus messages; valid provider responses install a new local app; malformed responses fail visibly.

**Rollback:** Revert UI Server install/response handling and R1 provider patch edits.

## Task 4: Local Deployment and Browser Verification

**Files:**
- Modify: `docs/iterations/0384-provider-owned-slide-app-install/runlog.md`
- Modify: `docs/ITERATIONS.md`

**Checks:**
- `bash scripts/ops/deploy_local.sh`
- `bash scripts/ops/check_runtime_baseline.sh`
- `command -v npx >/dev/null 2>&1`
- `export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"; export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"`
- `"$PWCLI" open http://127.0.0.1:30900/#/workspace --headed`
- `"$PWCLI" snapshot`
- Browser steps: open `工作区管理器`, click provider-owned install for `E2E 颜色生成器`, confirm a new sidebar app appears, open it, click `Generate`, and confirm color changes.
- Save browser evidence under `output/playwright/0384-provider-owned-install/`.
- `node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs`
- `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
- `node scripts/validate_ui_ast_v0x.mjs --case all`
- `npm -C packages/ui-model-demo-frontend run build`
- `git diff --check`
- final sub-agent review

**Expected:** Browser installs provider-owned `E2E 颜色生成器` from Workspace Manager and the installed app changes color via the existing dual-bus runtime path.

**Rollback:** Rebuild/redeploy from the previous dev/main revision and re-sync the previous persisted assets.
