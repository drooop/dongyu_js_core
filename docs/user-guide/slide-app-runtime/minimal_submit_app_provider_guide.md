---
title: "最小 Submit 双总线示例"
doc_type: user-guide
status: active
updated: 2026-07-16
source: ai
---

# 最小 Submit 双总线示例

本文说明一个最小滑动 App 如何由 provider 准备成 ZIP，进入 UI Server 后被安装为 Workspace 侧边栏里的 App，并通过双总线让 remote-worker `R1` 的 provider model `3000` 处理 Submit，最终把页面文字更新为 `Submitted: <输入内容>`。

一句话链路：

```text
UI click -> Model 0 control bus -> local MQTT -> remote provider public pin -> response_topic -> reply_target records -> ui-server -> local UI model
```

当前规约的关键点是：

| 项 | 当前写法 |
|---|---|
| request topic | `UIPUT/ws/dam/pic/de/R1/3000/submit1` |
| response topic | 以请求 records 中实际 `response_topic` 为准；Workspace Manager 安装的 App table 示例为 `UIPUT/ws/dam/pic/de/U1/1051/result`，这是 host transport endpoint，不是 App table 内部 root id |
| topic 含义 | `topic` 表示当前这条消息实际投递到哪里；请求投递到远端 endpoint，回包投递到 `response_topic` |
| 默认总线 | 同工作区请求默认走控制总线：`pin.bus.cb.out` -> local MQTT -> R1；MBR no-echo |
| 回包目标 | 由 UI Server 写入 `response_topic` 与 `reply_target_*`：`reply_target_worker_id = U1`、`reply_target_table_id = app:<...>`、`reply_target_model_id = 0`、`reply_target_pin = result` |
| 请求来源 | 放在 payload records：`origin_worker_id`、`origin_table_id`、`origin_model_id`、`origin_pin` |
| 消息方向 | 放在 payload records：`message_role = request` 或 `message_role = response` |
| 业务数据 | 与 envelope records 放在同一个 Temporary ModelTable array 中，通过 `payload_model_id` 指向业务 records |
| 禁止项 | `route.reply_to`、`return_topic`、`returnTopic`、`result_topic`、旧 `worker/<id>/model/<id>/pin/<pin>` topic |

## 1. Remote worker `R1` 的 provider model `3000`

`R1` 不需要知道 UI Server 最后把 App 安装到哪张 App instance table。`R1` 只需要声明自己有 provider model `3000`，root `(0,0,0)` 暴露 `submit1 pin.in`，然后把它接到真正的程序模型 Cell。这个远端 endpoint 可以简写为：`R1 / 3000 / submit1`。

最小填表结构：

| Cell | label | type | 作用 |
|---|---|---|---|
| `(0,0,0)` | `submit1` | `pin.in` | 远端公开入口。MQTT topic 最后一段 `submit1` 会进入这里。 |
| `(0,0,0)` | `result` | `pin.out` | 远端公开出口。程序返回的 `pin_payload.v2` 从这里离开。 |
| `(0,0,0)` | `submit1_route` | `pin.connect.cell` | root `submit1` -> `(1,1,1).submit1_in`，以及 `(1,1,1).submit1_out` -> root `result`。 |
| `(1,1,1)` | `submit1_in` | `pin.in` | 程序模型 Cell 的输入引脚。 |
| `(1,1,1)` | `submit1_out` | `pin.out` | 程序模型 Cell 的输出引脚。 |
| `(1,1,1)` | `submit1_wiring` | `pin.connect.label` | `submit1_in` -> `submit1:in`，`submit1:out` -> `submit1_out`。 |
| `(1,1,1)` | `submit1` | `func.js` | 处理业务 records，只读取 `payload_model_id` 指向的 `text` record，返回严格 `pin_payload.v2`。 |

函数端点不能跨 Cell 直连。也就是说，不能把 root `(0,0,0)` 的 `submit1` 直接写成 `submit1:in`；必须先用 `pin.connect.cell` 进入 `(1,1,1).submit1_in`，再由同 Cell 的 `pin.connect.label` 触发 `submit1:in`。

远端程序模型的核心逻辑如下。完整 patch 在 `deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json`。

```javascript
const inputRecords = Array.isArray(label && label.v) ? label.v : [];
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const mt = (k, t, v, id = 0) => ({ id, p: 0, r: 0, c: 0, k, t, v });
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
const payloadRecordsFor = (records) => {
  const payloadModelId = readInt(records, 'payload_model_id');
  return Number.isInteger(payloadModelId) && payloadModelId > 0
    ? records.filter((record) => isRecord(record) && record.id === payloadModelId)
    : [];
};
const safeSegment = (value) =>
  typeof value === 'string'
  && value.trim() === value
  && value.length > 0
  && !value.includes('/')
  && !value.includes('+')
  && !value.includes('#');
const validEndpoint = (endpoint, options = {}) => {
  if (
    !endpoint
    || !safeSegment(endpoint.worker_id)
    || !safeSegment(endpoint.table_id)
    || !Number.isInteger(endpoint.model_id)
    || !safeSegment(endpoint.pin)
  ) return false;
  if (endpoint.table_id === 'host') return endpoint.model_id > 0;
  return endpoint.model_id > 0 || (endpoint.model_id === 0 && options.allowNonHostModelZero === true);
};

const endpoint = {
  worker_id: readString(inputRecords, 'endpoint_worker_id'),
  table_id: readString(inputRecords, 'endpoint_table_id'),
  model_id: readInt(inputRecords, 'endpoint_model_id'),
  pin: readString(inputRecords, 'endpoint_pin'),
};
const origin = {
  worker_id: readString(inputRecords, 'origin_worker_id'),
  table_id: readString(inputRecords, 'origin_table_id'),
  model_id: readInt(inputRecords, 'origin_model_id'),
  pin: readString(inputRecords, 'origin_pin'),
};
const replyTarget = {
  worker_id: readString(inputRecords, 'reply_target_worker_id'),
  table_id: readString(inputRecords, 'reply_target_table_id'),
  model_id: readInt(inputRecords, 'reply_target_model_id'),
  pin: readString(inputRecords, 'reply_target_pin'),
};
const messageRole = readString(inputRecords, 'message_role');
const routeTopic = readString(inputRecords, 'topic');
const responseTopic = readString(inputRecords, 'response_topic');
const routeKind = readString(inputRecords, 'route_kind', 'control') || 'control';
const validRouteTopic = (value) => {
  if (typeof value !== 'string' || value.includes('+') || value.includes('#')) return false;
  const parts = value.split('/');
  return value.trim() === value && parts.length === 8 && parts[0] === 'UIPUT' && parts.every((part) => safeSegment(part)) && /^[1-9][0-9]*$/.test(parts[6]);
};
const validRouteKind = (value) => value === 'control' || value === 'management';
const transportEndpointFromTopic = (topic) => {
  if (!validRouteTopic(topic)) return null;
  const parts = topic.split('/');
  return {
    worker_id: parts[5],
    table_id: 'host',
    model_id: Number(parts[6]),
    pin: parts[7],
  };
};
const businessPayload = payloadRecordsFor(inputRecords);
const responseEndpoint = transportEndpointFromTopic(responseTopic);

if (
  readString(inputRecords, '__mt_payload_kind') !== 'pin_payload.v2'
  || recordOf(inputRecords, 'payload')
  || messageRole !== 'request'
  || !validEndpoint(endpoint)
  || !validEndpoint(origin, { allowNonHostModelZero: true })
  || !validEndpoint(replyTarget, { allowNonHostModelZero: true })
  || !validRouteTopic(routeTopic)
  || !validRouteTopic(responseTopic)
  || !validEndpoint(responseEndpoint)
  || responseTopic === routeTopic
  || !validRouteKind(routeKind)
  || businessPayload.length === 0
) {
  V1N.addLabel('remote_status', 'str', 'pin_payload_invalid');
  return null;
}

const textRecord = businessPayload.find((record) => record && record.k === 'text') || null;
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
  mt('__mt_payload_kind', 'str', 'pin_payload.v2'),
  mt('__mt_request_id', 'str', opId),
  mt('op_id', 'str', opId),
  mt('message_role', 'str', 'response'),
  mt('topic', 'str', responseTopic),
  mt('response_topic', 'str', responseTopic),
  mt('route_kind', 'str', routeKind),
  mt('bus', 'str', routeKind),
  mt('endpoint_worker_id', 'str', responseEndpoint.worker_id),
  mt('endpoint_table_id', 'str', responseEndpoint.table_id),
  mt('endpoint_model_id', 'int', responseEndpoint.model_id),
  mt('endpoint_pin', 'str', responseEndpoint.pin),
  mt('origin_worker_id', 'str', 'R1'),
  mt('origin_table_id', 'str', 'host'),
  mt('origin_model_id', 'int', 3000),
  mt('origin_pin', 'str', 'submit1'),
  mt('reply_target_worker_id', 'str', replyTarget.worker_id),
  mt('reply_target_table_id', 'str', replyTarget.table_id),
  mt('reply_target_model_id', 'int', replyTarget.model_id),
  mt('reply_target_pin', 'str', replyTarget.pin),
  mt('timestamp', 'int', Date.now()),
  mt('payload_model_id', 'int', 1),
  ...resultPayload.map((record) => ({ ...record, id: 1 })),
];
```

注意：`R1` 当前只接受 `text`。不要写旧的 `input_value`、`message_text` 或 `value.text` 兼容兜底。校验失败时写本地状态并 `return null`。

## 2. UI App JSON patch

当前基准文件是 `test_files/minimal_submit_dual_bus_app_payload.json`。它是一个 60 条 record 的 ModelTable records array。对应 ZIP 是 `test_files/minimal_submit_dual_bus.zip`，内部只有一个文件：`app_payload.json`。

这份 JSON patch 只包含 provider 可交付的 UI 模型，不包含安装后的 `table_id`、host transport endpoint、Model 0 自动 labels，也不包含任何 `route.reply_to`。

### 2.1 完整 patch label 说明

| label | type | 含义 |
|---|---|---|
| `model_type` | `model.table` | 声明这是一个可安装的 UI 模型。 |
| `app_name` | `str` | Workspace 侧边栏显示名。 |
| `slide_app_summary` | `str` | 滑动 App 简介，用于桌面/资产列表展示。 |
| `source_worker` | `str` | 交付来源说明。 |
| `slide_capable` | `bool` | 标记它是滑动 App。 |
| `slide_surface_type` | `str` | 表示页面挂载到 `workspace.page`。 |
| `from_user` / `to_user` | `str` | 历史示例用户字段；当前默认链路不依赖它们发送 Matrix。 |
| `ui_authoring_version` | `str` | 当前 UI 填表版本。 |
| `ui_root_node_id` | `str` | 根 UI 节点，例如 `minimal_submit_zip_root`。 |
| `input_text` | `str` | 输入框本地草稿。 |
| `display_text` | `str` | 页面结果文字，初始值 `Waiting for submit`。 |
| `remote_status` | `str` | 远端处理状态。 |
| `submit_inflight` | `bool` | Submit 是否正在等待回包。 |
| `last_submit_payload` | `json` | 最近一次提交的业务 ModelTable records。 |
| `host_ingress_v1` | `json` | 安装器生成 host ingress adapter 的声明。 |
| `remote_bus_endpoint_v1` | `json` | 远端 endpoint 默认目标：`R1 / 3000`。不写 `to.pin`。可选 `route_kind`，省略等同 `control`；写 `management` 时 UI Server 先走管理总线到 MBR。 |
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
| `ui_bind_read_json` | `json` | 只读绑定。本示例的 `StatusBadge` 用它读取同模型 `remote_status`，引用省略 `model_id`。 |
| `ui_label` | `str` | Button 显示文字。 |
| `ui_variant` | `str` | Button / Badge 样式。 |
| `click_event` | `pin.in` | Submit 按钮接收浏览器写入的 Cell 入口。 |
| `click_event_wiring` | `pin.connect.label` | 同一个按钮 Cell 内把 `click_event` 转给 `click_chain`。 |
| `click_chain` | `pin.out` | Submit 按钮 Cell 对外发送事件的出口。 |

### 2.1 同模型引用如何省略 `model_id`

Provider 准备 ZIP 时不知道 UI Server 会分配哪个 App instance `table_id`，所以 `app_payload.json` 里的同模型引用必须省略 `table_id` 和 `model_id`。

正确写法：

```json
{ "p": 0, "r": 0, "c": 0, "k": "input_text" }
```

错误写法：

```json
{ "model_id": 4100, "p": 0, "r": 0, "c": 0, "k": "input_text" }
```

不要在 `$label`、`ui_bind_json.read`、`ui_bind_json.write.target_ref`、`ui_bind_read_json` 或 `ui_props_json.tasksRef` 里把 `model_id: 0` 当作“当前模型”。在 ZIP record 外层，`id: 0` 表示包内局部 root model；安装后它仍是该 App table 内的 root model。但 UI 引用同模型 label 时仍应省略 `model_id`，由当前渲染上下文补足 `{table_id, model_id}`。

只有显式读取其他模型时才写 `model_id`，例如系统 overlay 模型或另一个已知模型。

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
generated host egress adapter wraps topic / route_kind / message_role / endpoint_worker_id / origin_worker_id / reply_target_worker_id
Model 0 mt_bus_send_in -> pin.bus.cb.out -> local MQTT -> R1 -> UIPUT/ws/dam/pic/de/R1/3000/submit1
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

每个 egress pin 都要列在 `dual_bus_model.egress_pins` 中。这样宿主才能把 App table root 的公开出口接入 host Model 0 的总线边界。

## 4. UI Server 安装过程

用户准备好 JSON patch 后，压缩成 ZIP，里面只有 `app_payload.json`。在 Workspace 的 `滑动 APP 导入` 上传时，UI Server 安装器会执行以下动作。

1. 解析 ZIP：只接受一个 `app_payload.json`，内容必须是 ModelTable records array。
2. 校验 provider records：拒绝 `op`、正式 `model_id`、`pin.bus.*`、`ui.egress.binding.v1`、`pin.connect.model`、`route.reply_to in zip`、`reply_target_*`、secret/token。
3. 分配 App instance `table_id`，例如 `app:subject:drop:minimal-submit:001`。
4. 把 package records materialize 到这张 App table；包内 `id: 0` 仍是该表内 root model，不会 remap 成 host 全局正数模型。
5. 在 Workspace 资产记录里写入 `table_id` 与 root `model_id`，所以用户能看到 `app_name` 并点击 Open。
6. 在 host Model 0 的 Workspace index cell 写 `model.subtableconnection`，指向新 App table；App table 自己的 Model 0 root 声明 `model.subtable`。
7. 写 host-owned 安装态 labels，例如 `deletable`、`installed_at`、`import_root_temp_id`、`last_installed_table_id`、`last_installed_model_id`。
8. 后续打开 App 时，前端使用 table-qualified `visible_model_ref={table_id,model_id}` 拉取该 App table 的可见 labels。
9. 运行时外发与回包必须使用 `origin_table_id` / `reply_target_table_id`；ZIP 不能预先声明这些宿主拥有的值。

安装器会在 App table root 和 host Model 0 上生成以下 labels；这些都不是 provider ZIP 应填写的内容：

| label | 位置 | 作用 |
|---|---|---|
| `deletable` / `installed_at` / `imported_bundle_model_ids` / `import_root_temp_id` | App table root model `0` | 标记这是可删除的本地安装实例，并记录安装来源。 |
| `host_ingress_generated_model0_labels` | App table root model `0` | 记录 host Model 0 上生成的入口 labels，例如 `imported_host_submit_<table>_0`。 |
| `host_ingress_generated_mount` | App table root model `0` | 记录这个 App table 由哪个 Model 0 parent-side `model.subtableconnection` connection/index Cell 索引。 |
| `host_ingress_generated_root_labels` | App table root model `0` | 记录 App root 上为入口中继生成的 root labels。 |
| `host_egress_generated_model0_labels` | App table root model `0` | 记录 host Model 0 上生成的出站 labels，例如 `imported_submit1_<table>_0_bus` 与 `bridge_imported_submit1_to_mt_bus_send_<table>_0`。 |
| `host_egress_generated_mount` | App table root model `0` | 记录出站桥接的 parent-side connection/index Cell 与 egress semantic。 |
| `ui_egress_submit1_binding` | App table root model `0` | 记录 `submit1` 已被安装器绑定到 host bus egress，类型是 `ui.egress.binding.v1`。 |

生成 key 的前缀可用于排查：入口通常以 `imported_host_submit_` 开头；出站 bus label 通常以 `imported_submit1_` 开头；桥接函数通常以 `bridge_imported_submit1_to_mt_bus_send_` 开头。最终写到 Model 0 `(0,0,0)` 的仍是 `mt_bus_send_in`，再由 Model 0 发出 `pin.bus.cb.out` 或 `pin.bus.mb.out`。

安装后的边界链路是：

```text
App table root submit1 pin.out
-> host Model 0 model.subtableconnection boundary
-> Model 0 pin.bus.cb.out
```

换句话说，imported root 的 `submit1` 不会直接跨表连到别的模型；它必须先经过 host 侧 `model.subtableconnection` 边界，再到 host Model 0，由 Model 0 继续把消息送进 control bus。`model.subtable` 只写在 App table 自己的 root 上，用于声明“这是一张 child App table”。

如果 `remote_bus_endpoint_v1.route_kind` 显式写为 `management`，最后一步会变为：

```text
-> Model 0 pin.bus.mb.out
-> management bus
-> MBR
-> payload topic 指向的控制总线 / MQTT
-> Remote Worker
```

这不会改变远端 request topic，但会增加独立的 `response_topic`；MBR 仍只按当前 payload records 中的 `topic` record 转发当前消息。

host bridge 写入的 `bus_send.v1` records 形态如下：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "bus_send.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "bus_out_key", "t": "str", "v": "app_submit1_bus" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "bus", "t": "str", "v": "control" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "route_kind", "t": "str", "v": "control" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "topic", "t": "str", "v": "UIPUT/ws/dam/pic/de/R1/3000/submit1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "response_topic", "t": "str", "v": "UIPUT/ws/dam/pic/de/U1/1051/result" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "message_role", "t": "str", "v": "request" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_worker_id", "t": "str", "v": "R1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_table_id", "t": "str", "v": "host" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_model_id", "t": "int", "v": 3000 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_pin", "t": "str", "v": "submit1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_worker_id", "t": "str", "v": "U1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_table_id", "t": "str", "v": "app:subject:drop:minimal-submit:001" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_model_id", "t": "int", "v": 0 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_pin", "t": "str", "v": "submit1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_worker_id", "t": "str", "v": "U1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_table_id", "t": "str", "v": "app:subject:drop:minimal-submit:001" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_model_id", "t": "int", "v": 0 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_pin", "t": "str", "v": "result" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "payload_model_id", "t": "int", "v": 1 },
  { "id": 1, "p": 0, "r": 0, "c": 0, "k": "text", "t": "str", "v": "hello" }
]
```

## 5. 外部客户端如何观察和模拟

观察请求时订阅：

```text
UIPUT/ws/dam/pic/de/R1/3000/submit1
```

这条消息的外层只有：

```json
{ "version": "v1", "type": "pin_payload", "payload": "ModelTable records array" }
```

要模拟 `R1` 回包，必须发布到请求 records 里的实际 `response_topic`。注意：这个 topic 是 UI Server 的 host transport endpoint；真正写回哪个 App instance table 由 `reply_target_table_id + reply_target_model_id` 决定。Workspace Manager 安装路径下通常是：

```text
UIPUT/ws/dam/pic/de/U1/1051/result
```

回包 records 的 `topic` 和 `response_topic` 都应等于这条 response topic。回包 records 的 `endpoint_*` 描述当前 transport 投递目标，也就是 host endpoint，例如 `U1 / 1051 / result`；`reply_target_*` 描述最终 materialize 的 App table 目标；`origin_*` 仍记录远端 provider，即 `R1 / 3000 / submit1`：

```json
{
  "version": "v1",
  "type": "pin_payload",
  "payload": [
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "pin_payload.v2" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_request_id", "t": "str", "v": "manual_result_app_table_001" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "op_id", "t": "str", "v": "manual_result_app_table_001" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "message_role", "t": "str", "v": "response" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "bus", "t": "str", "v": "control" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "route_kind", "t": "str", "v": "control" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "topic", "t": "str", "v": "UIPUT/ws/dam/pic/de/U1/1051/result" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "response_topic", "t": "str", "v": "UIPUT/ws/dam/pic/de/U1/1051/result" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_worker_id", "t": "str", "v": "U1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_table_id", "t": "str", "v": "host" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_model_id", "t": "int", "v": 1051 },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_pin", "t": "str", "v": "result" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_worker_id", "t": "str", "v": "R1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_table_id", "t": "str", "v": "host" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_model_id", "t": "int", "v": 3000 },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_pin", "t": "str", "v": "submit1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_worker_id", "t": "str", "v": "U1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_table_id", "t": "str", "v": "app:subject:drop:minimal-submit:001" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_model_id", "t": "int", "v": 0 },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_pin", "t": "str", "v": "result" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "payload_model_id", "t": "int", "v": 1 },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "timestamp", "t": "int", "v": 1700000000000 },
    { "id": 1, "p": 0, "r": 0, "c": 0, "k": "display_text", "t": "str", "v": "Submitted: hello from external client" },
    { "id": 1, "p": 0, "r": 0, "c": 0, "k": "remote_status", "t": "str", "v": "remote_processed" },
    { "id": 1, "p": 0, "r": 0, "c": 0, "k": "last_submit_payload", "t": "json", "v": [] },
    { "id": 1, "p": 0, "r": 0, "c": 0, "k": "submit_inflight", "t": "bool", "v": false }
  ]
}
```

默认 control 回包由 provider/R1 直接发布到 `response_topic` 对应的 local MQTT topic，UI Server 直接接收，MBR 不得转发或回显。只有请求显式使用 `route_kind=management` 时，response 才经 Matrix/Synapse 与 MBR 返回一次。UI Server 始终以 `reply_target_*` records 作为正式写回目标，不从 request topic 推断本地 model id。

## 6. 导出与交付

导出不是复制运行时数据库。它只导出当前 App 自己的 provider-authored records，不导出 host-owned labels。

可通过 Workspace 的 Zip 导出。对安装后的 App instance table，也可调用 table-qualified 导出接口：

```text
/api/slide-apps/export.zip?table_id=<encoded-table-id>&model_id=0
```

正式导出路径必须显式带 `table_id`。即使导出 host table 内的 App，也应使用：

```text
/api/slide-apps/export.zip?table_id=host&model_id=<model-id>
```

旧的 `/api/slide-apps/<modelId>/export.zip` 已废弃，当前实现会拒绝该路径。

导出过滤规则会排除 `host_ingress_generated_*`、`host_egress_generated_*`、`bus_event*`、`owner_request`、`owner_route`、`__owner_last_*`、`deletable`、`installed_at`、`imported_bundle_model_ids`、`import_root_temp_id` 等安装态和运行态 labels。

## 7. 禁止残留清单

| 禁止写法 | 原因 |
|---|---|
| `route.reply_to` in zip | 回包目标必须由 UI Server 写入 `reply_target_*` records。 |
| `source_model_id` | 已被 table-qualified `origin_table_id + origin_model_id` / `reply_target_table_id + reply_target_model_id` 取代。 |
| `worker/R1/model/3000/pin/submit1` 旧 topic | 当前只允许 `UIPUT/ws/dam/pic/de/R1/3000/submit1`。 |
| `pin.connect.model` | 跨模型连接必须经过父侧 `model.submtconnection` Cell boundary pins 与 child root boundary pins；跨 App table 必须经过父侧 `model.subtableconnection` Cell boundary pins 与 child table root boundary pins；`pin.connect.cell` 只用于同一模型 / 同一表内部。`model.submt` / `model.subtable` 只负责 child 侧身份声明。 |
| `ctx.writeLabel/getLabel/rmLabel` | 当前业务副作用只能走模型表运行时允许的 pin / V1N API。 |
