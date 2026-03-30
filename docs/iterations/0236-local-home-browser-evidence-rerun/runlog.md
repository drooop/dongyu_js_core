---
title: "0236 — local-home-browser-evidence-rerun Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-03-26
source: ai
iteration_id: 0236-local-home-browser-evidence-rerun
id: 0236-local-home-browser-evidence-rerun
phase: phase3
---

# 0236 — local-home-browser-evidence-rerun Runlog

## Environment

- Date: 2026-03-26
- Branch: `dropx/dev_0236-local-home-browser-evidence-rerun`
- Runtime: local browser evidence rerun after Home fix

## Execution Records

### Step 1 — Freeze Preconditions

- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "Completed|Home surface aligned|blocked" docs/iterations/0235-local-home-surface-materialization-fix/runlog.md`
- Key output:
  - local baseline gate = PASS
  - `0235` 已 completed，final verdict = `Home surface aligned`
- Result: PASS

### Step 2 — Execute Fresh Local Browser Task

- Browser task:
  - batch: `b2bd50a8-42f2-44d4-a286-fb7ac5a11373`
  - task id: `local-home-rerun`
- Artifacts:
  - [home.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/local-home-rerun/home.png)
  - [workspace.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/local-home-rerun/workspace.png)
  - [matrix-debug.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/local-home-rerun/matrix-debug.png)
  - [prompt.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/local-home-rerun/prompt.png)
  - [report.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/local-home-rerun/report.json)
- Canonical exchange:
  - [request.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/.orchestrator/runs/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/browser_tasks/local-home-rerun/request.json)
  - [result.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/.orchestrator/runs/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/browser_tasks/local-home-rerun/result.json)
- Key output:
  - Home:
    - `surface: root_home`
    - no legacy `home-datatable` / `DataTable` marker
  - Workspace:
    - registry entries remain current
  - Matrix Debug:
    - browser now renders `Model -100 has no UI schema or AST.`
  - Prompt:
    - reachable
- Result: PASS

### Step 3 — Adjudicate Effective Or Not Effective

- Fresh evidence summary:
  - Home repaired: PASS
  - Workspace registry current: PASS
  - Prompt reachable: PASS
  - Matrix Debug surface visible as `matrix_debug_root`: FAIL
    - browser-side current observation is `Model -100 has no UI schema or AST.`
- Final verdict: `Local environment not effective`
- Why:
  - `0235` fixed the Home surface drift and superseded the old `home-datatable` finding
  - but the new rerun exposed a different blocker on Matrix Debug
  - therefore local environment is still not globally effective
- Downstream impact:
  - remote line remains paused by user decision
  - next local work should focus on Matrix Debug browser/schema regression, not Home

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] `docs/iterations/0235-local-home-surface-materialization-fix/runlog.md` reviewed

```
Review Gate Record
- Iteration ID: 0236-local-home-browser-evidence-rerun
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: Manual planning completion and review-plan acceptance after planning stall. 0236 plan/resolution are self-contained and now use a concrete browser-task contract for local-home-rerun with canonical artifact names and deterministic report assertions.
```

### Browser Task Result

- Task ID: local-home-rerun
- Attempt: 1
- Status: pass
- Failure Kind: none
- Request File: .orchestrator/runs/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/browser_tasks/local-home-rerun/request.json
- Result File: .orchestrator/runs/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/browser_tasks/local-home-rerun/result.json
- Artifact: output/playwright/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/local-home-rerun/home.png
- Artifact: output/playwright/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/local-home-rerun/workspace.png
- Artifact: output/playwright/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/local-home-rerun/matrix-debug.png
- Artifact: output/playwright/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/local-home-rerun/prompt.png
- Artifact: output/playwright/b2bd50a8-42f2-44d4-a286-fb7ac5a11373/local-home-rerun/report.json
- Ingested At: 2026-03-25T20:12:29.061Z
- Result: PASS

```
Review Gate Record
- Iteration ID: 0236-local-home-browser-evidence-rerun
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: Manual browser rerun after 0235 Home fix. Fresh MCP evidence shows Home is repaired (`root_home`, no legacy datatable marker), Workspace registry remains current, Prompt is reachable, but Matrix Debug now renders "Model -100 has no UI schema or AST.", so the local environment remains not effective.
```

```
Review Gate Record
- Iteration ID: 0236-local-home-browser-evidence-rerun
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: Manual browser rerun after 0235 Home fix. Fresh MCP evidence shows Home is repaired (`root_home`, no legacy datatable marker), Workspace registry remains current, Prompt is reachable, but Matrix Debug now renders "Model -100 has no UI schema or AST.", so the local environment remains not effective.
```
