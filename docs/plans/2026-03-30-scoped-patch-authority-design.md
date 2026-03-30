---
title: "Scoped Patch Authority Design"
doc_type: design
status: active
updated: 2026-03-30
source: ai
---

# Scoped Patch Authority Design

Date: 2026-03-30
Status: Approved-for-planning
Related Iteration: `0266-scoped-patch-authority`

## Context

当前 runtime 仍存在两类不合规路径：

- `ui-server` 回程处理中直接对目标模型执行 `runtime.applyPatch(...)`
- 双总线 UI 子模型的回程 handler 仍可通过 `ctx.runtime.applyPatch(...)` 直接 materialize 任意 record

这与以下规约冲突：

- 父模型不能直接操作子模型内部状态，只能通过子模型暴露的 pin/API 链路传递数据
- 所有模型修改都应服从模型层级和模型作用域
- 运行态副作用必须可追溯，不能依赖全局越权写入口

## Decision

采用“root boundary + reserved helper cell + scoped patch only”方案：

- `(0,0,0)` 继续只承担模型边界和结构声明职责
- 每个模型默认预置一个保留 helper executor cell，推荐固定在 `(0,1,0)`
- 用户程序不开放 `apply_patch` / `applyScopedPatch`
- 用户程序只能通过写 pin 调用当前模型内的 helper
- helper 只拥有当前模型 scoped patch 权限
- 外界/父模型要进入子模型，必须通过 `model.submt` hosting cell 暴露出来的 pin 链路逐层深入

## Structural Rules

### 1. Root Cell

`(0,0,0)` 只允许承担以下职责：

- `model.table` / `model.single` / `model.matrix`
- `pin.table.in/out` 或 `pin.single.in/out`
- `pin.connect.*`
- `model.submt`
- 其它模型边界声明型 label

不把默认 helper 程序塞进根格，避免根格同时承担边界层和执行层语义。

### 2. Reserved Helper Cell

每个新模型默认预置一个保留 helper executor cell，例如 `(0,1,0)`。

职责：

- 接收当前模型内的 patch/materialization 请求
- 对请求做 scoped 校验
- 在当前模型内执行 `applyScopedPatch`
- 返回成功/失败状态

该 cell 默认可见，但使用保留位置与保留 key 标识为系统脚手架，不建议用户手工改写。

## Authority Model

### 1. Global applyPatch

保留给：

- trusted bootstrap
- persisted asset loader
- startup env patch
- 其它明确的 system bootstrap loader

不再作为运行态函数能力暴露给用户程序或一般 handler。

### 2. Scoped Patch

新增并冻结语义：

- `applyScopedPatch(currentModelId, patch)`
- 所有 `records[*].model_id` 必须等于 `currentModelId`
- 禁止 `create_model`
- 禁止跨模型写入
- 禁止越权修改父/子/兄弟模型

效果：

- `Model 0` 只能 scoped patch `Model 0`
- `Model 100` 只能 scoped patch `Model 100`
- 想修改子模型，必须把数据沿 pin/API 链继续传入子模型，再由子模型 helper materialize

## User Programming Model

用户自定义程序模型不开放 patch 级写能力。

允许能力：

- `add_label` / `rm_label`
- 读当前模型状态
- 写当前模型已声明的 pin
- 写入当前模型 helper request pin

禁止能力：

- 直接调用 `runtime.applyPatch`
- 直接调用 `ctx.applyScopedPatch`
- 通过函数绕过父子模型 pin/API 链路

这样可以保证用户流程模型也受同一权限模型约束。

## Dual-Bus Return Path

回程正式路径应为：

1. 外部结果进入 `Model 0`
2. `Model 0` 只写本层 relay / pin
3. 经父模型 hosting cell 暴露的 child pin，逐层向下 relay
4. 到达目标子模型后，写入该子模型 helper request pin
5. helper 在当前模型内执行 scoped patch
6. 页面因当前模型 label 改变而重渲染

不再允许：

- server 直接对目标子模型执行 `applyPatch`
- 系统函数拿 `ctx.runtime.applyPatch` 直接落盘到目标子模型

## Migration Impact

本次设计不是单点修补，必须覆盖以下资产：

- runtime 权限与 ctx API
- `ui-server` 双总线回程路径
- 所有当前使用 direct patch materialization 的系统模型/程序模型
- `packages/worker-base/system-models/**/*.json`
- `deploy/sys-v1ns/**/*.json`
- 历史 dual-bus/UI model 示例 patch
- 回归测试与本地部署验证

因此实现必须先完成 repo 审查与升级清单，再逐步替换。

## Acceptance Direction

完成态应满足：

- 运行态函数不再暴露全局 `applyPatch`
- 用户程序只能通过 pin 调用 helper 完成当前模型 materialization
- 双总线 UI 子模型的去程/回程都走 formal pin/API 链
- 旧 direct patch 路径被删除或显式 reject
- 所有受影响 JSON patches 与 tests 升级完成
- 本地重新部署后，在真实运行面通过验证
