---
title: "0374 - Web Tablet Desktop Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-05-12
source: ai
iteration_id: 0374-web-tablet-desktop
id: 0374-web-tablet-desktop
phase: execution
---

# Iteration 0374-web-tablet-desktop Runlog

## Environment

- Date: 2026-05-12
- Branch: `dev_0374-web-tablet-desktop`
- Runtime: local planning, no implementation runtime touched yet

## Planning Records

### 2026-05-12 - Intake And Branch

- User approved the Web Tablet Desktop direction:
  - first scope: desktop + single foreground app + task switcher
  - split view deferred
  - ModelTable editor visible as ordinary desktop app
  - implementation must be Tier2 / UI-model-first
- Command: `git switch -c dev_0374-web-tablet-desktop`
- Key output: `Switched to a new branch 'dev_0374-web-tablet-desktop'`
- Result: PASS

### 2026-05-12 - Iteration Scaffold

- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0374-web-tablet-desktop --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output:
  - `written .../docs/iterations/0374-web-tablet-desktop/plan.md`
  - `written .../docs/iterations/0374-web-tablet-desktop/resolution.md`
  - `written .../docs/iterations/0374-web-tablet-desktop/runlog.md`
- Result: PASS

### 2026-05-12 - Pre-Planning Sub-Agent Review

- Review type: AI-assisted
- Reviewer: sub-agent `019e1991-e7b9-7ec3-a4a4-5d584153752c`
- Decision: Change Requested
- Key findings absorbed into the plan:
  - Rename execution phases to workflow Steps to avoid conflict with repository Phase gates.
  - Reword "runtime" to "foreground app state model / desktop projection" where applicable.
  - Split UI model patch and route/shell consumption into separate steps.
  - Migrate app entries in small batches.
  - Make component-extension order explicit.
  - Add functional and conformance verification after every step.
- Result: PASS, findings incorporated before formal planning documents were finalized.

### 2026-05-12 - Formal Planning Review 1

- Review type: AI-assisted
- Reviewer: sub-agent `019e1997-a407-7d43-8a05-7326cb337bc7`
- Decision: Change Requested
- Findings:
  - `test_0311_pin_projection_contract.mjs` was too vague as a planning risk and must become a Step 1 baseline gate.
  - Review Gate record must include this decision before re-review.
  - Final pin/event verification must name `test_0311_pin_projection_contract.mjs` explicitly.
  - The implementation plan should use repository-native workflow language instead of an external `superpowers:executing-plans` prerequisite.
- Result: PASS, findings accepted for plan revision.

### 2026-05-12 - Baseline Test Recheck

- Command: `node scripts/tests/test_0311_pin_projection_contract.mjs`
- Key output:
  - `[PASS] ast_exposes_writable_pins_schema_for_pin_bound_node`
  - `[FAIL] test_workspace_patches_pinize_existing_buttons: model100_submit_must_use_pin_write`
  - `2 passed, 1 failed out of 3`
- Result: FAIL, promoted to Step 1 baseline gate before desktop implementation.

- Command: `node scripts/tests/test_0346_ui_model_compliance_contract.mjs`
- Key output: `test_0346_ui_model_compliance_contract: PASS (29 visible surfaces, 6 warnings)`
- Result: PASS

- Command: `git diff --check`
- Key output: no output
- Result: PASS

### 2026-05-12 - Formal Planning Review 2

- Review type: AI-assisted
- Reviewer: sub-agent `019e199b-2735-7281-8918-cc1c10301a46`
- Decision: Approved
- Findings: none
- Notes:
  - Previous Change Requested items were resolved.
  - `test_0311_pin_projection_contract.mjs` remains a hard Step 1 baseline gate before desktop implementation.
  - No implementation files changed during planning.
- Result: PASS, plan may enter Phase 3 execution starting from Step 1 baseline disposition.

## Review Gate Records

### Review Gate Record - 1

- Iteration ID: `0374-web-tablet-desktop`
- Review Date: 2026-05-12
- Review Type: AI-assisted sub-agent
- Review Index: 1
- Decision: Change Requested
- Notes: `test_0311_pin_projection_contract.mjs` must be elevated from vague baseline risk to explicit Step 1 gate; this runlog records the failure and the plan is being revised before re-review.

### Review Gate Record - 2

- Iteration ID: `0374-web-tablet-desktop`
- Review Date: 2026-05-12
- Review Type: AI-assisted sub-agent
- Review Index: 2
- Decision: Approved
- Notes: Plan/resolution approved for Phase 3. Execution must start with Step 1 baseline disposition for `test_0311_pin_projection_contract.mjs`; desktop implementation must not skip that gate.

## Execution Records

### Step 1 - Desktop Contract And State Ownership

- Root cause:
  - `scripts/tests/test_0311_pin_projection_contract.mjs` still asserted the pre-0358 direct positive-model pin shape for Model 100 submit.
  - Current SSOT and current tests require Model 100 submit to use `bus_event_v2 -> Model 0 bus_event_submit_100_0_0_0`.
  - The failure was therefore a stale test expectation, not a current UI model defect.
- Change:
  - Updated the Model 100 submit assertion in `scripts/tests/test_0311_pin_projection_contract.mjs` to require `bus_event_v2`, `bus_in_key=bus_event_submit_100_0_0_0`, and `value_t=modeltable`.
- Command: `node scripts/tests/test_0311_pin_projection_contract.mjs`
- Key output:
  - `[PASS] ast_exposes_writable_pins_schema_for_pin_bound_node`
  - `[PASS] workspace_patches_pinize_existing_buttons`
  - `[PASS] renderer_and_server_have_pin_envelope_contract`
  - `3 passed, 0 failed out of 3`
- Result: PASS
- Command: `node scripts/tests/test_0177_model100_submit_ui_contract.mjs`
- Key output: `PASS test_0177_model100_submit_ui_contract`
- Result: PASS
- Command: `node scripts/tests/test_0333_model100_cellwise_contract.mjs`
- Key output:
  - `[PASS] workspace_model100_declares_cellwise_and_drops_legacy_schema_source`
  - `[PASS] workspace_model100_submit_button_preserves_pin_metadata`
  - `[PASS] test_model100_ui_declares_model0_bus_event_submit_route`
  - `6 passed, 0 failed out of 6`
- Result: PASS
- Command: `git diff --check`
- Key output: no output
- Result: PASS
- Review:
  - Reviewer: sub-agent `019e199e-ce5b-7472-90b3-86cc392eb4e9`
  - Decision: Approved
  - Findings: none
  - Notes: Step 1 baseline gate disposition is correct; can proceed to Step 2 Component Gap Audit.
- Commit:
  - `0ca057a` (`test(ui): align pin projection contract with bus event ingress`)

### Step 2 - Component Gap Audit

- Decision:
  - No new UI component is required for the first Web Tablet Desktop slice.
  - Existing components are sufficient for the planned first implementation:
    - `Container` / `Card` for desktop sections, icon grid, task cards, and foreground framing.
    - `Button` / `Icon` for app launch and task controls.
    - `StatusBadge` for task/app status.
    - `Drawer` or equivalent panel surface for task switcher.
    - `Tabs` only if a first-slice surface needs simple segmented grouping.
    - `Text` for labels and empty states.
- Command:
```bash
node - <<'NODE'
import fs from 'node:fs';
const registry = JSON.parse(fs.readFileSync('packages/ui-renderer/src/component_registry_v1.json','utf8')).components || {};
const required = ['Container','Card','Button','Icon','StatusBadge','Drawer','Tabs','Text'];
const missing = required.filter((name) => !registry[name]);
console.log(JSON.stringify({ required, missing }, null, 2));
process.exit(missing.length ? 1 : 0);
NODE
```
- Key output:
  - `missing: []`
- Result: PASS
- Command: `rg -n "if \\(node\\.type === 'Text'\\)|if \\(node\\.type === 'Tabs'\\)|if \\(node\\.type === 'Button'\\)|if \\(node\\.type === 'Drawer'\\)|if \\(node\\.type === 'Card'\\)|if \\(node\\.type === 'Container'\\)|if \\(node\\.type === 'Icon'\\)|if \\(node\\.type === 'StatusBadge'\\)" packages/ui-renderer/src/renderer.mjs`
- Key output:
  - `738:  if (node.type === 'Text')`
  - `1219:  if (node.type === 'Tabs')`
  - `1243:  if (node.type === 'Button')`
  - `1359:  if (node.type === 'Drawer')`
  - `1426:  if (node.type === 'Card')`
  - `1438:  if (node.type === 'Container')`
  - `1686:  if (node.type === 'Icon')`
  - `1759:  if (node.type === 'StatusBadge')`
- Result: PASS
- Command: `node scripts/tests/test_0346_ui_model_compliance_contract.mjs`
- Key output: `test_0346_ui_model_compliance_contract: PASS (29 visible surfaces, 6 warnings)`
- Result: PASS
- Command: `npm -C packages/ui-model-demo-frontend run test`
- Key output:
  - `ui-model-demo-frontend@0.1.0 test`
  - `editor_v1_static_upload_binding_persisted: PASS`
- Result: PASS
- Command: `git diff --check`
- Key output: no output
- Result: PASS
- Review:
  - Reviewer: sub-agent `019e19a0-dc81-79a0-9c18-e0c627374add`
  - Decision: Change Requested
  - Findings:
    - Step 2 runlog lacked `git diff --check` evidence.
    - The renderer support check used an abbreviated command and needed a replayable command.
  - Notes: component decision was accepted; only evidence recording needed revision.
- Review:
  - Reviewer: sub-agent `019e19a3-a1b9-7791-85db-4c7414cc6d55`
  - Decision: Change Requested
  - Findings:
    - Step 2 registry check needed a replayable command, not only a prose description.
  - Notes: component decision was accepted; registry evidence recording needed revision.
- Review:
  - Reviewer: sub-agent `019e19a5-dff3-7cc3-b1b5-552c038cab6c`
  - Decision: Approved
  - Findings: none
  - Notes: no new component required; current evidence supports entering Step 3.
- Commit:
  - `b3f378f` (`docs(iterations): record desktop component audit`)

### Step 3 - Desktop UI Model Patch

- Change:
  - Added a reserved desktop UI model id `-28`.
  - Added `packages/worker-base/system-models/desktop_catalog_ui.json` as the first desktop launcher surface.
  - Wired the desktop catalog patch into the local demo store bootstrap.
  - Added `scripts/tests/test_0374_web_tablet_desktop_contract.mjs` to lock the desktop root, required system app icons, and initial workspace slide app icons.
  - Added the desktop catalog patch to the UI model compliance audit source list.
- Command: `node scripts/tests/test_0374_web_tablet_desktop_contract.mjs`
- Key output:
  - `[PASS] desktop_catalog_model_is_cellwise_ui_surface`
  - `[PASS] desktop_exposes_required_system_app_icons`
  - `[PASS] desktop_exposes_workspace_slide_app_icons_from_registry`
  - `3 passed, 0 failed out of 3`
- Result: PASS
- Command: `node scripts/tests/test_0346_ui_model_compliance_contract.mjs`
- Key output: `test_0346_ui_model_compliance_contract: PASS (30 visible surfaces, 6 warnings)`
- Result: PASS
- Command: `npm -C packages/ui-model-demo-frontend run test`
- Key output:
  - `editor_ast_no_direct_mutation_buttons: PASS`
  - `editor_v1_static_upload_binding_persisted: PASS`
- Result: PASS
- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output:
  - `✓ 1454 modules transformed.`
  - `✓ built in 2.72s`
- Result: PASS
- Command: `git diff --check`
- Key output: no output
- Result: PASS
- Review:
  - Reviewer: sub-agent `019e19ab-aa8d-7cc2-8ff8-d9a8dc1ad6ef`
  - Decision: Approved
  - Findings: none
  - Notes: no open questions or verification gaps.
- Commit:

### Step 4 - Web Shell Read-Only Desktop Entry

- Command: pending
- Key output: pending
- Result: pending
- Commit:

### Step 5 - Single Foreground App Player

- Command: pending
- Key output: pending
- Result: pending
- Commit:

### Step 6 - Task Switcher And Pseudo-Background

- Command: pending
- Key output: pending
- Result: pending
- Commit:

### Step 7 - Batched App Entry Migration

- Command: pending
- Key output: pending
- Result: pending
- Commit:

### Step 8 - Browser Verification, Docs Assessment, And Closeout

- Command: pending
- Key output: pending
- Result: pending
- Commit:

## Docs Updated

- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/ssot/label_type_registry.md` reviewed
- [ ] `docs/ssot/tier_boundary_and_conformance_testing.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/user-guide/ui_components_v2.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
