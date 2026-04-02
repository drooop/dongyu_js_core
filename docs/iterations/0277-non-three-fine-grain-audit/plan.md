---
title: "Iteration 0277-non-three-fine-grain-audit Plan"
doc_type: iteration-plan
status: active
updated: 2026-04-03
source: ai
iteration_id: 0277-non-three-fine-grain-audit
id: 0277-non-three-fine-grain-audit
phase: phase3
---

# Iteration 0277-non-three-fine-grain-audit Plan

## 0. Metadata
- ID: 0277-non-three-fine-grain-audit
- Date: 2026-04-03
- Owner: User + AI-assisted
- Branch: dev_0277-non-three-fine-grain-audit

## 1. Goal

排除 Three.js 后，审查 `workspace_positive_models.json` 是否符合“以细粒度 label 为主”的方向，并给出后续应优先拆分的清单。

## 2. Scope

### In Scope
- 审查 `workspace_positive_models.json`
- 排除 `Model 1007/1008`（Three.js 相关）
- 统计剩余粗粒度项
- 给出优先级和收口建议

### Out of Scope
- 实际拆分重构
- Three.js 自身细粒度改造

## 3. Success Criteria

1. 明确给出“主体是否仍以细粒度 label 为主”的结论
2. 列出非 Three.js 的大块项
3. 将这些大块项分成：
   - 结构层问题
   - 行为层问题
   - 运行态汇总问题
4. 给出一个可执行的后续拆分顺序
