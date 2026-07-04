---
title: "Iteration 0434 Slide App Subtable First Migration Runlog"
doc_type: iteration-runlog
status: planned
updated: 2026-07-03
source: ai
iteration_id: 0434-slide-app-subtable-first-migration
id: 0434-slide-app-subtable-first-migration
phase: phase3
---

# Iteration 0434-slide-app-subtable-first-migration Runlog

## Environment

- Date: 2026-07-03
- Branch: `dropx/dev_0434-slide-app-subtable-first-migration`
- Runtime: local UI Server, fake login allowed only for local test when `DY_DEV_FAKE_LOGIN=1`

Review Gate Record
- Iteration ID: 0434-slide-app-subtable-first-migration
- Review Date: 2026-07-03
- Review Type: AI-assisted
- Review Index: 1
- Decision: Change Requested
- Notes: Sub-agent review required explicit retirement/update of old `host|100` workspace contracts and stricter `model.subtableconnection` success criteria.

Review Gate Record
- Iteration ID: 0434-slide-app-subtable-first-migration
- Review Date: 2026-07-03
- Review Type: AI-assisted
- Review Index: 2
- Decision: Approved
- Notes: Sub-agent re-review approved the updated plan with no findings.

Review Gate Record
- Iteration ID: 0434-slide-app-subtable-first-migration
- Review Date: 2026-07-03
- Review Type: AI-assisted
- Review Index: 3
- Decision: Change Requested
- Notes: Sub-agent implementation review found that the first seed pass incorrectly used a shared owner, ran before persistence was enabled, and left a `host|100` frontend fallback.

Review Gate Record
- Iteration ID: 0434-slide-app-subtable-first-migration
- Review Date: 2026-07-03
- Review Type: AI-assisted
- Review Index: 4
- Decision: Approved
- Notes: Sub-agent re-review found no findings after owner-scoped seeding, persistence-idempotency verification, and frontend fallback removal. Verification gap remains Step 3 local deployment and real browser verification.

Review Gate Record
- Iteration ID: 0434-slide-app-subtable-first-migration
- Review Date: 2026-07-03
- Review Type: AI-assisted
- Review Index: 5
- Decision: Approved
- Notes: Sub-agent review approved the RemoteWorker Model 100 subtable reply-target fix after browser testing exposed `pin_payload_invalid` for child app table replies.

Review Gate Record
- Iteration ID: 0434-slide-app-subtable-first-migration
- Review Date: 2026-07-03
- Review Type: AI-assisted
- Review Index: 6
- Decision: Change Requested
- Notes: Sub-agent review requested tightening the renderer `singleFlight` release rule so missing label-backed loading values do not unlock the button early.

Review Gate Record
- Iteration ID: 0434-slide-app-subtable-first-migration
- Review Date: 2026-07-03
- Review Type: AI-assisted
- Review Index: 7
- Decision: Approved
- Notes: Sub-agent re-review approved strict `schemaLoadingRaw === false` release plus the missing-label negative test.

## Execution Records

### Step 1 — Register plan and prove the current failure

- Command:
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0434-slide-app-subtable-first-migration --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - `node scripts/tests/test_0434_first_slid_in_app_subtable_contract.mjs`
- Key output:
  - RED output before implementation: `host_model100_must_not_remain_workspace_app_entry`
- Result: PASS
- Commit:

### Step 2 — Materialize the first slid-in app as an App table

- Command:
  - `node scripts/tests/test_0434_first_slid_in_app_subtable_contract.mjs`
  - `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs`
  - `node scripts/tests/test_0382_workspace_entry_cleanup_contract.mjs`
  - `node scripts/tests/test_0425_slide_app_subtable_install_contract.mjs`
  - `node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs`
  - `node scripts/tests/test_0425_frontend_model_ref_projection_contract.mjs`
  - `node scripts/tests/test_0182_app_shell_route_sync_contract.mjs`
  - `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
  - `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
  - `node scripts/tests/test_0407_current_model_ref_contract.mjs`
  - `node scripts/tests/test_0182_model100_singleflight_release_contract.mjs`
  - `node scripts/tests/test_0329_renderer_opid_uniqueness_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - `test_0434_first_slid_in_app_subtable_contract`: `5 passed, 0 failed`
  - `test_0289_slide_workspace_generalization_server_flow`: `1 passed, 0 failed`
  - `test_0382_workspace_entry_cleanup_contract`: `PASS`
  - `test_0425_slide_app_subtable_install_contract`: `5 passed, 0 failed`
  - `test_0432_subtable_connection_runtime_contract`: `30 passed, 0 failed`
  - `test_0425_frontend_model_ref_projection_contract`: `12 passed, 0 failed`
  - `test_0182_app_shell_route_sync_contract`: `PASS`
  - `test_0386_android_tablet_os_shell_contract`: `11 passed, 0 failed`
  - `test_0384_provider_owned_slide_app_install_flow`: `10 passed, 0 failed`
  - `test_0322_imported_host_egress_server_flow`: `1 passed, 0 failed`
  - `test_0407_current_model_ref_contract`: `8 passed, 0 failed`
  - `test_0182_model100_singleflight_release_contract`: `PASS`
  - `test_0329_renderer_opid_uniqueness_contract`: `PASS`
  - frontend build completed; Vite reported existing large chunk warning only.
- Result: PASS
- Commit:

### Step 3 — Local deployment and browser verification

- Command:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `CODEX_HOME="$HOME/.codex" PWCLI="$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" bash scripts/ops/playwright_session_guard.sh cleanup`
  - `CODEX_HOME="$HOME/.codex" PWCLI="$HOME/.codex/skills/playwright/scripts/playwright_cli.sh" bash scripts/ops/playwright_session_guard.sh session open http://localhost:30900 --headed`
  - Browser actions: click `Fake Drop`, open `Slid in from DE` -> `E2E 颜色生成器`, enter `subtable final browser smoke 0434`, click `Generate Color`.
- Key output:
  - Local deploy completed; pods running:
    - `ui-server-686bcc64fd-jlk6c`
    - `mbr-worker-574956bfd4-7tnmv`
    - `remote-worker-5ff65d99f6-5pz8x`
    - `workspace-manager-545984997b-nvkxd`
  - Browser snapshot/store evidence:
    - `tableIds`: `["app:drop:e2e:2-0-20:1"]`
    - `appTableId`: `app:drop:e2e:2-0-20:1`
    - root `model_type`: `model.subtable`
    - foreground header: `Workspace app · model 0`
  - Browser interaction evidence:
    - color changed from `#e86a9b` to `#b8f57a`
    - `status`: `processed`
    - `submit_inflight`: `false`
    - `Generate Color` button after response: `disabled=false`, class `el-button el-button--primary el-button--large`
  - RemoteWorker log evidence:
    - inbound topic: `UIPUT/ws/dam/pic/de/R1/100/submit`
    - request labels include `origin_table_id=app:drop:e2e:2-0-20:1`, `origin_model_id=0`, `reply_target_table_id=app:drop:e2e:2-0-20:1`, `reply_target_model_id=0`
    - publish topic: `UIPUT/ws/dam/pic/de/U1/1051/result`
    - response labels include `bg_color=#b8f57a`, `status=processed`, `submit_inflight=false`
- Result: PASS
- Commit:

## Docs Updated

- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
