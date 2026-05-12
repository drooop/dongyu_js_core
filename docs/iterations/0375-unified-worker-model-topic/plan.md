---
title: "0375 - Unified Worker Model Topic Plan"
doc_type: iteration-plan
status: approved
updated: 2026-05-12
source: ai
iteration_id: 0375-unified-worker-model-topic
id: 0375-unified-worker-model-topic
phase: approved
---

# Iteration 0375-unified-worker-model-topic Plan

## Goal

Freeze and implement the unified worker/model endpoint topic contract for dual-bus slide app messaging.

The contract makes the MQTT topic describe only the remote worker endpoint. UI Server instance identity, local installed model id, reply target, and request correlation must travel inside the Temporary ModelTable payload records.

## Scope

- In scope:
- Runtime and documentation contract for the only legal endpoint topic format:
  `UIPUT/<ws_id>/<dam_id>/<pic_id>/<de_id>/<sw_id>/<worker_id>/<model_id>/<pin>`.
- Temporary ModelTable payload records that carry origin, reply target, endpoint, and operation metadata.
- Hard removal of return-topic and old split path semantics from runtime, Tier 2 patches, seeded models, tests, docs, and interactive examples.
- Local and remote browser verification with trace evidence showing the actual topic and payload records.
- Out of scope:
- A per-app MBR route registry.
- A `result topic`, `return topic`, `route.reply_to`, or compatibility fallback for historical topic formats.
- Provider ZIP sidecar manifests or non-ModelTable payload files.
- Changing the requirement that UI business events enter through the worker root Model 0 bus boundary.

## Invariants / Constraints

- Topic invariant:
  - The only valid transport endpoint topic has exactly 9 segments:
    `UIPUT`, `<ws_id>`, `<dam_id>`, `<pic_id>`, `<de_id>`, `<sw_id>`, `<worker_id>`, `<model_id>`, `<pin>`.
  - Every segment must be non-empty. `model_id` must be a positive integer. `worker_id` and `pin` must be safe topic segments and must not contain `/`, `+`, or `#`.
  - The old topic forms `UIPUT/.../worker/<worker_id>/model/<model_id>/pin/<pin>` and `UIPUT/.../<model_id>/<pin>` are invalid input surfaces and must fail closed.
- Payload invariant:
  - Transport packet business payload must be a Temporary ModelTable record array.
  - Origin, reply target, endpoint, and request correlation fields must be records in that array, not loose top-level JSON fields.
  - Required metadata records include `origin_worker_id`, `origin_model_id`, `origin_pin`, `reply_target_worker_id`, `reply_target_model_id`, `reply_target_pin`, `endpoint_worker_id`, `endpoint_model_id`, `endpoint_pin`, and `op_id` / `__mt_request_id`.
  - UI Server materialization must derive the local write target from those payload records, not from topic suffixes, `pin=result`, or any return topic.
- Return invariant:
  - `route.reply_to`, `return_topic`, `returnTopic`, `result_topic`, and old result topics are forbidden.
  - Receiving code must not accept those fields as compatibility inputs.
- Slide app invariant:
  - A provider ZIP may declare only the remote endpoint and ModelTable UI/program records.
  - UI Server installer owns local origin/reply target labels and host binding labels after installation.
- Existing repository invariants still apply:
  - All business side effects go through `add_label` / `rm_label`.
  - UI is projection only.
  - UI business events enter through worker root Model 0 system bus boundaries.
  - No compatibility code unless explicitly approved by the user; this iteration has no such approval.

## Success Criteria

- Contract tests prove:
  - New topic build/parse accepts only the exact 9-segment endpoint format.
  - Missing segments, extra segments, old `worker/model/pin`, and old `model/pin` forms are rejected.
  - Payload schema rejects loose top-level `origin_*` / `reply_target_*` object fields and accepts only Temporary ModelTable record-array metadata.
  - UI Server materialization writes to the target carried by payload records; a topic pointing at A with payload reply target B writes B.
  - `pin=result` without payload reply target fails.
- Active surface scan finds no current-path `route.reply_to`, `return_topic`, `returnTopic`, `result_topic`, or old topic literals outside explicit negative tests / historical evidence.
- Model 100 color generator and the minimal Submit dual-bus app pass local browser tests after local redeploy.
- Browser verification captures trace evidence showing:
  - outbound/inbound topics use `UIPUT/<ws>/<dam>/<pic>/<de>/<sw>/<worker_id>/<model_id>/<pin>`;
  - payload is a record array containing origin/reply target/endpoint records;
  - UI Server updates the local model from payload metadata.
- Remote deployment updates `ui-server`, `mbr-worker`, and `remote-worker`; pod hashes align with the committed source; public Playwright verification passes with the same trace checks.
- Every stage has sub-agent `codex-code-review` approval before the next stage begins.

## Inputs

- Created at: 2026-05-12
- Iteration ID: 0375-unified-worker-model-topic
- User-approved direction: topic is shared by send/receive and is based on remote workerID/modelID/pin; UI Server instance and local model information travel in payload.
