---
title: "0384 - Provider-Owned Slide App Install Plan"
doc_type: iteration-plan
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0384-provider-owned-slide-app-install
id: 0384-provider-owned-slide-app-install
phase: completed
---

# Iteration 0384-provider-owned-slide-app-install Plan

## Goal

Make Workspace Manager install slide apps from provider-owned bundles. Workspace Manager remains the index/catalog; the actual app payload for assets such as `E2E 颜色生成器` and `最小 Submit 双总线示例` must be requested from RemoteWorker `R1` and materialized by UI Server only after the provider returns a ModelTable bundle.

## Background

0378 made Workspace Manager interactive and added install buttons, but the install path still reads a local `source_model_id` from UI Server's asset catalog, exports that local model, and imports the result. That proves the materializer, but it does not match the intended ownership model:

- Workspace Manager should know which provider owns an asset.
- RemoteWorker `R1` should own the slide-app bundle content it provides.
- UI Server should only request, validate, allocate a local model id, mount, and render.
- The Workspace Manager DEM ModelTable owns the installable asset index. UI Server may keep a local projection/cache of that index for rendering, but the projection is not the authority.

0384 closes this ownership gap without changing the installed app runtime path that 0375/0379 already proved.

## Invariants (Must Not Change)

- UI Server is the slide-app host and installer, not the business truth owner for provider assets.
- Workspace Manager is an index/catalog. Its index truth is owned by Workspace Manager DEM ModelTable data; UI Server-hosted Workspace Manager UI is only a projection of that truth.
- Workspace Manager must not be the source of the provider bundle unless Workspace Manager itself is the provider.
- A provider bundle is still ModelTable data. Any request/response payload during transfer must be a Temporary ModelTable record array.
- Formal events must enter through UI Server Model 0 and the existing pin/control-bus path; no direct frontend writes to provider runtime.
- Do not preserve or add compatibility fallbacks for the old `source_model_id` install path. If provider endpoint data is missing, install must fail visibly.
- Imported bundles must continue to reject forbidden runtime truth: `pin.bus.*`, `pin.connect.model`, `ui.egress.binding.v1`, `reply_target_*`, `route.reply_to`, legacy object payloads, and secrets.
- `remote_bus_endpoint_v1` in the returned bundle continues to describe runtime business egress, not the bundle download request itself.
- Every implementation stage must be reviewed by a spawned sub-agent using `codex-code-review`; unresolved review findings block the next stage.

## Scope

### In Scope

- Freeze the provider-owned install contract in iteration docs and relevant SSOT/user-guide docs.
- Replace Workspace Manager installable asset rows with provider endpoint metadata instead of local source-model truth.
- Add RemoteWorker `R1` provider-side bundle service for the current two installable assets:
  - `E2E 颜色生成器`
  - `最小 Submit 双总线示例`
- Change UI Server install handling so clicking install sends a provider bundle request through Model 0 / bus path and materializes only provider-returned bundle records.
- Keep local materialization behavior: allocate a new model id, mount into Workspace, generate host ingress/egress labels, update sidebar selection/status.
- Update deterministic tests to prove the new path and reject the old local-copy path.
- Redeploy locally and verify with a real browser that Workspace Manager installs a provider-owned app and the installed app still runs through the existing dual-bus path.

### Out of Scope

- Dynamic cross-workspace discovery.
- Full app store/version negotiation.
- PICS implementation.
- Multi-provider authentication, payment, or permission UI.
- Cloud deployment unless local verification and user request later require it.
- Changing the runtime business endpoint contract for installed apps.

## Success Criteria (Definition of Done)

- Workspace Manager asset catalog rows for installable slide apps no longer use `source_model_id` as the install source.
- Install action fails if provider endpoint / asset id / bundle response is missing or malformed; it must not silently fall back to local model export.
- A provider response must match the pending install request before materialization: `op_id` or request correlation, `asset_id`, provider endpoint, and `reply_target` must all match the pending request.
- A stale, mismatched, or otherwise well-formed response for the wrong pending request must write a visible failure and must not create a model.
- RemoteWorker `R1` exposes a ModelTable-driven bundle response for both current slide-app assets.
- UI Server sends a bundle request as `pin_payload.v1` through Model 0 bus output and records an install status visible in Workspace Manager.
- UI Server validates the provider-returned bundle with the existing slide-app import validator before materialization.
- Installed app appears as a new Workspace sidebar entry and runs normally in browser after install.
- Tests prove: provider index shape, no `source_model_id` install fallback, provider bundle response validation, materialization from returned payload, and no legacy/compatibility labels.
- Each plan/implementation stage has sub-agent `codex-code-review` approval recorded in runlog.

## Risks & Mitigations

- Risk: async provider response may make install appear stuck.
  - Impact: user clicks install but sees no local app.
  - Mitigation: write visible request status immediately, materialize on response, and write explicit failure labels on timeout/malformed responses.
- Risk: reusing existing `pin_payload.v1` response materialization may accidentally write bundle records into Workspace Manager instead of installing them.
  - Impact: bundle data becomes state labels rather than an installed app.
  - Mitigation: detect `slide_app_bundle_response.v1` before generic owner materialization and route it to the installer path.
- Risk: provider bundle service could leak host-owned labels if it exports from a runtime model.
  - Impact: imported app contains stale local id, generated labels, or runtime state.
  - Mitigation: provider response must use the existing export filter/validator and tests must reject generated labels.
- Risk: current R1 remote patch only subscribes runtime pins.
  - Impact: bundle request never reaches provider.
  - Mitigation: add explicit provider bundle pin/subscription and route it through existing root/model pin wiring.

## Open Questions

None blocking. This iteration assumes `R1` can provide the bundle through a public provider pin, and UI Server may perform the final install as a host-owned materialization step after receiving the provider response.

## Compliance Checklists

### SSOT Alignment Checklist

- `docs/architecture_mantanet_and_workers.md`: Workspace Manager is an index/catalog DE service; UI Server installs/mounts/renders.
- `docs/ssot/runtime_semantics_modeltable_driven.md`: bus payloads remain Temporary ModelTable record arrays; positive apps do not declare bus pins.
- `docs/ssot/pin_connection_contract_v2.md`: provider bundle pins and any new connections remain ordinary `pin.in`/`pin.out` and `pin.connect.label` / `pin.connect.cell`; no `pin.connect.model` or removed endpoint syntax.
- `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`: imported bundle remains provider-authored ModelTable records; host-owned ingress/egress labels are generated only after install.
- `docs/ssot/temporary_modeltable_payload_v1.md`: provider request and response use `pin_payload.v1` and nested record arrays.
- `docs/ssot/label_type_registry.md`: new labels must either reuse existing label types or be documented when they become durable contract labels.
- `docs/ssot/tier_boundary_and_conformance_testing.md`: 0384 runlog must record PASS/FAIL for tier placement, model placement, data ownership, data flow, and data chain.

### Charter Compliance Checklist

- Tier placement: provider bundle truth lives in provider worker model; local installed instance lives in UI Server positive model after explicit materialization.
- Model placement: bus pins remain only on Model 0; imported positive app roots expose ordinary pins.
- Data ownership: Workspace Manager DEM owns catalog index truth; catalog index is not payload truth; provider owns payload truth; UI Server owns installed local instance identity.
- Data flow: UI click -> Workspace Manager action -> UI Server Model 0 bus out -> MBR/control bus -> R1 provider pin -> response -> UI Server installer -> Workspace mount.
- No compatibility: old `source_model_id` local-copy install path is removed from formal runtime behavior.
