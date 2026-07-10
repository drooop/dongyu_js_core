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

## Awaiting User Confirmation

| ID | Class | Item | Reason | Next action |
|---|---|---|---|---|
| F-06 | requires_user_confirmation | Base/DEM/MBR omitted-field auto-fill and permission routing are not implemented. | Current implementation validates explicit fields but does not infer route/permission data from a connection directory. | Confirm the route-directory truth, permission checks, default local/global server selection, and omitted-field materialization before planning implementation. |
| F-07 | requires_user_confirmation | `config.control`, `config.manage`, `mqtt.global.*`, and `mqtt.global_port` need a canonical decision. | Feishu conceptual labels and repo operational routing labels do not yet have one clear mapping. | Decide whether aggregate config labels become canonical, remain explanatory, or compile into existing split labels; confirm `mqtt.global_port` spelling. |

## Decisions Recorded — Follow-up Pending

| ID | Class | Decision | Current executable state | Next action |
|---|---|---|---|---|
| F-01 | decision_recorded_implementation_pending | Upgrade the whole Feishu Message API input envelope to `pin_payload.v2`. | Current parser/runtime input remains `pin_payload.v1`. | Create a separate SSOT/runtime/test migration iteration. |
| F-04 | decision_recorded_source_correction_pending | `model.submtconnect` is a Feishu source typo; do not add a repo alias. | Repo continues to accept only `model.submtconnection`. | Correct Feishu only after separate write authorization; no runtime change. |
| F-05 | decision_recorded_implementation_pending | Use authorized ModelTable writes; frontend stays projection-only. | Current runtime records pending refresh without the approved write path. | Define and implement the ModelTable write contract in a separate iteration. |
| F-08 | decision_recorded_implementation_pending | `add_task_return` must be a real PIN message. | Current runtime returns task id through response outbox. | Define the PIN payload/route and implement it in a separate iteration. |

## Completed Items

| ID | Class | Outcome | Evidence |
|---|---|---|---|
| F-09 | completed | Watcher fails closed when TLS verification is disabled; explicit override is restricted to fixture or exact loopback local-debug mode. | `0456-feishu-watcher-tls-preflight`; `scripts/tests/test_0441_feishu_source_watch_contract.mjs` |

## Query Rule

When the user asks "还有什么要做" or asks for remaining Feishu/SSOT work, include both Awaiting User Confirmation and Decisions Recorded — Follow-up Pending. Completed Items are historical evidence and are not remaining work.
