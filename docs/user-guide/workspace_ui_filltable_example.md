---
title: "Workspace UI Fill-Table Example"
doc_type: user-guide
status: active
updated: 2026-04-21
source: ai
---

# Workspace UI Fill-Table Example

本文对应 Workspace 侧边栏中的正式示例：`0270 Fill-Table Workspace UI`。

目标：
- 用填表方式组合出一个 `Input + Button + Label` 界面。
- 让它作为独立条目挂到 Workspace 侧边栏。
- 只通过改表切换两种链路：
  - 远端双总线模式
  - 本地程序模型模式
- 只通过改表影响布局与样式。

## 1. 最终界面效果

打开 `Workspace` 后，左侧侧边栏会出现 `0270 Fill-Table Workspace UI`。

点击 `Open` 后，右侧显示：
- 左边一个 `Input`
- 右边一个 `Confirm`
- 下方一个 `Label`

下方 `Label` 统一读取 `Model 1010` 的 `generated_color_text`。
不管当前走远端模式还是本地模式，页面都只认这一条结果标签。

## 2. 预置模型结构

本示例默认使用两个正数模型：

- `Model 1009`
  - Workspace 可见的 app host
  - 负责页面 UI 节点、Workspace 展示、以及把子模型 `submit` 往上 relay
- `Model 1010`
  - 真正的交互 truth
  - 负责输入草稿、结果文本、链路模式、布局参数、样式参数

挂载关系：

- `Model 0 -> Model 1009`
- `Model 1009 (0,2,0) -> Model 1010`

## 3. 页面组件由哪些标签驱动

### 3.1 Input

`Model 1009` 中的 Input 节点绑定到：

- 读取：`Model 1010 / (0,0,0) / input_draft`
- 写回：`ui_owner_label_update -> Model 1010 / input_draft`

所以输入框里的内容本身就是填表状态，不是硬编码状态。

### 3.2 Button

`Confirm` 按钮绑定到：

- action：`submit`
- `meta.model_id = 1010`

这会把事件写入 `Model 1010` 的 `ui_event`，再由 `dual_bus_model.ui_event_func` 接到处理链。

### 3.3 Label

结果文本节点只读取：

- `Model 1010 / (0,0,0) / generated_color_text`

因此：
- 远端返回时，更新的是这条标签
- 本地程序模型处理时，更新的也是这条标签

## 4. 远端模式

默认远端模式依赖：

- `Model 1010 / submit_route_mode = remote`
- `Model 1010 / (1,0,0) / processor_routes`
- `Model 0 / ws_filltable_submit_out`
- `MBR` 的 `mbr_route_1010`
- `remote-worker` 的 `11_model1010.json`

默认 `processor_routes` 值应把 `confirm` 接到 `dispatch_remote`：

```json
[
  {
    "from": "(self, confirm)",
    "to": [
      "(func, dispatch_remote:in)"
    ]
  }
]
```

远端模式完整链路：

1. `Button` 触发 `Model 1010 ui_event`
2. `prepare_workspace_filltable_submit` 把事件送到 `Model 1010 (1,0,0) confirm`
3. `dispatch_remote` 把 payload 写到 `Model 1010 / submit`
4. `Model 1009` hosting cell 把 child `submit` 接出来
5. `Model 0` 接到 `ws_filltable_submit_out`
6. `forward_workspace_filltable_submit_from_model0` 发到双总线
7. `MBR -> remote-worker`
8. `remote-worker` 返回 patch
9. `ui-server` 把 `snapshot_delta` 路由到 `Model 1010` 的 owner materialization
10. `generated_color_text` 更新，页面重新显示

## 5. 本地模式

本地模式不改页面结构，只改路由标签。

要切到本地模式，请把 `Model 1010 / (1,0,0) / processor_routes` 改成：

```json
[
  {
    "from": "(self, confirm)",
    "to": [
      "(func, dispatch_local:in)"
    ]
  }
]
```

此时：

- `Confirm` 仍然先进入 `Model 1010`
- 但不会再走双总线
- 而是改由 `dispatch_local` 在当前模型内计算颜色字符串
- 然后通过 helper cell `(0,1,0)` 的 `owner_apply -> owner_materialize` 更新：
  - `generated_color_text`
  - `result_status`
  - `submit_inflight`

因此这条本地链仍然遵守当前规约：
- 用户程序本身不直接拿全局 patch 权限
- 真正落表还是通过本模型 owner/helper 执行

## 6. 只改标签就能影响界面

本示例至少有三条直接可见的参数：

- `Model 1010 / layout_direction`
  - `row`
  - `row-reverse`
- `Model 1010 / input_font_size`
  - 例如 `18px`、`24px`
- `Model 1010 / button_color`
  - 例如 `#2563EB`、`#DC2626`

推荐试法：

1. 把 `layout_direction` 从 `row` 改成 `row-reverse`
2. 刷新或等待页面同步后，Input 和 Button 左右顺序会互换
3. 把 `input_font_size` 改成 `24px`
4. 输入框字号会变大
5. 把 `button_color` 改成 `#DC2626`
6. 按钮背景色会变化

如果只改这些标签，链路不变；变的是页面外观。

## 7. 通过 Home 调试页新建正数模型

当前首页调试 CRUD 已支持一种可复现的新建方式：

1. 打开 `Home`
2. 点击 `Add Label`
3. 手动填写一个新的正数 `model_id`
4. 把目标设为：
   - `p=0`
   - `r=0`
   - `c=0`
   - `k=model_type`
   - `t=model.table` 或 `model.single` / `model.matrix`
5. 填写 `value_text`
   - 例如 `UI.RebuildExample`
6. 点击 `Save`

当目标正数模型不存在时：
- 这次保存会先自动创建该模型
- 然后再把根格 `model_type` 写进去

这条能力是为了让用户可以用调试表单真正从空表起步，而不是只能改现成模型。

## 8. 重建练习

推荐按下面顺序做重建，而不是一上来就改所有表项：

### 8.1 重建 `Model 1010`

先保证根格至少有：

- `model_type`
- `dual_bus_model`
- `input_draft`
- `generated_color_text`
- `result_status`
- `submit_inflight`
- `submit_route_mode`
- `layout_direction`
- `input_font_size`
- `button_variant`
- `button_color`

然后补：

- `(1,0,0) / confirm`
- `(1,0,0) / processor_routes`
- `(1,0,0) / dispatch_remote`
- `(1,0,0) / dispatch_local`

### 8.2 重建 `Model 1009`

再补 app host：

- `app_name`
- `ui_authoring_version`
- `ui_root_node_id`
- `submit`
- `submit_request`
- `submit_request_wiring`
- `host_submit_routes`
- `emit_submit`

然后补挂载：

- `Model 1009 / (0,2,0) / model_type = model.submt -> 1010`

再补 UI 节点：

- 根容器
- 控件容器
- Input
- Button
- Text

### 8.3 重建 Workspace 挂载

最后补：

- `Model 0 -> 1009` 的 `model.submt`
- `-2 / ws_apps_registry` 中的 app 条目

做完后刷新页面，新的 Workspace 侧边栏条目应重新出现。

## 9. 建议验证顺序

每次重建或改表后，按这个顺序检查最省时间：

1. `Home` 中目标标签是否真的写进去
2. `Workspace` 侧边栏里是否出现 `0270 Fill-Table Workspace UI`
3. 点击 `Open` 后右侧是否出现 `Input + Button + Label`
4. 远端模式下点击 `Confirm` 是否返回新的颜色字符串
5. 切成本地模式后点击 `Confirm` 是否仍返回颜色字符串
6. 改 `layout_direction / input_font_size / button_color` 后页面是否立即变化

## 10. 常见故障

### 点击 Confirm 没反应

先查：

- `Model 1010 / ui_event` 是否被写入
- `prepare_workspace_filltable_submit` 是否存在
- `processor_routes` 当前是不是接到了正确函数

### 远端模式一直 loading

先查：

- `Model 0 / ws_filltable_submit_out`
- `MBR` 是否包含 `1010`
- `remote-worker` 是否加载了 `11_model1010.json`

### 页面有条目但 Open 后右侧空白

先查：

- `Model 1009 / app_name`
- `Model 1009 / ui_root_node_id`
- `Input / Button / Text` 这些 UI 节点标签是否完整

### 本地模式还能出总线

先查：

- `Model 1010 / (1,0,0) / processor_routes`
- 是否仍然连到 `dispatch_remote`

