---
title: "Slide App Runtime Developer Guide"
doc_type: user-guide
status: active
updated: 2026-04-29
source: ai
---

# Slide App Runtime Developer Guide

这份手册说明当前滑动 APP 的完整开发和运行链路。它不是新规约，而是把仓库里已经实现的 current truth 写成开发者可操作说明。

## 1. 先记住四条主线

| 主线 | 解决的问题 | 当前结论 |
|---|---|---|
| 编写 | 开发者怎样把 APP 写成模型表 | root metadata、UI 投影层、可选程序层、可选外发层都写成 ModelTable records |
| 安装 | zip 怎样变成 Workspace 里的一个 APP | `zip -> /api/media/upload -> mxc://... -> importer truth -> importer click pin -> materialize / mount` |
| 运行 | 用户点按钮后怎样到达后端目标单元格 | 前端发 `bus_event_v2`，server 写 Model 0 `pin.bus.in`，再由 pin route 进入目标模型 |
| 外发 | APP 怎样发管理总线消息 | app root `pin.out -> host / mount relay -> Model 0 mt_bus_send -> pin.bus.out` |

正式业务数据在传输过程中使用临时 ModelTable record array。这个数组“像模型表”，但不会自动落盘；只有安装、导入或 owner materialization 这类显式动作才会把它变成正式模型表 truth。

正式业务 ingress 的固定链路是：

```text
bus_event_v2 -> Model 0 (0,0,0) pin.bus.in -> pin route -> target
```

## 2. root 第 0 格默认有什么

每个 `model.table` 的 root cell `(0,0,0)` 会由 runtime 自动 seed 三条默认程序链。它们来自 `packages/worker-base/system-models/default_table_programs.json`。

不要把它理解成三对普通业务引脚。更准确的说法是“三条 root 默认程序链”。

| 程序链 | 默认 label | 作用 |
|---|---|---|
| 写格子 | `mt_write`、`mt_write_req`、`mt_write_result`、`mt_write_req_route` | 接收 `write_label.v1` 临时 ModelTable payload，并在当前模型内写一个目标 cell / label |
| 总线接收 | `mt_bus_receive`、`mt_bus_receive_in`、`mt_bus_receive_wiring` | 接收从 Model 0 或其他 pin route 过来的正式业务 payload，再派发给本模型目标 cell |
| 总线发送 | `mt_bus_send`、`mt_bus_send_in`、`mt_bus_send_wiring` | 接收外发请求，构造 `bus_send.v1`，最终写到 Model 0 的 `pin.bus.out` 链 |

开发者通常不需要手写这三条链。你要做的是：

- 在自己的 APP root 上声明 UI 和业务入口。
- 在业务 cell 上声明 `pin.in`、`pin.out`、`func.js` 和 wiring。
- 把正式业务提交做成临时 ModelTable payload，让默认链去派发。

## 3. 编写一个滑动 APP

一个滑动 APP 包通常至少包含 root metadata 和 UI 投影层。如果要触发后端逻辑，再加程序层。如果要发出管理总线消息，再加外发层。

### 3.1 root metadata

root metadata 写在导入包的临时 root model `(0,0,0)`：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "UI.MySlideApp" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "app_name", "t": "str", "v": "My Slide App" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "slide_capable", "t": "bool", "v": true },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "slide_surface_type", "t": "str", "v": "workspace.page" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "ui_authoring_version", "t": "str", "v": "cellwise.ui.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "ui_root_node_id", "t": "str", "v": "app_root" }
]
```

这些 label 让 Workspace 能识别和打开这个 APP。它们不等于页面布局。

### 3.2 UI 投影层

UI 投影层用 `cellwise.ui.v1` 填表。每个 UI node 尽量对应一个 cell，不要把整个页面塞进一个大 JSON 或 HTML 字符串。

```json
[
  { "id": 0, "p": 2, "r": 0, "c": 0, "k": "ui_node_id", "t": "str", "v": "app_root" },
  { "id": 0, "p": 2, "r": 0, "c": 0, "k": "ui_component", "t": "str", "v": "Container" },

  { "id": 0, "p": 2, "r": 1, "c": 0, "k": "ui_node_id", "t": "str", "v": "title" },
  { "id": 0, "p": 2, "r": 1, "c": 0, "k": "ui_component", "t": "str", "v": "Text" },
  { "id": 0, "p": 2, "r": 1, "c": 0, "k": "ui_parent", "t": "str", "v": "app_root" },
  { "id": 0, "p": 2, "r": 1, "c": 0, "k": "ui_props_json", "t": "json", "v": { "text": "Send to bus" } },

  { "id": 0, "p": 2, "r": 2, "c": 0, "k": "ui_node_id", "t": "str", "v": "send_button" },
  { "id": 0, "p": 2, "r": 2, "c": 0, "k": "ui_component", "t": "str", "v": "Button" },
  { "id": 0, "p": 2, "r": 2, "c": 0, "k": "ui_parent", "t": "str", "v": "app_root" },
  { "id": 0, "p": 2, "r": 2, "c": 0, "k": "ui_props_json", "t": "json", "v": { "label": "Send" } }
]
```

这表示：

- `(2,0,0)` 是页面根容器。
- `(2,1,0)` 是标题。
- `(2,2,0)` 是按钮。
- 文案、布局、父子关系都由 label 决定。

### 3.3 程序层

如果按钮要触发后端逻辑，需要为目标 cell 声明输入 pin、处理函数和 wiring。

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "submit_request", "t": "pin.in", "v": null },
  {
    "id": 0,
    "p": 0,
    "r": 0,
    "c": 0,
    "k": "submit_request_wiring",
    "t": "pin.connect.label",
    "v": [{ "from": "(self, submit_request)", "to": ["(func, handle_submit:in)"] }]
  },
  {
    "id": 0,
    "p": 0,
    "r": 0,
    "c": 0,
    "k": "handle_submit",
    "t": "func.js",
    "v": {
      "code": "const payload = Array.isArray(label && label.v) ? label.v : [];\nV1N.addLabel('status_text', 'str', 'received');\nreturn;"
    }
  }
]
```

这段的意思是：

- `submit_request` 是本 APP 的业务入口。
- `submit_request_wiring` 把这个入口接到 `handle_submit`。
- `handle_submit` 只在后端模型表运行处被触发，前端不会直接运行它。

## 4. 安装部署过程

滑动 APP 安装不是把 HTML 放进浏览器，而是把临时 ModelTable records 安装成正式模型。

正式安装链是：

```text
zip -> /api/media/upload -> mxc://... -> importer truth -> importer click pin -> materialize / mount
```

开发者要准备的 zip 至少包含：

```text
my-slide-app.zip
└── app_payload.json
```

`app_payload.json` 是临时 ModelTable record array。每条 record 至少包含：

| 字段 | 含义 |
|---|---|
| `id` | 临时模型 id。导入时会被 remap 成正式正数模型 id |
| `p/r/c` | cell 坐标 |
| `k` | label key |
| `t` | label type |
| `v` | label value |

安装时 server 会做这些事：

1. 从 media cache 读取 `mxc://...` 对应 zip。
2. 校验 `app_payload.json`。
3. 为临时模型 id 分配正式正数模型 id。
4. 把临时 records materialize 到 runtime。
5. 在 Model 0 的 Workspace mount 区写 `model.submt`，把 APP 挂到 Workspace。
6. 如果声明了 host ingress / egress，自动补宿主 adapter。

## 5. 安装时哪些引脚会自动建立

导入包可以在 root `(0,0,0)` 声明 `host_ingress_v1`，表示“这个 APP 愿意让宿主把正式业务入口接进来”。

最小声明示例：

```json
{
  "k": "host_ingress_v1",
  "t": "json",
  "v": {
    "version": "v1",
    "boundaries": [{
      "semantic": "submit",
      "pin_name": "submit_request",
      "value_t": "modeltable",
      "locator_kind": "root_relative_cell",
      "locator_value": { "p": 0, "r": 0, "c": 0 },
      "primary": true
    }]
  }
}
```

安装后宿主自动补：

| 位置 | 自动 label | 作用 |
|---|---|---|
| imported root `(0,0,0)` | `__host_ingress_submit` `pin.in` | imported APP 的宿主入口 relay |
| imported root `(0,0,0)` | `__host_ingress_submit_route` `pin.connect.cell` | relay 到声明的 `submit_request` |
| Model 0 root `(0,0,0)` | `imported_host_submit_<modelId>` `pin.bus.in` | 宿主入口 |
| Model 0 root `(0,0,0)` | `imported_host_submit_<modelId>_route` `pin.connect.model` | 从 Model 0 路由到 imported root relay |

如果 root 还声明了 `dual_bus_model` 并且有 root `submit` `pin.out`，宿主还会补外发 adapter：

| 位置 | 自动 label | 作用 |
|---|---|---|
| Model 0 mount cell | `__host_egress_submit_relay_<modelId>` `pin.in` | 接住 imported root `submit` |
| Model 0 mount cell | `__host_egress_submit_bridge_<modelId>` `pin.connect.label` | 把 imported root `submit` 接到 mount relay |
| Model 0 root `(0,0,0)` | `__host_egress_submit_bridge_in_<modelId>` `pin.in` | relay 到 root bridge function |
| Model 0 root `(0,0,0)` | `bridge_imported_submit_to_mt_bus_send_<modelId>` `func.js` | 构造 `bus_send.v1` 临时 ModelTable payload |
| Model 0 root `(0,0,0)` | `imported_submit_<modelId>_bus` `pin.bus.out` | 统一外发边界 |

这些自动 label 是宿主责任。开发者不应在 zip 里写死安装后的正式 `modelId`。

## 6. 点击按钮后怎样到达后端目标 cell

当前前端按钮有两类状态：

- 本地草稿：输入框正在打字、hover、focus、临时选中等，不算正式业务。
- 正式提交：send、submit、execute、confirm 等，要进入后端业务链。

正式提交链是：

```text
Button click
-> renderer builds bus_event_v2
-> remote store POST /bus_event
-> server validates temporary ModelTable payload
-> server writes Model 0 (0,0,0) k=<bus_in_key> t=pin.bus.in
-> pin.connect.model routes to target model root pin.in
-> target model mt_bus_receive_in
-> mt_bus_receive dispatches write_label.v1
-> target cell receives target pin.in
-> target func.js runs
```

按钮的 `ui_bind_json.write` 应该发出临时 ModelTable payload。典型 payload 是 `write_label.v1`：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "write_label.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_request_id", "t": "str", "v": "op_001" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_target_cell", "t": "json", "v": { "p": 0, "r": 0, "c": 0 } },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "submit_request", "t": "pin.in", "v": [{ "id": 0, "p": 0, "r": 0, "c": 0, "k": "text", "t": "str", "v": "hello" }] }
]
```

重要限制：

- `/bus_event` 不接受普通对象当正式 payload。
- `bus_event_v2.value` 必须已经是临时 ModelTable record array。
- 当前 HTTP ingress 的 `bus_in_key` 有 server allow-list；不能让前端随便写任意动态 key。
- imported app 安装生成的 `imported_host_submit_<modelId>` 是宿主接入点；如果要让某个 UI 按钮使用它，必须先通过投影 / server 规则显式允许，而不是绕过 allow-list。

## 7. 后端程序模型如何编写和触发

后端程序模型仍然是模型表的一部分。一个最小处理链通常包含：

| label | 类型 | 用途 |
|---|---|---|
| `submit_request` | `pin.in` | 入口 pin |
| `submit_request_wiring` | `pin.connect.label` | 把入口接到函数 |
| `handle_submit` | `func.js` | 处理临时 ModelTable payload |
| `submit` | `pin.out` | 可选，处理后要外发时使用 |

函数里读取的是 `label.v`，也就是 pin 收到的 payload。函数不应该调用旧的 `ctx.writeLabel` / `ctx.getLabel`。当前应使用 V1N 能力，例如 `V1N.addLabel(...)`，或者把请求交给 root 默认 `mt_write` / `mt_bus_send` 链。

一个需要外发的 handler 可以这样做：

```js
const records = Array.isArray(label && label.v) ? label.v : [];
const text = String((records.find((rec) => rec.k === 'text') || {}).v || '').trim();
const payload = [
  { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'app.submit.v1' },
  { id: 0, p: 0, r: 0, c: 0, k: 'message_text', t: 'str', v: text },
  { id: 0, p: 0, r: 0, c: 0, k: 'source_model_id', t: 'int', v: ctx.self.model_id }
];
if (text) V1N.addLabel('submit', 'pin.out', payload);
return;
```

这段不会直接发 Matrix / MQTT / MBR。它只写 app root 的 `submit` `pin.out`，后续由安装时自动生成的 host egress adapter 接管。

## 8. UI 模型怎样向自己的第 0 格发管理总线消息

如果 APP 需要外发管理总线消息，推荐链路是：

```text
target func.js
-> app root submit pin.out
-> Model 0 mount relay
-> Model 0 bridge_imported_submit_to_mt_bus_send_<modelId>
-> Model 0 mt_bus_send_in
-> Model 0 mt_bus_send
-> Model 0 pin.bus.out
-> Matrix / MBR / MQTT
```

关键点：

- APP 自己只写自己的 root `pin.out`。
- 宿主在安装时已经知道这个 APP 挂在哪个 Model 0 mount cell。
- 宿主 relay 把 app root `pin.out` 转成 Model 0 的 `mt_bus_send_in`。
- `mt_bus_send` 再统一写 `pin.bus.out`。
- Matrix / MBR / MQTT 只消费 Model 0 `pin.bus.out`。

因此，开发者要写的是“我这个 APP 的业务完成后产生了什么 payload”，不是“我怎样直接发 Matrix 消息”。

## 9. 快速检查清单

交付 zip 前，确认这些项：

- root `(0,0,0)` 有 `model_type = model.table`、`app_name`、`slide_capable = true`。
- UI 使用 `cellwise.ui.v1`，组件拆成多个 cell。
- 按钮的正式提交 payload 是临时 ModelTable record array。
- 程序入口有 `pin.in` 和 `pin.connect.label`。
- 需要宿主接入时声明 `host_ingress_v1`，locator 使用 `root_relative_cell`。
- 需要外发时有 root `submit` `pin.out` 和 `dual_bus_model` 声明。
- 不写死导入后的正式 `modelId`。
- 不使用旧 `ctx.writeLabel` / `ctx.getLabel`。
- 不让前端 direct 写目标业务 truth。

## 10. 和旧文档口径的区别

较早文档曾把浏览器事件描述成可以先直接到目标 cell。当前这不是正式业务入口。

当前要区分：

- 本地 UI 草稿可以留在前端或 overlay。
- 正式业务必须进入 Model 0 `pin.bus.in`。
- 后端目标 cell 的实际变化，是 `mt_bus_receive` / `mt_write` 等模型表链路处理后的结果，不是浏览器直接改出来的结果。
