---
title: "Feishu Contract Backlog"
doc_type: decision-backlog
status: active
updated: 2026-07-17
source: ai
---

# Feishu Contract Backlog

Purpose: this is the durable query point for unresolved Feishu-current contract differences. When asked what remains to do for Feishu/SSOT alignment, check this file first, then the latest related iteration reports.

Authority boundary: this backlog records open decisions. It is not executable product SSOT, and no item may be implemented or rejected solely because it appears here.

Source baseline:

- Primary baseline report: `docs/iterations/0454-feishu-focused-current-diff/current-diff-report.md`
- Revision-14272 evidence: `docs/iterations/0458-feishu-model2-safe-alignment/revision-diff-report.md`
- Source snapshots: `test_files/feishu_current/0454/state/snapshots/`

## Awaiting User Confirmation

| ID | Class | Item | Reason | Next action |
|---|---|---|---|---|
| F-06 | requires_user_confirmation | Base/DEM/MBR omitted-field auto-fill and permission routing are not implemented. | Current implementation validates explicit fields but does not infer route/permission data from a connection directory. | Confirm the route-directory truth, permission checks, default local/global server selection, and omitted-field materialization before planning implementation. |
| F-07 | requires_user_confirmation | `config.control`, `config.manage`, `mqtt.global.*`, and `mqtt.global_port` need a canonical decision. | Revision `14272` now contains aggregate `config.control` / `config.manage` examples, while repo operational routing still uses split labels; the new evidence strengthens the conflict but does not settle it. | Decide whether aggregate config labels become canonical, remain explanatory, or compile into existing split labels; confirm `mqtt.global_port` spelling. |
| F-10 | requires_user_confirmation | Revision `14272` introduces `sys_model_type`, `sys_model_size`, and `sys_` / `in_` / `out_` / `log_` / `user_` / `persis_` / `status_` key namespaces. | Current repo contracts use registry-defined keys without adopting this prefix scheme. | Decide whether the namespace scheme is normative, descriptive, or requires a migration/compatibility plan. |
| F-11 | requires_user_confirmation | Revision `14272` introduces program areas and lifecycle surfaces such as `pin.manage`, `user_set_status`, `CLEAR_BUFFER`, and `sys_func_*`. | Current runtime has no SYS/IN/OUT/LOG/USER/PERSIS/STATUS area model or MNG lifecycle contract. | Define the lifecycle state machine, ownership, commands, failure behavior, and area API before implementation. |
| F-12 | requires_user_confirmation | Revision `14272` introduces `func.code.python`, `func.code.js`, `func.mode`, and `func.timer.ms`. | Current executable labels remain `func.python` / `func.js`; timer and mode labels are not implemented. | Decide naming, migration, scheduling semantics, and whether the new labels replace or supplement the current labels. |
| F-13 | requires_user_confirmation | Revision `14272` introduces a log record schema with `log_type`, `log_info`, `log_model_id`, coordinates, function, and timestamp fields. | Current repo defines the `pin.login` / `pin.logout` channel but not this record schema. | Decide required fields, types, ownership, retention, and transport before adopting the schema. |
| F-14 | requires_user_confirmation | Revision `14272` states that only Flow models can run independently. | Current repo has no approved functional-type capability matrix enforcing that restriction. | Define model-type categories and independent-run capability rules before changing validation or runtime behavior. |

## Decisions Recorded — Follow-up Pending

| ID | Class | Decision | Current executable state | Next action |
|---|---|---|---|---|
| F-04 | decision_recorded_source_correction_pending | `model.submtconnect` is a Feishu source typo; do not add a repo alias. | Repo continues to accept only `model.submtconnection`. | Correct Feishu only after separate write authorization; no runtime change. |
| F-05 | decision_recorded_implementation_pending | Use authorized ModelTable writes; frontend stays projection-only. | Current Model 3200 fails closed with `ui_action_pending:refresh_data`; it does not write refresh state or produce a response. | Define and implement the ModelTable write contract in a separate iteration. |
| F-08 | decision_recorded_implementation_pending | `add_task_return` must be a real PIN message. | Current Model 3200 fails closed with `task_action_pending:add_task_return`; generic `result` does not count as a real `add_task_return` PIN. | Define the PIN payload/route and implement it in a separate iteration. |

## Completed Items

| ID | Class | Outcome | Evidence |
|---|---|---|---|
| F-01 | completed | The current public Feishu Message API input is hard-cut to flat `pin_payload.v2`; legacy v1 fails closed and R1 Model 3200 owns the business behavior. | `0457-feishu-message-api-v2-local-de`; accepted candidate `3b2a902`; local OrbStack control/management/E2E and three Step 11 whole-candidate approvals. |
| F-09 | completed | Watcher fails closed when TLS verification is disabled; explicit override is restricted to fixture or exact loopback local-debug mode. | `0456-feishu-watcher-tls-preflight`; `scripts/tests/test_0441_feishu_source_watch_contract.mjs` |

## Query Rule

When the user asks "还有什么要做" or asks for remaining Feishu/SSOT work, include both Awaiting User Confirmation and Decisions Recorded — Follow-up Pending. Completed Items are historical evidence and are not remaining work.
