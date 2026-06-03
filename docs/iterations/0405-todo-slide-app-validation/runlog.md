---
title: "Iteration 0405 To Do Slide App Validation Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-06-03
source: ai
iteration_id: 0405-todo-slide-app-validation
id: 0405-todo-slide-app-validation
phase: phase3
---

# Iteration 0405 To Do Slide App Validation Runlog

## Environment

- Date: 2026-06-03
- Branch: `dropx/dev_0405-todo-slide-app-validation`
- Runtime: local Kubernetes / UI Server `http://127.0.0.1:30900`
- Notes:
  - Existing unrelated dirty worktree entries were left untouched.
  - User requested plan first, sub-agent review, then implementation with sub-agent review after each stage.

## Review Gate Records

```text
Review Gate Record
- Iteration ID: 0405-todo-slide-app-validation
- Review Date: 2026-06-03
- Review Type: User
- Reviewer: User direct request
- Review Index: 1
- Decision: Approved
- Notes: User requested this To Do slide app implementation and authorized execution after plan review.
```

## Execution Records

### Stage 0 — Plan Review Gate

- Layer / placement check: planning documents now require To Do model `1086` to be a positive built-in app mounted under Model 0.
- Data ownership check: planning documents now require canonical task truth in app-owned `tasks_json`; frontend overlays are temporary only.
- Event path check: planning documents now require `UI component -> formal UI event -> Model 0 mounted app ingress -> app root pin -> app program model -> tasks_json`.
- Command:
  - `git diff --check -- docs/ITERATIONS.md docs/iterations/0405-todo-slide-app-validation/plan.md docs/iterations/0405-todo-slide-app-validation/resolution.md docs/iterations/0405-todo-slide-app-validation/runlog.md`
  - sub-agent review with `codex-code-review`
- Key output:
  - First sub-agent review decision: `CHANGE_REQUESTED`; required adding Model 0 mount/routing scope and fixing iteration stage count.
  - Second sub-agent review decision: `APPROVED`; findings none.
- Result: PASS
- Commit: none

### Stage 1 — Input Overlay Submit Contract

- Layer / placement check: frontend overlay remains temporary projection state; canonical draft labels still commit through `/bus_event`.
- Data ownership check: `on_submit` overlays only flush to their configured ModelTable label target before the formal pin event.
- Event path check: pin submit order is now overlay commit first, formal pin event second.
- Command:
  - `node scripts/tests/test_0405_todo_submit_overlay_contract.mjs`
  - `node scripts/tests/test_0305_positive_input_deferred_contract.mjs`
- Key output:
  - `PASS test_0405_todo_submit_overlay_contract`
  - `PASS test_0305_positive_input_deferred_contract`
  - First Stage 1 sub-agent review decision: `CHANGE_REQUESTED`; `bus_event_v2` submit path also needed overlay flush coverage.
  - Added `bus_event_v2` coverage and updated flush logic; both tests still pass.
  - Second Stage 1 sub-agent review decision: `APPROVED`; findings none.
- Result: PASS
- Commit: none

### Stage 2 — To Do UI Components

- Layer / placement check: `TodoBoard` and `TodoFocusList` are UI projection components registered in `cellwise.ui.v1`; they are not task-state owners.
- Data ownership check: components read `tasks_json` through label refs and dispatch temporary ModelTable event records for actions.
- Event path check: component actions emit configured `bus_event_v2` / pin-compatible targets; direct mutation of task arrays is not used.
- Command:
  - `node scripts/tests/test_0405_todo_components_contract.mjs`
  - `node -e "require('./packages/ui-renderer/src/renderer.js'); console.log('PASS renderer_cjs_load')"`
  - `npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - `PASS test_0405_todo_components_contract`
  - `PASS renderer_cjs_load`
  - `✓ built in 3.00s`
  - Stage 2 sub-agent review decision: `APPROVED`; noted that component test covers `bus_event_v2` dispatch, while pin-path coverage should be proven in Stage 3 model route tests.
- Result: PASS
- Commit: none

### Stage 3 — Built-In To Do Slide App Model

- Command:
  - `node scripts/tests/test_0405_todo_slide_app_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - `[PASS] workspace_entry_mount_and_route_contract`
  - `[PASS] cellwise_ui_fragmentation_and_sync_policy`
  - `[PASS] program_actions_route_and_update_tasks_json`
  - `summary: PASS`
  - `✓ built in 2.87s`
  - Stage 3 sub-agent review decision: `APPROVED`; findings none.
- Result: PASS
- Commit: none

### Stage 4 — Local Deploy And Browser Verification

- Command:
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `DY_PW_SESSION=dy-0400 bash scripts/ops/playwright_session_guard.sh cleanup`
  - Playwright browser opened `http://127.0.0.1:30900/#/workspace`
  - Playwright interactions: open To Do Board, create task, edit task, move status, switch focus view, filter unfinished tasks, drag card between columns.
  - `DY_PW_SESSION=dy-0400 bash scripts/ops/playwright_session_guard.sh check-clean`
- Key output:
  - Local deploy complete; UI Server: `http://localhost:30900`.
  - Baseline check: `baseline ready`.
  - Workspace list includes `To Do Board`.
  - Board view shows four columns: `还未开始`, `正在进行`, `已完成`, `已归档`.
  - Fast input + immediate save created `Playwright 即刻提交任务` with the submitted body text.
  - Edit dialog round-trip changed it to `Playwright 编辑后的任务` and moved it to `正在进行`.
  - Card action moved it to `已完成`; focus view excluded completed / archived tasks.
  - Focus filter `实现` showed only the matching unfinished item.
  - Drag/drop moved `验证 UI 模型文档` from `还未开始` to `正在进行`.
  - Browser console errors: 0.
  - Screenshot: `output/playwright/0405-todo-slide-app-validation/todo-board-after-e2e.png`.
  - Playwright cleanup: `PASS: no project Playwright session or project Playwright-managed browser process remains for dy-0400`.
  - Stage 4 sub-agent review decision: `APPROVED`; findings none.
- Result: PASS
- Commit: none

### Stage 5 — Final Review And Completion

- Command:
  - `node scripts/tests/test_0405_todo_submit_overlay_contract.mjs`
  - `node scripts/tests/test_0405_todo_components_contract.mjs`
  - `node scripts/tests/test_0405_todo_slide_app_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `git diff --check`
- Key output:
  - `PASS test_0405_todo_submit_overlay_contract`
  - `PASS test_0405_todo_components_contract`
  - `3 passed, 0 failed out of 3`
  - `summary: PASS`
  - `✓ built in 2.85s`
  - `baseline ready`
  - `git diff --check` produced no errors.
  - First final sub-agent review decision: `CHANGE_REQUESTED`; required living docs review and avoiding premature `Completed` status.
  - Second final sub-agent review decision: `CHANGE_REQUESTED`; required fixing a stale runlog line that still claimed `Completed`.
  - Third final sub-agent review decision: `APPROVED`; findings none.
  - `docs/ITERATIONS.md` status changed to `Completed`.
- Result: PASS
- Commit: none

## Docs Review

- `docs/ssot/runtime_semantics_modeltable_driven.md`: reviewed. `0405` added built-in positive app `Model 1086` using existing `workspace.page`; updated the current built-in landing point list. No new `slide_surface_type`, label type, or pin semantics were introduced.
- `docs/user-guide/modeltable_user_guide.md`: reviewed and updated. Added `Model 1086 To Do Board` to the Workspace slide app built-ins and desktop app entry list.
- `docs/ssot/label_type_registry.md`: reviewed. No update required; `0405` uses existing `model.table`, `model.submt`, `pin.in`, `pin.connect.label`, `pin.connect.cell`, `func.js`, `json`, `str`, `bool`, and existing `cellwise.ui.v1` labels.
- `docs/ssot/tier_boundary_and_conformance_testing.md`: reviewed. No update required; `0405` runlog and tests explicitly record Tier placement, model placement, data ownership, data flow, and data chain.
- `docs/ssot/execution_governance_ultrawork_doit.md`: reviewed. No update required; review gates and evidence were recorded in this runlog.
- `docs/handover/dam-worker-guide.md`: reviewed for mandatory living docs scope. No update required; `0405` does not change DAM worker guidance, bus topic rules, or provider ZIP semantics.
