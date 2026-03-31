---
title: "Iteration 0269-model100-live-submit-regression Run Log"
doc_type: iteration-runlog
status: active
updated: 2026-03-31
source: ai
iteration_id: 0269-model100-live-submit-regression
id: 0269-model100-live-submit-regression
phase: phase3
---

# Iteration 0269-model100-live-submit-regression Run Log

## Environment
- OS: macOS
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Branch: `dev_0269-model100-live-submit-regression`

### Review Gate Records (FACTS)
```text
Review Gate Record
- Iteration ID: 0269-model100-live-submit-regression
- Review Date: 2026-03-31
- Review Type: User
- Reviewer: user
- Review Index: 1
- Decision: Approved
- Notes: user approved fixing the existing color-generator baseline first before starting the new UI-model example case.
```

## Step 1 — Reproduce and lock regression
- Start time: 2026-03-31 17:25:00 +0800
- End time: 2026-03-31 17:33:00 +0800
- Branch: `dev_0269-model100-live-submit-regression`
- Commits:
  - N/A
- Commands executed:
  - Playwright open `http://localhost:30900/#/workspace`
  - Playwright click `Generate Color`
  - `curl -fsS http://localhost:30900/snapshot | jq ...`
  - `kubectl -n dongyu logs deploy/ui-server --since=5m | tail -n 200`
  - `kubectl -n dongyu logs deploy/mbr-worker --since=5m | tail -n 200`
  - `kubectl -n dongyu logs deploy/remote-worker --since=5m | tail -n 200`
- Key outputs (snippets):
  - live page click produced no visible color change
  - `ui-server` emitted:
    - `Model 100 ui_event detected, triggering prepare_model100_submit`
    - `WARNING: prepare_model100_submit function NOT found`
  - `remote-worker` showed no new inbound business trace for that click
  - `MBR` only continued heartbeat / ready flow
- Result: PASS

## Step 2 — Repair function registration chain
- Start time: 2026-03-31 17:33:00 +0800
- End time: 2026-03-31 17:41:00 +0800
- Branch: `dev_0269-model100-live-submit-regression`
- Commits:
  - N/A
- Commands executed:
  - `apply_patch scripts/tests/test_0269_model100_live_submit_registration_contract.mjs`
  - `node scripts/tests/test_0269_model100_live_submit_registration_contract.mjs`
  - `apply_patch packages/ui-model-demo-server/server.mjs`
  - `node scripts/tests/test_0269_model100_live_submit_registration_contract.mjs`
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
- Key outputs (snippets):
  - root cause:
    - `firstSystemModel()` could return a non-`-10` negative model, causing server-side gate checks to miss `prepare_model100_submit`
  - fix:
    - `firstSystemModel()` now prefers canonical `Model -10`
  - GREEN:
    - `test_0269_model100_live_submit_registration_contract` PASS
    - `test_0182_model100_submit_chain_contract` PASS
- Result: PASS

## Step 3 — Redeploy and live verify
- Start time: 2026-03-31 17:41:00 +0800
- End time: 2026-03-31 17:56:00 +0800
- Branch: `dev_0269-model100-live-submit-regression`
- Commits:
  - N/A
- Commands executed:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - Playwright open `http://localhost:30900/#/workspace`
  - Playwright click `Generate Color`
  - `curl -fsS http://localhost:30900/snapshot | jq ...`
  - `kubectl -n dongyu logs deploy/ui-server --since=2m | egrep ...`
  - `kubectl -n dongyu logs deploy/mbr-worker --since=2m | egrep ...`
  - `kubectl -n dongyu logs deploy/remote-worker --since=2m | egrep ...`
- Key outputs (snippets):
  - baseline:
    - `baseline ready`
  - live browser:
    - color changed after click (example final visible color `#5a507d`)
  - `ui-server`:
    - `executeFunction CALLED with name: prepare_model100_submit`
    - `forward_model100_submit_from_model0 Matrix send OK`
    - `snapshot_delta routed via owner materialization`
  - `MBR`:
    - `mqtt publish topic=.../100/event`
    - `recv mqtt topic=.../100/patch_out`
  - `remote-worker`:
    - inbound `100/event`
    - publish `100/patch_out`
    - heartbeat now reports `bg_color=#a9cdf7, status=processed`
- Result: PASS
