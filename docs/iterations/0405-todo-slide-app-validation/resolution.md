---
title: "Iteration 0405 To Do Slide App Validation Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-06-03
source: ai
iteration_id: 0405-todo-slide-app-validation
id: 0405-todo-slide-app-validation
phase: phase1
---

# Iteration 0405 To Do Slide App Validation Resolution

## Execution Strategy

Implement the app in small stages. Each implementation stage must finish with deterministic checks and a sub-agent `codex-code-review` review. Any review finding must be fixed and re-reviewed before moving to the next stage.

The immediate technical risk is input synchronization. Before adding the rich UI, first freeze and test that `on_submit` overlays flush before pin-based formal submit events.

## Stage 0 — Plan Review Gate

- Scope: review this plan/resolution before runtime changes.
- Files:
  - `docs/iterations/0405-todo-slide-app-validation/plan.md`
  - `docs/iterations/0405-todo-slide-app-validation/resolution.md`
  - `docs/iterations/0405-todo-slide-app-validation/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `git diff --check -- docs/ITERATIONS.md docs/iterations/0405-todo-slide-app-validation/plan.md docs/iterations/0405-todo-slide-app-validation/resolution.md docs/iterations/0405-todo-slide-app-validation/runlog.md`
  - sub-agent review with `codex-code-review`
- Acceptance:
  - Review decision is `APPROVED`.
  - Runlog records user authorization and AI-assisted plan review.
- Rollback:
  - Remove 0405 row from `docs/ITERATIONS.md`.
  - Remove `docs/iterations/0405-todo-slide-app-validation/`.

## Stage 1 — Input Overlay Submit Contract

- Scope:
  - Ensure `commit_policy: "on_submit"` overlay values flush before pin-based submit events, not only before action-based submit events.
  - Add deterministic test coverage.
- Files:
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `scripts/tests/test_0405_todo_submit_overlay_contract.mjs`
  - `docs/iterations/0405-todo-slide-app-validation/runlog.md`
- Verification:
  - `node scripts/tests/test_0405_todo_submit_overlay_contract.mjs`
  - sub-agent review with `codex-code-review`
- Acceptance:
  - Test proves pin events trigger `on_submit` overlay flush before the formal pin submit request.
  - Existing non-pin behavior remains unchanged.
- Rollback:
  - Revert `remote_store.js` and remove the new test.

## Stage 2 — To Do UI Components

- Scope:
  - Add UI-model-backed dynamic components for repeated task rendering.
  - Components must receive task data via labels and dispatch configured ModelTable events.
  - Keep surrounding layout/dialog/form controls as standard UI model nodes.
- Files:
  - `packages/ui-renderer/src/component_registry_v1.json`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `scripts/tests/test_0405_todo_components_contract.mjs`
  - `docs/iterations/0405-todo-slide-app-validation/runlog.md`
- Verification:
  - `node scripts/tests/test_0405_todo_components_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`
  - sub-agent review with `codex-code-review`
- Acceptance:
  - `TodoBoard` and `TodoFocusList` are registered.
  - Components render from `tasks_json`.
  - Components dispatch task action payloads through configured bindings, not by owning canonical state.
- Rollback:
  - Remove component registry entries, renderer implementations, and tests.

## Stage 3 — Built-In To Do Slide App Model

- Scope:
  - Add built-in model `1086` named `To Do Board`.
  - Define root labels, task seed data, draft labels, pins/functions, and UI nodes.
  - Mount model `1086` under Model 0 with the existing positive built-in app mount pattern.
  - Add app to Workspace allowlist and built-in app list.
  - Ensure formal task actions enter the app through the mounted app request pin before `tasks_json` changes.
- Files:
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/runtime_hierarchy_mounts.json`
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `scripts/tests/test_0405_todo_slide_app_contract.mjs`
  - `docs/iterations/0405-todo-slide-app-validation/runlog.md`
- Verification:
  - `node scripts/tests/test_0405_todo_slide_app_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - sub-agent review with `codex-code-review`
- Acceptance:
  - Workspace registry includes `To Do Board` as a built-in app.
  - Model 0 contains a `model.submt` mount for model `1086`.
  - App uses `cellwise.ui.v1` and has fragmented UI nodes for header, view switch, board, focus list, create dialog, and edit dialog.
  - Task create/edit/status movement updates `tasks_json` through the app root pin and app-owned ModelTable behavior.
  - Contract test records tier placement, model placement, data ownership, formal event path, and data chain.
- Rollback:
  - Remove model `1086`, remove Model 0 mount, remove app id from allowlists, remove tests.

## Stage 4 — Local Deploy And Browser Verification

- Scope:
  - Deploy local stack.
  - Real-browser test full user flow.
  - Capture evidence and clean Playwright sessions.
- Files:
  - `docs/iterations/0405-todo-slide-app-validation/runlog.md`
  - `outputs/playwright/0405-todo-slide-app-validation/` evidence
- Verification:
  - `bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - Real browser opens `http://127.0.0.1:30900/#/workspace`.
  - Browser opens `To Do Board`.
  - Browser creates a task by typing title/body/status and immediately clicking Save.
  - Browser verifies created task appears in the selected column.
  - Browser edits the task and verifies visible values update.
  - Browser moves the task to another status and verifies the column changes.
  - Browser switches to Focus view and verifies unfinished filtering.
  - `bash scripts/ops/playwright_session_guard.sh cleanup`
  - `bash scripts/ops/playwright_session_guard.sh check-clean`
  - sub-agent review with `codex-code-review`
- Acceptance:
  - All browser assertions pass.
  - No project Playwright-managed browser process remains.
- Rollback:
  - Revert Stage 1-3 changes and redeploy previous local version.

## Stage 5 — Final Review And Completion

- Scope:
  - Run final static checks.
  - Review overall diff and verification evidence.
  - Update iteration status if all checks pass.
- Files:
  - All files modified in 0405.
  - `docs/ITERATIONS.md`
  - `docs/iterations/0405-todo-slide-app-validation/runlog.md`
- Verification:
  - `git diff --check`
  - all Stage 1-4 tests/checks repeated where relevant
  - final sub-agent review with `codex-code-review`
- Acceptance:
  - Final review is `APPROVED`.
  - `docs/ITERATIONS.md` status reflects the final 0405 state.
- Rollback:
  - Revert the 0405 diff and restore iteration status.
