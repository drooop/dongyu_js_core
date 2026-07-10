---
title: "Contract Coverage Summary"
doc_type: generated-summary
status: active
updated: 2026-07-10
source: generated
generated_from: "docs/ssot/contract_surface_manifest.json"
---

# Contract Coverage Summary

Generated from `docs/ssot/contract_surface_manifest.json`. This is a routing/coverage view, not product SSOT. Do not edit it directly.

Contract cards: 10

## Coverage Table

| Contract | Status | Risk | Open findings | SSOT | Implementation | Tests | Verification |
|---|---|---|---|---|---|---|---|
| `model.v1n.worker_root` | aligned | medium | - | `docs/ssot/label_type_registry.md`<br>`docs/ssot/runtime_semantics_modeltable_driven.md` | `packages/worker-base/src/runtime.mjs`<br>`packages/worker-base/src/runtime.js` | `scripts/tests/test_0442_feishu_current_contract_alignment.mjs` | `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs` |
| `model.relationship.naming_and_numeric_subtable` | requires_user_confirmation | high | `F-04` (requires_user_confirmation) | `docs/ssot/label_type_registry.md`<br>`docs/ssot/runtime_semantics_modeltable_driven.md`<br>`docs/ssot/principal_scoped_subtable_namespace_v1.md` | `packages/worker-base/src/runtime.mjs`<br>`packages/worker-base/src/runtime.js` | `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`<br>`scripts/tests/test_0432_subtable_connection_runtime_contract.mjs` | `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs`<br>`node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs` |
| `pin_payload.formal_v2` | aligned | high | - | `docs/ssot/temporary_modeltable_payload_v1.md`<br>`docs/ssot/runtime_semantics_modeltable_driven.md`<br>`docs/ssot/feishu_model_label_alignment_v1.md` | `packages/worker-base/src/runtime.mjs`<br>`packages/worker-base/src/runtime.js`<br>`scripts/lib/pin_payload_v2_test_helpers.mjs` | `scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`<br>`scripts/tests/test_0396_dual_topic_submit_response_contract.mjs` | `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`<br>`node scripts/tests/test_0396_dual_topic_submit_response_contract.mjs` |
| `feishu_message_api.input_version` | requires_user_confirmation | high | `F-01` (requires_user_confirmation) | `docs/ssot/runtime_semantics_modeltable_driven.md`<br>`docs/ssot/feishu_model_label_alignment_v1.md` | `scripts/lib/feishu_message_api_v1.mjs`<br>`packages/worker-base/src/runtime.mjs`<br>`packages/worker-base/src/runtime.js` | `scripts/tests/test_0442_feishu_current_contract_alignment.mjs` | `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs` |
| `feishu_message_api.response_outbox` | aligned | high | - | `docs/ssot/runtime_semantics_modeltable_driven.md`<br>`docs/ssot/feishu_model_label_alignment_v1.md` | `packages/worker-base/src/runtime.mjs`<br>`packages/worker-base/src/runtime.js` | `scripts/tests/test_0448_feishu_message_api_response_outbox.mjs`<br>`scripts/tests/test_0449_feishu_response_outbox_publish.mjs`<br>`scripts/tests/test_0452_feishu_response_e2e_smoke.mjs` | `node scripts/tests/test_0448_feishu_message_api_response_outbox.mjs`<br>`node scripts/tests/test_0449_feishu_response_outbox_publish.mjs`<br>`node scripts/tests/test_0452_feishu_response_e2e_smoke.mjs` |
| `feishu_message_api.response_materialization` | aligned | high | - | `docs/ssot/runtime_semantics_modeltable_driven.md`<br>`docs/ssot/feishu_model_label_alignment_v1.md` | `packages/worker-base/src/runtime.mjs`<br>`packages/worker-base/src/runtime.js` | `scripts/tests/test_0450_feishu_response_materialization.mjs`<br>`scripts/tests/test_0452_feishu_response_e2e_smoke.mjs` | `node scripts/tests/test_0450_feishu_response_materialization.mjs`<br>`node scripts/tests/test_0452_feishu_response_e2e_smoke.mjs` |
| `feishu_message_api.resource_data_ui_task_handlers` | requires_user_confirmation | high | `F-05` (requires_user_confirmation)<br>`F-08` (requires_user_confirmation) | `docs/ssot/runtime_semantics_modeltable_driven.md` | `scripts/lib/feishu_message_api_v1.mjs`<br>`packages/worker-base/src/runtime.mjs`<br>`packages/worker-base/src/runtime.js` | `scripts/tests/test_0443_feishu_message_api_business_dispatch.mjs`<br>`scripts/tests/test_0444_feishu_task_manager_processor.mjs`<br>`scripts/tests/test_0445_feishu_resource_api_processor.mjs`<br>`scripts/tests/test_0446_feishu_data_api_processor.mjs`<br>`scripts/tests/test_0447_feishu_ui_api_processor.mjs` | `node scripts/tests/test_0443_feishu_message_api_business_dispatch.mjs`<br>`node scripts/tests/test_0444_feishu_task_manager_processor.mjs`<br>`node scripts/tests/test_0445_feishu_resource_api_processor.mjs`<br>`node scripts/tests/test_0446_feishu_data_api_processor.mjs`<br>`node scripts/tests/test_0447_feishu_ui_api_processor.mjs` |
| `feishu_source_watch.focused_docs` | tooling_gap | medium | `F-09` (tooling_gap) | `docs/ssot/feishu_source_watch_manifest.json` | `scripts/ops/feishu_source_watch.mjs` | `scripts/tests/test_0441_feishu_source_watch_contract.mjs` | `node scripts/tests/test_0441_feishu_source_watch_contract.mjs`<br>`node --check scripts/ops/feishu_source_watch.mjs` |
| `feishu_message_api.route_autofill_permission` | requires_user_confirmation | high | `F-06` (requires_user_confirmation) | `docs/ssot/runtime_semantics_modeltable_driven.md` | `scripts/lib/feishu_message_api_v1.mjs`<br>`packages/worker-base/src/runtime.mjs` | `scripts/tests/test_0442_feishu_current_contract_alignment.mjs` | `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs` |
| `feishu_config_labels.control_manage_mqtt` | requires_user_confirmation | high | `F-07` (requires_user_confirmation) | `docs/ssot/feishu_alignment_decisions_v0.md` | `packages/worker-base/src/bootstrap_config.mjs` | `scripts/tests/test_0455_contract_surface_index.mjs` | `node scripts/tests/test_0455_contract_surface_index.mjs` |

## Contract Cards

### model.v1n.worker_root

- Status: `aligned`
- Risk: `medium`
- Source refs: `feishu-model2`
- SSOT files: `docs/ssot/label_type_registry.md`<br>`docs/ssot/runtime_semantics_modeltable_driven.md`
- Decision files: -
- Evidence files: `docs/iterations/0454-feishu-focused-current-diff/current-diff-report.md`
- Implementation files: `packages/worker-base/src/runtime.mjs`<br>`packages/worker-base/src/runtime.js`
- Test files: `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
- Open findings: -
- Verification: `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
- Owner iterations: `0442-feishu-current-contract-alignment`<br>`0454-feishu-focused-current-diff`
- Notes: Worker root model.v1n is accepted only at host Model 0 root.
- Anchor matches: `ssot_files:model.v1n` => `docs/ssot/label_type_registry.md`<br>`docs/ssot/runtime_semantics_modeltable_driven.md`; `implementation_files:model.v1n` => `packages/worker-base/src/runtime.mjs`; `test_files:test_model_v1n_is_accepted_at_worker_root` => `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`

### model.relationship.naming_and_numeric_subtable

- Status: `requires_user_confirmation`
- Risk: `high`
- Source refs: `feishu-model2`
- SSOT files: `docs/ssot/label_type_registry.md`<br>`docs/ssot/runtime_semantics_modeltable_driven.md`<br>`docs/ssot/principal_scoped_subtable_namespace_v1.md`
- Decision files: `docs/ssot/feishu_contract_backlog.md`
- Evidence files: `docs/iterations/0454-feishu-focused-current-diff/current-diff-report.md`
- Implementation files: `packages/worker-base/src/runtime.mjs`<br>`packages/worker-base/src/runtime.js`
- Test files: `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`<br>`scripts/tests/test_0432_subtable_connection_runtime_contract.mjs`
- Open findings: `F-04` (requires_user_confirmation)
- Verification: `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs`<br>`node scripts/tests/test_0432_subtable_connection_runtime_contract.mjs`
- Owner iterations: `0432-subtable-connection-impl`<br>`0442-feishu-current-contract-alignment`<br>`0454-feishu-focused-current-diff`
- Notes: Numeric subtable references are implemented; model.submtconnect remains a suspected source typo and no alias is approved.
- Anchor matches: `ssot_files:model.subtableconnection` => `docs/ssot/label_type_registry.md`<br>`docs/ssot/runtime_semantics_modeltable_driven.md`<br>`docs/ssot/principal_scoped_subtable_namespace_v1.md`; `implementation_files:_normalizeSubtableConnectionDescriptor` => `packages/worker-base/src/runtime.mjs`; `test_files:test_numeric_subtableconnection_is_normalized_from_feishu_input` => `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`

### pin_payload.formal_v2

- Status: `aligned`
- Risk: `high`
- Source refs: `docs/ssot/temporary_modeltable_payload_v1.md`
- SSOT files: `docs/ssot/temporary_modeltable_payload_v1.md`<br>`docs/ssot/runtime_semantics_modeltable_driven.md`<br>`docs/ssot/feishu_model_label_alignment_v1.md`
- Decision files: -
- Evidence files: `docs/iterations/0454-feishu-focused-current-diff/current-diff-report.md`
- Implementation files: `packages/worker-base/src/runtime.mjs`<br>`packages/worker-base/src/runtime.js`<br>`scripts/lib/pin_payload_v2_test_helpers.mjs`
- Test files: `scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`<br>`scripts/tests/test_0396_dual_topic_submit_response_contract.mjs`
- Open findings: -
- Verification: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`<br>`node scripts/tests/test_0396_dual_topic_submit_response_contract.mjs`
- Owner iterations: `0332-modeltable-pin-payload-contract`<br>`0396-dual-topic-submit-response-contract`<br>`0451-feishu-legacy-v2-test-refresh`
- Notes: Formal bus and response transport uses v2 Temporary ModelTable records.
- Anchor matches: `ssot_files:pin_payload.v2` => `docs/ssot/temporary_modeltable_payload_v1.md`<br>`docs/ssot/runtime_semantics_modeltable_driven.md`<br>`docs/ssot/feishu_model_label_alignment_v1.md`; `implementation_files:payload_model_id` => `packages/worker-base/src/runtime.mjs`<br>`scripts/lib/pin_payload_v2_test_helpers.mjs`; `test_files:test_endpoint_packet_requires_response_topic_for_requests` => `scripts/tests/test_0396_dual_topic_submit_response_contract.mjs`

### feishu_message_api.input_version

- Status: `requires_user_confirmation`
- Risk: `high`
- Source refs: `feishu-message-api`
- SSOT files: `docs/ssot/runtime_semantics_modeltable_driven.md`<br>`docs/ssot/feishu_model_label_alignment_v1.md`
- Decision files: `docs/ssot/feishu_contract_backlog.md`
- Evidence files: `docs/iterations/0454-feishu-focused-current-diff/current-diff-report.md`
- Implementation files: `scripts/lib/feishu_message_api_v1.mjs`<br>`packages/worker-base/src/runtime.mjs`<br>`packages/worker-base/src/runtime.js`
- Test files: `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
- Open findings: `F-01` (requires_user_confirmation)
- Verification: `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
- Owner iterations: `0442-feishu-current-contract-alignment`<br>`0454-feishu-focused-current-diff`
- Notes: Feishu input remains v1 in code while formal response transport is v2; the upstream wording needs confirmation.
- Anchor matches: `ssot_files:pin_payload.v1` => `docs/ssot/runtime_semantics_modeltable_driven.md`<br>`docs/ssot/feishu_model_label_alignment_v1.md`; `implementation_files:parseFeishuPinPayloadV1` => `scripts/lib/feishu_message_api_v1.mjs`; `test_files:test_feishu_pin_payload_v1_child_table_payload_is_parsed` => `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`

### feishu_message_api.response_outbox

- Status: `aligned`
- Risk: `high`
- Source refs: `feishu-message-api`
- SSOT files: `docs/ssot/runtime_semantics_modeltable_driven.md`<br>`docs/ssot/feishu_model_label_alignment_v1.md`
- Decision files: -
- Evidence files: `docs/iterations/0454-feishu-focused-current-diff/current-diff-report.md`
- Implementation files: `packages/worker-base/src/runtime.mjs`<br>`packages/worker-base/src/runtime.js`
- Test files: `scripts/tests/test_0448_feishu_message_api_response_outbox.mjs`<br>`scripts/tests/test_0449_feishu_response_outbox_publish.mjs`<br>`scripts/tests/test_0452_feishu_response_e2e_smoke.mjs`
- Open findings: -
- Verification: `node scripts/tests/test_0448_feishu_message_api_response_outbox.mjs`<br>`node scripts/tests/test_0449_feishu_response_outbox_publish.mjs`<br>`node scripts/tests/test_0452_feishu_response_e2e_smoke.mjs`
- Owner iterations: `0448-feishu-message-api-response-outbox`<br>`0449-feishu-response-outbox-publish`<br>`0452-feishu-response-e2e-smoke`
- Notes: Handler results publish through the formal response outbox contract.
- Anchor matches: `ssot_files:feishu_message_api_response_out` => `docs/ssot/runtime_semantics_modeltable_driven.md`<br>`docs/ssot/feishu_model_label_alignment_v1.md`; `implementation_files:feishu_message_api_response_out` => `packages/worker-base/src/runtime.mjs`; `test_files:test_resource_response_outbox_uses_response_topic` => `scripts/tests/test_0448_feishu_message_api_response_outbox.mjs`

### feishu_message_api.response_materialization

- Status: `aligned`
- Risk: `high`
- Source refs: `docs/ssot/feishu_model_label_alignment_v1.md`
- SSOT files: `docs/ssot/runtime_semantics_modeltable_driven.md`<br>`docs/ssot/feishu_model_label_alignment_v1.md`
- Decision files: -
- Evidence files: `docs/iterations/0454-feishu-focused-current-diff/current-diff-report.md`
- Implementation files: `packages/worker-base/src/runtime.mjs`<br>`packages/worker-base/src/runtime.js`
- Test files: `scripts/tests/test_0450_feishu_response_materialization.mjs`<br>`scripts/tests/test_0452_feishu_response_e2e_smoke.mjs`
- Open findings: -
- Verification: `node scripts/tests/test_0450_feishu_response_materialization.mjs`<br>`node scripts/tests/test_0452_feishu_response_e2e_smoke.mjs`
- Owner iterations: `0450-feishu-response-materialization`<br>`0452-feishu-response-e2e-smoke`
- Notes: Inbound responses materialize only to explicit reply targets.
- Anchor matches: `ssot_files:pin_payload_response_materialize` => `docs/ssot/runtime_semantics_modeltable_driven.md`; `implementation_files:_materializePinPayloadResponse` => `packages/worker-base/src/runtime.mjs`; `test_files:test_response_materializes_to_app_table_reply_target` => `scripts/tests/test_0450_feishu_response_materialization.mjs`

### feishu_message_api.resource_data_ui_task_handlers

- Status: `requires_user_confirmation`
- Risk: `high`
- Source refs: `feishu-message-api`
- SSOT files: `docs/ssot/runtime_semantics_modeltable_driven.md`
- Decision files: `docs/ssot/feishu_contract_backlog.md`
- Evidence files: `docs/iterations/0454-feishu-focused-current-diff/current-diff-report.md`
- Implementation files: `scripts/lib/feishu_message_api_v1.mjs`<br>`packages/worker-base/src/runtime.mjs`<br>`packages/worker-base/src/runtime.js`
- Test files: `scripts/tests/test_0443_feishu_message_api_business_dispatch.mjs`<br>`scripts/tests/test_0444_feishu_task_manager_processor.mjs`<br>`scripts/tests/test_0445_feishu_resource_api_processor.mjs`<br>`scripts/tests/test_0446_feishu_data_api_processor.mjs`<br>`scripts/tests/test_0447_feishu_ui_api_processor.mjs`
- Open findings: `F-05` (requires_user_confirmation)<br>`F-08` (requires_user_confirmation)
- Verification: `node scripts/tests/test_0443_feishu_message_api_business_dispatch.mjs`<br>`node scripts/tests/test_0444_feishu_task_manager_processor.mjs`<br>`node scripts/tests/test_0445_feishu_resource_api_processor.mjs`<br>`node scripts/tests/test_0446_feishu_data_api_processor.mjs`<br>`node scripts/tests/test_0447_feishu_ui_api_processor.mjs`
- Owner iterations: `0443-feishu-message-api-business-dispatch`<br>`0444-feishu-task-manager-processor`<br>`0445-feishu-resource-api-processor`<br>`0446-feishu-data-api-processor`<br>`0447-feishu-ui-api-processor`<br>`0454-feishu-focused-current-diff`
- Notes: Public handlers exist; ui.refresh_data mutation and add_task_return message semantics remain open.
- Anchor matches: `ssot_files:ui.refresh_data` => `docs/ssot/runtime_semantics_modeltable_driven.md`; `ssot_files:task_data` => `docs/ssot/runtime_semantics_modeltable_driven.md`; `implementation_files:feishu_message_api_dispatch` => `packages/worker-base/src/runtime.mjs`; `test_files:test_refresh_data_records_pending_refresh_without_response` => `scripts/tests/test_0447_feishu_ui_api_processor.mjs`

### feishu_source_watch.focused_docs

- Status: `tooling_gap`
- Risk: `medium`
- Source refs: `feishu-model2`<br>`feishu-message-api`
- SSOT files: `docs/ssot/feishu_source_watch_manifest.json`
- Decision files: `docs/ssot/feishu_contract_backlog.md`
- Evidence files: `docs/iterations/0454-feishu-focused-current-diff/current-diff-report.md`
- Implementation files: `scripts/ops/feishu_source_watch.mjs`
- Test files: `scripts/tests/test_0441_feishu_source_watch_contract.mjs`
- Open findings: `F-09` (tooling_gap)
- Verification: `node scripts/tests/test_0441_feishu_source_watch_contract.mjs`<br>`node --check scripts/ops/feishu_source_watch.mjs`
- Owner iterations: `0441-feishu-source-watch`<br>`0454-feishu-focused-current-diff`
- Notes: Focused source watching is implemented; TLS-disabled environment preflight remains open.
- Anchor matches: `ssot_files:feishu_source_watch_manifest.v2` => `docs/ssot/feishu_source_watch_manifest.json`; `implementation_files:BASELINE_CREATED` => `scripts/ops/feishu_source_watch.mjs`; `test_files:test_manifest_records_no_secret_feishu_sources_and_confirmation_policy` => `scripts/tests/test_0441_feishu_source_watch_contract.mjs`

### feishu_message_api.route_autofill_permission

- Status: `requires_user_confirmation`
- Risk: `high`
- Source refs: `feishu-message-api`
- SSOT files: `docs/ssot/runtime_semantics_modeltable_driven.md`
- Decision files: `docs/ssot/feishu_contract_backlog.md`
- Evidence files: `docs/iterations/0454-feishu-focused-current-diff/current-diff-report.md`
- Implementation files: `scripts/lib/feishu_message_api_v1.mjs`<br>`packages/worker-base/src/runtime.mjs`
- Test files: `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
- Open findings: `F-06` (requires_user_confirmation)
- Verification: `node scripts/tests/test_0442_feishu_current_contract_alignment.mjs`
- Owner iterations: `0442-feishu-current-contract-alignment`<br>`0454-feishu-focused-current-diff`
- Notes: Current code validates explicit routing metadata; omitted-field auto-fill and permission policy require a separate decision.
- Anchor matches: `ssot_files:origin_pin` => `docs/ssot/runtime_semantics_modeltable_driven.md`; `implementation_files:origin_pin` => `scripts/lib/feishu_message_api_v1.mjs`<br>`packages/worker-base/src/runtime.mjs`; `test_files:test_feishu_message_api_rejects_invalid_bus_metadata` => `scripts/tests/test_0442_feishu_current_contract_alignment.mjs`

### feishu_config_labels.control_manage_mqtt

- Status: `requires_user_confirmation`
- Risk: `high`
- Source refs: `feishu-model2`
- SSOT files: `docs/ssot/feishu_alignment_decisions_v0.md`
- Decision files: `docs/ssot/feishu_contract_backlog.md`
- Evidence files: `docs/iterations/0454-feishu-focused-current-diff/current-diff-report.md`
- Implementation files: `packages/worker-base/src/bootstrap_config.mjs`
- Test files: `scripts/tests/test_0455_contract_surface_index.mjs`
- Open findings: `F-07` (requires_user_confirmation)
- Verification: `node scripts/tests/test_0455_contract_surface_index.mjs`
- Owner iterations: `0454-feishu-focused-current-diff`<br>`0455-contract-surface-index`
- Notes: Aggregate config labels and mqtt.global_port spelling remain open; current split-label behavior stays authoritative.
- Anchor matches: `ssot_files:mqtt.global.*` => `docs/ssot/feishu_alignment_decisions_v0.md`; `implementation_files:mqtt.global.ip` => `packages/worker-base/src/bootstrap_config.mjs`; `test_files:F-07` => `scripts/tests/test_0455_contract_surface_index.mjs`
