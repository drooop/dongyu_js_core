---
title: "Imported Slide App Host Ingress Implementation Plan"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Imported Slide App Host Ingress Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the first runtime-backed implementation of host-owned ingress for imported slide apps, using v1 root-relative boundary pin declarations and automatic Model 0 routing.

**Architecture:** Extend imported slide payload validation to accept one explicit v1 host ingress declaration for a primary `submit` boundary pin, then materialize a host-owned adapter on installation that routes a Model 0 ingress port to the imported app boundary pin. Keep existing direct-pin behavior in place for compatibility; this iteration adds the new host-ingress path rather than removing current paths.

**Tech Stack:** Node.js, ui-server import materialization, ModelTable runtime `pin.connect.model`, existing imported slide app tests, docs audit.

---

### Task 1: Freeze Iteration Docs And Register The Approved Scope

**Files:**
- Modify: `docs/ITERATIONS.md`
- Modify: `docs/iterations/0321-imported-slide-app-host-ingress-implementation/plan.md`
- Modify: `docs/iterations/0321-imported-slide-app-host-ingress-implementation/resolution.md`
- Modify: `docs/iterations/0321-imported-slide-app-host-ingress-implementation/runlog.md`

**Step 1:** confirm `0321` scope stays on one semantic (`submit`) and one locator form (`root-relative`)  
**Step 2:** record user approval and locked implementation shape  
**Step 3:** run `node scripts/ops/obsidian_docs_audit.mjs --root docs`

### Task 2: Write The Failing Contract Tests

**Files:**
- Create: `scripts/tests/test_0321_imported_host_ingress_contract.mjs`
- Create: `scripts/tests/test_0321_imported_host_ingress_server_flow.mjs`

**Step 1:** write contract assertions for:
- imported payload must declare one primary host ingress boundary
- locator form must be `root-relative`
- host route must be generated on install

**Step 2:** run them and confirm FAIL  
**Step 3:** add server-flow test for:
- install imported app with host ingress declaration
- send mailbox submit into host route
- assert imported app boundary pin receives the event

### Task 3: Implement Payload Schema And Validation

**Files:**
- Modify: `packages/ui-model-demo-server/server.mjs`

**Step 1:** add one explicit root label schema for host ingress declaration  
**Step 2:** validate:
- only one primary `submit` boundary
- locator form is `root-relative`
- referenced cell/pin exists and is `pin.in`
**Step 3:** keep forbidden/legacy cases rejecting with explicit errors  
**Step 4:** rerun contract tests

### Task 4: Materialize Host-Owned Adapter

**Files:**
- Modify: `packages/ui-model-demo-server/server.mjs`

**Step 1:** during import, after model id remap, compute imported boundary target cell  
**Step 2:** create one host-owned Model 0 ingress port and `pin.connect.model` route to the imported boundary pin  
**Step 3:** name route deterministically from imported model id + semantic  
**Step 4:** extend uninstall cleanup so wsDeleteApp/removeImportedBundleFromRuntime also remove host-owned ingress labels and routes  
**Step 5:** add delete-flow verification that imports one app, deletes it, and proves host-owned Model 0 labels/routes are gone  
**Step 6:** rerun server-flow test until PASS

### Task 5: Regression And Docs Alignment

**Files:**
- Modify: `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
- Modify: `docs/ssot/runtime_semantics_modeltable_driven.md`
- Modify: `docs/ssot/label_type_registry.md`
- Modify: `docs/user-guide/modeltable_user_guide.md`
- Modify: `docs/handover/dam-worker-guide.md`
- Modify: `docs/iterations/0321-imported-slide-app-host-ingress-implementation/runlog.md`

**Step 1:** run:
- `node scripts/tests/test_0321_imported_host_ingress_contract.mjs`
- `node scripts/tests/test_0321_imported_host_ingress_server_flow.mjs`
- `node scripts/tests/test_0307_executable_import_contract.mjs`
- `node scripts/tests/test_0307_executable_import_server_flow.mjs`
- `node scripts/tests/test_0306_runtime_mailbox_ingress_contract.mjs`
- `node scripts/ops/obsidian_docs_audit.mjs --root docs`

**Step 2:** record PASS/FAIL and commit hashes in runlog  
**Step 3:** update authoritative SSOT wording for:
- imported boundary pin declaration
- host-generated Model 0 ingress route
- uninstall cleanup of host-owned adapter labels
**Step 4:** update living docs for:
- `docs/user-guide/modeltable_user_guide.md`
- `docs/handover/dam-worker-guide.md`
