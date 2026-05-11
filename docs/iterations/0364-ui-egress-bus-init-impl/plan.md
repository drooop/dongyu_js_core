---
id: 0364
title: ui-egress-bus-init-impl
doc_type: iteration_plan
status: Completed
updated: 2026-05-10
source: ai
branch: dev_0364-ui-egress-bus-init-impl
created_at: 2026-05-10
iteration_id: 0364-ui-egress-bus-init-impl
phase: phase1
---

# 0364 UI Egress / Bus Init Implementation Plan

## Goal

Implement the 0363 frozen contract in runtime, installer/importer, system fill-table patches, user-facing examples, and local browser verification.

## Done Criteria

- Runtime hard-cuts legacy `pin.bus.in` / `pin.bus.out`; only `pin.bus.cb.*` and `pin.bus.mb.*` are valid bus boundary pins.
- Management-bus pins are accepted only for DEM model-table Model 0 `(0,0,0)`; non-DEM workers fail loudly instead of silently falling back.
- Slide App install/export uses host-owned `ui.egress.binding.v1`; provider ZIP/JSON patch cannot declare bus pins or host bindings.
- Existing UI models, system patches, MBR, and remote-worker fill-table content are adjusted to the new split bus contract with no compatibility path.
- The “最小 Submit 双总线示例” JSON patch and docs are updated for the new contract.
- Local deployment is refreshed and real-browser Playwright verification covers workspace slide flow, color generator, and minimal Submit dual-bus flow.
- Each implementation stage has a sub-agent `codex-code-review` gate; findings are fixed before moving on.

## Small Stages

1. Iteration setup and executable plan.
2. Runtime bus-pin split and startup role validation, test-first.
3. UI-server installer/importer, egress binding, and event ingress implementation.
4. System fill-table refill for ui-server / mbr / remote-worker plus existing UI model cleanup.
5. Minimal Submit JSON patch, userguide, visualized/static docs, and export/install documentation.
6. Local deploy and real-browser E2E verification.
7. Final closure review, iteration ledger update, commit, and merge readiness.

## Verification Plan

- Deterministic runtime tests: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`, plus affected existing pin/bus tests.
- Import/export tests: existing slide import/export and minimal Submit tests, updated to assert split bus and host-owned bindings.
- Static contract scans: reject legacy bus pins in active runtime, server, deploy patches, and userguide examples except explicit historical notes.
- Build checks: frontend/server package checks that are relevant to touched surfaces.
- Browser checks: Playwright against local `http://127.0.0.1:30900/#/workspace` after deployment refresh.

## Review Gates

After every stage, a sub-agent must run `codex-code-review` over the bounded diff and verification evidence. Any finding must be fixed and re-reviewed before starting the next stage.
