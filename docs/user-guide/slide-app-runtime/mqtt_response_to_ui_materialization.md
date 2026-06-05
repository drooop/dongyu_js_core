---
title: "MQTT 回包到 UI 显示"
doc_type: user-guide
status: active
updated: 2026-06-04
source: ai
---

# MQTT 回包到 UI 显示

本文说明从 remote-worker 收到 MQTT 请求开始，到 UI Server 收到 MQTT 回包并让界面显示新内容为止，开发者需要遵守的填表和 payload 规则。

一句话链路：

```text
remote-worker 程序模型
-> remote-worker root pin.out / Model 0 pin.bus.cb.out
-> MQTT response_topic
-> UI Server control-bus ingress
-> reply_target_model_id owner materialization
-> UI 组件读取更新后的 labels
```

## 1. 请求里已经带了回包地址

UI Server 外发请求时，会自动把这几类信息放进 `pin_payload.v1`：

| record | 含义 |
|---|---|
| `topic` | 本次 request 实际投递到哪里，例如 `UIPUT/ws/dam/pic/de/R1/3000/submit1`。 |
| `response_topic` | remote-worker 必须把 response 发回哪里，例如 `UIPUT/ws/dam/pic/de/U1/2000/result`。 |
| `endpoint_*` | request 的远端投递目标：`R1 / 3000 / submit1`。 |
| `origin_*` | request 的本地来源：`U1 / <installedModelId> / submit1`。 |
| `reply_target_*` | response 要 materialize 回哪个本地 App：`U1 / <installedModelId> / result`。 |
| `payload` | 真正业务数据，仍然是 ModelTable records array。 |

remote-worker 不要自己猜本地 model id，也不要把 response 发回 request 的 `topic`。它应直接读取 request 中的 `response_topic` 和 `reply_target_*`。

## 2. remote-worker 应该发什么 response

回包仍然是 `pin_payload.v1`，但要把 `message_role` 写成 `response`。

关键规则：

| 字段 | response 写法 |
|---|---|
| `message_role` | 必须是 `response`。 |
| `topic` | 必须等于 request 中的 `response_topic`。 |
| `response_topic` | 也写 request 中的 `response_topic`。 |
| `endpoint_*` | 必须等于 request 中的 `reply_target_*`，表示当前 response 正投递给 UI Server。 |
| `origin_*` | 写 remote-worker 自己，例如 `R1 / 3000 / submit1`。 |
| `reply_target_*` | 继续写 UI Server 本地目标，例如 `U1 / <installedModelId> / result`。 |
| `payload` | 要写回界面的 labels，仍是 ModelTable records array。 |

最小 response 示例：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "pin_payload.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_request_id", "t": "str", "v": "todo_save_result_001" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "op_id", "t": "str", "v": "todo_save_result_001" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "message_role", "t": "str", "v": "response" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "topic", "t": "str", "v": "UIPUT/ws/dam/pic/de/U1/2000/result" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "response_topic", "t": "str", "v": "UIPUT/ws/dam/pic/de/U1/2000/result" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "route_kind", "t": "str", "v": "control" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_worker_id", "t": "str", "v": "U1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_model_id", "t": "int", "v": 2000 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_pin", "t": "str", "v": "result" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_worker_id", "t": "str", "v": "R1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_model_id", "t": "int", "v": 3000 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_pin", "t": "str", "v": "submit1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_worker_id", "t": "str", "v": "U1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_model_id", "t": "int", "v": 2000 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_pin", "t": "str", "v": "result" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "payload", "t": "json", "v": [
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "display_text", "t": "str", "v": "Saved: MQTT task title" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "todo_save_status", "t": "str", "v": "remote_saved" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "submit_inflight", "t": "bool", "v": false }
  ] }
]
```

这里的 `2000` 只是安装后的本地 App model id 示例。真实值要从 request 的 `reply_target_model_id` 读取，不要写死。

## 3. UI Server 收到 response 后做什么

UI Server 收到 control-bus / MQTT packet 后，会先校验：

- 外层 packet 是 `version=v1`、`type=pin_payload`。
- 内层 payload 是严格的 ModelTable records array。
- `__mt_payload_kind=pin_payload.v1`。
- `message_role=response`。
- `topic` 等于 `response_topic`。
- `endpoint_*` 与 `reply_target_*` 描述同一个本地目标。
- `payload` record 的 `v` 也是 ModelTable records array。

校验通过后，UI Server 不按 request topic 推断目标，也不按 remote endpoint 写表。它只按 `reply_target_model_id` 找到本地已安装 App，然后把 nested `payload` 中的 labels materialize 到该模型。

以上面示例为例，UI Server 会向本地 App model `2000` 的 root `(0,0,0)` 写入：

```json
[
  { "p": 0, "r": 0, "c": 0, "k": "display_text", "t": "str", "v": "Saved: MQTT task title" },
  { "p": 0, "r": 0, "c": 0, "k": "todo_save_status", "t": "str", "v": "remote_saved" },
  { "p": 0, "r": 0, "c": 0, "k": "submit_inflight", "t": "bool", "v": false }
]
```

这一步是正式 materialization。传输过程中的 `pin_payload.v1` 只是临时 ModelTable-like 数据，不会自动落表。

## 4. UI 模型如何显示新内容

界面组件不需要订阅 MQTT，也不需要知道 `response_topic`。它只读取本地模型表 label。

例如，文本展示组件读取 `display_text`：

```json
{
  "read": { "p": 0, "r": 0, "c": 0, "k": "display_text" }
}
```

状态徽标读取 `todo_save_status`：

```json
{
  "p": 0,
  "r": 0,
  "c": 0,
  "k": "todo_save_status"
}
```

因此完整显示链路是：

```text
remote-worker response payload
-> UI Server materializes display_text / todo_save_status / submit_inflight
-> frontend snapshot / SSE 更新
-> Text / StatusBadge 重新读取 labels
-> 页面显示新内容
```

## 5. remote-worker 程序模型的写法

remote-worker 程序模型收到 request 后，应该从 request records 读取 `response_topic` 和 `reply_target_*`，再构造 response。

伪代码：

```javascript
const responseTopic = readPayload('response_topic');
const replyTarget = {
  worker_id: readPayload('reply_target_worker_id'),
  model_id: readPayload('reply_target_model_id'),
  pin: readPayload('reply_target_pin')
};

const resultLabels = [
  mt('display_text', 'str', 'Saved: ' + title),
  mt('todo_save_status', 'str', 'remote_saved'),
  mt('submit_inflight', 'bool', false)
];

return [
  mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
  mt('__mt_request_id', 'str', opId),
  mt('op_id', 'str', opId),
  mt('message_role', 'str', 'response'),
  mt('topic', 'str', responseTopic),
  mt('response_topic', 'str', responseTopic),
  mt('route_kind', 'str', 'control'),
  mt('endpoint_worker_id', 'str', replyTarget.worker_id),
  mt('endpoint_model_id', 'int', replyTarget.model_id),
  mt('endpoint_pin', 'str', replyTarget.pin),
  mt('origin_worker_id', 'str', 'R1'),
  mt('origin_model_id', 'int', 3000),
  mt('origin_pin', 'str', 'submit1'),
  mt('reply_target_worker_id', 'str', replyTarget.worker_id),
  mt('reply_target_model_id', 'int', replyTarget.model_id),
  mt('reply_target_pin', 'str', replyTarget.pin),
  mt('payload', 'json', resultLabels),
  mt('timestamp', 'int', Date.now())
];
```

如果函数所在 Cell 已通过 `pin.connect.label` 把 `submit1:out` 接到 root result / Model 0 bus out，返回这个 records array 即可。不要在 remote-worker 程序里直接调用 MQTT 客户端。

## 6. 常见错误

| 错误 | 后果 | 正确做法 |
|---|---|---|
| response 仍发到 request `topic` | 消息回到 remote-worker submit endpoint，UI 不会更新。 | response 的 `topic` 必须等于 request 的 `response_topic`。 |
| response 缺少 `reply_target_model_id` | UI Server 不知道写回哪个本地 App。 | 原样携带 request 的 `reply_target_*`。 |
| response 的 `endpoint_*` 仍写 `R1 / 3000 / submit1` | 当前投递目标被写错，校验会失败。 | response 的 `endpoint_*` 写 UI Server 本地目标。 |
| nested `payload` 不是 ModelTable records array | UI Server 不会 materialize。 | `payload.v` 必须是 records array。 |
| UI 组件直接订阅 MQTT | 绕过 ModelTable，不符合规约。 | UI 只读取本地 labels。 |
| remote-worker 直接写 UI label | 远端不拥有本地模型表。 | remote-worker 只发 response，UI Server owner materialization。 |



