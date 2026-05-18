---
title: "0377 - Default Workspace Manager DE Plan"
doc_type: iteration-plan
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0377-default-workspace-manager-de
id: 0377-default-workspace-manager-de
phase: completed
---

# Iteration 0377-default-workspace-manager-de Plan

## Goal

Create the first system-default Workspace Manager digital employee (DE) as a ModelTable-described service provider, with one DEM software worker under it, and expose a minimal Workspace Manager slide app contract that UI-Server can install and use through the same control-bus route shape as remote-worker provided apps.

## Scope

- In scope:
- Register the system role model: `Workspace-Manager-DE` is a default DE, not a UI-Server built-in page.
- Define that `Workspace-Manager-DE` initially contains exactly one software worker, whose `sys_worker_role` is `DEM`.
- Add fill-table assets for the Workspace Manager DEM, following the current `sys_worker_id` / `sys_worker_role` and split bus pin contracts.
- Add a minimal Workspace Manager slide app model that presents the asset tree and can trigger one DEM-backed action through the formal pin/control-bus path.
- Add deterministic tests that prove the new default DE/DEM patch does not use legacy pin forms and is routable through `pin.bus.cb.*`.
- Redeploy locally and verify in a real browser that the Workspace Manager slide app appears in Workspace and that an action reaches the DEM-backed route and updates the UI projection.
- Record sub-agent code review after every implementation stage and fix all findings before continuing.
- Out of scope:
- Implementing PICS-DE creation of new DE/DEM/V1N. This iteration only freezes PICS as future default-DE architecture.
- Replacing the whole Workspace visual design. This iteration creates the system-DE foundation and a minimal app; the broader visual redesign remains follow-up work.
- Adding `pin.connect.model`, legacy endpoint prefixes, or any compatibility parser.
- Making UI-Server the business owner of Workspace Manager or PICS functions.

## Invariants / Constraints

- `CLAUDE.md` is the highest execution constraint.
- UI-Server is a slide app host and event relay. It must not become the business truth source for Workspace Manager services.
- `Workspace-Manager-DE` and future `PICS-DE` are digital employees. Their services are provided by their own DEM software workers.
- Formal UI business events must enter through the worker root Model 0 system boundary and use the current split bus pins.
- Positive slide app models may only expose ordinary `pin.in` / `pin.out`; they must not directly declare `pin.bus.cb.*` or `pin.bus.mb.*`.
- All pin payloads must be Temporary ModelTable record arrays: format is ModelTable-like, persistence is explicit materialization.
- Only current connection labels are allowed: `pin.connect.label` and `pin.connect.cell`.
- `pin.connect.model`, `(self, ...)`, `(func, ...)`, `pin.log.*`, legacy `BUS_IN` / `BUS_OUT`, old `worker.role` key, `is_DEM`, and `v1n_id` are forbidden as new current inputs.
- Each implementation stage must end with sub-agent review using `codex-code-review`; the next stage can start only after review is `APPROVED` or all `CHANGE_REQUESTED` findings are fixed and re-reviewed.

## Success Criteria

- `docs/ITERATIONS.md` registers this iteration and this plan/resolution/runlog are filled.
- SSOT/user-guide docs clearly state that Workspace Manager and PICS are default DEs, not UI-Server owned business pages.
- A new Workspace Manager worker patch exists under `deploy/sys-v1ns/` and declares:
  - `sys_worker_id` with `t="worker.id"`;
  - `sys_worker_role` with `t="worker.role"` and `v="DEM"`;
  - Model 0 control bus pins;
  - no legacy pin/worker labels.
- A minimal Workspace Manager slide app model exists and can be discovered by Workspace.
- Tests validate:
  - Workspace Manager DEM patch shape;
  - no legacy pin connection forms;
  - positive slide app has no bus pins;
  - control-bus route packet uses the current Temporary ModelTable payload format.
- Local deployment is refreshed before browser verification.
- Browser verification at `http://127.0.0.1:30900/#/workspace` confirms:
  - Workspace Manager appears as a slide app;
  - opening it renders the asset tree view;
  - a DEM-backed action returns a visible result through the formal route path.
- Final sub-agent review is `APPROVED`.

## Inputs

- Created at: 2026-05-18
- Iteration ID: 0377-default-workspace-manager-de
- User-approved scope:
  - MBR and R1 remain existing roles.
  - This iteration additionally creates the Workspace Manager DE and fills its DEM.
  - PICS is a future default DE used to create other DE/DEM/V1N, but is not implemented in this iteration.
