---
title: "Color Generator Matrix 限流排查与最小改动验证（0137）"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Color Generator Matrix 限流排查与最小改动验证（0137）

## 1. 结论

- 问题主因在 `server -> Matrix` 发送节奏触发 Synapse `M_LIMIT_EXCEEDED (429)`，不是 `/ui_event` mailbox 入口拒绝。
- 最小改动（`sendMatrix` 串行限速队列 + 按 `retry_after_ms` 重试）后，在同负载测例下，`matrix_429_hits` 从 `330` 降为 `0`，并在队列排空后实现 `sent=40, mbr=40, remote=40`。

## 2. 测试范围

- 测例：Model 100 颜色生成器（Workspace -> Generate Color）。
- 链路：`UI -> server -> Matrix -> MBR -> MQTT -> remote-worker`。
- 负载：`40` 轮 `ui_event`，每轮间隔 `80ms`。

## 3. 改动点（最小）

- 文件：`/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-server/server.mjs`
- 范围：仅 `ProgramModelEngine.sendMatrix` 出站路径。
- 改动：
1. 新增串行发送队列，统一节流 Matrix 出站。
2. 新增最小发送间隔（默认 `550ms`，可由 `DY_MATRIX_SEND_MIN_INTERVAL_MS` 覆盖）。
3. 对 `429/M_LIMIT_EXCEEDED` 读取 `retry_after_ms` 重试；缺失时使用 fallback。

## 4. 执行命令（可复现）

工作目录：`/Users/drop/codebase/cowork/dongyuapp_elysia_based`

1. 基线检查
- `bash scripts/ops/check_runtime_baseline.sh`

2. 启动 UI Server
- `bun packages/ui-model-demo-server/server.mjs`

3. 导入正数模型（幂等）
- `UI_SERVER_URL=http://127.0.0.1:9000 bun scripts/import_positive_models_patch.mjs`

4. 高频注入（本次实际执行）
- 见证据文件：
- `docs/iterations/0137-planA-layered-pressure-test/assets/matrix_queue_pre_api_*.json`
- `docs/iterations/0137-planA-layered-pressure-test/assets/matrix_queue_post_api_*.json`

5. 链路对账（mbr/remote）
- `kubectl logs deploy/mbr-worker --tail=30000 | rg '<prefix>'`
- `kubectl logs deploy/remote-worker --tail=30000 | rg '<prefix>'`

6. Playwright UI 操作验证（快速点击）
- 使用 `playwright-cli` 在 Workspace 页面执行 `Generate Color` 突发点击。
- 结果见：`docs/iterations/0137-planA-layered-pressure-test/assets/playwright_matrix_queue_retry_verify.json`

## 5. 证据与结果

1. 改前（未加队列/重试）
- `docs/iterations/0137-planA-layered-pressure-test/assets/matrix_queue_pre_chain_preq_1770616776.json`
- 关键值：`sent=40, mbr_after_wait=17, remote_after_wait=7, matrix_429_hits=330`

2. 改后（加队列/重试）
- `docs/iterations/0137-planA-layered-pressure-test/assets/matrix_queue_post_chain_postq_1770616868.json`
- 关键值：`sent=40, mbr_after_drain=40, remote_after_drain=40, matrix_429_hits=0`

3. 对比汇总
- `docs/iterations/0137-planA-layered-pressure-test/assets/matrix_queue_retry_compare_latest.json`

4. Playwright 快速点击验证
- `docs/iterations/0137-planA-layered-pressure-test/assets/playwright_matrix_queue_retry_verify.json`
- 两组突发点击后 `color_updated_#xxxxxx` 均发生变化（`changed=true`）。

## 6. 注意事项

1. 改后链路可达性依赖“队列排空时间”；高突发下不是丢失，而是按速率平滑发送。
2. 如果需要更低 UI 可感知延迟，可在确认容量后再讨论动态速率或分流策略；本次仅验证最小改动有效性。

## 7. 正式 Gate 回归（2026-02-09）

- workspace：`ws0137_gate`
- A-D 脚本结果：PASS
- 证据：`docs/iterations/0137-planA-layered-pressure-test/assets/stepA_D_summary_2026-02-09T06-19-22-791Z.json`
- 关键指标：
1. 导入前：`before_positive_count=0`
2. 导入后：`after_positive_model_ids=[1,2,100,1001,1002]`
3. 压力：`success_count=30`, `error_count=0`, `p95_ms=1286`
- Playwright Step E：PASS（快速点击后颜色继续变化）
- 证据：`docs/iterations/0137-planA-layered-pressure-test/assets/playwright_stepE_gate_result.json`

## 8. UI 防多击增强验证（A1 -> A2）

- 目标：在保留方案A（Matrix 出站限速+重试）的基础上，降低 UI 侧重复点击造成的无效请求与可感知延时。
- A1（前端临时硬编码）：
1. 在 Model 100 submit 按钮注入 `disabled/loading/singleFlight`（由 `submit_inflight` 驱动）。
2. 在 renderer 增加本地 single-flight 锁，首击即本地锁定，直到 `submit_inflight=false` 才释放。
3. Playwright 20 次 DOM burst 结果：`burstDelta=1`，`drainDelta=1`，`changed=true`（通过）。
- A2（模型驱动落地）：
1. 移除前端硬编码，改为在 Model 100 schema `submit__props` 中声明 `disabled/loading/singleFlight`。
2. Playwright 复测结果与 A1 一致：`burstDelta=1`，`drainDelta=1`，`changed=true`（通过）。
- 证据：
1. `docs/iterations/0137-planA-layered-pressure-test/assets/playwright_a2_schema_singleflight_verify.txt`
