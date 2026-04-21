---
title: "Iteration 0185-ui-local-first-negative-state Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0185-ui-local-first-negative-state
id: 0185-ui-local-first-negative-state
phase: phase1
---

# Iteration 0185-ui-local-first-negative-state Plan

## Goal

- 审计并修复 UI 本地优先链路，使未接入 Model 0 `pin.bus.out` 的负数本地态更新不再体感等待远端。
- 重点覆盖两类已观察到的滞后：
  - `model100_input_draft` 一类负数 UI state 输入
  - `gallery_state(-102)` 一类滑块/控件连续更新

## Scope

- In scope:
  - 审计 remote frontend store 是否把负数本地态错误送入 `/ui_event`
  - 修复负数 UI state 的本地即时更新与必要的后台同步策略
  - 增加针对 remote store 的合同测试
  - 浏览器验证 input / slider 交互体感
- Out of scope:
  - 正数业务模型的 direct mutation 放宽
  - submit / Model 0 egress authority 设计变更
  - MBR / remote-worker / 双总线回包语义变更

## Invariants / Constraints

- 只有显式接到 Model 0 `pin.bus.out` 的动作才允许外发；未接线动作必须本地处理。
- UI 不能新增专用导航/输入旁路 API，仍须通过标准 `label_update` / `submit` envelope 表达。
- 正数业务模型 direct mutation 仍保持 `0177` 边界，不得放宽。
- 修改前必须先写红灯测试，并记录到 iteration runlog。

## Success Criteria

- remote store 对负数 UI state 的 `label_update` 会本地即时反映，不等待 `/ui_event` 往返。
- `model100_input_draft` 与 `gallery_state(-102)` 的连续更新不再依赖远端回包才能更新控件显示。
- 仅真正需要外发的动作继续走现有双总线链路，既有 submit/MBR 相关回归不被破坏。
- 新增合同测试 PASS，浏览器复现用例 PASS。

## Inputs

- Created at: 2026-03-11
- Iteration ID: 0185-ui-local-first-negative-state
