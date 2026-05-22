---
title: "0390 Focused App Shell Settings Runlog"
doc_type: iteration-runlog
status: in_progress
updated: 2026-05-21
source: codex
iteration_id: 0390-focused-app-shell-settings
---

# Iteration 0390 Focused App Shell Settings Runlog

## Environment

- Date: 2026-05-21
- Branch: `dropx/dev_0390-focused-app-shell-settings`
- Starting note: repository already had uncommitted 0386-0389 worktree changes before 0390 was opened. 0390 planning changes are limited to this iteration directory and `docs/ITERATIONS.md`.

## Review Gate Records

Review Gate Record
- Iteration ID: `0390-focused-app-shell-settings`
- Review Date: 2026-05-21
- Review Type: AI-assisted
- Reviewer: `019e4650-a1fc-75c3-a4fe-db99a1a0a3eb`
- Review Index: 1
- Decision: Change Requested
- Scope: 0390 plan/resolution/runlog and `docs/ITERATIONS.md` registry row.
- Notes: Quick Settings loophole, weak slid-in source metadata wording, missing Docs migration browser check, and MT app wrapper ambiguity.

Review Gate Record
- Iteration ID: `0390-focused-app-shell-settings`
- Review Date: 2026-05-21
- Review Type: AI-assisted
- Reviewer: `019e4653-7b62-7983-842d-995681a26af6`
- Review Index: 2
- Decision: Change Requested
- Scope: 0390 plan/resolution/runlog and `docs/ITERATIONS.md` registry row after first fix.
- Notes: Phase 2 must require latest 3 independent Approved reviews; inline Settings must be deleted, not demoted; MT browser verification must cover create/update/delete; review records must follow workflow template.

Review Gate Record
- Iteration ID: `0390-focused-app-shell-settings`
- Review Date: 2026-05-21
- Review Type: AI-assisted
- Reviewer: `019e4655-ccc0-7de0-9cb0-4c2016987b38`
- Review Index: 3
- Decision: Change Requested
- Scope: 0390 plan/resolution/runlog and `docs/ITERATIONS.md` registry row after second fix.
- Notes: Remaining weak wording allowed inline Settings as secondary behavior and MT-specific desktop sidebar as an exception.

Review Gate Record
- Iteration ID: `0390-focused-app-shell-settings`
- Review Date: 2026-05-21
- Review Type: AI-assisted
- Reviewer: `019e4658-0df9-75f3-b28e-d05efa7b1bcc`
- Review Index: 4
- Decision: Approved
- Scope: 0390 plan/resolution/runlog and `docs/ITERATIONS.md` registry row after third fix.
- Notes: No findings, open questions, or verification gaps.

Review Gate Record
- Iteration ID: `0390-focused-app-shell-settings`
- Review Date: 2026-05-21
- Review Type: User
- Reviewer: user
- Review Index: 5
- Decision: Approved
- Scope: 0390 plan/resolution after AI-assisted review cleanup.
- Notes: User explicitly said `Approved、开始实现`.

## Execution Records

### Stage 1 - Contract freeze

- Status: Planned, awaiting review/approval.
- Action:
- Created 0390 planning directory.
- Wrote plan, resolution, and runlog.
- Registered iteration in `docs/ITERATIONS.md`.
- Expanded the plan with the user's additional desktop-shell requirements:
- remove all desktop side navigation and expose MT as a built-in slide app;
- enforce full-screen/no outer-scroll shell behavior;
- simplify Dock to `Home` / `Tasks` / `MB`;
- move `Docs` into the slide app list;
- split app list into built-in and slid-in groups with source DE metadata;
- remove the duplicate quick information card and `today` / `Shell Contract` / `Workspace` / redundant `APP` sections.
- Verification:
- `test -f docs/iterations/0390-focused-app-shell-settings/plan.md && test -f docs/iterations/0390-focused-app-shell-settings/resolution.md && test -f docs/iterations/0390-focused-app-shell-settings/runlog.md && grep -F '0390-focused-app-shell-settings' docs/ITERATIONS.md`
- Result: PASS.
- Review:
- First review: `019e4650-a1fc-75c3-a4fe-db99a1a0a3eb` returned `CHANGE_REQUESTED`.
- Findings fixed:
- Removed the remaining plan loophole that allowed preserving the desktop Quick Settings card/panel.
- Strengthened slid-in app source DE display: every slid-in app must show source DE or an explicit abnormal state.
- Added explicit deterministic and browser verification requirements for `Docs` being removed from Dock and present in the slide app list.
- Clarified that ModelTable CRUD must be a real built-in slide app written through UI model records and backed by UI Server-owned program models, not a non-model wrapper around an old sidebar page.
- Added workflow-compliant Review Gate records.
- Added Phase 2 gate requirement: latest 3 independent reviews must all be `Approved`.
- Tightened Settings wording: old inline Settings expand/collapse behavior must be deleted, not demoted.
- Expanded MT browser verification to require a safe create/read/update/delete round trip through the new MT slide app.
- Third review: `019e4655-ccc0-7de0-9cb0-4c2016987b38` returned `CHANGE_REQUESTED`.
- Findings fixed:
- Removed remaining weak wording that allowed inline Settings as a secondary behavior.
- Replaced weak side-navigation wording with an absolute rule: desktop side navigation is removed entirely, including MT-specific sidebar/Navigation Rail; MT is only reachable through the app list and normal app launch flow.
- Re-review:
- `019e4658-0df9-75f3-b28e-d05efa7b1bcc` returned `APPROVED`.
- User gate: user explicitly approved the plan and asked to start implementation.
- Result: Stage 1 planning documents are review-clean and Phase 3 execution is allowed.

### Stage 1.2 - Deterministic contract tests

- Command: `node scripts/tests/test_0390_focused_app_shell_settings_contract.mjs`
- Initial RED result:
- `1 passed, 6 failed out of 7`.
- RED failures covered missing Drawer tree support, old desktop sidebar/Quick Settings/Dock behavior, missing built-in/slid-in grouping, missing Settings/ModelTable registry entries, and missing foreground shell AST module.
- Review:
- `019e4674-f4f2-7192-8e67-c47ac7765e59` returned `CHANGE_REQUESTED`; fixed host adapter, replaced source regex with executable AST contract, added launchability and missing source tests.
- `019e4678-0c77-7892-a082-4673cfbfca2a` returned `CHANGE_REQUESTED`; added Settings toggle deletion and exact target checks.
- `019e467a-99f1-7401-bdff-a1664ecc40b8` returned `CHANGE_REQUESTED`; added Dialog vnode contract.
- `019e467c-ab01-7aa2-b07f-f6553140a99b` returned `CHANGE_REQUESTED`; added Drawer default-hidden and auxiliary-panel-not-visible contract.
- `019e467e-ecb1-79f3-8509-fcd2b1cb04a7` returned `CHANGE_REQUESTED`; narrowed auxiliary-panel assertion so legal main `AppWindow` remains allowed.
- `019e4681-5ca2-7173-ad3e-a26d0872a3c1` returned `CHANGE_REQUESTED`; relaxed launch target checks to allow extra display metadata and broadened app-heading ban.
- `019e4683-44c9-7ed0-9f3f-69c633019ee9` returned `CHANGE_REQUESTED`; relaxed foreground Settings launch target check.
- `019e4684-9b67-7430-9536-51bcbb3b6339` returned `APPROVED`.
- Result: PASS for Stage 1.2 test quality gate.

### Stage 2-4 - Focused shell, desktop simplification, and built-in apps

- Files changed:
- `packages/ui-renderer/src/renderer.mjs`
- `packages/ui-renderer/src/renderer.js`
- `packages/ui-model-demo-frontend/src/desktop_foreground_shell_ast.js`
- `packages/ui-model-demo-frontend/src/demo_app.js`
- `packages/ui-model-demo-frontend/src/desktop_app_state.js`
- `packages/ui-model-demo-frontend/src/model_ids.js`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- `packages/ui-model-demo-server/server.mjs`
- `packages/worker-base/system-models/workspace_positive_models.json`
- `scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
- `scripts/tests/test_0374_web_tablet_desktop_contract.mjs`
- `scripts/tests/test_0390_focused_app_shell_settings_contract.mjs`
- Verification:
- `node scripts/tests/test_0390_focused_app_shell_settings_contract.mjs`: `7 passed, 0 failed out of 7`.
- `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`: `11 passed, 0 failed out of 11`.
- `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`: `13 passed, 0 failed out of 13`.
- `node scripts/tests/test_0388_shell_route_state_stability.mjs`: `6 passed, 0 failed out of 6`.
- `node scripts/validate_ui_ast_v0x.mjs --case all`: `summary: PASS`.
- `npm -C packages/ui-model-demo-frontend run build`: PASS; existing Vite chunk-size warning remains non-blocking.
- `node --check` for changed JS/MJS files: PASS.

### Stage 5 - Focused app content and control-bus browser fix

- Issue found during real-browser verification:
- Opening `E2E 颜色生成器` no longer showed the old asset-tree shell, but `Generate Color` still remained in `loading` and the color did not change.
- Runtime finding:
- UI Server was still externalizing `pin.bus.cb.out` through the Matrix path in one server-side egress branch, so RemoteWorker did not receive the control-bus request.
- Fixes:
- Render focused workspace apps as the app content itself instead of routing through the old `/workspace` projection shell.
- Publish UI Server `pin.bus.cb.out` through MQTT/control bus using the payload `topic`.
- Keep `pin.bus.mb.out` on the Matrix/management-bus path.
- Include `message_role` in same-`op_id` egress identity so request and response on the same endpoint topic are not deduplicated as one message.
- Verification:
- `node scripts/tests/test_0390_focused_app_shell_settings_contract.mjs`: `9 passed, 0 failed out of 9`.
- `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`: `14 passed, 0 failed out of 14`.
- `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`: `74 passed, 0 failed out of 74`.
- Browser: `http://127.0.0.1:30900/#/` opened the focused `E2E 颜色生成器`; no `资产树`, no `Sliding Flow Shell`, no old `APP` wrapper; clicking `Generate Color` changed color from `#FFFFFF` to `#aba73e` and status from `loading` to `processed`.
- Review:
- Focused app content review `019e46bc-8b40-7511-a441-39e49bff4361`: `APPROVED`.
- First control-bus review `019e46c3-9ef0-7253-a43e-1fc309157599`: `CHANGE_REQUESTED`; fixed same-`op_id` dedupe identity by adding `message_role`.
- Re-review `019e46c6-19ac-7710-9962-a725fd4f4d94`: `APPROVED`.

### Stage 6 - Desktop launcher layout and local deployment proof

- Issue found during browser verification:
- At 1280x720, built-in app cards and the slid-in app section visually overlapped even though the outer document did not scroll.
- Fix:
- Changed the desktop app-list surface to a vertical flow layout with its own scroll area.
- Marked built-in and slid-in sections as non-shrinking so cards keep their real height and the middle surface scrolls internally.
- Verification:
- `node scripts/tests/test_0390_focused_app_shell_settings_contract.mjs`: `9 passed, 0 failed out of 9`.
- `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`: `11 passed, 0 failed out of 11`.
- `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`: `13 passed, 0 failed out of 13`.
- `node scripts/tests/test_0388_shell_route_state_stability.mjs`: `6 passed, 0 failed out of 6`.
- `node scripts/validate_ui_ast_v0x.mjs --case all`: `summary: PASS`.
- `npm -C packages/ui-model-demo-frontend run build`: PASS; existing Vite chunk-size warning remains non-blocking.
- `node --check` for changed server/frontend JS files: PASS.
- Local deployment:
- Rebuilt and restarted `dy-ui-server:v1`.
- `ui-server-c8f9d7496-sztkd` became `Running`.
- `curl http://127.0.0.1:30900/`: HTTP 200.
- Browser desktop evidence: `Built-in`, `Docs`, `Settings`, `ModelTable`, `Slid in from DE`, source-DE badges, and Dock `Home / Tasks / MB` are visible; no old Quick Settings, `today`, `Shell Contract`, `Workspace`, asset tree, or outer document scrolling. App-list sections no longer overlap.

### Stage 7 - Final browser acceptance coverage

- Review finding:
- Final implementation review requested additional browser evidence for Settings, ModelTable CRUD, MB launch, Drawer, and Dialog.
- Browser evidence added:
- Drawer: opened `E2E 颜色生成器`, clicked `详情`, and confirmed the right-side `App Window` drawer shows `id: workspace:100` and `Workspace app · model 100`.
- Settings: opened desktop `Settings`; confirmed it is a focused built-in slide app with `Workspace app · model 1081` and does not show the removed inline `Quick Settings` / `Shell Contract` content.
- MB: clicked Dock `MB`; confirmed it opens `Matrix Suite` as `Workspace app · model 1080`, with the Matrix-style room/message/settings surface visible.
- Dialog: in `ModelTable`, opened row `Detail`; confirmed a modal dialog shows `model 1082 (0,0,0) zz_0390_browser_crud_1779305322971` and the edited value.
- ModelTable CRUD:
- Create: via `+ Add Label`, created temporary label `zz_0390_browser_crud_1779305322971` on model `1082` with value `created by browser 0390`.
- Read: filtered the table by that key and confirmed the row/value were visible.
- Update: clicked row `Edit`, changed the value to `updated by browser 0390`, saved, and confirmed the updated value was visible.
- Delete: clicked row `Delete`, confirmed status `deleted zz_0390_browser_crud_1779305322971 on model 1082`, and verified model `1082` no longer contains that target label.
- Cleanup:
- Cleared the visible ModelTable filter after the CRUD check. Note: the runtime may still retain the last selected key/filter value in editor local-state or trace labels; those are UI/runtime state records, not the deleted target label on model `1082`.

### Stage 6 - Supplemental install feedback and desktop density

- User feedback:
- Workspace Manager install currently lacks a success prompt.
- Returning to the desktop after install may not show the newly installed app in the list without extra refresh.
- Desktop app cards are too loose; the desktop needs a compact card view, a list view, and a view switch.
- Done criteria for this supplement:
- Install success is shown through UI-model Dialog records with an `打开` action.
- Successful install refreshes `ws_apps_registry` and desktop projection without a reload.
- Desktop supports compact cards and list view switching through UI-model controls.
- Local deployed browser verification covers install prompt/open, list refresh, and view switching.
- Fixes:
- Added UI-model Dialog records to the Workspace Manager asset app for install completion, including `稍后` and `打开` actions.
- Added server-side install state labels so provider-owned installs open the dialog, keep the success state idempotent on duplicate provider responses, and refresh the desktop app registry after materialization.
- Re-emitted provider bundle requests as a fresh one-shot bus output by removing the old request label before adding the new one.
- Added compact desktop card rendering, top-right source badges, and a UI-model `卡片` / `列表` switch backed by `desktop_app_view_mode`.
- Ensured `打开` from the install dialog returns the shell to the desktop foreground route before showing the installed app content.
- Cleared stale split-bus error labels after successful egress so old failed responses do not mask the current success state.
- Verification:
- `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`: `4 passed, 0 failed out of 4`.
- `node scripts/tests/test_0390_focused_app_shell_settings_contract.mjs`: `11 passed, 0 failed out of 11`.
- `npm -C packages/ui-model-demo-frontend run build`: PASS; existing Vite chunk-size warning remains non-blocking.
- Local deployment: rebuilt `dy-ui-server:v1`, restarted `deployment/ui-server`, and confirmed `runtime/mode` is `running`.
- Browser install flow: opened Workspace Manager, clicked `E2E 颜色生成器` install, confirmed Dialog `安装完毕` with body `E2E 颜色生成器 已安装为 model 1089。是否现在打开？`, clicked `打开`, and confirmed the installed app opened as `Workspace app · model 1089`.
- Browser app behavior: clicked `Generate Color`; color changed from `#FFFFFF` to `#bd3402` and status became `processed`.
- Browser desktop refresh: returned to desktop and confirmed the newly installed `E2E 颜色生成器` appears in the slid-in app list.
- Browser density/view switch: clicked `列表` and confirmed app entries render as compact horizontal list rows, then clicked `卡片` and confirmed compact card layout with source badges restored.

### Stage 8 - Desktop delete interaction refinement

- User feedback:
- Do not prioritize long-press as the app management gesture for now.
- Use a right-click / context menu interaction first.
- The visible delete button was too heavy; management-mode delete controls should be icon-only.
- Design reference:
- iPadOS-style app removal is treated as a small destructive affordance followed by confirmation.
- Android / Material-style contextual actions are represented as a focused object menu, with destructive work confirmed separately.
- Fixes:
- Changed generated desktop `AppCard` bindings from `longpress` to `contextmenu` for deletable slid-in apps.
- Added a lightweight renderer context menu for right-clicking a deletable app card; the menu contains a delete action and then opens the existing delete confirmation Dialog.
- Restyled management-mode delete controls in both card and list layouts as icon-only red minus badges with accessible labels.
- After review, moved the card-mode delete badge to the top-right corner, shifted the source badge left, and removed the duplicate click handler from the context-menu item so one menu click dispatches one delete request.
- Kept the confirmation and success dialogs backed by `desktop_delete_confirm_*` / `desktop_delete_result_*` UI-model state labels.
- Documented current Workspace Manager discovery truth in `slide_app_runtime_developer_guide.md`: the available install list currently comes from Workspace Manager DEM `asset_catalog_json`; new DEs must publish/index records there until future asset-reporting sync is implemented.
- Verification:
- `node scripts/tests/test_0390_focused_app_shell_settings_contract.mjs`: `15 passed, 0 failed out of 15`; includes DOM-level context-menu tests proving a right-click delete menu dispatches exactly once, outside click closes the menu without deleting, and reopening the menu cleans old listeners before deleting the latest target.
- `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`: `5 passed, 0 failed out of 5`.
- `node --check packages/ui-renderer/src/renderer.mjs && node --check packages/ui-renderer/src/renderer.js && node --check packages/ui-model-demo-frontend/src/route_ui_projection.js`: PASS.
- `npm -C packages/ui-model-demo-frontend run build`: PASS; existing Vite chunk-size warning remains non-blocking.
- Local deployment: rebuilt `dy-ui-server:v1`, synced local persisted assets, restarted `deployment/ui-server`, and confirmed `runtime/mode` is `running`.
- Browser right-click flow: opened desktop, right-clicked a source-unknown slid-in `E2E 颜色生成器` card, confirmed `.dy-app-context-menu` with `− / 删除`, clicked menu item, confirmed Dialog `删除滑动 App？`, clicked `删除`, confirmed success Dialog and slid-in source-unknown app count dropped from `6` to `5`.
- Browser card-management flow: clicked `管理` and verified card-mode delete control is icon-only `−` and positioned at the card's top-right corner.
- Browser list-management flow: switched to `列表` and confirmed list delete controls render as icon-only `−` buttons with `aria-label="删除 E2E 颜色生成器"`.
- Browser context-menu close flow: opened the right-click menu, clicked outside the menu, and confirmed the menu count became `0`; reopened it, pressed `Escape`, and confirmed it also closed.
- Browser context-menu reopen flow on `http://127.0.0.1:30900/`: right-clicked one source-unknown app, then right-clicked a second source-unknown app without selecting the first menu; confirmed there was still only one context menu and clicking its delete action opened `删除滑动 App？`.
