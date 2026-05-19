---
title: "0383 - UI Server Matrix Suite Slide App Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0383-ui-server-matrix-suite-slide-app
id: 0383-ui-server-matrix-suite-slide-app
phase: execution
---

# Iteration 0383-ui-server-matrix-suite-slide-app Runlog

## Environment

- Date: 2026-05-19
- Branch: `dropx/dev_0383-ui-server-matrix-suite-slide-app`
- Runtime: local development workspace

## Execution Records

### Step 1

- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0383-ui-server-matrix-suite-slide-app --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output: created 0383 plan/resolution/runlog skeleton.
- Result: PASS
- Commit: pending

### Step 1A

- Command: `git status --short --branch`
- Key output: branch is `dropx/dev_0383-ui-server-matrix-suite-slide-app`; only 0383 docs are initially untracked.
- Result: PASS
- Commit: pending

### Step 1B

- Command: design and iteration docs updated.
- Key output: 0383 plan/resolution/runlog frontmatter filled; `docs/plans/2026-05-19-matrix-suite-slide-app-design.md` added; `docs/ITERATIONS.md` registered.
- Result: pending review
- Commit: pending

## Review Gate Records

Review Gate Record
- Iteration ID: 0383-ui-server-matrix-suite-slide-app
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Review Index: 1
- Decision: Change Requested
- Notes: Sub-agent found direct-cross-model wording risk, weak file-sharing success verification, and pending runlog gate record.

### Review Fix 1

- Command: updated 0383 plan/resolution/design/runlog.
- Key output: Model 0 ingress now explicitly routes through `model.submt` hosting cell; File sharing browser acceptance now requires successful `FileInput` upload and timeline file record.
- Result: pending re-review
- Commit: pending

Review Gate Record
- Iteration ID: 0383-ui-server-matrix-suite-slide-app
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Review Index: 2
- Decision: Approved
- Notes: Design-stage re-review approved with no findings.

### Step 2/3 Implementation

- Command: updated `workspace_positive_models.json`, `runtime_hierarchy_mounts.json`, `model_ids.js`, and added `scripts/tests/test_0383_matrix_suite_slide_app_contract.mjs`.
- Key output: Added built-in model `1080` (`Matrix Suite`), Workspace registry/allowlist entry, Model 0 hosting-cell route, cellwise UI, and program-model actions for send/edit/channel CRUD/media/settings.
- Result: PASS
- Commit: pending

### Step 2/3 Verification

- Command: `node scripts/tests/test_0383_matrix_suite_slide_app_contract.mjs && node scripts/tests/test_0382_workspace_entry_cleanup_contract.mjs && node scripts/validate_ui_ast_v0x.mjs --case all`
- Key output: 0383 contract `4 passed`; 0382 Workspace entry contract PASS; UI AST validator summary PASS.
- Result: PASS
- Commit: pending

Review Gate Record
- Iteration ID: 0383-ui-server-matrix-suite-slide-app
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Review Index: 3
- Decision: Change Requested
- Notes: Sub-agent required channel update support, stronger FileInput path assertions, and real browser evidence.

### Review Fix 2

- Command: updated Matrix Suite model/table labels, Workspace registry derivation, and 0383 contract test.
- Key output: Added `update_channel` UI/program action, strengthened FileInput URI/name assertions, required Model 0 bus routing result, and allowed dynamically installed slide apps to appear without relaxing the built-in Workspace allowlist.
- Result: PASS
- Commit: pending

Review Gate Record
- Iteration ID: 0383-ui-server-matrix-suite-slide-app
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Review Index: 4
- Decision: Change Requested
- Notes: Sub-agent required final browser/runlog evidence, `delete_channel(room_id)` behavior, FileInput pending URI/name coverage, and design pin wording alignment.

### Review Fix 3

- Command: updated program model, 0383 contract test, and design/runlog wording.
- Key output: `delete_channel` now honors payload `room_id`; FileInput contract checks `pending_file_uri` and `pending_file_name`; design uses `matrix_suite_request` consistently.
- Result: PASS
- Commit: pending

### Step 4 Verification

- Command: `node scripts/tests/test_0383_matrix_suite_slide_app_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0382_workspace_entry_cleanup_contract.mjs`
- Key output: Workspace entry cleanup contract PASS.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`
- Key output: `4 passed, 0 failed out of 4`.
- Result: PASS
- Commit: pending

- Command: `node scripts/tests/test_0364_system_refill_contract.mjs`
- Key output: `6 passed, 0 failed out of 6`.
- Result: PASS
- Commit: pending

- Command: `node scripts/validate_ui_ast_v0x.mjs --case all`
- Key output: validator summary PASS.
- Result: PASS
- Commit: pending

- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output: Vite production build PASS; only existing large-chunk warning.
- Result: PASS
- Commit: pending

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS
- Commit: pending

### Step 5 Local Deployment

- Command: `docker build -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`
- Key output: built `dy-ui-server:v1`.
- Result: PASS
- Commit: pending

- Command: `LOCAL_PERSISTED_ASSET_ROOT=/Users/drop/dongyu/volume/persist/assets bash scripts/ops/sync_local_persisted_assets.sh && kubectl -n dongyu rollout restart deployment/ui-server && kubectl -n dongyu rollout status deployment/ui-server --timeout=120s`
- Key output: persisted assets synced; `ui-server` successfully rolled out.
- Result: PASS
- Commit: pending

- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: all local deployments ready; no terminating pods; `mbr-worker-secret` and `ui-server-secret` Matrix room values match; baseline ready.
- Result: PASS
- Commit: pending

### Step 5 Browser Verification

- Command: Playwright headed browser at `http://127.0.0.1:30900/#/workspace`.
- Key output: `Matrix Suite` appears in Workspace and opens as a cellwise slide app.
- Result: PASS
- Commit: pending

- Command: Playwright Matrix Suite flow using visible controls.
- Key output: created and renamed a room; sent text; edited last sent message; triggered Voice, Video conferencing, and Screen sharing; uploaded `/tmp/dy-0383-matrix-suite-upload-final3.txt` through `FileInput`; clicked Share file and saw `File shared: dy-0383-matrix-suite-upload-final3.txt`; saved settings; triggered Password maintenance; deleted the active room.
- Result: PASS
- Commit: pending

- Command: Playwright Matrix Suite 1v1 flow.
- Key output: created `Browser DM 0383` through `New 1v1` and deleted it through `Delete active`.
- Result: PASS
- Commit: pending

- Command: Playwright E2E color generator regression.
- Key output: opened `E2E 颜色生成器`; `current_app=100`; clicked `Generate Color`; color changed from `#FFFFFF` to `#63e60f`; status included `processed`.
- Result: PASS
- Commit: pending

### Browser-discovered Fixes

- Issue: flow shell showed stale `current_app=1080` when opening the color generator after Matrix Suite.
- Fix: flow shell display now uses the selected Workspace app over stale scene context for projection-only metadata.
- Verification: 0383 contract test `flow_shell_selected_app_projection` PASS; browser shows `current_app=100`.
- Result: PASS

- Issue: `Screen` button was visible but overlapped by the inspector panel in a narrow workspace viewport.
- Fix: Matrix Suite composer now uses `ui_wrap=true`, a smaller input minimum width, and a wider shell minimum width.
- Verification: Playwright ordinary click on `Screen` succeeded and produced `Screen sharing started`.
- Result: PASS

## Review Gate Records

Review Gate Record
- Iteration ID: 0383-ui-server-matrix-suite-slide-app
- Review Date: 2026-05-19
- Review Type: AI-assisted sub-agent
- Review Index: 5
- Decision: Approved
- Notes: Final review approved with no findings, no open questions, and no verification gaps.
