---
title: "How To Interact With Workspace Manager"
doc_type: user-guide
status: active
updated: 2026-05-23
source: codex
---

# 如何与工作区管理器交互

这份文档面向滑动 APP 提供方。它说明开发者完成 UI 模型后，怎样准备 ZIP、怎样上传得到资源引用，以及怎样把一个“可安装滑动 APP”索引发布到 Workspace Manager。

当前结论先放在前面：

- Workspace Manager 只维护资产索引，不拥有滑动 APP bundle 的真实内容。
- 实际安装时，UI Server 会根据索引向 provider worker 请求 bundle，再把 provider 返回的 ModelTable records 安装成本地滑动 APP。
- 完整 topic 不是目录真源；它由 Model 0 `mqtt_topic_base` 和目录行里的 endpoint labels 拼接得到。
- 上传 ZIP 后得到的 `mxc://...` 可以作为资源路径记录在索引里，方便审计、下载或人工核对；当前安装真源仍是 provider endpoint 返回的 `bundle_payload`。

## 1. 术语

| 名称 | 含义 |
|---|---|
| UI Server | 用户正在使用的界面宿主，负责安装、挂载和显示滑动 APP |
| Workspace Manager | 工作区管理器，负责展示可用资产和可安装滑动 APP 索引 |
| provider worker | 实际提供滑动 APP bundle 的软件工人，例如 `R1` |
| bundle provider model | provider worker 上负责返回 bundle 的模型，例如 `3100` |
| runtime endpoint | 安装后的 APP 点击按钮时，正式业务消息要发往的远端业务模型 |
| resource URI | 上传 ZIP 后得到的资源引用，当前通常是 `mxc://...` |

## 2. Topic 拼接审查结论

当前实现与文档一致：topic 是拼接完成的，但拼接输入不是“完整 topic 字符串”，而是 endpoint labels。

### 2.1 Provider-owned 安装请求 topic

Workspace Manager 目录行保存这些 label：

| label | 示例 | 作用 |
|---|---|---|
| `provider_worker_id` | `R1` | 哪个 worker 提供 bundle |
| `provider_model_id` | `3100` | 哪个 provider 模型返回 bundle |
| `provider_bundle_pin` | `bundle_request` | provider 模型的公开入口 pin |
| `provider_route_kind` | `control` | UI Server 先走控制总线还是管理总线 |

UI Server 读取 Model 0 第 0 格的：

```text
mqtt_topic_base = UIPUT/<ws_id>/<dam_id>/<pic_id>/<de_id>
```

然后拼接出安装请求 topic：

```text
<mqtt_topic_base>/<provider_worker_id>/<provider_model_id>/<provider_bundle_pin>
```

例如：

```text
UIPUT/ws/dam/pic/de/R1/3100/bundle_request
```

这个完整 topic 会写入临时 ModelTable payload 的 `topic` label，用于 MBR 转发。UI Server 同时生成 `response_topic = <mqtt_topic_base>/<host-transport-worker>/<host-transport-model>/<reply-pin>` 用于回包投递。若这次请求来自安装后的 App instance，payload 还必须带 `origin_table_id` 与 `reply_target_table_id`；真正 materialize 回哪张 App table 由 `reply_target_table_id + reply_target_model_id` 决定，而不是由 `response_topic` 的 model 段决定。完整 topic 可以投影成 `provider_bundle_topic` 给界面显示，但不能把 `provider_bundle_topic` 当作目录真源。

### 2.2 安装后业务运行 topic

安装后的滑动 APP root 通过 `remote_bus_endpoint_v1` 声明远端业务目标：

```json
{
  "transport": "mqtt",
  "route_kind": "control",
  "to": {
    "worker_id": "R1",
    "model_id": 3000
  }
}
```

远端 pin 不写在 `remote_bus_endpoint_v1` 里，而是来自当前被触发的公开 `pin.out`，例如 `submit1`。因此业务运行 topic 是：

```text
<mqtt_topic_base>/<remote_worker_id>/<remote_model_id>/<current_public_pin>
```

例如：

```text
UIPUT/ws/dam/pic/de/R1/3000/submit1
```

### 2.3 拼接格式要求

完整 endpoint topic 必须是 8 段：

```text
UIPUT/<ws_id>/<dam_id>/<pic_id>/<de_id>/<worker_id>/<model_id>/<pin>
```

验证规则：

- `mqtt_topic_base` 必须是 5 段。
- 完整 topic 必须是 8 段。
- 第一段必须是 `UIPUT`。
- 每一段都不能为空。
- 任何段都不能包含 `/`、`+`、`#`。
- `model_id` 必须是正整数。

## 3. 开发完成后如何准备 ZIP

开发者最终交付的 ZIP 只需要包含一个文件：

```text
my-slide-app.zip
└── app_payload.json
```

`app_payload.json` 是一个 ModelTable record array。它必须包含：

| 类别 | 必要 label |
|---|---|
| root metadata | `model_type`、`app_name`、`slide_app_summary`、`slide_capable`、`slide_surface_type`、`source_worker`、`from_user`、`to_user`、`ui_authoring_version`、`ui_root_node_id` |
| UI 投影 | `ui_node_id`、`ui_component`、`ui_parent`、`ui_props_json` 等 cellwise UI labels |
| 宿主 ingress | `host_ingress_v1`，说明 UI Server 安装后怎样把 submit 等正式业务事件接进来 |
| 对外 egress | `dual_bus_model`、公开 root `pin.out`，例如 `submit1` |
| 远端业务目标 | `remote_bus_endpoint_v1`，只写 worker / model / route kind，不写 pin 和 reply target |

最小 root endpoint 示例：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "app_name", "t": "str", "v": "最小 Submit 双总线示例" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "slide_app_summary", "t": "str", "v": "输入内容后通过远端 worker 处理并回写显示。" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "remote_bus_endpoint_v1", "t": "json", "v": {
    "transport": "mqtt",
    "route_kind": "control",
    "to": { "worker_id": "R1", "model_id": 3000 }
  }}
]
```

注意：

- ZIP 内不要写 `pin.bus.*`。
- ZIP 内不要写 `reply_target_*`。
- ZIP 内不要写完整安装后本地 model id。
- ZIP 内不要写 `remote_bus_endpoint_v1.to.pin`。

## 4. 如何上传得到资源路径

上传入口是当前 UI Server：

```text
POST /api/media/upload?filename=<your-app>.zip
```

上传成功后会得到一个 `mxc://...`。这个 URI 表示 ZIP 已经进入当前 UI Server 可识别的 media cache。

资源路径的用途分两类：

| 用途 | 当前状态 |
|---|---|
| 直接 ZIP 导入 | 可以把 `mxc://...` 写入“滑动 APP 导入”页面，再触发导入 |
| Workspace Manager 索引 | 可以把 `mxc://...` 写成 `bundle_resource_uri`，作为目录元数据和审计信息 |

重要边界：

- `bundle_resource_uri` 不是 provider-owned 安装的安装真源。
- Workspace Manager 的安装按钮不会只凭 `mxc://...` 创建 APP。
- 安装真源必须来自 provider worker 对 `slide_app_bundle_request.v1` 的回包，其中 `bundle_payload` 才是实际 ModelTable records。

## 5. 如何添加一个滑动 APP 索引

当前 Workspace Manager 的资产目录是一个 `Data.Array.One` 模型。每一行代表一个资产。滑动 APP 资产行至少要填这些 label：

| label | 类型 | 是否必填 | 含义 |
|---|---|---|---|
| `asset_id` | `str` | 必填 | 目录中的稳定资产 id，例如 `r1-minimal-submit` |
| `name` | `str` | 必填 | 显示名称 |
| `kind` | `str` | 建议 | 资产类别，例如 `slide_app` |
| `asset_type` | `str` | 必填 | 滑动 APP 写 `slide_app` |
| `owner` | `str` | 必填 | 所属 DE 或提供方名称，例如 `RemoteWorker-DE` |
| `owner_worker_id` | `str` | 必填 | 对应软件工人的 ID，例如 `R1` |
| `parent_asset_id` | `str` | 建议 | 父资产 id，例如 `r1` |
| `bundle_resource_uri` | `str` | 建议 | 上传 ZIP 后得到的资源路径，例如 `mxc://...` |
| `provider_worker_id` | `str` | 必填 | 提供 bundle 的 worker |
| `provider_model_id` | `int` | 必填 | 提供 bundle 的模型 |
| `provider_bundle_pin` | `str` | 必填 | 提供 bundle 的公开 pin |
| `provider_route_kind` | `str` | 必填 | `control` 或 `management` |
| `runtime_endpoint_worker_id` | `str` | 必填 | APP 安装后业务运行目标 worker |
| `runtime_endpoint_model_id` | `int` | 必填 | APP 安装后业务运行目标模型 |
| `runtime_pins` | `json` | 必填 | APP 安装后可能触发的公开 pin，例如 `["submit1"]` |
| `bundle_sha256` | `str` | 可选 | bundle hash，用于审计 |
| `installable` | `bool` | 必填 | 是否显示安装动作 |
| `action_label` | `str` | 建议 | 按钮文案，通常是 `安装` |
| `summary_markdown` | `str` | 建议 | 列表摘要 |
| `detail_markdown` | `str` | 建议 | 详情 Dialog 内容 |

### 5.1 最小目录行示例

假设：

- provider worker 是 `R1`
- bundle provider model 是 `3100`
- bundle 请求 pin 是 `bundle_request`
- 安装后业务模型是 `3000`
- 业务 pin 是 `submit1`
- 上传资源路径是 `mxc://example/media-id`

在 Workspace Manager asset catalog 中新增一行：

```json
[
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "asset_id", "t": "str", "v": "r1-minimal-submit" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "name", "t": "str", "v": "最小 Submit 双总线示例" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "kind", "t": "str", "v": "slide_app" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "asset_type", "t": "str", "v": "slide_app" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "owner", "t": "str", "v": "RemoteWorker R1" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "owner_worker_id", "t": "str", "v": "R1" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "parent_asset_id", "t": "str", "v": "r1" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "bundle_resource_uri", "t": "str", "v": "mxc://example/media-id" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "provider_worker_id", "t": "str", "v": "R1" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "provider_model_id", "t": "int", "v": 3100 },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "provider_bundle_pin", "t": "str", "v": "bundle_request" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "provider_route_kind", "t": "str", "v": "control" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "runtime_endpoint_worker_id", "t": "str", "v": "R1" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "runtime_endpoint_model_id", "t": "int", "v": 3000 },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "runtime_pins", "t": "json", "v": ["submit1"] },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "installable", "t": "bool", "v": true },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "action_label", "t": "str", "v": "安装" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "summary_markdown", "t": "str", "v": "### 最小 Submit 双总线示例\n\n由 RemoteWorker R1 提供，安装后点击 Submit 会走双总线回写显示。" },
  { "model_id": 1052, "p": 0, "r": 7, "c": 0, "k": "detail_markdown", "t": "str", "v": "## 最小 Submit 双总线示例\n\nBundle endpoint：R1 / 3100 / bundle_request。\n运行时 endpoint：R1 / 3000 / submit1。" }
]
```

同时要把目录 root 的 `max_r` 更新到包含新行，例如从 `6` 改成 `7`。

## 6. Provider worker 需要怎样响应安装请求

Workspace Manager 目录行只是告诉 UI Server “去哪里请求 bundle”。真正的 provider worker 需要在 `provider_model_id / provider_bundle_pin` 上响应请求。

请求 payload 的 nested `payload` 是：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "slide_app_bundle_request.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "asset_id", "t": "str", "v": "r1-minimal-submit" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "requested_version", "t": "str", "v": "current" }
]
```

provider 返回的 nested `payload` 必须是：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "slide_app_bundle_response.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "asset_id", "t": "str", "v": "r1-minimal-submit" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "bundle_payload", "t": "json", "v": [] },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "bundle_sha256", "t": "str", "v": "" }
]
```

其中 `bundle_payload.v` 是完整滑动 APP ModelTable record array，也就是 ZIP 里的 `app_payload.json` 内容。

## 7. 安装点击后的完整路径

```text
Workspace Manager 安装按钮
-> UI Server 读取 Workspace Manager asset row
-> 用 mqtt_topic_base + provider endpoint 拼出 topic
-> Model 0 bus out 发出 slide_app_bundle_request.v1
-> MBR 按 payload.topic 转发
-> provider worker 返回 slide_app_bundle_response.v1
-> UI Server 校验 pending install state
-> 校验 bundle_payload
-> materialize 成新的本地滑动 APP 模型
-> 挂到桌面 / 滑动 APP 列表
```

必须校验一致的内容：

- `op_id` 或请求关联信息
- `asset_id`
- provider endpoint
- computed topic
- `route_kind`
- `reply_target`

任何错资产、错 endpoint、错 topic、错 reply target 或过期回包，都不能创建本地模型。

## 8. 常见错误

| 错误 | 原因 | 修正 |
|---|---|---|
| 安装按钮没有显示 | `asset_type` 不是 `slide_app`，或 `installable` 不是 `true` | 修改目录行 |
| 点击安装后没有生成 APP | provider 没有返回合法 `slide_app_bundle_response.v1` | 检查 provider 模型和 `bundle_request` pin |
| topic 不符合预期 | `mqtt_topic_base` 或 endpoint labels 填错 | 检查 Model 0 `mqtt_topic_base` 和目录行 |
| 导入被拒绝 | `bundle_payload` 中缺少 root metadata 或包含禁止 label | 按 slide-app import validator 修正 |
| 回包被拒绝 | `asset_id`、topic、route kind 或 reply target 与 pending state 不一致 | 确保 provider 原样保留请求关联字段 |

## 9. 当前边界

- 当前是目录发布机制，不是自动全网扫描。
- `bundle_resource_uri` 是索引元数据，不是 provider-owned 安装真源。
- `provider_bundle_topic` 是派生投影，不应手写成目录真源。
- 如果需要跨工作区或 VPN 外路径，可以把 `provider_route_kind` 或 `remote_bus_endpoint_v1.route_kind` 写成 `management`，让 UI Server 先走管理总线到 MBR。
