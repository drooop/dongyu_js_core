---
title: "Slide Delivery And Runtime Overview v1"
doc_type: user-guide
status: active
updated: 2026-04-21
source: ai
---

# Slide Delivery And Runtime Overview v1

## 这页负责什么

这页只做一件事：

- 面向同事解释“一个 slide app 怎么交付进来，进来以后它怎么响应点击并继续跑下去”

它是总览页，不是新的协议源头。

所以这页会把两段链路并排讲清楚：

- 安装交付链
- 导入后运行链

但不会在这里重复展开这些细节：

- 上传鉴权和 cache 细节
  - 看 `slide_upload_auth_and_cache_contract_v1.md`
- zip 包导入细节
  - 看 `slide_matrix_delivery_v1.md`
- 填表创建字段说明
  - 看 `slide_app_filltable_create_v1.md`
- 执行型 app 的限制和示例
  - 看 `slide_executable_import_v1.md`

## 先看总图

当前 slide app 有两条不同的链：

1. 安装交付链
   - 把一个 app 交付进当前 ui-server，让它出现在 Workspace 里
2. 运行时触发链
   - app 已经装进来以后，前端点击、输入、提交怎样到达程序模型并继续沿 pin 链运行

这两条链不是一回事。

## 1. 安装交付

当前正式安装路径不是“同事手工构造一条自定义 Matrix room message”。

当前正式主线是：

1. 准备一个 slide app zip
2. 把 zip 发给当前 ui-server 的 `/api/media/upload`
3. 拿到上传返回里的 `mxc://...`
4. 把这个 URI 交给 importer 真值模型
5. 触发 importer 的 `click` pin
6. ui-server 校验包、分配新的正数 `model_id`、挂到 Workspace

如果同事走页面，这条链会被现成 importer 页面自动完成。

如果同事做程序接入，也必须遵守同一条主线，不要改写成别的安装协议。

这里有两个故意不展开的细节：

- 上传前到底要不要先登录
- 为什么有时会报 `media_not_cached`

这两点已经在正式合同页里固定：

- `slide_upload_auth_and_cache_contract_v1.md`

## 2. app 结构

当前可以把一个 slide app 理解成 4 层：

1. 交付层
   - 一个 zip
   - zip 内一个 `app_payload.json`
   - 内容是临时模型表数组：`id / p / r / c / k / t / v`
2. 根 metadata 层
   - root `(0,0,0)` 至少要有：
     - `model_type = model.table`
     - `app_name`
     - `source_worker`
     - `slide_capable = true`
     - `slide_surface_type`
     - `from_user`
     - `to_user`
     - `ui_authoring_version = cellwise.ui.v1`
     - `ui_root_node_id`
3. UI 投影层
   - 决定这个 app 在 Workspace 里怎么显示
   - 包括 page 节点、当前 cell、当前 pin、`writable_pins`
4. 可选执行层
   - 如果是执行型 app，还可以带最小程序能力：
     - 同 cell `func.js`
     - root / helper pin 链

按“同事实际要准备什么”再拆一次，可以更直接：

### 必须有的部分

- 一个 zip
- zip 内一个 `app_payload.json`
- 一个 root model
- root `(0,0,0)` 的最小 metadata
- 至少一套可被前端正常打开的 UI 投影信息

### 可选但常见的部分

- 可写 pin 定义
- `writable_pins`
- 同 cell `func.js`
- root / helper relay
- 运行中需要外发时的 Matrix transport relay

### 不要混成一回事的部分

- “这个 app 能不能被安装进来”
  - 看 zip、`mxc://...`、importer
- “这个 app 装进来以后能不能工作”
  - 看 UI 投影、pin、程序模型、后续 relay

也就是说：

- 安装成功，不等于运行链已经完整
- 运行链完整，也不等于可以跳过正式安装主线

换句话说，一个 app 不只是“一个页面”。

它至少同时包含：

- 安装时需要的交付结构
- Workspace 主线识别它需要的 metadata
- 页面本身的 UI 投影
- 可选的程序模型能力

补充一个容易混淆的点：

- 一个 cell 仍然只有一个有效模型标签
- 但它可以被多个上层 scope 发现

所以当前不是“一个 cell 显式同时属于很多模型”，而是：

- 真正执行靠目标坐标和已经建好的 pin 链
- 不是靠“我显式声明属于谁”来分支

## 3. 运行时触发

当前前端点击之后，不再把业务语义写成旧式 `action`。

正式方向已经冻结成：

- `target = cell`
- `pin = port`
- `value = pin 输入值`

所以一条前端事件现在表达的是：

- 把这个值写到“当前模型 + 当前单元格 + 当前 pin”

当前真实触发顺序是：

1. 前端把事件发给 server
2. server 直接把目标 pin 写到目标 cell
   - 目标就是 `Model 0` 时，写成 `pin.bus.in`
   - 其他模型时，写成目标 cell 的 `pin.in`
3. 当前 cell 收到这个 pin 后，先按它自己的逻辑处理
4. 如果这个 app 定义了后续 pin 链，再继续往 root / helper / 其他 relay 走
5. 最终由目标程序模型完成业务写入或外发

换成“导入 app 以后真正发生了什么”的说法就是：

1. 导入完成后，ui-server 会给这个 app 分配新的正数 `model_id`
2. 这个 app 自己随包带来的 UI 定义和程序模型，都会落到这个新模型空间里
3. 前端收到新的 snapshot 后，负责：
   - 按当前投影渲染页面
   - 读取最新值
   - 在用户交互时把事件发回后端
4. 当用户点击 `submit` / `click` 这类节点时，前端发回的是：
   - 当前模型
   - 当前单元格
   - 当前 pin
5. 后端把这个 pin 写进目标 cell 后，剩下的事情就交给这个 app 自己定义的 pin 链继续推进

所以当前项目里，“后端支持导入 app 自带程序模型”这句话已经成立，但成立的方式不是 server 替 app 猜业务，而是：

- server 负责把事件准确送到目标 cell / target pin
- app 自己负责定义后续怎么从这个 pin 继续走

这也是为什么这页只说“先到当前模型当前单元格当前 pin”，不说“所有事件都必须先经过 Model 0 IN”。

当前真实语义是：

- 浏览器事件先直达目标 cell
- 后续是否继续 relay 到 root、helper、Model 0，取决于这个 app 自己定义的 pin 链

另外，输入同步现在也不是默认逐键写回。

正数模型输入当前已经落实为延后同步：

- 常见是 `on_blur`
- 或按提交时机再真正发出去

当前可以把输入提交时机理解成 3 类：

- `immediate`
  - 需要马上提交的交互
- `on_blur`
  - 输入结束、离开输入框时再提交
- `on_submit`
  - 先保留本地草稿，等真正触发提交动作时再一起送出

所以“用户正在打字”和“后端已经收到业务提交”也不是一回事。

## 3.1 运行时对外发送（0322 补）

imported slide app 的业务结果要发到 MQTT / Matrix，走宿主补齐的出站 adapter，不是 app 自己发：

1. imported app 内部程序模型把结果写到 root `(0,0,0)` 的 `pin.out submit`（由 `owner_materialize` 应用 `apply_records` 完成）。
2. 宿主安装时生成的 `mountBridge` 把 `submit` value 写到 Model 0 mount cell 的 `__host_egress_submit_relay_<id>`。
3. 宿主的 `model0_route` 把 value 再转到 Model 0 `(0,0,0)` 的 `imported_submit_<id>_out`。
4. 这次写入被 EventLog observer 触发 `programEngine.tick()`，`processEventsSnapshot` 找到对应 `forward_imported_submit_from_model0_<id>` 函数并执行。
5. forward 函数构造 `pin_payload v1` packet，写入 Model 0 `pin.bus.out` → MQTT publish，并 `ctx.sendMatrix(packet)` → Matrix publish；失败会落到 `<forwardFunc>_last_error` JSON label 上（op_id + reason + ts）。
6. forward 收尾把 egress label 和 imported root `submit` reset 回 null，避免重放。

卸载 imported app 时，这一整套 labels（ingress + egress + forwardFunc + error label）都按 `host_ingress_generated_*` / `host_egress_generated_*` 清单 rm_label 清理。

## 4. Matrix 关系

这里最容易混淆，必须分开看。

### A. 安装时的 Matrix 关系

安装时，Matrix 的角色是：

- 作为 media 承载层

也就是：

- zip 先进 Matrix media
- 当前 ui-server 通过 `/api/media/upload` 拿到 `mxc://...`
- importer 再消费这个 `mxc://...`

这条链解决的是：

- “把一个 app 安装进来”

它不是运行时业务发包链。

### B. 运行中的 Matrix 关系

运行中，Matrix 的角色是：

- 业务 payload 的 transport

当前仓库里已经存在正式 transport：

- `pin_payload v1`

这条链解决的是：

- app 在运行中把业务 payload 往外发
- 或从外部 transport 回来，再继续进入模型链路

它不是安装导入协议，也不要求同事为安装去手写一条新的 room message。

如果同事这一侧真要接运行中的业务发包，当前应该对接的也不是自定义 slide room message，而是现有 `pin_payload v1`。

最小形状可以理解成：

```json
{
  "version": "v1",
  "type": "pin_payload",
  "op_id": "example_1712709000000",
  "source_model_id": 1201,
  "pin": "submit",
  "payload": [
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.RemoteSubmit" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "input_value", "t": "str", "v": "hello" }
  ],
  "timestamp": 1712709000000
}
```

这条消息表达的不是“安装一个 slide app”，而是：

- 某个已经装进来的 app
- 在运行中
- 把自己的业务 payload 从既有 pin 链外发出去

什么时候才需要它：

- 当这个 app 自己的运行链定义了“继续向外发 Matrix / MBR / remote-worker”

什么时候不需要它：

- 只是把 app 安装进来
- 只是本地 cell 内或本地模型内就能完成的处理

最短理解可以记成：

- 安装看：
  - zip -> upload -> `mxc://...` -> importer
- 运行看：
  - 当前 cell / 当前 pin -> app 自己的 pin 链 -> 需要时再到 Matrix transport

如果你在看运行时的 Matrix 流转细节，继续看：

- `docs/ssot/ui_to_matrix_event_flow.md`

## 给同事的最短判断

如果同事只是要“把一个 slide app 交付进来”，先看：

- `slide_matrix_delivery_v1.md`
- `slide_upload_auth_and_cache_contract_v1.md`

如果同事还要理解“导入后这个 app 为什么点一下就能继续跑”，再补看：

- 本页第 3 节
- `slide_executable_import_v1.md`

如果同事要区分“安装时 Matrix 在做什么”和“运行中 Matrix 在做什么”，直接看本页第 4 节即可。
