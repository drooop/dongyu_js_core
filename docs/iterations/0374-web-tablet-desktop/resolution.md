---
title: "0374 - Web Tablet Desktop Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-05-12
source: ai
iteration_id: 0374-web-tablet-desktop
id: 0374-web-tablet-desktop
phase: approved
---

# Iteration 0374-web-tablet-desktop Resolution

## Execution Strategy

- Use a Tier2 / UI-model-first delivery path.
- Treat the tablet desktop and task switcher as system UI surfaces backed by negative-model state.
- Keep app/business content in the existing positive models.
- Keep Web shell changes as projection consumption only: shell reads ModelTable state and selects the surface to render; it must not become the registry or task state owner.
- Split execution into small steps. After each step, run deterministic checks and a sub-agent `codex-code-review` review before continuing.

## Step 1 - Desktop Contract And State Ownership

- Scope:
- Freeze the desktop/app/task state contract before implementation.
- Define the app definition vs opened task vs foreground app distinction.
- Define owner placement for:
  - desktop app registry projection
  - opened apps
  - foreground app
  - recent apps
  - pseudo-background status
- Record that ModelTable editor is a normal visible desktop app.
- Files:
- Modify: `docs/plans/2026-05-12-web-tablet-desktop-design.md`
- Modify: `docs/plans/2026-05-12-web-tablet-desktop-implementation.md`
- Modify: `docs/iterations/0374-web-tablet-desktop/runlog.md`
- Verification:
- `git diff --check`
- `node scripts/tests/test_0311_pin_projection_contract.mjs`
- Manual conformance checklist:
  - Tier placement explained
  - negative vs positive model placement explained
  - ownership and data flow explained
  - no frontend-only truth source
- Baseline gate:
  - If `test_0311_pin_projection_contract.mjs` fails, classify it before implementation:
    - 0374-related: fix before Step 3 starts.
    - unrelated: record exclusion reason, impact boundary, owner, and follow-up iteration in runlog.
- Acceptance:
- Contract is self-contained and reviewable without chat context.
- `test_0311_pin_projection_contract.mjs` has a recorded disposition, not a vague risk note.
- Sub-agent review decision is Approved.
- Rollback:
- Revert the docs changes in this step.

## Step 2 - Component Gap Audit

- Scope:
- Audit whether the current UI model components can express the desktop and task switcher.
- Required visual/control patterns:
  - desktop icon grid
  - app icon
  - desktop section/recent row
  - single foreground app frame
  - task switcher card
  - status badge
  - return-to-desktop control
  - close/restore controls
- If existing components are enough, do not add components.
- If a component is missing, implement component support before any UI model uses it.
- Files:
- Inspect: `packages/ui-renderer/src/component_registry_v1.json`
- Inspect/modify if needed: `packages/ui-renderer/src/renderer.mjs`
- Modify if component changes: `docs/user-guide/ui_components_v2.md`
- Add/modify tests if component changes: `scripts/tests/` or `packages/ui-model-demo-frontend/scripts/`
- Modify: `docs/iterations/0374-web-tablet-desktop/runlog.md`
- Verification:
- Component registry check or targeted renderer test.
- `node scripts/tests/test_0346_ui_model_compliance_contract.mjs`
- `npm -C packages/ui-model-demo-frontend run test` if renderer changes.
- `git diff --check`
- Acceptance:
- Every component used by the new desktop UI model is registered and renderable.
- If no component is added, the runlog records the no-new-component decision.
- Sub-agent review decision is Approved.
- Rollback:
- Revert component registry/renderer/docs/test changes from this step.

## Step 3 - Desktop UI Model Patch

- Scope:
- Add the desktop first-screen UI model as `cellwise.ui.v1`.
- Add app icons for Gallery, Docs, ModelTable, Prompt, Static, and runnable Workspace slide apps.
- Keep icons/actions as UI state or route intents, not business truth.
- Avoid whole-page HTML or large JSON UI blobs.
- Files:
- Create/modify: `packages/worker-base/system-models/*desktop*_ui.json` or nearest existing system model patch chosen during Step 1.
- Modify: `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Modify/add tests validating desktop UI projection.
- Modify: `docs/iterations/0374-web-tablet-desktop/runlog.md`
- Verification:
- `node scripts/tests/test_0346_ui_model_compliance_contract.mjs`
- Desktop projection test added in this step.
- `git diff --check`
- Acceptance:
- Desktop UI model is granular cellwise UI.
- Desktop UI model renders through existing projection path.
- Sub-agent review decision is Approved.
- Rollback:
- Revert the new desktop UI model patch, bootstrap import, and related tests.

## Step 4 - Web Shell Read-Only Desktop Entry

- Scope:
- Make Web root render the desktop first screen.
- Preserve existing deep links for Gallery, Docs, Workspace, Prompt, Static, and ModelTable/editor route.
- Hide or demote top Navigate links in the primary desktop experience.
- Keep shell logic read-only with respect to desktop registry/task truth except dispatching UI events already expressed by ModelTable labels.
- Files:
- Modify: `packages/ui-model-demo-frontend/src/router.js`
- Modify: `packages/ui-model-demo-frontend/src/demo_app.js`
- Modify: `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
- Modify: `packages/ui-model-demo-frontend/src/route_ui_projection.js` if required by projection routing.
- Modify/add route tests.
- Modify: `docs/iterations/0374-web-tablet-desktop/runlog.md`
- Verification:
- Route projection tests.
- `npm -C packages/ui-model-demo-frontend run test`
- `npm -C packages/ui-model-demo-frontend run build`
- `git diff --check`
- Acceptance:
- Root renders desktop.
- Old deep links still render their old surfaces.
- Web shell does not own desktop/task truth.
- Sub-agent review decision is Approved.
- Rollback:
- Revert shell/route/projection/test changes from this step.

## Step 5 - Single Foreground App Player

- Scope:
- Add the app-open path from desktop icon to one foreground app surface.
- Support opening:
  - Gallery
  - Docs
  - ModelTable editor
  - at least one Workspace slide app
- Reuse existing Workspace selected-app / flow-shell projection for slide apps.
- Do not implement split view, freeform windows, or multiple rendered foregrounds.
- Files:
- Modify: desktop UI model patch from Step 3.
- Modify: projection helpers selected in Step 4.
- Modify/add tests for open/foreground selection.
- Modify: `docs/iterations/0374-web-tablet-desktop/runlog.md`
- Verification:
- Open-app projection test.
- `node scripts/tests/test_0311_pin_projection_contract.mjs`
- Additional pin/event path test for actions added by this step, if any.
- `npm -C packages/ui-model-demo-frontend run test`
- `npm -C packages/ui-model-demo-frontend run build`
- `git diff --check`
- Acceptance:
- A desktop icon opens exactly one foreground app.
- Returning to desktop is available.
- Slide apps still render from their ModelTable-owned surface.
- Sub-agent review decision is Approved.
- Rollback:
- Revert app-open projection/UI-model changes.

## Step 6 - Task Switcher And Pseudo-Background

- Scope:
- Add opened apps, recent apps, foreground marker, restore, and close.
- Store task switcher state in negative system UI state.
- Background apps keep resumable state but do not continuously render complex UI.
- Files:
- Modify: desktop/task UI model patch.
- Modify: projection helpers or state derivers selected in Step 1.
- Modify/add tests for open/restore/close.
- Modify: `docs/iterations/0374-web-tablet-desktop/runlog.md`
- Verification:
- Open A -> return desktop -> open B -> restore A test.
- Close A removes it from opened apps test.
- `npm -C packages/ui-model-demo-frontend run test`
- `npm -C packages/ui-model-demo-frontend run build`
- `git diff --check`
- Acceptance:
- Task switcher restores and closes opened apps.
- No true multi-runtime/background-rendering semantics are introduced.
- Sub-agent review decision is Approved.
- Rollback:
- Revert task switcher UI/state/projection/test changes.

## Step 7 - Batched App Entry Migration

- Scope:
- Migrate app entries in small batches:
  - 7A: Gallery, Docs, ModelTable
  - 7B: Workspace slide apps
  - 7C: Prompt, Static, other system entries
  - 7D: deep-link compatibility regression
- Each batch must verify icon launch, original route, return desktop, task restore, and ownership.
- Files:
- Modify: UI model patches and page catalog patches identified by prior steps.
- Modify/add targeted tests per batch.
- Modify: `docs/iterations/0374-web-tablet-desktop/runlog.md`
- Verification:
- Batch-specific route/projection tests.
- `node scripts/tests/test_0346_ui_model_compliance_contract.mjs`
- `npm -C packages/ui-model-demo-frontend run test`
- `npm -C packages/ui-model-demo-frontend run build`
- `git diff --check`
- Acceptance:
- Every migrated entry opens from desktop and via original deep link.
- Every batch has sub-agent review Approved before the next batch.
- Rollback:
- Revert the batch-specific UI model/catalog/test changes.

## Step 8 - Browser Verification, Docs Assessment, And Closeout

- Scope:
- Run final deterministic and browser verification.
- Assess whether living docs need updates.
- Record all PASS/FAIL evidence.
- Update iteration index when completed.
- Files:
- Modify if needed: `docs/user-guide/modeltable_user_guide.md`
- Modify if needed: `docs/user-guide/ui_components_v2.md`
- Modify: `docs/iterations/0374-web-tablet-desktop/runlog.md`
- Modify: `docs/ITERATIONS.md`
- Verification:
- `node scripts/tests/test_0346_ui_model_compliance_contract.mjs`
- route/workspace projection tests added during this iteration
- `node scripts/tests/test_0311_pin_projection_contract.mjs`
- any additional pin/event path tests added during Step 5
- `npm -C packages/ui-model-demo-frontend run test`
- `npm -C packages/ui-model-demo-frontend run build`
- local browser verification of desktop, Gallery, Docs, ModelTable, one slide app, and task switcher
- `git diff --check`
- Acceptance:
- All planned checks PASS.
- Final sub-agent review decision is Approved.
- Rollback:
- Revert iteration changes to the last approved step or revert the whole iteration branch.

## Notes

- Generated at: 2026-05-12
- Known baseline gate:
  - `node scripts/tests/test_0311_pin_projection_contract.mjs` currently fails at `model100_submit_must_use_pin_write`.
  - Because 0374 touches Workspace slide app entry and foreground app opening, this cannot be treated as unrelated without evidence.
  - Step 1 must either fix it before desktop implementation or record a concrete exclusion reason, impact boundary, owner, and follow-up iteration.
