---
title: "Workspace UI Fill-Table Example Implementation Plan"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Workspace UI Fill-Table Example Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a preloaded Workspace example that is built from ModelTable UI labels, mounts as a sibling app in the Workspace sidebar, and can switch between remote dual-bus mode and local program-model mode purely through fill-table edits.

**Architecture:** Reuse the current Workspace app host + mounted truth pattern, but add one new app host model plus one child truth model dedicated to the example. Keep result binding stable while allowing route/connect labels to toggle between remote and local processing. Validate the end-to-end path in both modes, then write a user guide that reconstructs the example from scratch.

**Tech Stack:** ModelTableRuntime, cellwise UI authoring, Workspace mount catalog, owner materialization, remote-worker/MBR role patches, local K8s deployment, Playwright, script-first contract tests.

---

### Task 1: Freeze the example contract

**Files:**
- Create: `scripts/tests/test_0270_workspace_ui_filltable_example_contract.mjs`
- Modify: `docs/ssot/runtime_semantics_modeltable_driven.md` (only if new clarifications are needed)
- Modify: `docs/user-guide/modeltable_user_guide.md` (only if baseline guidance must be extended first)

**Step 1: Write the failing test**
- Assert the repo has no new example app yet
- Assert the example requires:
  - Workspace sidebar entry
  - app host model
  - child truth model
  - remote/local mode labels
  - stable result label

**Step 2: Run the test to verify it fails**

Run: `node scripts/tests/test_0270_workspace_ui_filltable_example_contract.mjs`
Expected: FAIL

**Step 3: Add the minimal contract scaffolding**
- Only if docs need tiny clarifications before implementation

**Step 4: Re-run the test**

Run: `node scripts/tests/test_0270_workspace_ui_filltable_example_contract.mjs`
Expected: PASS or partially green with implementation placeholders explicitly tracked

### Task 2: Add the preloaded Workspace example

**Files:**
- Modify: `packages/worker-base/system-models/workspace_positive_models.json`
- Modify: `packages/worker-base/system-models/workspace_catalog_ui.json`
- Modify: `packages/worker-base/system-models/runtime_hierarchy_mounts.json`
- Test: `scripts/tests/test_0270_workspace_ui_filltable_example_contract.mjs`
- Test: `scripts/tests/test_0270_workspace_ui_filltable_mount_contract.mjs`

**Step 1: Write the failing mount test**
- Assert new sidebar entry exists
- Assert app host model exists
- Assert child truth model is mounted via `model.submt`

**Step 2: Run it to fail**

Run: `node scripts/tests/test_0270_workspace_ui_filltable_mount_contract.mjs`

**Step 3: Implement minimal patch additions**
- Add the new app host model
- Add the child truth model
- Add Workspace registry/mount records

**Step 4: Re-run tests**

Run:
- `node scripts/tests/test_0270_workspace_ui_filltable_example_contract.mjs`
- `node scripts/tests/test_0270_workspace_ui_filltable_mount_contract.mjs`

Expected: PASS

### Task 3: Implement the remote dual-bus mode

**Files:**
- Modify: `packages/worker-base/system-models/workspace_positive_models.json`
- Modify if required: `deploy/sys-v1ns/remote-worker/patches/10_model100.json` or adjacent worker role patches
- Modify if required: `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
- Test: `scripts/tests/test_0270_workspace_ui_filltable_remote_mode_contract.mjs`

**Step 1: Write the failing remote-mode test**
- Assert the example’s confirm action reaches a legal remote submit chain
- Assert result comes back through owner materialization, not direct patch bypass

**Step 2: Run it to fail**

Run: `node scripts/tests/test_0270_workspace_ui_filltable_remote_mode_contract.mjs`

**Step 3: Implement the minimal remote route**
- Reuse the current color-generator transport pattern where possible
- Keep result label stable

**Step 4: Re-run**

Run: `node scripts/tests/test_0270_workspace_ui_filltable_remote_mode_contract.mjs`
Expected: PASS

### Task 4: Implement the local mode switch via fill-table

**Files:**
- Modify: `packages/worker-base/system-models/workspace_positive_models.json`
- Test: `scripts/tests/test_0270_workspace_ui_filltable_local_mode_contract.mjs`

**Step 1: Write the failing local-mode test**
- Assert changing mode/connect labels switches processing to local-only
- Assert the same result label updates
- Assert no bus egress is required in this mode

**Step 2: Run it to fail**

Run: `node scripts/tests/test_0270_workspace_ui_filltable_local_mode_contract.mjs`

**Step 3: Implement the minimal local route**
- Add local function and connect labels
- Preserve same result label / same UI consumption path

**Step 4: Re-run**

Run: `node scripts/tests/test_0270_workspace_ui_filltable_local_mode_contract.mjs`
Expected: PASS

### Task 5: Parameterize layout and style by labels

**Files:**
- Modify: `packages/worker-base/system-models/workspace_positive_models.json`
- Test: `scripts/tests/test_0270_workspace_ui_filltable_props_contract.mjs`

**Step 1: Write the failing props test**
- Assert layout/style labels exist and are consumed by UI props

**Step 2: Run it to fail**

Run: `node scripts/tests/test_0270_workspace_ui_filltable_props_contract.mjs`

**Step 3: Implement label-driven props**
- `layout_direction`
- `input_font_size`
- `button_color` or variant
- `result_text_style`

**Step 4: Re-run**

Run: `node scripts/tests/test_0270_workspace_ui_filltable_props_contract.mjs`
Expected: PASS

### Task 6: Write the user-facing reconstruction guide

**Files:**
- Create: `docs/user-guide/workspace_ui_filltable_example.md`
- Modify: `docs/user-guide/README.md`
- Test: `scripts/tests/test_0270_workspace_ui_filltable_doc_contract.mjs`

**Step 1: Write the failing doc-contract test**
- Assert the guide covers:
  - model creation
  - component placement
  - Workspace mount
  - remote mode
  - local mode
  - delete and rebuild

**Step 2: Run it to fail**

Run: `node scripts/tests/test_0270_workspace_ui_filltable_doc_contract.mjs`

**Step 3: Write the guide**
- Keep it step-by-step and reproducible

**Step 4: Re-run**

Run: `node scripts/tests/test_0270_workspace_ui_filltable_doc_contract.mjs`
Expected: PASS

### Task 7: Full live verification

**Files:**
- Modify: `docs/iterations/0270-workspace-ui-filltable-example/runlog.md`

**Step 1: Run the focused test suite**

Run:
- `node scripts/tests/test_0270_workspace_ui_filltable_example_contract.mjs`
- `node scripts/tests/test_0270_workspace_ui_filltable_mount_contract.mjs`
- `node scripts/tests/test_0270_workspace_ui_filltable_remote_mode_contract.mjs`
- `node scripts/tests/test_0270_workspace_ui_filltable_local_mode_contract.mjs`
- `node scripts/tests/test_0270_workspace_ui_filltable_props_contract.mjs`
- `node scripts/tests/test_0270_workspace_ui_filltable_doc_contract.mjs`
- `node scripts/tests/test_0144_remote_worker.mjs`
- `node scripts/tests/test_0144_mbr_compat.mjs`
- `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
- `node scripts/tests/test_0216_threejs_scene_contract.mjs`

**Step 2: Redeploy**

Run:
- `bash scripts/ops/check_runtime_baseline.sh`
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- `bash scripts/ops/check_runtime_baseline.sh`

**Step 3: Live verify the five required behaviors**
- Home CRUD
- Gallery slider
- Workspace mount chain
- Color generator
- remote-worker + MBR end-to-end

**Step 4: Live verify the new example**
- Sidebar entry visible
- Remote mode works
- Local mode works after fill-table edits
- Delete and rebuild works

**Step 5: Record evidence**
- Browser screenshots or textual evidence
- `ui-server` / `mbr-worker` / `remote-worker` logs
- runlog updates
