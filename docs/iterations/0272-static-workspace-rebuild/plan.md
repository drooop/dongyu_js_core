---
title: "Iteration 0272-static-workspace-rebuild Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0272-static-workspace-rebuild
id: 0272-static-workspace-rebuild
phase: phase1
---

# Iteration 0272-static-workspace-rebuild Plan

## Goal

用当前正数 Workspace app + child truth model 的方式重建 Static 页面，同时保留 `/p/<projectName>/...` 的访问规则。

## Scope

- 新增 Workspace Static app host 和 truth model
- 页面支持上传单个 HTML 或 zip
- 上传参数、状态和项目列表都由模型表驱动
- 页面入口挂到 Workspace 侧边栏
- 最终用 `workspace_ui_filltable_example_visualized.html` 真实上传验证

## Acceptance

- Static 条目在 Workspace 可见
- 页面打开后可上传 HTML / zip
- 上传后可通过 `/p/<projectName>/...` 访问
- 关键状态在 truth model 可见
- 用户文档完整

