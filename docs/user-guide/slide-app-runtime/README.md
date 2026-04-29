---
title: "Slide App Runtime User Guide"
doc_type: user-guide
status: active
updated: 2026-04-29
source: ai
---

# Slide App Runtime User Guide

本目录面向开发者解释“滑动 APP”当前怎么编写、怎么安装、安装时宿主会自动补哪些引脚、点击按钮后事件如何进入后端，以及后端程序模型怎样把消息发到管理总线。

## 文档入口

- `slide_app_runtime_developer_guide.md`
  - 主手册。包含 ModelTable 填表示例、root 默认程序链、安装链路、运行时事件链路和外发链路。
- `slide_app_runtime_flow_visualized.html`
  - 自包含可视化页面。用可点击阶段卡片和流程图解释同一条链路，可直接用浏览器打开。

## 当前边界

- 这里说明的是 0326 之后的 current truth。
- 正式业务入口必须是 `bus_event_v2 -> Model 0 (0,0,0) pin.bus.in -> pin route -> target`。
- 输入过程中的本地草稿不等于业务提交。
- 引脚上传递的业务数据是临时 ModelTable record array；只有显式 materialization 才落成正式模型表。
