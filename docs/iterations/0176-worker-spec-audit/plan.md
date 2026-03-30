---
title: "0176 — Plan (WHAT / WHY)"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0176-worker-spec-audit
id: 0176-worker-spec-audit
phase: phase1
---

# 0176 — Plan (WHAT / WHY)

## Goal

对以下三类“软件工人”做一次从初始化到功能验证的规约审计，并为后续人工/自动验证沉淀可复跑的手工填表用例与日志格式：

- `ui-server`
- `mbr worker`
- `Sliding UI -> ui-server` 这一侧的前端/投影路径（按“滑动 UI 给 ui-server 的软件工人”理解）

本轮重点不是立即修复所有问题，而是先确认：
- 是否完全符合当前规约
- 是否有实现落错层（Tier 1 / Tier 2 混淆）
- 是否存在绕过、旁路、不规范入口
- 哪些规则必须由手工填 `model0` / 正数模型案例覆盖

## Scope

- In scope:
  - 核查三条代码/运行链路的真实实现路径与边界
  - 核对当前规约要求：
    - `MODELTABLE_PATCH_JSON` 启动入表
    - Matrix / MQTT 只从 Model 0 `(0,0,0)` 读表
    - UI 事件只写 mailbox
    - side effect 只通过 `add_label` / `rm_label`
    - Tier 1 / Tier 2 严格分层
    - 正数模型 / 子模型 / pin 路由 / owner 边界
  - 设计“从 0 开始填 model0 和正数模型”的人工测试用例目录
  - 设计 `docs/logs/` 下的记录格式并开始落盘
  - 把风险点、绕过点、规约改进建议写进文档
- Out of scope:
  - 未经确认的大规模 runtime 修复
  - 与本轮审计无关的 UI 美化或结构重构
  - 远端云环境操作

## Invariants / Constraints

- 以 `CLAUDE.md` 和 `docs/architecture_mantanet_and_workers.md` / `docs/ssot/runtime_semantics_modeltable_driven.md` 为上位约束。
- 审计结论必须基于 repo 事实、命令输出、运行日志，不得凭印象。
- 本轮允许写文档、logs、测试案例、必要的审计辅助说明；除非发现证据收集本身被 bug 阻塞，否则不默认进入 remediation。
- 若确认存在“必须修”的实现缺口，应记录为后续 iteration 候选，而不是在本轮审计中静默混入。

## Success Criteria

- 形成三类软件工人的事实审计记录，至少包含：
  - 初始化路径
  - 数据传递链路
  - Tier 1 / Tier 2 归属判断
  - 规约符合点 / 违例点 / 风险点
- 形成一份手工填表验证用例目录，覆盖：
  - model0 bootstrap / 创建正数模型
  - 子模型声明与进入
  - 在所属模型 `(0,0,0)` 权限下写 label
  - model1 -> model2 通过 pin/connect 传值
  - 不合法路径 / 绕过路径 / 预期拒绝
- 在 `docs/logs/` 下创建可复用日志格式，并落至少一轮真实记录。
- 把发现的规约改进建议写入文档，便于后续讨论。

## Inputs

- Created at: 2026-03-07
- Iteration ID: 0176-worker-spec-audit
- Upstream baseline:
  - `0175-local-color-generator-smoke`
  - 当前分支 `dev_0176-worker-spec-audit`
