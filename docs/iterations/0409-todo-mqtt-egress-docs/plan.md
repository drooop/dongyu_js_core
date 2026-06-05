---
title: "0409 To Do MQTT Egress Docs Plan"
doc_type: iteration-plan
status: completed
updated: 2026-06-04
iteration_id: 0409-todo-mqtt-egress-docs
id: 0409-todo-mqtt-egress-docs
source: ai
---

# 0409 To Do MQTT Egress Docs Plan

## Goal

让开发者明确：保存任务按钮如果要最终发出 MQTT，不能只把 `ui_bind_json.bus_in_key` 改成 App 内部 pin；必须让按钮先进入 Model 0 ingress，再触发 App 内部程序模型，由程序模型写 root `pin.out`，最后通过安装器生成的 host egress adapter 外发。

## Problem

当前基础 UI 文档中的正式业务事件示例使用 `bus_in_key="submit_request"`。这会让开发者把 App root 内部 `pin.in` 当成 UI Server Model 0 的业务入口。实际运行时 `bus_event_v2.bus_in_key` 只接受 Model 0 已声明的 ingress route，或固定 allow-list key。因此这个写法不会进入 MQTT 链路。

To Do Board 的 ZIP payload 已经使用正确的 `bus_event_submit_0_0_0_0` 占位入口，但文档没有把“按钮业务事件”和“程序模型外发 MQTT”拆开讲清。

## Scope

- 修正基础 UI 文档中的 `bus_event_v2` 示例，不再教 `submit_request` 作为 `bus_in_key`。
- 新增一个完整 To Do 保存任务并外发 MQTT 的 ModelTable JSON patch 示例。
- 新增开发者说明文档，解释需要修改哪些 labels、每个 label 的作用，以及最终 MQTT topic 如何生成。
- 新增回包说明文档，解释 remote-worker response 如何按 `response_topic` 回到 UI Server，并按 `reply_target_model_id` materialize 成界面 labels。
- 新增确定性测试，验证示例可导入并能产生 MQTT publish。

## Non-Goals

- 不改变运行时的 Model 0 ingress 校验。
- 不给 `submit_request` 增加兼容入口。
- 不改现有 To Do Board 的本地任务管理行为。
- 不把 UI 直接连接到 MQTT / Matrix。

## Acceptance

- 文档明确 `bus_event_submit_0_0_0_0` 是 ZIP 作者可写的 submit 占位入口，安装后会变成 `imported_host_submit_<modelId>`。
- 文档明确 `submit_request` / `todo_request` 是 App 内部 pin，不能直接作为 `bus_event_v2.bus_in_key`。
- 完整示例包含 `host_ingress_v1`、`remote_bus_endpoint_v1`、`dual_bus_model`、root `pin.out submit1`、程序模型和按钮绑定。
- 测试证明安装示例后，保存按钮触发会发布到 `UIPUT/ws/dam/pic/de/R1/3000/submit1`，payload 内包含任务标题、内容和状态。
- 文档明确 MQTT 回包必须使用 `message_role=response`，`topic=response_topic`，并由 UI Server 按 `reply_target_model_id` 写回本地 App labels 后再刷新界面。
