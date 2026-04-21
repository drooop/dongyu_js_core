---
title: "Iteration 0134-color-generator-e2e-repro Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0134-color-generator-e2e-repro
id: 0134-color-generator-e2e-repro
phase: phase1
---

# Iteration 0134-color-generator-e2e-repro Plan

## Goal

基于现有文档与脚本，复现一次 Model 100 颜色生成器双总线 E2E 测试流程，并沉淀可复现 runbook。

## Scope

In scope:
- 使用仓库现有组件完成一次真实链路验证：UI Server → Matrix → MBR → MQTT → K8s Worker → 回写 UI。
- 记录可执行命令、关键日志信号、PASS/FAIL 判定。
- 新增用户文档：`docs/user-guide/color_generator_e2e_runbook.md`。
- 更新本 iteration 的 `runlog.md` 与 `docs/ITERATIONS.md` 状态。

Out of scope:
- 重构 runtime/MBR/server 代码逻辑。
- 新增业务模型或改动 Model 100 语义。
- 引入新的外部服务依赖。

## Invariants / Constraints

- 遵循 `docs/WORKFLOW.md`：Phase 3 仅在明确 Approved 后执行。
- 证据必须可审计：命令、关键输出、退出码与结论一一对应。
- 使用仓库既有实现与契约：
  - `docs/handover/dam-worker-guide.md`
  - `scripts/test_e2e_model100.mjs`
  - `scripts/run_worker_mbr_v0.mjs`
  - `scripts/run_remote_worker_k8s_v2.mjs`
  - `packages/ui-model-demo-server/server.mjs`
- 最终成功与否必须通过 Playwright 操作验证。

## Success Criteria

- 形成一次完整执行记录，明确 PASS 或 FAIL（含根因）。
- Playwright 产出终验结论，且与命令行测试结论一致。
- 新增 runbook 覆盖：前置条件、启动顺序、验证步骤、常见失败与排障。

## Inputs

- Created at: 2026-02-09
- Iteration ID: 0134-color-generator-e2e-repro
