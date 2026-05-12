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

### Step 2 - Component Gap Audit

- Command: pending
- Key output: pending
- Result: pending
- Commit:

### Step 3 - Desktop UI Model Patch

- Command: pending
- Key output: pending
- Result: pending
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
