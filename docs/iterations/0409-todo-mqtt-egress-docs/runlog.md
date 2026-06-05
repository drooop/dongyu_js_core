---
title: "0409 To Do MQTT Egress Docs Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-06-04
iteration_id: 0409-todo-mqtt-egress-docs
id: 0409-todo-mqtt-egress-docs
source: ai
---

# 0409 To Do MQTT Egress Docs Runlog

## 2026-06-04

### Intake

- Root cause: developer changed `ui_bind_json.write.bus_in_key` to `submit_request`, but `submit_request` is an App-internal pin, not a Model 0 ingress route.
- Scope: docs + complete example + deterministic contract test. Runtime behavior stays unchanged.

### Stage 1: Docs And Example Payload

- Updated `docs/user-guide/ui_model_basic_filltable_guide.md`:
  - `bus_event_v2.bus_in_key` example now uses `bus_event_submit_0_0_0_0` for ZIP authoring.
  - Added explicit warning that `submit_request` / `todo_request` are App-internal pins, not Model 0 ingress keys.
  - Added MQTT egress label checklist and end-to-end path.
- Added `docs/user-guide/slide-app-runtime/todo_save_mqtt_event_example.md`.
- Added `test_files/todo_save_mqtt_event_app_payload.json`.

Verification:
- Command: `node -e "JSON.parse(require('fs').readFileSync('test_files/todo_save_mqtt_event_app_payload.json','utf8')); console.log('json ok')"`
- Result: PASS (`json ok`).

### Stage 2: Contract Test

- Added `scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs`.
- The test imports `test_files/todo_save_mqtt_event_app_payload.json` as a ZIP, triggers generated host ingress, and checks MQTT publish to `UIPUT/ws/dam/pic/de/R1/3000/submit1`.

Verification:
- Command: `node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs`
- Result: PASS (`PASS test_0409_todo_mqtt_egress_docs_contract`).
- Command: `node scripts/tests/test_0408_todo_board_import_payload_contract.mjs`
- Result: PASS (`PASS test_0408_todo_board_import_payload_contract`).
- Command: `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
- Result: PASS (`4 passed, 0 failed out of 4`).
- Command: `git diff --check`
- Result: PASS.

### Stage 2 Review

- Sub-agent review: CHANGE_REQUESTED.
- Finding: the first version of `test_0409_todo_mqtt_egress_docs_contract.mjs` triggered the save path with a direct pin envelope instead of `bus_event_v2.bus_in_key`, so it did not prove the real button contract.
- Fix: replaced the save trigger with `{ type: "bus_event_v2", bus_in_key: imported_host_submit_<modelId>, value: ... }`, asserted `routed_by=model0_busin`, and added negative checks that `submit_request` / `todo_request` as `bus_in_key` are rejected with `invalid_bus_in_key`.
- Re-run: `node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs`
- Result: PASS.

### Stage 3: Final Review And Close

- Sub-agent re-review: APPROVED.
- Findings: none.
- Verification gaps: none.

Final verification:
- Command: `node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs`
- Result: PASS.
- Command: `node scripts/tests/test_0408_todo_board_import_payload_contract.mjs`
- Result: PASS.
- Command: `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
- Result: PASS (`4 passed, 0 failed out of 4`).
- Command: `git diff --check`
- Result: PASS.

### Stage 4: MQTT Response To UI Materialization Docs

- Added `docs/user-guide/slide-app-runtime/mqtt_response_to_ui_materialization.md`.
- Updated `docs/user-guide/slide-app-runtime/README.md` so the new response guide is discoverable.
- Extended `scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs` to require the response guide to teach:
  - `message_role=response`;
  - `topic=response_topic`;
  - `reply_target_model_id`;
  - UI Server owner materialization;
  - UI components reading local labels instead of subscribing to MQTT directly.

Verification:
- Command: `node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs`
- Result: PASS (`PASS test_0409_todo_mqtt_egress_docs_contract`).
- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Result: PASS (`74 passed, 0 failed out of 74`).
- Command: `git diff --check`
- Result: PASS.

### Stage 4 Review

- Sub-agent review: CHANGE_REQUESTED.
- Finding: the first response-guide test assertions did not require the guide to preserve `pin_payload.v1` and nested `payload.v` as ModelTable records array.
- Finding: the first response-guide test assertions did not lock the negative rules that UI must not subscribe to MQTT directly and remote-worker must not directly write UI labels.
- Fix: added assertions for `pin_payload.v1`, nested ModelTable payload, no direct UI MQTT subscription, and no direct remote-worker UI label write.

Re-run:
- Command: `node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs`
- Result: PASS (`PASS test_0409_todo_mqtt_egress_docs_contract`).
- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Result: PASS (`74 passed, 0 failed out of 74`).
- Command: `git diff --check`
- Result: PASS.

### Stage 4 Re-review

- Sub-agent re-review: APPROVED.
- Findings: none.
- Verification gaps: none.
