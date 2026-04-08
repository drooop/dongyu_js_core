---
title: "Slide App Zip Import v1 Implementation Plan"
doc_type: plan
status: active
updated: 2026-04-08
source: ai
---

# Slide App Zip Import v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let Workspace import one declarative slide app zip, mount it, open it, and delete it.

**Architecture:** Add one importer app in Workspace, validate one zipped temporary-modeltable payload, materialize it into new positive models with sequential ids, and extend Workspace registry/delete handling to treat imported apps as first-class entries.

**Tech Stack:** Node.js, existing ui-server host APIs, `adm-zip`, ModelTable runtime, Workspace registry projection, Playwright/browser verification.

---

### Task 1: Register Iteration And Freeze Docs

**Files:**
- Modify: `docs/ITERATIONS.md`
- Create: `docs/iterations/0302-slide-app-zip-import-v1/plan.md`
- Create: `docs/iterations/0302-slide-app-zip-import-v1/resolution.md`
- Create: `docs/iterations/0302-slide-app-zip-import-v1/runlog.md`

**Step 1:** add `0302` entry and docs skeleton  
**Step 2:** record user approval and frozen constraints  
**Step 3:** verify docs parse cleanly with docs audit

### Task 2: Write Failing Contract Tests

**Files:**
- Create: `scripts/tests/test_0302_slide_app_zip_import_contract.mjs`
- Create: `scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs`

**Step 1:** write contract test for importer app models, registry fields, and delete button  
**Step 2:** run to confirm FAIL  
**Step 3:** write server-flow test for zip import -> registry mount -> delete -> cleanup  
**Step 4:** run to confirm FAIL

### Task 3: Add Importer Workspace App

**Files:**
- Modify: `packages/ui-model-demo-frontend/src/model_ids.js`
- Modify: `packages/worker-base/system-models/workspace_positive_models.json`

**Step 1:** add fixed ids for importer host/truth  
**Step 2:** add importer UI page with zip upload + import status  
**Step 3:** add truth labels for import media uri/name/status/result  
**Step 4:** run contract test and keep it failing only on backend gaps

### Task 4: Implement Zip Import Materialization

**Files:**
- Modify: `packages/ui-model-demo-server/server.mjs`

**Step 1:** add zip payload extraction and validation helpers  
**Step 2:** add minimal metadata-field validation  
**Step 3:** add sequential model id allocation  
**Step 4:** add payload remap/materialize logic  
**Step 5:** run server-flow test and make import pass

### Task 5: Implement Workspace Delete Cleanup

**Files:**
- Modify: `packages/ui-model-demo-server/server.mjs`
- Modify: `packages/worker-base/system-models/workspace_catalog_ui.json`
- Modify: `packages/worker-base/system-models/intent_handlers_ws.json`

**Step 1:** expose delete action on sidebar rows  
**Step 2:** make delete handler accept row value directly  
**Step 3:** implement full imported-app cleanup in runtime + sqlite  
**Step 4:** run server-flow test and make delete pass

### Task 6: Regression, Docs, And Live Verification

**Files:**
- Modify: `docs/iterations/0302-slide-app-zip-import-v1/runlog.md`
- Create: `docs/user-guide/slide_app_zip_import_v1.md`
- Modify: `docs/user-guide/README.md`

**Step 1:** run contract/server-flow tests and 0284/0270/static regressions  
**Step 2:** redeploy local and verify Workspace import/delete in browser  
**Step 3:** update runlog and user guide  
**Step 4:** run docs audit
