---
title: "Iteration 0278-non-three-fine-grain-remediation Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0278-non-three-fine-grain-remediation
id: 0278-non-three-fine-grain-remediation
phase: phase1
---

# Iteration 0278-non-three-fine-grain-remediation Plan

## Goal

按 `0277` 的审查结论，优先把非 Three.js 的页面 authoring 粗块拆细，先覆盖：

- `0270`
- `0276`
- `Static`

## Scope

### In Scope
- 扩展 compiler 以支持更细的 prop/style/ref labels
- 将目标页面中的大 `ui_props_json / ui_bind_json / ui_bind_write_json` 拆成分散 labels
- 更新 authoring contract
- 本地部署与浏览器回归

### Out of Scope
- Three.js
- 大流程函数 `func.js`
- `ws_apps_registry`

## Done

1. 目标节点不再依赖那批大的 `ui_props_json`
2. 目标节点的动态布局/文本仍然能工作
3. `0270`、`0276`、`Static` 浏览器无回归
