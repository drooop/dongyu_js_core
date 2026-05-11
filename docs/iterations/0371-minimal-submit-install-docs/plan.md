---
id: 0371
title: minimal-submit-install-docs
doc_type: iteration_plan
status: Completed
updated: 2026-05-11
source: ai
branch: dropx/0371-minimal-submit-install-docs
created_at: 2026-05-11
iteration_id: 0371-minimal-submit-install-docs
phase: phase1
---

# Iteration 0371 Minimal Submit Install Docs Plan

## Goal

- Extend the "最小 Submit 双总线示例" developer docs and interactive HTML so they explain what happens after the zip reaches UI Server: model materialization, `model.submt` mount, sidebar appearance, generated host ingress/egress labels, and the path from imported root `(0,0,0)` to Model 0 `(0,0,0)` for management-bus egress.

## Scope

- In scope:
- Update the Markdown guide and interactive HTML.
- Add deterministic docs checks for installer-generated labels and mount/egress path explanation.
- Record the iteration evidence.
- Out of scope:
- Runtime changes, JSON patch changes, zip changes, remote deployment, or browser app behavior changes.

## Invariants / Constraints

- Provider zip must remain free of host-owned labels such as `ui.egress.binding.v1`, `pin.bus.*`, and generated cleanup labels.
- `route.reply_to` remains server-owned and must not be put in zip.
- Documentation must match the current installer implementation in `packages/ui-model-demo-server/server.mjs`.

## Success Criteria

- Markdown and HTML docs explain:
  - materialization from temp `id: 0` to local installed model id;
  - `model.submt` mount into Model 0 workspace mount cell;
  - sidebar/catalog appearance;
  - generated `host_ingress_generated_*`, `host_egress_generated_*`, and `ui_egress_submit1_binding` labels;
  - imported root `submit1` to Model 0 root `mt_bus_send / pin.bus.mb.out` path.
- Minimal Submit docs tests pass.
- Import/export tests pass.
- HTML renders in Playwright.
- `git diff --check` passes.

## Inputs

- Created at: 2026-05-11
- Iteration ID: 0371-minimal-submit-install-docs
