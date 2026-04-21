---
title: "Doc Page Fill-Table Guide"
doc_type: user-guide
status: active
updated: 2026-04-21
source: ai
---

# Doc Page Fill-Table Guide

## 目标

这份文档说明如何只靠填写模型表，做出一个最小可工作的文档页面。

当前 MVP 使用临时示例模型 `1015`，它不会出现在 Workspace 侧边栏，而是放在现有 Gallery 页面里做预览。

## 这个最小示例包含什么

`Model 1015` 里现在放了这些组件：

- `Section`
- `Heading`
- `Paragraph`
- `Callout`
- `List`
- `ListItem`
- `MermaidDiagram`

这足够证明：

- 文档页面不需要整页 HTML/Markdown 直塞
- 可以按 cell 粒度填写
- 改一个 label，页面会直接变化

## 关键前提

- 根 cell `(0,0,0)` 必须有：
  - `ui_authoring_version = cellwise.ui.v1`
  - `ui_root_node_id`
- 每个节点一个 cell
- 每个新能力是 `label.k` 约定，不是新 `label.t`
- 本轮不需要改标签类型注册表

## 0275 新增字段

- `ui_heading_level`
- `ui_list_type`
- `ui_callout_type`
- `ui_image_src`
- `ui_image_alt`
- `ui_mermaid_code`
- `ui_code_language`
- `ui_section_number`

## 最小填表步骤

1. 在 `Model 1015` 的根 cell 填：
   - `ui_authoring_version = cellwise.ui.v1`
   - `ui_root_node_id = doc_example_root`
2. 新建根节点 cell：
   - `ui_node_id = doc_example_root`
   - `ui_component = Section`
   - `ui_title = 0275 文档型页面 MVP`
   - `ui_section_number = 1`
3. 新建标题节点：
   - `ui_component = Heading`
   - `ui_text = 文档标题`
   - `ui_heading_level = 2`
4. 新建段落节点：
   - `ui_component = Paragraph`
   - `ui_text = 第一段内容`
5. 新建提示框节点：
   - `ui_component = Callout`
   - `ui_title = 提示`
   - `ui_text = 说明文字`
   - `ui_callout_type = tip`
6. 新建列表节点：
   - `ui_component = List`
   - `ui_list_type = ordered`
7. 在 List 下继续填多个 `ListItem`

## 怎么验证它真的在工作

1. 打开 Gallery 页面
2. 找到 `0275 Doc Page MVP Preview`
3. 在 Home 页把 `Model 1015` 的某个字段改掉，例如：
   - `ui_heading_level: 2 -> 3`
   - `ui_title`
   - `ui_text`
   - `ui_callout_type: tip -> warning`
4. 回到 Gallery，确认页面显示随之变化

## 建议先改这几个字段

- `ui_title`
  - 可以直接验证 Section 头部变化
- `ui_heading_level`
  - 可以验证标题层级变化
- `ui_text`
  - 可以验证 Paragraph / ListItem 的内容变化
- `ui_callout_type`
  - 可以验证提示框样式切换
- `ui_mermaid_code`
  - 当前会以占位形式显示原始图代码

## 当前边界

- `MermaidDiagram` 目前只做占位显示，不做真实图渲染
- 这轮只是 MVP，不包含完整文档站、目录、锚点、Badge、Hero 变体大全
- 正式 Workspace 文档型 app 计划留到后续 iteration，再使用保留模型号 `1013/1014`
