---
title: "0387 - Android Tablet OS Shell MVP Plan"
doc_type: iteration-plan
status: approved
updated: 2026-05-20
source: codex
iteration_id: 0387-android-tablet-os-shell-mvp
phase: approved
---

# Iteration 0387-android-tablet-os-shell-mvp Plan

## Goal

- Implement the first Android tablet-like OS shell MVP on top of the existing 0374 desktop baseline.
- Make launchable surfaces feel like apps on a tablet: status bar, dock, Navigation Rail, app grid, widgets, Quick Settings, foreground window frame, task switcher, and split-pane-ready layout.
- Keep implementation fill-table / UI-model-first: system UI is expressed through cellwise UI records and renderer primitives.

## Scope

- In scope:
- Add first-class UI components for OS shell areas when existing `Container` / `Button` / `Card` are too generic.
- Rework `desktop_catalog_ui.json` to use the new components and richer layout.
- Rework foreground player and task switcher frame to visually match the shell and expose split-pane structure.
- Add `slide_app_summary` labels to the current workspace slide apps and propagate summaries into `ws_apps_registry`.
- Display app summaries on generated desktop app cards.
- Keep icons optional; MVP can use generated text/initial visual marks.
- Update user-facing docs for new app metadata and shell behavior.
- Verify with automated tests, frontend build, local deploy, and real browser interaction.
- Out of scope:
- Full redesign of all individual slide apps.
- True background rendering of multiple live apps.
- Drag/drop freeform windowing.
- Real Android system integration.
- Adding MUI / Quasar dependencies.
- Changing Matrix, MBR, MQTT, Model 0, or business pin behavior.

## Invariants / Constraints

- 0387 cannot start until 0386 contract review is approved.
- Business actions still run inside each app through the existing program model / pin / bus path.
- The shell can update negative UI state such as foreground app and task stack; it must not write app business truth directly.
- New UI model records must be granular: shell areas, cards, app entries, and controls are separate nodes.
- Existing routes remain usable.
- Each small stage and each big stage requires sub-agent code review and fixes before continuing.

## Big Stages

- Big Stage A: UI model component foundation.
- Big Stage B: desktop and app metadata implementation.
- Big Stage C: foreground / task / split-pane shell implementation.
- Big Stage D: docs, local deployment, real browser verification, final review.

## Small Stages

- 0387.1: Add renderer/registry support for shell components and automated component tests.
- 0387.2: Add slide app summary metadata and registry propagation.
- 0387.3: Rebuild desktop UI model into Android tablet shell layout.
- 0387.4: Upgrade foreground app player, task switcher, Quick Settings, and split-pane visual frame.
- 0387.5: Update user docs and run deterministic tests/build.
- 0387.6: Deploy locally and verify with a real browser: desktop launch, app open/return, task switcher, Quick Settings, split-pane shell, and color generator behavior.
- 0387.7: Big-stage/final sub-agent review, fix findings, and close iteration.

## Success Criteria

- The root page renders an Android tablet-style shell, not the old flat launcher.
- The shell visibly contains status bar, dock/taskbar, Navigation Rail, desktop grid, widget area, Quick Settings affordance/panel, and a split-pane-ready foreground frame.
- Desktop slide apps show both name and `slide_app_summary`.
- Current approved workspace apps are still launchable.
- At least E2E 颜色生成器 opens from the shell and passes a real browser Generate Color smoke check.
- ModelTable editor remains reachable as a shell app.
- Automated tests pass:
- `node scripts/tests/test_0386_android_tablet_os_shell_contract.mjs`
- Existing desktop contract test.
- Relevant UI AST validation.
- Frontend build.
- Browser evidence is recorded in 0387 runlog.
- Sub-agent review passes after every small stage and final stage.

## Inputs

- Created at: 2026-05-20
- Iteration ID: 0387-android-tablet-os-shell-mvp
- Branch: `dropx/dev_0386-0387-android-tablet-os-shell`
- Depends on: `0386-android-tablet-os-shell-contract`
