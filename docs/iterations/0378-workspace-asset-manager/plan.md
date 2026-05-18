---
title: "0378 - Workspace Asset Manager Plan"
doc_type: iteration-plan
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0378-workspace-asset-manager
id: 0378-workspace-asset-manager
phase: completed
---

# Iteration 0378-workspace-asset-manager Plan

## Goal

Turn the current Workspace Manager slide app into an interactive asset manager. It must show current workspace software-worker assets as a clickable list, let users inspect ordinary assets, and let users install slide-app assets into the local UI Server workspace using the same local materialization path as slide-app import.

## Scope

- In scope:
  - Keep the current simplified deployment shape: one Workspace Manager DE with a single DEM worker; all Workspace Manager business logic runs in that DEM for now.
  - Add a fixed Workspace Manager asset catalog stored as ModelTable `Data.Array.One`-style labels. This is the first test version of the future worker asset-reporting topic.
  - Show RemoteWorker R1 and its offered slide apps: `E2E 颜色生成器` and `最小 Submit 双总线示例`.
  - Render the asset manager as a Cellwise UI list/table with interactive row actions.
  - For ordinary assets, selecting a row updates a basic-info panel; a details action opens a Dialog with richer metadata.
  - For slide-app assets, show an install action that creates a new local UI Server slide-app instance and refreshes the workspace sidebar.
  - Verify local cluster deployment and real browser behavior.
- Out of scope:
  - Dynamic worker discovery and incremental update protocol.
  - Cross-workspace MBR-to-MBR asset discovery.
  - Full PICS implementation.
  - Remote binary download from an external worker. For this iteration, install uses fixed local source model ids that represent R1-provided assets in the current dev stack.

## Invariants / Constraints

- UI is a projection of ModelTable labels; no one-off HTML blob implementation.
- Formal UI button events must use current event routes or explicit host install action; no `pin.connect.model`, no `(self, ...)` / `(func, ...)` tuple syntax, no `v1n_id`, no `is_DEM`.
- Workspace Manager and PICS remain DE service providers, not UI-Server-owned business pages.
- Workspace Manager worker must remain deployed in local cluster as a DEM-only simplified DE.
- Install must allocate a new local model id and show the installed app in Workspace, rather than only showing a fake success message.
- Each implementation stage must request sub-agent review with `codex-code-review`; if review returns `CHANGE_REQUESTED`, fix and re-review before continuing.

## Success Criteria

- `workspace-manager` Deployment is present and ready in local cluster.
- Workspace Manager asset catalog includes ordinary worker/DEM assets plus slide-app assets under RemoteWorker R1, using current `Data.Array.One`-style array records.
- Browser can open `工作区管理器`, see an interactive asset list, select ordinary and slide-app rows, open a details Dialog, and click install for a slide-app asset.
- After install, Workspace sidebar contains a newly materialized copy of the selected slide app with a new model id.
- Deterministic tests cover asset catalog shape, UI model shape, host install action, and no legacy pin/identity forms.
- Final sub-agent review returns `APPROVED`.

## Inputs

- Created at: 2026-05-18
- Iteration ID: 0378-workspace-asset-manager
