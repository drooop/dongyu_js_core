# Iteration 0134-color-generator-e2e-repro Resolution

## Execution Strategy

以最小改动方式复现现有 E2E 流程：优先使用仓库现有脚本与服务入口，执行事实全部写入 runlog；知识沉淀仅新增 runbook，不改动运行时语义。

## Step 1

- Scope:
  - 建立执行前置：iteration 登记、环境变量映射、服务依赖就绪检查。
- Files:
  - docs/ITERATIONS.md
  - docs/iterations/0134-color-generator-e2e-repro/runlog.md
- Verification:
  - `rg -n "0134-color-generator-e2e-repro" docs/ITERATIONS.md`
  - `node -v && npm -v`
  - `lsof -iTCP -sTCP:LISTEN -nP | rg ":1883|:9000|:8008|:19000" -S || true`
- Acceptance:
  - iteration 已登记，环境检查结果明确。
- Rollback:
  - 回退 `docs/ITERATIONS.md` 与 runlog 的 Step 1 记录。

## Step 2

- Scope:
  - 启动并连通 UI Server、MBR、K8s Worker，执行颜色生成器链路触发。
- Files:
  - docs/iterations/0134-color-generator-e2e-repro/runlog.md
  - docs/iterations/0134-color-generator-e2e-repro/assets/*
- Verification:
  - `curl`/`node` 验证服务健康与事件回写。
  - 关键日志命中：`forward_model100_events`、`mbr_mgmt_to_mqtt`、`Detected event`、`snapshot_delta`。
- Acceptance:
  - 出现可判定结果（PASS 或 FAIL），并附根因证据。
- Rollback:
  - 终止本次新增进程，清理临时日志。

## Step 3

- Scope:
  - 用 Playwright 执行最终终验，确认成功或失败。
- Files:
  - docs/iterations/0134-color-generator-e2e-repro/runlog.md
  - docs/iterations/0134-color-generator-e2e-repro/assets/playwright_*.txt
- Verification:
  - Playwright 操作登录、触发颜色生成、轮询 snapshot，并输出结论。
- Acceptance:
  - Playwright 结论与 Step 2 结论一致。
- Rollback:
  - 关闭 browser 会话；删除临时截图/日志（若无保留价值）。

## Step 4

- Scope:
  - 固化知识到用户文档，补齐 iteration 记录并更新索引状态。
- Files:
  - docs/user-guide/color_generator_e2e_runbook.md
  - docs/iterations/0134-color-generator-e2e-repro/runlog.md
  - docs/ITERATIONS.md
- Verification:
  - `rg -n "颜色生成器|Playwright|前置条件|排障" docs/user-guide/color_generator_e2e_runbook.md`
  - `rg -n "0134-color-generator-e2e-repro" docs/ITERATIONS.md`
- Acceptance:
  - runbook 可独立执行；iteration 状态与事实一致。
- Rollback:
  - 回退 runbook 与索引文档变更。

## Notes

- Generated at: 2026-02-09
