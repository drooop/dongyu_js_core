---
title: "0175 — 本地颜色生成器运行冒烟验证"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0175-local-color-generator-smoke
id: 0175-local-color-generator-smoke
phase: phase1
---

# 0175 — 本地颜色生成器运行冒烟验证

## Goal

- 使用现有颜色生成器（Model 100 / Generate Color）例子，验证本地项目当前是否能按仓库既有 runbook 正常启动并完成一次 submit roundtrip。

## Scope

- In scope:
- 使用仓库现有一键脚本启动/验证本地链路。
- 在不改变业务模型语义的前提下，允许修复本地 baseline / deploy 脚本中的配置性缺口，使 OrbStack pod 部署路径能被正确验证。
- 记录实际 PASS/FAIL、关键日志与阻塞点。
- 将本次本地运行结论沉淀到 `runlog.md`。
- Out of scope:
- 修改业务逻辑、runtime、worker、server 语义代码。
- 变更 cloud 环境、远端部署配置或公共用户文档。

## Invariants / Constraints

- 只使用仓库现有本地验证入口，优先 `scripts/ops/run_model100_submit_roundtrip_local.sh` 与 `docs/user-guide/color_generator_e2e_runbook.md`。
- 验证结论必须来自真实命令输出，不能用“应该可以”代替。
- 如果本地 baseline 未满足，需要如实记录 FAIL/阻塞，而不是补做额外假设。

## Success Criteria

- `0175` iteration 已登记并具备 Review Gate。
- 一次本地颜色生成器 roundtrip 被实际执行，并得到明确 PASS 或 FAIL。
- runlog 中包含命令、关键输出、结论与下一步判断。

## Inputs

- Created at: 2026-03-07
- Iteration ID: 0175-local-color-generator-smoke
- Trigger:
  - 用户要求先 merge 到 `dev`，再新开一个 iteration，用颜色选择/颜色生成器例子测试项目本地运行情况。
