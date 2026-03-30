---
title: "0234 — local-browser-evidence-effective-rerun Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-25
source: ai
iteration_id: 0234-local-browser-evidence-effective-rerun
id: 0234-local-browser-evidence-effective-rerun
phase: phase1
---

# 0234 — local-browser-evidence-effective-rerun Resolution

## HOW

0234 采用“先冻结复验合同，再重获 canonical local baseline，随后执行一次 fresh Playwright MCP browser task，最后用 snapshot + browser report 联合裁决”的顺序推进。

核心原则：

- 不在 0234 内继续修代码
- 不复用 `0223` 的旧截图、旧 runlog 结论
- 不在 baseline gate 未绿时直接跑浏览器并强行裁决
- 不用 mock executor 或人工点击替代真实 Playwright MCP
- 一旦发现需要源码修复，立即停止并要求新开 fix iteration

## Preconditions

- Working directory:
  - `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Target branch:
  - `dropx/dev_0234-local-browser-evidence-effective-rerun`
- Canonical local endpoint:
  - `http://127.0.0.1:30900`
- Canonical batch id:
  - `0234-local-browser-evidence-effective-rerun`
- Canonical browser task id:
  - `local-effective-rerun`
- Required tooling:
  - `bash`
  - `node`
  - `python3`
  - `curl`
  - `jq`
- Required runtime capabilities:
  - reachable local cluster / `ensure_runtime_baseline.sh`
  - real Playwright MCP browser executor

## Delivery Boundaries

- 允许写入：
  - `docs/iterations/0234-local-browser-evidence-effective-rerun/runlog.md`
  - `.orchestrator/runs/0234-local-browser-evidence-effective-rerun/browser_tasks/local-effective-rerun/request.json`
  - `.orchestrator/runs/0234-local-browser-evidence-effective-rerun/browser_tasks/local-effective-rerun/result.json`
  - `output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/*`
- 只读参考：
  - `scripts/ops/check_runtime_baseline.sh`
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`
  - `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `scripts/orchestrator/browser_bridge.mjs`
  - `scripts/orchestrator/browser_agent.mjs`
  - `docs/iterations/0223-local-cluster-browser-evidence/runlog.md`
  - `docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md`
- 不允许扩到：
  - `packages/**`
  - `scripts/ops/*.sh`
  - `scripts/tests/*.mjs`
  - `scripts/orchestrator/*.mjs`

## Stop Conditions

- Step 2 若 `bash scripts/ops/check_runtime_baseline.sh` 仍非绿色，0234 不得进入 fresh browser rerun；最终结论只能是 `blocked/unverified`
- Step 3 若 browser executor 不是 `playwright-mcp`，或 `result.json.failure_kind` 是以下任一值，0234 必须停下：
  - `mcp_unavailable`
  - `executor_unavailable`
  - `browser_bridge_not_proven`
  - `request_invalid`
  - `result_invalid`
- Step 4 若 snapshot 与 browser report 互相矛盾，0234 不得硬判 `effective`；必须写成 `not effective` 或 `blocked/unverified`
- 任一阶段若发现必须修改源码才能继续，0234 必须停止，不得在本 iteration 内转成 repair

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Freeze Preconditions And Evidence Contract | 固定 0234 的前置事实、fresh rerun 前提、batch/task/artifact/report 合同 | `docs/iterations/0223-local-cluster-browser-evidence/runlog.md`, `docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md`, `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`, `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`, `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs` | contract tests + runlog grep | 只读分析，无业务回退 |
| 2 | Re-materialize Canonical Local Baseline | 在 browser rerun 前通过 canonical local repair 与 live `/snapshot` 重获可裁决环境 | `scripts/ops/ensure_runtime_baseline.sh`, `scripts/ops/check_runtime_baseline.sh`, `docs/iterations/0234-local-browser-evidence-effective-rerun/runlog.md` | ensure/check + snapshot assertions | 无 repo 回退；仅允许重新执行 canonical baseline 路径 |
| 3 | Execute One Fresh Playwright MCP Browser Task | 用单个 canonical browser task 产出新的 request/result/artifact/report evidence pack | `.orchestrator/runs/0234-local-browser-evidence-effective-rerun/browser_tasks/local-effective-rerun/request.json`, `.orchestrator/runs/0234-local-browser-evidence-effective-rerun/browser_tasks/local-effective-rerun/result.json`, `output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/*`, `docs/iterations/0234-local-browser-evidence-effective-rerun/runlog.md` | request/result/artifact existence + executor/failure-kind checks | 清理本次 batch/task 证据目录，不改源码 |
| 4 | Adjudicate Effective Or Not Effective | 用 live snapshot 与 fresh browser report 联合给出最终裁决并写入 runlog | `output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/report.json`, `docs/iterations/0234-local-browser-evidence-effective-rerun/runlog.md`, `scripts/ops/check_runtime_baseline.sh` | snapshot assertions + report field checks + runlog verdict grep | 仅回滚 runlog 判词或删除无效 evidence 后重跑 Step 3/4 |

## Step 1 — Freeze Preconditions And Evidence Contract

- Scope:
  - 固定 0223 与 0233 的事实边界，防止 0234 在执行期改变“为何重跑”的口径
  - 确认 repo-side contracts 仍为绿色：
    - `0232` live surface gate contract
    - `0233` persisted asset loader contract
    - Matrix debug server-side validation
  - 冻结 0234 的 batch id、task id、artifact 名称与 `report.json` 最小字段集合
- Files:
  - `docs/iterations/0223-local-cluster-browser-evidence/runlog.md`
  - `docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md`
  - `scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs`
  - `scripts/tests/test_0200b_persisted_asset_loader_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `docs/iterations/0234-local-browser-evidence-effective-rerun/runlog.md`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0232_local_baseline_surface_gate_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0200b_persisted_asset_loader_contract.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "Local environment not effective|home-datatable|old workspace registry|matrix_debug_page_asset=missing|blocked/unverified|code-side fix complete" docs/iterations/0223-local-cluster-browser-evidence/runlog.md docs/iterations/0233-local-matrix-debug-surface-materialization-fix/runlog.md
```

- Acceptance:
  - 已明确：
    - `0223` 的 `not effective` 属于修复前环境事实
    - `0233` 已完成 repo-side 修复，但 live environment 仍未被重新证明为 effective
  - `0232` gate contract、persisted asset loader contract、Matrix debug local server validation 均为绿色
  - 0234 的 canonical evidence contract 已冻结为：
    - batch: `0234-local-browser-evidence-effective-rerun`
    - task: `local-effective-rerun`
    - artifacts:
      - `home.png`
      - `workspace.png`
      - `matrix-debug.png`
      - `prompt.png`
      - `report.json`
- Rollback:
  - 本步只读；如果 runlog 中误写了 planning 文字，只回退 `0234` 的文档改动

## Step 2 — Re-materialize Canonical Local Baseline

- Scope:
  - 在跑 fresh browser evidence 前，先要求 current local environment 真正通过 `0232` canonical gate
  - 只接受 canonical 路径：
    - `bash scripts/ops/ensure_runtime_baseline.sh`
    - `bash scripts/ops/check_runtime_baseline.sh`
    - live `http://127.0.0.1:30900/snapshot`
  - 如果 gate 仍未转绿，不继续进入 Step 3
- Files:
  - `scripts/ops/ensure_runtime_baseline.sh`
  - `scripts/ops/check_runtime_baseline.sh`
  - `docs/iterations/0234-local-browser-evidence-effective-rerun/runlog.md`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/ensure_runtime_baseline.sh
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-22"].cells["0,1,0"].labels.page_asset_v0.v.id == "root_home"'
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-100"].cells["0,1,0"].labels.page_asset_v0.v.id == "matrix_debug_root"'
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '.snapshot.models["-103"].cells["0,1,0"].labels.page_asset_v0 != null and .snapshot.models["-102"].cells["0,11,0"].labels.gallery_showcase_tab.v == "matrix"'
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && curl -fsS http://127.0.0.1:30900/snapshot | jq -e '(.snapshot.models["-2"].cells["0,0,0"].labels.ws_apps_registry.v // []) as $apps | ([100,-100,-103,1003,1004,1005,1007] | all(. as $id | ($apps | map(.model_id) | index($id)))) and (($apps | map(.model_id) | index(1006)) | not) and (($apps | map(.model_id) | index(1008)) | not)'
```

- Acceptance:
  - `check_runtime_baseline.sh` 返回 PASS
  - live `/snapshot` 与 `0232` 冻结的 surface contract 一致
  - 没有出现 `matrix_debug_page_asset=missing`、旧 `home` surface、旧 workspace registry 之类的 stale blocker
  - 只有在这些条件成立后，0234 才允许进入 fresh browser rerun
- Rollback:
  - 本步无 repo 级回退
  - 若执行途中产生了无效的 batch evidence 目录，删除：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rm -rf .orchestrator/runs/0234-local-browser-evidence-effective-rerun output/playwright/0234-local-browser-evidence-effective-rerun
```

  - 若 local environment 需要恢复到 canonical state，只允许重新执行：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/ensure_runtime_baseline.sh
```

## Step 3 — Execute One Fresh Playwright MCP Browser Task

- Scope:
  - 使用单个 canonical browser task 生成 fresh rerun evidence pack
  - browser task 必须至少覆盖：
    - `/#/` Home
    - `/#/workspace` Workspace
    - Workspace 中的 Matrix Debug surface
    - `/#/prompt` Prompt
  - 真实 executor 必须是 `playwright-mcp`
  - `report.json` 必须至少写出：
    - `home.surface_marker`
    - `home.legacy_home_datatable_detected`
    - `workspace.observed_registry_model_ids`
    - `workspace.legacy_registry_detected`
    - `matrix_debug.surface_marker`
    - `matrix_debug.visible`
    - `prompt.reachable`
    - `verdict_candidate`
    - `console_errors`
- Files:
  - `.orchestrator/runs/0234-local-browser-evidence-effective-rerun/browser_tasks/local-effective-rerun/request.json`
  - `.orchestrator/runs/0234-local-browser-evidence-effective-rerun/browser_tasks/local-effective-rerun/result.json`
  - `output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/home.png`
  - `output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/workspace.png`
  - `output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/matrix-debug.png`
  - `output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/prompt.png`
  - `output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/report.json`
  - optional:
    - `output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/console.json`
    - `output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/trace.zip`
  - `docs/iterations/0234-local-browser-evidence-effective-rerun/runlog.md`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID=0234-local-browser-evidence-effective-rerun && test -f ".orchestrator/runs/$BATCH_ID/browser_tasks/local-effective-rerun/request.json" && test -f ".orchestrator/runs/$BATCH_ID/browser_tasks/local-effective-rerun/result.json"
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID=0234-local-browser-evidence-effective-rerun && test -f "output/playwright/$BATCH_ID/local-effective-rerun/home.png" && test -f "output/playwright/$BATCH_ID/local-effective-rerun/workspace.png" && test -f "output/playwright/$BATCH_ID/local-effective-rerun/matrix-debug.png" && test -f "output/playwright/$BATCH_ID/local-effective-rerun/prompt.png" && test -f "output/playwright/$BATCH_ID/local-effective-rerun/report.json"
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID=0234-local-browser-evidence-effective-rerun && node -e "const fs=require('fs'); const p='.orchestrator/runs/'+process.env.BATCH_ID+'/browser_tasks/local-effective-rerun/request.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); if (j.executor.mode!=='mcp') throw new Error('executor_mode_not_mcp'); if (j.executor.executor_id!=='playwright-mcp') throw new Error('executor_id_not_playwright_mcp'); console.log('PASS request executor contract')"
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && export BATCH_ID=0234-local-browser-evidence-effective-rerun && node -e "const fs=require('fs'); const p='.orchestrator/runs/'+process.env.BATCH_ID+'/browser_tasks/local-effective-rerun/result.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); if (j.status!=='pass') throw new Error('browser_task_not_pass:'+j.failure_kind); if (j.failure_kind!=='none') throw new Error('unexpected_failure_kind:'+j.failure_kind); const rel=(j.artifacts||[]).map(x=>x.relative_path); for (const name of ['home.png','workspace.png','matrix-debug.png','prompt.png','report.json']) { if (!rel.some(p=>p.endsWith('/'+name))) throw new Error('missing_artifact:'+name) } console.log('PASS result contract and artifacts')"
```

- Acceptance:
  - request/result 文件位于 canonical `.orchestrator` 路径
  - artifacts 位于 canonical `output/playwright` 路径
  - executor 明确为 `playwright-mcp`
  - 结果不是 mock/fallback，也不是 `mcp_unavailable` 一类 blocker masquerading as pass
  - `report.json` 足以支撑 Step 4 的 deterministic adjudication
- Rollback:
  - 删除本次 batch 的 local browser evidence 痕迹：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rm -rf .orchestrator/runs/0234-local-browser-evidence-effective-rerun/browser_tasks/local-effective-rerun output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun
```

  - 不回退任何源码或历史 iteration 证据

## Step 4 — Adjudicate Effective Or Not Effective

- Scope:
  - 用 live `/snapshot` 与 fresh `report.json` 联合给出唯一合法结论
  - 将裁决写入 `runlog.md`，并明确这次 fresh rerun 是 supersede 还是 reaffirm `0223` 的旧结论
  - 只允许以下终态：
    - `Local environment effective`
    - `Local environment not effective`
    - `blocked/unverified`
- Files:
  - `output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/report.json`
  - `docs/iterations/0234-local-browser-evidence-effective-rerun/runlog.md`
  - `scripts/ops/check_runtime_baseline.sh`
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/check_runtime_baseline.sh
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && jq -e '.home.surface_marker == "root_home" and .home.legacy_home_datatable_detected == false' output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/report.json
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && jq -e '(.workspace.observed_registry_model_ids | index(100)) and (.workspace.observed_registry_model_ids | index(-100)) and (.workspace.observed_registry_model_ids | index(-103)) and (.workspace.observed_registry_model_ids | index(1003)) and (.workspace.observed_registry_model_ids | index(1004)) and (.workspace.observed_registry_model_ids | index(1005)) and (.workspace.observed_registry_model_ids | index(1007)) and ((.workspace.observed_registry_model_ids | index(1006)) | not) and ((.workspace.observed_registry_model_ids | index(1008)) | not) and .workspace.legacy_registry_detected == false' output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/report.json
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && jq -e '.matrix_debug.surface_marker == "matrix_debug_root" and .matrix_debug.visible == true and .prompt.reachable == true and (.verdict_candidate == "effective" or .verdict_candidate == "not_effective")' output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun/report.json
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "Local environment effective|Local environment not effective|blocked/unverified" docs/iterations/0234-local-browser-evidence-effective-rerun/runlog.md
```

- Acceptance:
  - 若 Step 2 绿色且 `report.json` 与 live snapshot 一致地指向新 surface，则终态必须是：
    - `Local environment effective`
  - 若 Step 2 绿色，但 `report.json` 或 live snapshot 仍暴露旧 Home / 旧 Workspace registry / Matrix debug 不可见，则终态必须是：
    - `Local environment not effective`
  - 若 Step 2 或 Step 3 未完成，或证据互相矛盾无法裁决，则终态只能是：
    - `blocked/unverified`
  - runlog 必须明确说明：
    - 这次结论是 supersede 还是 reaffirm `0223`
    - 对 downstream 的影响是继续放行还是要求新开 fix iteration
- Rollback:
  - 若只是 runlog 判词错误，回退 `runlog.md` 到上一个正确版本并按同一 evidence 重新写结论
  - 若 evidence pack 本身不可信，删除本次 batch evidence 后重跑 Step 3/4：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rm -rf .orchestrator/runs/0234-local-browser-evidence-effective-rerun/browser_tasks/local-effective-rerun output/playwright/0234-local-browser-evidence-effective-rerun/local-effective-rerun
```

## Conformance Notes

- Tier boundary:
  - 0234 只做环境验证与证据沉淀，不修改 Tier 1 / Tier 2 逻辑
- Model placement:
  - 0234 只读取并验证 `-22`、`-100`、`-103`、`-102`、`-2` 的既有 placement
- Data ownership:
  - truth source 仍是 repo authoritative assets + live snapshot；screenshots 只是 operator evidence
- Data flow / data chain:
  - 0234 只消费既有 `persisted asset -> loader -> live snapshot` 与 `browser_task -> result/artifact` 链路，不新增任何旁路

## Global Rollback Rule

- 0234 默认不产生源码改动；全局回退只涉及本次 evidence 和 runlog
- 若需要彻底清理 0234 运行痕迹，执行：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rm -rf .orchestrator/runs/0234-local-browser-evidence-effective-rerun output/playwright/0234-local-browser-evidence-effective-rerun
```

- 若 local environment 需要恢复到 canonical baseline，只允许重新执行：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bash scripts/ops/ensure_runtime_baseline.sh
```

- 不允许用 ad-hoc cluster mutation、手工改 snapshot、手工替换截图等方式“修正结论”
