---
title: "Minimal Slide App Provider Guide"
doc_type: user-guide
status: active
updated: 2026-04-29
source: ai
---

# Minimal Slide App Provider Guide

这份文档只面向滑动 APP 提供方。你不需要先理解本项目的宿主、管理总线、Model 0 或内部导入器细节。

目标是写出一个最小可用 APP：

- 一个 `Input`，让用户输入文本。
- 一个 `Submit` 按钮，把文本交给后端程序模型。
- 一个显示用 `Text`，展示程序模型写回的结果。

也就是一个完整的 `Input + Submit Button + Display Label` 示例。

你最终交付一个 zip，里面放一个 `app_payload.json`。这个 JSON 是一组 ModelTable records；每条 record 就是一格上的一个 label。

## 1. 你需要关心的三件事

| 你写的部分 | 作用 | 本例里叫什么 |
|---|---|---|
| 页面模型 | 描述输入框、按钮和显示文字 | `cellwise.ui.v1` UI labels |
| submit 入口 | 接收按钮提交过来的临时 ModelTable payload | `submit_request` `pin.in` |
| submit 程序 | 读取提交文本，并写回显示 label | `handle_submit` `func.js` |

你不需要在交付包里写安装后的正式 `model_id`。在 `app_payload.json` 里使用临时 `id: 0` 即可；安装时宿主会把它换成正式模型 id，并同步修正 UI 绑定中的 `model_id: 0`。

你也不需要手写宿主侧路由。你只声明 `host_ingress_v1`，告诉宿主：“这个 APP 的 submit 入口是 `submit_request`。”

## 2. 最小 APP 的单元格总览

本例只用一个临时模型 `id: 0`。所有坐标都是这个临时模型内的坐标。

| cell | 用途 | 关键 labels |
|---|---|---|
| `(0,0,0)` | APP root 与 submit 程序模型 | `model_type`、`app_name`、`host_ingress_v1`、`input_text`、`display_text`、`submit_request`、`submit_request_wiring`、`handle_submit` |
| `(2,0,0)` | 页面根容器 | `ui_node_id=minimal_root`、`ui_component=Container` |
| `(2,1,0)` | 标题 | `ui_component=Text`、`ui_text=Minimal Submit App` |
| `(2,2,0)` | 输入框 | `ui_component=Input`、`ui_bind_json.read/write -> input_text` |
| `(2,3,0)` | 提交按钮 | `ui_component=Button`、`ui_bind_json.write.pin=submit_request` |
| `(2,4,0)` | 显示结果 | `ui_component=Text`、`ui_bind_json.read -> display_text` |

这个拆法的重点是：每个可见组件都是一个 cell。不要把整个页面写成一个 HTML 字符串，也不要把所有 UI 都塞进一个大 JSON。

## 3. Submit 按钮会提交什么

按钮提交的是临时 ModelTable record array，不是普通对象。

本例按钮实际提交给 `submit_request` 的 payload 形状是：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "ui_event.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "text", "t": "str", "v": "<用户输入的文本>" }
]
```

`handle_submit` 程序只需要从这组 records 里找 `k="text"`，然后写回 `display_text`。

## 4. 完整 submit 程序模型内容

下面这段就是本例 `handle_submit` 的完整内容。它运行在 `(0,0,0)`，所以 `V1N.addLabel(...)` 会写回同一个 root cell。

<!-- minimal-submit-handler:start -->
```js
const records = Array.isArray(label && label.v) ? label.v : [];
const readPayload = (key, fallback = '') => {
  const record = records.find((item) => (
    item
    && item.id === 0
    && item.p === 0
    && item.r === 0
    && item.c === 0
    && item.k === key
  ));
  return record && Object.prototype.hasOwnProperty.call(record, 'v') ? record.v : fallback;
};

const text = String(readPayload('text', '')).trim();
const displayText = text ? `Submitted: ${text}` : 'Submitted: (empty)';
V1N.addLabel('display_text', 'str', displayText);
V1N.addLabel('last_submit_payload', 'json', records);
return;
```
<!-- minimal-submit-handler:end -->

不要使用旧写法：

- 不要写 `ctx.writeLabel(...)`。
- 不要写 `ctx.getLabel(...)`。
- 不要让按钮直接写 `display_text`。按钮只负责提交；正式结果由程序模型写回。

## 5. 完整 `app_payload.json`

下面这份就是完整交付内容。实际 zip 里只需要把它保存成 `app_payload.json`。

<!-- minimal-submit-app-payload:start -->
```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "UI.MinimalSubmitApp" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "app_name", "t": "str", "v": "Minimal Submit App" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "source_worker", "t": "str", "v": "provider-minimal-submit" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "slide_capable", "t": "bool", "v": true },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "slide_surface_type", "t": "str", "v": "workspace.page" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "from_user", "t": "str", "v": "@provider:example" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "to_user", "t": "str", "v": "@host:example" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "ui_authoring_version", "t": "str", "v": "cellwise.ui.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "ui_root_node_id", "t": "str", "v": "minimal_root" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "input_text", "t": "str", "v": "" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "display_text", "t": "str", "v": "Waiting for submit" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "last_submit_payload", "t": "json", "v": null },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "host_ingress_v1", "t": "json", "v": { "version": "v1", "boundaries": [{ "semantic": "submit", "pin_name": "submit_request", "value_t": "modeltable", "locator_kind": "root_relative_cell", "locator_value": { "p": 0, "r": 0, "c": 0 }, "primary": true }] } },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "submit_request", "t": "pin.in", "v": null },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "submit_request_wiring", "t": "pin.connect.label", "v": [{ "from": "(self, submit_request)", "to": ["(func, handle_submit:in)"] }] },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "handle_submit", "t": "func.js", "v": { "code": "const records = Array.isArray(label && label.v) ? label.v : [];\nconst readPayload = (key, fallback = '') => {\n  const record = records.find((item) => (\n    item\n    && item.id === 0\n    && item.p === 0\n    && item.r === 0\n    && item.c === 0\n    && item.k === key\n  ));\n  return record && Object.prototype.hasOwnProperty.call(record, 'v') ? record.v : fallback;\n};\n\nconst text = String(readPayload('text', '')).trim();\nconst displayText = text ? `Submitted: ${text}` : 'Submitted: (empty)';\nV1N.addLabel('display_text', 'str', displayText);\nV1N.addLabel('last_submit_payload', 'json', records);\nreturn;" } },

  { "id": 0, "p": 2, "r": 0, "c": 0, "k": "ui_node_id", "t": "str", "v": "minimal_root" },
  { "id": 0, "p": 2, "r": 0, "c": 0, "k": "ui_component", "t": "str", "v": "Container" },
  { "id": 0, "p": 2, "r": 0, "c": 0, "k": "ui_layout", "t": "str", "v": "column" },
  { "id": 0, "p": 2, "r": 0, "c": 0, "k": "ui_gap", "t": "int", "v": 12 },

  { "id": 0, "p": 2, "r": 1, "c": 0, "k": "ui_node_id", "t": "str", "v": "minimal_title" },
  { "id": 0, "p": 2, "r": 1, "c": 0, "k": "ui_component", "t": "str", "v": "Text" },
  { "id": 0, "p": 2, "r": 1, "c": 0, "k": "ui_parent", "t": "str", "v": "minimal_root" },
  { "id": 0, "p": 2, "r": 1, "c": 0, "k": "ui_order", "t": "int", "v": 10 },
  { "id": 0, "p": 2, "r": 1, "c": 0, "k": "ui_text", "t": "str", "v": "Minimal Submit App" },
  { "id": 0, "p": 2, "r": 1, "c": 0, "k": "ui_style_font_size", "t": "str", "v": "24px" },
  { "id": 0, "p": 2, "r": 1, "c": 0, "k": "ui_style_font_weight", "t": "str", "v": "700" },

  { "id": 0, "p": 2, "r": 2, "c": 0, "k": "ui_node_id", "t": "str", "v": "message_input" },
  { "id": 0, "p": 2, "r": 2, "c": 0, "k": "ui_component", "t": "str", "v": "Input" },
  { "id": 0, "p": 2, "r": 2, "c": 0, "k": "ui_parent", "t": "str", "v": "minimal_root" },
  { "id": 0, "p": 2, "r": 2, "c": 0, "k": "ui_order", "t": "int", "v": 20 },
  { "id": 0, "p": 2, "r": 2, "c": 0, "k": "ui_label", "t": "str", "v": "Message" },
  { "id": 0, "p": 2, "r": 2, "c": 0, "k": "ui_placeholder", "t": "str", "v": "Type a message" },
  { "id": 0, "p": 2, "r": 2, "c": 0, "k": "ui_bind_json", "t": "json", "v": { "read": { "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "input_text" }, "write": { "action": "label_update", "target_ref": { "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "input_text" }, "commit_policy": "on_submit" } } },

  { "id": 0, "p": 2, "r": 3, "c": 0, "k": "ui_node_id", "t": "str", "v": "submit_button" },
  { "id": 0, "p": 2, "r": 3, "c": 0, "k": "ui_component", "t": "str", "v": "Button" },
  { "id": 0, "p": 2, "r": 3, "c": 0, "k": "ui_parent", "t": "str", "v": "minimal_root" },
  { "id": 0, "p": 2, "r": 3, "c": 0, "k": "ui_order", "t": "int", "v": 30 },
  { "id": 0, "p": 2, "r": 3, "c": 0, "k": "ui_label", "t": "str", "v": "Submit" },
  { "id": 0, "p": 2, "r": 3, "c": 0, "k": "ui_variant", "t": "str", "v": "primary" },
  { "id": 0, "p": 2, "r": 3, "c": 0, "k": "ui_bind_json", "t": "json", "v": { "write": { "pin": "submit_request", "target_ref": { "model_id": 0, "p": 0, "r": 0, "c": 0 }, "value_t": "modeltable", "value_ref": [{ "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "ui_event.v1" }, { "id": 0, "p": 0, "r": 0, "c": 0, "k": "text", "t": "str", "v": { "$label": { "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "input_text" } } }], "commit_policy": "immediate" } } },

  { "id": 0, "p": 2, "r": 4, "c": 0, "k": "ui_node_id", "t": "str", "v": "display_label" },
  { "id": 0, "p": 2, "r": 4, "c": 0, "k": "ui_component", "t": "str", "v": "Text" },
  { "id": 0, "p": 2, "r": 4, "c": 0, "k": "ui_parent", "t": "str", "v": "minimal_root" },
  { "id": 0, "p": 2, "r": 4, "c": 0, "k": "ui_order", "t": "int", "v": 40 },
  { "id": 0, "p": 2, "r": 4, "c": 0, "k": "ui_bind_json", "t": "json", "v": { "read": { "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "display_text" } } },
  { "id": 0, "p": 2, "r": 4, "c": 0, "k": "ui_variant", "t": "str", "v": "success" }
]
```
<!-- minimal-submit-app-payload:end -->

## 6. 这个例子运行后会发生什么

1. 安装器把临时 `id: 0` 变成正式模型 id。
2. 页面显示标题、输入框、`Submit` 按钮和结果文字。
3. 用户输入 `hello` 时，输入过程先作为本地草稿处理；不会每个字符都强制变成正式业务结果。
4. 用户点击 `Submit` 后，按钮把 `text=hello` 作为临时 ModelTable payload 交给 `submit_request`。
5. `submit_request_wiring` 触发 `handle_submit`。
6. `handle_submit` 写回 `display_text = "Submitted: hello"`。
7. 显示用 `Text` 读取 `display_text`，页面展示结果。

## 7. 如何打包

zip 结构如下：

```text
minimal-submit-app.zip
└── app_payload.json
```

`app_payload.json` 必须是上面那种数组。不要交付这些内容：

- 不要放 `op: "add_label"`。
- 不要放安装后的正式 `model_id`。
- 不要放宿主生成的路由 label。
- 不要放 secret、token 或个人账号凭据。

## 8. 交付前自检

| 检查项 | 通过标准 |
|---|---|
| APP 可识别 | root 有 `model_type=model.table`、`app_name`、`slide_capable=true` |
| UI 可渲染 | root 有 `ui_authoring_version=cellwise.ui.v1` 和有效 `ui_root_node_id` |
| 粒度足够 | 输入框、按钮、显示 label 分别是不同 cell |
| submit 可触发 | root 有 `submit_request` `pin.in` 和 `submit_request_wiring` |
| 程序可运行 | `handle_submit` 是 `func.js`，代码非空 |
| 数据格式正确 | 按钮提交的是临时 ModelTable record array |
| 结果来源正确 | 显示文字由 `handle_submit` 写回，不由按钮直接改 |
