---
title: "Iteration 0423 Snapshot Granularity Implementation Runlog"
doc_type: iteration-runlog
status: in-progress
updated: 2026-06-23
source: ai
iteration_id: 0423-snapshot-granularity-impl
id: 0423-snapshot-granularity-impl
phase: execution
---

# Iteration 0423-snapshot-granularity-impl Runlog

## Environment

- Date: 2026-06-23
- Branch: `dropx/dev_0423-snapshot-granularity-impl`
- Runtime target: local OrbStack only
- Remote deployment: out of scope

## Review Gate Record

- Iteration ID: `0423-snapshot-granularity-impl`
- Review Date: 2026-06-23
- Review Type: User + sub-agent design review
- Decision: Approved
- Notes:
  - User approved starting implementation after the reviewed design.
  - Design review sub-agent `019ef0d1-a72e-7cb2-bcb0-1efc6c63a2b1` initially requested changes.
  - After tightening `full` diagnostics-only boundary, visible-model-set recovery, Workspace Manager install/remove checks, permission matrix, and pass/fail acceptance targets, the same sub-agent returned `Decision: APPROVED`.

## Execution Records

### Phase 1: Snapshot Size Instrumentation And Baseline

- Status: implemented, pending sub-agent review
- RED command:
  - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
- RED result:
  - `FAIL test_profile_stats_are_computed_after_profile_filtering`
  - reason: `buildClientSnapshotProfileWithStats(snapshot, options)` was not exported.
- Implementation:
  - Added `buildClientSnapshotProfileWithStats`.
  - Added client-visible `snapshot_stats` helper for total bytes, model/cell/label contributors, and dropped counts.
  - Added `scripts/tests/test_0423_snapshot_granularity_contract.mjs`.
  - Added `scripts/ops/report_snapshot_profile_sizes.mjs`.
- GREEN commands:
  - `node scripts/tests/test_0423_snapshot_granularity_contract.mjs`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/ops/report_snapshot_profile_sizes.mjs --top-models 5 --top-labels 8`
- GREEN key output:
  - `PASS test_0423_snapshot_granularity_contract: 2 passed`
  - `PASS 7/7`
  - report command printed `bootstrap`, `visible:100`, and `full` contributors.
- Local baseline command:
  - `node scripts/ops/report_snapshot_profile_sizes.mjs --top-models 5 --top-labels 8`
- Local baseline key output:
  - `bootstrap`: `158415B`, `7` models, `318` cells, `2006` labels.
  - `visible:100`: `172047B`, `8` models, `338` cells, `2166` labels.
  - `full`: `722185B`, `58` models, `1220` cells, `8111` labels.
  - top `bootstrap` model contributors:
    - `-103`: `119603B`
    - `-28`: `13892B`
    - `-23`: `9517B`
    - `-2`: `8491B`
    - `-29`: `6381B`
  - top `bootstrap` label contributors:
    - `-2/0,0,0/ws_apps_registry`: `5917B`
    - `-2/0,0,0/ui_page_catalog_json`: `1134B`
    - `-103/2,198,0/ui_props_json`: `596B`
    - `-103/2,64,0/ui_bind_json`: `467B`
    - `-28/2,0,0/ui_props_json`: `451B`
  - top `bootstrap` cell contributors:
    - `-2/0,0,0`: `8429B`
    - `-103/2,198,0`: `993B`
    - `-103/2,64,0`: `946B`
    - `-23/2,12,0`: `802B`
    - `-29/3,3,0`: `752B`
- Result: PASS
- Phase 1 review 1:
  - Agent: `019ef0dd-bb34-7e20-b922-6a08f0e430b4`
  - Decision: Change Requested
  - Findings:
    - Test only covered `bootstrap`, not `visible` and `full`.
    - Baseline command was elided and not reproducible.
- Fix after review:
  - Extended the test to cover `bootstrap`, `visible`, and `full` stats.
  - Added checked-in report script with exact command.
  - Re-ran verification commands above.
- Phase 1 review 2:
  - Agent: `019ef0dd-bb34-7e20-b922-6a08f0e430b4`
  - Decision: Change Requested
  - Finding:
    - Report script omitted `stats.cells`, so bytes-by-cell was not reproducible.
- Fix after review 2:
  - Added `top_cells` to `scripts/ops/report_snapshot_profile_sizes.mjs`.
  - Added test coverage that report output includes `top_cells` for `bootstrap`, `visible`, and `full`.
  - Re-ran verification commands above.
- Commit: pending

### Phase 2: Strict Bootstrap Contract And Compact App Index

- Status: pending

### Phase 3: App/Model Lazy Load Boundary

- Status: pending

### Phase 4: Projection-Driven Rendering

- Status: pending

### Phase 5: Profile-Scoped Patch And Recovery Hardening

- Status: pending

### Phase 6: Local OrbStack Deployment And Browser Measurement

- Status: pending

## Docs Updated

- `docs/plans/2026-06-23-snapshot-granularity-design.md`: added reviewed design.
- `docs/iterations/0423-snapshot-granularity-impl/plan.md`: added iteration contract.
- `docs/iterations/0423-snapshot-granularity-impl/resolution.md`: added execution plan.
- `docs/ITERATIONS.md`: registered iteration.

## Living Docs Review

- `docs/ssot/runtime_semantics_modeltable_driven.md`: review required before completion if snapshot profile semantics change.
- `docs/user-guide/modeltable_user_guide.md`: review required before completion if developer-facing UI model behavior changes.
- `docs/ssot/execution_governance_ultrawork_doit.md`: no change expected.
