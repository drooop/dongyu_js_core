---
title: "0376 - Control First MBR Routing Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0376-control-first-mbr-routing
id: 0376-control-first-mbr-routing
phase: completed
---

# Iteration 0376-control-first-mbr-routing Resolution

## Execution Strategy

Use a hard-cut, test-first sequence. First update the normative contract and add failing checks for the new route truth. Then change the runtime topic derivation, UI Server imported host egress generation, MBR Tier 2 patch, and minimal-submit assets. After each implementation stage, run the targeted checks and request a sub-agent code review before moving on.

## Step 1 — Contract and Iteration Gate

- Scope: update iteration docs and normative docs to freeze the new control-bus-first contract.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0376-control-first-mbr-routing/plan.md`
  - `docs/iterations/0376-control-first-mbr-routing/resolution.md`
  - `docs/iterations/0376-control-first-mbr-routing/runlog.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - `docs/user-guide/slide-app-runtime/*.md`
- Verification:
  - `rg -n "UI/滑动 App.*默认属于管理总线|pin.bus.mb.out.*默认|endpoint metadata records 决定|管理总线转控制总线" docs/ssot docs/user-guide`
  - targeted doc contract tests after Step 2.
- Acceptance:
  - docs say default slide-app egress is control bus to MBR.
  - docs say MBR routes by payload `topic`, not endpoint records.
  - docs say management bus is explicit/future cross-workspace only.
- Rollback: revert documentation edits and iteration index entry.

## Step 2 — Failing Contract Tests

- Scope: add or update tests that fail on the current old behavior.
- Files:
  - `scripts/tests/test_0376_control_first_mbr_routing_contract.mjs` or updated existing nearest tests.
  - `scripts/tests/test_0364_slide_import_bus_binding_contract.mjs`
  - `scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
  - `scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
  - `scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Verification:
  - Run the new/updated tests and record the expected failing assertions before production changes.
- Acceptance:
  - failures prove current code still generates `pin.bus.mb.out` or endpoint-derived routing.
  - failures prove missing `topic` is not allowed to fall back to endpoint records.
  - failures prove missing `route_kind` is accepted as control, while invalid `route_kind` is rejected.
- Rollback: remove only the new/updated failing tests if the contract is rescoped before implementation.

## Step 3 — Runtime and UI Server Host Egress

- Scope: make control bus the default physical route and include `topic` / `route_kind` records in generated payloads.
- Files:
  - `scripts/worker_engine_v0.mjs`
  - `packages/ui-model-demo-server/server.mjs`
  - nearby server/runtime tests.
- Verification:
  - Targeted tests from Step 2 pass for host egress and topic routing.
  - Negative checks reject missing/unsafe topic.
- Acceptance:
  - generated imported app egress binding has `host_pin_type="pin.bus.cb.out"` and `bus="control"`.
  - `pin.bus.cb.out` publishes to payload `topic`.
  - endpoint records no longer decide MBR or worker engine MQTT publish topic; missing `topic` fails closed instead of falling back to endpoint records.
  - generated installed slide-app ingress/egress labels connect through Model 0 using `pin.bus.cb.*` by default, not `pin.bus.mb.*`.
- Rollback: revert server/runtime changes and associated tests.

## Step 4 — MBR Tier 2 Refill

- Scope: refill MBR model patch functions for the first two duties.
- Files:
  - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
  - MBR contract tests.
- Verification:
  - MBR tests prove `control -> control`, `control -> management`, and invalid topic rejection.
  - MBR tests prove default ingress is control bus and default slide-app traffic no longer enters MBR through `pin.bus.mb.in`.
  - Search proves no MBR dispatch function still derives route topic from endpoint records.
- Acceptance:
  - `route_kind="control"` writes `mbr_cb_out`.
  - `route_kind="management"` writes `mbr_mb_out`.
  - MBR-to-MBR management remains documented out of scope.
- Rollback: revert MBR patch and tests.

## Step 5 — Minimal Submit Assets, Local Deploy, Browser Verification

- Scope: update example JSON/docs and verify the running local app with real browser.
- Files:
  - `docs/user-guide/slide-app-runtime/minimal_submit_dual_bus_app_payload.json`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html`
  - deployment docs if the local/remote deploy path changes.
- Verification:
  - deterministic tests from all earlier steps.
  - local stack restart/deploy using current project script.
  - Playwright browser test at local Workspace for color generator and minimal submit flow.
- Acceptance:
  - docs and examples show `topic` / `route_kind`.
  - browser verifies real installed app can submit and update visible result.
  - color generator submit changes result state after local deployment.
- Rollback: revert docs/assets and redeploy previous local stack if required.

## Notes

- Generated at: 2026-05-18
- Sub-agent code review is required after each implementation step and before final report.
