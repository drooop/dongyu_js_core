---
title: "0302 — slide-app-zip-import-v1 Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0302-slide-app-zip-import-v1
id: 0302-slide-app-zip-import-v1
phase: phase1
---

# 0302 — slide-app-zip-import-v1 Plan

## Goal

实现 Slide app zip 导入 v1：在 Workspace 中完成 zip 导入、解压、model_id 分配、挂载、打开与卸载的最小闭环。

## Scope

- 新增一个 Workspace importer app
- zip 中只支持一个 JSON payload 文件
- payload 文件使用临时模型表数组合同
- 导入后自动 materialize 成新的正数模型并挂到 Workspace
- 侧边栏支持删除已导入 app

## Out Of Scope

- assets
- remote worker 真发 metrics
- 完整应用商店
- 执行型 slide app 包

## Frozen Constraints

- `0302` 不替代 `0288-0291`
- `0302` 自己冻结导入准入最小字段集
- model_id 顺序递增且不回收
- matrix 消息体与导入包使用同一个 payload 合同

## Success Criteria

1. Workspace 中存在 `滑动 APP 导入`
2. 导入一个 zip 后，新 app 出现在 `ws_apps_registry`
3. 新 app 可 `Open`
4. Delete 后 registry、挂载和模型一起消失
5. `0284 / 0270 / Model 100 / Static` 不回归
