---
title: "Iteration 0268-home-all-models-filter Run Log"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0268-home-all-models-filter
id: 0268-home-all-models-filter
phase: phase3
---

# Iteration 0268-home-all-models-filter Run Log

## Environment
- OS: macOS
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Branch: `dev_0268-home-all-models-filter`

### Review Gate Records (FACTS)
```text
Review Gate Record
- Iteration ID: 0268-home-all-models-filter
- Review Date: 2026-03-31
- Review Type: User
- Reviewer: user
- Review Index: 1
- Decision: Approved
- Notes: user approved explicit All models mode while keeping existing p/r/c and k|t|v filters.
```

## Step 1 — Add all-models contract
- Start time: 2026-03-31 01:35:00 +0800
- End time: 2026-03-31 01:38:00 +0800
- Branch: `dev_0268-home-all-models-filter`
- Commits:
  - N/A
- Commands executed:
  - `apply_patch scripts/tests/test_0268_home_all_models_contract.mjs`
  - `node scripts/tests/test_0268_home_all_models_contract.mjs`
- Key outputs (snippets):
  - RED:
    - selector had no `All models`
    - rows were empty when `selected_model_id=''`
    - selected text did not report all-models mode
- Result: PASS

## Step 2 — Implement all-models mode
- Start time: 2026-03-31 01:38:00 +0800
- End time: 2026-03-31 01:42:00 +0800
- Branch: `dev_0268-home-all-models-filter`
- Commits:
  - N/A
- Commands executed:
  - `apply_patch packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `apply_patch scripts/tests/test_0268_home_all_models_contract.mjs`
  - `node scripts/tests/test_0268_home_all_models_contract.mjs`
- Key outputs (snippets):
  - `deriveEditorModelOptions()` now prepends `{ label: 'All models', value: '' }`
  - `deriveHomeTableRows()` now iterates every model when `selected_model_id=''`
  - `deriveHomeSelectedLabelText()` now returns `Current target: all models`
  - final GREEN:
    - `editor_model_options_include_all_models` PASS
    - `home_table_rows_expand_to_multiple_models_when_all_selected` PASS
    - `home_selected_label_text_reports_all_models_mode` PASS
- Result: PASS

## Step 3 — Live verify
- Start time: 2026-03-31 01:42:00 +0800
- End time: 2026-03-31 01:50:00 +0800
- Branch: `dev_0268-home-all-models-filter`
- Commits:
  - N/A
- Commands executed:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - Playwright open `http://localhost:30900/#/`
  - Playwright open Home model selector
  - Playwright verify `All models` option exists
  - Playwright select `All models`
- Key outputs (snippets):
  - baseline:
    - `baseline ready`
  - live selector:
    - dropdown contains `All models`
  - live page after select:
    - body text shows `Current target: all models`
    - table simultaneously shows rows from multiple model ids (`0`, `2`, ...)
- Result: PASS
