---
title: "Cloud Worker Sync And Color Proxy Import Implementation"
doc_type: plan
status: active
updated: 2026-04-09
source: ai
---

# Cloud Worker Sync And Color Proxy Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the public color generator by syncing cloud workers, then produce and verify a color-generator proxy import zip.

**Architecture:** Keep the imported app projection-only. The new imported app host binds to the existing `Model 100` and `Model -2` labels, so the imported app behaves like a second entrypoint into the same color-generator truth and action path.

**Tech Stack:** Node scripts, ModelTable patch payloads, workspace zip importer, local/cloud deploy scripts, Playwright browser verification.

---

### Task 1: Lock the proxy import contract with failing tests

**Files:**
- Create: `scripts/tests/test_0303_color_generator_proxy_import_contract.mjs`
- Create: `scripts/tests/test_0303_color_generator_proxy_import_server_flow.mjs`

**Step 1: Write the failing tests**

- Contract test:
  - assert `test_files/color_generator_proxy_app_payload.json` exists
  - assert `test_files/color_generator_proxy_import.zip` exists
  - assert payload root metadata matches `0302`
  - assert payload binds to `model_id=100` and `model_id=-2`
- Server-flow test:
  - import the zip payload into a fresh server state
  - assert imported app enters registry
  - assert imported app still references `Model 100 / Model -2`

**Step 2: Run tests to verify they fail**

Run:
- `node scripts/tests/test_0303_color_generator_proxy_import_contract.mjs`
- `node scripts/tests/test_0303_color_generator_proxy_import_server_flow.mjs`

### Task 2: Build the proxy payload and zip

**Files:**
- Create: `test_files/color_generator_proxy_app_payload.json`
- Create: `test_files/color_generator_proxy_import.zip`

**Step 1: Write minimal payload**

- One slide-capable host model
- No child truth model required
- UI fields mirror the current color generator
- Bindings read/write:
  - `Model 100` root labels for color/status/system_ready
  - `Model -2 model100_input_draft` for text input
  - `submit` action with `meta.model_id = 100`

**Step 2: Create zip**

- zip must contain exactly one JSON file

### Task 3: Verify locally

**Files:**
- Update: `docs/iterations/0303-cloud-worker-sync-and-color-proxy-import/runlog.md`

**Step 1: Import locally**

Run local deploy and browser verification.

**Step 2: Verify behavior**

- imported app appears in Workspace
- imported app opens
- generating color updates the same values as `Model 100`
- delete removes the imported app

### Task 4: Sync cloud workers and verify public behavior

**Files:**
- Update: `docs/iterations/0303-cloud-worker-sync-and-color-proxy-import/runlog.md`

**Step 1: Roll out cloud workers**

- sync revision
- update `mbr-worker`
- update `remote-worker`
- verify pod hashes

**Step 2: Verify public color generator**

- open public Workspace
- run color generator
- confirm processed result returns

### Task 5: Verify the proxy import publicly and close the iteration

**Files:**
- Update: `docs/iterations/0303-cloud-worker-sync-and-color-proxy-import/runlog.md`
- Update: `docs/iterations/0303-cloud-worker-sync-and-color-proxy-import/resolution.md`
- Update: `docs/ITERATIONS.md`

**Step 1: Import proxy zip on public workspace**

- verify imported app opens
- verify generate action matches color generator
- verify delete cleanup

**Step 2: Final checks**

- docs audit
- no leftover temporary apps
- merge to `dev`
