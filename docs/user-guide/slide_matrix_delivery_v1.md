---
title: "Slide Matrix Delivery v1"
doc_type: user-guide
status: active
updated: 2026-04-10
source: ai
---

# Slide Matrix Delivery v1

## 这份文档解决什么

这份文档是 `0309` 的正式版，替代 `0304` 的 preview note。

它只写当前已经稳定的做法，不再混入已经退役的旧入口，也不提前定义还没落地的新房间消息协议。

## 先说结论

当前 slide app 的正式交付分成两段：

1. 先把 zip 放进 Matrix media，拿到一个 `mxc://...`。
2. 再让 importer 主线消费这个 `mxc://...`，走当前稳定的 pin-chain 完成安装。

也就是说：

- 正式交付单元还是 zip。
- zip 里的内容还是 `app_payload.json`。
- 正式业务入口已经不是旧的 `action=slide_app_import`。
- `0308` 之后，slide 主线旧 action 会直接返回 `legacy_action_protocol_retired`。

## 当前正式边界

### 已冻结

- zip 包格式
- root metadata 最小集
- `slide_surface_type` 枚举
- 前端 pin 直寻址协议
- importer / creator / workspace 系统按钮的 pin 化入口
- slide 主线旧 action 退役

### 当前不定义为正式协议

- 不定义新的 Matrix room event type
- 不定义“别人随便丢一个外部 `mxc://`，server 自动去拉取”的能力
- 不恢复 slide 主线 legacy `action` 路由

当前 live code 的稳定做法是：

- `slideImportAppFromMxc()` 只消费当前 server 已缓存的 Matrix media
- importer 真值模型从 `slide_import_media_uri` 读取 `mxc://...`
- 按钮点击走 pin-chain，不走旧 action

## 同事侧最短工作流

### 路径 A：直接用现成 importer 页面

这是当前最短、最稳的做法。

1. 准备一个符合要求的 slide app zip。
2. 在 Workspace 打开 `滑动 APP 导入`。
3. 上传 zip。
4. 页面会先把文件放进 Matrix media，并写入 importer 真值里的 `slide_import_media_uri`。
5. 点击 `导入 Slide App`。
6. 确认新 app 出现在 Workspace 侧边栏并可打开。

这条路径里：

- Matrix media 上传已经发生了
- importer pin-chain 也已经发生了
- 同事不需要再手工发旧 action 消息

### 路径 B：做程序接入时该怎么理解

如果不是走页面，而是做程序接入，当前也必须遵守同一条正式主线：

1. 先让 zip 进入 Matrix media，得到 `mxc://...`
2. 保证这个 `mxc://...` 已被当前 ui-server 缓存
3. 把这个 URI 交给 importer 真值模型
4. 触发 importer host 上的 `click` pin

不要做这些事：

- 不要再发 `action=slide_app_import`
- 不要把 room message 自定义成另一套正式业务协议
- 不要绕开 importer，直接把 zip 交给 runtime

## 包结构

zip 内当前只放一个 JSON 文件，建议叫：

- `app_payload.json`

文件内容继续使用临时模型表数组合同：

- `id`
- `p`
- `r`
- `c`
- `k`
- `t`
- `v`

这意味着：

- zip 里的模型记录
- importer materialize 前的临时记录

使用的是同一套结构。

## Root metadata 最小集

导入包里必须有一个唯一的 slide app root model。

它的 `(0,0,0)` 至少要带这些 labels：

- `model_type = model.table`
- `app_name`
- `source_worker`
- `slide_capable = true`
- `slide_surface_type`
- `from_user`
- `to_user`
- `ui_authoring_version = cellwise.ui.v1`
- `ui_root_node_id`

其中：

- `slide_capable + slide_surface_type`
  - 决定它能不能进入 Workspace 的 slide 主线
- `from_user + to_user`
  - 会进入 Workspace registry，也会回写到导入结果状态里
- `ui_authoring_version + ui_root_node_id`
  - 决定前端能不能按当前 cellwise 投影正常打开

## `slide_surface_type` 当前正式枚举

- `flow.shell`
  - 内置 flow shell 页面
- `workspace.importer`
  - importer 自己的工作页
- `workspace.page`
  - 导入后可直接在 Workspace 右侧打开的页面型 app

新增枚举值时，必须先改现行规约，再进入实现。

## 执行型 app 的当前口径

`0307` 之后，导入 app 可以带两类最小业务：

- 同 cell `func.js`
- 继续走 pin 链到 root / helper，再完成后端写入

但导入边界没有放宽成“什么都能带”。

当前仍明确不支持：

- `func.python`
- `pin.bus.in`
- `pin.bus.out`
- `pin.connect.model`
- 覆盖系统 helper / privilege labels
- 浏览器侧任意 `eval`

如果同事要做执行型 app，包结构和导入主线不变，只是在 app 内部程序模型上多了可执行最小能力。具体例子继续看：

- `slide_executable_import_v1.md`

## 当前正式消息怎么发

### 1. 安装消息

当前正式安装消息不是“旧 action 消息”，而是：

- 一个 Matrix media URI
- 再加一个 importer `click` pin 触发

最小 pin 消息示例：

```json
{
  "event_id": 1712709000000,
  "type": "click",
  "payload": {
    "meta": {
      "op_id": "slide_import_click_1712709000000"
    },
    "target": {
      "model_id": 1030,
      "p": 2,
      "r": 4,
      "c": 0
    },
    "pin": "click",
    "value": {
      "click": true
    }
  },
  "source": "ui_renderer",
  "ts": 1712709000000
}
```

配套前提是：

- importer 真值模型 `1031` 已经持有 `slide_import_media_uri = mxc://...`
- 这个 `mxc://...` 对当前 ui-server 来说是可读的已缓存媒体

对接时要记住：

- zip 本身不直接当 runtime 指令
- `mxc://...` 才是 importer 当前消费的交付引用
- 触发入口是 importer 的 pin，不是 `action`

### 2. 页面内业务消息

`0310/0311` 之后，页面内正式业务消息也不再以 `action` 为中心。

正式方向是：

- `target = cell`
- `pin = port`
- `value = pin 输入值`

也就是说，前端表达的是：

- “把这个值写到这个 cell 的这个 pin”

而不是：

- “请 server 按某个 action 猜我要做什么”

## 事件链怎么走

### 外部导入链

这是同事最需要理解的一条链：

1. zip 进入 Matrix media
2. importer 真值模型拿到 `slide_import_media_uri`
3. importer 按钮收到 `click` pin
4. importer 内部程序模型继续把请求交给 slide import handler
5. handler 调 `slideImportAppFromMxc()`
6. server 校验包、分配新的正数 `model_id`、挂到 Workspace
7. Workspace registry 刷新，新 app 可打开

### app 内部业务链

导入完成后，app 自己的业务继续走自己的 pin 链：

1. 前端节点把值写到当前 cell 的 pin
2. 当前 cell 可本地处理
3. 也可以继续经 `pin.out` / helper 链传播
4. 最终由目标程序模型完成业务写入

这就是为什么要把两条链分开理解：

- 导入链负责“把 app 装进来”
- app 内部链负责“这个 app 装进来以后怎么工作”

## 当前不该再写进同事文档的旧做法

这些都已经不是正式主线：

- `action=slide_app_import`
- `action=slide_app_create`
- `action=ws_app_add`
- `action=ws_app_delete`
- `action=ws_select_app`
- `action=ws_app_select`

这些旧 slide action 现在应统一视为：

- `legacy_action_protocol_retired`

非 slide legacy action 目前仍有兼容保留，但不属于这份文档范围。

## 最短验证

### 人工验证

1. 打开 Workspace。
2. 打开 `滑动 APP 导入`。
3. 上传一个符合要求的 zip。
4. 点击 `导入 Slide App`。
5. 确认侧边栏新增 app。
6. 点击 `Open`，确认页面能打开。
7. 如果是执行型 app，再点一次示例按钮，确认状态变化。
8. 点击 `Delete`，确认它从侧边栏消失。

### 自动验证

最短建议跑这两条：

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based
node scripts/tests/test_0308_slide_legacy_action_retirement_server_flow.mjs
node scripts/tests/test_0311_workspace_pin_addressing_server_flow.mjs
```

它们分别覆盖：

- 旧 slide action 已退役
- pin 直寻址的 add / import / create / select / delete 仍成立

## 相关文档

- `slide_app_zip_import_v1.md`
  - 包格式、导入字段和安装/卸载规则
- `slide_executable_import_v1.md`
  - 执行型导入的边界和示例
- `slide_workspace_generalization.md`
  - slide-capable app 的统一主线合同
- `modeltable_user_guide.md`
  - mailbox / pin / slide surface 的全局规则
