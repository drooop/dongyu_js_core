---
title: "Doc Workspace Fill-Table Example"
doc_type: user-guide
status: active
updated: 2026-04-21
source: ai
---

# Doc Workspace Fill-Table Example

## 目标

这个示例说明：一个接近 `workspace_ui_filltable_example_visualized.html` 风格的文档页面，也可以完全通过填写模型表来组成。

它不是临时预览，而是正式挂在 Workspace 侧边栏里的页面。

## 模型分工

- `Model 1013`
  - app host
  - 负责页面结构、布局、顺序、挂载
- `Model 1014`
  - truth model
  - 负责主要文本内容

在 Workspace 中，你会看到：

- `0276 Doc Page Workspace Example`

点击 `Open` 后，右侧就会显示文档页面。

## 页面是怎么组成的

这个页面使用了这些组件：

- `Section`
- `Heading`
- `Paragraph`
- `Callout`
- `List`
- `ListItem`
- `MermaidDiagram`
- `Container`

其中：

- 结构和位置主要在 `Model 1013`
- 文字内容主要在 `Model 1014`

## 哪些标签控制布局

最关键的是 `Model 1013` 里的这些 label：

- `ui_parent`
- `ui_order`
- `ui_layout`
- `ui_gap`
- `ui_wrap`

例如：

- `Model 1013 / (2,14,0) / ui_layout = row`

它决定了“布局证明”那一行是左右排布。

如果你把它改成：

- `column`

页面就会从左右布局变成上下布局。

这就是“布局位置由 label 定义”的直接证明。

## 哪些标签控制内容

主要文本放在 `Model 1014 / (0,0,0)`，例如：

- `doc_title`
- `hero_heading`
- `hero_intro`
- `summary_left_text`
- `summary_right_text`
- `flow_section_text`
- `layout_left_text`
- `layout_right_text`
- `rebuild_step_1`
- `rebuild_step_2`
- `rebuild_step_3`

修改这些值后，页面会直接更新。

## 最短验证步骤

1. 打开 Workspace。
2. 在侧边栏找到 `0276 Doc Page Workspace Example`。
3. 点击 `Open`，确认右侧显示的是文档页面。
4. 切到 Home，选择 `Model 1014`，修改 `doc_title` 或 `hero_heading`。
5. 回到 Workspace，确认标题变化。
6. 再切到 Home，修改 `Model 1013 / (2,14,0) / ui_layout`。
7. 回到 Workspace，确认布局变化。

## 和 0275 的关系

- `0275` 证明了文档组件和最小预览已经成立
- `0276` 则把它提升成正式 Workspace 页面

也就是说：

- `0275` 是最小能力证明
- `0276` 是正式页面示例
