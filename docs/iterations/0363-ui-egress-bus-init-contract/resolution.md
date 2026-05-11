---
title: "0363 UI Egress Bus Init Contract Resolution"
doc_type: iteration_resolution
status: approved
updated: 2026-05-09
source: ai
iteration: 0363-ui-egress-bus-init-contract
---

# Iteration 0363-ui-egress-bus-init-contract Resolution

## Execution Strategy

- Execute as a documents-only contract freeze.
- Split work into small review-gated stages. After each stage, spawn a sub-agent using `codex-code-review`; fix findings before continuing.
- Do not modify runtime code, system model JSON, deploy patches, or test scripts in this iteration. Those changes belong to the follow-up implementation iteration.
- Record factual commands and review decisions in `runlog.md`.

## Step 1

- Scope: Register the iteration and freeze the documents-only work plan.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0363-ui-egress-bus-init-contract/plan.md`
  - `docs/iterations/0363-ui-egress-bus-init-contract/resolution.md`
  - `docs/iterations/0363-ui-egress-bus-init-contract/runlog.md`
- Verification:
  - `git diff --check`
  - sub-agent review of the scaffold and plan
- Acceptance:
  - The iteration is registered.
  - The plan states that 0363 is docs-only and that 0364 performs implementation.
  - Review returns `APPROVED`.
- Rollback:
  - Remove the 0363 iteration row and scaffold files.

## Step 2

- Scope: Freeze bus pin family and placement semantics.
- Files:
  - `CLAUDE.md`
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/pin_connection_contract_v2.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
- Verification:
  - grep checks for the target labels and forbidden `pin.log.*` restoration
  - sub-agent review
- Acceptance:
  - Local pins stay `pin.in` / `pin.out` / `pin.login` / `pin.logout`.
  - Target system bus pins are `pin.bus.cb.in` / `pin.bus.cb.out` and `pin.bus.mb.in` / `pin.bus.mb.out`.
  - `pin.bus.mb.*` is restricted to DEM worker root Model 0 `(0,0,0)`.
  - `pin.bus.cb.*` is restricted to worker root Model 0 `(0,0,0)`.
  - The old `pin.bus.in` / `pin.bus.out` surface is described only as current implementation / migration surface until 0364, not as the target authoring surface.
- Rollback:
  - Revert the Step 2 SSOT edits.

## Step 3

- Scope: Freeze UI egress management-bus binding semantics.
- Files:
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/user-guide/modeltable_user_guide.md`
- Verification:
  - grep checks for `ui.egress.binding.v1`, `remote_bus_endpoint_v1`, and forbidden provider-owned bus declarations
  - sub-agent review
- Acceptance:
  - Provider ZIPs may declare public root out pins and remote endpoint intent.
  - Provider ZIPs must not declare host-owned `ui.egress.binding.v1` or bus pins.
  - The installer creates host-owned egress binding records after assigning the local model id.
  - The UI model can display which host management-bus pin a UI public out pin uses.
- Rollback:
  - Revert the Step 3 docs.

## Step 4

- Scope: Freeze software-worker startup order and 0364 implementation obligations.
- Files:
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/iterations/0363-ui-egress-bus-init-contract/runlog.md`
- Verification:
  - grep checks for the startup order terms
  - sub-agent review
- Acceptance:
  - Startup order uses project terms, not generic wording that hides ModelTable identity, program models, pins, connections, or runtime data ordering.
  - The follow-up implementation requirements include re-fill-table review for `ui-server` / `mbr` / `remote-worker`, existing UI model/interface adjustments, and new minimal Submit JSON patch plus browser E2E.
- Rollback:
  - Revert Step 4 docs.

## Step 5

- Scope: Final docs validation and iteration closure.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0363-ui-egress-bus-init-contract/runlog.md`
- Verification:
  - `git diff --check`
  - grep checks for pending placeholders
  - final sub-agent review
- Acceptance:
  - All review findings are fixed.
  - `runlog.md` contains factual evidence.
  - `docs/ITERATIONS.md` marks 0363 `Completed`.
- Rollback:
  - Revert closure status to `Approved` or `In Progress` if final review fails.

## Notes

- Generated at: 2026-05-09
