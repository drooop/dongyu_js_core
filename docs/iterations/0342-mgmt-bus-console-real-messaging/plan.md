---
title: "0342 — Mgmt Bus Console Real Messaging Plan"
doc_type: iteration-plan
status: approved
updated: 2026-04-26
source: ai
iteration_id: 0342-mgmt-bus-console-real-messaging
id: 0342-mgmt-bus-console-real-messaging
phase: phase3
---

# 0342 — Mgmt Bus Console Real Messaging Plan

## Goal

Make the Workspace asset tree readable in the current browser width and extend `Mgmt Bus Console` so its model-defined UI can send an actual Matrix/MBR message to `@mbr:<host_url>` and receive a visible response back through the existing bus chain.

## Scope

- In scope:
  - Rebalance the Workspace asset tree table so the action column is compact and app names are not covered by the Open/Delete area.
  - Add model-table-authored target/user, status, and sent-message local fields to Model `1036`, with received/transcript data projected from source-owned trace state.
  - Keep the formal send entry as `UI event -> bus_event_v2 -> Model 0 pin.bus.in -> -10.mgmt_bus_console_intent`.
  - Add server-side forwarding from the already-routed `-10.mgmt_bus_console_intent` to Matrix as a temporary ModelTable `pin_payload`.
  - Add an explicit MBR response path for Mgmt Bus Console messages and return a temporary ModelTable `mgmt_bus_console_ack` through Matrix/source-owned projection.
  - Redeploy the local stack and verify color generator plus Mgmt Bus Console send/receive in a real browser at `http://127.0.0.1:30900/#/workspace`.
- Out of scope:
  - No browser direct Matrix send.
  - No generic MBR CRUD.
  - No new renderer component family.
  - No replacement of Matrix live adapter or MQTT worker topology.
  - No promotion to `main`.

## Invariants / Constraints

- `CLAUDE.md` is authoritative.
- UI remains a ModelTable projection and may only trigger formal business work through Model `0` bus ingress.
- Formal payloads must remain temporary ModelTable record arrays.
- MBR must only handle the explicit Mgmt Bus Console message contract; it must not accept arbitrary CRUD.
- Return data must flow back through Matrix and source-owned projection, not through a browser-side shortcut or Model `1036` response truth.
- All mutations remain `add_label` / `rm_label`.
- Local UI state on Model `1036` is limited to an explicit whitelist.
- If Matrix/MBR is unavailable, the failure must be visible in ModelTable state; no hidden fallback is allowed.

## Success Criteria

- A red/green contract test proves the asset tree action column is compact and no longer uses a fixed overlay that can cover names.
- A red/green contract test proves Model `1036` declares target/status local state and renders source-owned response/transcript projection.
- A red/green contract test proves the send button emits `bus_event_v2` with a temporary ModelTable payload including `target_user_id`.
- A server test proves `mgmt_bus_console_send` reaches `-10.mgmt_bus_console_intent` and is forwarded to Matrix as `source_model_id=1036`, `pin=submit`.
- An MBR test proves a valid Model `1036` message creates a `mgmt_bus_console_ack` response and invalid/generic shapes are not treated as CRUD.
- Browser verification shows: color generator still changes color; Mgmt Bus Console sends a message to `@mbr:<host_url>` and displays an MBR response; no browser `/_matrix/client` requests occur.
- Stage and final sub-agent `codex-code-review` return `APPROVED`, or findings are fixed and re-reviewed.

## Inputs

- Created at: 2026-04-26
- Iteration ID: 0342-mgmt-bus-console-real-messaging
- User browser comment: Workspace asset names are still covered by the Open/Delete area.
- User requirement: UI model must actually send and receive messages with target user `@mbr:<host_url>`.
