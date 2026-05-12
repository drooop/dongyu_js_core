---
title: "Web Tablet Desktop Implementation Plan"
doc_type: implementation-plan
status: approved
updated: 2026-05-12
source: ai
iteration_id: 0374-web-tablet-desktop
---

# Web Tablet Desktop Implementation Plan

> **For Codex:** REQUIRED PROCESS: follow `docs/WORKFLOW.md`, execute task-by-task from `docs/iterations/0374-web-tablet-desktop/resolution.md`, and run `codex-code-review` sub-agent review after each task before continuing.

**Goal:** Build a Web tablet desktop where all runnable surfaces launch as apps, with one foreground app and a task switcher.

**Architecture:** The desktop and task switcher are Tier2 system UI models backed by negative-model UI state. Positive app models remain owners of app/business content. Web shell code only consumes and projects ModelTable state; it does not become the registry or task state owner.

**Tech Stack:** Vue 3, Element Plus, `cellwise.ui.v1`, `packages/ui-renderer`, `packages/worker-base/system-models`, frontend projection helpers, deterministic Node tests.

---

### Task 1: Freeze Desktop Contract

**Files:**
- Modify: `docs/plans/2026-05-12-web-tablet-desktop-design.md`
- Modify: `docs/iterations/0374-web-tablet-desktop/plan.md`
- Modify: `docs/iterations/0374-web-tablet-desktop/resolution.md`
- Modify: `docs/iterations/0374-web-tablet-desktop/runlog.md`

**Step 1: Verify the planning docs are registered**

Run: `rg -n "0374-web-tablet-desktop|Web Tablet Desktop" docs/ITERATIONS.md docs/iterations/0374-web-tablet-desktop docs/plans/2026-05-12-web-tablet-desktop-*.md`

Expected: all files mention the iteration and the planned desktop scope.

**Step 2: Run formatting check**

Run: `git diff --check`

Expected: no whitespace errors.

**Step 3: Run baseline pin/event gate**

Run: `node scripts/tests/test_0311_pin_projection_contract.mjs`

Expected:

- PASS, or
- FAIL with a documented disposition:
  - 0374-related: fix before Task 3 starts.
  - unrelated: record exclusion reason, impact boundary, owner, and follow-up iteration.

**Step 4: Request sub-agent review**

Ask `codex-code-review` to review only planning/design docs for Tier2 placement, ownership, route compatibility, and review-gate completeness.

Expected: Approved before implementation begins.

**Step 5: Commit**

```bash
git add docs/ITERATIONS.md docs/iterations/0374-web-tablet-desktop docs/plans/2026-05-12-web-tablet-desktop-design.md docs/plans/2026-05-12-web-tablet-desktop-implementation.md
git commit -m "docs(iterations): plan web tablet desktop"
```

### Task 2: Audit Component Gaps

**Files:**
- Inspect: `packages/ui-renderer/src/component_registry_v1.json`
- Inspect/modify if needed: `packages/ui-renderer/src/renderer.mjs`
- Modify if needed: `docs/user-guide/ui_components_v2.md`
- Test if component changes: `packages/ui-model-demo-frontend` or `scripts/tests`

**Step 1: List required controls**

Check whether existing `Container`, `Card`, `Button`, `Icon`, `StatusBadge`, `Drawer`, `Tabs`, `Text`, and layout labels can express:

- desktop icon grid
- app icon
- recent row
- foreground frame
- task switcher card
- restore and close controls

**Step 2: Decide component scope**

If existing components are enough, record "no new component" in the runlog.

If a new component is needed, write a failing component test first, then update registry, renderer, tests, and user guide before any UI model uses it.

**Step 3: Verify**

Run:

```bash
node scripts/tests/test_0346_ui_model_compliance_contract.mjs
npm -C packages/ui-model-demo-frontend run test
git diff --check
```

Expected: checks pass, or no frontend test required if no code changed.

**Step 4: Sub-agent review and commit**

Request review for the component decision/change. Fix findings, then commit.

### Task 3: Add Desktop UI Model

**Files:**
- Create/modify: `packages/worker-base/system-models/*desktop*_ui.json`
- Modify: `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Add/modify: desktop projection test
- Modify: `docs/iterations/0374-web-tablet-desktop/runlog.md`

**Step 1: Write failing projection/compliance test**

Add a test that expects the desktop UI model to exist, use `cellwise.ui.v1`, and expose a root node plus visible app icon nodes.

Expected first run: FAIL because desktop UI model is not yet loaded.

**Step 2: Implement minimal desktop model patch**

Create a granular `cellwise.ui.v1` desktop UI model. Include static system app entries first:

- Gallery
- Docs
- ModelTable
- Prompt
- Static

**Step 3: Load the patch**

Import and apply the desktop patch in the frontend demo bootstrap.

**Step 4: Verify**

Run:

```bash
node scripts/tests/test_0346_ui_model_compliance_contract.mjs
node <new-desktop-projection-test>
git diff --check
```

Expected: PASS.

**Step 5: Sub-agent review and commit**

Request review focused on UI model granularity and ownership. Fix findings, then commit.

### Task 4: Make Web Root Render Desktop

**Files:**
- Modify: `packages/ui-model-demo-frontend/src/router.js`
- Modify: `packages/ui-model-demo-frontend/src/demo_app.js`
- Modify: `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
- Modify if needed: `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- Add/modify route tests

**Step 1: Write failing route test**

Expect Web root `/` to resolve to desktop while old deep links still resolve.

Expected first run: FAIL because `/` still points to the old Home/editor page.

**Step 2: Add desktop route/page entry**

Make root render desktop. Move the old ModelTable editor surface to a normal app route if required, for example `/modeltable`.

**Step 3: Verify**

Run:

```bash
node scripts/tests/test_0311_pin_projection_contract.mjs
npm -C packages/ui-model-demo-frontend run test
npm -C packages/ui-model-demo-frontend run build
git diff --check
```

Expected: PASS.

**Step 4: Sub-agent review and commit**

Request review focused on shell read-only behavior and deep-link compatibility. Fix findings, then commit.

### Task 5: Add Single Foreground App Player

**Files:**
- Modify: desktop UI model patch
- Modify: projection/state derivation helpers selected by Task 4
- Add/modify open-app tests

**Step 1: Write failing open-app test**

Expect clicking or dispatching an app-open action to set one foreground app and render the corresponding page/app.

Expected first run: FAIL because foreground app state is not wired.

**Step 2: Implement foreground state projection**

Add negative-model UI state labels and projection helpers for foreground app selection.

**Step 3: Support first app types**

Support Gallery, Docs, ModelTable, and at least one Workspace slide app.

**Step 4: Verify**

Run:

```bash
npm -C packages/ui-model-demo-frontend run test
npm -C packages/ui-model-demo-frontend run build
git diff --check
```

Expected: PASS.

**Step 5: Sub-agent review and commit**

Request review focused on state ownership and no runtime semantic changes. Fix findings, then commit.

### Task 6: Add Task Switcher And Pseudo-Background

**Files:**
- Modify: desktop/task UI model patch
- Modify: projection/state derivation helpers
- Add/modify open/restore/close tests

**Step 1: Write failing task switcher tests**

Test:

- open A, return desktop, open B, restore A
- close A removes it from opened apps

Expected first run: FAIL.

**Step 2: Implement opened/recent/foreground state**

Keep opened/recent/foreground state in negative system UI labels. Do not render multiple app UIs in parallel.

**Step 3: Verify**

Run:

```bash
npm -C packages/ui-model-demo-frontend run test
npm -C packages/ui-model-demo-frontend run build
git diff --check
```

Expected: PASS.

**Step 4: Sub-agent review and commit**

Request review focused on pseudo-background boundary. Fix findings, then commit.

### Task 7: Migrate App Entries In Batches

**Files:**
- Modify: desktop UI model patch
- Modify: page/catalog patches as needed
- Add/modify batch route/projection tests

**Step 1: Batch 7A**

Migrate Gallery, Docs, and ModelTable entries.

Verify desktop launch, original deep link, return desktop, and restore.

Request review and commit.

**Step 2: Batch 7B**

Migrate Workspace slide app entries.

Verify at least one built-in slide app opens from desktop and old Workspace deep link still works.

Request review and commit.

**Step 3: Batch 7C**

Migrate Prompt, Static, and remaining system entries.

Verify launch and deep-link compatibility.

Request review and commit.

**Step 4: Batch 7D**

Run deep-link regression for all old routes.

Request review and commit if fixes were needed.

### Task 8: Final Verification And Closeout

**Files:**
- Modify: `docs/iterations/0374-web-tablet-desktop/runlog.md`
- Modify: `docs/ITERATIONS.md`
- Modify if needed: `docs/user-guide/modeltable_user_guide.md`
- Modify if needed: `docs/user-guide/ui_components_v2.md`

**Step 1: Run deterministic checks**

Run:

```bash
node scripts/tests/test_0346_ui_model_compliance_contract.mjs
node scripts/tests/test_0311_pin_projection_contract.mjs
npm -C packages/ui-model-demo-frontend run test
npm -C packages/ui-model-demo-frontend run build
git diff --check
```

Expected: PASS.

**Step 2: Browser verification**

Start the local app and verify:

- desktop loads at root
- Gallery opens from desktop
- Docs opens from desktop
- ModelTable opens from desktop
- a slide app opens from desktop
- task switcher restores and closes apps
- old deep links still work

Expected: PASS with evidence recorded in runlog.

**Step 3: Final sub-agent review**

Request final `codex-code-review`. Fix findings.

**Step 4: Close iteration**

Update `docs/ITERATIONS.md` to Completed and record final commit facts.
