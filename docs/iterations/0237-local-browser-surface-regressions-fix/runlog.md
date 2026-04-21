---
title: "0237 — local-browser-surface-regressions-fix Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0237-local-browser-surface-regressions-fix
id: 0237-local-browser-surface-regressions-fix
phase: phase3
---

# 0237 — local-browser-surface-regressions-fix Runlog

## Environment

- Date: 2026-03-26
- Branch: `dropx/dev_0237-local-browser-surface-regressions-fix`
- Runtime: local browser regression fix

## Execution Records

### Step 1 — Freeze Dual Regression Contract

- Started: `2026-03-26 05:07:49 +0800`
- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && jq '{matrix_debug, notes}' output/playwright/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/local-home-rerun/report.json`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq '{ui_page: .snapshot.models["-2"].cells["0,0,0"].labels.ui_page.v, ws_app_selected: .snapshot.models["-2"].cells["0,0,0"].labels.ws_app_selected.v, selected_model_id: .snapshot.models["-2"].cells["0,0,0"].labels.selected_model_id.v, editor_options_has_model0: (.snapshot.models["-2"].cells["0,0,0"].labels.editor_model_options_json.v | any(.value == 0)), trace_asset: .snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0.v}'`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq '.snapshot.models["-100"].cells | keys'`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "m\\.id !== 0" packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '1,220p' scripts/ops/sync_local_persisted_assets.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '1,240p' docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md`
- Key output:
  - `0236` browser report remains red:
    - `matrix_debug.surface_marker = null`
    - `matrix_debug.visible = false`
    - `matrix_debug.missing_ui_schema_detected = true`
  - live `/snapshot` remains red:
    - `ui_page = "home"`
    - `ws_app_selected = 1005`
    - `selected_model_id = "1007"`
    - `editor_options_has_model0 = false`
    - `trace_asset = null`
  - live trace model surface is not materialized:
    - `curl ... | jq '.snapshot.models["-100"].cells | keys'` returns only `["0,0,0"]`
    - `Model -100 / 0,1,0 / page_asset_v0` is absent from current live snapshot
  - repo-side green facts still hold:
    - `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs` -> `4 passed, 0 failed out of 4`
    - `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs` -> `validate_matrix_debug_server_sse: PASS`
    - `node scripts/tests/test_0212_home_crud_contract.mjs` -> `4 passed, 0 failed out of 4`
  - Home selector inventory gap is directly explained by current repo code:
    - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js:234` still filters model options with `m.id !== 0`
    - therefore current selector inventory cannot contain `value == 0`
  - Matrix Debug live gap is consistent with current authoritative sync chain drift:
    - current `scripts/ops/sync_local_persisted_assets.sh` no longer externalizes `matrix_debug_surface.json` or `intent_handlers_matrix_debug.json`
    - `0233` runlog already localized the same symptom to `repo asset -> local persisted asset root -> manifest` omission, not route/renderer consumption
- Adjudication:
  - Step 1 required dual freeze is complete:
    - browser evidence red
    - live `/snapshot` red
    - repo-side contract / isolated validator green
  - Home selector failure is within the intended 0237 scope:
    - option inventory omits `model0`
    - current home-state selected value also drifts away from the canonical `model0` baseline
  - Matrix Debug failure is not localized to `server snapshot / frontend projection / renderer consumption` in the current branch:
    - isolated `createServerState({ dbPath: null })` path is green
    - live runtime is missing `Model -100 / 0,1,0 / page_asset_v0`
    - current repo sync script again omits the persisted-asset materialization inputs that `0233` had already identified as authoritative
  - Therefore `0237` hits the Step 1 stop condition:
    - Matrix Debug failure is explained by the persisted-asset / deploy chain
    - Step 2 must not be entered under the current `resolution.md`
    - the Matrix Debug portion requires a follow-up iteration on the authoritative asset sync / materialization path
- Conformance review:
  - tier placement: no Tier 1 runtime semantics were changed; this step is evidence-only
  - model placement: `Model -100` formal surface remains required at `0,1,0/page_asset_v0`; no placement rewrite was attempted
  - data ownership: truth source remains model-defined assets plus authoritative persisted-asset chain; no UI fallback or server-owned AST was introduced
  - data flow / data chain: the confirmed break is on the authoritative asset materialization chain, while the Home selector gap sits in frontend projection code
- Result: PASS (stop condition triggered; execution halted before Step 2)

### Execution Halt

- `0237` was stopped after Step 1 per `resolution.md`.
- Steps 2-4 were not entered because the Matrix Debug portion exceeded the allowed repair boundary for this iteration.

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] `docs/iterations/0236-local-home-browser-evidence-rerun/runlog.md` reviewed

```
Review Gate Record
- Iteration ID: 0237-local-browser-surface-regressions-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 2
- Decision: APPROVED
- Revision Type: N/A
- Notes: # 0237 Plan Review — APPROVED
```

```
Review Gate Record
- Iteration ID: 0237-local-browser-surface-regressions-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 4
- Decision: On Hold
- Revision Type: N/A
- Notes: parse_failure: Could not parse verdict from review output

Review history:
  - Round 2 (REVIEW_PLAN): APPROVED [n/a]
```

```
Review Gate Record
- Iteration ID: 0237-local-browser-surface-regressions-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 5
- Decision: APPROVED
- Revision Type: N/A
- Notes: Manual review-plan acceptance after REVIEW_PLAN parse false negative. 0237 plan/resolution are self-contained, eliminate placeholders, keep scope on server/frontend surface regressions only, and define concrete guards for Matrix Debug browser failure plus Home model0 selector drift.
```

```
Review Gate Record
- Iteration ID: 0237-local-browser-surface-regressions-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: # 0237 Execution Review — Plan (Read-Only Review)
```

```
Review Gate Record
- Iteration ID: 0237-local-browser-surface-regressions-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 3
- Decision: On Hold
- Revision Type: N/A
- Notes: parse_failure: Could not parse verdict from review output

Review history:
  - Round 2 (REVIEW_PLAN): APPROVED [n/a]
  - Round 5 (REVIEW_PLAN): APPROVED [n/a]
  - Round 1 (REVIEW_EXEC): APPROVED [n/a]
```
