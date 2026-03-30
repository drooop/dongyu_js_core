---
title: "0240 — local-browser-evidence-rerun-after-0238-0239 Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-03-26
source: ai
iteration_id: 0240-local-browser-evidence-rerun-after-0238-0239
id: 0240-local-browser-evidence-rerun-after-0238-0239
phase: phase3
---

# 0240 — local-browser-evidence-rerun-after-0238-0239 Runlog

## Environment

- Date: 2026-03-26
- Branch: `dropx/dev_0240-local-browser-evidence-rerun-after-0238-0239`
- Runtime: local browser evidence rerun after local follow-ups

## Execution Records

### Step 1 — Fresh Local Deploy On Recovered Mainline

- Branch: `dropx/dev_0240-local-browser-evidence-rerun-after-0238-0239`
- Commands:
  - `git checkout -b dropx/dev_0240-local-browser-evidence-rerun-after-0238-0239`
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `curl -fsS http://127.0.0.1:30900/snapshot | jq -c '{ui_page:(.snapshot.models["-2"].cells["0,0,0"].labels.ui_page.v), selected_model_id:(.snapshot.models["-2"].cells["0,0,0"].labels.selected_model_id.v), has_model0:(.snapshot.models["-2"].cells["0,0,0"].labels.editor_model_options_json.v | any(.value==0)), home_asset:(.snapshot.models["-22"].cells["0,1,0"].labels.page_asset_v0.v.id), matrix_asset:(.snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0.v.id)}'`
- Key output:
  - `baseline ready`
  - `ui_page = "home"`
  - `selected_model_id = "0"`
  - `has_model0 = true`
  - `home_asset = "root_home"`
  - `matrix_asset = "matrix_debug_root"`
- Result: PASS

### Step 2 — Fresh Browser Evidence

- Playwright MCP pages captured:
  - `output/playwright/0240-local-browser-evidence-rerun-after-0238-0239/final-rerun/home.png`
  - `output/playwright/0240-local-browser-evidence-rerun-after-0238-0239/final-rerun/workspace.png`
  - `output/playwright/0240-local-browser-evidence-rerun-after-0238-0239/final-rerun/matrix-debug.png`
  - `output/playwright/0240-local-browser-evidence-rerun-after-0238-0239/final-rerun/prompt.png`
  - `output/playwright/0240-local-browser-evidence-rerun-after-0238-0239/final-rerun/report.json`
- Observed facts:
  - Home:
    - top marker `surface: root_home`
    - title `Home Catalog`
    - selector current value `0 (MT)`
  - Workspace:
    - asset tree contains `Gallery` and `Matrix Debug`
    - current app renders live workspace surface
  - Matrix Debug:
    - title `Matrix Debug`
    - panel title `Matrix Debug Surface`
    - no `no UI schema or AST`
  - Prompt:
    - route reachable
    - prompt textarea and Preview/Apply controls present
- Result: PASS

### Final Adjudication

- Verdict: `Local environment effective`
- Notes:
  - local baseline gate green
  - Home / Workspace / Matrix Debug / Prompt fresh browser evidence all current
  - `0240` is no longer blocked by missing prior fixes or branch lineage drift

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] `docs/iterations/0238-local-matrix-debug-materialization-regression-fix/runlog.md` reviewed
- [x] `docs/iterations/0239-local-home-selector-model0-fix/runlog.md` reviewed
