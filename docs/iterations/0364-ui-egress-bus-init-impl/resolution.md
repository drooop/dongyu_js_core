---
id: 0364
title: ui-egress-bus-init-impl
doc_type: iteration_resolution
status: Completed
updated: 2026-05-10
source: ai
branch: dev_0364-ui-egress-bus-init-impl
iteration_id: 0364-ui-egress-bus-init-impl
phase: phase1
---

# Resolution

## Execution Strategy

Proceed in bounded stages. Each stage must add or update tests before production changes, record verification in `runlog.md`, and pass sub-agent review before the next stage starts.

## Step 1 - Iteration Setup

- Scope: Fill iteration plan, resolution, runlog, and register 0364 in the iteration index.
- Files: `docs/iterations/0364-ui-egress-bus-init-impl/*`, `docs/ITERATIONS.md`.
- Verification: `git diff --check`; review gate over docs-only setup.
- Acceptance: Plan includes done criteria, stage boundaries, verification, and review gates.
- Rollback: Remove 0364 scaffold and index row before implementation.

## Step 2 - Runtime Contract

- Scope: Implement split bus pin types, DEM role validation, startup restore ordering guards where needed, and old bus pin rejection.
- Files: `packages/worker-base/src/runtime.mjs`, runtime tests.
- Verification: New 0364 runtime test plus affected existing pin/bus validators.
- Acceptance: Old `pin.bus.in/out` fail; split bus pins work only in valid locations and roles.
- Rollback: Revert runtime/test changes for this step.

## Step 3 - Installer / Importer / UI Server

- Scope: Enforce provider ZIP constraints, generate host-owned `ui.egress.binding.v1`, update host ingress/egress adapters to split bus pins, and update event paths.
- Files: `packages/ui-model-demo-server/**`, importer/export tests.
- Verification: Updated slide import/export and minimal submit contract tests.
- Acceptance: Provider patch cannot carry host bus/binding labels; host materialization creates the binding and real pin route.
- Rollback: Revert server/test changes for this step.

## Step 4 - System Fill-Table And Existing UI Models

- Scope: Refill ui-server, mbr, remote-worker, and current UI models to the new split-bus contract.
- Files: `packages/worker-base/system-models/**`, `deploy/sys-v1ns/**`, test fixtures and UI model payloads.
- Verification: Static scans and fixture tests prove no active old bus pins or forbidden compatibility labels remain.
- Acceptance: System and deploy patches match DEM/non-DEM rules.
- Rollback: Revert fill-table patch updates for this step.

## Step 5 - Minimal Submit And Docs

- Scope: Update minimal Submit JSON patch, ZIP/export instructions, userguide, visualized/static HTML docs, and topic/route explanation.
- Files: `docs/user-guide/slide-app-runtime/**`, related assets/tests.
- Verification: Docs contract tests and package checks for generated artifacts.
- Acceptance: Docs describe current split-bus and host-owned binding flow only.
- Rollback: Revert docs/assets for this step.

## Step 6 - Local Deploy And Browser E2E

- Scope: Refresh local deployment and run real-browser tests for workspace, color generator, and minimal Submit dual-bus app.
- Files: deploy artifacts only if needed.
- Verification: Playwright evidence against `http://127.0.0.1:30900/#/workspace`.
- Acceptance: Browser flow proves the current runtime path, not a script-only shortcut.
- Rollback: Restore previous local runtime state if needed.

## Step 7 - Closure

- Scope: Final code review, status updates, commit, and merge readiness.
- Verification: Final review plus consolidated command evidence.
- Acceptance: All review gates passed and `docs/ITERATIONS.md` is marked Completed.
