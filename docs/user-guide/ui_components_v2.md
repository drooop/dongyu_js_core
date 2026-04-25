---
title: "UI 模型填表开发者指南 (cellwise.ui.v1)"
doc_type: user-guide
status: active
updated: 2026-04-25
source: ai
---

# UI 模型填表开发者指南 (cellwise.ui.v1)

本文档面向编写 slide app / Workspace app 的开发者，说明如何用 ModelTable 填表方式定义 UI：页面长什么样、节点怎么排版、文字和样式从哪里来、按钮点击后如何触发程序模型。

当前推荐方式是 `cellwise.ui.v1`。它的核心原则是：UI 不是一整段 HTML 字符串，也不是一个塞满整页 JSON 的大字段；每个可见组件都应该拆成一个 ModelTable cell，用 label 描述这个组件的类型、属性、父子关系和事件连接。

## 1. 先看一个最小页面

下面这个模型会在 Workspace 中显示一个 slide app，页面里只有一行标题。

### 1.1 填表内容

| cell | k | t | v | 说明 |
|---|---|---|---|---|
| `0,0,0` | `model_type` | `model.table` | `slide_hello` | 模型表用途标识 |
| `0,0,0` | `app_name` | `str` | `Hello UI` | Workspace 中显示的 app 名称 |
| `0,0,0` | `slide_capable` | `bool` | `true` | 声明这是可挂载的 slide app |
| `0,0,0` | `slide_surface_type` | `str` | `flow.shell` | 使用当前 slide shell 渲染 |
| `0,0,0` | `ui_authoring_version` | `str` | `cellwise.ui.v1` | 启用填表式 UI 投影 |
| `0,0,0` | `ui_root_node_id` | `str` | `root` | 指定页面根节点 |
| `2,0,0` | `ui_node_id` | `str` | `root` | 根组件 id |
| `2,0,0` | `ui_component` | `str` | `Container` | 根组件是容器 |
| `2,0,0` | `ui_layout` | `str` | `column` | 子组件纵向排列 |
| `2,0,0` | `ui_gap` | `int` | `12` | 子组件间距为 12px |
| `2,1,0` | `ui_node_id` | `str` | `title` | 标题节点 id |
| `2,1,0` | `ui_component` | `str` | `Text` | 标题组件类型 |
| `2,1,0` | `ui_parent` | `str` | `root` | 标题放进根容器 |
| `2,1,0` | `ui_order` | `int` | `10` | 在 root 子节点中排第一个 |
| `2,1,0` | `ui_text` | `str` | `Hello UI` | 页面上显示的文字 |
| `2,1,0` | `ui_variant` | `str` | `title` | 标题样式 |

### 1.2 同样内容的外部补丁形态

实际导入或迁移时常见的是 records 数组。每条 record 都是一条 label，外部补丁通常用 `model_id` 指定写入哪个模型；业务 pin payload 的临时模型表则使用 `id`，见第 7 节。

```json
{
  "records": [
    { "model_id": 1200, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "slide_hello" },
    { "model_id": 1200, "p": 0, "r": 0, "c": 0, "k": "app_name", "t": "str", "v": "Hello UI" },
    { "model_id": 1200, "p": 0, "r": 0, "c": 0, "k": "slide_capable", "t": "bool", "v": true },
    { "model_id": 1200, "p": 0, "r": 0, "c": 0, "k": "slide_surface_type", "t": "str", "v": "flow.shell" },
    { "model_id": 1200, "p": 0, "r": 0, "c": 0, "k": "ui_authoring_version", "t": "str", "v": "cellwise.ui.v1" },
    { "model_id": 1200, "p": 0, "r": 0, "c": 0, "k": "ui_root_node_id", "t": "str", "v": "root" },
    { "model_id": 1200, "p": 2, "r": 0, "c": 0, "k": "ui_node_id", "t": "str", "v": "root" },
    { "model_id": 1200, "p": 2, "r": 0, "c": 0, "k": "ui_component", "t": "str", "v": "Container" },
    { "model_id": 1200, "p": 2, "r": 0, "c": 0, "k": "ui_layout", "t": "str", "v": "column" },
    { "model_id": 1200, "p": 2, "r": 0, "c": 0, "k": "ui_gap", "t": "int", "v": 12 },
    { "model_id": 1200, "p": 2, "r": 1, "c": 0, "k": "ui_node_id", "t": "str", "v": "title" },
    { "model_id": 1200, "p": 2, "r": 1, "c": 0, "k": "ui_component", "t": "str", "v": "Text" },
    { "model_id": 1200, "p": 2, "r": 1, "c": 0, "k": "ui_parent", "t": "str", "v": "root" },
    { "model_id": 1200, "p": 2, "r": 1, "c": 0, "k": "ui_order", "t": "int", "v": 10 },
    { "model_id": 1200, "p": 2, "r": 1, "c": 0, "k": "ui_text", "t": "str", "v": "Hello UI" },
    { "model_id": 1200, "p": 2, "r": 1, "c": 0, "k": "ui_variant", "t": "str", "v": "title" }
  ]
}
```

如果把 `2,1,0 / ui_text` 的值改成 `我的第一个 UI 模型`，页面标题就应该跟着变。这个例子体现了最重要的规则：界面文字不是写死在前端代码里，而是来自 ModelTable label。

## 2. UI 模型的基本心智模型

`cellwise.ui.v1` 会把一个正数模型投影成前端 AST，再由 renderer 渲染成页面。

| 概念 | 填表位置 | 作用 |
|---|---|---|
| app 元信息 | 通常在 `0,0,0` | 让 Workspace 知道这是一个可展示 app |
| UI 开关 | `0,0,0 / ui_authoring_version` | 值必须是 `cellwise.ui.v1` |
| 根节点 | `0,0,0 / ui_root_node_id` | 指向某个 `ui_node_id` |
| UI 节点 | 任意 cell | 一个 cell 代表一个组件 |
| 组件类型 | 节点 cell 的 `ui_component` | 决定渲染成 Text、Button、Input 等 |
| 视觉包含关系 | 节点 cell 的 `ui_parent` | 决定这个组件放进哪个容器 |
| 展示属性 | 节点 cell 的 `ui_text`、`ui_label` 等 | 决定组件显示内容与样式 |
| 数据绑定 | 节点 cell 的 `ui_bind_*` | 决定组件从哪个 label 读取/写入 |
| 事件连接 | 节点 cell 的 `ui_bind_json.write` | 决定按钮或输入变化触发哪个 pin/action |

推荐把 UI 节点放在 `p=2` 区域，把可执行按钮或程序入口放在自己的执行 cell 上。这个分区不是唯一要求，但能让模型更容易读：`0,0,0` 放模型级状态，`p=2` 放视觉节点，程序模型或 pin 入口放在语义上对应的 cell。

## 3. 必填 label

一个 UI 模型至少需要两类 label：模型级 label 和节点级 label。

### 3.1 模型级 label

| k | t | 必填 | 示例 | 含义 |
|---|---|---|---|---|
| `app_name` | `str` | 推荐 | `E2E 颜色生成器` | Workspace 中显示的名称，也常作为页面标题来源 |
| `slide_capable` | `bool` | 是 | `true` | 声明该模型可作为 slide app 挂载 |
| `slide_surface_type` | `str` | 推荐 | `flow.shell` | 当前 slide shell 类型 |
| `ui_authoring_version` | `str` | 是 | `cellwise.ui.v1` | 使用填表式 UI 投影 |
| `ui_root_node_id` | `str` | 是 | `root` | 页面根节点的 `ui_node_id` |

### 3.2 节点级 label

| k | t | 必填 | 示例 | 含义 |
|---|---|---|---|---|
| `ui_node_id` | `str` | 是 | `submit_button` | 稳定节点 id，供父子关系引用 |
| `ui_component` | `str` | 是 | `Button` | 组件类型 |
| `ui_parent` | `str` | 根节点可省略 | `input_row` | 父节点的 `ui_node_id` |
| `ui_order` | `int` | 推荐 | `20` | 同一父节点下的 sibling order |
| `ui_slot` | `str` | 可选 | `header` | named region；只表达区域名，不替代父子关系 |

`ui_node_id` 应该稳定。不要用坐标当作节点 id，因为后续重排 cell 时坐标可能变化，但组件身份最好不变。

## 4. cellwise.ui.v1 containment

`cellwise.ui.v1 containment` 是当前 UI 填表的组合规则。

| label | 规则 |
|---|---|
| `ui_parent` | 表达 visual containment，也就是这个组件在画面上被哪个父组件包含 |
| `ui_order` | 表达 sibling order，也就是同一个父组件下的排列顺序 |
| `ui_layout` | 写在父 `Container` 上，表达 container child layout |
| `ui_slot` | 表达 named region，例如 `header`、`main`、`footer` |
| `model.submt` | 只保留给 independent child model，不用于普通行列排版 |

普通页面布局不要用 `model.submt`。例如“第一行三个按钮、第二行第一列两个输入框”这种视觉结构，应该用 `Container + ui_parent + ui_order + ui_layout` 表达；只有当你真的要挂一个独立子模型或子 app 时，才使用 `model.submt`。

### 4.1 one row with three buttons

目标：一行里放三个按钮。

| cell | k | t | v |
|---|---|---|---|
| `2,1,0` | `ui_node_id` | `str` | `button_row` |
| `2,1,0` | `ui_component` | `str` | `Container` |
| `2,1,0` | `ui_parent` | `str` | `root` |
| `2,1,0` | `ui_order` | `int` | `10` |
| `2,1,0` | `ui_layout` | `str` | `row` |
| `2,1,0` | `ui_gap` | `int` | `8` |
| `2,1,1` | `ui_node_id` | `str` | `button_a` |
| `2,1,1` | `ui_component` | `str` | `Button` |
| `2,1,1` | `ui_parent` | `str` | `button_row` |
| `2,1,1` | `ui_order` | `int` | `10` |
| `2,1,1` | `ui_label` | `str` | `保存` |
| `2,1,2` | `ui_node_id` | `str` | `button_b` |
| `2,1,2` | `ui_component` | `str` | `Button` |
| `2,1,2` | `ui_parent` | `str` | `button_row` |
| `2,1,2` | `ui_order` | `int` | `20` |
| `2,1,2` | `ui_label` | `str` | `预览` |
| `2,1,3` | `ui_node_id` | `str` | `button_c` |
| `2,1,3` | `ui_component` | `str` | `Button` |
| `2,1,3` | `ui_parent` | `str` | `button_row` |
| `2,1,3` | `ui_order` | `int` | `30` |
| `2,1,3` | `ui_label` | `str` | `发布` |

要再加第四个按钮，只需要新增一个 `Button` cell，`ui_parent = button_row`，并给一个更大的 `ui_order`。

### 4.2 nested input column

目标：第二行左侧有两个输入框，右侧有一个按钮。

| cell | k | t | v |
|---|---|---|---|
| `2,2,0` | `ui_node_id` | `str` | `form_row` |
| `2,2,0` | `ui_component` | `str` | `Container` |
| `2,2,0` | `ui_parent` | `str` | `root` |
| `2,2,0` | `ui_order` | `int` | `20` |
| `2,2,0` | `ui_layout` | `str` | `row` |
| `2,2,0` | `ui_gap` | `int` | `12` |
| `2,2,1` | `ui_node_id` | `str` | `input_column` |
| `2,2,1` | `ui_component` | `str` | `Container` |
| `2,2,1` | `ui_parent` | `str` | `form_row` |
| `2,2,1` | `ui_order` | `int` | `10` |
| `2,2,1` | `ui_layout` | `str` | `column` |
| `2,2,1` | `ui_gap` | `int` | `6` |
| `2,2,2` | `ui_node_id` | `str` | `name_input` |
| `2,2,2` | `ui_component` | `str` | `Input` |
| `2,2,2` | `ui_parent` | `str` | `input_column` |
| `2,2,2` | `ui_order` | `int` | `10` |
| `2,2,2` | `ui_label` | `str` | `名称` |
| `2,2,2` | `ui_placeholder` | `str` | `输入名称` |
| `2,2,3` | `ui_node_id` | `str` | `desc_input` |
| `2,2,3` | `ui_component` | `str` | `Input` |
| `2,2,3` | `ui_parent` | `str` | `input_column` |
| `2,2,3` | `ui_order` | `int` | `20` |
| `2,2,3` | `ui_label` | `str` | `描述` |
| `2,2,3` | `ui_placeholder` | `str` | `输入描述` |
| `2,2,4` | `ui_node_id` | `str` | `submit_button` |
| `2,2,4` | `ui_component` | `str` | `Button` |
| `2,2,4` | `ui_parent` | `str` | `form_row` |
| `2,2,4` | `ui_order` | `int` | `20` |
| `2,2,4` | `ui_label` | `str` | `提交` |

这里的“嵌套”是普通 UI 节点之间的视觉包含关系，不是子模型关系。`input_column` 只是一个容器节点。

## 5. 常用组件与 label

当前 renderer 注册的组件很多，普通 slide app 最常用的是 `Container`、`Text`、`Input`、`Button`、`ColorBox`、`StatusBadge`、`StatCard`、`Terminal`、`FileInput`、`Table`、`Form`、`Card`。复杂文档页还可以用 `Heading`、`Paragraph`、`List`、`Callout`、`Image`、`MermaidDiagram`、`Section`。

### 5.1 通用属性 label

这些 label 会被投影成组件 props 或样式。

| label | t | 投影到 | 适用场景 |
|---|---|---|---|
| `ui_text` | `str` | `props.text` | `Text`、`Paragraph`、`Checkbox` 等显示文字 |
| `ui_title` | `str` | `props.title` | `Card`、`Terminal` 等标题 |
| `ui_label` | `str` | `props.label` | `Button`、`Input`、`StatusBadge`、`StatCard` |
| `ui_variant` | `str` | `props.type` | 按钮类型、文字类型或状态类型 |
| `ui_placeholder` | `str` | `props.placeholder` | `Input` |
| `ui_button_label` | `str` | `props.buttonLabel` | 上传或复合组件按钮文字 |
| `ui_empty_text` | `str` | `props.emptyText` | 空状态文字 |
| `ui_width` | `str` | `props.width` | 宽度，如 `120px`、`100%` |
| `ui_height` | `int` | `props.height` | 高度，数字会按 px 处理 |
| `ui_min_width` | `str` | `props.minWidth` | 最小宽度 |
| `ui_max_width` | `str` | `props.maxWidth` | 最大宽度 |
| `ui_heading_level` | `int` | `props.level` | `Heading` 等标题级别 |
| `ui_section_number` | `int` | `props.sectionNumber` | 文档分节 |
| `ui_options_json` | `json` | `props.options` | `Select`、`RadioGroup` 等选项 |
| `ui_props_json` | `json` | 合并进 `props` | 少量补充属性 |

`ui_props_json` 是补充能力，不是把整页塞成 JSON 的入口。推荐优先使用明确 label；只有当前没有单独 label 的小属性，才放进 `ui_props_json`。

### 5.2 样式 label

样式 label 会进入 `props.style`。

| label | 示例 | 说明 |
|---|---|---|
| `ui_style_width` | `100%` | CSS width |
| `ui_style_min_width` | `240px` | CSS min-width |
| `ui_style_max_width` | `680px` | CSS max-width |
| `ui_style_padding` | `16px` | CSS padding |
| `ui_style_margin` | `0 auto` | CSS margin |
| `ui_style_align_items` | `center` | CSS align-items |
| `ui_style_justify_content` | `space-between` | CSS justify-content |
| `ui_style_background_color` | `#F8FAFC` | CSS background-color |
| `ui_style_color` | `#0F172A` | CSS color |
| `ui_style_font_size` | `20px` | CSS font-size |
| `ui_style_font_family` | `monospace` | CSS font-family |
| `ui_style_font_weight` | `700` | CSS font-weight |
| `ui_style_flex` | `1` | CSS flex |
| `ui_style_flex_direction` | `row` | CSS flex-direction |
| `ui_style_text_align` | `center` | CSS text-align |

### 5.3 Container

`Container` 用来组合其他组件，是最常用的布局节点。

| label | t | 示例 | 说明 |
|---|---|---|---|
| `ui_layout` | `str` | `row` / `column` | 子节点横排或竖排 |
| `ui_gap` | `int` | `12` | 子节点间距 |
| `ui_wrap` | `bool` | `true` | 横向空间不足时是否换行 |
| `ui_style_align_items` | `str` | `center` | 交叉轴对齐 |
| `ui_style_justify_content` | `str` | `space-between` | 主轴对齐 |

目前 `row`、`row-reverse`、`column-reverse` 会按对应方向展示；其他值默认按 `column` 展示。为了可预期，普通页面建议只使用 `row` 和 `column`。

### 5.4 Text

`Text` 用来显示文字。文字可以来自 `ui_text`，也可以通过读绑定来自另一个 label。

| label | t | 示例 | 说明 |
|---|---|---|---|
| `ui_text` | `str` | `E2E 颜色生成器` | 静态文字 |
| `ui_variant` | `str` | `title` / `info` | 文字类型 |
| `ui_size` | `str` | `xl` | 字号预设 |
| `ui_style_font_size` | `str` | `20px` | 明确字号 |
| `ui_style_font_weight` | `str` | `700` | 字重 |
| `ui_style_color` | `str` | `#64748B` | 文字颜色 |

示例：把标题文字改掉。

| cell | k | t | v |
|---|---|---|---|
| `2,1,0` | `ui_text` | `str` | `新的标题` |

### 5.5 Input

`Input` 用于输入文本。常见用法是读写一个草稿 label。

| label | t | 示例 | 说明 |
|---|---|---|---|
| `ui_label` | `str` | `输入文本` | 输入框标签 |
| `ui_placeholder` | `str` | `Enter any text` | 占位文字 |
| `ui_bind_json.read` | `json` | label ref | 从哪里读取当前值 |
| `ui_bind_json.write` | `json` | action 或 pin | 输入变化后写到哪里 |

输入框常用 `commit_policy`：

| commit_policy | 说明 |
|---|---|
| `on_change` | 输入变化时提交 |
| `on_blur` | 失焦时提交 |
| `on_submit` | 和提交动作配合，先在前端保留草稿 |
| `immediate` | 立即提交 |

### 5.6 Button

`Button` 用来触发动作或 pin。

| label | t | 示例 | 说明 |
|---|---|---|---|
| `ui_label` | `str` | `Generate Color` | 按钮文字 |
| `ui_variant` | `str` | `primary` | 按钮类型，会投影到 `type` |
| `ui_props_json` | `json` | `{ "size": "large" }` | 额外按钮属性 |
| `ui_bind_json.write` | `json` | `{ "pin": "click", ... }` | 点击后触发的写入 |

如果 `Button` 的 write binding 使用 `pin`，渲染层会把点击事件写入 Model 0 mailbox，并生成一个 pin event。按钮本身不应该直接改业务结果；结果应由程序模型处理后再写回 ModelTable。

### 5.7 ColorBox

`ColorBox` 用于展示颜色块。它通常通过读绑定读取一个颜色 label。

| label | t | 示例 | 说明 |
|---|---|---|---|
| `ui_width` | `str` | `120px` | 色块宽度 |
| `ui_height` | `int` | `80` | 色块高度 |
| `ui_props_json.borderRadius` | `json` | `12px` | 圆角 |
| `ui_bind_read_json` | `json` | label ref | 读取颜色值 |

示例：

```json
{
  "model_id": 100,
  "p": 2,
  "r": 3,
  "c": 1,
  "labels": {
    "ui_node_id": { "t": "str", "v": "color_box" },
    "ui_component": { "t": "str", "v": "ColorBox" },
    "ui_parent": { "t": "str", "v": "color_row" },
    "ui_order": { "t": "int", "v": 10 },
    "ui_width": { "t": "str", "v": "120px" },
    "ui_height": { "t": "int", "v": 80 },
    "ui_props_json": { "t": "json", "v": { "borderRadius": "12px" } },
    "ui_bind_read_json": { "t": "json", "v": { "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "bg_color" } }
  }
}
```

当 `100 / 0,0,0 / bg_color` 从 `#FFFFFF` 变成 `#C12ABE` 时，这个色块应该变成对应颜色。

### 5.8 StatusBadge、StatCard、Terminal

这三个组件适合做状态、指标和日志展示。

| 组件 | 常用 label | 用途 |
|---|---|---|
| `StatusBadge` | `ui_label`、`ui_bind_read_json` | 显示 ready / pending / error 等状态 |
| `StatCard` | `ui_label`、`ui_props_json.unit`、`ui_bind_read_json` | 显示数字指标 |
| `Terminal` | `ui_title`、`ui_bind_read_json`、`ui_props_json.maxHeight` | 显示多行日志 |

## 6. 数据读取：把 label 显示到组件上

如果组件内容来自模型状态，而不是写死文本，使用 read binding。

### 6.1 推荐写法：`ui_bind_read_json`

| cell | k | t | v |
|---|---|---|---|
| `2,3,4` | `ui_node_id` | `str` | `color_value` |
| `2,3,4` | `ui_component` | `str` | `Text` |
| `2,3,4` | `ui_bind_read_json` | `json` | `{ "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "bg_color" }` |

这表示 `Text` 显示 `Model 100 / 0,0,0 / bg_color` 的当前值。对应 label 如果是 `#1C41C9`，页面显示也应该是 `#1C41C9`。

### 6.2 合并写法：`ui_bind_json.read`

如果同一个组件还需要 write binding，可以写成：

```json
{
  "read": { "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "input_draft" },
  "write": {
    "action": "label_update",
    "target_ref": { "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "input_draft" },
    "commit_policy": "on_blur"
  }
}
```

### 6.3 拆字段写法：`ui_read_*`

不方便写 JSON 时，可以拆成多个 label：

| k | t | v |
|---|---|---|
| `ui_read_model_id` | `int` | `100` |
| `ui_read_p` | `int` | `0` |
| `ui_read_r` | `int` | `0` |
| `ui_read_c` | `int` | `0` |
| `ui_read_k` | `str` | `bg_color` |

这和 `ui_bind_read_json` 表达同一个读取目标。

## 7. 事件写入：让 UI 触发程序模型

UI 的点击、输入变化等行为最终应写入 ModelTable，而不是走任意 JSON 对象。当前主线里，按钮触发程序模型的推荐方式是 pin write binding。

### 7.1 Button 触发 pin

下面是一个按钮点击触发 `click` pin 的例子。

```json
{
  "write": {
    "pin": "click",
    "value_t": "modeltable",
    "value_ref": [
      { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "ui_event.v1" },
      { "id": 0, "p": 0, "r": 0, "c": 0, "k": "input_value", "t": "str", "v": { "$label": { "model_id": -2, "p": 0, "r": 0, "c": 0, "k": "model100_input_draft" } } }
    ],
    "commit_policy": "immediate"
  }
}
```

含义如下：

| 字段 | 说明 |
|---|---|
| `pin` | 要触发的输入 pin 名称 |
| `value_t` | payload 类型；当前事件链路应使用 `modeltable` |
| `value_ref` | 发送给程序模型的临时 ModelTable records |
| `__mt_payload_kind` | 内置说明字段，用来标记 payload 语义 |
| `input_value` | 用户业务字段，程序模型可以读取它 |
| `$label` | 发送时从指定 label 取当前值 |
| `commit_policy` | 这个触发动作何时提交 |

渲染层会把这次点击包装成 mailbox event；后续由运行时、MBR、remote worker 或本地程序模型处理。开发者只需要保证 pin payload 是 ModelTable records，不要传任意散乱对象。

### 7.2 action 写入 label

某些编辑器类 UI 可以直接写 label，例如输入框维护草稿：

```json
{
  "read": { "model_id": -2, "p": 0, "r": 0, "c": 0, "k": "draft_text" },
  "write": {
    "action": "label_update",
    "target_ref": { "model_id": -2, "p": 0, "r": 0, "c": 0, "k": "draft_text" },
    "commit_policy": "on_blur"
  }
}
```

这种方式适合 UI 草稿态、编辑器状态和局部输入态。业务结果仍建议由程序模型写回正数模型。

## 8. 完整例子：E2E 颜色生成器

这个例子展示一个实际 slide app 的核心结构：标题、颜色块、颜色值、输入框、生成按钮、状态徽章。

### 8.1 模型级状态

| cell | k | t | v | 说明 |
|---|---|---|---|---|
| `0,0,0` | `app_name` | `str` | `E2E 颜色生成器` | Workspace 显示名称 |
| `0,0,0` | `bg_color` | `str` | `#FFFFFF` | 当前颜色 |
| `0,0,0` | `status` | `str` | `ready` | 当前状态 |
| `0,0,0` | `submit_inflight` | `bool` | `false` | 是否正在生成 |
| `0,0,0` | `slide_capable` | `bool` | `true` | 可作为 slide app |
| `0,0,0` | `slide_surface_type` | `str` | `flow.shell` | slide shell |
| `0,0,0` | `ui_authoring_version` | `str` | `cellwise.ui.v1` | 填表式 UI |
| `0,0,0` | `ui_root_node_id` | `str` | `color_root` | 根节点 |

### 8.2 页面结构

| cell | 节点 | 组件 | 父节点 | 顺序 | 关键 label |
|---|---|---|---|---|---|
| `2,0,0` | `color_root` | `Container` | - | - | `ui_layout=column`, `ui_gap=12` |
| `2,1,0` | `title` | `Text` | `color_root` | `10` | `ui_text=E2E 颜色生成器` |
| `2,2,0` | `color_row` | `Container` | `color_root` | `20` | `ui_layout=row`, `ui_gap=16` |
| `2,2,1` | `color_box` | `ColorBox` | `color_row` | `10` | read `bg_color` |
| `2,2,2` | `color_value` | `Text` | `color_row` | `20` | read `bg_color` |
| `2,3,0` | `input_row` | `Container` | `color_root` | `30` | `ui_layout=row` |
| `2,3,1` | `prompt_input` | `Input` | `input_row` | `10` | read/write draft |
| `1,0,0` | `submit_button` | `Button` | `input_row` | `20` | `ui_label=Generate Color`, write pin |
| `2,4,0` | `status_row` | `Container` | `color_root` | `40` | `ui_layout=row`, `ui_wrap=true` |
| `2,4,1` | `status_badge` | `StatusBadge` | `status_row` | `10` | read `status` |

### 8.3 关键节点 records

```json
[
  { "model_id": 100, "p": 2, "r": 0, "c": 0, "k": "ui_node_id", "t": "str", "v": "color_root" },
  { "model_id": 100, "p": 2, "r": 0, "c": 0, "k": "ui_component", "t": "str", "v": "Container" },
  { "model_id": 100, "p": 2, "r": 0, "c": 0, "k": "ui_layout", "t": "str", "v": "column" },
  { "model_id": 100, "p": 2, "r": 0, "c": 0, "k": "ui_gap", "t": "int", "v": 12 },

  { "model_id": 100, "p": 2, "r": 1, "c": 0, "k": "ui_node_id", "t": "str", "v": "title" },
  { "model_id": 100, "p": 2, "r": 1, "c": 0, "k": "ui_component", "t": "str", "v": "Text" },
  { "model_id": 100, "p": 2, "r": 1, "c": 0, "k": "ui_parent", "t": "str", "v": "color_root" },
  { "model_id": 100, "p": 2, "r": 1, "c": 0, "k": "ui_order", "t": "int", "v": 10 },
  { "model_id": 100, "p": 2, "r": 1, "c": 0, "k": "ui_text", "t": "str", "v": "E2E 颜色生成器" },
  { "model_id": 100, "p": 2, "r": 1, "c": 0, "k": "ui_style_font_size", "t": "str", "v": "20px" },
  { "model_id": 100, "p": 2, "r": 1, "c": 0, "k": "ui_style_font_weight", "t": "str", "v": "700" },

  { "model_id": 100, "p": 2, "r": 2, "c": 0, "k": "ui_node_id", "t": "str", "v": "color_row" },
  { "model_id": 100, "p": 2, "r": 2, "c": 0, "k": "ui_component", "t": "str", "v": "Container" },
  { "model_id": 100, "p": 2, "r": 2, "c": 0, "k": "ui_parent", "t": "str", "v": "color_root" },
  { "model_id": 100, "p": 2, "r": 2, "c": 0, "k": "ui_order", "t": "int", "v": 20 },
  { "model_id": 100, "p": 2, "r": 2, "c": 0, "k": "ui_layout", "t": "str", "v": "row" },

  { "model_id": 100, "p": 2, "r": 2, "c": 1, "k": "ui_node_id", "t": "str", "v": "color_box" },
  { "model_id": 100, "p": 2, "r": 2, "c": 1, "k": "ui_component", "t": "str", "v": "ColorBox" },
  { "model_id": 100, "p": 2, "r": 2, "c": 1, "k": "ui_parent", "t": "str", "v": "color_row" },
  { "model_id": 100, "p": 2, "r": 2, "c": 1, "k": "ui_order", "t": "int", "v": 10 },
  { "model_id": 100, "p": 2, "r": 2, "c": 1, "k": "ui_width", "t": "str", "v": "120px" },
  { "model_id": 100, "p": 2, "r": 2, "c": 1, "k": "ui_height", "t": "int", "v": 80 },
  { "model_id": 100, "p": 2, "r": 2, "c": 1, "k": "ui_bind_read_json", "t": "json", "v": { "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "bg_color" } },

  { "model_id": 100, "p": 2, "r": 2, "c": 2, "k": "ui_node_id", "t": "str", "v": "color_value" },
  { "model_id": 100, "p": 2, "r": 2, "c": 2, "k": "ui_component", "t": "str", "v": "Text" },
  { "model_id": 100, "p": 2, "r": 2, "c": 2, "k": "ui_parent", "t": "str", "v": "color_row" },
  { "model_id": 100, "p": 2, "r": 2, "c": 2, "k": "ui_order", "t": "int", "v": 20 },
  { "model_id": 100, "p": 2, "r": 2, "c": 2, "k": "ui_bind_read_json", "t": "json", "v": { "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "bg_color" } }
]
```

### 8.4 点击 Generate Color 后发生什么

1. 用户点击 `submit_button`。
2. `ui_bind_json.write.pin = click` 被触发。
3. UI 把 `value_ref` 解析成 ModelTable payload，并写入 mailbox。
4. 程序模型读取 payload 中的 `input_value`。
5. 程序模型写回 `bg_color`、`status`、`submit_inflight`。
6. `ColorBox` 和 `Text` 通过 read binding 读到新 label，页面颜色和值一起变化。

这条链路里，前端只负责把 UI 事件按规则送出去，以及把模型状态投影回来。颜色如何生成、何时完成、失败怎么记录，都应该由程序模型和运行时链路处理。

## 9. 修改 UI 的常见操作

### 9.1 改页面标题

改这个 label：

| cell | k | t | old | new |
|---|---|---|---|---|
| `2,1,0` | `ui_text` | `str` | `E2E 颜色生成器` | `我的颜色实验室` |

如果标题同时想影响 Workspace 侧边栏名称，也要改 `0,0,0 / app_name`。

### 9.2 新增一行

新增一个 `Container`，父节点指向 root：

| cell | k | t | v |
|---|---|---|---|
| `2,6,0` | `ui_node_id` | `str` | `extra_row` |
| `2,6,0` | `ui_component` | `str` | `Container` |
| `2,6,0` | `ui_parent` | `str` | `color_root` |
| `2,6,0` | `ui_order` | `int` | `60` |
| `2,6,0` | `ui_layout` | `str` | `row` |
| `2,6,0` | `ui_gap` | `int` | `8` |

然后把新组件的 `ui_parent` 指向 `extra_row`。

### 9.3 把横排改成竖排

改父容器的 `ui_layout`：

| cell | k | t | old | new |
|---|---|---|---|---|
| `2,2,0` | `ui_layout` | `str` | `row` | `column` |

注意：改的是父 `Container`，不是每个子组件。

### 9.4 控制按钮 loading / disabled

可以让按钮属性读取 `submit_inflight`：

```json
{
  "type": "primary",
  "loading": { "$label": { "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "submit_inflight" } },
  "disabled": { "$label": { "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "submit_inflight" } },
  "singleFlight": {
    "key": "model100_generate",
    "releaseRef": { "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "submit_inflight" },
    "releaseWhen": false
  }
}
```

这段可以放进按钮 cell 的 `ui_props_json`。含义是：生成过程中按钮显示 loading 并禁用；当 `submit_inflight` 回到 `false` 时释放。

## 10. 常见错误

| 错误 | 结果 | 正确做法 |
|---|---|---|
| 只用一个大 `ui_props_json` 描述整页 | 页面不可拆、不可复用、难以单点修改 | 每个组件一个 cell |
| 把普通行列布局写成 `model.submt` | 子模型边界被误用，后续组合会变复杂 | 普通布局用 `Container + ui_parent` |
| 子组件没有 `ui_parent` | 可能被默认挂到 root，导致位置错误 | 明确写父节点 id |
| 同级节点不写 `ui_order` | 顺序依赖默认值和 id，容易不稳定 | 按 10、20、30 留间隔 |
| `ui_parent` 写坐标 | 找不到父节点 | 写父节点的 `ui_node_id` |
| Button 直接改业务结果 label | 绕过程序模型，链路不可审计 | Button 触发 pin，由程序模型写结果 |
| pin payload 传任意对象 | MBR/worker 链路无法按合同处理 | 使用 ModelTable records |
| 把 display text 写死在前端 | 填表无法改 UI | 用 `ui_text`、`ui_label` 或 read binding |

## 11. 开发者检查清单

交付一个 UI 模型前，至少检查这些点：

| 检查项 | 通过标准 |
|---|---|
| Workspace 可发现 | `app_name`、`slide_capable=true`、`slide_surface_type` 已填写 |
| UI 投影开启 | `ui_authoring_version=cellwise.ui.v1` |
| root 可找到 | `ui_root_node_id` 指向一个存在的 `ui_node_id` |
| 页面可拆分 | 主要组件都有自己的 cell，不是一坨 HTML 或大 JSON |
| 父子关系清楚 | 每个非 root 节点有正确 `ui_parent` |
| 排序稳定 | 同级节点有 `ui_order` |
| 布局写在父容器 | 行列排布由父 `Container / ui_layout` 控制 |
| 读绑定明确 | 动态展示值有 `ui_bind_read_json` 或 `ui_bind_json.read` |
| 写绑定可审计 | 业务动作通过 pin 或明确 action 进入 ModelTable |
| payload 合规 | pin 传递的是 ModelTable records |
| 可视化验证 | 页面加载、标题变化、布局变化、按钮点击和状态回写都实际验证过 |

## 12. 什么时候需要扩展 UI 组件

如果现有 label 已能表达需求，优先填表；如果你需要新的视觉能力，再考虑扩展组件。

适合扩展组件的情况：

| 需求 | 建议 |
|---|---|
| 只是换文字、颜色、间距、行列 | 不扩展组件，直接改 label |
| 只是多一个小属性 | 优先用 `ui_props_json`；稳定后再升级成明确 label |
| 新增可复用控件 | 在 renderer/component registry 增加组件，并补文档 |
| 新增事件语义 | 先定义 ModelTable payload，再接入程序模型 |
| 新增独立子 app | 使用 `model.submt`，不要用普通 `ui_parent` 伪装 |

一个好的 UI 模型应该像搭积木：小组件能组合成行列，行列能组合成页面，页面行为能通过 pin 连接程序模型。这样用户改 label 就能改页面，开发者扩展组件也不会破坏已有模型。
