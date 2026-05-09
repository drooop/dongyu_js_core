---
title: "0362 Slide App Self Described Route Plan"
doc_type: iteration_plan
status: approved
updated: 2026-05-07
source: ai
iteration: 0362-slide-app-self-described-route
---

# Iteration 0362-slide-app-self-described-route Plan

## Goal

- Freeze and implement the slide app bundle route contract where an uploaded ZIP contains only ModelTable records, and outbound requests carry a self-described `route.to` / `route.reply_to` instead of requiring MBR per-app route registration.
- Clarify that `route.to.pin` is the target model's public root pin, and that remote-worker internal `pin.connect.cell` / `pin.connect.label` wiring decides which program model is triggered.
- Prove the contract with a real uploaded slide app whose local UI Server model id differs from the remote provider model id.

## Scope

- In scope:
- SSOT updates for `remote_bus_endpoint_v1`, provider/local model identity split, public pin semantics, and no MBR per-app route registration.
- Contract tests that reject old assumptions: topic based on local installed model id, missing `route.reply_to`, or direct program invocation through payload-only routing.
- UI Server importer/exporter/runtime changes needed to preserve `remote_bus_endpoint_v1`, remap local references, and attach self-described route metadata to outbound `pin_payload`.
- MBR/remote-worker generic handling needed to route by message `route.to` and return by `route.reply_to`.
- Update minimal Submit payload/zip/docs so the example reflects `RE:provider_model_id -> UI local model_id` split.
- Local deployment refresh and Playwright browser E2E against `http://127.0.0.1:30900/#/workspace`.
- Out of scope:
- Declaring or installing the remote-worker provider program model from the UI Server ZIP.
- Introducing non-ModelTable manifest files in the ZIP.
- Compatibility aliases for old `pin.connect.model`, object pin payloads, or per-app static MBR route registration.
- Remote cloud deployment unless needed for local verification parity.

## Invariants / Constraints

- ZIP payload is exactly one JSON file named `app_payload.json`, and its content is a ModelTable records array.
- `remote_bus_endpoint_v1` is ModelTable data, not a sidecar manifest. It declares the remote destination worker/model defaults only.
- `route.to.worker_id + route.to.model_id + route.to.pin` identifies the remote public entry pin.
- `route.reply_to.worker_id + route.reply_to.model_id + route.reply_to.pin` identifies the local return target and is server-owned: UI Server must synthesize it from the installed local app instance and current host identity at runtime.
- Imported ZIP records must not provide or override runtime `route.reply_to`; if any bundle declares a reply target as install/runtime truth, importer or contract validation must reject it.
- `pin` never directly names a cross-cell function endpoint. It names a public Cell pin; remote internal wiring is explicit ModelTable `pin.connect.cell` plus `pin.connect.label`.
- MBR must not require installing a per-app route label for every uploaded app instance.
- All formal business events still enter UI Server through Model 0 `pin.bus.in` and all pin values remain Temporary ModelTable Message record arrays.
- Each stage must end with a spawned sub-agent `codex-code-review` result of `Decision: APPROVED` after fixes. Unresolved findings are blocking unless they are explicitly outside that stage's approved scope.

## Success Criteria

- SSOT/user-guide docs describe the exact fill-table records for RE Model 3000 root and program cell `(1,1,1)` for `submit1`.
- Deterministic tests prove imported UI local id and remote provider id are separate, and outbound payload routes to the remote provider id while reply targets the local id.
- MBR generic forwarding uses message route metadata rather than a pre-registered per-app route.
- The saved minimal Submit ZIP imports through Workspace, opens as a new local model, submits through `route.to.pin`, receives a result, and updates the displayed text in a real browser.
- Deterministic tests prove imported ZIP records cannot inject or override `route.reply_to`.
- Every implementation stage is reviewed by a spawned sub-agent using `codex-code-review`, and the stage does not proceed until the final review returns `Decision: APPROVED`.

## Inputs

- Created at: 2026-05-07
- Iteration ID: 0362-slide-app-self-described-route
- User-approved direction: ZIP only contains ModelTable records; no remote-worker program model in the UI bundle; no MBR per-app route registration; `pin` is the target model public entry pin.
