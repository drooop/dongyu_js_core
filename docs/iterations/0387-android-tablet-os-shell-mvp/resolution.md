---
title: "0387 - Android Tablet OS Shell MVP Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-20
source: codex
iteration_id: 0387-android-tablet-os-shell-mvp
phase: completed
---

# Iteration 0387-android-tablet-os-shell-mvp Resolution

## Execution Strategy

- Implement in small review-gated slices.
- Prefer UI model records and renderer primitives over bespoke page code.
- Extend renderer components only for reusable shell primitives that cannot be cleanly represented by generic components.
- Keep all app content ownership unchanged; the OS shell only launches and frames apps.

## Step 1: Shell Component Foundation

- Scope:
- Register and render reusable OS shell components: `StatusBar`, `Taskbar`, `NavigationRail`, `DesktopGrid`, `AppCard`, `WidgetPanel`, `QuickSettingsPanel`, `AppWindow`, `SplitPaneWindow`, and `AppSwitcher`.
- Files:
- `packages/ui-renderer/src/component_registry_v1.json`
- `packages/ui-renderer/src/renderer.mjs`
- `scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
- Verification:
- `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
- Acceptance:
- Component registry and renderer markers pass.
- Review:
- Sub-agent review required.

## Step 2: App Summary Metadata

- Scope:
- Add `slide_app_summary` root labels for current launchable workspace apps.
- Propagate summary into `ws_apps_registry` in local and server stores.
- Files:
- `packages/worker-base/system-models/workspace_positive_models.json`
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- `packages/ui-model-demo-server/server.mjs`
- Verification:
- `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
- Existing desktop contract test.
- Acceptance:
- Every slide-capable workspace entry has a non-empty summary.
- Review:
- Sub-agent review required.

## Step 3: Desktop Shell UI Model

- Scope:
- Rewrite the desktop catalog model into Android tablet OS shell layout using granular UI records.
- Project registry apps as `AppCard` children with name, summary, and launch binding.
- Files:
- `packages/worker-base/system-models/desktop_catalog_ui.json`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- Verification:
- `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
- `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`
- Acceptance:
- Root route contains status bar, dock, Navigation Rail, app grid, widget area, and generated app cards.
- Review:
- Sub-agent review required.

## Step 4: Foreground Window, Quick Settings, Split Pane

- Scope:
- Upgrade foreground player and task switcher frame to OS shell style.
- Add Quick Settings panel state/control and split-pane-ready visual frame.
- Files:
- `packages/ui-model-demo-frontend/src/demo_app.js`
- `packages/ui-model-demo-frontend/src/desktop_app_state.js`
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- `packages/ui-model-demo-frontend/src/remote_store.js`
- Verification:
- Existing desktop contract test plus any new shell state test.
- Acceptance:
- User can open app, return home, open task switcher, close/restore task, and toggle Quick Settings.
- Review:
- Sub-agent review required.

## Step 5: Docs And Deterministic Verification

- Scope:
- Update UI component and ModelTable user docs for shell components and `slide_app_summary`.
- Run deterministic tests and frontend build.
- Files:
- `docs/user-guide/ui_components_v2.md`
- `docs/user-guide/modeltable_user_guide.md`
- `docs/iterations/0387-android-tablet-os-shell-mvp/runlog.md`
- Verification:
- `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
- `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`
- `node scripts/validate_ui_ast_v0x.mjs --case all`
- `npm -C packages/ui-model-demo-frontend run build`
- Acceptance:
- All checks pass or runlog records a narrowly scoped, non-blocking unrelated failure with reason.
- Review:
- Sub-agent review required.

## Step 6: Local Deploy And Browser Verification

- Scope:
- Deploy current branch locally.
- Use a real browser to verify shell rendering and core flows.
- Files:
- `docs/iterations/0387-android-tablet-os-shell-mvp/runlog.md`
- `output/playwright/0387-android-tablet-os-shell-mvp/`
- Verification:
- Local page at `http://127.0.0.1:30900/#/`.
- Open desktop shell.
- Open E2E 颜色生成器, click Generate Color, confirm color changes or processed status updates.
- Open task switcher and Quick Settings.
- Open at least one system app and one workspace slide app.
- Acceptance:
- Browser evidence recorded with screenshot path and result.
- Review:
- Sub-agent review required.

## Step 7: Final Review And Close

- Scope:
- Run final sub-agent review on all 0386/0387 changes.
- Fix findings until approved.
- Update iteration statuses and runlogs.
- Verification:
- `git status --short`
- Final deterministic checks and browser evidence.
- Acceptance:
- 0386 and 0387 are complete and review-approved.
