---
title: "Iteration 0265-local-deploy-and-debug-policy Run Log"
doc_type: iteration-runlog
status: active
updated: 2026-03-30
source: ai
iteration_id: 0265-local-deploy-and-debug-policy
id: 0265-local-deploy-and-debug-policy
phase: phase3
---

# Iteration 0265-local-deploy-and-debug-policy Run Log

## Environment
- OS: macOS
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Branch: `dev_0265-local-deploy-and-debug-policy`

### Review Gate Records (FACTS)
```text
Review Gate Record
- Iteration ID: 0265-local-deploy-and-debug-policy
- Review Date: 2026-03-30
- Review Type: User
- Reviewer: user
- Review Index: 1
- Decision: Approved
- Notes: user reported local UI still did not show structural labels and requested that missing redeploy, if confirmed, must be promoted into repo rules.
```

## Step 1 — Redeploy local stack
- Start time: 2026-03-30 15:12:00 +0800
- End time: 2026-03-30 15:25:00 +0800
- Branch: `dev_0265-local-deploy-and-debug-policy`
- Commits:
  - N/A
- Commands executed:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `curl -fsS http://localhost:30900/snapshot | jq ...`
  - `apply_patch scripts/ops/sync_local_persisted_assets.sh`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
- Key outputs (snippets):
  - pre-fix runtime fact:
    - only `Model 0 / 10,0,0 / 100 / submt` visible in local `/snapshot`
    - missing `1,0,*` and `2,0,*` `model.submt` rows
  - root cause:
    - `runtime_hierarchy_mounts.json` was loaded in repo path, but `sync_local_persisted_assets.sh` did not copy/register it into persisted assets
  - fix:
    - added `runtime_hierarchy_mounts.json` to `system_positive_full`
  - post-deploy baseline:
    - `baseline ready`
    - `ui-server`, `remote-worker`, `mbr-worker`, `ui-side-worker` all rolled out successfully
- Result: PASS

## Step 2 — Verify debug CRUD live
- Start time: 2026-03-30 15:25:00 +0800
- End time: 2026-03-30 15:27:00 +0800
- Branch: `dev_0265-local-deploy-and-debug-policy`
- Commits:
  - N/A
- Commands executed:
  - `curl -fsS http://localhost:30900/snapshot | jq ...`
  - Playwright MCP open `http://localhost:30900`
- Key outputs (snippets):
  - `/snapshot` now shows `Model 0` `model.submt` hosting cells:
    - `1,0,0 -> -1`
    - `1,0,1 -> -2`
    - `...`
    - `2,0,0 -> 1`
    - `2,0,1 -> 2`
    - `10,0,0 -> 100`
  - Home debug table in browser now shows:
    - `model_type / model.submt / -26`
    - `model_type / model.submt / -100`
    - `model_type / model.submt / -101`
    - `model_type / model.submt / 1`
    - `model100_submit_bridge / pin.connect.label`
    - `submit_relay / pin.in`
    - `matrix_token / matrix.token`
    - `matrix_passwd / matrix.passwd`
- Result: PASS

## Step 3 — Persist policy
- Start time: 2026-03-30 15:27:00 +0800
- End time: 2026-03-30 15:28:00 +0800
- Branch: `dev_0265-local-deploy-and-debug-policy`
- Commits:
  - N/A
- Commands executed:
  - `apply_patch CLAUDE.md`
  - `rg -n "redeploy or restart the affected local stack first" CLAUDE.md`
- Key outputs (snippets):
  - `CLAUDE.md:37`
  - `if acceptance depends on local running ui/runtime/debug surfaces, you MUST redeploy or restart the affected local stack first...`
- Result: PASS
