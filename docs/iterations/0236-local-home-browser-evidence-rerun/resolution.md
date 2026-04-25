---
title: "0236 — local-home-browser-evidence-rerun Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0236-local-home-browser-evidence-rerun
id: 0236-local-home-browser-evidence-rerun
phase: phase1
---

# 0236 — local-home-browser-evidence-rerun Resolution

## Execution Strategy

- 先确认 `0235` 已完成且 local gate 为绿
- 再执行一次 fresh Playwright MCP rerun，生成新的 canonical browser evidence pack
- 最后按 fresh evidence 给出新的 local environment verdict

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Freeze Preconditions | 固定 `0235` 完成后 local rerun 的输入前提 | `0235` runlog + local gate | gate + prior evidence checks | 只回退文档 |
| 2 | Execute Fresh Local Browser Task | 产出新的 canonical screenshot/report pack | `.orchestrator/runs/<batch>/browser_tasks/...`, `output/playwright/...` | request/result/artifact checks | 删除本次 evidence 后重跑 |
| 3 | Adjudicate Effective Or Not Effective | 用 fresh pack 给出新的 local verdict | report + runlog | deterministic assertions | 仅回退 runlog verdict |

## Step 1 — Freeze Preconditions

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "Completed|Home surface aligned|blocked" docs/iterations/0235-local-home-surface-materialization-fix/runlog.md
```

## Step 2 — Execute Fresh Local Browser Task

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && test -f .orchestrator/runs/<batch_id>/browser_tasks/local-home-rerun/request.json && test -f .orchestrator/runs/<batch_id>/browser_tasks/local-home-rerun/result.json
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && test -f output/playwright/<batch_id>/local-home-rerun/home.png && test -f output/playwright/<batch_id>/local-home-rerun/workspace.png && test -f output/playwright/<batch_id>/local-home-rerun/matrix-debug.png && test -f output/playwright/<batch_id>/local-home-rerun/prompt.png && test -f output/playwright/<batch_id>/local-home-rerun/report.json
```

## Step 3 — Adjudicate Effective Or Not Effective

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && jq -e '.home.surface_marker == "root_home" and .home.legacy_home_datatable_detected == false and .matrix_debug.surface_marker == "matrix_debug_root" and .matrix_debug.visible == true and .prompt.reachable == true and (.verdict_candidate == "effective" or .verdict_candidate == "not_effective")' output/playwright/<batch_id>/local-home-rerun/report.json
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "Local environment effective|Local environment not effective" docs/iterations/0236-local-home-browser-evidence-rerun/runlog.md
```

## Canonical Browser Task Contract

- task id:
  - `local-home-rerun`
- required artifacts:
  - `home.png`
  - `workspace.png`
  - `matrix-debug.png`
  - `prompt.png`
  - `report.json`
- `report.json` minimum fields:
  - `home.surface_marker`
  - `home.legacy_home_datatable_detected`
  - `workspace.observed_registry_model_ids`
  - `workspace.legacy_registry_detected`
  - `matrix_debug.surface_marker`
  - `matrix_debug.visible`
  - `prompt.reachable`
  - `verdict_candidate`
  - `console_errors`
