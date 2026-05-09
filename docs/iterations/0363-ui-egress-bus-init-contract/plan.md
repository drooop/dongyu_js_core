---
title: "0363 UI Egress Bus Init Contract Plan"
doc_type: iteration_plan
status: approved
updated: 2026-05-09
source: ai
iteration: 0363-ui-egress-bus-init-contract
---

# Iteration 0363-ui-egress-bus-init-contract Plan

## Goal

- Freeze the next contract for UI model egress management-bus binding, split system bus pins into control-bus and management-bus families, and define software-worker startup ordering in project terms.
- Keep this iteration documents-only. Runtime, system model, deployment patch, existing UI asset, local deploy, and browser E2E changes belong to the follow-up implementation iteration.

## Scope

- In scope:
- Define target bus pin families:
  - local Cell pins stay `pin.in` / `pin.out` / `pin.login` / `pin.logout`
  - control-bus boundary pins become `pin.bus.cb.in` / `pin.bus.cb.out`
  - management-bus boundary pins become `pin.bus.mb.in` / `pin.bus.mb.out`
- Define placement and role constraints for the target contract.
- Define host-owned UI egress binding so a UI model can show which management-bus pin a public UI `pin.out` uses, without letting the imported app directly declare bus pins.
- Define software-worker startup order using project terms:
  - establish models and hierarchy
  - write worker identity and role
  - write external communication parameters
  - load program models
  - declare pins
  - declare connections
  - restore executable runtime data after wiring is complete
- Document 0364 implementation and verification obligations, including re-fill-table review for `ui-server` / `mbr` / `remote-worker`, existing UI model adjustments, and a new "最小 Submit 双总线示例" JSON patch plus browser test.
- Out of scope:
- Runtime code changes.
- System model JSON / deploy patch migration.
- Local or remote deployment.
- Playwright browser verification.
- Committing or merging the follow-up implementation.

## Invariants / Constraints

- No compatibility aliases may be introduced. Removed forms such as `pin.connect.model` and `pin.log.*` remain removed.
- The 0363 documents must avoid making the current runtime silently non-conformant before 0364. When describing target behavior, mark any unimplemented change as a target contract for the follow-up implementation.
- Imported slide app ZIP payloads remain ModelTable-only records and must not contain host-owned runtime truth.
- UI remains a projection of ModelTable. UI models may declare public out pins and endpoint intent, but formal egress must be installed by the host and routed through the worker root.
- Pin payload values remain Temporary ModelTable Messages: format is ModelTable-like, persistence is explicit materialization.
- Every small stage must receive sub-agent `codex-code-review`; unresolved findings block the next stage.

## Success Criteria

- `docs/ssot/pin_connection_contract_v2.md`, `docs/ssot/label_type_registry.md`, and `docs/ssot/runtime_semantics_modeltable_driven.md` agree on the target bus pin split and worker startup order.
- UI egress binding is described as host-owned installed truth, not provider-authored bundle truth.
- The follow-up implementation plan explicitly includes re-fill-table review for `ui-server` / `mbr` / `remote-worker`, existing UI surface adjustment, new minimal Submit JSON patch output, and actual browser testing.
- `docs/ITERATIONS.md` registers this iteration and is updated to `Completed` only after docs, runlog evidence, and review gates are complete.

## Inputs

- Created at: 2026-05-09
- Iteration ID: 0363-ui-egress-bus-init-contract
- User-approved direction: include implementation-aftercare items in the plan, especially re-fill-table review, existing UI model adjustment, and new minimal Submit JSON patch plus browser testing in the follow-up implementation.
