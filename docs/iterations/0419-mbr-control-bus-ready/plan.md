---
title: "Iteration 0419-mbr-control-bus-ready Plan"
doc_type: iteration-plan
status: hotfix
updated: 2026-06-18
source: ai
iteration_id: 0419-mbr-control-bus-ready
id: 0419-mbr-control-bus-ready
phase: hotfix
---

# Iteration 0419-mbr-control-bus-ready Plan

## Goal

Restore Workspace Manager slide-app installation in the local deployed cluster by ensuring MBR control-bus MQTT routing can enter `runtime_mode=running` even when Matrix management-bus initialization is delayed or temporarily unavailable.

## Scope

In scope:

- Fix MBR startup/readiness behavior for control-bus routing.
- Keep Matrix management-bus ingress protected until Matrix adapter is actually ready.
- Add a deterministic regression test for the readiness split.
- Redeploy the affected local stack and verify the Workspace Manager install flow in a real browser.

Out of scope:

- Changing topic shape or pin payload schema.
- Changing RemoteWorker bundle payloads.
- Fixing the remote Matrix server 500 responses themselves.
- Remote/cloud deployment.

## Invariants / Constraints

- `CLAUDE.md` is authoritative.
- UI remains a projection of ModelTable.
- Business events still enter through Model 0 system bus boundaries.
- `runtime_mode=edit` still drops inbound Matrix/MQTT messages before normal runtime activation.
- The fix must not silently bypass Matrix management-bus validation. It may only decouple control-bus readiness from Matrix adapter readiness.
- No compatibility alias or legacy path may be introduced.

## Root Cause Evidence

Local deployed MBR logs show:

- `mqtt READY subscribed=UIPUT/ws/dam/pic/de/+/+/+`.
- Matrix adapter initialization fails with `sync_timeout` after Matrix `/versions` and filter calls return server errors.
- MBR stays in `runtime_mode=edit`.
- Provider bundle requests and responses are then dropped as `drop pre-running mqtt`.

This means Workspace Manager can send the install request and RemoteWorker can publish a bundle response, but MBR does not route the control-bus response back to UI Server.

## Success Criteria

- A regression test proves MBR runner readiness activates runtime for MQTT control-bus routing without waiting for Matrix ready.
- The same test proves Matrix ingress still checks runtime and adapter readiness before handling management-bus events.
- Existing MBR routing tests remain green.
- Local `mbr-worker` logs show `runtime_mode=running` after redeploy.
- Real Chrome browser test on `http://localhost:30900/#/` proves clicking a Workspace Manager install button produces a visible completion result and the installed app appears/openable.

## Inputs

- Created at: 2026-06-18
- Iteration ID: `0419-mbr-control-bus-ready`
- Branch: `dropx/dev_0419-mbr-control-bus-ready`
