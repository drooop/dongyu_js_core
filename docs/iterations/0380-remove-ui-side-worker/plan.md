---
title: "0380 - Remove UI Side Worker Plan"
doc_type: iteration-plan
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0380-remove-ui-side-worker
id: 0380-remove-ui-side-worker
phase: completed
---

# Iteration 0380-remove-ui-side-worker Plan

## Goal

- Remove the historical `ui-side-worker` from the active local/cloud runtime surface.
- Keep the current formal worker set focused on `ui-server`, `mbr-worker`, `remote-worker`, and `workspace-manager`.

## Scope

- In scope:
- Delete `ui-side-worker` deployment assets, runner, role patches, and deploy targets.
- Remove active deploy/baseline/test dependencies on `ui-side-worker`.
- Verify local deployment no longer expects `ui-side-worker`.
- Out of scope:
- Rewriting historical iteration records that mention `ui-side-worker`.
- Changing the current UI Server / MBR / Remote Worker / Workspace Manager behavior.

## Invariants / Constraints

- No compatibility path should keep `ui-side-worker` as an active deployment target.
- No formal baseline check should require `ui-side-worker`.
- Historical docs may mention it as history, but current docs/scripts/tests must not require it.

## Success Criteria

- `ui-side-worker` no longer appears in active local/cloud deployment scripts or manifests.
- Persisted asset manifest generation no longer includes `ui-side-worker` scope or role assets.
- Baseline checks pass without `ui-side-worker`.
- Local Kubernetes no longer has a `ui-side-worker` deployment/service after cleanup.
- Tests that previously asserted `ui-side-worker` active deployment are updated or removed.

## Inputs

- Created at: 2026-05-19
- Iteration ID: 0380-remove-ui-side-worker
- User instruction: if it does not affect the current system, remove `ui-side-worker` and ensure docs do not depend on it.
