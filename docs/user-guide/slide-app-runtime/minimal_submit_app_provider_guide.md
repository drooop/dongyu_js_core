---
title: "Minimal Submit Dual-Bus Slide App Provider Guide"
doc_type: user-guide
status: active
updated: 2026-05-07
source: ai
---

# 最小 Submit 双总线示例

这份文档面向滑动 APP 提供方和 remote-worker 提供方。目标是讲清一个最小应用如何从页面按钮走完整双总线，并把 remote-worker 的结果回写到 UI。

本项目当前可直接实测的参考应用在 Workspace 里，名字是 `最小 Submit 双总线示例`，模型 id 是 `1050`。

用户在浏览器输入内容后点击 `Submit`，最终显示应从 `Waiting for submit` 变成：

```text
Submitted: <输入内容>
```

正式路径是：

```text
UI click -> Model 0 -> Matrix -> MBR -> MQTT -> remote-worker R1 -> MQTT -> MBR -> Matrix -> ui-server -> UI model
```

通用写法等价为：

```text
UI click -> Model 0 -> Matrix -> MBR -> MQTT -> remote-worker -> MQTT -> MBR -> Matrix -> ui-server -> UI model
```

关键值如下：

| 名称 | 值 |
|---|---|
| UI 模型 | `1050` |
| UI 入口 | `bus_event_submit_1050_0_0_0` |
| Matrix event type | `dy.bus.v0` |
| MBR Matrix 目标用户 | `@mbr:<host_url>` |
| submit topic | `UIPUT/ws/dam/pic/de/sw/1050/submit` |
| result topic | `UIPUT/ws/dam/pic/de/sw/1050/result` |
| remote-worker 程序 | `on_minimal_submit_matrix_remote_submit` |

## 1. remote-worker R1 应该怎么填

如果新建一个 remote-worker `R1`，它不需要关心 UI 如何渲染。`R1` 只负责接收 submit topic 上的临时 ModelTable payload，运行自己的程序模型，然后把结果发到 result topic。

### 1.1 填表过程

1. 在 `R1` 上创建模型 `1050`，类型是 `model.table`。
2. 在 `R1` 的模型 `1050` 根单元格 `(0,0,0)` 填运行状态 labels：`display_text`、`remote_status`、`submit_inflight`、`last_submit_payload`。
3. 在同一个根单元格声明两个普通引脚：`submit` 是 `pin.in`，`result` 是 `pin.out`。
4. 用 `pin.connect.label` 把 `submit` 接到 `on_minimal_submit_matrix_remote_submit:in`，再把程序的 out 接到 `result`。
5. `on_minimal_submit_matrix_remote_submit` 只读取 payload 里的 `text` record，不接受旧字段兜底。
6. 程序生成 `display_text`、`remote_status`、`last_submit_payload`、`submit_inflight` 四条结果 records，并发布到 `UIPUT/ws/dam/pic/de/sw/1050/result`。
7. 在 `R1` 的配置模型里订阅 `UIPUT/ws/dam/pic/de/sw/1050/submit` 和 `UIPUT/ws/dam/pic/de/sw/1050/result`。

### 1.2 R1 最终填写内容

下面是本项目部署 `R1` 时使用的最终内容。开发者手工填表时，含义就是“在模型 `1050` 的 `(0,0,0)` 放这些 labels”。

```json
[
  { "op": "create_model", "model_id": 1050, "name": "minimal_submit_matrix_example_remote", "type": "ui" },
  { "op": "add_label", "model_id": 1050, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "UI.MinimalSubmitMatrixRemoteTruth" },
  { "op": "add_label", "model_id": 1050, "p": 0, "r": 0, "c": 0, "k": "display_text", "t": "str", "v": "Waiting for submit" },
  { "op": "add_label", "model_id": 1050, "p": 0, "r": 0, "c": 0, "k": "remote_status", "t": "str", "v": "idle" },
  { "op": "add_label", "model_id": 1050, "p": 0, "r": 0, "c": 0, "k": "submit_inflight", "t": "bool", "v": false },
  { "op": "add_label", "model_id": 1050, "p": 0, "r": 0, "c": 0, "k": "last_submit_payload", "t": "json", "v": [] },
  { "op": "add_label", "model_id": 1050, "p": 0, "r": 0, "c": 0, "k": "submit", "t": "pin.in", "v": null },
  { "op": "add_label", "model_id": 1050, "p": 0, "r": 0, "c": 0, "k": "result", "t": "pin.out", "v": null },
  { "op": "add_label", "model_id": 1050, "p": 0, "r": 0, "c": 0, "k": "result_out_topic", "t": "str", "v": "UIPUT/ws/dam/pic/de/sw/1050/result" },
  {
    "op": "add_label",
    "model_id": 1050,
    "p": 0,
    "r": 0,
    "c": 0,
    "k": "root_routes",
    "t": "pin.connect.label",
    "v": [
      { "from": "submit", "to": ["on_minimal_submit_matrix_remote_submit:in"] },
      { "from": "on_minimal_submit_matrix_remote_submit:out", "to": ["result"] }
    ]
  }
]
```

程序模型 `on_minimal_submit_matrix_remote_submit` 的内容如下：

```js
const payload = Array.isArray(label && label.v) ? label.v : [];
const textRecord = payload.find((record) => record && record.k === 'text') || null;
const text = String(textRecord && textRecord.v != null ? textRecord.v : '').trim();
const displayText = 'Submitted: ' + (text || '(empty)');
const resultPayload = [
  { id: 0, p: 0, r: 0, c: 0, k: 'display_text', t: 'str', v: displayText },
  { id: 0, p: 0, r: 0, c: 0, k: 'remote_status', t: 'str', v: 'remote_processed' },
  { id: 0, p: 0, r: 0, c: 0, k: 'last_submit_payload', t: 'json', v: payload },
  { id: 0, p: 0, r: 0, c: 0, k: 'submit_inflight', t: 'bool', v: false }
];
V1N.table.addLabel(0, 0, 0, 'display_text', 'str', displayText);
V1N.table.addLabel(0, 0, 0, 'remote_status', 'str', 'remote_processed');
V1N.table.addLabel(0, 0, 0, 'last_submit_payload', 'json', payload);
V1N.table.addLabel(0, 0, 0, 'submit_inflight', 'bool', false);
const topicLabel = V1N.readLabel(0, 0, 0, 'result_out_topic');
const topic = String(topicLabel && topicLabel.v ? topicLabel.v : '').trim();
if (topic) {
  ctx.publishMqtt(topic, {
    version: 'v1',
    type: 'pin_payload',
    op_id: 'minimal_submit_matrix_result_' + Date.now(),
    source_model_id: 1050,
    pin: 'result',
    payload: resultPayload,
    timestamp: Date.now()
  });
}
return resultPayload;
```

`R1` 的订阅配置必须包含：

```json
[
  "UIPUT/ws/dam/pic/de/sw/1050/submit",
  "UIPUT/ws/dam/pic/de/sw/1050/result"
]
```

## 2. UI 侧 slide app 怎么写

UI 侧模型仍然是 cellwise UI，不是 HTML 字符串。`最小 Submit 双总线示例` 的 UI 拆成这些 cell：

| cell | 作用 | 关键 labels |
|---|---|---|
| `(0,0,0)` | UI root / 状态 truth | `model_type`、`app_name`、`ui_root_node_id`、`input_text`、`display_text`、`remote_status`、`submit` |
| `(2,0,0)` | 页面根容器 | `ui_component=Container`、`ui_layout=column` |
| `(2,1,0)` | 卡片 | `ui_component=Card`、`ui_title=最小 Submit 双总线示例` |
| `(2,2,0)` | 说明文字 | `ui_component=Text` |
| `(2,3,0)` | 输入框 | 读写 `input_text`，`commit_policy=on_blur` |
| `(2,4,0)` | Submit 按钮 | `bus_event_v2=true`，入口 `bus_event_submit_1050_0_0_0` |
| `(2,5,0)` | 显示结果 | 读取 `display_text` |
| `(2,6,0)` | 状态徽标 | 读取 `remote_status` |

按钮提交的 payload 必须是临时 ModelTable records：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "ui_event.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "text", "t": "str", "v": "<用户输入的文本>" }
]
```

注意：按钮不直接写 `display_text`，也不直接调用 Matrix。按钮只把临时 ModelTable payload 交给 Model 0。

## 3. 滑动过程如何触发

如果你不是使用项目内预置的模型 `1050`，而是要交付一个新的滑动 APP，则通过 Workspace 下的 `滑动 APP 导入` 触发安装。

### 3.1 zip 里是什么

zip 只需要一个文件：

```text
minimal-submit-dual-bus.zip
└── app_payload.json
```

`app_payload.json` 是 ModelTable records array。提供方只写临时 `id: 0`，不要写安装后的正式 model id，也不要写 `op: "add_label"`。

最小结构如下：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "UI.MinimalSubmitApp" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "app_name", "t": "str", "v": "最小 Submit 双总线示例" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "slide_capable", "t": "bool", "v": true },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "ui_authoring_version", "t": "str", "v": "cellwise.ui.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "ui_root_node_id", "t": "str", "v": "minimal_submit_matrix_root" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "input_text", "t": "str", "v": "" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "display_text", "t": "str", "v": "Waiting for submit" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "remote_status", "t": "str", "v": "idle" }
]
```

实际交付时还要继续补齐 `(2,0,0)` 到 `(2,6,0)` 的 UI 组件 labels。原则是每个可见组件一个 cell，不要把页面压成一个 HTML 字符串。

### 3.2 如何在 Workspace 触发导入

1. 打开 Workspace。
2. 在资产树中打开 `滑动 APP 导入`。
3. 选择准备好的 `minimal-submit-dual-bus.zip`。
4. 点击导入按钮。
5. 导入器会把 zip 上传到 `/api/media/upload`，形成 `mxc://...` 媒体地址。
6. 导入器把 `app_payload.json` materialize 成正式模型，自动 remap 临时 `id: 0`。
7. 宿主把新模型挂到 Workspace，并根据声明自动建立宿主侧引脚/Model 0 adapter。
8. 用户在 Workspace 打开新 APP 后，页面由 `cellwise.ui.v1` labels 渲染。

## 4. 用外部客户端测试双总线

### 4.1 如何观察 UI 发出的 submit

最直接的观察点是 MQTT submit topic：

```text
UIPUT/ws/dam/pic/de/sw/1050/submit
```

当浏览器点击 `Submit` 后，外部客户端应能在这个 topic 看到类似消息：

```json
{
  "version": "v1",
  "type": "pin_payload",
  "op_id": "minimal_submit_matrix_1778115519973",
  "source_model_id": 1050,
  "pin": "submit",
  "payload": [
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "ui_event.v1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "text", "t": "str", "v": "hello from browser" }
  ],
  "timestamp": 1778115519973
}
```

如果用 Matrix 客户端观察，则看 bus room / DM 中的 `dy.bus.v0` 事件；content 也是同一个 `pin_payload`。发送方向是 ui-server 到 `@mbr:<host_url>`。

### 4.2 如何直接改变 UI 显示

外部客户端要模拟 `R1` 回包时，向 result topic 发消息：

```text
UIPUT/ws/dam/pic/de/sw/1050/result
```

消息内容应是：

```json
{
  "version": "v1",
  "type": "pin_payload",
  "op_id": "manual_result_1050_001",
  "source_model_id": 1050,
  "pin": "result",
  "payload": [
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "display_text", "t": "str", "v": "Submitted: hello from external client" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "remote_status", "t": "str", "v": "remote_processed" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "submit_inflight", "t": "bool", "v": false }
  ],
  "timestamp": 1778115520131
}
```

MBR 收到 result topic 后会把消息转回 Matrix，ui-server 收到后 materialize 到 UI 模型 `1050`，页面上的显示文字会变成 `Submitted: hello from external client`。

Matrix 直接发送只适合使用被接收方信任的 bus peer 账号。普通第三方 Matrix 账号即使发出了 `dy.bus.v0`，也可能被接收方按 peer 过滤忽略。开发联调时优先使用上面的 MQTT topic 测试。

## 5. 不允许的旧写法

这些写法不属于当前示例，也不应作为新交付内容：

| 禁止项 | 原因 |
|---|---|
| `pin.connect.model` | 当前规约已移除，跨 cell / 子模型边界使用 `pin.connect.cell` 和 `model.submt` |
| `ctx.writeLabel` / `ctx.getLabel` / `ctx.rmLabel` | 旧 API，不作为新程序模型写法 |
| `input_value` 作为 `text` 的兜底字段 | 这是旧示例兼容口径，`R1` 当前只接受 `text` |
| 前端直接发 Matrix | 正式业务必须先进入 Model 0 |
| 外部 MQTT 直接写任意 cell | 必须走声明过的 `pin_payload` 和 result materialization |

## 6. 最小验收流程

1. 浏览器打开 Workspace，进入 `最小 Submit 双总线示例`。
2. 输入 `hello dual bus`。
3. 点击 `Submit`。
4. 观察 `UIPUT/ws/dam/pic/de/sw/1050/submit` 收到 `text=hello dual bus`。
5. 观察 `R1` 发布 `UIPUT/ws/dam/pic/de/sw/1050/result`。
6. 浏览器显示 `Submitted: hello dual bus`，状态显示 `remote_processed`。
7. 再用外部 MQTT 客户端向 result topic 发送 `display_text=Submitted: manual external test`，确认页面显示被回流更新。
