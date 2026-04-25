---
title: "Slide Delivery And Runtime Overview v1"
doc_type: user-guide
status: active
updated: 2026-04-26
source: ai
---

# Slide Delivery And Runtime Overview v1

## 这页负责什么

这页面向开发者解释一个“滑动 APP”从交付、安装、打开、运行到外发回流的完整过程。它不是新的协议源头，而是把当前已经冻结的主线讲清楚。

当前最重要的边界是：

- 安装交付和页面运行不是同一条链。
- 本地 UI 草稿 / overlay 不算正式业务。
- 正式业务 ingress 必须进入 `bus_event_v2 -> Model 0 (0,0,0) pin.bus.in -> pin route -> target`。
- 前端只渲染和收集事件，不保存业务 truth。
- 外发和回包必须经过 Model 0 和 owner materialization，不允许前端或 server 绕开主链直接改目标模型。

如果只需要上传鉴权、zip 结构、Matrix 投递或执行型 app 限制，可以继续看：

- `slide_upload_auth_and_cache_contract_v1.md`
- `slide_matrix_delivery_v1.md`
- `slide_app_zip_import_v1.md`
- `slide_executable_import_v1.md`

## 1. 安装交付

安装交付解决的是“把一个 app 放进当前 Workspace”，不是运行时业务发包。

当前正式安装链可以压缩成这一句：

```text
zip -> /api/media/upload -> mxc://... -> importer truth -> importer click pin -> materialize / mount
```

逐步展开是：

1. 开发者准备一个 slide app zip。
2. zip 里包含 `app_payload.json`，内容是临时 ModelTable record array。
3. 当前 ui-server 通过 `/api/media/upload` 接收 zip。
4. 上传返回 `mxc://...`，它只是 media URI，不是运行时业务消息。
5. importer truth 记录待导入 URI、校验状态和导入结果。
6. 用户或自动流程触发 importer click pin。
7. ui-server 校验包、分配正数 `model_id`、materialize 模型表记录。
8. Workspace mount 新模型，用户才能打开它。

安装交付链的 truth 在 importer 侧。导入完成以后，Workspace 看到的是 materialize 后的正数模型。

安装链不要做这些事：

- 不要让同事手工构造自定义 Matrix room message 来安装 app。
- 不要把运行时业务 payload 混进 installer。
- 不要把导入后点击按钮的事件当成安装协议的一部分。

## 2. App 结构

一个可运行的滑动 APP 至少按四层理解。

### root metadata

root metadata 决定这个 app 是否能被 Workspace 识别、列出和打开。

root `(0,0,0)` 通常至少包含：

- `model_type = model.table`
- `app_name`
- `source_worker`
- `slide_capable = true`
- `slide_surface_type`
- `from_user`
- `to_user`
- `ui_authoring_version`
- `ui_root_node_id`

这些 label 是 app 的入口 metadata，不是页面布局本身。

### UI projection layer

UI projection layer 决定页面怎么显示。当前主线优先使用 `cellwise.ui.v1`：

- root cell 声明 `ui_authoring_version = cellwise.ui.v1`。
- root cell 声明 `ui_root_node_id`。
- 每个 UI node 由一个 cell 上的 `ui_node_id` / `ui_component` / `ui_parent` / `ui_order` 等 label 组成。
- 前端按这些 label 投影成组件树。

开发者应把页面拆成多个 cell，而不是把整个页面塞进一个大 JSON 或 HTML 字符串。比如一行布局、一个按钮、一个输入框、一个状态块，都可以各自有独立 cell 和 label。

### optional program layer

optional program layer 是 app 自己的程序能力。不是所有 app 都需要程序层。

常见内容包括：

- `pin.in`
- `pin.out`
- `pin.connect.*`
- 同 cell `func.js`
- root `(0,0,0)` 的 `mt_write` / `mt_bus_receive` / `mt_bus_send`

程序层只负责 app 自己的业务链路。跨模型正式通信仍要走 pin 链，不允许前端直接写业务 truth。

### optional egress adapter

optional egress adapter 只在 app 需要外发时存在。

它的职责是把 app root 的 `pin.out` 接到宿主外发链，再由 Model 0 统一转成 `pin.bus.out`。没有外发需求的 app 不需要这一层。

## 3. 页面运行

页面运行解决的是“用户打开 app 后，前端如何渲染和提交事件”。

当前页面运行链可以压缩成：

```text
frontend renders cellwise.ui.v1
local draft / overlay stays local
formal business submit enters current pin chain
```

### 渲染阶段

前端读取 snapshot，根据 `cellwise.ui.v1` 渲染页面：

- `Container` 决定局部布局。
- `Input` / `Button` / `Table` / `Terminal` 等组件由模型表 cell 声明。
- 文案、标题、placeholder、布局方向、绑定关系都来自 label。
- 前端不把自己渲染出来的 UI 当 truth。

开发者可以通过改 label 改 UI。例如标题来自某个 `ui_text`，改这个 label 后，下次投影出来的标题也会变化。

### 本地草稿阶段

输入框、滑块、hover、展开态、临时选中态等可以先停留在本地 UI 草稿 / overlay。

本地 UI 草稿 / overlay 不算正式业务。它只影响当前交互体验，不代表业务已经提交，也不代表目标模型已经发生正式变化。

常见提交策略：

- `immediate`：交互发生后立即提交。
- `on_blur`：输入结束、离开输入框后提交。
- `on_submit`：输入先作为本地草稿，等按钮或明确 submit 动作一起提交。

### 正式业务 ingress

一旦事件不再是本地草稿，而是要触发业务程序、持久化、跨模型 relay 或外发 transport，它就是正式业务 ingress。

正式业务 ingress 必须进入：

```text
bus_event_v2 -> Model 0 (0,0,0) pin.bus.in -> pin route -> target
```

这意味着：

- 前端提交 `bus_event_v2`。
- `bus_event_v2.value` 必须已经是临时 ModelTable record array。
- server 只把合法 envelope 写入 Model 0 的 `pin.bus.in`。
- `pin.connect.model` 再把事件送到目标模型。
- 目标模型 root 的 `mt_bus_receive` 再按 payload 分发到目标 cell / target pin。

这种写法故意把“本地 UI 草稿”和“正式业务入口”分开，避免用户还在编辑时就把草稿误认为正式业务。

## 4. 外发回流

外发回流解决的是“已经装好的 app 如何把业务 payload 发到外部，再把回包合规地写回模型”。

当前外发回流链可以压缩成：

```text
app root pin.out -> host / mount relay -> Model 0 mt_bus_send -> pin.bus.out -> Matrix / MBR / MQTT -> return packet -> Model 0 -> owner materialization -> target model
```

逐步展开是：

1. app 内部程序模型完成业务处理。
2. 需要外发时，app root 写自己的 `pin.out`。
3. 宿主安装时生成的 host / mount relay 接住这个 `pin.out`。
4. relay 把 payload 转成 Model 0 的 `mt_bus_send` 请求。
5. Model 0 `mt_bus_send` 构造 `pin_payload v1`。
6. runtime 写入 Model 0 `pin.bus.out`。
7. Matrix / MBR / MQTT 只消费这条正式外发链。
8. 外部回包先回到 Model 0。
9. owner materialization 把回包对应的变化写回目标模型。
10. 前端收到新 snapshot 后重新投影页面。

这里有三个硬边界：

- app 自己不能绕开宿主直接发送 Matrix / MBR / MQTT。
- server 不能绕开 owner materialization 直接 patch 目标模型。
- 回包不能直接把浏览器 UI 当 truth，只能通过 Model 0 和 owner 链回到模型表。

## 给开发者的最短判断

如果你要交付一个 app：

- 准备 zip 和 `app_payload.json`。
- 走 `/api/media/upload` 和 importer。
- 确认 root metadata 足够让 Workspace 打开。

如果你要写页面：

- 用 `cellwise.ui.v1` 分 cell 描述组件。
- 文案、布局、绑定都写成 label。
- 不要用一个大 HTML 字符串替代模型表 UI。

如果你要提交业务：

- 本地输入先用 draft / overlay。
- 明确 submit / send / execute 后再进入 `bus_event_v2 -> Model 0 pin.bus.in`。
- payload 用临时 ModelTable record array。

如果你要外发：

- app root 写 `pin.out`。
- 宿主 relay 到 Model 0 `mt_bus_send`。
- 外部 transport 和回包都经 Model 0 与 owner materialization。
