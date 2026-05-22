---
title: "0386 - Android Tablet OS Shell Contract Plan"
doc_type: iteration-plan
status: approved
updated: 2026-05-20
source: codex
iteration_id: 0386-android-tablet-os-shell-contract
phase: approved
---

# Iteration 0386-android-tablet-os-shell-contract Plan

## Goal

- Freeze the contract for upgrading the existing Web Tablet Desktop into an Android tablet-like OS shell.
- Keep the shell ModelTable / cellwise-first: the visible shell must be expressed by UI model records and small renderer primitives, not by a coarse HTML blob or a third-party app shell.
- Add reusable slide app metadata so every launchable app can describe itself before it is opened.

## Scope

- In scope:
- Define the Android tablet shell areas: top status bar, bottom taskbar / dock, left Navigation Rail, desktop app grid, widget area, Quick Settings panel, and split-pane app window.
- Define first-class UI component names for those shell areas so later UI models can use them directly.
- Define `slide_app_summary` as the required short description label for slide-capable apps.
- Define the MVP acceptance boundary for 0387, including browser verification of launcher, foreground app, task switcher, Quick Settings, split-pane layout, and at least one slide app.
- Add deterministic contract tests that fail until the implementation provides the new components and metadata.
- Out of scope:
- Rebuilding every existing slide app for the new OS style.
- Real multi-window scheduling, drag-resize, or freeform desktop windows.
- Adding MUI, Quasar, or any design-system dependency; they are references only.
- Changing Model 0, pin, bus, or business event semantics.

## Invariants / Constraints

- `CLAUDE.md` and active `docs/ssot/**` remain higher authority than this iteration.
- 0386 is a contract/planning iteration; runtime behavior changes belong to 0387.
- UI is projection of ModelTable truth. The OS shell may hold local UI state in negative models, but positive slide app business state remains owned by the app model.
- App launch and task state remain UI-local state; formal business actions inside apps must continue through the existing pin / Model 0 / bus paths.
- The shell must be composed from granular components and labels. A whole-screen HTML string is not acceptable as the authoritative UI surface.
- New UI components must be registered in `component_registry_v1.json`, rendered by `ui-renderer`, and covered by tests before use in system-model UI records.
- Existing deep links remain available.
- Every small stage and big stage must be reviewed by a sub-agent using `codex-code-review`; review findings must be fixed before continuing.

## Big Stages

- Big Stage A: Contract freeze.
- Big Stage B: RED contract test.
- Big Stage C: sub-agent review, fix, and close contract phase.

## Small Stages

- 0386.1: Register 0386 / 0387, fill plan / resolution / runlog, and add RED contract tests.
- 0386.2: Sub-agent review of the contract slice, then fix docs / tests until approved.
- 0386.3: Mark 0386 complete only after the contract test proves the expected implementation gaps and review passes.

## Success Criteria

- `docs/ITERATIONS.md` registers both 0386 and 0387 with the correct branch and status.
- 0386 plan and resolution explicitly describe the shell areas, app summary metadata, scope boundaries, stage gates, and verification.
- A contract test exists for:
- Required OS shell component registry entries.
- Required renderer support markers.
- Required `slide_app_summary` metadata on workspace slide apps.
- Required route projection metadata so desktop app entries can show title and summary.
- No MUI / Quasar dependency or imports.
- The initial 0386 test run records expected failures before implementation.
- Sub-agent review of 0386 returns `APPROVED`.

## Inputs

- Created at: 2026-05-20
- Iteration ID: 0386-android-tablet-os-shell-contract
- Branch: `dropx/dev_0386-0387-android-tablet-os-shell`
- User-approved direction:
- Target style: Android tablet-like OS surface.
- Design references: MUI / Quasar only as visual/product references.
- Implementation preference: basic HTML elements with Tailwind-like styling through current UI model and renderer.
- Slide app adaptation: no mandatory icons in this iteration; add a model label for app summary.
