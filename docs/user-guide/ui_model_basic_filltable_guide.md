---
title: "Basic UI Model Fill-Table Guide"
doc_type: user-guide
status: active
updated: 2026-06-03
source: ai
---

# Basic UI Model Fill-Table Guide

这份文档面向开发者用户：你可以照着这里的表，手工填写 ModelTable labels，做出一些简单界面。

本文只讲当前已经成立的 `cellwise.ui.v1` 基础能力：

- 界面布局：行、列、卡片、间距、父子包含关系。
- `Button` 按钮：按钮文字、样式、点击事件绑定。
- `Input` 输入框：显示当前值、输入后写回草稿 label。
- 文本展示框：静态文本、读取某个 label 的动态文本、Markdown 文本。
- 弹出式提示框：用 `Dialog` 显示提示、确认、详情。
- 页面切换：`Tabs + TabPane` 多 tab 切换。
- 局部页面切换：不使用 Tabs，仅通过按钮和显示条件切换局部区域。

本文不覆盖完整滑动 APP 安装、Workspace Manager 发布、双总线远端服务编排。那些内容看 `slide-app-runtime/slide_app_runtime_developer_guide.md`。

## 1. 最小规则

### 1.1 每个可见组件占一个 Cell

当前推荐写法是：一个组件就是一个 UI node cell。不要把整个页面写成一段 HTML，也不要把整页塞到一个巨大的 JSON 里。

每个 UI node 至少需要：

| label | t | 说明 |
|---|---|---|
| `ui_node_id` | `str` | 这个组件的稳定名字，比如 `submit_button`。 |
| `ui_component` | `str` | 组件类型，比如 `Container`、`Button`、`Input`。 |
| `ui_parent` | `str` | 父组件的 `ui_node_id`。根节点不需要。 |
| `ui_order` | `int` | 同一个父组件下的排序。 |

模型 root cell `(0,0,0)` 至少需要：

| label | t | 说明 |
|---|---|---|
| `model_type` | `model.table` | 声明这是一个模型表模型。 |
| `app_name` | `str` | 在 Workspace / 桌面里显示的名字。 |
| `slide_capable` | `bool` | 是否可作为滑动 APP 打开。 |
| `slide_app_summary` | `str` | 滑动 APP 简介。 |
| `slide_surface_type` | `str` | 通常填 `workspace.page`。 |
| `ui_authoring_version` | `str` | 固定填 `cellwise.ui.v1`。 |
| `ui_root_node_id` | `str` | 指向页面根 UI node。 |

### 1.2 手工填表 record 写法

手工填表时，本质上就是往某个 cell 写 label。下面这种 JSON record 只是把“填哪一格、填什么 label”写清楚：

```json
{
  "op": "add_label",
  "model_id": 4100,
  "p": 2,
  "r": 0,
  "c": 0,
  "k": "ui_component",
  "t": "str",
  "v": "Container"
}
```

字段含义：

| 字段 | 含义 |
|---|---|
| `model_id` | 目标模型 id。手工填表时换成你自己的模型 id。 |
| `p/r/c` | cell 坐标。 |
| `k` | label key。 |
| `t` | label type。 |
| `v` | label value。 |

### 1.3 打包成滑动 APP ZIP 时的 record 写法

如果你要把这份文档里的界面打包成滑动 APP ZIP，`app_payload.json` 不能直接使用上面的 `op + model_id` 形式。

ZIP 导入器要求的是临时模型表 record array，每条 record 只使用：

| 字段 | 含义 |
|---|---|
| `id` | 临时模型 id。单模型滑动 APP 通常全部填 `0`。 |
| `p/r/c` | cell 坐标。 |
| `k` | label key。 |
| `t` | label type。 |
| `v` | label value。 |

也就是说，手工填表 record：

```json
{
  "op": "add_label",
  "model_id": 4100,
  "p": 2,
  "r": 0,
  "c": 0,
  "k": "ui_component",
  "t": "str",
  "v": "Container"
}
```

打包进 `app_payload.json` 时应改成：

```json
{
  "id": 0,
  "p": 2,
  "r": 0,
  "c": 0,
  "k": "ui_component",
  "t": "str",
  "v": "Container"
}
```

转换规则：

| 手工填表字段 | ZIP 字段 |
|---|---|
| `model_id` | 删除；由安装器分配正式模型 id。 |
| `op` | 删除；ZIP 中每条 record 都表示要 materialize 的 label。 |
| `id` | 新增；同一个临时模型内填 `0`。 |
| label 内部引用里的 `model_id` | 同模型引用省略 `model_id`；跨模型引用才显式填写目标 `model_id`。不要把 `0` 当成当前模型占位符。 |

也就是说，如果组件读取本 App root cell 的 `draft_text`，写：

```json
{ "p": 0, "r": 0, "c": 0, "k": "draft_text" }
```

不要写：

```json
{ "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "draft_text" }
```

只有读取其他模型时才写 `model_id`，例如系统 overlay 模型 `-2`、runtime 状态模型 `-1`，或明确存在的其他正数模型。

这条规则也适用于按钮事件里的 `value_ref`、`meta_ref`、输入框的 `read` / `target_ref`、`ui_bind_read_json`、`ui_props_json.tasksRef` 这类引用。开发者在 ZIP 阶段不知道安装后的正式 model id，所以不要写 `model_id: 4100`、`model_id: 1086`，也不要用 `model_id: 0` 伪装当前模型。

如果确实需要把当前正式 model id 作为业务数据发给后端，不要手填一个固定数值。后续应使用运行时提供的当前模型引用能力；在当前阶段，普通同模型 UI 读写和按钮提交都应通过省略 `model_id` 解决。

ZIP root `(0,0,0)` 还必须补齐安装 metadata：

| label | t | 说明 |
|---|---|---|
| `source_worker` | `str` | 提供者名称或来源说明。 |
| `from_user` | `str` | 提供方用户标识。 |
| `to_user` | `str` | 接收方用户标识。 |

最小验证包示例已放在：

- `docs/user-guide/examples/ui_basic_filltable_validation_app_payload.json`

本地安装测试时，把这个文件压缩为 ZIP，并命名为 `app_payload.json` 放在 ZIP 根目录。

## 2. 一个最小页面

目标效果：页面显示标题、输入框、提交按钮和结果文本。

### 2.1 Root labels

| cell | k | t | v |
|---|---|---|---|
| `(0,0,0)` | `model_type` | `model.table` | `UI.BasicExample` |
| `(0,0,0)` | `app_name` | `str` | `基础 UI 示例` |
| `(0,0,0)` | `slide_capable` | `bool` | `true` |
| `(0,0,0)` | `slide_app_summary` | `str` | `Input + Button + Text + Dialog + Tabs 示例` |
| `(0,0,0)` | `slide_surface_type` | `str` | `workspace.page` |
| `(0,0,0)` | `ui_authoring_version` | `str` | `cellwise.ui.v1` |
| `(0,0,0)` | `ui_root_node_id` | `str` | `basic_root` |
| `(0,0,0)` | `draft_text` | `str` | `` |
| `(0,0,0)` | `result_text` | `str` | `等待输入` |
| `(0,0,0)` | `dialog_open` | `bool` | `false` |
| `(0,0,0)` | `show_detail` | `bool` | `false` |
| `(0,0,0)` | `active_tab` | `str` | `form` |

### 2.2 UI nodes

| cell | node | component | parent | order | 说明 |
|---|---|---|---|---:|---|
| `(2,0,0)` | `basic_root` | `Container` | - | 0 | 页面根容器。 |
| `(2,1,0)` | `title` | `Text` | `basic_root` | 10 | 标题。 |
| `(2,2,0)` | `form_row` | `Container` | `basic_root` | 20 | 输入框和按钮所在行。 |
| `(2,2,1)` | `name_input` | `Input` | `form_row` | 10 | 输入框。 |
| `(2,2,2)` | `submit_button` | `Button` | `form_row` | 20 | 按钮。 |
| `(2,3,0)` | `result_text` | `Text` | `basic_root` | 30 | 结果文本。 |

完整 records：

```json
[
  { "op": "add_label", "model_id": 4100, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "UI.BasicExample" },
  { "op": "add_label", "model_id": 4100, "p": 0, "r": 0, "c": 0, "k": "app_name", "t": "str", "v": "基础 UI 示例" },
  { "op": "add_label", "model_id": 4100, "p": 0, "r": 0, "c": 0, "k": "slide_capable", "t": "bool", "v": true },
  { "op": "add_label", "model_id": 4100, "p": 0, "r": 0, "c": 0, "k": "slide_app_summary", "t": "str", "v": "Input + Button + Text + Dialog + Tabs 示例" },
  { "op": "add_label", "model_id": 4100, "p": 0, "r": 0, "c": 0, "k": "slide_surface_type", "t": "str", "v": "workspace.page" },
  { "op": "add_label", "model_id": 4100, "p": 0, "r": 0, "c": 0, "k": "ui_authoring_version", "t": "str", "v": "cellwise.ui.v1" },
  { "op": "add_label", "model_id": 4100, "p": 0, "r": 0, "c": 0, "k": "ui_root_node_id", "t": "str", "v": "basic_root" },
  { "op": "add_label", "model_id": 4100, "p": 0, "r": 0, "c": 0, "k": "draft_text", "t": "str", "v": "" },
  { "op": "add_label", "model_id": 4100, "p": 0, "r": 0, "c": 0, "k": "result_text", "t": "str", "v": "等待输入" },
  { "op": "add_label", "model_id": 4100, "p": 0, "r": 0, "c": 0, "k": "dialog_open", "t": "bool", "v": false },
  { "op": "add_label", "model_id": 4100, "p": 0, "r": 0, "c": 0, "k": "show_detail", "t": "bool", "v": false },
  { "op": "add_label", "model_id": 4100, "p": 0, "r": 0, "c": 0, "k": "active_tab", "t": "str", "v": "form" },

  { "op": "add_label", "model_id": 4100, "p": 2, "r": 0, "c": 0, "k": "ui_node_id", "t": "str", "v": "basic_root" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 0, "c": 0, "k": "ui_component", "t": "str", "v": "Container" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 0, "c": 0, "k": "ui_layout", "t": "str", "v": "column" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 0, "c": 0, "k": "ui_gap", "t": "int", "v": 16 },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 0, "c": 0, "k": "ui_style_padding", "t": "str", "v": "24px" },

  { "op": "add_label", "model_id": 4100, "p": 2, "r": 1, "c": 0, "k": "ui_node_id", "t": "str", "v": "title" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 1, "c": 0, "k": "ui_component", "t": "str", "v": "Text" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 1, "c": 0, "k": "ui_parent", "t": "str", "v": "basic_root" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 1, "c": 0, "k": "ui_order", "t": "int", "v": 10 },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 1, "c": 0, "k": "ui_text", "t": "str", "v": "基础 UI 示例" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 1, "c": 0, "k": "ui_style_font_size", "t": "str", "v": "24px" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 1, "c": 0, "k": "ui_style_font_weight", "t": "str", "v": "700" },

  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 0, "k": "ui_node_id", "t": "str", "v": "form_row" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 0, "k": "ui_component", "t": "str", "v": "Container" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 0, "k": "ui_parent", "t": "str", "v": "basic_root" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 0, "k": "ui_order", "t": "int", "v": 20 },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 0, "k": "ui_layout", "t": "str", "v": "row" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 0, "k": "ui_gap", "t": "int", "v": 12 },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 0, "k": "ui_style_align_items", "t": "str", "v": "center" },

  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 1, "k": "ui_node_id", "t": "str", "v": "name_input" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 1, "k": "ui_component", "t": "str", "v": "Input" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 1, "k": "ui_parent", "t": "str", "v": "form_row" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 1, "k": "ui_order", "t": "int", "v": 10 },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 1, "k": "ui_placeholder", "t": "str", "v": "输入一些文字" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 1, "k": "ui_style_flex", "t": "str", "v": "1" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 1, "k": "ui_bind_json", "t": "json", "v": { "read": { "p": 0, "r": 0, "c": 0, "k": "draft_text" }, "write": { "action": "ui_owner_label_update", "target_ref": { "p": 0, "r": 0, "c": 0, "k": "draft_text" }, "commit_policy": "on_blur" } } },

  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 2, "k": "ui_node_id", "t": "str", "v": "submit_button" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 2, "k": "ui_component", "t": "str", "v": "Button" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 2, "k": "ui_parent", "t": "str", "v": "form_row" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 2, "k": "ui_order", "t": "int", "v": 20 },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 2, "k": "ui_label", "t": "str", "v": "提交" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 2, "k": "ui_variant", "t": "str", "v": "primary" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 2, "c": 2, "k": "ui_bind_json", "t": "json", "v": { "write": { "action": "ui_owner_label_update", "target_ref": { "p": 0, "r": 0, "c": 0, "k": "result_text" }, "value_ref": { "t": "str", "v": { "$label": { "p": 0, "r": 0, "c": 0, "k": "draft_text" } } } } } },

  { "op": "add_label", "model_id": 4100, "p": 2, "r": 3, "c": 0, "k": "ui_node_id", "t": "str", "v": "result_display" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 3, "c": 0, "k": "ui_component", "t": "str", "v": "Text" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 3, "c": 0, "k": "ui_parent", "t": "str", "v": "basic_root" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 3, "c": 0, "k": "ui_order", "t": "int", "v": 30 },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 3, "c": 0, "k": "ui_bind_read_json", "t": "json", "v": { "p": 0, "r": 0, "c": 0, "k": "result_text" } }
]
```

这组 records 的关键效果：

- 改 `app_name` 会改桌面或 Workspace 中显示的应用名。
- 改 `ui_text` 会改页面标题。
- 输入框读取 `draft_text`，失焦后写回 `draft_text`。
- 按钮点击后把 `draft_text` 的值写到 `result_text`。
- 结果文本读取 `result_text`。

## 3. Layout：页面布局

### 3.1 Container

`Container` 是最常用的布局组件。

| label | t | 常用值 | 说明 |
|---|---|---|---|
| `ui_layout` | `str` | `column` / `row` | 子组件竖排或横排。 |
| `ui_gap` | `int` | `8` / `12` / `16` | 子组件之间的间距，单位是 px。 |
| `ui_wrap` | `bool` | `true` / `false` | 横向布局是否换行。 |
| `ui_style_padding` | `str` | `24px` | 内边距。 |
| `ui_style_align_items` | `str` | `center` | 横排时常用于垂直居中。 |
| `ui_style_justify_content` | `str` | `space-between` | 子项主轴分布。 |

一个“上下两行，第一行三个按钮，第二行一个输入框”的结构可以这样拆：

| node | component | parent | layout |
|---|---|---|---|
| `root` | `Container` | - | `column` |
| `actions_row` | `Container` | `root` | `row` |
| `btn_a` | `Button` | `actions_row` | - |
| `btn_b` | `Button` | `actions_row` | - |
| `btn_c` | `Button` | `actions_row` | - |
| `input_row` | `Container` | `root` | `row` |
| `main_input` | `Input` | `input_row` | - |

注意：普通视觉布局不需要 `model.submt`。`model.submt` 是子模型挂载边界，不是普通 UI 行列容器。

## 4. Text：文本展示框

### 4.1 静态文本

| cell | k | t | v |
|---|---|---|---|
| `(2,1,0)` | `ui_component` | `str` | `Text` |
| `(2,1,0)` | `ui_text` | `str` | `Hello` |

### 4.2 动态文本

动态文本读取某个 label：

```json
{
  "read": {
    "p": 0,
    "r": 0,
    "c": 0,
    "k": "result_text"
  }
}
```

填到 `ui_bind_json`：

| cell | k | t | v |
|---|---|---|---|
| `(2,3,0)` | `ui_component` | `str` | `Text` |
| `(2,3,0)` | `ui_bind_json` | `json` | `{ "read": { ... } }` |

只读场景也可以直接用 `ui_bind_read_json`：

```json
{ "p": 0, "r": 0, "c": 0, "k": "result_text" }
```

### 4.3 Markdown 文本

长说明、表格、代码块推荐用 `Markdown`：

| label | t | 说明 |
|---|---|---|
| `ui_markdown` | `str` | 直接写 Markdown 内容。 |
| `ui_bind_read_json` | `json` | 从某个 label 读取 Markdown 内容。 |
| `ui_style_max_width` | `str` | 例如 `880px`，让长文更可读。 |

```json
[
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 4, "c": 0, "k": "ui_node_id", "t": "str", "v": "help_markdown" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 4, "c": 0, "k": "ui_component", "t": "str", "v": "Markdown" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 4, "c": 0, "k": "ui_parent", "t": "str", "v": "basic_root" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 4, "c": 0, "k": "ui_order", "t": "int", "v": 40 },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 4, "c": 0, "k": "ui_markdown", "t": "str", "v": "## 帮助\n\n- 输入文字\n- 点击提交\n- 查看结果" }
]
```

> 写进 JSON 文件时，Markdown 换行应使用 JSON 标准换行转义 `\n`。不要写成 `\\n`，否则页面会把它当成普通字符显示。

## 5. Input：输入框

`Input` 的核心是读一个 label，并把用户输入写回另一个 label。通常读写同一个 label。

| label | t | 说明 |
|---|---|---|
| `ui_placeholder` | `str` | 占位提示。 |
| `ui_variant` | `str` | 可填 `textarea` 或 `password`。 |
| `ui_bind_json.read` | `json` | 输入框当前显示值来自哪里。 |
| `ui_bind_json.write` | `json` | 用户输入后写到哪里。 |

推荐输入框使用 `commit_policy: "on_blur"`。这样用户快速输入时先使用本地草稿，失焦后再正式写入，避免字符“一顿一顿”跳回旧值。

```json
{
  "read": { "p": 0, "r": 0, "c": 0, "k": "draft_text" },
  "write": {
    "action": "ui_owner_label_update",
    "target_ref": { "p": 0, "r": 0, "c": 0, "k": "draft_text" },
    "commit_policy": "on_blur"
  }
}
```

如果这个输入值只是界面本地草稿，用 `on_blur`。如果这个值代表正式业务提交，通常不要每个字符都发正式业务事件，而是让 Submit 按钮触发正式事件。

## 6. Button：按钮和事件绑定

### 6.1 基础按钮

| label | t | 说明 |
|---|---|---|
| `ui_label` | `str` | 按钮文字。 |
| `ui_variant` | `str` | `primary`、`danger`、`text`、`link` 等。 |
| `ui_bind_json.write` | `json` | 点击后触发的动作。 |

### 6.2 UI-only 写 label

如果按钮只是打开弹窗、切换本地详情、保存草稿，可以使用 `ui_owner_label_update`。

下面的按钮把 `dialog_open` 写成 `true`，用于打开弹窗：

```json
{
  "write": {
    "action": "ui_owner_label_update",
    "target_ref": { "p": 0, "r": 0, "c": 0, "k": "dialog_open" },
    "value_ref": { "t": "bool", "v": true }
  }
}
```

### 6.3 从输入框复制到结果文本

下面的按钮把 `draft_text` 的当前值写到 `result_text`：

```json
{
  "write": {
    "action": "ui_owner_label_update",
    "target_ref": { "p": 0, "r": 0, "c": 0, "k": "result_text" },
    "value_ref": {
      "t": "str",
      "v": {
        "$label": { "p": 0, "r": 0, "c": 0, "k": "draft_text" }
      }
    }
  }
}
```

### 6.4 正式业务事件

如果按钮要触发后端程序模型、总线消息或远端 worker，不要直接把最终业务结果写到界面 label。正确做法是让按钮发出 `bus_event_v2`，内容必须是 ModelTable-like record array。

示例：

```json
{
  "write": {
    "bus_event_v2": true,
    "bus_in_key": "submit_request",
    "value_t": "modeltable",
    "value_ref": [
      { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "ui_event.v1" },
      { "id": 0, "p": 0, "r": 0, "c": 0, "k": "event_name", "t": "str", "v": "submit" },
      { "id": 0, "p": 0, "r": 0, "c": 0, "k": "input_text", "t": "str", "v": { "$label": { "p": 0, "r": 0, "c": 0, "k": "draft_text" } } }
    ],
    "meta": {
      "source": "basic_ui_example"
    }
  }
}
```

这类正式业务链路的结果应该由后端程序模型或总线回包写回 ModelTable，然后 Text/Input/Dialog 再读取新的 labels 显示。

## 7. Dialog：弹出式提示框

`Dialog` 用一个 bool label 控制打开/关闭。最常见的是：

- `dialog_open = false`：不显示。
- 点击按钮把 `dialog_open` 改成 `true`：显示。
- 点击关闭按钮或 Dialog 自身关闭动作把 `dialog_open` 改成 `false`：隐藏。

### 7.1 Dialog 本体

```json
[
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 5, "c": 0, "k": "ui_node_id", "t": "str", "v": "notice_dialog" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 5, "c": 0, "k": "ui_component", "t": "str", "v": "Dialog" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 5, "c": 0, "k": "ui_parent", "t": "str", "v": "basic_root" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 5, "c": 0, "k": "ui_order", "t": "int", "v": 50 },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 5, "c": 0, "k": "ui_props_json", "t": "json", "v": { "title": "提示", "width": "420px" } },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 5, "c": 0, "k": "ui_bind_json", "t": "json", "v": { "read": { "p": 0, "r": 0, "c": 0, "k": "dialog_open" }, "write": { "action": "ui_owner_label_update", "target_ref": { "p": 0, "r": 0, "c": 0, "k": "dialog_open" } } } }
]
```

### 7.2 Dialog 内容

Dialog 内容也是普通子组件。把 `ui_parent` 指向 Dialog 的 `ui_node_id`：

```json
[
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 5, "c": 1, "k": "ui_node_id", "t": "str", "v": "notice_text" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 5, "c": 1, "k": "ui_component", "t": "str", "v": "Text" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 5, "c": 1, "k": "ui_parent", "t": "str", "v": "notice_dialog" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 5, "c": 1, "k": "ui_order", "t": "int", "v": 10 },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 5, "c": 1, "k": "ui_text", "t": "str", "v": "操作已经完成。" }
]
```

### 7.3 打开和关闭按钮

打开：

```json
{
  "write": {
    "action": "ui_owner_label_update",
    "target_ref": { "p": 0, "r": 0, "c": 0, "k": "dialog_open" },
    "value_ref": { "t": "bool", "v": true }
  }
}
```

关闭：

```json
{
  "write": {
    "action": "ui_owner_label_update",
    "target_ref": { "p": 0, "r": 0, "c": 0, "k": "dialog_open" },
    "value_ref": { "t": "bool", "v": false }
  }
}
```

## 8. Tabs：多 tab 页面切换

`Tabs` 用一个 label 保存当前 tab 名，例如 `active_tab = "form"`。

### 8.1 Root state

| cell | k | t | v |
|---|---|---|---|
| `(0,0,0)` | `active_tab` | `str` | `form` |

### 8.2 Tabs records

```json
[
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 0, "k": "ui_node_id", "t": "str", "v": "main_tabs" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 0, "k": "ui_component", "t": "str", "v": "Tabs" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 0, "k": "ui_parent", "t": "str", "v": "basic_root" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 0, "k": "ui_order", "t": "int", "v": 60 },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 0, "k": "ui_bind_json", "t": "json", "v": { "read": { "p": 0, "r": 0, "c": 0, "k": "active_tab" }, "write": { "action": "ui_owner_label_update", "target_ref": { "p": 0, "r": 0, "c": 0, "k": "active_tab" } } } },

  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 1, "k": "ui_node_id", "t": "str", "v": "tab_form" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 1, "k": "ui_component", "t": "str", "v": "TabPane" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 1, "k": "ui_parent", "t": "str", "v": "main_tabs" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 1, "k": "ui_order", "t": "int", "v": 10 },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 1, "k": "ui_props_json", "t": "json", "v": { "label": "表单", "name": "form" } },

  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 2, "k": "ui_node_id", "t": "str", "v": "tab_help" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 2, "k": "ui_component", "t": "str", "v": "TabPane" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 2, "k": "ui_parent", "t": "str", "v": "main_tabs" },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 2, "k": "ui_order", "t": "int", "v": 20 },
  { "op": "add_label", "model_id": 4100, "p": 2, "r": 6, "c": 2, "k": "ui_props_json", "t": "json", "v": { "label": "帮助", "name": "help" } }
]
```

Tab 内容继续作为 `TabPane` 的子节点填写。例如：

| node | component | parent |
|---|---|---|
| `form_text` | `Text` | `tab_form` |
| `help_markdown` | `Markdown` | `tab_help` |

## 9. 不依赖 Tabs 的局部页面切换

如果只是“主内容 / 详情内容”两态切换，不必使用 Tabs。可以用一个 bool label 控制显示：

- `show_detail = false`：显示主内容。
- `show_detail = true`：显示详情内容。

当前 renderer 的 `visibleRef` / `hiddenRef` 是 bool-ish 判断，不支持直接写“当 `active_view == detail` 时显示”。因此：

- 两态切换：一个 bool label 就够。
- 三态以上切换：推荐使用 `Tabs`；或者让程序模型维护多个 bool labels，例如 `show_list`、`show_detail`、`show_settings`。

### 9.1 主内容区域

主内容使用 `hiddenRef`：当 `show_detail` 为 true 时隐藏。

```json
{
  "hiddenRef": { "p": 0, "r": 0, "c": 0, "k": "show_detail" }
}
```

填到主内容容器的 `ui_props_json`。

### 9.2 详情区域

详情区域使用 `visibleRef`：只有 `show_detail` 为 true 时显示。

```json
{
  "visibleRef": { "p": 0, "r": 0, "c": 0, "k": "show_detail" }
}
```

填到详情容器的 `ui_props_json`。

### 9.3 切换按钮

打开详情：

```json
{
  "write": {
    "action": "ui_owner_label_update",
    "target_ref": { "p": 0, "r": 0, "c": 0, "k": "show_detail" },
    "value_ref": { "t": "bool", "v": true }
  }
}
```

返回主内容：

```json
{
  "write": {
    "action": "ui_owner_label_update",
    "target_ref": { "p": 0, "r": 0, "c": 0, "k": "show_detail" },
    "value_ref": { "t": "bool", "v": false }
  }
}
```

这种方式适合详情展开、向导下一步、局部设置面板、安装完成提示后的“打开 / 留在当前页”等简单交互。

## 10. To Do Board 审查：哪些地方用了扩展

0405 版 `To Do Board` 的结论是：它整体遵守 `cellwise.ui.v1`，但不是完全由本文前面列出的基础组件组成。

它用了两类能力：

| 部分 | 是否基础能力 | 说明 |
|---|---|---|
| 页面根、标题、状态、按钮行 | 是 | `Container`、`Heading`、`Text`、`StatusBadge`、`Button`。 |
| 双视图切换 | 是 | `Tabs + TabPane`。 |
| 新增/编辑弹窗 | 是 | `Dialog`、`Form`、`FormItem`、`Input`、`Select`、`Button`。 |
| 多列任务看板 | 扩展 | `TodoBoard` 专用组件。 |
| 未完成专注列表 | 扩展 | `TodoFocusList` 专用组件。 |
| 拖动任务换状态 | 扩展 | 由 `TodoBoard` 内部处理拖放，并发出正式 `bus_event_v2`。 |

所以，如果开发者只看本文前面的基础组件说明，可以手工填出“表单 + 弹窗 + tabs + 文本/按钮”的简单应用；但要完整复刻当前 `To Do Board` 的多列卡片、拖放和专注列表，需要使用下面两个扩展组件。

### 10.1 任务数据 label

To Do Board 的任务 truth 存在模型 root cell 的 `tasks_json`：

```json
[
  {
    "id": "task_1",
    "title": "验证 UI 模型文档",
    "body": "用基础组件说明手工填出一个真实可交互的滑动 App。",
    "status": "todo"
  }
]
```

每个任务至少需要：

| 字段 | 说明 |
|---|---|
| `id` | 稳定任务 id。 |
| `title` | 卡片标题。 |
| `body` | 任务详情。 |
| `status` | 状态值，例如 `todo`、`doing`、`done`、`archived`。 |

### 10.2 `TodoBoard` 扩展组件

`TodoBoard` 用来渲染多列看板。它从 `tasksRef` 读取任务列表，用 `columns` 定义列。

```json
[
  { "op": "add_label", "model_id": 1086, "p": 2, "r": 11, "c": 0, "k": "ui_node_id", "t": "str", "v": "todo_board" },
  { "op": "add_label", "model_id": 1086, "p": 2, "r": 11, "c": 0, "k": "ui_component", "t": "str", "v": "TodoBoard" },
  { "op": "add_label", "model_id": 1086, "p": 2, "r": 11, "c": 0, "k": "ui_parent", "t": "str", "v": "todo_board_tab" },
  { "op": "add_label", "model_id": 1086, "p": 2, "r": 11, "c": 0, "k": "ui_props_json", "t": "json", "v": {
    "tasksRef": { "p": 0, "r": 0, "c": 0, "k": "tasks_json" },
    "columns": [
      { "value": "todo", "label": "还未开始", "tone": "#2563eb", "bg": "#eff6ff" },
      { "value": "doing", "label": "正在进行", "tone": "#d97706", "bg": "#fffbeb" },
      { "value": "done", "label": "已完成", "tone": "#16a34a", "bg": "#f0fdf4" },
      { "value": "archived", "label": "已归档", "tone": "#64748b", "bg": "#f8fafc" }
    ],
    "emptyText": "把任务拖到这里"
  } },
  { "op": "add_label", "model_id": 1086, "p": 2, "r": 11, "c": 0, "k": "ui_bind_json", "t": "json", "v": {
    "write": { "bus_event_v2": true, "bus_in_key": "todo_1086_bus_event", "commit_policy": "immediate" }
  } }
]
```

`TodoBoard` 内部会把用户操作转换成临时 ModelTable records：

| 用户动作 | `todo_action` | 额外 records |
|---|---|---|
| 点击任务卡片的“编辑” | `open_edit` | `task_id` |
| 点击“开始 / 完成 / 归档” | `move_status` | `task_id`、`status` |
| 拖动任务到另一列 | `move_status` | `task_id`、`status` |

注意：`TodoBoard` 不直接改 `tasks_json`。它只发出 `bus_event_v2`，后端程序模型收到 `todo_action` 后再写回 `tasks_json`。

### 10.3 `TodoFocusList` 扩展组件

`TodoFocusList` 用于“未完成专注”视图。它同样读取 `tasks_json`，但默认隐藏 `done` 和 `archived`，并可通过 `filterRef` 读取筛选文本。

```json
[
  { "op": "add_label", "model_id": 1086, "p": 2, "r": 16, "c": 0, "k": "ui_node_id", "t": "str", "v": "todo_focus_list" },
  { "op": "add_label", "model_id": 1086, "p": 2, "r": 16, "c": 0, "k": "ui_component", "t": "str", "v": "TodoFocusList" },
  { "op": "add_label", "model_id": 1086, "p": 2, "r": 16, "c": 0, "k": "ui_parent", "t": "str", "v": "todo_focus_tab" },
  { "op": "add_label", "model_id": 1086, "p": 2, "r": 16, "c": 0, "k": "ui_props_json", "t": "json", "v": {
    "tasksRef": { "p": 0, "r": 0, "c": 0, "k": "tasks_json" },
    "filterRef": { "p": 0, "r": 0, "c": 0, "k": "filter_text" },
    "emptyText": "没有匹配的未完成任务"
  } },
  { "op": "add_label", "model_id": 1086, "p": 2, "r": 16, "c": 0, "k": "ui_bind_json", "t": "json", "v": {
    "write": { "bus_event_v2": true, "bus_in_key": "todo_1086_bus_event", "commit_policy": "immediate" }
  } }
]
```

### 10.4 输入同步策略

To Do Board 的新增/编辑弹窗里，标题和内容输入框使用：

```json
{ "commit_policy": "on_submit" }
```

这表示快速输入时不每个字符都正式写表，避免打字过程卡顿或回跳。点击“保存任务 / 保存修改”时，提交按钮会读取当前显示的输入值，并通过正式事件提交。

### 10.5 程序模型如何接收

To Do Board 的 UI 事件入口分两种情况：

| 场景 | `bus_in_key` 应填写 |
|---|---|
| 内置 Model 1086 | `todo_1086_bus_event`，因为 Model 0 已经有固定 route。 |
| 打包成 ZIP 交给 UI Server 安装 | `bus_event_submit_0_0_0_0`，安装器会按新分配的正式 model id 自动改成 `imported_host_submit_<modelId>`。 |

ZIP 版本还需要在 root `(0,0,0)` 声明 `host_ingress_v1`，指向 `todo_request`：

```json
{
  "id": 0,
  "p": 0,
  "r": 0,
  "c": 0,
  "k": "host_ingress_v1",
  "t": "json",
  "v": {
    "version": "v1",
    "boundaries": [{
      "semantic": "submit",
      "pin_name": "todo_request",
      "value_t": "modeltable",
      "locator_kind": "root_relative_cell",
      "locator_value": { "p": 0, "r": 0, "c": 0 },
      "primary": true
    }]
  }
}
```

安装后，Model 0 挂载路由会把 `imported_host_submit_<modelId>` 转到本 app 的 `todo_request`，再触发 `handle_todo_event` 程序模型。程序模型根据 `todo_action` 执行：

| `todo_action` | 程序模型动作 |
|---|---|
| `open_create` | 打开新增弹窗。 |
| `create_task` | 读取标题、内容、状态，新增任务到 `tasks_json`。 |
| `open_edit` | 读取 `task_id`，打开编辑弹窗。 |
| `save_edit` | 保存编辑结果到 `tasks_json`。 |
| `move_status` | 修改指定任务状态。 |
| `filter_focus` | 更新专注视图筛选文本。 |

完整组件参考见 `docs/user-guide/ui_components_v2.md` 的 `Task Components` 小节。

## 11. 推荐填表顺序

手工填一个简单页面时，按这个顺序最不容易乱：

1. 先填 root metadata：`model_type`、`app_name`、`slide_capable`、`ui_authoring_version`、`ui_root_node_id`。
2. 再填 UI 状态 labels：例如 `draft_text`、`result_text`、`dialog_open`、`show_detail`、`active_tab`。
3. 填根容器：`ui_node_id`、`ui_component=Container`、`ui_layout`、`ui_gap`。
4. 从上到下填子组件：每个组件都有 `ui_parent` 和 `ui_order`。
5. 最后填读写绑定：`ui_bind_json` 或 `ui_bind_read_json`。
6. 先验证静态显示，再验证输入，再验证按钮，再验证弹窗和页面切换。

## 12. 常见错误

| 错误 | 后果 | 正确做法 |
|---|---|---|
| 忘记 `ui_authoring_version=cellwise.ui.v1` | 页面不会按 cellwise UI 编译。 | 在 `(0,0,0)` 填固定值。 |
| `ui_root_node_id` 指向不存在的 node | 页面为空。 | 确保有同名 `ui_node_id`。 |
| 子组件没有 `ui_parent` | 可能被挂到根下或显示顺序异常。 | 非根组件都写 `ui_parent`。 |
| 兄弟节点都不写 `ui_order` | 顺序难以预测。 | 每个兄弟节点写 10、20、30 这样的 order。 |
| 用一个大 HTML 写整页 | 后续不能按 cell 改标题、按钮、输入框。 | 拆成 `Container`、`Text`、`Input`、`Button`。 |
| 输入框用 `immediate` 写正式业务状态 | 快速输入时容易出现回跳，也会把草稿当正式业务。 | 输入草稿用 `on_blur`，正式业务由按钮提交。 |
| 认为 To Do Board 只用了基础组件 | 会漏掉多列看板、拖放和专注列表的组件能力。 | 使用 `TodoBoard` / `TodoFocusList`，并查组件参考。 |
| 用按钮直接写最终业务结果 | 绕过程序模型和总线链路。 | UI-only 状态才这样写；正式业务用 `bus_event_v2` 或 pin path。 |
| 认为 `visibleRef` 能比较字符串 | 目前只判断 label 是否为真。 | 两态用 bool；三态以上用 Tabs 或程序模型维护多个 bool。 |

## 13. 下一步看哪里

| 目标 | 文档 |
|---|---|
| 查看完整组件清单 | `docs/user-guide/ui_components_v2.md` |
| 学习滑动 APP 安装和运行链路 | `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md` |
| 学习最小 Submit 双总线示例 | `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md` |
| 学习 Workspace Manager 发布可安装索引 | `docs/user-guide/slide-app-runtime/workspace_manager_interaction_guide.md` |

## 14. 填表自检清单

交付一个简单 UI 模型前，至少检查：

| 检查项 | 通过标准 |
|---|---|
| Root | `(0,0,0)` 有 `model_type`、`app_name`、`ui_authoring_version`、`ui_root_node_id`。 |
| 组件 | 每个可见组件都有 `ui_node_id` 和 `ui_component`。 |
| 父子关系 | 除根节点外都有 `ui_parent`。 |
| 排序 | 同一父组件下的节点有稳定 `ui_order`。 |
| 输入框 | `Input` 有 read/write 绑定；草稿输入优先用 `on_blur`。 |
| 按钮 | UI-only 状态更新和正式业务事件区分清楚。 |
| 弹窗 | `Dialog` 由 bool label 控制，关闭动作能写回 false。 |
| 页面切换 | Tabs 使用 `active_tab`；非 Tabs 局部切换使用 bool label。 |
| 粒度 | 没有把整页塞进一个 HTML 或巨型 JSON。 |
