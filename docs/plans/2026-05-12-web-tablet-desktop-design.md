---
title: "Web Tablet Desktop Design"
doc_type: design
status: planned
updated: 2026-05-12
source: ai
iteration_id: 0374-web-tablet-desktop
---

# Web Tablet Desktop Design

## Decision

The Web edition should move from route-first navigation to a tablet-like desktop. The first version includes:

- a desktop first screen
- one foreground app at a time
- a task switcher
- pseudo-background restore
- no split view yet

The design must be Tier2 / UI-model-first. The desktop is not a new source of truth; it is a ModelTable-backed system UI surface.

## Product Model

The user opens the Web app and sees app icons, similar to a tablet desktop. The user does not start by choosing `Gallery`, `Docs`, or `Workspace` from top navigation.

Desktop-visible apps include:

- Gallery
- Docs
- ModelTable editor
- Prompt
- Static
- runnable Workspace slide apps

Clicking an app icon opens that app in a single foreground app player. The user can return to the desktop, open another app, or use the task switcher to restore or close an opened app.

## App Definitions And Tasks

The system must distinguish:

- App definition: a launchable thing shown on the desktop.
- Opened task: a remembered app session in the task switcher.
- Foreground app: the single app currently shown.
- Recent app: an app that was opened recently and can be relaunched or restored.

By default, one app definition has one opened task. Multi-instance apps are out of scope until explicitly added.

## Ownership

System UI state belongs to negative system models. This includes:

- desktop app registry projection
- opened apps
- foreground app
- recent apps
- task switcher state
- pseudo-background status

Positive models keep ownership of app/business content. A slide app's UI surface and business labels stay with that positive model.

The Web shell can read and project this state, and can dispatch formal UI events. It cannot become the registry or task state owner.

## UI Model Strategy

The desktop, app player frame, and task switcher should be represented with `cellwise.ui.v1` UI models.

Required surfaces:

- Desktop icon grid
- Recent apps section
- System app icons
- Workspace slide app icons
- Foreground app frame
- Task switcher panel/card list
- Restore and close controls
- Return-to-desktop control

Use existing components if possible: `Container`, `Card`, `Button`, `Icon`, `StatusBadge`, `Drawer`, `Tabs`, `Text`, and related layout labels.

If a required control is not expressible with current UI components, extend component support first:

1. update `component_registry_v1.json`
2. update renderer support
3. add component tests
4. update `docs/user-guide/ui_components_v2.md`
5. only then use the component from UI model patches

## Routing

The old routes stay available as deep links:

- Gallery
- Docs
- Workspace
- Prompt
- Static
- ModelTable/editor route

The visible primary experience changes. The Web root should show the desktop.

The ModelTable editor should not disappear. It becomes a normal desktop app, likely backed by the existing Home/editor surface and a compatibility route such as `/modeltable` if needed by implementation.

## App Player

The first version renders one foreground app.

For system apps, the player renders the corresponding existing page surface.

For Workspace slide apps, the player reuses the existing selected-app and flow-shell projection. The selected app remains ModelTable-owned.

Background app UIs are not rendered. Pseudo-background means the task list keeps enough ModelTable-backed state to restore the app.

## Deferred

The following are not part of the first implementation:

- dual-app split view
- freeform windows
- multi-instance apps
- continuously rendered background app UIs
- mobile-specific layout
- removing old routes

## Review Rule

Every implementation step must end with:

- deterministic verification
- conformance review: Tier, placement, ownership, flow, data chain
- sub-agent `codex-code-review`
- fixes before the next step starts

Before desktop implementation starts, the current `node scripts/tests/test_0311_pin_projection_contract.mjs` failure must be classified:

- If related to 0374, fix it before adding the desktop UI model.
- If unrelated, record the exclusion reason, impact boundary, owner, and follow-up iteration in the runlog.
