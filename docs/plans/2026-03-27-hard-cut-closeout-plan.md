---
title: "Hard-Cut Closeout Implementation Plan"
doc_type: plan
status: active
updated: 2026-03-29
source: ai
---

# Hard-Cut Closeout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成本次 hard-cut program 的最后收尾，让 `cellwise.ui.v1` 成为唯一 authoring source，`pin/owner-materialization` 成为唯一 business write 路径，并拿到可靠的本地浏览器证据。

**Architecture:** 先把“权威 source 已切换”与“验证链仍滞后”的问题分开处理。`0257` 先完成 source deletion 和 contract/validator 对齐，再单独修复 editor/test 页的事件消费稳定性，最后恢复 live local browser 验收链。整个收尾过程禁止再新增 legacy `page_asset_v0` source 或 direct positive-model write。

**Tech Stack:** ModelTableRuntime, Vue 3, Element Plus, ui-renderer, ui-model-demo-frontend, ui-model-demo-server, Playwright MCP, script-first contract tests.

---

### Task 1: Freeze The Closeout Scope

**Files:**
- Modify: `docs/iterations/0255-hard-cut-bind-write-pin-only-cutover/plan.md`
- Modify: `docs/iterations/0255-hard-cut-bind-write-pin-only-cutover/resolution.md`
- Modify: `docs/iterations/0256-hard-cut-first-page-rebuild/plan.md`
- Modify: `docs/iterations/0256-hard-cut-first-page-rebuild/resolution.md`
- Modify: `docs/iterations/0257-hard-cut-legacy-path-deletion/plan.md`
- Modify: `docs/iterations/0257-hard-cut-legacy-path-deletion/resolution.md`

**Step 1: Update 0255 scope**

Declare `0255` done only for:
- generic owner intent transport
- local/isolated/live parity for positive schema write

Explicitly exclude:
- system page source deletion
- editor/test-page cleanup
- Docker/build infra repair

**Step 2: Update 0256 scope**

Declare `0256` done only for:
- first writable page browser proof on `1001`
- proof artifact generation

Explicitly exclude:
- system page browser proof
- editor test route

**Step 3: Update 0257 scope**

Split 0257 into:
- `Tranche A`: positive example pages
- `Tranche B`: system pages source deletion + contract migration
- `Tranche C`: editor/test route, remaining validators, live verification recovery

**Step 4: Save**

Record that the remaining blockers are now:
- editor validator mailbox sequencing
- local live deploy/build reliability

---

### Task 2: Complete 0257 Tranche B Contract Migration

**Files:**
- Modify: `scripts/tests/test_0212_home_crud_contract.mjs`
- Modify: `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
- Modify: `scripts/tests/test_0216_threejs_scene_contract.mjs`
- Modify: `scripts/tests/test_0217_gallery_extension_contract.mjs`
- Modify: `scripts/tests/test_0235_home_surface_contract.mjs`
- Modify: `scripts/tests/test_0257_legacy_path_inventory_contract.mjs`
- Modify: `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`

**Step 1: Keep the tests red-first**

Before each assertion rewrite:
- run the target test
- capture the exact failure

**Step 2: Rewrite contracts to new source semantics**

Change assertions from:
- `page_asset_v0 exists on model`

To:
- `ui_authoring_version = cellwise.ui.v1`
- `ui_root_node_id is stable`
- expected `ui_node_id` / `ui_props_json` / `ui_bind_*` records exist

**Step 3: Keep business behavior assertions**

Do not relax:
- action names
- mounted model ids
- write targets
- no-direct-write guarantees

**Step 4: Re-run each migrated contract**

Run:
- `node scripts/tests/test_0212_home_crud_contract.mjs`
- `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
- `node scripts/tests/test_0216_threejs_scene_contract.mjs`
- `node scripts/tests/test_0217_gallery_extension_contract.mjs`
- `node scripts/tests/test_0235_home_surface_contract.mjs`
- `node scripts/tests/test_0257_legacy_path_inventory_contract.mjs`

Expected:
- all PASS

---

### Task 3: Complete 0257 Tranche B Runtime Consumer Migration

**Files:**
- Modify: `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
- Modify: `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- Modify: `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Modify: `packages/ui-model-demo-frontend/src/gallery_store.js`
- Modify: `scripts/tests/test_0191a_page_asset_resolver.mjs`
- Modify: `scripts/tests/test_0191b_gallery_asset_resolution.mjs`
- Modify: `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`

**Step 1: Make route resolution cellwise-first**

For route pages with `asset_type=model_label`:
- try explicit `page_asset_v0` label if present
- otherwise compile cellwise from the target model

**Step 2: Keep backward read compatibility only where required**

Allowed:
- read legacy `asset_ref` metadata from nav catalog

Not allowed:
- require `page_asset_v0` source to exist on the target model

**Step 3: Migrate gallery and local demo helpers**

Ensure helper stores no longer assume:
- `getLabelValue(... page_asset_v0)` is the only source

**Step 4: Re-run**

Run:
- `node scripts/tests/test_0191a_page_asset_resolver.mjs`
- `node scripts/tests/test_0191b_gallery_asset_resolution.mjs`
- `node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`

Expected:
- all PASS

---

### Task 4: Finish 0257 Tranche C Source Deletion

**Files:**
- Modify: `packages/worker-base/system-models/editor_test_catalog_ui.json`
- Modify: `packages/worker-base/system-models/home_catalog_ui.json`
- Modify: `packages/worker-base/system-models/docs_catalog_ui.json`
- Modify: `packages/worker-base/system-models/static_catalog_ui.json`
- Modify: `packages/worker-base/system-models/prompt_catalog_ui.json`
- Modify: `packages/worker-base/system-models/workspace_catalog_ui.json`
- Modify: `packages/worker-base/system-models/gallery_catalog_ui.json`
- Modify: `packages/worker-base/system-models/matrix_debug_surface.json`
- Test helper: `scripts/lib/page_asset_to_cellwise.mjs`
- Test: `scripts/tests/test_0257_page_asset_to_cellwise_migration_contract.mjs`

**Step 1: Use the migration helper, do not hand-retype ASTs**

Convert legacy `page_asset_v0` sources into:
- `ui_authoring_version`
- `ui_root_node_id`
- node-level `ui_*` labels

**Step 2: Verify every migrated model**

Run targeted JSON sanity check:
- parse each patch file
- ensure `page_asset_v0` source record removed
- ensure root authoring labels exist

**Step 3: Re-run inventory**

Run:
- `node scripts/tests/test_0257_legacy_path_inventory_contract.mjs`

Expected:
- PASS that authoritative source removal is complete

---

### Task 5: Repair Editor/Test Route Validation

**Files:**
- Modify: `packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
- Inspect: `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Inspect: `packages/ui-renderer/src/renderer.mjs`
- Inspect: `packages/ui-model-demo-frontend/src/demo_app.js`

**Step 1: Write a minimal reproduction inside validator flow**

Add temporary pinpoint assertions or logs to answer:
- which exact step leaves mailbox occupied
- whether the problem is duplicate `dispatchAddLabel`
- whether route change and button dispatch overlap

**Step 2: Keep the fix narrow**

Only fix one of:
- validator sequencing
- stale mailbox precondition handling
- renderer/store event consumption order

Do not redesign editor page behavior here.

**Step 3: Verify**

Run:
- `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`

Expected:
- PASS without `event_mailbox_full`

---

### Task 6: Restore Local Live Verification Path

**Files:**
- Inspect: `scripts/ops/deploy_local.sh`
- Inspect: `k8s/Dockerfile.ui-server`
- Inspect: local Docker build behavior
- Optional docs note: `docs/iterations/0257-hard-cut-legacy-path-deletion/runlog.md`

**Step 1: Reproduce deploy failure deterministically**

Capture:
- BuildKit TLS failure against `registry-1.docker.io`
- whether cached local images allow classic builder fallback

**Step 2: Choose the minimal local-only recovery**

Allowed:
- local build invocation change
- local deploy fallback path

Not allowed:
- remote changes
- insecure global Docker mutations without evidence

**Step 3: Verify baseline**

Run:
- `bash scripts/ops/check_runtime_baseline.sh`
- if needed `bash scripts/ops/deploy_local.sh` or local fallback path

Expected:
- local live environment reachable again on `30900`

---

### Task 7: Final Browser Proof For System Pages

**Files:**
- Output only: `output/playwright/0257-hard-cut-legacy-path-deletion/**`
- Optional docs note: `docs/iterations/0257-hard-cut-legacy-path-deletion/runlog.md`

**Step 1: Source-mode smoke**

Use local source mode (`5173?mode=local`) to confirm:
- Home
- Prompt
- Gallery
- Workspace selected `-100`

**Step 2: Live mode smoke**

After live deploy path is restored, use `30900` to confirm:
- Home route
- Prompt route
- Gallery route
- Workspace with `Matrix Debug`

**Step 3: Save screenshots**

Capture at least:
- Home
- Prompt
- Gallery
- Matrix Debug / Workspace

**Step 4: Record conclusion**

Only when both are true:
- contracts/validators PASS
- browser evidence exists

Then 0257 can be called completed.

---

### Task 8: Final Closeout

**Files:**
- Modify: `docs/iterations/0257-hard-cut-legacy-path-deletion/runlog.md`
- Modify: `docs/ITERATIONS.md`

**Step 1: Record exact final state**

State explicitly:
- `page_asset_v0` no longer authoritative source
- `cellwise.ui.v1` is the only authoring source for migrated pages
- remaining legacy references are metadata/comments only, if any

**Step 2: Mark status**

Set:
- `0257 = Completed`

Only if:
- Task 2-7 all succeeded

**Step 3: Summarize residual risks**

If any remain, list only real residuals such as:
- known local Docker TLS/build fragility
- non-authoritative comments still mentioning `page_asset_v0`
