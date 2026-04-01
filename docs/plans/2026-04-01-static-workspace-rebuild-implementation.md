---
title: "Static Workspace Rebuild Implementation Plan"
doc_type: implementation-plan
status: active
updated: 2026-04-01
source: ai
---

# Static Workspace Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the old Static page as a formal Workspace app using a positive app host plus child truth model, while keeping the `/p/<projectName>/...` serving rule and validating real uploads.

**Architecture:** Reuse the existing static serving and upload host APIs, but move the visible entry and page state to `Model 1011`/`Model 1012`. Keep Workspace as the only formal user entry, keep static files mounted under `/p/<projectName>/...`, and verify with a real uploaded HTML artifact.

**Tech Stack:** ModelTable patches, cellwise UI authoring, Workspace registry, ui-server host APIs, local K8s deploy, Playwright, script-first contract tests.

---

### Task 1: Freeze the Static rebuild contract

**Files:**
- Create: `scripts/tests/test_0272_static_workspace_contract.mjs`
- Create: `scripts/tests/test_0272_static_workspace_mount_contract.mjs`

**Step 1: Write failing tests**
- app host exists
- truth model exists
- Workspace registry contains the new app
- `Model 0 -> app -> truth` mount chain exists
- truth model owns `static_*` fields

**Step 2: Run tests to verify fail**

Run:
- `node scripts/tests/test_0272_static_workspace_contract.mjs`
- `node scripts/tests/test_0272_static_workspace_mount_contract.mjs`

### Task 2: Add new Workspace Static app models

**Files:**
- Modify: `packages/ui-model-demo-frontend/src/model_ids.js`
- Modify: `packages/worker-base/system-models/workspace_positive_models.json`
- Modify: `packages/worker-base/system-models/runtime_hierarchy_mounts.json`

**Step 1: Implement app host + truth model patches**
- add `Model 1011` app host
- add `Model 1012` truth model
- add Workspace registry entry
- add mount chain

**Step 2: Re-run contract tests**

Run:
- `node scripts/tests/test_0272_static_workspace_contract.mjs`
- `node scripts/tests/test_0272_static_workspace_mount_contract.mjs`

### Task 3: Rebuild Static page UI in cellwise form

**Files:**
- Modify: `packages/worker-base/system-models/workspace_positive_models.json`
- Create: `scripts/tests/test_0272_static_workspace_ui_contract.mjs`

**Step 1: Write failing UI contract**
- input exists
- upload type selector exists
- file upload exists
- upload button exists
- refresh button exists
- projects table exists

**Step 2: Implement minimal page**

**Step 3: Re-run**

Run:
- `node scripts/tests/test_0272_static_workspace_ui_contract.mjs`

### Task 4: Move static action ownership from `-2` to truth model

**Files:**
- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify if needed: `packages/worker-base/system-models/intent_handlers_static.json`
- Create: `scripts/tests/test_0272_static_action_ownership_contract.mjs`

**Step 1: Write failing ownership test**
- upload/list/delete actions must read state from `Model 1012`
- not from `-2`

**Step 2: Implement minimal host/action migration**

**Step 3: Re-run**

Run:
- `node scripts/tests/test_0272_static_action_ownership_contract.mjs`

### Task 5: Preserve `/p/<projectName>/...` access and real upload path

**Files:**
- Create: `scripts/tests/test_0272_static_publish_path_contract.mjs`
- Create if needed: `scripts/tests/test_0272_static_real_upload_contract.mjs`

**Step 1: Write failing tests**
- uploaded project remains accessible under `/p/<projectName>/...`
- html and zip are both accepted

**Step 2: Implement missing glue only**

**Step 3: Re-run**

Run:
- `node scripts/tests/test_0272_static_publish_path_contract.mjs`
- `node scripts/tests/test_0272_static_real_upload_contract.mjs`

### Task 6: Write the user guide

**Files:**
- Create: `docs/user-guide/static_workspace_rebuild.md`
- Modify: `docs/user-guide/README.md`
- Create: `scripts/tests/test_0272_static_doc_contract.mjs`

**Step 1: Write failing doc contract**
- must cover:
  - Workspace entry
  - project name
  - upload kind
  - upload html
  - upload zip
  - `/p/<projectName>/...`
  - model ownership

**Step 2: Write guide**

**Step 3: Re-run**

Run:
- `node scripts/tests/test_0272_static_doc_contract.mjs`

### Task 7: Full local verification

**Files:**
- Modify: `docs/iterations/0272-static-workspace-rebuild/runlog.md`

**Step 1: Focused test suite**

Run:
- `node scripts/tests/test_0272_static_workspace_contract.mjs`
- `node scripts/tests/test_0272_static_workspace_mount_contract.mjs`
- `node scripts/tests/test_0272_static_workspace_ui_contract.mjs`
- `node scripts/tests/test_0272_static_action_ownership_contract.mjs`
- `node scripts/tests/test_0272_static_publish_path_contract.mjs`
- `node scripts/tests/test_0272_static_real_upload_contract.mjs`
- `node scripts/tests/test_0272_static_doc_contract.mjs`

**Step 2: Redeploy**

Run:
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- `bash scripts/ops/check_runtime_baseline.sh`

**Step 3: Live verify**
- open Workspace Static app
- upload one HTML file
- verify `/p/<projectName>/...`
- upload one zip
- verify `/p/<projectName>/...`
- upload `docs/user-guide/workspace_ui_filltable_example_visualized.html`

**Step 4: Record evidence**

