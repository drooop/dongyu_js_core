---
title: "Iteration 0137-planA-layered-pressure-test Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0137-planA-layered-pressure-test
id: 0137-planA-layered-pressure-test
phase: phase1
---

# Iteration 0137-planA-layered-pressure-test Resolution

## Execution Strategy

- 先以空 workspace 启动 server，确保没有历史 DB 干扰。
- 用脚本执行 Step A-D（前后态、导入幂等、`ui_event` 压力）并固化 JSON 证据。
- 用 Playwright 执行 Step E 做用户视角终验。
- 将结果写入 runlog，失败点附命令与关键输出。

## Step 1

- Scope:
- 准备基线环境与迭代证据目录。
- Files:
- `docs/iterations/0137-planA-layered-pressure-test/runlog.md`
- `docs/iterations/0137-planA-layered-pressure-test/assets/*`
- Verification:
- `bash scripts/ops/check_runtime_baseline.sh`
- Acceptance:
- 所有 baseline 检查项 PASS。
- Rollback:
- 不改代码，无回滚动作。

## Step 2

- Scope:
- 在空 workspace 上启动 server，验证导入前空态。
- Files:
- `scripts/test_planA_layered_pressure.mjs`（新增）
- `docs/iterations/0137-planA-layered-pressure-test/assets/step2_*.json`
- Verification:
- 启动命令：`PORT=19000 bun packages/ui-model-demo-server/server.mjs`
- 脚本输出中 `before_positive_count=0` 且 `before_ws_registry_len=0`
- Acceptance:
- 导入前满足空态判定。
- Rollback:
- 终止 server 进程并删除 `/tmp` 临时 workspace。

## Step 3

- Scope:
- 动态导入正数模型并验证幂等导入。
- Files:
- `packages/worker-base/system-models/workspace_positive_models.json`
- `scripts/import_positive_models_patch.mjs`
- `docs/iterations/0137-planA-layered-pressure-test/assets/step3_*.json`
- Verification:
- 调用 `/api/modeltable/patch` 导入后检查模型集合与 registry。
- 连续重复导入 5 次，确认 registry 长度稳定。
- Acceptance:
- `after_required_models_present=true` 且 `idempotency_failures=0`。
- Rollback:
- 重启空 workspace server 清空内存态。

## Step 4

- Scope:
- 执行 `ui_event` 压力测试，验证错误率与延迟。
- Files:
- `scripts/test_planA_layered_pressure.mjs`
- `docs/iterations/0137-planA-layered-pressure-test/assets/step4_pressure_summary.json`
- Verification:
- 连续 30 次 submit，统计 `success_count/error_count/p95_ms`。
- Acceptance:
- `error_count=0` 且 `p95_ms < 3000`。
- Rollback:
- 降低压力参数重跑，定位失败样本并记录。

## Step 5

- Scope:
- Playwright 终验（导入前空、导入后可见）。
- Files:
- `docs/iterations/0137-planA-layered-pressure-test/assets/playwright_step5.json`
- Verification:
- Playwright 导航、登录、进入 Workspace，记录导入前后 UI 差异与关键元素。
- Acceptance:
- 导入前出现“暂无可用应用”，导入后出现 `E2E 颜色生成器` 并展示详情面板。
- Rollback:
- 关闭浏览器与 server 会话，无代码回滚。

## Notes

- Generated at: 2026-02-09
