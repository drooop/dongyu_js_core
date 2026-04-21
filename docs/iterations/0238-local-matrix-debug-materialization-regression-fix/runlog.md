---
title: "0238 — local-matrix-debug-materialization-regression-fix Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0238-local-matrix-debug-materialization-regression-fix
id: 0238-local-matrix-debug-materialization-regression-fix
phase: phase3
---

# 0238 — local-matrix-debug-materialization-regression-fix Runlog

## Environment

- Date: 2026-03-26
- Branch: `dropx/dev_0238-local-matrix-debug-materialization-regression-fix`
- Runtime: local Matrix Debug materialization fix

## Execution Records

### Step 1 — Freeze Regression And Localize The Break

- Started: `2026-03-26 06:11:57 +0800`
- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && python3 - <<'PY' ... PY`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && tmpdir="$(mktemp -d)" && LOCAL_PERSISTED_ASSET_ROOT="$tmpdir" bash scripts/ops/sync_local_persisted_assets.sh >/dev/null && python3 - "$tmpdir" <<'PY' ... PY`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0 == null'`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '20,140p' docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && sed -n '1,120p' docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md`
- Key output:
  - `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`:
    - `[PASS] test_model_id_registry_registers_trace_model`
    - `[PASS] test_matrix_debug_surface_is_model_defined_and_mounted`
    - `[PASS] test_matrix_debug_actions_use_dispatch_contract`
    - `[PASS] test_matrix_debug_contract_depends_on_existing_guards`
    - `4 passed, 0 failed out of 4`
  - `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`:
    - `validate_matrix_debug_server_sse: PASS`
  - regression signature probe:
    - `PASS current_regression_signature_confirmed`
    - 含义：当前 `scripts/ops/sync_local_persisted_assets.sh` 仍缺少 `matrix_debug_surface.json` / `intent_handlers_matrix_debug.json`，且 `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs` 仍缺少 `test_repo_sync_externalizes_matrix_debug_surface_and_handlers_for_ui_server`
  - temp persisted-root reproduction:
    - `PASS current_temp_root_reproduces_matrix_debug_omission`
    - 含义：临时 asset root 下 `system/ui/matrix_debug_surface.json` 与 `system/ui/intent_handlers_matrix_debug.json` 均未落盘，`manifest.v0.json` 也无对应 entry
  - live snapshot fact freeze:
    - `jq -e '.snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0 == null'` => `true`
  - prior evidence reviewed:
    - `0233` runlog 已记录同类 authoritative sync omission 曾导致 live `matrix_debug_page_asset=missing`
    - `0237` Step 1 已记录当前分支的 repo-green/live-red 事实，且 live `Model -100` 仅剩 `0,0,0`
- Adjudication:
  - 当前三组事实再次成立：
    - `0213` contract green
    - `validate_matrix_debug_server_sse` green
    - live local `/snapshot` red，`Model -100 / 0,1,0 / page_asset_v0 == null`
  - current break 已在 temp persisted asset root 直接复现，断点仍位于 authoritative sync/manifest omission，而非 runtime/ui-server/renderer
  - 因此 Step 2 可以保持在最小写入面：
    - `scripts/ops/sync_local_persisted_assets.sh`
    - `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
- Conformance review:
  - tier placement：本步只做只读核查，没有跨 Tier 改动
  - model placement：继续以 `Model -100 / 0,1,0 / page_asset_v0 = matrix_debug_root` 为 authoritative contract
  - data ownership：truth source 仍是 persisted authoritative assets，不是 browser fallback
  - data flow / data chain：缺口位于 repo asset -> persisted sync -> manifest -> loader 的 authoritative chain
- Result: PASS
- Commit: `977ff1f` (`chore(iteration): record 0238 step1 evidence`)

### Step 2 — Restore Authoritative Sync And Guard

- Started: `2026-03-26 06:14:26 +0800`
- Files changed:
  - `scripts/ops/sync_local_persisted_assets.sh`
  - `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
- Command:
  - red test before fix:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
  - post-fix verification:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash -n scripts/ops/sync_local_persisted_assets.sh`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && tmpdir="$(mktemp -d)" && LOCAL_PERSISTED_ASSET_ROOT="$tmpdir" bash scripts/ops/sync_local_persisted_assets.sh >/dev/null && python3 - "$tmpdir" <<'PY' ... PY`
- Key output:
  - red test before fix:
    - `[PASS] test_manifest_loader_orders_and_filters_by_scope_phase_and_filter`
    - `[FAIL] test_repo_sync_externalizes_matrix_debug_surface_and_handlers_for_ui_server: matrix_debug_surface must be externalized into persisted assets for ui-server`
    - `1 passed, 1 failed out of 2`
  - minimal fix:
    - `scripts/ops/sync_local_persisted_assets.sh` 的 `system_negative_full` 恢复：
      - `intent_handlers_matrix_debug.json`
      - `matrix_debug_surface.json`
    - `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs` 新增 end-to-end guard：
      - 临时 asset root 运行真实 `sync_local_persisted_assets.sh`
      - 断言 `ui-server` manifest entry 包含两个 Matrix Debug 文件
      - 断言 persisted loader materialize：
        - `Model -100 / 0,1,0 / page_asset_v0.v.id == "matrix_debug_root"`
        - `Model -10 / 0,0,0 / handle_matrix_debug_refresh.code` 为字符串
  - post-fix verification:
    - `bash -n scripts/ops/sync_local_persisted_assets.sh` PASS
    - `node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`:
      - `[PASS] test_manifest_loader_orders_and_filters_by_scope_phase_and_filter`
      - `[PASS] test_repo_sync_externalizes_matrix_debug_surface_and_handlers_for_ui_server`
      - `2 passed, 0 failed out of 2`
    - `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`:
      - `4 passed, 0 failed out of 4`
    - temp persisted-root assertion:
      - `PASS restored_matrix_debug_sync_and_manifest`
- Adjudication:
  - Step 2 维持在 resolution 允许的最小写入面，没有扩到 loader/ui-server/runtime
  - authoritative sync 与 repo-side guard 已恢复为同一条链路上的双重约束：
    - sync 脚本负责 externalize
    - loader contract 负责证明 manifest + materialization
  - `0213` formal contract 继续为绿，说明本步没有改 formal surface
- Conformance review:
  - tier placement：只修复 persisted-asset externalization 与 contract guard，未改变 Tier 1 解释器
  - model placement：继续保持 `Model -100` surface 与 `Model -10` handlers 的既有放置
  - data ownership：truth source 仍是 authoritative system-model assets；sync 仅做外化
  - data flow / data chain：仍经 repo asset -> persisted sync -> manifest -> loader -> runtime applyPatch，无 UI fallback
- Result: PASS
- Commit: `44d4565` (`fix(ops): restore matrix debug persisted assets`)

### Step 3 — Re-materialize Through Canonical Local Repair

- Started: `2026-03-26 06:14:26 +0800`
- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/ensure_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0.v.id == "matrix_debug_root"'`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '(.snapshot.models["-100"].cells["0,0,0"].labels.trace_status != null) and (.snapshot.models["-100"].cells["0,0,0"].labels.app_name.v == "Matrix Debug")'`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -c '{page_asset: .snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0.v.id, trace_status: .snapshot.models["-100"].cells["0,0,0"].labels.trace_status.v, app_name: .snapshot.models["-100"].cells["0,0,0"].labels.app_name.v}'`
- Key output:
  - `bash scripts/ops/ensure_runtime_baseline.sh`:
    - `[baseline] no reachable kubernetes context found from candidates: docker-desktop orbstack`
  - `bash scripts/ops/check_runtime_baseline.sh`:
    - `[check] kubernetes context: orbstack`
    - `[check] FAIL deploy/mosquitto readyReplicas= (expect 1)`
    - `[check] FAIL deploy/synapse readyReplicas= (expect 1)`
    - `[check] FAIL deploy/remote-worker readyReplicas= (expect 1)`
    - `[check] FAIL deploy/mbr-worker readyReplicas= (expect 1)`
    - `[check] FAIL deploy/ui-server readyReplicas= (expect 1)`
    - `[check] FAIL deploy/ui-side-worker readyReplicas= (expect 1)`
    - `[check] FAIL mbr-worker-secret.MODELTABLE_PATCH_JSON missing`
    - `[check] FAIL ui-server-secret.MODELTABLE_PATCH_JSON missing`
    - `[check] baseline NOT ready`
  - live snapshot assertions:
    - `page_asset_v0.v.id == "matrix_debug_root"` => `false`
    - `trace_status != null && app_name == "Matrix Debug"` => `true`
    - summary => `{"page_asset":null,"trace_status":"monitoring","app_name":"Matrix Debug"}`
  - diagnostic follow-up:
    - `kubectl cluster-info --context orbstack` 返回 `Unable to connect to the server: dial tcp 127.0.0.1:26443: connect: operation not permitted`
- Adjudication:
  - 当前状态为 `repo-fixed / live-red / gate-red`
  - Step 2 的 repo-side 修复已经完成，但 Step 3 所需的 canonical local repair 未能在当前执行环境落地
  - live `/snapshot` 仍缺失 `Model -100 / 0,1,0 / page_asset_v0`
  - `trace_status` 与 `app_name` 仍存在，说明 trace host glue 尚在，缺口仍是 formal page asset 未重新 materialize
  - 基于当前沙箱事实，Step 3 只能裁定为 `blocked/unverified`，不得继续声称 local live 已修复
- Conformance review:
  - tier placement：未通过任何 fallback 绕过 canonical repair
  - model placement：live 仍未恢复 `Model -100 / 0,1,0 / page_asset_v0`
  - data ownership：未对运行中模型或 live asset root 做手工改写
  - data flow / data chain：阻塞发生在 canonical local deploy/readiness 路径，而非 repo contract 链
- Result: BLOCKED / UNVERIFIED

### Manual Continuation — Outer-Shell Live Verification

- Context:
  - inner execution correctly finished the repo-side repair, but Step 3 was falsely blocked by inner-shell local cluster access limits
  - outer shell continuation was used to validate whether the repo-side fix actually re-materialized into the live local environment
- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/deploy_local.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && python3 - <<'PY'\nimport json, urllib.request\nobj=json.load(urllib.request.urlopen('http://127.0.0.1:30900/snapshot', timeout=10))\nmodels=obj['snapshot']['models']\nprint(models['-100']['cells'].get('0,1,0',{}).get('labels',{}).get('page_asset_v0',{}).get('v',{}).get('id'))\nprint(models['-100']['cells']['0,0,0']['labels'].get('trace_status',{}).get('v'))\nprint(models['-100']['cells']['0,0,0']['labels'].get('app_name',{}).get('v'))\nPY`
  - pod-side reproduction:
    - `kubectl -n dongyu exec <ui-server-pod> -- sh -lc 'bun -e "... createServerState({ dbPath: \"/app/.dy_persist/modeltable.db\" }) ..."'`
  - fresh Workspace browser spot-check:
    - open `/#/workspace`
    - click `Matrix Debug`
- Key output:
  - `deploy_local.sh` completed successfully
  - `check_runtime_baseline.sh` returned PASS
  - live `/snapshot` now returns:
    - `page_asset = matrix_debug_root`
    - `trace_status = monitoring`
    - `app_name = Matrix Debug`
  - pod-side `createServerState({ dbPath: "/app/.dy_persist/modeltable.db" })` also returns:
    - `page_asset_after_running = matrix_debug_root`
    - `cells_after_running = ["0,0,0","0,1,0"]`
  - fresh Workspace browser spot-check:
    - Matrix Debug no longer shows `Model -100 has no UI schema or AST.`
    - Matrix Debug renders:
      - `Matrix Debug Surface`
      - `Trace Buffer`
      - `Refresh / Clear Trace / Summarize`
- Adjudication:
  - `0238` repo-side repair was correct
  - after canonical local deploy, live local materialization also recovered
  - the remaining blocker is no longer Matrix Debug materialization
- Result: PASS
- Final verdict: `Matrix Debug surface aligned`

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] `docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md` reviewed

```
Review Gate Record
- Iteration ID: 0238-local-matrix-debug-materialization-regression-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 2
- Decision: On Hold
- Revision Type: N/A
- Notes: parse_failure: Could not parse verdict from review output

Review history:

```

```
Review Gate Record
- Iteration ID: 0238-local-matrix-debug-materialization-regression-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 3
- Decision: APPROVED
- Revision Type: N/A
- Notes: Manual review-plan acceptance after REVIEW_PLAN parse false negative. 0238 plan/resolution are self-contained, restore current Matrix Debug materialization regression to the authoritative persisted-asset sync/guard layer, and keep Home selector and remote lines out of scope.
```

```
Review Gate Record
- Iteration ID: 0238-local-matrix-debug-materialization-regression-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: EXECUTION
- Review Index: 3
- Decision: On Hold
- Revision Type: N/A
- Notes: Execution output parse failed: ops_tasks[0].required_artifacts must be non-empty

Review history:
  - Round 3 (REVIEW_PLAN): APPROVED [n/a]
```

```
Review Gate Record
- Iteration ID: 0238-local-matrix-debug-materialization-regression-fix
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: Manual REVIEW_EXEC acceptance after outer-shell live verification. Repo-side Matrix Debug persisted-asset sync/guard fix remained green, canonical local deploy completed, live snapshot recovered `matrix_debug_root`, and fresh browser spot-check confirmed Matrix Debug Surface renders again.
```
