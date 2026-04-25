---
title: "Cellwise UI Authoring Contract V1"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Cellwise UI Authoring Contract V1

## Goal

定义 hard-cut 后唯一合法的 UI authoring source：

- 一个 UI 节点对应一个 cell
- 组件组合、父子挂载、排版、读写语义全部用分散 labels 表达
- rich page 不再手写 `page_asset_v0`

## Scope

本稿冻结：

- cellwise node identity
- parent/slot/order/layout
- minimal visual props
- read/write intent labels

本稿不冻结：

- 所有高级组件的完整 prop 覆盖面
- 最终业务 action catalog

## Root Labels

放在 model root `(0,0,0)`：

- `ui_authoring_version: str = "cellwise.ui.v1"`
- `ui_root_node_id: str`

只有声明了 `ui_authoring_version = cellwise.ui.v1` 的 model，才按新 authoring compiler 解释。

## Node Labels

每个 node 占一个 cell。

### Identity

- `ui_node_id: str`
- `ui_component: str`
- `ui_parent: str`  
  - root node 允许为空或等于自身 root id
- `ui_order: int`
- `ui_slot: str` optional

### Layout

- `ui_layout: str`  
  - `column`
  - `row`
  - `grid`
- `ui_gap: int`
- `ui_wrap: bool`

### Common Display Props

- `ui_text: str`
- `ui_title: str`
- `ui_label: str`
- `ui_variant: str`
- `ui_placeholder: str`
- `ui_accept: str`
- `ui_button_label: str`
- `ui_empty_text: str`
- `ui_size: str`
- `ui_row_key: str`
- `ui_prop: str`
- `ui_align: str`
- `ui_width: str`
- `ui_min_width: str`
- `ui_max_width: str`
- `ui_height: int`
- `ui_border: bool`
- `ui_stripe: bool`
- `ui_options_json: json`

### Document Page MVP Field Keys (0275)

这些是 `label.k` 字段约定，不是新的 `label.t`。继续使用现有 `str / int`：

- `ui_heading_level: int`
  - Heading level，当前支持 `1-4`
- `ui_list_type: str`
  - `ordered | unordered`
- `ui_callout_type: str`
  - `tip | info | warning | danger`
- `ui_image_src: str`
  - Image 的 `src`
- `ui_image_alt: str`
  - Image 的 `alt`
- `ui_mermaid_code: str`
  - MermaidDiagram 的源文本。Phase A 只占位显示原文，不做真实渲染
- `ui_code_language: str`
  - 预留给 CodeBlock / 后续 richer doc component
- `ui_section_number: int`
  - Section 标题前的编号 badge

这些字段进入 compiler 后，会映射到对应 node props；不需要修改 `docs/ssot/label_type_registry.md`。

### Fine-Grain Ref Labels (0278)

为避免把 `$label` ref 塞回大 `ui_props_json`，允许按下面的细粒度形式表达：

- `<base>_ref_model_id`
- `<base>_ref_p`
- `<base>_ref_r`
- `<base>_ref_c`
- `<base>_ref_k`

例如：

- `ui_text_ref_*`
- `ui_title_ref_*`
- `ui_variant_ref_*`
- `ui_section_number_ref_*`
- `ui_style_flex_direction_ref_*`
- `ui_style_background_color_ref_*`
- `ui_style_font_size_ref_*`
- `ui_selected_text_ref_*`
- `ui_data_ref_*`

compiler 会把它们转成 `$label` 引用，而不是要求作者再手写一个大 JSON。

### Style Labels (0278)

对于常见样式，允许直接使用细粒度 style labels：

- `ui_style_width`
- `ui_style_min_width`
- `ui_style_max_width`
- `ui_style_padding`
- `ui_style_margin`
- `ui_style_align_items`
- `ui_style_justify_content`
- `ui_style_background_color`
- `ui_style_color`
- `ui_style_font_size`
- `ui_style_font_family`
- `ui_style_font_weight`
- `ui_style_flex`
- `ui_style_flex_direction`
- `ui_style_text_align`

### Simple Write Value Ref (0278)

对于像 `row.name` 这种简单值来源，允许：

- `ui_write_value_t`
- `ui_write_value_ref`

用于生成：

```json
{
  "value_ref": {
    "t": "str",
    "v": { "$ref": "row.name" }
  }
}
```

## Read Binding Labels

- `ui_read_model_id: int`
- `ui_read_p: int`
- `ui_read_r: int`
- `ui_read_c: int`
- `ui_read_k: str`

若这 5 个 label 都存在，则 compiler 生成：

```json
{
  "bind": {
    "read": { "model_id": ..., "p": ..., "r": ..., "c": ..., "k": "..." }
  }
}
```

## Write Labels

### UI-local direct write

仅允许 same-model/local state 场景：

- `ui_write_action: str = "label_update"`
- `ui_write_target_model_id`
- `ui_write_target_p`
- `ui_write_target_r`
- `ui_write_target_c`
- `ui_write_target_k`

### Business write

business write 不再 author 成 direct positive-model `target_ref`。

业务写入必须声明为 action intent：

- `ui_write_action: str`
- `ui_write_mode: str = "intent"`

是否补充 target metadata，由后续具体业务 contract 冻结；但原则固定为：

- 业务写入 = action intent
- 最终落地 = `pin/owner-materialization`

## Compiler Output

compiler 输出当前 runtime 可消费的 AST object shape：

- `id`
- `type`
- `props`
- `children`
- `bind`

注意：

- 这是 runtime render target
- 不是 authoring source

## Hard Rules

1. 新功能不得手写 `page_asset_v0`
2. rich page 只能来自 `cellwise.ui.v1`
3. business write 不得 author 成 direct positive-model label update
4. `ui_authoring_version` 缺失的 model，不属于新 authoring 体系

## Pilot

`0254/0256` 先以 `Model 1003` 作为 first-page pilot。
