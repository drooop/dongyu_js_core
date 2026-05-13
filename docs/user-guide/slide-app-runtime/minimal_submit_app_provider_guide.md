---
title: "最小 Submit 双总线示例"
doc_type: user-guide
status: active
updated: 2026-05-13
source: ai
---

# 最小 Submit 双总线示例

本文说明一个最小滑动 App 如何由 provider 准备成 ZIP，进入 UI Server 后被安装为 Workspace 侧边栏里的 App，并通过双总线让 remote-worker `R1` 的 provider model `3000` 处理 Submit，最终把页面文字更新为 `Submitted: <输入内容>`。

一句话链路：

```text
UI click -> Model 0 -> Matrix -> MBR -> remote provider public pin -> same endpoint topic response -> reply_target records -> ui-server -> local UI model
```

当前规约的关键点是：

| 项 | 当前写法 |
|---|---|
| MQTT topic | `UIPUT/ws/dam/pic/de/sw/R1/3000/submit1` |
| topic 含义 | 请求和回包都使用同一个远端 endpoint：worker `R1`、model `3000`、pin `submit1` |
| 回包目标 | 不放在 topic；放在 payload records：`reply_target_worker_id = U1`、`reply_target_model_id = 2000`、`reply_target_pin = result` |
| 请求来源 | 放在 payload records：`origin_worker_id`、`origin_model_id`、`origin_pin` |
| 消息方向 | 放在 payload records：`message_role = request` 或 `message_role = response` |
| 业务数据 | 放在嵌套 `payload` record 中，仍是 ModelTable records array |
| 禁止项 | `route.reply_to`、`return_topic`、`returnTopic`、`result_topic`、旧 `worker/<id>/model/<id>/pin/<pin>` topic |

## 1. Remote worker `R1` 的 provider model `3000`

`R1` 不需要知道 UI Server 最后把 App 安装成本地 model `2000`、`3000` 还是其他 id。`R1` 只需要声明自己有 provider model `3000`，root `(0,0,0)` 暴露 `submit1 pin.in`，然后把它接到真正的程序模型 Cell。这个远端 endpoint 可以简写为：`R1 / 3000 / submit1`。

最小填表结构：

| Cell | label | type | 作用 |
|---|---|---|---|
| `(0,0,0)` | `submit1` | `pin.in` | 远端公开入口。MQTT topic 最后一段 `submit1` 会进入这里。 |
| `(0,0,0)` | `result` | `pin.out` | 远端公开出口。程序返回的 `pin_payload.v1` 从这里离开。 |
| `(0,0,0)` | `submit1_route` | `pin.connect.cell` | root `submit1` -> `(1,1,1).submit1_in`，以及 `(1,1,1).submit1_out` -> root `result`。 |
| `(1,1,1)` | `submit1_in` | `pin.in` | 程序模型 Cell 的输入引脚。 |
| `(1,1,1)` | `submit1_out` | `pin.out` | 程序模型 Cell 的输出引脚。 |
| `(1,1,1)` | `submit1_wiring` | `pin.connect.label` | `submit1_in` -> `submit1:in`，`submit1:out` -> `submit1_out`。 |
| `(1,1,1)` | `submit1` | `func.js` | 处理业务 payload，只读取 `text` record，返回严格 `pin_payload.v1`。 |

函数端点不能跨 Cell 直连。也就是说，不能把 root `(0,0,0)` 的 `submit1` 直接写成 `submit1:in`；必须先用 `pin.connect.cell` 进入 `(1,1,1).submit1_in`，再由同 Cell 的 `pin.connect.label` 触发 `submit1:in`。

远端程序模型的核心逻辑如下。完整 patch 在 `deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json`。

```javascript
const inputRecords = Array.isArray(label && label.v) ? label.v : [];
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const mt = (k, t, v) => ({ id: 0, p: 0, r: 0, c: 0, k, t, v });
const isRecord = (record) =>
  record && typeof record === 'object' && !Array.isArray(record)
  && Object.keys(record).sort().join(',') === 'c,id,k,p,r,t,v'
  && Number.isInteger(record.id)
  && Number.isInteger(record.p)
  && Number.isInteger(record.r)
  && Number.isInteger(record.c)
  && typeof record.k === 'string'
  && record.k.length > 0
  && typeof record.t === 'string'
  && record.t.length > 0
  && hasOwn(record, 'v');
const recordOf = (records, key) =>
  Array.isArray(records)
    ? records.find((record) => isRecord(record) && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key) || null
    : null;
const readString = (records, key, fallback = '') => {
  const record = recordOf(records, key);
  return record && record.t === 'str' && typeof record.v === 'string' && record.v.trim() === record.v ? record.v : fallback;
};
const readInt = (records, key) => {
  const record = recordOf(records, key);
  return record && record.t === 'int' && Number.isInteger(record.v) ? record.v : null;
};
const readJson = (records, key, fallback = null) => {
  const record = recordOf(records, key);
  return record && record.t === 'json' ? record.v : fallback;
};
const safeSegment = (value) =>
  typeof value === 'string'
  && value.trim() === value
  && value.length > 0
  && !value.includes('/')
  && !value.includes('+')
  && !value.includes('#');
const validEndpoint = (endpoint) =>
  safeSegment(endpoint.worker_id)
  && Number.isInteger(endpoint.model_id)
  && endpoint.model_id > 0
  && safeSegment(endpoint.pin);

const endpoint = {
  worker_id: readString(inputRecords, 'endpoint_worker_id'),
  model_id: readInt(inputRecords, 'endpoint_model_id'),
  pin: readString(inputRecords, 'endpoint_pin'),
};
const origin = {
  worker_id: readString(inputRecords, 'origin_worker_id'),
  model_id: readInt(inputRecords, 'origin_model_id'),
  pin: readString(inputRecords, 'origin_pin'),
};
const replyTarget = {
  worker_id: readString(inputRecords, 'reply_target_worker_id'),
  model_id: readInt(inputRecords, 'reply_target_model_id'),
  pin: readString(inputRecords, 'reply_target_pin'),
};
const messageRole = readString(inputRecords, 'message_role');
const businessPayload = readJson(inputRecords, 'payload', []);

if (
  readString(inputRecords, '__mt_payload_kind') !== 'pin_payload.v1'
  || messageRole !== 'request'
  || !validEndpoint(endpoint)
  || !validEndpoint(origin)
  || !validEndpoint(replyTarget)
  || !Array.isArray(businessPayload)
  || !businessPayload.every(isRecord)
) {
  V1N.addLabel('remote_status', 'str', 'pin_payload_invalid');
  return null;
}

const textRecord = recordOf(businessPayload, 'text');
const text = String(textRecord && textRecord.v != null ? textRecord.v : '').trim();
const resultPayload = [
  mt('display_text', 'str', 'Submitted: ' + (text || '(empty)')),
  mt('remote_status', 'str', 'remote_processed'),
  mt('last_submit_payload', 'json', businessPayload),
  mt('submit_inflight', 'bool', false),
];

// 等价展开时会出现以下字段：
// k: 'remote_status', t: 'str', v: 'remote_processed'
// k: 'last_submit_payload', t: 'json', v: businessPayload
// k: 'submit_inflight', t: 'bool', v: false
// v: businessPayload

const opId = 'submit1_result_' + Date.now();
return [
  mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
  mt('__mt_request_id', 'str', opId),
  mt('op_id', 'str', opId),
  mt('message_role', 'str', 'response'),
  mt('endpoint_worker_id', 'str', endpoint.worker_id),
  mt('endpoint_model_id', 'int', endpoint.model_id),
  mt('endpoint_pin', 'str', endpoint.pin),
  mt('origin_worker_id', 'str', 'R1'),
  mt('origin_model_id', 'int', 3000),
  mt('origin_pin', 'str', 'submit1'),
  mt('reply_target_worker_id', 'str', replyTarget.worker_id),
  mt('reply_target_model_id', 'int', replyTarget.model_id),
  mt('reply_target_pin', 'str', replyTarget.pin),
  mt('payload', 'json', resultPayload),
  mt('timestamp', 'int', Date.now()),
];
```

注意：`R1` 当前只接受 `text`。不要写旧的 `input_value`、`message_text` 或 `value.text` 兼容兜底。校验失败时写本地状态并 `return null`。

## 2. UI App JSON patch

当前基准文件是 `test_files/minimal_submit_dual_bus_app_payload.json`。它是一个 63 条 record 的 ModelTable records array。对应 ZIP 是 `test_files/minimal_submit_dual_bus.zip`，内部只有一个文件：`app_payload.json`。

这份 JSON patch 只包含 provider 可交付的 UI 模型，不包含安装后的正式 model id，不包含 Model 0 自动 labels，也不包含任何 `route.reply_to`。

### 2.1 完整 patch label 说明

| label | type | 含义 |
|---|---|---|
| `model_type` | `model.table` | 声明这是一个可安装的 UI 模型。 |
| `app_name` | `str` | Workspace 侧边栏显示名。 |
| `source_worker` | `str` | 交付来源说明。 |
| `slide_capable` | `bool` | 标记它是滑动 App。 |
| `slide_surface_type` | `str` | 表示页面挂载到 `workspace.page`。 |
| `from_user` / `to_user` | `str` | Matrix 管理总线示例用户。 |
| `ui_authoring_version` | `str` | 当前 UI 填表版本。 |
| `ui_root_node_id` | `str` | 根 UI 节点，例如 `minimal_submit_zip_root`。 |
| `input_text` | `str` | 输入框本地草稿。 |
| `display_text` | `str` | 页面结果文字，初始值 `Waiting for submit`。 |
| `remote_status` | `str` | 远端处理状态。 |
| `submit_inflight` | `bool` | Submit 是否正在等待回包。 |
| `last_submit_payload` | `json` | 最近一次提交的业务 ModelTable records。 |
| `host_ingress_v1` | `json` | 安装器生成 host ingress adapter 的声明。 |
| `remote_bus_endpoint_v1` | `json` | 远端 endpoint 默认目标：`R1 / 3000`。不写 `to.pin`。 |
| `dual_bus_model` | `json` | 声明 `egress_pins=["submit1"]`，让安装器生成 host egress adapter。 |
| `submit_request` | `pin.in` | root 内部提交入口。 |
| `submit1` | `pin.out` | 对外提交出口，也就是后续的 `endpoint_pin`。 |
| `submit_request_wiring` | `pin.connect.label` | root 内 `submit_request -> handle_submit:in`。 |
| `root_routes` | `pin.connect.cell` | 按钮 Cell 的 `click_chain` -> root `submit_request`。 |
| `handle_submit` | `func.js` | 读取 `text` / `source`，写本地状态，并把业务 payload 写到 `submit1 pin.out`。 |
| `ui_node_id` | `str` | UI 节点 id。 |
| `ui_component` | `str` | UI 组件类型，如 `Container`、`Card`、`Input`、`Button`、`StatusBadge`。 |
| `ui_layout` | `json` | 行列布局。 |
| `ui_gap` | `str` | UI 间距。 |
| `ui_parent` | `str` | 当前 UI 节点挂到哪个父节点。 |
| `ui_order` | `int` | 同一父节点下的排序。 |
| `ui_title` | `str` | Card 标题。 |
| `ui_placeholder` | `str` | Input 占位提示。 |
| `ui_bind_json` | `json` | 输入、点击、读写绑定。 |
| `ui_label` | `str` | Button 显示文字。 |
| `ui_variant` | `str` | Button / Badge 样式。 |
| `click_event` | `pin.in` | Submit 按钮接收浏览器写入的 Cell 入口。 |
| `click_event_wiring` | `pin.connect.label` | 同一个按钮 Cell 内把 `click_event` 转给 `click_chain`。 |
| `click_chain` | `pin.out` | Submit 按钮 Cell 对外发送事件的出口。 |
| `ui_text_ref_model_id` / `ui_text_ref_p` / `ui_text_ref_r` / `ui_text_ref_c` / `ui_text_ref_k` | scalar labels | Text / Badge 节点读取哪个 label。 |

## 3. Submit 类提交按钮怎么填

Submit 类提交按钮由三段组成：按钮 Cell labels、Root 入口、业务程序。

### 3.1 按钮 Cell labels

按钮 Cell 至少要有这些 labels。注意这里的字段名是 `write.pin`，不是普通对象里的任意 `pin`。浏览器点击先写入 `click_event pin.in`，再由同格的 `click_event_wiring` 转到 `click_chain pin.out`，这样不会让 UI 直接写一个对外出口：

```json
[
  { "k": "ui_component", "t": "str", "v": "Button" },
  { "k": "ui_label", "t": "str", "v": "Submit" },
  { "k": "click_event", "t": "pin.in", "v": null },
  { "k": "click_chain", "t": "pin.out", "v": null },
  { "k": "click_event_wiring", "t": "pin.connect.label", "v": [{ "from": "click_event", "to": ["click_chain"] }] },
  {
    "k": "ui_bind_json",
    "t": "json",
    "v": {
      "write": {
        "pin": "click_event",
        "value_t": "modeltable",
        "value_ref": [
          { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "ui_event.v1" },
          { "id": 0, "p": 0, "r": 0, "c": 0, "k": "text", "t": "str", "v": { "$label": { "p": 0, "r": 0, "c": 0, "k": "input_text" } } },
          { "id": 0, "p": 0, "r": 0, "c": 0, "k": "source", "t": "str", "v": "ui_button" }
        ]
      }
    }
  }
]
```

### 3.2 生效顺序

```text
ui_bind_json writes modeltable value_ref to click_event
click_event -> click_event_wiring -> click_chain
click_chain -> root_routes -> submit_request
submit_request -> submit_request_wiring -> handle_submit:in
handle_submit writes input_text / last_submit_payload / submit_inflight / remote_status
handle_submit writes business payload to submit1 pin.out
dual_bus_model.egress_pins contains submit1
generated host egress adapter wraps message_role / endpoint_worker_id / origin_worker_id / reply_target_worker_id
Model 0 mt_bus_send_in -> pin.bus.mb.out -> Matrix -> MBR -> UIPUT/ws/dam/pic/de/sw/R1/3000/submit1
```

`handle_submit` 只准备业务 payload：

```javascript
const payload = [
  { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'minimal_submit.request.v1' },
  { id: 0, p: 0, r: 0, c: 0, k: 'text', t: 'str', v: text },
  { id: 0, p: 0, r: 0, c: 0, k: 'source', t: 'str', v: source },
];
V1N.addLabel('input_text', 'str', text);
V1N.addLabel('last_submit_payload', 'json', payload);
V1N.addLabel('submit_inflight', 'bool', !!text);
V1N.addLabel('remote_status', 'str', text ? 'sending' : 'empty_input');
if (text) V1N.addLabel('submit1', 'pin.out', payload);
```

### 3.3 多个提交按钮

复杂界面可以有多个提交按钮，但每个按钮应有自己的链路。例如：

| 用途 | button pin | root pin | handler | egress pin |
|---|---|---|---|---|
| Submit | `click_event` -> `click_chain` | `submit_request` | `handle_submit` | `submit1` |
| Approve | `approve_click_event` -> `approve_click_chain` | `approve_request` | `handle_approve` | `approve1` |

每个 egress pin 都要列在 `dual_bus_model.egress_pins` 中。这样安装器会分别生成对应的 host egress adapter。

## 4. UI Server 安装过程

用户准备好 JSON patch 后，压缩成 ZIP，里面只有 `app_payload.json`。在 Workspace 的 `滑动 APP 导入` 上传后，UI Server 安装器会执行：

1. 解析 ZIP：只接受一个 `app_payload.json`，内容必须是 ModelTable records array。
2. 校验 provider records：拒绝 `op`、正式 `model_id`、`pin.bus.*`、`ui.egress.binding.v1`、`pin.connect.model`、`route.reply_to in zip`、`reply_target_*`、secret/token。
3. 分配本地 installed model id，例如 `2000`。
4. 把临时 records materialize 成正式模型。
5. 在 Workspace 侧边栏写入资产记录，所以用户能看到 `app_name` 并点击 Open。
6. 在 Model 0 的 Workspace mount cell 写 `model.submt`，把新 App 挂载为子模型。
7. 写 host-owned labels：`deletable`、`installed_at`、`imported_bundle_model_ids`、`import_root_temp_id`。
8. 生成 host ingress labels：`imported_host_submit_<modelId>`、`host_ingress_generated_model0_labels`、`host_ingress_generated_mount`、`host_ingress_generated_root_labels`。
9. 生成 host egress labels：`ui_egress_submit1_binding` / `ui.egress.binding.v1`、`imported_submit1_<modelId>_bus`、`bridge_imported_submit1_to_mt_bus_send_<modelId>`、`host_egress_generated_model0_labels`、`host_egress_generated_mount`。

安装后链路是：

```text
imported root submit1 pin.out -> Model 0 mount cell relay -> Model 0 (0,0,0) bridge_imported_submit1_to_mt_bus_send_<id>:in
-> Model 0 (0,0,0) mt_bus_send_in
-> Model 0 pin.bus.mb.out
```

host bridge 写入的 `bus_send.v1` records 形态如下：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "bus_send.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "bus_out_key", "t": "str", "v": "imported_submit1_2000_bus" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "message_role", "t": "str", "v": "request" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_worker_id", "t": "str", "v": "R1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_model_id", "t": "int", "v": 3000 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_pin", "t": "str", "v": "submit1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_worker_id", "t": "str", "v": "U1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_model_id", "t": "int", "v": 2000 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_pin", "t": "str", "v": "submit1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_worker_id", "t": "str", "v": "U1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_model_id", "t": "int", "v": 2000 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_pin", "t": "str", "v": "result" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "payload", "t": "json", "v": [{ "id": 0, "p": 0, "r": 0, "c": 0, "k": "text", "t": "str", "v": "hello" }] }
]
```

## 5. 外部客户端如何观察和模拟

观察请求时订阅：

```text
UIPUT/ws/dam/pic/de/sw/R1/3000/submit1
```

这条消息的外层只有：

```json
{ "version": "v1", "type": "pin_payload", "payload": "ModelTable records array" }
```

要模拟 `R1` 回包，不要发布到所谓 result topic。仍然发布到同一个 endpoint topic：

```text
UIPUT/ws/dam/pic/de/sw/R1/3000/submit1
```

回包 records 的 `endpoint_*` 仍指向 `R1 / 3000 / submit1`，并通过 `message_role = response` 表示这不是再次触发远端程序的请求。UI Server 本地目标只放在 `reply_target_*` records：

```json
{
  "version": "v1",
  "type": "pin_payload",
  "payload": [
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "pin_payload.v1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_request_id", "t": "str", "v": "manual_result_2000_001" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "op_id", "t": "str", "v": "manual_result_2000_001" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "message_role", "t": "str", "v": "response" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_worker_id", "t": "str", "v": "R1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_model_id", "t": "int", "v": 3000 },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_pin", "t": "str", "v": "submit1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_worker_id", "t": "str", "v": "R1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_model_id", "t": "int", "v": 3000 },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_pin", "t": "str", "v": "submit1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_worker_id", "t": "str", "v": "U1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_model_id", "t": "int", "v": 2000 },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_pin", "t": "str", "v": "result" },
    {
      "id": 0, "p": 0, "r": 0, "c": 0, "k": "payload", "t": "json",
      "v": [
        { "id": 0, "p": 0, "r": 0, "c": 0, "k": "display_text", "t": "str", "v": "Submitted: hello from external client" },
        { "id": 0, "p": 0, "r": 0, "c": 0, "k": "remote_status", "t": "str", "v": "remote_processed" },
        { "id": 0, "p": 0, "r": 0, "c": 0, "k": "last_submit_payload", "t": "json", "v": [] },
        { "id": 0, "p": 0, "r": 0, "c": 0, "k": "submit_inflight", "t": "bool", "v": false }
      ]
    }
  ]
}
```

MBR 收到 `message_role=response` 后会转回 Matrix；UI Server 只按 `reply_target_*` records materialize 到本地 UI 模型，不从 topic 推断本地 model id。远端 runtime 收到同一 topic 上的 `response` 时会忽略它，避免二次触发 `submit1` 程序。

## 6. 导出与交付

导出不是复制运行时数据库。它只导出当前 App 自己的 provider-authored records，不导出 host-owned labels。

可通过 Workspace 的 Zip 导出，也可调用：

```text
/api/slide-apps/<modelId>/export.zip
```

导出过滤规则会排除 `host_ingress_generated_*`、`host_egress_generated_*`、`bus_event*`、`owner_request`、`owner_route`、`__owner_last_*`、`deletable`、`installed_at`、`imported_bundle_model_ids`、`import_root_temp_id` 等安装态和运行态 labels。

## 7. 禁止残留清单

| 禁止写法 | 原因 |
|---|---|
| `route.reply_to` in zip | 回包目标必须由 UI Server 写入 `reply_target_*` records。 |
| `source_model_id` | 已被 `origin_model_id` / `reply_target_model_id` 取代。 |
| `worker/R1/model/3000/pin/submit1` 旧 topic | 当前只允许 `UIPUT/ws/dam/pic/de/sw/R1/3000/submit1`。 |
| `pin.connect.model` | 跨模型连接使用 `model.submt` + `pin.connect.cell`。 |
| `ctx.writeLabel/getLabel/rmLabel` | 当前业务副作用只能走模型表运行时允许的 pin / V1N API。 |
