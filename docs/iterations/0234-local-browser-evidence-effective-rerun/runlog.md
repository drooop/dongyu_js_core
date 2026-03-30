---
title: "0234 — local-browser-evidence-effective-rerun Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-03-26
source: ai
iteration_id: 0234-local-browser-evidence-effective-rerun
id: 0234-local-browser-evidence-effective-rerun
phase: phase3
---

# 0234 — local-browser-evidence-effective-rerun Runlog

## Environment

- Date: 2026-03-26
- Branch: `dropx/dev_0234-local-browser-evidence-effective-rerun`
- Runtime: local browser evidence rerun

## Execution Records

### Step 1 — Freeze Preconditions And Evidence Contract

- Started: `2026-03-26 00:04:09 +0800`
- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "Local environment not effective|home-datatable|old workspace registry|matrix_debug_page_asset=missing|blocked/unverified|code-side fix complete" docs/iterations/0223-local-cluster-browser-evidence/runlog.md docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md`
- Key output:
  - `node scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`:
    - `PASS test_0232_local_baseline_surface_gate_contract`
  - `node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`:
    - `[PASS] test_manifest_loader_orders_and_filters_by_scope_phase_and_filter`
    - `[PASS] test_repo_sync_externalizes_matrix_debug_surface_and_handlers_for_ui_server`
    - `2 passed, 0 failed out of 2`
  - `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`:
    - `validate_matrix_debug_server_sse: PASS`
    - server-side validator 日志显示 `handle_matrix_debug_refresh`、`handle_matrix_debug_summarize`、`handle_matrix_debug_clear_trace` 均被触发
  - historical runlog grep:
    - `docs/iterations/0223-local-cluster-browser-evidence/runlog.md` 继续固定：
      - `Final verdict: Local environment not effective`
      - `home-datatable`
    - `docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md` 继续固定：
      - `matrix_debug_page_asset=missing`
      - `blocked/unverified`
      - `code-side fix complete`
- Adjudication:
  - `0223` 的 `Local environment not effective` 明确属于修复前 live environment 事实，不能被复用为 0234 的最终结论。
  - `0233` 已完成 repo-side chain fix，并明确把 live effective materialization 留在 `blocked/unverified`，因此 0234 必须先通过 canonical baseline gate，才有资格进入 fresh browser rerun。
  - `0234` 的 canonical evidence contract 现冻结为：
    - batch: `0234-local-browser-evidence-effective-rerun`
    - task: `local-effective-rerun`
    - artifacts:
      - `home.png`
      - `workspace.png`
      - `matrix-debug.png`
      - `prompt.png`
      - `report.json`
- Conformance review:
  - tier placement：本步只做合同验证与历史证据冻结，未变更 Tier 1 / Tier 2 逻辑
  - model placement：只复核 `-22`、`-100`、`-103`、`-102`、`-2` 的既有裁决边界
  - data ownership：truth source 仍是 repo authoritative contracts + historical runlog + live gate，screenshots 尚未产生
  - data flow / data chain：本步只验证 `persisted asset -> loader -> server validation` 与 `historical runlog -> rerun precondition` 两条既有链路
- Result: PASS
- Commit: `0854917` (`chore: record 0234 step1 contract freeze`)

### Step 2 — Re-materialize Canonical Local Baseline

- Started: `2026-03-26 00:05:55 +0800`
- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/ensure_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-22"].cells["0,1,0"].labels.page_asset_v0.v.id == "root_home"'`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0.v.id == "matrix_debug_root"'`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-103"].cells["0,1,0"].labels.page_asset_v0 != null and .snapshot.models["-102"].cells["0,11,0"].labels.gallery_showcase_tab.v == "matrix"'`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '(.snapshot.models["-2"].cells["0,0,0"].labels.ws_apps_registry.v // []) as $apps | ([100,-100,-103,1003,1004,1005,1007] | all(. as $id | ($apps | map(.model_id) | index($id)))) and (($apps | map(.model_id) | index(1006)) | not) and (($apps | map(.model_id) | index(1008)) | not)'`
- Key output:
  - `bash scripts/ops/ensure_runtime_baseline.sh`:
    - `[baseline] no reachable kubernetes context found from candidates: docker-desktop orbstack`
  - `bash scripts/ops/check_runtime_baseline.sh`:
    - `[check] kubernetes context: orbstack`
    - `FAIL deploy/mosquitto readyReplicas= (expect 1)`
    - `FAIL deploy/synapse readyReplicas= (expect 1)`
    - `FAIL deploy/remote-worker readyReplicas= (expect 1)`
    - `FAIL deploy/mbr-worker readyReplicas= (expect 1)`
    - `FAIL deploy/ui-server readyReplicas= (expect 1)`
    - `FAIL deploy/ui-side-worker readyReplicas= (expect 1)`
    - `FAIL mbr-worker-secret.MODELTABLE_PATCH_JSON missing`
    - `FAIL ui-server-secret.MODELTABLE_PATCH_JSON missing`
    - `FAIL live_snapshot_unreachable http://127.0.0.1:30900/snapshot`
    - `[check] baseline NOT ready`
  - direct live `/snapshot` assertions:
    - Home `root_home` -> `true`
    - Matrix Debug `matrix_debug_root` -> `true`
    - Gallery asset + matrix tab -> `true`
    - Workspace registry set -> `true`
- Adjudication:
  - canonical Step 2 gate 未通过：`ensure_runtime_baseline.sh` 与 `check_runtime_baseline.sh` 均返回非零。
  - 尽管 direct `curl` 到 `/snapshot` 的四个 surface assertions 全部为 `true`，但 resolution 明确要求只在 canonical baseline gate 绿色后才允许进入 fresh browser rerun；不能用局部 snapshot 事实绕过 `check_runtime_baseline.sh` 的失败。
  - 因此 0234 已命中 Stop Condition：
    - `bash scripts/ops/check_runtime_baseline.sh` 仍非绿色
    - 0234 不得进入 fresh browser rerun
    - 当前唯一合法中间状态是 `blocked/unverified`
- Conformance review:
  - tier placement：本步仅执行 canonical local ops + live snapshot 只读断言，未改 Tier 1 / Tier 2 代码
  - model placement：surface assertions 继续针对 `-22`、`-100`、`-103`、`-102`、`-2` 的既有 placement
  - data ownership：即使 live `/snapshot` 表面上符合预期，authoritative gate 仍以 canonical repair/check 结果为准
  - data flow / data chain：不能用 direct snapshot 旁路 `ensure -> check -> browser rerun` 的既定执行链
- Result: BLOCKED/UNVERIFIED
- Commit: `35bbb74` (`chore: record 0234 step2 baseline gate verdict`)

### Step 3 — Execute One Fresh Playwright MCP Browser Task

- Started: `2026-03-26 00:07:10 +0800`
- Command:
  - stop-condition guard inherited from Step 2:
    - `bash scripts/ops/check_runtime_baseline.sh` remained non-green, so canonical browser rerun was not entered
  - no-stale-evidence assertions:
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID=0234-local-browser-evidence-effective-rerun; test ! -e ".orchestrator/runs/$BATCH_ID/browser_tasks/local-effective-rerun/request.json" && test ! -e ".orchestrator/runs/$BATCH_ID/browser_tasks/local-effective-rerun/result.json" && echo 'PASS no canonical browser task request/result generated under stop condition'`
    - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID=0234-local-browser-evidence-effective-rerun; test ! -e "output/playwright/$BATCH_ID/local-effective-rerun/home.png" && test ! -e "output/playwright/$BATCH_ID/local-effective-rerun/workspace.png" && test ! -e "output/playwright/$BATCH_ID/local-effective-rerun/matrix-debug.png" && test ! -e "output/playwright/$BATCH_ID/local-effective-rerun/prompt.png" && test ! -e "output/playwright/$BATCH_ID/local-effective-rerun/report.json" && echo 'PASS no fresh browser artifacts generated under stop condition'`
- Key output:
  - `PASS no canonical browser task request/result generated under stop condition`
  - `PASS no fresh browser artifacts generated under stop condition`
- Adjudication:
  - resolution 的 Stop Condition 已在 Step 2 触发，因此本步不能生成 request/result/artifact，也不能运行真实 Playwright MCP browser task。
  - 为避免误把旧 evidence 或半成品 evidence 当作 fresh rerun，本步显式确认 canonical `.orchestrator` 与 `output/playwright` 路径下均未生成 `local-effective-rerun` 证据包。
  - 因为 executor 根本未被合法启动，所以本步只能记为 `blocked/unverified`，而不是 `pass`。
- Conformance review:
  - tier placement：本步未触碰浏览器桥接实现，也未触碰业务/UI/runtime 代码
  - model placement：无新增模型读取或写入；仅验证 Step 3 没有产出错误 evidence
  - data ownership：不复用旧 screenshot/request/result，继续保持 fresh evidence 必须来自合法 rerun 的约束
  - data flow / data chain：`check_runtime_baseline -> browser_task` 链在 gate 失败处停止，没有产生旁路 browser evidence
- Result: BLOCKED/UNVERIFIED
- Commit: `6a73d0e` (`chore: record 0234 step3 browser stop condition`)

### Step 4 — Adjudicate Effective Or Not Effective

- Started: `2026-03-26 00:07:45 +0800`
- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID=0234-local-browser-evidence-effective-rerun; test ! -f "output/playwright/$BATCH_ID/local-effective-rerun/report.json" && echo 'PASS report.json absent because Step 3 was not legally entered'`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "Local environment effective|Local environment not effective|blocked/unverified" docs/iterations/0234-local-browser-evidence-effective-rerun/runlog.md`
- Key output:
  - `bash scripts/ops/check_runtime_baseline.sh`:
    - `[check] kubernetes context: orbstack`
    - `FAIL deploy/mosquitto readyReplicas= (expect 1)`
    - `FAIL deploy/synapse readyReplicas= (expect 1)`
    - `FAIL deploy/remote-worker readyReplicas= (expect 1)`
    - `FAIL deploy/mbr-worker readyReplicas= (expect 1)`
    - `FAIL deploy/ui-server readyReplicas= (expect 1)`
    - `FAIL deploy/ui-side-worker readyReplicas= (expect 1)`
    - `FAIL mbr-worker-secret.MODELTABLE_PATCH_JSON missing`
    - `FAIL ui-server-secret.MODELTABLE_PATCH_JSON missing`
    - `FAIL live_snapshot_unreachable http://127.0.0.1:30900/snapshot`
    - `[check] baseline NOT ready`
  - report guard:
    - `PASS report.json absent because Step 3 was not legally entered`
- Final verdict: `blocked/unverified`
- Adjudication:
  - 由于 Step 2 canonical baseline gate 失败、Step 3 依法未进入 fresh Playwright MCP rerun，0234 不具备 `effective` 或新的 `not effective` browser evidence 裁决条件。
  - 因此本 iteration 唯一合法终态是：
    - `blocked/unverified`
  - 对 `0223` 的关系：
    - 0234 没有产出新的 fresh browser evidence，因此不能用 `effective` supersede `0223`
    - 0234 也不复写 `0223` 的旧 stale-surface 细节；它记录的是“本次 rerun 在当前 executor 环境下未能合法启动”
    - 可操作含义上，0234 reaffirm 了“当前 local environment 仍不能被放行为 effective”
  - downstream 影响：
    - 不允许把 local environment 宣布为 `effective`
    - 如需继续，必须新开 fix/investigation iteration，先解决 canonical baseline gate 与 executor environment 的阻塞，再重新执行新的 browser rerun iteration
- Conformance review:
  - tier placement：最终裁决完全基于 canonical gate 与 evidence absence 事实，未引入新逻辑
  - model placement：未改变任何 model placement；仍只消费既有 snapshot/gate 观察结果
  - data ownership：truth source 仍是 canonical baseline gate；缺失 `report.json` 即缺失 fresh browser truth
  - data flow / data chain：`ensure/check` 失败导致 `browser_task -> report.json` 链未形成，因此只能停在 `blocked/unverified`
- Result: BLOCKED/UNVERIFIED
- Commit: `2199819` (`chore: record 0234 step4 final blocked verdict`)

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] `docs/iterations/0223-local-cluster-browser-evidence/runlog.md` reviewed
- [x] `docs/iterations/0232-local-baseline-surface-gate/runlog.md` reviewed
- [x] `docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md` reviewed

```
Review Gate Record
- Iteration ID: 0234-local-browser-evidence-effective-rerun
- Review Date: 2026-03-26
- Review Type: User
- Phase: REVIEW_EXEC
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: User explicitly instructed execution on branch `dropx/dev_0234-local-browser-evidence-effective-rerun` and required step-by-step Phase 3 evidence with per-step commits.
```

```
Review Gate Record
- Iteration ID: 0234-local-browser-evidence-effective-rerun
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
- Iteration ID: 0234-local-browser-evidence-effective-rerun
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: Manual planning acceptance after parse false negative: rewritten 0234 plan.md and resolution.md are self-contained, verification-only, and correctly gated on 0232 local baseline and 0233 matrix debug materialization evidence.
```

```
Review Gate Record
- Iteration ID: 0234-local-browser-evidence-effective-rerun
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: EXECUTION
- Review Index: 0
- Decision: On Hold
- Revision Type: N/A
- Notes: Execution output cannot mix browser_tasks and ops_tasks in the same step

Review history:
  - Round 1 (REVIEW_PLAN): APPROVED [n/a]
```

### Browser Task Result

- Task ID: local-effective-rerun
- Attempt: 1
- Status: pass
- Failure Kind: none
- Request File: .orchestrator/runs/20ad18d0-3e52-4c48-9935-0464f8b4fbc2/browser_tasks/local-effective-rerun/request.json
- Result File: .orchestrator/runs/20ad18d0-3e52-4c48-9935-0464f8b4fbc2/browser_tasks/local-effective-rerun/result.json
- Artifact: output/playwright/20ad18d0-3e52-4c48-9935-0464f8b4fbc2/local-effective-rerun/home.png
- Artifact: output/playwright/20ad18d0-3e52-4c48-9935-0464f8b4fbc2/local-effective-rerun/workspace.png
- Artifact: output/playwright/20ad18d0-3e52-4c48-9935-0464f8b4fbc2/local-effective-rerun/matrix-debug.png
- Artifact: output/playwright/20ad18d0-3e52-4c48-9935-0464f8b4fbc2/local-effective-rerun/prompt.png
- Artifact: output/playwright/20ad18d0-3e52-4c48-9935-0464f8b4fbc2/local-effective-rerun/report.json
- Ingested At: 2026-03-25T17:45:50.688Z
- Result: PASS

```
Review Gate Record
- Iteration ID: 0234-local-browser-evidence-effective-rerun
- Review Date: 2026-03-25
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: Manual browser-only rerun after mixed ops/browser stop. Fresh MCP evidence captured canonical screenshots/report.json. Home still renders legacy home-datatable while workspace registry, Matrix Debug surface, and Prompt route are current; adjudicate Local environment not effective.
```

## Manual Recovery — Fresh Browser-Only Rerun

- Date: `2026-03-26`
- Recovery cause:
  - original execution stopped because the same step mixed `ops_tasks` and `browser_tasks`
  - after `0233`/`0232`, canonical local baseline gate was rechecked out-of-band and returned green
- Fresh MCP evidence captured:
  - [home.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/home.png)
  - [workspace.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/workspace.png)
  - [matrix-debug.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/matrix-debug.png)
  - [prompt.png](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/prompt.png)
  - [report.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/report.json)
- Canonical batch exchange:
  - request: [request.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/.orchestrator/runs/20ad18d0-3e52-4c48-9935-0464f8b4fbc2/browser_tasks/local-effective-rerun/request.json)
  - result: [result.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/.orchestrator/runs/20ad18d0-3e52-4c48-9935-0464f8b4fbc2/browser_tasks/local-effective-rerun/result.json)

### Fresh Evidence Summary

- `bash scripts/ops/check_runtime_baseline.sh`:
  - PASS
- live `/snapshot`:
  - `home_asset = root_home`
  - `matrix_asset = matrix_debug_root`
  - `gallery_asset_present = true`
  - `gallery_tab = matrix`
  - workspace registry contains `100/-100/-103/1003/1004/1005/1007`
- fresh browser MCP rerun:
  - Home still renders `target: home-datatable`
  - Workspace shows current registry entries including `Matrix Debug` and `0216 Three Scene`
  - Matrix Debug surface renders `Matrix Debug Surface`
  - Prompt route is reachable

## Final Adjudication

- Final verdict: `Local environment not effective`
- Why:
  - this fresh rerun supersedes the earlier `blocked/unverified` stop condition
  - canonical local gate is now green, so the rerun is legally entered and authoritative
  - however, browser-side Home still renders the legacy `home-datatable` surface while other surfaces are current
  - therefore the local environment cannot be declared `effective`
- Downstream impact:
  - `0230` / `0224` / `0225` must not treat local as environment-effective precedent
  - a new local fix iteration is required if Home is expected to project `root_home`
