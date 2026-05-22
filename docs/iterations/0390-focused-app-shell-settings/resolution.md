---
title: "0390 Focused App Shell Settings Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-05-21
source: codex
iteration_id: 0390-focused-app-shell-settings
phase: execution
---

# Iteration 0390 Focused App Shell Settings Resolution

## Execution Strategy

- Work in small stages with review gates.
- Start by making the target behavior executable through tests.
- Keep shell frame behavior model-driven; use host insertion only for the selected app content surface.
- Prefer extending shared UI model components over one-off frontend branches.
- Keep Settings as a normal built-in slide app entry so it can later grow like other apps.
- Treat ModelTable CRUD the same way: a built-in slide app that can call UI Server-owned program models, not a privileged permanent sidebar.
- Make desktop simplification a first-class deliverable, not a visual cleanup afterthought.

## Big Phase 1: Contract And Test Surface

### Stage 1.1: Contract Freeze

- Scope:
- Register the iteration, freeze this plan/resolution, and record current constraints including the new desktop simplification requirements.
- Files:
- `docs/ITERATIONS.md`
- `docs/iterations/0390-focused-app-shell-settings/plan.md`
- `docs/iterations/0390-focused-app-shell-settings/resolution.md`
- `docs/iterations/0390-focused-app-shell-settings/runlog.md`
- Verification:
- Iteration index contains 0390.
- Plan, resolution, and runlog exist.
- Acceptance:
- No implementation files are changed in this stage.
- Review:
- Phase 2 requires at least 3 independent reviews. The Review Gate is approved only after the latest 3 review decisions are all `Approved` and all earlier `Change Requested` items are fixed and recorded in `runlog.md`.

### Stage 1.2: Deterministic Contract Tests

- Scope:
- Add tests that fail against the old behavior and define the new shell contract.
- Cover focused foreground mode, no outer viewport scrolling, hidden app drawer, Settings as a built-in app, ModelTable CRUD as a built-in app, simplified Dock, app grouping/source metadata, and Drawer/Dialog component availability.
- Files:
- `scripts/tests/test_0390_focused_app_shell_settings_contract.mjs`
- Existing shell/desktop tests as needed.
- Verification:
- New test must prove the old always-visible `App Window` side panel, any inline Settings expand/collapse behavior, duplicate quick info card, `today`/`Shell Contract`/`Workspace` sections, and all desktop side navigation are no longer accepted.
- New test must assert Dock contains only `Home`, `Tasks`, and `MB`; Dock must not contain `Docs`.
- New test must assert `Docs` appears in the slide app list.
- New test must assert the desktop has no Quick Settings card/panel in the root desktop surface.
- New test must assert slid-in apps always show source DE or an explicit `source unknown` abnormal state.
- Acceptance:
- Test suite describes the desired behavior without relying on screenshots.
- Review:
- Sub-agent review required.

## Big Phase 2: Shared UI Model Capabilities

### Stage 2.1: Drawer And Dialog Component Support

- Scope:
- Ensure Drawer and Dialog can be authored from UI model records and rendered through both renderer builds.
- Ensure child composition, open/close binding, title, placement/width, and close events are covered.
- Files:
- `packages/ui-renderer/src/component_registry_v1.json`
- `packages/ui-renderer/src/renderer.mjs`
- `packages/ui-renderer/src/renderer.js`
- `docs/user-guide/ui_components_v2.md`
- Verification:
- New contract test.
- Existing renderer parity checks.
- Acceptance:
- Drawer/Dialog are reusable UI model components, not shell-only special cases.
- Review:
- Sub-agent review required.

### Stage 2.2: Full-Screen Shell Layout Guard

- Scope:
- Add a shared shell/root layout rule that occupies the browser viewport and prevents outer horizontal/vertical page scrolling.
- Ensure this is applied to desktop and foreground app states rather than patched per app.
- Files:
- `packages/ui-model-demo-frontend/src/demo_app.js`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- Frontend style entry if required by current structure.
- Verification:
- New 0390 contract test.
- Browser later checks `document.scrollingElement` dimensions against the viewport.
- Acceptance:
- Normal desktop and foreground app pages do not scroll at the outer page level.
- Review:
- Sub-agent review required.

## Big Phase 3: Desktop And Foreground Shell Refactor

### Stage 3.1: Focused Foreground App Shell

- Scope:
- Replace the foreground split-pane layout with a focused app display.
- Move the old `App Window` auxiliary content into a Drawer that is hidden by default.
- Keep desktop/task/home navigation stable and prevent route bounce.
- Files:
- `packages/ui-model-demo-frontend/src/demo_app.js`
- `packages/ui-model-demo-frontend/src/desktop_app_state.js`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- Related tests.
- Verification:
- New 0390 test.
- Existing 0388 route stability test.
- Browser later confirms actual behavior.
- Acceptance:
- Foreground app page no longer shows sidebars or right panel by default.
- Review:
- Sub-agent review required.

### Stage 3.2: Desktop Launcher Simplification

- Scope:
- Remove desktop side navigation entirely, including any MT-specific sidebar or Navigation Rail.
- Move ModelTable CRUD into the built-in slide app list with normal launch/task behavior.
- Remove the screenshot quick information card and the `today`, `Shell Contract`, `Workspace`, and redundant `APP` sections.
- Keep the desktop focused on the slide app list.
- Files:
- `packages/worker-base/system-models/desktop_catalog_ui.json`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- `packages/ui-model-demo-frontend/src/demo_app.js`
- Related tests.
- Verification:
- New 0390 contract test.
- Existing 0374 desktop contract test updated if its old expectations conflict.
- Acceptance:
- Desktop shows the app list directly with no removed sections.
- Review:
- Sub-agent review required.

### Stage 3.3: Dock Semantics

- Scope:
- Simplify Dock to `Home`, `Tasks`, and `MB`.
- Route `MB` to the existing Matrix Suite app as a placeholder for the future Matrix/Element-like management bus app.
- Ensure `Docs` is available through the slide app list.
- Files:
- `packages/worker-base/system-models/desktop_catalog_ui.json`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Related tests.
- Verification:
- New 0390 contract test.
- Browser later opens `MB` and confirms Matrix Suite appears.
- Acceptance:
- Dock no longer duplicates the removed quick info card and no longer owns Docs as a special shortcut.
- Review:
- Sub-agent review required.

### Stage 3.4: App List Grouping And Source Metadata

- Scope:
- Split app list presentation into built-in apps and slid-in apps.
- Display source DE metadata for every slid-in app.
- Define missing-source behavior as visible `source unknown` or equivalent explicit abnormal state, not silent omission.
- Files:
- `packages/worker-base/system-models/desktop_catalog_ui.json`
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- `packages/ui-model-demo-server/server.mjs`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- `docs/user-guide/modeltable_user_guide.md`
- Related tests.
- Verification:
- New 0390 contract test.
- Existing slide app registry tests.
- Acceptance:
- Built-in and slid-in app groups render separately, and every slid-in app shows either its source DE or an explicit `source unknown` abnormal state.
- Review:
- Sub-agent review required.

## Big Phase 4: Built-In Slide Apps

### Stage 4.1: Built-In Settings Slide App

- Scope:
- Add a UI Server built-in Settings app model and desktop/catalog entry.
- Change the shell Settings action so it opens the Settings app rather than toggling an inline panel.
- Remove the desktop Quick Settings card/panel from this shell. If a future Quick Settings surface is needed, it must be introduced by a separate requirement and must not reuse the removed desktop card behavior.
- Files:
- `packages/worker-base/system-models/workspace_positive_models.json`
- `packages/worker-base/system-models/desktop_catalog_ui.json`
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- `packages/ui-model-demo-server/server.mjs`
- `docs/user-guide/modeltable_user_guide.md`
- Verification:
- New 0390 test.
- Desktop catalog contract tests.
- Acceptance:
- Settings appears and behaves like a launchable built-in slide app.
- Review:
- Sub-agent review required.

### Stage 4.2: Built-In ModelTable CRUD Slide App

- Scope:
- Add or expose the ModelTable CRUD interface as a UI Server built-in slide app.
- Implement the MT surface through UI model records and UI Server-owned program models, keeping it functionally equivalent to the current MT capability while giving it the same launch/open/task behavior as other slide apps.
- Remove its dependency on a permanent desktop sidebar entry.
- Files:
- `packages/worker-base/system-models/workspace_positive_models.json`
- `packages/worker-base/system-models/desktop_catalog_ui.json`
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- `packages/ui-model-demo-server/server.mjs`
- `docs/user-guide/modeltable_user_guide.md`
- Related tests.
- Verification:
- New 0390 contract test.
- Existing CRUD/server flow tests that cover the current MT behavior.
- Browser later opens MT from the app list and performs a safe CRUD round trip: create a temporary label/record, read it back, update it, then delete it or otherwise revert it through the app.
- Acceptance:
- MT is a normal built-in slide app and no longer a special desktop sidebar page; its browser evidence proves create/read/update/delete access through the new app surface.
- Review:
- Sub-agent review required.

## Big Phase 5: Verification, Docs, And Closure

### Stage 5.1: Documentation Update

- Scope:
- Update user-facing docs for the new desktop structure, built-in vs slid-in app list, source DE metadata, Drawer/Dialog, Settings app, and MT app.
- Files:
- `docs/user-guide/modeltable_user_guide.md`
- `docs/user-guide/ui_components_v2.md`
- Verification:
- Docs mention the current behavior and avoid references to removed desktop sections as active UI.
- Acceptance:
- A developer/user can understand where Docs, Settings, MT, and slid-in apps appear.
- Review:
- Sub-agent review required.

### Stage 5.2: Local Deploy And Real Browser Verification

- Scope:
- Build/redeploy the affected local UI Server stack.
- Use a real browser to verify full-screen desktop, no outer scrolling, simplified Dock, no desktop Quick Settings card/panel, `Docs` absent from Dock, `Docs` present in the slide app list, app grouping/source metadata, focused app mode, Drawer, Dialog example, Settings app launch, MT app launch, Matrix Suite through `MB`, route stability, and E2E color generator.
- Files:
- `docs/iterations/0390-focused-app-shell-settings/runlog.md`
- `output/playwright/0390-focused-app-shell-settings/`
- Verification:
- `npm -C packages/ui-model-demo-frontend run build`
- Local deploy/restart commands recorded in runlog.
- Browser at `http://127.0.0.1:30900/#/`.
- Acceptance:
- Browser evidence proves the user-facing contract.
- Review:
- Sub-agent review required.

### Stage 5.3: Final Review And Closure

- Scope:
- Run final review over the whole 0390 change set.

## Big Phase 6: Install Feedback And Launcher Density Supplement

### Stage 6.1: Install Completion Dialog Contract

- Scope:
- Add deterministic tests for a Workspace Manager provider-install response that must write UI-model Dialog state: open flag, title, body text, target app payload, and two actions: open installed app / stay on desktop.
- Files:
- `scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
- `scripts/tests/test_0390_focused_app_shell_settings_contract.mjs`
- `packages/worker-base/system-models/workspace_positive_models.json`
- Verification:
- Provider response test proves the successful response writes Dialog labels and a valid target app payload.
- 0390 contract test proves the Dialog is authored as `Dialog`/`Text`/`Button` UI model records, not a hard-coded frontend alert.
- Acceptance:
- The install completion prompt is model-driven and can open the newly installed app.

### Stage 6.2: Desktop Registry Refresh After Install

- Scope:
- Ensure successful install refreshes the workspace app registry and emits a snapshot update so the desktop list includes the installed app without reload.
- Files:
- `packages/ui-model-demo-server/server.mjs`
- `scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
- Verification:
- Test asserts `ws_apps_registry` contains the newly installed root model after the provider response is handled.
- Browser later verifies the new app appears on the desktop after returning home.
- Acceptance:
- New installed apps are visible in the desktop app list immediately after install.

### Stage 6.3: Compact Cards And List View

- Scope:
- Add desktop app view-mode state, UI-model view switch controls, compact card styling, and list rendering.
- Files:
- `packages/ui-model-demo-frontend/src/desktop_app_state.js`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- `packages/ui-renderer/src/renderer.mjs`
- `packages/ui-renderer/src/renderer.js`
- `packages/worker-base/system-models/desktop_catalog_ui.json`
- `scripts/tests/test_0390_focused_app_shell_settings_contract.mjs`
- Verification:
- Test proves card/list controls exist as UI model records and route through local state.
- Test proves list mode projects app entries with list display metadata.
- Test proves compact cards render source/built-in badges as compact metadata.
- Browser later toggles between card and list view.
- Acceptance:
- Desktop is denser, and users can switch between compact cards and list view.

### Stage 6.4: Local Deploy And Browser Re-Test

- Scope:
- Rebuild/redeploy local UI Server and verify the supplemental behavior in a real browser.
- Files:
- `docs/iterations/0390-focused-app-shell-settings/runlog.md`
- `output/playwright/0390-focused-app-shell-settings/`
- Verification:
- Deterministic tests pass.
- Frontend build passes.
- Browser verifies install success Dialog, open installed app action, return-home list refresh, card/list switch, and compact card layout.
- Acceptance:
- The supplemental user feedback is confirmed against the deployed local service.
- Fix findings and re-review until approved.
- Update iteration status and runlog.
- Verification:
- Deterministic tests, frontend build, local deployment, and browser evidence are all recorded.
- Acceptance:
- 0390 is ready for commit/merge if requested.
