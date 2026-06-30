---
title: "Iteration 0430 Feishu Operational SSOT Implementation Plan"
doc_type: iteration-plan
status: in-progress
updated: 2026-07-01
source: ai
iteration_id: 0430-feishu-operational-ssot-impl
id: 0430-feishu-operational-ssot-impl
phase: execution
---

# Iteration 0430-feishu-operational-ssot-impl Plan

## Goal

Implement the 0429 blueprint: propagate the 0428 Feishu alignment target into
operational SSOT, harden validators/runtime against stale labels and nested
formal payloads, refit project-owned fill-table assets and examples, then prove
the new path with local deployment and browser E2E.

## Scope

- In scope:
  - Update operational SSOT docs for model labels, pin connection, temporary
    payloads, imported slide App ingress, and user guide impact.
  - Add tests/validators before behavior changes.
  - Implement the minimum runtime/server hard-cut required by those tests.
  - Refit active project-owned Tier2 assets and built-in model assets.
  - Refit Minimal Submit, E2E Color Generator, To Do Board, provider-owned
    install examples, and developer docs.
  - Deploy locally and verify with real browser flows.
  - Run sub-agent `codex-code-review` after each stage and after the full
    iteration; fix findings before moving on.
- Out of scope:
  - Remote/cloud deployment.
  - Merge to `dev` / `main`.
  - Compatibility aliases or fallbacks for stale labels / stale payload shapes.
  - Changing Feishu source documents.

## Invariants / Constraints

- `CLAUDE.md` remains the highest repo-local execution constraint.
- 0428 and 0429 are direct inputs.
- `pin.connect.model` remains removed and must not be reintroduced.
- Project input labels must reject `model.v1n`,
  `model.subtableconnection`, and `model.submtconnection`.
- `model.v1n` semantics remain represented as project `model.table` plus exact
  worker labels:
  - `k = "sys_worker_role"`, `t = "worker.role"`,
    `v = "WSM" | "DEM" | "V1N"`.
  - `k = "sys_worker_id"`, `t = "worker.id"`,
    `v = "ws/dam/pic/de/sw"`.
- Formal business pin/bus values must be Temporary ModelTable record arrays.
- Target formal transport is `pin_payload.v2` or an exactly equivalent
  non-nested record-array shape; this iteration uses `pin_payload.v2` as the
  named target.
- Persistence remains explicit materialization.
- App instance traffic must use table-qualified durable references:
  `{ table_id, model_id }`.
- No compatibility layer is allowed. Old forms must fail closed, not be
  normalized silently.
- Runtime CJS and ESM behavior must remain aligned.

## Success Criteria

- Operational SSOT docs describe the same accepted/rejected label set and
  target payload shape.
- Tests prove rejected labels and nested formal payloads fail closed.
- Runtime/server pass the new tests and existing targeted regression tests.
- Active Tier2 assets and examples use the target non-nested formal transport
  shape.
- Developer docs explain submit/request, response materialization, and provider
  bundle install using the target shape.
- Local deployment completes.
- Browser E2E proves at least:
  - Minimal Submit request/response materializes visibly.
  - E2E Color Generator changes color after Generate.
  - Workspace Manager provider-owned install can install and open an App.
- Every stage has sub-agent review recorded in runlog.

## Inputs

- Created at: 2026-07-01
- Iteration ID: `0430-feishu-operational-ssot-impl`
- Branch: `dropx/dev_0430-feishu-operational-ssot-impl`
- Source SSOT / plans:
  - `docs/ssot/feishu_model_label_alignment_v1.md`
  - `docs/iterations/0429-feishu-model-label-operational-ssot/plan.md`
  - `docs/iterations/0429-feishu-model-label-operational-ssot/resolution.md`
