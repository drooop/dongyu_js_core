---
title: "Workspace 文档页面填表示例 — 可视化指南"
doc_type: user-guide
status: active
updated: 2026-04-21
source: ai
based_on: docs/user-guide/doc_workspace_filltable_example.md
---

# Workspace 文档页面填表示例 — 可视化指南

本文不再解释旧的 `0270 Fill-Table Workspace UI` 三组件例子。  
它现在用图解方式说明新的正式示例：

- `0276 Doc Page Workspace Example`

目标是展示一件事：

- 一个接近文档页面的界面，也可以通过填表组成
- 结构、内容、布局位置，都可以由模型表里的 label 决定

---

## 一、总览：最终看到的页面

```mermaid
graph TD
    sidebar["Workspace 侧边栏\n0276 Doc Page Workspace Example"]
    page["右侧文档页面"]

    sidebar --> page

    subgraph doc["页面主体"]
        direction TB
        hero["Hero Section\n标题 + 导语"]
        summary["Summary Row\n左右两块内容"]
        flow["Flow Section\n说明 + Mermaid 占位"]
        layout["Layout Proof\n左右布局证明"]
        rebuild["Rebuild Steps\n重建步骤列表"]
    end

    page --> doc
```

**怎么看这张图：** 这个页面是一个正式的 Workspace 条目。打开后，右侧不是表单，而是一个“像文档一样”的页面，分成多个 section。

---

## 二、模型关系：谁负责结构，谁负责内容

```mermaid
graph TD
    M0["Model 0\n系统根模型"]
    M1013["Model 1013\nDoc Page App Host"]
    M1014["Model 1014\nDoc Page Truth"]
    WS["Workspace 侧边栏"]

    M0 -->|"model.submt"| M1013
    M1013 -->|"model.submt (0,2,0)"| M1014
    WS -. "注册 app 条目" .-> M1013

    subgraph host["1013 负责"]
      h1["Section / Paragraph / Callout / List 等节点结构"]
      h2["ui_parent / ui_order / ui_layout"]
      h3["页面布局与显示顺序"]
    end

    subgraph truth["1014 负责"]
      t1["doc_title / hero_heading / hero_intro"]
      t2["summary_left_text / summary_right_text"]
      t3["flow_section_text / rebuild_step_*"]
    end
```

**怎么看这张图：**

- `1013` 是页面的壳：决定有哪些节点、谁是谁的父节点、顺序怎样排、哪些地方横排或竖排。
- `1014` 是内容真值：决定标题写什么、段落写什么、步骤写什么。

---

## 三、页面组成：每一块都来自填表

```mermaid
graph LR
    A["(2,2,0)\nSection hero"] --> B["(2,3,0)\nHeading"]
    A --> C["(2,4,0)\nParagraph"]

    D["(2,5,0)\nContainer summary row"] --> E["(2,6,0)\nSection left"]
    D --> F["(2,8,0)\nSection right"]
    E --> G["(2,7,0)\nParagraph"]
    F --> H["(2,9,0)\nParagraph"]

    I["(2,10,0)\nSection flow"] --> J["(2,11,0)\nParagraph"]
    I --> K["(2,12,0)\nMermaidDiagram"]

    L["(2,13,0)\nSection layout proof"] --> M["(2,14,0)\nContainer row"]
    M --> N["(2,15,0)\nCallout left"]
    M --> O["(2,16,0)\nCallout right"]

    P["(2,17,0)\nSection rebuild"] --> Q["(2,18,0)\nList"]
    Q --> R["(2,19,0)\nListItem 1"]
    Q --> S["(2,20,0)\nListItem 2"]
    Q --> T["(2,21,0)\nListItem 3"]
```

**怎么看这张图：** 这张图直接对应 `Model 1013` 里的 cell。一个节点一个 cell，不是整块页面一次性塞进去。

---

## 四、布局是怎么由 label 决定的

最关键的例子是：

- `Model 1013 / (2,14,0) / ui_layout`

默认值是：

```text
row
```

这会让“左侧块 / 右侧块”横向排列。

如果改成：

```text
column
```

页面就会变成上下排列。

```mermaid
graph LR
    rowLabel["ui_layout = row"] --> rowView["左块 | 右块"]
    colLabel["ui_layout = column"] --> colView["左块\n右块"]
```

**怎么看这张图：** 同一个页面节点，不换组件，只改一个 label，布局方向就变了。

---

## 五、内容是怎么由 label 决定的

这些内容主要来自 `Model 1014 / (0,0,0)`：

```mermaid
graph TD
    title["doc_title"] --> hero["Hero Section 标题栏"]
    heading["hero_heading"] --> heroH["Heading 节点"]
    intro["hero_intro"] --> heroP["Paragraph 节点"]
    leftText["summary_left_text"] --> leftP["左侧 Paragraph"]
    rightText["summary_right_text"] --> rightP["右侧 Paragraph"]
    flowText["flow_section_text"] --> flowP["Flow Paragraph"]
    steps["rebuild_step_1/2/3"] --> list["Rebuild ListItem"]
```

**怎么看这张图：** 这页不是把长文直接塞进 host model。多数正文内容都放在 truth model，再通过绑定投射到页面节点上。

---

## 六、最短重建思路

```mermaid
flowchart TD
    S["开始"] --> A["创建 Model 1014\n填写内容 labels"]
    A --> B["创建 Model 1013\n填写节点结构 labels"]
    B --> C["在 1013 上挂 1014"]
    C --> D["在 Model 0 下挂 1013"]
    D --> E["写入 Workspace registry"]
    E --> F["刷新页面并打开"]
```

**怎么看这张图：** 顺序不能反。先有 truth 内容，再有 host 结构，再有挂载与侧边栏入口。

---

## 七、你现在应该关注什么

1. 这页已经不是旧的三组件示例，而是正式的文档型页面样例。
2. 结构在 `1013`，内容在 `1014`。
3. `ui_layout / ui_order / ui_parent` 决定“摆在哪里”。
4. `doc_title / hero_intro / rebuild_step_*` 决定“写什么”。

---

## 八、最短验证步骤

1. 打开 Workspace。
2. 找到 `0276 Doc Page Workspace Example`。
3. 点击 `Open`，确认右侧出现文档页面。
4. 去 Home，选择 `Model 1014`，修改 `doc_title` 或 `hero_heading`。
5. 回 Workspace，确认标题或文案变化。
6. 再去 Home，修改 `Model 1013 / (2,14,0) / ui_layout`。
7. 回 Workspace，确认“左侧块 / 右侧块”从横排变成竖排，或反过来。
