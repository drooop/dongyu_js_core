---
title: "Minimal Submit Dual-Bus Visualized Guide"
doc_type: user-guide
status: active
updated: 2026-05-07
source: ai
---

# 最小 Submit 双总线示例可视化说明

这份文档是 `minimal_submit_app_provider_guide.md` 的可视化补充。它说明 `最小 Submit 双总线示例` 如何从 Workspace UI 进入 Model 0，再经过 Matrix、MBR、MQTT、remote-worker R1（RE），最后按 `route.reply_to` 回到本地 UI 模型。

## 1. 总链路

```mermaid
sequenceDiagram
  participant User as Browser User
  participant UI as UI local model 2000
  participant M0 as Model 0
  participant Matrix as Matrix dy.bus.v0
  participant MBR as MBR
  participant MQTT as MQTT topics
  participant R1 as remote-worker RE

  User->>UI: Type text and click Submit
  UI->>M0: bus_event_v2 with local model 2000 and pin submit1
  M0->>Matrix: pin_payload submit to @mbr:<host_url>
  Matrix->>MBR: dy.bus.v0 content
  MBR->>MQTT: route.to RE / model 3000 / pin submit1
  MQTT->>R1: trigger public pin submit1
  R1->>MQTT: route.reply_to ui-server-U1 / model 2000 / pin result
  MQTT->>MBR: result pin_payload
  MBR->>Matrix: dy.bus.v0 result
  Matrix->>UI: ui-server materializes result by local model id
  UI-->>User: Submitted: <输入内容>
```

## 2. RE 填表结构

```mermaid
flowchart TB
  R1["remote-worker RE"] --> M3000["Provider Model 3000<br/>model.table"]
  M3000 --> Pins["Root public pins<br/>submit1 pin.in<br/>result pin.out"]
  M3000 --> Routes["submit1_route<br/>pin.connect.cell"]
  Routes --> ProgramCell["Cell (1,1,1)<br/>submit1_in / submit1_out"]
  ProgramCell --> Func["submit1<br/>func.js"]
  Func --> Result["resultPayload<br/>display_text + remote_status"]
  Result --> Topic["reply_to<br/>ui-server-U1 model 2000 result"]

  classDef table fill:#e8f1f8,stroke:#2b6f9f,color:#102a43;
  classDef pin fill:#edf7ef,stroke:#357a54,color:#173b2b;
  classDef out fill:#fff0e6,stroke:#b35d2e,color:#4b2412;
  class M3000 table;
  class Pins,Routes,ProgramCell,Func pin;
  class Result,Topic out;
```

RE 的公开 `submit1` pin 不是程序端点本身。RE 需要用 `pin.connect.cell` 把 root `submit1` 接到 `(1,1,1).submit1_in`，再用同 Cell 的 `pin.connect.label` 把 `submit1_in` 接到 `submit1:in`。程序只读取 submit payload 里的 `text` record，不接受 `input_value` 旧字段兜底。

## 3. Workspace 导入过程

```mermaid
flowchart LR
  Zip["minimal-submit-dual-bus.zip"] --> Payload["app_payload.json<br/>temporary id: 0 records"]
  Payload --> Upload["/api/media/upload"]
  Upload --> Mxc["mxc://..."]
  Mxc --> Importer["Workspace: 滑动 APP 导入"]
  Importer --> Materialize["materialize into formal model id"]
  Materialize --> Mount["mount into Workspace"]
  Mount --> Adapter["auto host pins / Model 0 adapter"]
  Adapter --> App["Workspace slide app"]

  classDef file fill:#f7efe1,stroke:#9b6b2f,color:#1f2933;
  classDef host fill:#e8f1f8,stroke:#2b6f9f,color:#102a43;
  classDef app fill:#edf7ef,stroke:#357a54,color:#173b2b;
  class Zip,Payload file;
  class Upload,Mxc,Importer,Materialize,Mount,Adapter host;
  class App app;
```

zip 里只放 `app_payload.json`。这个文件是 ModelTable records array，不是 HTML 页面，也不是 patch ops。UI 应按 cell 拆分：Container、Card、Input、Button、Text、StatusBadge 分别是独立 cell。

开发者可以直接写 `app_payload.json`，也可以先在 Workspace 中填表做出一个 `slide_capable=true` 的 APP，再通过 `Zip` 链接或 `/api/slide-apps/<modelId>/export.zip` 导出。导出包会把正式模型 id 改回临时 id，并移除安装时生成的 `host_*_generated_*` 状态。绑定中的 `model_id` 字段和分散式 `*_model_id` 标签都会随导入/导出一起 remap。

如果 APP 要把 submit 交给远端 provider，root 应声明 `remote_bus_endpoint_v1`。该 label 只声明 `route.to.worker_id=RE` 与 `route.to.model_id=3000`，不能写 `to.pin`；公开 pin 必须由 `dual_bus_model.egress_pins=["submit1"]` 和 root `submit1 pin.out` 决定。`route.reply_to` 由 UI Server 运行时根据本地安装模型 id 生成，不能写在 zip 里。

## 4. 外部客户端收发测试

```mermaid
flowchart TB
  Browser["Browser Submit"] --> MBR["MBR"]
  MBR --> SubmitTopic["subscribe:<br/>worker/RE/model/3000/pin/submit1"]
  SubmitTopic --> Observer["External client observes<br/>pin_payload submit"]

  External["External client publishes result"] --> ResultTopic["publish:<br/>worker/ui-server-U1/model/2000/pin/result"]
  ResultTopic --> MBR2["MBR"]
  MBR2 --> Matrix["Matrix dy.bus.v0"]
  Matrix --> UIServer["ui-server"]
  UIServer --> UI["UI local model 2000<br/>display_text"]

  classDef observe fill:#e8f1f8,stroke:#2b6f9f,color:#102a43;
  classDef publish fill:#fff0e6,stroke:#b35d2e,color:#4b2412;
  classDef ui fill:#edf7ef,stroke:#357a54,color:#173b2b;
  class SubmitTopic,Observer observe;
  class External,ResultTopic publish;
  class UI ui;
```

观察 submit 时订阅：

```text
UIPUT/ws/dam/pic/de/sw/worker/RE/model/3000/pin/submit1
```

模拟 RE 回包并改变 UI 时发布：

```text
UIPUT/ws/dam/pic/de/sw/worker/ui-server-U1/model/2000/pin/result
```

result 消息的核心 payload：

```json
{
  "version": "v1",
  "type": "pin_payload",
  "source_model_id": 2000,
  "pin": "result",
  "route": {
    "to": { "worker_id": "ui-server-U1", "model_id": 2000, "pin": "result" },
    "from": { "worker_id": "RE", "model_id": 3000, "pin": "submit1" }
  },
  "payload": [
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "display_text", "t": "str", "v": "Submitted: hello from external client" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "remote_status", "t": "str", "v": "remote_processed" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "submit_inflight", "t": "bool", "v": false }
  ]
}
```

## 5. 快速检查表

| 检查项 | 正确结果 |
|---|---|
| UI 入口 | local model 的 `bus_event_v2 -> Model 0 pin.bus.mb.in` |
| Matrix event | `dy.bus.v0`，目标 `@mbr:<host_url>` |
| submit route | `route.to = RE / 3000 / submit1` |
| result route | `route.reply_to = ui-server-U1 / local model / result` |
| RE 程序接线 | root `submit1` -> `(1,1,1).submit1_in` -> `submit1:in` |
| 页面结果 | `Submitted: <输入内容>` |
| 禁止残留 | 无 `pin.connect.model`，无 `ctx.writeLabel/getLabel/rmLabel`，无 `input_value` 兼容兜底 |

交互版文档见：[minimal_submit_app_provider_interactive.html](minimal_submit_app_provider_interactive.html)。
