---
title: "Slide App Runtime User Guide"
doc_type: user-guide
status: active
updated: 2026-06-10
source: ai
---

# Slide App Runtime User Guide

本目录面向滑动 APP 开发者、provider 和集成者。它说明当前滑动 APP 如何编写、打包、安装、接入宿主引脚、触发后端程序模型，以及如何把结果沿总线回写到 UI。

Authority:
- This is a user guide. It does not override `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`, `docs/ssot/pin_connection_contract_v2.md`, `docs/ssot/temporary_modeltable_payload_v1.md`, or `docs/ssot/label_type_registry.md`.

Current boundary:
- 正式业务入口默认通过 `bus_event_v2 -> Model 0 (0,0,0) pin.bus.cb.in -> pin route -> target`；显式管理语义才使用 `pin.bus.mb.in`。
- 输入过程中的本地草稿不等于业务提交。
- 引脚上传递的业务数据是临时 ModelTable record array；只有显式 materialization 才落成正式模型表。
- HTML 文件只作为 visualized / interactive companion，不是 SSOT。

## Start Here

| File | Role | Use when |
|---|---|---|
| `slide_app_runtime_developer_guide.md` | main developer guide | 需要理解完整开发、安装、运行、事件和外发链路。 |
| `function_port_collision_repair_guide.md` | repair guide | 需要对比 `func.js` 自动端口与显式 `pin.*` 同名冲突，并修正导入包或已安装实例。 |
| `minimal_submit_app_provider_guide.md` | provider cookbook | 需要做一个最小 Submit 双总线 APP 或 remote-worker provider 示例。 |
| `todo_save_mqtt_event_example.md` | task-save MQTT cookbook | 需要让 To Do / 表单类按钮先触发程序模型，再通过 root `pin.out` 发出 MQTT。 |
| `mqtt_response_to_ui_materialization.md` | MQTT response cookbook | 需要理解 remote-worker 回包如何通过 `response_topic` 回到 UI Server，并 materialize 成界面 labels。 |
| `minimal_submit_app_provider_visualized.md` | visualized Markdown | 需要用图解理解最小 Submit 示例。 |
| `minimal_submit_app_provider_interactive.html` | interactive HTML | 需要在浏览器里切换查看 R1 填表、UI 拆分、Workspace 导入和外部 topic 测试步骤。 |
| `slide_app_runtime_flow_visualized.html` | visualized HTML | 需要用阶段卡片和流程图浏览同一条链路。 |

## Verification Rule

修改本目录 Markdown 时，检查它仍然和上游 SSOT 对齐。

修改本目录 HTML 时，必须用本地静态服务或浏览器直接打开页面，确认页面能加载、关键内容可见、交互控件可用。
