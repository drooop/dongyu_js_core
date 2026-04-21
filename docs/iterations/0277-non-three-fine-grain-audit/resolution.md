---
title: "Iteration 0277-non-three-fine-grain-audit Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0277-non-three-fine-grain-audit
id: 0277-non-three-fine-grain-audit
phase: phase1
---

# Iteration 0277-non-three-fine-grain-audit Resolution

## Step 1: 统计结构基线

- 统计文件大小、总记录数、add_label 数、create_model 数
- 统计主要 key 分布
- 判断是否仍以细粒度结构标签为主体

## Step 2: 排除 Three.js 后扫描大块项

- 排除 `Model 1007/1008`
- 扫描较大的 label value
- 找出：
  - 大 `ui_props_json`
  - 大 `ui_bind_json`
  - 大 `func.js`
  - 大汇总状态

## Step 3: 形成收口建议

- 区分：
  - 应优先拆的页面 authoring 粗块
  - 暂可保留的行为逻辑块
  - 暂可保留的运行态投影块
- 输出下一步优先级顺序
