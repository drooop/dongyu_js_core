---
title: "Minimal Submit Dual-Bus Slide App Provider Guide"
doc_type: user-guide
status: active
updated: 2026-05-07
source: ai
---

# 最小 Submit 双总线示例

这份文档面向滑动 APP 提供方和 remote-worker 提供方。目标是讲清一个最小应用如何从页面按钮走完整双总线，并把 remote-worker 的结果回写到 UI。

本项目当前的目标示例用两个 id 说明身份拆分：

- UI Server 安装后的本地模型：示例写作 `2000`
- RE 上的远端 provider 模型：示例写作 `3000`

用户在浏览器输入内容后点击 `Submit`，最终显示应从 `Waiting for submit` 变成：

```text
Submitted: <输入内容>
```

正式路径是：

```text
UI local model 2000
-> Model 0
-> Matrix
-> MBR
-> route.to = RE / model 3000 / pin submit1
-> RE provider model 3000
-> route.reply_to = ui-server-U1 / local model 2000 / pin result
-> MBR
-> Matrix
-> ui-server
-> UI local model 2000
```

通用写法等价为：

```text
UI click -> Model 0 -> Matrix -> MBR -> remote provider public pin -> reply_to -> ui-server -> local UI model
```

关键值如下：

| 名称 | 值 |
|---|---|
| 本地 UI 模型 | `2000`（安装时由 UI Server 分配，实际值可变） |
| 远端 provider | `RE / 3000` |
| 远端入口 | `route.to.pin = submit1` |
| 回包目标 | `route.reply_to = ui-server-U1 / 2000 / result` |
| Matrix event type | `dy.bus.v0` |
| MBR Matrix 目标用户 | `@mbr:<host_url>` |
| topic 角色 | transport 派生结果，不是规约真相 |
| 规约真相 | `route.to` / `route.reply_to` |

## 1. remote-worker RE 应该怎么填

如果新建一个 remote-worker `RE`，它不需要关心 UI 如何渲染。`RE` 只负责接收路由到 provider model `3000` 的公开 pin，例如 `submit1`，运行自己的程序模型，然后按消息里的 `route.reply_to` 发回 result。

### 1.1 填表过程

1. 在 `RE` 上创建 provider 模型 `3000`，类型是 `model.table`。
2. 在 `3000` 的根单元格 `(0,0,0)` 声明公开入口 `submit1`，类型是 `pin.in`。
3. 在同一个根单元格声明公开出口 `result`，类型是 `pin.out`。
4. 用 root `(0,0,0)` 的 `pin.connect.cell` 把 `[0,0,0,"submit1"]` 接到程序所在 Cell `(1,1,1)` 的普通入口 `submit1_in`。
5. 在 `(1,1,1)` 用 `pin.connect.label` 把 `submit1_in` 接到函数端点 `submit1:in`，再把 `submit1:out` 接到普通出口 `submit1_out`。
6. 再用 root `pin.connect.cell` 把 `[1,1,1,"submit1_out"]` 接回 `[0,0,0,"result"]`。
7. 函数 `submit1` 只读取 payload 里的 `text` record，不接受旧字段兜底。

### 1.2 RE 最终填写内容

开发者手工填表时，含义就是“在 RE 的模型 `3000` 里放这些 labels”。

```json
[
  { "op": "create_model", "model_id": 3000, "name": "minimal_submit_provider", "type": "ui" },
  { "op": "add_label", "model_id": 3000, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "RE.ProviderApp" },
  { "op": "add_label", "model_id": 3000, "p": 0, "r": 0, "c": 0, "k": "submit1", "t": "pin.in", "v": null },
  { "op": "add_label", "model_id": 3000, "p": 0, "r": 0, "c": 0, "k": "result", "t": "pin.out", "v": null },
  {
    "op": "add_label",
    "model_id": 3000,
    "p": 0,
    "r": 0,
    "c": 0,
    "k": "submit1_route",
    "t": "pin.connect.cell",
    "v": [
      { "from": [0, 0, 0, "submit1"], "to": [[1, 1, 1, "submit1_in"]] },
      { "from": [1, 1, 1, "submit1_out"], "to": [[0, 0, 0, "result"]] }
    ]
  },
  { "op": "add_label", "model_id": 3000, "p": 1, "r": 1, "c": 1, "k": "model_type", "t": "model.single", "v": "RE.Program.Submit1" },
  { "op": "add_label", "model_id": 3000, "p": 1, "r": 1, "c": 1, "k": "submit1_in", "t": "pin.in", "v": null },
  { "op": "add_label", "model_id": 3000, "p": 1, "r": 1, "c": 1, "k": "submit1_out", "t": "pin.out", "v": null },
  { "op": "add_label", "model_id": 3000, "p": 1, "r": 1, "c": 1, "k": "submit1", "t": "func.js", "v": { "code": "const inputRecords = Array.isArray(label && label.v) ? label.v : []; const routeRecord = inputRecords.find((record) => record && record.k === 'route' && record.t === 'json' && record.v && typeof record.v === 'object') || null; const route = routeRecord ? routeRecord.v : null; const replyTo = route && route.reply_to && typeof route.reply_to === 'object' && !Array.isArray(route.reply_to) ? route.reply_to : null; const businessPayload = inputRecords.filter((record) => !(record && record.k === 'route')); const textRecord = businessPayload.find((record) => record && record.k === 'text') || null; const text = String(textRecord && textRecord.v != null ? textRecord.v : '').trim(); const displayText = 'Submitted: ' + (text || '(empty)'); const resultPayload = [{ id: 0, p: 0, r: 0, c: 0, k: 'display_text', t: 'str', v: displayText }, { id: 0, p: 0, r: 0, c: 0, k: 'remote_status', t: 'str', v: 'remote_processed' }, { id: 0, p: 0, r: 0, c: 0, k: 'last_submit_payload', t: 'json', v: businessPayload }, { id: 0, p: 0, r: 0, c: 0, k: 'submit_inflight', t: 'bool', v: false }]; const safeSegment = (value) => typeof value === 'string' && value.trim() === value && value.length > 0 && !value.includes('/') && !value.includes('+') && !value.includes('#'); const mt = (k, t, v) => ({ id: 0, p: 0, r: 0, c: 0, k, t, v }); const validReplyTo = replyTo && safeSegment(String(replyTo.worker_id || '')) && Number.isInteger(Number(replyTo.model_id)) && Number(replyTo.model_id) > 0 && safeSegment(String(replyTo.pin || '')); if (!validReplyTo) { V1N.addLabel('remote_status', 'str', 'route_reply_to_missing'); V1N.addLabel('submit_inflight', 'bool', false); return null; } const opId = 'minimal_submit_result_' + Date.now(); const to = { worker_id: String(replyTo.worker_id).trim(), model_id: Number(replyTo.model_id), pin: String(replyTo.pin).trim() }; return [mt('__mt_payload_kind', 'str', 'pin_payload.v1'), mt('__mt_request_id', 'str', opId), mt('op_id', 'str', opId), mt('source_model_id', 'int', Number(replyTo.model_id)), mt('pin', 'str', String(replyTo.pin).trim()), mt('payload', 'json', resultPayload), mt('timestamp', 'int', Date.now()), mt('route', 'json', { to, from: { worker_id: 'RE', model_id: 3000, pin: 'submit1' } })];" } },
  {
    "op": "add_label",
    "model_id": 3000,
    "p": 1,
    "r": 1,
    "c": 1,
    "k": "submit1_wiring",
    "t": "pin.connect.label",
    "v": [
      { "from": "submit1_in", "to": ["submit1:in"] },
      { "from": "submit1:out", "to": ["submit1_out"] }
    ]
  }
]
```

程序模型 `submit1` 的输出必须是 ModelTable-shaped `pin_payload.v1`。如果 `route.reply_to` 缺失或非法，函数只能写本地错误状态并 `return null`，不能把普通业务结果送到公开 `result` pin。

```js
const inputRecords = Array.isArray(label && label.v) ? label.v : [];
const routeRecord = inputRecords.find((record) => record && record.k === 'route' && record.t === 'json') || null;
const route = routeRecord ? routeRecord.v : null;
const replyTo = route && route.reply_to && typeof route.reply_to === 'object' && !Array.isArray(route.reply_to)
  ? route.reply_to
  : null;
const safeSegment = (value) => typeof value === 'string'
  && value.trim() === value
  && value.length > 0
  && !value.includes('/')
  && !value.includes('+')
  && !value.includes('#');

if (!replyTo
  || !safeSegment(String(replyTo.worker_id || ''))
  || !Number.isInteger(Number(replyTo.model_id))
  || Number(replyTo.model_id) <= 0
  || !safeSegment(String(replyTo.pin || ''))) {
  V1N.addLabel('remote_status', 'str', 'route_reply_to_missing');
  V1N.addLabel('submit_inflight', 'bool', false);
  return null;
}

const payload = inputRecords.filter((record) => !(record && record.k === 'route'));
const textRecord = payload.find((record) => record && record.k === 'text') || null;
const text = String(textRecord && textRecord.v != null ? textRecord.v : '').trim();
const displayText = 'Submitted: ' + (text || '(empty)');
const resultPayload = [
  { id: 0, p: 0, r: 0, c: 0, k: 'display_text', t: 'str', v: displayText },
  { id: 0, p: 0, r: 0, c: 0, k: 'remote_status', t: 'str', v: 'remote_processed' },
  { id: 0, p: 0, r: 0, c: 0, k: 'last_submit_payload', t: 'json', v: payload },
  { id: 0, p: 0, r: 0, c: 0, k: 'submit_inflight', t: 'bool', v: false }
];
const mt = (k, t, v) => ({ id: 0, p: 0, r: 0, c: 0, k, t, v });
const opId = 'minimal_submit_result_' + Date.now();
const to = {
  worker_id: String(replyTo.worker_id).trim(),
  model_id: Number(replyTo.model_id),
  pin: String(replyTo.pin).trim()
};
return [
  mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
  mt('__mt_request_id', 'str', opId),
  mt('op_id', 'str', opId),
  mt('source_model_id', 'int', Number(replyTo.model_id)),
  mt('pin', 'str', String(replyTo.pin).trim()),
  mt('payload', 'json', resultPayload),
  mt('timestamp', 'int', Date.now()),
  mt('route', 'json', { to, from: { worker_id: 'RE', model_id: 3000, pin: 'submit1' } })
];
```

## 2. UI 侧 slide app 怎么写

UI 侧模型仍然是 cellwise UI，不是 HTML 字符串。`最小 Submit 双总线示例` 的 UI 拆成这些 cell：

| cell | 作用 | 关键 labels |
|---|---|---|
| `(0,0,0)` | UI root / 状态 truth | `model_type`、`app_name`、`ui_root_node_id`、`remote_bus_endpoint_v1`、`dual_bus_model.egress_pins=["submit1"]`、`input_text`、`display_text`、`remote_status`、`submit1` |
| `(2,0,0)` | 页面根容器 | `ui_component=Container`、`ui_layout=column` |
| `(2,1,0)` | 卡片 | `ui_component=Card`、`ui_title=最小 Submit 双总线示例` |
| `(2,2,0)` | 输入框 | `ui_component=Input`，读写 `input_text`，`commit_policy=on_blur` |
| `(2,3,0)` | Submit 按钮 | `ui_component=Button`，`click_chain pin.in` 接到 root `submit_request` |
| `(2,4,0)` | 显示结果 | `ui_component=Text`，读取 `display_text` |
| `(2,5,0)` | 状态徽标 | `ui_component=StatusBadge`，读取 `remote_status` |

### 2.0 完整 patch label 对照表

当前基准文件 `test_files/minimal_submit_dual_bus_app_payload.json` 是一个 61 条 record 的 ModelTable records array。zip 中的 `app_payload.json` 与它语义一致，且 zip 内只允许这一份模型表文件。

Root `(0,0,0)` 负责身份、运行状态、导入合同、远端路由和按钮后的程序链路：

| cell | label.k | label.t | 作用 |
|---|---|---|---|
| `(0,0,0)` | `model_type` | `model.table` | 声明这是一个可挂载的 UI 表模型。 |
| `(0,0,0)` | `app_name` | `str` | Workspace 资产树和页面标题显示的应用名。 |
| `(0,0,0)` | `source_worker` | `str` | 交付来源元信息，便于导入和排障；不决定路由。 |
| `(0,0,0)` | `slide_capable` | `bool` | 声明该模型可作为滑动 APP 被导入和挂载。 |
| `(0,0,0)` | `slide_surface_type` | `str` | 声明滑动 APP 的展示面类型，当前示例是 Workspace 页面。 |
| `(0,0,0)` | `from_user` | `str` | 导入来源用户元信息；导入器可覆盖或记录，不作为 `route.to` 真相。 |
| `(0,0,0)` | `to_user` | `str` | 示例中的 Matrix 目标元信息；正式外发目标以运行时 `route.to` 为准。 |
| `(0,0,0)` | `ui_authoring_version` | `str` | 声明 UI 写法版本为 `cellwise.ui.v1`。 |
| `(0,0,0)` | `ui_root_node_id` | `str` | 指向页面根 UI 节点 `minimal_submit_zip_root`。 |
| `(0,0,0)` | `input_text` | `str` | 输入框绑定的草稿值。 |
| `(0,0,0)` | `display_text` | `str` | 页面显示结果，初始为 `Waiting for submit`，回包后变成 `Submitted: ...`。 |
| `(0,0,0)` | `remote_status` | `str` | 状态徽标读取的远端处理状态。 |
| `(0,0,0)` | `submit_inflight` | `bool` | 标记当前是否有 Submit 请求等待回包。 |
| `(0,0,0)` | `last_submit_payload` | `json` | 保存最后一次提交的业务 payload，便于审计和调试。 |
| `(0,0,0)` | `host_ingress_v1` | `json` | 告诉宿主导入器这个 APP 的正式入口是 `submit_request`，值类型是 ModelTable records。 |
| `(0,0,0)` | `remote_bus_endpoint_v1` | `json` | 声明远端默认目标 worker/model：`RE / 3000`；不写 `to.pin`，也不写 `reply_to`。 |
| `(0,0,0)` | `dual_bus_model` | `json` | 声明哪些 root `pin.out` 会走双总线，本示例只有 `submit1`。 |
| `(0,0,0)` | `submit_request` | `pin.in` | root 内部业务入口，接收按钮传来的临时 ModelTable records。 |
| `(0,0,0)` | `submit1` | `pin.out` | 对外公开出口；程序写入后由宿主生成的 adapter 发向 Model 0 双总线出口。 |
| `(0,0,0)` | `submit_request_wiring` | `pin.connect.label` | 同 Cell 内把 `submit_request` 接到函数端点 `handle_submit:in`。 |
| `(0,0,0)` | `root_routes` | `pin.connect.cell` | 跨 Cell 把按钮 `(2,3,0)` 的 `click_chain` 接到 root 的 `submit_request`。 |
| `(0,0,0)` | `handle_submit` | `func.js` | 后端模型表运行环境里的程序模型：读取 `text`，更新本地状态，并写 `submit1 pin.out`。 |

UI 层 `(2,*,0)` 每个可见部件都拆成独立 Cell：

| cell | label.k | label.t | 作用 |
|---|---|---|---|
| `(2,0,0)` | `ui_node_id` | `str` | 页面根容器节点 id。 |
| `(2,0,0)` | `ui_component` | `str` | 渲染为 `Container`。 |
| `(2,0,0)` | `ui_layout` | `str` | 根容器纵向排列。 |
| `(2,0,0)` | `ui_gap` | `int` | 根容器子组件间距。 |
| `(2,1,0)` | `ui_node_id` | `str` | Card 节点 id。 |
| `(2,1,0)` | `ui_component` | `str` | 渲染为 `Card`。 |
| `(2,1,0)` | `ui_parent` | `str` | Card 挂到根容器。 |
| `(2,1,0)` | `ui_order` | `int` | Card 在根容器中的排序。 |
| `(2,1,0)` | `ui_title` | `str` | Card 标题。 |
| `(2,2,0)` | `ui_node_id` | `str` | Input 节点 id。 |
| `(2,2,0)` | `ui_component` | `str` | 渲染为 `Input`。 |
| `(2,2,0)` | `ui_parent` | `str` | Input 挂到 Card。 |
| `(2,2,0)` | `ui_order` | `int` | Input 在 Card 中的排序。 |
| `(2,2,0)` | `ui_placeholder` | `str` | 输入框占位文案。 |
| `(2,2,0)` | `ui_bind_json` | `json` | Input 读取并写回 root `input_text`，写入策略为 `on_blur`。 |
| `(2,3,0)` | `ui_node_id` | `str` | Button 节点 id。 |
| `(2,3,0)` | `ui_component` | `str` | 渲染为 `Button`。 |
| `(2,3,0)` | `ui_parent` | `str` | Button 挂到 Card。 |
| `(2,3,0)` | `ui_order` | `int` | Button 在 Card 中的排序。 |
| `(2,3,0)` | `ui_label` | `str` | 按钮文字 `Submit`。 |
| `(2,3,0)` | `ui_variant` | `str` | 按钮外观为 primary。 |
| `(2,3,0)` | `click_chain` | `pin.in` | 按钮点击时写入的本 Cell 普通引脚。 |
| `(2,3,0)` | `ui_bind_json` | `json` | Button 点击绑定：生成临时 records，写入 `click_chain`。 |
| `(2,4,0)` | `ui_node_id` | `str` | Text 节点 id。 |
| `(2,4,0)` | `ui_component` | `str` | 渲染为 `Text`。 |
| `(2,4,0)` | `ui_parent` | `str` | Text 挂到 Card。 |
| `(2,4,0)` | `ui_order` | `int` | Text 在 Card 中的排序。 |
| `(2,4,0)` | `ui_variant` | `str` | Text 采用 success 外观。 |
| `(2,4,0)` | `ui_bind_json` | `json` | Text 读取 root `display_text`。 |
| `(2,5,0)` | `ui_node_id` | `str` | StatusBadge 节点 id。 |
| `(2,5,0)` | `ui_component` | `str` | 渲染为 `StatusBadge`。 |
| `(2,5,0)` | `ui_parent` | `str` | StatusBadge 挂到 Card。 |
| `(2,5,0)` | `ui_order` | `int` | StatusBadge 在 Card 中的排序。 |
| `(2,5,0)` | `ui_label` | `str` | 状态前缀显示为 `REMOTE`。 |
| `(2,5,0)` | `ui_text_ref_model_id` | `int` | 指向 zip 内临时 root 模型 `0`；导入后 remap 为正式模型 id。 |
| `(2,5,0)` | `ui_text_ref_p` | `int` | 状态值引用的目标 p 坐标。 |
| `(2,5,0)` | `ui_text_ref_r` | `int` | 状态值引用的目标 r 坐标。 |
| `(2,5,0)` | `ui_text_ref_c` | `int` | 状态值引用的目标 c 坐标。 |
| `(2,5,0)` | `ui_text_ref_k` | `str` | 状态值读取 root `remote_status`。 |

这张表也是审查 JSON patch 是否有效的最小清单：如果少了 `remote_bus_endpoint_v1`、`dual_bus_model`、`submit1`、`click_chain`、`root_routes`、`submit_request_wiring` 或 `handle_submit`，按钮就无法走完整双总线。

按钮提交的 payload 必须是临时 ModelTable records：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "ui_event.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "text", "t": "str", "v": "<用户输入的文本>" }
]
```

注意：按钮不直接写 `display_text`，也不直接调用 Matrix。按钮只把临时 ModelTable payload 交给 Model 0。

### 2.1 Submit 按钮如何绑定事件

按钮所在的 Cell 是 `(2,3,0)`。它有三个关键 label：

```json
[
  { "id": 0, "p": 2, "r": 3, "c": 0, "k": "click_chain", "t": "pin.in", "v": null },
  { "id": 0, "p": 2, "r": 3, "c": 0, "k": "ui_label", "t": "str", "v": "Submit" },
  {
    "id": 0,
    "p": 2,
    "r": 3,
    "c": 0,
    "k": "ui_bind_json",
    "t": "json",
    "v": {
      "write": {
        "pin": "click_chain",
        "value_t": "modeltable",
        "commit_policy": "immediate",
        "value_ref": [
          { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "ui_event.v1" },
          { "id": 0, "p": 0, "r": 0, "c": 0, "k": "text", "t": "str", "v": { "$label": { "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "input_text" } } },
          { "id": 0, "p": 0, "r": 0, "c": 0, "k": "source", "t": "str", "v": "ui_button" }
        ]
      }
    }
  }
]
```

`ui_bind_json.write.pin=click_chain` 表示点击按钮时，前端把 `value_ref` 解析成临时 ModelTable records，并写入同 Cell 的 `click_chain`。这一步仍是 UI 事件，不是业务落表。

随后 root `(0,0,0)` 的跨 Cell 接线把按钮事件送到 root 业务入口：

```json
{
  "id": 0,
  "p": 0,
  "r": 0,
  "c": 0,
  "k": "root_routes",
  "t": "pin.connect.cell",
  "v": [
    { "from": [2, 3, 0, "click_chain"], "to": [[0, 0, 0, "submit_request"]] }
  ]
}
```

root 内部再用同 Cell 接线触发程序模型：

```json
{
  "id": 0,
  "p": 0,
  "r": 0,
  "c": 0,
  "k": "submit_request_wiring",
  "t": "pin.connect.label",
  "v": [
    { "from": "submit_request", "to": ["handle_submit:in"] }
  ]
}
```

`handle_submit` 是 `func.js`。它只读取 `text` 这个 record，不读取旧的 `input_value`、`message_text` 或嵌套 `value.text` 兜底。它会更新本地状态，并把业务 payload 写到 root `submit1 pin.out`：

```js
const records = Array.isArray(label && label.v) ? label.v : [];
const readPayload = function(key, fallback) {
  const rec = records.find(function(item) {
    return item && item.id === 0 && item.p === 0 && item.r === 0 && item.c === 0 && item.k === key;
  });
  return rec && Object.prototype.hasOwnProperty.call(rec, 'v') ? rec.v : fallback;
};
const text = String(readPayload('text', '')).trim();
const source = String(readPayload('source', 'ui_button'));
const SELF = ctx.self.model_id;
const payload = [
  { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'minimal_submit.request.v1' },
  { id: 0, p: 0, r: 0, c: 0, k: 'text', t: 'str', v: text },
  { id: 0, p: 0, r: 0, c: 0, k: 'source_model_id', t: 'int', v: SELF },
  { id: 0, p: 0, r: 0, c: 0, k: 'source', t: 'str', v: source }
];
V1N.addLabel('input_text', 'str', text);
V1N.addLabel('last_submit_payload', 'json', payload);
V1N.addLabel('submit_inflight', 'bool', !!text);
V1N.addLabel('remote_status', 'str', text ? 'sending' : 'empty_input');
if (text) V1N.addLabel('submit1', 'pin.out', payload);
```

`submit1` 被 `dual_bus_model.egress_pins=["submit1"]` 声明为公开外发 pin。安装时 UI Server 会建立 host-owned adapter，把它转成 Model 0 的 `pin.bus.mb.out`，再进入 Matrix / MBR / remote-worker。这个 adapter 是安装过程生成的，不应写进 zip。

完整触发链路可以按下面检查：

```text
(2,3,0) Button ui_bind_json
-> writes temporary ModelTable records to (2,3,0) click_chain
-> root_routes: [2,3,0,"click_chain"] -> [0,0,0,"submit_request"]
-> submit_request_wiring: submit_request -> handle_submit:in
-> handle_submit func.js reads text and writes root submit1 pin.out
-> generated host egress adapter reads remote_bus_endpoint_v1 + dual_bus_model.egress_pins
-> Model 0 mt_bus_send / pin.bus.mb.out
-> Matrix dy.bus.v0 to @mbr:<host_url>
-> MBR derives MQTT topic from route.to = RE / 3000 / submit1
-> RE Model 3000 public submit1 pin
-> RE submit1 program returns pin_payload.v1 to route.reply_to
-> UI Server materializes display_text / remote_status on local installed model
```

也就是说，`Submit` 这类按钮的绑定不是“按钮直接调 Matrix”，也不是“按钮直接改结果 label”。按钮只产生一个 ModelTable-like 事件；后续是否触发程序、是否外发双总线，完全由模型表中的引脚和接线决定。

## 3. 滑动过程如何触发

如果要交付一个新的滑动 APP，则通过 Workspace 下的 `滑动 APP 导入` 触发安装。

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

完整可导入示例已经落盘：

```text
test_files/minimal_submit_dual_bus_app_payload.json
test_files/minimal_submit_dual_bus.zip
```

这两个文件是手工测试 zip 安装流程的基准资产。`zip` 版本只包含一个 `app_payload.json`，内容与 JSON 文件一致。

### 3.2 app_payload.json 后续如何生成

有两条正式路径：

1. **直接编写 ModelTable records array**。开发者按本节的单元格拆分方式写 `app_payload.json`，所有模型 id 都使用临时 id，例如根模型写 `id: 0`。如果 payload 里引用自己，也写 `model_id: 0`；导入器安装时会 remap 成正式模型 id。
2. **从 Workspace 已有 APP 导出 zip**。如果开发者已经在 Workspace 里通过填表做出了一个 `slide_capable=true` 的滑动 APP，可以在 Workspace 资产树里使用该 APP 行的 `Zip` 链接，或者直接访问：

```text
/api/slide-apps/<modelId>/export.zip
```

导出的 zip 会自动生成一个 `app_payload.json`。导出过程会去掉安装时生成的状态，例如 `installed_at`、`deletable`、`host_ingress_generated_*`、`host_egress_generated_*`，也会把正式 `model_id` 重新改写成临时 id。因此导出的包可以交给另一个环境再走 `滑动 APP 导入`。

引用其他模型时可以使用两种写法，导入/导出都会 remap：

```json
{ "k": "ui_bind_json", "t": "json", "v": { "read": { "model_id": 0, "p": 0, "r": 0, "c": 0, "k": "display_text" } } }
{ "k": "ui_text_ref_model_id", "t": "int", "v": 0 }
```

第一种是推荐写法，因为一个 label 里就能完整表达绑定关系；第二种是分散式引用写法，适合已有的 `ui_text_ref_*` 标签族。两种写法里的 `0` 都表示 zip 内的临时根模型，不是安装后的正式模型 id。

导出不是“把运行时完整数据库复制走”。它只导出当前 APP 自己的可交付模型表定义。Model 0、MBR、remote-worker 的运行态状态不在 zip 内；远端目标应由 APP root 上的 `remote_bus_endpoint_v1` 声明。

### 3.2a remote_bus_endpoint_v1

如果这个 APP 的 Submit 要交给远端 RE 的 provider model 处理，zip 里的 root `(0,0,0)` 应写：

```json
{
  "id": 0,
  "p": 0,
  "r": 0,
  "c": 0,
  "k": "remote_bus_endpoint_v1",
  "t": "json",
  "v": {
    "transport": "mqtt",
    "to": {
      "worker_id": "RE",
      "model_id": 3000
    }
  }
}
```

这里的 `3000` 是 RE 上的 provider model id，不是 UI Server 安装后的本地 model id。UI Server 安装时可能把这个 APP 分配成本地 `2000`、`2010` 或 `2030`，这些本地 id 只用于回包写回。

`remote_bus_endpoint_v1` 只允许声明远端 `route.to` 默认值中的 worker / model。这里不要写 `to.pin`，也不要写 `route.reply_to`。`route.to.pin` 来自当前触发的公开 pin；`route.reply_to` 必须由 UI Server 运行时按当前 host 与本地安装模型生成，zip 不能提供或覆盖。

同一个 root `(0,0,0)` 还必须显式声明哪些公开出口会走双总线：

```json
{
  "id": 0,
  "p": 0,
  "r": 0,
  "c": 0,
  "k": "dual_bus_model",
  "t": "json",
  "v": {
    "mode": "imported_host_egress",
    "egress_pins": ["submit1"]
  }
}
```

然后 root 上还要有同名普通出口：

```json
{ "id": 0, "p": 0, "r": 0, "c": 0, "k": "submit1", "t": "pin.out", "v": null }
```

如果将来有十个按钮，可以把 `egress_pins` 写成 `["submit1","submit2",...,"submit10"]`，并逐一声明同名 root `pin.out`。不能把 `egress_pins` 写成 `submit1:in`，因为那是函数端点，不是公开 Cell pin。

运行时点击 `submit1` 时，外发 packet 应表达：

```json
{
  "route": {
    "to": {
      "worker_id": "RE",
      "model_id": 3000,
      "pin": "submit1"
    },
    "reply_to": {
      "worker_id": "ui-server-U1",
      "model_id": 2000,
      "pin": "result"
    }
  }
}
```

MBR 不需要给这个 APP 预注册 per-app route。它只读取消息里的 `route.to`，再派生 transport topic 或目标地址。

### 3.2b RE Model 3000 如何把公开 pin 接到程序模型

topic 只负责把消息送到 RE 的 Model 0。真正触发哪个程序，由 RE Model `3000` 内部的模型表接线决定。

假设公开入口叫 `submit1`，实际程序模型在 `(1,1,1)`，第 0 格应填：

```json
[
  { "op": "add_label", "model_id": 3000, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "RE.ProviderApp" },
  { "op": "add_label", "model_id": 3000, "p": 0, "r": 0, "c": 0, "k": "submit1", "t": "pin.in", "v": null },
  { "op": "add_label", "model_id": 3000, "p": 0, "r": 0, "c": 0, "k": "result", "t": "pin.out", "v": null },
  { "op": "add_label", "model_id": 3000, "p": 0, "r": 0, "c": 0, "k": "submit1_route", "t": "pin.connect.cell", "v": [
    { "from": [0, 0, 0, "submit1"], "to": [[1, 1, 1, "submit1_in"]] },
    { "from": [1, 1, 1, "submit1_out"], "to": [[0, 0, 0, "result"]] }
  ] }
]
```

程序所在 Cell `(1,1,1)` 应填：

```json
[
  { "op": "add_label", "model_id": 3000, "p": 1, "r": 1, "c": 1, "k": "model_type", "t": "model.single", "v": "RE.Program.Submit1" },
  { "op": "add_label", "model_id": 3000, "p": 1, "r": 1, "c": 1, "k": "submit1_in", "t": "pin.in", "v": null },
  { "op": "add_label", "model_id": 3000, "p": 1, "r": 1, "c": 1, "k": "submit1_out", "t": "pin.out", "v": null },
  { "op": "add_label", "model_id": 3000, "p": 1, "r": 1, "c": 1, "k": "submit1", "t": "func.js", "v": { "code": "const inputRecords = Array.isArray(label && label.v) ? label.v : []; const routeRecord = inputRecords.find((record) => record && record.k === 'route' && record.t === 'json' && record.v && typeof record.v === 'object') || null; const route = routeRecord ? routeRecord.v : null; const replyTo = route && route.reply_to && typeof route.reply_to === 'object' && !Array.isArray(route.reply_to) ? route.reply_to : null; const businessPayload = inputRecords.filter((record) => !(record && record.k === 'route')); const textRecord = businessPayload.find((record) => record && record.k === 'text') || null; const text = String(textRecord && textRecord.v != null ? textRecord.v : '').trim(); const displayText = 'Submitted: ' + (text || '(empty)'); const resultPayload = [{ id: 0, p: 0, r: 0, c: 0, k: 'display_text', t: 'str', v: displayText }, { id: 0, p: 0, r: 0, c: 0, k: 'remote_status', t: 'str', v: 'remote_processed' }, { id: 0, p: 0, r: 0, c: 0, k: 'last_submit_payload', t: 'json', v: businessPayload }, { id: 0, p: 0, r: 0, c: 0, k: 'submit_inflight', t: 'bool', v: false }]; const safeSegment = (value) => typeof value === 'string' && value.trim() === value && value.length > 0 && !value.includes('/') && !value.includes('+') && !value.includes('#'); const mt = (k, t, v) => ({ id: 0, p: 0, r: 0, c: 0, k, t, v }); const validReplyTo = replyTo && safeSegment(String(replyTo.worker_id || '')) && Number.isInteger(Number(replyTo.model_id)) && Number(replyTo.model_id) > 0 && safeSegment(String(replyTo.pin || '')); if (!validReplyTo) { V1N.addLabel('remote_status', 'str', 'route_reply_to_missing'); V1N.addLabel('submit_inflight', 'bool', false); return null; } const opId = 'minimal_submit_result_' + Date.now(); const to = { worker_id: String(replyTo.worker_id).trim(), model_id: Number(replyTo.model_id), pin: String(replyTo.pin).trim() }; return [mt('__mt_payload_kind', 'str', 'pin_payload.v1'), mt('__mt_request_id', 'str', opId), mt('op_id', 'str', opId), mt('source_model_id', 'int', Number(replyTo.model_id)), mt('pin', 'str', String(replyTo.pin).trim()), mt('payload', 'json', resultPayload), mt('timestamp', 'int', Date.now()), mt('route', 'json', { to, from: { worker_id: 'RE', model_id: 3000, pin: 'submit1' } })];" } },
  { "op": "add_label", "model_id": 3000, "p": 1, "r": 1, "c": 1, "k": "submit1_wiring", "t": "pin.connect.label", "v": [
    { "from": "submit1_in", "to": ["submit1:in"] },
    { "from": "submit1:out", "to": ["submit1_out"] }
  ] }
]
```

`route.to.pin=submit1` 的含义是“进入 RE Model 3000 root 的公开 `submit1` 引脚”。它不是直接调用 `submit1:in`。函数端点不能跨 Cell 直连，必须先到函数所在 Cell 的普通 pin。

### 3.3 如何在 Workspace 触发导入

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

最直接的观察点是 MBR 派生出的 MQTT submit topic。按 0362 目标规约，topic 由 `route.to` 派生，因此 provider model id 是 RE 上的 `3000`：

```text
UIPUT/ws/dam/pic/de/sw/worker/RE/model/3000/pin/submit1
```

当浏览器点击 `Submit` 后，外部客户端应能在这个 topic 看到类似消息：

```json
{
  "version": "v1",
  "type": "pin_payload",
  "op_id": "minimal_submit_matrix_1778115519973",
  "source_model_id": 2000,
  "pin": "submit1",
  "route": {
    "to": { "worker_id": "RE", "model_id": 3000, "pin": "submit1" },
    "reply_to": { "worker_id": "ui-server-U1", "model_id": 2000, "pin": "result" }
  },
  "payload": [
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "ui_event.v1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "text", "t": "str", "v": "hello from browser" }
  ],
  "timestamp": 1778115519973
}
```

如果用 Matrix 客户端观察，则看 bus room / DM 中的 `dy.bus.v0` 事件；content 也是同一个 `pin_payload`。发送方向是 ui-server 到 `@mbr:<host_url>`。

### 4.2 如何直接改变 UI 显示

外部客户端要模拟 `RE` 回包时，向 `route.reply_to` 派生出的 result topic 发消息：

```text
UIPUT/ws/dam/pic/de/sw/worker/ui-server-U1/model/2000/pin/result
```

消息内容应是：

```json
{
  "version": "v1",
  "type": "pin_payload",
  "op_id": "manual_result_2000_001",
  "source_model_id": 2000,
  "pin": "result",
  "route": {
    "to": { "worker_id": "ui-server-U1", "model_id": 2000, "pin": "result" },
    "from": { "worker_id": "RE", "model_id": 3000, "pin": "submit1" }
  },
  "payload": [
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "display_text", "t": "str", "v": "Submitted: hello from external client" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "remote_status", "t": "str", "v": "remote_processed" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "last_submit_payload", "t": "json", "v": [
      { "id": 0, "p": 0, "r": 0, "c": 0, "k": "text", "t": "str", "v": "hello from external client" }
    ] },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "submit_inflight", "t": "bool", "v": false }
  ],
  "timestamp": 1778115520131
}
```

MBR 收到 result topic 后会把消息转回 Matrix，ui-server 收到后按 `source_model_id=2000` materialize 到本地安装的 UI 模型，页面上的显示文字会变成 `Submitted: hello from external client`。

Matrix 直接发送只适合使用被接收方信任的 bus peer 账号。普通第三方 Matrix 账号即使发出了 `dy.bus.v0`，也可能被接收方按 peer 过滤忽略。开发联调时优先使用上面的 MQTT topic 测试。

## 5. 不允许的旧写法

这些写法不属于当前示例，也不应作为新交付内容：

| 禁止项 | 原因 |
|---|---|
| `pin.connect.model` | 当前规约已移除，跨 cell / 子模型边界使用 `pin.connect.cell` 和 `model.submt` |
| `ctx.writeLabel` / `ctx.getLabel` / `ctx.rmLabel` | 旧 API，不作为新程序模型写法 |
| `input_value` 作为 `text` 的兜底字段 | 这是旧示例兼容口径，RE 当前只接受 `text` |
| zip 中提供 `route.reply_to` | 回包目标由 UI Server 运行时生成，不能被第三方包覆盖 |
| MBR per-app 静态 route 注册 | MBR 应读取消息里的 `route.to` 通用转发 |
| 前端直接发 Matrix | 正式业务必须先进入 Model 0 |
| 外部 MQTT 直接写任意 cell | 必须走声明过的 `pin_payload` 和 result materialization |

## 6. 最小验收流程

1. 浏览器打开 Workspace，进入 `最小 Submit 双总线示例`。
2. 输入 `hello dual bus`。
3. 点击 `Submit`。
4. 观察 `UIPUT/ws/dam/pic/de/sw/worker/RE/model/3000/pin/submit1` 收到 `text=hello dual bus`。
5. 观察 RE 按 `route.reply_to` 发布 result。
6. 浏览器显示 `Submitted: hello dual bus`，状态显示 `remote_processed`。
7. 再用外部 MQTT 客户端向 result topic 发送 `display_text=Submitted: manual external test`，确认页面显示被回流更新。
