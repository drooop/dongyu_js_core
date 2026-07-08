---
title: "Iteration 0452 Feishu Response E2E Smoke Plan"
doc_type: iteration-plan
status: completed
updated: 2026-07-09
source: ai
iteration_id: 0452-feishu-response-e2e-smoke
id: 0452-feishu-response-e2e-smoke
phase: phase1
---

# Iteration 0452-feishu-response-e2e-smoke Plan

## Goal

Prove that a Feishu public message can be handled, emitted as a formal response packet, and materialized back into the local reply target in one deterministic local smoke test.

## Background

0442-0451 completed individual slices: current Feishu input parsing, business dispatch, resource/data/UI/task processors, response outbox creation, response publication, inbound response materialization, and historical test refresh. The remaining gap is a single executable chain that connects those slices.

## Invariants

- Do not use a real MQTT broker for this smoke; keep it deterministic with a local mock publish recorder.
- Do not add legacy `pin_payload.v1` compatibility for runtime response packets.
- Response packets must use `message_role=response`, `topic=response_topic`, and `response_topic=response_topic`.
- Inbound response handling must materialize payload records to `reply_target_table_id + reply_target_model_id` and must not re-trigger endpoint `pin.in`.
- Rejecting a looped-back response must remain visible; no host fallback.

## Scope

In scope:

- Add a focused 0452 test covering the full local response loop.
- Apply minimal runtime fixes only if the full-chain test exposes a real current-contract defect.
- Update 0452 runlog and completion status.

Out of scope:

- Real Feishu API calls.
- Real MQTT broker, cloud deployment, browser, or UI rendering verification.
- New Feishu message API behavior beyond the existing resource/data/UI/task processors.

## Success Criteria

- A running runtime accepts a Feishu `resource.report` message through the Model 0 bus.
- The handler writes observable resource state and publishes one formal response packet to `response_pin`.
- The published packet can be looped back through `mqttIncoming`.
- The looped response writes payload records into the local reply target model and does not write endpoint `pin.in`.
- Missing reply target during loopback is rejected without host fallback.
- 0442-0451 focused/regression tests remain green.

## Risks & Mitigations

- Risk: the smoke could accidentally duplicate 0448/0449/0450 without proving their connection.
  - Mitigation: use the actual published packet from the 0449 path as the input to the 0450 path.
- Risk: CJS and ESM runtime behavior could diverge.
  - Mitigation: run the smoke against both runtime variants.
- Risk: a failure could be caused by test setup rather than the chain.
  - Mitigation: assert intermediate publish packet fields before loopback.

## Open Questions

None.

## Compliance Checklists

### SSOT Alignment Checklist

- `docs/ssot/runtime_semantics_modeltable_driven.md`: response packets are not endpoint program triggers.
- `docs/ssot/feishu_model_label_alignment_v1.md`: current Feishu response/outbox contract.
- `CLAUDE.md`: deterministic PASS/FAIL verification and no silent fallback.

### Charter Compliance Checklist

- Tier placement: root bus ingress and response outbox stay on Model 0.
- Model placement: response materialization writes to the declared reply target model.
- Data ownership: published response payload is not rewritten into unrelated host/shared models.
- Data flow and chain: Feishu message -> handler -> response outbox -> publish -> inbound materialization.
