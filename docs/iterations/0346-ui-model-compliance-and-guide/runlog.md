---
title: "0346 — UI Model Compliance And Guide Run Log"
doc_type: iteration-runlog
status: completed
updated: 2026-04-27
source: ai
iteration_id: 0346-ui-model-compliance-and-guide
id: 0346-ui-model-compliance-and-guide
phase: completed
---

# Iteration 0346-ui-model-compliance-and-guide Runlog

## Environment

- Date: 2026-04-27
- Branch: `dev_0346-ui-model-compliance-and-guide`
- Base: `origin/dev` after pushing 0342-0345.
- Review Gate Record:
- Iteration ID: 0346-ui-model-compliance-and-guide
- Review Date: 2026-04-27
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: User explicitly requested execution, per-interface sub-agent review, and final completion report.

## Pre-Execution Records

### Remote Sync

- Command: `git push origin dev main`
- Key output:
  - `dev -> dev` updated from `a8214b3` to `a90c4f7`.
  - `main -> main` updated from `05fc446` to `bb6e045`.
- Result: PASS

## Execution Records

### Step 1

- Status: completed
- Scope:
  - Added deterministic UI compliance audit for visible route/workspace/login/gallery/docs surfaces.
  - Converted active page catalog entries from `page_asset_v0` references to `cellwise_model`.
  - Split common `ui_props_json` text/layout/label props into dedicated cellwise labels across visible UI patches.
  - Repaired broken Workspace/Home containment and replaced Docs raw `Html` with `Markdown`.
  - Added cellwise surfaces for Login, Model 1, Model 2, Leave Request, and Repair Request.
- Commands:
  - `node scripts/audit_ui_model_compliance.mjs`
  - `node scripts/tests/test_0346_ui_model_compliance_contract.mjs`
  - `node scripts/tests/test_0191a_page_asset_resolver.mjs`
  - `node -c packages/ui-renderer/src/renderer.mjs`
  - `node -c packages/ui-model-demo-server/server.mjs`
- Key output:
  - `Summary: 25 visible surfaces, 0 violations, 6 warnings`
  - `test_0346_ui_model_compliance_contract: PASS (25 visible surfaces, 6 warnings)`
  - `7 passed, 0 failed out of 7`
- Result: PASS

### Step 2

- Status: completed
- Scope:
  - Added dedicated `sliding_flow_shell_ui.json` cellwise catalog for the Sliding Flow Shell.
  - Removed hardcoded Sliding Flow Shell component AST from route projection; frontend now inserts the selected app into a model-defined slot.
  - Removed Gallery `page_asset_v0` fallback.
  - Updated stale Home/Static/Matrix Debug tests from legacy `page_asset_v0` expectations to `cellwise_model` expectations.
- Commands:
  - `node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
  - `node scripts/tests/test_0217_gallery_extension_contract.mjs`
  - `node scripts/tests/test_0191d_home_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_static_asset_resolution.mjs`
  - `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `node scripts/tests/test_0191c_prompt_asset_resolution.mjs`
- Key output:
  - `8 passed, 0 failed out of 8`
  - `6 passed, 0 failed out of 6`
  - `1 passed, 0 failed out of 1`
  - `4 passed, 0 failed out of 4`
- Follow-up:
  - Sub-agent review `019dcaf9-58f5-7ce0-b0d9-78c5101f621d` found stale Prompt asset resolution coverage.
  - Prompt UI patch loading is now idempotent in local demo mode, and Prompt asset resolution test passes with `cellwise_model`.
  - Sub-agent review `019dcafd-2e9e-7443-8137-e29a9a8757ce` found stale persisted nav catalog and resolver legacy contract coverage.
  - Local demo now refreshes nav catalog on startup, the resolver rejects legacy `schema_model` / `model_label` assets by default, and Prompt coverage includes stale `page_asset_v0` catalog upgrade.
- Result: PASS

### Step 3

- Status: completed
- Scope:
  - Confirmed business demo and Workspace tool surfaces are covered by cellwise UI audit.
  - Preserved Model 100 color generator pin-chain behavior and input-draft flow.
- Commands:
  - `node scripts/tests/test_0333_model100_cellwise_contract.mjs`
  - `node scripts/tests/test_0306_model100_pin_chain_contract.mjs`
  - `node scripts/tests/test_0177_model100_submit_ui_contract.mjs`
  - `node scripts/tests/test_0177_model100_input_draft_contract.mjs`
  - `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
- Key output:
  - `6 passed, 0 failed out of 6`
  - `3 passed, 0 failed out of 3`
  - `PASS test_0177_model100_submit_ui_contract`
  - `PASS test_0177_model100_input_draft_contract`
  - `4 passed, 0 failed out of 4`
- Result: PASS

### Step 4

- Status: completed
- Scope:
  - Confirmed Matrix Debug and Mgmt Bus Console remain model-authored and do not add direct Matrix send or direct business-state writes.
  - Kept Model -100 formal surface on cellwise component cells.
- Commands:
  - `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
  - `node scripts/audit_ui_model_compliance.mjs`
- Key output:
  - `4 passed, 0 failed out of 4`
  - `Summary: 27 visible surfaces, 0 violations, 6 warnings`
- Result: PASS

### Step 5

- Status: completed
- Scope:
  - Rewrote developer-facing UI model authoring guide.
  - Added model-authored UI guide page (`Model 1037`) with Markdown/code/diagram source-preview sections.
  - Added Markdown renderer contract and clarified Mermaid support as source preview.
- Commands:
  - `node scripts/tests/test_0346_markdown_renderer_contract.mjs`
  - `node scripts/tests/test_0346_ui_model_compliance_contract.mjs`
  - `node scripts/tests/test_0266_scoped_patch_docs_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `npm -C packages/ui-model-demo-frontend run test`
- Key output:
  - `test_0346_markdown_renderer_contract: PASS`
  - `test_0346_ui_model_compliance_contract: PASS (27 visible surfaces, 6 warnings)`
  - `4 passed, 0 failed out of 4`
  - `✓ built in 2.80s`
  - `editor_v1_static_upload_binding_persisted: PASS`
- Result: PASS

### Step 6

- Status: completed
- Commands:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `node --check packages/ui-model-demo-server/server.mjs`
  - `LOCAL_PERSISTED_ASSET_ROOT=/Users/drop/dongyu/volume/persist/assets bash scripts/ops/sync_local_persisted_assets.sh`
  - `docker build -f k8s/Dockerfile.ui-server -t dy-ui-server:v1 .`
  - `kubectl -n dongyu rollout restart deployment/ui-server`
  - `kubectl -n dongyu rollout status deployment/ui-server --timeout=120s`
  - `curl -i -sS http://127.0.0.1:30900/favicon.ico`
  - `curl -sS -X POST http://127.0.0.1:30900/api/runtime/mode -H 'content-type: application/json' --data '{"mode":"running"}'`
  - `UI_SERVER_URL=http://127.0.0.1:30900 WINDOW_MS=8000 node scripts/tests/test_0145_workspace_single_submit.mjs`
  - `playwright-cli -s=0346-final open http://127.0.0.1:30900/#/workspace --headed`
  - `playwright-cli -s=0346-final run-code <workspace UI e2e script>`
  - `playwright-cli -s=0346-final console error`
- Key output:
  - `node --check packages/ui-model-demo-server/server.mjs` PASS.
  - Frontend production build completed in the UI server Docker build.
  - `deployment "ui-server" successfully rolled out`.
  - One old `ui-server` pod remained in Terminating after rollout; it was already deleted by Kubernetes and was force-cleaned to restore baseline.
  - `[check] baseline ready`
  - `HTTP/1.1 204 No Content` for `/favicon.ico`.
  - `{"ok":true,"mode":"running"}`.
  - `test_0145_workspace_single_submit`: `initial_color=#95c317`, `final_color=#a79514`, `change_count=1`.
  - Browser Color Generator: `input=color-1777229527311`, `before=#181bef`, `after=#ed37c9`, `changed=true`.
  - Browser Mgmt Bus Console: sent `0346-final-1777229532450` to `@mbr:localhost`; transcript contained `ack from @mbr:localhost: 0346-final-1777229532450`.
  - Browser page checks:
    - Gallery contained `Wave D: New UI Components`.
    - `0284 Matrix Chat Phase 2` contained `Open Echo DM`.
    - `滑动 APP 导入` contained `上传一个 zip`.
    - `滑动 APP 创建` contained `创建 Slide App`.
    - `UI 模型开发者手册` contained `Quick Start`.
  - Browser console check: `Errors: 0, Warnings: 0`.
  - Screenshots:
    - `output/playwright/0346-final-color-generator.png`
    - `output/playwright/0346-final-mgmt-bus-console.png`
    - `output/playwright/0346-final-ui-guide.png`
- Result: PASS

## Review Records

- Step 1 review: spawned sub-agent `019dcad8-afa4-7393-8a23-296912423625` with `codex-code-review`; findings were addressed in the audit/model changes.
- Step 2 review: spawned sub-agent `019dcaf5-99c7-7752-ae44-93b0683863c8` with `codex-code-review`; decision `CHANGE_REQUESTED`; stale tests and runlog gaps addressed.
- Step 2 follow-up review: spawned sub-agent `019dcaf9-58f5-7ce0-b0d9-78c5101f621d` with `codex-code-review`; decision `CHANGE_REQUESTED`; stale Prompt test and local patch loading gap addressed.
- Step 2 second follow-up review: spawned sub-agent `019dcafd-2e9e-7443-8137-e29a9a8757ce` with `codex-code-review`; decision `CHANGE_REQUESTED`; stale persisted nav catalog and resolver legacy contract gaps addressed.
- Step 5/6 review: spawned sub-agent `019dcb05-3ca3-7741-84c3-68b5335a0f77` with `codex-code-review`; decision `CHANGE_REQUESTED`; browser evidence gap addressed.
- Step 6 follow-up review: spawned sub-agent `019dcb11-2928-79a2-94a0-3dbfbe4e7ff4` with `codex-code-review`; decision `CHANGE_REQUESTED`; Workspace legacy scalar payload paths and stale tests addressed.
- Step 6 second follow-up review: spawned sub-agent `019dcb16-74f1-7db0-a71f-34752673b262` with `codex-code-review`; decision `CHANGE_REQUESTED`; Add App payload and audit/test gaps addressed.
- Step 6 third follow-up review: spawned sub-agent `019dcb19-8b9a-71f3-b99a-ea59a3aa23b4` with `codex-code-review`; decision `APPROVED`; no findings and no verification gaps.
- Final review: spawned sub-agent `019dcb23-de21-79d0-9950-32999a0551d4` with `codex-code-review`; decision `APPROVED`; no findings, no open questions, and no verification gaps.
