---
title: "Feishu Contract Backlog"
doc_type: decision-backlog
status: active
updated: 2026-07-10
source: ai
---

# Feishu Contract Backlog

Purpose: this is the durable query point for unresolved Feishu-current contract differences. When asked what remains to do for Feishu/SSOT alignment, check this file first, then the latest related iteration reports.

Authority boundary: this backlog records open decisions. It is not executable product SSOT, and no item may be implemented or rejected solely because it appears here.

Source baseline:

- Primary report: `docs/iterations/0454-feishu-focused-current-diff/current-diff-report.md`
- Source snapshots: `test_files/feishu_current/0454/state/snapshots/`

## Active Items

| ID | Class | Item | Reason | Next action |
|---|---|---|---|---|
| F-01 | requires_user_confirmation | Message API version mismatch: header says `pin_payload.v2`, examples still use `pin_payload.v1`. | Implementing either side without confirmation could make the runtime reject the actual Feishu message shape. | Ask whether Feishu message API input remains `pin_payload.v1` for the `0.1` child table shape, or whether the whole input envelope is moving to `pin_payload.v2`. |
| F-04 | requires_user_confirmation | `model.submtconnect` appears once while the rest of the source and repo use `model.submtconnection`. | Adding an alias would introduce compatibility behavior for what may only be a typo. | Confirm with the team whether `model.submtconnect` is a document typo before any registry/runtime change. |
| F-05 | requires_user_confirmation | `ui.refresh_data` says the UI model changes labels, while the repo records pending refresh and keeps UI as projection. | Direct UI mutation conflicts with the current ModelTable truth boundary unless expressed as authorized label writes. | Clarify whether refresh should produce authorized ModelTable writes, frontend projection refresh, or both. |
| F-06 | requires_user_confirmation | Base/DEM/MBR omitted-field auto-fill and permission routing are not implemented. | Current implementation validates explicit fields but does not infer route/permission data from a connection directory. | Confirm the route-directory truth, permission checks, default local/global server selection, and omitted-field materialization before planning implementation. |
| F-07 | requires_user_confirmation | `config.control`, `config.manage`, `mqtt.global.*`, and `mqtt.global_port` need a canonical decision. | Feishu conceptual labels and repo operational routing labels do not yet have one clear mapping. | Decide whether aggregate config labels become canonical, remain explanatory, or compile into existing split labels; confirm `mqtt.global_port` spelling. |
| F-08 | requires_user_confirmation | `add_task_return` is documented as a task pin return, but runtime returns task id through response outbox. | Current behavior may carry the data but may not match the literal pin-specific return described by Feishu. | Confirm whether `add_task_return` must be a real task pin message or whether response outbox handler result is accepted mapping. |
| F-09 | tooling_gap | Feishu watcher allowed a run with `NODE_TLS_REJECT_UNAUTHORIZED=0`. | Recurring source monitoring should not silently run with TLS verification disabled. | Add watcher preflight: fail or clearly report TLS-disabled mode unless an explicit local-debug flag is set. |

## Query Rule

When the user asks "还有什么要做" or asks for remaining Feishu/SSOT work, include the active items above unless a later iteration marks them resolved or superseded.
