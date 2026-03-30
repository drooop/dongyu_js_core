---
title: "Iteration 0137-planA-layered-pressure-test Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0137-planA-layered-pressure-test
id: 0137-planA-layered-pressure-test
phase: phase3
---

# Iteration 0137-planA-layered-pressure-test Runlog

## Environment

- Date: 2026-02-09
- Branch: `dev_0137-planA-layered-pressure-test`
- Runtime:
- k8s context: `docker-desktop`
- UI Server: `PORT=19000 bun packages/ui-model-demo-server/server.mjs`
- Patch-only workspace: `/tmp/dy_empty_db_workspace/ws_patch_only`

## Execution Records

### Step 1

- Command:
- `bash scripts/ops/check_runtime_baseline.sh > docs/iterations/0137-planA-layered-pressure-test/assets/step1_baseline_check.txt`
- Key output:
- `PASS deploy/mbr-worker readyReplicas=1`
- `PASS deploy/remote-worker readyReplicas=1`
- `PASS mosquitto running`
- `PASS element synapse running`
- Result: PASS
- Commit: N/A

### Step 2-4

- Command:
- `UI_SERVER_URL=http://127.0.0.1:19000 bun scripts/test_planA_layered_pressure.mjs`
- Key output:
- Step2 (导入前): `before_positive_count=0`, `before_ws_registry_len=0`
- Step3 (导入后): `after_positive_model_ids=[1,2,100,1001,1002]`, `after_ws_registry_len=5`, `idempotency_failures=[]`
- Step4 (压力): `rounds=30`, `success_count=28`, `error_count=2`, `p95_ms=515`
- 失败细节: round `11`、`22` 出现 `wait_timeout`（15s）
- Result: FAIL（Step4 未达 `error_count=0`）
- Commit: N/A

### Step 4.1（链路证据补充）

- Command:
- `kubectl logs deploy/remote-worker --tail=2000 | rg 'planA_' > docs/iterations/0137-planA-layered-pressure-test/assets/remote_worker_planA.log`
- `kubectl logs deploy/mbr-worker --tail=3000 | rg 'planA_' > docs/iterations/0137-planA-layered-pressure-test/assets/mbr_worker_planA.log`
- Key output:
- `remote_worker_planA.log` 缺失 round `11`、`22`
- `mbr_worker_planA.log` 可见 round `22` 的 `recv mgmt ui_event` 与 `mqtt publish`
- Result: FAIL（已稳定复现“链路节奏性丢轮”）
- Commit: N/A

### Step 5（Playwright 终验）

- Command:
- Playwright MCP：登录 -> 打开 Workspace（导入前）-> 导入正数 patch -> 再次检查 Workspace -> 点击 `Generate Color`
- Key output:
- 导入前：`workspace_empty_text=true`, `has_color_app=false`
- 导入后：`workspace_empty_text=false`, `has_color_app=true`, `has_generate_button=true`
- 点击后：`color=#fc8974`, `status=color_updated_#fc8974`
- Result: PASS
- Commit: N/A

### Step 6（高频点击/高频事件定位）

- Command:
- Playwright 高频点击观测（`Generate Color`）：
- 30 次，约 110ms 间隔：`ui_event` request/response = `30/30`
- 80 次，约 20ms 间隔（DOM click burst）：`ui_event` request/response = `80/80`
- API 高频注入（prefix=`diagf_1770583913879`）：
- `40` 次，`120ms` 间隔，均返回 `ok=true` 且 `ui_event_last_op_id` 对齐
- Key output:
- `diag_fast_api_summary.json`：`okCount=40`, `errCount=0`
- `diag_fast_chain_diff.json`：`sent=40`, `mbr=18`, `remote=11`
- `missing_in_mbr=22`, `missing_in_remote=29`, `in_mbr_not_remote=9`
- Result: FAIL（高频下链路存在明显丢失）
- Commit: N/A

### Step 6.1（问题点判定）

- 观察结论：
- 不是 mailbox 入口拒绝：`/ui_event` 侧全部成功，`ui_event_last_op_id` 可推进到最后一条。
- 首个可确认丢失点在 server->Matrix->MBR 链路：部分 op_id 未到 mbr。
- 还存在 mbr->remote-worker 的进一步丢失（mbr 看到但 remote 未看到）。
- 现场日志（server 会话）出现 `M_LIMIT_EXCEEDED (429 Too Many Requests)`，与高频丢失时间窗一致。
- Result: CONFIRMED（本轮先不改 mailbox 语义，先处理链路限流/重试）

### Step 6.2（最小改动验证：Matrix send 限速队列 + retry_after_ms）

- Code change:
- `packages/ui-model-demo-server/server.mjs`
- 新增 `sendMatrix` 出站串行队列。
- 新增最小发送间隔（默认 `550ms`）。
- 对 `429/M_LIMIT_EXCEEDED` 按 `retry_after_ms` 重试（无值时 fallback）。
- Command:
- `bash scripts/ops/check_runtime_baseline.sh`
- `bun packages/ui-model-demo-server/server.mjs`
- `UI_SERVER_URL=http://127.0.0.1:9000 bun scripts/import_positive_models_patch.mjs`
- 高频注入（40轮，80ms 间隔）并对账：
- `kubectl logs deploy/mbr-worker --tail=30000 | rg '<prefix>'`
- `kubectl logs deploy/remote-worker --tail=30000 | rg '<prefix>'`
- Key output:
- 改前（`preq_1770616776`）：
- `sent=40, mbr_after_wait=17, remote_after_wait=7, matrix_429_hits=330`
- 改后（`postq_1770616868`）：
- `sent=40, mbr_after_drain=40, remote_after_drain=40, matrix_429_hits=0`
- Playwright（Workspace / Generate Color）：
- `10` 次 `100ms` + 等待 `20s`：`changed=true`
- `20` 次 `50ms` + 等待 `25s`：`changed=true`
- Result: PASS（最小改动验证通过）
- Commit: N/A

### Step 7（正式全量回归 Gate：ws0137_gate）

- Workspace:
- `WORKER_BASE_WORKSPACE=ws0137_gate`
- Command:
- `bash scripts/ops/check_runtime_baseline.sh`
- `WORKER_BASE_WORKSPACE=ws0137_gate bun scripts/reset_workspace_db_v0.mjs`
- `WORKER_BASE_WORKSPACE=ws0137_gate bun packages/ui-model-demo-server/server.mjs`
- `UI_SERVER_URL=http://127.0.0.1:9000 PLANA_UI_EVENT_ROUNDS=30 PLANA_UI_EVENT_TIMEOUT_MS=30000 bun scripts/test_planA_layered_pressure.mjs`
- Playwright Step E（Workspace -> `Generate Color` 快速点击 10 次）：
- `ok=true, changed=true`
- Key output:
- `stepA_D_summary_2026-02-09T06-19-22-791Z.json`：
- Step2：`before_positive_count=0`, `before_ws_registry_len=0`
- Step3：`after_positive_model_ids=[1,2,100,1001,1002]`, `idempotency_failures=[]`
- Step4：`success_count=30`, `error_count=0`, `p95_ms=1286`
- `playwright_stepE_gate_result.json`：
- `{"ok":true,"initial":"color_updated_#709904","final":"color_updated_#4813d6","changed":true}`
- Result: PASS（本轮 Step A-E 全量回归通过）
- Commit: N/A

### Step 8（UI 防多击增强：A1 -> A2）

- Command:
- `WORKER_BASE_WORKSPACE=ws_a1a2 bun scripts/reset_workspace_db_v0.mjs`
- `WORKER_BASE_WORKSPACE=ws_a1a2 bun packages/ui-model-demo-server/server.mjs`
- `UI_SERVER_URL=http://127.0.0.1:9000 bun scripts/import_positive_models_patch.mjs`
- `npm -C packages/ui-model-demo-frontend run build`
- Playwright（Workspace -> `Generate Color` 20 次 DOM burst）：
- A1（前端硬编码 submit props）验证：`burstDelta=1`, `drainDelta=1`, `changed=true`
- A2（schema `submit__props` 驱动）复验：`burstDelta=1`, `drainDelta=1`, `changed=true`
- Key output:
- A2 证据：`playwright_a2_schema_singleflight_verify.txt` 中 `{"ok":true,"burstDelta":1,"drainDelta":1,"changed":true,...}`
- Result: PASS（A1 有效，A2 等效替代并通过）
- Commit: N/A

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed
- [x] `docs/user-guide/color_generator_e2e_runbook.md` updated（补充 0137 方案A压测入口与排障线索）
- [x] `docs/tests/color-generator-matrix-rate-limit-0137.md` added（本次排查与最小改动验证沉淀）
- [x] 高频定位证据落盘：
- `docs/iterations/0137-planA-layered-pressure-test/assets/diag_fast_api_summary.json`
- `docs/iterations/0137-planA-layered-pressure-test/assets/diag_fast_chain_diff.json`
- `docs/iterations/0137-planA-layered-pressure-test/assets/diag_fast_ids_raw.txt`
- `docs/iterations/0137-planA-layered-pressure-test/assets/diag_fast_matrix_429_excerpt.txt`
- [x] 本轮最小改动验证证据：
- `docs/iterations/0137-planA-layered-pressure-test/assets/matrix_queue_pre_api_preq_1770616776.json`
- `docs/iterations/0137-planA-layered-pressure-test/assets/matrix_queue_pre_chain_preq_1770616776.json`
- `docs/iterations/0137-planA-layered-pressure-test/assets/matrix_queue_post_api_postq_1770616868.json`
- `docs/iterations/0137-planA-layered-pressure-test/assets/matrix_queue_post_chain_postq_1770616868.json`
- `docs/iterations/0137-planA-layered-pressure-test/assets/matrix_queue_retry_compare_latest.json`
- `docs/iterations/0137-planA-layered-pressure-test/assets/playwright_matrix_queue_retry_verify.json`
- [x] 本轮正式 Gate 证据：
- `docs/iterations/0137-planA-layered-pressure-test/assets/stepA_D_summary_2026-02-09T06-19-22-791Z.json`
- `docs/iterations/0137-planA-layered-pressure-test/assets/step2_before_2026-02-09T06-19-22-791Z.json`
- `docs/iterations/0137-planA-layered-pressure-test/assets/step3_import_2026-02-09T06-19-22-791Z.json`
- `docs/iterations/0137-planA-layered-pressure-test/assets/step4_pressure_summary.json`
- `docs/iterations/0137-planA-layered-pressure-test/assets/playwright_stepE_gate_result.json`
- [x] 本轮 A1/A2 防多击证据：
- `docs/iterations/0137-planA-layered-pressure-test/assets/playwright_a2_schema_singleflight_verify.txt`

## Current Decision

- 0137 当前已具备“最小改动有效 + 全量 Gate 通过”的验证证据。
- 下一步建议：评估队列参数对交互延迟的上限（是否从 550ms 下调）并决定是否进入收尾提交。
