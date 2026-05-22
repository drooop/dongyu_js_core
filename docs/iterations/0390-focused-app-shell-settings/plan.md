---
title: "0390 Focused App Shell Settings"
doc_type: iteration_plan
status: approved
updated: 2026-05-21
source: codex
---

# 0390 Focused App Shell Settings

## Goal

Refine the Android tablet shell into a cleaner full-screen app launcher and focused app environment: foreground slide apps receive the full display area, desktop chrome is reduced to essential navigation, auxiliary panels move behind explicit drawers, Dialog becomes a first-class UI model component, Settings becomes a built-in UI Server slide app, and ModelTable CRUD is treated as a slide app rather than a separate sidebar page.

## User-Facing Contract

- Opening a slide app enters focused app mode.
- Focused app mode must not show the desktop asset tree, desktop sidebars, or any always-visible `App Window` side panel.
- App-level auxiliary information may exist, but it must be hidden by default and opened explicitly through a Drawer-like interaction.
- Dialog must be usable from UI model records as a reusable component, not a hard-coded page special case.
- Settings must be represented as a UI Server built-in slide app written through UI model records and launched like other built-in apps.
- The old inline Settings expand/collapse panel must be removed. The Settings entry must only open the Settings built-in slide app.
- Desktop side navigation must be removed entirely. ModelTable CRUD must be reachable only through the slide app list and normal app launch flow.
- The shell must occupy the full browser viewport; the outer page must not scroll horizontally or vertically in normal desktop and foreground app states.
- The desktop Dock must be simplified to `Home`, `Tasks`, and `MB`. `MB` is a placeholder entry backed by the current Matrix Suite app until the future Element/Matrix-like management bus app is implemented.
- `Docs` must be available from the slide app list, not as a special Dock-only shortcut.
- The slide app list must distinguish built-in apps from apps installed/slid in from another DE.
- Every app slid in from another DE must display its source DE in the list. If source metadata is missing, the UI must show an explicit abnormal state such as `source unknown`; missing metadata must not be silently ignored.
- The desktop quick information card shown in the screenshot must be removed because it duplicates the simplified Dock.
- The desktop should not show the current `today`, `Shell Contract`, or `Workspace` sections.
- The app list does not need an `APP` label; it should directly present the available slide apps.
- Installing a slide app from Workspace Manager must show a UI-model `Dialog` after success. The dialog must say the install is complete and offer to open the newly installed app.
- After an install succeeds and the user returns to the desktop, the desktop slide app list must include the newly installed app without requiring a page reload.
- The desktop launcher must provide both compact card view and list view. Users must be able to switch between the two views through UI-model controls.
- App cards should be visually tighter than the first 0390 version. Built-in/source badges should be compact and positioned like metadata, not consume a full text row.

## Constraints

- UI remains a ModelTable projection; the shell must not become a separate truth source.
- Settings App state and shell-local UI state may live in negative/system UI models, but user-visible app metadata must be represented as ModelTable labels.
- ModelTable CRUD must be represented as a built-in slide app model written through UI model records and backed by UI Server-owned program models. It must not remain a standalone sidebar-only page or a non-model wrapper around the old page.
- Built-in/slid-in grouping and source DE display must come from model labels or registry records, not from hard-coded title matching.
- The focused app shell may use host-owned content insertion only for embedding the selected app surface; surrounding frame and controls should still be model-driven.
- Drawer and Dialog must be expressed through the shared UI renderer/component registry so future slide apps can use the same primitives.
- No compatibility fallback: if the new component contract is invalid, fail visibly rather than silently rendering an old side panel or old inline Settings.
- Full-screen behavior must be enforced at the shell/root layout level, not by hiding overflow inside individual app components only.
- Local deployment and real browser verification are required before completion.
- Each implementation stage and final result must be reviewed by a sub-agent using `codex-code-review`.

## Scope

- Foreground app shell layout and route state in the UI Server frontend.
- Desktop shell cleanup: remove all desktop side navigation, remove the duplicated quick settings/info card, remove `today`, `Shell Contract`, and `Workspace` sections.
- Dock cleanup: keep only `Home`, `Tasks`, and `MB`, with `MB` opening the current Matrix Suite app.
- Slide app list grouping: built-in apps vs apps slid in from another DE, including source DE metadata display.
- UI model component support and documentation for Drawer/Dialog.
- New UI Server built-in slide apps for Settings and ModelTable CRUD.
- Deterministic tests for focused app mode, full-screen non-scroll behavior, hidden app drawer, Dialog/Drawer registry support, Settings app launch, ModelTable CRUD app launch, Dock cleanup, and app grouping metadata.
- Local deployed browser verification for desktop, foreground app, drawer, dialog example, Settings app, ModelTable CRUD app, Matrix Suite via `MB`, and E2E color generator.
- Supplemental browser verification for Workspace Manager install success dialog, direct open from that dialog, desktop list refresh after install, and card/list view switching.

## Out of Scope

- Redesigning every existing slide app for the new tablet style.
- Implementing deep Settings business functions beyond a first usable built-in Settings app shell.
- Expanding ModelTable CRUD beyond the existing basic create/read/update/delete capability. This iteration must move the existing capability into a real built-in slide app, but it does not need to add new CRUD business features.
- Implementing the future `MB` management bus chat app; `MB` routes to the current Matrix Suite placeholder for now.
- Cloud deployment, branch merge, or push unless requested separately.
- Reworking Matrix Suite real communication capabilities.

## Big Phases

### Phase A: Shell Information Architecture Contract

- Freeze the new shell hierarchy: full-screen root, simplified Dock, no duplicate quick information card, no `today`/`Shell Contract`/`Workspace` sections.
- Define how built-in apps and slid-in apps are represented in the app list.
- Define required source metadata for slid-in apps.
- Define ModelTable CRUD and Settings as built-in slide apps.

### Phase B: UI Model Capability Contract

- Ensure Drawer is the standard hidden auxiliary surface for app/window details.
- Ensure Dialog is a reusable UI model component for details and confirmations.
- Define full-screen shell layout constraints and no-scroll acceptance.

### Phase C: Implementation Plan

- Add failing tests first.
- Implement reusable component support.
- Refactor desktop and foreground shell.
- Add Settings and ModelTable CRUD built-in slide app models.
- Update documentation and user-guide wording.

### Phase D: Verification And Review

- Run deterministic tests and frontend build.
- Redeploy local UI Server.
- Use a real browser to verify root desktop, app launch, Drawer/Dialog, Settings, ModelTable CRUD, Matrix Suite via `MB`, and E2E color generation.
- Run sub-agent review at each stage and final review before closure.

## Acceptance Criteria

- Foreground slide apps use a focused display: no asset tree, no desktop sidebars, and no always-visible right `App Window` panel.
- The app auxiliary panel is hidden by default and can be opened through a Drawer component.
- Dialog and Drawer are both available through UI model records and documented with model-label usage.
- Settings appears as a built-in slide app in the desktop/app catalog and opens like other apps.
- ModelTable CRUD appears as a built-in slide app in the app list and opens like other apps.
- The old inline Settings expand/collapse behavior is removed. The Settings entry must open the Settings built-in slide app, and no inline Settings expand/collapse entry or visible inline Settings state may remain.
- The root desktop and foreground app pages do not allow outer horizontal or vertical scrolling at the browser viewport level.
- Desktop side navigation is removed entirely, including any MT-specific sidebar or Navigation Rail; MT is only reachable through the slide app list and normal app launch flow.
- Dock contains only `Home`, `Tasks`, and `MB`.
- `MB` opens the current Matrix Suite app as the temporary MB implementation.
- `Docs` is visible in the slide app list.
- Built-in apps and slid-in apps are visually separated in the slide app list.
- Slid-in apps always show source DE metadata; missing source metadata is rendered as an explicit abnormal state and covered by tests.
- The desktop no longer shows the screenshot quick information card, `today`, `Shell Contract`, `Workspace`, or a redundant `APP` heading.
- Dock does not contain `Docs`, and the slide app list does contain `Docs`.
- `E2E 颜色生成器` still opens and generates a new color after local deployment.
- Browser verification confirms no route bounce when opening desktop apps, returning to desktop, opening Drawer, opening Settings, opening ModelTable CRUD, and opening Matrix Suite through `MB`.
- Workspace Manager install shows an install-complete Dialog authored in UI model records, and the Dialog's `打开` action launches the new installed app.
- Returning to the desktop after a successful install shows the new app in the slid-in app list without a browser reload.
- Desktop app list supports compact card view and list view switching through UI-model controls.
- Card view uses tighter cards and displays built-in/source badges in a compact metadata position.

## Done Criteria

- Iteration docs are registered and reviewed.
- Deterministic tests pass.
- Frontend build passes.
- Local stack is redeployed or restarted for affected services.
- Real browser test at `http://127.0.0.1:30900/#/` passes the acceptance criteria.
- Final sub-agent code review returns approved or all findings are fixed and re-reviewed.
