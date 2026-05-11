---
id: 0371
title: minimal-submit-install-docs
doc_type: iteration_runlog
status: Completed
updated: 2026-05-11
source: ai
branch: dropx/0371-minimal-submit-install-docs
iteration_id: 0371-minimal-submit-install-docs
phase: phase4
---

# Iteration 0371 Minimal Submit Install Docs Runlog

## Environment

- Date: 2026-05-11
- Branch: `dropx/0371-minimal-submit-install-docs`
- Runtime: docs/test iteration; no service redeploy required

## Execution Records

### Step 1 - Installer Fact Check

- Command: `rg -n "host_ingress_generated|host_egress_generated|model.submt|slideImportAppFromMxc" packages/ui-model-demo-server packages/worker-base docs/ssot scripts/tests`
- Key output: installer writes `model.submt`, generated host ingress labels, generated host egress labels, and `ui.egress.binding.v1`; export filters generated labels.
- Command: `sed -n '2180,2290p' packages/ui-model-demo-server/server.mjs`
- Key output: `materializeSlideImportPayload()` creates local models, writes install metadata, mounts root into Model 0, then materializes host ingress and host egress adapters.
- Command: `sed -n '60,150p' scripts/tests/test_0364_slide_import_bus_binding_contract.mjs`
- Key output: tests assert `ui_egress_submit1_binding`, `imported_submit1_<id>_bus`, and generated split bus pins.
- Result: PASS
- Commit: pending

### Step 2 - Docs And Tests

- Change: Added "UI Server 安装过程" to Markdown guide, including model materialization, `model.submt` mount, sidebar/catalog behavior, generated host ingress labels, generated host egress labels, and imported root to Model 0 root egress path.
- Change: Added an "安装过程" panel to the interactive HTML with generated label tables.
- Change: Extended `test_0360_minimal_submit_dual_bus_docs_contract.mjs` with `minimal_submit_docs_explain_ui_server_install_materialization`.
- Command: `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
- Key output: `6 passed, 0 failed out of 6`.
- Result: PASS
- Commit: pending

### Step 3 - Browser Render Check

- Command: `python3 -m http.server 8765 --directory docs/user-guide/slide-app-runtime`
- Command: `"$PWCLI" open "http://127.0.0.1:8765/minimal_submit_app_provider_interactive.html" --headed`
- Command: `"$PWCLI" click "5. 安装过程"`
- Key output: Playwright snapshot shows the "zip 进入 UI Server 后如何安装" panel, generated host ingress labels, generated host egress labels, and the imported root to Model 0 root path.
- Artifact: `output/playwright/0371-minimal-submit-install-docs.png`
- Result: PASS
- Commit: pending

## Docs Updated

- [x] `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md` updated
- [x] `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html` updated
- [x] `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` reviewed; no change required
