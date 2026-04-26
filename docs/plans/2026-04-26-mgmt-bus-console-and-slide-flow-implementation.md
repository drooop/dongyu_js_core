---
title: "Mgmt Bus Console And Slide Flow Implementation Plan"
doc_type: plan
status: approved
updated: 2026-04-26
source: ai
---

# Mgmt Bus Console And Slide Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver iterations `0336` and `0337` with deterministic tests, sub-agent review checkpoints, local deployment, and browser verification.

**Architecture:** Implement in two major stages. First, add model-table UI and event-dispatch support for `Mgmt Bus Console`; second, rewrite slide-flow docs and enforce them with a docs contract test.

**Tech Stack:** Node scripts, `packages/ui-renderer`, `packages/ui-model-demo-frontend`, `packages/worker-base/system-models`, Markdown user guides.

---

### Task 1: Register Iterations And Add 0336 Red Test

**Files:**
- Modify: `docs/ITERATIONS.md`
- Modify: `docs/iterations/0336-mgmt-bus-console-implementation/plan.md`
- Modify: `docs/iterations/0336-mgmt-bus-console-implementation/resolution.md`
- Create: `scripts/tests/test_0336_mgmt_bus_console_contract.mjs`

**Steps:**
- Write the failing test for model `1036` metadata, four-region cellwise UI, text labels, send path, and no-secret guard.
- Run `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs` and verify it fails because model `1036` is absent.

### Task 2: Fill Model 1036 And Pass Contract Test

**Files:**
- Modify: `packages/worker-base/system-models/workspace_positive_models.json`

**Steps:**
- Add model `1036` as a positive `model.table` Workspace app.
- Fill the four-region UI with existing components only.
- Re-run `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs` until it passes.
- Spawn a sub-agent with `codex-code-review` for this stage and fix any findings.

### Task 3: Add Bus Event Dispatch Support If Required

**Files:**
- Modify: `packages/ui-renderer/src/renderer.mjs`
- Modify: `packages/ui-model-demo-frontend/src/ui_cellwise_projection.js`
- Add/modify targeted test under `scripts/tests/`

**Steps:**
- Write a failing dispatch test proving a button can emit `bus_event_v2` to Model 0 with a temporary ModelTable record-array payload.
- Implement the smallest generic bind support needed.
- Run targeted tests and frontend package tests.
- Spawn a sub-agent with `codex-code-review` for this stage and fix any findings.

### Task 4: Add Negative Contract Checks

**Files:**
- Add/modify targeted `scripts/tests/test_*.mjs`
- Modify only narrow guards if existing behavior fails the approved contract.

**Steps:**
- Add or reuse checks for invalid payload rejection, Matrix initial-sync ignore, and MBR generic CRUD rejection.
- Run the targeted tests.
- Spawn a sub-agent with `codex-code-review` and fix any findings.

### Task 5: Add 0337 Red Test And Rewrite Docs

**Files:**
- Create: `scripts/tests/test_0337_slide_flow_docs_contract.mjs`
- Modify: `docs/user-guide/slide_delivery_and_runtime_overview_v1.md`
- Modify targeted related docs only if required by the test.

**Steps:**
- Write the failing doc contract test.
- Rewrite the slide overview into the four-part current-truth structure.
- Run the doc test and text searches until they pass.
- Spawn a sub-agent with `codex-code-review` and fix any findings.

### Task 6: Local Verification And Completion

**Files:**
- Modify runlogs and iteration index after evidence is collected.

**Steps:**
- Run deterministic tests and frontend build/test.
- Redeploy or restart the local runtime if UI/runtime behavior is affected.
- Use browser automation against `http://127.0.0.1:30900/#/workspace` to open `Mgmt Bus Console` and exercise the composer/send path.
- Update runlogs and mark iterations completed.
