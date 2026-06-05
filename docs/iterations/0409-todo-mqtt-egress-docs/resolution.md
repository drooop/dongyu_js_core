---
title: "0409 To Do MQTT Egress Docs Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-06-04
iteration_id: 0409-todo-mqtt-egress-docs
id: 0409-todo-mqtt-egress-docs
source: ai
---

# 0409 To Do MQTT Egress Docs Resolution

## Stage 1: Docs And Example Payload

Files:
- Modify `docs/user-guide/ui_model_basic_filltable_guide.md`.
- Add `docs/user-guide/slide-app-runtime/todo_save_mqtt_event_example.md`.
- Add `test_files/todo_save_mqtt_event_app_payload.json`.

Steps:
1. Replace the misleading `bus_in_key="submit_request"` example with the import-safe submit ingress key.
2. Explain that a button event reaches local program code first; MQTT only happens after that program writes a public root `pin.out`.
3. Add a full ModelTable records array for a minimal save-task App that writes to `submit1 pin.out`.
4. Document each required label and the exact MQTT topic generated from `remote_bus_endpoint_v1 + egress_pins`.

Verification:
- JSON parse for the new payload.
- Grep confirms the basic guide no longer teaches `bus_in_key="submit_request"`.

## Stage 2: Deterministic Contract Test

Files:
- Add `scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs`.

Steps:
1. Import the new payload through the real slide import path in a temporary server state.
2. Trigger the generated host ingress key with a task-save payload.
3. Confirm the App program writes local status and `last_submit_payload`.
4. Confirm the host egress adapter publishes one MQTT request to `UIPUT/ws/dam/pic/de/R1/3000/submit1`.
5. Confirm the published payload contains `message_role=request`, endpoint metadata, response topic, and nested task payload records.

Verification:
- `node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs`
- Existing related checks:
  - `node scripts/tests/test_0408_todo_board_import_payload_contract.mjs`
  - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`

## Stage 3: Review And Close

Files:
- Update `docs/iterations/0409-todo-mqtt-egress-docs/runlog.md`.
- Update `docs/ITERATIONS.md`.

Steps:
1. Run code-review style review for the bounded diff.
2. Fix any findings.
3. Run final verification.
4. Mark iteration completed.

Rollback:
- Revert the new docs, payload fixture, contract test, and iteration row/files.

## Stage 4: MQTT Response To UI Materialization Docs

Files:
- Add `docs/user-guide/slide-app-runtime/mqtt_response_to_ui_materialization.md`.
- Update `docs/user-guide/slide-app-runtime/README.md`.
- Update `scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs`.

Steps:
1. Explain the reverse path from remote-worker response to UI Server materialization.
2. Document the required `pin_payload.v1` response labels: `message_role=response`, `topic=response_topic`, `endpoint_*`, `origin_*`, `reply_target_*`, and nested `payload`.
3. Explain that UI components do not subscribe to MQTT; they read labels written by UI Server owner materialization.
4. Add test assertions that the new guide remains discoverable and teaches the current response contract.

Verification:
- `node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs`
- `git diff --check`
