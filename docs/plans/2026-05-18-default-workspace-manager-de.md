---
title: "Default Workspace Manager DE Implementation Plan"
doc_type: plan
status: completed
updated: 2026-05-19
source: ai
---

# Default Workspace Manager DE Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a default Workspace Manager DE with one DEM worker and expose its first slide app through the existing UI-Server host/control-bus path.

**Architecture:** UI-Server remains a thin slide app host. Workspace Manager is a system-default DE whose DEM owns service behavior and provides a slide app that UI-Server can install, mount, and operate through Model 0 and control-bus routing. PICS is documented as a future default DE, but not implemented in this iteration.

**Tech Stack:** ModelTable JSON patches, `ModelTableRuntime`, Node validation scripts, Vue UI demo, Playwright browser verification.

---

## Task 1: Governance and Contract

**Files:**
- Modify: `docs/ITERATIONS.md`
- Modify: `docs/iterations/0377-default-workspace-manager-de/plan.md`
- Modify: `docs/iterations/0377-default-workspace-manager-de/resolution.md`
- Modify: `docs/iterations/0377-default-workspace-manager-de/runlog.md`
- Modify: `docs/architecture_mantanet_and_workers.md`
- Modify: `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md`

**Steps:**
- Write the 0377 iteration contract.
- Add docs that distinguish `Workspace-Manager-DE` and `PICS-DE` from UI-Server-owned built-ins.
- Run targeted `rg` checks for required and forbidden wording.
- Ask a sub-agent to run `codex-code-review` on the docs slice.
- Fix all findings before Task 2.

## Task 2: Workspace Manager DEM Patch

**Files:**
- Create: `deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json`
- Modify: `scripts/ops/sync_local_persisted_assets.sh`
- Create: `scripts/tests/test_0377_workspace_manager_de_contract.mjs`

**Steps:**
- Write a failing validation test for the new role patch.
- Add the fill-table patch with `sys_worker_id`, `sys_worker_role=DEM`, and legal bus pins.
- Add sync support if local persisted assets need it.
- Run the test and forbidden-label scan.
- Ask a sub-agent to review the fill-table slice.
- Fix all findings before Task 3.

## Task 3: Workspace Manager Slide App

**Files:**
- Modify or create: positive model patch/model asset for the Workspace Manager slide app.
- Modify: `scripts/tests/test_0377_workspace_manager_de_contract.mjs`

**Steps:**
- Add a failing test for app discoverability and no direct bus pins.
- Add a minimal cellwise Workspace Manager UI model with asset tree and one action pin.
- Run UI validation and the 0377 contract test.
- Ask a sub-agent to review the slide app model slice.
- Fix all findings before Task 4.

## Task 4: Local Deployment and Browser Verification

**Files:**
- Modify: `docs/iterations/0377-default-workspace-manager-de/runlog.md`
- Optional: `docs/iterations/0377-default-workspace-manager-de/assets/*`

**Steps:**
- Refresh the local deployment after model changes.
- Use a real browser to open Workspace.
- Verify Workspace Manager appears, renders, and can trigger one DEM-backed result.
- Re-check existing color/minimal submit paths.
- Ask a sub-agent to review the verification evidence.
- Fix all findings before Task 5.

## Task 5: Final Review

**Files:**
- Modify: `docs/ITERATIONS.md`
- Modify: `docs/iterations/0377-default-workspace-manager-de/runlog.md`

**Steps:**
- Run the final targeted test set and `git diff --check`.
- Ask a sub-agent to review the full 0377 diff.
- Fix findings, rerun verification, and repeat review until approved.
- Mark the iteration completed only after all checks pass.
