---
title: "0374 - Web Tablet Desktop Plan"
doc_type: iteration-plan
status: approved
updated: 2026-05-12
source: ai
iteration_id: 0374-web-tablet-desktop
id: 0374-web-tablet-desktop
phase: approved
---

# Iteration 0374-web-tablet-desktop Plan

## Goal

- Turn the Web entry experience into a tablet-like app desktop while keeping the implementation Tier2 / UI-model-first.
- The first implementation scope is desktop + single foreground app + task switcher. Dual-app split view is deliberately deferred.
- The old route/navigation system remains available as deep links and compatibility surface, but it is no longer the primary user-facing navigation.

## Scope

- In scope:
- A new Web Tablet Desktop first screen.
- A visible desktop app entry for the existing ModelTable editor.
- Desktop app entries for Gallery, Docs, Prompt, Static, and all Workspace slide apps that are runnable.
- A single foreground app player surface.
- A task switcher with opened apps, foreground app, recent apps, restore, and close.
- Pseudo-background behavior: preserve app task state and restore entry, without rendering multiple app UIs in parallel.
- Route/deep-link compatibility for existing Gallery, Docs, Workspace, and related routes.
- UI model/system-model patches as the primary delivery form.
- Component registry/renderer extension only when the UI model cannot express a required desktop/task-switcher control with existing components.
- Sub-agent review after every implementation step before moving to the next step.
- Out of scope:
- Dual-app split view.
- Freeform windows.
- Multi-instance apps by default.
- Multiple background app UIs rendered at the same time.
- Mobile-specific layout work beyond choices that keep later mobile adaptation feasible.
- Runtime interpreter semantics, new label.t semantics, or server-held app/task truth.
- Removing existing deep links.

## Invariants / Constraints

- `CLAUDE.md` is highest priority.
- Work must follow `docs/WORKFLOW.md`: iteration registration, docs-only planning, review gate, then execution.
- UI is projection of ModelTable and cannot become the truth source.
- Most changes should be Tier2: system-model patches, UI model definitions, projection helpers, and tests.
- Hidden or platform-owned UI state defaults to negative system models.
- Positive models keep ownership of user-visible app/business content.
- Desktop registry and task switcher state are projections/system UI state, not business truth.
- Formal business events must not bypass the current Model 0 / bus / pin paths.
- If a needed visual control is not expressible by the current UI component set, extend `component_registry_v1.json`, renderer support, tests, and `docs/user-guide/ui_components_v2.md` before using the component in UI models.
- No whole-page HTML or coarse blob may become an authoritative UI surface.

## Success Criteria

- Opening the Web root shows the tablet desktop, not a top navigation landing page.
- The ModelTable editor appears as a normal desktop app.
- Gallery, Docs, Prompt, Static, and runnable Workspace slide apps appear as launchable desktop apps.
- Clicking a desktop app opens a single foreground app player.
- The user can return to the desktop.
- The user can open a task switcher, restore an opened app, and close an opened app.
- Pseudo-background task state is stored in ModelTable-owned UI state, not in ad hoc frontend-only truth.
- Existing deep links still work.
- UI model compliance checks pass for new/changed UI surfaces.
- Route/workspace projection checks pass.
- Relevant pin/event path checks pass.
- The current `node scripts/tests/test_0311_pin_projection_contract.mjs` failure is resolved or explicitly classified before desktop implementation starts:
  - if 0374-related, it must be fixed before Step 3 starts;
  - if unrelated, runlog must record the exclusion reason, impact boundary, owner, and follow-up iteration.
- Frontend build passes.
- Browser verification covers desktop, Gallery, Docs, ModelTable, at least one slide app, and the task switcher.
- Every implementation step has sub-agent review recorded before the next step starts.

## Inputs

- Created at: 2026-05-12
- Iteration ID: 0374-web-tablet-desktop
- Branch: `dev_0374-web-tablet-desktop`
- User-approved direction:
  - Web first screen should resemble an iOS/iPadOS-like app desktop.
  - Workspace slide apps should become app icons, not Navigate links.
  - ModelTable editor should be visible as a normal desktop app.
  - Phase 1 product scope is desktop + single foreground app + task switcher.
  - Dual-app split view is a later phase.
  - Implementation must be Tier2 / UI-model-first.
