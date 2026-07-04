---
title: "Iteration 0429 Feishu Model Label Operational SSOT Plan"
doc_type: iteration-plan
status: planned
updated: 2026-07-01
source: ai
iteration_id: 0429-feishu-model-label-operational-ssot
id: 0429-feishu-model-label-operational-ssot
phase: planning
---

# Iteration 0429-feishu-model-label-operational-ssot Plan

## Goal

Freeze the next implementation plan for turning the 0428 Feishu alignment
target into operational repo contracts, validators, runtime behavior,
fill-table patches, developer examples, and browser-verifiable flows.

## Scope

- In scope:
  - Identify the operational SSOT files that must be updated in the follow-up
    implementation iteration.
  - Freeze `pin_payload.v2` as the target non-nested Temporary ModelTable
    message kind that the follow-up implementation iteration should enforce.
  - Define the validator/runtime work needed to reject stale labels and stale
    nested message shapes in the follow-up implementation iteration.
  - Define the fill-table refit work for UI Server, MBR, Workspace Manager, R1,
    and slide App examples.
  - Define the local deployment and browser E2E verification required after
    implementation.
  - Record per-stage sub-agent review requirements for the follow-up
    implementation iteration.
- Out of scope for this planning iteration:
  - Operational SSOT edits outside this iteration's own planning docs.
  - Runtime code edits.
  - Fill-table patch edits.
  - Local or remote deployment.
  - Browser E2E execution.
  - Merging to `dev` / `main`.
  - Backward-compatible aliases for rejected labels or old payload shapes.

## Invariants / Constraints

- `CLAUDE.md` remains the highest repo-local execution constraint.
- 0428 target SSOT is the direct input for this iteration.
- `pin.connect.model` remains removed and must not be reintroduced.
- Project input labels must not accept `model.v1n`,
  `model.subtableconnection`, or `model.submtconnection`.
- `model.v1n` remains represented as project `model.table` plus exact worker
  labels:
  - `k = "sys_worker_role"`, `t = "worker.role"`,
    `v = "WSM" | "DEM" | "V1N"`.
  - `k = "sys_worker_id"`, `t = "worker.id"`,
    `v = "ws/dam/pic/de/sw"`.
- Formal business pin/bus values must be Temporary ModelTable record arrays.
- Persistence remains explicit materialization; transport, forwarding,
  tracing, and rendering do not create formal labels by themselves.
- App instance traffic must use table-qualified durable references:
  `{ table_id, model_id }`.
- No compatibility layer is allowed. The implementation stage must use tests
  and refit work to catch old shapes instead of silently accepting them.

## Success Criteria

- `resolution.md` clearly separates 0429 docs-only planning work from the
  follow-up implementation stages.
- The follow-up implementation plan is split into reviewable stages with files,
  verification commands, acceptance criteria, and rollback notes.
- Operational SSOT propagation targets are explicitly listed.
- Validator/runtime hard-cut targets are explicitly listed.
- Fill-table refit targets and browser E2E targets are explicitly listed.
- `docs/ITERATIONS.md` registers this iteration as `Planned`.
- `runlog.md` records the scaffold commands, current branch, source docs, local
  planning checks, and sub-agent review decision.
- Sub-agent review approves the plan or all findings are resolved.

## Inputs

- Created at: 2026-07-01
- Iteration ID: `0429-feishu-model-label-operational-ssot`
- Branch: `dropx/dev_0429-feishu-model-label-operational-ssot`
- Source SSOT:
  - `docs/ssot/feishu_model_label_alignment_v1.md`
  - `docs/iterations/0428-feishu-model-label-ssot-plan/resolution.md`
- Feishu source extracts used by 0428:
  - `/tmp/feishu_LGsZ_model_doc.md`
  - `/tmp/feishu_JYNW_doc.md`
  - `/tmp/feishu_WBZj_doc.md`
