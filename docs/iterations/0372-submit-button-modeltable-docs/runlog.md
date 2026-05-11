---
id: 0372
title: submit-button-modeltable-docs
doc_type: iteration_runlog
status: Completed
updated: 2026-05-11
source: ai
branch: dropx/0372-submit-button-modeltable-docs
iteration_id: 0372-submit-button-modeltable-docs
phase: phase4
---

# Iteration 0372 Submit Button ModelTable Docs Runlog

## Environment

- Date: 2026-05-11
- Branch: `dropx/0372-submit-button-modeltable-docs`
- Runtime: docs/test iteration; no service redeploy required

Review Gate Record
- Iteration ID: 0372-submit-button-modeltable-docs
- Review Date: 2026-05-11
- Review Type: User request
- Review Index: 1/1
- Decision: Approved
- Notes: User requested adding submit-button ModelTable preparation details to the docs.

## Execution Records

### Step 1 - Docs Recipe

- Command: `node -e "const p=require('./test_files/minimal_submit_dual_bus_app_payload.json'); for (const r of p.filter(x=> (x.p===2&&x.r===3&&x.c===0)|| (x.p===0&&x.r===0&&x.c===0 && ['submit_request','submit1','root_routes','submit_request_wiring','handle_submit','remote_bus_endpoint_v1','dual_bus_model'].includes(x.k)))) console.log(JSON.stringify(r));"`
- Key output: confirmed Submit button Cell `(2,3,0)` uses `ui_component=Button`, `click_chain pin.in`, and `ui_bind_json.write.pin=click_chain`; root `(0,0,0)` uses `root_routes`, `submit_request_wiring`, `handle_submit`, `submit1`, `remote_bus_endpoint_v1`, and `dual_bus_model`.
- Change: Added a submit-style button ModelTable recipe to the Markdown guide.
- Change: Added a dedicated "提交按钮" panel to the interactive HTML.
- Result: PASS
- Commit: pending

### Step 2 - Contract Tests And Evidence

- Command: `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
- Key output: `7 passed, 0 failed out of 7`.
- Command: `python3 -m http.server 8765 --directory docs/user-guide/slide-app-runtime`
- Command: `"$PWCLI" open "http://127.0.0.1:8765/minimal_submit_app_provider_interactive.html" --headed`
- Command: `"$PWCLI" click "4. 提交按钮"`
- Key output: Playwright snapshot shows the "Submit 类提交按钮如何准备模型表" panel, button Cell labels, root entry labels, egress labels, status/result labels, effect order, and multi-button naming.
- Artifact: `output/playwright/0372-submit-button-modeltable-docs.png`
- Command: `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
- Key output: `3 passed, 0 failed out of 3`.
- Command: `node scripts/tests/test_0353_slide_app_runtime_docs_publish_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`.
- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS
- Commit: pending

## Docs Updated

- [x] `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md` updated
- [x] `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html` updated
- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed; no change required
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed; no change required
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed; no change required
