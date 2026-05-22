---
title: "0389 Workspace Manager Provider Install MBR Validation"
doc_type: iteration_plan
status: completed
updated: 2026-05-20
source: codex
---

# 0389 Workspace Manager Provider Install MBR Validation

## Goal

Make Workspace Manager's provider-owned slide app install path actually complete in the local cluster.

## Observed Failure

Clicking `安装` in `工作区管理器` changes the UI status to `requesting ... R1/3100/bundle_request`, but no new local slide app appears. Logs show RemoteWorker R1 receives the request and publishes a `slide_app_bundle_response.v1`, while MBR rejects the packet with `legacy_pin_payload_metadata_removed`.

## Root Cause

The MBR/bootstrap legacy metadata guard recursively scans arbitrary business payload values. A provider-owned slide app bundle is itself a ModelTable record array, and valid UI labels inside that bundle can contain JSON fields such as `write.pin`. Those fields are UI component semantics, not legacy routing metadata. The current guard therefore rejects valid ModelTable business content.

## Constraints

- Do not reintroduce legacy `pin`, `source_model_id`, `return_topic`, `reply_to`, or route metadata.
- Keep routing metadata strict at the pin payload envelope and non-bundle business payload boundary.
- Only allow the exception for nested `slide_app_bundle_response.v1` `bundle_payload` when it is a valid ModelTable record array.
- Local deployment and real browser verification are required.
- Each small stage and the final result must be reviewed by a sub-agent using `codex-code-review`.

## Stages

- 0389.1: Freeze this focused plan and review it.
- 0389.2: Add failing tests proving bootstrap/MBR validation accepts valid provider bundle responses while still rejecting legacy metadata outside the scoped bundle payload.
- 0389.3: Implement the scoped validation fix in worker bootstrap and MBR fill-table code.
- 0389.4: Re-fill/redeploy local mbr/remote-worker/ui-server as needed, then verify with a real browser that Workspace Manager install creates a new local slide app.
- 0389.5: Final review and closure.

## Done Criteria

- Valid `slide_app_bundle_response.v1` with a ModelTable `bundle_payload` containing UI JSON `write.pin` is accepted by MBR/bootstrap validation.
- Non-bundle or top-level legacy routing metadata remains rejected.
- Browser test: click `工作区管理器` -> `安装` for a provider-owned slide app -> new slide app appears on the desktop/workspace and can be opened.
