---
title: "Iteration 0182-color-generator-local-submit-chain Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0182-color-generator-local-submit-chain
id: 0182-color-generator-local-submit-chain
phase: phase1
---

# Iteration 0182-color-generator-local-submit-chain Plan

## Goal

把颜色生成器从当前 `Model 100 ui_event -> forward_model100_events -> direct Matrix send` 迁到“输入本地处理、只有 `submit` 经现有链路外发”的实现路径。

## Scope

- In scope:
  - 移除颜色生成器对 `dual_bus_model.ui_event_func=forward_model100_events` 的直接外发依赖
  - 保留输入框 local draft、本地 `submit_inflight` 和本地即时响应
  - 使 `submit` 成为唯一可离开本地 runtime 的用户动作
  - 增补失败测试、回归测试、本地和远端验收
- Out of scope:
  - 不引入新的 pin type / label.t
  - 不改通用 runtime 语义，除非证明 server/system-models 无法完成
  - 不扩大到其它 app 的全量迁移

## Invariants / Constraints

- 沿用 `0181` 已批准规约：authority 在现有接线路径，不在新字段。
- 输入框、切页、选中应用等动作不得默认进入远端候选链。
- `submit` 必须是唯一外发动作。
- 优先 fill-table / server 层最小改动；若可避免，不修改 runtime。
- 验证必须同时覆盖：
  - Functional：颜色生成器还能跑通
  - Conformance：输入本地、submit 唯一外发

## Success Criteria

- 新测试先失败后转绿，证明：
  - 输入框只写本地 draft
  - `submit` 是唯一外发动作
  - 旧 direct forward 路径不再作为 authority
- 本地 `verify_model100_submit_roundtrip.sh` PASS
- 远端 `https://app.dongyudigital.com` 回归 PASS
- `0182` runlog 记录真实命令、输出、commit、PASS/FAIL

## Inputs

- Created at: 2026-03-08
- Iteration ID: 0182-color-generator-local-submit-chain
- Approval: user approved continue in-session on 2026-03-08
