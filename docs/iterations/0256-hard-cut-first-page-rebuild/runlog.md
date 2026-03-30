---
title: "0256 — hard-cut-first-page-rebuild Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-03-29
source: ai
iteration_id: 0256-hard-cut-first-page-rebuild
id: 0256-hard-cut-first-page-rebuild
phase: phase3
---

# 0256 — hard-cut-first-page-rebuild Runlog

## Environment

- Date: `2026-03-27`
- Branch: `dev_0256-hard-cut-first-page-rebuild`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`

## Execution Records

### Step 1 — Choose writable pilot page

- Selected page:
  - `Model 1001` (`请假申请`)
- Reason:
  - positive schema form
  - browser input path exists
  - truth labels are observable in `/snapshot`
- Result: PASS

### Step 2 — Rebuild on new contracts

- Preconditions:
  - `0254` compiler already active for `1003`
  - `0255` owner intent transport completed
- Additional change:
  - positive schema `Input` defaults now use `commit_policy: on_blur`
- Result: PASS

### Step 3 — Browser writable proof

- Browser path:
  - `http://127.0.0.1:30900/#/workspace`
  - open `请假申请`
  - edit field `姓名`
  - blur commit
- Live result:
  - `1001.applicant = hard-cut-0256-proof`
- Browser evidence:
  - `output/playwright/0256-hard-cut-first-page-rebuild/1001-writable-page-proof.png`
- Result: PASS

## Final Adjudication

- Decision: Completed
- Verdict:
  - first writable page proof passed on live local cluster
