---
title: "0396 Dual Topic Submit Response Plan"
doc_type: iteration-plan
status: approved
updated: 2026-05-28
source: codex
---

# 0396 Dual Topic Submit Response

## Goal

Hard-cut the control-bus endpoint topic contract so slide-app submit requests and responses no longer share the same MQTT topic.

The current repository still uses the 0375 contract:

- Endpoint topic: `UIPUT/<ws>/<dam>/<pic>/<de>/<sw>/<worker_id>/<model_id>/<pin>`
- Submit request and response both use the same `topic`

The required contract is:

- Endpoint topic: `UIPUT/<ws>/<dam>/<pic>/<de>/<worker_id>/<model_id>/<pin>`
- A request to `submit1` is published to `UIPUT/ws/dam/pic/de/R1/3000/submit1`
- The response is published to a separate response topic derived from `reply_target_*`

## Response Topic Rule

For every request packet that expects an owner-materialized response:

- UI Server generates `response_topic` at request creation time.
- `response_topic` uses the same endpoint topic shape as `topic`.
- `response_topic = <mqtt_topic_base>/<reply_target_worker_id>/<reply_target_model_id>/<reply_target_pin>`.
- For the minimal Submit app, if the local installed model is `2000`, the response topic is `UIPUT/ws/dam/pic/de/U1/2000/result`.
- The request packet is published to `topic = UIPUT/ws/dam/pic/de/R1/3000/submit1`.
- The response packet is published to `topic = response_topic`.
- In a response packet, `endpoint_*` must describe the current packet destination, so it must match `reply_target_*` and `topic`.
- In a response packet, `origin_*` must describe the remote provider endpoint that produced the response.
- UI Server subscribes under the current topic base, accepts response packets only when `topic === response_topic`, and materializes into the target model only through `reply_target_*`.
- RemoteWorker must not invent a different response topic; it must copy the request `response_topic` into the response packet's `topic` and `response_topic`.

## Scope

- Update SSOT/user-guide/iteration-facing docs that currently describe the old `/sw/` topic segment or same-topic response behavior.
- Update runtime and server validators so only the 8-segment endpoint topic is accepted.
- Add `response_topic` as current pin-payload metadata for request/response correlation.
- Generate request payloads with:
  - `topic = request destination topic`
  - `response_topic = response destination topic`
- Generate response payloads with:
  - `topic = response destination topic`
  - `response_topic = response destination topic`
- Update UI Server, MBR, RemoteWorker and Workspace Manager fill-table patches to the new topic contract.
- Update deterministic tests and the minimal Submit dual-bus example assets/docs.
- Redeploy local stack and verify with a real browser flow after implementation.

## Non-Goals

- Do not keep compatibility with `UIPUT/.../de/sw/...`.
- Do not keep compatibility with old `return_topic`, `returnTopic`, `result_topic`, `route.reply_to`, or `reply_to` records.
- Do not redesign Matrix management-bus semantics.
- Do not change the public worker/model/pin addressing concept beyond removing the redundant `sw` segment and splitting response topics.

## Invariants

- `topic` always means the actual transport topic used for the current packet.
- `response_topic` is the only current metadata field that declares where a request expects its response.
- Request and response topics must be different for submit-style UI events.
- Missing, invalid, or same-as-`topic` `response_topic` must fail closed for request packets that require a response.
- Response packets must fail closed when `topic !== response_topic`.
- Response packets must fail closed when `endpoint_*` does not match `reply_target_*`.
- MBR forwards by the packet's `topic`; it must not reconstruct or infer the destination from legacy fields.
- All transported payloads remain Temporary ModelTable record arrays.
- `reply_target_*` remains the owner materialization target inside the response payload; it is not a transport topic.
- Any payload or configured topic containing the old `/sw/` segment must fail validation rather than silently work.

## Success Criteria

- Tests fail before implementation for the old `/sw/` topic and same-topic response assumptions.
- Deterministic tests pass for:
  - 8-segment endpoint topic validation.
  - 9-segment old `/sw/` endpoint rejection.
  - UI Server request generation with distinct `topic` and `response_topic`.
  - Missing, malformed, or same-topic `response_topic` rejection.
  - RemoteWorker response generation using `response_topic` as the response packet `topic`.
  - RemoteWorker response generation with response `endpoint_* = reply_target_*`.
  - MBR forwarding by current packet `topic`.
  - UI Server accepting response packets delivered on response topic and rejecting response packets delivered on the submit topic.
- Active-surface scan proves current implementation, fill-table patches and current user-facing docs no longer present `/de/sw/` as a valid current topic and no longer claim submit request/response share one topic.
- Local Model 0 / MBR / RemoteWorker fill-table config uses `mqtt_topic_base = UIPUT/ws/dam/pic/de`.
- Minimal Submit dual-bus app request goes to `UIPUT/ws/dam/pic/de/R1/3000/submit1` and receives on a distinct response topic.
- Real browser testing confirms the minimal Submit flow and affected slide-app runtime still update the UI.
