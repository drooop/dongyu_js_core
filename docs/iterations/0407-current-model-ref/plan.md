---
title: "0407 Current Model Reference Plan"
doc_type: iteration-plan
status: active
updated: 2026-06-03
iteration_id: 0407-current-model-ref
id: 0407-current-model-ref
source: ai
---

# 0407 Current Model Reference Plan

## Goal

让滑动 App 开发者在 ZIP / app payload 中不需要填写部署后才由 Dongyu App 分配的 `model_id`。同一个 UI 模型内部的 label 引用应省略 `model_id`，运行时根据当前 UI 节点所在模型自动解析为实际模型。

## Problem

当前文档和 To Do Board 示例中大量写死 `model_id: 4100` 或 `model_id: 1086`。这对内置模型可用，但对外部开发者提供的滑动 App 不成立：正式 `model_id` 在安装部署时才生成，开发者无法提前知道。

历史文档还出现过“ZIP 内部临时模型引用填 `model_id: 0`，安装器 remap”的说法。该说法会让 `model_id: 0` 同时承担系统根模型和当前模型占位符两种含义，后续容易产生误用。

## Decision

- 同模型引用使用 `{ "p": 0, "r": 0, "c": 0, "k": "draft_text" }`，省略 `model_id`。
- 运行时渲染器以当前 AST 节点的 `cell_ref.model_id` 作为解析上下文。
- 跨模型引用仍必须显式写 `model_id`，例如系统状态模型 `-2` 或其他正数模型。
- 不新增面向开发者的 `get_current_model_id` 函数；同模型省略更简单，也不把运行时信息泄露进静态 JSON patch。
- 不把 `model_id: 0` 作为新规约的当前模型占位符。

## Scope

- 更新 `ui-renderer` 引用解析，使 `read`、`target_ref`、`commit_target_ref`、`$label`、组件 `*Ref` 这类 UI 引用可在同模型场景省略 `model_id`。
- 更新前端 overlay / effective label 读取，使省略 `model_id` 的引用在提交策略中仍能稳定读写。
- 重填 `Model 1086 / To Do Board` 中同模型 UI 引用，移除不必要的 `model_id: 1086`。
- 更新非自带滑动 App 示例 payload，移除同模型引用里的 `model_id: 0`。
- 更新开发者文档，明确新写法、旧写法风险和 To Do Board 扩展组件示例。

## Non-Goals

- 不改变跨模型引用的能力。
- 不改变安装器分配模型 id 的策略。
- 不引入旧 `model_id: 0` 当前模型占位符兼容层。
- 不重写滑动 App 安装链路。

## Acceptance

- 省略 `model_id` 的同模型引用可以读取 label、提交 overlay、发 `bus_event_v2` payload，并通过确定性测试。
- To Do Board 的 `tasksRef`、`filterRef`、输入 read/target refs、按钮 payload `$label` 改为同模型省略 `model_id`。
- 非自带滑动 App 示例 payload 不再要求开发者填写部署后 `model_id` 或用 `0` 占位。
- 文档明确：同模型省略；跨模型显式；不要把 `model_id: 0` 当当前模型。
- 每个实现小阶段后都有 sub-agent code review，并修正到通过。
