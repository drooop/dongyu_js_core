---
title: "0359 Matrix Submit Example E2E Runlog"
doc_type: iteration_runlog
status: completed
updated: 2026-05-07
source: ai
iteration: 0359-matrix-submit-example-e2e
---

# Iteration 0359-matrix-submit-example-e2e Runlog

## Environment

- Date: 2026-05-07
- Branch: `dev_0359-matrix-submit-example-e2e`
- Runtime: local Kubernetes namespace `dongyu`, URL `http://127.0.0.1:30900/#/workspace`
- Review Gate Record
- Iteration ID: 0359-matrix-submit-example-e2e
- Review Date: 2026-05-06
- Review Type: User-directed execution
- Review Index: 1
- Decision: Approved
- Notes: User requested implementation and browser verification for local name cleanup, color generator redeploy behavior, and real Matrix submit example.

## Execution Records

### Step 1

- Command: Playwright opened `http://127.0.0.1:30900/#/workspace`, filled `E2E 颜色生成器`, and clicked `Generate Color`.
- Key output: before redeploy visible color changed from `#6b4053` to `#67eb43`; after redeploy visible color changed from `#67eb43` to `#90c938`; status stayed `processed`.
- Result: PASS. Local deployment is active and the color generator route still performs a real roundtrip.
- Commit: pending

### Step 2

- Command: Runtime snapshot and Playwright workspace list inspection.
- Key output: no visible app name contains `Codex`; runtime app list contains `Slide Verify 0506` instead of `Codex Slide Verify 0506`.
- Result: PASS. Visible local app name cleanup is complete.
- Commit: pending

### Step 3

- Command: `node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`
- Key output: `PASS test_0359_minimal_submit_matrix_e2e_contract passed=5`
- Result: PASS. The new example is seeded, mounted into Workspace, uses `bus_event_v2`, routes through Model 0, has MBR/remote-worker contracts, and handles result materialization.
- Commit: pending

### Step 4

- Command: `SKIP_IMAGE_BUILD=1 SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Key output: `=== Local deploy complete ===`, `UI Server: http://localhost:30900`, room `!OiabgfYplPPGTrgjOp:localhost`.
- Result: PASS. Persisted assets and public docs were synced, and ui-server/mbr-worker/remote-worker/ui-side-worker rolled out.
- Commit: pending

### Step 5

- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: all local deployments ready; `mbr-worker-secret.MODELTABLE_PATCH_JSON ready`; `ui-server-secret.MODELTABLE_PATCH_JSON ready`; `baseline ready`.
- Result: PASS.
- Commit: pending

### Step 6

- Command: Playwright opened `最小 Submit 双总线示例`, filled `matrix submit 0507 real roundtrip`, and clicked `Submit`.
- Key output: browser displayed `Submitted: matrix submit 0507 real roundtrip`; status displayed `remote_processed`.
- Result: PASS. The UI example completed the real Matrix dual-bus roundtrip.
- Commit: pending

### Step 7

- Command: `kubectl -n dongyu logs deploy/mbr-worker --since=8m --tail=500 | rg '1050|UIPUT/ws/dam/pic/de/sw/1050'`
- Key output: MBR received `minimal_submit_matrix_1778115519973`, published `UIPUT/ws/dam/pic/de/sw/1050/submit`, then received `UIPUT/ws/dam/pic/de/sw/1050/result`.
- Result: PASS.
- Commit: pending

### Step 8

- Command: `kubectl -n dongyu logs deploy/remote-worker --since=8m --tail=500 | rg '1050|UIPUT/ws/dam/pic/de/sw/1050'`
- Key output: remote-worker received `UIPUT/ws/dam/pic/de/sw/1050/submit`, then published `UIPUT/ws/dam/pic/de/sw/1050/result` with `display_text=Submitted: matrix submit 0507 real roundtrip`.
- Result: PASS.
- Commit: pending

### Step 9

- Command: `node scripts/tests/test_0263_model_mounting_profiles.mjs`
- Key output: FAIL before completing all profiles; current analyzer reports pre-existing `ui-server` unmounted models `-27` and `1015`, duplicate child mounts, plus remote-worker historical unmounted `1010` and `1019`. New model `1050` is mounted in Workspace and covered by 0359 contract.
- Result: NON-BLOCKING. This is a broader historical mount-audit debt outside the 0359 acceptance scope; the 0359-specific browser failure was fixed by adding Model 0 `(2,0,20) -> 1050`.
- Commit: pending

## Docs Updated

- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/slide-app-runtime/` updated
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed
- [ ] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
