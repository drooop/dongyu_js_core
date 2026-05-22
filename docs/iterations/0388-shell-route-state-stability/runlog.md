---
title: "0388 Shell Route State Stability Runlog"
doc_type: iteration_runlog
status: completed
updated: 2026-05-20
source: codex
---

# 0388 Runlog

## Stage 0388.1 Planning

- Registered 0388 plan, resolution, and runlog.
- Initial observed browser state:
  - Root opened with a persisted foreground app.
  - Clicking `桌面` returned to the Android tablet desktop and remained there for the observed wait.
  - Clicking the desktop `E2E 颜色生成器` card changed the foreground shell title to model `100`, but embedded workspace content still showed the previously selected app. This confirms foreground and workspace selected app can diverge.

## Reviews

- 0388.1 planning review: `019e455d-2d04-7a71-b3b4-f2392c1abec2` returned `CHANGE_REQUESTED`.
- Fixes applied:
  - Moved 0388 planning docs back to `review` until a review gate approves them.
  - Switched to dedicated branch `dropx/dev_0388-shell-route-state-stability`.
  - Added Stage 0388.6 final review and closure details to the resolution.
- 0388.1 re-review: pending.
- 0388.1 re-review: `019e455f-a178-7643-9706-9e985c5b9bfc` returned `APPROVED`.

## Stage 0388.2 Failing Tests

- Added `scripts/tests/test_0388_shell_route_state_stability.mjs`.
- CWD: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Command:
  - `node scripts/tests/test_0388_shell_route_state_stability.mjs`
- Current result before implementation:
  - `test_server_persists_editor_state_label_update`: PASS.
  - `test_remote_store_posts_ui_local_state_to_bus_event_endpoint`: FAIL because the remote store posts shell UI-local state to nonexistent `/ui_event`.
  - `test_pending_shell_state_survives_stale_snapshot`: FAIL because a stale SSE snapshot can overwrite the just-clicked foreground app.
  - `test_foreground_workspace_click_updates_selected_workspace_model_locally`: FAIL because launching workspace app model `100` leaves `ws_app_selected` at stale model `1082`.
  - Summary: `1 passed, 3 failed out of 4`.
- 0388.2 review: `019e4562-d8a4-7a72-9f62-e44e6d8859ad` returned `CHANGE_REQUESTED`.
- Fix applied:
  - Added the failing command and three failure causes to this runlog.
- 0388.2 re-review: pending.
- 0388.2 re-review: `019e4564-8b17-7e71-bb3d-0d476587f729` returned `CHANGE_REQUESTED`.
- Fix applied:
  - Added explicit command CWD for reproducibility.
- 0388.2 second re-review: pending.
- 0388.2 second re-review: `019e4565-bf99-7b52-9c1f-21165ad8b2bb` returned `APPROVED`.

## Stage 0388.3 UI-Local State Sync Fix

- CWD: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Changes:
  - Remote shell-local state now syncs through `/bus_event`; the nonexistent `/ui_event` route is no longer used.
  - Pending shell-local state is overlaid onto incoming snapshots until the server returns the same committed value.
  - Foreground workspace app launches now also update local `ws_app_selected` and `selected_model_id` immediately.
  - Updated the 0374 remote-store regression to expect `/bus_event`.
- Verification:
  - `node --check packages/ui-model-demo-frontend/src/remote_store.js`: PASS.
  - `node scripts/tests/test_0388_shell_route_state_stability.mjs`: `4 passed, 0 failed out of 4`.
  - `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`: `13 passed, 0 failed out of 13`.
  - `node scripts/tests/test_0201_route_local_ast_contract.mjs`: `5 passed, 0 failed out of 5`.
  - `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`: `11 passed, 0 failed out of 11`.
- 0388.3 review: pending.
- 0388.3 review: `019e4569-7558-74d0-b5cf-f5f3394cb468` returned `CHANGE_REQUESTED`.
- Review finding fixed:
  - Added a regression for the window after `/bus_event` success but before a confirming snapshot.
  - Kept pending shell-local state until an incoming snapshot actually contains the committed value.
- Recheck:
  - `node scripts/tests/test_0388_shell_route_state_stability.mjs`: `5 passed, 0 failed out of 5`.
  - `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`: `13 passed, 0 failed out of 13`.
  - `node --check packages/ui-model-demo-frontend/src/remote_store.js`: PASS.
- 0388.3 re-review: pending.
- 0388.3 re-review: `019e456b-e322-7fd2-be40-4c6f6b5d07bf` returned `APPROVED`.

## Stage 0388.4 Atomic Shell Transition

- CWD: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Added a regression requiring:
  - Workspace selection sync must not defer stale values through `queueMicrotask`.
  - Task activation must write foreground state before changing hash route.
- Initial result:
  - `node scripts/tests/test_0388_shell_route_state_stability.mjs`: failed on deferred workspace selection.
- Fixes:
  - Removed deferred workspace selection microtask from `syncWorkspaceSelection`.
  - Reordered `activateDesktopTask` so foreground state and related shell state are written before hash navigation.
- Verification:
  - `node scripts/tests/test_0388_shell_route_state_stability.mjs`: `6 passed, 0 failed out of 6`.
  - `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`: `13 passed, 0 failed out of 13`.
  - `node --check packages/ui-model-demo-frontend/src/demo_app.js`: PASS.
- 0388.4 review: `019e456e-bfd7-7be0-8373-ecd52917cef7` returned `APPROVED`.

## Stage 0388.5 Local Deploy And Browser Verification

- CWD: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Local deploy:
  - `docker build -t dy-ui-server:v1 -f k8s/Dockerfile.ui-server-prebuilt .`: PASS.
  - `kubectl -n dongyu rollout restart deployment/ui-server && kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`: PASS.
  - `kubectl -n dongyu get pods -l app=ui-server -o wide`: pod `ui-server-5ffdfb59ff-qgxcd` is `Running`, `Ready 1/1`.
  - `curl -sS http://127.0.0.1:30900/`: returned the built frontend HTML.
  - `curl -sS http://127.0.0.1:30900/snapshot`: returned the live snapshot JSON.
- Real browser verification with Playwright against `http://127.0.0.1:30900/#/`:
  - Opened the Android tablet desktop successfully.
  - Clicked desktop `E2E 颜色生成器`; after a wait, the foreground shell stayed on `E2E 颜色生成器 / Workspace app · model 100`.
  - The embedded workspace content also showed the `E2E 颜色生成器` app and `Current App 100`; it no longer displayed the stale previously selected app.
  - Filled `route stable 0388`, clicked `Generate Color`, and verified the color changed from `#FFFFFF` to `#a37de4` with status `processed`.
  - Clicked `桌面`, waited, and verified the shell remained on the Android tablet desktop instead of jumping back into the app.
  - Re-entered `E2E 颜色生成器`, opened `任务`, and verified the task switcher stayed over the active app.
  - `playwright console warning`: `Errors: 0, Warnings: 0`.
- Artifact:
  - `output/playwright/0388-shell-route-state-stability/browser-stage-0388-5.png`.
- 0388.5 review: `019e4577-7f84-7a12-b442-10f96b6f05f4` returned `APPROVED`.

## Stage 0388.6 Final Verification And Review

- CWD: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Deterministic verification:
  - `node scripts/tests/test_0388_shell_route_state_stability.mjs`: `6 passed, 0 failed out of 6`.
  - `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`: `13 passed, 0 failed out of 13`.
  - `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`: `11 passed, 0 failed out of 11`.
  - `node scripts/validate_ui_ast_v0x.mjs --case all`: `summary: PASS`.
  - `npm -C packages/ui-model-demo-frontend run build`: PASS with the existing Vite chunk-size warning.
  - `git diff --check`: PASS.
- Final review: `019e4579-43f1-7de3-a17e-0aecc803a771` returned `APPROVED`.
