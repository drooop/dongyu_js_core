---
title: "To Do 保存按钮外发 MQTT 示例"
doc_type: user-guide
status: active
updated: 2026-06-04
source: ai
---

# To Do 保存按钮外发 MQTT 示例

本文回答一个常见问题：开发者修改保存任务按钮的 `ui_bind_json` 后，为什么没有成功发出 MQTT，以及正确应该怎么填表。

完整可安装 JSON patch 保存在：

```text
test_files/todo_save_mqtt_event_app_payload.json
```

这个文件是 ModelTable records array，可以作为 `app_payload.json` 放入 ZIP 后通过 `滑动 APP 导入` 安装。

## 1. 先分清三种入口

| 名称 | 示例 | 谁使用 | 含义 |
|---|---|---|---|
| Model 0 ingress key | `bus_event_submit_0_0_0_0` | `ui_bind_json.write.bus_in_key` | ZIP 作者可写的 submit 占位入口。安装后 UI Server 改成 `imported_host_submit_<modelId>`。 |
| App 内部入口 pin | `todo_request` / `submit_request` | App root 的 `pin.in` | App 自己接收业务事件的入口，不能直接写到 `bus_in_key`。 |
| App 对外出口 pin | `submit1` | 程序模型写入 `pin.out` | 程序模型写入这里后，安装器生成的 host egress adapter 才会发 MQTT。 |

所以，下面这种写法不正确：

```json
{
  "write": {
    "bus_event_v2": true,
    "bus_in_key": "submit_request"
  }
}
```

`submit_request` 是 App 内部 pin，不是 Model 0 的入口。运行时会把它当成无效的 `bus_in_key`，不会进入 MQTT 链路。

## 2. 按钮应该怎么写

保存任务按钮的 `ui_bind_json` 应该写成：

```json
{
  "write": {
    "bus_event_v2": true,
    "bus_in_key": "bus_event_submit_0_0_0_0",
    "value_t": "modeltable",
    "value_ref": [
      { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "ui_event.v1" },
      { "id": 0, "p": 0, "r": 0, "c": 0, "k": "todo_action", "t": "str", "v": "save_task" },
      { "id": 0, "p": 0, "r": 0, "c": 0, "k": "title", "t": "str", "v": { "$label": { "p": 0, "r": 0, "c": 0, "k": "draft_title" } } },
      { "id": 0, "p": 0, "r": 0, "c": 0, "k": "body", "t": "str", "v": { "$label": { "p": 0, "r": 0, "c": 0, "k": "draft_body" } } },
      { "id": 0, "p": 0, "r": 0, "c": 0, "k": "status", "t": "str", "v": { "$label": { "p": 0, "r": 0, "c": 0, "k": "draft_status" } } }
    ],
    "meta": { "source": "todo_save_mqtt_example" }
  }
}
```

这一步只表示“把按钮事件交给当前 App 的正式业务入口”。它还不是 MQTT。

安装后，UI Server 会把 `bus_event_submit_0_0_0_0` 改成真实入口，例如：

```text
imported_host_submit_2017
```

开发者不要自己填写 `imported_host_submit_<modelId>`，因为正式 `modelId` 是安装时分配的。

## 3. Root 还必须有哪些 labels

如果目标是发 MQTT，App root `(0,0,0)` 至少还要有这些 labels：

```json
[
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
  },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "todo_request", "t": "pin.in", "v": null },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "todo_request_wiring", "t": "pin.connect.label", "v": [{ "from": "todo_request", "to": ["handle_todo_save:in"] }] },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "submit1", "t": "pin.out", "v": null },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "dual_bus_model", "t": "json", "v": { "mode": "imported_host_egress", "egress_pins": ["submit1"] } },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "remote_bus_endpoint_v1", "t": "json", "v": { "transport": "mqtt", "to": { "worker_id": "R1", "model_id": 3000 } } }
]
```

这些 label 的作用是：

| label | 作用 |
|---|---|
| `host_ingress_v1` | 安装器根据它把 Model 0 的 submit 入口接到 App 内部 `todo_request`。 |
| `todo_request` | App 内部入口。按钮 payload 最终会进入这里。 |
| `todo_request_wiring` | 让 `todo_request` 触发 `handle_todo_save` 程序模型。 |
| `submit1` | App 对外出口。只有程序模型写入这个 `pin.out`，才会外发。 |
| `dual_bus_model` | 告诉安装器 `submit1` 是需要生成 host egress adapter 的出口。 |
| `remote_bus_endpoint_v1` | 告诉安装器远端 worker 是 `R1`，远端 provider model 是 `3000`。 |

## 4. 程序模型如何真正发出 MQTT

程序模型不要直接写 MQTT topic。它只需要把业务数据写到 root `submit1 pin.out`：

```javascript
const records = Array.isArray(label && label.v) ? label.v : [];
const readPayload = (key, fallback = '') => {
  const rec = records.find((item) => item && item.id === 0 && item.p === 0 && item.r === 0 && item.c === 0 && item.k === key);
  return rec && Object.prototype.hasOwnProperty.call(rec, 'v') ? rec.v : fallback;
};
const mt = (k, t, v) => ({ id: 0, p: 0, r: 0, c: 0, k, t, v });

const title = String(readPayload('title', '')).trim();
const body = String(readPayload('body', '')).trim();
const status = String(readPayload('status', 'todo')).trim() || 'todo';

const taskPayload = [
  mt('__mt_payload_kind', 'str', 'todo_save.request.v1'),
  mt('todo_action', 'str', 'save_task'),
  mt('title', 'str', title),
  mt('body', 'str', body),
  mt('status', 'str', status),
  mt('source', 'str', 'todo_save_mqtt_example')
];

V1N.addLabel('last_submit_payload', 'json', taskPayload);
V1N.addLabel('todo_save_status', 'str', 'sending: ' + title);
V1N.addLabel('submit_inflight', 'bool', true);
V1N.addLabel('submit1', 'pin.out', taskPayload);
```

`submit1` 被写入后，安装器生成的 host egress adapter 会自动包装为 `pin_payload.v1`，并补齐这些 records：

| record | 示例 |
|---|---|
| `message_role` | `request` |
| `topic` | `UIPUT/ws/dam/pic/de/R1/3000/submit1` |
| `response_topic` | UI Server 的 host transport endpoint，例如 `UIPUT/ws/dam/pic/de/U1/1087/result` |
| `endpoint_worker_id` | `R1` |
| `endpoint_model_id` | `3000` |
| `endpoint_pin` | `submit1` |
| `origin_worker_id` | `U1` |
| `origin_table_id` | 当前安装后的 App instance table id |
| `origin_model_id` | App table 内的本地 model id，root 通常是 `0` |
| `reply_target_table_id` | 回包要写回的 App instance table id |
| `reply_target_model_id` | 回包要写回的 App table 内 model id，root 通常是 `0` |
| `origin_pin` | `submit1` |
| `payload` | 上面的 `taskPayload` |

最终 MQTT topic 是：

```text
UIPUT/ws/dam/pic/de/R1/3000/submit1
```

其中 `R1 / 3000` 来自 `remote_bus_endpoint_v1`，最后的 `submit1` 来自当前被写入的 root `pin.out`。

## 5. 如果只改一个 JSON 会怎样

只改按钮 `ui_bind_json` 只能完成“按钮事件进入本 App 程序模型”。能不能发 MQTT 取决于 root 是否还有外发链。

结论：只改按钮 `ui_bind_json` 不够让保存任务发出 MQTT；必须同时补齐 root 外发 labels，并让程序模型写入公开 `pin.out`。

| 目标 | 只改按钮 `ui_bind_json` 是否足够 |
|---|---|
| 打开弹窗、保存本地草稿 | 可能足够。 |
| 触发本 App 内部程序模型 | 需要正确的 `bus_in_key` 和 `host_ingress_v1`。 |
| 发出 MQTT | 不够，还必须有 `dual_bus_model`、`remote_bus_endpoint_v1`、root `pin.out`，并由程序模型写入该 `pin.out`。 |

## 6. 验证方式

本仓库的确定性验证脚本是：

```bash
node scripts/tests/test_0409_todo_mqtt_egress_docs_contract.mjs
```

该脚本会把 `test_files/todo_save_mqtt_event_app_payload.json` 作为 ZIP 导入，触发保存任务事件，并检查是否真的发布到：

```text
UIPUT/ws/dam/pic/de/R1/3000/submit1
```
